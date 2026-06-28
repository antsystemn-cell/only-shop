import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listExpenses, getExpenseCategoryLabel } from "@/lib/expenses/expensesService";
import { Download, FileBarChart, ArrowUpDown } from "lucide-react";
import {
  format,
  subDays,
  startOfDay,
  endOfDay,
  startOfMonth,
  startOfYear,
  startOfWeek,
  eachDayOfInterval,
} from "date-fns";
import { toast } from "sonner";
import { calcSalesProfitByProduct, marginColorClass } from "@/lib/inventoryCalc";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

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

type SortKey = "name" | "qty" | "revenue" | "cost" | "profit" | "margin";

export default function Reports() {
  const [from, setFrom] = useState(format(subDays(new Date(), 29), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [orders, setOrders] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("profit");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const applyQuick = (key: "today" | "week" | "month" | "year") => {
    const now = new Date();
    let start = now;
    if (key === "today") start = startOfDay(now);
    if (key === "week") start = startOfWeek(now, { weekStartsOn: 1 });
    if (key === "month") start = startOfMonth(now);
    if (key === "year") start = startOfYear(now);
    setFrom(format(start, "yyyy-MM-dd"));
    setTo(format(now, "yyyy-MM-dd"));
  };

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
      const orderRows = ((ord as any) || []).filter(
        (o: any) => o.status !== "cancelled" && o.affects_revenue,
      );
      setOrders(orderRows);
      setExpenses(exp);

      // Load order items for those orders
      const orderIds = orderRows.map((o: any) => o.id);
      if (orderIds.length > 0) {
        const { data: oi } = await supabase
          .from("order_items")
          .select("order_id,product_id,product_name,quantity,unit_price,unit_cost,line_total,line_cost")
          .in("order_id", orderIds)
          .limit(20000);
        setItems((oi as any) || []);
      } else {
        setItems([]);
      }
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
    const totalRevenue = items.reduce(
      (s, i) => s + Number(i.line_total ?? Number(i.unit_price || 0) * Number(i.quantity || 0)),
      0,
    );
    const totalCost = items.reduce(
      (s, i) => s + Number(i.line_cost ?? Number(i.unit_cost || 0) * Number(i.quantity || 0)),
      0,
    );
    const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
    const grossProfit = totalRevenue - totalCost;
    const avgMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
    const orderCount = orders.length;
    const avgOrder = orderCount > 0 ? totalRevenue / orderCount : 0;
    return {
      orders: orderCount,
      totalRevenue,
      totalCost,
      grossProfit,
      avgMargin,
      avgOrder,
      totalExpenses,
      net: grossProfit - totalExpenses,
    };
  }, [orders, items, expenses]);

  // Per-product breakdown
  const productBreakdown = useMemo(() => {
    const data = calcSalesProfitByProduct(
      items
        .filter((i) => i.product_id)
        .map((i) => ({
          productId: i.product_id,
          productName: i.product_name || "—",
          quantitySold: Number(i.quantity || 0),
          unitPrice: Number(i.unit_price || 0),
          costPrice: Number(i.unit_cost || 0),
        })),
    );
    const sorted = [...data].sort((a, b) => {
      const mul = sortDir === "desc" ? -1 : 1;
      switch (sortKey) {
        case "name":
          return mul * a.name.localeCompare(b.name);
        case "qty":
          return mul * (a.qtySold - b.qtySold);
        case "revenue":
          return mul * (a.revenue - b.revenue);
        case "cost":
          return mul * (a.cost - b.cost);
        case "margin":
          return mul * (a.margin - b.margin);
        case "profit":
        default:
          return mul * (a.profit - b.profit);
      }
    });
    return sorted;
  }, [items, sortKey, sortDir]);

  // Daily series
  const dailySeries = useMemo(() => {
    const days = eachDayOfInterval({ start: new Date(from), end: new Date(to) });
    const byDay = new Map<string, { revenue: number; cost: number }>();
    for (const o of orders) {
      const key = format(new Date(o.sale_date), "yyyy-MM-dd");
      const prev = byDay.get(key) || { revenue: 0, cost: 0 };
      byDay.set(key, {
        revenue: prev.revenue + Number(o.total || 0),
        cost: prev.cost + Number(o.cost_amount || 0),
      });
    }
    return days.map((d) => {
      const key = format(d, "yyyy-MM-dd");
      const v = byDay.get(key) || { revenue: 0, cost: 0 };
      return {
        date: format(d, "MM-dd"),
        Орлого: Math.round(v.revenue),
        Ашиг: Math.round(v.revenue - v.cost),
      };
    });
  }, [orders, from, to]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSortKey(k);
      setSortDir("desc");
    }
  };

  const SortBtn = ({ k, label }: { k: SortKey; label: string }) => (
    <button
      onClick={() => toggleSort(k)}
      className="inline-flex items-center gap-1 hover:text-foreground"
    >
      {label}
      <ArrowUpDown className="h-3 w-3 opacity-50" />
    </button>
  );

  const exportSales = () => {
    const rows: string[][] = [
      ["order_number","sale_date","source_type","is_manual","is_historical","status","customer_name","customer_phone","subtotal","delivery_fee","total","cost_amount"],
      ...orders.map((o) => [
        o.order_number, o.sale_date, o.source_type, o.is_manual, o.is_historical, o.status,
        o.customer_name || "", o.customer_phone || "", o.subtotal, o.delivery_fee, o.total, o.cost_amount,
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

  const exportProductProfit = () => {
    const rows: string[][] = [
      ["Бараа", "Зарсан тоо", "Орлого", "Өртөг нийт", "Ашиг", "Маржин %"],
      ...productBreakdown.map((p) => [
        p.name,
        String(p.qtySold),
        String(Math.round(p.revenue)),
        String(Math.round(p.cost)),
        String(Math.round(p.profit)),
        p.margin.toFixed(1),
      ]),
    ];
    downloadCSV(`product_profit_${from}_${to}.csv`, rows);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileBarChart className="h-6 w-6" /> Тайлан
          </h1>
          <p className="text-sm text-muted-foreground">Орлого, ашиг, зардлын дэлгэрэнгүй тайлан</p>
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

      {/* Quick selects */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => applyQuick("today")}>Өнөөдөр</Button>
        <Button variant="outline" size="sm" onClick={() => applyQuick("week")}>Энэ 7 хоног</Button>
        <Button variant="outline" size="sm" onClick={() => applyQuick("month")}>Энэ сар</Button>
        <Button variant="outline" size="sm" onClick={() => applyQuick("year")}>Энэ жил</Button>
      </div>

      {/* Top metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Нийт борлуулалт</CardTitle></CardHeader>
          <CardContent><div className="text-lg font-bold">{fmt(summary.totalRevenue)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Нийт өртөг</CardTitle></CardHeader>
          <CardContent><div className="text-lg font-bold">{fmt(summary.totalCost)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Нийт ашиг</CardTitle></CardHeader>
          <CardContent>
            <div className={`text-lg font-bold ${summary.grossProfit >= 0 ? "text-green-600" : "text-destructive"}`}>
              {fmt(summary.grossProfit)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Дундаж маржин</CardTitle></CardHeader>
          <CardContent>
            <div className={`text-lg font-bold ${marginColorClass(summary.avgMargin)}`}>
              {summary.avgMargin.toFixed(1)}%
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Захиалгын тоо</CardTitle></CardHeader>
          <CardContent><div className="text-lg font-bold">{summary.orders}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Дундаж захиалга</CardTitle></CardHeader>
          <CardContent><div className="text-lg font-bold">{fmt(summary.avgOrder)}</div></CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Цаг хугацааны борлуулалт</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailySeries}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(v: any) => fmt(Number(v))}
                  contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }}
                />
                <Legend />
                <Line type="monotone" dataKey="Орлого" stroke="#3b82f6" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Ашиг" stroke="#16a34a" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* P&L summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">P&L хураангуй</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableBody>
              <TableRow><TableCell>Захиалгын тоо</TableCell><TableCell className="text-right font-medium">{summary.orders}</TableCell></TableRow>
              <TableRow><TableCell>Нийт орлого</TableCell><TableCell className="text-right font-medium">{fmt(summary.totalRevenue)}</TableCell></TableRow>
              <TableRow><TableCell>Нийт өртөг</TableCell><TableCell className="text-right font-medium">{fmt(summary.totalCost)}</TableCell></TableRow>
              <TableRow><TableCell className="font-semibold">Бохир ашиг</TableCell><TableCell className="text-right font-bold text-green-600">{fmt(summary.grossProfit)}</TableCell></TableRow>
              <TableRow><TableCell>Нийт зардал</TableCell><TableCell className="text-right font-medium">{fmt(summary.totalExpenses)}</TableCell></TableRow>
              <TableRow className="border-t-2">
                <TableCell className="font-bold">Цэвэр ашиг</TableCell>
                <TableCell className={`text-right font-bold text-lg ${summary.net >= 0 ? "text-green-600" : "text-destructive"}`}>
                  {fmt(summary.net)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Product profit breakdown */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Бараа бүрийн ашиг</CardTitle>
          <Button variant="outline" size="sm" onClick={exportProductProfit} disabled={loading || productBreakdown.length === 0}>
            <Download className="h-4 w-4 mr-2" /> CSV
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><SortBtn k="name" label="Бараа" /></TableHead>
                  <TableHead className="text-right"><SortBtn k="qty" label="Зарсан тоо" /></TableHead>
                  <TableHead className="text-right"><SortBtn k="revenue" label="Орлого" /></TableHead>
                  <TableHead className="text-right"><SortBtn k="cost" label="Өртөг нийт" /></TableHead>
                  <TableHead className="text-right"><SortBtn k="profit" label="Ашиг" /></TableHead>
                  <TableHead className="text-right"><SortBtn k="margin" label="Маржин %" /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productBreakdown.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Энэ хугацаанд борлуулалт алга
                    </TableCell>
                  </TableRow>
                ) : (
                  productBreakdown.slice(0, 300).map((p) => (
                    <TableRow key={p.productId}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-right">{p.qtySold}</TableCell>
                      <TableCell className="text-right">{fmt(p.revenue)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{fmt(p.cost)}</TableCell>
                      <TableCell className={`text-right font-semibold ${p.profit >= 0 ? "text-green-600" : "text-destructive"}`}>
                        {fmt(p.profit)}
                      </TableCell>
                      <TableCell className={`text-right font-semibold ${marginColorClass(p.margin)}`}>
                        {p.margin.toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
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
