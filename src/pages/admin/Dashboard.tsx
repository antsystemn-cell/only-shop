import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DollarSign,
  ShoppingCart,
  Globe,
  Hand,
  Archive,
  Receipt,
  TrendingUp,
  AlertTriangle,
  Package2,
  ArrowRight,
} from "lucide-react";
import { listExpenses } from "@/lib/expenses/expensesService";
import { format, subDays, startOfDay, endOfDay } from "date-fns";

function fmt(n: number) {
  return new Intl.NumberFormat("mn-MN").format(Math.round(n)) + "₮";
}

interface OrderRow {
  id: string;
  total: number;
  cost_amount: number;
  source_type: string;
  is_historical: boolean;
  is_manual: boolean;
  affects_revenue: boolean;
  status: string;
  sale_date: string;
  created_at: string;
  customer_name: string | null;
  order_number: string;
}

export default function Dashboard() {
  const [from, setFrom] = useState(format(subDays(new Date(), 29), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<{ name: string; qty: number; revenue: number }[]>([]);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const fromIso = startOfDay(new Date(from)).toISOString();
      const toIso = endOfDay(new Date(to)).toISOString();

      const [{ data: ord }, exp, { data: items }, { data: prods }, { data: vars }, { data: setting }] =
        await Promise.all([
          supabase
            .from("orders")
            .select(
              "id,total,cost_amount,source_type,is_historical,is_manual,affects_revenue,status,sale_date,created_at,customer_name,order_number",
            )
            .gte("sale_date", fromIso)
            .lte("sale_date", toIso)
            .order("sale_date", { ascending: false })
            .limit(2000),
          listExpenses({ fromDate: from, toDate: to }),
          supabase
            .from("order_items")
            .select("product_name_snapshot,quantity,total_price,order_id,orders!inner(sale_date,status,affects_revenue)")
            .gte("orders.sale_date", fromIso)
            .lte("orders.sale_date", toIso)
            .limit(5000),
          supabase.from("products").select("id,stock").eq("is_active", true).limit(2000),
          supabase
            .from("product_variants")
            .select("id,stock")
            .eq("is_active", true)
            .limit(5000),
          (supabase.from as any)("admin_settings")
            .select("setting_value")
            .eq("setting_key", "default_low_stock_threshold")
            .maybeSingle(),
        ]);

      setOrders((ord as any) || []);
      setExpenses(exp);

      // top products (exclude cancelled / non-revenue)
      const agg = new Map<string, { name: string; qty: number; revenue: number }>();
      ((items as any[]) || []).forEach((it) => {
        const o = it.orders;
        if (!o) return;
        if (o.status === "cancelled" || !o.affects_revenue) return;
        const key = it.product_name_snapshot || "—";
        const cur = agg.get(key) || { name: key, qty: 0, revenue: 0 };
        cur.qty += Number(it.quantity || 0);
        cur.revenue += Number(it.total_price || 0);
        agg.set(key, cur);
      });
      const top = Array.from(agg.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);
      setTopProducts(top);

      // low stock
      let threshold = 5;
      if (setting?.data?.setting_value) {
        const v = parseInt(String(setting.data.setting_value), 10);
        if (!isNaN(v)) threshold = v;
      }
      const lowProds = (prods || []).filter((p: any) => (p.stock || 0) > 0 && (p.stock || 0) <= threshold).length;
      const lowVars = (vars || []).filter((v: any) => (v.stock || 0) > 0 && (v.stock || 0) <= threshold).length;
      setLowStockCount(lowProds + lowVars);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  const kpi = useMemo(() => {
    const valid = orders.filter((o) => o.status !== "cancelled" && o.affects_revenue);
    const sum = (rows: OrderRow[]) => rows.reduce((s, o) => s + Number(o.total || 0), 0);
    const cost = (rows: OrderRow[]) => rows.reduce((s, o) => s + Number(o.cost_amount || 0), 0);

    const website = valid.filter((o) => o.source_type === "website_order");
    const manual = valid.filter((o) => o.is_manual && !o.is_historical);
    const historical = valid.filter((o) => o.is_historical);
    const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
    const totalRevenue = sum(valid);
    const totalCost = cost(valid);
    const grossProfit = totalRevenue - totalCost;
    const net = grossProfit - totalExpenses;

    return {
      website: { count: website.length, revenue: sum(website) },
      manual: { count: manual.length, revenue: sum(manual) },
      historical: { count: historical.length, revenue: sum(historical) },
      totalRevenue,
      totalCost,
      grossProfit,
      totalExpenses,
      net,
      ordersCount: valid.length,
    };
  }, [orders, expenses]);

  // Revenue by day chart data
  const chartData = useMemo(() => {
    const map = new Map<string, number>();
    orders
      .filter((o) => o.status !== "cancelled" && o.affects_revenue)
      .forEach((o) => {
        const d = format(new Date(o.sale_date), "yyyy-MM-dd");
        map.set(d, (map.get(d) || 0) + Number(o.total || 0));
      });
    const arr = Array.from(map.entries())
      .map(([date, v]) => ({ date, value: v }))
      .sort((a, b) => a.date.localeCompare(b.date));
    return arr;
  }, [orders]);

  const maxChart = Math.max(1, ...chartData.map((d) => d.value));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Хянах самбар</h1>
          <p className="text-sm text-muted-foreground">Бизнесийн нэгдсэн дүр зураг</p>
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

      {/* Source-based KPI */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
              <Globe className="h-3.5 w-3.5" /> Вэб борлуулалт
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{fmt(kpi.website.revenue)}</div>
            <div className="text-xs text-muted-foreground">{kpi.website.count} захиалга</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
              <Hand className="h-3.5 w-3.5" /> Гар борлуулалт
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{fmt(kpi.manual.revenue)}</div>
            <div className="text-xs text-muted-foreground">{kpi.manual.count} захиалга</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-gray-400">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
              <Archive className="h-3.5 w-3.5" /> Түүхэн борлуулалт
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{fmt(kpi.historical.revenue)}</div>
            <div className="text-xs text-muted-foreground">{kpi.historical.count} захиалга</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
              <Receipt className="h-3.5 w-3.5" /> Зардал
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{fmt(kpi.totalExpenses)}</div>
            <div className="text-xs text-muted-foreground">{expenses.length} бичлэг</div>
          </CardContent>
        </Card>
        <Card className={`border-l-4 ${kpi.net >= 0 ? "border-l-green-500" : "border-l-destructive"}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5" /> Тооцоолсон цэвэр
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-xl font-bold ${kpi.net >= 0 ? "text-green-600" : "text-destructive"}`}>
              {fmt(kpi.net)}
            </div>
            <div className="text-xs text-muted-foreground">
              Орлого − өртөг − зардал
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary row */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Нийт орлого</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              {fmt(kpi.totalRevenue)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Нийт өртөг</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmt(kpi.totalCost)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Бохир ашиг</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{fmt(kpi.grossProfit)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Захиалгын тоо</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              {kpi.ordersCount}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Revenue chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Өдрийн орлого</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">Өгөгдөл алга</div>
            ) : (
              <div className="flex items-end gap-1 h-48">
                {chartData.map((d) => (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group">
                    <div className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100">
                      {fmt(d.value)}
                    </div>
                    <div
                      className="w-full bg-primary/70 hover:bg-primary rounded-t transition-colors"
                      style={{ height: `${Math.max(2, (d.value / maxChart) * 160)}px` }}
                      title={`${d.date}: ${fmt(d.value)}`}
                    />
                    <div className="text-[9px] text-muted-foreground rotate-45 origin-left whitespace-nowrap">
                      {d.date.slice(5)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Low stock alert */}
        <Card className={lowStockCount > 0 ? "border-amber-300" : ""}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Бага үлдэгдэл
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-3xl font-bold text-amber-600">{lowStockCount}</div>
            <p className="text-sm text-muted-foreground">SKU нь босго тоо хэмжээнээс бага байна</p>
            <Link to="/admin/inventory">
              <Button variant="outline" size="sm" className="w-full">
                <Package2 className="h-4 w-4 mr-2" />
                Үлдэгдэл шалгах
                <ArrowRight className="h-3 w-3 ml-auto" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Top products */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Шилдэг бараанууд</CardTitle>
        </CardHeader>
        <CardContent>
          {topProducts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Өгөгдөл алга</div>
          ) : (
            <div className="space-y-2">
              {topProducts.map((p, i) => (
                <div key={p.name} className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded">
                  <Badge variant="outline" className="w-6 h-6 p-0 flex items-center justify-center">
                    {i + 1}
                  </Badge>
                  <div className="flex-1 truncate text-sm font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{p.qty} ширхэг</div>
                  <div className="text-sm font-semibold">{fmt(p.revenue)}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {loading && (
        <div className="text-center text-xs text-muted-foreground">Шинэчилж байна...</div>
      )}
    </div>
  );
}
