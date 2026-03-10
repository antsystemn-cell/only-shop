import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Phone, Mail, ChevronDown, Eye, EyeOff } from "lucide-react";
import { z } from "zod";
import onlyLogo from "@/assets/only-logo.png";

// ── Validation ──────────────────────────────────────────────
function isPhoneNumber(val: string): boolean {
  const digits = val.replace(/[\s\-\+\(\)]/g, "");
  if (/^976\d{8}$/.test(digits)) return true;
  if (/^[89]\d{7}$/.test(digits)) return true;
  return false;
}

function normalizePhone(val: string): string {
  const digits = val.replace(/[\s\-\+\(\)]/g, "");
  if (/^976\d{8}$/.test(digits)) return digits.slice(3);
  if (/^\d{8}$/.test(digits)) return digits;
  return digits;
}

function isEmail(val: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
}

// ── Auth settings type ──────────────────────────────────────
interface AuthSettings {
  phone_registration_enabled?: boolean | string;
  email_registration_enabled?: boolean | string;
  phone_primary_enabled?: boolean | string;
  phone_otp_login_enabled?: boolean | string;
  phone_registration_otp_required?: boolean | string;
  otp_length?: number | string;
  otp_expiry_seconds?: number | string;
  otp_resend_cooldown_seconds?: number | string;
}

function isTruthy(val: any): boolean {
  return val === true || val === "true";
}

