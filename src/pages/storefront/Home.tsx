import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight, Loader2, Percent, TrendingUp, Sparkles, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { HeroCarousel } from "@/components/storefront/HeroCarousel";
import { OtCategoryStrip } from "@/components/storefront/OtCategoryStrip";
import { BrandCarousel } from "@/components/storefront/BrandCarousel";
import { OtProductCardComponent } from "@/components/storefront/OtProductCard";
import { searchItems } from "@/services/otApi";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Skeleton } from "@/components/ui/skeleton";

function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="px-2 md:container grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 md:gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card overflow-hidden">
          <Skeleton className="aspect-square" />
          <div className="p-3 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-5 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  // Fetch trending OT products (popular items)
  const { data: trendingResult, isLoading: loadingTrending } = useQuery({
    queryKey: ["ot-home-trending"],
    queryFn: () =>
      searchItems({
        query: "trending",
        pageSize: 20,
        orderBy: "Volume:Desc",
      }),
    staleTime: 1000 * 60 * 15,
  });

  // Fetch new arrivals
  const { data: newResult, isLoading: loadingNew } = useQuery({
    queryKey: ["ot-home-new"],
    queryFn: () =>
      searchItems({
        query: "fashion",
        pageSize: 20,
      }),
    staleTime: 1000 * 60 * 15,
  });

  // Fetch electronics / tech products
  const { data: techResult, isLoading: loadingTech } = useQuery({
    queryKey: ["ot-home-tech"],
    queryFn: () =>
      searchItems({
        query: "electronics",
        pageSize: 20,
        orderBy: "Volume:Desc",
      }),
    staleTime: 1000 * 60 * 15,
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
      return data?.map((b) => ({ name: b.name, logo_url: b.logo_url })) || [];
    },
  });

  const trendingProducts = trendingResult?.items || [];
  const newProducts = newResult?.items || [];
  const techProducts = techResult?.items || [];

  return (
    <div className="animate-fade-in">
      {/* Hero Carousel */}
      <HeroCarousel />

      {/* OT API Categories */}
      <OtCategoryStrip />

      {/* Trending Products - Carousel */}
      <section className="py-8 md:py-12">
        <div className="container flex items-center justify-between mb-6 md:mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <TrendingUp className="h-5 w-5 md:h-6 md:w-6 text-primary" />
            </div>
            <h2 className="text-sm md:text-3xl font-bold">Эрэлттэй бараа</h2>
          </div>
          <Link to="/ot?q=trending&sort=Volume:Desc">
            <Button variant="ghost" className="gap-2">
              Бүгдийг үзэх
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        {loadingTrending ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : trendingProducts.length > 0 ? (
          <Carousel
            opts={{ align: "start", loop: true }}
            className="w-full px-2 md:px-8 lg:container"
          >
            <CarouselContent className="-ml-2 md:-ml-4">
              {trendingProducts.map((product) => (
                <CarouselItem
                  key={product.id}
                  className="pl-2 md:pl-4 basis-[45%] sm:basis-1/3 md:basis-1/4 lg:basis-1/5 xl:basis-1/6"
                >
                  <OtProductCardComponent product={product} />
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="left-0 md:left-2 -translate-x-1/2 hidden md:flex" />
            <CarouselNext className="right-0 md:right-2 translate-x-1/2 hidden md:flex" />
          </Carousel>
        ) : null}
      </section>

      {/* New Arrivals - Grid */}
      <section className="py-8 md:py-12">
        <div className="px-2 md:container flex items-center justify-between mb-6 md:mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent">
              <Sparkles className="h-5 w-5 md:h-6 md:w-6 text-accent-foreground" />
            </div>
            <h2 className="text-sm md:text-3xl font-bold">Шинэ бараа</h2>
          </div>
          <Link to="/ot?q=fashion">
            <Button variant="ghost" className="gap-2">
              Бүгдийг үзэх
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        {loadingNew ? (
          <ProductGridSkeleton count={10} />
        ) : newProducts.length > 0 ? (
          <div className="px-2 md:container grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 md:gap-4">
            {newProducts.map((product) => (
              <OtProductCardComponent key={product.id} product={product} />
            ))}
          </div>
        ) : null}
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

      {/* Tech / Electronics - Grid */}
      <section className="py-8 md:py-12">
        <div className="px-2 md:container flex items-center justify-between mb-6 md:mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-secondary">
              <ShoppingBag className="h-5 w-5 md:h-6 md:w-6 text-secondary-foreground" />
            </div>
            <h2 className="text-sm md:text-3xl font-bold">Электроник бараа</h2>
          </div>
          <Link to="/ot?q=electronics&sort=Volume:Desc">
            <Button variant="ghost" className="gap-2">
              Бүгдийг үзэх
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        {loadingTech ? (
          <ProductGridSkeleton count={10} />
        ) : techProducts.length > 0 ? (
          <div className="px-2 md:container grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 md:gap-4">
            {techProducts.map((product) => (
              <OtProductCardComponent key={product.id} product={product} />
            ))}
          </div>
        ) : null}
      </section>

      {/* CTA to marketplace */}
      <section className="py-8 md:py-12">
        <div className="flex justify-center">
          <Link to="/ot">
            <Button size="lg" className="gap-2">
              Маркетплэйс руу очих
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
