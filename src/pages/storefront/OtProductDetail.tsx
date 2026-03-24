import DOMPurify from "dompurify";
import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { getSeoImage } from "@/utils/seoHelpers";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link, useNavigate } from "react-router-dom";
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
  ExternalLink,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { fetchProductDetail, fetchProductDescription, batchGetSimplifiedItemConfigurationInfo, fetchItemsByIds } from "@/services/otApi";
import { isAmazonProvider, buildAmazonAddToCartPayload, withAmazonErrorHandling, getAmazonAutoConfigurationId, amazonLog } from "@/services/amazonOtapiAdapter";
import { useOtCartSafe } from "@/contexts/OtCartContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ProductReviews } from "@/components/storefront/ProductReviews";
import { ImageZoomModal } from "@/components/storefront/ImageZoomModal";
import { SimilarProducts } from "@/components/storefront/SimilarProducts";
import { useTranslatedTitle } from "@/hooks/useTranslatedTitles";
import { useWishlist } from "@/contexts/WishlistContext";
import { toast } from "sonner";
import { useTrackRecentlyViewed } from "@/hooks/useRecentlyViewed";

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
  const [activeTab, setActiveTab] = useState("description");
  const navigate = useNavigate();
  const { addItem, isLoading: isCartLoading } = useOtCartSafe();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedConfigs, setSelectedConfigs] = useState<Record<string, string>>({});
  const [zoomOpen, setZoomOpen] = useState(false);
  const [isBuyingNow, setIsBuyingNow] = useState(false);
  const [gallerySlide, setGallerySlide] = useState<"left" | "right" | null>(null);
  const [configImageOverride, setConfigImageOverride] = useState<string | null>(null);
  // For Amazon: track the variant image inserted into the gallery
  const [variantGalleryImage, setVariantGalleryImage] = useState<string | null>(null);

  // Touch swipe state for image gallery
  const touchStartX = useRef(0);
  const imageCountRef = useRef(0);

  const animateGallery = useCallback((newIndex: number | ((p: number) => number), dir: "left" | "right") => {
    setGallerySlide(dir);
    setTimeout(() => {
      setSelectedImage(newIndex);
      setGallerySlide(dir === "left" ? "right" : "left");
      setTimeout(() => setGallerySlide(null), 200);
    }, 120);
  }, []);

  const handleGalleryTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);
  const handleGalleryTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const count = imageCountRef.current;
      if (count <= 1) return;
      const dx = e.changedTouches[0].clientX - touchStartX.current;
      if (Math.abs(dx) > 50) {
        if (dx > 0) animateGallery((p) => (p - 1 + count) % count, "right");
        else animateGallery((p) => (p + 1) % count, "left");
      }
    },
    [animateGallery],
  );

  // Check if current user is admin
  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      return !!data;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 30,
  });

  const {
    data: product,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["ot-product", itemId],
    queryFn: () => fetchProductDetail(itemId!),
    enabled: !!itemId,
    staleTime: 1000 * 60 * 10,
    retry: 1,
  });

  const { data: amazonHiddenConfiguration } = useQuery({
    queryKey: ["amazon-hidden-config", itemId, product?.providerType],
    queryFn: async () => {
      const data = await batchGetSimplifiedItemConfigurationInfo(itemId!) as {
        Result?: { Configuration?: { Current?: { ConfigurationId?: string | number; AvailableQuantity?: number } } };
      };
      const current = data?.Result?.Configuration?.Current;
      const configurationId = current?.ConfigurationId;
      if (configurationId === undefined || configurationId === null || configurationId === "") {
        return null;
      }
      return {
        id: String(configurationId),
        quantity: typeof current?.AvailableQuantity === "number" ? current.AvailableQuantity : undefined,
        price: product?.price,
        imageUrl: undefined,
        configuratorIds: [] as string[],
      };
    },
    enabled:
      !!itemId &&
      !!product &&
      isAmazonProvider(product.providerType) &&
      product.configurators.length === 0 &&
      product.configuredItems.length === 0,
    staleTime: 1000 * 60 * 5,
  });

  // Auto-select configurator groups that have only one option
  useEffect(() => {
    if (!product?.configurators?.length) return;
    const autoSelections: Record<string, string> = {};
    for (const config of product.configurators) {
      const values = ensureArray(config.values);
      if (values.length === 1) {
        autoSelections[config.pid] = values[0].id;
      }
    }
    if (Object.keys(autoSelections).length > 0) {
      setSelectedConfigs((prev) => {
        const merged = { ...autoSelections, ...prev };
        // Only update if something actually changed
        const changed = Object.keys(autoSelections).some((k) => prev[k] !== autoSelections[k]);
        return changed ? merged : prev;
      });
    }
  }, [product]);

  const translatedTitle = useTranslatedTitle(product?.title);

  // Track recently viewed (fire-and-forget, non-blocking)
  const trackView = useTrackRecentlyViewed();
  useEffect(() => {
    if (!product || !itemId) return;
    const providerType = (product as any).providerType?.toLowerCase() || "taobao";
    trackView({
      provider: providerType,
      provider_product_id: itemId,
      canonical_key: `${providerType}:${itemId}`,
      title_snapshot: translatedTitle || product.title || "",
      image_snapshot: product.imageUrl || product.images?.[0] || "",
      price_snapshot: product.price || 0,
      currency: "₮",
      product_url: `/ot/product/${itemId}`,
    });
  }, [product?.id]); // Only once per product load

  const { data: description } = useQuery({
    queryKey: ["ot-product-desc", itemId],
    queryFn: () => fetchProductDescription(itemId!),
    enabled: !!itemId,
    staleTime: 1000 * 60 * 10,
  });

  // Amazon variant enrichment: fetch images for each variant ASIN
  // Prices are now resolved via skuPrices in fetchProductDetail
  const isAmazon = isAmazonProvider(product?.providerType);
  const variantAsins = useMemo(() => {
    if (!isAmazon || !product?.configuredItems?.length) return [];
    return [...new Set(product.configuredItems.map((ci) => `az-${ci.id}`))];
  }, [isAmazon, product?.configuredItems]);

  const { data: amazonVariantInfo } = useQuery({
    queryKey: ["amazon-variant-info", variantAsins],
    queryFn: () => fetchItemsByIds(variantAsins, 6, { includeUnavailable: true }),
    enabled: variantAsins.length > 1,
    staleTime: 1000 * 60 * 10,
  });

  const effectiveConfiguredItems = useMemo(() => {
    const baseItems = product?.configuredItems?.length
      ? product.configuredItems
      : amazonHiddenConfiguration ? [amazonHiddenConfiguration] : [];

    // Enrich with Amazon variant images (prices already set via skuPrices)
    if (amazonVariantInfo?.length && baseItems.length > 0) {
      const infoMap = new Map(amazonVariantInfo.map((v) => [v.id.replace(/^az-/, ""), v]));
      return baseItems.map((ci) => {
        const info = infoMap.get(ci.id);
        if (!info) return ci;
        return {
          ...ci,
          imageUrl: info.imageUrl || ci.imageUrl,
        };
      });
    }

    return baseItems;
  }, [product?.configuredItems, amazonHiddenConfiguration, amazonVariantInfo]);

  // Find matching configured item
  const matchedConfig = useMemo(() => {
    if (!effectiveConfiguredItems.length) return null;
    const selectedVids = Object.values(selectedConfigs).filter(Boolean);

    if (selectedVids.length === 0) {
      return null;
    }

    return effectiveConfiguredItems.find((ci) => selectedVids.every((vid) => ci.configuratorIds.includes(vid)));
  }, [effectiveConfiguredItems, selectedConfigs]);

  // Price range from configured items
  const priceRange = useMemo(() => {
    if (!effectiveConfiguredItems.length) return null;
    const prices = effectiveConfiguredItems.map((ci) => ci.price).filter((p): p is number => p != null && p > 0);
    if (prices.length < 2) return null;
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    if (min === max) return null;
    return { min, max };
  }, [effectiveConfiguredItems]);

  // Dynamic SEO meta tags for link previews
  useDocumentMeta({
    title: product ? `${product.title} | Онли` : undefined,
    description: product?.features?.slice(0, 3).map(f => `${f.name}: ${f.value}`).join(", ").slice(0, 160) || undefined,
    image: product ? getSeoImage({ type: "product", images: product.images, imageUrl: product.imageUrl }) : undefined,
    url: itemId ? `https://only.mn/ot/product/${itemId}` : undefined,
    type: "product",
  });

  const allConfigsSelected = product?.configurators?.length
    ? product.configurators.every((c) => selectedConfigs[c.pid] && selectedConfigs[c.pid] !== "")
    : true;

  const effectivePrice = matchedConfig?.price ?? product?.price ?? 0;
  const effectiveQuantity = matchedConfig?.quantity ?? product?.quantity;

  // Build gallery images: prepend variant image if it's not already in the original gallery
  const galleryImages = useMemo(() => {
    if (!product?.images) return [];
    if (!variantGalleryImage) return product.images;
    // If variant image is already in the product images, don't duplicate
    if (product.images.includes(variantGalleryImage)) return product.images;
    // Prepend variant image at position 0
    return [variantGalleryImage, ...product.images];
  }, [product?.images, variantGalleryImage]);

  // For non-Amazon products, configImageOverride replaces the gallery view entirely (old behavior)
  // For Amazon products, we use galleryImages with variantGalleryImage prepended
  const effectiveImage =
    (configImageOverride && !isAmazon) ? configImageOverride : galleryImages[selectedImage] || product?.imageUrl;

  const handleAddToCart = async (): Promise<boolean> => {
    if (!product) return false;

    const isAmazon = isAmazonProvider(product.providerType);

    // Amazon-specific: use adapter for validation and payload building
    if (isAmazon) {
      // Auto-resolve configurationId for products with no configurator UI
      let resolvedConfigId = matchedConfig?.id;
      const amazonConfigPool = effectiveConfiguredItems;
      if (!resolvedConfigId && amazonConfigPool.length) {
        const autoId = getAmazonAutoConfigurationId(
          amazonConfigPool,
          product.configurators,
        );
        if (autoId) {
          resolvedConfigId = autoId;
          amazonLog("autoConfigResolved", { itemId: product.id, configId: autoId });
        }
      }

      const result = buildAmazonAddToCartPayload(
        product.id,
        quantity,
        selectedConfigs,
        product.configurators,
        resolvedConfigId,
      );
      if ("error" in result) {
        toast.error(result.error);
        return false;
      }

      // Check stock for selected/auto-resolved variant
      const resolvedConfig = matchedConfig || amazonConfigPool.find((ci) => ci.id === resolvedConfigId);
      if (resolvedConfig && resolvedConfig.quantity !== undefined && resolvedConfig.quantity <= 0) {
        toast.error("Сонгосон хувилбарын үлдэгдэл дууссан байна");
        return false;
      }

      try {
        await withAmazonErrorHandling(
          () => addItem(
            result.payload.itemId,
            result.payload.quantity,
            undefined,
            result.payload.configurationId,
            result.payload.fieldParameters,
          ),
          product.providerType,
        );
        return true;
      } catch {
        return false;
      }
    }

    // Non-Amazon: existing logic unchanged
    if (product.configurators.length > 0) {
      const allSelected = product.configurators.every((c) => selectedConfigs[c.pid] && selectedConfigs[c.pid] !== "");
      if (!allSelected) {
        toast.error("Бүх хувилбараа сонгоно уу (өнгө, хэмжээ гэх мэт)");
        return false;
      }

      if (matchedConfig && matchedConfig.quantity !== undefined && matchedConfig.quantity <= 0) {
        toast.error("Сонгосон хувилбарын үлдэгдэл дууссан байна");
        return false;
      }
    }

    const configurationId = matchedConfig?.id;

    let fieldParameters = "<Fields/>";
    if (product.configurators.length > 0 && Object.keys(selectedConfigs).length > 0) {
      const fieldXmlParts = Object.entries(selectedConfigs)
        .filter(([, vid]) => vid)
        .map(([pid, vid]) => `<Field><FieldId>${pid}</FieldId><ValueId>${vid}</ValueId></Field>`)
        .join("");
      if (fieldXmlParts) {
        fieldParameters = `<Fields>${fieldXmlParts}</Fields>`;
      }
    }

    try {
      await addItem(product.id, quantity, undefined, configurationId, fieldParameters);
      return true;
    } catch {
      return false;
    }
  };

  const handleBuyNow = async () => {
    setIsBuyingNow(true);
    const success = await handleAddToCart();
    setIsBuyingNow(false);
    if (success) {
      // Navigate with buyNow flag + itemId so checkout only processes this item
      navigate(`/ot/checkout?buyNow=${encodeURIComponent(product!.id)}`);
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
            <Button className="mt-2">Онлайн дэлгүүр руу буцах</Button>
          </Link>
        </div>
      </div>
    );
  }

  const discountPercent =
    product.originalPrice && product.originalPrice > effectivePrice
      ? Math.round(((product.originalPrice - effectivePrice) / product.originalPrice) * 100)
      : 0;

  // Update ref for touch handler
  imageCountRef.current = galleryImages.length;

  return (
    <div className="container py-4 md:py-8 animate-fade-in">
      {/* Breadcrumbs */}
      {ensureArray(product.breadcrumbs).length > 0 && (
        <nav className="flex items-center gap-1 text-xs text-muted-foreground mb-4 flex-wrap">
          <Link to="/ot" className="hover:text-foreground transition-colors">
            Маркетплэйс
          </Link>
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
          <div
            className="relative aspect-square rounded-xl overflow-hidden bg-white border max-w-full cursor-zoom-in"
            onTouchStart={handleGalleryTouchStart}
            onTouchEnd={handleGalleryTouchEnd}
            onClick={() => setZoomOpen(true)}
          >
            <img
              src={effectiveImage}
              alt={product.title}
              className={`w-full h-full object-contain max-w-full max-h-full transition-all duration-200 ease-out ${
                gallerySlide === "left"
                  ? "translate-x-[-30px] opacity-0"
                  : gallerySlide === "right"
                    ? "translate-x-[30px] opacity-0"
                    : "translate-x-0 opacity-100"
              }`}
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/placeholder.svg";
              }}
            />
            {galleryImages.length > 1 && (
              <>
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full opacity-80 hover:opacity-100 h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    animateGallery((p) => (p - 1 + galleryImages.length) % galleryImages.length, "right");
                  }}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full opacity-80 hover:opacity-100 h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    animateGallery((p) => (p + 1) % galleryImages.length, "left");
                  }}
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
            {galleryImages.length > 1 && (
              <span className="absolute bottom-3 right-3 bg-background/80 backdrop-blur-sm text-xs px-2 py-1 rounded-full">
                {selectedImage + 1}/{galleryImages.length}
              </span>
            )}
          </div>

          {/* Image Zoom Modal */}
          <ImageZoomModal
            images={galleryImages}
            initialIndex={selectedImage}
            open={zoomOpen}
            onOpenChange={setZoomOpen}
          />

          {/* Thumbnails */}
          {galleryImages.length > 1 && (
            <div className="flex gap-2 mt-3 overflow-x-auto pb-2 scrollbar-hide">
              {galleryImages
                .slice(0, 10)
                .map((img, i) => (
                  <button
                    key={`${img}-${i}`}
                    onClick={() => setSelectedImage(i)}
                    className={`w-16 h-16 rounded-lg border-2 overflow-hidden shrink-0 transition-all ${
                      selectedImage === i
                        ? "border-primary ring-1 ring-primary/30"
                        : "border-transparent hover:border-muted-foreground/30"
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
            <h1 className="text-xl md:text-2xl font-bold leading-tight">{translatedTitle || product.title}</h1>
            {translatedTitle && translatedTitle !== product.title && (
              <p className="text-xs text-muted-foreground mt-1">{product.externalTitle || product.title}</p>
            )}
          </div>

          {/* Price section */}
          <div className="space-y-1">
            <div className="flex items-baseline gap-3">
              {/* Show price range if variants have different prices and not all selected */}
              {priceRange && !allConfigsSelected ? (
                <span className="text-3xl font-bold text-primary">
                  {formatPrice(priceRange.min, product.currency)} – {formatPrice(priceRange.max, product.currency)}
                </span>
              ) : (
                <span className="text-3xl font-bold text-primary">{formatPrice(effectivePrice, product.currency)}</span>
              )}
              {product.originalPrice && product.originalPrice > effectivePrice && allConfigsSelected && (
                <span className="text-lg text-muted-foreground line-through">
                  {formatPrice(product.originalPrice, product.currency)}
                </span>
              )}
            </div>

            {/* Provider badge under price */}
            {product.providerType?.toLowerCase() === "poizon" || product.providerType?.toLowerCase() === "dewu" ? (
              <div className="flex items-center gap-1.5 mt-1">
                <span className="inline-flex items-center gap-1 bg-emerald-600 text-white text-xs font-bold px-2 py-0.5 rounded">
                  <Shield className="h-3 w-3" />
                  100% Оригинал
                </span>
              </div>
            ) : product.providerType?.toLowerCase() === "taobao" || product.providerType?.toLowerCase() === "tmall" ? (
              <div className="mt-1">
                <span className="inline-flex items-center bg-orange-500 text-white text-xs font-medium px-2 py-0.5 rounded">
                  {product.providerType === "Tmall" || product.providerType?.toLowerCase() === "tmall"
                    ? "Tmall"
                    : "Taobao"}
                </span>
              </div>
            ) : null}
          </div>
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
            <div className="space-y-2">
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
                  {isAdmin && product.externalUrl && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild title="Эх линк руу очих">
                      <a href={product.externalUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                  <WishlistHeartButton productId={itemId!} />
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={() =>
                  navigate(
                    `/ot?vendorId=${product.vendor!.id}&vendorName=${encodeURIComponent(product.vendor!.name || "")}`,
                  )
                }
              >
                <Store className="h-3.5 w-3.5 mr-1.5" />
                Энэ дэлгүүрийн бүх барааг үзэх
              </Button>
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
                    — {ensureArray(config.values).find((v) => v.id === selectedConfigs[config.pid])?.value}
                  </span>
                )}
              </h3>
              <div className="flex flex-wrap gap-2">
                {ensureArray(config.values).map((val) => {
                  const isSelected = selectedConfigs[config.pid] === val.id;
                  // Check if this variant combination is out of stock
                  // considering other already-selected configurator values
                  const isOutOfStock = (() => {
                    if (!product.configuredItems?.length) return false;
                    // Get selected values from OTHER configurator groups
                    const otherSelectedVids = Object.entries(selectedConfigs)
                      .filter(([pid, vid]) => pid !== config.pid && vid)
                      .map(([, vid]) => vid);
                    // Find configured items that include this value AND all other selected values
                    const matchingConfigs = product.configuredItems.filter((ci) => {
                      if (!ci.configuratorIds.includes(val.id)) return false;
                      return otherSelectedVids.every((vid) => ci.configuratorIds.includes(vid));
                    });
                    // If no matching configs found but there are configured items, it's unavailable
                    if (matchingConfigs.length === 0 && otherSelectedVids.length > 0) return true;
                    // If all matching configs have 0 quantity, it's out of stock
                    if (matchingConfigs.length > 0 && matchingConfigs.every((ci) => ci.quantity === 0)) {
                      return true;
                    }
                    return false;
                  })();

                  return (
                    <button
                      key={val.id}
                      disabled={isOutOfStock}
                      onClick={() => {
                        if (isOutOfStock) return;
                        const newVal = isSelected ? "" : val.id;
                        setSelectedConfigs((prev) => ({
                          ...prev,
                          [config.pid]: newVal,
                        }));
                        // Show configurator image in main gallery
                        if (newVal) {
                          const imgUrl = val.imageUrl || effectiveConfiguredItems.find((ci) =>
                            ci.configuratorIds.includes(newVal)
                          )?.imageUrl;
                          
                          if (imgUrl && isAmazon) {
                            // Amazon: prepend image to gallery and navigate to it
                            setVariantGalleryImage(imgUrl);
                            // If the image is already in the product gallery, navigate to it
                            const existingIdx = product.images.indexOf(imgUrl);
                            if (existingIdx >= 0) {
                              setSelectedImage(existingIdx);
                            } else {
                              // It will be prepended at index 0
                              setSelectedImage(0);
                            }
                          } else if (imgUrl) {
                            // Non-Amazon: use override (old behavior)
                            setConfigImageOverride(imgUrl);
                          } else {
                            setConfigImageOverride(null);
                            setVariantGalleryImage(null);
                          }
                        } else {
                          setConfigImageOverride(null);
                          setVariantGalleryImage(null);
                        }
                      }}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                        isOutOfStock
                          ? "border-border opacity-40 cursor-not-allowed line-through"
                          : isSelected
                            ? "border-primary bg-primary/10 text-primary shadow-sm"
                            : "border-border hover:border-primary/50"
                      }`}
                      title={isOutOfStock ? "Дууссан" : ""}
                    >
                      {(() => {
                        // Use configurator value image, or fallback to enriched configuredItem image
                        const thumbUrl = val.imageUrl || effectiveConfiguredItems.find(
                          (ci) => ci.configuratorIds.includes(val.id)
                        )?.imageUrl;
                        return thumbUrl ? (
                          <img
                            src={thumbUrl}
                            alt={val.value}
                            className={`w-8 h-8 rounded object-cover ${isOutOfStock ? "grayscale" : ""}`}
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                        ) : null;
                      })()}
                      <span className="line-clamp-1">{val.value}</span>
                      {isOutOfStock && <span className="text-[10px] text-destructive font-medium">Дууссан</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Quantity + Add to Cart + Buy Now */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-3">
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
                <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => setQuantity((q) => q + 1)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <Button
                size="lg"
                className="flex-1 gap-2"
                variant="outline"
                disabled={effectiveQuantity === 0 || isCartLoading}
                onClick={handleAddToCart}
              >
                <ShoppingCart className="h-5 w-5" />
                {isCartLoading && !isBuyingNow ? "Нэмж байна..." : "Сагсанд нэмэх"}
              </Button>
            </div>
            <Button
              size="lg"
              className="w-full gap-2"
              disabled={effectiveQuantity === 0 || isCartLoading || isBuyingNow}
              onClick={handleBuyNow}
            >
              <Zap className="h-5 w-5" />
              {isBuyingNow ? "Бэлдэж байна..." : "Шууд захиалах"}
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

      {/* Tabs */}
      <Tabs defaultValue="description" className="mt-8">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="description">Тайлбар</TabsTrigger>
          <TabsTrigger value="reviews">Сэтгэгдэл</TabsTrigger>
        </TabsList>
        <TabsContent value="description" className="mt-4">
          {description ? (
            <div
              className="prose prose-sm max-w-none dark:prose-invert [&_img]:rounded-lg [&_img]:max-w-full"
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(description, {
                  ALLOWED_TAGS: [
                    "p",
                    "br",
                    "strong",
                    "em",
                    "ul",
                    "ol",
                    "li",
                    "a",
                    "img",
                    "table",
                    "tr",
                    "td",
                    "th",
                    "thead",
                    "tbody",
                    "div",
                    "span",
                    "h1",
                    "h2",
                    "h3",
                    "h4",
                    "h5",
                    "h6",
                    "b",
                    "i",
                    "u",
                    "sub",
                    "sup",
                    "dl",
                    "dt",
                    "dd",
                  ],
                  ALLOWED_ATTR: ["href", "src", "alt", "title", "class", "style", "width", "height", "target", "rel"],
                }),
              }}
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

      {/* Similar / Vendor Products */}
      <SimilarProducts product={product} customTitle={translatedTitle || product.title} />
    </div>
  );
}

// ─── Wishlist Heart Button ─────────────────────────────────

function WishlistHeartButton({ productId }: { productId: string }) {
  const { isInWishlist, toggleWishlist, isLoading } = useWishlist();
  const inWishlist = isInWishlist(productId);

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      onClick={() => toggleWishlist(productId)}
      disabled={isLoading}
      title={inWishlist ? "Хүслийн жагсаалтаас хасах" : "Хүслийн жагсаалтад нэмэх"}
    >
      <Heart className={`h-4 w-4 ${inWishlist ? "fill-red-500 text-red-500" : ""}`} />
    </Button>
  );
}
