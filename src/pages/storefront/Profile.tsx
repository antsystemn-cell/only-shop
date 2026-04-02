import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  ArrowLeft, User, MapPin, Lock, Loader2, Mail, Phone, Save,
  ShoppingBag, Heart, Clock, Wallet, ChevronRight,
} from "lucide-react";

export default function Profile() {
  const { user } = useAuth();

  return (
    <div className="container py-8 max-w-4xl">
      <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4" />
        Нүүр хуудас
      </Link>

      <h1 className="text-3xl font-bold mb-6">Миний профайл</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { href: "/orders", icon: ShoppingBag, label: "Миний захиалгууд", color: "text-blue-500" },
          { href: "/wallet", icon: Wallet, label: "Данс", color: "text-green-500" },
          { href: "/wishlist", icon: Heart, label: "Дуртай бараа", color: "text-red-500" },
          { href: "/view-history", icon: Clock, label: "Үзсэн түүх", color: "text-purple-500" },
        ].map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className="flex items-center gap-3 p-4 rounded-xl border bg-card hover:bg-accent transition-colors group"
          >
            <item.icon className={`h-5 w-5 ${item.color} shrink-0`} />
            <span className="text-sm font-medium flex-1">{item.label}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
          </Link>
        ))}
      </div>

      <Tabs defaultValue="info" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="info" className="gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Мэдээлэл</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Lock className="h-4 w-4" />
            <span className="hidden sm:inline">Нууцлал</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          <ProfileInfoTab user={user!} />
        </TabsContent>
        <TabsContent value="security">
          <SecurityTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProfileInfoTab({ user }: { user: { id: string; email?: string } }) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("user_id", user.id)
        .single();
      if (data) {
        setFullName(data.full_name || "");
        setPhone(data.phone || "");
      }
      setLoading(false);
    })();
  }, [user.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName, phone })
        .eq("user_id", user.id);
      if (error) throw error;
      toast.success("Мэдээлэл хадгалагдлаа");
    } catch (err: any) {
      toast.error(err.message || "Алдаа гарлаа");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5 text-primary" />
          Хувийн мэдээлэл
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            Имэйл
          </Label>
          <Input value={user.email || ""} disabled className="bg-muted/50" />
        </div>
        <div className="space-y-2">
          <Label>Нэр</Label>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Таны нэр" />
        </div>
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            Утасны дугаар
          </Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+976 9999 9999" />
        </div>
        <Separator />
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Хадгалах
        </Button>
      </CardContent>
    </Card>
  );
}

function SecurityTab() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error("Нууц үг хамгийн багадаа 6 тэмдэгт байх ёстой");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Нууц үгүүд таарахгүй байна");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Нууц үг амжилттай солигдлоо");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err.message || "Алдаа гарлаа");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-primary" />
          Нууц үг солих
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Шинэ нууц үг</Label>
          <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Нууц үг давтах</Label>
          <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
        </div>
        <Separator />
        <Button onClick={handleChangePassword} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
          Нууц үг солих
        </Button>
      </CardContent>
    </Card>
  );
}
