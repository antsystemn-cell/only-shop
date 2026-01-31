import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Heart, ShoppingBag, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ProductCard } from "@/components/storefront/ProductCard";

export default function Wishlist() {
  const { user } = useAuth();

  const { data: wishlistProducts, isLoading } = useQuery({
    queryKey: ["wishlist-products", user?.id],
    queryFn: async () => {
      if (!user) return [];

      // First get wishlist items
      const { data: wishlistItems, error: wishlistError } = await supabase
        .from("wishlists")
        .select("product_id")
        .eq("user_id", user.id);

      if (wishlistError) throw wishlistError;
      if (!wishlistItems || wishlistItems.length === 0) return [];

      // Then fetch the products
      const productIds = wishlistItems.map((item) => item.product_id);
      const { data: products, error: productsError } = await supabase
        .from("products")
        .select("*")
        .in("id", productIds)
        .eq("is_active", true);

      if (productsError) throw productsError;
      return products || [];
    },
    enabled: !!user,
  });

  if (!user) {
    return (
      <div className="container py-16">
        <div className="max-w-md mx-auto text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-muted flex items-center justify-center">
            <Heart className="h-10 w-10 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Хүслийн жагсаалт</h1>
          <p className="text-muted-foreground mb-6">
            Хүслийн жагсаалтаа харахын тулд нэвтэрнэ үү
          </p>
          <Link to="/auth">
            <Button size="lg">Нэвтрэх</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 rounded-lg bg-red-100">
          <Heart className="h-6 w-6 text-red-500" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Хүслийн жагсаалт</h1>
          <p className="text-muted-foreground">
            {wishlistProducts?.length || 0} бараа хадгалсан
          </p>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : wishlistProducts && wishlistProducts.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
          {wishlistProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-muted flex items-center justify-center">
            <Heart className="h-10 w-10 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold mb-2">
            Хүслийн жагсаалт хоосон байна
          </h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Танд таалагдсан барааны зүрхэн дээр дарж хүслийн жагсаалтандаа нэмээрэй
          </p>
          <Link to="/shop">
            <Button size="lg" className="gap-2">
              <ShoppingBag className="h-5 w-5" />
              Дэлгүүр үзэх
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
