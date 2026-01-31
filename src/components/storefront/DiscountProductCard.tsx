import { Link } from "react-router-dom";
import { Heart, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useWishlist } from "@/contexts/WishlistContext";
import type { Tables } from "@/integrations/supabase/types";

type Product = Tables<"products">;

interface DiscountProductCardProps {
  product: Product;
}

export function DiscountProductCard({ product }: DiscountProductCardProps) {
  const { isInWishlist, toggleWishlist } = useWishlist();

  const discount = product.compare_price
    ? Math.round(((product.compare_price - product.price) / product.compare_price) * 100)
    : 0;

  const inWishlist = isInWishlist(product.id);

  const handleToggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist(product.id);
  };

  return (
    <Link to={`/product/${product.id}`}>
      <Card className="group overflow-hidden hover-lift hover:shadow-xl transition-all duration-300 border-0 bg-transparent">
        {/* Large Image */}
        <div className="relative aspect-[3/4] bg-muted rounded-2xl overflow-hidden">
          {product.images && product.images[0] ? (
            <img
              src={product.images[0]}
              alt={product.name_mn}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
              <Package className="h-20 w-20 text-muted-foreground/20" />
            </div>
          )}

          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          {/* Discount Badge - Large and Bold */}
          {discount > 0 && (
            <Badge 
              className={`absolute top-3 left-3 bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold shadow-xl ${
                discount > 20 
                  ? "text-lg px-4 py-2" 
                  : "text-base px-3 py-1.5"
              }`}
            >
              -{discount}%
            </Badge>
          )}

          {/* Wishlist Button */}
          <Button
            size="icon"
            variant="ghost"
            className={`absolute top-3 right-3 bg-white/90 hover:bg-white shadow-lg transition-all ${
              inWishlist ? "text-red-500" : "text-muted-foreground"
            }`}
            onClick={handleToggleWishlist}
          >
            <Heart className={`h-5 w-5 ${inWishlist ? "fill-current" : ""}`} />
          </Button>

          {/* Product Name - Bottom overlay on hover */}
          <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
            <h3 className="font-semibold text-white text-sm line-clamp-2 drop-shadow-lg">
              {product.name_mn}
            </h3>
          </div>
        </div>
      </Card>
    </Link>
  );
}
