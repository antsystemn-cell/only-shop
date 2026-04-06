import { useState, useEffect, useMemo } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ArrowLeft, Loader2, MapPin, Truck, ShoppingBag, Package, Clock, CheckCircle2 } from "lucide-react";
import { z } from "zod";
import PaymentMethodSelector, { type PaymentMethod } from "@/components/storefront/PaymentMethodSelector";
import { calculateDelivery, type DeliveryZoneInfo } from "@/lib/deliveryCalculator";
import { triggerDeliverySync } from "@/lib/deliverySync";

interface DeliveryZone {
  id: string;
  name: string;
  zone_type: string;
  standard_price: number;
  standard_days: number | null;
  express_price: number | null;
  express_days: number | null;
}

const addressSchema = z.object({
  city: z.string().min(1, "Хот/Аймаг сонгоно уу"),
  district: z.string().min(1, "Дүүрэг/Сум оруулна уу"),
  street_address: z.string().min(5, "Дэлгэрэнгүй хаяг оруулна уу"),
  apartment: z.string().optional(),
  phone: z.string().min(8, "Утасны дугаар оруулна уу"),
});

function formatMntPrice(price: number) {
  return new Intl.NumberFormat("mn-MN").format(Math.round(price)) + "₮";
}

export default function Checkout() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    items: allLocalItems,
    getSubtotal: getAllLocalSubtotal,
    clearCart: clearLocalCart,
    removeFromCart,
  } = useCart();
  const { user, isLoading: authLoading } = useAuth();

  const buyNowProductId = (location.state as any)?.buyNowProductId as string | undefined;
  const localItems = buyNowProductId ? allLocalItems.filter((i) => i.product.id === buyNowProductId) : allLocalItems;

  const [selectedZone, setSelectedZone] = useState<DeliveryZone | null>(null);
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("qpay");

  const [addressForm, setAddressForm] = useState({
    city: "Улаанбаатар",
    district: "",
    street_address: "",
    apartment: "",
    phone: "",
  });

  const totalItemCount = localItems.length;

  useEffect(() => {
    if (!authLoading && !user) {
      toast.error("Захиалга өгөхийн тулд нэвтэрнэ үү");
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (totalItemCount === 0 && !authLoading) {
      navigate("/shop");
    }
  }, [totalItemCount, navigate, authLoading]);

  const { data: deliveryZones } = useQuery({
    queryKey: ["delivery-zones"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_zones")
        .select("*")
        .eq("is_active", true)
        .order("zone_type")
        .order("name");
      if (error) throw error;
      return data as DeliveryZone[];
    },
  });

  const ubDistricts = deliveryZones?.filter((z) => z.zone_type === "ub_district") || [];
  const aimags = deliveryZones?.filter((z) => z.zone_type === "aimag") || [];

  // ── Centralized delivery calculation ──
  const deliveryResult = useMemo(() => {
    const products = localItems.map((item) => ({
      delivery_fee_type: item.product.delivery_fee_type || "default",
      custom_delivery_fee: item.product.custom_delivery_fee ?? null,
    }));

    const zoneInfo: DeliveryZoneInfo | null = selectedZone
      ? {
          standard_price: selectedZone.standard_price,
          standard_days: selectedZone.standard_days,
          express_price: selectedZone.express_price,
          express_days: selectedZone.express_days,
        }
      : null;

    return calculateDelivery(products, zoneInfo, "standard");
  }, [localItems, selectedZone]);

  const localSubtotal = buyNowProductId
    ? localItems.reduce((sum, i) => sum + i.product.price * i.quantity, 0)
    : getAllLocalSubtotal();

  const deliveryFee = deliveryResult.fee;
  const localTotal = localSubtotal + deliveryFee;

  const deliveryDays = selectedZone?.standard_days ?? null;

  const createOrderMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Нэвтрэх шаардлагатай");

      // For FREE/FIXED delivery, zone is not required
      if (deliveryResult.zoneAffectsPrice && !selectedZone) {
        throw new Error("Хүргэлтийн бүс сонгоно уу");
      }

      const validation = addressSchema.safeParse(addressForm);
      if (!validation.success) {
        const fieldErrors: Record<string, string> = {};
        validation.error.errors.forEach((err) => {
          if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
        });
        setErrors(fieldErrors);
        throw new Error("Хаягийн мэдээлэл дутуу байна");
      }

      const estimatedDate = new Date();
      estimatedDate.setDate(estimatedDate.getDate() + (deliveryDays || 3));

      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          user_id: user.id,
          order_number: "",
          subtotal: localSubtotal,
          delivery_fee: deliveryFee,
          total: localTotal,
          status: "pending",
          payment_status: "pending",
          payment_method: paymentMethod,
          delivery_type: "standard",
          delivery_zone_id: selectedZone?.id || null,
          estimated_delivery_date: estimatedDate.toISOString().split("T")[0],
          delivery_address: {
            city: addressForm.city,
            district: addressForm.district,
            street_address: addressForm.street_address,
            apartment: addressForm.apartment,
            phone: addressForm.phone,
          },
          notes: notes || null,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      const orderItems = localItems.map((item) => ({
        order_id: order.id,
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.product.price,
        total_price: item.product.price * item.quantity,
        product_snapshot: {
          id: item.product.id,
          name: item.product.name,
          name_mn: item.product.name_mn,
          price: item.product.price,
          images: item.product.images,
        },
      }));

      const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
      if (itemsError) throw itemsError;

      let pi: any = null;
      if (paymentMethod !== "wallet") {
        const { data: piData, error: piErr } = await supabase
          .from("payment_intents")
          .insert({
            user_id: user.id,
            type: "order" as const,
            reference_id: order.id,
            amount: localTotal,
            provider:
              paymentMethod === "omniway"
                ? ("omniway" as const)
                : paymentMethod === "storepay"
                  ? ("storepay" as const)
                  : ("qpay" as const),
            status: "initiated" as const,
          })
          .select()
          .single();
        if (piErr) console.error("Payment intent creation error:", piErr);
        pi = piData;
      }

      return { order, paymentIntentId: pi?.id };
    },
    onSuccess: ({ order, paymentIntentId }) => {
      // Trigger delivery sync (fire-and-forget)
      triggerDeliverySync(order.id);
      
      if (buyNowProductId) {
        removeFromCart(buyNowProductId);
      } else {
        clearLocalCart();
      }
      toast.success("Захиалга амжилттай үүсгэгдлээ!");
      const url = paymentIntentId
        ? `/order-confirmation/${order.id}?pi=${paymentIntentId}`
        : `/order-confirmation/${order.id}`;
      navigate(url);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Захиалга үүсгэхэд алдаа гарлаа");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    createOrderMutation.mutate();
  };

  // District selection: ONLY updates address form, does NOT affect delivery pricing for FREE/FIXED
  const handleZoneChange = (zoneId: string) => {
    const zone = deliveryZones?.find((z) => z.id === zoneId);
    setSelectedZone(zone || null);
    if (zone) {
      setAddressForm((prev) => ({ ...prev, district: zone.name }));
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Determine if we can submit without zone (FREE/FIXED don't need zone)
  const canSubmitWithoutZone = !deliveryResult.zoneAffectsPrice;

  return (
    <div className="container py-8">
      <Link to="/shop" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4" />
        Дэлгүүр рүү буцах
      </Link>

      <h1 className="text-3xl font-bold mb-8">Захиалга баталгаажуулах</h1>

      <form onSubmit={handleSubmit}>
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-start gap-3 p-4 rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-800">
              <Package className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-sm text-green-700 dark:text-green-300">
                  Бэлэн бараа ({localItems.length} бараа)
                </p>
                <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Төлбөр төлөгдсөнөөс хойш <strong>24 цагийн дотор</strong> хүргэгдэнэ
                </p>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  Хүргэлтийн хаяг
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Хот/Аймаг</Label>
                    <Select
                      value={addressForm.city}
                      onValueChange={(value) => {
                        setAddressForm({ ...addressForm, city: value, district: "" });
                        setSelectedZone(null);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Сонгох" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Улаанбаатар">Улаанбаатар</SelectItem>
                        <SelectItem value="Орон нутаг">Орон нутаг</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Дүүрэг/Аймаг</Label>
                    <Select value={selectedZone?.id || ""} onValueChange={handleZoneChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Сонгох" />
                      </SelectTrigger>
                      <SelectContent>
                        {(addressForm.city === "Улаанбаатар" ? ubDistricts : aimags).map((zone) => (
                          <SelectItem key={zone.id} value={zone.id}>
                            {zone.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.district && <p className="text-sm text-destructive">{errors.district}</p>}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="street_address">Дэлгэрэнгүй хаяг (Хаягийн байршлаа тодорхой бичнэ үү...) *</Label>
                  <Textarea
                    id="street_address"
                    value={addressForm.street_address}
                    onChange={(e) => setAddressForm({ ...addressForm, street_address: e.target.value })}
                    placeholder="Хаана байрлалтай, ямар хотхон, хэддүгээр байр, тоот, давхар, орц, орцны код гэх мэт..."
                    rows={2}
                  />
                  {errors.street_address && <p className="text-sm text-destructive">{errors.street_address}</p>}
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="apartment">Орц/Тоот</Label>
                    <Input
                      id="apartment"
                      value={addressForm.apartment}
                      onChange={(e) => setAddressForm({ ...addressForm, apartment: e.target.value })}
                      placeholder="1-р орц, 305 тоот"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Утас *</Label>
                    <Input
                      id="phone"
                      value={addressForm.phone}
                      onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })}
                      placeholder="99001122"
                    />
                    {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Delivery Fee Display */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5 text-primary" />
                  Хүргэлтийн төлбөр
                </CardTitle>
              </CardHeader>
              <CardContent>
                {deliveryResult.resolvedType === "free" ? (
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                    <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                    <div>
                      <p className="font-semibold text-green-700 dark:text-green-300">
                        ✅ Хүргэлт үнэгүй
                      </p>
                      <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                        Энэ барааны хүргэлт үнэгүй
                      </p>
                    </div>
                  </div>
                ) : deliveryResult.resolvedType === "fixed" ? (
                  <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                    <div>
                      <p className="font-medium">Тогтмол хүргэлтийн төлбөр</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Байршлаас үл хамаарч тогтмол үнэтэй
                      </p>
                    </div>
                    <span className="font-bold text-primary text-lg">{deliveryResult.label}</span>
                  </div>
                ) : selectedZone ? (
                  <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                    <div>
                      <p className="font-medium">Энгийн хүргэлт</p>
                      {deliveryDays && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {deliveryDays} хоногт хүргэнэ
                        </p>
                      )}
                    </div>
                    <span className="font-bold text-primary text-lg">{deliveryResult.label}</span>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-4">
                    Дүүрэг/Аймаг сонговол хүргэлтийн төлбөр тодорхойлогдоно
                  </p>
                )}
              </CardContent>
            </Card>

            <PaymentMethodSelector selected={paymentMethod} onSelect={setPaymentMethod} />

            <Card>
              <CardHeader>
                <CardTitle>Нэмэлт тэмдэглэл</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Захиалгын талаар нэмэлт мэдээлэл..."
                  rows={3}
                />
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1">
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5 text-primary" />
                  Захиалгын дүн
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {localItems.map((item) => (
                    <div key={item.product.id} className="flex gap-2">
                      <div className="w-12 h-12 bg-muted rounded-lg overflow-hidden shrink-0">
                        {item.product.images?.[0] ? (
                          <img
                            src={item.product.images[0]}
                            alt={item.product.name_mn}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                            <ShoppingBag className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-xs truncate">{item.product.name_mn}</p>
                        <p className="text-xs text-muted-foreground">{item.quantity} ширхэг</p>
                        <p className="text-xs font-semibold">{formatMntPrice(item.product.price * item.quantity)}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Барааны дүн</span>
                    <span>{formatMntPrice(localSubtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Хүргэлт</span>
                    {deliveryResult.resolvedType === "free" ? (
                      <span className="text-green-600 font-medium">Үнэгүй</span>
                    ) : deliveryResult.resolvedType === "fixed" || selectedZone ? (
                      <span>{formatMntPrice(deliveryFee)}</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </div>
                  <Separator />
                  <div className="flex justify-between font-bold text-lg">
                    <span>Нийт дүн</span>
                    <span className="text-primary">{formatMntPrice(localTotal)}</span>
                  </div>
                </div>

                <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3 text-xs text-green-700 dark:text-green-300">
                  <Clock className="h-3.5 w-3.5 inline mr-1.5" />
                  Төлбөр төлөгдсөнөөс хойш <strong>24 цагийн дотор</strong> хүргэгдэнэ
                </div>

                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  disabled={
                    (!canSubmitWithoutZone && !selectedZone) ||
                    createOrderMutation.isPending
                  }
                >
                  {createOrderMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Захиалга үүсгэж байна...
                    </>
                  ) : (
                    "Захиалга баталгаажуулах"
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}
