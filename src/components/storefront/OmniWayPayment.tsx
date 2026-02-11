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

interface OmniWayPaymentProps {
  paymentIntentId: string;
  amount: number;
  orderNumber?: string;
  onPaymentSuccess?: () => void;
}

interface InvoiceData {
  invoiceNumber: string;
  qr_image: string | null; // base64 with data:image/png;base64,... prefix
  qr_content: string | null; // deeplink
  amount: number;
}

type PaymentStatus = "idle" | "creating" | "pending" | "paid" | "failed" | "cancelled";

export default function OmniWayPayment({
  paymentIntentId,
  amount,
  orderNumber,
  onPaymentSuccess,
}: OmniWayPaymentProps) {
  const [status, setStatus] = useState<PaymentStatus>("idle");
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
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
      const { data, error: fnError } = await supabase.functions.invoke("omniway", {
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

      if (data?.status === "CANCELLED") {
        stopPolling();
        setStatus("cancelled");
        setError("Нэхэмжлэх цуцлагдсан байна.");
        return;
      }

      pollingCountRef.current += 1;
      // 24h expiry, but we poll for 10 min max then slow down
      if (pollingCountRef.current >= 120) {
        stopPolling();
        setStatus("failed");
        setError("Төлбөр хүлээх хугацаа дууссан. Дахин оролдоно уу.");
      }
    } catch (err) {
      console.error("OmniWay payment check error:", err);
    }
  }, [paymentIntentId, stopPolling, onPaymentSuccess]);

  const createInvoice = useCallback(async () => {
    setStatus("creating");
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("omniway", {
        body: { action: "createInvoice", params: { paymentIntentId } },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      setInvoice(data);
      setStatus("pending");

      // On mobile, auto-open deeplink
      if (isMobile && data.qr_content) {
        window.location.href = data.qr_content;
      }

      stopPolling();
      pollingRef.current = setInterval(checkPaymentStatus, 5000);
    } catch (err: any) {
      console.error("OmniWay create invoice error:", err);
      setStatus("failed");
      setError(err.message || "Нэхэмжлэл үүсгэхэд алдаа гарлаа");
      toast.error("OmniWay нэхэмжлэл үүсгэхэд алдаа гарлаа");
    }
  }, [paymentIntentId, stopPolling, checkPaymentStatus, isMobile]);

  const retryPayment = () => {
    setInvoice(null);
    createInvoice();
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
          OmniWay төлбөр
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
        </div>

        {status === "idle" && (
          <Button onClick={createInvoice} size="lg" className="w-full">
            <QrCode className="h-4 w-4 mr-2" />
            OmniWay-аар төлөх
          </Button>
        )}

        {status === "creating" && (
          <div className="flex flex-col items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Нэхэмжлэл үүсгэж байна...</p>
          </div>
        )}

        {(status === "failed" || status === "cancelled") && (
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

        {status === "pending" && invoice && (
          <>
            {/* QR Code - Desktop */}
            {!isMobile && invoice.qr_image && (
              <div className="flex flex-col items-center">
                <div className="bg-white p-4 rounded-xl shadow-sm border">
                  <img
                    src={invoice.qr_image}
                    alt="OmniWay QR Code"
                    className="w-64 h-64 mx-auto"
                  />
                </div>
                <p className="text-sm text-muted-foreground mt-3 flex items-center gap-1">
                  <Smartphone className="h-4 w-4" />
                  OmniWay аппаар QR кодыг уншуулна уу
                </p>
              </div>
            )}

            {/* Mobile deeplink */}
            {isMobile && invoice.qr_content && (
              <div className="flex flex-col items-center gap-3">
                <a
                  href={invoice.qr_content}
                  className="w-full"
                >
                  <Button size="lg" className="w-full">
                    <Smartphone className="h-4 w-4 mr-2" />
                    OmniWay апп-аар нээх
                  </Button>
                </a>
                <p className="text-xs text-muted-foreground text-center">
                  Апп суулгаагүй бол эхлээд суулгана уу
                </p>
              </div>
            )}

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
