import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const HUB_BASE = "https://vvqbrpuiqzksygpcmrmg.supabase.co/functions/v1";

// In-memory partner-portal session cache (per-instance). 12h TTL on Hub side;
// we refresh 30 min early.
let sessionCache: { token: string; expires_at: number } | null = null;

async function getPartnerToken(apiKey: string): Promise<string> {
  const now = Date.now();
  if (sessionCache && sessionCache.expires_at - 30 * 60 * 1000 > now) {
    return sessionCache.token;
  }
  const r = await fetch(`${HUB_BASE}/partner-portal-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify({}),
  });
  const data = await safeJson(r);
  if (!r.ok || !data?.token) {
    throw new Error(data?.error || "Failed to create partner session");
  }
  sessionCache = {
    token: data.token,
    expires_at: new Date(data.expires_at).getTime(),
  };
  return data.token;
}

async function portal(apiKey: string, payload: Record<string, unknown>) {
  const token = await getPartnerToken(apiKey);
  const r = await fetch(`${HUB_BASE}/partner-portal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, ...payload }),
  });
  const data = await safeJson(r);
  // Retry once if session expired
  if (r.status === 401) {
    sessionCache = null;
    const t2 = await getPartnerToken(apiKey);
    const r2 = await fetch(`${HUB_BASE}/partner-portal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: t2, ...payload }),
    });
    return { data: await safeJson(r2), status: r2.status };
  }
  return { data, status: r.status };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const apiKey = Deno.env.get("DELIVERY_API_KEY");
  if (!apiKey) return json({ error: "DELIVERY_API_KEY not configured" }, 500);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: claims, error: authErr } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
  if (authErr || !claims?.claims?.sub) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: isAdmin } = await admin.rpc("is_admin", { _user_id: claims.claims.sub });
  if (!isAdmin) return json({ error: "Forbidden" }, 403);

  try {
    const body = await req.json();
    const { action, external_order_id, status, note, driver_id, order_id } = body;

    // Resolve local order → external id if needed
    const resolveExternal = async (): Promise<string | null> => {
      if (external_order_id) return external_order_id;
      if (!order_id) return null;
      const { data } = await admin
        .from("orders")
        .select("delivery_external_id")
        .eq("id", order_id)
        .maybeSingle();
      return (data?.delivery_external_id as string) || null;
    };

    // Find Hub's order UUID (partner-portal wants Hub order_id, not external_order_id)
    const findHubOrderId = async (ext: string): Promise<string | null> => {
      const r = await fetch(`${HUB_BASE}/delivery-status-check?external_order_id=${encodeURIComponent(ext)}`, {
        headers: { "x-api-key": apiKey },
      });
      const d = await safeJson(r);
      return (d?.order_id as string) || (d?.hub_order_id as string) || null;
    };

    if (action === "status_check") {
      const ext = await resolveExternal();
      if (!ext) return json({ error: "Missing external_order_id" }, 400);
      const r = await fetch(`${HUB_BASE}/delivery-status-check?external_order_id=${encodeURIComponent(ext)}`, {
        headers: { "x-api-key": apiKey },
      });
      return json(await safeJson(r), r.status);
    }

    if (action === "list_drivers") {
      const { data, status } = await portal(apiKey, { action: "list_drivers" });
      return json(data, status);
    }

    if (action === "assign_driver") {
      const ext = await resolveExternal();
      if (!ext) return json({ error: "Missing external_order_id" }, 400);
      const hubId = await findHubOrderId(ext);
      if (!hubId) return json({ error: "Hub order not found" }, 404);
      const { data, status } = await portal(apiKey, {
        action: "assign_driver",
        order_id: hubId,
        driver_id: driver_id || null,
      });
      return json(data, status);
    }

    if (action === "update_fulfillment") {
      const ext = await resolveExternal();
      if (!ext || !status) return json({ error: "Missing fields" }, 400);
      const hubId = await findHubOrderId(ext);
      if (!hubId) return json({ error: "Hub order not found" }, 404);
      const { data, status: st } = await portal(apiKey, {
        action: "update_fulfillment",
        order_id: hubId,
        status,
      });
      return json(data, st);
    }

    if (action === "update_payment") {
      const ext = await resolveExternal();
      if (!ext || !status) return json({ error: "Missing fields" }, 400);
      const hubId = await findHubOrderId(ext);
      if (!hubId) return json({ error: "Hub order not found" }, 404);
      const { data, status: st } = await portal(apiKey, {
        action: "update_payment",
        order_id: hubId,
        status,
      });
      return json(data, st);
    }

    // Legacy: kept for backwards compatibility
    if (action === "status_update") {
      if (!external_order_id || !status) return json({ error: "Missing fields" }, 400);
      const r = await fetch(`${HUB_BASE}/status-update-inbound`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify({ external_order_id, status, note: note || "" }),
      });
      return json(await safeJson(r), r.status);
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
});

async function safeJson(r: Response) {
  const t = await r.text();
  try { return JSON.parse(t); } catch { return { raw: t }; }
}
function json(d: any, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
