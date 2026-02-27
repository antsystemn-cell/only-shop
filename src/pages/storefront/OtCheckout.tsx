import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
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
import { getAnonymousSession } from "@/services/otSession";
import {
  getUserProfileInfoList,
  createUserProfile,
  type OtUserProfile,
} from "@/services/otApi";
import PaymentMethodSelector, { type PaymentMethod } from "@/components/storefront/PaymentMethodSelector";
import QPayPayment from "@/components/storefront/QPayPayment";
import OmniWayPayment from "@/components/storefront/OmniWayPayment";
import StorepayPayment from "@/components/storefront/StorepayPayment";


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
  const { user } = useAuth();
  const { items, groups, subtotal, checkBasket, checkingStatus, refreshBasket, itemCount, removeItem, clearCart } = useOtCartSafe();
  const [step, setStep] = useState<CheckoutStep>(1);
  const [isProcessing, setIsProcessing] = useState(false);

  // Step 1 — basket checking
  const [checkResult, setCheckResult] = useState<any>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [invalidItems, setInvalidItems] = useState<BasketInvalidItem[]>([]);
  const [isRemovingInvalid, setIsRemovingInvalid] = useState(false);

  // Step 2 — delivery type (custom, not OTAPI)
  const [deliveryType, setDeliveryType] = useState<"delivery" | "pickup">("delivery");

  // Step 3 — profiles
  const [profiles, setProfiles] = useState<OtUserProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<string>("");
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [showNewProfile, setShowNewProfile] = useState(false);
  const [newProfile, setNewProfile] = useState({
    fullName: "",
    phone: "",
    address: "",
  });

  // Step 4 — comment
  const [comment, setComment] = useState("");

  const [orderResult, setOrderResult] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("qpay");
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [paymentPaid, setPaymentPaid] = useState(false);

  // Redirect if cart is empty
  useEffect(() => {
    if (items.length === 0 && step === 1) {
      navigate("/ot");
    }
  }, [items.length, step, navigate]);

  // ─── Step 1: Basket Checking ──────────────────────────────

  const runCheck = useCallback(async () => {
    try {
      setCheckError(null);
      setInvalidItems([]);
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
        setInvalidItems(resultInvalid);
        setCheckError(`Сагсанд ${resultInvalid.length} боломжгүй бараа байна`);
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
        setCheckError("Сагс шалгалт удааширлаа. Дахин оролдоно уу.");
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

  const loadProfiles = useCallback(async () => {
    try {
      setLoadingProfiles(true);
      const sessionId = await getAnonymousSession();
      const data = await getUserProfileInfoList(sessionId);
      const rawItems = data?.Result?.Items;
      const list = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
      setProfiles(list);
      if (list.length > 0) setSelectedProfile(list[0].Id);
    } catch (err: any) {
      console.error("Profiles load error:", err);
    } finally {
      setLoadingProfiles(false);
    }
  }, []);

  const handleCreateProfile = async () => {
    if (!newProfile.fullName || !newProfile.phone || !newProfile.address) {
      toast.error("Бүх талбарыг бөглөнө үү");
      return;
    }
    try {
      setIsProcessing(true);
      const sessionId = await getAnonymousSession();
      const xml = `<UserProfileInfo>
        <FullName>${newProfile.fullName}</FullName>
        <Phone>${newProfile.phone}</Phone>
        <Address>${newProfile.address}</Address>
      </UserProfileInfo>`;
      await createUserProfile(sessionId, xml);
      toast.success("Хаяг амжилттай нэмэгдлээ");
      setShowNewProfile(false);
      setNewProfile({ fullName: "", phone: "", address: "" });
      await loadProfiles();
    } catch (err: any) {
      toast.error(err.message || "Хаяг нэмэхэд алдаа гарлаа");
    } finally {
      setIsProcessing(false);
    }
  };

  // ─── Step 5: Create Order ─────────────────────────────────

  const handleCreateOrder = async () => {
    try {
      setIsProcessing(true);

      if (items.length === 0) {
        toast.error("Сагс хоосон байна. Бараа нэмнэ үү.");
        return;
      }

      // Build delivery address from selected profile
      const selectedProfileData = profiles.find(p => p.Id === selectedProfile);
      const deliveryAddress = selectedProfileData ? {
        fullName: selectedProfileData.FullName,
        phone: selectedProfileData.Phone,
        address: selectedProfileData.Address,
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

      // Clear the OTAPI basket after successful order
      await clearCart();
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
        // Skip address step, go straight to confirmation (step 4)
        loadProfiles(); // still load in background in case needed
        setStep(4);
        return;
      }
      // delivery selected → load profiles for address step
      loadProfiles();
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
        return checkingStatus.isComplete || checkResult;
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
                      <p className="text-sm">{checkError}</p>
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
                    <div className="flex gap-2 justify-center">
                      <Button onClick={runCheck} disabled={checkingStatus.isRunning}>Дахин шалгах</Button>
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
                  <Dialog open={showNewProfile} onOpenChange={setShowNewProfile}>
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
                          <Label>Нэр *</Label>
                          <Input
                            value={newProfile.fullName}
                            onChange={(e) => setNewProfile((p) => ({ ...p, fullName: e.target.value }))}
                            placeholder="Баатар Болд"
                          />
                        </div>
                        <div>
                          <Label>Утас *</Label>
                          <Input
                            value={newProfile.phone}
                            onChange={(e) => setNewProfile((p) => ({ ...p, phone: e.target.value }))}
                            placeholder="+976 9999 9999"
                          />
                        </div>
                        <div>
                          <Label>Хаяг *</Label>
                          <Textarea
                            value={newProfile.address}
                            onChange={(e) => setNewProfile((p) => ({ ...p, address: e.target.value }))}
                            placeholder="Жишээ: БЗД, 25-р хороо, Нуур ХТ 15-205 тоот, орцны код: 1234"
                            rows={3}
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Хаягаа маш тодорхой дэлгэрэнгүй тайлбарлаж бичнэ үү, хэрэв орц тань кодтой бол кодоо мөн бичнэ үү.
                          </p>
                        </div>
                        <Button onClick={handleCreateProfile} disabled={isProcessing} className="w-full">
                          {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                          Хаяг нэмэх
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingProfiles ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : profiles.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    Хаяг байхгүй байна. "Шинэ хаяг" товч дарж нэмнэ үү, эсвэл алгасаарай.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {profiles.map((profile) => (
                      <button
                        key={profile.Id}
                        onClick={() => setSelectedProfile(profile.Id)}
                        className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                          selectedProfile === profile.Id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <p className="font-medium">{profile.FullName || "Нэргүй"}</p>
                        {profile.Address && (
                          <p className="text-sm text-muted-foreground mt-0.5">{profile.Address}</p>
                        )}
                        {profile.Phone && (
                          <p className="text-sm text-muted-foreground">{profile.Phone}</p>
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

                {/* Profile info */}
                {selectedProfile && profiles.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-1">Хаяг</h3>
                    {(() => {
                      const p = profiles.find((pr) => pr.Id === selectedProfile);
                      return p ? (
                        <p className="text-sm text-muted-foreground">
                          {p.FullName} — {p.Address} {p.Phone && `(${p.Phone})`}
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
                  onClick={handleCreateOrder}
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
                    <div className="flex gap-3 justify-center pt-4">
                      <Link to="/ot/orders">
                        <Button>Захиалгууд харах</Button>
                      </Link>
                      <Link to="/ot">
                        <Button variant="outline">Маркетплэйс руу буцах</Button>
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
                          .update({ status: "processing" })
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
                          .update({ status: "processing" })
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
                          .update({ status: "processing" })
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
    </div>
  );
}
