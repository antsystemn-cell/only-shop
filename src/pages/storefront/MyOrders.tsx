import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Package, Loader2, Calendar, ShoppingBag, ChevronRight, Eye, RefreshCw } from "lucide-react";

// ---- Local order types ----
interface OrderItem {
  id: string;
  quantity: number;
  total_price: number;
  product_snapshot: { name_mn: string; images?: string[] };
}
interface LocalOrder {
  id: string;
  order_number: string;
  status: string;
  total: number;
  created_at: string;
  order_items: OrderItem[];
}

// ---- Status maps ----
const LOCAL_STATUS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Хүлээгдэж буй", variant: "secondary" },
  processing: { label: "Боловсруулж буй", variant: "default" },
  shipped: { label: "Хүргэгдэж буй", variant: "default" },
  delivered: { label: "Хүргэгдсэн", variant: "default" },
  cancelled: { label: "Цуцлагдсан", variant: "destructive" },
};

const OT_STATUS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Төлбөр хүлээгдэж байна", variant: "secondary" },
  paid: { label: "Төлбөр төлөгдсөн", variant: "default" },
  foreign_ordered: { label: "Гадаад захиалга хийгдсэн", variant: "default" },
  at_warehouse: { label: "Гадаад агуулахад", variant: "default" },
  shipped_mn: { label: "Монгол руу ачигдсан", variant: "default" },
  arrived_ub: { label: "УБ-д ирсэн", variant: "default" },
  delivered: { label: "Хүлээлгэн өгсөн", variant: "default" },
  cancelled: { label: "Цуцлагдсан", variant: "destructive" },
};

