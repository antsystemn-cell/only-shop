import { useState } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Search, ShoppingCart, Eye, ChevronDown, ChevronRight,
  Package, X, Plus,
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
import CreateOrderDialog from "./CreateOrderDialog";
import OrderDetailSheet from "@/components/admin/OrderDetailSheet";

export default function LocalOrdersTab() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [fulfillmentFilter, setFulfillmentFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const isMobile = useIsMobile();

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: orders, isLoading } = useQuery({
    queryKey: ["admin", "orders", "local", searchQuery, statusFilter, fulfillmentFilter, sourceFilter, dateFrom, dateTo],
    queryFn: async () => {
      let query = supabase
        .from("orders")
        .select("*, order_items(*)")
        .order("created_at", { ascending: false })
        .limit(200);

      if (searchQuery) {
        query = query.or(`order_number.ilike.%${searchQuery}%,customer_name.ilike.%${searchQuery}%,customer_phone.ilike.%${searchQuery}%`);
      }
      if (statusFilter && statusFilter !== "all") query = query.eq("payment_status", statusFilter);
      if (fulfillmentFilter && fulfillmentFilter !== "all") query = query.eq("fulfillment_status", fulfillmentFilter as any);
      if (sourceFilter && sourceFilter !== "all") query = query.eq("source", sourceFilter as any);
      if (dateFrom) query = query.gte("created_at", dateFrom);
      if (dateTo) query = query.lte("created_at", dateTo + "T23:59:59");

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
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      toast({ title: "Төлөв шинэчлэгдлээ" });
    },
    onError: (e: any) => toast({ title: "Алдаа", description: e.message, variant: "destructive" }),
  });

  const paymentMutation = useMutation({
    mutationFn: async ({ id, oldStatus, newStatus }: { id: string; oldStatus: string; newStatus: string }) => {
      await updatePaymentStatus(id, oldStatus, newStatus);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      toast({ title: "Төлбөрийн төлөв шинэчлэгдлээ" });
    },
    onError: (e: any) => toast({ title: "Алдаа", description: e.message, variant: "destructive" }),
  });

  const toggleExpand = (id: string) => {
    setExpandedOrders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const clearFilters = () => { setSearchQuery(""); setStatusFilter("all"); setFulfillmentFilter("all"); setSourceFilter("all"); setDateFrom(""); setDateTo(""); };
  const hasFilters = searchQuery || statusFilter !== "all" || fulfillmentFilter !== "all" || sourceFilter !== "all" || dateFrom || dateTo;

  const getCustomerDisplay = (order: any) => {
    if (order.customer_name) return { name: order.customer_name, phone: order.customer_phone };
    if (order.profile) return { name: order.profile.full_name || "—", phone: order.profile.phone || order.profile.email };
    return { name: "—", phone: "" };
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 w-fit">
          <Package className="h-3 w-3 mr-1" /> Бүх захиалга
        </Badge>
        <Button onClick={() => setCreateOpen(true)} className="bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" />
          Захиалга үүсгэх
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Дугаар, нэр, утас хайх..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
              </div>
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="Бүх суваг" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Бүх суваг</SelectItem>
                  {ORDER_SOURCES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={fulfillmentFilter} onValueChange={setFulfillmentFilter}>
                <SelectTrigger className="w-full sm:w-[170px]">
                  <SelectValue placeholder="Биелэлт" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Бүх биелэлт</SelectItem>
                  {FULFILLMENT_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="Төлбөр" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Бүх төлбөр</SelectItem>
                  {PAYMENT_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!isMobile && (
              <div className="flex gap-3 items-center">
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[150px]" />
                <span className="text-muted-foreground text-sm">—</span>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[150px]" />
                {hasFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    <X className="h-4 w-4 mr-1" /> Цэвэрлэх
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Orders table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShoppingCart className="h-5 w-5 text-primary" />
            Захиалгууд
            {orders && <Badge variant="secondary">{orders.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-6 sm:pt-0">
          {isLoading ? (
            <div className="space-y-3 p-4">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : orders && orders.length > 0 ? (
            isMobile ? (
              <div className="divide-y">
                {orders.map((order) => {
                  const cust = getCustomerDisplay(order);
                  const fb = getFulfillmentBadge((order as any).fulfillment_status || "confirmed");
                  const pb = getPaymentBadge(order.payment_status || "unpaid");
                  return (
                    <div key={order.id} className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm font-medium">{order.order_number}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${fb.color}`}>{fb.label}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{cust.name}</span>
                        <span className="font-medium">{formatCurrency(Number(order.total))}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">{getSourceLabel((order as any).source || "website")}</Badge>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${pb.color}`}>{pb.label}</span>
                        </div>
                        <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => { setSelectedOrder(order); setDetailOpen(true); }}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead className="w-[120px]">Захиалга</TableHead>
                    <TableHead className="w-[140px]">Захиалагч</TableHead>
                    <TableHead className="w-[80px]">Суваг</TableHead>
                    <TableHead className="text-center w-[140px]">Биелэлт</TableHead>
                    <TableHead className="text-center w-[130px]">Төлбөр</TableHead>
                    <TableHead className="text-right w-[100px]">Дүн</TableHead>
                    <TableHead className="text-center w-[90px]">Огноо</TableHead>
                    <TableHead className="text-center w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => {
                    const cust = getCustomerDisplay(order);
                    const fb = getFulfillmentBadge((order as any).fulfillment_status || "confirmed");
                    const pb = getPaymentBadge(order.payment_status || "pending");
                    return (
                      <>
                        <TableRow key={order.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => toggleExpand(order.id)}>
                          <TableCell className="py-2">
                            {order.order_items && order.order_items.length > 0 && (
                              expandedOrders.has(order.id)
                                ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </TableCell>
                          <TableCell className="py-2">
                            <div className="font-mono text-xs font-medium">{order.order_number}</div>
                            <div className="text-[10px] text-muted-foreground">{order.order_items?.length || 0} бараа</div>
                          </TableCell>
                          <TableCell className="py-2">
                            <div className="text-sm font-medium truncate max-w-[130px]">{cust.name}</div>
                            <div className="text-xs text-muted-foreground truncate max-w-[130px]">{cust.phone}</div>
                          </TableCell>
                          <TableCell className="py-2">
                            <Badge variant="outline" className="text-[10px]">{getSourceLabel((order as any).source || "website")}</Badge>
                          </TableCell>
                          <TableCell className="text-center py-2" onClick={(e) => e.stopPropagation()}>
                            <Select
                              value={(order as any).fulfillment_status || "confirmed"}
                              onValueChange={(v) => fulfillmentMutation.mutate({ id: order.id, oldStatus: (order as any).fulfillment_status || "confirmed", newStatus: v })}
                            >
                              <SelectTrigger className="w-[130px] h-7 text-xs">
                                <SelectValue>
                                  <span className={`px-2 py-0.5 rounded-full text-xs ${fb.color}`}>{fb.label}</span>
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {FULFILLMENT_STATUSES.map((s) => (
                                  <SelectItem key={s.value} value={s.value}>
                                    <span className={`px-2 py-0.5 rounded-full text-xs ${s.color}`}>{s.label}</span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-center py-2" onClick={(e) => e.stopPropagation()}>
                            <Select
                              value={order.payment_status || "pending"}
                              onValueChange={(v) => paymentMutation.mutate({ id: order.id, oldStatus: order.payment_status || "pending", newStatus: v })}
                            >
                              <SelectTrigger className="w-[120px] h-7 text-xs">
                                <SelectValue>
                                  <span className={`px-2 py-0.5 rounded-full text-xs ${pb.color}`}>{pb.label}</span>
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {PAYMENT_STATUSES.map((s) => (
                                  <SelectItem key={s.value} value={s.value}>
                                    <span className={`px-2 py-0.5 rounded-full text-xs ${s.color}`}>{s.label}</span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-right py-2">
                            <div className="font-medium text-sm">{formatCurrency(Number(order.total))}</div>
                            {Number(order.delivery_fee) > 0 && (
                              <div className="text-[10px] text-muted-foreground">Хүргэлт: {formatCurrency(Number(order.delivery_fee))}</div>
                            )}
                          </TableCell>
                          <TableCell className="text-center py-2 text-xs text-muted-foreground">
                            {format(new Date(order.created_at), "MM/dd HH:mm")}
                          </TableCell>
                          <TableCell className="text-center py-2" onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setSelectedOrder(order); setDetailOpen(true); }}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                        {expandedOrders.has(order.id) && order.order_items?.map((item: any) => {
                          const snapshot = item.product_snapshot || {};
                          const imgSrc = snapshot.imageUrl || snapshot.image_url || snapshot.images?.[0];
                          return (
                            <TableRow key={item.id} className="bg-muted/30">
                              <TableCell></TableCell>
                              <TableCell colSpan={2} className="py-2">
                                <div className="flex items-center gap-3">
                                  {imgSrc && <img src={imgSrc} alt="" className="w-10 h-10 rounded object-contain border bg-muted" />}
                                  <div className="min-w-0">
                                    <div className="text-sm font-medium truncate">{item.product_name_snapshot || snapshot.title || snapshot.name || snapshot.name_mn || "Бараа"}</div>
                                    {(item.color_snapshot || item.size_snapshot) && (
                                      <div className="text-xs text-muted-foreground mt-0.5">
                                        {item.color_snapshot && `Өнгө: ${item.color_snapshot}`}
                                        {item.size_snapshot && ` · Хэмжээ: ${item.size_snapshot}`}
                                      </div>
                                    )}
                                    {snapshot.configurators && (
                                      <div className="text-xs text-muted-foreground mt-0.5">🏷️ {snapshot.configurators}</div>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-center text-sm py-2">{item.quantity}</TableCell>
                              <TableCell className="text-right text-sm py-2" colSpan={2}>{formatCurrency(Number(item.total_price))}</TableCell>
                              <TableCell colSpan={3}></TableCell>
                            </TableRow>
                          );
                        })}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            )
          ) : (
            <div className="text-center py-12 text-muted-foreground px-4">
              <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Захиалга олдсонгүй</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail sheet */}
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

      {/* Create order dialog */}
      <CreateOrderDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
