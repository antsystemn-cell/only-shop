import { useState, useCallback, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/hooks/use-toast";
import { ProductCard } from "@/components/storefront/ProductCard";
import type { Tables } from "@/integrations/supabase/types";

type ProductVariant = Tables<"product_variants">;

function formatPrice(price: number) {
  return new Intl.NumberFormat("mn-MN").format(price) + "₮";
}

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const { addToCart } = useCart();
  const { toast } = useToast();
  const [quantity, setQuantity] = useState(1);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  
  // Embla carousel for swipe support
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
  
  const scrollTo = useCallback((index: number) => {
    if (emblaApi) emblaApi.scrollTo(index);
  }, [emblaApi]);

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
    // Reset variant selections when product changes
    setSelectedSize(null);
    setSelectedColor(null);
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
  const { data: product, isLoading } = useQuery({
    queryKey: ["product", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, categories(*)")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch product variants
  const { data: variants = [] } = useQuery({
    queryKey: ["product-variants", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_variants")
        .select("*")
        .eq("product_id", id)
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (error) throw error;
      return data as ProductVariant[];
    },
    enabled: !!id,
  });

  // Extract unique sizes and colors from variants
  const { availableSizes, availableColors } = useMemo(() => {
    const sizes = new Set<string>();
    const colors: { name: string; hex: string | null }[] = [];
    const colorSet = new Set<string>();

    variants.forEach((variant) => {
      if (variant.size) sizes.add(variant.size);
      if (variant.color && !colorSet.has(variant.color)) {
        colorSet.add(variant.color);
        colors.push({ name: variant.color, hex: variant.color_hex });
      }
    });

    return {
      availableSizes: Array.from(sizes),
      availableColors: colors,
    };
  }, [variants]);

  // Find selected variant based on size and color
  const selectedVariant = useMemo(() => {
    if (!variants.length) return null;
    
    // If both size and color exist in variants, find exact match
    const hasSizes = variants.some(v => v.size);
    const hasColors = variants.some(v => v.color);
    
    return variants.find((v) => {
      const sizeMatch = !hasSizes || !selectedSize || v.size === selectedSize;
      const colorMatch = !hasColors || !selectedColor || v.color === selectedColor;
      return sizeMatch && colorMatch;
    }) || null;
  }, [variants, selectedSize, selectedColor]);

  // Calculate effective price and stock
  const effectivePrice = useMemo(() => {
    if (!product) return 0;
    const adjustment = selectedVariant?.price_adjustment || 0;
    return product.price + adjustment;
  }, [product, selectedVariant]);

  // Calculate effective stock - use variant stock if variants exist
  const effectiveStock = useMemo(() => {
    if (!product) return 0;
    
    // If no variants, use product stock
    if (!variants.length) return product.stock;
    
    // If a specific variant is selected, use that variant's stock
    if (selectedVariant) return selectedVariant.stock;
    
    // If variants exist but no specific one selected, sum all variant stocks
    const totalVariantStock = variants.reduce((sum, v) => sum + (v.stock || 0), 0);
    return totalVariantStock;
  }, [product, variants, selectedVariant]);

  // Check if any variant has stock (for overall availability)
  const hasAnyStock = useMemo(() => {
    if (!variants.length) return (product?.stock || 0) > 0;
    return variants.some(v => v.stock > 0);
  }, [product, variants]);

  // Auto-select first variant options if available
  useEffect(() => {
    if (availableSizes.length > 0 && !selectedSize) {
      setSelectedSize(availableSizes[0]);
    }
    if (availableColors.length > 0 && !selectedColor) {
      setSelectedColor(availableColors[0].name);
    }
  }, [availableSizes, availableColors, selectedSize, selectedColor]);

  // Fetch related products
  const { data: relatedProducts } = useQuery({
    queryKey: ["related-products", product?.category_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .eq("category_id", product!.category_id)
        .neq("id", id)
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

  const images = product.images || [];
  const discount = product.compare_price
    ? Math.round(((product.compare_price - product.price) / product.compare_price) * 100)
    : 0;

  const handleAddToCart = () => {
    addToCart(product, quantity);
    const variantInfo = [selectedSize, selectedColor].filter(Boolean).join(", ");
    toast({
      title: "Сагсанд нэмэгдлээ",
      description: `${product.name_mn}${variantInfo ? ` (${variantInfo})` : ""} - ${quantity} ширхэг`,
    });
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
          <div className="relative">
            {images.length > 0 ? (
              <div className="overflow-hidden rounded-2xl" ref={emblaRef}>
                <div className="flex">
                  {images.map((image, index) => (
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

            {/* Navigation Arrows - Hidden on mobile, visible on hover for desktop */}
            {images.length > 1 && (
              <>
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute left-3 top-1/2 -translate-y-1/2 hidden md:flex opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm shadow-lg"
                  onClick={scrollPrev}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute right-3 top-1/2 -translate-y-1/2 hidden md:flex opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm shadow-lg"
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

            {/* Dot Indicators for Mobile */}
            {images.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                {images.map((_, index) => (
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
          {images.length > 1 && (
            <div className="hidden md:flex gap-2 overflow-x-auto pb-2">
              {images.map((image, index) => (
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
              {formatPrice(effectivePrice)}
            </span>
            {product.compare_price && (
              <span className="text-xl text-muted-foreground line-through">
                {formatPrice(product.compare_price)}
              </span>
            )}
            {selectedVariant?.price_adjustment && selectedVariant.price_adjustment !== 0 && (
              <span className="text-sm text-muted-foreground">
                ({selectedVariant.price_adjustment > 0 ? "+" : ""}{formatPrice(selectedVariant.price_adjustment)})
              </span>
            )}
          </div>

          <Separator />

          {/* Size Selection - Card Style */}
          {availableSizes.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Хэмжээ</span>
                {selectedSize && (
                  <span className="text-sm text-muted-foreground">Сонгосон: {selectedSize}</span>
                )}
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {availableSizes.map((size) => {
                  const isSelected = selectedSize === size;
                  const variant = variants.find(v => v.size === size && (!selectedColor || v.color === selectedColor));
                  const isAvailable = variant ? variant.stock > 0 : true;
                  const priceAdjustment = variant?.price_adjustment || 0;
                  
                  return (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      disabled={!isAvailable}
                      className={`
                        relative p-3 rounded-xl border-2 text-center transition-all
                        ${isSelected 
                          ? "border-primary bg-primary/5 shadow-md" 
                          : "border-input bg-background hover:border-primary/50 hover:bg-muted/50"
                        }
                        ${!isAvailable && "opacity-40 cursor-not-allowed"}
                      `}
                    >
                      <span className={`block font-semibold ${isSelected ? "text-primary" : ""}`}>
                        {size}
                      </span>
                      {priceAdjustment !== 0 && (
                        <span className="text-xs text-muted-foreground">
                          {priceAdjustment > 0 ? "+" : ""}{formatPrice(priceAdjustment)}
                        </span>
                      )}
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

          {/* Color Selection - Card Style with Labels */}
          {availableColors.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Өнгө</span>
                {selectedColor && (
                  <span className="text-sm text-muted-foreground">Сонгосон: {selectedColor}</span>
                )}
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {availableColors.map((color) => {
                  const isSelected = selectedColor === color.name;
                  const variant = variants.find(v => v.color === color.name && (!selectedSize || v.size === selectedSize));
                  const isAvailable = variant ? variant.stock > 0 : true;
                  const priceAdjustment = variant?.price_adjustment || 0;
                  
                  return (
                    <button
                      key={color.name}
                      onClick={() => setSelectedColor(color.name)}
                      disabled={!isAvailable}
                      className={`
                        relative p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-2
                        ${isSelected 
                          ? "border-primary bg-primary/5 shadow-md" 
                          : "border-input bg-background hover:border-primary/50 hover:bg-muted/50"
                        }
                        ${!isAvailable && "opacity-40 cursor-not-allowed"}
                      `}
                    >
                      {/* Color swatch */}
                      <div 
                        className={`w-8 h-8 rounded-full border shadow-sm ${
                          color.hex && isLightColor(color.hex) ? "border-border" : "border-transparent"
                        }`}
                        style={{ backgroundColor: color.hex || "#888888" }}
                      />
                      <span className={`text-xs font-medium truncate w-full text-center ${isSelected ? "text-primary" : ""}`}>
                        {color.name}
                      </span>
                      {priceAdjustment !== 0 && (
                        <span className="text-xs text-muted-foreground">
                          {priceAdjustment > 0 ? "+" : ""}{formatPrice(priceAdjustment)}
                        </span>
                      )}
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

          {/* Dimensions from variant */}
          {selectedVariant?.dimensions && (
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">Хэмжээс:</span>
              <span className="text-muted-foreground">{selectedVariant.dimensions}</span>
            </div>
          )}

          {/* Description */}
          {product.description_mn && (
            <p className="text-muted-foreground">{product.description_mn}</p>
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
                    <span className="text-sm text-destructive">Энэ хувилбар дууссан</span>
                  </>
                )
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
              onClick={() => setQuantity((q) => Math.min(selectedVariant?.stock || effectiveStock, q + 1))}
              disabled={quantity >= (selectedVariant?.stock || effectiveStock) || !hasAnyStock}
            >
              <Plus className="h-4 w-4" />
            </Button>
            </div>

            <Button
              size="lg"
              className="flex-1 gap-2 glow-green"
              onClick={handleAddToCart}
              disabled={!hasAnyStock || (selectedVariant && selectedVariant.stock === 0)}
            >
              <ShoppingCart className="h-5 w-5" />
              Сагсанд нэмэх
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
            <div className="prose prose-sm max-w-none">
              {product.description_mn || product.description || (
                <p className="text-muted-foreground">Тайлбар байхгүй</p>
              )}
            </div>
          </TabsContent>
          <TabsContent value="specs" className="mt-4">
            {product.specs && typeof product.specs === "object" && Object.keys(product.specs).length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(product.specs as Record<string, string>).map(([key, value]) => (
                  <div key={key} className="flex justify-between py-2 border-b">
                    <span className="font-medium">{key}</span>
                    <span className="text-muted-foreground">{value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">Техникийн үзүүлэлт байхгүй</p>
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
