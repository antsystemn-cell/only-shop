import { useState, useEffect } from "react";
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
import { ProductCostFields } from "@/components/admin/ProductCostFields";
import ProductLocationStockEditor from "@/components/admin/inventory/ProductLocationStockEditor";


import { VariantFormData } from "@/components/admin/VariantFormFields";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Package,
  Star,
  Loader2,
  Eye,
  EyeOff,
  GripVertical,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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
  homepage_position: number | null;
  created_at?: string;
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

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("mn-MN").format(amount) + "₮";
}

export default function Products() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("new") === "1"
  );
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name_mn: "",
    slug: "",
    seo_title: "",
    seo_description: "",
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
    delivery_fee_type: "default" as "default" | "free" | "custom",
    custom_delivery_fee: "",
    cost_price: "",
    landed_cost: "",
    additional_cost: "",
    packaging_cost: "",
    default_delivery_cost: "",
    low_margin_threshold: "15",
    purchase_cost_cny: "",
    exchange_rate_cny: "",
    cargo_fee: "",
    pickup_fee: "",
    fb_boost_cost: "",
    other_cost: "",
    other_cost_note: "",
    low_stock_threshold: "5",
    restock_qty: "10",
    homepage_position: "",
  });

  // Local variants for new product creation
  const [localVariants, setLocalVariants] = useState<VariantFormData[]>([]);

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
        .order("homepage_position", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (searchQuery) {
        query = query.or(
          `name_mn.ilike.%${searchQuery}%,sku.ilike.%${searchQuery}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Product[];
    },
  });

  // Auto-open edit dialog when ?edit=<productId> is in the URL
  useEffect(() => {
    if (typeof window === "undefined") return;
    const editId = new URLSearchParams(window.location.search).get("edit");
    if (!editId || !products) return;
    const found = products.find((p) => p.id === editId);
    if (found && (!editingProduct || editingProduct.id !== editId)) {
      handleEdit(found);
      // strip the query param so reopening Inventory navigation works cleanly
      const url = new URL(window.location.href);
      url.searchParams.delete("edit");
      window.history.replaceState({}, "", url.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products]);

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
    mutationFn: async (
      data: typeof formData & { id?: string; variants?: VariantFormData[] }
    ) => {
      const productData = {
        name: data.name_mn,
        name_mn: data.name_mn,
        slug: data.slug || null,
        seo_title: data.seo_title || null,
        seo_description: data.seo_description || null,
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
        delivery_fee_type: data.delivery_fee_type,
        custom_delivery_fee: data.delivery_fee_type === "custom" && data.custom_delivery_fee
          ? parseFloat(data.custom_delivery_fee)
          : null,
        cost_price: parseFloat(data.cost_price) || 0,
        landed_cost: parseFloat(data.landed_cost) || 0,
        additional_cost: parseFloat(data.additional_cost) || 0,
        packaging_cost: parseFloat(data.packaging_cost) || 0,
        default_delivery_cost: parseFloat(data.default_delivery_cost) || 0,
        low_margin_threshold: parseFloat(data.low_margin_threshold) || 15,
        low_stock_threshold: parseInt(data.low_stock_threshold) || 5,
        restock_qty: parseInt(data.restock_qty) || 10,
        purchase_cost_cny: parseFloat(data.purchase_cost_cny) || 0,
        exchange_rate_cny: parseFloat(data.exchange_rate_cny) || 0,
        cargo_fee: parseFloat(data.cargo_fee) || 0,
        pickup_fee: parseFloat(data.pickup_fee) || 0,
        fb_boost_cost: parseFloat(data.fb_boost_cost) || 0,
        other_cost: parseFloat(data.other_cost) || 0,
        other_cost_note: data.other_cost_note || null,
        homepage_position: data.homepage_position !== "" ? parseInt(data.homepage_position) : null,
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
        const basePrice = parseFloat(data.price) || 0;
        const variantsToInsert = data.variants.map((v, index) => ({
          product_id: productId,
          name: v.name || null,
          size: v.size || null,
          color: v.color || null,
          color_hex: v.color_hex || null,
          dimensions: v.dimensions || null,
          weight: v.weight || null,
          price: parseFloat(v.price) || basePrice,
          price_adjustment: 0, // Deprecated
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

  // Toggle visibility mutation
  const toggleVisibilityMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("products")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
    },
    onError: (error: any) => {
      toast({
        title: "Алдаа гарлаа",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Reorder mutation (homepage position swap)
  const reorderMutation = useMutation({
    mutationFn: async (updates: { id: string; homepage_position: number }[]) => {
      for (const u of updates) {
        const { error } = await supabase
          .from("products")
          .update({ homepage_position: u.homepage_position })
          .eq("id", u.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      queryClient.invalidateQueries({ queryKey: ["all-products"] });
    },
    onError: (error: any) => {
      toast({ title: "Алдаа гарлаа", description: error.message, variant: "destructive" });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
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
      slug: "",
      seo_title: "",
      seo_description: "",
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
      delivery_fee_type: "default",
      custom_delivery_fee: "",
      cost_price: "",
      landed_cost: "",
      additional_cost: "",
      packaging_cost: "",
      default_delivery_cost: "",
      low_margin_threshold: "15",
      low_stock_threshold: "5",
      restock_qty: "10",
      purchase_cost_cny: "",
      exchange_rate_cny: "",
      cargo_fee: "",
      pickup_fee: "",
      fb_boost_cost: "",
      other_cost: "",
      other_cost_note: "",
      homepage_position: "",
    });
    setEditingProduct(null);
    setLocalVariants([]);
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name_mn: product.name_mn,
      slug: (product as any).slug || "",
      seo_title: (product as any).seo_title || "",
      seo_description: (product as any).seo_description || "",
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
      delivery_fee_type: ((product as any).delivery_fee_type || "default") as "default" | "free" | "custom",
      custom_delivery_fee: (product as any).custom_delivery_fee?.toString() || "",
      cost_price: (product as any).cost_price?.toString() || "",
      landed_cost: (product as any).landed_cost?.toString() || "",
      additional_cost: (product as any).additional_cost?.toString() || "",
      packaging_cost: (product as any).packaging_cost?.toString() || "",
      default_delivery_cost: (product as any).default_delivery_cost?.toString() || "",
      low_margin_threshold: (product as any).low_margin_threshold?.toString() || "15",
      low_stock_threshold: (product as any).low_stock_threshold?.toString() || "5",
      restock_qty: (product as any).restock_qty?.toString() || "10",
      purchase_cost_cny: (product as any).purchase_cost_cny?.toString() || "",
      exchange_rate_cny: (product as any).exchange_rate_cny?.toString() || "",
      cargo_fee: (product as any).cargo_fee?.toString() || "",
      pickup_fee: (product as any).pickup_fee?.toString() || "",
      fb_boost_cost: (product as any).fb_boost_cost?.toString() || "",
      other_cost: (product as any).other_cost?.toString() || "",
      other_cost_note: (product as any).other_cost_note || "",
      homepage_position: (product as any).homepage_position?.toString() || "",
    });
    setLocalVariants([]);
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

  // Reorder via drag & drop: assigns sequential positions to the new order.
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !products) return;
    const oldIndex = products.findIndex((p) => p.id === active.id);
    const newIndex = products.findIndex((p) => p.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const newOrder = arrayMove(products, oldIndex, newIndex);
    const updates = newOrder
      .map((p, i) => ({ id: p.id, homepage_position: i + 1 }))
      .filter((u) => {
        const current = products.find((p) => p.id === u.id);
        return current?.homepage_position !== u.homepage_position;
      });
    if (updates.length === 0) return;
    // Optimistic update
    queryClient.setQueryData(
      ["admin", "products", searchQuery],
      newOrder.map((p, i) => ({ ...p, homepage_position: i + 1 }))
    );
    reorderMutation.mutate(updates);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

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
        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" />
              Бараа нэмэх
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0">
            <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
              <DialogTitle>
                {editingProduct ? "Бараа засах" : "Шинэ бараа нэмэх"}
              </DialogTitle>
            </DialogHeader>
            <form
              onSubmit={handleSubmit}
              className="flex-1 overflow-y-auto px-6 py-4 space-y-6"
            >
              {/* Basic Info */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name_mn">Барааны нэр *</Label>
                  <Input
                    id="name_mn"
                    value={formData.name_mn}
                    onChange={(e) =>
                      setFormData({ ...formData, name_mn: e.target.value })
                    }
                    placeholder="iPhone 15 Pro Max"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Ангилал</Label>
                  <Select
                    value={formData.category_id}
                    onValueChange={(value) =>
                      setFormData({ ...formData, category_id: value })
                    }
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
                <Label>Дэлгэрэнгүй танилцуулга</Label>
                <RichTextEditor
                  content={formData.description_mn}
                  onChange={(html) =>
                    setFormData({ ...formData, description_mn: html })
                  }
                  placeholder="Барааны дэлгэрэнгүй танилцуулга бичих..."
                />
              </div>

              {/* Pricing Section */}
              <div className="p-4 border rounded-lg bg-muted/30 space-y-4">
                <h4 className="font-semibold text-sm">Үнэ & Нөөц</h4>
                <p className="text-xs text-muted-foreground -mt-2">
                  {localVariants.length > 0
                    ? "⚠️ Хувилбар нэмсэн тул суурь үнэ, нөөц ашиглагдахгүй. Хувилбар бүрийн үнэ, нөөцийг тохируулна уу."
                    : "Хувилбаргүй үед энэ үнэ, нөөц ашиглагдана."}
                </p>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="price">Суурь үнэ (₮) *</Label>
                    <Input
                      id="price"
                      type="number"
                      value={formData.price}
                      onChange={(e) =>
                        setFormData({ ...formData, price: e.target.value })
                      }
                      placeholder="0"
                      min="0"
                      required
                      className={localVariants.length > 0 ? "opacity-60" : ""}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="compare_price">Хуучин үнэ (₮)</Label>
                    <Input
                      id="compare_price"
                      type="number"
                      value={formData.compare_price}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          compare_price: e.target.value,
                        })
                      }
                      placeholder="0"
                      min="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="stock">Нийт үлдэгдэл</Label>
                    <Input
                      id="stock"
                      type="number"
                      value={formData.stock}
                      onChange={(e) =>
                        setFormData({ ...formData, stock: e.target.value })
                      }
                      placeholder="0"
                      min="0"
                      className={localVariants.length > 0 ? "opacity-60" : ""}
                    />
                  </div>

                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="low_stock_threshold">Бага үлдэгдлийн хязгаар</Label>
                    <Input
                      id="low_stock_threshold"
                      type="number"
                      min="0"
                      value={formData.low_stock_threshold}
                      onChange={(e) => setFormData({ ...formData, low_stock_threshold: e.target.value })}
                      placeholder="5"
                    />
                    <p className="text-xs text-muted-foreground">Нөөц энэ тоонд хүрвэл "Бага" гэж тэмдэглэнэ</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="restock_qty">Нөхөн дүүргэлтийн тоо</Label>
                    <Input
                      id="restock_qty"
                      type="number"
                      min="0"
                      value={formData.restock_qty}
                      onChange={(e) => setFormData({ ...formData, restock_qty: e.target.value })}
                      placeholder="10"
                    />
                    <p className="text-xs text-muted-foreground">Дахин захиалахад санал болгох тоо ширхэг</p>
                  </div>
                </div>

                {editingProduct && (
                  <ProductLocationStockEditor productId={editingProduct.id} />
                )}
              </div>


              {/* Cost & Profit */}
              <ProductCostFields
                value={{
                  cost_price: formData.cost_price,
                  landed_cost: formData.landed_cost,
                  additional_cost: formData.additional_cost,
                  packaging_cost: formData.packaging_cost,
                  default_delivery_cost: formData.default_delivery_cost,
                  low_margin_threshold: formData.low_margin_threshold,
                  purchase_cost_cny: formData.purchase_cost_cny,
                  exchange_rate_cny: formData.exchange_rate_cny,
                  cargo_fee: formData.cargo_fee,
                  pickup_fee: formData.pickup_fee,
                  fb_boost_cost: formData.fb_boost_cost,
                  other_cost: formData.other_cost,
                  other_cost_note: formData.other_cost_note,
                }}
                onChange={(v) => setFormData({ ...formData, ...v })}
                sellingPrice={parseFloat(formData.price) || 0}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="slug">URL Slug</Label>
                  <Input
                    id="slug"
                    value={formData.slug}
                    onChange={(e) =>
                      setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/--+/g, "-").replace(/^-|-$/g, "") })
                    }
                    placeholder="iphone-15-pro-max"
                  />
                  <p className="text-xs text-muted-foreground">
                    {formData.slug ? `/product/${formData.slug}` : "Хоосон үлдээвэл ID ашиглана"}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sku">SKU</Label>
                  <Input
                    id="sku"
                    value={formData.sku}
                    onChange={(e) =>
                      setFormData({ ...formData, sku: e.target.value })
                    }
                    placeholder="ELEC-001"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="brand">Брэнд</Label>
                  <Select
                    value={formData.brand}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        brand: value === "none" ? "" : value,
                      })
                    }
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

              {/* SEO / Link Preview */}
              <div className="p-4 border rounded-lg bg-muted/30 space-y-4">
                <h4 className="font-semibold text-sm">🔗 Link Preview / SEO</h4>
                <p className="text-xs text-muted-foreground -mt-2">
                  Чатаар линк илгээхэд харагдах гарчиг, тайлбар. Хоосон үлдээвэл барааны нэр, тайлбараас автомат үүсгэнэ.
                </p>
                <div className="grid gap-4 md:grid-cols-1">
                  <div className="space-y-2">
                    <Label htmlFor="seo_title">SEO гарчиг</Label>
                    <Input
                      id="seo_title"
                      value={formData.seo_title}
                      onChange={(e) => setFormData({ ...formData, seo_title: e.target.value })}
                      placeholder={formData.name_mn || "Барааны нэр ашиглагдана"}
                      maxLength={70}
                    />
                    <p className="text-xs text-muted-foreground">{formData.seo_title.length}/70</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="seo_description">SEO тайлбар</Label>
                    <Textarea
                      id="seo_description"
                      value={formData.seo_description}
                      onChange={(e) => setFormData({ ...formData, seo_description: e.target.value })}
                      placeholder="Хоосон бол барааны тайлбараас автомат авна"
                      rows={2}
                      maxLength={160}
                    />
                    <p className="text-xs text-muted-foreground">{formData.seo_description.length}/160</p>
                  </div>
                </div>
                {/* Preview card */}
                {(formData.name_mn || formData.seo_title) && (
                  <div className="border rounded-lg overflow-hidden bg-background max-w-sm">
                    {formData.images[0] && (
                      <img src={formData.images[0]} alt="preview" className="w-full h-32 object-cover" />
                    )}
                    <div className="p-3">
                      <p className="text-xs text-muted-foreground">only.mn</p>
                      <p className="font-medium text-sm line-clamp-1">{formData.seo_title || formData.name_mn}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{formData.seo_description || "Барааны тайлбар энд харагдана"}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Delivery Fee Config */}
              <div className="p-4 border rounded-lg bg-muted/30 space-y-4">
                <h4 className="font-semibold text-sm">🚚 Хүргэлтийн үнэ</h4>
                <div className="space-y-3">
                  <div className="flex flex-col gap-2">
                    {[
                      { value: "default", label: "Сайтын үндсэн бодлогоор", desc: "Бүсчлэлийн үнээр тооцно" },
                      { value: "free", label: "Хүргэлт үнэгүй", desc: "Энэ бараанд хүргэлтийн төлбөргүй" },
                      { value: "custom", label: "Өөрийн үнэтэй", desc: "Тогтмол хүргэлтийн үнэ тохируулах" },
                    ].map((opt) => (
                      <label key={opt.value} className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${formData.delivery_fee_type === opt.value ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}>
                        <input
                          type="radio"
                          name="delivery_fee_type"
                          value={opt.value}
                          checked={formData.delivery_fee_type === opt.value}
                          onChange={(e) => setFormData({ ...formData, delivery_fee_type: e.target.value as any })}
                          className="mt-1"
                        />
                        <div>
                          <p className="font-medium text-sm">{opt.label}</p>
                          <p className="text-xs text-muted-foreground">{opt.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                  {formData.delivery_fee_type === "custom" && (
                    <div className="space-y-2 pl-6">
                      <Label htmlFor="custom_delivery_fee">Хүргэлтийн үнэ (₮)</Label>
                      <Input
                        id="custom_delivery_fee"
                        type="number"
                        value={formData.custom_delivery_fee}
                        onChange={(e) => setFormData({ ...formData, custom_delivery_fee: e.target.value })}
                        placeholder="5000"
                        min="0"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="border rounded-lg p-4 bg-muted/30">
                <ProductImageUpload
                  images={formData.images}
                  onImagesChange={(images) =>
                    setFormData({ ...formData, images })
                  }
                  maxImages={5}
                />
              </div>

              <div className="flex gap-6">
                <div className="flex items-center gap-2">
                  <Switch
                    id="is_featured"
                    checked={formData.is_featured}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, is_featured: checked })
                    }
                  />
                  <Label htmlFor="is_featured">Онцлох бараа</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, is_active: checked })
                    }
                  />
                  <Label htmlFor="is_active">Идэвхтэй</Label>
                </div>
              </div>

              <div className="grid sm:grid-cols-[200px_1fr] gap-3 items-end">
                <div className="space-y-1.5">
                  <Label htmlFor="homepage_position">Нүүр хуудасны байрлал</Label>
                  <Input
                    id="homepage_position"
                    type="number"
                    min="0"
                    placeholder="ж: 1, 2, 3..."
                    value={formData.homepage_position}
                    onChange={(e) =>
                      setFormData({ ...formData, homepage_position: e.target.value })
                    }
                  />
                </div>
                <p className="text-xs text-muted-foreground pb-2">
                  Бага тоо — нүүр хуудсанд эхэнд харагдана. Хоосон үлдээвэл шинэ нэмэгдсэн нь эхэндээ ордог.
                </p>
              </div>

              {/* Variants Section */}
              <div className="border-t pt-6">
                {editingProduct ? (
                  <ProductVariantsManager
                    productId={editingProduct.id}
                    productName={editingProduct.name_mn}
                    basePrice={parseFloat(formData.price) || 0}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">Барааг хадгалсны дараа хувилбарууд нэмэх боломжтой.</p>
                )}
              </div>

              {/* Submit Button */}
              <div className="flex justify-end gap-3 pt-4 border-t sticky bottom-0 bg-background pb-2">
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
                    <TableHead className="w-12 text-center">Дараалал</TableHead>
                    <TableHead>Бараа</TableHead>
                    <TableHead>Ангилал</TableHead>
                    <TableHead className="text-right">Үнэ</TableHead>
                    <TableHead className="text-center">Нөөц</TableHead>
                    <TableHead className="text-center">Үнэлгээ</TableHead>
                    <TableHead className="text-center">Төлөв</TableHead>
                    <TableHead className="text-right">Үйлдэл</TableHead>
                  </TableRow>
                </TableHeader>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={products.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                <TableBody>
                  {products.map((product) => (
                    <SortableProductRow key={product.id} id={product.id} position={product.homepage_position}>
                      <></>
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
                            <div className="text-xs text-muted-foreground">
                              {product.sku}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {product.categories?.name_mn || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="font-medium">
                          {formatCurrency(product.price)}
                        </div>
                        {product.compare_price && (
                          <div className="text-xs text-muted-foreground line-through">
                            {formatCurrency(product.compare_price)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={
                            product.stock > 0 ? "secondary" : "destructive"
                          }
                        >
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
                            onClick={() => toggleVisibilityMutation.mutate({ id: product.id, is_active: !product.is_active })}
                            title={product.is_active ? "Нуух" : "Харуулах"}
                            className={product.is_active ? "text-green-600 hover:text-red-500" : "text-muted-foreground hover:text-green-600"}
                          >
                            {product.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                          </Button>
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
