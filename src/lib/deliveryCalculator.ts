/**
 * Centralized delivery pricing calculator.
 *
 * PRIORITY (strict, never break):
 *   1. FREE  – product-level override → delivery = 0
 *   2. FIXED – product-level override → use product.custom_delivery_fee
 *   3. DEFAULT – site / zone-based pricing
 *
 * District / city selection MUST NOT override FREE or FIXED.
 */

export type DeliveryFeeType = "free" | "fixed" | "default";

export interface DeliveryProduct {
  delivery_fee_type: string; // "free" | "fixed" | "default"
  custom_delivery_fee: number | null;
  /** Quantity of this product in the cart (default 1) */
  quantity?: number;
  /** If quantity >= this number, delivery becomes free for the whole order */
  free_delivery_min_qty?: number | null;
}

export interface DeliveryZoneInfo {
  standard_price: number;
  standard_days: number | null;
  express_price: number | null;
  express_days: number | null;
}

export type ResolvedDeliveryType = "free" | "fixed" | "default";

export interface DeliveryResult {
  /** Final delivery fee in MNT */
  fee: number;
  /** Which rule determined the fee */
  resolvedType: ResolvedDeliveryType;
  /** Display label for the user */
  label: string;
  /** Whether zone selection matters for this result */
  zoneAffectsPrice: boolean;
}

/**
 * Calculate delivery for a set of cart products.
 *
 * Rules:
 * - If ANY product has FREE delivery → entire order = FREE (fee=0)
 * - If no FREE, but any product has FIXED → use the highest FIXED fee
 * - Otherwise → DEFAULT (zone-based or base price)
 */
export function calculateDelivery(
  products: DeliveryProduct[],
  zone: DeliveryZoneInfo | null,
  _deliveryType: "standard" | "express" = "standard",
  defaultFee: number = 5000
): DeliveryResult {
  // 1. Check for FREE (explicit OR quantity-threshold based)
  const hasFree = products.some((p) => {
    if (p.delivery_fee_type === "free") return true;
    if (
      p.free_delivery_min_qty != null &&
      p.free_delivery_min_qty > 0 &&
      (p.quantity ?? 1) >= p.free_delivery_min_qty
    ) {
      return true;
    }
    return false;
  });

  if (hasFree) {
    return {
      fee: 0,
      resolvedType: "free",
      label: "Хүргэлт үнэгүй",
      zoneAffectsPrice: false,
    };
  }

  // 2. Check for FIXED
  const fixedProducts = products.filter(
    (p) => p.delivery_fee_type === "fixed" && p.custom_delivery_fee != null
  );

  if (fixedProducts.length > 0) {
    // Use the highest fixed fee among products
    const maxFixed = Math.max(
      ...fixedProducts.map((p) => p.custom_delivery_fee!)
    );
    return {
      fee: maxFixed,
      resolvedType: "fixed",
      label: formatFee(maxFixed),
      zoneAffectsPrice: false,
    };
  }

  // 3. DEFAULT – zone-based pricing
  if (zone) {
    const fee =
      _deliveryType === "express" && zone.express_price
        ? zone.express_price
        : zone.standard_price;
    return {
      fee,
      resolvedType: "default",
      label: formatFee(fee),
      zoneAffectsPrice: true,
    };
  }

  // No zone selected yet – use default
  return {
    fee: defaultFee,
    resolvedType: "default",
    label: formatFee(defaultFee) + " (байршлаас хамаарч өөрчлөгдөнө)",
    zoneAffectsPrice: true,
  };
}

function formatFee(amount: number): string {
  return new Intl.NumberFormat("mn-MN").format(Math.round(amount)) + "₮";
}
