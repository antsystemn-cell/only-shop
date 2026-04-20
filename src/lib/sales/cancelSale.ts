import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit/auditService";

/**
 * Cancel a sale and (optionally) restore inventory via the
 * `restore_sale_inventory` RPC. Safe to call multiple times — the
 * RPC short-circuits if inventory was already restored.
 */
export async function cancelSale(orderId: string, opts: { restoreStock?: boolean; reason?: string } = {}) {
  const { restoreStock = true, reason } = opts;

  // 1) Mark the order as cancelled
  const { error: updErr } = await supabase
    .from("orders")
    .update({
      status: "cancelled" as any,
      fulfillment_status: "cancelled",
      cancelled_at: new Date().toISOString(),
      affects_revenue: false,
      affects_analytics: false,
      internal_note: reason || null,
    })
    .eq("id", orderId);
  if (updErr) throw updErr;

  // 2) Restore stock (idempotent on the DB side)
  if (restoreStock) {
    const { error: rpcErr } = await supabase.rpc("restore_sale_inventory", {
      p_order_id: orderId,
    });
    if (rpcErr) throw rpcErr;
  }

  await logAudit({
    action: "cancel",
    entity_type: "order",
    entity_id: orderId,
    details: { restoreStock, reason: reason || null },
  });
}
