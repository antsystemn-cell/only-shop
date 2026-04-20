import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listExpenses, getExpenseCategoryLabel } from "@/lib/expenses/expensesService";
import { Download, FileBarChart } from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { toast } from "sonner";

function fmt(n: number) {
  return new Intl.NumberFormat("mn-MN").format(Math.round(n)) + "₮";
}

function downloadCSV(filename: string, rows: string[][]) {
  const csv = rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const [from, setFrom] = useState(format(subDays(new Date(), 29), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [orders, setOrders] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const fromIso = startOfDay(new Date(from)).toISOString();
      const toIso = endOfDay(new Date(to)).toISOString();
      const [{ data: ord }, exp] = await Promise.all([
        supabase
          .from("orders")
          .select(
            "id,order_number,sale_date,source_type,is_manual,is_historical,status,affects_revenue,customer_name,customer_phone,subtotal,delivery_fee,total,cost_amount",
          )
          .gte("sale_date", fromIso)
          .lte("sale_date", toIso)
          .order("sale_date", { ascending: false })
          .limit(5000),
        listExpenses({ fromDate: from, toDate: to }),
      ]);
      setOrders((ord as any) || []);
      setExpenses(exp);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  const summary = useMemo(() => {
    const valid = orders.filter((o) => o.status !== "cancelled" && o.affects_revenue);
    const sum = (k: string) => valid.reduce((s, o) => s + Number(o[k] || 0), 0);
    const totalRevenue = sum("total");
    const totalCost = sum("cost_amount");
    const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
    return {
      orders: valid.length,
      totalRevenue,
      totalCost,
      grossProfit: totalRevenue - totalCost,
      totalExpenses,
      net: totalRevenue - totalCost - totalExpenses,
    };
  }, [orders, expenses]);

  const exportSales = () => {
    const rows: string[][] = [
      [
        "order_number",
        "sale_date",
        "source_type",
        "is_manual",
        "is_historical",
        "status",
        "customer_name",
        "customer_phone",
        "subtotal",
        "delivery_fee",
        "total",
        "cost_amount",
      ],
      ...orders.map((o) => [
        o.order_number,
        o.sale_date,
        o.source_type,
        o.is_manual,
        o.is_historical,
        o.status,
        o.customer_name || "",
        o.customer_phone || "",
        o.subtotal,
        o.delivery_fee,
        o.total,
        o.cost_amount,
      ]),
    ];
    downloadCSV(`sales_${from}_${to}.csv`, rows);
  };

  const exportExpenses = () => {
    const rows: string[][] = [
      ["expense_date", "category", "payment_method", "amount", "note"],
      ...expenses.map((e) => [
        e.expense_date,
        getExpenseCategoryLabel(e.category),
        e.payment_method || "",
        e.amount,
        e.note || "",
      ]),
    ];
    downloadCSV(`expenses_${from}_${to}.csv`, rows);
  };

  const exportPL = () => {
    const rows: string[][] = [
      ["Үзүүлэлт", "Дүн (₮)"],
      ["Захиалгын тоо", String(summary.orders)],
      ["Нийт орлого", String(summary.totalRevenue)],
      ["Нийт өртөг", String(summary.totalCost)],
      ["Бохир ашиг", String(summary.grossProfit)],
      ["Нийт зардал", String(summary.totalExpenses)],
      ["Цэвэр ашиг", String(summary.net)],
    ];
    downloadCSV(`pnl_${from}_${to}.csv`, rows);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileBarChart className="h-6 w-6" /> Тайлан
          </h1>
          <p className="text-sm text-muted-foreground">Орлого, зардал, ашгийн тайлан + CSV экспорт</p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <Label className="text-xs">Эхлэх</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9" />
          </div>
          <div>
            <Label className="text-xs">Дуусах</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9" />
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">P&L хураангуй</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableBody>
              <TableRow>
                <TableCell>Захиалгын тоо</TableCell>
                <TableCell className="text-right font-medium">{summary.orders}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Нийт орлого</TableCell>
                <TableCell className="text-right font-medium">{fmt(summary.totalRevenue)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Нийт өртөг</TableCell>
                <TableCell className="text-right font-medium">{fmt(summary.totalCost)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-semibold">Бохир ашиг</TableCell>
                <TableCell className="text-right font-bold text-green-600">
                  {fmt(summary.grossProfit)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Нийт зардал</TableCell>
                <TableCell className="text-right font-medium">{fmt(summary.totalExpenses)}</TableCell>
              </TableRow>
              <TableRow className="border-t-2">
                <TableCell className="font-bold">Цэвэр ашиг</TableCell>
                <TableCell
                  className={`text-right font-bold text-lg ${
                    summary.net >= 0 ? "text-green-600" : "text-destructive"
                  }`}
                >
                  {fmt(summary.net)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">CSV Экспорт</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={exportSales} disabled={loading}>
            <Download className="h-4 w-4 mr-2" />
            Борлуулалт ({orders.length})
          </Button>
          <Button variant="outline" onClick={exportExpenses} disabled={loading}>
            <Download className="h-4 w-4 mr-2" />
            Зардал ({expenses.length})
          </Button>
          <Button variant="outline" onClick={exportPL} disabled={loading}>
            <Download className="h-4 w-4 mr-2" />
            P&L хураангуй
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
