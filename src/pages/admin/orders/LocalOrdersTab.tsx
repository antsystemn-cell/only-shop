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
import { useIsMobile } from "@/hooks/use-mobile";
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
  const isMobile = useIsMobile();

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: orders, isLoading } = useQuery({
    queryKey: ["admin", "orders", "local", searchQuery, statusFilter, dateFrom, dateTo],
    queryFn: async () => {
      let query = supabase
        .from("orders")
        .select("*, order_items(*)")
        .order("created_at", { ascending: false });

      if (searchQuery) query = query.or(`order_number.ilike.%${searchQuery}%`);
      if (statusFilter && statusFilter !== "all") query = query.eq("status", statusFilter as any);
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

      return data?.map(o => ({ ...o, profile: profilesMap[o.user_id || ""] || null })) || [];
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("orders").update({ status: status as any }).eq("id", id);
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
      const { error } = await supabase.from("orders").update({ notes } as any).eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "orders", "local"] });
      toast({ title: "Тэмдэглэл хадгалагдлаа" });
    },
  });

  const getStatusBadge = (status: string) => {
    const s = statusOptions.find(opt => opt.value === status) || { label: status, color: "bg-gray-100 text-gray-800" };
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>;
  };

  const toggleExpand = (orderId: string) => {
    setExpandedOrders(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId); else next.add(orderId);
      return next;
    });
  };

  const clearFilters = () => { setSearchQuery(""); setStatusFilter("all"); setDateFrom(""); setDateTo(""); };
  const hasFilters = searchQuery || statusFilter !== "all" || dateFrom || dateTo;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <Package className="h-3 w-3 mr-1" /> Бэлэн бараа
          </Badge>
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
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Дугаараар хайх..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Бүх төлөв" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Бүх төлөв</SelectItem>
                {statusOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!isMobile && (
              <>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[150px]" />
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[150px]" />
              </>
            )}
            {hasFilters && (
              <Button variant="ghost" size="icon" onClick={clearFilters} className="shrink-0">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Orders */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShoppingCart className="h-5 w-5 text-primary" />
            Бэлэн барааны захиалга
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
              /* Mobile card layout */
              <div className="divide-y">
                {orders.map((order) => (
                  <div key={order.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm font-medium">{order.order_number}</span>
                      {getStatusBadge(order.status)}
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{order.profile?.full_name || "—"}</span>
                      <span className="font-medium">{formatCurrency(Number(order.total))}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {order.order_items?.length || 0} бараа · {format(new Date(order.created_at), "MM/dd HH:mm")}
                      </span>
                      <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => { setSelectedOrder(order); setDetailOpen(true); }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Desktop table */
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead className="w-[130px]">Захиалга</TableHead>
                    <TableHead className="w-[140px]">Хэрэглэгч</TableHead>
                    <TableHead className="text-center w-[50px]">Бараа</TableHead>
                    <TableHead className="text-right w-[100px]">Дүн</TableHead>
                    <TableHead className="text-center w-[150px]">Төлөв</TableHead>
                    <TableHead className="text-center w-[120px]">Огноо</TableHead>
                    <TableHead className="text-center w-[50px]">Үйлдэл</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <>
                      <TableRow key={order.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => toggleExpand(order.id)}>
                        <TableCell className="py-2">
                          {order.order_items?.length > 0 && (
                            expandedOrders.has(order.id)
                              ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell className="py-2">
                          <div className="font-mono text-xs font-medium">{order.order_number}</div>
                          {order.payment_status && (
                            <Badge variant="outline" className="mt-0.5 text-[10px]">
                              {order.payment_status === "paid" ? "Төлсөн" : "Төлөгдөөгүй"}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="py-2">
                          <div className="text-sm font-medium truncate max-w-[130px]">{order.profile?.full_name || "—"}</div>
                          <div className="text-xs text-muted-foreground truncate max-w-[130px]">{order.profile?.phone || order.profile?.email}</div>
                        </TableCell>
                        <TableCell className="text-center py-2">
                          <Badge variant="secondary" className="text-xs">{order.order_items?.length || 0}</Badge>
                        </TableCell>
                        <TableCell className="text-right py-2">
                          <div className="font-medium text-sm">{formatCurrency(Number(order.total))}</div>
                          <div className="text-[10px] text-muted-foreground">Хүргэлт: {formatCurrency(Number(order.delivery_fee))}</div>
                        </TableCell>
                        <TableCell className="text-center py-2" onClick={(e) => e.stopPropagation()}>
                          <Select value={order.status} onValueChange={(v) => updateStatusMutation.mutate({ id: order.id, status: v })}>
                            <SelectTrigger className="w-[140px] h-7 text-xs">
                              <SelectValue>{getStatusBadge(order.status)}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {statusOptions.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  <span className={`px-2 py-0.5 rounded-full text-xs ${opt.color}`}>{opt.label}</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
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
                        const isOtapi = snapshot.sourceType === "otapi";
                        return (
                          <TableRow key={item.id} className="bg-muted/30">
                            <TableCell></TableCell>
                            <TableCell colSpan={2} className="py-2">
                              <div className="flex items-center gap-3">
                                {imgSrc && <img src={imgSrc} alt="" className="w-10 h-10 rounded object-contain border bg-muted" />}
                                <div className="min-w-0">
                                  <div className="text-sm font-medium truncate">{snapshot.title || snapshot.name || snapshot.name_mn || "Бараа"}</div>
                                  {snapshot.configurators && (
                                    <div className="text-xs text-muted-foreground mt-0.5">🏷️ {snapshot.configurators}</div>
                                  )}
                                  {snapshot.rawConfigurators && snapshot.rawConfigurators !== snapshot.configurators && (
                                    <div className="text-xs text-muted-foreground/60 mt-0.5">📝 Эх: {snapshot.rawConfigurators}</div>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-center text-sm py-2">{item.quantity}</TableCell>
                            <TableCell className="text-right text-sm py-2">{formatCurrency(Number(item.total_price))}</TableCell>
                            <TableCell colSpan={3}></TableCell>
                          </TableRow>
                        );
                      })}
                    </>
                  ))}
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
        isMobile={isMobile}
      />
    </div>
  );
}

// ─── Order Detail Sheet ─────────────────────────────────────

function LocalOrderDetailSheet({
  order, open, onClose, onStatusChange, onSaveNotes, isMobile,
}: {
  order: any; open: boolean; onClose: () => void;
  onStatusChange: (status: string) => void;
  onSaveNotes: (notes: string) => void;
  isMobile: boolean;
}) {
  const [notes, setNotes] = useState("");
  if (!order) return null;
  const deliveryAddress = order.delivery_address || {};

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className={`${isMobile ? 'w-full' : 'w-full sm:max-w-lg'} overflow-y-auto p-0`}>
        <SheetHeader className="p-4 pb-2 sticky top-0 bg-background z-10 border-b">
          <SheetTitle className="flex items-center gap-2 text-base">
            <ShoppingCart className="h-4 w-4" />
            {order.order_number}
          </SheetTitle>
        </SheetHeader>

        <div className="p-4 space-y-4">
          {/* Status & Payment */}
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="p-3">
                <Label className="text-muted-foreground text-xs">Төлөв</Label>
                <Select value={order.status} onValueChange={onStatusChange}>
                  <SelectTrigger className="mt-1 h-8 text-xs">
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
              <CardContent className="p-3">
                <Label className="text-muted-foreground text-xs">Төлбөр</Label>
                <div className="mt-1">
                  <Badge variant={order.payment_status === "paid" ? "default" : "secondary"} className="text-xs">
                    {order.payment_status === "paid" ? "Төлсөн" : "Төлөгдөөгүй"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Financial */}
          <Card>
            <CardContent className="p-3 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Барааны дүн:</span><span>{formatCurrency(Number(order.subtotal))}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Хүргэлт:</span><span>{formatCurrency(Number(order.delivery_fee))}</span></div>
              <div className="flex justify-between font-bold border-t pt-1.5"><span>Нийт:</span><span>{formatCurrency(Number(order.total))}</span></div>
            </CardContent>
          </Card>

          {/* Customer */}
          {order.profile && (
            <Card>
              <CardContent className="p-3 space-y-1.5 text-sm">
                <div className="flex items-center gap-2"><User className="h-3 w-3 text-muted-foreground" />{order.profile.full_name || "—"}</div>
                <div className="flex items-center gap-2"><Mail className="h-3 w-3 text-muted-foreground" /><span className="truncate">{order.profile.email}</span></div>
                {order.profile.phone && <div className="flex items-center gap-2"><Phone className="h-3 w-3 text-muted-foreground" />{order.profile.phone}</div>}
              </CardContent>
            </Card>
          )}

          {/* Address */}
          {Object.keys(deliveryAddress).length > 0 && (
            <Card>
              <CardContent className="p-3 text-sm space-y-1">
                <div className="flex items-center gap-2 text-xs font-medium"><MapPin className="h-3 w-3" />Хүргэлтийн хаяг</div>
                <p className="text-xs text-muted-foreground">{deliveryAddress.city}, {deliveryAddress.district}</p>
                <p className="text-xs text-muted-foreground">{deliveryAddress.street_address}</p>
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
                const isOtapi = snapshot.sourceType === "otapi";
                return (
                  <div key={item.id} className="flex gap-3 p-3 border rounded-lg">
                    {(snapshot.imageUrl || snapshot.image_url || snapshot.images?.[0]) && (
                      <img src={snapshot.imageUrl || snapshot.image_url || snapshot.images?.[0]} alt="" className="w-12 h-12 rounded object-contain border bg-muted shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium line-clamp-2">{snapshot.title || snapshot.name || snapshot.name_mn || "Бараа"}</div>
                      {snapshot.configurators && (
                        <p className="text-xs text-muted-foreground mt-0.5">🏷️ {snapshot.configurators}</p>
                      )}
                      {snapshot.rawConfigurators && snapshot.rawConfigurators !== snapshot.configurators && (
                        <p className="text-xs text-muted-foreground/60 mt-0.5">📝 Эх: {snapshot.rawConfigurators}</p>
                      )}
                      {snapshot.selectedConfigurators && Array.isArray(snapshot.selectedConfigurators) && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {snapshot.selectedConfigurators.map((cfg: any, ci: number) => (
                            <div key={ci}>
                              <Badge variant="outline" className="text-[10px]">
                                {cfg.name || cfg.title}: {cfg.value || cfg.selectedValue}
                              </Badge>
                              {(cfg.originalName || cfg.originalValue || cfg.rawName || cfg.rawValue) && (
                                <span className="text-muted-foreground/60 ml-0.5 text-[10px]">
                                  ({cfg.rawName || cfg.originalName}: {cfg.rawValue || cfg.originalValue})
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        {isOtapi ? (
                          <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">{snapshot.providerType || "OT"}</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">Бэлэн бараа</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {formatCurrency(Number(item.unit_price))} × {item.quantity}
                      </div>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {isOtapi && snapshot.externalUrl && (
                          <a href={snapshot.externalUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">🔗 Эх сурвалж</a>
                        )}
                        {isOtapi && snapshot.itemId && (
                          <a href={`/product/otapi/${snapshot.itemId}`} target="_blank" rel="noopener noreferrer" className="text-xs text-green-600 hover:underline">🏠 Манай сайт</a>
                        )}
                        {!isOtapi && item.product_id && (
                          <a href={`/product/local/${item.product_id}`} target="_blank" rel="noopener noreferrer" className="text-xs text-green-600 hover:underline">📦 Барааны линк</a>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-medium text-sm">{formatCurrency(Number(item.total_price))}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <Card>
            <CardContent className="p-3 space-y-2">
              <Label className="text-xs flex items-center gap-1"><MessageSquare className="h-3 w-3" />Тэмдэглэл</Label>
              <Textarea value={notes || order.notes || ""} onChange={(e) => setNotes(e.target.value)} placeholder="Тэмдэглэл..." rows={2} />
              <Button size="sm" onClick={() => onSaveNotes(notes || order.notes || "")}>Хадгалах</Button>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardContent className="p-3 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground text-xs">Үүсгэсэн:</span><span className="text-xs">{format(new Date(order.created_at), "yyyy-MM-dd HH:mm")}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground text-xs">Шинэчилсэн:</span><span className="text-xs">{format(new Date(order.updated_at), "yyyy-MM-dd HH:mm")}</span></div>
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}
