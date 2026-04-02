import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { DollarSign, Save, Plus, Trash2, RefreshCw, Loader2, TrendingUp, Percent, Calculator } from "lucide-react";

export default function Pricing() {
  const queryClient = useQueryClient();

  const { data: configs, isLoading } = useQuery({
    queryKey: ["admin", "price-config"],
    queryFn: async () => {
      const { data, error } = await supabase.from("price_config").select("*").order("config_key");
      if (error) throw error;
      return data;
    },
  });


  const updateMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: any }) => {
      const { error } = await supabase
        .from("price_config")
        .update({ config_value: value })
        .eq("config_key", key);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "price-config"] });
      toast.success("Тохиргоо хадгалагдлаа");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const getConfig = (key: string) => configs?.find((c) => c.config_key === key);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div><h1 className="text-3xl font-bold">Үнийн тохиргоо</h1></div>
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Үнийн тохиргоо</h1>
          <p className="text-muted-foreground mt-1">Валют, нэмэгдэл, хөнгөлөлтийн тохиргоо</p>
        </div>
      </div>

      <Tabs defaultValue="rates">
        <TabsList>
          <TabsTrigger value="rates"><DollarSign className="h-4 w-4 mr-1" />Ханш</TabsTrigger>
          <TabsTrigger value="markups"><Percent className="h-4 w-4 mr-1" />Нэмэгдэл</TabsTrigger>
          <TabsTrigger value="tiers"><Calculator className="h-4 w-4 mr-1" />Шатлал</TabsTrigger>
          <TabsTrigger value="discounts"><Percent className="h-4 w-4 mr-1" />Хөнгөлөлт</TabsTrigger>
        </TabsList>

        <TabsContent value="rates" className="mt-4">
          <ExchangeRatesCard config={getConfig("exchange_rates")} onSave={(v) => updateMutation.mutate({ key: "exchange_rates", value: v })} />
          <div className="mt-4">
            <RoundPricesCard config={getConfig("round_prices")} onSave={(v) => updateMutation.mutate({ key: "round_prices", value: v })} />
          </div>
        </TabsContent>

        <TabsContent value="markups" className="mt-4">
          <ProviderMarkupsCard config={getConfig("provider_markups")} onSave={(v) => updateMutation.mutate({ key: "provider_markups", value: v })} />
        </TabsContent>

        <TabsContent value="tiers" className="mt-4">
          <PriceTiersCard config={getConfig("price_tiers")} onSave={(v) => updateMutation.mutate({ key: "price_tiers", value: v })} />
        </TabsContent>

        <TabsContent value="discounts" className="mt-4">
          <DiscountRulesCard config={getConfig("discount_rules")} onSave={(v) => updateMutation.mutate({ key: "discount_rules", value: v })} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ExchangeRatesCard({ config, onSave }: { config: any; onSave: (v: any) => void }) {
  const [rates, setRates] = useState<Record<string, number>>(config?.config_value || {});
  useEffect(() => { if (config?.config_value) setRates(config.config_value); }, [config]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5 text-primary" />Валютын ханш</CardTitle>
        <CardDescription>1 гадаад валют = X MNT</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.entries(rates).map(([key, val]) => (
          <div key={key} className="flex items-center gap-4">
            <Label className="w-32 font-mono text-lg">{key}</Label>
            <Input type="number" value={val} onChange={(e) => setRates({ ...rates, [key]: Number(e.target.value) })} className="w-48" />
            <span className="text-sm text-muted-foreground">MNT</span>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <Input
            placeholder="Шинэ валют (USD, EUR...)"
            className="w-48"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const v = (e.target as HTMLInputElement).value.toUpperCase();
                if (v && !rates[v]) { setRates({ ...rates, [v]: 0 }); (e.target as HTMLInputElement).value = ""; }
              }
            }}
          />
          <span className="text-xs text-muted-foreground">Enter дарж нэмэх</span>
        </div>
        <Button onClick={() => onSave(rates)} size="sm"><Save className="h-4 w-4 mr-2" />Хадгалах</Button>
      </CardContent>
    </Card>
  );
}

