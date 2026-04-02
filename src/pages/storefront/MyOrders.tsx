import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Package, Loader2, Calendar, ShoppingBag, ChevronRight } from "lucide-react";

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

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Хүлээгдэж буй", variant: "secondary" },
  processing: { label: "Боловсруулж буй", variant: "default" },
  shipped: { label: "Хүргэгдэж буй", variant: "default" },
  delivered: { label: "Хүргэгдсэн", variant: "default" },
  cancelled: { label: "Цуцлагдсан", variant: "destructive" },
};

export default function MyOrders() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  const { data: orders, isLoading } = useQuery({
    queryKey: ["my-orders", user?.id],
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

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container py-6 max-w-2xl animate-fade-in">
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-2xl p-5 mb-5">
        <h1 className="text-xl font-bold">Миний захиалгууд</h1>
        <p className="text-sm text-muted-foreground mt-1">Таны бүх захиалгуудын түүх</p>
      </div>

      {orders && orders.length > 0 ? (
        <div className="space-y-4">
          {orders.map((order) => {
            const st = STATUS_MAP[order.status] || STATUS_MAP.pending;
            const itemCount = order.order_items.reduce((s, i) => s + i.quantity, 0);
            return (
              <Card key={order.id} className="overflow-hidden hover:shadow-md transition-shadow rounded-2xl">
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
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <Package className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg mb-1">Захиалга байхгүй</h3>
          <p className="text-muted-foreground text-sm mb-4">Та одоогоор захиалга хийгээгүй байна</p>
          <Link to="/shop" className="text-primary font-medium text-sm hover:underline">
            Дэлгүүр үзэх →
          </Link>
        </div>
      )}
    </div>
  );
}
