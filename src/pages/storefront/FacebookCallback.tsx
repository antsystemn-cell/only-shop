import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const REDIRECT_URI = `${window.location.origin}/auth/facebook/callback`;

export default function FacebookCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const hasProcessedRef = useRef(false);

  useEffect(() => {
    if (hasProcessedRef.current) return;
    hasProcessedRef.current = true;

    const code = searchParams.get("code");
    const stateB64 = searchParams.get("state");
    const fbError = searchParams.get("error");

    if (fbError) {
      setError("Facebook нэвтрэлт цуцлагдсан");
      setTimeout(() => navigate("/auth"), 2000);
      return;
    }

    if (!code) {
      setError("Facebook-ээс код ирсэнгүй");
      setTimeout(() => navigate("/auth"), 2000);
      return;
    }

    let returnTo = "/";
    if (stateB64) {
      try {
        const state = JSON.parse(atob(stateB64));
        returnTo = state.return_to || "/";
      } catch {
        // ignore invalid state
      }
    }

    (async () => {
      try {
        const { data, error: fnErr } = await supabase.functions.invoke("facebook-auth", {
          body: {
            action: "exchange-code",
            code,
            redirect_uri: REDIRECT_URI,
          },
        });

        if (fnErr || data?.error) {
          setError(data?.error || "Facebook нэвтрэхэд алдаа гарлаа");
          setTimeout(() => navigate("/auth"), 3000);
          return;
        }

        if (!data?.token_hash) {
          setError("Сессия үүсгэхэд алдаа гарлаа");
          setTimeout(() => navigate("/auth"), 3000);
          return;
        }

        const otpType = data.type === "magiclink" ? "email" : data.type || "email";
        const { error: verifyErr } = await supabase.auth.verifyOtp({
          token_hash: data.token_hash,
          type: otpType,
        });

        if (verifyErr) {
          console.error("OTP verify error:", verifyErr);
          setError(verifyErr.message || "Сессия үүсгэхэд алдаа гарлаа");
          setTimeout(() => navigate("/auth"), 3000);
          return;
        }

        toast.success("Facebook-ээр амжилттай нэвтэрлээ!");
        navigate(returnTo, { replace: true });
      } catch (err: any) {
        console.error("Facebook callback error:", err);
        setError(err?.message || "Алдаа гарлаа. Дахин оролдоно уу.");
        setTimeout(() => navigate("/auth"), 3000);
      }
    })();
  }, [searchParams, navigate]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      {error ? (
        <div className="text-center space-y-2">
          <p className="text-destructive font-medium">{error}</p>
          <p className="text-sm text-muted-foreground">Нэвтрэх хуудас руу шилжиж байна...</p>
        </div>
      ) : (
        <>
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Facebook-ээр нэвтэрж байна...</p>
        </>
      )}
    </div>
  );
}
