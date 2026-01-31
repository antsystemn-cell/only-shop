import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Package, 
  ArrowLeft, 
  ShoppingBag, 
  Calendar,
  Loader2,
  ChevronRight
} from "lucide-react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

interface OrderItem {
  id: string;
  quantity: number;
  total_price: number;
  product_snapshot: {
    name_mn: string;
    images?: string[];
  };
}

interface Order {
  id: string;
  order_number: string;
  status: string;
  payment_status: string | null;
  total: number;
  created_at: string;
  order_items: OrderItem[];
}

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Хүлээгдэж буй", variant: "secondary" },
  processing: { label: "Боловсруулж буй", variant: "default" },
  shipped: { label: "Хүргэгдэж буй", variant: "default" },
  delivered: { label: "Хүргэгдсэн", variant: "default" },
  cancelled: { label: "Цуцлагдсан", variant: "destructive" },
};

export default function CustomerOrders() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  const { data: orders, isLoading } = useQuery({
    queryKey: ["customer-orders", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          id,
          order_number,
          status,
          payment_status,
          total,
          created_at,
          order_items (
            id,
            quantity,
            total_price,
            product_snapshot
          )
        `)
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []).map((order: any) => ({
        ...order,
        order_items: order.order_items.map((item: any) => ({
          ...item,
          product_snapshot: item.product_snapshot as OrderItem["product_snapshot"],
        })),
      })) as Order[];
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
    <div className="container py-8 max-w-4xl">
      <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4" />
        Нүүр хуудас руу буцах
      </Link>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Миний захиалгууд</h1>
          <p className="text-muted-foreground mt-1">
            Таны өмнөх захиалгуудын түүх
          </p>
        </div>
      </div>

      {orders && orders.length > 0 ? (
        <div className="space-y-4">
          {orders.map((order) => {
            const status = statusLabels[order.status] || statusLabels.pending;
            const itemCount = order.order_items.reduce((sum, item) => sum + item.quantity, 0);
            
            return (
              <Card key={order.id} className="overflow-hidden hover:shadow-md transition-shadow">
                <CardContent className="p-0">
                  <Link to={`/order-confirmation/${order.id}`}>
                    <div className="p-4 sm:p-6">
                      {/* Header */}
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
                          <Badge variant={status.variant}>{status.label}</Badge>
                          <ChevronRight className="h-5 w-5 text-muted-foreground hidden sm:block" />
                        </div>
                      </div>

                      <Separator className="my-4" />

                      {/* Items Preview */}
                      <div className="flex items-center gap-4">
                        <div className="flex -space-x-2">
                          {order.order_items.slice(0, 3).map((item, index) => (
                            <div
                              key={item.id}
                              className="w-12 h-12 rounded-lg bg-muted border-2 border-background overflow-hidden"
                              style={{ zIndex: 3 - index }}
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
                          <p className="text-sm text-muted-foreground">
                            {itemCount} бараа
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg text-primary">
                            {order.total.toLocaleString()}₮
                          </p>
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
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-4 rounded-full bg-muted mb-4">
              <Package className="h-12 w-12 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Захиалга олдсонгүй</h3>
            <p className="text-muted-foreground mb-6">
              Та одоогоор ямар нэгэн захиалга өгөөгүй байна
            </p>
            <Button asChild>
              <Link to="/shop">
                <ShoppingBag className="h-4 w-4 mr-2" />
                Дэлгүүр үзэх
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
