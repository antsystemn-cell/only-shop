import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Save, Megaphone } from "lucide-react";

export default function Seo() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin", "settings", "seo"],
    queryFn: async () => {
      const { data, error } = await supabase.from("admin_settings").select("*").eq("category", "seo");
      if (error) throw error;
      return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: any }) => {
      const { error } = await supabase.from("admin_settings").update({ setting_value: JSON.stringify(value) }).eq("setting_key", key);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin", "settings", "seo"] }); toast.success("Хадгалагдлаа"); },
    onError: (e: any) => toast.error(e.message),
  });

  const getSetting = (key: string) => {
    const s = settings?.find((s) => s.setting_key === key);
    try { return s ? JSON.parse(String(s.setting_value)) : ""; } catch { return s?.setting_value || ""; }
  };

  if (isLoading) return <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div><h1 className="text-3xl font-bold">SEO тохиргоо</h1><p className="text-muted-foreground mt-1">Хайлтын системийн оновчлол</p></div>

      <SeoField label="SEO анхдагч гарчиг" settingKey="seo_default_title" value={getSetting("seo_default_title")} onSave={(v) => updateMutation.mutate({ key: "seo_default_title", value: v })} />
      <SeoField label="SEO анхдагч тайлбар" settingKey="seo_default_description" value={getSetting("seo_default_description")} onSave={(v) => updateMutation.mutate({ key: "seo_default_description", value: v })} textarea />
      <SeoField label="Social sharing зураг URL" settingKey="social_og_image" value={getSetting("social_og_image")} onSave={(v) => updateMutation.mutate({ key: "social_og_image", value: v })} />
    </div>
  );
}

function SeoField({ label, settingKey, value, onSave, textarea }: { label: string; settingKey: string; value: string; onSave: (v: string) => void; textarea?: boolean }) {
  const [val, setVal] = useState(value);
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{label}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {textarea ? <Textarea value={val} onChange={(e) => setVal(e.target.value)} rows={3} /> : <Input value={val} onChange={(e) => setVal(e.target.value)} />}
        <Button size="sm" onClick={() => onSave(val)}><Save className="h-4 w-4 mr-2" />Хадгалах</Button>
      </CardContent>
    </Card>
  );
}
