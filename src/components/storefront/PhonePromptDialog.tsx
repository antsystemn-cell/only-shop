import { useState, useEffect } from "react";
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
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!user || checked) return;

    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("phone")
        .eq("user_id", user.id)
        .single();

      setChecked(true);

      if (!data?.phone || data.phone.trim() === "") {
        setOpen(true);
      }
    })();
  }, [user, checked]);

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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
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
