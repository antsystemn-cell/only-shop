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
  Trophy,
  Megaphone,
  PieChart,
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
  net_profit: number;
  gross_profit: number;
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

interface ProductProfitRow {
  name: string;
  qty: number;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
}

const SOURCE_COLORS: Record<string, string> = {
  website_order: "bg-blue-500",
  admin_manual_sale: "bg-purple-500",
  phone_order: "bg-pink-500",
  facebook_chat_order: "bg-indigo-500",
  walk_in_store_sale: "bg-emerald-500",
  historical_sale: "bg-gray-400",
  other_manual: "bg-orange-400",
};

const SOURCE_LABELS: Record<string, string> = {
  website_order: "Вэб",
  admin_manual_sale: "Админ гар",
  phone_order: "Утсаар",
  facebook_chat_order: "Facebook",
  walk_in_store_sale: "Дэлгүүр",
  historical_sale: "Түүхэн",
  other_manual: "Бусад",
};

export default function Dashboard() {
  const [from, setFrom] = useState(format(subDays(new Date(), 29), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<ProductProfitRow[]>([]);
  const [profitLeaders, setProfitLeaders] = useState<ProductProfitRow[]>([]);
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
              "id,total,cost_amount,net_profit,gross_profit,source_type,is_historical,is_manual,affects_revenue,status,sale_date,created_at,customer_name,order_number",
            )
            .gte("sale_date", fromIso)
            .lte("sale_date", toIso)
            .order("sale_date", { ascending: false })
            .limit(2000),
          listExpenses({ fromDate: from, toDate: to }),
          supabase
            .from("order_items")
            .select(
              "product_name_snapshot,quantity,total_price,line_cost,order_id,orders!inner(sale_date,status,affects_revenue)",
            )
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

      // Aggregate per-product
      const agg = new Map<string, ProductProfitRow>();
      ((items as any[]) || []).forEach((it) => {
        const o = it.orders;
        if (!o) return;
        if (o.status === "cancelled" || !o.affects_revenue) return;
        const key = it.product_name_snapshot || "—";
        const cur = agg.get(key) || { name: key, qty: 0, revenue: 0, cost: 0, profit: 0, margin: 0 };
        cur.qty += Number(it.quantity || 0);
        cur.revenue += Number(it.total_price || 0);
        cur.cost += Number(it.line_cost || 0);
        agg.set(key, cur);
      });
      const all = Array.from(agg.values()).map((p) => {
        p.profit = p.revenue - p.cost;
        p.margin = p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0;
        return p;
      });
      setTopProducts([...all].sort((a, b) => b.revenue - a.revenue).slice(0, 5));
      setProfitLeaders([...all].filter((p) => p.profit > 0).sort((a, b) => b.profit - a.profit).slice(0, 5));

      // Low stock
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
    const sumNet = (rows: OrderRow[]) => rows.reduce((s, o) => s + Number(o.net_profit || 0), 0);

    const website = valid.filter((o) => o.source_type === "website_order");
    const manual = valid.filter((o) => o.is_manual && !o.is_historical);
    const historical = valid.filter((o) => o.is_historical);
    const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
    const totalRevenue = sum(valid);
    const totalCost = cost(valid);
    const grossProfit = totalRevenue - totalCost;
    const orderNetProfit = sumNet(valid); // includes delivery_paid + packaging
    const net = orderNetProfit - totalExpenses;

    return {
      website: { count: website.length, revenue: sum(website) },
      manual: { count: manual.length, revenue: sum(manual) },
      historical: { count: historical.length, revenue: sum(historical) },
      totalRevenue,
      totalCost,
      grossProfit,
      orderNetProfit,
      totalExpenses,
      net,
      ordersCount: valid.length,
    };
  }, [orders, expenses]);

  // Source breakdown
  const sourceBreakdown = useMemo(() => {
    const map = new Map<string, { revenue: number; count: number }>();
    orders
      .filter((o) => o.status !== "cancelled" && o.affects_revenue)
      .forEach((o) => {
        const cur = map.get(o.source_type) || { revenue: 0, count: 0 };
        cur.revenue += Number(o.total || 0);
        cur.count += 1;
        map.set(o.source_type, cur);
      });
    const total = Array.from(map.values()).reduce((s, x) => s + x.revenue, 0) || 1;
    return Array.from(map.entries())
      .map(([source, v]) => ({ source, ...v, pct: (v.revenue / total) * 100 }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [orders]);

  // Expense by category
  const expenseBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    expenses.forEach((e) => {
      const k = e.category || "other";
      map.set(k, (map.get(k) || 0) + Number(e.amount || 0));
    });
    const total = Array.from(map.values()).reduce((s, x) => s + x, 0) || 1;
    return Array.from(map.entries())
      .map(([category, amount]) => ({ category, amount, pct: (amount / total) * 100 }))
      .sort((a, b) => b.amount - a.amount);
  }, [expenses]);

  // Ad-heavy warning: ad spend / revenue ratio
  const adWarning = useMemo(() => {
    const adKeys = ["advertising", "ad", "marketing", "facebook_ads", "boost"];
    const adSpend = expenses
      .filter((e) => adKeys.some((k) => String(e.category || "").toLowerCase().includes(k)))
      .reduce((s, e) => s + Number(e.amount || 0), 0);
    const ratio = kpi.totalRevenue > 0 ? (adSpend / kpi.totalRevenue) * 100 : 0;
    let level: "safe" | "warn" | "danger" = "safe";
    if (ratio >= 30) level = "danger";
    else if (ratio >= 15) level = "warn";
    return { adSpend, ratio, level };
  }, [expenses, kpi.totalRevenue]);

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
            <div className="text-xs text-muted-foreground">Net (захиалга) − зардал</div>
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

      {/* Ad-heavy warning */}
      {adWarning.adSpend > 0 && (
        <Card
          className={
            adWarning.level === "danger"
              ? "border-destructive bg-destructive/5"
              : adWarning.level === "warn"
                ? "border-amber-300 bg-amber-50 dark:bg-amber-950/20"
                : "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20"
          }
        >
          <CardContent className="flex flex-wrap items-center gap-4 py-4">
            <Megaphone
              className={`h-6 w-6 ${
                adWarning.level === "danger"
                  ? "text-destructive"
                  : adWarning.level === "warn"
                    ? "text-amber-600"
                    : "text-emerald-600"
              }`}
            />
            <div className="flex-1 min-w-[200px]">
              <div className="font-semibold">
                Сурталчилгааны зардал: {fmt(adWarning.adSpend)} ({adWarning.ratio.toFixed(1)}% орлогын)
              </div>
              <div className="text-xs text-muted-foreground">
                {adWarning.level === "danger"
                  ? "⚠️ Маш өндөр — ашгийн зөрүүгээ дахин шалгана уу"
                  : adWarning.level === "warn"
                    ? "Анхаар: 15%-аас давсан байна"
                    : "Хэвийн түвшинд"}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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

      {/* Source & Expense breakdown */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <PieChart className="h-4 w-4" /> Эх үүсвэрийн хуваарилалт
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sourceBreakdown.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">Өгөгдөл алга</div>
            ) : (
              <div className="space-y-3">
                {/* Stacked bar */}
                <div className="flex w-full h-3 rounded-full overflow-hidden bg-muted">
                  {sourceBreakdown.map((s) => (
                    <div
                      key={s.source}
                      className={SOURCE_COLORS[s.source] || "bg-gray-300"}
                      style={{ width: `${s.pct}%` }}
                      title={`${SOURCE_LABELS[s.source] || s.source}: ${s.pct.toFixed(1)}%`}
                    />
                  ))}
                </div>
                <div className="space-y-1.5">
                  {sourceBreakdown.map((s) => (
                    <div key={s.source} className="flex items-center gap-2 text-sm">
                      <div className={`w-3 h-3 rounded ${SOURCE_COLORS[s.source] || "bg-gray-300"}`} />
                      <div className="flex-1">{SOURCE_LABELS[s.source] || s.source}</div>
                      <div className="text-xs text-muted-foreground">{s.count}</div>
                      <div className="font-medium tabular-nums">{fmt(s.revenue)}</div>
                      <div className="text-xs text-muted-foreground w-12 text-right">{s.pct.toFixed(1)}%</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="h-4 w-4" /> Зардлын ангилал
            </CardTitle>
          </CardHeader>
          <CardContent>
            {expenseBreakdown.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">Зардал бүртгэгдээгүй</div>
            ) : (
              <div className="space-y-2">
                {expenseBreakdown.map((e) => (
                  <div key={e.category} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="capitalize">{e.category}</span>
                      <span className="font-medium tabular-nums">
                        {fmt(e.amount)} <span className="text-xs text-muted-foreground">({e.pct.toFixed(0)}%)</span>
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500" style={{ width: `${e.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top products & Profit leaders */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" /> Шилдэг борлуулалттай
            </CardTitle>
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
                    <div className="text-xs text-muted-foreground">{p.qty} ш</div>
                    <div className="text-sm font-semibold tabular-nums">{fmt(p.revenue)}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" /> Ашгийн чемпионууд
            </CardTitle>
          </CardHeader>
          <CardContent>
            {profitLeaders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">Ашигтай бараа алга</div>
            ) : (
              <div className="space-y-2">
                {profitLeaders.map((p, i) => (
                  <div key={p.name} className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded">
                    <Badge
                      variant="outline"
                      className={`w-6 h-6 p-0 flex items-center justify-center ${
                        i === 0 ? "border-amber-400 text-amber-600" : ""
                      }`}
                    >
                      {i + 1}
                    </Badge>
                    <div className="flex-1 truncate text-sm font-medium">{p.name}</div>
                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        p.margin >= 30
                          ? "border-green-300 text-green-700"
                          : p.margin >= 15
                            ? "border-amber-300 text-amber-700"
                            : "border-destructive text-destructive"
                      }`}
                    >
                      {p.margin.toFixed(0)}%
                    </Badge>
                    <div className="text-sm font-semibold tabular-nums text-green-600">{fmt(p.profit)}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {loading && <div className="text-center text-xs text-muted-foreground">Шинэчилж байна...</div>}
    </div>
  );
}
