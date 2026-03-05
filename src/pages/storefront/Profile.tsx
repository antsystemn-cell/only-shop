import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { getAnonymousSession } from "@/services/otSession";
import {
  getUserProfileInfoList,
  createUserProfile,
  updateUserProfile,
  deleteUserProfile,
  type OtUserProfile,
} from "@/services/otApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  ArrowLeft,
  User,
  MapPin,
  Wallet,
  Lock,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Mail,
  Phone,
  Save,
  ShoppingBag,
  Heart,
  Store,
  ChevronRight,
} from "lucide-react";
import { ChangeContactInfo } from "@/components/storefront/ChangeContactInfo";

export default function Profile() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-4xl">
      <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4" />
        Нүүр хуудас
      </Link>

      <h1 className="text-3xl font-bold mb-6">Миний профайл</h1>

      {/* Quick Links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { href: "/orders", icon: ShoppingBag, label: "Миний захиалгууд", color: "text-blue-500" },
          { href: "/wallet", icon: Wallet, label: "Данс", color: "text-green-500" },
          { href: "/favourite-vendors", icon: Store, label: "Дуртай борлуулагч", color: "text-orange-500" },
          { href: "/wishlist", icon: Heart, label: "Дуртай бараа", color: "text-red-500" },
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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="info" className="gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Мэдээлэл</span>
          </TabsTrigger>
          <TabsTrigger value="addresses" className="gap-2">
            <MapPin className="h-4 w-4" />
            <span className="hidden sm:inline">Хаягууд</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Lock className="h-4 w-4" />
            <span className="hidden sm:inline">Нууцлал</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          <ProfileInfoTab user={user!} />
        </TabsContent>
        <TabsContent value="addresses">
          <AddressesTab />
        </TabsContent>
        <TabsContent value="security">
          <SecurityTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Profile Info Tab ──────────────────────────────────────────

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

// ─── Addresses Tab (OT API) ────────────────────────────────────

function AddressesTab() {
  const [profiles, setProfiles] = useState<OtUserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ fullName: "", phone: "", address: "", zipCode: "" });
  const [saving, setSaving] = useState(false);

  const loadProfiles = useCallback(async () => {
    try {
      setLoading(true);
      const sessionId = await getAnonymousSession();
      const data = await getUserProfileInfoList(sessionId);
      const rawItems = data?.Result?.Items;
      setProfiles(Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : []);
    } catch {
      // no profiles
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  const resetForm = () => {
    setForm({ fullName: "", phone: "", address: "", zipCode: "" });
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (p: OtUserProfile) => {
    setForm({
      fullName: p.FullName || "",
      phone: p.Phone || "",
      address: p.Address || "",
      zipCode: p.ZipCode || "",
    });
    setEditingId(p.Id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.fullName || !form.phone || !form.address) {
      toast.error("Бүх талбарыг бөглөнө үү");
      return;
    }
    setSaving(true);
    try {
      const sessionId = await getAnonymousSession();
      const xml = `<UserProfileInfo>
        ${editingId ? `<Id>${editingId}</Id>` : ""}
        <FullName>${form.fullName}</FullName>
        <Phone>${form.phone}</Phone>
        <Address>${form.address}</Address>
        ${form.zipCode ? `<ZipCode>${form.zipCode}</ZipCode>` : ""}
      </UserProfileInfo>`;

      if (editingId) {
        await updateUserProfile(sessionId, xml);
        toast.success("Хаяг шинэчлэгдлээ");
      } else {
        await createUserProfile(sessionId, xml);
        toast.success("Хаяг нэмэгдлээ");
      }
      resetForm();
      await loadProfiles();
    } catch (err: any) {
      toast.error(err.message || "Алдаа гарлаа");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (profileId: string) => {
    try {
      const sessionId = await getAnonymousSession();
      await deleteUserProfile(sessionId, profileId);
      toast.success("Хаяг устгагдлаа");
      await loadProfiles();
    } catch (err: any) {
      toast.error(err.message || "Алдаа гарлаа");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Хүргэлтийн хаягууд
          </span>
          <Dialog open={showForm} onOpenChange={(open) => { if (!open) resetForm(); else setShowForm(true); }}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Шинэ хаяг
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingId ? "Хаяг засах" : "Шинэ хаяг нэмэх"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label>Нэр *</Label>
                  <Input value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} />
                </div>
                <div>
                  <Label>Утас *</Label>
                  <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                </div>
                <div>
                  <Label>Хаяг *</Label>
                  <Textarea value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
                </div>
                <div>
                  <Label>Шуудангийн код</Label>
                  <Input value={form.zipCode} onChange={(e) => setForm((f) => ({ ...f, zipCode: e.target.value }))} />
                </div>
                <Button onClick={handleSave} disabled={saving} className="w-full">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  {editingId ? "Шинэчлэх" : "Нэмэх"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : profiles.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <MapPin className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>Хаяг бүртгэгдээгүй байна</p>
          </div>
        ) : (
          <div className="space-y-3">
            {profiles.map((p) => (
              <div key={p.Id} className="flex items-start gap-3 p-4 rounded-lg border">
                <MapPin className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{p.FullName}</p>
                  <p className="text-sm text-muted-foreground">{p.Address}</p>
                  {p.Phone && <p className="text-sm text-muted-foreground">{p.Phone}</p>}
                  {p.CityName && <p className="text-xs text-muted-foreground">{p.CityName}</p>}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => startEdit(p)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Хаяг устгах уу?</AlertDialogTitle>
                        <AlertDialogDescription>Энэ үйлдлийг буцаах боломжгүй.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Цуцлах</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(p.Id)}>Устгах</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Security Tab ──────────────────────────────────────────────

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
    <div className="space-y-6">
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

      <ChangeContactInfo />
    </div>
  );
}
