import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Heart, ShoppingBag, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { ProductCard } from "@/components/storefront/ProductCard";

function RemoveButton({ productId }: { productId: string }) {
  const { toggleWishlist, isLoading } = useWishlist();
  const queryClient = useQueryClient();

  const handleRemove = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await toggleWishlist(productId);
    queryClient.invalidateQueries({ queryKey: ["wishlist-products"] });
  };

  return (
    <Button variant="destructive" size="sm" className="w-full gap-1.5 text-xs mt-1" onClick={handleRemove} disabled={isLoading}>
      <X className="h-3.5 w-3.5" />Хасах
    </Button>
  );
}

export default function Wishlist() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["wishlist-products", user?.id],
    queryFn: async () => {
      if (!user) return { localProducts: [] };

      const { data: wishlistRes, error } = await supabase
        .from("wishlists")
        .select("product_id")
        .eq("user_id", user.id);

      if (error) throw error;
      const localIds = (wishlistRes || []).map((item) => item.product_id);

      if (localIds.length === 0) return { localProducts: [] };

      const { data: products, error: prodError } = await supabase
        .from("products")
        .select("*")
        .in("id", localIds)
        .eq("is_active", true);

      if (prodError) throw prodError;
      return { localProducts: products || [] };
    },
    enabled: !!user,
  });

  const totalCount = data?.localProducts.length || 0;

  if (!user) {
    return (
      <div className="container py-16">
        <div className="max-w-md mx-auto text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-muted flex items-center justify-center">
            <Heart className="h-10 w-10 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Хүслийн жагсаалт</h1>
          <p className="text-muted-foreground mb-6">Хүслийн жагсаалтаа харахын тулд нэвтэрнэ үү</p>
          <Link to="/auth"><Button size="lg">Нэвтрэх</Button></Link>
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
            <div key={product.id}>
              <ProductCard product={product} />
              <RemoveButton productId={product.id} />
            </div>
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
              <ShoppingBag className="h-5 w-5" />Дэлгүүр үзэх
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
