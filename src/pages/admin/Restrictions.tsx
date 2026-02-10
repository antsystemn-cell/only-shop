import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Trash2, ShieldOff } from "lucide-react";

const restrictionTypes = [
  { value: "product", label: "Бараа хориглох" },
  { value: "category", label: "Ангилал нуух" },
  { value: "provider", label: "Нийлүүлэгч хориглох" },
];

export default function Restrictions() {
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({ restriction_type: "product", target_id: "", target_name: "", reason: "" });
  const queryClient = useQueryClient();

  const { data: restrictions } = useQuery({
    queryKey: ["admin", "restrictions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("catalog_restrictions").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const addMutation = useMutation({
    mutationFn: async (data: typeof form) => { const { error } = await supabase.from("catalog_restrictions").insert([data]); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin", "restrictions"] }); toast.success("Хязгаарлалт нэмэгдлээ"); setIsOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("catalog_restrictions").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin", "restrictions"] }); toast.success("Устгагдлаа"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold">Хязгаарлалт</h1><p className="text-muted-foreground mt-1">Бараа, ангилал, нийлүүлэгч хориглох</p></div>
        <Button onClick={() => { setForm({ restriction_type: "product", target_id: "", target_name: "", reason: "" }); setIsOpen(true); }}><Plus className="h-4 w-4 mr-2" />Хязгаарлалт нэмэх</Button>
      </div>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><ShieldOff className="h-5 w-5 text-primary" />Хязгаарлалтууд {restrictions && <Badge variant="secondary">{restrictions.length}</Badge>}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Төрөл</TableHead><TableHead>ID</TableHead><TableHead>Нэр</TableHead><TableHead>Шалтгаан</TableHead><TableHead className="text-right">Үйлдэл</TableHead></TableRow></TableHeader>
            <TableBody>
              {restrictions?.map((r) => (
                <TableRow key={r.id}>
                  <TableCell><Badge variant="outline">{restrictionTypes.find((t) => t.value === r.restriction_type)?.label}</Badge></TableCell>
                  <TableCell className="font-mono text-sm">{r.target_id}</TableCell>
                  <TableCell>{r.target_name || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{r.reason || "—"}</TableCell>
                  <TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => { if (confirm("Устгах уу?")) deleteMutation.mutate(r.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                </TableRow>
              ))}
              {(!restrictions || restrictions.length === 0) && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Хязгаарлалт олдсонгүй</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Хязгаарлалт нэмэх</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); addMutation.mutate(form); }} className="space-y-4">
            <div className="space-y-2">
              <Label>Төрөл</Label>
              <Select value={form.restriction_type} onValueChange={(v) => setForm({ ...form, restriction_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{restrictionTypes.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>ID *</Label><Input value={form.target_id} onChange={(e) => setForm({ ...form, target_id: e.target.value })} required /></div>
            <div className="space-y-2"><Label>Нэр</Label><Input value={form.target_name} onChange={(e) => setForm({ ...form, target_name: e.target.value })} /></div>
            <div className="space-y-2"><Label>Шалтгаан</Label><Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Болих</Button>
              <Button type="submit" disabled={addMutation.isPending}>Нэмэх</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
