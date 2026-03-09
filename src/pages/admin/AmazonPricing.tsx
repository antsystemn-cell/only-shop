import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, DollarSign, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const FORMULA_TYPES = [
  { value: "passthrough", label: "Эх үнэ (шууд)" },
  { value: "fixed_markup", label: "Тогтмол нэмэгдэл" },
  { value: "percentage_markup", label: "Хувийн нэмэгдэл" },
];

const ROUNDING_RULES = [
  { value: "none", label: "Бөөрөнхийлөхгүй" },
  { value: "round_up_100", label: "100-аар дээшлүүлэх" },
  { value: "round_up_1000", label: "1000-аар дээшлүүлэх" },
  { value: "round_nearest_100", label: "100-д ойртуулах" },
];

export default function AmazonPricing() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);
  const [form, setForm] = useState({
    name: "",
    formula_type: "percentage_markup",
    formula_value: 20,
    min_margin: 0,
    rounding_rule: "round_up_100",
    brand: "",
    is_active: true,
  });

  const { data: rules, isLoading } = useQuery({
    queryKey: ["amazon-pricing-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("amazon_pricing_rules")
        .select("*")
        .order("priority", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingRule) {
        const { error } = await supabase
          .from("amazon_pricing_rules")
          .update({ ...form, updated_at: new Date().toISOString() })
          .eq("id", editingRule.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("amazon_pricing_rules").insert(form);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["amazon-pricing-rules"] });
      setDialogOpen(false);
      setEditingRule(null);
      toast({ title: "Үнийн дүрэм хадгалагдлаа" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("amazon_pricing_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["amazon-pricing-rules"] });
      toast({ title: "Устгагдлаа" });
    },
  });

  const openEdit = (rule: any) => {
    setEditingRule(rule);
    setForm({
      name: rule.name,
      formula_type: rule.formula_type,
      formula_value: rule.formula_value,
      min_margin: rule.min_margin || 0,
      rounding_rule: rule.rounding_rule || "round_up_100",
      brand: rule.brand || "",
      is_active: rule.is_active,
    });
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditingRule(null);
    setForm({ name: "", formula_type: "percentage_markup", formula_value: 20, min_margin: 0, rounding_rule: "round_up_100", brand: "", is_active: true });
    setDialogOpen(true);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center p-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Amazon үнийн дүрмүүд</h1>
          <p className="text-muted-foreground">Импортлогдсон барааны үнийг тооцоолох дүрмүүд</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Шинэ дүрэм</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingRule ? "Дүрэм засах" : "Шинэ үнийн дүрэм"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Нэр</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Жишээ: US Electronics 30%" />
              </div>
              <div className="space-y-2">
                <Label>Томьёоны төрөл</Label>
                <Select value={form.formula_type} onValueChange={(v) => setForm({ ...form, formula_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FORMULA_TYPES.map((f) => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Утга ({form.formula_type === "percentage_markup" ? "%" : "₮"})</Label>
                <Input
                  type="number"
                  value={form.formula_value}
                  onChange={(e) => setForm({ ...form, formula_value: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Хамгийн бага ашиг (%)</Label>
                <Input
                  type="number"
                  value={form.min_margin}
                  onChange={(e) => setForm({ ...form, min_margin: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Бөөрөнхийлөлт</Label>
                <Select value={form.rounding_rule} onValueChange={(v) => setForm({ ...form, rounding_rule: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROUNDING_RULES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Брэнд шүүлтүүр (заавал биш)</Label>
                <Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} placeholder="Apple, Samsung..." />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                <Label>Идэвхтэй</Label>
              </div>
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full">
                {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Хадгалах
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Үнийн дүрмүүд ({rules?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Нэр</TableHead>
                <TableHead>Томьёо</TableHead>
                <TableHead>Утга</TableHead>
                <TableHead>Мин. ашиг</TableHead>
                <TableHead>Бөөрөнхийлөлт</TableHead>
                <TableHead>Брэнд</TableHead>
                <TableHead>Идэвхтэй</TableHead>
                <TableHead>Үйлдэл</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules?.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium">{rule.name}</TableCell>
                  <TableCell>{FORMULA_TYPES.find((f) => f.value === rule.formula_type)?.label}</TableCell>
                  <TableCell>{rule.formula_value}{rule.formula_type === "percentage_markup" ? "%" : "₮"}</TableCell>
                  <TableCell>{rule.min_margin}%</TableCell>
                  <TableCell>{ROUNDING_RULES.find((r) => r.value === rule.rounding_rule)?.label}</TableCell>
                  <TableCell>{rule.brand || "Бүгд"}</TableCell>
                  <TableCell><Switch checked={rule.is_active ?? false} disabled /></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(rule)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(rule.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(!rules || rules.length === 0) && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Үнийн дүрэм үүсгээгүй байна
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
