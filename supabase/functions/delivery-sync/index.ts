import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DELIVERY_API_URL =
  "https://vvqbrpuiqzksygpcmrmg.supabase.co/functions/v1/order-intake";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const deliveryApiKey = Deno.env.get("DELIVERY_API_KEY");

  if (!deliveryApiKey) {
    return new Response(
      JSON.stringify({ error: "DELIVERY_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json();
    const { action, order_id, order_ids } = body;

    if (action === "retry_all_failed") {
      return await retryAllFailed(supabase, deliveryApiKey);
    }

    if (action === "sync_batch" && Array.isArray(order_ids)) {
      const results = [];
      for (const oid of order_ids) {
        const r = await syncSingleOrder(supabase, deliveryApiKey, oid);
        results.push({ order_id: oid, ...r });
      }
      return jsonResponse({ results });
    }

    if (order_id) {
      const result = await syncSingleOrder(supabase, deliveryApiKey, order_id);
      return jsonResponse(result);
    }

    return jsonResponse({ error: "Missing order_id or action" }, 400);
  } catch (err: any) {
    console.error("Delivery sync error:", err);
    return jsonResponse({ error: err.message }, 500);
  }
});

async function syncSingleOrder(
  supabase: any,
  apiKey: string,
  orderId: string
) {
  // Fetch order with items
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    await updateSyncStatus(supabase, orderId, "failed", "Order not found");
    return { success: false, error: "Order not found" };
  }

  // Skip if already synced
  if (order.delivery_sync_status === "synced") {
    return { success: true, message: "Already synced" };
  }

  // GUARD: skip manual / historical / non-website sales unless explicitly requested
  if (
    order.delivery_sync_status === "disabled" ||
    order.should_create_delivery === false ||
    order.delivery_creation_mode === "none"
  ) {
    return { success: true, message: "Delivery disabled for this sale (manual/historical)" };
  }

  // Validate required fields
  const validationError = validateOrder(order);
  if (validationError) {
    await updateSyncStatus(supabase, orderId, "failed", validationError);
    return { success: false, error: validationError };
  }

  // Build payload
  const externalOrderId = `SHOP-${order.id}`;
  const deliveryAddress = order.delivery_address || {};

  const payload: any = {
    external_order_id: externalOrderId,
    customer_name: order.customer_name || deliveryAddress.name || "—",
    phone: order.customer_phone || deliveryAddress.phone || "",
    alternate_phone: order.alternate_phone || "",
    district: deliveryAddress.district || "",
    address_text:
      order.address_text ||
      [deliveryAddress.street_address, deliveryAddress.apartment]
        .filter(Boolean)
        .join(", ") ||
      "",
    delivery_note: order.delivery_note || order.notes || "",
    payment_method: order.payment_method || "qpay",
    payment_status: mapPaymentStatus(order.payment_status),
    delivery_fee: Number(order.delivery_fee) || 0,
    subtotal: Number(order.subtotal) || 0,
    total_amount: Number(order.total) || 0,
    source_channel: "website",
    customer_note: order.notes || "",
    items: (order.order_items || []).map((item: any) => {
      const snapshot = item.product_snapshot || {};
      return {
        product_name:
          item.product_name_snapshot ||
          snapshot.name_mn ||
          snapshot.name ||
          "Бараа",
        sku: item.sku_snapshot || "",
        variant: [item.color_snapshot, item.size_snapshot]
          .filter(Boolean)
          .join(" / ") || item.variant_name_snapshot || "",
        quantity: item.quantity,
        unit_price: Number(item.unit_price) || 0,
      };
    }),
  };

  // Send to delivery API
  try {
    const response = await fetch(DELIVERY_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
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
      await supabase
        .from("orders")
        .update({
          delivery_sync_status: "synced",
          delivery_sync_error: null,
          delivery_attempt_count: (order.delivery_attempt_count || 0) + 1,
          delivery_last_attempt_at: new Date().toISOString(),
          delivery_external_id: externalOrderId,
        })
        .eq("id", orderId);

      // Log success
      await logSync(supabase, orderId, "success", payload, responseData);

      return { success: true, external_id: externalOrderId };
    } else {
      const errMsg = `API ${response.status}: ${responseData?.error || responseText.substring(0, 200)}`;
      await updateSyncStatus(supabase, orderId, "failed", errMsg, order.delivery_attempt_count);
      await logSync(supabase, orderId, "failed", payload, responseData, errMsg);
      return { success: false, error: errMsg };
    }
  } catch (fetchErr: any) {
    const errMsg = `Network error: ${fetchErr.message}`;
    await updateSyncStatus(supabase, orderId, "failed", errMsg, order.delivery_attempt_count);
    await logSync(supabase, orderId, "failed", payload, null, errMsg);
    return { success: false, error: errMsg };
  }
}

async function retryAllFailed(supabase: any, apiKey: string) {
  const { data: failedOrders } = await supabase
    .from("orders")
    .select("id")
    .in("delivery_sync_status", ["failed", "pending"])
    .order("created_at", { ascending: true })
    .limit(50);

  if (!failedOrders || failedOrders.length === 0) {
    return jsonResponse({ message: "No failed orders to retry", count: 0 });
  }

  const results = [];
  for (const o of failedOrders) {
    const r = await syncSingleOrder(supabase, apiKey, o.id);
    results.push({ order_id: o.id, ...r });
  }

  const synced = results.filter((r) => r.success).length;
  return jsonResponse({
    message: `Retried ${results.length} orders, ${synced} synced`,
    count: results.length,
    synced,
    results,
  });
}

function validateOrder(order: any): string | null {
  const addr = order.delivery_address || {};
  const phone = order.customer_phone || addr.phone;
  if (!phone) return "Утасны дугаар байхгүй";
  const address = order.address_text || addr.street_address;
  if (!address) return "Хаяг байхгүй";
  if (!order.order_items || order.order_items.length === 0) return "Бараа байхгүй";
  if (!order.total || Number(order.total) <= 0) return "Нийт дүн буруу";
  return null;
}

function mapPaymentStatus(status: string | null): string {
  switch (status) {
    case "paid":
      return "paid";
    case "cash_on_delivery":
      return "cash_on_delivery";
    case "refunded":
      return "refunded";
    default:
      return "unpaid";
  }
}

async function updateSyncStatus(
  supabase: any,
  orderId: string,
  status: string,
  error: string,
  prevCount?: number
) {
  await supabase
    .from("orders")
    .update({
      delivery_sync_status: status,
      delivery_sync_error: error,
      delivery_attempt_count: (prevCount || 0) + 1,
      delivery_last_attempt_at: new Date().toISOString(),
    })
    .eq("id", orderId);
}

async function logSync(
  supabase: any,
  orderId: string,
  status: string,
  payload: any,
  response: any,
  error?: string
) {
  try {
    await supabase.from("audit_logs").insert({
      action: `delivery_sync_${status}`,
      entity_type: "order",
      entity_id: orderId,
      details: {
        payload_summary: {
          external_order_id: payload.external_order_id,
          total_amount: payload.total_amount,
          items_count: payload.items?.length,
        },
        response,
        error,
      },
    });
  } catch (e) {
    console.error("Failed to log sync:", e);
  }
}

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
