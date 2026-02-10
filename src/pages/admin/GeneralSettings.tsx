import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Save, Settings } from "lucide-react";

export default function GeneralSettings() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin", "settings", "general"],
    queryFn: async () => {
      const { data, error } = await supabase.from("admin_settings").select("*").eq("category", "general");
      if (error) throw error;
      return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: any }) => {
      const { error } = await supabase.from("admin_settings").update({ setting_value: JSON.stringify(value) }).eq("setting_key", key);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin", "settings"] }); toast.success("Хадгалагдлаа"); },
    onError: (e: any) => toast.error(e.message),
  });

  const getSetting = (key: string) => {
    const s = settings?.find((s) => s.setting_key === key);
    try { return s ? JSON.parse(String(s.setting_value)) : ""; } catch { return s?.setting_value || ""; }
  };

  if (isLoading) return <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div><h1 className="text-3xl font-bold">Ерөнхий тохиргоо</h1><p className="text-muted-foreground mt-1">Сайтын үндсэн тохиргоо</p></div>
      <SettingField label="Сайтын нэр" settingKey="site_name" value={getSetting("site_name")} onSave={(v) => updateMutation.mutate({ key: "site_name", value: v })} />
      <SettingField label="Сайтын тайлбар" settingKey="site_description" value={getSetting("site_description")} onSave={(v) => updateMutation.mutate({ key: "site_description", value: v })} />
    </div>
  );
}

function SettingField({ label, settingKey, value, onSave }: { label: string; settingKey: string; value: string; onSave: (v: string) => void }) {
  const [val, setVal] = useState(value);
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{label}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <Input value={val} onChange={(e) => setVal(e.target.value)} />
        <Button size="sm" onClick={() => onSave(val)}><Save className="h-4 w-4 mr-2" />Хадгалах</Button>
      </CardContent>
    </Card>
  );
}
