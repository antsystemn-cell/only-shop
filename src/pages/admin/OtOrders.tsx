import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { searchAllOtOrders, getSalesOrderDetails, cancelSalesOrder, cancelLineSalesOrder, getOrderLineStatusHistory } from "@/services/otApi";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Search, ShoppingCart, Eye, ChevronLeft, ChevronRight, ExternalLink,
  Package, XCircle, Clock, User, History, Loader2, Download, Filter,
  CheckCircle, RefreshCw,
} from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────

function formatPrice(amount?: number, currency?: string) {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(amount) + (currency || "¥");
}

function normalizeOrders(data: any): any[] {
  const items = data?.Result?.Items?.Items
    || data?.Result?.Items
    || data?.Result?.Content?.Items
    || [];
  return Array.isArray(items) ? items : [];
}

function normalizeTotalCount(data: any): number {
  return data?.Result?.Items?.TotalCount
    || data?.Result?.TotalCount
    || data?.Result?.Content?.TotalCount
    || 0;
}

function getStatusColor(status?: string): string {
  if (!status) return "bg-muted text-muted-foreground";
  const s = status.toLowerCase();
  if (s.includes("cancel")) return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
  if (s.includes("deliver") || s.includes("complet") || s.includes("received")) return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
  if (s.includes("ship") || s.includes("send") || s.includes("transit")) return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";
  if (s.includes("process") || s.includes("purchas") || s.includes("paid")) return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
  if (s.includes("wait") || s.includes("pending") || s.includes("new")) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
  return "bg-muted text-muted-foreground";
}

const STATUS_FILTERS = [
  { value: "all", label: "Бүгд" },
  { value: "new", label: "Шинэ" },
  { value: "pending", label: "Хүлээгдэж" },
  { value: "processing", label: "Бэлтгэгдэж" },
  { value: "purchased", label: "Худалдаж авсан" },
  { value: "shipped", label: "Хүргэлтэд" },
  { value: "delivered", label: "Хүргэгдсэн" },
  { value: "cancelled", label: "Цуцлагдсан" },
];

// ─── Main Component ──────────────────────────────────────────

