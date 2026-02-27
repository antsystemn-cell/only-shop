import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Search, ShoppingCart, Eye, ChevronLeft, ChevronRight,
  Package, XCircle, Loader2, Download, Filter,
  RefreshCw, Globe,
} from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────

function formatPrice(amount?: number) {
  if (amount == null) return "—";
  return new Intl.NumberFormat("mn-MN").format(Math.round(amount)) + "₮";
}

function getStatusColor(status?: string): string {
  if (!status) return "bg-muted text-muted-foreground";
  const s = status.toLowerCase();
  if (s === "cancelled") return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
  if (s === "delivered" || s === "completed") return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
  if (s === "shipped") return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";
  if (s === "processing") return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
  if (s === "pending") return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
  return "bg-muted text-muted-foreground";
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Хүлээгдэж буй",
  processing: "Боловсруулж буй",
  shipped: "Хүргэлтэд",
  delivered: "Хүргэгдсэн",
  completed: "Дууссан",
  cancelled: "Цуцлагдсан",
};

const STATUS_FILTERS = [
  { value: "all", label: "Бүгд" },
  { value: "pending", label: "Хүлээгдэж буй" },
  { value: "processing", label: "Боловсруулж буй" },
  { value: "shipped", label: "Хүргэлтэд" },
  { value: "delivered", label: "Хүргэгдсэн" },
  { value: "cancelled", label: "Цуцлагдсан" },
];

// ─── Main Component ──────────────────────────────────────────

