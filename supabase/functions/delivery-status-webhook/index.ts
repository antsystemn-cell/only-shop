import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
};

/**
 * Webhook endpoint for the delivery system to push status updates back.
 * 
 * POST /delivery-status-webhook
 * Headers: x-api-key: <DELIVERY_API_KEY>
 * Body: {
 *   external_order_id: "SHOP-<uuid>",
 *   fulfillment_status: "confirmed" | "phone_confirmed" | "out_for_delivery" | "delivered" | "cancelled",
 *   payment_status?: "unpaid" | "cash" | "paid" | "refunded",
 *   note?: string
 * }
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const deliveryApiKey = Deno.env.get("DELIVERY_API_KEY");

  // Authenticate with API key
  const incomingKey = req.headers.get("x-api-key");
  if (!deliveryApiKey || incomingKey !== deliveryApiKey) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json();
    const { external_order_id, fulfillment_status, payment_status, note } = body;

    if (!external_order_id) {
      return jsonResponse({ error: "external_order_id is required" }, 400);
    }

    // Extract order ID from external_order_id (format: "SHOP-<uuid>")
    const orderId = external_order_id.replace(/^SHOP-/, "");
    if (!orderId) {
      return jsonResponse({ error: "Invalid external_order_id format" }, 400);
    }

    // Validate statuses
    const validFulfillment = ["confirmed", "phone_confirmed", "out_for_delivery", "delivered", "cancelled"];
    const validPayment = ["unpaid", "cash", "paid", "refunded"];

    if (fulfillment_status && !validFulfillment.includes(fulfillment_status)) {
      return jsonResponse({ error: `Invalid fulfillment_status. Must be one of: ${validFulfillment.join(", ")}` }, 400);
    }
    if (payment_status && !validPayment.includes(payment_status)) {
      return jsonResponse({ error: `Invalid payment_status. Must be one of: ${validPayment.join(", ")}` }, 400);
    }

    // Fetch current order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, fulfillment_status, payment_status, status")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return jsonResponse({ error: "Order not found" }, 404);
    }

    // Build update
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (fulfillment_status && fulfillment_status !== order.fulfillment_status) {
      updateData.fulfillment_status = fulfillment_status;
      
      // Map to legacy status
      const legacyMap: Record<string, string> = {
        confirmed: "pending",
        phone_confirmed: "processing",
        out_for_delivery: "shipped",
        delivered: "delivered",
        cancelled: "cancelled",
      };
      updateData.status = legacyMap[fulfillment_status] || "pending";

      // Set timestamps
      if (fulfillment_status === "delivered") updateData.delivered_at = new Date().toISOString();
      if (fulfillment_status === "cancelled") updateData.cancelled_at = new Date().toISOString();
    }

    if (payment_status && payment_status !== order.payment_status) {
      updateData.payment_status = payment_status;
    }

    // Apply update
    const { error: updateError } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", orderId);

    if (updateError) {
      console.error("Update error:", updateError);
      return jsonResponse({ error: "Failed to update order" }, 500);
    }

    // Log status change
    const logData: Record<string, any> = {
      order_id: orderId,
      note: note || "Хүргэлтийн системээс шинэчлэгдсэн",
    };
    if (fulfillment_status && fulfillment_status !== order.fulfillment_status) {
      logData.old_fulfillment_status = order.fulfillment_status;
      logData.new_fulfillment_status = fulfillment_status;
    }
    if (payment_status && payment_status !== order.payment_status) {
      logData.old_payment_status = order.payment_status;
      logData.new_payment_status = payment_status;
    }

    await supabase.from("order_status_logs").insert(logData);

    // Audit log
    await supabase.from("audit_logs").insert({
      action: "delivery_webhook_status_update",
      entity_type: "order",
      entity_id: orderId,
      details: {
        external_order_id,
        fulfillment_status,
        payment_status,
        note,
        previous: {
          fulfillment_status: order.fulfillment_status,
          payment_status: order.payment_status,
        },
      },
    });

    return jsonResponse({
      success: true,
      order_id: orderId,
      updated: {
        fulfillment_status: fulfillment_status || order.fulfillment_status,
        payment_status: payment_status || order.payment_status,
      },
    });
  } catch (err: any) {
    console.error("Webhook error:", err);
    return jsonResponse({ error: err.message }, 500);
  }
});

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
