import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight, Loader2, Percent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { HeroCarousel } from "@/components/storefront/HeroCarousel";
import { ProductCard } from "@/components/storefront/ProductCard";
import { DiscountProductCard } from "@/components/storefront/DiscountProductCard";
import { CategoryStrip } from "@/components/storefront/CategoryStrip";
import { BrandCarousel } from "@/components/storefront/BrandCarousel";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";

export default function Home() {
  // Fetch random products (100 items)
  const {
    data: randomProducts,
    isLoading: loadingRandom
  } = useQuery({
    queryKey: ["random-products"],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from("products").select("*").eq("is_active", true).limit(100);
      if (error) throw error;
      // Shuffle the array randomly
      return data?.sort(() => Math.random() - 0.5) || [];
    }
  });

  // Fetch discounted products (products with compare_price) - get more for carousel
  const {
    data: discountedProducts,
    isLoading: loadingDiscounted
  } = useQuery({
    queryKey: ["discounted-products"],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from("products").select("*").eq("is_active", true).not("compare_price", "is", null).order("created_at", {
        ascending: false
      }).limit(50);
      if (error) throw error;
      return data?.filter(p => p.compare_price && p.compare_price > p.price) || [];
    }
  });

  // Fetch featured products
  const {
    data: featuredProducts,
    isLoading: loadingProducts
  } = useQuery({
    queryKey: ["featured-products"],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from("products").select("*").eq("is_active", true).eq("is_featured", true).order("created_at", {
        ascending: false
      }).limit(8);
      if (error) throw error;
      return data;
    }
  });

  // Fetch all categories for strip
  const {
    data: categories,
    isLoading: loadingCategories
  } = useQuery({
    queryKey: ["categories-all"],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from("categories").select("*").eq("is_active", true).order("display_order", {
        ascending: true
      });
      if (error) throw error;
      return data;
    }
  });

  // Fetch brands from brands table
  const { data: brands } = useQuery({
    queryKey: ["all-brands-home"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brands")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (error) throw error;
      return data?.map(b => ({ name: b.name, logo_url: b.logo_url })) || [];
    },
  });
  return <div className="animate-fade-in">
      {/* Hero Carousel */}
      <HeroCarousel />

      {/* Category Strip - Right below hero */}
      {!loadingCategories && categories && categories.length > 0 && <CategoryStrip categories={categories} />}

      {/* Discounted Products Section - Carousel */}
      {discountedProducts && discountedProducts.length > 0 && <section className="py-12">
          <div className="container flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <Percent className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <h2 className="md:text-3xl font-bold text-sm">Хямдралтай бараа</h2>
                
              </div>
            </div>
            <Link to="/shop?discount=true">
              <Button variant="ghost" className="gap-2">
                Бүгдийг үзэх
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          {loadingDiscounted ? <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div> : <Carousel opts={{
        align: "start",
        loop: true
      }} className="w-full px-2 md:px-8 lg:container">
              <CarouselContent className="-ml-2 md:-ml-4">
                {discountedProducts.map(product => <CarouselItem key={product.id} className="pl-2 md:pl-4 basis-[45%] sm:basis-1/3 md:basis-1/4 lg:basis-1/5 xl:basis-1/6">
                    <DiscountProductCard product={product} />
                  </CarouselItem>)}
              </CarouselContent>
              <CarouselPrevious className="left-0 md:left-2 -translate-x-1/2 hidden md:flex" />
              <CarouselNext className="right-0 md:right-2 translate-x-1/2 hidden md:flex" />
            </Carousel>}
        </section>}

      {/* Featured Products Section */}
      {featuredProducts && featuredProducts.length > 0 && <section className="py-12">
          <div className="px-2 md:container flex items-center justify-between mb-8">
            <div>
              <h2 className="md:text-3xl font-bold text-base">Онцлох бараа</h2>
              
            </div>
            <Link to="/shop?featured=true">
              <Button variant="ghost" className="gap-2">
                Бүгдийг үзэх
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          {loadingProducts ? <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div> : <div className="px-2 md:container grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-6">
              {featuredProducts.map(product => <ProductCard key={product.id} product={product} variant="featured" />)}
            </div>}
        </section>}


      {/* Promo Banner */}
      <section className="container py-12">
        
      </section>

      {/* Featured Brands Section */}
      {brands && brands.length > 0 && (
        <section className="py-8">
          <div className="px-2 md:container mb-6">
            <h2 className="md:text-3xl font-bold text-base">Онцлох брэндүүд</h2>
          </div>
          <div className="px-2 md:container">
            <BrandCarousel brands={brands} />
          </div>
        </section>
      )}

      {/* All Random Products Section */}
      <section className="py-12">
        <div className="px-2 md:container mb-6">
          <h2 className="md:text-3xl font-bold text-base">Бүх төрлийн бараа</h2>
        </div>

        {loadingRandom ? <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div> : randomProducts && randomProducts.length > 0 ? <div className="px-2 md:container grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 md:gap-6">
            {randomProducts.map(product => <ProductCard key={product.id} product={product} />)}
          </div> : <div className="text-center py-12 text-muted-foreground">
            Бараа олдсонгүй
          </div>}

        <div className="flex justify-center mt-8">
          <Link to="/shop">
            <Button size="lg" className="gap-2">
              Бүх бараа үзэх
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>
    </div>;
}