import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Package, Pencil, Plus, Search, Warehouse } from "lucide-react";
import { toast } from "sonner";

interface WarehouseItem {
  id: string;
  item_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  images: string[];
  price_mnt: number;
  original_price_mnt: number | null;
  stock: number;
  is_active: boolean;
  provider_type: string;
  created_at: string;
  updated_at: string;
}

function formatMnt(v: number) {
  return new Intl.NumberFormat("mn-MN").format(Math.round(v)) + "₮";
}

export default function OtWarehouse() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editItem, setEditItem] = useState<WarehouseItem | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const { data: items = [], isLoading } = useQuery<WarehouseItem[]>({
    queryKey: ["admin", "warehouse-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("warehouse_items")
        .select("*")
        .order("item_id", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as WarehouseItem[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (item: Partial<WarehouseItem> & { id?: string }) => {
      if (item.id) {
        const { error } = await supabase
          .from("warehouse_items")
          .update({
            title: item.title,
            description: item.description,
            image_url: item.image_url,
            price_mnt: item.price_mnt,
            original_price_mnt: item.original_price_mnt,
            stock: item.stock,
            is_active: item.is_active,
          })
          .eq("id", item.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("warehouse_items")
          .insert({
            item_id: item.item_id,
            title: item.title || "",
            description: item.description,
            image_url: item.image_url,
            price_mnt: item.price_mnt || 0,
            original_price_mnt: item.original_price_mnt,
            stock: item.stock || 0,
            is_active: item.is_active ?? true,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "warehouse-items"] });
      toast.success("Амжилттай хадгаллаа");
      setEditItem(null);
      setShowAdd(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = items.filter(
    (i) =>
      i.item_id.toLowerCase().includes(search.toLowerCase()) ||
      i.title.toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = items.filter((i) => i.is_active).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Агуулахын бараа</h1>
          <p className="text-muted-foreground mt-1">
            Гараар оруулсан бараанууд (wh- prefix), өөрийн ₮ үнэтэй
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Шинэ бараа
        </Button>
      </div>

      {/* Summary */}
      {!isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{items.length}</div>
              <p className="text-xs text-muted-foreground">Нийт бараа</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{activeCount}</div>
              <p className="text-xs text-muted-foreground">Идэвхтэй</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">
                {items.filter((i) => !i.title || i.price_mnt <= 0).length}
              </div>
              <p className="text-xs text-muted-foreground">Мэдээлэл дутуу</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Бараанууд
            {items.length > 0 && <Badge variant="secondary">{filtered.length}/{items.length}</Badge>}
          </CardTitle>
          <div className="relative mt-2">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="ID эсвэл нэрээр хайх..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-muted-foreground">
              <Warehouse className="h-12 w-12 mb-3 opacity-50" />
              <p>{items.length === 0 ? "Агуулахад бараа байхгүй" : "Хайлтад тохирох бараа олдсонгүй"}</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-auto max-h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Зураг</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>Нэр</TableHead>
                    <TableHead className="text-right">Үнэ (₮)</TableHead>
                    <TableHead className="text-center">Үлдэгдэл</TableHead>
                    <TableHead className="text-center">Төлөв</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((item) => (
                    <TableRow
                      key={item.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setEditItem(item)}
                    >
                      <TableCell>
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt=""
                            className="w-10 h-10 object-cover rounded border"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-muted rounded flex items-center justify-center">
                            <Package className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{item.item_id}</TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {item.title || <span className="text-muted-foreground italic">Нэргүй</span>}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {item.price_mnt > 0 ? formatMnt(item.price_mnt) : (
                          <span className="text-destructive text-xs">Тохируулаагүй</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">{item.stock}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={item.is_active ? "default" : "secondary"}>
                          {item.is_active ? "Идэвхтэй" : "Идэвхгүй"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Pencil className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      {editItem && (
        <WarehouseItemDialog
          item={editItem}
          open
          onClose={() => setEditItem(null)}
          onSave={(data) => saveMutation.mutate({ ...data, id: editItem.id })}
          saving={saveMutation.isPending}
        />
      )}

      {/* Add Dialog */}
      {showAdd && (
        <WarehouseItemDialog
          open
          onClose={() => setShowAdd(false)}
          onSave={(data) => saveMutation.mutate(data)}
          saving={saveMutation.isPending}
        />
      )}
    </div>
  );
}

// ─── Edit/Add Dialog ─────────────────────────────────────────

function WarehouseItemDialog({
  item,
  open,
  onClose,
  onSave,
  saving,
}: {
  item?: WarehouseItem;
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<WarehouseItem>) => void;
  saving: boolean;
}) {
  const [itemId, setItemId] = useState(item?.item_id || "wh-");
  const [title, setTitle] = useState(item?.title || "");
  const [description, setDescription] = useState(item?.description || "");
  const [imageUrl, setImageUrl] = useState(item?.image_url || "");
  const [priceMnt, setPriceMnt] = useState(String(item?.price_mnt || ""));
  const [originalPriceMnt, setOriginalPriceMnt] = useState(
    item?.original_price_mnt ? String(item.original_price_mnt) : ""
  );
  const [stock, setStock] = useState(String(item?.stock ?? 0));
  const [isActive, setIsActive] = useState(item?.is_active ?? true);

  const isNew = !item;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isNew ? "Шинэ агуулахын бараа нэмэх" : `Засах: ${item.item_id}`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {isNew && (
            <div>
              <Label>Барааны ID (wh-...)</Label>
              <Input value={itemId} onChange={(e) => setItemId(e.target.value)} placeholder="wh-123456" />
            </div>
          )}

          <div>
            <Label>Нэр</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Барааны нэр" />
          </div>

          <div>
            <Label>Тайлбар</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Барааны тайлбар..."
              rows={3}
            />
          </div>

          <div>
            <Label>Зургийн URL</Label>
            <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
            {imageUrl && (
              <img src={imageUrl} alt="preview" className="w-20 h-20 object-cover rounded border mt-2" />
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Үнэ (₮)</Label>
              <Input
                type="number"
                value={priceMnt}
                onChange={(e) => setPriceMnt(e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <Label>Хуучин үнэ (₮) - заавал биш</Label>
              <Input
                type="number"
                value={originalPriceMnt}
                onChange={(e) => setOriginalPriceMnt(e.target.value)}
                placeholder="Хямдралын өмнөх үнэ"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Үлдэгдэл</Label>
              <Input
                type="number"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <Label>Идэвхтэй</Label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Болих
          </Button>
          <Button
            disabled={saving || (!isNew && false) || (isNew && !itemId.startsWith("wh-"))}
            onClick={() =>
              onSave({
                item_id: itemId,
                title,
                description: description || null,
                image_url: imageUrl || null,
                price_mnt: Number(priceMnt) || 0,
                original_price_mnt: originalPriceMnt ? Number(originalPriceMnt) : null,
                stock: Number(stock) || 0,
                is_active: isActive,
              })
            }
          >
            {saving ? "Хадгалж байна..." : "Хадгалах"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
