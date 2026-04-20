import { supabase } from "@/integrations/supabase/client";

// ─── Types ──────────────────────────────────────────────────

export const SALE_SOURCE_TYPES = [
  { value: "website_order", label: "Вэбсайт", color: "bg-blue-100 text-blue-800" },
  { value: "admin_manual_sale", label: "Админ (гараар)", color: "bg-purple-100 text-purple-800" },
  { value: "phone_order", label: "Утсаар", color: "bg-cyan-100 text-cyan-800" },
  { value: "facebook_chat_order", label: "Facebook", color: "bg-indigo-100 text-indigo-800" },
  { value: "walk_in_store_sale", label: "Биечлэн", color: "bg-amber-100 text-amber-800" },
  { value: "historical_sale", label: "Түүхэн", color: "bg-gray-200 text-gray-800" },
  { value: "other_manual", label: "Бусад (гараар)", color: "bg-slate-100 text-slate-800" },
] as const;

export type SaleSourceType = (typeof SALE_SOURCE_TYPES)[number]["value"];

export interface ManualSaleItemInput {
  product_id?: string | null;
  variant_id?: string | null;
  product_name: string;
  sku?: string | null;
  variant_name?: string | null;
  color?: string | null;
  size?: string | null;
  unit_price: number;
  unit_cost?: number;
  quantity: number;
  product_snapshot?: Record<string, any>;
}

export interface CreateManualSaleParams {
  source_type: SaleSourceType;
  is_historical: boolean;
  sale_date: string; // ISO timestamp
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  payment_method?: string | null;
  payment_status: "paid" | "unpaid" | "cash_on_delivery" | "refunded";
  fulfillment_status: string;
  should_create_delivery: boolean;
  affects_inventory: boolean;
  affects_analytics: boolean;
  affects_revenue: boolean;
  discount_amount?: number;
  delivery_fee?: number;
  notes?: string | null;
  internal_note?: string | null;
  address_text?: string | null;
  items: ManualSaleItemInput[];
}

// ─── Create Manual / Historical Sale ────────────────────────

export async function createManualSale(params: CreateManualSaleParams): Promise<string> {
  const subtotal = params.items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const discount = params.discount_amount || 0;
  const deliveryFee = params.delivery_fee || 0;
  const total = subtotal - discount + deliveryFee;
  const costAmount = params.items.reduce((s, i) => s + (i.unit_cost || 0) * i.quantity, 0);

  const { data, error } = await supabase.rpc("create_manual_sale", {
    p_source_type: params.source_type,
    p_is_historical: params.is_historical,
    p_sale_date: params.sale_date,
    p_customer_name: params.customer_name || null,
    p_customer_phone: params.customer_phone || null,
    p_customer_email: params.customer_email || null,
    p_payment_method: params.payment_method || null,
    p_payment_status: params.payment_status,
    p_fulfillment_status: params.fulfillment_status,
    p_should_create_delivery: params.should_create_delivery,
    p_affects_inventory: params.affects_inventory,
    p_affects_analytics: params.affects_analytics,
    p_affects_revenue: params.affects_revenue,
    p_subtotal: subtotal,
    p_discount_amount: discount,
    p_delivery_fee: deliveryFee,
    p_total: total,
    p_cost_amount: costAmount,
    p_notes: params.notes || null,
    p_internal_note: params.internal_note || null,
    p_address_text: params.address_text || null,
    p_items: params.items.map((i) => ({
      product_id: i.product_id || null,
      variant_id: i.variant_id || null,
      product_name: i.product_name,
      sku: i.sku || null,
      variant_name: i.variant_name || null,
      color: i.color || null,
      size: i.size || null,
      unit_price: i.unit_price,
      unit_cost: i.unit_cost || 0,
      quantity: i.quantity,
      product_snapshot: i.product_snapshot || { name: i.product_name, name_mn: i.product_name },
    })) as any,
  });

  if (error) throw error;
  return data as unknown as string;
}

// ─── Duplicate Detection ────────────────────────────────────

export interface DuplicateMatch {
  order_id: string;
  order_number: string;
  sale_date: string;
  total: number;
  customer_phone: string | null;
}

export async function findPotentialDuplicate(
  phone: string,
  saleDate: string,
  total: number
): Promise<DuplicateMatch[]> {
  if (!phone) return [];
  const { data, error } = await supabase.rpc("find_potential_duplicate_sale", {
    p_phone: phone,
    p_sale_date: saleDate,
    p_total: total,
  });
  if (error) {
    console.error("Duplicate check failed:", error);
    return [];
  }
  return (data as DuplicateMatch[]) || [];
}

// ─── Cancel + Restore Inventory ─────────────────────────────

export async function cancelSale(orderId: string): Promise<void> {
  const { error: updErr } = await supabase
    .from("orders")
    .update({
      fulfillment_status: "cancelled",
      status: "cancelled" as any,
      cancelled_at: new Date().toISOString(),
    } as any)
    .eq("id", orderId);
  if (updErr) throw updErr;

  const { error: rpcErr } = await supabase.rpc("restore_sale_inventory", {
    p_order_id: orderId,
  });
  if (rpcErr) throw rpcErr;
}

// ─── Helpers ────────────────────────────────────────────────

export function getSourceTypeBadge(sourceType: string) {
  return (
    SALE_SOURCE_TYPES.find((s) => s.value === sourceType) || {
      value: sourceType,
      label: sourceType,
      color: "bg-gray-100 text-gray-800",
    }
  );
}

export function getDeliveryStatusBadge(order: {
  delivery_sync_status?: string | null;
  should_create_delivery?: boolean | null;
  delivery_creation_mode?: string | null;
}) {
  if (order.delivery_creation_mode === "none" || order.should_create_delivery === false) {
    return { label: "Шаардлагагүй", color: "bg-gray-100 text-gray-700" };
  }
  if (order.delivery_creation_mode === "manual" && order.delivery_sync_status === "disabled") {
    return { label: "Гараар үүсгэх", color: "bg-amber-100 text-amber-800" };
  }
  switch (order.delivery_sync_status) {
    case "synced":
      return { label: "Үүсгэгдсэн", color: "bg-green-100 text-green-800" };
    case "pending":
      return { label: "Хүлээгдэж байна", color: "bg-blue-100 text-blue-800" };
    case "failed":
      return { label: "Алдаа", color: "bg-red-100 text-red-800" };
    case "disabled":
      return { label: "Идэвхгүй", color: "bg-gray-100 text-gray-700" };
    default:
      return { label: order.delivery_sync_status || "—", color: "bg-gray-100 text-gray-700" };
  }
}
