import { useParams, Link } from "react-router-dom";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { Loader2, ChevronDown, Sparkles, Star, Footprints, Droplets, Shirt, Home, Baby, Smartphone, Heart, Dumbbell, ShoppingBag, TrendingUp, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { searchItems } from "@/services/otApi";
import { OtProductCardComponent } from "@/components/storefront/OtProductCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import HeaderSearch from "@/components/storefront/HeaderSearch";

const ICON_MAP: Record<string, React.ReactNode> = {
  sparkles: <Sparkles className="h-4 w-4" />,
  star: <Star className="h-4 w-4" />,
  footprints: <Footprints className="h-4 w-4" />,
  droplets: <Droplets className="h-4 w-4" />,
  shirt: <Shirt className="h-4 w-4" />,
  home: <Home className="h-4 w-4" />,
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
}

// ─── Provider Category Tabs ─────────────────────────────────
function ProviderCategoryTabs({ providerType }: { providerType: string }) {
  const { data: categories } = useQuery({
    queryKey: ["ot-provider-categories", providerType],
    queryFn: async () => {
      const { data } = await supabase
        .from("ot_categories")
        .select("id, internal_id, name_mn, name_en, icon_url, provider_type")
        .is("parent_internal_id", null)
        .eq("is_active", true)
        .eq("provider_type", providerType)
        .order("display_order");
      // If no provider-specific categories, fall back to all root categories
      if (!data || data.length === 0) {
        const { data: allCats } = await supabase
          .from("ot_categories")
          .select("id, internal_id, name_mn, name_en, icon_url")
          .is("parent_internal_id", null)
          .eq("is_active", true)
          .order("display_order");
        return allCats || [];
      }
      return data;
    },
    staleTime: 1000 * 60 * 30,
  });

  if (!categories || categories.length === 0) return null;

  return (
    <div className="overflow-x-auto scrollbar-hide">
      <div className="flex items-center gap-1 pb-1">
        {categories.slice(0, 15).map((cat) => (
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

// ─── Section Block ──────────────────────────────────────────
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

  const icon = section.icon_name ? ICON_MAP[section.icon_name] || <Package className="h-4 w-4" /> : <Package className="h-4 w-4" />;

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-primary/10 text-primary">{icon}</div>
          <h2 className="text-sm md:text-lg font-bold">{section.title}</h2>
        </div>
        <Link to={`/ot?q=${encodeURIComponent(section.search_query || "")}&provider=${section.provider_type}`}>
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-7">
            Бүгдийг үзэх
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1 md:gap-3">
          {Array.from({ length: section.page_size || 12 }).map((_, i) => (
            <div key={i} className="overflow-hidden">
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
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1 md:gap-3">
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

export default function ProviderPage() {
  const { slug } = useParams<{ slug: string }>();

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

  const showCategories = providerInfo?.show_categories !== false;

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
    <div className="animate-fade-in">
      {/* Search bar - mobile */}
      <div className="px-3 pt-3 pb-2 md:hidden">
        <HeaderSearch />
      </div>

      {/* Provider category tabs */}
      {showCategories && providerInfo?.provider_type && (
        <div className="px-3 md:container border-b">
          <ProviderCategoryTabs providerType={providerInfo.provider_type} />
        </div>
      )}

      {/* Sections */}
      <div className="px-2 md:container py-4 md:py-6">
        {loadingSections ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
    </div>
  );
}
