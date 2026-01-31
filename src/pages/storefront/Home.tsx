import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { HeroCarousel } from "@/components/storefront/HeroCarousel";
import { ProductCard } from "@/components/storefront/ProductCard";
import { CategoryCard } from "@/components/storefront/CategoryCard";

export default function Home() {
  // Fetch featured products
  const { data: featuredProducts, isLoading: loadingProducts } = useQuery({
    queryKey: ["featured-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .eq("is_featured", true)
        .order("created_at", { ascending: false })
        .limit(8);

      if (error) throw error;
      return data;
    },
  });

  // Fetch latest products
  const { data: latestProducts, isLoading: loadingLatest } = useQuery({
    queryKey: ["latest-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(8);

      if (error) throw error;
      return data;
    },
  });

  // Fetch categories
  const { data: categories, isLoading: loadingCategories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true })
        .limit(6);

      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="animate-fade-in">
      {/* Hero Carousel */}
      <HeroCarousel />

      {/* Categories Section */}
      <section className="container py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold">Ангилалууд</h2>
            <p className="text-muted-foreground mt-1">
              Бүх төрлийн бараанууд
            </p>
          </div>
          <Link to="/categories">
            <Button variant="ghost" className="gap-2">
              Бүгдийг үзэх
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        {loadingCategories ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : categories && categories.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {categories.map((category) => (
              <CategoryCard key={category.id} category={category} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            Ангилал олдсонгүй
          </div>
        )}
      </section>

      {/* Featured Products Section */}
      {featuredProducts && featuredProducts.length > 0 && (
        <section className="container py-12">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold">Онцлох бараа</h2>
              <p className="text-muted-foreground mt-1">
                Шилдэг сонголтууд
              </p>
            </div>
            <Link to="/shop?featured=true">
              <Button variant="ghost" className="gap-2">
                Бүгдийг үзэх
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          {loadingProducts ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {featuredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Latest Products Section */}
      <section className="container py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold">Шинэ бараа</h2>
            <p className="text-muted-foreground mt-1">
              Сүүлд нэмэгдсэн бүтээгдэхүүнүүд
            </p>
          </div>
          <Link to="/shop">
            <Button variant="ghost" className="gap-2">
              Бүгдийг үзэх
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        {loadingLatest ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : latestProducts && latestProducts.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {latestProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            Бараа олдсонгүй
          </div>
        )}
      </section>

      {/* Promo Banner */}
      <section className="container py-12">
        <div className="rounded-2xl gradient-hero p-8 md:p-12 text-white text-center">
          <h2 className="text-2xl md:text-4xl font-bold mb-4">
            Үнэгүй хүргэлт
          </h2>
          <p className="text-lg text-white/80 mb-6 max-w-2xl mx-auto">
            100,000₮-с дээш захиалгад Улаанбаатар хотод үнэгүй хүргэлт
          </p>
          <Link to="/shop">
            <Button
              size="lg"
              className="bg-primary text-primary-foreground hover:bg-primary/90 glow-green"
            >
              Дэлгүүр үзэх
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