export default function MyOrders() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const [selectedOtOrder, setSelectedOtOrder] = useState<any>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  // Local orders
  const { data: localOrders, isLoading: localLoading } = useQuery({
    queryKey: ["my-local-orders", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, status, total, created_at, order_items(id, quantity, total_price, product_snapshot)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((o: any) => ({
        ...o,
        order_items: o.order_items.map((i: any) => ({
          ...i,
          product_snapshot: i.product_snapshot as OrderItem["product_snapshot"],
        })),
      })) as LocalOrder[];
    },
    enabled: !!user,
  });

  // OT orders
  const {
    data: otOrders,
    isLoading: otLoading,
    refetch: refetchOt,
  } = useQuery({
    queryKey: ["my-ot-orders", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ot_orders")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  if (authLoading || (localLoading && otLoading)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalCount = (localOrders?.length || 0) + (otOrders?.length || 0);

  return (
    <div className="container py-8 max-w-4xl">
      <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4" /> Нүүр хуудас руу буцах
      </Link>

      <div className="mb-6">
        <h1 className="text-3xl font-bold">Миний захиалгууд</h1>
        <p className="text-muted-foreground mt-1">Таны бүх захиалгуудын түүх</p>
      </div>

      <Tabs defaultValue="ot" className="w-full">
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="ot">Гадаад захиалга ({otOrders?.length || 0})</TabsTrigger>
          <TabsTrigger value="local">Бэлэн бараа захиалга ({localOrders?.length || 0})</TabsTrigger>
        </TabsList>

        {/* OT Orders Tab */}
        <TabsContent value="ot" className="mt-4">
          {otLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : otOrders && otOrders.length > 0 ? (
            <div className="space-y-4">
              {otOrders.map((order: any) => {
                const st = OT_STATUS[order.status] || { label: order.status, variant: "outline" as const };
                const items = (order.items as any[]) || [];
                return (
                  <Card key={order.id} className="overflow-hidden hover:shadow-md transition-shadow">
                    <CardContent className="p-4 sm:p-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <Package className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-mono font-semibold text-sm">{order.order_number}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(order.created_at).toLocaleDateString("mn-MN")}
                            </p>
                          </div>
                        </div>
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </div>
                      {order.status === "cancelled" && order.cancel_reason && (
                        <p className="text-xs text-destructive mb-2">Шалтгаан: {order.cancel_reason}</p>
                      )}
                      {items.length > 0 && (
                        <>
                          <Separator className="my-3" />
                          <div className="flex items-center gap-3">
                            <div className="flex -space-x-2">
                              {items.slice(0, 3).map((item: any, i: number) => (
                                <div
                                  key={i}
                                  className="w-10 h-10 rounded bg-muted border-2 border-background overflow-hidden"
                                  style={{ zIndex: 3 - i }}
                                >
                                  {item.imageUrl ? (
                                    <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <ShoppingBag className="h-3 w-3 text-muted-foreground" />
                                    </div>
                                  )}
                                </div>
                              ))}
                              {items.length > 3 && (
                                <div className="w-10 h-10 rounded bg-muted border-2 border-background flex items-center justify-center text-xs font-medium">
                                  +{items.length - 3}
                                </div>
                              )}
                            </div>
                            <span className="text-sm text-muted-foreground flex-1">{order.item_count} бараа</span>
                            <span className="font-bold text-primary">
                              {new Intl.NumberFormat("mn-MN").format(Math.round(order.subtotal))}₮
                            </span>
                          </div>
                        </>
                      )}
                      <div className="flex justify-end mt-3 gap-2">
                        {order.status === "pending" && (
                          <Button size="sm" asChild>
                            <Link to={`/ot/checkout?pay=${order.id}`}>💳 Төлбөр төлөх</Link>
                          </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => setSelectedOtOrder(order)}>
                          <Eye className="h-4 w-4 mr-1" /> Дэлгэрэнгүй
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <EmptyState text="Гадаадаас захиалга хийгээгүй байна" linkTo="/ot" linkLabel="Онлайн дэлгүүр үзэх" />
          )}
        </TabsContent>

        {/* Local Orders Tab */}
        <TabsContent value="local" className="mt-4">
          {localLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : localOrders && localOrders.length > 0 ? (
            <div className="space-y-4">
              {localOrders.map((order) => {
                const st = LOCAL_STATUS[order.status] || LOCAL_STATUS.pending;
                const itemCount = order.order_items.reduce((s, i) => s + i.quantity, 0);
                return (
                  <Card key={order.id} className="overflow-hidden hover:shadow-md transition-shadow">
                    <CardContent className="p-0">
                      <Link to={`/order-confirmation/${order.id}`}>
                        <div className="p-4 sm:p-6">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-primary/10">
                                <Package className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <p className="font-mono font-semibold">{order.order_number}</p>
                                <p className="text-sm text-muted-foreground flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {new Date(order.created_at).toLocaleDateString("mn-MN", {
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric",
                                  })}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={st.variant}>{st.label}</Badge>
                              <ChevronRight className="h-5 w-5 text-muted-foreground hidden sm:block" />
                            </div>
                          </div>
                          <Separator className="my-4" />
                          <div className="flex items-center gap-4">
                            <div className="flex -space-x-2">
                              {order.order_items.slice(0, 3).map((item, idx) => (
                                <div
                                  key={item.id}
                                  className="w-12 h-12 rounded-lg bg-muted border-2 border-background overflow-hidden"
                                  style={{ zIndex: 3 - idx }}
                                >
                                  {item.product_snapshot.images?.[0] ? (
                                    <img
                                      src={item.product_snapshot.images[0]}
                                      alt={item.product_snapshot.name_mn}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                  )}
                                </div>
                              ))}
                              {order.order_items.length > 3 && (
                                <div className="w-12 h-12 rounded-lg bg-muted border-2 border-background flex items-center justify-center text-sm font-medium">
                                  +{order.order_items.length - 3}
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-muted-foreground">{itemCount} бараа</p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-lg text-primary">{order.total.toLocaleString()}₮</p>
                            </div>
                          </div>
                        </div>
                      </Link>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <EmptyState text="Дотоод захиалга өгөөгүй байна" linkTo="/shop" linkLabel="Дэлгүүр үзэх" />
          )}
        </TabsContent>
      </Tabs>

      {/* OT Order Detail Dialog */}
      <Dialog open={!!selectedOtOrder} onOpenChange={(open) => !open && setSelectedOtOrder(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Захиалгын дэлгэрэнгүй</DialogTitle>
          </DialogHeader>
          {selectedOtOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Захиалгын №:</span>
                  <p className="font-mono font-semibold">{selectedOtOrder.order_number}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Статус:</span>
                  <p>
                    <Badge>{OT_STATUS[selectedOtOrder.status]?.label || selectedOtOrder.status}</Badge>
                  </p>
                  {selectedOtOrder.status === "cancelled" && selectedOtOrder.cancel_reason && (
                    <p className="text-xs text-destructive mt-1">Шалтгаан: {selectedOtOrder.cancel_reason}</p>
                  )}
                </div>
                <div>
                  <span className="text-muted-foreground">Огноо:</span>
                  <p>{new Date(selectedOtOrder.created_at).toLocaleString("mn-MN")}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Хүргэлт:</span>
                  <p>{selectedOtOrder.delivery_type === "delivery" ? "Хүргэлтээр" : "Өөрөө авна"}</p>
                </div>
              </div>
              {selectedOtOrder.delivery_address && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Хаяг:</span>
                  <p>
                    {selectedOtOrder.delivery_address.fullName} — {selectedOtOrder.delivery_address.address}
                    {selectedOtOrder.delivery_address.phone && ` (${selectedOtOrder.delivery_address.phone})`}
                  </p>
                </div>
              )}
              {selectedOtOrder.comment && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Тэмдэглэл:</span>
                  <p>{selectedOtOrder.comment}</p>
                </div>
              )}
              <Separator />
              <div className="space-y-3">
                <h4 className="font-semibold">Бараанууд</h4>
                {((selectedOtOrder.items as any[]) || []).map((item: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg border">
                    <div className="w-14 h-14 rounded bg-muted overflow-hidden shrink-0">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm line-clamp-2">{item.title}</p>
                      {item.configurators && <p className="text-xs text-muted-foreground">{item.configurators}</p>}
                      <span className="text-xs text-muted-foreground">Тоо: {item.quantity}</span>
                    </div>
                    <span className="text-sm font-medium shrink-0">
                      {new Intl.NumberFormat("mn-MN").format(Math.round(item.totalPrice))}₮
                    </span>
                  </div>
                ))}
              </div>
              <Separator />
              <div className="flex justify-between font-bold text-lg">
                <span>Нийт:</span>
                <span className="text-primary">
                  {new Intl.NumberFormat("mn-MN").format(Math.round(selectedOtOrder.subtotal))}₮
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmptyState({ text, linkTo, linkLabel }: { text: string; linkTo: string; linkLabel: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="p-4 rounded-full bg-muted mb-4">
          <Package className="h-12 w-12 text-muted-foreground" />
        </div>
        <h3 className="font-semibold text-lg mb-2">Захиалга олдсонгүй</h3>
        <p className="text-muted-foreground mb-6">{text}</p>
        <Button asChild>
          <Link to={linkTo}>
            <ShoppingBag className="h-4 w-4 mr-2" />
            {linkLabel}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
