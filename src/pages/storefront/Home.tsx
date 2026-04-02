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
import { Zap, Star, ShoppingBag, Truck, Shield, CreditCard, ArrowRight } from "lucide-react";

export default function Home() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();

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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 md:gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-card rounded-xl overflow-hidden">
              <Skeleton className="aspect-square" />
              <div className="p-2.5 space-y-1.5">
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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 md:gap-3">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    );
  };

  const SectionHeader = ({ icon: Icon, title, onViewAll, iconColor = "text-primary" }: { icon: any; title: string; onViewAll: () => void; iconColor?: string }) => (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${iconColor}`} />
        <h2 className="text-sm md:text-base font-bold text-foreground">{title}</h2>
      </div>
      <Button variant="ghost" size="sm" onClick={onViewAll} className="text-xs text-muted-foreground h-7 px-2 rounded-full hover:text-primary">
        Бүгдийг үзэх <ArrowRight className="h-3 w-3 ml-1" />
      </Button>
    </div>
  );

  return (
    <div className="animate-fade-in">
      {/* Mobile Search */}
      {isMobile && (
        <div className="sticky top-0 z-30 bg-card px-3 pt-3 pb-2 shadow-sm">
          <HeaderSearch />
        </div>
      )}

      <div className="container py-3 space-y-4 md:space-y-6">
        {/* Hero Banner */}
        {banners && banners.length > 0 && <HeroCarousel />}

        {/* Categories */}
        {categories && categories.length > 0 && (
          <section className="bg-card rounded-xl p-3">
            <SectionHeader icon={LayoutGridIcon} title="Ангилал" onViewAll={() => navigate("/categories")} />
            <div className="grid grid-cols-4 md:grid-cols-4 lg:grid-cols-8 gap-2">
              {categories.map((category) => (
                <CategoryCard key={category.id} category={category} />
              ))}
            </div>
          </section>
        )}

        {/* Sale Products */}
        {saleProducts && saleProducts.length > 0 && (
          <section className="bg-card rounded-xl p-3">
            <SectionHeader icon={Zap} title="Хямдралтай" onViewAll={() => navigate("/shop")} iconColor="text-destructive" />
            {renderProductGrid(saleProducts, false)}
          </section>
        )}

        {/* Featured Products */}
        {(featuredLoading || (featuredProducts && featuredProducts.length > 0)) && (
          <section>
            <SectionHeader icon={Star} title="Онцлох бараа" onViewAll={() => navigate("/shop?featured=true")} />
            {renderProductGrid(featuredProducts, featuredLoading)}
          </section>
        )}

        {/* New Arrivals */}
        {(newLoading || (newProducts && newProducts.length > 0)) && (
          <section>
            <SectionHeader icon={ShoppingBag} title="Шинэ бараа" onViewAll={() => navigate("/shop?sort=newest")} />
            {renderProductGrid(newProducts, newLoading)}
          </section>
        )}

        {/* Trust Section */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
          {[
            { icon: Truck, title: "Хурдан хүргэлт", desc: "24 цагийн дотор" },
            { icon: Shield, title: "Баталгаат бараа", desc: "100% чанарын баталгаа" },
            { icon: CreditCard, title: "Аюулгүй төлбөр", desc: "Олон төлбөрийн сонголт" },
            { icon: ShoppingBag, title: "Бэлэн бараа", desc: "Монголд бэлэн байгаа" },
          ].map((item, i) => (
            <div key={i} className="bg-card rounded-xl text-center p-3 md:p-4">
              <item.icon className="h-6 w-6 md:h-8 md:w-8 mx-auto mb-1.5 text-primary" />
              <p className="font-semibold text-xs md:text-sm text-foreground">{item.title}</p>
              <p className="text-[10px] md:text-xs text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

// Small icon component to avoid extra import
function LayoutGridIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="7" height="7" x="3" y="3" rx="1" /><rect width="7" height="7" x="14" y="3" rx="1" /><rect width="7" height="7" x="14" y="14" rx="1" /><rect width="7" height="7" x="3" y="14" rx="1" />
    </svg>
  );
}
