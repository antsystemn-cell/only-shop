import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, History, Package2, Search, Skull, PercentCircle, FileSpreadsheet, Clock, Wallet, Coins, Sparkles, Pencil } from "lucide-react";
import * as XLSX from "xlsx";
import { StockAdjustmentDialog } from "@/components/admin/inventory/StockAdjustmentDialog";
import { StockHistorySheet } from "@/components/admin/inventory/StockHistorySheet";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
import { marginColorClass } from "@/lib/inventoryCalc";

interface Row {
  product_id: string;
  variant_id: string | null;
  product_name: string;
  variant_label: string | null;
  sku: string | null;
  stock: number;
  price: number;
  cost: number;
  margin_pct: number;
  last_sold_at: string | null;
  days_since_sold: number | null;
  total_sold_30d: number;
  low_stock_threshold: number;
}

type TabKey = "all" | "low" | "out" | "dead" | "low_margin";

export default function Inventory() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<TabKey>("all");
  const [threshold, setThreshold] = useState(5);
  const [marginThreshold, setMarginThreshold] = useState(15); // %
  const [deadDays, setDeadDays] = useState(60);
  const [sortKey, setSortKey] = useState<"name" | "stock" | "margin" | "sold30">("name");

  const [dlgOpen, setDlgOpen] = useState(false);
  const [target, setTarget] = useState<Row | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyTarget, setHistoryTarget] = useState<Row | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: prods }, { data: vars }, { data: setting }, { data: items30 }, { data: lastSold }] =
        await Promise.all([
          supabase
            .from("products")
            .select("id,name,name_mn,sku,stock,price,cost_price,landed_cost,additional_cost,low_stock_threshold")
            .eq("is_active", true)
            .limit(2000),
          supabase
            .from("product_variants")
            .select("id,product_id,name,color,size,sku_suffix,stock,price,cost_price,landed_cost")
            .eq("is_active", true)
            .limit(5000),
          (supabase.from as any)("admin_settings")
            .select("setting_value")
            .eq("setting_key", "default_low_stock_threshold")
            .maybeSingle(),
          // sold last 30d (only revenue-affecting orders)
          supabase
            .from("order_items")
            .select("product_id,variant_id,quantity,created_at,orders!inner(affects_revenue,status,sale_date)")
            .gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString())
            .limit(10000),
          // last sold per (variant or product)
          supabase
            .from("order_items")
            .select("product_id,variant_id,created_at,orders!inner(affects_revenue,status)")
            .order("created_at", { ascending: false })
            .limit(20000),
        ]);

      if (setting?.setting_value !== undefined) {
        const v = parseInt(String(setting.setting_value), 10);
        if (!isNaN(v)) setThreshold(v);
      }

      // Aggregate sold 30d
      const sold30Map = new Map<string, number>();
      (items30 || []).forEach((it: any) => {
        if (!it.orders?.affects_revenue) return;
        if (it.orders?.status === "cancelled") return;
        const key = `${it.product_id || ""}|${it.variant_id || ""}`;
        sold30Map.set(key, (sold30Map.get(key) || 0) + (it.quantity || 0));
      });

      // Last sold map
      const lastSoldMap = new Map<string, string>();
      (lastSold || []).forEach((it: any) => {
        if (!it.orders?.affects_revenue) return;
        if (it.orders?.status === "cancelled") return;
        const key = `${it.product_id || ""}|${it.variant_id || ""}`;
        if (!lastSoldMap.has(key)) lastSoldMap.set(key, it.created_at);
      });

      const variantsByProduct = new Map<string, any[]>();
      (vars || []).forEach((v: any) => {
        if (!variantsByProduct.has(v.product_id)) variantsByProduct.set(v.product_id, []);
        variantsByProduct.get(v.product_id)!.push(v);
      });

      const out: Row[] = [];
      const buildRow = (p: any, v: any | null): Row => {
        const price = Number(v?.price ?? p.price ?? 0);
        const baseCost =
          Number(v?.landed_cost ?? 0) ||
          Number(v?.cost_price ?? 0) ||
          Number(p.landed_cost ?? 0) ||
          Number(p.cost_price ?? 0);
        const additional = Number(p.additional_cost ?? 0);
        const cost = baseCost + (v ? 0 : additional);
        const margin_pct = price > 0 ? ((price - cost) / price) * 100 : 0;
        const key = `${p.id}|${v?.id || ""}`;
        const last = lastSoldMap.get(key) || lastSoldMap.get(`${p.id}|`) || null;
        return {
          product_id: p.id,
          variant_id: v?.id || null,
          product_name: p.name_mn || p.name,
          variant_label: v ? [v.color, v.size, v.name].filter(Boolean).join(" / ") || "—" : null,
          sku: v?.sku_suffix || p.sku,
          stock: v?.stock ?? p.stock ?? 0,
          price,
          cost,
          margin_pct,
          last_sold_at: last,
          days_since_sold: last ? differenceInDays(new Date(), new Date(last)) : null,
          total_sold_30d: sold30Map.get(key) || 0,
          low_stock_threshold: Number(p.low_stock_threshold ?? threshold) || threshold,
        };
      };

      (prods || []).forEach((p: any) => {
        const vList = variantsByProduct.get(p.id) || [];
        if (vList.length === 0) out.push(buildRow(p, null));
        else vList.forEach((v) => out.push(buildRow(p, v)));
      });

      setRows(out);
    } catch (e: any) {
      toast.error(e.message || "Татаж чадсангүй");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    let r = rows;
    if (tab === "low") r = r.filter((x) => x.stock <= threshold && x.stock > 0);
    else if (tab === "out") r = r.filter((x) => x.stock <= 0);
    else if (tab === "dead")
      r = r.filter((x) => x.stock > 0 && (x.days_since_sold === null || x.days_since_sold >= deadDays));
    else if (tab === "low_margin") r = r.filter((x) => x.price > 0 && x.margin_pct < marginThreshold);

    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(
        (x) =>
          x.product_name.toLowerCase().includes(q) ||
          (x.sku || "").toLowerCase().includes(q) ||
          (x.variant_label || "").toLowerCase().includes(q),
      );
    }

    const sorted = [...r];
    sorted.sort((a, b) => {
      if (sortKey === "stock") return a.stock - b.stock;
      if (sortKey === "margin") return a.margin_pct - b.margin_pct;
      if (sortKey === "sold30") return b.total_sold_30d - a.total_sold_30d;
      return a.product_name.localeCompare(b.product_name);
    });
    return sorted;
  }, [rows, tab, search, threshold, deadDays, marginThreshold, sortKey]);

  const lowCount = rows.filter((x) => x.stock <= threshold && x.stock > 0).length;
  const outCount = rows.filter((x) => x.stock <= 0).length;
  const deadCount = rows.filter(
    (x) => x.stock > 0 && (x.days_since_sold === null || x.days_since_sold >= deadDays),
  ).length;
  const lowMarginCount = rows.filter((x) => x.price > 0 && x.margin_pct < marginThreshold).length;

  const totalStockValue = rows.reduce((s, r) => s + r.stock * r.cost, 0);
  const totalStockSelling = rows.reduce((s, r) => s + r.stock * r.price, 0);
  const totalPotentialProfit = totalStockSelling - totalStockValue;
  const totalStaleValue = rows
    .filter((r) => r.stock > 0 && (r.days_since_sold === null || r.days_since_sold >= deadDays))
    .reduce((s, r) => s + r.stock * r.cost, 0);

  const fmt = (n: number) => new Intl.NumberFormat("mn-MN").format(Math.round(n));

  const exportToExcel = (data: Row[]) => {
    try {
      const sheetData = data.map((r, i) => ({
        "№": i + 1,
        "Бараа": r.product_name,
        "Хувилбар": r.variant_label || "",
        "SKU": r.sku || "",
        "Үлдэгдэл": r.stock,
        "Өртөг (₮)": r.cost > 0 ? Math.round(r.cost) : "",
        "Үнэ (₮)": r.price > 0 ? Math.round(r.price) : "",
        "Үлдэгдлийн өртөг (₮)": Math.round(r.stock * r.cost),
        "Маржин %": r.price > 0 ? Number(r.margin_pct.toFixed(1)) : "",
        "30 хоногт зарагдсан": r.total_sold_30d,
        "Сүүлд зарсан": r.last_sold_at ? format(new Date(r.last_sold_at), "yyyy-MM-dd") : "",
        "Зарагдаагүй хоног": r.days_since_sold ?? "",
      }));
      const totalQty = data.reduce((s, r) => s + r.stock, 0);
      const totalValue = data.reduce((s, r) => s + r.stock * r.cost, 0);
      sheetData.push({
        "№": "" as any,
        "Бараа": "НИЙТ" as any,
        "Хувилбар": "",
        "SKU": "",
        "Үлдэгдэл": totalQty,
        "Өртөг (₮)": "",
        "Үнэ (₮)": "",
        "Үлдэгдлийн өртөг (₮)": Math.round(totalValue),
        "Маржин %": "",
        "30 хоногт зарагдсан": "" as any,
        "Сүүлд зарсан": "",
        "Зарагдаагүй хоног": "",
      });
      const ws = XLSX.utils.json_to_sheet(sheetData);
      ws["!cols"] = [
        { wch: 5 }, { wch: 36 }, { wch: 22 }, { wch: 16 }, { wch: 10 },
        { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Үлдэгдэл");
      const fname = `inventory_${format(new Date(), "yyyy-MM-dd_HHmm")}.xlsx`;
      XLSX.writeFile(wb, fname);
      toast.success(`${data.length} мөр экспортлогдлоо`);
    } catch (e: any) {
      toast.error(e.message || "Экспорт амжилтгүй");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package2 className="h-6 w-6" /> Бараа материал
          </h1>
          <p className="text-sm text-muted-foreground">
            Үлдэгдэл, ашгийн маржин, үхсэн бараа, нөхөн дүүргэлтийн төлөвлөгөө
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportToExcel(filtered)} disabled={loading || filtered.length === 0}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Excel экспорт
          </Button>
          <Link to="/admin/inventory/movements">
            <Button variant="outline">
              <History className="h-4 w-4 mr-2" />
              Хөдөлгөөний түүх
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Нийт SKU</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{rows.length}</div>
          </CardContent>
        </Card>
        <Card className={lowCount > 0 ? "border-amber-300" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-amber-500" /> Бага (≤{threshold})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-amber-600">{lowCount}</div>
          </CardContent>
        </Card>
        <Card className={outCount > 0 ? "border-destructive" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Дууссан</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-destructive">{outCount}</div>
          </CardContent>
        </Card>
        <Card className={deadCount > 0 ? "border-purple-300" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
              <Skull className="h-3 w-3 text-purple-500" /> Түр идэвхгүй ({deadDays}+ хон.)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-purple-600">{deadCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Үлдэгдлийн өртөг</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{fmt(totalStockValue)}₮</div>
          </CardContent>
        </Card>
      </div>

      {/* Profit / Value cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
              <Wallet className="h-3 w-3" /> Нийт борлуулалтын үнэ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{fmt(totalStockSelling)}₮</div>
            <p className="text-[11px] text-muted-foreground">Бүх нөөц зарагдвал</p>
          </CardContent>
        </Card>
        <Card className={totalPotentialProfit > 0 ? "border-green-300" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-green-500" /> Боломжит ашиг
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-xl font-bold ${totalPotentialProfit >= 0 ? "text-green-600" : "text-destructive"}`}>
              {fmt(totalPotentialProfit)}₮
            </div>
          </CardContent>
        </Card>
        <Card className={totalStaleValue > 0 ? "border-purple-300" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
              <Coins className="h-3 w-3 text-purple-500" /> Түр идэвхгүй нөөц (₮)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-purple-600">{fmt(totalStaleValue)}₮</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
              <TabsList>
                <TabsTrigger value="all">Бүгд</TabsTrigger>
                <TabsTrigger value="low">Бага ({lowCount})</TabsTrigger>
                <TabsTrigger value="out">Дууссан ({outCount})</TabsTrigger>
                <TabsTrigger value="dead">
                  <Skull className="h-3 w-3 mr-1" /> Түр идэвхгүй ({deadCount})
                </TabsTrigger>
                <TabsTrigger value="low_margin">
                  <PercentCircle className="h-3 w-3 mr-1" /> Бага маржин ({lowMarginCount})
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex flex-wrap items-center gap-2">
              {tab === "dead" && (
                <Input
                  type="number"
                  className="w-24"
                  value={deadDays}
                  onChange={(e) => setDeadDays(parseInt(e.target.value || "60", 10))}
                  title="Түр идэвхгүй барааны өдрийн босго"
                />
              )}
              {tab === "low_margin" && (
                <Input
                  type="number"
                  className="w-24"
                  value={marginThreshold}
                  onChange={(e) => setMarginThreshold(parseInt(e.target.value || "15", 10))}
                  title="Маржин %"
                />
              )}
              <Select value={sortKey} onValueChange={(v) => setSortKey(v as any)}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Нэрээр</SelectItem>
                  <SelectItem value="stock">Үлдэгдлээр (өсөх)</SelectItem>
                  <SelectItem value="margin">Маржинаар (өсөх)</SelectItem>
                  <SelectItem value="sold30">30 хоногт зарагдсанаар</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative w-64">
                <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Нэр, SKU, хувилбар..."
                  className="pl-8"
                />
              </div>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Бараа</TableHead>
                <TableHead>Хувилбар</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Үлдэгдэл</TableHead>
                <TableHead className="text-right">Өртөг</TableHead>
                <TableHead className="text-right">Үнэ</TableHead>
                <TableHead className="text-right">Маржин %</TableHead>
                <TableHead className="text-right">Үлд. өртөг</TableHead>
                <TableHead className="text-right">30 хон.</TableHead>
                <TableHead className="text-right">Үлдэх хоног</TableHead>
                <TableHead className="text-right">Сүүлд зарсан</TableHead>
                <TableHead className="text-right">Үйлдэл</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                    Ачааллаж байна...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                    Бараа алга
                  </TableCell>
                </TableRow>
              ) : (
                filtered.slice(0, 500).map((r) => {
                  const effThreshold = r.low_stock_threshold || threshold;
                  const isOut = r.stock <= 0;
                  const isLow = !isOut && r.stock <= effThreshold;
                  const isStale = !isOut && (r.days_since_sold === null || r.days_since_sold >= deadDays);
                  const lowMargin = r.price > 0 && r.margin_pct < marginThreshold;
                  const avgDaily = avgDailySales(r.total_sold_30d, 30);
                  const daysLeft = daysOfStock(r.stock, avgDaily);
                  const stockBadgeClass = isOut
                    ? ""
                    : isLow
                    ? "bg-amber-100 text-amber-800 hover:bg-amber-100"
                    : isStale
                    ? "bg-purple-100 text-purple-800 hover:bg-purple-100"
                    : "bg-green-100 text-green-800 hover:bg-green-100";
                  return (
                    <TableRow key={`${r.product_id}-${r.variant_id || "base"}`}>
                      <TableCell className="font-medium">{r.product_name}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{r.variant_label || "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{r.sku || "—"}</TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={isOut ? "destructive" : "outline"}
                          className={stockBadgeClass}
                        >
                          {r.stock}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {r.cost > 0 ? fmt(r.cost) + "₮" : "—"}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {r.price > 0 ? fmt(r.price) + "₮" : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.price > 0 ? (
                          <span className={`font-semibold ${marginColorClass(r.margin_pct)}`}>
                            {r.margin_pct.toFixed(1)}%
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {r.cost > 0 && r.stock > 0 ? fmt(r.cost * r.stock) + "₮" : "—"}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {r.total_sold_30d > 0 ? r.total_sold_30d : "—"}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {daysLeft === null ? (
                          <span className="text-muted-foreground">∞</span>
                        ) : (
                          <span className={daysLeft <= 7 ? "text-destructive font-semibold" : daysLeft <= 30 ? "text-amber-600" : ""}>
                            {daysLeft} хон.
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {r.last_sold_at ? (
                          <span className="flex items-center justify-end gap-1">
                            {format(new Date(r.last_sold_at), "yyyy-MM-dd")}
                            {r.days_since_sold !== null && r.days_since_sold >= deadDays && (
                              <TrendingDown className="h-3 w-3 text-purple-500" />
                            )}
                          </span>
                        ) : (
                          <span className="text-purple-500">Хэзээ ч</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setHistoryTarget(r);
                              setHistoryOpen(true);
                            }}
                            title="Үлдэгдлийн түүх"
                          >
                            <Clock className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setTarget(r);
                              setDlgOpen(true);
                            }}
                          >
                            Тохируулах
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          {filtered.length > 500 && (
            <p className="text-xs text-muted-foreground text-center">
              Эхний 500 мөрийг харууллаа. Шүүлт ашиглана уу.
            </p>
          )}
        </CardContent>
      </Card>

      {target && (
        <StockAdjustmentDialog
          open={dlgOpen}
          onOpenChange={setDlgOpen}
          productId={target.product_id}
          variantId={target.variant_id}
          currentStock={target.stock}
          label={`${target.product_name}${target.variant_label ? " — " + target.variant_label : ""}`}
          onDone={load}
        />
      )}

      {historyTarget && (
        <StockHistorySheet
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          productId={historyTarget.product_id}
          variantId={historyTarget.variant_id}
          currentStock={historyTarget.stock}
          label={`${historyTarget.product_name}${historyTarget.variant_label ? " — " + historyTarget.variant_label : ""}`}
        />
      )}
    </div>
  );
}
