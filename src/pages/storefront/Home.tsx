import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight, Loader2, TrendingUp, Sparkles, ShoppingBag, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { HeroCarousel } from "@/components/storefront/HeroCarousel";
import { OtCategoryStrip } from "@/components/storefront/OtCategoryStrip";
import { BrandCarousel } from "@/components/storefront/BrandCarousel";
import { OtProductCardComponent } from "@/components/storefront/OtProductCard";
import { searchItems } from "@/services/otApi";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Skeleton } from "@/components/ui/skeleton";
import type { OtProductCard } from "@/types/otApi";

function ProductGridSkeleton({ count = 10 }: { count?: number }) {
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

interface ProductSectionProps {
  title: string;
  icon: React.ReactNode;
  iconBg: string;
  products: OtProductCard[];
  isLoading: boolean;
  linkTo: string;
  variant?: "carousel" | "grid";
}

function ProductSection({ title, icon, iconBg, products, isLoading, linkTo, variant = "grid" }: ProductSectionProps) {
  if (!isLoading && products.length === 0) return null;

  return (
    <section className="py-8 md:py-12">
      <div className={`${variant === "carousel" ? "container" : "px-2 md:container"} flex items-center justify-between mb-6 md:mb-8`}>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${iconBg}`}>
            {icon}
          </div>
          <h2 className="text-sm md:text-3xl font-bold">{title}</h2>
        </div>
        <Link to={linkTo}>
          <Button variant="ghost" className="gap-2">
            Бүгдийг үзэх
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      {isLoading ? (
        variant === "carousel" ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <ProductGridSkeleton />
        )
      ) : variant === "carousel" ? (
        <Carousel opts={{ align: "start", loop: true }} className="w-full px-2 md:px-8 lg:container">
          <CarouselContent className="-ml-2 md:-ml-4">
            {products.map((product) => (
              <CarouselItem key={product.id} className="pl-2 md:pl-4 basis-[45%] sm:basis-1/3 md:basis-1/4 lg:basis-1/5 xl:basis-1/6">
                <OtProductCardComponent product={product} />
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="left-0 md:left-2 -translate-x-1/2 hidden md:flex" />
          <CarouselNext className="right-0 md:right-2 translate-x-1/2 hidden md:flex" />
        </Carousel>
      ) : (
        <div className="px-2 md:container grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 md:gap-4">
          {products.map((product) => (
            <OtProductCardComponent key={product.id} product={product} />
          ))}
        </div>
      )}
    </section>
  );
}

export default function Home() {
  // Taobao trending products
  const { data: taobaoResult, isLoading: loadingTaobao } = useQuery({
    queryKey: ["ot-home-taobao"],
    queryFn: () =>
      searchItems({
        query: "bag",
        provider: "Taobao",
        pageSize: 20,
        orderBy: "Volume:Desc",
      }),
    staleTime: 1000 * 60 * 15,
  });

  // Poizon products
  const { data: poizonResult, isLoading: loadingPoizon } = useQuery({
    queryKey: ["ot-home-poizon"],
    queryFn: () =>
      searchItems({
        query: "shoes",
        provider: "Poizon",
        pageSize: 20,
        orderBy: "Volume:Desc",
      }),
    staleTime: 1000 * 60 * 15,
  });

  // General popular products (all providers)
  const { data: popularResult, isLoading: loadingPopular } = useQuery({
    queryKey: ["ot-home-popular"],
    queryFn: () =>
      searchItems({
        query: "phone case",
        pageSize: 20,
        orderBy: "Volume:Desc",
      }),
    staleTime: 1000 * 60 * 15,
  });

  // Fashion / clothing
  const { data: fashionResult, isLoading: loadingFashion } = useQuery({
    queryKey: ["ot-home-fashion"],
    queryFn: () =>
      searchItems({
        query: "jacket",
        pageSize: 20,
      }),
    staleTime: 1000 * 60 * 15,
  });

  // Brands
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

  return (
    <div className="animate-fade-in">
      <HeroCarousel />
      <OtCategoryStrip />

      {/* Taobao - Trending */}
      <ProductSection
        title="Taobao шилдэг"
        icon={<TrendingUp className="h-5 w-5 md:h-6 md:w-6 text-primary" />}
        iconBg="bg-primary/10"
        products={taobaoResult?.items || []}
        isLoading={loadingTaobao}
        linkTo="/ot?provider=Taobao&sort=Volume:Desc"
        variant="carousel"
      />

      {/* Poizon - Shoes & Fashion */}
      <ProductSection
        title="Poizon бараа"
        icon={<Zap className="h-5 w-5 md:h-6 md:w-6 text-accent-foreground" />}
        iconBg="bg-accent"
        products={poizonResult?.items || []}
        isLoading={loadingPoizon}
        linkTo="/ot?provider=Poizon&sort=Volume:Desc"
        variant="grid"
      />

      {/* Brands */}
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

      {/* Popular - All providers */}
      <ProductSection
        title="Эрэлттэй бараа"
        icon={<Sparkles className="h-5 w-5 md:h-6 md:w-6 text-secondary-foreground" />}
        iconBg="bg-secondary"
        products={popularResult?.items || []}
        isLoading={loadingPopular}
        linkTo="/ot?q=phone+case&sort=Volume:Desc"
        variant="carousel"
      />

      {/* Fashion */}
      <ProductSection
        title="Хувцас & Загвар"
        icon={<ShoppingBag className="h-5 w-5 md:h-6 md:w-6 text-primary" />}
        iconBg="bg-primary/10"
        products={fashionResult?.items || []}
        isLoading={loadingFashion}
        linkTo="/ot?q=jacket"
        variant="grid"
      />

      {/* CTA */}
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
