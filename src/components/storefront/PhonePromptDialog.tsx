import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Phone, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function PhonePromptDialog() {
  const { user, isLoading } = useAuth();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const lastCheckedRef = useRef<string | null>(null);

  const checkPhone = useCallback(async (userId: string) => {
    // Avoid re-checking same user
    if (lastCheckedRef.current === userId) return;
    lastCheckedRef.current = userId;

    // Delay for new user profile trigger
    await new Promise((r) => setTimeout(r, 1200));

    const { data } = await supabase
      .from("profiles")
      .select("phone")
      .eq("user_id", userId)
      .maybeSingle();

    if (!data?.phone || data.phone.trim() === "") {
      setOpen(true);
    }
  }, []);

  // Check on user change
  useEffect(() => {
    if (isLoading || !user) {
      // Reset when logged out so next login re-checks
      if (!user && !isLoading) {
        lastCheckedRef.current = null;
      }
      return;
    }
    checkPhone(user.id);
  }, [user, isLoading, checkPhone]);

  // Also re-check after navigation (e.g. from /auth to /)
  useEffect(() => {
    if (!user || isLoading) return;

    const onFocus = () => {
      if (user && lastCheckedRef.current !== user.id) {
        checkPhone(user.id);
      }
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [user, isLoading, checkPhone]);

  const handleSave = async () => {
    const trimmed = phone.replace(/\s/g, "");
    if (!/^\d{8}$/.test(trimmed)) {
      toast.error("Зөв утасны дугаар оруулна уу (8 оронтой)");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ phone: trimmed })
        .eq("user_id", user!.id);

      if (error) throw error;
      toast.success("Утасны дугаар хадгалагдлаа");
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Алдаа гарлаа");
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { /* prevent closing without saving */ if (!v) return; }}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary" />
            Утасны дугаар оруулна уу
          </DialogTitle>
          <DialogDescription className="text-sm">
            Захиалга хийхэд таны утасны дугаар зайлшгүй шаардлагатай тул та
            утасны дугаараа үнэн зөв оруулна уу.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Утасны дугаар</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="9999 9999"
              type="tel"
              maxLength={8}
              autoFocus
            />
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Phone className="h-4 w-4 mr-2" />
            )}
            Хадгалах
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