export default function OtOrdersTab() {
  const [searchOrderNumber, setSearchOrderNumber] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [pageSize] = useState(20);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // ── Fetch orders from local DB ──
  const { data: ordersResult, isLoading, refetch } = useQuery({
    queryKey: ["admin", "ot-orders-local", searchOrderNumber, statusFilter, page],
    queryFn: async () => {
      let query = supabase
        .from("ot_orders")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      if (searchOrderNumber.trim()) {
        query = query.ilike("order_number", `%${searchOrderNumber.trim()}%`);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { orders: data || [], count: count || 0 };
    },
  });

  const orders = ordersResult?.orders || [];
  const totalCount = ordersResult?.count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  // ── Update status mutation ──
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("ot_orders")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Төлөв шинэчлэгдлээ" });
      queryClient.invalidateQueries({ queryKey: ["admin", "ot-orders-local"] });
      setCancelTarget(null);
    },
    onError: (e: any) => toast({ title: "Алдаа", description: e.message, variant: "destructive" }),
  });

  const openDetail = (order: any) => {
    setSelectedOrder(order);
    setDetailOpen(true);
  };

  // ── CSV Export ──
  const handleExportCsv = useCallback(() => {
    if (!orders.length) return;
    const headers = ["Order Number", "Status", "Items", "Subtotal", "Delivery", "Date"];
    const rows = orders.map((order: any) => {
      return [
        order.order_number,
        order.status,
        order.item_count,
        order.subtotal,
        order.delivery_type,
        order.created_at,
      ].join(",");
    });
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ot-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: "CSV татагдлаа", description: `${orders.length} захиалга экспортлогдлоо` });
  }, [orders, toast]);

  // ── Stats ──
  const stats = {
    total: totalCount,
    displayed: orders.length,
    pendingCount: orders.filter((o: any) => o.status === "pending").length,
    processingCount: orders.filter((o: any) => o.status === "processing").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            <Globe className="h-3 w-3 mr-1" /> OT Commerce
          </Badge>
          <span className="text-sm text-muted-foreground">Гадаад барааны захиалгууд</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1" /> Шинэчлэх
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={!orders.length}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">Нийт</p><p className="text-2xl font-bold">{stats.total}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">Харуулсан</p><p className="text-2xl font-bold">{stats.displayed}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">Хүлээгдэж</p><p className="text-2xl font-bold text-accent-foreground">{stats.pendingCount}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">Боловсруулж</p><p className="text-2xl font-bold text-primary">{stats.processingCount}</p></CardContent></Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Захиалгын дугаараар хайх..."
                value={searchOrderNumber}
                onChange={(e) => { setSearchOrderNumber(e.target.value); setPage(0); }}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
              <SelectTrigger>
                <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Төлөв" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map(f => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            OT Захиалгын жагсаалт
            {orders.length > 0 && <Badge variant="secondary">{totalCount}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : orders.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Дугаар</TableHead>
                      <TableHead className="text-center">Бараа</TableHead>
                      <TableHead className="text-right">Дүн</TableHead>
                      <TableHead className="text-center">Хүргэлт</TableHead>
                      <TableHead className="text-center">Төлөв</TableHead>
                      <TableHead className="text-center">Огноо</TableHead>
                      <TableHead className="text-center">Үйлдэл</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order: any) => (
                      <TableRow key={order.id} className="hover:bg-muted/50">
                        <TableCell>
                          <div className="font-mono text-sm font-medium">{order.order_number}</div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{order.item_count}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatPrice(order.subtotal)}
                        </TableCell>
                        <TableCell className="text-center text-sm">
                          {order.delivery_type === "delivery" ? "Хүргэлт" : "Өөрөө авна"}
                        </TableCell>
                        <TableCell className="text-center">
                          <Select
                            value={order.status}
                            onValueChange={(v) => updateStatusMutation.mutate({ id: order.id, status: v })}
                          >
                            <SelectTrigger className="h-7 w-[140px] text-xs">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                                {STATUS_LABELS[order.status] || order.status}
                              </span>
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                                <SelectItem key={value} value={value}>{label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-center text-sm text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString("mn-MN")}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openDetail(order)} title="Дэлгэрэнгүй">
                              <Eye className="h-4 w-4" />
                            </Button>
                            {order.status !== "cancelled" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setCancelTarget(order.id)}
                                title="Цуцлах"
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    {page * pageSize + 1}–{Math.min((page + 1) * pageSize, totalCount)} / {totalCount}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">Захиалга олдсонгүй</p>
              <p className="text-sm text-muted-foreground">Шүүлтүүрээ өөрчилж дахин хайна уу</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order Detail Sheet */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Захиалгын дэлгэрэнгүй</SheetTitle>
          </SheetHeader>
          {selectedOrder && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <Label className="text-muted-foreground">Дугаар</Label>
                  <p className="font-mono font-semibold">{selectedOrder.order_number}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Төлөв</Label>
                  <p><Badge className={getStatusColor(selectedOrder.status)}>{STATUS_LABELS[selectedOrder.status] || selectedOrder.status}</Badge></p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Хүргэлт</Label>
                  <p>{selectedOrder.delivery_type === "delivery" ? "Хүргэлтээр" : "Өөрөө авна"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Огноо</Label>
                  <p>{new Date(selectedOrder.created_at).toLocaleString("mn-MN")}</p>
                </div>
              </div>

              {/* Delivery Address */}
              {selectedOrder.delivery_address && (
                <div>
                  <Label className="text-muted-foreground">Хаяг</Label>
                  <p className="text-sm mt-1">
                    {selectedOrder.delivery_address.fullName} — {selectedOrder.delivery_address.address}
                    {selectedOrder.delivery_address.phone && ` (${selectedOrder.delivery_address.phone})`}
                  </p>
                </div>
              )}

              {/* Comment */}
              {selectedOrder.comment && (
                <div>
                  <Label className="text-muted-foreground">Тэмдэглэл</Label>
                  <p className="text-sm mt-1">{selectedOrder.comment}</p>
                </div>
              )}

              {/* Items */}
              <div>
                <Label className="text-muted-foreground mb-2 block">Бараанууд ({selectedOrder.item_count})</Label>
                <div className="space-y-2">
                  {(selectedOrder.items as any[] || []).map((item: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 p-2 rounded-lg border">
                      <div className="w-12 h-12 rounded bg-muted overflow-hidden shrink-0">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm line-clamp-2">{item.title}</p>
                        {item.configurators && <p className="text-xs text-muted-foreground">{item.configurators}</p>}
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {item.quantity} × {formatPrice(item.price)}
                          {item.originalCnyPrice && ` (${item.originalCnyCurrency || "¥"}${item.originalCnyPrice})`}
                        </p>
                      </div>
                      <span className="text-sm font-medium shrink-0">{formatPrice(item.totalPrice)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div className="flex justify-between font-bold text-lg pt-2 border-t">
                <span>Нийт:</span>
                <span className="text-primary">{formatPrice(selectedOrder.subtotal)}</span>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Cancel Confirmation */}
      <AlertDialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Захиалга цуцлах уу?</AlertDialogTitle>
            <AlertDialogDescription>Энэ захиалгын төлөвийг "Цуцлагдсан" болгож өөрчлөх гэж байна.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Буцах</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelTarget && updateStatusMutation.mutate({ id: cancelTarget, status: "cancelled" })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Цуцлах
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
