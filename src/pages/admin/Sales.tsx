import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Upload, Search, Eye, Printer, Ban, MoreHorizontal } from "lucide-react";
import { format } from "date-fns";
import { ManualSaleDialog } from "@/components/admin/sales/ManualSaleDialog";
import { HistoricalImportDialog } from "@/components/admin/sales/HistoricalImportDialog";
import { getSourceTypeBadge, getDeliveryStatusBadge } from "@/lib/sales/salesService";
import { cancelSale } from "@/lib/sales/cancelSale";
import { printInvoice } from "@/components/admin/InvoicePrint";
import { useToast } from "@/hooks/use-toast";
import OrderDetailSheet from "@/components/admin/OrderDetailSheet";

type TabKey = "all" | "website" | "manual" | "historical" | "cancelled";

export default function Sales() {
  const [tab, setTab] = useState<TabKey>("all");
  const [search, setSearch] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [historicalOpen, setHistoricalOpen] = useState(false);
  const [defaultHistorical, setDefaultHistorical] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<any>(null);
  const [restoreStock, setRestoreStock] = useState(true);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const cancelMutation = useMutation({
    mutationFn: ({ id, restore }: { id: string; restore: boolean }) =>
      cancelSale(id, { restoreStock: restore }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "sales"] });
      toast({ title: "Захиалга цуцлагдлаа" });
      setCancelTarget(null);
    },
    onError: (e: any) => toast({ title: "Алдаа", description: e.message, variant: "destructive" }),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "sales", tab, search],
    queryFn: async () => {
      let q = supabase
        .from("orders")
        .select("*, order_items(*)")
        .order("sale_date", { ascending: false })
        .limit(200);

      if (tab === "website") q = q.eq("source_type", "website_order");
      if (tab === "manual") q = q.eq("is_manual", true).eq("is_historical", false);
      if (tab === "historical") q = q.eq("is_historical", true);
      if (tab === "cancelled") q = q.eq("status", "cancelled" as any);

      if (search) {
        q = q.or(
          `order_number.ilike.%${search}%,customer_name.ilike.%${search}%,customer_phone.ilike.%${search}%`
        );
      }

      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const totals = (() => {
    const r = data || [];
    return {
      count: r.length,
      revenue: r.reduce((s, o: any) => s + Number(o.total || 0), 0),
      cost: r.reduce((s, o: any) => s + Number(o.cost_amount || 0), 0),
    };
  })();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Борлуулалт</h1>
          <p className="text-muted-foreground mt-1">
            Бүх захиалга — вэбсайт, гар, түүхэн борлуулалт
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setDefaultHistorical(false);
              setManualOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-1" /> Гар захиалга
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setDefaultHistorical(true);
              setManualOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-1" /> Түүхэн борлуулалт
          </Button>
          <Button onClick={() => setHistoricalOpen(true)}>
            <Upload className="w-4 h-4 mr-1" /> CSV импорт
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Захиалгын тоо</div>
            <div className="text-2xl font-bold">{totals.count}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Нийт орлого</div>
            <div className="text-2xl font-bold">{totals.revenue.toLocaleString()}₮</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Тооцоолсон ашиг</div>
            <div className="text-2xl font-bold">
              {(totals.revenue - totals.cost).toLocaleString()}₮
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs + Search */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-3 justify-between items-center">
            <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
              <TabsList>
                <TabsTrigger value="all">Бүгд</TabsTrigger>
                <TabsTrigger value="website">Вэбсайт</TabsTrigger>
                <TabsTrigger value="manual">Гар</TabsTrigger>
                <TabsTrigger value="historical">Түүхэн</TabsTrigger>
                <TabsTrigger value="cancelled">Цуцлагдсан</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-2 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Дугаар / нэр / утас"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Дугаар</TableHead>
                  <TableHead>Огноо</TableHead>
                  <TableHead>Эх үүсвэр</TableHead>
                  <TableHead>Үйлчлүүлэгч</TableHead>
                  <TableHead>Хүргэлт</TableHead>
                  <TableHead className="text-right">Дүн</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={7}>
                        <Skeleton className="h-8 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : data?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Захиалга алга
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.map((o: any) => {
                    const src = getSourceTypeBadge(o.source_type);
                    const del = getDeliveryStatusBadge(o);
                    return (
                      <TableRow key={o.id}>
                        <TableCell className="font-mono text-xs">{o.order_number}</TableCell>
                        <TableCell className="text-xs">
                          {format(new Date(o.sale_date || o.created_at), "yyyy-MM-dd HH:mm")}
                        </TableCell>
                        <TableCell>
                          <Badge className={src.color} variant="secondary">{src.label}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          <div>{o.customer_name || "—"}</div>
                          <div className="text-xs text-muted-foreground">{o.customer_phone || ""}</div>
                        </TableCell>
                        <TableCell>
                          <Badge className={del.color} variant="secondary">{del.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {Number(o.total).toLocaleString()}₮
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => { setSelectedOrder(o); setDetailOpen(true); }}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="icon" variant="ghost"><MoreHorizontal className="w-4 h-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => printInvoice(o)}>
                                  <Printer className="w-4 h-4 mr-2" /> Нэхэмжлэх хэвлэх
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  disabled={o.status === "cancelled"}
                                  onClick={() => { setRestoreStock(true); setCancelTarget(o); }}
                                >
                                  <Ban className="w-4 h-4 mr-2" /> Цуцлах
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <ManualSaleDialog
        open={manualOpen}
        onOpenChange={setManualOpen}
        defaultHistorical={defaultHistorical}
      />
      <HistoricalImportDialog open={historicalOpen} onOpenChange={setHistoricalOpen} />
      {selectedOrder && (
        <OrderDetailSheet
          order={selectedOrder}
          open={detailOpen}
          onClose={() => setDetailOpen(false)}
          onFulfillmentChange={() => {}}
          onPaymentChange={() => {}}
          isMobile={false}
        />
      )}

      <AlertDialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Захиалгыг цуцлах уу?</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelTarget?.order_number} · {Number(cancelTarget?.total || 0).toLocaleString()}₮
              <br />
              Цуцалсны дараа орлогод тооцогдохгүй болно.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label className="flex items-center gap-2 text-sm py-2">
            <input
              type="checkbox"
              checked={restoreStock}
              onChange={(e) => setRestoreStock(e.target.checked)}
            />
            Үлдэгдлийг буцаан нэмэх (stock restore)
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel>Болих</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                cancelTarget && cancelMutation.mutate({ id: cancelTarget.id, restore: restoreStock })
              }
            >
              Цуцлах
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
