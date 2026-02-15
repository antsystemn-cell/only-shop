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
import { useOtCartSafe } from "@/contexts/OtCartContext";
import { getAnonymousSession } from "@/services/otSession";
import {
  searchDeliveryModesForSession,
  getUserProfileInfoList,
  createUserProfile,
  createOtOrder,
  salesPaymentReserve,
  type OtDeliveryMode,
  type OtUserProfile,
} from "@/services/otApi";
import { PickupPointSelector } from "@/components/storefront/PickupPointSelector";

type CheckoutStep = 1 | 2 | 3 | 4 | 5;

const STEP_LABELS = [
  "Сагс шалгах",
  "Хүргэлт сонгох",
  "Хаяг сонгох",
  "Баталгаажуулах",
  "Дууссан",
];

export default function OtCheckout() {
  const navigate = useNavigate();
  const { items, groups, subtotal, checkBasket, checkingStatus, refreshBasket, itemCount } = useOtCartSafe();
  const [step, setStep] = useState<CheckoutStep>(1);
  const [isProcessing, setIsProcessing] = useState(false);

  // Step 1 — basket checking
  const [checkResult, setCheckResult] = useState<any>(null);
  const [checkError, setCheckError] = useState<string | null>(null);

  // Step 2 — delivery modes
  const [deliveryModes, setDeliveryModes] = useState<OtDeliveryMode[]>([]);
  const [selectedDelivery, setSelectedDelivery] = useState<string>("");
  const [selectedPickupPoint, setSelectedPickupPoint] = useState<string>("");
  const [loadingDelivery, setLoadingDelivery] = useState(false);

  // Step 3 — profiles
  const [profiles, setProfiles] = useState<OtUserProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<string>("");
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [showNewProfile, setShowNewProfile] = useState(false);
  const [newProfile, setNewProfile] = useState({
    fullName: "",
    phone: "",
    address: "",
    zipCode: "",
  });

  // Step 4 — comment
  const [comment, setComment] = useState("");

  const [orderResult, setOrderResult] = useState<any>(null);
  const [paymentReserveLoading, setPaymentReserveLoading] = useState(false);
  const [paymentReserved, setPaymentReserved] = useState(false);

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
      // Pre-validate: ensure basket has items
      if (items.length === 0) {
        setCheckError("Сагс хоосон байна. Бараа нэмнэ үү.");
        return;
      }
      const result = await checkBasket();
      setCheckResult(result);
    } catch (err: any) {
      const msg = err.message || "Сагс шалгахад алдаа гарлаа";
      // Handle ContractViolation specifically
      if (msg.includes("ContractViolation") || msg.includes("Missing parameter")) {
        setCheckError("Сагсанд боломжгүй бараа байна. Дууссан эсвэл устгагдсан барааг сагснаасаа хасаад дахин оролдоно уу.");
      } else {
        setCheckError(msg);
      }
    }
  }, [checkBasket, items.length]);

  useEffect(() => {
    if (step === 1 && !checkResult && !checkingStatus.isRunning) {
      runCheck();
    }
  }, [step]);

  // ─── Step 2: Load Delivery Modes ──────────────────────────

  const loadDeliveryModes = useCallback(async () => {
    try {
      setLoadingDelivery(true);
      const sessionId = await getAnonymousSession();
      const data = await searchDeliveryModesForSession(sessionId);
      const rawItems = data?.Result?.Items;
      const list = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
      setDeliveryModes(list);
      const defaultMode = list.find((m: any) => m.IsDefault);
      if (defaultMode) setSelectedDelivery(defaultMode.Id);
      else if (list.length > 0) setSelectedDelivery(list[0].Id);
    } catch (err: any) {
      toast.error("Хүргэлтийн горим ачаалахад алдаа гарлаа");
    } finally {
      setLoadingDelivery(false);
    }
  }, []);

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
        ${newProfile.zipCode ? `<ZipCode>${newProfile.zipCode}</ZipCode>` : ""}
      </UserProfileInfo>`;
      await createUserProfile(sessionId, xml);
      toast.success("Хаяг амжилттай нэмэгдлээ");
      setShowNewProfile(false);
      setNewProfile({ fullName: "", phone: "", address: "", zipCode: "" });
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
      const sessionId = await getAnonymousSession();
      const result = await createOtOrder(sessionId, {
        deliveryModeId: selectedDelivery || undefined,
        profileId: selectedProfile || undefined,
        comment: comment || undefined,
      });
      setOrderResult(result);
      setStep(5);
      toast.success("Захиалга амжилттай үүсгэгдлээ!");
      refreshBasket();
    } catch (err: any) {
      toast.error(err.message || "Захиалга үүсгэхэд алдаа гарлаа");
    } finally {
      setIsProcessing(false);
    }
  };

  // ─── Step navigation ──────────────────────────────────────

  const goNext = () => {
    if (step === 2 && !loadingDelivery && deliveryModes.length === 0) {
      loadDeliveryModes();
    }
    if (step === 1) {
      loadDeliveryModes();
    }
    if (step === 2) {
      loadProfiles();
    }
    if (step < 5) setStep((s) => (s + 1) as CheckoutStep);
  };

  const goBack = () => {
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
                  <div className="flex flex-col items-center gap-4 py-8">
                    <AlertTriangle className="h-10 w-10 text-destructive" />
                    <p className="text-destructive">{checkError}</p>
                    <Button onClick={runCheck}>Дахин шалгах</Button>
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
                          <div className="w-10 h-10 rounded bg-muted overflow-hidden shrink-0">
                            {item.imageUrl && (
                              <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm line-clamp-1">{item.title}</p>
                          </div>
                          <span className="text-sm font-medium">
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

          {/* ─── Step 2: Delivery Mode ──────────────────────── */}
          {step === 2 && (
            <Card className="animate-fade-in">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5 text-primary" />
                  Хүргэлтийн горим сонгох
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingDelivery ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : deliveryModes.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    Хүргэлтийн горим олдсонгүй. Автоматаар тохируулагдана.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {deliveryModes.map((mode) => (
                      <button
                        key={mode.Id}
                        onClick={() => setSelectedDelivery(mode.Id)}
                        className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                          selectedDelivery === mode.Id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{mode.Name || `Горим #${mode.Id}`}</p>
                            {mode.Description && (
                              <p className="text-sm text-muted-foreground mt-0.5">{mode.Description}</p>
                            )}
                            {mode.EstimatedDays && (
                              <p className="text-xs text-muted-foreground mt-1">
                                ~{mode.EstimatedDays} хоног
                              </p>
                            )}
                          </div>
                          {mode.Price !== undefined && (
                            <Badge variant="secondary">
                              {mode.Currency || "¥"}{mode.Price}
                            </Badge>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Pickup Points */}
                {selectedDelivery && (
                  <div className="mt-4">
                    <Separator className="mb-4" />
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Package className="h-4 w-4 text-primary" />
                      Авах цэг сонгох (заавал биш)
                    </h3>
                    <PickupPointSelector
                      deliveryModeId={selectedDelivery}
                      selectedPointId={selectedPickupPoint}
                      onSelect={setSelectedPickupPoint}
                    />
                  </div>
                )}
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
                            placeholder="Дүүрэг, хороо, байр, тоот..."
                          />
                        </div>
                        <div>
                          <Label>Шуудангийн код</Label>
                          <Input
                            value={newProfile.zipCode}
                            onChange={(e) => setNewProfile((p) => ({ ...p, zipCode: e.target.value }))}
                            placeholder="14200"
                          />
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
                        <div key={item.orderLineId} className="flex justify-between text-sm py-1.5">
                          <span className="line-clamp-1 flex-1 mr-2">{item.title}</span>
                          <span className="shrink-0 font-medium">
                            {item.quantity} × ¥{item.price.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                <Separator />

                {/* Delivery info */}
                {selectedDelivery && deliveryModes.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-1">Хүргэлт</h3>
                    <p className="text-sm text-muted-foreground">
                      {deliveryModes.find((m) => m.Id === selectedDelivery)?.Name || selectedDelivery}
                    </p>
                  </div>
                )}

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
                  <span className="text-primary">¥{subtotal.toFixed(2)}</span>
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

          {/* ─── Step 5: Order Complete ──────────────────────── */}
          {step === 5 && (
            <Card className="animate-fade-in">
              <CardContent className="text-center py-12 space-y-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-2xl font-bold">Захиалга амжилттай!</h2>
                <p className="text-muted-foreground">
                  Таны захиалга амжилттай бүртгэгдлээ. Удахгүй тантай холбогдох болно.
                </p>
                {orderResult?.Result?.OrderId && (
                  <Badge variant="secondary" className="text-base py-1 px-3">
                    Захиалгын дугаар: {orderResult.Result.OrderId}
                  </Badge>
                )}

                {/* Payment Reserve */}
                {orderResult?.Result?.OrderId && !paymentReserved && (
                  <div className="pt-2">
                    <Separator className="mb-4" />
                    <p className="text-sm text-muted-foreground mb-3">
                      Захиалгын төлбөрийг дансны үлдэгдлээс хасах бол:
                    </p>
                    <Button
                      onClick={async () => {
                        setPaymentReserveLoading(true);
                        try {
                          await salesPaymentReserve(orderResult.Result.OrderId, subtotal);
                          setPaymentReserved(true);
                          toast.success("Төлбөр амжилттай хасагдлаа!");
                        } catch (err: any) {
                          toast.error(err.message || "Төлбөр хасахад алдаа гарлаа");
                        } finally {
                          setPaymentReserveLoading(false);
                        }
                      }}
                      disabled={paymentReserveLoading}
                      variant="secondary"
                    >
                      {paymentReserveLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <CreditCard className="h-4 w-4 mr-2" />
                      )}
                      Дансаар төлөх
                    </Button>
                  </div>
                )}
                {paymentReserved && (
                  <div className="flex items-center gap-2 text-primary text-sm pt-2">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Төлбөр амжилттай хасагдсан</span>
                  </div>
                )}

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