export default function OtOrders() {
  const [searchUserId, setSearchUserId] = useState("");
  const [searchOrderId, setSearchOrderId] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [providerFilter, setProviderFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [pageSize] = useState(20);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<{ type: "order" | "line"; id: string; name?: string } | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // ── Search orders ──
  const { data: ordersData, isLoading, refetch } = useQuery({
    queryKey: ["admin", "ot-orders", searchUserId, searchOrderId, statusFilter, providerFilter, page],
    queryFn: () => searchAllOtOrders({
      userId: searchUserId || undefined,
      orderId: searchOrderId || undefined,
      page,
      pageSize,
    }),
  });

  const allOrders = normalizeOrders(ordersData);
  
  // Client-side filtering for status and provider
  const orders = allOrders.filter((order: any) => {
    const statusName = (order.StatusName || order.Status?.Name || "").toLowerCase();
    const provider = (order.ProviderType || order.Provider || "").toLowerCase();
    
    if (statusFilter !== "all" && !statusName.includes(statusFilter)) return false;
    if (providerFilter !== "all" && !provider.includes(providerFilter)) return false;
    return true;
  });

  const totalCount = normalizeTotalCount(ordersData);
  const totalPages = Math.ceil(totalCount / pageSize);

  // ── Order detail ──
  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: ["admin", "ot-order-detail", selectedOrderId],
    queryFn: () => getSalesOrderDetails(selectedOrderId!) as Promise<any>,
    enabled: !!selectedOrderId && detailOpen,
  });

  const orderDetail = (detailData as any)?.Result;

  // ── Cancel mutations ──
  const cancelOrderMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => cancelSalesOrder(id, reason),
    onSuccess: () => {
      toast({ title: "Захиалга цуцлагдлаа" });
      queryClient.invalidateQueries({ queryKey: ["admin", "ot-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "ot-order-detail"] });
      setCancelTarget(null);
      setCancelReason("");
    },
    onError: (e: any) => toast({ title: "Алдаа", description: e.message, variant: "destructive" }),
  });

  const cancelLineMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => cancelLineSalesOrder(id, reason),
    onSuccess: () => {
      toast({ title: "Бараа цуцлагдлаа" });
      queryClient.invalidateQueries({ queryKey: ["admin", "ot-order-detail"] });
      setCancelTarget(null);
      setCancelReason("");
    },
    onError: (e: any) => toast({ title: "Алдаа", description: e.message, variant: "destructive" }),
  });

  const handleCancel = () => {
    if (!cancelTarget) return;
    if (cancelTarget.type === "order") {
      cancelOrderMutation.mutate({ id: cancelTarget.id, reason: cancelReason || undefined });
    } else {
      cancelLineMutation.mutate({ id: cancelTarget.id, reason: cancelReason || undefined });
    }
  };

  const openDetail = (orderId: string) => {
    setSelectedOrderId(orderId);
    setDetailOpen(true);
  };

  // ── CSV Export ──
  const handleExportCsv = useCallback(() => {
    if (!orders.length) return;
    const headers = ["Order ID", "User ID", "Status", "Items", "Amount", "Date"];
    const rows = orders.map((order: any) => {
      const id = order.Id || order.SalesOrderId || "";
      const userId = order.UserId || order.CustomerUserId || "";
      const statusName = order.StatusName || order.Status?.Name || "";
      const total = order.TotalPrice?.ConvertedPrice ?? order.TotalPrice?.OriginalPrice ?? order.Amount ?? "";
      const itemCount = order.OrderLinesCount || order.ItemsCount || "";
      const createdAt = order.CreatedDate || order.CreateDate || "";
      return [id, userId, statusName, itemCount, total, createdAt].join(",");
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
    filtered: orders.length,
    pendingCount: allOrders.filter((o: any) => {
      const s = (o.StatusName || o.Status?.Name || "").toLowerCase();
      return s.includes("pending") || s.includes("new") || s.includes("wait");
    }).length,
    shippedCount: allOrders.filter((o: any) => {
      const s = (o.StatusName || o.Status?.Name || "").toLowerCase();
      return s.includes("ship") || s.includes("transit") || s.includes("send");
    }).length,
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">OT Захиалгууд</h1>
          <p className="text-muted-foreground mt-1">OT API-н захиалгуудыг хайх, удирдах</p>
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
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Нийт</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Шүүсэн</p>
            <p className="text-2xl font-bold">{stats.filtered}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Хүлээгдэж</p>
            <p className="text-2xl font-bold text-accent-foreground">{stats.pendingCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Хүргэлтэд</p>
            <p className="text-2xl font-bold text-primary">{stats.shippedCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="User ID-ээр хайх..."
                value={searchUserId}
                onChange={(e) => { setSearchUserId(e.target.value); setPage(0); }}
                className="pl-10"
              />
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Захиалгын ID-ээр хайх..."
                value={searchOrderId}
                onChange={(e) => { setSearchOrderId(e.target.value); setPage(0); }}
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
            <Select value={providerFilter} onValueChange={(v) => { setProviderFilter(v); setPage(0); }}>
              <SelectTrigger>
                <SelectValue placeholder="Нийлүүлэгч" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Бүх нийлүүлэгч</SelectItem>
                <SelectItem value="taobao">Taobao</SelectItem>
                <SelectItem value="poizon">Poizon</SelectItem>
                <SelectItem value="1688">1688</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="mt-3 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setSearchUserId(""); setSearchOrderId(""); setStatusFilter("all"); setProviderFilter("all"); setPage(0); }}
              disabled={!searchUserId && !searchOrderId && statusFilter === "all" && providerFilter === "all"}
            >
              Бүх шүүлтүүр цэвэрлэх
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            OT Захиалгын жагсаалт
            {orders.length > 0 && <Badge variant="secondary">{orders.length}</Badge>}
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
                      <TableHead>Захиалга ID</TableHead>
                      <TableHead>Хэрэглэгч</TableHead>
                      <TableHead className="text-center">Бараа</TableHead>
                      <TableHead className="text-right">Дүн</TableHead>
                      <TableHead className="text-center">Төлөв</TableHead>
                      <TableHead className="text-center">Огноо</TableHead>
                      <TableHead className="text-center">Үйлдэл</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order: any) => {
                      const id = order.Id || order.SalesOrderId || "";
                      const userId = order.UserId || order.CustomerUserId || "";
                      const statusName = order.StatusName || order.Status?.Name || order.StatusId || "";
                      const total = order.TotalPrice?.ConvertedPrice ?? order.TotalPrice?.OriginalPrice ?? order.Amount;
                      const currency = order.TotalPrice?.CurrencySign || "¥";
                      const itemCount = order.OrderLinesCount || order.ItemsCount || "—";
                      const createdAt = order.CreatedDate || order.CreateDate || "";

                      return (
                        <TableRow key={id} className="hover:bg-muted/50">
                          <TableCell>
                            <div className="font-mono text-sm font-medium">{id}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm text-muted-foreground">{userId || "—"}</div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary">{itemCount}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatPrice(total, currency)}
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(statusName)}`}>
                              {statusName || "—"}
                            </span>
                          </TableCell>
                          <TableCell className="text-center text-sm text-muted-foreground">
                            {createdAt ? new Date(createdAt).toLocaleDateString() : "—"}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openDetail(id)} title="Дэлгэрэнгүй">
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setCancelTarget({ type: "order", id })}
                                title="Цуцлах"
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Нийт {totalCount} захиалга — Хуудас {page + 1}/{totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                      <ChevronLeft className="h-4 w-4 mr-1" /> Өмнөх
                    </Button>
                    <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                      Дараах <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>OT захиалга олдсонгүй</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order Detail Sheet */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Захиалгын дэлгэрэнгүй: {selectedOrderId}
            </SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {detailLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
              </div>
            ) : orderDetail ? (
              <OrderDetailContent
                detail={orderDetail}
                onCancelLine={(lineId, name) => setCancelTarget({ type: "line", id: lineId, name })}
              />
            ) : (
              <p className="text-muted-foreground text-center py-8">Мэдээлэл олдсонгүй</p>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Cancel Confirmation */}
      <AlertDialog open={!!cancelTarget} onOpenChange={() => { setCancelTarget(null); setCancelReason(""); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {cancelTarget?.type === "order" ? "Захиалга цуцлах" : `Бараа цуцлах`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {cancelTarget?.type === "order"
                ? `${cancelTarget.id} дугаартай захиалгыг цуцлах уу?`
                : `"${cancelTarget?.name || cancelTarget?.id}" барааг цуцлах уу?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label>Шалтгаан (заавал биш)</Label>
            <Textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Цуцлах шалтгаан..."
              className="mt-1"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Болих</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
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

// ─── Order Detail Content ────────────────────────────────────

function OrderDetailContent({ detail, onCancelLine }: { detail: any; onCancelLine: (lineId: string, name?: string) => void }) {
  const order = detail?.SalesOrder || detail;
  const orderLines = order?.OrderLines?.Items || order?.OrderLines || [];
  const statusName = order?.StatusName || order?.Status?.Name || "";
  const totalPrice = order?.TotalPrice;
  const userId = order?.UserId || order?.CustomerUserId || "";
  const createdAt = order?.CreatedDate || order?.CreateDate || "";
  const deliveryMode = order?.DeliveryModeName || order?.DeliveryMode?.Name || "";
  const comment = order?.Comment || "";
  const providerType = order?.ProviderType || "";

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-4 space-y-2">
            <Label className="text-muted-foreground text-xs">Төлөв</Label>
            <div>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(statusName)}`}>
                {statusName || "—"}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 space-y-2">
            <Label className="text-muted-foreground text-xs">Нийт дүн</Label>
            <div className="text-lg font-bold">
              {formatPrice(totalPrice?.ConvertedPrice ?? totalPrice?.OriginalPrice, totalPrice?.CurrencySign)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 space-y-2">
            <Label className="text-muted-foreground text-xs">Хэрэглэгч ID</Label>
            <div className="font-mono text-sm">{userId || "—"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 space-y-2">
            <Label className="text-muted-foreground text-xs">Огноо</Label>
            <div className="text-sm">{createdAt ? new Date(createdAt).toLocaleString() : "—"}</div>
          </CardContent>
        </Card>
      </div>

      {providerType && (
        <Card>
          <CardContent className="pt-4">
            <Label className="text-muted-foreground text-xs">Нийлүүлэгч</Label>
            <p className="text-sm mt-1 font-medium">{providerType}</p>
          </CardContent>
        </Card>
      )}

      {deliveryMode && (
        <Card>
          <CardContent className="pt-4">
            <Label className="text-muted-foreground text-xs">Хүргэлтийн горим</Label>
            <p className="text-sm mt-1">{deliveryMode}</p>
          </CardContent>
        </Card>
      )}

      {comment && (
        <Card>
          <CardContent className="pt-4">
            <Label className="text-muted-foreground text-xs">Тэмдэглэл</Label>
            <p className="text-sm mt-1">{comment}</p>
          </CardContent>
        </Card>
      )}

      {/* Order Lines */}
      <div>
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Package className="h-4 w-4" /> Барааны жагсаалт ({orderLines.length})
        </h3>
        <div className="space-y-3">
          {orderLines.map((line: any, idx: number) => (
            <OrderLineCard key={line.Id || idx} line={line} onCancel={onCancelLine} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Order Line Card with Timeline ───────────────────────────

function OrderLineCard({ line, onCancel }: { line: any; onCancel: (lineId: string, name?: string) => void }) {
  const [showTimeline, setShowTimeline] = useState(false);
  const lineId = line.Id || "";
  const title = line.Title || line.ItemTitle || line.ExternalTitle || "Бараа";
  const imageUrl = line.ImageUrl || line.MainPictureUrl || "";
  const quantity = line.Quantity || 1;
  const price = line.Price || line.TotalPrice;
  const priceDisplay = price ? formatPrice(price.ConvertedPrice ?? price.OriginalPrice, price.CurrencySign) : "—";
  const statusName = line.StatusName || line.Status?.Name || "";
  const vendorName = line.VendorName || line.ProviderName || "";
  const vendorUrl = line.VendorUrl || line.ProviderUrl || "";
  const itemId = line.ItemId || line.ExternalItemId || "";

  const { data: timelineData, isLoading: timelineLoading } = useQuery({
    queryKey: ["ot-order-line-timeline", lineId],
    queryFn: () => getOrderLineStatusHistory(lineId) as Promise<any>,
    enabled: showTimeline && !!lineId,
  });

  const timeline = (timelineData as any)?.Result?.Items || (timelineData as any)?.Result?.StatusHistory?.Items || [];

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex gap-4">
          {imageUrl && (
            <img src={imageUrl} alt="" className="w-16 h-16 rounded-lg object-cover border shrink-0" />
          )}
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium line-clamp-2">{title}</p>
                <p className="text-xs text-muted-foreground">ID: {itemId}</p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${getStatusColor(statusName)}`}>
                {statusName || "—"}
              </span>
            </div>

            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>Тоо: {quantity}</span>
              <span className="font-medium text-foreground">{priceDisplay}</span>
            </div>

            {vendorName && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span>Нийлүүлэгч: {vendorName}</span>
                {vendorUrl && (
                  <a href={vendorUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowTimeline(!showTimeline)}>
                <History className="h-3 w-3 mr-1" />
                Түүх
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-destructive hover:text-destructive"
                onClick={() => onCancel(lineId, title)}
              >
                <XCircle className="h-3 w-3 mr-1" />
                Цуцлах
              </Button>
            </div>

            {/* Timeline */}
            {showTimeline && (
              <div className="mt-3 pl-4 border-l-2 border-muted space-y-3">
                {timelineLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Уншиж байна...
                  </div>
                ) : timeline.length > 0 ? (
                  timeline.map((entry: any, idx: number) => (
                    <div key={idx} className="relative">
                      <div className="absolute -left-[calc(1rem+5px)] top-1 w-2.5 h-2.5 rounded-full bg-primary border-2 border-background" />
                      <div>
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${getStatusColor(entry.StatusName || entry.Name)}`}>
                          {entry.StatusName || entry.Name || "—"}
                        </span>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {entry.Date ? new Date(entry.Date).toLocaleString() : ""}
                        </p>
                        {entry.Comment && <p className="text-xs mt-0.5">{entry.Comment}</p>}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">Статусын түүх олдсонгүй</p>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