// ══════════════════════════════════════════════════════════════
// MAIN AUTH COMPONENT
// ══════════════════════════════════════════════════════════════
export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signIn, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState("login");
  const [authSettings, setAuthSettings] = useState<AuthSettings>({});
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Load auth settings
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from("admin_settings")
          .select("setting_key, setting_value")
          .eq("category", "auth");
        const s: Record<string, any> = {};
        for (const row of data || []) {
          try {
            s[row.setting_key] = JSON.parse(String(row.setting_value));
          } catch {
            s[row.setting_key] = row.setting_value;
          }
        }
        setAuthSettings(s);
      } catch {
        // defaults
      } finally {
        setSettingsLoaded(true);
      }
    })();
  }, []);

  // Redirect if logged in
  useEffect(() => {
    if (user && !authLoading) {
      const from = (location.state as any)?.from || "/";
      navigate(from);
    }
  }, [user, authLoading, navigate, location.state]);

  if (authLoading || !settingsLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Нүүр хуудас руу буцах
        </Link>

        <Card className="border-border/50 shadow-xl">
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center">
              <img src={onlyLogo} alt="Only" className="h-12 w-12" />
            </div>
            <div>
              <CardTitle className="text-2xl">Тавтай морил</CardTitle>
              <CardDescription>Only дэлгүүрт нэвтрэх</CardDescription>
            </div>
          </CardHeader>

          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">Нэвтрэх</TabsTrigger>
                <TabsTrigger value="signup">Бүртгүүлэх</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <LoginForm authSettings={authSettings} signIn={signIn} />
              </TabsContent>

              <TabsContent value="signup">
                <RegisterForm
                  authSettings={authSettings}
                  onSuccess={() => setActiveTab("login")}
                />
              </TabsContent>
            </Tabs>
          </CardContent>

          <CardFooter className="flex justify-center text-sm text-muted-foreground">
            <p>
              Бүртгүүлснээр та манай{" "}
              <Link to="/page/terms_of_use" className="text-primary hover:underline">
                үйлчилгээний нөхцөл
              </Link>
              -ийг зөвшөөрч байна.
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// LOGIN FORM
// ══════════════════════════════════════════════════════════════
function LoginForm({
  authSettings,
  signIn,
}: {
  authSettings: AuthSettings;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
}) {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotIdentifier, setForgotIdentifier] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  // Phone reset OTP state
  const [resetOtpStep, setResetOtpStep] = useState(false);
  const [resetOtpCode, setResetOtpCode] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [resetPasswordStep, setResetPasswordStep] = useState(false);
  const [resetOtpCooldown, setResetOtpCooldown] = useState(0);
  const [resetSuccess, setResetSuccess] = useState(false);

  // OTP state
  const [otpStep, setOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);

  const identifierIsPhone = isPhoneNumber(identifier);
  const identifierIsEmail = isEmail(identifier);
  const otpLoginEnabled = isTruthy(authSettings.phone_otp_login_enabled);

  // Cooldown timer
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const t = setTimeout(() => setOtpCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [otpCooldown]);

  // ── Password login ─────────────────────────────────────────
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!identifier.trim()) {
      setError("Утасны дугаар эсвэл имэйл оруулна уу");
      return;
    }
    if (!password) {
      setError("Нууц үг оруулна уу");
      return;
    }

    setIsLoading(true);

    try {
      let email = identifier.trim();

      // If phone number, resolve to email first
      if (identifierIsPhone) {
        const { data, error: fnErr } = await supabase.functions.invoke("phone-auth", {
          body: { action: "resolve-phone", phone: identifier },
        });
        if (fnErr || data?.error) {
          setError(data?.error || "Утасны дугаартай бүртгэл олдсонгүй");
          setIsLoading(false);
          return;
        }
        email = data.email;
      }

      const { error: signInErr } = await signIn(email, password);
      if (signInErr) {
        if (signInErr.message.includes("Invalid login credentials")) {
          setError("Нэвтрэх мэдээлэл буруу байна");
        } else if (signInErr.message.includes("Email not confirmed")) {
          setError("Имэйлээ баталгаажуулна уу");
        } else {
          setError(signInErr.message);
        }
        return;
      }

      toast.success("Амжилттай нэвтэрлээ!");
      navigate("/");
    } catch {
      setError("Алдаа гарлаа");
    } finally {
      setIsLoading(false);
    }
  };

  // ── OTP flow ──────────────────────────────────────────────
  const handleSendOtp = async () => {
    if (!identifierIsPhone) return;
    setOtpSending(true);
    setError("");

    try {
      const { data, error: fnErr } = await supabase.functions.invoke("phone-auth", {
        body: { action: "send-otp", phone: identifier, purpose: "login" },
      });
      if (fnErr || data?.error) {
        setError(data?.error || "OTP илгээхэд алдаа гарлаа");
        if (data?.cooldown_remaining) setOtpCooldown(data.cooldown_remaining);
        return;
      }
      setOtpStep(true);
      setOtpCooldown(data.cooldown || 60);
      toast.success("OTP код илгээгдлээ");
    } catch {
      setError("Алдаа гарлаа");
    } finally {
      setOtpSending(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode || otpCode.length < 4) {
      setError("OTP код оруулна уу");
      return;
    }
    setIsLoading(true);
    setError("");

    try {
      const { data, error: fnErr } = await supabase.functions.invoke("phone-auth", {
        body: {
          action: "verify-otp",
          phone: identifier,
          code: otpCode,
          purpose: "login",
        },
      });

      if (fnErr || data?.error) {
        setError(data?.error || "OTP баталгаажуулахад алдаа гарлаа");
        setIsLoading(false);
        return;
      }

      if (data.token_hash && data.email) {
        // Use the magic link token to sign in
        const { error: verifyErr } = await supabase.auth.verifyOtp({
          token_hash: data.token_hash,
          type: "magiclink",
        });
        if (verifyErr) {
          setError("Сессия үүсгэхэд алдаа гарлаа");
          setIsLoading(false);
          return;
        }
        toast.success("Амжилттай нэвтэрлээ!");
        navigate("/");
      }
    } catch {
      setError("Алдаа гарлаа");
    } finally {
      setIsLoading(false);
    }
  };

  // ── Forgot password ───────────────────────────────────────
  if (showForgotPassword) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-center">Нууц үг сэргээх</h3>
        <p className="text-sm text-muted-foreground text-center">
          Бүртгэлтэй имэйл хаягаа оруулна уу.
        </p>
        {forgotSent ? (
          <div className="text-center space-y-3 py-4">
            <p className="text-sm text-primary font-medium">
              ✓ Нууц үг сэргээх холбоос илгээгдлээ!
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setShowForgotPassword(false);
                setForgotSent(false);
              }}
            >
              Буцах
            </Button>
          </div>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!forgotEmail.trim()) {
                toast.error("Имэйл хаягаа оруулна уу");
                return;
              }
              setIsLoading(true);
              const { error } = await supabase.auth.resetPasswordForEmail(
                forgotEmail.trim(),
                { redirectTo: `${window.location.origin}/reset-password` }
              );
              setIsLoading(false);
              if (error) {
                toast.error(error.message);
                return;
              }
              setForgotSent(true);
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Имэйл</Label>
              <Input
                type="email"
                placeholder="example@email.com"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Холбоос илгээх
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => setShowForgotPassword(false)}
            >
              Буцах
            </Button>
          </form>
        )}
      </div>
    );
  }

  // ── OTP step ──────────────────────────────────────────────
  if (otpStep) {
    const otpLen = parseInt(String(authSettings.otp_length)) || 4;
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="text-center space-y-2">
          <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Phone className="h-7 w-7 text-primary" />
          </div>
          <h3 className="text-lg font-semibold">Код баталгаажуулах</h3>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium">{identifier}</span> дугаар руу илгээсэн кодыг оруулна уу
          </p>
        </div>

        <div className="flex justify-center">
          <InputOTP
            maxLength={otpLen}
            value={otpCode}
            onChange={setOtpCode}
          >
            <InputOTPGroup>
              {Array.from({ length: otpLen }).map((_, i) => (
                <InputOTPSlot key={i} index={i} />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>

        {error && (
          <p className="text-sm text-destructive text-center">{error}</p>
        )}

        <Button
          className="w-full"
          onClick={handleVerifyOtp}
          disabled={isLoading || otpCode.length < otpLen}
        >
          {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Баталгаажуулах
        </Button>

        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setOtpStep(false);
              setOtpCode("");
              setError("");
            }}
          >
            ← Буцах
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSendOtp}
            disabled={otpCooldown > 0 || otpSending}
          >
            {otpCooldown > 0 ? `Дахин авах (${otpCooldown}с)` : "Дахин код авах"}
          </Button>
        </div>
      </div>
    );
  }

  // ── Main login form ───────────────────────────────────────
  return (
    <form onSubmit={handlePasswordLogin} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="login-id">Утасны дугаар эсвэл И-мэйл</Label>
        <div className="relative">
          <Input
            id="login-id"
            type="text"
            placeholder={
              isTruthy(authSettings.phone_primary_enabled)
                ? "99112233 эсвэл email@example.com"
                : "email@example.com эсвэл 99112233"
            }
            value={identifier}
            onChange={(e) => {
              setIdentifier(e.target.value);
              setError("");
            }}
            disabled={isLoading}
            className="pr-10"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {identifierIsPhone ? (
              <Phone className="h-4 w-4 text-primary" />
            ) : identifierIsEmail ? (
              <Mail className="h-4 w-4 text-primary" />
            ) : null}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="login-pw">Нууц үг</Label>
        <div className="relative">
          <Input
            id="login-pw"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError("");
            }}
            disabled={isLoading}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Нэвтрэх
      </Button>

      {/* OTP login option — only for phone and when enabled */}
      {otpLoginEnabled && identifierIsPhone && (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={handleSendOtp}
          disabled={otpSending}
        >
          {otpSending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          OTP кодоор нэвтрэх
        </Button>
      )}

      <div className="text-center">
        <button
          type="button"
          onClick={() => setShowForgotPassword(true)}
          className="text-sm text-primary hover:underline"
        >
          Нууц үгээ мартсан уу?
        </button>
      </div>
    </form>
  );
}

