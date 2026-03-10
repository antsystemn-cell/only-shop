import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Save, Shield, Phone, Mail, Key } from "lucide-react";

export default function AuthSettings() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin", "settings", "auth"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_settings")
        .select("*")
        .eq("category", "auth");
      if (error) throw error;
      return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: any }) => {
      const { error } = await supabase
        .from("admin_settings")
        .update({ setting_value: JSON.stringify(value) })
        .eq("setting_key", key);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "settings", "auth"] });
      toast.success("Хадгалагдлаа");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const getVal = (key: string, fallback: any = "") => {
    const s = settings?.find((s) => s.setting_key === key);
    try {
      return s ? JSON.parse(String(s.setting_value)) : fallback;
    } catch {
      return s?.setting_value || fallback;
    }
  };

  const toggleSetting = (key: string) => {
    const current = getVal(key, "false");
    const newVal = current === "true" || current === true ? "false" : "true";
    updateMutation.mutate({ key, value: newVal });
  };

  const isTruthy = (key: string) => {
    const v = getVal(key, "false");
    return v === "true" || v === true;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          Нэвтрэлтийн тохиргоо
        </h1>
        <p className="text-muted-foreground mt-1">
          Хэрэглэгчийн бүртгэл, нэвтрэлтийн тохиргоо
        </p>
      </div>

      {/* Registration methods */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Бүртгэлийн аргууд</CardTitle>
          <CardDescription>Хэрэглэгч бүртгүүлэх боломжтой аргуудыг тохируулах</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ToggleRow
            icon={<Phone className="h-5 w-5" />}
            label="Утасны дугаараар бүртгүүлэх"
            description="Хэрэглэгч утасны дугаараар бүртгэл үүсгэх боломж"
            checked={isTruthy("phone_registration_enabled")}
            onToggle={() => toggleSetting("phone_registration_enabled")}
          />
          <Separator />
          <ToggleRow
            icon={<Mail className="h-5 w-5" />}
            label="Имэйлээр бүртгүүлэх"
            description="Хэрэглэгч имэйлээр бүртгэл үүсгэх боломж"
            checked={isTruthy("email_registration_enabled")}
            onToggle={() => toggleSetting("email_registration_enabled")}
          />
          <Separator />
          <ToggleRow
            icon={<Phone className="h-5 w-5" />}
            label="Утасны дугаарыг гол арга болгох"
            description="Нэвтрэх хуудсанд утасны дугаарыг эхний сонголтоор харуулах"
            checked={isTruthy("phone_primary_enabled")}
            onToggle={() => toggleSetting("phone_primary_enabled")}
          />
        </CardContent>
      </Card>

      {/* OTP settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            OTP тохиргоо
          </CardTitle>
          <CardDescription>Нэг удаагийн нууц код (OTP) тохиргоо</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ToggleRow
            icon={<Phone className="h-5 w-5" />}
            label="OTP кодоор нэвтрэх"
            description="Хэрэглэгч утасны дугаар + OTP кодоор нэвтрэх боломж"
            checked={isTruthy("phone_otp_login_enabled")}
            onToggle={() => toggleSetting("phone_otp_login_enabled")}
          />
          <Separator />
          <ToggleRow
            icon={<Shield className="h-5 w-5" />}
            label="Бүртгүүлэх үед OTP шаардах"
            description="Утасны дугаараар бүртгүүлэх үед OTP баталгаажуулалт шаардах"
            checked={isTruthy("phone_registration_otp_required")}
            onToggle={() => toggleSetting("phone_registration_otp_required")}
          />
          <Separator />
          <NumberSetting
            label="OTP кодын урт"
            settingKey="otp_length"
            value={getVal("otp_length", "4")}
            onSave={(v) => updateMutation.mutate({ key: "otp_length", value: v })}
            min={4}
            max={6}
          />
          <NumberSetting
            label="OTP хугацаа (секунд)"
            settingKey="otp_expiry_seconds"
            value={getVal("otp_expiry_seconds", "180")}
            onSave={(v) => updateMutation.mutate({ key: "otp_expiry_seconds", value: v })}
            min={60}
            max={600}
          />
          <NumberSetting
            label="Дахин илгээх хугацаа (секунд)"
            settingKey="otp_resend_cooldown_seconds"
            value={getVal("otp_resend_cooldown_seconds", "60")}
            onSave={(v) => updateMutation.mutate({ key: "otp_resend_cooldown_seconds", value: v })}
            min={30}
            max={300}
          />
          <NumberSetting
            label="Оролдлогын дээд тоо"
            settingKey="otp_max_attempts"
            value={getVal("otp_max_attempts", "5")}
            onSave={(v) => updateMutation.mutate({ key: "otp_max_attempts", value: v })}
            min={3}
            max={10}
          />
          <Separator />
          <TemplateSetting
            label="OTP мессежийн загвар"
            description="{{CODE}} = OTP код, {{MINUTES}} = хугацаа минутаар"
            value={getVal("otp_message_template", "Таны баталгаажуулах код: {{CODE}}. Хугацаа: {{MINUTES}} минут.")}
            onSave={(v) => updateMutation.mutate({ key: "otp_message_template", value: v })}
          />
        </CardContent>
      </Card>
    </div>
  );
}

// ── Reusable components ──────────────────────────────────────

function ToggleRow({
  icon,
  label,
  description,
  checked,
  onToggle,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="text-muted-foreground mt-0.5">{icon}</div>
        <div>
          <p className="font-medium">{label}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onToggle} />
    </div>
  );
}

function NumberSetting({
  label,
  settingKey,
  value,
  onSave,
  min,
  max,
}: {
  label: string;
  settingKey: string;
  value: string;
  onSave: (v: string) => void;
  min: number;
  max: number;
}) {
  const [val, setVal] = useState(String(value));
  useEffect(() => setVal(String(value)), [value]);

  return (
    <div className="flex items-center justify-between gap-4">
      <Label className="font-medium">{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          className="w-24 text-center"
          min={min}
          max={max}
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => onSave(val)}
          disabled={val === String(value)}
        >
          <Save className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

function TemplateSetting({
  label,
  description,
  value,
  onSave,
}: {
  label: string;
  description: string;
  value: string;
  onSave: (v: string) => void;
}) {
  const [val, setVal] = useState(value);
  useEffect(() => setVal(value), [value]);

  return (
    <div className="space-y-2">
      <Label className="font-medium">{label}</Label>
      <p className="text-xs text-muted-foreground">{description}</p>
      <Textarea value={val} onChange={(e) => setVal(e.target.value)} rows={2} />
      <Button
        size="sm"
        onClick={() => onSave(val)}
        disabled={val === value}
      >
        <Save className="h-4 w-4 mr-2" />
        Хадгалах
      </Button>
    </div>
  );
}
