import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Wallet, CheckCircle2, Loader2, AlertTriangle } from "lucide-react";

interface WalletPaymentProps {
  amount: number;
  orderId: string;
  onPaymentSuccess?: () => void;
}

export default function WalletPayment({ amount, orderId, onPaymentSuccess }: WalletPaymentProps) {
  const { user } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_wallets")
      .select("balance")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setBalance(data?.balance ?? 0);
        setLoading(false);
      });
  }, [user]);

  const handlePay = async () => {
    if (!user || balance === null) return;
    if (balance < amount) {
      toast.error("Хэтэвчний үлдэгдэл хүрэлцэхгүй байна");
      return;
    }

    setPaying(true);
    try {
      // Deduct from wallet (negative credit)
      const { error: rpcErr } = await supabase.rpc("credit_wallet", {
        p_user_id: user.id,
        p_amount: -amount,
      });
      if (rpcErr) throw rpcErr;

      setPaid(true);
      setBalance((b) => (b !== null ? b - amount : 0));
      toast.success("Хэтэвчнээс амжилттай төлөгдлөө!");
      onPaymentSuccess?.();
    } catch (err: any) {
      toast.error(err.message || "Төлбөр төлөхөд алдаа гарлаа");
    } finally {
      setPaying(false);
    }
  };

  if (paid) {
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

  const insufficient = balance !== null && balance < amount;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" />
          Хэтэвчнээс төлөх
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center p-4 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground">Төлөх дүн</p>
          <p className="text-3xl font-bold text-primary">{amount.toLocaleString()}₮</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center p-3 rounded-lg border">
              <span className="text-sm text-muted-foreground">Хэтэвчний үлдэгдэл:</span>
              <span className={`font-bold ${insufficient ? "text-destructive" : "text-primary"}`}>
                {(balance ?? 0).toLocaleString()}₮
              </span>
            </div>

            {insufficient && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Үлдэгдэл хүрэлцэхгүй байна. Хэтэвчээ цэнэглэнэ үү.</span>
              </div>
            )}

            <Button
              size="lg"
              className="w-full"
              onClick={handlePay}
              disabled={paying || insufficient}
            >
              {paying ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Төлж байна...</>
              ) : (
                <><Wallet className="h-4 w-4 mr-2" /> Хэтэвчнээс төлөх</>
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
