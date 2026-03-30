import { Link } from "react-router-dom";
import { ShoppingCart, Package, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Product = Tables<"products">;

interface ProductCardProps {
  product: Product;
  variant?: "default" | "featured";
}

function formatPrice(price: number) {
  return new Intl.NumberFormat("mn-MN").format(price) + "₮";
}

export function ProductCard({ product, variant = "default" }: ProductCardProps) {
  const { addToCart } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { toast } = useToast();

  const isFeatured = variant === "featured";
  const inWishlist = isInWishlist(product.id);

  // Fetch variants to determine true availability and pricing
  const { data: variants } = useQuery({
    queryKey: ["product-variants-card", product.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_variants")
        .select("stock, price, price_adjustment")
        .eq("product_id", product.id)
        .eq("is_active", true);

      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  // Calculate effective stock - if variants exist, sum variant stocks
  const effectiveStock =
    variants && variants.length > 0
      ? variants.reduce((sum, v) => sum + (v.stock || 0), 0)
      : product.stock;

  // Calculate display price - use minimum variant price if variants exist
  const displayPrice =
    variants && variants.length > 0
      ? Math.min(
          ...variants.map((v) =>
            v.price !== null ? v.price : product.price + (v.price_adjustment || 0)
          )
        )
      : product.price;

  // Check if there are multiple prices (for "from X₮" display)
  const hasMultiplePrices =
    variants &&
    variants.length > 1 &&
    new Set(
      variants.map((v) =>
        v.price !== null ? v.price : product.price + (v.price_adjustment || 0)
      )
    ).size > 1;

  const discount = product.compare_price
    ? Math.round(
        ((product.compare_price - displayPrice) / product.compare_price) * 100
      )
    : 0;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(product);
    toast({
      title: "Сагсанд нэмэгдлээ",
      description: product.name_mn,
    });
  };

  const handleToggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist(product.id);
  };

  return (
    <Link to={`/product/${product.slug || product.id}`}>
      <Card className="group overflow-hidden hover-lift hover:shadow-lg transition-all duration-300">
        {/* Image */}
        <div className="relative aspect-square bg-card overflow-hidden">
          {product.images && product.images[0] ? (
            <img
              src={product.images[0]}
              alt={product.name_mn}
              className="w-full h-full object-contain p-1 group-hover:scale-105 transition-transform duration-500"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="h-16 w-16 text-muted-foreground/30" />
            </div>
          )}

          {/* Badges */}
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {discount > 0 && (
              <Badge
                className={`bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold shadow-lg animate-pulse ${
                  discount > 20 ? "text-base px-3 py-1.5" : "text-sm px-2.5 py-1"
                }`}
              >
                -{discount}%
              </Badge>
            )}
            {product.is_featured && (
              <Badge className="bg-primary text-primary-foreground">Онцлох</Badge>
            )}
          </div>

          {/* Out of stock overlay */}
          {effectiveStock === 0 && (
            <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
              <Badge variant="secondary" className="text-sm">
                Дууссан
              </Badge>
            </div>
          )}

          {/* Wishlist Button */}
          <Button
            size="icon"
            variant="ghost"
            className={`absolute top-2 right-2 bg-background/80 hover:bg-background transition-all ${
              inWishlist ? "text-red-500" : "text-muted-foreground"
            }`}
            onClick={handleToggleWishlist}
          >
            <Heart className={`h-5 w-5 ${inWishlist ? "fill-current" : ""}`} />
          </Button>

          {/* Quick Add Button */}
          {effectiveStock > 0 && (
            <Button
              size="icon"
              className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 glow-green-sm"
              onClick={handleAddToCart}
            >
              <ShoppingCart className="h-4 w-4" />
            </Button>
          )}
        </div>

        <CardContent className={isFeatured ? "p-3" : "p-4"}>
          {/* Brand */}
          {product.brand && !isFeatured && (
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {product.brand}
            </span>
          )}

          {/* Product Name */}
          <h3
            className={`font-medium text-sm group-hover:text-primary transition-colors ${
              isFeatured
                ? "line-clamp-2 min-h-[2.5rem]"
                : "line-clamp-2 min-h-[2.5rem]"
            }`}
          >
            {product.name_mn}
          </h3>

          {/* Price and other details */}
          {!isFeatured && (
            <>
              {/* Price */}
              <div className="flex items-center gap-2 mt-2">
                <span className="text-lg font-bold text-primary">
                  {hasMultiplePrices && (
                    <span className="text-sm font-normal text-muted-foreground mr-1">
                      эхлэх
                    </span>
                  )}
                  {formatPrice(displayPrice)}
                </span>
                {product.compare_price && product.compare_price > displayPrice && (
                  <span className="text-sm text-muted-foreground line-through">
                    {formatPrice(product.compare_price)}
                  </span>
                )}
              </div>

              {/* Stock Status */}
              {effectiveStock <= 5 && effectiveStock > 0 && (
                <p className="text-xs text-destructive mt-2">
                  Зөвхөн {effectiveStock} ширхэг үлдсэн
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
