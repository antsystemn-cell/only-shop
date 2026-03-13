import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import {
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Truck,
  MapPin,
  ShoppingBag,
  ArrowLeft,
  ArrowRight,
  Plus,
  Package,
  CreditCard,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useOtCartSafe, type OtBasketItem, type BasketInvalidItem } from "@/contexts/OtCartContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import PaymentMethodSelector, { type PaymentMethod } from "@/components/storefront/PaymentMethodSelector";
import QPayPayment from "@/components/storefront/QPayPayment";
import OmniWayPayment from "@/components/storefront/OmniWayPayment";
import StorepayPayment from "@/components/storefront/StorepayPayment";
import WalletPayment from "@/components/storefront/WalletPayment";


type CheckoutStep = 1 | 2 | 3 | 4 | 5;

const STEP_LABELS = [
  "Сагс шалгах",
  "Хүргэлт сонгох",
  "Хаяг сонгох",
  "Баталгаажуулах",
  "Төлбөр төлөх",
];

export default function OtCheckout() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { items: allItems, groups: allGroups, subtotal: allSubtotal, checkBasket, checkingStatus, refreshBasket, itemCount: allItemCount, removeItem, clearCart } = useOtCartSafe();
  
  // Buy Now mode: only process the single item matching the buyNow itemId
  const buyNowItemId = searchParams.get("buyNow");
  const items = buyNowItemId
    ? allItems.filter(i => i.itemId === buyNowItemId)
    : allItems;
  const subtotal = buyNowItemId
    ? items.reduce((sum, i) => sum + (i.totalPrice || i.price * i.quantity), 0)
    : allSubtotal;
  const itemCount = buyNowItemId
    ? items.reduce((sum, i) => sum + i.quantity, 0)
    : allItemCount;
  const groups = buyNowItemId
    ? allGroups.map(g => ({ ...g, items: g.items.filter(i => i.itemId === buyNowItemId) })).filter(g => g.items.length > 0)
    : allGroups;
  
  const [step, setStep] = useState<CheckoutStep>(1);
  const [isProcessing, setIsProcessing] = useState(false);

  // Step 1 — basket checking
  const [checkResult, setCheckResult] = useState<any>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [invalidItems, setInvalidItems] = useState<BasketInvalidItem[]>([]);
  const [priceChangedItems, setPriceChangedItems] = useState<BasketInvalidItem[]>([]);
  const [isRemovingInvalid, setIsRemovingInvalid] = useState(false);

  // Step 2 — delivery type (custom, not OTAPI)
  const [deliveryType, setDeliveryType] = useState<"delivery" | "pickup">("delivery");

  // Step 3 — local addresses from user_addresses table
  interface LocalAddress {
    id: string;
    label: string | null;
    street_address: string;
    district: string | null;
    city: string;
    phone: string | null;
  }
  const [addresses, setAddresses] = useState<LocalAddress[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<string>("");
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [showNewAddress, setShowNewAddress] = useState(false);
  const [newAddress, setNewAddress] = useState({
    label: "",
    phone: "",
    address: "",
  });

  // Step 4 — comment
  const [comment, setComment] = useState("");

  // Guest phone dialog
  const [showGuestPhoneDialog, setShowGuestPhoneDialog] = useState(false);
  const [guestPhone, setGuestPhone] = useState("");

  const [orderResult, setOrderResult] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("qpay");
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [paymentPaid, setPaymentPaid] = useState(false);

  // Handle ?pay=orderId — jump directly to payment step
  useEffect(() => {
    const payOrderId = searchParams.get("pay");
    if (!payOrderId || !user) return;
    (async () => {
      const { data, error } = await supabase
        .from("ot_orders")
        .select("*")
        .eq("id", payOrderId)
        .eq("user_id", user.id)
        .eq("status", "pending")
        .single();
      if (error || !data) {
        toast.error("Захиалга олдсонгүй эсвэл төлбөр аль хэдийн төлөгдсөн.");
        navigate("/ot/orders");
        return;
      }
      setOrderResult(data);
      setStep(5);
    })();
  }, [searchParams, user]);

  // Redirect if cart is empty (only when not in pay mode)
  useEffect(() => {
    const payOrderId = searchParams.get("pay");
    if (!payOrderId && items.length === 0 && step === 1) {
      navigate("/ot");
    }
  }, [items.length, step, navigate, searchParams]);

  // ─── Step 1: Basket Checking ──────────────────────────────

  const runCheck = useCallback(async () => {
    try {
      setCheckError(null);
      setInvalidItems([]);
      setPriceChangedItems([]);
      setCheckResult(null);

      if (items.length === 0) {
        setCheckError("Сагс хоосон байна. Бараа нэмнэ үү.");
        return;
      }

      console.log("[OtCheckout] Running basket check...");
      const result = await checkBasket();

      // Check if checkBasket returned invalid items
      const resultInvalid = result?._invalidItems as BasketInvalidItem[] | undefined;
      if (resultInvalid && resultInvalid.length > 0) {
        // Separate price-changed items from truly invalid items
        const priceChanged = resultInvalid.filter(i => i.isPriceChanged);
        const trulyInvalid = resultInvalid.filter(i => !i.isPriceChanged);

        if (trulyInvalid.length > 0) {
          setInvalidItems(trulyInvalid);
          setCheckError(`Сагсанд ${trulyInvalid.length} боломжгүй бараа байна`);
        }
        if (priceChanged.length > 0) {
          setPriceChangedItems(priceChanged);
          // If only price changes (no truly invalid), don't set error - show dialog instead
          if (trulyInvalid.length === 0) {
            setCheckResult(result); // still mark as "checked"
          }
        }
        if (trulyInvalid.length === 0 && priceChanged.length === 0) {
          setCheckResult(result);
        }
        return;
      }

      // Success
      setCheckResult(result);
      console.log("[OtCheckout] Basket check passed");
    } catch (err: any) {
      const msg = err.message || "";
      if (msg === "EMPTY_BASKET") {
        setCheckError("Сагс хоосон байна. Бараа нэмнэ үү.");
      } else if (msg === "CHECK_TIMEOUT") {
        setCheckError("TIMEOUT");
      } else if (msg.includes("SessionExpired")) {
        setCheckError("Сессийн хугацаа дууссан. Дахин оролдоно уу.");
      } else if (msg === "BASKET_CHECK_NO_ACTIVITY_ID") {
        setCheckError("Сагс шалгалт эхлүүлж чадсангүй (ID олдсонгүй). Дахин оролдоно уу.");
      } else if (msg.includes("NotFound") || msg.includes("not found")) {
        setCheckError("Сагс шалгалтын хүсэлт хугацаа дууссан. Дахин шалгаж байна…");
      } else if (msg.includes("ContractViolation")) {
        setCheckError("Техникийн алдаа гарлаа. Сагсаа шинэчилж дахин оролдоно уу.");
        await refreshBasket();
      } else {
        setCheckError(msg || "Сагс шалгахад алдаа гарлаа");
      }
    }
  }, [checkBasket, items, refreshBasket]);

  const handleRemoveInvalidAndRecheck = useCallback(async () => {
    if (invalidItems.length === 0) return;
    setIsRemovingInvalid(true);
    try {
      const removedTitles: string[] = [];
      for (const inv of invalidItems) {
        const matchingItem = items.find(i => i.orderLineId === inv.elementId);
        if (matchingItem) removedTitles.push(matchingItem.title);
        try {
          await removeItem(inv.elementId);
        } catch (e) {
          console.warn("[OtCheckout] Failed to remove item:", inv.elementId, e);
        }
      }
      await refreshBasket();
      if (removedTitles.length > 0) {
        toast.info(`${removedTitles.length} боломжгүй бараа хасагдлаа`);
      }
      setInvalidItems([]);
      setCheckError(null);
      // Re-run check
      setTimeout(() => runCheck(), 1000);
    } catch (err: any) {
      toast.error("Бараа хасахад алдаа гарлаа");
    } finally {
      setIsRemovingInvalid(false);
    }
  }, [invalidItems, items, removeItem, refreshBasket, runCheck]);

  useEffect(() => {
    if (step === 1 && !checkResult && !checkingStatus.isRunning) {
      runCheck();
    }
  }, [step]);

  // Step 2 is now static — no OTAPI call needed

  // ─── Step 3: Load Profiles ────────────────────────────────

  const loadAddresses = useCallback(async () => {
    if (!user) return;
    try {
      setLoadingAddresses(true);
      const { data, error } = await supabase
        .from("user_addresses")
        .select("id, label, street_address, district, city, phone")
        .eq("user_id", user.id)
        .order("is_default", { ascending: false });
      if (error) throw error;
      setAddresses(data || []);
      if (data && data.length > 0) setSelectedAddress(data[0].id);
    } catch (err: any) {
      console.error("Addresses load error:", err);
    } finally {
      setLoadingAddresses(false);
    }
  }, [user]);

  const handleCreateAddress = async () => {
    if (!newAddress.phone || !newAddress.address) {
      toast.error("Утас болон хаягаа бөглөнө үү");
      return;
    }
    if (newAddress.phone.length !== 8 || !/^\d{8}$/.test(newAddress.phone)) {
      toast.error("Утасны дугаар 8 оронтой байх ёстой");
      return;
    }
    if (!user) {
      toast.error("Нэвтэрсэн байх шаардлагатай");
      return;
    }
    try {
      setIsProcessing(true);
      const { error } = await supabase
        .from("user_addresses")
        .insert({
          user_id: user.id,
          label: newAddress.label || null,
          street_address: newAddress.address,
          city: "Улаанбаатар",
          phone: newAddress.phone,
        });
      if (error) throw error;
      toast.success("Хаяг амжилттай нэмэгдлээ");
      setShowNewAddress(false);
      setNewAddress({ label: "", phone: "", address: "" });
      await loadAddresses();
    } catch (err: any) {
      toast.error(err.message || "Хаяг нэмэхэд алдаа гарлаа");
    } finally {
      setIsProcessing(false);
    }
  };

  // ─── Step 5: Create Order ─────────────────────────────────

  const handleCreateOrder = async (overrideGuestPhone?: string) => {
    try {
      setIsProcessing(true);

      // If guest user and no phone provided, show dialog
      if (!user && !overrideGuestPhone && !guestPhone) {
        setShowGuestPhoneDialog(true);
        setIsProcessing(false);
        return;
      }

      const effectiveGuestPhone = overrideGuestPhone || guestPhone;

      if (items.length === 0) {
        toast.error("Сагс хоосон байна. Бараа нэмнэ үү.");
        return;
      }

      // Build delivery address from selected local address
      const selectedAddr = addresses.find(a => a.id === selectedAddress);
      const deliveryAddress = selectedAddr ? {
        phone: selectedAddr.phone,
        address: selectedAddr.street_address,
        district: selectedAddr.district,
        city: selectedAddr.city,
        label: selectedAddr.label,
      } : !user && effectiveGuestPhone ? {
        guest_phone: effectiveGuestPhone,
      } : null;

      // Build items snapshot
      const itemsSnapshot = items.map(item => ({
        itemId: item.itemId,
        orderLineId: item.orderLineId,
        title: item.title,
        imageUrl: item.imageUrl,
        quantity: item.quantity,
        price: item.price,
        totalPrice: item.totalPrice,
        currency: item.currency,
        providerType: item.providerType,
        vendorName: item.vendorName,
        configurators: item.configurators,
        originalCnyPrice: item.originalCnyPrice,
        originalCnyCurrency: item.originalCnyCurrency,
        externalUrl: item.providerType === "Poizon"
          ? `https://www.dewu.com/product-detail.html?productId=${item.itemId}`
          : `https://item.taobao.com/item.htm?id=${item.itemId}`,
      }));

      const commentText = comment
        ? `[${deliveryType === "delivery" ? "Хүргэлт" : "Өөрөө авна"}] ${comment}`
        : `[${deliveryType === "delivery" ? "Хүргэлт" : "Өөрөө авна"}]`;

      // Save order to local database
      const { data: newOrder, error } = await supabase
        .from("ot_orders")
        .insert({
          user_id: user?.id || null,
          order_number: "", // auto-generated by trigger
          status: "pending",
          delivery_type: deliveryType,
          delivery_address: deliveryAddress,
          comment: commentText,
          items: itemsSnapshot,
          item_count: itemCount,
          subtotal: Math.round(subtotal),
        })
        .select()
        .single();

      if (error) throw new Error(error.message);

      // Create payment intent
      if (user?.id) {
        const { data: pi, error: piErr } = await supabase
          .from("payment_intents")
          .insert({
            user_id: user.id,
            type: "order" as const,
            reference_id: newOrder.id,
            amount: Math.round(subtotal),
            provider: paymentMethod === "omniway" ? ("omniway" as const) : paymentMethod === "storepay" ? ("storepay" as const) : ("qpay" as const),
            status: "initiated" as const,
          })
          .select()
          .single();

        if (!piErr && pi) {
          setPaymentIntentId(pi.id);
        }
      }

      setOrderResult(newOrder);
      setStep(5);
      toast.success("Захиалга амжилттай үүслээ! Төлбөрөө төлнө үү.");

      // Clear cart: if buyNow mode, only remove the specific items; otherwise clear all
      if (buyNowItemId) {
        for (const item of items) {
          try { await removeItem(item.orderLineId); } catch {}
        }
      } else {
        await clearCart();
      }
    } catch (err: any) {
      toast.error(err.message || "Захиалга үүсгэхэд алдаа гарлаа");
    } finally {
      setIsProcessing(false);
    }
  };

  // ─── Step navigation ──────────────────────────────────────

  const goNext = () => {
    if (step === 1) {
      // Moving to step 2 (delivery type selection)
    }
    if (step === 2) {
      if (deliveryType === "pickup") {
        setStep(4);
        return;
      }
      // delivery selected → load local addresses
      loadAddresses();
    }
    if (step < 5) setStep((s) => (s + 1) as CheckoutStep);
  };

  const goBack = () => {
    if (step === 4 && deliveryType === "pickup") {
      // Skip address step back to delivery selection
      setStep(2);
      return;
    }
    if (step > 1) setStep((s) => (s - 1) as CheckoutStep);
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return (checkingStatus.isComplete || checkResult) && priceChangedItems.length === 0;
      case 2:
        return true; // delivery optional
      case 3:
        return true; // profile optional
      case 4:
        return !isProcessing;
      default:
        return false;
    }
  };

  const handleAcceptPriceChanges = useCallback(() => {
    setPriceChangedItems([]);
    // Price accepted — basket check is already marked complete, allow proceeding
    toast.success("Үнийн өөрчлөлт зөвшөөрөгдлөө");
  }, []);

  const handleRejectPriceChanges = useCallback(() => {
    setPriceChangedItems([]);
    setCheckResult(null);
    navigate("/ot");
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container py-4 flex items-center gap-4">
          <Link to="/ot">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold">Захиалга өгөх</h1>
        </div>
      </div>

      {/* Step Progress */}
      <div className="container py-6">
        <div className="flex items-center justify-between mb-8 max-w-2xl mx-auto">
          {STEP_LABELS.map((label, i) => {
            const stepNum = i + 1;
            const isActive = step === stepNum;
            const isDone = step > stepNum;
            return (
              <div key={i} className="flex flex-col items-center gap-1.5 flex-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                    isDone
                      ? "bg-primary text-primary-foreground"
                      : isActive
                      ? "bg-primary text-primary-foreground animate-pulse-glow"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isDone ? <CheckCircle2 className="h-4 w-4" /> : stepNum}
                </div>
                <span
                  className={`text-xs text-center hidden sm:block ${
                    isActive ? "font-semibold text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>

        <div className="max-w-2xl mx-auto space-y-6">
          {/* ─── Step 1: Basket Checking ────────────────────── */}
          {step === 1 && (
            <Card className="animate-fade-in">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5 text-primary" />
                  Сагс шалгаж байна
                </CardTitle>
              </CardHeader>
              <CardContent>
                {checkingStatus.isRunning ? (
                  <div className="flex flex-col items-center gap-4 py-8">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="text-muted-foreground">Барааны бэлэн байдлыг шалгаж байна...</p>
                  </div>
                ) : checkError ? (
                  <div className="space-y-4 py-4">
                    <div className="flex items-center gap-2 text-destructive">
                      <AlertTriangle className="h-5 w-5 shrink-0" />
                      <p className="text-sm">
                        {checkError === "TIMEOUT"
                          ? "Сагс шалгалт удааширлаа. Дахин оролдох эсвэл шалгалтыг алгасаж үргэлжлүүлэх боломжтой."
                          : checkError}
                      </p>
                    </div>
                    {/* Show invalid items so user can identify and remove them */}
                    {invalidItems.length > 0 && (
                      <div className="space-y-2 border border-destructive/30 rounded-lg p-3">
                        <p className="text-xs font-semibold text-destructive">Боломжгүй бараанууд:</p>
                        {invalidItems.map((inv) => {
                          const matchingItem = items.find(i => i.orderLineId === inv.elementId);
                          return (
                            <div key={inv.elementId} className="flex items-center gap-3 py-1.5">
                              <div className="w-8 h-8 rounded bg-muted overflow-hidden shrink-0">
                                {matchingItem?.imageUrl && <img src={matchingItem.imageUrl} alt="" className="w-full h-full object-cover" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="text-xs line-clamp-1 text-destructive">{inv.title || matchingItem?.title || inv.itemId}</span>
                                <span className="text-[10px] text-muted-foreground block">{inv.reasonText}</span>
                              </div>
                            </div>
                          );
                        })}
                        <Button
                          size="sm"
                          variant="destructive"
                          className="w-full mt-2"
                          disabled={isRemovingInvalid}
                          onClick={handleRemoveInvalidAndRecheck}
                        >
                          {isRemovingInvalid ? (
                            <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Хасаж байна...</>
                          ) : (
                            "Боломжгүй барааг устгаад дахин шалгах"
                          )}
                        </Button>
                      </div>
                    )}
                    <div className="flex gap-2 justify-center flex-wrap">
                      <Button onClick={runCheck} disabled={checkingStatus.isRunning}>Дахин шалгах</Button>
                      {checkError === "TIMEOUT" && (
                        <Button
                          variant="default"
                          onClick={() => {
                            setCheckError(null);
                            setCheckResult({ _skipped: true });
                          }}
                        >
                          Шалгалтыг алгасаад үргэлжлүүлэх
                        </Button>
                      )}
                      <Button variant="outline" onClick={() => navigate("/ot")}>Сагс руу буцах</Button>
                    </div>
                  </div>
                ) : checkResult ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-primary">
                      <CheckCircle2 className="h-5 w-5" />
                      <span className="font-medium">Бараанууд шалгагдсан</span>
                    </div>
                    {/* Show basket items summary */}
                    <div className="space-y-2">
                      {items.map((item) => (
                        <div key={item.orderLineId} className="flex items-center gap-3 py-2">
                          <div className="w-12 h-12 rounded-md bg-muted overflow-hidden shrink-0">
                            {item.imageUrl && (
                              <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm line-clamp-1 font-medium">{item.title}</p>
                            {item.configurators && (
                              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{item.configurators}</p>
                            )}
                          </div>
                          <span className="text-sm font-medium shrink-0">
                            {item.quantity} × {new Intl.NumberFormat("mn-MN").format(Math.round(item.price))}₮
                          </span>
                        </div>
                      ))}
                    </div>
                    <Separator />
                    <div className="flex justify-between font-semibold">
                      <span>Нийт ({itemCount} ширхэг):</span>
                       <span className="text-primary">{new Intl.NumberFormat("mn-MN").format(Math.round(subtotal))}₮</span>
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          )}

          {/* Price Change Confirmation Dialog */}
          <Dialog open={priceChangedItems.length > 0} onOpenChange={(open) => { if (!open) handleRejectPriceChanges(); }}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  Барааны үнэ өөрчлөгдсөн
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Таны сонгосон барааны үнэ өөрчлөгдсөн байна. Та энэ үнийг хүлээн зөвшөөрч байна уу?
                </p>
                <div className="space-y-2 border rounded-lg p-3 bg-muted/30">
                  {priceChangedItems.map((item) => {
                    const matchingItem = items.find(i => i.orderLineId === item.elementId);
                    return (
                      <div key={item.elementId} className="flex items-center gap-3 py-1.5">
                        <div className="w-10 h-10 rounded bg-muted overflow-hidden shrink-0">
                          {matchingItem?.imageUrl && <img src={matchingItem.imageUrl} alt="" className="w-full h-full object-cover" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm line-clamp-1 font-medium">{matchingItem?.title || item.title || item.itemId}</p>
                          <p className="text-xs text-amber-600">{item.reasonText}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-3">
                  <Button className="flex-1" onClick={handleAcceptPriceChanges}>
                    Тийм
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={handleRejectPriceChanges}>
                    Үгүй
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* ─── Step 2: Delivery Type ──────────────────────── */}
          {step === 2 && (
            <Card className="animate-fade-in">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5 text-primary" />
                  Хүргэлт сонгох
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <button
                  onClick={() => setDeliveryType("delivery")}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                    deliveryType === "delivery"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Truck className={`h-6 w-6 shrink-0 ${deliveryType === "delivery" ? "text-primary" : "text-muted-foreground"}`} />
                    <div>
                      <p className="font-medium">Захиалга ирэхээр хүргэлтээр авна</p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Таны зааж өгсөн хаяг руу хүргэлт хийнэ
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setDeliveryType("pickup")}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                    deliveryType === "pickup"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Package className={`h-6 w-6 shrink-0 ${deliveryType === "pickup" ? "text-primary" : "text-muted-foreground"}`} />
                    <div>
                      <p className="font-medium">Захиалга ирэхээр өөрөө очиж авна</p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Агуулахаас өөрөө ирж авна
                      </p>
                    </div>
                  </div>
                </button>
              </CardContent>
            </Card>
          )}

          {/* ─── Step 3: Delivery Profile ───────────────────── */}
          {step === 3 && (
            <Card className="animate-fade-in">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    Хүргэлтийн хаяг
                  </span>
                  <Dialog open={showNewAddress} onOpenChange={setShowNewAddress}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Plus className="h-4 w-4 mr-1" />
                        Шинэ хаяг
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Шинэ хаяг нэмэх</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 pt-2">
                        <div>
                          <Label>Хаягийн нэр (заавал биш)</Label>
                          <Input
                            value={newAddress.label}
                            onChange={(e) => setNewAddress((p) => ({ ...p, label: e.target.value }))}
                            placeholder="Жишээ: Гэр, Оффис"
                          />
                        </div>
                        <div>
                          <Label>Утасны дугаар *</Label>
                          <Input
                            value={newAddress.phone}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, "").slice(0, 8);
                              setNewAddress((p) => ({ ...p, phone: val }));
                            }}
                            placeholder="99119911"
                            maxLength={8}
                            inputMode="numeric"
                          />
                          <p className="text-xs text-muted-foreground mt-1">8 оронтой утасны дугаар</p>
                        </div>
                        <div>
                          <Label>Хаяг *</Label>
                          <Textarea
                            value={newAddress.address}
                            onChange={(e) => setNewAddress((p) => ({ ...p, address: e.target.value }))}
                            placeholder="Жишээ: БЗД, 25-р хороо, Нуур ХТ 15-205 тоот, орцны код: 1234"
                            rows={3}
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Хаягаа маш тодорхой дэлгэрэнгүй тайлбарлаж бичнэ үү, хэрэв орц тань кодтой бол кодоо мөн бичнэ үү.
                          </p>
                        </div>
                        <Button onClick={handleCreateAddress} disabled={isProcessing} className="w-full">
                          {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                          Хаяг нэмэх
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingAddresses ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : addresses.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    Хаяг байхгүй байна. "Шинэ хаяг" товч дарж нэмнэ үү.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {addresses.map((addr) => (
                      <button
                        key={addr.id}
                        onClick={() => setSelectedAddress(addr.id)}
                        className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                          selectedAddress === addr.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        {addr.label && <p className="text-xs font-semibold text-primary mb-0.5">{addr.label}</p>}
                        <p className="text-sm">{addr.street_address}</p>
                        {addr.phone && (
                          <p className="text-sm text-muted-foreground mt-0.5">{addr.phone}</p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ─── Step 4: Order Summary & Confirm ────────────── */}
          {step === 4 && (
            <Card className="animate-fade-in">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  Захиалга баталгаажуулах
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Items */}
                <div>
                  <h3 className="text-sm font-semibold mb-2">Бараанууд ({itemCount})</h3>
                  {groups.map((group) => (
                    <div key={group.providerType} className="mb-3">
                      <Badge variant="outline" className="mb-2">{group.providerType}</Badge>
                      {group.items.map((item) => (
                        <div key={item.orderLineId} className="flex items-center gap-3 py-2">
                          <div className="w-12 h-12 rounded-md bg-muted overflow-hidden shrink-0">
                            {item.imageUrl && (
                              <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm line-clamp-1 font-medium">{item.title}</p>
                            {item.configurators && (
                              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{item.configurators}</p>
                            )}
                          </div>
                          <span className="shrink-0 text-sm font-medium">
                            {item.quantity} × {new Intl.NumberFormat("mn-MN").format(Math.round(item.price))}₮
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                <Separator />

                {/* Delivery info */}
                <div>
                  <h3 className="text-sm font-semibold mb-1">Хүргэлт</h3>
                  <p className="text-sm text-muted-foreground">
                    {deliveryType === "delivery" ? "Хүргэлтээр авна" : "Өөрөө очиж авна"}
                  </p>
                </div>

                {/* Address info */}
                {selectedAddress && addresses.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-1">Хаяг</h3>
                    {(() => {
                      const a = addresses.find((addr) => addr.id === selectedAddress);
                      return a ? (
                        <p className="text-sm text-muted-foreground">
                          {a.street_address} {a.phone && `(${a.phone})`}
                        </p>
                      ) : null;
                    })()}
                  </div>
                )}

                <Separator />

                {/* Comment */}
                <div>
                  <Label>Тэмдэглэл (заавал биш)</Label>
                  <Textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Нэмэлт тайлбар..."
                    className="mt-1"
                  />
                </div>

                <Separator />

                <div className="flex justify-between text-lg font-bold">
                  <span>Нийт дүн:</span>
                  <span className="text-primary">{new Intl.NumberFormat("mn-MN").format(Math.round(subtotal))}₮</span>
                </div>

                <Button
                  size="lg"
                  className="w-full mt-4"
                  onClick={() => handleCreateOrder()}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Захиалга үүсгэж байна...
                    </>
                  ) : (
                    "Захиалга баталгаажуулах"
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* ─── Step 5: Payment ──────────────────────────── */}
          {step === 5 && (
            <div className="space-y-6 animate-fade-in">
              {/* Order created banner */}
              <Card>
                <CardContent className="py-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold">Захиалга амжилттай үүслээ</h2>
                      {orderResult?.order_number && (
                        <p className="text-sm text-muted-foreground">
                          Захиалгын дугаар: <span className="font-mono font-semibold">{orderResult.order_number}</span>
                        </p>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-3">
                    Төлбөрөө төлсний дараа таны захиалга баталгаажна.
                  </p>
                  <Separator className="my-4" />
                  <div className="flex justify-between font-bold text-lg">
                    <span>Төлөх дүн:</span>
                    <span className="text-primary">{new Intl.NumberFormat("mn-MN").format(Math.round(orderResult?.subtotal || subtotal))}₮</span>
                  </div>
                </CardContent>
              </Card>

              {/* Payment completed state */}
              {paymentPaid ? (
                <Card>
                  <CardContent className="text-center py-12 space-y-4">
                    <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                    </div>
                    <h2 className="text-2xl font-bold">Төлбөр амжилттай!</h2>
                    <p className="text-muted-foreground">
                      Таны захиалга баталгаажлаа. Удахгүй тантай холбогдох болно.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4 w-full px-4">
                      <Link to="/ot/orders" className="w-full sm:w-auto">
                        <Button className="w-full sm:w-auto">Захиалгууд харах</Button>
                      </Link>
                      <Link to="/" className="w-full sm:w-auto">
                        <Button variant="outline" className="w-full sm:w-auto">Дэлгүүр рүү буцах</Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Payment method selector */}
                  <PaymentMethodSelector
                    selected={paymentMethod}
                    onSelect={setPaymentMethod}
                  />

                  {/* Payment component based on selected method */}
                  {paymentMethod === "qpay" && orderResult?.id && (
                    <QPayPayment
                      paymentIntentId={paymentIntentId || undefined}
                      orderId={orderResult.id}
                      orderNumber={orderResult.order_number}
                      amount={Math.round(orderResult.subtotal || subtotal)}
                      onPaymentSuccess={async () => {
                        setPaymentPaid(true);
                        await supabase
                          .from("ot_orders")
                          .update({ status: "paid" })
                          .eq("id", orderResult.id);
                      }}
                    />
                  )}

                  {paymentMethod === "omniway" && paymentIntentId && (
                    <OmniWayPayment
                      paymentIntentId={paymentIntentId}
                      amount={Math.round(orderResult?.subtotal || subtotal)}
                      onPaymentSuccess={async () => {
                        setPaymentPaid(true);
                        await supabase
                          .from("ot_orders")
                          .update({ status: "paid" })
                          .eq("id", orderResult.id);
                      }}
                    />
                  )}

                  {paymentMethod === "storepay" && paymentIntentId && (
                    <StorepayPayment
                      paymentIntentId={paymentIntentId}
                      amount={Math.round(orderResult?.subtotal || subtotal)}
                      onPaymentSuccess={async () => {
                        setPaymentPaid(true);
                        await supabase
                          .from("ot_orders")
                          .update({ status: "paid" })
                          .eq("id", orderResult.id);
                      }}
                    />
                  )}

                  {/* Wallet payment */}
                  {paymentMethod === "wallet" && orderResult?.id && (
                    <WalletPayment
                      amount={Math.round(orderResult.subtotal || subtotal)}
                      orderId={orderResult.id}
                      onPaymentSuccess={async () => {
                        setPaymentPaid(true);
                        await supabase
                          .from("ot_orders")
                          .update({ status: "paid" })
                          .eq("id", orderResult.id);
                      }}
                    />
                  )}
                </>
              )}
            </div>
          )}

          {/* ─── Navigation Buttons ──────────────────────────── */}
          {step < 5 && (
            <div className="flex justify-between">
              <Button variant="outline" onClick={goBack} disabled={step === 1}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Өмнөх
              </Button>
              {step < 4 ? (
                <Button onClick={goNext} disabled={!canProceed()}>
                  Дараах
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* Guest Phone Dialog */}
      <Dialog open={showGuestPhoneDialog} onOpenChange={setShowGuestPhoneDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Утасны дугаар оруулна уу</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Захиалгын мэдэгдэл хүлээн авахын тулд утасны дугаараа оруулна уу.
          </p>
          <Input
            placeholder="Утасны дугаар (8 оронтой)"
            value={guestPhone}
            onChange={(e) => setGuestPhone(e.target.value.replace(/\D/g, "").slice(0, 8))}
            maxLength={8}
            type="tel"
          />
          <Button
            className="w-full"
            disabled={guestPhone.length !== 8}
            onClick={() => {
              setShowGuestPhoneDialog(false);
              handleCreateOrder(guestPhone);
            }}
          >
            Баталгаажуулах
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
