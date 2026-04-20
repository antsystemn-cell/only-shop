import { supabase } from "@/integrations/supabase/client";

export const EXPENSE_CATEGORIES = [
  { value: "advertising", label: "Сурталчилгаа" },
  { value: "delivery", label: "Хүргэлт" },
  { value: "packaging", label: "Сав баглаа" },
  { value: "supplies", label: "Хангамжийн зүйл" },
  { value: "salary", label: "Цалин" },
  { value: "rent", label: "Түрээс" },
  { value: "utilities", label: "Цахилгаан/Ус/Интернэт" },
  { value: "refund_loss", label: "Буцаалт/Алдагдал" },
  { value: "damaged_goods", label: "Эвдэрсэн бараа" },
  { value: "miscellaneous", label: "Бусад" },
] as const;

export interface Expense {
  id: string;
  expense_date: string;
  category: string;
  amount: number;
  payment_method: string | null;
  note: string | null;
  attachment_url: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExpenseInput {
  expense_date: string;
  category: string;
  amount: number;
  payment_method?: string | null;
  note?: string | null;
  attachment_url?: string | null;
}

export async function listExpenses(filters: { fromDate?: string; toDate?: string; category?: string } = {}) {
  let query = (supabase.from as any)("expenses")
    .select("*")
    .order("expense_date", { ascending: false });

  if (filters.fromDate) query = query.gte("expense_date", filters.fromDate);
  if (filters.toDate) query = query.lte("expense_date", filters.toDate);
  if (filters.category) query = query.eq("category", filters.category);

  const { data, error } = await query;
  if (error) throw error;
  return (data as Expense[]) || [];
}

export async function createExpense(input: ExpenseInput): Promise<Expense> {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await (supabase.from as any)("expenses")
    .insert({ ...input, created_by_user_id: user?.id || null })
    .select()
    .single();
  if (error) throw error;
  return data as Expense;
}

export async function updateExpense(id: string, input: Partial<ExpenseInput>): Promise<void> {
  const { error } = await (supabase.from as any)("expenses").update(input).eq("id", id);
  if (error) throw error;
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await (supabase.from as any)("expenses").delete().eq("id", id);
  if (error) throw error;
}

export function getExpenseCategoryLabel(value: string) {
  return EXPENSE_CATEGORIES.find((c) => c.value === value)?.label || value;
}
