import { useState, useRef } from "react";
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
import { Plus, Pencil, Trash2, Loader2, Palette, Ruler, Box, Scale, ImagePlus, X, Image as ImageIcon } from "lucide-react";

interface ProductVariant {
  id: string;
  product_id: string;
  size: string | null;
  color: string | null;
  color_hex: string | null;
  dimensions: string | null;
  weight: string | null;
  price_adjustment: number;
  stock: number;
  sku_suffix: string | null;
  is_active: boolean;
  display_order: number;
  images: string[] | null;
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
    weight: "",
    price_adjustment: "0",
    stock: "0",
    sku_suffix: "",
    is_active: true,
    images: [] as string[],
  });
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        weight: data.weight || null,
        price_adjustment: parseFloat(data.price_adjustment) || 0,
        stock: parseInt(data.stock) || 0,
        sku_suffix: data.sku_suffix || null,
        is_active: data.is_active,
        images: data.images.length > 0 ? data.images : null,
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
      weight: "",
      price_adjustment: "0",
      stock: "0",
      sku_suffix: "",
      is_active: true,
      images: [],
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
      weight: variant.weight || "",
      price_adjustment: variant.price_adjustment.toString(),
      stock: variant.stock.toString(),
      sku_suffix: variant.sku_suffix || "",
      is_active: variant.is_active,
      images: variant.images || [],
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const newImages: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split(".").pop();
        const fileName = `${productId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("products")
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("products")
          .getPublicUrl(fileName);

        newImages.push(urlData.publicUrl);
      }

      setFormData((prev) => ({
        ...prev,
        images: [...prev.images, ...newImages],
      }));

      toast({
        title: "Зураг нэмэгдлээ",
        description: `${newImages.length} зураг амжилттай upload хийгдлээ`,
      });
    } catch (error: any) {
      toast({
        title: "Алдаа гарлаа",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const removeImage = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
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
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingVariant ? "Хувилбар засах" : "Шинэ хувилбар нэмэх"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              {/* Images Section */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <ImageIcon className="h-3 w-3" />
                  Хувилбарын зургууд
                </Label>
                <div className="flex flex-wrap gap-2">
                  {formData.images.map((image, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={image}
                        alt={`Variant image ${index + 1}`}
                        className="w-16 h-16 object-cover rounded-lg border"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <label className="w-16 h-16 flex items-center justify-center border-2 border-dashed border-muted-foreground/30 rounded-lg cursor-pointer hover:border-primary transition-colors">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageUpload}
                      className="hidden"
                      disabled={isUploading}
                    />
                    {isUploading ? (
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    ) : (
                      <ImagePlus className="h-5 w-5 text-muted-foreground" />
                    )}
                  </label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Хувилбарт зориулсан зураг оруулна уу (олон зураг сонгож болно)
                </p>
              </div>

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
                  <Label htmlFor="dimensions">Хэмжээ (урт x өргөн)</Label>
                  <Input
                    id="dimensions"
                    value={formData.dimensions}
                    onChange={(e) => setFormData({ ...formData, dimensions: e.target.value })}
                    placeholder="10x20x5 см"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="weight" className="flex items-center gap-1">
                  <Scale className="h-3 w-3" />
                  Жин
                </Label>
                <Input
                  id="weight"
                  value={formData.weight}
                  onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                  placeholder="500г, 1кг..."
                />
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
                  disabled={saveMutation.isPending || isUploading}
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
                <TableHead className="w-16">Зураг</TableHead>
                <TableHead>Размер</TableHead>
                <TableHead>Өнгө</TableHead>
                <TableHead>Хэмжээ</TableHead>
                <TableHead>Жин</TableHead>
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
                    {variant.images && variant.images.length > 0 ? (
                      <img
                        src={variant.images[0]}
                        alt="Variant"
                        className="w-10 h-10 object-cover rounded"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-muted rounded flex items-center justify-center">
                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </TableCell>
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
                  <TableCell>
                    {variant.weight || <span className="text-muted-foreground">—</span>}
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
