import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Minus, Plus, Package, Zap, Truck } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Product = Tables<"products">;

function formatPrice(price: number) {
  return new Intl.NumberFormat("mn-MN").format(price) + "₮";
}

export default function BuyNow() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToCart, items, removeFromCart } = useCart();
  const [quantity, setQuantity] = useState(1);

  const { data: product, isLoading } = useQuery({
    queryKey: ["buy-now-product", id],
    queryFn: async () => {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id!);
      let query = supabase.from("products").select("*").eq("is_active", true);
      if (isUuid) {
        query = query.eq("id", id);
      } else {
        query = query.eq("slug", id);
      }
      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      return data as Product;
    },
    enabled: !!id,
  });

  const handleProceed = () => {
    if (!product) return;
    // Remove existing cart item for this product first, then add with chosen quantity
    const existing = items.find(i => i.product.id === product.id);
    if (existing) {
      removeFromCart(product.id);
    }
    addToCart(product, quantity);
    navigate("/checkout", { state: { buyNowProductId: product.id } });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Бараа олдсонгүй</p>
        <Link to="/shop">
          <Button>Дэлгүүр рүү буцах</Button>
        </Link>
      </div>
    );
  }

  const totalPrice = product.price * quantity;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold truncate">Шууд захиалах</h1>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-6">
        {/* Product Card */}
        <div className="bg-card rounded-2xl border overflow-hidden">
          <div className="flex gap-4 p-4">
            <div className="w-28 h-28 rounded-xl bg-muted/30 overflow-hidden shrink-0 border">
              {product.images && product.images[0] ? (
                <img
                  src={product.images[0]}
                  alt={product.name_mn}
                  className="w-full h-full object-contain p-1"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="h-10 w-10 text-muted-foreground/30" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-base leading-tight line-clamp-3">
                {product.name_mn}
              </h2>
              <p className="text-primary font-bold text-lg mt-2">
                {formatPrice(product.price)}
              </p>
              {product.compare_price && product.compare_price > product.price && (
                <p className="text-sm text-muted-foreground line-through">
                  {formatPrice(product.compare_price)}
                </p>
              )}
            </div>
          </div>

          {/* Quantity selector */}
          <div className="border-t px-4 py-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Тоо ширхэг</span>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-full"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-8 text-center text-lg font-bold">{quantity}</span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-full"
                  onClick={() => setQuantity(quantity + 1)}
                  disabled={quantity >= (product.stock || 99)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Price Summary */}
        <div className="bg-card rounded-2xl border p-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Нэгж үнэ</span>
            <span>{formatPrice(product.price)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Тоо ширхэг</span>
            <span>×{quantity}</span>
          </div>
          <Separator />
          <div className="flex justify-between items-center">
            <span className="font-semibold">Нийт дүн</span>
            <span className="text-xl font-bold text-primary">{formatPrice(totalPrice)}</span>
          </div>
        </div>

        {/* Action Button */}
        <Button
          className="w-full h-12 rounded-xl text-base font-semibold"
          onClick={handleProceed}
        >
          <Zap className="h-5 w-5 mr-2" />
          Захиалга үргэлжлүүлэх
        </Button>
      </div>
    </div>
  );
}
