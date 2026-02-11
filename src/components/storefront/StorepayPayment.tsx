import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

type PaymentStatus = "idle" | "creating" | "pending" | "paid" | "failed";

export default function StorepayPayment({
  paymentIntentId,
  amount,
  orderNumber,
  onPaymentSuccess,
}: StorepayPaymentProps) {
  const [status, setStatus] = useState<PaymentStatus>("idle");
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

  const checkPaymentStatus = useCallback(async () => {
    try {
      const { data, error: fnError } = await supabase.functions.invoke("storepay", {
        body: { action: "checkPayment", params: { paymentIntentId } },
      });
      if (fnError) throw fnError;

      if (data?.status === "PAID") {
        stopPolling();
        setStatus("paid");
        toast.success("Төлбөр амжилттай төлөгдлөө!");
        onPaymentSuccess?.();
        return;
      }

      pollingCountRef.current += 1;
      if (pollingCountRef.current >= 120) {
        stopPolling();
        setStatus("failed");
        setError("Төлбөр хүлээх хугацаа дууссан. Дахин оролдоно уу.");
      }
    } catch (err) {
      console.error("Storepay payment check error:", err);
    }
  }, [paymentIntentId, stopPolling, onPaymentSuccess]);

  const createLoan = useCallback(async () => {
    setStatus("creating");
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("storepay", {
        body: { action: "createLoan", params: { paymentIntentId } },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      setLoan({
        loanId: data.loanId,
        qrData: data.qrData,
        amount: data.amount,
      });
      setStatus("pending");

      stopPolling();
      pollingRef.current = setInterval(checkPaymentStatus, 5000);
    } catch (err: any) {
      console.error("Storepay create loan error:", err);
      setStatus("failed");
      setError(err.message || "Нэхэмжлэл үүсгэхэд алдаа гарлаа");
      toast.error("Storepay нэхэмжлэл үүсгэхэд алдаа гарлаа");
    }
  }, [paymentIntentId, stopPolling, checkPaymentStatus]);

  const retryPayment = () => {
    setLoan(null);
    createLoan();
  };

  if (status === "paid") {
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

        {status === "idle" && (
          <Button onClick={createLoan} size="lg" className="w-full">
            <QrCode className="h-4 w-4 mr-2" />
            Storepay-аар төлөх
          </Button>
        )}

        {status === "creating" && (
          <div className="flex flex-col items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Нэхэмжлэл үүсгэж байна...</p>
          </div>
        )}

        {status === "failed" && (
          <div className="flex flex-col items-center py-6 space-y-4">
            <XCircle className="h-12 w-12 text-destructive" />
            <p className="text-destructive text-center font-medium">
              {error || "Төлбөр амжилтгүй"}
            </p>
            <Button onClick={retryPayment} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Дахин оролдох
            </Button>
          </div>
        )}

        {status === "pending" && loan && (
          <>
            {/* QR Code - generated from JSON data per Storepay docs */}
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
              <span>Төлбөр хүлээж байна...</span>
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
