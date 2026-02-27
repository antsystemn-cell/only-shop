import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Search, ShoppingCart, Eye, ChevronDown, ChevronRight, User, MapPin, Phone, Mail,
  Package, Truck, DollarSign, MessageSquare, Calendar, X,
} from "lucide-react";
import { format } from "date-fns";

const statusOptions = [
  { value: "pending", label: "Хүлээгдэж байна", color: "bg-yellow-100 text-yellow-800" },
  { value: "processing", label: "Бэлтгэгдэж байна", color: "bg-blue-100 text-blue-800" },
  { value: "shipped", label: "Хүргэлтэд гарсан", color: "bg-purple-100 text-purple-800" },
  { value: "delivered", label: "Хүргэгдсэн", color: "bg-green-100 text-green-800" },
  { value: "cancelled", label: "Цуцлагдсан", color: "bg-red-100 text-red-800" },
];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("mn-MN").format(amount) + "₮";
}

export default function LocalOrdersTab() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [viewMode, setViewMode] = useState<"orders" | "items">("orders");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: orders, isLoading } = useQuery({
    queryKey: ["admin", "orders", "local", searchQuery, statusFilter, dateFrom, dateTo],
    queryFn: async () => {
      let query = supabase
        .from("orders")
        .select("*, order_items(*)")
        .order("created_at", { ascending: false });

      if (searchQuery) {
        query = query.or(`order_number.ilike.%${searchQuery}%`);
      }
      if (statusFilter && statusFilter !== "all") {
        query = query.eq("status", statusFilter as any);
      }
      if (dateFrom) query = query.gte("created_at", dateFrom);
      if (dateTo) query = query.lte("created_at", dateTo + "T23:59:59");

      const { data, error } = await query;
      if (error) throw error;

      const userIds = [...new Set(data?.map(o => o.user_id).filter(Boolean))];
      let profilesMap: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, email, phone")
          .in("user_id", userIds);
        profiles?.forEach(p => { profilesMap[p.user_id] = p; });
      }

      return data?.map(o => ({
        ...o,
        profile: profilesMap[o.user_id || ""] || null,
      })) || [];
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("orders")
        .update({ status: status as any })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "orders", "local"] });
      toast({ title: "Төлөв шинэчлэгдлээ" });
    },
    onError: (error: any) => {
      toast({ title: "Алдаа", description: error.message, variant: "destructive" });
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async ({ orderId, notes }: { orderId: string; notes: string }) => {
      const { error } = await supabase
        .from("orders")
        .update({ notes } as any)
        .eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "orders", "local"] });
      toast({ title: "Тэмдэглэл хадгалагдлаа" });
    },
  });

  const getStatusBadge = (status: string) => {
    const s = statusOptions.find(opt => opt.value === status) ||
      { label: status, color: "bg-gray-100 text-gray-800" };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${s.color}`}>
        {s.label}
      </span>
    );
  };

  const toggleExpand = (orderId: string) => {
    setExpandedOrders(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setDateFrom("");
    setDateTo("");
  };

  const hasFilters = searchQuery || statusFilter !== "all" || dateFrom || dateTo;

  return (
    <div className="space-y-6">
      {/* Header with badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <Package className="h-3 w-3 mr-1" /> Бэлэн бараа
          </Badge>
          <span className="text-sm text-muted-foreground">Дотоод барааны захиалгууд</span>
        </div>
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
          <TabsList className="h-8">
            <TabsTrigger value="orders" className="text-xs h-7">Захиалгаар</TabsTrigger>
            <TabsTrigger value="items" className="text-xs h-7">Барааагаар</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Дугаар, имэйл, утасаар хайх..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Бүх төлөв" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Бүх төлөв</SelectItem>
                {statusOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <div className="flex gap-2">
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="flex-1" />
              {hasFilters && (
                <Button variant="ghost" size="icon" onClick={clearFilters}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            Бэлэн барааны захиалгууд
            {orders && <Badge variant="secondary">{orders.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : orders && orders.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Захиалга</TableHead>
                    <TableHead>Хэрэглэгч</TableHead>
                    <TableHead className="text-center">Бараа</TableHead>
                    <TableHead className="text-right">Дүн</TableHead>
                    <TableHead className="text-center">Төлөв</TableHead>
                    <TableHead className="text-center">Огноо</TableHead>
                    <TableHead className="text-center">Үйлдэл</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <>
                      <TableRow key={order.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => toggleExpand(order.id)}>
                        <TableCell>
                          {order.order_items?.length > 0 && (
                            expandedOrders.has(order.id)
                              ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-mono text-sm font-medium">{order.order_number}</div>
                          {order.payment_status && (
                            <Badge variant="outline" className="mt-1 text-xs">
                              {order.payment_status === "paid" ? "Төлсөн" : order.payment_status === "pending" ? "Төлөгдөөгүй" : order.payment_status}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-medium">{order.profile?.full_name || "—"}</div>
                          <div className="text-xs text-muted-foreground">{order.profile?.email}</div>
                          {order.profile?.phone && (
                            <div className="text-xs text-muted-foreground">{order.profile.phone}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{order.order_items?.length || 0}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="font-medium">{formatCurrency(Number(order.total))}</div>
                          <div className="text-xs text-muted-foreground">
                            Хүргэлт: {formatCurrency(Number(order.delivery_fee))}
                          </div>
                        </TableCell>
                        <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                          <Select
                            value={order.status}
                            onValueChange={(value) =>
                              updateStatusMutation.mutate({ id: order.id, status: value })
                            }
                          >
                            <SelectTrigger className="w-40 h-8">
                              <SelectValue>{getStatusBadge(order.status)}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {statusOptions.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  <span className={`px-2 py-0.5 rounded-full text-xs ${opt.color}`}>
                                    {opt.label}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-center text-sm text-muted-foreground">
                          {format(new Date(order.created_at), "yyyy-MM-dd HH:mm")}
                        </TableCell>
                        <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" onClick={() => { setSelectedOrder(order); setDetailOpen(true); }}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                      {/* Expanded items — LOCAL source: NO external links */}
                      {expandedOrders.has(order.id) && order.order_items?.map((item: any) => {
                        const snapshot = item.product_snapshot || {};
                        const imgSrc = snapshot.imageUrl || snapshot.image_url || snapshot.images?.[0];
                        const isOtapi = snapshot.sourceType === "otapi";
                        return (
                          <TableRow key={item.id} className="bg-muted/30">
                            <TableCell></TableCell>
                            <TableCell colSpan={2}>
                              <div className="flex items-center gap-3">
                                {imgSrc && (
                                  <img src={imgSrc} alt="" className="w-10 h-10 rounded object-contain border bg-muted" />
                                )}
                                <div>
                                  <div className="text-sm font-medium">{snapshot.title || snapshot.name || snapshot.name_mn || "Бараа"}</div>
                                  <div className="text-xs text-muted-foreground">x{item.quantity}</div>
                                  {isOtapi && (
                                    <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 mt-1">
                                      {snapshot.providerType || "OT"}
                                    </Badge>
                                  )}
                                  {!isOtapi && (
                                    <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200 mt-1">
                                      Бэлэн бараа
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-center text-sm">{item.quantity}</TableCell>
                            <TableCell className="text-right text-sm">
                              {formatCurrency(Number(item.total_price))}
                            </TableCell>
                            <TableCell colSpan={3}></TableCell>
                          </TableRow>
                        );
                      })}
                    </>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Захиалга олдсонгүй</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order Detail Sheet */}
      <LocalOrderDetailSheet
        order={selectedOrder}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onStatusChange={(status) => {
          if (selectedOrder) updateStatusMutation.mutate({ id: selectedOrder.id, status });
        }}
        onSaveNotes={(notes) => {
          if (selectedOrder) addCommentMutation.mutate({ orderId: selectedOrder.id, notes });
        }}
      />
    </div>
  );
}

// ─── Order Detail Sheet (LOCAL source — NO external product links) ─────

function LocalOrderDetailSheet({
  order,
  open,
  onClose,
  onStatusChange,
  onSaveNotes,
}: {
  order: any;
  open: boolean;
  onClose: () => void;
  onStatusChange: (status: string) => void;
  onSaveNotes: (notes: string) => void;
}) {
  const [notes, setNotes] = useState("");

  if (!order) return null;

  const deliveryAddress = order.delivery_address || {};

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Захиалга: {order.order_number}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Status & Summary */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-4">
                <Label className="text-muted-foreground text-xs">Төлөв</Label>
                <Select value={order.status} onValueChange={onStatusChange}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <Label className="text-muted-foreground text-xs">Төлбөр</Label>
                <div className="mt-1">
                  <Badge variant={order.payment_status === "paid" ? "default" : "secondary"}>
                    {order.payment_status === "paid" ? "Төлсөн" : "Төлөгдөөгүй"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Financial Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <DollarSign className="h-4 w-4" />Төлбөрийн мэдээлэл
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Барааны дүн:</span><span>{formatCurrency(Number(order.subtotal))}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Хүргэлтийн төлбөр:</span><span>{formatCurrency(Number(order.delivery_fee))}</span></div>
                <div className="flex justify-between font-bold border-t pt-2"><span>Нийт:</span><span>{formatCurrency(Number(order.total))}</span></div>
              </div>
            </CardContent>
          </Card>

          {/* Customer Info */}
          {order.profile && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <User className="h-4 w-4" />Хэрэглэгчийн мэдээлэл
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center gap-2"><User className="h-3 w-3 text-muted-foreground" />{order.profile.full_name || "—"}</div>
                <div className="flex items-center gap-2"><Mail className="h-3 w-3 text-muted-foreground" />{order.profile.email}</div>
                {order.profile.phone && <div className="flex items-center gap-2"><Phone className="h-3 w-3 text-muted-foreground" />{order.profile.phone}</div>}
              </CardContent>
            </Card>
          )}

          {/* Delivery Address */}
          {Object.keys(deliveryAddress).length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MapPin className="h-4 w-4" />Хүргэлтийн хаяг
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <p>{deliveryAddress.city}, {deliveryAddress.district}</p>
                {deliveryAddress.sub_district && <p>{deliveryAddress.sub_district}</p>}
                <p>{deliveryAddress.street_address}</p>
                {deliveryAddress.apartment && <p>Байр: {deliveryAddress.apartment}</p>}
                {deliveryAddress.phone && <p>Утас: {deliveryAddress.phone}</p>}
              </CardContent>
            </Card>
          )}

          {/* Order Items — source-aware rendering */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Package className="h-4 w-4" />Бараанууд ({order.order_items?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {order.order_items?.map((item: any) => {
                  const snapshot = item.product_snapshot || {};
                  const isOtapi = snapshot.sourceType === "otapi";
                  return (
                    <div key={item.id} className="flex items-start gap-3 p-3 border rounded-lg">
                      {(snapshot.imageUrl || snapshot.image_url || snapshot.images?.[0]) && (
                        <img
                          src={snapshot.imageUrl || snapshot.image_url || snapshot.images?.[0]}
                          alt=""
                          className="w-14 h-14 rounded object-contain border bg-muted"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {snapshot.title || snapshot.name || snapshot.name_mn || "Бараа"}
                        </div>
                        {/* Source badge */}
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          {isOtapi ? (
                            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                              {snapshot.providerType || "OT"}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                              Бэлэн бараа
                            </Badge>
                          )}
                          {isOtapi && snapshot.originalCnyPrice && (
                            <span className="text-xs text-muted-foreground">
                              Эх үнэ: {snapshot.originalCnyCurrency || "¥"}{Number(snapshot.originalCnyPrice).toFixed(2)}
                            </span>
                          )}
                        </div>
                        {/* OT items: external + internal links */}
                        {isOtapi && snapshot.externalUrl && (
                          <a
                            href={snapshot.externalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-500 hover:underline mt-1 block truncate"
                          >
                            🔗 Эх сурвалж линк
                          </a>
                        )}
                        {isOtapi && snapshot.itemId && (
                          <a
                            href={`/product/otapi/${snapshot.itemId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-green-600 hover:underline mt-0.5 block"
                          >
                            🏠 Манай сайтын линк
                          </a>
                        )}
                        {/* LOCAL items: internal product link */}
                        {!isOtapi && item.product_id && (
                          <a
                            href={`/product/local/${item.product_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-green-600 hover:underline mt-1 block"
                          >
                            📦 Барааны линк
                          </a>
                        )}
                        {snapshot.brand && <div className="text-xs text-muted-foreground">{snapshot.brand}</div>}
                        <div className="text-xs text-muted-foreground mt-1">
                          {formatCurrency(Number(item.unit_price))} × {item.quantity}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-medium text-sm">{formatCurrency(Number(item.total_price))}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Admin Notes */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />Админ тэмдэглэл
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={notes || order.notes || ""}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Тэмдэглэл бичих..."
                rows={3}
              />
              <Button size="sm" onClick={() => onSaveNotes(notes || order.notes || "")}>
                Хадгалах
              </Button>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Calendar className="h-4 w-4" />Хугацаа
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Үүсгэсэн:</span>
                <span>{format(new Date(order.created_at), "yyyy-MM-dd HH:mm")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Шинэчилсэн:</span>
                <span>{format(new Date(order.updated_at), "yyyy-MM-dd HH:mm")}</span>
              </div>
              {order.estimated_delivery_date && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Хүргэгдэх:</span>
                  <span>{order.estimated_delivery_date}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}
