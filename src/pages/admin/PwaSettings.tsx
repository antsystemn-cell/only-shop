import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Save, Smartphone, Eye } from "lucide-react";

interface PwaConfig {
  enabled: boolean;
  title: string;
  subtitle: string;
  button_text: string;
  dismiss_days: number;
  position: "bottom" | "top" | "center";
  logo_url: string;
  bg_color: string;
  text_color: string;
  button_bg_color: string;
  button_text_color: string;
  border_radius: "sm" | "md" | "lg" | "xl" | "2xl";
  show_close_button: boolean;
}

const DEFAULT_CONFIG: PwaConfig = {
  enabled: true,
  title: "Only.mn апп суулгах",
  subtitle: "Илүү хурдан, илүү тохиромжтой хэрэглээ.",
  button_text: "Суулгах",
  dismiss_days: 7,
  position: "bottom",
  logo_url: "",
  bg_color: "",
  text_color: "",
  button_bg_color: "",
  button_text_color: "",
  border_radius: "2xl",
  show_close_button: true,
};

export default function PwaSettings() {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<PwaConfig>(DEFAULT_CONFIG);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin", "settings", "pwa"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_settings")
        .select("*")
        .eq("setting_key", "pwa_install_banner");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (settings && settings.length > 0) {
      try {
        const parsed = typeof settings[0].setting_value === "string"
          ? JSON.parse(settings[0].setting_value)
          : settings[0].setting_value;
        setConfig({ ...DEFAULT_CONFIG, ...parsed });
      } catch {
        setConfig(DEFAULT_CONFIG);
      }
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (newConfig: PwaConfig) => {
      const existing = settings && settings.length > 0;
      if (existing) {
        const { error } = await supabase
          .from("admin_settings")
          .update({ setting_value: JSON.stringify(newConfig) as any, updated_at: new Date().toISOString() })
          .eq("setting_key", "pwa_install_banner");
        if (error) throw error;
      } else {
        const { error } = await supabase.from("admin_settings").insert({
          setting_key: "pwa_install_banner",
          setting_value: JSON.stringify(newConfig) as any,
          category: "pwa",
          description: "PWA суулгах banner тохиргоо",
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "settings", "pwa"] });
      queryClient.invalidateQueries({ queryKey: ["pwa-config"] });
      toast.success("PWA тохиргоо хадгалагдлаа");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleSave = () => saveMutation.mutate(config);

  const update = (key: keyof PwaConfig, value: any) => setConfig((prev) => ({ ...prev, [key]: value }));

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Smartphone className="h-8 w-8" />
            PWA тохиргоо
          </h1>
          <p className="text-muted-foreground mt-1">
            PWA суулгах banner-ийн текст, дизайн, байрлалыг удирдах
          </p>
        </div>
        <Button onClick={handleSave} disabled={saveMutation.isPending}>
          <Save className="h-4 w-4 mr-2" />
          Хадгалах
        </Button>
      </div>

      {/* Enable/Disable */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Banner идэвхжүүлэх</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Switch checked={config.enabled} onCheckedChange={(v) => update("enabled", v)} />
            <span className="text-sm text-muted-foreground">
              {config.enabled ? "Идэвхтэй" : "Идэвхгүй"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Text Content */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Текст & Контент</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Гарчиг</Label>
            <Input value={config.title} onChange={(e) => update("title", e.target.value)} placeholder="Only.mn апп суулгах" />
          </div>
          <div className="space-y-2">
            <Label>Дэд гарчиг</Label>
            <Textarea value={config.subtitle} onChange={(e) => update("subtitle", e.target.value)} placeholder="Илүү хурдан, илүү тохиромжтой хэрэглээ." rows={2} />
          </div>
          <div className="space-y-2">
            <Label>Товчлуурын текст</Label>
            <Input value={config.button_text} onChange={(e) => update("button_text", e.target.value)} placeholder="Суулгах" />
          </div>
          <div className="space-y-2">
            <Label>Дахин санамж үзүүлэх хоног</Label>
            <Input type="number" min={1} max={90} value={config.dismiss_days} onChange={(e) => update("dismiss_days", Number(e.target.value))} />
            <p className="text-xs text-muted-foreground">Хэрэглэгч хаасны дараа хэдэн хоногийн дараа дахин харуулах</p>
          </div>
        </CardContent>
      </Card>

      {/* Position & Layout */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Байрлал & Загвар</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Байрлал</Label>
            <Select value={config.position} onValueChange={(v) => update("position", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="top">Дээд талд</SelectItem>
                <SelectItem value="center">Дунд (Modal)</SelectItem>
                <SelectItem value="bottom">Доод талд</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Булангийн хэлбэр</Label>
            <Select value={config.border_radius} onValueChange={(v) => update("border_radius", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sm">Бага (sm)</SelectItem>
                <SelectItem value="md">Дунд (md)</SelectItem>
                <SelectItem value="lg">Том (lg)</SelectItem>
                <SelectItem value="xl">Маш том (xl)</SelectItem>
                <SelectItem value="2xl">Тойрог (2xl)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={config.show_close_button} onCheckedChange={(v) => update("show_close_button", v)} />
            <Label>Хаах товчлуур харуулах</Label>
          </div>
        </CardContent>
      </Card>

      {/* Logo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Лого</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Лого URL (хоосон бол анхдагч icon харуулна)</Label>
            <Input value={config.logo_url} onChange={(e) => update("logo_url", e.target.value)} placeholder="https://..." />
          </div>
          {config.logo_url && (
            <div className="w-12 h-12 rounded-xl border overflow-hidden">
              <img src={config.logo_url} alt="Logo preview" className="w-full h-full object-contain" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Colors */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Өнгө (хоосон бол анхдагч дизайн)</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Дэвсгэр өнгө</Label>
            <div className="flex gap-2">
              <Input value={config.bg_color} onChange={(e) => update("bg_color", e.target.value)} placeholder="#1a1a2e" />
              {config.bg_color && <div className="w-10 h-10 rounded-lg border shrink-0" style={{ backgroundColor: config.bg_color }} />}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Текстийн өнгө</Label>
            <div className="flex gap-2">
              <Input value={config.text_color} onChange={(e) => update("text_color", e.target.value)} placeholder="#ffffff" />
              {config.text_color && <div className="w-10 h-10 rounded-lg border shrink-0" style={{ backgroundColor: config.text_color }} />}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Товчлуурын дэвсгэр</Label>
            <div className="flex gap-2">
              <Input value={config.button_bg_color} onChange={(e) => update("button_bg_color", e.target.value)} placeholder="#e94560" />
              {config.button_bg_color && <div className="w-10 h-10 rounded-lg border shrink-0" style={{ backgroundColor: config.button_bg_color }} />}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Товчлуурын текстийн өнгө</Label>
            <div className="flex gap-2">
              <Input value={config.button_text_color} onChange={(e) => update("button_text_color", e.target.value)} placeholder="#ffffff" />
              {config.button_text_color && <div className="w-10 h-10 rounded-lg border shrink-0" style={{ backgroundColor: config.button_text_color }} />}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Урьдчилан харах
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-muted/50 rounded-xl p-6 flex items-center justify-center min-h-[120px]">
            <BannerPreview config={config} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function BannerPreview({ config }: { config: PwaConfig }) {
  const radiusMap = { sm: "0.25rem", md: "0.375rem", lg: "0.5rem", xl: "0.75rem", "2xl": "1rem" };
  const radius = radiusMap[config.border_radius] || "1rem";

  return (
    <div
      className="w-full max-w-sm shadow-lg p-4 flex items-start gap-3"
      style={{
        borderRadius: radius,
        backgroundColor: config.bg_color || "hsl(var(--secondary))",
        color: config.text_color || "hsl(var(--secondary-foreground))",
      }}
    >
      <div
        className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden"
        style={{ backgroundColor: config.text_color ? `${config.text_color}15` : "hsl(var(--secondary-foreground) / 0.1)" }}
      >
        {config.logo_url ? (
          <img src={config.logo_url} alt="logo" className="w-8 h-8 object-contain" />
        ) : (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{config.title || "Only.mn апп суулгах"}</p>
        <p className="text-xs opacity-80 mt-0.5">{config.subtitle || "Илүү хурдан, илүү тохиромжтой хэрэглээ."}</p>
        <button
          className="mt-3 text-xs font-semibold px-4 py-1.5 rounded-lg transition-colors cursor-default"
          style={{
            backgroundColor: config.button_bg_color || (config.text_color ? `${config.text_color}33` : "hsl(var(--secondary-foreground) / 0.2)"),
            color: config.button_text_color || "inherit",
          }}
        >
          {config.button_text || "Суулгах"}
        </button>
      </div>
      {config.show_close_button && (
        <div className="shrink-0 p-1 rounded-full opacity-60">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
      )}
    </div>
  );
}
