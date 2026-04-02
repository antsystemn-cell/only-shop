import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/storefront/ProductCard";
import { CategoryCard } from "@/components/storefront/CategoryCard";
import { HeroCarousel } from "@/components/storefront/HeroCarousel";
import HeaderSearch from "@/components/storefront/HeaderSearch";
import { useIsMobile } from "@/hooks/use-mobile";
import { ShoppingBag, Star, Sparkles, Truck, Shield, CreditCard } from "lucide-react";

export default function Home() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  // Fetch banners
  const { data: banners } = useQuery({
    queryKey: ["banners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("banners")
        .select("*")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  // Fetch featured products
  const { data: featuredProducts, isLoading: featuredLoading } = useQuery({
    queryKey: ["featured-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .eq("is_featured", true)
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  // Fetch new arrivals
  const { data: newProducts, isLoading: newLoading } = useQuery({
    queryKey: ["new-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ["home-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("is_active", true)
        .order("display_order")
        .limit(8);
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 10,
  });

  // Fetch sale products (compare_price set)
  const { data: saleProducts } = useQuery({
    queryKey: ["sale-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .not("compare_price", "is", null)
        .gt("compare_price", 0)
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  const renderProductGrid = (products: any[] | undefined, loading: boolean) => {
    if (loading) {
      return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 md:gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="aspect-square rounded-lg" />
              <div className="p-2 space-y-1.5">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      );
    }
    if (!products || products.length === 0) return null;
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 md:gap-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    );
  };

  return (
    <div className="animate-fade-in">
      {isMobile && (
        <div className="sticky top-0 z-30 bg-background px-3 pt-3 pb-2">
          <HeaderSearch />
        </div>
      )}

      <div className="px-1 md:container py-2 md:py-6 space-y-8">
        {/* Hero Banner */}
        {banners && banners.length > 0 && (
          <HeroCarousel />
        )}

        {/* Categories */}
        {categories && categories.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg md:text-xl font-bold">Ангилал</h2>
              <Button variant="ghost" size="sm" onClick={() => navigate("/shop")} className="text-xs text-muted-foreground">
                Бүгдийг үзэх →
              </Button>
            </div>
            <div className="grid grid-cols-4 md:grid-cols-4 lg:grid-cols-8 gap-2 md:gap-4">
              {categories.map((category) => (
                <CategoryCard key={category.id} category={category} />
              ))}
            </div>
          </section>
        )}

        {/* Featured Products */}
        {(featuredLoading || (featuredProducts && featuredProducts.length > 0)) && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                  <Star className="h-4 w-4" />
                </div>
                <h2 className="text-lg md:text-xl font-bold">Онцлох бараа</h2>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate("/shop?featured=true")} className="text-xs text-muted-foreground">
                Бүгдийг үзэх →
              </Button>
            </div>
            {renderProductGrid(featuredProducts, featuredLoading)}
          </section>
        )}

        {/* Sale Products */}
        {saleProducts && saleProducts.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-destructive/10 text-destructive">
                  <Sparkles className="h-4 w-4" />
                </div>
                <h2 className="text-lg md:text-xl font-bold">Хямдралтай</h2>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate("/shop")} className="text-xs text-muted-foreground">
                Бүгдийг үзэх →
              </Button>
            </div>
            {renderProductGrid(saleProducts, false)}
          </section>
        )}

        {/* New Arrivals */}
        {(newLoading || (newProducts && newProducts.length > 0)) && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                  <ShoppingBag className="h-4 w-4" />
                </div>
                <h2 className="text-lg md:text-xl font-bold">Шинэ бараа</h2>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate("/shop?sort=newest")} className="text-xs text-muted-foreground">
                Бүгдийг үзэх →
              </Button>
            </div>
            {renderProductGrid(newProducts, newLoading)}
          </section>
        )}

        {/* Trust Section */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4 py-6">
          {[
            { icon: Truck, title: "Хурдан хүргэлт", desc: "24 цагийн дотор" },
            { icon: Shield, title: "Баталгаат бараа", desc: "100% чанарын баталгаа" },
            { icon: CreditCard, title: "Аюулгүй төлбөр", desc: "Олон төлбөрийн сонголт" },
            { icon: ShoppingBag, title: "Бэлэн бараа", desc: "Монголд бэлэн байгаа" },
          ].map((item, i) => (
            <div key={i} className="text-center p-4 rounded-xl bg-muted/50">
              <item.icon className="h-8 w-8 mx-auto mb-2 text-primary" />
              <p className="font-semibold text-sm">{item.title}</p>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
