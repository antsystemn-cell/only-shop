// Profit calculation utilities — Phase 1
// Single source of truth for all margin/profit math on the frontend.

export interface ProductLikeForCost {
  cost_price?: number | null;
  landed_cost?: number | null;
  additional_cost?: number | null;
}

export interface VariantLikeForCost {
  cost_price?: number | null;
  landed_cost?: number | null;
}

/**
 * Returns the effective unit cost using the priority:
 *   variant.landed_cost → variant.cost_price → product.landed_cost → product.cost_price
 * Adds product.additional_cost when falling back to product-level values.
 */
export function getEffectiveCost(
  product?: ProductLikeForCost | null,
  variant?: VariantLikeForCost | null
): number {
  if (variant) {
    if (Number(variant.landed_cost) > 0) return Number(variant.landed_cost);
    if (Number(variant.cost_price) > 0) return Number(variant.cost_price);
  }
  if (product) {
    const add = Number(product.additional_cost) || 0;
    if (Number(product.landed_cost) > 0) return Number(product.landed_cost) + add;
    if (Number(product.cost_price) > 0) return Number(product.cost_price) + add;
  }
  return 0;
}

export interface MarginPreview {
  cost: number;
  price: number;
  profit: number;
  marginPct: number;
  isLowMargin: boolean;
  hasNoCost: boolean;
}

/**
 * Computes margin preview for a single unit at a given selling price.
 * `lowThreshold` defaults to 15%.
 */
export function calcUnitMargin(
  price: number,
  cost: number,
  lowThreshold = 15
): MarginPreview {
  const safePrice = Number(price) || 0;
  const safeCost = Number(cost) || 0;
  const profit = safePrice - safeCost;
  const marginPct = safePrice > 0 ? (profit / safePrice) * 100 : 0;
  return {
    cost: safeCost,
    price: safePrice,
    profit,
    marginPct,
    isLowMargin: safeCost > 0 && marginPct < lowThreshold,
    hasNoCost: safeCost <= 0,
  };
}

export interface OrderProfitInput {
  subtotal?: number | null;        // sum of unit_price × qty
  cost_amount?: number | null;     // sum of unit_cost × qty
  delivery_fee?: number | null;    // charged to customer
  delivery_cost_paid?: number | null; // paid by business
  packaging_cost_total?: number | null;
  discount_amount?: number | null;
}

export interface OrderProfit {
  revenue: number;       // subtotal
  cost: number;          // cost_amount
  grossProfit: number;   // revenue - cost
  netProfit: number;     // revenue + delivery_fee - discount - cost - delivery_paid - packaging
  grossMarginPct: number;
  netMarginPct: number;
  deliverySubsidy: number; // delivery_paid - delivery_fee (positive = bizness loses money)
}

export function calcOrderProfit(o: OrderProfitInput): OrderProfit {
  const revenue = Number(o.subtotal) || 0;
  const cost = Number(o.cost_amount) || 0;
  const fee = Number(o.delivery_fee) || 0;
  const paid = Number(o.delivery_cost_paid) || 0;
  const pack = Number(o.packaging_cost_total) || 0;
  const disc = Number(o.discount_amount) || 0;

  const grossProfit = revenue - cost;
  const netProfit = revenue + fee - disc - cost - paid - pack;
  const totalRev = revenue + fee;
  return {
    revenue,
    cost,
    grossProfit,
    netProfit,
    grossMarginPct: revenue > 0 ? (grossProfit / revenue) * 100 : 0,
    netMarginPct: totalRev > 0 ? (netProfit / totalRev) * 100 : 0,
    deliverySubsidy: paid - fee,
  };
}

/** Returns a tailwind text color class based on profit value. */
export function getProfitColorClass(value: number): string {
  if (value > 0) return "text-green-600";
  if (value < 0) return "text-red-600";
  return "text-muted-foreground";
}

/** Returns a tailwind text color class based on margin percentage. */
export function getMarginColorClass(marginPct: number, lowThreshold = 15): string {
  if (marginPct >= lowThreshold * 2) return "text-green-600";
  if (marginPct >= lowThreshold) return "text-amber-600";
  if (marginPct > 0) return "text-orange-600";
  return "text-red-600";
}

export function formatPct(n: number, digits = 1): string {
  if (!isFinite(n)) return "—";
  return `${n.toFixed(digits)}%`;
}
