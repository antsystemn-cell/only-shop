import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, ArrowLeft } from "lucide-react";
import { z } from "zod";
import onlyLogo from "@/assets/only-logo.png";

const loginSchema = z.object({
  email: z.string().trim().email({ message: "Зөв имэйл хаяг оруулна уу" }),
  password: z.string().min(6, { message: "Нууц үг хамгийн багадаа 6 тэмдэгт байх ёстой" }),
});

const signupSchema = z.object({
  fullName: z.string().trim().min(2, { message: "Нэрээ оруулна уу" }).max(100),
  email: z.string().trim().email({ message: "Зөв имэйл хаяг оруулна уу" }),
  password: z.string().min(6, { message: "Нууц үг хамгийн багадаа 6 тэмдэгт байх ёстой" }),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Нууц үг таарахгүй байна",
  path: ["confirmPassword"],
});

export default function Auth() {
  const navigate = useNavigate();
  const { user, signIn, signUp, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState("login");
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  
  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginErrors, setLoginErrors] = useState<Record<string, string>>({});
  
  // Signup form state
  const [signupFullName, setSignupFullName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");
  const [signupErrors, setSignupErrors] = useState<Record<string, string>>({});

  // Redirect if already logged in
  useEffect(() => {
    if (user && !authLoading) {
      navigate("/");
    }
  }, [user, authLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginErrors({});
    
    const result = loginSchema.safeParse({ email: loginEmail, password: loginPassword });
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          errors[err.path[0] as string] = err.message;
        }
      });
      setLoginErrors(errors);
      return;
    }

    setIsLoading(true);
    const { error } = await signIn(loginEmail, loginPassword);
    setIsLoading(false);

    if (error) {
      if (error.message.includes("Invalid login credentials")) {
        toast.error("Имэйл эсвэл нууц үг буруу байна");
      } else if (error.message.includes("Email not confirmed")) {
        toast.error("Имэйлээ баталгаажуулна уу");
      } else {
        toast.error("Нэвтрэхэд алдаа гарлаа: " + error.message);
      }
      return;
    }

    toast.success("Амжилттай нэвтэрлээ!");
    navigate("/");
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupErrors({});

    const result = signupSchema.safeParse({
      fullName: signupFullName,
      email: signupEmail,
      password: signupPassword,
      confirmPassword: signupConfirmPassword,
    });
    
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          errors[err.path[0] as string] = err.message;
        }
      });
      setSignupErrors(errors);
      return;
    }

    setIsLoading(true);
    const { error } = await signUp(signupEmail, signupPassword, signupFullName);
    setIsLoading(false);

    if (error) {
      if (error.message.includes("User already registered")) {
        toast.error("Энэ имэйл хаягаар бүртгэлтэй хэрэглэгч байна");
      } else {
        toast.error("Бүртгүүлэхэд алдаа гарлаа: " + error.message);
      }
      return;
    }

    toast.success("Бүртгэл амжилттай! Имэйлээ шалгаж баталгаажуулна уу.");
    setActiveTab("login");
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
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
              <CardDescription>
                Only дэлгүүрт нэвтрэх эсвэл бүртгүүлэх
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {showForgotPassword ? (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-center">Нууц үг сэргээх</h3>
                <p className="text-sm text-muted-foreground text-center">
                  Бүртгэлтэй имэйл хаягаа оруулна уу. Нууц үг сэргээх холбоос илгээх болно.
                </p>
                {forgotSent ? (
                  <div className="text-center space-y-3 py-4">
                    <p className="text-sm text-primary font-medium">
                      ✓ Нууц үг сэргээх холбоос имэйл рүү илгээгдлээ!
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Имэйлээ шалгаж, холбоос дээр дарна уу.
                    </p>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => { setShowForgotPassword(false); setForgotSent(false); setForgotEmail(""); }}
                    >
                      Нэвтрэх хэсэг рүү буцах
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    if (!forgotEmail.trim()) {
                      toast.error("Имэйл хаягаа оруулна уу");
                      return;
                    }
                    setIsLoading(true);
                    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
                      redirectTo: `${window.location.origin}/reset-password`,
                    });
                    setIsLoading(false);
                    if (error) {
                      toast.error("Алдаа гарлаа: " + error.message);
                      return;
                    }
                    setForgotSent(true);
                  }} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="forgot-email">Имэйл</Label>
                      <Input
                        id="forgot-email"
                        type="email"
                        placeholder="example@email.com"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        disabled={isLoading}
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Илгээж байна...
                        </>
                      ) : (
                        "Холбоос илгээх"
                      )}
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
            ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">Нэвтрэх</TabsTrigger>
                <TabsTrigger value="signup">Бүртгүүлэх</TabsTrigger>
              </TabsList>
              
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Имэйл</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="example@email.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      disabled={isLoading}
                    />
                    {loginErrors.email && (
                      <p className="text-sm text-destructive">{loginErrors.email}</p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Нууц үг</Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      disabled={isLoading}
                    />
                    {loginErrors.password && (
                      <p className="text-sm text-destructive">{loginErrors.password}</p>
                    )}
                  </div>
                  
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Нэвтэрч байна...
                      </>
                    ) : (
                      "Нэвтрэх"
                    )}
                  </Button>
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
              </TabsContent>
              
              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Нэр</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="Таны нэр"
                      value={signupFullName}
                      onChange={(e) => setSignupFullName(e.target.value)}
                      disabled={isLoading}
                    />
                    {signupErrors.fullName && (
                      <p className="text-sm text-destructive">{signupErrors.fullName}</p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Имэйл</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="example@email.com"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      disabled={isLoading}
                    />
                    {signupErrors.email && (
                      <p className="text-sm text-destructive">{signupErrors.email}</p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Нууц үг</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="••••••••"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      disabled={isLoading}
                    />
                    {signupErrors.password && (
                      <p className="text-sm text-destructive">{signupErrors.password}</p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-confirm">Нууц үг давтах</Label>
                    <Input
                      id="signup-confirm"
                      type="password"
                      placeholder="••••••••"
                      value={signupConfirmPassword}
                      onChange={(e) => setSignupConfirmPassword(e.target.value)}
                      disabled={isLoading}
                    />
                    {signupErrors.confirmPassword && (
                      <p className="text-sm text-destructive">{signupErrors.confirmPassword}</p>
                    )}
                  </div>
                  
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Бүртгүүлж байна...
                      </>
                    ) : (
                      "Бүртгүүлэх"
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
            )}
          </CardContent>
          <CardFooter className="flex justify-center text-sm text-muted-foreground">
            <p>
              Бүртгүүлснээр та манай{" "}
              <Link to="/terms" className="text-primary hover:underline">
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
