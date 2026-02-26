import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { XMLParser } from "https://esm.sh/fast-xml-parser@4.3.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ParsedUser {
  legacy_id: string;
  login: string;
  email: string;
  phone: string;
  first_name: string;
  last_name: string;
  full_name: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "Unauthorized" }, 401);

    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: isAdmin } = await adminClient.rpc("is_admin", { _user_id: user.id });
    if (!isAdmin) return json({ error: "Admin access required" }, 403);

    const body = await req.json();
    const { action } = body;

    if (action === "parse_xml") {
      return parseAndClassify(adminClient, body.xmlContent);
    }

    if (action === "import_batch") {
      return importBatch(adminClient, body.users, body.mode, user.id);
    }

    if (action === "log_migration") {
      return logMigration(adminClient, body, user.id);
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (error: unknown) {
    console.error("[import-users-xml] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return json({ success: false, error: message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── Action 1: Parse XML and classify users ─────────────────────
async function parseAndClassify(
  supabase: ReturnType<typeof createClient>,
  xmlContent: string
): Promise<Response> {
  const users = parseUsersXml(xmlContent);
  if (users.length === 0) {
    return json({ success: false, error: "XML-д хэрэглэгч олдсонгүй" });
  }

  // Fetch existing profiles
  const { data: existingProfiles } = await supabase
    .from("profiles")
    .select("ot_user_id, email, user_id");

  const legacyIdSet = new Set((existingProfiles || []).map((p) => p.ot_user_id));
  const emailMap = new Map(
    (existingProfiles || [])
      .filter((p) => p.email)
      .map((p) => [p.email!.toLowerCase(), p.user_id])
  );

  const seenLegacyIds = new Set<string>();
  const toInsert: ParsedUser[] = [];
  const toMerge: Array<{ user: ParsedUser; existingUserId: string }> = [];
  const toSkip: Array<{ legacy_id: string; reason: string }> = [];

  for (const user of users) {
    if (user.legacy_id && seenLegacyIds.has(user.legacy_id)) {
      toSkip.push({ legacy_id: user.legacy_id, reason: "XML файл доторх давхардал" });
      continue;
    }
    if (!user.email && !user.phone) {
      toSkip.push({ legacy_id: user.legacy_id, reason: "Имэйл болон утасны дугаар алга" });
      continue;
    }
    if (user.legacy_id) seenLegacyIds.add(user.legacy_id);

    if (user.legacy_id && legacyIdSet.has(user.legacy_id)) {
      toSkip.push({ legacy_id: user.legacy_id, reason: "legacy_id аль хэдийн бүртгэлтэй" });
      continue;
    }
    if (user.email && emailMap.has(user.email)) {
      toMerge.push({ user, existingUserId: emailMap.get(user.email)! });
      continue;
    }
    toInsert.push(user);
  }

  return json({
    success: true,
    result: {
      total: users.length,
      toInsert: toInsert.length,
      toMerge: toMerge.length,
      toSkip: toSkip.length,
      skipReasons: toSkip.slice(0, 200),
      sampleRows: users.slice(0, 10),
      // Send classified data back so frontend can chunk it
      insertUsers: toInsert,
      mergeUsers: toMerge,
    },
  });
}

// ─── Action 2: Import a batch of users ──────────────────────────
async function importBatch(
  supabase: ReturnType<typeof createClient>,
  users: Array<{ user: ParsedUser; existingUserId?: string }>,
  mode: "insert" | "merge",
  _adminUserId: string
): Promise<Response> {
  let successCount = 0;
  const errors: Array<{ legacy_id: string; error: string }> = [];

  if (mode === "insert") {
    for (const u of users) {
      try {
        const email = u.user.email || `${u.user.login || u.user.legacy_id}@imported.local`;
        
        // 1) Create auth user first via admin API
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: {
            full_name: u.user.full_name || u.user.login || "",
            imported: true,
          },
        });

        if (authError) {
          errors.push({ legacy_id: u.user.legacy_id, error: `Auth: ${authError.message}` });
          continue;
        }

        const authUserId = authData.user.id;

        // 2) Update the auto-created profile with legacy data
        const updates: Record<string, unknown> = {};
        if (u.user.legacy_id) updates.ot_user_id = u.user.legacy_id;
        if (u.user.full_name) updates.full_name = u.user.full_name;
        if (u.user.phone) updates.phone = u.user.phone;

        if (Object.keys(updates).length > 0) {
          const { error: profileError } = await supabase
            .from("profiles")
            .update(updates)
            .eq("user_id", authUserId);
          if (profileError) {
            console.warn(`[import] Profile update warning for ${u.user.legacy_id}: ${profileError.message}`);
          }
        }

        successCount++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        errors.push({ legacy_id: u.user.legacy_id, error: msg });
      }
    }
  } else {
    // Merge mode
    for (const { user, existingUserId } of users) {
      if (!existingUserId) continue;
      const updates: Record<string, unknown> = {};
      if (user.full_name) updates.full_name = user.full_name;
      if (user.phone) updates.phone = user.phone;
      if (user.legacy_id) updates.ot_user_id = user.legacy_id;

      if (Object.keys(updates).length > 0) {
        const { error } = await supabase
          .from("profiles")
          .update(updates)
          .eq("user_id", existingUserId);
        if (error) {
          errors.push({ legacy_id: user.legacy_id, error: error.message });
        } else {
          successCount++;
        }
      }
    }
  }

  return json({ success: true, successCount, errorCount: errors.length, errors });
}

// ─── Action 3: Log migration result ────────────────────────────
async function logMigration(
  supabase: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
  adminUserId: string
): Promise<Response> {
  await supabase.from("migration_jobs").insert({
    job_type: "user_xml_import",
    status: body.status as string,
    started_at: body.startedAt as string,
    completed_at: new Date().toISOString(),
    created_by: adminUserId,
    total_count: body.totalCount as number,
    processed_count: body.processedCount as number,
    success_count: body.successCount as number,
    error_count: body.errorCount as number,
    errors: body.errors,
    params: { source_file: body.sourceFile },
  });

  return json({ success: true });
}

// ─── XML Parser ─────────────────────────────────────────────────
function parseUsersXml(xmlContent: string): ParsedUser[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    trimValues: true,
    parseTagValue: false,
  });
  const parsed = parser.parse(xmlContent);
  const usersRoot = parsed?.Users?.User;
  if (!usersRoot) return [];
  const rawUsers = Array.isArray(usersRoot) ? usersRoot : [usersRoot];

  return rawUsers.map((u: Record<string, unknown>) => ({
    legacy_id: String(u.OtapiId || ""),
    login: String(u.Login || "").trim(),
    email: normalizeEmail(String(u.Email || "")),
    phone: normalizePhone(String(u.Phone || "")),
    first_name: String(u.FirstName || "").trim(),
    last_name: String(u.LastName || "").trim(),
    full_name:
      String(u.FIO || "").trim() ||
      [String(u.LastName || "").trim(), String(u.FirstName || "").trim()]
        .filter(Boolean)
        .join(" ") ||
      "",
  }));
}

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim().replace(/\s+/g, "");
}

function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-\(\)]/g, "").trim();
}
