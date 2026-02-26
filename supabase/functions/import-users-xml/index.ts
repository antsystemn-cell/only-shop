import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parse } from "https://esm.sh/fast-xml-parser@4.3.2";

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

interface ImportResult {
  total: number;
  toInsert: number;
  toMerge: number;
  toSkip: number;
  skipReasons: Array<{ legacy_id: string; reason: string }>;
  sampleRows: ParsedUser[];
  inserted?: number;
  merged?: number;
  skipped?: number;
  errors?: Array<{ legacy_id: string; error: string }>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify admin
    const userClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: isAdmin } = await adminClient.rpc("is_admin", { _user_id: user.id });
    if (!isAdmin) {
      return json({ error: "Admin access required" }, 403);
    }

    const body = await req.json();
    const { action, xmlContent, sourceFile, dryRun } = body;

    if (action === "import_users_xml") {
      return await importUsersFromXml(adminClient, xmlContent, sourceFile, dryRun, user.id);
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

function parseUsersXml(xmlContent: string): ParsedUser[] {
  const parsed = parse(xmlContent, {
    ignoreAttributes: false,
    trimValues: true,
    parseTagValue: false,
  });

  const usersRoot = parsed?.Users?.User;
  if (!usersRoot) return [];

  const rawUsers = Array.isArray(usersRoot) ? usersRoot : [usersRoot];

  return rawUsers.map((u: Record<string, unknown>) => {
    const email = normalizeEmail(String(u.Email || ""));
    const phone = normalizePhone(String(u.Phone || ""));
    const firstName = String(u.FirstName || "").trim();
    const lastName = String(u.LastName || "").trim();
    const fio = String(u.FIO || "").trim();

    return {
      legacy_id: String(u.OtapiId || ""),
      login: String(u.Login || "").trim(),
      email,
      phone,
      first_name: firstName,
      last_name: lastName,
      full_name: fio || [lastName, firstName].filter(Boolean).join(" ") || "",
    };
  });
}

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim().replace(/\s+/g, "");
}

function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-\(\)]/g, "").trim();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function importUsersFromXml(
  supabase: ReturnType<typeof createClient>,
  xmlContent: string,
  sourceFile: string,
  dryRun: boolean,
  adminUserId: string
): Promise<Response> {
  const startedAt = new Date().toISOString();
  const users = parseUsersXml(xmlContent);

  if (users.length === 0) {
    return json({ success: false, error: "XML-д хэрэглэгч олдсонгүй" });
  }

  // Fetch existing profiles by ot_user_id
  const { data: existingByLegacy } = await supabase
    .from("profiles")
    .select("ot_user_id, email, user_id");

  const legacyIdSet = new Set((existingByLegacy || []).map((p) => p.ot_user_id));
  const emailSet = new Set((existingByLegacy || []).map((p) => p.email?.toLowerCase()));

  // Deduplicate within the XML itself
  const seenLegacyIds = new Set<string>();
  const seenEmails = new Set<string>();

  const toInsert: ParsedUser[] = [];
  const toMerge: Array<{ user: ParsedUser; existingUserId?: string }> = [];
  const toSkip: Array<{ legacy_id: string; reason: string }> = [];

  for (const user of users) {
    // Skip duplicates within the same file
    if (user.legacy_id && seenLegacyIds.has(user.legacy_id)) {
      toSkip.push({ legacy_id: user.legacy_id, reason: "XML файл доторх давхардал" });
      continue;
    }

    // Skip if no email AND no phone
    if (!user.email && !user.phone) {
      toSkip.push({
        legacy_id: user.legacy_id,
        reason: "Имэйл болон утасны дугаар алга",
      });
      continue;
    }

    if (user.legacy_id) seenLegacyIds.add(user.legacy_id);
    if (user.email) seenEmails.add(user.email);

    // Check if legacy_id already exists in DB
    if (user.legacy_id && legacyIdSet.has(user.legacy_id)) {
      toSkip.push({
        legacy_id: user.legacy_id,
        reason: "legacy_id аль хэдийн бүртгэлтэй",
      });
      continue;
    }

    // Check if email already exists
    if (user.email && emailSet.has(user.email)) {
      const existing = (existingByLegacy || []).find(
        (p) => p.email?.toLowerCase() === user.email
      );
      toMerge.push({ user, existingUserId: existing?.user_id });
      continue;
    }

    toInsert.push(user);
  }

  const result: ImportResult = {
    total: users.length,
    toInsert: toInsert.length,
    toMerge: toMerge.length,
    toSkip: toSkip.length,
    skipReasons: toSkip.slice(0, 200),
    sampleRows: users.slice(0, 10),
  };

  if (dryRun) {
    return json({ success: true, dryRun: true, result });
  }

  // ─── Actual Import ────────────────────────────────────
  let insertedCount = 0;
  let mergedCount = 0;
  let skippedCount = toSkip.length;
  const errors: Array<{ legacy_id: string; error: string }> = [];

  // Batch insert new users (100 per batch)
  const BATCH_SIZE = 100;
  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const batch = toInsert.slice(i, i + BATCH_SIZE);
    const rows = batch.map((u) => ({
      ot_user_id: u.legacy_id || null,
      email: u.email || `${u.login || u.legacy_id}@imported.local`,
      full_name: u.full_name || u.login || "",
      phone: u.phone || null,
      user_id: crypto.randomUUID(), // placeholder since no auth user yet
    }));

    const { error: insertError } = await supabase.from("profiles").insert(rows);

    if (insertError) {
      // Fall back to individual inserts
      for (const row of rows) {
        const { error: singleError } = await supabase.from("profiles").insert(row);
        if (singleError) {
          errors.push({
            legacy_id: row.ot_user_id || "unknown",
            error: singleError.message,
          });
        } else {
          insertedCount++;
        }
      }
    } else {
      insertedCount += batch.length;
    }
  }

  // Merge existing users (update non-critical fields)
  for (const { user, existingUserId } of toMerge) {
    if (!existingUserId) {
      skippedCount++;
      continue;
    }

    const updates: Record<string, unknown> = {};
    if (user.full_name) updates.full_name = user.full_name;
    if (user.phone) updates.phone = user.phone;
    if (user.legacy_id) updates.ot_user_id = user.legacy_id;

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from("profiles")
        .update(updates)
        .eq("user_id", existingUserId);

      if (updateError) {
        errors.push({ legacy_id: user.legacy_id, error: updateError.message });
      } else {
        mergedCount++;
      }
    } else {
      skippedCount++;
    }
  }

  // Log the migration
  await supabase.from("migration_jobs").insert({
    job_type: "user_xml_import",
    status: errors.length > 0 ? "completed_with_errors" : "completed",
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    created_by: adminUserId,
    total_count: users.length,
    processed_count: insertedCount + mergedCount + skippedCount,
    success_count: insertedCount + mergedCount,
    error_count: errors.length,
    errors: errors.slice(0, 100),
    params: {
      source_file: sourceFile,
      inserted: insertedCount,
      merged: mergedCount,
      skipped: skippedCount,
    },
  });

  result.inserted = insertedCount;
  result.merged = mergedCount;
  result.skipped = skippedCount;
  result.errors = errors.slice(0, 100);

  return json({ success: true, dryRun: false, result });
}
