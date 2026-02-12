import DOMPurify from "dompurify";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  ShoppingCart,
  Star,
  Store,
  Minus,
  Plus,
  Heart,
  Globe,
  Clock,
  Shield,
  Share2,
  Package,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { fetchProductDetail, fetchProductDescription } from "@/services/otApi";
import { useOtCartSafe } from "@/contexts/OtCartContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ProductReviews } from "@/components/storefront/ProductReviews";
import { toast } from "sonner";

function ensureArray<T>(value: T | T[] | undefined | null): T[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [value];
}

function formatPrice(price: number, currency: string) {
  if (currency === "₮" || currency === "MNT") {
    return new Intl.NumberFormat("mn-MN").format(Math.round(price)) + "₮";
  }
  return `${currency}${price.toFixed(2)}`;
}

export default function OtProductDetail() {
  const { itemId } = useParams<{ itemId: string }>();
  const { addItem, isLoading: isCartLoading } = useOtCartSafe();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedConfigs, setSelectedConfigs] = useState<Record<string, string>>({});

  const { data: product, isLoading, error } = useQuery({
    queryKey: ["ot-product", itemId],
    queryFn: () => fetchProductDetail(itemId!),
    enabled: !!itemId,
    staleTime: 1000 * 60 * 10,
    retry: 1,
  });

  const { data: description } = useQuery({
    queryKey: ["ot-product-desc", itemId],
    queryFn: () => fetchProductDescription(itemId!),
    enabled: !!itemId,
    staleTime: 1000 * 60 * 10,
  });

  // Find matching configured item
  const matchedConfig = useMemo(() => {
    if (!product?.configuredItems?.length || !Object.keys(selectedConfigs).length) return null;
    const selectedVids = Object.values(selectedConfigs).filter(Boolean);
    if (selectedVids.length === 0) return null;
    return product.configuredItems.find((ci) =>
      selectedVids.every((vid) => ci.configuratorIds.includes(vid))
    );
  }, [product, selectedConfigs]);

  const effectivePrice = matchedConfig?.price ?? product?.price ?? 0;
  const effectiveQuantity = matchedConfig?.quantity ?? product?.quantity;
  const effectiveImage = matchedConfig?.imageUrl || product?.images?.[selectedImage] || product?.imageUrl;

  const handleAddToCart = async () => {
    if (!product) return;

    // If there are configurators but none selected, prompt user
    if (product.configurators.length > 0 && !matchedConfig && Object.values(selectedConfigs).filter(Boolean).length === 0) {
      toast.error("Хувилбараа сонгоно уу");
      return;
    }

    const configurationId = matchedConfig?.id;

    // Build XML configurators as fallback
    let configurators: string | undefined;
    if (!configurationId && Object.keys(selectedConfigs).length > 0) {
      const parts = Object.entries(selectedConfigs)
        .filter(([, vid]) => vid)
        .map(([pid, vid]) => `<Item><Pid>${pid}</Pid><Vid>${vid}</Vid></Item>`)
        .join("");
      if (parts) {
        configurators = `<ItemConfigurationValues>${parts}</ItemConfigurationValues>`;
      }
    }

    try {
      await addItem(product.id, quantity, configurators, configurationId);
    } catch {
      // toast already shown in context
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Холбоос хуулагдлаа");
  };

  if (isLoading) {
    return (
      <div className="container py-8 animate-fade-in">
        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-3">
            <Skeleton className="aspect-square rounded-xl" />
            <div className="flex gap-2">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="w-16 h-16 rounded-lg" />
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-10 w-1/3" />
            <Skeleton className="h-px w-full" />
            <div className="flex gap-2">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-20 rounded-lg" />
              ))}
            </div>
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="container py-20 text-center">
        <div className="max-w-md mx-auto space-y-4">
          <div className="p-4 rounded-full bg-muted inline-block">
            <Package className="h-12 w-12 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold">Бараа олдсонгүй</h2>
          <p className="text-muted-foreground text-sm">
            {error?.message || "Энэ бараа одоогоор боломжгүй эсвэл устгагдсан байна"}
          </p>
          <Link to="/ot">
            <Button className="mt-2">Маркетплэйс руу буцах</Button>
          </Link>
        </div>
      </div>
    );
  }

  const discountPercent =
    product.originalPrice && product.originalPrice > effectivePrice
      ? Math.round(((product.originalPrice - effectivePrice) / product.originalPrice) * 100)
      : 0;

  return (
    <div className="container py-4 md:py-8 animate-fade-in">
      {/* Breadcrumbs */}
      {ensureArray(product.breadcrumbs).length > 0 && (
        <nav className="flex items-center gap-1 text-xs text-muted-foreground mb-4 flex-wrap">
          <Link to="/ot" className="hover:text-foreground transition-colors">Маркетплэйс</Link>
          {ensureArray(product.breadcrumbs).map((bc, i) => (
            <span key={bc.id || i} className="flex items-center gap-1">
              <span>/</span>
              <Link to={`/ot?category=${bc.id}`} className="hover:text-foreground transition-colors line-clamp-1">
                {bc.name}
              </Link>
            </span>
          ))}
        </nav>
      )}

      <div className="grid md:grid-cols-2 gap-6 md:gap-10">
        {/* ─── Image Gallery ─── */}
        <div className="overflow-hidden min-w-0">
          <div className="relative aspect-square rounded-xl overflow-hidden bg-muted border max-w-full">
            <img
              src={effectiveImage}
              alt={product.title}
              className="w-full h-full object-contain max-w-full max-h-full"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/placeholder.svg";
              }}
            />
            {product.images.length > 1 && (
              <>
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full opacity-80 hover:opacity-100 h-8 w-8"
                  onClick={() =>
                    setSelectedImage((p) => (p - 1 + product.images.length) % product.images.length)
                  }
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full opacity-80 hover:opacity-100 h-8 w-8"
                  onClick={() =>
                    setSelectedImage((p) => (p + 1) % product.images.length)
                  }
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            )}
            {/* Discount badge */}
            {discountPercent > 0 && (
              <Badge className="absolute top-3 left-3 bg-destructive text-destructive-foreground text-xs">
                -{discountPercent}%
              </Badge>
            )}
            {/* Image counter */}
            {product.images.length > 1 && (
              <span className="absolute bottom-3 right-3 bg-background/80 backdrop-blur-sm text-xs px-2 py-1 rounded-full">
                {selectedImage + 1}/{product.images.length}
              </span>
            )}
          </div>

          {/* Thumbnails */}
          {product.images.length > 1 && (
            <div className="flex gap-2 mt-3 overflow-x-auto pb-2 scrollbar-hide">
              {ensureArray(product.images).slice(0, 10).map((img, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedImage(i)}
                  className={`w-16 h-16 rounded-lg border-2 overflow-hidden shrink-0 transition-all ${
                    selectedImage === i ? "border-primary ring-1 ring-primary/30" : "border-transparent hover:border-muted-foreground/30"
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ─── Product Info ─── */}
        <div className="space-y-5">
          {/* Title */}
          <div>
            <h1 className="text-xl md:text-2xl font-bold leading-tight">
              {product.title}
            </h1>
            {product.externalTitle && product.externalTitle !== product.title && (
              <p className="text-sm text-muted-foreground mt-1">{product.externalTitle}</p>
            )}
          </div>

          {/* Price section */}
          <div className="space-y-1">
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold text-primary">
                {formatPrice(effectivePrice, product.currency)}
              </span>
              {product.originalPrice && product.originalPrice > effectivePrice && (
                <span className="text-lg text-muted-foreground line-through">
                  {formatPrice(product.originalPrice, product.currency)}
                </span>
              )}
            </div>
          </div>

          {/* Stock & Delivery info */}
          <div className="flex flex-wrap gap-2">
            {effectiveQuantity !== undefined && effectiveQuantity > 0 ? (
              <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-green-500/20">
                <Package className="h-3 w-3 mr-1" />
                Нөөцөд ({effectiveQuantity})
              </Badge>
            ) : effectiveQuantity === 0 ? (
              <Badge variant="destructive">Дууссан</Badge>
            ) : null}
            <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
              <Globe className="h-3 w-3 mr-1" />
              Гадаадаас
            </Badge>
            <Badge variant="secondary" className="bg-orange-500/10 text-orange-600 border-orange-500/20">
              <Clock className="h-3 w-3 mr-1" />
              10-14 хоног
            </Badge>
          </div>

          <Separator />

          {/* Vendor */}
          {product.vendor && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <div className="p-1.5 rounded-full bg-muted">
                  <Store className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <span className="font-medium">{product.vendor.name}</span>
                  {product.vendor.score != null && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      {product.vendor.score}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleShare}>
                  <Share2 className="h-4 w-4" />
                </Button>
                {user && (
                  <FavouriteVendorButton
                    userId={user.id}
                    vendorId={product.vendor.id}
                    vendorName={product.vendor.name}
                    vendorScore={product.vendor.score}
                  />
                )}
              </div>
            </div>
          )}

          <Separator />

          {/* Configurators (variants) */}
          {ensureArray(product.configurators).map((config) => (
            <div key={config.pid} className="space-y-2">
              <h3 className="text-sm font-semibold">
                {config.propertyName}
                {selectedConfigs[config.pid] && (
                  <span className="text-muted-foreground font-normal ml-2">
                    — {ensureArray(config.values).find(v => v.id === selectedConfigs[config.pid])?.value}
                  </span>
                )}
              </h3>
              <div className="flex flex-wrap gap-2">
                {ensureArray(config.values).map((val) => {
                  const isSelected = selectedConfigs[config.pid] === val.id;
                  return (
                    <button
                      key={val.id}
                      onClick={() =>
                        setSelectedConfigs((prev) => ({
                          ...prev,
                          [config.pid]: isSelected ? "" : val.id,
                        }))
                      }
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                        isSelected
                          ? "border-primary bg-primary/10 text-primary shadow-sm"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      {val.imageUrl && (
                        <img
                          src={val.imageUrl}
                          alt={val.value}
                          className="w-8 h-8 rounded object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      )}
                      <span className="line-clamp-1">{val.value}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Quantity + Add to Cart */}
          <div className="flex items-center gap-3 pt-2">
            <div className="flex items-center border rounded-lg bg-muted/50">
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-12 text-center font-medium">{quantity}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10"
                onClick={() => setQuantity((q) => q + 1)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <Button
              size="lg"
              className="flex-1 gap-2"
              disabled={effectiveQuantity === 0 || isCartLoading}
              onClick={handleAddToCart}
            >
              <ShoppingCart className="h-5 w-5" />
              {isCartLoading ? "Нэмж байна..." : "Сагсанд нэмэх"}
            </Button>
          </div>

          {/* Delivery & Trust Signals */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/30">
              <Truck className="h-4 w-4 text-primary shrink-0" />
              <div>
                <p className="text-xs font-medium">Хүргэлт</p>
                <p className="text-[10px] text-muted-foreground">10-14 хоногт</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/30">
              <Shield className="h-4 w-4 text-primary shrink-0" />
              <div>
                <p className="text-xs font-medium">Баталгаат</p>
                <p className="text-[10px] text-muted-foreground">Чанарын баталгаа</p>
              </div>
            </div>
          </div>

          {/* Features */}
          {ensureArray(product.features).length > 0 && (
            <div className="border rounded-lg overflow-hidden mt-2">
              <div className="px-4 py-2.5 bg-muted/50 border-b">
                <h3 className="font-semibold text-sm">Үзүүлэлтүүд</h3>
              </div>
              <div className="divide-y">
                {ensureArray(product.features).map((f, i) => (
                  <div key={i} className="flex justify-between px-4 py-2.5 text-sm">
                    <span className="text-muted-foreground">{f.name}</span>
                    <span className="font-medium text-right">{f.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs: Description + Reviews */}
      <Tabs defaultValue="description" className="mt-8">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="description">Тайлбар</TabsTrigger>
          <TabsTrigger value="reviews">Сэтгэгдэл</TabsTrigger>
        </TabsList>
        <TabsContent value="description" className="mt-4">
          {description ? (
            <div
              className="prose prose-sm max-w-none dark:prose-invert [&_img]:rounded-lg [&_img]:max-w-full"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(description, { ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'img', 'table', 'tr', 'td', 'th', 'thead', 'tbody', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'b', 'i', 'u', 'sub', 'sup', 'dl', 'dt', 'dd'], ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'style', 'width', 'height', 'target', 'rel'] }) }}
            />
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Тайлбар байхгүй</p>
            </div>
          )}
        </TabsContent>
        <TabsContent value="reviews" className="mt-4">
          <ProductReviews itemId={itemId!} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Favourite Vendor Button ─────────────────────────────────

function FavouriteVendorButton({ userId, vendorId, vendorName, vendorScore }: {
  userId: string;
  vendorId: string;
  vendorName?: string;
  vendorScore?: number;
}) {
  const queryClient = useQueryClient();

  const { data: isFav } = useQuery({
    queryKey: ["fav-vendor", userId, vendorId],
    queryFn: async () => {
      const { data } = await supabase
        .from("favourite_vendors")
        .select("id")
        .eq("user_id", userId)
        .eq("vendor_id", vendorId)
        .maybeSingle();
      return !!data;
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async () => {
      if (isFav) {
        await supabase.from("favourite_vendors").delete().eq("user_id", userId).eq("vendor_id", vendorId);
      } else {
        await supabase.from("favourite_vendors").insert({
          user_id: userId,
          vendor_id: vendorId,
          vendor_name: vendorName,
          vendor_score: vendorScore,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fav-vendor", userId, vendorId] });
      queryClient.invalidateQueries({ queryKey: ["favourite-vendors"] });
      toast(isFav ? "Борлуулагч хасагдлаа" : "Борлуулагч нэмэгдлээ");
    },
  });

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      onClick={() => toggleMutation.mutate()}
      disabled={toggleMutation.isPending}
      title={isFav ? "Дуртайгаас хасах" : "Дуртайд нэмэх"}
    >
      <Heart className={`h-4 w-4 ${isFav ? "fill-red-500 text-red-500" : ""}`} />
    </Button>
  );
}
