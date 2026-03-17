import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Lock, Loader2, User, AtSign } from "lucide-react";
import onlyLogo from "@/assets/only-logo.png";
import { FacebookSignInButton } from "@/components/storefront/FacebookSignInButton";

const MN_PHONE_REGEX = /^[89]\d{7}$/;

function detectIdentifierType(value: string): "phone" | "email" | "unknown" {
  const trimmed = value.trim().replace(/[\s\-\+\(\)]/g, "");
  if (/^976\d{8}$/.test(trimmed)) return "phone";
  if (MN_PHONE_REGEX.test(trimmed)) return "phone";
  if (value.includes("@")) return "email";
  if (/^\d+$/.test(trimmed) && trimmed.length >= 8) return "phone";
  return "unknown";
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/[\s\-\+\(\)]/g, "");
  if (/^976\d{8}$/.test(digits)) return digits.slice(3);
  return digits;
}

export default function AdminLogin() {
  const [isSignup, setIsSignup] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ identifier?: string; password?: string; fullName?: string }>({});
  const navigate = useNavigate();
  const { toast } = useToast();

  const identifierType = detectIdentifierType(identifier);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .eq("role", "admin")
          .single();
        if (roleData) navigate("/admin");
      }
    };
    checkSession();
  }, [navigate]);

  const resolveEmail = async (): Promise<string | null> => {
    if (identifierType === "email") return identifier.trim();
    if (identifierType === "phone") {
      const phone = normalizePhone(identifier);
      try {
        const { data, error } = await supabase.functions.invoke("phone-auth", {
          body: { action: "resolve-phone", phone },
        });
        if (error || data?.error) {
          toast({ title: "Алдаа", description: data?.error || "Утасны дугаартай бүртгэл олдсонгүй", variant: "destructive" });
          return null;
        }
        return data.email;
      } catch {
        toast({ title: "Алдаа", description: "Сервертэй холбогдох үед алдаа гарлаа", variant: "destructive" });
        return null;
      }
    }
    setErrors({ identifier: "Зөв утасны дугаар эсвэл имэйл оруулна уу" });
    return null;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!identifier.trim()) {
      setErrors({ identifier: "Утасны дугаар эсвэл имэйл оруулна уу" });
      return;
    }
    if (password.length < 6) {
      setErrors({ password: "Нууц үг хамгийн багадаа 6 тэмдэгт байх ёстой" });
      return;
    }

    setIsLoading(true);
    try {
      const email = await resolveEmail();
      if (!email) return;

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast({
          title: "Нэвтрэх амжилтгүй",
          description: error.message.includes("Invalid login") ? "Нэвтрэх мэдээлэл буруу байна" : error.message,
          variant: "destructive",
        });
        return;
      }
      if (data.user) {
        const { data: roleData, error: roleError } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", data.user.id)
          .eq("role", "admin")
          .single();
        if (roleError || !roleData) {
          await supabase.auth.signOut();
          toast({ title: "Хандах эрхгүй", description: "Та админ эрхгүй байна.", variant: "destructive" });
          return;
        }
        toast({ title: "Амжилттай нэвтэрлээ", description: "Админ самбарт тавтай морил!" });
        navigate("/admin");
      }
    } catch {
      toast({ title: "Алдаа", description: "Сервертэй холбогдох үед алдаа гарлаа", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const emailVal = identifier.trim();
    if (!emailVal || !emailVal.includes("@")) {
      setErrors({ identifier: "Зөв имэйл хаяг оруулна уу" });
      return;
    }
    if (password.length < 6) {
      setErrors({ password: "Нууц үг хамгийн багадаа 6 тэмдэгт байх ёстой" });
      return;
    }
    if (fullName.length < 2) {
      setErrors({ fullName: "Нэрээ оруулна уу" });
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: emailVal,
        password,
        options: { emailRedirectTo: `${window.location.origin}/admin`, data: { full_name: fullName } },
      });
      if (error) {
        toast({
          title: "Алдаа",
          description: error.message.includes("already registered") ? "Энэ имэйлээр бүртгэл үүссэн байна" : error.message,
          variant: "destructive",
        });
        return;
      }
      if (data.user) {
        toast({ title: "Бүртгэл амжилттай", description: "Админ эрх авахын тулд админтай холбогдоно уу." });
        setIsSignup(false);
        setPassword("");
      }
    } catch {
      toast({ title: "Алдаа", description: "Сервертэй холбогдох үед алдаа гарлаа", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center gradient-hero p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      </div>
      
      <Card className="w-full max-w-md glass-card animate-scale-in relative z-10">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto">
            <img src={onlyLogo} alt="Only Logo" className="h-16 w-auto mx-auto" />
          </div>
          <div>
            <CardTitle className="text-2xl">Only Admin</CardTitle>
            <CardDescription className="mt-2">
              {isSignup ? "Шинэ бүртгэл үүсгэх" : "Админ самбарт нэвтрэх"}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={isSignup ? handleSignup : handleLogin} className="space-y-4">
            {isSignup && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Бүтэн нэр</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Таны нэр"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className={`pl-10 ${errors.fullName ? "border-destructive" : ""}`}
                    disabled={isLoading}
                  />
                </div>
                {errors.fullName && <p className="text-sm text-destructive">{errors.fullName}</p>}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="identifier">
                {isSignup ? "Имэйл" : "Утасны дугаар эсвэл имэйл"}
              </Label>
              <div className="relative">
                <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="identifier"
                  type="text"
                  placeholder={isSignup ? "admin@only.mn" : "99112233 эсвэл admin@only.mn"}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className={`pl-10 ${errors.identifier ? "border-destructive" : ""}`}
                  disabled={isLoading}
                />
              </div>
              {!isSignup && identifier.trim() && identifierType !== "unknown" && (
                <p className="text-xs text-muted-foreground">
                  {identifierType === "phone" ? "📱 Утасны дугаараар нэвтрэнэ" : "📧 Имэйлээр нэвтрэнэ"}
                </p>
              )}
              {errors.identifier && <p className="text-sm text-destructive">{errors.identifier}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Нууц үг</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`pl-10 pr-10 ${errors.password ? "border-destructive" : ""}`}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{isSignup ? "Бүртгэж байна..." : "Нэвтэрж байна..."}</>
              ) : (
                isSignup ? "Бүртгүүлэх" : "Нэвтрэх"
              )}
            </Button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Эсвэл</span>
              </div>
            </div>

            <FacebookSignInButton />

            <div className="text-center mt-4">
              <button
                type="button"
                onClick={() => { setIsSignup(!isSignup); setErrors({}); }}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                {isSignup ? "Бүртгэлтэй юу? Нэвтрэх" : "Бүртгэлгүй юу? Бүртгүүлэх"}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
