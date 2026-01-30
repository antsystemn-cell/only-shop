import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Lock, Mail, Loader2, User } from "lucide-react";
import onlyLogo from "@/assets/only-logo.png";

const loginSchema = z.object({
  email: z.string().trim().email("Зөв имэйл хаяг оруулна уу"),
  password: z.string().min(6, "Нууц үг хамгийн багадаа 6 тэмдэгт байх ёстой"),
});

const signupSchema = z.object({
  email: z.string().trim().email("Зөв имэйл хаяг оруулна уу"),
  password: z.string().min(6, "Нууц үг хамгийн багадаа 6 тэмдэгт байх ёстой"),
  fullName: z.string().min(2, "Нэрээ оруулна уу"),
});

export default function AdminLogin() {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; fullName?: string }>({});
  const navigate = useNavigate();
  const { toast } = useToast();

  // Check if already logged in
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Check if user is admin
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .eq("role", "admin")
          .single();
        
        if (roleData) {
          navigate("/admin");
        }
      }
    };
    checkSession();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate input
    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      const fieldErrors: { email?: string; password?: string } = {};
      result.error.errors.forEach((err) => {
        if (err.path[0] === "email") fieldErrors.email = err.message;
        if (err.path[0] === "password") fieldErrors.password = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast({
            title: "Нэвтрэх амжилтгүй",
            description: "Имэйл эсвэл нууц үг буруу байна",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Алдаа гарлаа",
            description: error.message,
            variant: "destructive",
          });
        }
        return;
      }

      if (data.user) {
        // Check if user has admin role
        const { data: roleData, error: roleError } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", data.user.id)
          .eq("role", "admin")
          .single();

        if (roleError || !roleData) {
          // Not an admin - sign out and show error
          await supabase.auth.signOut();
          toast({
            title: "Хандах эрхгүй",
            description: "Та админ эрхгүй байна. Админтай холбогдоно уу.",
            variant: "destructive",
          });
          return;
        }

        toast({
          title: "Амжилттай нэвтэрлээ",
          description: "Админ самбарт тавтай морил!",
        });
        navigate("/admin");
      }
    } catch (error) {
      toast({
        title: "Алдаа гарлаа",
        description: "Сервертэй холбогдох үед алдаа гарлаа",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate input
    const result = signupSchema.safeParse({ email, password, fullName });
    if (!result.success) {
      const fieldErrors: { email?: string; password?: string; fullName?: string } = {};
      result.error.errors.forEach((err) => {
        if (err.path[0] === "email") fieldErrors.email = err.message;
        if (err.path[0] === "password") fieldErrors.password = err.message;
        if (err.path[0] === "fullName") fieldErrors.fullName = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);

    try {
      const redirectUrl = `${window.location.origin}/admin`;
      
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) {
        if (error.message.includes("already registered")) {
          toast({
            title: "Бүртгэл байна",
            description: "Энэ имэйл хаягаар аль хэдийн бүртгэл үүссэн байна. Нэвтрэх хэсгийг ашиглана уу.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Алдаа гарлаа",
            description: error.message,
            variant: "destructive",
          });
        }
        return;
      }

      if (data.user) {
        toast({
          title: "Бүртгэл амжилттай",
          description: "Таны бүртгэл үүслээ. Админ эрх авахын тулд админтай холбогдоно уу.",
        });
        setIsSignup(false);
        setPassword("");
      }
    } catch (error) {
      toast({
        title: "Алдаа гарлаа",
        description: "Сервертэй холбогдох үед алдаа гарлаа",
        variant: "destructive",
      });
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
          {/* Logo */}
          <div className="mx-auto">
            <img 
              src={onlyLogo} 
              alt="Only Logo" 
              className="h-16 w-auto mx-auto"
            />
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
                {errors.fullName && (
                  <p className="text-sm text-destructive">{errors.fullName}</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Имэйл</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@only.mn"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`pl-10 ${errors.email ? "border-destructive" : ""}`}
                  disabled={isLoading}
                />
              </div>
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email}</p>
              )}
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
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isSignup ? "Бүртгэж байна..." : "Нэвтэрж байна..."}
                </>
              ) : (
                isSignup ? "Бүртгүүлэх" : "Нэвтрэх"
              )}
            </Button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setIsSignup(!isSignup);
                  setErrors({});
                }}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                {isSignup 
                  ? "Бүртгэлтэй юу? Нэвтрэх" 
                  : "Бүртгэлгүй юу? Бүртгүүлэх"}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
