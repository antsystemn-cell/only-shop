import { supabase } from "@/integrations/supabase/client";

export type AuditAction =
  | "create" | "update" | "delete"
  | "cancel" | "restore"
  | "stock_adjust" | "manual_sale" | "historical_import"
  | "expense_create" | "expense_delete"
  | "login" | "logout" | "permission_change";

export interface AuditLogParams {
  action: AuditAction | string;
  entity_type: string;     // e.g. "order", "product", "expense"
  entity_id?: string | null;
  details?: Record<string, any>;
}

/**
 * Insert a row into audit_logs. Best-effort — never throws.
 * Run this AFTER the actual mutation succeeded.
 */
export async function logAudit(params: AuditLogParams): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("audit_logs").insert({
      user_id: user?.id ?? null,
      action: params.action,
      entity_type: params.entity_type,
      entity_id: params.entity_id ?? null,
      details: params.details ?? {},
    });
  } catch (e) {
    // Silently swallow — audit must not break the user flow
    console.warn("[audit] failed:", e);
  }
}

export const AUDIT_ACTION_LABELS: Record<string, { label: string; color: string }> = {
  create:             { label: "Үүсгэв",            color: "bg-green-100 text-green-800" },
  update:             { label: "Шинэчлэв",          color: "bg-blue-100 text-blue-800" },
  delete:             { label: "Устгав",            color: "bg-red-100 text-red-800" },
  cancel:             { label: "Цуцлав",            color: "bg-amber-100 text-amber-800" },
  restore:            { label: "Сэргээв",           color: "bg-cyan-100 text-cyan-800" },
  stock_adjust:       { label: "Үлдэгдэл засав",    color: "bg-indigo-100 text-indigo-800" },
  manual_sale:        { label: "Гар борлуулалт",    color: "bg-purple-100 text-purple-800" },
  historical_import:  { label: "Түүхэн импорт",     color: "bg-gray-200 text-gray-800" },
  expense_create:     { label: "Зардал нэмэв",      color: "bg-orange-100 text-orange-800" },
  expense_delete:     { label: "Зардал устгав",     color: "bg-rose-100 text-rose-800" },
  login:              { label: "Нэвтрэв",           color: "bg-slate-100 text-slate-800" },
  logout:             { label: "Гарав",             color: "bg-slate-100 text-slate-800" },
  permission_change:  { label: "Эрх өөрчлөв",       color: "bg-yellow-100 text-yellow-800" },
};

export function getAuditActionBadge(action: string) {
  return AUDIT_ACTION_LABELS[action] || { label: action, color: "bg-muted text-foreground" };
}
