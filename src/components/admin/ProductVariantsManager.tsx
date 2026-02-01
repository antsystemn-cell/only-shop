import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Loader2, Palette, Ruler, Box } from "lucide-react";

interface ProductVariant {
  id: string;
  product_id: string;
  size: string | null;
  color: string | null;
  color_hex: string | null;
  dimensions: string | null;
  price_adjustment: number;
  stock: number;
  sku_suffix: string | null;
  is_active: boolean;
  display_order: number;
}

interface ProductVariantsManagerProps {
  productId: string;
  productName: string;
}

export function ProductVariantsManager({ productId, productName }: ProductVariantsManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null);
  const [formData, setFormData] = useState({
    size: "",
    color: "",
    color_hex: "#000000",
    dimensions: "",
    price_adjustment: "0",
    stock: "0",
    sku_suffix: "",
    is_active: true,
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch variants for this product
  const { data: variants, isLoading } = useQuery({
    queryKey: ["admin", "product-variants", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_variants")
        .select("*")
        .eq("product_id", productId)
        .order("display_order");
      if (error) throw error;
      return data as ProductVariant[];
    },
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData & { id?: string }) => {
      const variantData = {
        product_id: productId,
        size: data.size || null,
        color: data.color || null,
        color_hex: data.color_hex || null,
        dimensions: data.dimensions || null,
        price_adjustment: parseFloat(data.price_adjustment) || 0,
        stock: parseInt(data.stock) || 0,
        sku_suffix: data.sku_suffix || null,
        is_active: data.is_active,
      };

      if (data.id) {
        const { error } = await supabase
          .from("product_variants")
          .update(variantData)
          .eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("product_variants")
          .insert([variantData]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "product-variants", productId] });
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: editingVariant ? "Variant шинэчлэгдлээ" : "Variant нэмэгдлээ",
        description: "Амжилттай хадгаллаа",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Алдаа гарлаа",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("product_variants")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "product-variants", productId] });
      toast({
        title: "Variant устгагдлаа",
        description: "Амжилттай устгалаа",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Алдаа гарлаа",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      size: "",
      color: "",
      color_hex: "#000000",
      dimensions: "",
      price_adjustment: "0",
      stock: "0",
      sku_suffix: "",
      is_active: true,
    });
    setEditingVariant(null);
  };

  const handleEdit = (variant: ProductVariant) => {
    setEditingVariant(variant);
    setFormData({
      size: variant.size || "",
      color: variant.color || "",
      color_hex: variant.color_hex || "#000000",
      dimensions: variant.dimensions || "",
      price_adjustment: variant.price_adjustment.toString(),
      stock: variant.stock.toString(),
      sku_suffix: variant.sku_suffix || "",
      is_active: variant.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({
      ...formData,
      id: editingVariant?.id,
    });
  };

  const handleDelete = (id: string) => {
    if (confirm("Энэ variant-ыг устгахдаа итгэлтэй байна уу?")) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Box className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Хувилбарууд (Размер, Өнгө, Хэмжээ)</h3>
          {variants && <Badge variant="secondary">{variants.length}</Badge>}
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-1" />
              Хувилбар нэмэх
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingVariant ? "Хувилбар засах" : "Шинэ хувилбар нэмэх"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="grid gap-4 grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="size" className="flex items-center gap-1">
                    <Ruler className="h-3 w-3" />
                    Размер
                  </Label>
                  <Input
                    id="size"
                    value={formData.size}
                    onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                    placeholder="S, M, L, XL..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dimensions">Хэмжээ</Label>
                  <Input
                    id="dimensions"
                    value={formData.dimensions}
                    onChange={(e) => setFormData({ ...formData, dimensions: e.target.value })}
                    placeholder="10x20x5 см"
                  />
                </div>
              </div>

              <div className="grid gap-4 grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="color" className="flex items-center gap-1">
                    <Palette className="h-3 w-3" />
                    Өнгө
                  </Label>
                  <Input
                    id="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    placeholder="Улаан, Хар..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="color_hex">Өнгөний код</Label>
                  <div className="flex gap-2">
                    <Input
                      id="color_hex"
                      type="color"
                      value={formData.color_hex}
                      onChange={(e) => setFormData({ ...formData, color_hex: e.target.value })}
                      className="w-12 h-10 p-1 cursor-pointer"
                    />
                    <Input
                      value={formData.color_hex}
                      onChange={(e) => setFormData({ ...formData, color_hex: e.target.value })}
                      placeholder="#000000"
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="stock">Нөөц</Label>
                  <Input
                    id="stock"
                    type="number"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    placeholder="0"
                    min="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price_adjustment">Үнийн өөрчлөлт (₮)</Label>
                  <Input
                    id="price_adjustment"
                    type="number"
                    value={formData.price_adjustment}
                    onChange={(e) => setFormData({ ...formData, price_adjustment: e.target.value })}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sku_suffix">SKU дагавар</Label>
                <Input
                  id="sku_suffix"
                  value={formData.sku_suffix}
                  onChange={(e) => setFormData({ ...formData, sku_suffix: e.target.value })}
                  placeholder="-RED-M"
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="variant_is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="variant_is_active">Идэвхтэй</Label>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Болих
                </Button>
                <Button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="bg-primary hover:bg-primary/90"
                >
                  {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingVariant ? "Хадгалах" : "Нэмэх"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-4 text-muted-foreground">Уншиж байна...</div>
      ) : variants && variants.length > 0 ? (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Размер</TableHead>
                <TableHead>Өнгө</TableHead>
                <TableHead>Хэмжээ</TableHead>
                <TableHead className="text-center">Нөөц</TableHead>
                <TableHead className="text-right">Үнийн өөрчлөлт</TableHead>
                <TableHead className="text-center">Төлөв</TableHead>
                <TableHead className="text-right">Үйлдэл</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {variants.map((variant) => (
                <TableRow key={variant.id}>
                  <TableCell>
                    {variant.size ? (
                      <Badge variant="outline">{variant.size}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {variant.color ? (
                      <div className="flex items-center gap-2">
                        {variant.color_hex && (
                          <div
                            className="w-5 h-5 rounded-full border border-border"
                            style={{ backgroundColor: variant.color_hex }}
                          />
                        )}
                        <span>{variant.color}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {variant.dimensions || <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={variant.stock > 0 ? "secondary" : "destructive"}>
                      {variant.stock}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {variant.price_adjustment !== 0 ? (
                      <span className={variant.price_adjustment > 0 ? "text-green-600" : "text-red-600"}>
                        {variant.price_adjustment > 0 ? "+" : ""}{variant.price_adjustment.toLocaleString()}₮
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {variant.is_active ? (
                      <Badge className="bg-green-100 text-green-800">Идэвхтэй</Badge>
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
                        onClick={() => handleEdit(variant)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(variant.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-6 text-muted-foreground border rounded-lg bg-muted/30">
          <Box className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Хувилбар байхгүй байна</p>
          <p className="text-xs mt-1">Размер, өнгө, хэмжээ нэмэхийн тулд дээрх товчийг дарна уу</p>
        </div>
      )}
    </div>
  );
}
