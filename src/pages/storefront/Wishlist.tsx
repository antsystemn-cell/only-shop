import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Heart, ShoppingBag, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ProductCard } from "@/components/storefront/ProductCard";
import { OtProductCardComponent } from "@/components/storefront/OtProductCard";
import { fetchItemsByIds } from "@/services/otApi";

export default function Wishlist() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["wishlist-products", user?.id],
    queryFn: async () => {
      if (!user) return { localProducts: [], otProducts: [] };

      const [localWishlistRes, otWishlistRes] = await Promise.all([
        supabase.from("wishlists").select("product_id").eq("user_id", user.id),
        supabase.from("ot_wishlists" as any).select("product_id").eq("user_id", user.id),
      ]);

      if (localWishlistRes.error) throw localWishlistRes.error;
      if (otWishlistRes.error) throw otWishlistRes.error;

      const localIds = (localWishlistRes.data || []).map((item) => item.product_id);
      const otData = (otWishlistRes.data as unknown as Array<{ product_id: string }>) || [];
      const otIds = otData.map((item) => item.product_id);

      const [localProductsRes, otProducts] = await Promise.all([
        localIds.length > 0
          ? supabase.from("products").select("*").in("id", localIds).eq("is_active", true)
          : Promise.resolve({ data: [], error: null } as any),
        otIds.length > 0 ? fetchItemsByIds(otIds, 6, { includeUnavailable: true }) : Promise.resolve([]),
      ]);

      if (localProductsRes.error) throw localProductsRes.error;

      return {
        localProducts: localProductsRes.data || [],
        otProducts,
      };
    },
    enabled: !!user,
  });

  const totalCount = (data?.localProducts.length || 0) + (data?.otProducts.length || 0);

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
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 rounded-lg bg-muted">
          <Heart className="h-6 w-6 text-foreground" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Хүслийн жагсаалт</h1>
          <p className="text-muted-foreground">{totalCount} бараа хадгалсан</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : totalCount > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
          {(data?.localProducts || []).map((product) => (
            <ProductCard key={`local-${product.id}`} product={product} />
          ))}
          {(data?.otProducts || []).map((product) => (
            <OtProductCardComponent key={`ot-${product.id}`} product={product} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-muted flex items-center justify-center">
            <Heart className="h-10 w-10 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Хүслийн жагсаалт хоосон байна</h2>
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
