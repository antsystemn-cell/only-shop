import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const HUB_BASE = "https://vvqbrpuiqzksygpcmrmg.supabase.co/functions/v1";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const apiKey = Deno.env.get("DELIVERY_API_KEY");
  if (!apiKey) return json({ error: "DELIVERY_API_KEY not configured" }, 500);

  // Verify caller is admin
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
    const { action, external_order_id, status, note } = body;

    if (action === "status_check") {
      if (!external_order_id) return json({ error: "Missing external_order_id" }, 400);
      const r = await fetch(`${HUB_BASE}/delivery-status-check?external_order_id=${encodeURIComponent(external_order_id)}`, {
        headers: { "x-api-key": apiKey },
      });
      const data = await safeJson(r);
      return json(data, r.status);
    }

    if (action === "status_update") {
      if (!external_order_id || !status) return json({ error: "Missing fields" }, 400);
      const r = await fetch(`${HUB_BASE}/status-update-inbound`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify({ external_order_id, status, note: note || "" }),
      });
      const data = await safeJson(r);
      return json(data, r.status);
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
