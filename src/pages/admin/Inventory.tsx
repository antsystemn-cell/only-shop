import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, History, Package2, Search } from "lucide-react";
import { StockAdjustmentDialog } from "@/components/admin/inventory/StockAdjustmentDialog";
import { toast } from "sonner";

interface Row {
  product_id: string;
  variant_id: string | null;
  product_name: string;
  variant_label: string | null;
  sku: string | null;
  stock: number;
}

export default function Inventory() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");
  const [threshold, setThreshold] = useState(5);

  const [dlgOpen, setDlgOpen] = useState(false);
  const [target, setTarget] = useState<Row | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: prods }, { data: vars }, { data: setting }] = await Promise.all([
        supabase.from("products").select("id,name,name_mn,sku,stock").eq("is_active", true).limit(2000),
        supabase
          .from("product_variants")
          .select("id,product_id,name,color,size,sku_suffix,stock")
          .eq("is_active", true)
          .limit(5000),
        (supabase.from as any)("admin_settings")
          .select("setting_value")
          .eq("setting_key", "default_low_stock_threshold")
          .maybeSingle(),
      ]);

      if (setting?.data?.setting_value) {
        const v = parseInt(String(setting.data.setting_value), 10);
        if (!isNaN(v)) setThreshold(v);
      }

      const productMap = new Map((prods || []).map((p: any) => [p.id, p]));
      const variantsByProduct = new Map<string, any[]>();
      (vars || []).forEach((v: any) => {
        if (!variantsByProduct.has(v.product_id)) variantsByProduct.set(v.product_id, []);
        variantsByProduct.get(v.product_id)!.push(v);
      });

      const out: Row[] = [];
      (prods || []).forEach((p: any) => {
        const vList = variantsByProduct.get(p.id) || [];
        if (vList.length === 0) {
          out.push({
            product_id: p.id,
            variant_id: null,
            product_name: p.name_mn || p.name,
            variant_label: null,
            sku: p.sku,
            stock: p.stock || 0,
          });
        } else {
          vList.forEach((v: any) => {
            const label = [v.color, v.size, v.name].filter(Boolean).join(" / ") || "—";
            out.push({
              product_id: p.id,
              variant_id: v.id,
              product_name: p.name_mn || p.name,
              variant_label: label,
              sku: v.sku_suffix || p.sku,
              stock: v.stock || 0,
            });
          });
        }
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
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(
        (x) =>
          x.product_name.toLowerCase().includes(q) ||
          (x.sku || "").toLowerCase().includes(q) ||
          (x.variant_label || "").toLowerCase().includes(q),
      );
    }
    return r;
  }, [rows, tab, search, threshold]);

  const lowCount = rows.filter((x) => x.stock <= threshold && x.stock > 0).length;
  const outCount = rows.filter((x) => x.stock <= 0).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package2 className="h-6 w-6" /> Бараа материал
          </h1>
          <p className="text-sm text-muted-foreground">Барааны үлдэгдэл, нөхөн дүүргэлт, гар тохируулга</p>
        </div>
        <Link to="/admin/inventory/movements">
          <Button variant="outline">
            <History className="h-4 w-4 mr-2" />
            Хөдөлгөөний түүх
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Нийт SKU</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rows.length}</div>
          </CardContent>
        </Card>
        <Card className={lowCount > 0 ? "border-amber-300" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Бага үлдэгдэл (≤ {threshold})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{lowCount}</div>
          </CardContent>
        </Card>
        <Card className={outCount > 0 ? "border-destructive" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Дууссан</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{outCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList>
                <TabsTrigger value="all">Бүгд</TabsTrigger>
                <TabsTrigger value="low">Бага ({lowCount})</TabsTrigger>
                <TabsTrigger value="out">Дууссан ({outCount})</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative w-72">
              <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Нэр, SKU, хувилбар..."
                className="pl-8"
              />
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Бараа</TableHead>
                <TableHead>Хувилбар</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Үлдэгдэл</TableHead>
                <TableHead className="text-right">Үйлдэл</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Ачааллаж байна...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Бараа алга
                  </TableCell>
                </TableRow>
              ) : (
                filtered.slice(0, 500).map((r) => {
                  const isOut = r.stock <= 0;
                  const isLow = !isOut && r.stock <= threshold;
                  return (
                    <TableRow key={`${r.product_id}-${r.variant_id || "base"}`}>
                      <TableCell className="font-medium">{r.product_name}</TableCell>
                      <TableCell className="text-muted-foreground">{r.variant_label || "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{r.sku || "—"}</TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={isOut ? "destructive" : isLow ? "secondary" : "outline"}
                          className={isLow ? "bg-amber-100 text-amber-800 hover:bg-amber-100" : ""}
                        >
                          {r.stock}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
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
    </div>
  );
}
