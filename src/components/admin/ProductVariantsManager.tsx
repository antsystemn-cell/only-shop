import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
} from "@/components/ui/dialog";
import {
  VariantFormFields,
  VariantFormData,
  emptyVariantForm,
} from "./VariantFormFields";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Box,
  Image as ImageIcon,
} from "lucide-react";

interface ProductVariant {
  id: string;
  product_id: string;
  name: string | null;
  size: string | null;
  color: string | null;
  color_hex: string | null;
  dimensions: string | null;
  weight: string | null;
  price: number | null;
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
  basePrice?: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("mn-MN").format(amount) + "₮";
}

export function ProductVariantsManager({
  productId,
  productName,
  basePrice = 0,
}: ProductVariantsManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null);
  const [formData, setFormData] = useState<VariantFormData>({
    ...emptyVariantForm,
    price: basePrice.toString(),
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
    mutationFn: async (data: VariantFormData & { id?: string }) => {
      const variantData = {
        product_id: productId,
        name: data.name || null,
        size: data.size || null,
        color: data.color || null,
        color_hex: data.color_hex || null,
        dimensions: data.dimensions || null,
        weight: data.weight || null,
        price: parseFloat(data.price) || null,
        price_adjustment: 0, // Deprecated, keep at 0
        stock: parseInt(data.stock) || 0,
        sku_suffix: data.sku_suffix || null,
        is_active: data.is_active,
        images: data.images.length > 0 ? data.images : null,
      };

      if (data.id && !data.id.startsWith("local-")) {
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
      queryClient.invalidateQueries({
        queryKey: ["admin", "product-variants", productId],
      });
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: editingVariant ? "Хувилбар шинэчлэгдлээ" : "Хувилбар нэмэгдлээ",
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
      queryClient.invalidateQueries({
        queryKey: ["admin", "product-variants", productId],
      });
      toast({
        title: "Хувилбар устгагдлаа",
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
      ...emptyVariantForm,
      price: basePrice.toString(),
    });
    setEditingVariant(null);
  };

  const handleEdit = (variant: ProductVariant) => {
    setEditingVariant(variant);
    setFormData({
      id: variant.id,
      name: variant.name || "",
      size: variant.size || "",
      color: variant.color || "",
      color_hex: variant.color_hex || "#000000",
      dimensions: variant.dimensions || "",
      weight: variant.weight || "",
      price: (variant.price ?? basePrice).toString(),
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
    if (confirm("Энэ хувилбарыг устгахдаа итгэлтэй байна уу?")) {
      deleteMutation.mutate(id);
    }
  };

  const getVariantDisplayName = (v: ProductVariant) => {
    if (v.name) return v.name;
    const parts = [v.size, v.color, v.dimensions].filter(Boolean);
    return parts.length > 0 ? parts.join(" / ") : "Хувилбар";
  };

  const getVariantPrice = (v: ProductVariant) => {
    // Use absolute price if set, otherwise fall back to base + adjustment
    if (v.price !== null && v.price !== undefined) {
      return v.price;
    }
    return basePrice + (v.price_adjustment || 0);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Box className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Хувилбарууд</h3>
          {variants && <Badge variant="secondary">{variants.length}</Badge>}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            resetForm();
            setIsDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-1" />
          Хувилбар нэмэх
        </Button>
      </div>

      {/* Dialog for Add/Edit */}
      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>
              {editingVariant ? "Хувилбар засах" : "Шинэ хувилбар нэмэх"}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={handleSubmit}
            className="flex-1 overflow-y-auto space-y-4 py-4"
          >
            <VariantFormFields
              data={formData}
              onChange={setFormData}
              basePrice={basePrice}
            />
            <div className="flex justify-end gap-3 pt-4 border-t sticky bottom-0 bg-background">
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
                {saveMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {editingVariant ? "Хадгалах" : "Нэмэх"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="text-center py-4 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
          Уншиж байна...
        </div>
      ) : variants && variants.length > 0 ? (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-14">Зураг</TableHead>
                <TableHead>Нэр</TableHead>
                <TableHead>Хэмжээ/Өнгө</TableHead>
                <TableHead className="text-right">Үнэ</TableHead>
                <TableHead className="text-center">Нөөц</TableHead>
                <TableHead className="text-center">Төлөв</TableHead>
                <TableHead className="text-right w-24">Үйлдэл</TableHead>
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
                  <TableCell className="font-medium">
                    {getVariantDisplayName(variant)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {variant.color && variant.color_hex && (
                        <div
                          className="w-4 h-4 rounded-full border border-border"
                          style={{ backgroundColor: variant.color_hex }}
                        />
                      )}
                      <span className="text-sm text-muted-foreground">
                        {[variant.size, variant.color, variant.dimensions]
                          .filter(Boolean)
                          .join(" / ") || "—"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-semibold text-primary">
                    {formatCurrency(getVariantPrice(variant))}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant={variant.stock > 0 ? "secondary" : "destructive"}
                    >
                      {variant.stock}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {variant.is_active ? (
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
        <Card className="text-center py-8 text-muted-foreground bg-muted/30">
          <Box className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm font-medium">Хувилбар байхгүй</p>
          <p className="text-xs mt-1">
            Өнгө, хэмжээ, загвар нэмэхийн тулд дээрх товчийг дарна уу
          </p>
          <p className="text-xs mt-2 text-primary">
            Хувилбар бүр өөрийн үнэ, нөөцтэй байна
          </p>
        </Card>
      )}
    </div>
  );
}
