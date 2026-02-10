import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Library } from "lucide-react";

export default function Collections() {
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", description: "", type: "manual", is_active: true, item_ids_text: "" });
  const queryClient = useQueryClient();

  const { data: collections, isLoading } = useQuery({
    queryKey: ["admin", "collections"],
    queryFn: async () => {
      const { data, error } = await supabase.from("catalog_collections").select("*").order("display_order");
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = { name: data.name, description: data.description, type: data.type, is_active: data.is_active, item_ids: data.item_ids_text ? data.item_ids_text.split(",").map((s: string) => s.trim()) : [] };
      if (data.id) {
        const { error } = await supabase.from("catalog_collections").update(payload).eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("catalog_collections").insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin", "collections"] }); toast.success("Хадгалагдлаа"); setIsOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("catalog_collections").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin", "collections"] }); toast.success("Устгагдлаа"); },
    onError: (e: any) => toast.error(e.message),
  });

  const handleOpen = (item?: any) => {
    if (item) { setEditing(item); setForm({ name: item.name, description: item.description || "", type: item.type, is_active: item.is_active, item_ids_text: (item.item_ids || []).join(", ") }); }
    else { setEditing(null); setForm({ name: "", description: "", type: "manual", is_active: true, item_ids_text: "" }); }
    setIsOpen(true);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold">Цуглуулга</h1><p className="text-muted-foreground mt-1">Онцлох бараа, тусгай цуглуулга</p></div>
        <Button onClick={() => handleOpen()}><Plus className="h-4 w-4 mr-2" />Цуглуулга нэмэх</Button>
      </div>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Library className="h-5 w-5 text-primary" />Цуглуулгууд {collections && <Badge variant="secondary">{collections.length}</Badge>}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Нэр</TableHead><TableHead>Төрөл</TableHead><TableHead className="text-center">Барааны тоо</TableHead><TableHead className="text-center">Идэвхтэй</TableHead><TableHead className="text-right">Үйлдэл</TableHead></TableRow></TableHeader>
            <TableBody>
              {collections?.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell><Badge variant="outline">{c.type === "manual" ? "Гараар" : "Дүрмээр"}</Badge></TableCell>
                  <TableCell className="text-center">{(c.item_ids as string[] | null)?.length || 0}</TableCell>
                  <TableCell className="text-center"><Badge className={c.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>{c.is_active ? "Тийм" : "Үгүй"}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleOpen(c)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm("Устгах уу?")) deleteMutation.mutate(c.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {(!collections || collections.length === 0) && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Цуглуулга олдсонгүй</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Цуглуулга засах" : "Шинэ цуглуулга"}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate({ ...form, ...(editing ? { id: editing.id } : {}) }); }} className="space-y-4">
            <div className="space-y-2"><Label>Нэр *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div className="space-y-2"><Label>Тайлбар</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="space-y-2"><Label>Бараа ID-ууд (таслалаар)</Label><Textarea value={form.item_ids_text} onChange={(e) => setForm({ ...form, item_ids_text: e.target.value })} placeholder="item1, item2, item3" /></div>
            <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={(c) => setForm({ ...form, is_active: c })} /><Label>Идэвхтэй</Label></div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Болих</Button>
              <Button type="submit" disabled={saveMutation.isPending}>{editing ? "Хадгалах" : "Нэмэх"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