function ProviderMarkupsCard({ config, onSave }: { config: any; onSave: (v: any) => void }) {
  const [markups, setMarkups] = useState<Record<string, number>>(config?.config_value || {});
  const [newKey, setNewKey] = useState("");
  useEffect(() => { if (config?.config_value) setMarkups(config.config_value); }, [config]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Нийлүүлэгчийн нэмэгдэл (%)</CardTitle>
        <CardDescription>Нийлүүлэгч бүрт тусгай markup хувь тохируулах</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.entries(markups).map(([key, val]) => (
          <div key={key} className="flex items-center gap-4">
            <Label className="w-32 capitalize">{key}</Label>
            <Input type="number" value={val} onChange={(e) => setMarkups({ ...markups, [key]: Number(e.target.value) })} className="w-32" />
            <span className="text-muted-foreground">%</span>
            {key !== "default" && (
              <Button variant="ghost" size="icon" onClick={() => { const m = { ...markups }; delete m[key]; setMarkups(m); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            )}
          </div>
        ))}
        <div className="flex items-center gap-2">
          <Input placeholder="Шинэ нийлүүлэгч" value={newKey} onChange={(e) => setNewKey(e.target.value)} className="w-48" />
          <Button variant="outline" size="sm" onClick={() => { if (newKey) { setMarkups({ ...markups, [newKey]: 15 }); setNewKey(""); } }}><Plus className="h-4 w-4 mr-1" />Нэмэх</Button>
        </div>
        <Button onClick={() => onSave(markups)} size="sm"><Save className="h-4 w-4 mr-2" />Хадгалах</Button>
      </CardContent>
    </Card>
  );
}

function RoundPricesCard({ config, onSave }: { config: any; onSave: (v: any) => void }) {
  const [val, setVal] = useState(config?.config_value || { enabled: true, precision: 0 });
  useEffect(() => { if (config?.config_value) setVal(config.config_value); }, [config]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Үнэ бүхэлчлэх</CardTitle>
        <CardDescription>Барааны үнийг бүхэл тоо руу бүхэлчлэх</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Switch checked={val.enabled} onCheckedChange={(c) => setVal({ ...val, enabled: c })} />
          <Label>Бүхэл тоо руу бүхэлчлэх</Label>
        </div>
        <Button onClick={() => onSave(val)} size="sm"><Save className="h-4 w-4 mr-2" />Хадгалах</Button>
      </CardContent>
    </Card>
  );
}

function PriceTiersCard({ config, onSave }: { config: any; onSave: (v: any) => void }) {
  const [tiers, setTiers] = useState<any[]>(config?.config_value?.tiers || []);
  useEffect(() => { if (config?.config_value?.tiers) setTiers(config.config_value.tiers); }, [config]);
  
  const updateTier = (i: number, field: string, val: any) => {
    const t = [...tiers]; t[i] = { ...t[i], [field]: val === "" ? null : Number(val) }; setTiers(t);
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Үнийн шатлал</CardTitle>
        <CardDescription>Үнийн хүрээн дээр тулгуурлан өөр markup тохируулах</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-[1fr_auto_1fr_1fr_auto] gap-2 items-center text-xs font-medium text-muted-foreground">
          <span>Мин (¥)</span><span></span><span>Макс (¥)</span><span>Markup %</span><span></span>
        </div>
        {tiers.map((t, i) => (
          <div key={i} className="grid grid-cols-[1fr_auto_1fr_1fr_auto] gap-2 items-center">
            <Input type="number" placeholder="0" value={t.min ?? ""} onChange={(e) => updateTier(i, "min", e.target.value)} />
            <span className="text-muted-foreground">→</span>
            <Input type="number" placeholder="∞" value={t.max ?? ""} onChange={(e) => updateTier(i, "max", e.target.value)} />
            <div className="flex items-center gap-1">
              <Input type="number" value={t.markup_pct} onChange={(e) => updateTier(i, "markup_pct", e.target.value)} />
              <span className="text-muted-foreground">%</span>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setTiers(tiers.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => setTiers([...tiers, { min: 0, max: null, markup_pct: 10 }])}><Plus className="h-4 w-4 mr-1" />Шатлал нэмэх</Button>
        <div><Button onClick={() => onSave({ tiers })} size="sm"><Save className="h-4 w-4 mr-2" />Хадгалах</Button></div>
      </CardContent>
    </Card>
  );
}

function DiscountRulesCard({ config, onSave }: { config: any; onSave: (v: any) => void }) {
  const [rules, setRules] = useState<any[]>(config?.config_value?.bulk_discount || []);
  useEffect(() => { if (config?.config_value?.bulk_discount) setRules(config.config_value.bulk_discount); }, [config]);
  
  const updateRule = (i: number, field: string, val: string) => {
    const r = [...rules]; r[i] = { ...r[i], [field]: Number(val) }; setRules(r);
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Хөнгөлөлтийн дүрэм</CardTitle>
        <CardDescription>Тоо хэмжээнээс хамаарсан хөнгөлөлт</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center text-xs font-medium text-muted-foreground">
          <span>Мин тоо хэмжээ</span><span>Хөнгөлөлт %</span><span></span>
        </div>
        {rules.map((r, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
            <Input type="number" value={r.min_qty} onChange={(e) => updateRule(i, "min_qty", e.target.value)} />
            <div className="flex items-center gap-1">
              <Input type="number" value={r.discount_pct} onChange={(e) => updateRule(i, "discount_pct", e.target.value)} />
              <span className="text-muted-foreground">%</span>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setRules(rules.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => setRules([...rules, { min_qty: 1, discount_pct: 5 }])}><Plus className="h-4 w-4 mr-1" />Дүрэм нэмэх</Button>
        <div><Button onClick={() => onSave({ bulk_discount: rules })} size="sm"><Save className="h-4 w-4 mr-2" />Хадгалах</Button></div>
      </CardContent>
    </Card>
  );
}
