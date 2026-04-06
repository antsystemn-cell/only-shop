import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Package, Truck, Clock, CheckCircle2, AlertTriangle, CreditCard,
  ShoppingCart, Plus, Search, X, Phone, MapPin,
  ArrowRight, Eye, Printer, RefreshCw, CloudOff, Cloud,
} from "lucide-react";
import { retryDeliverySync, retryAllFailedSyncs } from "@/lib/deliverySync";
import { printDeliveryLabel } from "@/components/admin/DeliveryLabelPrint";
import { format } from "date-fns";
import {
  ORDER_SOURCES,
  FULFILLMENT_STATUSES,
  PAYMENT_STATUSES,
  updateFulfillmentStatus,
  updatePaymentStatus,
  getFulfillmentBadge,
  getPaymentBadge,
  getSourceLabel,
  formatCurrency,
} from "@/lib/orderService";
import CreateOrderDialog from "./orders/CreateOrderDialog";
import OrderDetailSheet from "@/components/admin/OrderDetailSheet";

export default function DeliveryOperations() {
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const isMobile = useIsMobile();

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const getDateRange = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).toISOString();
    if (dateFilter === "today") return { from: today };
    if (dateFilter === "week") return { from: weekAgo };
    return {};
  };

  const { data: orders, isLoading } = useQuery({
    queryKey: ["admin", "delivery-orders", searchQuery, sourceFilter, dateFilter],
    queryFn: async () => {
      let query = supabase
        .from("orders")
        .select("*, order_items(*)")
        .order("created_at", { ascending: false })
        .limit(500);

      const dateRange = getDateRange();
      if (dateRange.from) query = query.gte("created_at", dateRange.from);
      if (searchQuery) {
        query = query.or(`order_number.ilike.%${searchQuery}%,customer_name.ilike.%${searchQuery}%,customer_phone.ilike.%${searchQuery}%`);
      }
      if (sourceFilter !== "all") query = query.eq("source", sourceFilter as any);

      const { data, error } = await query;
      if (error) throw error;

      const userIds = [...new Set(data?.map((o) => o.user_id).filter(Boolean))];
      let profilesMap: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, email, phone")
          .in("user_id", userIds);
        profiles?.forEach((p) => { profilesMap[p.user_id] = p; });
      }

      return data?.map((o) => ({ ...o, profile: profilesMap[o.user_id || ""] || null })) || [];
    },
  });

  const fulfillmentMutation = useMutation({
    mutationFn: async ({ id, oldStatus, newStatus }: { id: string; oldStatus: string; newStatus: string }) => {
      await updateFulfillmentStatus(id, oldStatus, newStatus);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "delivery-orders"] });
      toast({ title: "Төлөв шинэчлэгдлээ" });
    },
    onError: (e: any) => toast({ title: "Алдаа", description: e.message, variant: "destructive" }),
  });

  const paymentMutation = useMutation({
    mutationFn: async ({ id, oldStatus, newStatus }: { id: string; oldStatus: string; newStatus: string }) => {
      await updatePaymentStatus(id, oldStatus, newStatus);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "delivery-orders"] });
      toast({ title: "Төлбөрийн төлөв шинэчлэгдлээ" });
    },
    onError: (e: any) => toast({ title: "Алдаа", description: e.message, variant: "destructive" }),
  });

  // Group orders by fulfillment status
  const grouped = FULFILLMENT_STATUSES.reduce((acc, status) => {
    acc[status.value] = (orders || []).filter((o: any) => (o.fulfillment_status || "confirmed") === status.value);
    return acc;
  }, {} as Record<string, any[]>);

  // Summary stats
  const allOrders = orders || [];
  const failedSyncCount = allOrders.filter((o: any) => o.delivery_sync_status === "failed").length;
  const pendingSyncCount = allOrders.filter((o: any) => o.delivery_sync_status === "pending").length;
  const stats = {
    confirmed: grouped.confirmed?.length || 0,
    phoneConfirmed: grouped.phone_confirmed?.length || 0,
    outForDelivery: grouped.out_for_delivery?.length || 0,
    delivered: grouped.delivered?.length || 0,
    unpaid: allOrders.filter((o: any) => o.payment_status !== "paid" && o.fulfillment_status !== "cancelled").length,
    syncFailed: failedSyncCount,
  };

  // Retry sync mutations
  const retrySyncMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const result = await retryDeliverySync(orderId);
      if (!result.success) throw new Error(result.error || "Sync failed");
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "delivery-orders"] });
      toast({ title: "Синк амжилттай" });
    },
    onError: (e: any) => toast({ title: "Синк алдаа", description: e.message, variant: "destructive" }),
  });

  const retryAllMutation = useMutation({
    mutationFn: retryAllFailedSyncs,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "delivery-orders"] });
      toast({ title: `${data.synced || 0} захиалга синк хийгдлээ` });
    },
    onError: (e: any) => toast({ title: "Алдаа", description: e.message, variant: "destructive" }),
  });

  const getNextAction = (status: string) => {
    const map: Record<string, { label: string; next: string }> = {
      confirmed: { label: "Утсаар баталгаажуулсан", next: "phone_confirmed" },
      phone_confirmed: { label: "Хүргэлтэнд гарсан", next: "out_for_delivery" },
      out_for_delivery: { label: "Хүргэгдсэн", next: "delivered" },
    };
    return map[status];
  };

  const getCustomerDisplay = (order: any) => {
    if (order.customer_name) return { name: order.customer_name, phone: order.customer_phone };
    if (order.profile) return { name: order.profile.full_name || "—", phone: order.profile.phone || order.profile.email };
    return { name: "—", phone: "" };
  };

  const getItemName = (item: any) => {
    const snapshot = item.product_snapshot || {};
    return item.product_name_snapshot || snapshot.title || snapshot.name || snapshot.name_mn || "Бараа";
  };

  const getSyncBadge = (order: any) => {
    const status = order.delivery_sync_status;
    if (status === "synced") return { label: "Синк ✓", color: "bg-green-100 text-green-700", icon: Cloud };
    if (status === "failed") return { label: "Синк ✗", color: "bg-red-100 text-red-700", icon: CloudOff };
    return { label: "Хүлээгдэж", color: "bg-yellow-100 text-yellow-700", icon: Clock };
  };

  const summaryCards = [
    { label: "Шинэ захиалга", value: stats.confirmed, icon: ShoppingCart, color: "text-blue-600" },
    { label: "Утсаар баталгаажсан", value: stats.phoneConfirmed, icon: Phone, color: "text-cyan-600" },
    { label: "Хүргэлтэнд гарсан", value: stats.outForDelivery, icon: Truck, color: "text-purple-600" },
    { label: "Хүргэгдсэн", value: stats.delivered, icon: CheckCircle2, color: "text-green-600" },
    { label: "Төлөгдөөгүй", value: stats.unpaid, icon: AlertTriangle, color: "text-red-600" },
    ...(stats.syncFailed > 0 ? [{ label: "Синк алдаа", value: stats.syncFailed, icon: CloudOff, color: "text-red-600" }] : []),
  ];

  return (
    <TooltipProvider>
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Хүргэлт & Үйл ажиллагаа</h1>
          <p className="text-muted-foreground mt-1">Захиалгын биелэлт, хүргэлтийн удирдлага</p>
        </div>
        <div className="flex gap-2">
          {(failedSyncCount > 0 || pendingSyncCount > 0) && (
            <Button
              variant="outline"
              onClick={() => retryAllMutation.mutate()}
              disabled={retryAllMutation.isPending}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${retryAllMutation.isPending ? "animate-spin" : ""}`} />
              Бүгдийг синк ({failedSyncCount + pendingSyncCount})
            </Button>
          )}
          <Button onClick={() => setCreateOpen(true)} className="bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" />
            Захиалга үүсгэх
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {summaryCards.map((card) => (
          <Card key={card.label}>
            <CardContent className="p-3 text-center">
              <card.icon className={`h-5 w-5 mx-auto mb-1 ${card.color}`} />
              <div className="text-2xl font-bold">{card.value}</div>
              <div className="text-xs text-muted-foreground">{card.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Дугаар, нэр, утас хайх..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
        </div>
        <Select value={dateFilter} onValueChange={setDateFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Өнөөдөр</SelectItem>
            <SelectItem value="week">7 хоног</SelectItem>
            <SelectItem value="all">Бүгд</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Бүх суваг" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Бүх суваг</SelectItem>
            {ORDER_SOURCES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Kanban-style grouped sections */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : (
        <div className="space-y-4">
          {FULFILLMENT_STATUSES.map((status) => {
            const statusOrders = grouped[status.value] || [];
            if (statusOrders.length === 0 && status.value === "cancelled") return null;

            return (
              <Card key={status.value}>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <span className={`w-3 h-3 rounded-full ${status.color.split(" ")[0]}`}></span>
                    {status.label}
                    <Badge variant="secondary" className="text-xs">{statusOrders.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  {statusOrders.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">Захиалга байхгүй</p>
                  ) : (
                    <div className="space-y-2">
                      {statusOrders.map((order: any) => {
                        const cust = getCustomerDisplay(order);
                        const pb = getPaymentBadge(order.payment_status || "pending");
                        const nextAction = getNextAction(status.value);
                        const items = order.order_items || [];

                        return (
                          <div key={order.id} className="p-3 border rounded-lg hover:bg-muted/30 transition-colors">
                            {/* Top row: order info + actions */}
                            <div className="flex items-center gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono text-xs font-bold">{order.order_number}</span>
                                  <Badge variant="outline" className="text-[10px]">{getSourceLabel(order.source || "website")}</Badge>
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${pb.color}`}>{pb.label}</span>
                                  {order.fulfillment_status !== "cancelled" && (() => {
                                    const sync = getSyncBadge(order);
                                    return (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium inline-flex items-center gap-0.5 cursor-help ${sync.color}`}>
                                            <sync.icon className="h-2.5 w-2.5" />
                                            {sync.label}
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom" className="max-w-xs">
                                          {order.delivery_sync_status === "failed" && (
                                            <p className="text-xs text-destructive">{order.delivery_sync_error || "Алдаа"}</p>
                                          )}
                                          {order.delivery_sync_status === "synced" && (
                                            <p className="text-xs">ID: {order.delivery_external_id}</p>
                                          )}
                                          {order.delivery_attempt_count > 0 && (
                                            <p className="text-xs text-muted-foreground">Оролдлого: {order.delivery_attempt_count}</p>
                                          )}
                                        </TooltipContent>
                                      </Tooltip>
                                    );
                                  })()}
                                </div>
                                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                  <span className="font-medium text-foreground">{cust.name}</span>
                                  {cust.phone && <span className="flex items-center gap-0.5"><Phone className="h-3 w-3" />{cust.phone}</span>}
                                  <span className="font-medium text-foreground">{formatCurrency(Number(order.total))}</span>
                                </div>
                                {order.address_text && (
                                  <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                                    <MapPin className="h-3 w-3" />
                                    <span className="truncate max-w-[300px]">{order.address_text}</span>
                                  </div>
                                )}
                              </div>

                              {/* Quick actions */}
                              <div className="flex items-center gap-1 shrink-0">
                                {(order.delivery_sync_status === "failed" || order.delivery_sync_status === "pending") && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 text-orange-600 hover:text-orange-700"
                                    onClick={() => retrySyncMutation.mutate(order.id)}
                                    disabled={retrySyncMutation.isPending}
                                    title="Синк дахин оролдох"
                                  >
                                    <RefreshCw className={`h-3.5 w-3.5 ${retrySyncMutation.isPending ? "animate-spin" : ""}`} />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  onClick={() => printDeliveryLabel(order)}
                                  title="Хаягийн шошго хэвлэх"
                                >
                                  <Printer className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  onClick={() => { setSelectedOrder(order); setDetailOpen(true); }}
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                                {order.payment_status !== "paid" && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={() => paymentMutation.mutate({ id: order.id, oldStatus: order.payment_status || "unpaid", newStatus: "paid" })}
                                  >
                                    <CreditCard className="h-3 w-3 mr-1" />
                                    Төлөгдсөн
                                  </Button>
                                )}
                                {nextAction && (
                                  <Button
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={() => fulfillmentMutation.mutate({ id: order.id, oldStatus: status.value, newStatus: nextAction.next })}
                                  >
                                    {nextAction.label}
                                    <ArrowRight className="h-3 w-3 ml-1" />
                                  </Button>
                                )}
                                {status.value !== "cancelled" && status.value !== "delivered" && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs text-destructive hover:text-destructive"
                                    onClick={() => {
                                      if (confirm("Захиалга цуцлах уу?")) {
                                        fulfillmentMutation.mutate({ id: order.id, oldStatus: status.value, newStatus: "cancelled" });
                                      }
                                    }}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </div>

                            {/* Items list */}
                            {items.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-dashed space-y-1">
                                {items.map((item: any) => {
                                  const snapshot = item.product_snapshot || {};
                                  const imgSrc = snapshot.imageUrl || snapshot.image_url || snapshot.images?.[0];
                                  return (
                                    <div key={item.id} className="flex items-center gap-2 text-xs">
                                      {imgSrc && (
                                        <img src={imgSrc} alt="" className="w-7 h-7 rounded object-contain border bg-muted shrink-0" />
                                      )}
                                      <span className="flex-1 min-w-0 truncate text-muted-foreground">
                                        {getItemName(item)}
                                        {(item.color_snapshot || item.size_snapshot) && (
                                          <span className="text-muted-foreground/70">
                                            {item.color_snapshot && ` · ${item.color_snapshot}`}
                                            {item.size_snapshot && ` · ${item.size_snapshot}`}
                                          </span>
                                        )}
                                      </span>
                                      <span className="shrink-0 text-muted-foreground">×{item.quantity}</span>
                                      <span className="shrink-0 font-medium text-foreground">{formatCurrency(Number(item.total_price))}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <CreateOrderDialog open={createOpen} onOpenChange={setCreateOpen} />

      <OrderDetailSheet
        order={selectedOrder}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onFulfillmentChange={(oldS, newS) => {
          if (selectedOrder) fulfillmentMutation.mutate({ id: selectedOrder.id, oldStatus: oldS, newStatus: newS });
        }}
        onPaymentChange={(oldS, newS) => {
          if (selectedOrder) paymentMutation.mutate({ id: selectedOrder.id, oldStatus: oldS, newStatus: newS });
        }}
        isMobile={isMobile}
      />
    </div>
    </TooltipProvider>
  );
}
