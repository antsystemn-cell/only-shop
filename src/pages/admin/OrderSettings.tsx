import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Save } from "lucide-react";

export default function OrderSettings() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin", "settings", "orders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("admin_settings").select("*").eq("category", "orders");
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
      <div><h1 className="text-3xl font-bold">Захиалгын тохиргоо</h1><p className="text-muted-foreground mt-1">Захиалгатай холбоотой тохиргоо</p></div>

      <Card>
        <CardHeader><CardTitle className="text-base">Автоматаар баталгаажуулах</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-4">
            <Switch checked={getSetting("auto_confirm_orders") === true} onCheckedChange={(c) => updateMutation.mutate({ key: "auto_confirm_orders", value: c })} />
            <Label>Захиалга автоматаар баталгаажуулах</Label>
          </div>
        </CardContent>
      </Card>

      <OrderSettingField label="Мэдэгдэл илгээх имэйл" value={getSetting("order_notification_email")} onSave={(v) => updateMutation.mutate({ key: "order_notification_email", value: v })} />
    </div>
  );
}

function OrderSettingField({ label, value, onSave }: { label: string; value: string; onSave: (v: string) => void }) {
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
