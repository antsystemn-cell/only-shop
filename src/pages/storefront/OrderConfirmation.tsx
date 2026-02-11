import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import QPayPayment from "@/components/storefront/QPayPayment";
import { 
  CheckCircle2, 
  Package, 
  Truck, 
  MapPin, 
  Calendar,
  ShoppingBag,
  Home,
  Loader2
} from "lucide-react";

interface OrderItem {
  id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  product_snapshot: {
    id: string;
    name: string;
    name_mn: string;
    price: number;
    images?: string[];
  };
}

interface DeliveryAddress {
  city: string;
  district: string;
  street_address: string;
  apartment?: string;
  phone: string;
}

interface Order {
  id: string;
  order_number: string;
  status: string;
  payment_status: string | null;
  subtotal: number;
  delivery_fee: number;
  total: number;
  delivery_type: string | null;
  estimated_delivery_date: string | null;
  delivery_address: DeliveryAddress | null;
  notes: string | null;
  created_at: string;
  order_items: OrderItem[];
  delivery_zones: {
    name: string;
  } | null;
}

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Хүлээгдэж буй", variant: "secondary" },
  processing: { label: "Боловсруулж буй", variant: "default" },
  shipped: { label: "Хүргэгдэж буй", variant: "default" },
  delivered: { label: "Хүргэгдсэн", variant: "default" },
  cancelled: { label: "Цуцлагдсан", variant: "destructive" },
};

const paymentStatusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Төлбөр хүлээгдэж буй", variant: "outline" },
  paid: { label: "Төлбөр төлөгдсөн", variant: "default" },
  failed: { label: "Төлбөр амжилтгүй", variant: "destructive" },
};

export default function OrderConfirmation() {
  const { orderId } = useParams<{ orderId: string }>();

  const { data: order, isLoading, error, refetch } = useQuery({
    queryKey: ["order", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          order_items (*),
          delivery_zones (name)
        `)
        .eq("id", orderId)
        .single();
      
      if (error) throw error;
      
      const orderItems: OrderItem[] = (data.order_items || []).map((item: any) => ({
        id: item.id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price,
        product_snapshot: item.product_snapshot as OrderItem["product_snapshot"],
      }));
      
      return {
        id: data.id,
        order_number: data.order_number,
        status: data.status,
        payment_status: data.payment_status,
        subtotal: data.subtotal,
        delivery_fee: data.delivery_fee,
        total: data.total,
        delivery_type: data.delivery_type,
        estimated_delivery_date: data.estimated_delivery_date,
        delivery_address: data.delivery_address as unknown as DeliveryAddress | null,
        notes: data.notes,
        created_at: data.created_at,
        order_items: orderItems,
        delivery_zones: data.delivery_zones,
      } as Order;
    },
    enabled: !!orderId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="container py-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Захиалга олдсонгүй</h1>
        <Button asChild>
          <Link to="/">Нүүр хуудас руу буцах</Link>
        </Button>
      </div>
    );
  }

  const orderStatus = statusLabels[order.status] || statusLabels.pending;
  const paymentStatus = paymentStatusLabels[order.payment_status || "pending"] || paymentStatusLabels.pending;
  const showPayment = order.payment_status === "pending" || order.payment_status === "failed";

  return (
    <div className="container py-8 max-w-4xl">
      {/* Success Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-4">
          <CheckCircle2 className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-3xl font-bold mb-2">
          {order.payment_status === "paid" ? "Төлбөр амжилттай!" : "Захиалга амжилттай!"}
        </h1>
        <p className="text-muted-foreground">
          Таны захиалгыг хүлээн авлаа. Захиалгын дугаар: <strong>{order.order_number}</strong>
        </p>
      </div>

      {/* QPay Payment Section - shown for unpaid orders */}
      {showPayment && (
        <div className="mb-8">
          <QPayPayment
            orderId={order.id}
            orderNumber={order.order_number}
            amount={order.total}
            onPaymentSuccess={() => refetch()}
          />
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Order Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Package className="h-5 w-5 text-primary" />
              Захиалгын мэдээлэл
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Захиалгын дугаар</span>
              <span className="font-mono font-medium">{order.order_number}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Төлөв</span>
              <Badge variant={orderStatus.variant}>{orderStatus.label}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Төлбөр</span>
              <Badge variant={paymentStatus.variant}>{paymentStatus.label}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Огноо</span>
              <span>{new Date(order.created_at).toLocaleDateString("mn-MN")}</span>
            </div>
          </CardContent>
        </Card>

        {/* Delivery Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Truck className="h-5 w-5 text-primary" />
              Хүргэлтийн мэдээлэл
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Хүргэлтийн төрөл</span>
              <span className="capitalize">
                {order.delivery_type === "express" ? "Шуурхай" : "Энгийн"}
              </span>
            </div>
            {order.delivery_zones && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Бүс</span>
                <span>{order.delivery_zones.name}</span>
              </div>
            )}
            {order.estimated_delivery_date && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Хүргэх огноо</span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {new Date(order.estimated_delivery_date).toLocaleDateString("mn-MN")}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delivery Address */}
        {order.delivery_address && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MapPin className="h-5 w-5 text-primary" />
                Хүргэлтийн хаяг
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="font-medium">
                  {order.delivery_address.city}, {order.delivery_address.district}
                </p>
                <p className="text-muted-foreground">
                  {order.delivery_address.street_address}
                  {order.delivery_address.apartment && `, ${order.delivery_address.apartment}`}
                </p>
                <p className="text-sm mt-2">
                  Утас: <strong>{order.delivery_address.phone}</strong>
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Order Items */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShoppingBag className="h-5 w-5 text-primary" />
              Захиалсан бараанууд
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {order.order_items.map((item) => (
                <div key={item.id} className="flex gap-4">
                  <div className="w-16 h-16 bg-muted rounded-lg overflow-hidden shrink-0">
                    {item.product_snapshot.images?.[0] ? (
                      <img
                        src={item.product_snapshot.images[0]}
                        alt={item.product_snapshot.name_mn}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <ShoppingBag className="h-6 w-6" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{item.product_snapshot.name_mn}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.quantity} × {item.unit_price.toLocaleString()}₮
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{item.total_price.toLocaleString()}₮</p>
                  </div>
                </div>
              ))}
            </div>

            <Separator className="my-4" />

            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Барааны дүн</span>
                <span>{order.subtotal.toLocaleString()}₮</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Хүргэлт</span>
                <span>{order.delivery_fee.toLocaleString()}₮</span>
              </div>
              <Separator />
              <div className="flex justify-between font-bold text-lg">
                <span>Нийт</span>
                <span className="text-primary">{order.total.toLocaleString()}₮</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        {order.notes && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Тэмдэглэл</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{order.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
        <Button asChild size="lg">
          <Link to="/">
            <Home className="h-4 w-4 mr-2" />
            Нүүр хуудас
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link to="/shop">
            <ShoppingBag className="h-4 w-4 mr-2" />
            Дэлгүүр үргэлжлүүлэх
          </Link>
        </Button>
      </div>
    </div>
  );
}
