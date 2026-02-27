import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ArrowLeft,
  Package,
  Loader2,
  Calendar,
  Eye,
  ShoppingBag,
  RefreshCw,
} from "lucide-react";

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Хүлээгдэж буй", variant: "secondary" },
  processing: { label: "Боловсруулж буй", variant: "default" },
  shipped: { label: "Хүргэлтэд", variant: "default" },
  delivered: { label: "Хүргэгдсэн", variant: "default" },
  completed: { label: "Дууссан", variant: "default" },
  cancelled: { label: "Цуцлагдсан", variant: "destructive" },
};

export default function OtOrders() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  const loadOrders = async () => {
    if (!user) return;
    try {
      setLoading(true);
      let query = supabase
        .from("ot_orders")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setOrders(data || []);
    } catch (err: any) {
      console.error("OT orders load error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) loadOrders();
  }, [user, statusFilter]);

  if (authLoading) {
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
        Нүүр хуудас
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">Миний захиалгууд</h1>
          <p className="text-muted-foreground mt-1">Маркетплэйсийн захиалгуудын түүх</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Статус" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Бүгд</SelectItem>
              {Object.entries(STATUS_LABELS).map(([value, { label }]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={loadOrders}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : orders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-4 rounded-full bg-muted mb-4">
              <Package className="h-12 w-12 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Захиалга олдсонгүй</h3>
            <p className="text-muted-foreground mb-6">Та маркетплэйсээс бараа захиалаагүй байна</p>
            <Button asChild>
              <Link to="/ot">
                <ShoppingBag className="h-4 w-4 mr-2" />
                Маркетплэйс үзэх
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const statusInfo = STATUS_LABELS[order.status] || { label: order.status, variant: "outline" as const };
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
                    <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                  </div>

                  {items.length > 0 && (
                    <>
                      <Separator className="my-3" />
                      <div className="flex items-center gap-3">
                        <div className="flex -space-x-2">
                          {items.slice(0, 3).map((item, i) => (
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

                  <div className="flex justify-end mt-3">
                    <Button variant="outline" size="sm" onClick={() => { setSelectedOrder(order); setShowDetail(true); }}>
                      <Eye className="h-4 w-4 mr-1" />
                      Дэлгэрэнгүй
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Order Detail Dialog */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Захиалгын дэлгэрэнгүй</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Захиалгын №:</span>
                  <p className="font-mono font-semibold">{selectedOrder.order_number}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Статус:</span>
                  <p><Badge>{STATUS_LABELS[selectedOrder.status]?.label || selectedOrder.status}</Badge></p>
                </div>
                <div>
                  <span className="text-muted-foreground">Огноо:</span>
                  <p>{new Date(selectedOrder.created_at).toLocaleString("mn-MN")}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Хүргэлт:</span>
                  <p>{selectedOrder.delivery_type === "delivery" ? "Хүргэлтээр" : "Өөрөө авна"}</p>
                </div>
              </div>

              {selectedOrder.delivery_address && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Хаяг:</span>
                  <p>{selectedOrder.delivery_address.fullName} — {selectedOrder.delivery_address.address}
                    {selectedOrder.delivery_address.phone && ` (${selectedOrder.delivery_address.phone})`}
                  </p>
                </div>
              )}

              {selectedOrder.comment && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Тэмдэглэл:</span>
                  <p>{selectedOrder.comment}</p>
                </div>
              )}

              <Separator />

              <div className="space-y-3">
                <h4 className="font-semibold">Бараанууд</h4>
                {((selectedOrder.items as any[]) || []).map((item: any, i: number) => (
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
                <span className="text-primary">{new Intl.NumberFormat("mn-MN").format(Math.round(selectedOrder.subtotal))}₮</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
