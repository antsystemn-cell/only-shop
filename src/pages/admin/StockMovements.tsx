import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchStockMovements, getMovementTypeBadge, STOCK_MOVEMENT_TYPES, StockMovementRow } from "@/lib/inventory/stockService";
import { History } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function StockMovements() {
  const [rows, setRows] = useState<StockMovementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");

  const [productMap, setProductMap] = useState<Record<string, string>>({});
  const [variantMap, setVariantMap] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchStockMovements({
        movementType: type === "all" ? undefined : type,
        fromDate: from ? new Date(from).toISOString() : undefined,
        toDate: to ? new Date(to + "T23:59:59").toISOString() : undefined,
        limit: 500,
      });
      setRows(data);

      const productIds = Array.from(new Set(data.map((d) => d.product_id).filter(Boolean) as string[]));
      const variantIds = Array.from(new Set(data.map((d) => d.variant_id).filter(Boolean) as string[]));
      if (productIds.length) {
        const { data: ps } = await supabase.from("products").select("id,name,name_mn").in("id", productIds);
        const m: Record<string, string> = {};
        (ps || []).forEach((p: any) => (m[p.id] = p.name_mn || p.name));
        setProductMap(m);
      }
      if (variantIds.length) {
        const { data: vs } = await supabase
          .from("product_variants")
          .select("id,color,size,name")
          .in("id", variantIds);
        const m: Record<string, string> = {};
        (vs || []).forEach((v: any) => {
          m[v.id] = [v.color, v.size, v.name].filter(Boolean).join(" / ") || "хувилбар";
        });
        setVariantMap(m);
      }
    } catch (e: any) {
      toast.error(e.message || "Алдаа");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, from, to]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) => {
      const pname = (r.product_id && productMap[r.product_id]) || "";
      const vname = (r.variant_id && variantMap[r.variant_id]) || "";
      return (
        pname.toLowerCase().includes(q) ||
        vname.toLowerCase().includes(q) ||
        (r.reason || "").toLowerCase().includes(q) ||
        (r.note || "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, productMap, variantMap]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <History className="h-6 w-6" /> Үлдэгдлийн хөдөлгөөн
        </h1>
        <p className="text-sm text-muted-foreground">Бүх stock орлого/зарлагын лог</p>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue placeholder="Төрөл" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Бүх төрөл</SelectItem>
                {STOCK_MOVEMENT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            <Input
              placeholder="Хайх (бараа, шалтгаан...)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Огноо</TableHead>
                <TableHead>Төрөл</TableHead>
                <TableHead>Бараа / Хувилбар</TableHead>
                <TableHead className="text-right">Өөрчлөлт</TableHead>
                <TableHead className="text-right">Өмнөх → Дараах</TableHead>
                <TableHead>Шалтгаан</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Ачааллаж байна...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Бичлэг алга
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => {
                  const t = getMovementTypeBadge(r.movement_type);
                  const pname = (r.product_id && productMap[r.product_id]) || "—";
                  const vname = r.variant_id ? variantMap[r.variant_id] : null;
                  const positive = r.quantity_change > 0;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {format(new Date(r.created_at), "yyyy-MM-dd HH:mm")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={t.color}>
                          {t.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{pname}</div>
                        {vname && <div className="text-xs text-muted-foreground">{vname}</div>}
                      </TableCell>
                      <TableCell
                        className={`text-right font-semibold ${
                          positive ? "text-green-600" : "text-destructive"
                        }`}
                      >
                        {positive ? "+" : ""}
                        {r.quantity_change}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground text-xs">
                        {r.quantity_before} → {r.quantity_after}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.reason || r.note || "—"}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
