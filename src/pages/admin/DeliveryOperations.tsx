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
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Package, Truck, Clock, CheckCircle2, AlertTriangle, CreditCard,
  ShoppingCart, Plus, Search, X, ChevronRight, Phone, MapPin,
  ArrowRight,
} from "lucide-react";
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

export default function DeliveryOperations() {
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("today");
  const [createOpen, setCreateOpen] = useState(false);
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
  const stats = {
    draft: grouped.draft?.length || 0,
    confirmed: grouped.confirmed?.length || 0,
    preparing: grouped.preparing?.length || 0,
    ready: grouped.ready_for_delivery?.length || 0,
    outForDelivery: grouped.out_for_delivery?.length || 0,
    delivered: grouped.delivered?.length || 0,
    codUnpaid: allOrders.filter((o: any) => o.payment_status !== "paid" && o.fulfillment_status !== "cancelled" && o.fulfillment_status !== "draft").length,
  };

  const getNextAction = (status: string) => {
    const map: Record<string, { label: string; next: string }> = {
      draft: { label: "Баталгаажуулах", next: "confirmed" },
      confirmed: { label: "Бэлтгэж эхлэх", next: "preparing" },
      preparing: { label: "Хүргэлтэд бэлэн", next: "ready_for_delivery" },
      ready_for_delivery: { label: "Хүргэлтэд гарсан", next: "out_for_delivery" },
      out_for_delivery: { label: "Хүргэгдсэн", next: "delivered" },
    };
    return map[status];
  };

  const getCustomerDisplay = (order: any) => {
    if (order.customer_name) return { name: order.customer_name, phone: order.customer_phone };
    if (order.profile) return { name: order.profile.full_name || "—", phone: order.profile.phone || order.profile.email };
    return { name: "—", phone: "" };
  };

  const summaryCards = [
    { label: "Ноорог", value: stats.draft, icon: Clock, color: "text-gray-600" },
    { label: "Шинэ захиалга", value: stats.confirmed, icon: ShoppingCart, color: "text-blue-600" },
    { label: "Бэлтгэгдэж байна", value: stats.preparing, icon: Package, color: "text-yellow-600" },
    { label: "Хүргэлтэд бэлэн", value: stats.ready, icon: CheckCircle2, color: "text-indigo-600" },
    { label: "Хүргэлтэд гарсан", value: stats.outForDelivery, icon: Truck, color: "text-purple-600" },
    { label: "Хүргэгдсэн", value: stats.delivered, icon: CheckCircle2, color: "text-green-600" },
    { label: "COD төлөгдөөгүй", value: stats.codUnpaid, icon: AlertTriangle, color: "text-red-600" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Хүргэлт & Үйл ажиллагаа</h1>
          <p className="text-muted-foreground mt-1">Захиалгын биелэлт, хүргэлтийн удирдлага</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" />
          Захиалга үүсгэх
        </Button>
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
          {FULFILLMENT_STATUSES.filter(s => !["returned"].includes(s.value)).map((status) => {
            const statusOrders = grouped[status.value] || [];
            if (statusOrders.length === 0 && ["draft", "cancelled", "returned"].includes(status.value)) return null;

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

                        return (
                          <div key={order.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/30 transition-colors">
                            {/* Order info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold">{order.order_number}</span>
                                <Badge variant="outline" className="text-[10px]">{getSourceLabel(order.source || "website")}</Badge>
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${pb.color}`}>{pb.label}</span>
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                <span className="font-medium text-foreground">{cust.name}</span>
                                {cust.phone && <span className="flex items-center gap-0.5"><Phone className="h-3 w-3" />{cust.phone}</span>}
                                <span>{order.order_items?.length || 0} бараа</span>
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
                            <div className="flex items-center gap-2 shrink-0">
                              {order.payment_status !== "paid" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => paymentMutation.mutate({ id: order.id, oldStatus: order.payment_status || "pending", newStatus: "paid" })}
                                >
                                  <CreditCard className="h-3 w-3 mr-1" />
                                  Төлсөн
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
    </div>
  );
}
