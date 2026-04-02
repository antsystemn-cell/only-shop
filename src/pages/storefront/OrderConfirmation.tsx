import { useState, useEffect, useCallback } from "react";
import { useParams, Link, useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import QPayPayment from "@/components/storefront/QPayPayment";
import OmniWayPayment from "@/components/storefront/OmniWayPayment";
import StorepayPayment from "@/components/storefront/StorepayPayment";
import WalletPayment from "@/components/storefront/WalletPayment";
import PaymentMethodSelector, { type PaymentMethod } from "@/components/storefront/PaymentMethodSelector";
import { 
  CheckCircle2, 
  Package, 
  Truck, 
  MapPin, 
  Calendar,
  ShoppingBag,
  Home,
  Loader2,
  AlertCircle,
  CreditCard
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
  payment_method: string | null;
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
  const [searchParams] = useSearchParams();
  const paymentIntentId = searchParams.get("pi");

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
        payment_method: data.payment_method,
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

  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>("qpay");
  const [changingMethod, setChangingMethod] = useState(false);
  const [currentPaymentIntentId, setCurrentPaymentIntentId] = useState<string | null>(paymentIntentId);
  const [switchingPayment, setSwitchingPayment] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (order?.payment_method) {
      setSelectedPaymentMethod(order.payment_method as PaymentMethod);
    }
  }, [order?.payment_method]);

  // Sync paymentIntentId from URL
  useEffect(() => {
    setCurrentPaymentIntentId(paymentIntentId);
  }, [paymentIntentId]);

  const handleChangePaymentMethod = useCallback(async (method: PaymentMethod) => {
    if (!order) return;
    setSwitchingPayment(true);
    try {
      // Update order's payment method in DB
      await supabase
        .from("orders")
        .update({ payment_method: method })
        .eq("id", order.id);

      // Create new payment intent for non-wallet methods
      if (method !== "wallet") {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const { data: pi, error: piErr } = await supabase
          .from("payment_intents")
          .insert({
            user_id: user.id,
            type: "order" as const,
            reference_id: order.id,
            amount: order.total,
            provider:
              method === "omniway"
                ? ("omniway" as const)
                : method === "storepay"
                  ? ("storepay" as const)
                  : ("qpay" as const),
            status: "initiated" as const,
          })
          .select()
          .single();

        if (piErr) {
          console.error("Payment intent creation error:", piErr);
          throw piErr;
        }

        setCurrentPaymentIntentId(pi.id);
        // Update URL with new payment intent
        navigate(`/order-confirmation/${order.id}?pi=${pi.id}`, { replace: true });
      } else {
        setCurrentPaymentIntentId(null);
        navigate(`/order-confirmation/${order.id}`, { replace: true });
      }

      setSelectedPaymentMethod(method);
      setChangingMethod(false);
      refetch();
    } catch (err) {
      console.error("Failed to switch payment method:", err);
    } finally {
      setSwitchingPayment(false);
    }
  }, [order, navigate, refetch]);

  return (
    <div className="container py-8 max-w-4xl">
      {/* Header - different for paid vs unpaid */}
      <div className="text-center mb-8">
        {isPaid ? (
          <>
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
              <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Төлбөр амжилттай!</h1>
            <p className="text-muted-foreground">
              Таны захиалгыг хүлээн авлаа.
            </p>
            <p className="font-mono text-xl font-bold mt-2">{order.order_number}</p>
          </>
        ) : (
          <>
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-900/30 mb-4">
              <CreditCard className="h-10 w-10 text-amber-600 dark:text-amber-400" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Төлбөр төлөх</h1>
            <p className="font-mono text-2xl font-bold mt-1 mb-2">{order.order_number}</p>
            <p className="text-muted-foreground max-w-md mx-auto">
              Таны захиалга амжилттай үүссэн бөгөөд төлбөр төлөгдсөнөөр захиалга нь бүрэн баталгаажих болно.
            </p>
          </>
        )}
      </div>

      {/* Payment Section - shown for unpaid orders */}
      {showPayment && (
        <div className="mb-8 space-y-4">
          {/* Payment method change option */}
          {changingMethod ? (
            <PaymentMethodSelector
              selected={selectedPaymentMethod}
              onSelect={handleChangePaymentMethod}
              title="Төлбөрийн хэлбэр сонгох"
            />
          ) : (
            <>
              {/* Show current payment widget */}
              {activePaymentMethod === "wallet" && (
                <WalletPayment
                  amount={order.total}
                  orderId={order.id}
                  onPaymentSuccess={async () => {
                    await supabase
                      .from("orders")
                      .update({ payment_status: "paid", status: "processing" })
                      .eq("id", order.id);
                    refetch();
                  }}
                />
              )}
              {activePaymentMethod === "omniway" && paymentIntentId && (
                <OmniWayPayment
                  paymentIntentId={paymentIntentId}
                  orderNumber={order.order_number}
                  amount={order.total}
                  onPaymentSuccess={() => refetch()}
                />
              )}
              {activePaymentMethod === "storepay" && paymentIntentId && (
                <StorepayPayment
                  paymentIntentId={paymentIntentId}
                  orderNumber={order.order_number}
                  amount={order.total}
                  onPaymentSuccess={() => refetch()}
                />
              )}
              {activePaymentMethod !== "omniway" && activePaymentMethod !== "storepay" && activePaymentMethod !== "wallet" && (
                <QPayPayment
                  paymentIntentId={paymentIntentId || undefined}
                  orderId={!paymentIntentId ? order.id : undefined}
                  orderNumber={order.order_number}
                  amount={order.total}
                  onPaymentSuccess={() => refetch()}
                />
              )}

              {/* Button to switch payment method */}
              <div className="text-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setChangingMethod(true)}
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Төлбөрийн хэлбэр солих
                </Button>
              </div>
            </>
          )}
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
