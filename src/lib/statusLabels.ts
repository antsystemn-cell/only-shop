// Centralized status label/color maps. Use these everywhere in the UI.
// Backend values may vary (legacy keys are aliased to canonical buckets).

export type StatusColor = "green" | "amber" | "blue" | "red" | "purple" | "gray";

export interface StatusConfig {
  label: string;
  color: StatusColor;
}

export interface StatusMeta {
  label: string;
  color: string; // tailwind bg+text classes for badge
  variant?: "default" | "secondary" | "outline" | "destructive";
}

// =========================================================
// 1. Canonical maps per the spec — use with <StatusBadge map={...} />
// =========================================================

export const fulfillmentStatus: Record<string, StatusConfig> = {
  new:        { label: "Захиалга авсан",     color: "amber"  },
  confirmed:  { label: "Баталгаажсан",        color: "amber"  },
  preparing:  { label: "Бэлтгэгдэж буй",     color: "amber"  },
  shipped:    { label: "Хүргэлтэнд гарсан",  color: "blue"   },
  delivered:  { label: "Хүргэгдсэн",          color: "green"  },
  cancelled:  { label: "Цуцлагдсан",          color: "red"    },
};

export const paymentStatus: Record<string, StatusConfig> = {
  pending:    { label: "Хүлээгдэж буй",       color: "amber"  },
  paid:       { label: "Төлөгдсөн",            color: "green"  },
  refunded:   { label: "Буцаагдсан",           color: "red"    },
  failed:     { label: "Төлбөр амжилтгүй",    color: "red"    },
};

export const orderSource: Record<string, StatusConfig> = {
  website:    { label: "Вэбсайт",              color: "purple" },
  manual:     { label: "Гар борлуулалт",       color: "gray"   },
  historical: { label: "Түүхэн",               color: "gray"   },
};

export const inventoryMovement: Record<string, StatusConfig> = {
  manual_sale:  { label: "Гар зарагдсан",     color: "gray"   },
  order_sale:   { label: "Захиалгаар",         color: "blue"   },
  restock:      { label: "Нөхөн дүүргэлт",   color: "green"  },
  adjustment:   { label: "Тохируулга",         color: "amber"  },
  return:       { label: "Буцаалт",            color: "purple" },
};

export function getStatus(
  value: string | null | undefined,
  map: Record<string, StatusConfig>,
): StatusConfig {
  if (!value) return { label: "—", color: "gray" };
  return map[value] ?? { label: value, color: "gray" };
}

// =========================================================
// 2. Legacy meta API (tailwind class strings) — kept for existing consumers
// =========================================================

export type FulfillmentKey =
  | "new"
  | "confirmed"
  | "preparing"
  | "shipped"
  | "delivered"
  | "cancelled";

export type PaymentKey = "pending" | "paid" | "refunded" | "failed";

const COLOR_CLASSES: Record<StatusColor, { bg: string; variant: StatusMeta["variant"] }> = {
  green:  { bg: "bg-green-100 text-green-800",   variant: "default" },
  amber:  { bg: "bg-amber-100 text-amber-800",   variant: "secondary" },
  blue:   { bg: "bg-blue-100 text-blue-800",     variant: "default" },
  red:    { bg: "bg-red-100 text-red-800",       variant: "destructive" },
  purple: { bg: "bg-purple-100 text-purple-800", variant: "default" },
  gray:   { bg: "bg-gray-100 text-gray-800",     variant: "outline" },
};

function toMeta(cfg: StatusConfig): StatusMeta {
  const c = COLOR_CLASSES[cfg.color];
  return { label: cfg.label, color: c.bg, variant: c.variant };
}

// Legacy / alternate backend keys → canonical bucket
const FULFILLMENT_ALIAS: Record<string, FulfillmentKey> = {
  new: "new",
  pending: "new",
  confirmed: "confirmed",
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
  failed: "failed",
  paid: "paid",
  success: "paid",
  completed: "paid",
  refunded: "refunded",
};

const SOURCE_LABELS: Record<string, string> = {
  website: "Вэбсайт",
  admin_manual: "Гар борлуулалт",
  admin_manual_sale: "Гар борлуулалт",
  manual_sale: "Гар борлуулалт",
  manual: "Гар борлуулалт",
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
  return toMeta(fulfillmentStatus[getFulfillmentKey(raw)]);
}

export function getPaymentMeta(raw?: string | null): StatusMeta {
  return toMeta(paymentStatus[getPaymentKey(raw)]);
}

export function getFulfillmentLabel(raw?: string | null): string {
  return getFulfillmentMeta(raw).label;
}

export function getPaymentLabel(raw?: string | null): string {
  return getPaymentMeta(raw).label;
}

export function getSourceLabel(raw?: string | null): string {
  if (!raw) return "—";
  return SOURCE_LABELS[raw] ?? orderSource[raw]?.label ?? raw;
}

// Ordered list for dropdowns / tabs (canonical keys only)
export const FULFILLMENT_OPTIONS: { value: FulfillmentKey; label: string; color: string }[] =
  (Object.keys(fulfillmentStatus) as FulfillmentKey[]).map((k) => {
    const m = toMeta(fulfillmentStatus[k]);
    return { value: k, label: m.label, color: m.color };
  });

export const PAYMENT_OPTIONS: { value: PaymentKey; label: string; color: string }[] =
  (Object.keys(paymentStatus) as PaymentKey[]).map((k) => {
    const m = toMeta(paymentStatus[k]);
    return { value: k, label: m.label, color: m.color };
  });
