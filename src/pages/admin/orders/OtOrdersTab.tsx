import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Search, ShoppingCart, Eye, ChevronLeft, ChevronRight,
  Package, XCircle, Download, Filter,
  RefreshCw, Globe, User, MapPin,
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
  if (s === "delivered") return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
  if (s === "arrived_ub") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
  if (s === "shipped_mn") return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";
  if (s === "at_warehouse") return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400";
  if (s === "foreign_ordered") return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
  if (s === "paid") return "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400";
  if (s === "pending") return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
  return "bg-muted text-muted-foreground";
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Төлбөр хүлээгдэж байна",
  paid: "Төлбөр төлөгдсөн",
  foreign_ordered: "Гадаад захиалга хийгдсэн",
  at_warehouse: "Гадаад агуулахад",
  shipped_mn: "МН руу ачигдсан",
  arrived_ub: "УБ-д ирсэн",
  delivered: "Хүлээлгэн өгсөн",
  cancelled: "Цуцлагдсан",
};

const STATUS_LABELS_FULL: Record<string, string> = {
  pending: "Төлбөр хүлээгдэж байна",
  paid: "Төлбөр төлөгдсөн",
  foreign_ordered: "Гадаад захиалга хийгдсэн",
  at_warehouse: "Гадаад агуулахад хүлээн авсан",
  shipped_mn: "Монгол руу ачигдсан",
  arrived_ub: "Улаанбаатарт ирсэн",
  delivered: "Хүлээлгэн өгсөн",
  cancelled: "Цуцлагдсан",
};

const STATUS_FILTERS = [
  { value: "all", label: "Бүгд" },
  ...Object.entries(STATUS_LABELS_FULL).map(([value, label]) => ({ value, label })),
];

// ─── Main Component ──────────────────────────────────────────