// ══════════════════════════════════════════════════════════════
// REGISTER FORM
// ══════════════════════════════════════════════════════════════
function RegisterForm({
  authSettings,
  onSuccess,
}: {
  authSettings: AuthSettings;
  onSuccess: () => void;
}) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // OTP verification for registration
  const [otpStep, setOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);

  const otpRequired = isTruthy(authSettings.phone_registration_otp_required);
  const otpLen = parseInt(String(authSettings.otp_length)) || 4;

  useEffect(() => {
    if (otpCooldown <= 0) return;
    const t = setTimeout(() => setOtpCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [otpCooldown]);

  const validate = (): string | null => {
    const p = normalizePhone(phone);
    if (!p || !/^[89]\d{7}$/.test(p)) return "Утасны дугаар буруу байна";
    if (password.length < 6) return "Нууц үг хамгийн багадаа 6 тэмдэгт";
    if (password !== confirmPassword) return "Нууц үг таарахгүй байна";
    if (showEmail && email && !isEmail(email)) return "Имэйл хаяг буруу байна";
    return null;
  };

  // ── Send registration OTP ─────────────────────────────────
  const handleSendOtp = async () => {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setOtpSending(true);
    setError("");
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("phone-auth", {
        body: { action: "send-otp", phone, purpose: "register" },
      });
      if (fnErr || data?.error) {
        setError(data?.error || "OTP илгээхэд алдаа гарлаа");
        if (data?.cooldown_remaining) setOtpCooldown(data.cooldown_remaining);
        return;
      }
      setOtpStep(true);
      setOtpCooldown(data.cooldown || 60);
      toast.success("OTP код илгээгдлээ");
    } catch {
      setError("Алдаа гарлаа");
    } finally {
      setOtpSending(false);
    }
  };

  const handleVerifyRegOtp = async () => {
    if (!otpCode || otpCode.length < otpLen) {
      setError("OTP код оруулна уу");
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("phone-auth", {
        body: {
          action: "verify-otp",
          phone,
          code: otpCode,
          purpose: "register",
        },
      });
      if (fnErr || data?.error) {
        setError(data?.error || "OTP баталгаажуулахад алдаа гарлаа");
        setIsLoading(false);
        return;
      }
      setOtpVerified(true);
      // Now register
      await doRegister(true);
    } catch {
      setError("Алдаа гарлаа");
    } finally {
      setIsLoading(false);
    }
  };

  // ── Register ──────────────────────────────────────────────
  const doRegister = async (otpDone: boolean = false) => {
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("phone-auth", {
        body: {
          action: "register-phone",
          phone,
          password,
          email: showEmail && email ? email.trim() : undefined,
          otp_verified: otpDone,
        },
      });

      if (fnErr || data?.error) {
        setError(data?.error || "Бүртгүүлэхэд алдаа гарлаа");
        return;
      }

      toast.success("Бүртгэл амжилттай! Нэвтрэх хэсгийг ашиглана уу.");
      onSuccess();
    } catch {
      setError("Алдаа гарлаа");
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      setError(err);
      return;
    }

    // If OTP required and not verified, send OTP first
    if (otpRequired && !otpVerified) {
      await handleSendOtp();
      return;
    }

    setIsLoading(true);
    setError("");
    await doRegister(otpVerified);
    setIsLoading(false);
  };

  // ── OTP verification step ────────────────────────────────
  if (otpStep && !otpVerified) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="text-center space-y-2">
          <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Phone className="h-7 w-7 text-primary" />
          </div>
          <h3 className="text-lg font-semibold">Код баталгаажуулах</h3>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium">{phone}</span> дугаар руу илгээсэн кодыг оруулна уу
          </p>
        </div>

        <div className="flex justify-center">
          <InputOTP maxLength={otpLen} value={otpCode} onChange={setOtpCode}>
            <InputOTPGroup>
              {Array.from({ length: otpLen }).map((_, i) => (
                <InputOTPSlot key={i} index={i} />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>

        {error && <p className="text-sm text-destructive text-center">{error}</p>}

        <Button
          className="w-full"
          onClick={handleVerifyRegOtp}
          disabled={isLoading || otpCode.length < otpLen}
        >
          {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Баталгаажуулах
        </Button>

        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setOtpStep(false);
              setOtpCode("");
              setError("");
            }}
          >
            ← Буцах
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSendOtp}
            disabled={otpCooldown > 0 || otpSending}
          >
            {otpCooldown > 0 ? `Дахин авах (${otpCooldown}с)` : "Дахин код авах"}
          </Button>
        </div>
      </div>
    );
  }

  // ── Registration form ─────────────────────────────────────
  return (
    <form onSubmit={handleRegister} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="reg-phone">Утасны дугаар</Label>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="reg-phone"
            type="tel"
            placeholder="99112233"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setError("");
            }}
            disabled={isLoading}
            className="pl-10"
            maxLength={12}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="reg-pw">Нууц үг</Label>
        <div className="relative">
          <Input
            id="reg-pw"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError("");
            }}
            disabled={isLoading}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="reg-pw2">Нууц үг давтах</Label>
        <Input
          id="reg-pw2"
          type="password"
          placeholder="••••••••"
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value);
            setError("");
          }}
          disabled={isLoading}
        />
      </div>

      {/* Optional email */}
      {!showEmail ? (
        <button
          type="button"
          onClick={() => setShowEmail(true)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <Mail className="h-4 w-4" />
          И-мэйл нэмэх (сонголттой)
          <ChevronDown className="h-3 w-3" />
        </button>
      ) : (
        <div className="space-y-2 animate-fade-in">
          <Label htmlFor="reg-email">И-мэйл (сонголттой)</Label>
          <Input
            id="reg-email"
            type="email"
            placeholder="email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
          />
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Бүртгүүлэх
      </Button>
    </form>
  );
}
