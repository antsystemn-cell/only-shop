import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ChevronDown, Loader2, Sparkles, Star, Footprints, Droplets, Shirt, Home as HomeIcon, Baby, Smartphone, Heart, Dumbbell, ShoppingBag, TrendingUp, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { OtProductCardComponent } from "@/components/storefront/OtProductCard";
import { searchItems } from "@/services/otApi";
import { Skeleton } from "@/components/ui/skeleton";
import HeaderSearch from "@/components/storefront/HeaderSearch";
import type { OtProductCard } from "@/types/otApi";

// Icon map for admin-configured sections
const ICON_MAP: Record<string, React.ReactNode> = {
  sparkles: <Sparkles className="h-4 w-4" />,
  star: <Star className="h-4 w-4" />,
  footprints: <Footprints className="h-4 w-4" />,
  droplets: <Droplets className="h-4 w-4" />,
  shirt: <Shirt className="h-4 w-4" />,
  home: <HomeIcon className="h-4 w-4" />,
  baby: <Baby className="h-4 w-4" />,
  smartphone: <Smartphone className="h-4 w-4" />,
  heart: <Heart className="h-4 w-4" />,
  dumbbell: <Dumbbell className="h-4 w-4" />,
  "shopping-bag": <ShoppingBag className="h-4 w-4" />,
  "trending-up": <TrendingUp className="h-4 w-4" />,
  package: <Package className="h-4 w-4" />,
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
  show_on_home: boolean | null;
}

// ─── Category Tabs (horizontal scrollable thin text) ────────
function CategoryTabs() {
  const { data: categories } = useQuery({
    queryKey: ["ot-root-categories-strip"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ot_categories")
        .select("id, internal_id, name_mn, name_en, icon_url, parent_internal_id")
        .is("parent_internal_id", null)
        .eq("is_active", true)
        .order("display_order");
      return data || [];
    },
    staleTime: 1000 * 60 * 30,
  });

  if (!categories || categories.length === 0) return null;

  return (
    <div className="overflow-x-auto scrollbar-hide">
      <div className="flex items-center gap-1 pb-1">
        <Link
          to="/ot"
          className="shrink-0 px-3 py-1.5 text-xs font-semibold text-primary border-b-2 border-primary whitespace-nowrap"
        >
          Бүгд
        </Link>
        {categories.slice(0, 12).map((cat) => (
          <Link
            key={cat.internal_id}
            to={`/ot/browse/${cat.internal_id}`}
            className="shrink-0 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground whitespace-nowrap transition-colors"
          >
            {cat.name_mn || cat.name_en || cat.internal_id}
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── Home Section Block ─────────────────────────────────────
function HomeSectionBlock({ section }: { section: ProviderSection }) {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ["home-section", section.id],
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

  const icon = section.icon_name ? ICON_MAP[section.icon_name] || <Package className="h-4 w-4" /> : <Package className="h-4 w-4" />;
  const providerLabel = section.provider_type === "Poizon" ? "Poizon" : section.provider_type === "Taobao" ? "Taobao" : "";

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-primary/10 text-primary">{icon}</div>
          <h2 className="text-sm md:text-lg font-bold">
            {section.title}
            {providerLabel && (
              <span className="text-xs font-normal text-muted-foreground ml-1.5">({providerLabel})</span>
            )}
          </h2>
        </div>
        <Link to={`/ot?q=${encodeURIComponent(section.search_query || "")}&provider=${section.provider_type}`}>
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-7">
            Бүгдийг үзэх
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1.5 md:gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-card overflow-hidden">
              <Skeleton className="aspect-square" />
              <div className="p-2 space-y-1.5">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1.5 md:gap-3">
            {allItems.map((product) => (
              <OtProductCardComponent key={product.id} product={product} />
            ))}
          </div>
          {hasNextPage && (
            <div className="flex justify-center mt-3">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ChevronDown className="h-3.5 w-3.5" />}
                Илүү ихийг харах
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default function Home() {
  // Fetch all sections marked show_on_home from both providers
  const { data: sections, isLoading: loadingSections } = useQuery({
    queryKey: ["home-sections"],
    queryFn: async () => {
      const { data } = await supabase
        .from("provider_sections")
        .select("*")
        .eq("is_active", true)
        .eq("show_on_home", true)
        .order("display_order");
      return (data || []) as ProviderSection[];
    },
    staleTime: 1000 * 60 * 30,
  });

  return (
    <div className="animate-fade-in">
      {/* Search bar - visible on mobile, hidden on desktop (header has it) */}
      <div className="px-3 pt-3 pb-2 md:hidden">
        <HeaderSearch />
      </div>

      {/* Category tabs - horizontal scroll */}
      <div className="px-3 md:container border-b">
        <CategoryTabs />
      </div>

      {/* Sections */}
      <div className="px-2 md:container py-4 md:py-6">
        {loadingSections ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : sections && sections.length > 0 ? (
          sections.map((section) => (
            <HomeSectionBlock key={section.id} section={section} />
          ))
        ) : (
          <>
            {/* Fallback static sections if no admin sections configured */}
            <p className="text-center text-muted-foreground py-10">Секц тохируулагдаагүй байна</p>
          </>
        )}

        {/* CTA */}
        <div className="flex justify-center py-4">
          <Link to="/ot">
            <Button variant="outline" size="sm" className="gap-1.5">
              Маркетплэйс руу очих
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
