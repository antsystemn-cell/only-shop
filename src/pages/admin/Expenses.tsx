import { useEffect, useState } from "react";
import {
  EXPENSE_CATEGORIES,
  Expense,
  createExpense,
  deleteExpense,
  getExpenseCategoryLabel,
  listExpenses,
  updateExpense,
} from "@/lib/expenses/expensesService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Receipt } from "lucide-react";
import { format, startOfMonth } from "date-fns";
import { toast } from "sonner";

function fmt(n: number) {
  return new Intl.NumberFormat("mn-MN").format(Math.round(n)) + "₮";
}

export default function Expenses() {
  const [items, setItems] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [filterCat, setFilterCat] = useState<string>("all");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState({
    expense_date: format(new Date(), "yyyy-MM-dd"),
    category: "advertising",
    amount: "",
    payment_method: "cash",
    note: "",
  });

  const load = async () => {
    setLoading(true);
    try {
      const data = await listExpenses({
        fromDate: from,
        toDate: to,
        category: filterCat === "all" ? undefined : filterCat,
      });
      setItems(data);
    } catch (e: any) {
      toast.error(e.message || "Алдаа");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, filterCat]);

  const startNew = () => {
    setEditing(null);
    setForm({
      expense_date: format(new Date(), "yyyy-MM-dd"),
      category: "advertising",
      amount: "",
      payment_method: "cash",
      note: "",
    });
    setOpen(true);
  };

  const startEdit = (e: Expense) => {
    setEditing(e);
    setForm({
      expense_date: e.expense_date,
      category: e.category,
      amount: String(e.amount),
      payment_method: e.payment_method || "cash",
      note: e.note || "",
    });
    setOpen(true);
  };

  const submit = async () => {
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) {
      toast.error("Дүн оруулна уу");
      return;
    }
    try {
      if (editing) {
        await updateExpense(editing.id, {
          expense_date: form.expense_date,
          category: form.category,
          amount: amt,
          payment_method: form.payment_method,
          note: form.note,
        });
        toast.success("Шинэчиллээ");
      } else {
        await createExpense({
          expense_date: form.expense_date,
          category: form.category,
          amount: amt,
          payment_method: form.payment_method,
          note: form.note,
        });
        toast.success("Нэмлээ");
      }
      setOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.message || "Алдаа");
    }
  };

  const del = async (id: string) => {
    if (!confirm("Устгах уу?")) return;
    try {
      await deleteExpense(id);
      toast.success("Устгалаа");
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const total = items.reduce((s, e) => s + Number(e.amount || 0), 0);
  const byCategory = items.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + Number(e.amount || 0);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Receipt className="h-6 w-6" /> Зардал
          </h1>
          <p className="text-sm text-muted-foreground">Сурталчилгаа, түрээс, цалин гэх мэт зардлуудыг бүртгэх</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={startNew}>
              <Plus className="h-4 w-4 mr-2" /> Зардал нэмэх
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Зардал засах" : "Зардал нэмэх"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Огноо</Label>
                  <Input
                    type="date"
                    value={form.expense_date}
                    onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Дүн (₮)</Label>
                  <Input
                    type="number"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Ангилал</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Төлбөрийн хэлбэр</Label>
                <Select
                  value={form.payment_method}
                  onValueChange={(v) => setForm({ ...form, payment_method: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Бэлэн</SelectItem>
                    <SelectItem value="bank_transfer">Дансаар</SelectItem>
                    <SelectItem value="card">Карт</SelectItem>
                    <SelectItem value="qpay">QPay</SelectItem>
                    <SelectItem value="other">Бусад</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Тэмдэглэл</Label>
                <Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Цуцлах
              </Button>
              <Button onClick={submit}>{editing ? "Шинэчлэх" : "Нэмэх"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">Эхлэх</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Дуусах</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Ангилал</Label>
            <Select value={filterCat} onValueChange={setFilterCat}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Бүгд</SelectItem>
                {EXPENSE_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col justify-end">
            <div className="text-xs text-muted-foreground">Нийт</div>
            <div className="text-2xl font-bold">{fmt(total)}</div>
          </div>
        </CardContent>
      </Card>

      {/* By category breakdown */}
      {Object.keys(byCategory).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ангиллаар</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(byCategory).map(([cat, amt]) => (
                <Badge key={cat} variant="outline" className="text-xs">
                  {getExpenseCategoryLabel(cat)}: <span className="ml-1 font-semibold">{fmt(amt)}</span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* List */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Огноо</TableHead>
                <TableHead>Ангилал</TableHead>
                <TableHead>Төлбөр</TableHead>
                <TableHead>Тэмдэглэл</TableHead>
                <TableHead className="text-right">Дүн</TableHead>
                <TableHead className="text-right">Үйлдэл</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Ачааллаж байна...
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Бичлэг алга
                  </TableCell>
                </TableRow>
              ) : (
                items.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-xs whitespace-nowrap">{e.expense_date}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{getExpenseCategoryLabel(e.category)}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{e.payment_method || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                      {e.note || "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold">{fmt(Number(e.amount))}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => startEdit(e)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => del(e.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
