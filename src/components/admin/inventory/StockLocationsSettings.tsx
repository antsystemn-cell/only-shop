import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, MapPin, Loader2 } from "lucide-react";

interface StockLocation {
  id: string;
  name: string;
  description: string | null;
  color: string;
  is_active: boolean;
  display_order: number;
}

interface FormData {
  name: string;
  description: string;
  color: string;
  is_active: boolean;
  display_order: number;
}

const emptyForm: FormData = {
  name: "",
  description: "",
  color: "#625AFA",
  is_active: true,
  display_order: 0,
};

export default function StockLocationsSettings() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<StockLocation | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);

  const { data: locations, isLoading } = useQuery({
    queryKey: ["admin", "stock-locations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_locations")
        .select("*")
        .order("display_order");
      if (error) throw error;
      return data as StockLocation[];
    },
  });

  const { data: stockCounts } = useQuery({
    queryKey: ["admin", "stock-locations", "counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_location_stock")
        .select("location_id, quantity");
      if (error) throw error;
      const map: Record<string, { total: number; products: number }> = {};
      (data || []).forEach((row: any) => {
        if (!map[row.location_id]) map[row.location_id] = { total: 0, products: 0 };
        map[row.location_id].total += row.quantity || 0;
        map[row.location_id].products += 1;
      });
      return map;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        description: form.description || null,
        color: form.color,
        is_active: form.is_active,
        display_order: form.display_order,
      };
      if (editing) {
        const { error } = await supabase
          .from("stock_locations")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("stock_locations").insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "stock-locations"] });
      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
      toast({ title: editing ? "Шинэчиллээ" : "Нэмэгдлээ" });
    },
    onError: (e: any) =>
      toast({ title: "Алдаа", description: e.message, variant: "destructive" }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("stock_locations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "stock-locations"] });
      toast({ title: "Устгалаа" });
    },
    onError: (e: any) =>
      toast({ title: "Алдаа", description: e.message, variant: "destructive" }),
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, display_order: (locations?.length || 0) + 1 });
    setOpen(true);
  };

  const openEdit = (loc: StockLocation) => {
    setEditing(loc);
    setForm({
      name: loc.name,
      description: loc.description || "",
      color: loc.color || "#625AFA",
      is_active: loc.is_active,
      display_order: loc.display_order,
    });
    setOpen(true);
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" /> Барааны байршлууд
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Агуулах салбар, жолоочид өгсөн, замд яваа гэх мэт байршлуудаа удирдана уу.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-1" /> Байршил нэмэх
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editing ? "Байршил засах" : "Шинэ байршил"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="space-y-1">
                  <Label>Нэр *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Жишээ: Агуулах салбар"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Тайлбар</Label>
                  <Textarea
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                    placeholder="Нэмэлт тэмдэглэл"
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Өнгө</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={form.color}
                        onChange={(e) =>
                          setForm({ ...form, color: e.target.value })
                        }
                        className="w-12 h-10 p-1 cursor-pointer"
                      />
                      <Input
                        value={form.color}
                        onChange={(e) =>
                          setForm({ ...form, color: e.target.value })
                        }
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Эрэмбэ</Label>
                    <Input
                      type="number"
                      value={form.display_order}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          display_order: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.is_active}
                    onCheckedChange={(c) => setForm({ ...form, is_active: c })}
                  />
                  <Label>Идэвхтэй</Label>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setOpen(false)}>
                    Болих
                  </Button>
                  <Button
                    onClick={() => save.mutate()}
                    disabled={!form.name || save.isPending}
                  >
                    {save.isPending && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    Хадгалах
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mx-auto" />
          </div>
        ) : !locations || locations.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">
            Байршил алга. Дээрх товчоор нэмнэ үү.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Нэр</TableHead>
                <TableHead>Тайлбар</TableHead>
                <TableHead className="text-center">Бараа</TableHead>
                <TableHead className="text-right">Нийт ширхэг</TableHead>
                <TableHead className="text-center">Төлөв</TableHead>
                <TableHead className="text-right w-24">Үйлдэл</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {locations.map((loc) => {
                const stats = stockCounts?.[loc.id];
                return (
                  <TableRow key={loc.id}>
                    <TableCell>{loc.display_order}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: loc.color }}
                        />
                        <span className="font-medium">{loc.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {loc.description || "—"}
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      {stats?.products || 0}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {stats?.total || 0}
                    </TableCell>
                    <TableCell className="text-center">
                      {loc.is_active ? (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                          Идэвхтэй
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Идэвхгүй</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(loc)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => {
                            if (
                              confirm(
                                `"${loc.name}" байршлыг устгах уу? Холбогдох үлдэгдлийн бүртгэл бас устгагдана.`
                              )
                            )
                              del.mutate(loc.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
