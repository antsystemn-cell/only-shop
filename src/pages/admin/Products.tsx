import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { ProductImageUpload } from "@/components/admin/ProductImageUpload";
import { ProductVariantsManager } from "@/components/admin/ProductVariantsManager";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Package,
  Star,
  Loader2,
  Box,
  ImagePlus,
  X,
  Image as ImageIcon,
} from "lucide-react";

interface Product {
  id: string;
  name: string;
  name_mn: string;
  description_mn: string | null;
  price: number;
  compare_price: number | null;
  stock: number;
  sku: string | null;
  brand: string | null;
  images: string[];
  is_featured: boolean;
  is_active: boolean;
  rating: number;
  review_count: number;
  category_id: string | null;
  categories?: {
    name_mn: string;
  } | null;
}

interface Category {
  id: string;
  name: string;
  name_mn: string;
}

interface Brand {
  id: string;
  name: string;
}

// Local variant type for creating new product with variants
interface LocalVariant {
  id: string; // temporary local id
  size: string;
  color: string;
  color_hex: string;
  dimensions: string;
  style: string;
  price_adjustment: string;
  stock: string;
  sku_suffix: string;
  is_active: boolean;
  images: string[];
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("mn-MN").format(amount) + "₮";
}

export default function Products() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name_mn: "",
    description_mn: "",
    price: "",
    compare_price: "",
    stock: "",
    sku: "",
    brand: "",
    category_id: "",
    is_featured: false,
    is_active: true,
    images: [] as string[],
  });

  // Local variants for new product creation
  const [localVariants, setLocalVariants] = useState<LocalVariant[]>([]);
  const [showVariantForm, setShowVariantForm] = useState(false);
  const [variantFormData, setVariantFormData] = useState<LocalVariant>({
    id: "",
    size: "",
    color: "",
    color_hex: "#000000",
    dimensions: "",
    style: "",
    price_adjustment: "0",
    stock: "0",
    sku_suffix: "",
    is_active: true,
    images: [],
  });
  const [isVariantImageUploading, setIsVariantImageUploading] = useState(false);
  const [editingLocalVariant, setEditingLocalVariant] = useState<string | null>(null);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch products
  const { data: products, isLoading } = useQuery({
    queryKey: ["admin", "products", searchQuery],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select(`
          *,
          categories (
            name_mn
          )
        `)
        .order("created_at", { ascending: false });

      if (searchQuery) {
        query = query.or(`name_mn.ilike.%${searchQuery}%,sku.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Product[];
    },
  });

  // Fetch categories for dropdown
  const { data: categories } = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, name_mn")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data as Category[];
    },
  });

  // Fetch brands for dropdown
  const { data: brands } = useQuery({
    queryKey: ["admin", "brands-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brands")
        .select("id, name")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data as Brand[];
    },
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData & { id?: string; variants?: LocalVariant[] }) => {
      const productData = {
        name: data.name_mn, // Use Mongolian name as primary
        name_mn: data.name_mn,
        description_mn: data.description_mn || null,
        price: parseFloat(data.price) || 0,
        compare_price: data.compare_price ? parseFloat(data.compare_price) : null,
        stock: parseInt(data.stock) || 0,
        sku: data.sku || null,
        brand: data.brand || null,
        category_id: data.category_id || null,
        is_featured: data.is_featured,
        is_active: data.is_active,
        images: data.images,
      };

      let productId = data.id;

      if (data.id) {
        const { error } = await supabase
          .from("products")
          .update(productData)
          .eq("id", data.id);
        if (error) throw error;
      } else {
        const { data: newProduct, error } = await supabase
          .from("products")
          .insert([productData])
          .select("id")
          .single();
        if (error) throw error;
        productId = newProduct.id;
      }

      // Save variants for new product
      if (!data.id && data.variants && data.variants.length > 0 && productId) {
        const variantsToInsert = data.variants.map((v, index) => ({
          product_id: productId,
          size: v.size || null,
          color: v.color || null,
          color_hex: v.color_hex || null,
          dimensions: v.dimensions || null,
          price_adjustment: parseFloat(v.price_adjustment) || 0,
          stock: parseInt(v.stock) || 0,
          sku_suffix: v.sku_suffix || null,
          is_active: v.is_active,
          display_order: index,
          images: v.images.length > 0 ? v.images : null,
        }));

        const { error: variantError } = await supabase
          .from("product_variants")
          .insert(variantsToInsert);
        if (variantError) throw variantError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: editingProduct ? "Бараа шинэчлэгдлээ" : "Бараа нэмэгдлээ",
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
        .from("products")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      toast({
        title: "Бараа устгагдлаа",
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
      name_mn: "",
      description_mn: "",
      price: "",
      compare_price: "",
      stock: "",
      sku: "",
      brand: "",
      category_id: "",
      is_featured: false,
      is_active: true,
      images: [],
    });
    setEditingProduct(null);
    setLocalVariants([]);
    setShowVariantForm(false);
    setEditingLocalVariant(null);
    resetVariantForm();
  };

  const resetVariantForm = () => {
    setVariantFormData({
      id: "",
      size: "",
      color: "",
      color_hex: "#000000",
      dimensions: "",
      style: "",
      price_adjustment: "0",
      stock: "0",
      sku_suffix: "",
      is_active: true,
      images: [],
    });
  };

  const handleVariantImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsVariantImageUploading(true);
    const newImages: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split(".").pop();
        const fileName = `variants/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("products")
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("products")
          .getPublicUrl(fileName);

        newImages.push(urlData.publicUrl);
      }

      setVariantFormData((prev) => ({
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
      setIsVariantImageUploading(false);
    }
  };

  const removeVariantImage = (index: number) => {
    setVariantFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const handleAddLocalVariant = () => {
    if (editingLocalVariant) {
      setLocalVariants(prev => 
        prev.map(v => v.id === editingLocalVariant ? { ...variantFormData, id: editingLocalVariant } : v)
      );
      setEditingLocalVariant(null);
    } else {
      const newVariant: LocalVariant = {
        ...variantFormData,
        id: `local-${Date.now()}`,
      };
      setLocalVariants(prev => [...prev, newVariant]);
    }
    resetVariantForm();
    setShowVariantForm(false);
  };

  const handleEditLocalVariant = (variant: LocalVariant) => {
    setVariantFormData(variant);
    setEditingLocalVariant(variant.id);
    setShowVariantForm(true);
  };

  const handleDeleteLocalVariant = (id: string) => {
    setLocalVariants(prev => prev.filter(v => v.id !== id));
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name_mn: product.name_mn,
      description_mn: product.description_mn || "",
      price: product.price.toString(),
      compare_price: product.compare_price?.toString() || "",
      stock: product.stock.toString(),
      sku: product.sku || "",
      brand: product.brand || "",
      category_id: product.category_id || "",
      is_featured: product.is_featured,
      is_active: product.is_active,
      images: product.images || [],
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({
      ...formData,
      id: editingProduct?.id,
      variants: localVariants,
    });
  };

  const handleDelete = (id: string) => {
    if (confirm("Энэ барааг устгахдаа итгэлтэй байна уу?")) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Бараа удирдах</h1>
          <p className="text-muted-foreground mt-1">
            Бүтээгдэхүүнүүдийг удирдах
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" />
              Бараа нэмэх
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingProduct ? "Бараа засах" : "Шинэ бараа нэмэх"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name_mn">Барааны нэр *</Label>
                  <Input
                    id="name_mn"
                    value={formData.name_mn}
                    onChange={(e) => setFormData({ ...formData, name_mn: e.target.value })}
                    placeholder="iPhone 15 Pro Max"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Ангилал</Label>
                  <Select
                    value={formData.category_id}
                    onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Ангилал сонгох" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories?.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name_mn}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description_mn">Тайлбар</Label>
                <Textarea
                  id="description_mn"
                  value={formData.description_mn}
                  onChange={(e) => setFormData({ ...formData, description_mn: e.target.value })}
                  placeholder="Барааны тайлбар..."
                  rows={3}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="price">Үнэ (₮) *</Label>
                  <Input
                    id="price"
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="0"
                    min="0"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="compare_price">Хуучин үнэ (₮)</Label>
                  <Input
                    id="compare_price"
                    type="number"
                    value={formData.compare_price}
                    onChange={(e) => setFormData({ ...formData, compare_price: e.target.value })}
                    placeholder="0"
                    min="0"
                  />
                </div>
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
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="sku">SKU</Label>
                  <Input
                    id="sku"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    placeholder="ELEC-001"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="brand">Брэнд</Label>
                  <Select
                    value={formData.brand}
                    onValueChange={(value) => setFormData({ ...formData, brand: value === "none" ? "" : value })}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Брэнд сонгох..." />
                    </SelectTrigger>
                    <SelectContent className="bg-background border shadow-lg z-50">
                      <SelectItem value="none">Брэндгүй</SelectItem>
                      {brands?.map((brand) => (
                        <SelectItem key={brand.id} value={brand.name}>
                          {brand.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Product Images Upload */}
              <div className="border rounded-lg p-4 bg-muted/30">
                <ProductImageUpload
                  images={formData.images}
                  onImagesChange={(images) => setFormData({ ...formData, images })}
                  maxImages={5}
                />
              </div>

              <div className="flex gap-6">
                <div className="flex items-center gap-2">
                  <Switch
                    id="is_featured"
                    checked={formData.is_featured}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_featured: checked })}
                  />
                  <Label htmlFor="is_featured">Онцлох бараа</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                  <Label htmlFor="is_active">Идэвхтэй</Label>
                </div>
              </div>

              {/* Product Variants - Show different UI for new vs existing product */}
              {editingProduct ? (
                <div className="border-t pt-4 mt-4">
                  <ProductVariantsManager 
                    productId={editingProduct.id} 
                    productName={editingProduct.name_mn} 
                  />
                </div>
              ) : (
                <div className="border-t pt-4 mt-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Box className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">Хувилбарууд (Загвар, Өнгө, Хэмжээ)</h3>
                      {localVariants.length > 0 && (
                        <Badge variant="secondary">{localVariants.length}</Badge>
                      )}
                    </div>
                    <Button 
                      type="button" 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        setShowVariantForm(true);
                        setEditingLocalVariant(null);
                        resetVariantForm();
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Хувилбар нэмэх
                    </Button>
                  </div>

                  {/* Variant Form */}
                  {showVariantForm && (
                    <div className="border rounded-lg p-4 bg-muted/30 mb-4 space-y-4">
                      {/* Images Section */}
                      <div className="space-y-2">
                        <Label className="flex items-center gap-1">
                          <ImageIcon className="h-3 w-3" />
                          Хувилбарын зургууд
                        </Label>
                        <div className="flex flex-wrap gap-2">
                          {variantFormData.images.map((image, index) => (
                            <div key={index} className="relative group">
                              <img
                                src={image}
                                alt={`Variant image ${index + 1}`}
                                className="w-16 h-16 object-cover rounded-lg border"
                              />
                              <button
                                type="button"
                                onClick={() => removeVariantImage(index)}
                                className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                          <label className="w-16 h-16 flex items-center justify-center border-2 border-dashed border-muted-foreground/30 rounded-lg cursor-pointer hover:border-primary transition-colors">
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={handleVariantImageUpload}
                              className="hidden"
                              disabled={isVariantImageUploading}
                            />
                            {isVariantImageUploading ? (
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

                      <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
                        <div className="space-y-2">
                          <Label htmlFor="var_style" className="flex items-center gap-1">
                            <Box className="h-3 w-3" />
                            Загвар
                          </Label>
                          <Input
                            id="var_style"
                            value={variantFormData.style}
                            onChange={(e) => setVariantFormData({ ...variantFormData, style: e.target.value })}
                            placeholder="Pro, Max, Ultra..."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="var_size">Размер</Label>
                          <Input
                            id="var_size"
                            value={variantFormData.size}
                            onChange={(e) => setVariantFormData({ ...variantFormData, size: e.target.value })}
                            placeholder="S, M, L, XL..."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="var_dimensions">Хэмжээ</Label>
                          <Input
                            id="var_dimensions"
                            value={variantFormData.dimensions}
                            onChange={(e) => setVariantFormData({ ...variantFormData, dimensions: e.target.value })}
                            placeholder="128GB, 256GB..."
                          />
                        </div>
                      </div>

                      <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
                        <div className="space-y-2">
                          <Label htmlFor="var_color">Өнгө</Label>
                          <Input
                            id="var_color"
                            value={variantFormData.color}
                            onChange={(e) => setVariantFormData({ ...variantFormData, color: e.target.value })}
                            placeholder="Улаан, Хар..."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="var_color_hex">Өнгөний код</Label>
                          <div className="flex gap-2">
                            <Input
                              id="var_color_hex"
                              type="color"
                              value={variantFormData.color_hex}
                              onChange={(e) => setVariantFormData({ ...variantFormData, color_hex: e.target.value })}
                              className="w-12 h-10 p-1 cursor-pointer"
                            />
                            <Input
                              value={variantFormData.color_hex}
                              onChange={(e) => setVariantFormData({ ...variantFormData, color_hex: e.target.value })}
                              placeholder="#000000"
                              className="flex-1"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="var_sku_suffix">SKU дагавар</Label>
                          <Input
                            id="var_sku_suffix"
                            value={variantFormData.sku_suffix}
                            onChange={(e) => setVariantFormData({ ...variantFormData, sku_suffix: e.target.value })}
                            placeholder="-PRO-RED"
                          />
                        </div>
                      </div>

                      <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
                        <div className="space-y-2">
                          <Label htmlFor="var_stock">Нөөц</Label>
                          <Input
                            id="var_stock"
                            type="number"
                            value={variantFormData.stock}
                            onChange={(e) => setVariantFormData({ ...variantFormData, stock: e.target.value })}
                            placeholder="0"
                            min="0"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="var_price_adjustment">Үнийн өөрчлөлт (₮)</Label>
                          <Input
                            id="var_price_adjustment"
                            type="number"
                            value={variantFormData.price_adjustment}
                            onChange={(e) => setVariantFormData({ ...variantFormData, price_adjustment: e.target.value })}
                            placeholder="0"
                          />
                        </div>
                        <div className="flex items-end gap-2 pb-2">
                          <Switch
                            id="var_is_active"
                            checked={variantFormData.is_active}
                            onCheckedChange={(checked) => setVariantFormData({ ...variantFormData, is_active: checked })}
                          />
                          <Label htmlFor="var_is_active">Идэвхтэй</Label>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2">
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
                            setShowVariantForm(false);
                            resetVariantForm();
                            setEditingLocalVariant(null);
                          }}
                        >
                          Болих
                        </Button>
                        <Button 
                          type="button" 
                          size="sm"
                          onClick={handleAddLocalVariant}
                          disabled={isVariantImageUploading}
                        >
                          {editingLocalVariant ? "Хадгалах" : "Нэмэх"}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Local Variants List */}
                  {localVariants.length > 0 ? (
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-16">Зураг</TableHead>
                            <TableHead>Загвар</TableHead>
                            <TableHead>Размер</TableHead>
                            <TableHead>Өнгө</TableHead>
                            <TableHead>Хэмжээ</TableHead>
                            <TableHead className="text-center">Нөөц</TableHead>
                            <TableHead className="text-right">Үнийн өөрчлөлт</TableHead>
                            <TableHead className="text-right">Үйлдэл</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {localVariants.map((variant) => (
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
                                {variant.style ? (
                                  <Badge variant="outline">{variant.style}</Badge>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
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
                                        className="w-4 h-4 rounded-full border border-border"
                                        style={{ backgroundColor: variant.color_hex }}
                                      />
                                    )}
                                    <span className="text-sm">{variant.color}</span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {variant.dimensions || <span className="text-muted-foreground">—</span>}
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant={parseInt(variant.stock) > 0 ? "secondary" : "destructive"}>
                                  {variant.stock}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                {parseFloat(variant.price_adjustment) !== 0 ? (
                                  <span className={parseFloat(variant.price_adjustment) > 0 ? "text-green-600" : "text-red-600"}>
                                    {parseFloat(variant.price_adjustment) > 0 ? "+" : ""}{formatCurrency(parseFloat(variant.price_adjustment))}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => handleEditLocalVariant(variant)}
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive hover:text-destructive"
                                    onClick={() => handleDeleteLocalVariant(variant.id)}
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
                      <p className="text-xs mt-1">Загвар, өнгө, хэмжээ нэмэхийн тулд дээрх товчийг дарна уу</p>
                    </div>
                  )}
                </div>
              )}

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
                  {editingProduct ? "Хадгалах" : "Нэмэх"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Бараа хайх..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Products table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Барааны жагсаалт
            {products && <Badge variant="secondary">{products.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : products && products.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Бараа</TableHead>
                    <TableHead>Ангилал</TableHead>
                    <TableHead className="text-right">Үнэ</TableHead>
                    <TableHead className="text-center">Нөөц</TableHead>
                    <TableHead className="text-center">Үнэлгээ</TableHead>
                    <TableHead className="text-center">Төлөв</TableHead>
                    <TableHead className="text-right">Үйлдэл</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => (
                    <TableRow key={product.id} className="hover:bg-muted/50">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                            {product.images && product.images.length > 0 ? (
                              <img
                                src={product.images[0]}
                                alt={product.name_mn}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Package className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                          <div>
                            <div className="font-medium">{product.name_mn}</div>
                            <div className="text-xs text-muted-foreground">{product.sku}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {product.categories?.name_mn || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="font-medium">{formatCurrency(product.price)}</div>
                        {product.compare_price && (
                          <div className="text-xs text-muted-foreground line-through">
                            {formatCurrency(product.compare_price)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={product.stock > 0 ? "secondary" : "destructive"}>
                          {product.stock}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          <span className="text-sm">{product.rating}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {product.is_active ? (
                          <Badge className="bg-green-100 text-green-800">Идэвхтэй</Badge>
                        ) : (
                          <Badge variant="secondary">Идэвхгүй</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(product)}
                            title="Засах"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(product.id)}
                            className="text-destructive hover:text-destructive"
                            title="Устгах"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Бараа олдсонгүй</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
