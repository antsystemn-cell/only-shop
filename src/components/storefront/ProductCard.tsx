import { Link, useNavigate } from "react-router-dom";
import { ShoppingCart, Zap, Package, Heart, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  const navigate = useNavigate();

  const inWishlist = isInWishlist(product.id);

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
    staleTime: 1000 * 60 * 5,
  });

  const effectiveStock =
    variants && variants.length > 0
      ? variants.reduce((sum, v) => sum + (v.stock || 0), 0)
      : product.stock;

  const displayPrice =
    variants && variants.length > 0
      ? Math.min(
          ...variants.map((v) =>
            v.price !== null ? v.price : product.price + (v.price_adjustment || 0)
          )
        )
      : product.price;

  const hasMultiplePrices =
    variants &&
    variants.length > 1 &&
    new Set(
      variants.map((v) =>
        v.price !== null ? v.price : product.price + (v.price_adjustment || 0)
      )
    ).size > 1;

  const discount = product.compare_price
    ? Math.round(((product.compare_price - displayPrice) / product.compare_price) * 100)
    : 0;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(product);
    toast({ title: "Сагсанд нэмэгдлээ", description: product.name_mn });
  };

  const handleBuyNow = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/buy-now/${product.slug || product.id}`);
  };

  const handleToggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist(product.id);
  };

  return (
    <Link to={`/product/${product.slug || product.id}`}>
      <div className="bg-card rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300 h-full flex flex-col">
        {/* Image */}
        <div className="relative aspect-square bg-muted/30 overflow-hidden">
          {product.images && product.images[0] ? (
            <img
              src={product.images[0]}
              alt={product.name_mn}
              className="w-full h-full object-contain p-2"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="h-12 w-12 text-muted-foreground/30" />
            </div>
          )}

          {/* Badges */}
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {discount > 0 && (
              <Badge className="bg-amber-500 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                Sale
              </Badge>
            )}
            {product.is_featured && (
              <Badge className="bg-emerald-500 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                New
              </Badge>
            )}
          </div>

          {/* Out of stock */}
          {effectiveStock === 0 && (
            <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
              <Badge variant="secondary" className="text-xs rounded-full">Дууссан</Badge>
            </div>
          )}

          {/* Wishlist */}
          <button
            className="absolute top-2 right-2 h-7 w-7 rounded-full bg-card/80 backdrop-blur-sm flex items-center justify-center shadow-sm hover:bg-card transition-colors"
            onClick={handleToggleWishlist}
          >
            <Heart className={`h-3.5 w-3.5 ${inWishlist ? "text-destructive fill-destructive" : "text-muted-foreground"}`} />
          </button>
        </div>

        {/* Content */}
        <div className="p-2.5 flex-1 flex flex-col">
          {/* Title */}
          <h3 className="text-xs font-medium text-foreground line-clamp-2 min-h-[2rem] mb-1.5">
            {product.name_mn}
          </h3>

          {/* Price */}
          <div className="mt-auto">
            <p className="text-sm font-bold text-primary">
              {hasMultiplePrices && <span className="text-[10px] font-normal text-muted-foreground mr-0.5">эхлэх </span>}
              {formatPrice(displayPrice)}
              {product.compare_price && product.compare_price > displayPrice && (
                <span className="text-[10px] font-normal text-muted-foreground line-through ml-1">
                  {formatPrice(product.compare_price)}
                </span>
              )}
            </p>
          </div>

          {/* Rating */}
          {product.rating != null && product.rating > 0 && (
            <div className="flex items-center gap-0.5 mt-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className={`h-3 w-3 ${i < Math.round(product.rating!) ? "text-amber-400 fill-amber-400" : "text-muted"}`} />
              ))}
            </div>
          )}

          {/* Action buttons */}
          {effectiveStock > 0 && (
            <div className="flex gap-1.5 mt-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-7 text-[10px] rounded-full font-semibold px-1"
                onClick={handleAddToCart}
              >
                <ShoppingCart className="h-3 w-3 mr-0.5 shrink-0" />
                Сагслах
              </Button>
              <Button
                size="sm"
                className="flex-1 h-7 text-[10px] rounded-full font-semibold px-1"
                onClick={handleBuyNow}
              >
                <Zap className="h-3 w-3 mr-0.5 shrink-0" />
                Шууд захиалах
              </Button>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
