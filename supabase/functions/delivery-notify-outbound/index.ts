import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DELIVERY_STATUS_URL =
  "https://vvqbrpuiqzksygpcmrmg.supabase.co/functions/v1/status-update-inbound";

/**
 * Outbound: Notify delivery system when shop order status changes.
 * 
 * POST /delivery-notify-outbound
 * Body: {
 *   external_order_id: "SHOP-<uuid>",
 *   fulfillment_status?: string,
 *   payment_status?: string
 * }
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const deliveryApiKey = Deno.env.get("DELIVERY_API_KEY");
  if (!deliveryApiKey) {
    return jsonResponse({ error: "DELIVERY_API_KEY not configured" }, 500);
  }

  try {
    const body = await req.json();
    const { external_order_id, fulfillment_status, payment_status } = body;

    if (!external_order_id) {
      return jsonResponse({ error: "external_order_id is required" }, 400);
    }

    if (!fulfillment_status && !payment_status) {
      return jsonResponse({ error: "At least one status field is required" }, 400);
    }

    // Build payload for delivery system
    const payload: Record<string, string> = { external_order_id };
    if (fulfillment_status) payload.fulfillment_status = fulfillment_status;
    if (payment_status) payload.payment_status = payment_status;

    // Send to delivery system
    const response = await fetch(DELIVERY_STATUS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": deliveryApiKey,
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    let responseData: any;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    if (response.ok) {
      console.log(`Notified delivery system for ${external_order_id}:`, responseData);
      return jsonResponse({ success: true, delivery_response: responseData });
    } else {
      console.error(`Delivery notify failed for ${external_order_id}: ${response.status}`, responseData);
      return jsonResponse({
        success: false,
        error: `Delivery API ${response.status}`,
        delivery_response: responseData,
      }, 502);
    }
  } catch (err: any) {
    console.error("Delivery notify outbound error:", err);
    return jsonResponse({ error: err.message }, 500);
  }
});

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