export default function OtOrdersTab() {
  const [searchOrderNumber, setSearchOrderNumber] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [pageSize] = useState(20);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [cancelTarget, setCancelTarget] = useState<any>(null);
  const [cancelReason, setCancelReason] = useState("");
  const isMobile = useIsMobile();

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: ordersResult, isLoading, refetch } = useQuery({
    queryKey: ["admin", "ot-orders-local", searchOrderNumber, statusFilter, page],
    queryFn: async () => {
      let query = supabase
        .from("ot_orders")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      if (searchOrderNumber.trim()) query = query.ilike("order_number", `%${searchOrderNumber.trim()}%`);

      const { data, error, count } = await query;
      if (error) throw error;

      const userIds = [...new Set(data?.map(o => o.user_id).filter(Boolean))] as string[];
      let profilesMap: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, email, phone")
          .in("user_id", userIds);
        profiles?.forEach(p => { profilesMap[p.user_id] = p; });
      }

      return {
        orders: (data || []).map(o => ({ ...o, profile: profilesMap[o.user_id || ""] || null })),
        count: count || 0,
      };
    },
  });

  const orders = ordersResult?.orders || [];
  const totalCount = ordersResult?.count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, cancel_reason }: { id: string; status: string; cancel_reason?: string }) => {
      const { data: order } = await supabase
        .from("ot_orders")
        .select("user_id, subtotal, status")
        .eq("id", id)
        .single();

      const updateData: any = { status };
      if (cancel_reason) updateData.cancel_reason = cancel_reason;

      const { error } = await supabase.from("ot_orders").update(updateData).eq("id", id);
      if (error) throw error;

      const PAID_STATUSES = ["paid", "foreign_ordered", "at_warehouse", "shipped_mn", "arrived_ub", "delivered"];
      if (status === "cancelled" && order?.user_id && order.subtotal > 0 && PAID_STATUSES.includes(order.status)) {
        await supabase.rpc("credit_wallet", { p_user_id: order.user_id, p_amount: order.subtotal });
      }
    },
    onSuccess: () => {
      toast({ title: "Төлөв шинэчлэгдлээ" });
      queryClient.invalidateQueries({ queryKey: ["admin", "ot-orders-local"] });
      setCancelTarget(null);
      setCancelReason("");
    },
    onError: (e: any) => toast({ title: "Алдаа", description: e.message, variant: "destructive" }),
  });

  const openDetail = (order: any) => {
    setSelectedOrder(order);
    setDetailOpen(true);
  };

  const handleExportCsv = useCallback(() => {
    if (!orders.length) return;
    const headers = ["Order Number", "Status", "Items", "Subtotal", "Delivery", "Date"];
    const rows = orders.map((order: any) => [order.order_number, order.status, order.item_count, order.subtotal, order.delivery_type, order.created_at].join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ot-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: "CSV татагдлаа" });
  }, [orders, toast]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            <Globe className="h-3 w-3 mr-1" /> OT Commerce
          </Badge>
          <span className="text-sm text-muted-foreground hidden sm:inline">Гадаад барааны захиалгууд</span>
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

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Дугаараар хайх..."
                value={searchOrderNumber}
                onChange={(e) => { setSearchOrderNumber(e.target.value); setPage(0); }}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
              <SelectTrigger className="w-full sm:w-[200px]">
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

      {/* Orders */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShoppingCart className="h-5 w-5 text-primary" />
            OT Захиалга
            {orders.length > 0 && <Badge variant="secondary">{totalCount}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-6 sm:pt-0">
          {isLoading ? (
            <div className="space-y-3 p-4">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : orders.length > 0 ? (
            <>
              {/* Mobile: Card layout */}
              {isMobile ? (
                <div className="divide-y">
                  {orders.map((order: any) => (
                    <div key={order.id} className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm font-medium">{order.order_number}</span>
                        <Badge className={`${getStatusColor(order.status)} text-[10px] px-1.5 py-0.5`}>
                          {STATUS_LABELS[order.status] || order.status}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {order.profile?.full_name || (order.delivery_address as any)?.guest_phone ? `📱 ${(order.delivery_address as any)?.guest_phone}` : "Зочин"}
                        </span>
                        <span className="font-medium">{formatPrice(order.subtotal)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {order.item_count} бараа · {new Date(order.created_at).toLocaleDateString("mn-MN")}
                        </span>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => openDetail(order)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {order.status !== "cancelled" && (
                            <Button variant="ghost" size="sm" className="h-8 px-2 text-destructive" onClick={() => setCancelTarget(order)}>
                              <XCircle className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Desktop: Compact table */
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[130px]">Дугаар</TableHead>
                      <TableHead className="w-[140px]">Хэрэглэгч</TableHead>
                      <TableHead className="text-center w-[50px]">Бараа</TableHead>
                      <TableHead className="text-right w-[100px]">Дүн</TableHead>
                      <TableHead className="text-center w-[160px]">Төлөв</TableHead>
                      <TableHead className="text-center w-[90px]">Огноо</TableHead>
                      <TableHead className="text-center w-[70px]">Үйлдэл</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order: any) => (
                      <TableRow key={order.id} className="hover:bg-muted/50">
                        <TableCell className="py-2">
                          <span className="font-mono text-xs font-medium">{order.order_number}</span>
                        </TableCell>
                        <TableCell className="py-2">
                          <div className="text-sm font-medium truncate max-w-[130px]">
                            {order.profile?.full_name || ((order.delivery_address as any)?.guest_phone ? `📱 ${(order.delivery_address as any).guest_phone}` : "Зочин")}
                          </div>
                          <div className="text-xs text-muted-foreground truncate max-w-[130px]">
                            {order.profile?.phone || order.profile?.email || ((order.delivery_address as any)?.guest_phone && "Зочин хэрэглэгч")}
                          </div>
                        </TableCell>
                        <TableCell className="text-center py-2">
                          <Badge variant="secondary" className="text-xs">{order.item_count}</Badge>
                        </TableCell>
                        <TableCell className="text-right py-2 font-medium text-sm">
                          {formatPrice(order.subtotal)}
                        </TableCell>
                        <TableCell className="text-center py-2" onClick={(e) => e.stopPropagation()}>
                          <Select
                            value={order.status}
                            onValueChange={(v) => {
                              if (v === "cancelled") setCancelTarget(order);
                              else updateStatusMutation.mutate({ id: order.id, status: v });
                            }}
                          >
                            <SelectTrigger className="h-7 w-[150px] text-xs">
                              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${getStatusColor(order.status)}`}>
                                {STATUS_LABELS[order.status] || order.status}
                              </span>
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(STATUS_LABELS_FULL).map(([value, label]) => (
                                <SelectItem key={value} value={value}>{label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-center py-2 text-xs text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString("mn-MN")}
                        </TableCell>
                        <TableCell className="text-center py-2">
                          <div className="flex items-center justify-center gap-0.5">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openDetail(order)}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            {order.status !== "cancelled" && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setCancelTarget(order)}>
                                <XCircle className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between p-4 pt-3">
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
            <div className="text-center py-12 px-4">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">Захиалга олдсонгүй</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order Detail Sheet - mobile-friendly */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className={`${isMobile ? 'w-full' : 'w-full sm:max-w-lg'} overflow-y-auto p-0`}>
          <SheetHeader className="p-4 pb-2 sticky top-0 bg-background z-10 border-b">
            <SheetTitle className="flex items-center gap-2 text-base">
              <ShoppingCart className="h-4 w-4" />
              {selectedOrder?.order_number}
            </SheetTitle>
          </SheetHeader>
          {selectedOrder && (
            <div className="p-4 space-y-4">
              {/* Status & summary */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground">Төлөв</span>
                  <p className="mt-0.5">
                    <Badge className={getStatusColor(selectedOrder.status)}>
                      {STATUS_LABELS_FULL[selectedOrder.status] || selectedOrder.status}
                    </Badge>
                  </p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Хүргэлт</span>
                  <p className="text-sm mt-0.5">{selectedOrder.delivery_type === "delivery" ? "Хүргэлтээр" : "Өөрөө авна"}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Огноо</span>
                  <p className="text-sm mt-0.5">{new Date(selectedOrder.created_at).toLocaleString("mn-MN")}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Нийт дүн</span>
                  <p className="text-sm font-bold text-primary mt-0.5">{formatPrice(selectedOrder.subtotal)}</p>
                </div>
              </div>

              {/* Customer */}
              {selectedOrder.profile ? (
                <Card>
                  <CardContent className="p-3 space-y-1.5 text-sm">
                    <div className="flex items-center gap-2 font-medium">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      {selectedOrder.profile.full_name || "—"}
                    </div>
                    {selectedOrder.profile.email && (
                      <div className="text-xs text-muted-foreground pl-5">{selectedOrder.profile.email}</div>
                    )}
                    {selectedOrder.profile.phone && (
                      <div className="text-xs text-muted-foreground pl-5">{selectedOrder.profile.phone}</div>
                    )}
                  </CardContent>
                </Card>
              ) : (selectedOrder.delivery_address as any)?.guest_phone ? (
                <Card>
                  <CardContent className="p-3 space-y-1.5 text-sm">
                    <div className="flex items-center gap-2 font-medium">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      Зочин хэрэглэгч
                    </div>
                    <div className="text-xs text-muted-foreground pl-5">
                      📱 {(selectedOrder.delivery_address as any).guest_phone}
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {/* Delivery Address */}
              {selectedOrder.delivery_address && (
                <Card>
                  <CardContent className="p-3 space-y-1 text-sm">
                    <div className="flex items-center gap-2 font-medium text-xs">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground" /> Хүргэлтийн хаяг
                    </div>
                    <p className="text-xs text-muted-foreground pl-5">
                      {selectedOrder.delivery_address.fullName && <span>{selectedOrder.delivery_address.fullName}, </span>}
                      {selectedOrder.delivery_address.address || "—"}
                    </p>
                    {selectedOrder.delivery_address.phone && (
                      <p className="text-xs text-muted-foreground pl-5">Утас: {selectedOrder.delivery_address.phone}</p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Cancel reason */}
              {selectedOrder.cancel_reason && (
                <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/5 text-sm">
                  <span className="text-xs text-muted-foreground">Цуцалсан шалтгаан</span>
                  <p className="text-destructive mt-0.5">{selectedOrder.cancel_reason}</p>
                </div>
              )}

              {/* Items */}
              <div>
                <h4 className="text-sm font-medium mb-2">Бараанууд ({selectedOrder.item_count})</h4>
                <div className="space-y-2">
                  {(selectedOrder.items as any[] || []).map((item: any, i: number) => (
                    <div key={i} className="flex gap-3 p-3 rounded-lg border">
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
                        <p className="text-sm font-medium line-clamp-2">{item.title}</p>
                        {/* Show translated configurators */}
                        {item.configurators && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            🏷️ {item.configurators}
                          </p>
                        )}
                        {/* Show raw/original configurators (e.g. Chinese text) */}
                        {item.rawConfigurators && item.rawConfigurators !== item.configurators && (
                          <p className="text-xs text-muted-foreground/70 mt-0.5">
                            📝 Эх: {item.rawConfigurators}
                          </p>
                        )}
                        {item.selectedConfigurators && Array.isArray(item.selectedConfigurators) && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {item.selectedConfigurators.map((cfg: any, ci: number) => (
                              <div key={ci} className="text-xs">
                                <Badge variant="outline" className="text-[10px]">
                                  {cfg.name || cfg.title}: {cfg.value || cfg.selectedValue}
                                </Badge>
                                {/* Show original/raw values if different */}
                                {(cfg.originalName || cfg.originalValue || cfg.rawName || cfg.rawValue) && (
                                  <span className="text-muted-foreground/60 ml-1 text-[10px]">
                                    ({cfg.originalName || cfg.rawName || cfg.name}: {cfg.originalValue || cfg.rawValue || cfg.value})
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        {item.vendorName && (
                          <p className="text-xs text-muted-foreground mt-0.5">🏪 {item.vendorName}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {item.quantity} × {formatPrice(item.price)}
                          {item.originalCnyPrice && (
                            <span className="ml-1">(Эх: {item.originalCnyCurrency || "¥"}{Number(item.originalCnyPrice).toFixed(2)})</span>
                          )}
                        </p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {(item.externalUrl || item.itemId) && (
                            <a
                              href={item.externalUrl || (item.providerType === "Poizon"
                                ? `https://www.dewu.com/product-detail.html?productId=${item.itemId}`
                                : `https://item.taobao.com/item.htm?id=${item.itemId}`)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-500 hover:underline"
                            >
                              🔗 Эх сурвалж
                            </a>
                          )}
                          {item.itemId && (
                            <a href={`/product/otapi/${item.itemId}`} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-green-600 hover:underline">
                              🏠 Манай сайт
                            </a>
                          )}
                        </div>
                      </div>
                      <span className="text-sm font-bold shrink-0">{formatPrice(item.totalPrice)}</span>
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
      <AlertDialog open={!!cancelTarget} onOpenChange={(open) => { if (!open) { setCancelTarget(null); setCancelReason(""); } }}>
        <AlertDialogContent className="max-w-[95vw] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Захиалга цуцлах уу?</AlertDialogTitle>
            <AlertDialogDescription>
              Энэ захиалгыг цуцлахад төлбөрийн дүн хэрэглэгчийн хэтэвчинд буцаагдана.
              {cancelTarget && (
                <span className="block mt-1 font-semibold">Буцаагдах: {formatPrice(cancelTarget.subtotal)}</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-6 pb-2">
            <Label>Цуцлах шалтгаан *</Label>
            <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Шалтгаанаа бичнэ үү..." className="mt-1" rows={3} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Буцах</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelTarget && updateStatusMutation.mutate({ id: cancelTarget.id, status: "cancelled", cancel_reason: cancelReason })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!cancelReason.trim()}
            >
              Цуцлах
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
