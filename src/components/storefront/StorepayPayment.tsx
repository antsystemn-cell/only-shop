import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Loader2,
  QrCode,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Smartphone,
  Clock,
  Phone,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { QRCodeSVG } from "qrcode.react";

interface StorepayPaymentProps {
  paymentIntentId: string;
  amount: number;
  orderNumber?: string;
  onPaymentSuccess?: () => void;
}

interface LoanData {
  loanId: string;
  qrData: string;
  amount: number;
}

interface CreditCheck {
  eligible: boolean;
  possibleAmount: number;
  message?: string;
}

type FlowStep = "phone" | "checking_credit" | "credit_result" | "creating" | "pending" | "paid" | "failed";

export default function StorepayPayment({
  paymentIntentId,
  amount,
  orderNumber,
  onPaymentSuccess,
}: StorepayPaymentProps) {
  const [step, setStep] = useState<FlowStep>("phone");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [creditCheck, setCreditCheck] = useState<CreditCheck | null>(null);
  const [loan, setLoan] = useState<LoanData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingCountRef = useRef(0);
  const isMobile = useIsMobile();

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    pollingCountRef.current = 0;
  }, []);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  // Validate phone
  const validatePhone = (value: string): boolean => {
    const digits = value.replace(/\D/g, "");
    if (!digits) {
      setPhoneError("Утасны дугаараа оруулна уу");
      return false;
    }
    if (digits.length !== 8) {
      setPhoneError("Утасны дугаар 8 оронтой байх ёстой");
      return false;
    }
    setPhoneError(null);
    return true;
  };

  // Check credit eligibility
  const handleCheckCredit = async () => {
    if (!validatePhone(phoneNumber)) return;

    setStep("checking_credit");
    setCreditCheck(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("storepay", {
        body: { action: "checkCredit", params: { mobileNumber: phoneNumber } },
      });
      if (fnError) throw fnError;

      const result: CreditCheck = {
        eligible: data?.eligible ?? false,
        possibleAmount: data?.possibleAmount ?? 0,
        message: data?.message,
      };

      setCreditCheck(result);
      setStep("credit_result");
    } catch (err: any) {
      console.error("Credit check error:", err);
      setCreditCheck({
        eligible: false,
        possibleAmount: 0,
        message: "Storepay зээлийн эрх шалгахад алдаа гарлаа",
      });
      setStep("credit_result");
    }
  };

  // Check payment status (polling)
  const checkPaymentStatus = useCallback(async () => {
    try {
      const { data, error: fnError } = await supabase.functions.invoke("storepay", {
        body: { action: "checkPayment", params: { paymentIntentId } },
      });
      if (fnError) throw fnError;

      if (data?.status === "PAID") {
        stopPolling();
        setStep("paid");
        toast.success("Төлбөр амжилттай төлөгдлөө!");
        onPaymentSuccess?.();
        return;
      }

      pollingCountRef.current += 1;
      if (pollingCountRef.current >= 120) {
        stopPolling();
        setStep("failed");
        setError("Төлбөр хүлээх хугацаа дууссан. Дахин оролдоно уу.");
      }
    } catch (err) {
      console.error("Payment check error:", err);
    }
  }, [paymentIntentId, stopPolling, onPaymentSuccess]);

  // Create loan / invoice
  const handleCreateLoan = async () => {
    if (!creditCheck?.eligible) return;
    if (creditCheck.possibleAmount < amount) return;

    setStep("creating");
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("storepay", {
        body: {
          action: "createLoan",
          params: { paymentIntentId, mobileNumber: phoneNumber },
        },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      setLoan({
        loanId: data.loanId,
        qrData: data.qrData,
        amount: data.amount,
      });
      setStep("pending");

      stopPolling();
      pollingRef.current = setInterval(checkPaymentStatus, 5000);
    } catch (err: any) {
      console.error("Create loan error:", err);
      setStep("failed");
      setError(err.message || "Нэхэмжлэл үүсгэхэд алдаа гарлаа");
      toast.error("Нэхэмжлэл үүсгэхэд алдаа гарлаа");
    }
  };

  const handleRetry = () => {
    setLoan(null);
    setCreditCheck(null);
    setError(null);
    setPhoneNumber("");
    setStep("phone");
  };

  // ========== PAID STATE ==========
  if (step === "paid") {
    return (
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex flex-col items-center py-8">
          <CheckCircle2 className="h-16 w-16 text-primary mb-4" />
          <h3 className="text-xl font-bold text-primary mb-2">Төлбөр амжилттай!</h3>
          <p className="text-2xl font-bold text-primary mt-2">
            {amount.toLocaleString()}₮
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="h-5 w-5 text-primary" />
          Storepay төлбөр
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Amount Display */}
        <div className="text-center p-4 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground">Төлөх дүн</p>
          <p className="text-3xl font-bold text-primary">{amount.toLocaleString()}₮</p>
          {orderNumber && (
            <p className="text-xs text-muted-foreground mt-1">Захиалга: {orderNumber}</p>
          )}
          <Badge variant="secondary" className="mt-2">Зээлээр төлөх</Badge>
        </div>

        {/* ========== STEP 1: PHONE INPUT ========== */}
        {step === "phone" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="storepay-phone" className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Утасны дугаар
              </Label>
              <Input
                id="storepay-phone"
                type="tel"
                inputMode="numeric"
                placeholder="Жишээ: 99112233"
                value={phoneNumber}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 8);
                  setPhoneNumber(val);
                  if (phoneError) setPhoneError(null);
                }}
                maxLength={8}
              />
              {phoneError && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {phoneError}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Storepay апп-д бүртгэлтэй утасны дугаараа оруулна уу
              </p>
            </div>

            <Button
              onClick={handleCheckCredit}
              size="lg"
              className="w-full"
              disabled={phoneNumber.length !== 8}
            >
              <ShieldCheck className="h-4 w-4 mr-2" />
              Зээлийн эрх шалгах
            </Button>
          </div>
        )}

        {/* ========== STEP 2: CHECKING CREDIT ========== */}
        {step === "checking_credit" && (
          <div className="flex flex-col items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Зээлийн эрх шалгаж байна...</p>
            <p className="text-sm text-muted-foreground mt-1">{phoneNumber}</p>
          </div>
        )}

        {/* ========== STEP 3: CREDIT RESULT ========== */}
        {step === "credit_result" && creditCheck && (
          <div className="space-y-4">
            <div className="text-center space-y-2">
              <h4 className="font-semibold text-sm text-muted-foreground">
                Таны худалдан авалтын боломжит эрх
              </h4>

              {creditCheck.eligible && creditCheck.possibleAmount >= amount ? (
                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <CheckCircle2 className="h-8 w-8 text-primary mx-auto mb-2" />
                  <p className="text-sm font-medium text-primary">
                    Та Storepay-ээр худалдан авалт хийх боломжтой
                  </p>
                  <p className="text-lg font-bold text-primary mt-1">
                    Боломжит лимит: {creditCheck.possibleAmount.toLocaleString()}₮
                  </p>
                </div>
              ) : creditCheck.eligible && creditCheck.possibleAmount < amount ? (
                <div className="p-4 rounded-lg bg-destructive/5 border border-destructive/20">
                  <XCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
                  <p className="text-sm font-medium text-destructive">
                    Таны Storepay зээлийн эрх хүрэлцэхгүй байна
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Боломжит лимит: {creditCheck.possibleAmount.toLocaleString()}₮ / Шаардлагатай: {amount.toLocaleString()}₮
                  </p>
                </div>
              ) : (
                <div className="p-4 rounded-lg bg-destructive/5 border border-destructive/20">
                  <XCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
                  <p className="text-sm font-medium text-destructive">
                    {creditCheck.message || "Энэ утасны дугаар Storepay-д бүртгэлгүй байна"}
                  </p>
                </div>
              )}
            </div>

            {creditCheck.eligible && creditCheck.possibleAmount >= amount ? (
              <Button onClick={handleCreateLoan} size="lg" className="w-full">
                <QrCode className="h-4 w-4 mr-2" />
                Нэхэмжлэл үүсгэх
              </Button>
            ) : (
              <Button onClick={handleRetry} variant="outline" className="w-full">
                <RefreshCw className="h-4 w-4 mr-2" />
                Өөр дугаараар оролдох
              </Button>
            )}
          </div>
        )}

        {/* ========== STEP 4: CREATING INVOICE ========== */}
        {step === "creating" && (
          <div className="flex flex-col items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Нэхэмжлэл үүсгэж байна...</p>
          </div>
        )}

        {/* ========== STEP 5: FAILED ========== */}
        {step === "failed" && (
          <div className="flex flex-col items-center py-6 space-y-4">
            <XCircle className="h-12 w-12 text-destructive" />
            <p className="text-destructive text-center font-medium">
              {error || "Төлбөр амжилтгүй"}
            </p>
            <Button onClick={handleRetry} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Дахин оролдох
            </Button>
          </div>
        )}

        {/* ========== STEP 6: PENDING (QR + POLLING) ========== */}
        {step === "pending" && loan && (
          <>
            {/* Success message */}
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 text-center">
              <CheckCircle2 className="h-6 w-6 text-primary mx-auto mb-2" />
              <p className="text-sm font-medium text-primary">
                Таны Storepay-д нэхэмжлэл илгээгдлээ
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Storepay апп руугаа нэвтэрч төлбөрөө баталгаажуулна уу.
              </p>
            </div>

            {/* QR Code */}
            <div className="flex flex-col items-center">
              <div className="bg-white p-4 rounded-xl shadow-sm border">
                <QRCodeSVG
                  value={loan.qrData}
                  size={isMobile ? 200 : 256}
                  level="M"
                />
              </div>
              <p className="text-sm text-muted-foreground mt-3 flex items-center gap-1">
                <Smartphone className="h-4 w-4" />
                Storepay аппаар QR кодыг уншуулна уу
              </p>
            </div>

            <Separator />

            {/* Polling Status */}
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4 animate-pulse" />
              <span>Төлбөр хүлээгдэж байна...</span>
              <Badge variant="outline" className="text-xs">Автомат шалгалт</Badge>
            </div>

            <Button onClick={checkPaymentStatus} variant="outline" size="sm" className="w-full">
              <RefreshCw className="h-4 w-4 mr-2" />
              Төлбөр шалгах
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
