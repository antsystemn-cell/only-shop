import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import PaymentMethodSelector, { type PaymentMethod } from "@/components/storefront/PaymentMethodSelector";
import QPayPayment from "@/components/storefront/QPayPayment";
import OmniWayPayment from "@/components/storefront/OmniWayPayment";
import StorepayPayment from "@/components/storefront/StorepayPayment";
import {
  ArrowLeft,
  Wallet as WalletIcon,
  Loader2,
  Plus,
  RefreshCw,
} from "lucide-react";

export default function Wallet() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();

  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("qpay");
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [creatingTopUp, setCreatingTopUp] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  const loadBalance = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const { data } = await supabase
        .from("user_wallets")
        .select("balance")
        .eq("user_id", user.id)
        .maybeSingle();
      setBalance(data?.balance ?? 0);
    } catch (err) {
      console.error("Wallet load error:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) loadBalance();
  }, [user, loadBalance]);

  const handleStartTopUp = async () => {
    const amount = parseFloat(topUpAmount);
    if (!amount || amount < 100) {
      toast.error("Хамгийн бага цэнэглэх дүн: 100₮");
      return;
    }
    if (amount > 10000000) {
      toast.error("Хамгийн их цэнэглэх дүн: 10,000,000₮");
      return;
    }
    if (!user) return;

    setCreatingTopUp(true);
    try {
      // 1. Create wallet_topup record
      const { data: topup, error: topupErr } = await supabase
        .from("wallet_topups")
        .insert({ user_id: user.id, amount, status: "pending" })
        .select()
        .single();
      if (topupErr) throw topupErr;

      // 2. Create payment intent
      const { data: pi, error: piErr } = await supabase
        .from("payment_intents")
        .insert({
          user_id: user.id,
          type: "wallet_topup",
          reference_id: topup.id,
          amount,
          provider: paymentMethod === "omniway" ? "omniway" : paymentMethod === "storepay" ? "storepay" : "qpay",
          status: "initiated",
        })
        .select()
        .single();
      if (piErr) throw piErr;

      setPaymentIntentId(pi.id);
      setShowPayment(true);
    } catch (err: any) {
      console.error("Create topup error:", err);
      toast.error("Цэнэглэлт үүсгэхэд алдаа гарлаа");
    } finally {
      setCreatingTopUp(false);
    }
  };

  const handlePaymentSuccess = () => {
    setShowPayment(false);
    setPaymentIntentId(null);
    setTopUpAmount("");
    loadBalance();
    toast.success("Данс амжилттай цэнэглэгдлээ!");
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-2xl">
      <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4" />
        Нүүр хуудас
      </Link>

      <h1 className="text-3xl font-bold mb-6">Данс / Wallet</h1>

      {/* Balance Card */}
      <Card className="mb-6 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Дансны үлдэгдэл</p>
              <p className="text-4xl font-bold text-primary">
                {Number(balance).toLocaleString()}₮
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={loadBalance}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <div className="p-4 rounded-full bg-primary/10">
                <WalletIcon className="h-8 w-8 text-primary" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top-Up Section */}
      {!showPayment ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Данс цэнэглэх
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Цэнэглэх дүн (₮)</label>
              <Input
                type="number"
                placeholder="Жишээ: 50000"
                value={topUpAmount}
                onChange={(e) => setTopUpAmount(e.target.value)}
                min={100}
                max={10000000}
              />
              <div className="flex gap-2 flex-wrap">
                {[5000, 10000, 50000, 100000].map((amt) => (
                  <Button
                    key={amt}
                    variant="outline"
                    size="sm"
                    onClick={() => setTopUpAmount(String(amt))}
                  >
                    {amt.toLocaleString()}₮
                  </Button>
                ))}
              </div>
            </div>

            <Separator />

            <PaymentMethodSelector
              selected={paymentMethod}
              onSelect={setPaymentMethod}
            />

            <Button
              onClick={handleStartTopUp}
              size="lg"
              className="w-full"
              disabled={!topUpAmount || creatingTopUp || (paymentMethod !== "qpay" && paymentMethod !== "omniway" && paymentMethod !== "storepay")}
            >
              {creatingTopUp ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Үүсгэж байна...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Цэнэглэх - {topUpAmount ? `${Number(topUpAmount).toLocaleString()}₮` : ""}
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <Button
            variant="outline"
            onClick={() => {
              setShowPayment(false);
              setPaymentIntentId(null);
            }}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Буцах
          </Button>

          {paymentIntentId && paymentMethod === "qpay" && (
            <QPayPayment
              paymentIntentId={paymentIntentId}
              amount={parseFloat(topUpAmount)}
              onPaymentSuccess={handlePaymentSuccess}
            />
          )}
          {paymentIntentId && paymentMethod === "omniway" && (
            <OmniWayPayment
              paymentIntentId={paymentIntentId}
              amount={parseFloat(topUpAmount)}
              onPaymentSuccess={handlePaymentSuccess}
            />
          )}
          {paymentIntentId && paymentMethod === "storepay" && (
            <StorepayPayment
              paymentIntentId={paymentIntentId}
              amount={parseFloat(topUpAmount)}
              onPaymentSuccess={handlePaymentSuccess}
            />
          )}
        </div>
      )}
    </div>
  );
}
