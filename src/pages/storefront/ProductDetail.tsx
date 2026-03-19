import DOMPurify from "dompurify";
import { useState, useCallback, useEffect, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import useEmblaCarousel from "embla-carousel-react";
import {
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  ShoppingCart,
  Star,
  Package,
  Truck,
  Shield,
  Loader2,
  Check,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/hooks/use-toast";
import { ProductCard } from "@/components/storefront/ProductCard";
import { useTrackRecentlyViewed } from "@/hooks/useRecentlyViewed";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { getSeoImage } from "@/utils/seoHelpers";

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
  price_adjustment: number | null;
  stock: number;
  sku_suffix: string | null;
  is_active: boolean | null;
  display_order: number | null;
  images: string[] | null;
}

function formatPrice(price: number) {
  return new Intl.NumberFormat("mn-MN").format(price) + "₮";
}

export default function ProductDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { addToCart } = useCart();
  const { toast } = useToast();
  const [quantity, setQuantity] = useState(1);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

  // Embla carousel for swipe support
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });

  const scrollTo = useCallback(
    (index: number) => {
      if (emblaApi) emblaApi.scrollTo(index);
    },
    [emblaApi]
  );

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  // Reset carousel when product changes
  useEffect(() => {
    if (emblaApi) {
      emblaApi.scrollTo(0);
      setSelectedIndex(0);
    }
    setSelectedVariantId(null);
    setQuantity(1);
  }, [id, emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi, onSelect]);

  const scrollPrev = useCallback(() => {
    if (emblaApi) emblaApi.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    if (emblaApi) emblaApi.scrollNext();
  }, [emblaApi]);

  // Fetch product
  // Check if the param looks like a UUID
  const isUuid = id ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) : false;

  const { data: product, isLoading } = useQuery({
    queryKey: ["product", id],
    queryFn: async () => {
      // Try by UUID first, then by slug
      if (isUuid) {
        const { data, error } = await supabase
          .from("products")
          .select("*, categories(*)")
          .eq("id", id!)
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from("products")
          .select("*, categories(*)")
          .eq("slug", id!)
          .single();
        if (error) throw error;
        return data;
      }
    },
    enabled: !!id,
  });

  // Track recently viewed (fire-and-forget)
  const trackView = useTrackRecentlyViewed();
  useEffect(() => {
    if (!product) return;
    trackView({
      provider: "local",
      provider_product_id: product.id,
      canonical_key: `local:${product.id}`,
      title_snapshot: product.name_mn || product.name,
      image_snapshot: product.images?.[0] || "",
      price_snapshot: product.price,
      currency: "₮",
      product_url: `/product/${product.slug || product.id}`,
    });
  }, [product?.id]);

  // Dynamic OG meta tags for link previews
  useDocumentMeta({
    title: product?.seo_title || product?.name_mn,
    description: product?.seo_description || (product?.description_mn ? product.description_mn.replace(/<[^>]*>/g, "").slice(0, 160) : undefined),
    image: product?.images?.[0],
    url: product ? `https://only.mn/product/${product.slug || product.id}` : undefined,
    type: "product",
  });

  // Fetch product variants
  const productId = product?.id;
  const { data: variants = [] } = useQuery({
    queryKey: ["product-variants", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_variants")
        .select("*")
        .eq("product_id", productId!)
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (error) throw error;
      return data as ProductVariant[];
    },
    enabled: !!productId,
  });

  // Selected variant object
  const selectedVariant = useMemo(() => {
    if (!selectedVariantId) return null;
    return variants.find((v) => v.id === selectedVariantId) || null;
  }, [variants, selectedVariantId]);

  // Auto-select first variant when variants load
  useEffect(() => {
    if (variants.length > 0 && !selectedVariantId) {
      // Select first variant with stock, or just first one
      const firstWithStock = variants.find((v) => v.stock > 0);
      setSelectedVariantId(firstWithStock?.id || variants[0].id);
    }
  }, [variants, selectedVariantId]);

  // Calculate effective price - NEW LOGIC: Use variant's absolute price
  const effectivePrice = useMemo(() => {
    if (!product) return 0;

    // If no variants, use base product price
    if (!variants.length) return product.price;

    // If variant selected, use variant's own price (absolute, not additive)
    if (selectedVariant) {
      // Use variant.price if set, otherwise fall back to base price + adjustment (legacy)
      if (
        selectedVariant.price !== null &&
        selectedVariant.price !== undefined
      ) {
        return selectedVariant.price;
      }
      // Legacy fallback
      return product.price + (selectedVariant.price_adjustment || 0);
    }

    // No variant selected yet, show minimum price
    const minPrice = Math.min(
      ...variants.map((v) =>
        v.price !== null ? v.price : product.price + (v.price_adjustment || 0)
      )
    );
    return minPrice;
  }, [product, variants, selectedVariant]);

  // Calculate effective stock
  const effectiveStock = useMemo(() => {
    if (!product) return 0;

    // If no variants, use product stock
    if (!variants.length) return product.stock;

    // If variant selected, use that variant's stock
    if (selectedVariant) return selectedVariant.stock;

    // Total of all variants
    return variants.reduce((sum, v) => sum + (v.stock || 0), 0);
  }, [product, variants, selectedVariant]);

  // Check if any variant has stock
  const hasAnyStock = useMemo(() => {
    if (!variants.length) return (product?.stock || 0) > 0;
    return variants.some((v) => v.stock > 0);
  }, [product, variants]);

  // Get images - use variant images if selected, otherwise product images
  const displayImages = useMemo(() => {
    if (
      selectedVariant?.images &&
      selectedVariant.images.length > 0
    ) {
      return selectedVariant.images;
    }
    return product?.images || [];
  }, [product, selectedVariant]);

  // Fetch related products
  const { data: relatedProducts } = useQuery({
    queryKey: ["related-products", product?.category_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .eq("category_id", product!.category_id)
        .neq("id", product!.id)
        .limit(4);

      if (error) throw error;
      return data;
    },
    enabled: !!product?.category_id,
  });

  if (isLoading) {
    return (
      <div className="container py-20 flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container py-20 text-center">
        <h1 className="text-2xl font-bold mb-4">Бараа олдсонгүй</h1>
        <Link to="/shop">
          <Button>Дэлгүүр рүү буцах</Button>
        </Link>
      </div>
    );
  }

  const discount = product.compare_price
    ? Math.round(
        ((product.compare_price - effectivePrice) / product.compare_price) * 100
      )
    : 0;

  const handleAddToCart = () => {
    addToCart(product, quantity);
    const variantName = selectedVariant?.name || 
      [selectedVariant?.size, selectedVariant?.color, selectedVariant?.dimensions]
        .filter(Boolean)
        .join(", ");
    toast({
      title: "Сагсанд нэмэгдлээ",
      description: `${product.name_mn}${variantName ? ` (${variantName})` : ""} - ${quantity} ширхэг`,
    });
  };

  const getVariantDisplayName = (v: ProductVariant) => {
    if (v.name) return v.name;
    const parts = [v.size, v.color, v.dimensions].filter(Boolean);
    return parts.length > 0 ? parts.join(" / ") : "Хувилбар";
  };

  const getVariantPrice = (v: ProductVariant) => {
    if (v.price !== null && v.price !== undefined) {
      return v.price;
    }
    return product.price + (v.price_adjustment || 0);
  };

  // Helper to determine if a color is light
  function isLightColor(hex: string): boolean {
    const c = hex.replace("#", "");
    const r = parseInt(c.substr(0, 2), 16);
    const g = parseInt(c.substr(2, 2), 16);
    const b = parseInt(c.substr(4, 2), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 155;
  }

  return (
    <div className="container py-8 animate-fade-in">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link to="/" className="hover:text-foreground">
          Нүүр
        </Link>
        <span>/</span>
        <Link to="/shop" className="hover:text-foreground">
          Дэлгүүр
        </Link>
        {product.categories && (
          <>
            <span>/</span>
            <Link
              to={`/shop?category=${product.category_id}`}
              className="hover:text-foreground"
            >
              {(product.categories as { name_mn: string }).name_mn}
            </Link>
          </>
        )}
        <span>/</span>
        <span className="text-foreground">{product.name_mn}</span>
      </nav>

      <div className="grid lg:grid-cols-2 gap-6 lg:gap-12">
        {/* Image Gallery with Swipe */}
        <div className="space-y-4">
          {/* Main Image Carousel */}
          <div className="relative group">
            {displayImages.length > 0 ? (
              <div className="overflow-hidden rounded-2xl" ref={emblaRef}>
                <div className="flex">
                  {displayImages.map((image, index) => (
                    <div
                      key={index}
                      className="flex-[0_0_100%] min-w-0 aspect-[4/5] md:aspect-square bg-muted"
                    >
                      <img
                        src={image}
                        alt={`${product.name_mn} ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="aspect-[4/5] md:aspect-square rounded-2xl bg-muted flex items-center justify-center">
                <Package className="h-24 w-24 text-muted-foreground/30" />
              </div>
            )}

            {/* Navigation Arrows */}
            {displayImages.length > 1 && (
              <>
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute left-3 top-1/2 -translate-y-1/2 hidden md:flex opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm shadow-lg"
                  onClick={scrollPrev}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute right-3 top-1/2 -translate-y-1/2 hidden md:flex opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm shadow-lg"
                  onClick={scrollNext}
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </>
            )}

            {/* Badges */}
            <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
              {discount > 0 && (
                <Badge className="bg-destructive text-destructive-foreground text-sm px-3 py-1">
                  -{discount}%
                </Badge>
              )}
              {product.is_featured && (
                <Badge className="bg-primary text-primary-foreground">
                  Онцлох
                </Badge>
              )}
            </div>

            {/* Dot Indicators */}
            {displayImages.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                {displayImages.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => scrollTo(index)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      index === selectedIndex
                        ? "bg-white w-6"
                        : "bg-white/50 hover:bg-white/70"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Thumbnails - Desktop only */}
          {displayImages.length > 1 && (
            <div className="hidden md:flex gap-2 overflow-x-auto pb-2">
              {displayImages.map((image, index) => (
                <button
                  key={index}
                  onClick={() => scrollTo(index)}
                  className={`shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                    index === selectedIndex
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-transparent hover:border-muted-foreground/30"
                  }`}
                >
                  <img
                    src={image}
                    alt={`${product.name_mn} ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="space-y-6">
          {/* Brand & Title */}
          <div>
            {product.brand && (
              <span className="text-sm font-medium text-primary uppercase tracking-wide">
                {product.brand}
              </span>
            )}
            <h1 className="text-2xl lg:text-3xl font-bold">{product.name_mn}</h1>
            {product.rating && product.rating > 0 && (
              <div className="flex items-center gap-2 mt-2">
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`h-4 w-4 ${
                        star <= Math.round(product.rating || 0)
                          ? "fill-primary text-primary"
                          : "text-muted-foreground"
                      }`}
                    />
                  ))}
                </div>
                <span className="text-sm text-muted-foreground">
                  ({product.review_count} үнэлгээ)
                </span>
              </div>
            )}
          </div>

          {/* Price */}
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold text-primary">
              {variants.length > 0 && !selectedVariant && "₮"}
              {formatPrice(effectivePrice)}
            </span>
            {product.compare_price && product.compare_price > effectivePrice && (
              <span className="text-xl text-muted-foreground line-through">
                {formatPrice(product.compare_price)}
              </span>
            )}
          </div>

          <Separator />

          {/* Variant Selection - New Card Style */}
          {variants.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Хувилбар сонгох</span>
                {selectedVariant && (
                  <span className="text-sm text-muted-foreground">
                    Сонгосон: {getVariantDisplayName(selectedVariant)}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {variants.map((variant) => {
                  const isSelected = selectedVariantId === variant.id;
                  const isAvailable = variant.stock > 0;
                  const variantPrice = getVariantPrice(variant);

                  return (
                    <button
                      key={variant.id}
                      onClick={() => {
                        setSelectedVariantId(variant.id);
                        setQuantity(1);
                        setSelectedIndex(0);
                      }}
                      disabled={!isAvailable}
                      className={`
                        relative p-3 rounded-xl border-2 text-left transition-all
                        ${
                          isSelected
                            ? "border-primary bg-primary/5 shadow-md"
                            : "border-input bg-background hover:border-primary/50 hover:bg-muted/50"
                        }
                        ${!isAvailable && "opacity-40 cursor-not-allowed"}
                      `}
                    >
                      <div className="flex items-start gap-2">
                        {/* Color swatch if exists */}
                        {variant.color_hex && (
                          <div
                            className={`w-6 h-6 rounded-full border shrink-0 ${
                              isLightColor(variant.color_hex)
                                ? "border-border"
                                : "border-transparent"
                            }`}
                            style={{ backgroundColor: variant.color_hex }}
                          />
                        )}
                        {/* Variant image thumbnail */}
                        {!variant.color_hex &&
                          variant.images &&
                          variant.images[0] && (
                            <img
                              src={variant.images[0]}
                              alt=""
                              className="w-6 h-6 rounded object-cover shrink-0"
                            />
                          )}
                        <div className="flex-1 min-w-0">
                          <span
                            className={`block font-medium text-sm truncate ${
                              isSelected ? "text-primary" : ""
                            }`}
                          >
                            {getVariantDisplayName(variant)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatPrice(variantPrice)}
                          </span>
                        </div>
                      </div>
                      {!isAvailable && (
                        <span className="absolute inset-0 flex items-center justify-center">
                          <span className="w-full h-0.5 bg-destructive/50 rotate-45 absolute" />
                        </span>
                      )}
                      {isSelected && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                          <Check className="h-3 w-3 text-primary-foreground" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Selected Variant Details */}
          {selectedVariant && (
            <div className="flex flex-wrap gap-4 text-sm">
              {selectedVariant.dimensions && (
                <div>
                  <span className="font-medium">Хэмжээ:</span>{" "}
                  <span className="text-muted-foreground">
                    {selectedVariant.dimensions}
                  </span>
                </div>
              )}
              {selectedVariant.weight && (
                <div>
                  <span className="font-medium">Жин:</span>{" "}
                  <span className="text-muted-foreground">
                    {selectedVariant.weight}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Short Description */}
          {product.description_mn && (
            <div
              className="text-muted-foreground prose prose-sm max-w-none line-clamp-3 [&_img]:hidden [&_table]:hidden [&_iframe]:hidden"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(product.description_mn.replace(/<[^>]*>/g, ' ').substring(0, 200) + (product.description_mn.length > 200 ? '...' : '')) }}
            />
          )}

          {/* Stock Status */}
          <div className="flex items-center gap-2">
            {hasAnyStock ? (
              selectedVariant ? (
                selectedVariant.stock > 0 ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-sm">
                      Нөөцөнд {selectedVariant.stock} ширхэг байна
                    </span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-destructive" />
                    <span className="text-sm text-destructive">
                      Энэ хувилбар дууссан
                    </span>
                  </>
                )
              ) : variants.length > 0 ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  <span className="text-sm">Хувилбар сонгоно уу</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  <span className="text-sm">
                    Нөөцөнд {effectiveStock} ширхэг байна
                  </span>
                </>
              )
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-destructive" />
                <span className="text-sm text-destructive">Дууссан</span>
              </>
            )}
          </div>

          {/* Quantity & Add to Cart */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center border rounded-lg">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-12 text-center font-medium">{quantity}</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  setQuantity((q) =>
                    Math.min(selectedVariant?.stock || effectiveStock, q + 1)
                  )
                }
                disabled={
                  quantity >= (selectedVariant?.stock || effectiveStock) ||
                  !hasAnyStock
                }
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <Button
              size="lg"
              className="flex-1 gap-2"
              variant="outline"
              onClick={handleAddToCart}
              disabled={
                !hasAnyStock ||
                (variants.length > 0 && !selectedVariant) ||
                (selectedVariant && selectedVariant.stock === 0)
              }
            >
              <ShoppingCart className="h-5 w-5" />
              Сагсанд нэмэх
            </Button>
            <Button
              size="lg"
              className="flex-1 gap-2"
              onClick={() => {
                handleAddToCart();
                navigate("/checkout", { state: { buyNowProductId: product.id } });
              }}
              disabled={
                !hasAnyStock ||
                (variants.length > 0 && !selectedVariant) ||
                (selectedVariant && selectedVariant.stock === 0)
              }
            >
              <Zap className="h-5 w-5" />
              Шууд захиалах
            </Button>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Truck className="h-5 w-5 text-primary" />
              <div className="text-sm">
                <p className="font-medium">Хурдан хүргэлт</p>
                <p className="text-muted-foreground">1-3 хоног</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Shield className="h-5 w-5 text-primary" />
              <div className="text-sm">
                <p className="font-medium">Баталгаат</p>
                <p className="text-muted-foreground">Чанарын баталгаа</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Package className="h-5 w-5 text-primary" />
              <div className="text-sm">
                <p className="font-medium">Буцаалт</p>
                <p className="text-muted-foreground">7 хоногт</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs: Specs & Description */}
      <div className="mt-12">
        <Tabs defaultValue="description">
          <TabsList>
            <TabsTrigger value="description">Тайлбар</TabsTrigger>
            <TabsTrigger value="specs">Техникийн үзүүлэлт</TabsTrigger>
          </TabsList>
          <TabsContent value="description" className="mt-4">
            <div className="prose prose-sm max-w-none [&_table]:border-collapse [&_table]:w-full [&_td]:border [&_td]:border-border [&_td]:p-2 [&_th]:border [&_th]:border-border [&_th]:p-2 [&_th]:bg-muted [&_th]:font-semibold [&_img]:rounded-lg [&_img]:max-w-full [&_iframe]:rounded-lg [&_iframe]:max-w-full [&_iframe]:aspect-video">
              {product.description_mn || product.description ? (
                <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(product.description_mn || product.description || '', { ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'img', 'table', 'tr', 'td', 'th', 'thead', 'tbody', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'b', 'i', 'u'], ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'style', 'width', 'height'] }) }} />
              ) : (
                <p className="text-muted-foreground">Тайлбар байхгүй</p>
              )}
            </div>
          </TabsContent>
          <TabsContent value="specs" className="mt-4">
            {product.specs &&
            typeof product.specs === "object" &&
            Object.keys(product.specs).length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(product.specs as Record<string, string>).map(
                  ([key, value]) => (
                    <div key={key} className="flex justify-between py-2 border-b">
                      <span className="font-medium">{key}</span>
                      <span className="text-muted-foreground">{value}</span>
                    </div>
                  )
                )}
              </div>
            ) : (
              <p className="text-muted-foreground">
                Техникийн үзүүлэлт байхгүй
              </p>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Related Products */}
      {relatedProducts && relatedProducts.length > 0 && (
        <section className="mt-16">
          <h2 className="text-2xl font-bold mb-6">Төстэй бараанууд</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {relatedProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
