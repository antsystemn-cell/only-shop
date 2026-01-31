import { Link } from "react-router-dom";
import { ShoppingCart, Star, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type Product = Tables<"products">;

interface ProductCardProps {
  product: Product;
}

function formatPrice(price: number) {
  return new Intl.NumberFormat("mn-MN").format(price) + "₮";
}

export function ProductCard({ product }: ProductCardProps) {
  const { addToCart } = useCart();
  const { toast } = useToast();

  const discount = product.compare_price
    ? Math.round(((product.compare_price - product.price) / product.compare_price) * 100)
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

  return (
    <Link to={`/product/${product.id}`}>
      <Card className="group overflow-hidden hover-lift hover:shadow-lg transition-all duration-300">
        {/* Image */}
        <div className="relative aspect-square bg-muted overflow-hidden">
          {product.images && product.images[0] ? (
            <img
              src={product.images[0]}
              alt={product.name_mn}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="h-16 w-16 text-muted-foreground/30" />
            </div>
          )}

          {/* Badges */}
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {discount > 0 && (
              <Badge className="bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold text-sm px-2.5 py-1 shadow-lg animate-pulse">
                -{discount}%
              </Badge>
            )}
            {product.is_featured && (
              <Badge className="bg-primary text-primary-foreground">
                Онцлох
              </Badge>
            )}
          </div>

          {/* Quick Add Button */}
          <Button
            size="icon"
            className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 glow-green-sm"
            onClick={handleAddToCart}
          >
            <ShoppingCart className="h-4 w-4" />
          </Button>
        </div>

        <CardContent className="p-4">
          {/* Product Name */}
          <h3 className="font-medium text-sm line-clamp-2 mb-2 group-hover:text-primary transition-colors">
            {product.name_mn}
          </h3>

          {/* Rating */}
          {product.rating && product.rating > 0 && (
            <div className="flex items-center gap-1 mb-2">
              <Star className="h-3.5 w-3.5 fill-primary text-primary" />
              <span className="text-xs text-muted-foreground">
                {product.rating.toFixed(1)} ({product.review_count})
              </span>
            </div>
          )}

          {/* Price */}
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-primary">
              {formatPrice(product.price)}
            </span>
            {product.compare_price && (
              <span className="text-sm text-muted-foreground line-through">
                {formatPrice(product.compare_price)}
              </span>
            )}
          </div>

          {/* Stock Status */}
          {product.stock <= 5 && product.stock > 0 && (
            <p className="text-xs text-destructive mt-2">
              Зөвхөн {product.stock} ширхэг үлдсэн
            </p>
          )}
          {product.stock === 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              Дууссан
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
