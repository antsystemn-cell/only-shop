import { useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const REDIRECT_URI = `${window.location.origin}/auth/facebook/callback`;

export function FacebookSignInButton() {
  const [isLoading, setIsLoading] = useState(false);
  const location = useLocation();

  const handleFacebookSignIn = async () => {
    setIsLoading(true);
    try {
      const returnTo = (location.state as any)?.from || "/";

      const { data, error } = await supabase.functions.invoke("facebook-auth", {
        body: {
          action: "get-login-url",
          redirect_uri: REDIRECT_URI,
          return_to: returnTo,
        },
      });

      if (error || data?.error) {
        toast.error("Facebook нэвтрэлт эхлүүлэхэд алдаа гарлаа");
        console.error("Facebook login URL error:", error || data?.error);
        return;
      }

      if (data?.url) {
        // Use window.top to break out of iframe (Lovable preview), fallback to window
        const target = window.top || window;
        target.location.href = data.url;
      }
    } catch (err) {
      toast.error("Facebook нэвтрэлт эхлүүлэхэд алдаа гарлаа");
      console.error("Facebook sign-in error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      className="w-full gap-2"
      onClick={handleFacebookSignIn}
      disabled={isLoading}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="#1877F2">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      )}
      Facebook-ээр нэвтрэх
    </Button>
  );
}
