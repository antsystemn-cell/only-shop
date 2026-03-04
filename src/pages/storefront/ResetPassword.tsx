import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, ArrowLeft, CheckCircle } from "lucide-react";
import { z } from "zod";
import onlyLogo from "@/assets/only-logo.png";

const passwordSchema = z.object({
  password: z.string().min(6, { message: "Нууц үг хамгийн багадаа 6 тэмдэгт байх ёстой" }),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Нууц үг таарахгүй байна",
  path: ["confirmPassword"],
});

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isRecovery, setIsRecovery] = useState(false);

  useEffect(() => {
    // Listen for PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
      }
    });

    // Also check hash for type=recovery
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setIsRecovery(true);
    }

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = passwordSchema.safeParse({ password, confirmPassword });
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) errs[err.path[0] as string] = err.message;
      });
      setErrors(errs);
      return;
    }

    setIsLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setIsLoading(false);

    if (error) {
      toast.error("Нууц үг солиход алдаа гарлаа: " + error.message);
      return;
    }

    setIsSuccess(true);
    toast.success("Нууц үг амжилттай солигдлоо!");
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md border-border/50 shadow-xl">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <CheckCircle className="h-16 w-16 text-primary mx-auto" />
            <h2 className="text-xl font-semibold">Нууц үг амжилттай солигдлоо!</h2>
            <p className="text-muted-foreground">Та шинэ нууц үгээрээ нэвтрэх боломжтой.</p>
            <Button onClick={() => navigate("/")} className="w-full">
              Нүүр хуудас руу очих
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link to="/auth" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" />
          Нэвтрэх хуудас руу буцах
        </Link>

        <Card className="border-border/50 shadow-xl">
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center">
              <img src={onlyLogo} alt="Only" className="h-12 w-12" />
            </div>
            <div>
              <CardTitle className="text-2xl">Шинэ нууц үг</CardTitle>
              <CardDescription>Шинэ нууц үгээ оруулна уу</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {!isRecovery ? (
              <div className="text-center space-y-4">
                <p className="text-muted-foreground">
                  Нууц үг сэргээх холбоос хүчингүй эсвэл хугацаа дууссан байна.
                </p>
                <Button variant="outline" onClick={() => navigate("/auth")} className="w-full">
                  Нэвтрэх хуудас руу буцах
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">Шинэ нууц үг</Label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                  />
                  {errors.password && (
                    <p className="text-sm text-destructive">{errors.password}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-new-password">Нууц үг давтах</Label>
                  <Input
                    id="confirm-new-password"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isLoading}
                  />
                  {errors.confirmPassword && (
                    <p className="text-sm text-destructive">{errors.confirmPassword}</p>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Хадгалж байна...
                    </>
                  ) : (
                    "Нууц үг солих"
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
