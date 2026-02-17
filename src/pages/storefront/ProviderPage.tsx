import { useParams } from "react-router-dom";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { Loader2, ChevronDown, Sparkles, Star, Footprints, Droplets, Shirt, Home, Baby, Smartphone, Heart, Dumbbell, ShoppingBag, TrendingUp, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { searchItems } from "@/services/otApi";
import { OtProductCardComponent } from "@/components/storefront/OtProductCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { OtProductCard } from "@/types/otApi";

// Map icon names to components
const ICON_MAP: Record<string, React.ReactNode> = {
  sparkles: <Sparkles className="h-5 w-5" />,
  star: <Star className="h-5 w-5" />,
  footprints: <Footprints className="h-5 w-5" />,
  droplets: <Droplets className="h-5 w-5" />,
  shirt: <Shirt className="h-5 w-5" />,
  home: <Home className="h-5 w-5" />,
  baby: <Baby className="h-5 w-5" />,
  smartphone: <Smartphone className="h-5 w-5" />,
  heart: <Heart className="h-5 w-5" />,
  dumbbell: <Dumbbell className="h-5 w-5" />,
  "shopping-bag": <ShoppingBag className="h-5 w-5" />,
  "trending-up": <TrendingUp className="h-5 w-5" />,
  package: <Package className="h-5 w-5" />,
};

interface ProviderSection {
  id: string;
  title: string;
  icon_name: string | null;
  search_query: string | null;
  category_id: string | null;
  order_by: string | null;
  page_size: number | null;
  provider_type: string;
}

function SectionBlock({ section }: { section: ProviderSection }) {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ["provider-section", section.id],
    queryFn: ({ pageParam = 0 }) =>
      searchItems({
        query: section.search_query || undefined,
        categoryId: section.category_id || undefined,
        provider: section.provider_type,
        page: pageParam,
        pageSize: section.page_size || 12,
        orderBy: section.order_by || "Volume:Desc",
      }),
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, p) => sum + p.items.length, 0);
      if (loaded < lastPage.totalCount) return allPages.length;
      return undefined;
    },
    initialPageParam: 0,
    staleTime: 1000 * 60 * 15,
  });

  const allItems = data?.pages.flatMap((p) => p.items) || [];

  if (!isLoading && allItems.length === 0) return null;

  const icon = section.icon_name ? ICON_MAP[section.icon_name] || <Package className="h-5 w-5" /> : <Package className="h-5 w-5" />;

  return (
    <section className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-primary/10 text-primary">{icon}</div>
        <h2 className="text-lg md:text-xl font-bold">{section.title}</h2>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1.5 md:gap-4">
          {Array.from({ length: section.page_size || 12 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-card overflow-hidden">
              <Skeleton className="aspect-square" />
              <div className="p-2 space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1.5 md:gap-4">
            {allItems.map((product) => (
              <OtProductCardComponent key={product.id} product={product} />
            ))}
          </div>
          {hasNextPage && (
            <div className="flex justify-center mt-4">
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
                Илүү ихийг харах
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default function ProviderPage() {
  const { slug } = useParams<{ slug: string }>();

  // Get provider info from strip items
  const { data: providerInfo } = useQuery({
    queryKey: ["provider-strip-item", slug],
    queryFn: async () => {
      const { data } = await supabase
        .from("provider_strip_items")
        .select("*")
        .eq("slug", slug!)
        .eq("is_active", true)
        .single();
      return data;
    },
    enabled: !!slug,
  });

  // Get sections for this provider
  const { data: sections, isLoading: loadingSections } = useQuery({
    queryKey: ["provider-sections", providerInfo?.provider_type],
    queryFn: async () => {
      const { data } = await supabase
        .from("provider_sections")
        .select("*")
        .eq("provider_type", providerInfo!.provider_type)
        .eq("is_active", true)
        .order("display_order");
      return (data || []) as ProviderSection[];
    },
    enabled: !!providerInfo?.provider_type,
    staleTime: 1000 * 60 * 30,
  });

  if (!providerInfo && !loadingSections) {
    return (
      <div className="container py-20 text-center">
        <p className="text-muted-foreground">Нийлүүлэгч олдсонгүй</p>
      </div>
    );
  }

  return (
    <div className="container px-2 md:px-4 py-4 md:py-8 animate-fade-in">
      {/* Provider Header */}
      <div className="mb-6">
        <h1 className="text-xl md:text-3xl font-bold">
          {providerInfo?.name || slug}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {providerInfo?.provider_type === "Poizon"
            ? "100% оригинал баталгаатай бараанууд"
            : "Олон төрлийн бараанууд шууд Хятадаас"}
        </p>
      </div>

      {/* Sections */}
      {loadingSections ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      ) : sections && sections.length > 0 ? (
        sections.map((section) => (
          <SectionBlock key={section.id} section={section} />
        ))
      ) : (
        <div className="text-center py-20">
          <p className="text-muted-foreground">Ангилал тохируулагдаагүй байна</p>
        </div>
      )}
    </div>
  );
}
