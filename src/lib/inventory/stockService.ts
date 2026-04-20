import { supabase } from "@/integrations/supabase/client";

export const STOCK_MOVEMENT_TYPES = [
  { value: "restock", label: "Нөхөн дүүргэлт", color: "bg-green-100 text-green-800" },
  { value: "manual_adjust", label: "Гараар тохируулга", color: "bg-blue-100 text-blue-800" },
  { value: "sale_deduction", label: "Гар зарагдсан", color: "bg-purple-100 text-purple-800" },
  { value: "website_order_deduction", label: "Вэб захиалга", color: "bg-indigo-100 text-indigo-800" },
  { value: "historical_deduction", label: "Түүхэн зарагдсан", color: "bg-gray-200 text-gray-800" },
  { value: "return_to_stock", label: "Буцаалт", color: "bg-cyan-100 text-cyan-800" },
  { value: "damaged_lost", label: "Эвдрэл/Алдагдал", color: "bg-red-100 text-red-800" },
  { value: "cancellation_restore", label: "Цуцлал — буцаасан", color: "bg-amber-100 text-amber-800" },
] as const;

export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number]["value"];

export interface AdjustStockParams {
  product_id?: string | null;
  variant_id?: string | null;
  quantity_change: number; // positive = add, negative = remove
  movement_type: "restock" | "manual_adjust" | "return_to_stock" | "damaged_lost";
  reason?: string;
  note?: string;
}

export async function adjustStock(params: AdjustStockParams): Promise<void> {
  const { error } = await supabase.rpc("adjust_stock", {
    p_product_id: params.product_id || null,
    p_variant_id: params.variant_id || null,
    p_quantity_change: params.quantity_change,
    p_movement_type: params.movement_type,
    p_reason: params.reason || null,
    p_note: params.note || null,
  });
  if (error) throw error;
}

export function getMovementTypeBadge(type: string) {
  return (
    STOCK_MOVEMENT_TYPES.find((t) => t.value === type) || {
      value: type,
      label: type,
      color: "bg-gray-100 text-gray-800",
    }
  );
}

export interface StockMovementRow {
  id: string;
  product_id: string | null;
  variant_id: string | null;
  movement_type: string;
  quantity_before: number;
  quantity_change: number;
  quantity_after: number;
  reference_type: string | null;
  reference_id: string | null;
  reason: string | null;
  note: string | null;
  created_at: string;
}

export async function fetchStockMovements(filters: {
  productId?: string;
  variantId?: string;
  movementType?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
} = {}) {
  let query = (supabase.from as any)("stock_movements")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(filters.limit || 200);

  if (filters.productId) query = query.eq("product_id", filters.productId);
  if (filters.variantId) query = query.eq("variant_id", filters.variantId);
  if (filters.movementType) query = query.eq("movement_type", filters.movementType);
  if (filters.fromDate) query = query.gte("created_at", filters.fromDate);
  if (filters.toDate) query = query.lte("created_at", filters.toDate);

  const { data, error } = await query;
  if (error) throw error;
  return (data as StockMovementRow[]) || [];
}
