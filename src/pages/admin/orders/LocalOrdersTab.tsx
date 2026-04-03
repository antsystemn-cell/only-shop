import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Search, ShoppingCart, Eye, ChevronDown, ChevronRight, User, MapPin, Phone, Mail,
  Package, Truck, MessageSquare, X, Plus, Clock, CreditCard, Filter,
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
                  const pb = getPaymentBadge(order.payment_status || "pending");
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

// OrderDetailSheet is now imported from @/components/admin/OrderDetailSheet

  const { toast } = useToast();
  const [notes, setNotes] = useState("");

  // Fetch status logs
  const { data: statusLogs } = useQuery({
    queryKey: ["order-status-logs", order?.id],
    queryFn: async () => {
      if (!order?.id) return [];
      const { data } = await supabase
        .from("order_status_logs")
        .select("*")
        .eq("order_id", order.id)
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!order?.id && open,
  });

  const saveNotesMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("orders")
        .update({ internal_note: notes } as any)
        .eq("id", order.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      toast({ title: "Тэмдэглэл хадгалагдлаа" });
    },
  });

  if (!order) return null;

  const fb = getFulfillmentBadge((order as any).fulfillment_status || "confirmed");
  const pb = getPaymentBadge(order.payment_status || "pending");
  const deliveryAddress = order.delivery_address || {};
  const cust = order.customer_name || order.profile?.full_name || "—";
  const custPhone = order.customer_phone || order.profile?.phone || "";

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className={`${isMobile ? "w-full" : "w-full sm:max-w-lg"} overflow-y-auto p-0`}>
        <SheetHeader className="p-4 pb-2 sticky top-0 bg-background z-10 border-b">
          <SheetTitle className="flex items-center gap-2 text-base">
            <ShoppingCart className="h-4 w-4" />
            {order.order_number}
            <Badge variant="outline" className="text-[10px] ml-auto">{getSourceLabel((order as any).source || "website")}</Badge>
          </SheetTitle>
        </SheetHeader>

        <div className="p-4 space-y-4">
          {/* Status controls */}
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="p-3">
                <Label className="text-muted-foreground text-xs">Биелэлт</Label>
                <Select
                  value={(order as any).fulfillment_status || "confirmed"}
                  onValueChange={(v) => onFulfillmentChange((order as any).fulfillment_status || "confirmed", v)}
                >
                  <SelectTrigger className="mt-1 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FULFILLMENT_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <Label className="text-muted-foreground text-xs">Төлбөр</Label>
                <Select
                  value={order.payment_status || "pending"}
                  onValueChange={(v) => onPaymentChange(order.payment_status || "pending", v)}
                >
                  <SelectTrigger className="mt-1 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          </div>

          {/* Financial */}
          <Card>
            <CardContent className="p-3 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Барааны дүн:</span><span>{formatCurrency(Number(order.subtotal))}</span></div>
              {Number((order as any).discount_amount) > 0 && (
                <div className="flex justify-between text-red-600"><span>Хөнгөлөлт:</span><span>-{formatCurrency(Number((order as any).discount_amount))}</span></div>
              )}
              <div className="flex justify-between"><span className="text-muted-foreground">Хүргэлт:</span><span>{formatCurrency(Number(order.delivery_fee))}</span></div>
              <div className="flex justify-between font-bold border-t pt-1.5"><span>Нийт:</span><span>{formatCurrency(Number(order.total))}</span></div>
            </CardContent>
          </Card>

          {/* Customer */}
          <Card>
            <CardContent className="p-3 space-y-1.5 text-sm">
              <div className="flex items-center gap-2"><User className="h-3 w-3 text-muted-foreground" />{cust}</div>
              {custPhone && <div className="flex items-center gap-2"><Phone className="h-3 w-3 text-muted-foreground" />{custPhone}</div>}
              {(order.customer_email || order.profile?.email) && (
                <div className="flex items-center gap-2"><Mail className="h-3 w-3 text-muted-foreground" /><span className="truncate">{order.customer_email || order.profile?.email}</span></div>
              )}
              {(order as any).alternate_phone && (
                <div className="flex items-center gap-2"><Phone className="h-3 w-3 text-muted-foreground" />{(order as any).alternate_phone} (нэмэлт)</div>
              )}
            </CardContent>
          </Card>

          {/* Address */}
          {((order as any).address_text || Object.keys(deliveryAddress).length > 0) && (
            <Card>
              <CardContent className="p-3 text-sm space-y-1">
                <div className="flex items-center gap-2 text-xs font-medium"><MapPin className="h-3 w-3" />Хүргэлтийн хаяг</div>
                {deliveryAddress.district && <p className="text-xs text-muted-foreground">{deliveryAddress.city}, {deliveryAddress.district}</p>}
                {(order as any).address_text && <p className="text-xs text-muted-foreground">{(order as any).address_text}</p>}
                {deliveryAddress.street_address && !((order as any).address_text) && <p className="text-xs text-muted-foreground">{deliveryAddress.street_address}</p>}
                {(order as any).delivery_note && <p className="text-xs text-muted-foreground italic">📝 {(order as any).delivery_note}</p>}
                {deliveryAddress.phone && <p className="text-xs text-muted-foreground">Утас: {deliveryAddress.phone}</p>}
              </CardContent>
            </Card>
          )}

          {/* Items */}
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <Package className="h-4 w-4" /> Бараанууд ({order.order_items?.length || 0})
            </h4>
            <div className="space-y-2">
              {order.order_items?.map((item: any) => {
                const snapshot = item.product_snapshot || {};
                const imgSrc = snapshot.imageUrl || snapshot.image_url || snapshot.images?.[0];
                return (
                  <div key={item.id} className="flex gap-3 p-3 border rounded-lg">
                    {imgSrc && <img src={imgSrc} alt="" className="w-12 h-12 rounded object-contain border bg-muted shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium line-clamp-2">{item.product_name_snapshot || snapshot.title || snapshot.name || snapshot.name_mn || "Бараа"}</div>
                      {(item.color_snapshot || item.size_snapshot) && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {item.color_snapshot && `Өнгө: ${item.color_snapshot}`}
                          {item.size_snapshot && ` · ${item.size_snapshot}`}
                        </div>
                      )}
                      {snapshot.configurators && <p className="text-xs text-muted-foreground mt-0.5">🏷️ {snapshot.configurators}</p>}
                      <div className="text-xs text-muted-foreground mt-0.5">{formatCurrency(Number(item.unit_price))} × {item.quantity}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-medium text-sm">{formatCurrency(Number(item.total_price))}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Internal note */}
          <Card>
            <CardContent className="p-3 space-y-2">
              <Label className="text-xs flex items-center gap-1"><MessageSquare className="h-3 w-3" />Дотоод тэмдэглэл</Label>
              <Textarea value={notes || (order as any).internal_note || ""} onChange={(e) => setNotes(e.target.value)} placeholder="Ажилтнуудад..." rows={2} />
              <Button size="sm" onClick={() => saveNotesMutation.mutate()}>Хадгалах</Button>
            </CardContent>
          </Card>

          {/* Status history */}
          {statusLogs && statusLogs.length > 0 && (
            <Card>
              <CardContent className="p-3">
                <Label className="text-xs flex items-center gap-1 mb-2"><Clock className="h-3 w-3" />Төлвийн түүх</Label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {statusLogs.map((log: any) => (
                    <div key={log.id} className="text-xs border-l-2 border-primary/20 pl-2 py-1">
                      <div className="text-muted-foreground">{format(new Date(log.created_at), "MM/dd HH:mm")}</div>
                      {log.new_fulfillment_status && (
                        <div>Биелэлт: {log.old_fulfillment_status || "—"} → <strong>{log.new_fulfillment_status}</strong></div>
                      )}
                      {log.new_payment_status && (
                        <div>Төлбөр: {log.old_payment_status || "—"} → <strong>{log.new_payment_status}</strong></div>
                      )}
                      {log.note && <div className="text-muted-foreground italic">{log.note}</div>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Timeline */}
          <Card>
            <CardContent className="p-3 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground text-xs">Үүсгэсэн:</span><span className="text-xs">{format(new Date(order.created_at), "yyyy-MM-dd HH:mm")}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground text-xs">Шинэчилсэн:</span><span className="text-xs">{format(new Date(order.updated_at), "yyyy-MM-dd HH:mm")}</span></div>
              {(order as any).confirmed_at && <div className="flex justify-between"><span className="text-muted-foreground text-xs">Баталгаажсан:</span><span className="text-xs">{format(new Date((order as any).confirmed_at), "yyyy-MM-dd HH:mm")}</span></div>}
              {(order as any).delivered_at && <div className="flex justify-between"><span className="text-muted-foreground text-xs">Хүргэгдсэн:</span><span className="text-xs">{format(new Date((order as any).delivered_at), "yyyy-MM-dd HH:mm")}</span></div>}
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}
