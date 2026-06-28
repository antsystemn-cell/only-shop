// Centralized status label/color maps. Use these everywhere in the UI.
// Backend values may vary (legacy keys are aliased to canonical buckets).

export type FulfillmentKey =
  | "new"
  | "preparing"
  | "shipped"
  | "delivered"
  | "cancelled";

export type PaymentKey = "pending" | "paid" | "refunded";

export interface StatusMeta {
  label: string;
  color: string; // tailwind bg+text classes for badge
  variant?: "default" | "secondary" | "outline" | "destructive";
}

// Canonical → display
const FULFILLMENT_META: Record<FulfillmentKey, StatusMeta> = {
  new: { label: "Захиалга авсан", color: "bg-amber-100 text-amber-800", variant: "secondary" },
  preparing: { label: "Бэлтгэгдэж буй", color: "bg-amber-100 text-amber-800", variant: "secondary" },
  shipped: { label: "Хүргэлтэнд гарсан", color: "bg-blue-100 text-blue-800", variant: "default" },
  delivered: { label: "Хүргэгдсэн", color: "bg-green-100 text-green-800", variant: "default" },
  cancelled: { label: "Цуцлагдсан", color: "bg-red-100 text-red-800", variant: "destructive" },
};

const PAYMENT_META: Record<PaymentKey, StatusMeta> = {
  pending: { label: "Хүлээгдэж буй", color: "bg-amber-100 text-amber-800", variant: "outline" },
  paid: { label: "Төлөгдсөн", color: "bg-green-100 text-green-800", variant: "default" },
  refunded: { label: "Буцаагдсан", color: "bg-red-100 text-red-800", variant: "destructive" },
};

// Legacy / alternate backend keys → canonical bucket
const FULFILLMENT_ALIAS: Record<string, FulfillmentKey> = {
  new: "new",
  pending: "new",
  confirmed: "new",
  processing: "preparing",
  preparing: "preparing",
  phone_confirmed: "preparing",
  ready: "preparing",
  shipped: "shipped",
  out_for_delivery: "shipped",
  in_transit: "shipped",
  delivered: "delivered",
  completed: "delivered",
  cancelled: "cancelled",
  canceled: "cancelled",
  refunded: "cancelled",
};

const PAYMENT_ALIAS: Record<string, PaymentKey> = {
  pending: "pending",
  unpaid: "pending",
  cash_on_delivery: "pending",
  awaiting: "pending",
  failed: "pending",
  paid: "paid",
  success: "paid",
  completed: "paid",
  refunded: "refunded",
};

const SOURCE_LABELS: Record<string, string> = {
  website: "Вэбсайт",
  admin_manual: "Гар",
  admin_manual_sale: "Админ гар",
  manual_sale: "Гар",
  manual: "Гар",
  phone: "Утас",
  facebook: "Facebook",
  instagram: "Instagram",
  walk_in: "Биечлэн",
  legacy_import: "Түүхэн",
  historical: "Түүхэн",
};

export function getFulfillmentKey(raw?: string | null): FulfillmentKey {
  if (!raw) return "new";
  return FULFILLMENT_ALIAS[raw] ?? "new";
}

export function getPaymentKey(raw?: string | null): PaymentKey {
  if (!raw) return "pending";
  return PAYMENT_ALIAS[raw] ?? "pending";
}

export function getFulfillmentMeta(raw?: string | null): StatusMeta {
  return FULFILLMENT_META[getFulfillmentKey(raw)];
}

export function getPaymentMeta(raw?: string | null): StatusMeta {
  return PAYMENT_META[getPaymentKey(raw)];
}

export function getFulfillmentLabel(raw?: string | null): string {
  return getFulfillmentMeta(raw).label;
}

export function getPaymentLabel(raw?: string | null): string {
  return getPaymentMeta(raw).label;
}

export function getSourceLabel(raw?: string | null): string {
  if (!raw) return "—";
  return SOURCE_LABELS[raw] ?? raw;
}

// Ordered list for dropdowns / tabs (canonical keys only)
export const FULFILLMENT_OPTIONS: { value: FulfillmentKey; label: string; color: string }[] =
  (Object.keys(FULFILLMENT_META) as FulfillmentKey[]).map((k) => ({
    value: k,
    label: FULFILLMENT_META[k].label,
    color: FULFILLMENT_META[k].color,
  }));

export const PAYMENT_OPTIONS: { value: PaymentKey; label: string; color: string }[] =
  (Object.keys(PAYMENT_META) as PaymentKey[]).map((k) => ({
    value: k,
    label: PAYMENT_META[k].label,
    color: PAYMENT_META[k].color,
  }));
