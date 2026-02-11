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

interface QPayPaymentProps {
  /** New unified flow: pass paymentIntentId */
  paymentIntentId?: string;
  /** Legacy flow: orderId-based */
  orderId?: string;
  orderNumber?: string;
  amount: number;
  onPaymentSuccess?: () => void;
}

interface InvoiceData {
  invoice_id: string;
  qr_image: string;
  urls: any;
  amount: number;
}

type PaymentStatus = "idle" | "creating" | "pending" | "paid" | "failed";

export default function QPayPayment({
  paymentIntentId,
  orderId,
  orderNumber,
  amount,
  onPaymentSuccess,
}: QPayPaymentProps) {
  const [status, setStatus] = useState<PaymentStatus>("idle");
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingCountRef = useRef(0);

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
      const body = paymentIntentId
        ? { action: "checkPayment", params: { paymentIntentId } }
        : { action: "checkPayment", params: { orderId } };

      const { data, error: fnError } = await supabase.functions.invoke("qpay", { body });
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
      console.error("Payment check error:", err);
    }
  }, [paymentIntentId, orderId, stopPolling, onPaymentSuccess]);

  const createInvoice = useCallback(async () => {
    setStatus("creating");
    setError(null);

    try {
      const body = paymentIntentId
        ? { action: "createInvoice", params: { paymentIntentId } }
        : { action: "createInvoiceByOrder", params: { orderId } };

      const { data, error: fnError } = await supabase.functions.invoke("qpay", { body });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      setInvoice(data);
      setStatus("pending");

      stopPolling();
      pollingRef.current = setInterval(checkPaymentStatus, 5000);
    } catch (err: any) {
      console.error("Create invoice error:", err);
      setStatus("failed");
      setError(err.message || "Нэхэмжлэл үүсгэхэд алдаа гарлаа");
      toast.error("QPay нэхэмжлэл үүсгэхэд алдаа гарлаа");
    }
  }, [paymentIntentId, orderId, stopPolling, checkPaymentStatus]);

  const retryPayment = () => {
    setInvoice(null);
    createInvoice();
  };

  // Extract bank app links
  const bankApps: Array<{ name: string; description: string; logo: string; link: string }> = [];
  if (invoice?.urls) {
    const urlsList = Array.isArray(invoice.urls) ? invoice.urls : [];
    urlsList.forEach((app: any) => {
      bankApps.push({
        name: app.name || app.description || "Bank",
        description: app.description || "",
        logo: app.logo || "",
        link: app.link || "",
      });
    });
  }

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
          QPay төлбөр
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
            QPay-ээр төлөх
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

        {status === "pending" && invoice && (
          <>
            {/* QR Code */}
            {invoice.qr_image && (
              <div className="flex flex-col items-center">
                <div className="bg-white p-4 rounded-xl shadow-sm border">
                  <img
                    src={`data:image/png;base64,${invoice.qr_image}`}
                    alt="QPay QR Code"
                    className="w-64 h-64 mx-auto"
                  />
                </div>
                <p className="text-sm text-muted-foreground mt-3 flex items-center gap-1">
                  <Smartphone className="h-4 w-4" />
                  Банкны аппаар QR кодыг уншуулна уу
                </p>
              </div>
            )}

            <Separator />

            {/* Bank Apps - dynamic from QPay */}
            {bankApps.length > 0 && (
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-primary" />
                  Банкны апп-аар төлөх
                </h4>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-[300px] overflow-y-auto">
                  {bankApps.map((app, index) => (
                    <a
                      key={index}
                      href={app.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-center gap-2 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-center"
                    >
                      {app.logo ? (
                        <img
                          src={app.logo}
                          alt={app.name}
                          className="w-10 h-10 rounded-lg object-contain"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Smartphone className="h-5 w-5 text-primary" />
                        </div>
                      )}
                      <span className="text-xs font-medium leading-tight line-clamp-2">
                        {app.name}
                      </span>
                    </a>
                  ))}
                </div>
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
