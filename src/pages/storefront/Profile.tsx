import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  User, Lock, Loader2, Mail, Phone, Save,
  ShoppingBag, Heart, Clock, Wallet, ChevronRight,
} from "lucide-react";

export default function Profile() {
  const { user } = useAuth();

  return (
    <div className="container py-6 max-w-2xl animate-fade-in">
      {/* Profile header */}
      <div className="bg-gradient-to-r from-primary to-primary/80 rounded-2xl p-6 text-primary-foreground mb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary-foreground/20 flex items-center justify-center">
            <User className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Миний профайл</h1>
            <p className="text-primary-foreground/70 text-sm">{user?.email}</p>
          </div>
        </div>
      </div>

      {/* Quick links grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {[
          { href: "/orders", icon: ShoppingBag, label: "Захиалгууд", color: "bg-blue-500/10 text-blue-500" },
          { href: "/wallet", icon: Wallet, label: "Данс", color: "bg-green-500/10 text-green-500" },
          { href: "/wishlist", icon: Heart, label: "Дуртай бараа", color: "bg-red-500/10 text-red-500" },
          { href: "/view-history", icon: Clock, label: "Үзсэн түүх", color: "bg-purple-500/10 text-purple-500" },
        ].map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className="flex items-center gap-3 p-4 rounded-2xl bg-card border hover:shadow-md transition-all group"
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.color}`}>
              <item.icon className="h-5 w-5" />
            </div>
            <span className="text-sm font-medium flex-1">{item.label}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
          </Link>
        ))}
      </div>

      {/* Profile info */}
      <ProfileInfoTab user={user!} />

      <div className="mt-4">
        <SecurityTab />
      </div>
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
      const { error } = await supabase.from("profiles").update({ full_name: fullName, phone }).eq("user_id", user.id);
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
      <Card className="rounded-2xl">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <User className="h-4 w-4 text-primary" />
          Хувийн мэдээлэл
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
            <Mail className="h-3 w-3" /> Имэйл
          </Label>
          <Input value={user.email || ""} disabled className="bg-muted/50 rounded-xl" />
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Нэр</Label>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Таны нэр" className="rounded-xl" />
        </div>
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
            <Phone className="h-3 w-3" /> Утас
          </Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9999 9999" className="rounded-xl" />
        </div>
        <Separator />
        <Button onClick={handleSave} disabled={saving} className="rounded-xl w-full">
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
    if (newPassword.length < 6) { toast.error("Нууц үг хамгийн багадаа 6 тэмдэгт"); return; }
    if (newPassword !== confirmPassword) { toast.error("Нууц үгүүд таарахгүй байна"); return; }
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
    <Card className="rounded-2xl border shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Lock className="h-4 w-4 text-primary" />
          Нууц үг солих
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Шинэ нууц үг</Label>
          <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="rounded-xl" />
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Нууц үг давтах</Label>
          <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="rounded-xl" />
        </div>
        <Separator />
        <Button onClick={handleChangePassword} disabled={saving} variant="outline" className="rounded-xl w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
          Нууц үг солих
        </Button>
      </CardContent>
    </Card>
  );
}
