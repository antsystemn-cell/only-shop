import { supabase } from "@/integrations/supabase/client";

/**
 * Triggers delivery sync for an order (fire-and-forget).
 * Never throws — errors are stored in the orders table.
 */
export async function triggerDeliverySync(orderId: string): Promise<void> {
  try {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const url = `https://${projectId}.supabase.co/functions/v1/delivery-sync`;

    const { data: { session } } = await supabase.auth.getSession();
    
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ order_id: orderId }),
    }).catch((err) => {
      console.error("Delivery sync fire-and-forget failed:", err);
    });
  } catch (err) {
    console.error("Delivery sync trigger error:", err);
  }
}

/**
 * Retry sync for a specific order (awaits result).
 */
export async function retryDeliverySync(orderId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke("delivery-sync", {
      body: { order_id: orderId },
    });
    if (error) return { success: false, error: error.message };
    return data;
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Retry all failed/pending syncs.
 */
export async function retryAllFailedSyncs(): Promise<{ success: boolean; synced?: number; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke("delivery-sync", {
      body: { action: "retry_all_failed" },
    });
    if (error) return { success: false, error: error.message };
    return { success: true, synced: data?.synced || 0 };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Notify delivery system when order status changes (fire-and-forget).
 * Sends to the delivery platform's status-update-inbound endpoint.
 */
export async function notifyDeliveryStatusChange(
  orderId: string,
  fulfillmentStatus?: string,
  paymentStatus?: string
): Promise<void> {
  try {
    // Only notify if order has been synced to delivery system
    const { data: order } = await supabase
      .from("orders")
      .select("delivery_sync_status, delivery_external_id")
      .eq("id", orderId)
      .single();

    if (!order || order.delivery_sync_status !== "synced" || !order.delivery_external_id) {
      return; // Not synced yet, skip notification
    }

    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const url = `https://${projectId}.supabase.co/functions/v1/delivery-notify-outbound`;

    const { data: { session } } = await supabase.auth.getSession();

    const body: Record<string, string> = {
      external_order_id: order.delivery_external_id,
    };
    if (fulfillmentStatus) body.fulfillment_status = fulfillmentStatus;
    if (paymentStatus) body.payment_status = paymentStatus;

    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify(body),
    }).catch((err) => {
      console.error("Delivery status notify failed:", err);
    });
  } catch (err) {
    console.error("Delivery status notify error:", err);
  }
}
