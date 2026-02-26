import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ChevronDown, Loader2, Sparkles, Star, Footprints, Droplets, Shirt, Home as HomeIcon, Baby, Smartphone, Heart, Dumbbell, ShoppingBag, TrendingUp, Package, Folder } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { OtProductCardComponent } from "@/components/storefront/OtProductCard";
import { searchItems } from "@/services/otApi";
import { Skeleton } from "@/components/ui/skeleton";
import HeaderSearch from "@/components/storefront/HeaderSearch";
import type { OtProductCard } from "@/types/otApi";
import { useRef, useCallback, useEffect, useState, useMemo } from "react";
import { useProviderSafe } from "@/contexts/ProviderContext";
import { useIsMobile } from "@/hooks/use-mobile";

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
function CategoryTabs({ activeId, onSelect, categories }: { activeId: string | null; onSelect: (id: string | null) => void; categories: Array<{ internal_id: string; name_mn: string | null; name_en: string | null }> }) {
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [activeId]);

  if (!categories || categories.length === 0) return null;

  return (
    <div className="overflow-x-auto scrollbar-hide">
      <div className="flex items-center gap-1 pb-1">
        <button
          ref={activeId === null ? activeRef : undefined}
          onClick={() => onSelect(null)}
          className={`shrink-0 px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
            activeId === null
              ? "text-primary border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Бүгд
        </button>
        {categories.map((cat) => (
          <button
            key={cat.internal_id}
            ref={activeId === cat.internal_id ? activeRef : undefined}
            onClick={() => onSelect(cat.internal_id)}
            className={`shrink-0 px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
              activeId === cat.internal_id
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {cat.name_mn || cat.name_en || cat.internal_id}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Featured Subcategories with Images ─────────────────────
function FeaturedSubcategories({ parentId }: { parentId: string }) {
  const { data: subcategories } = useQuery({
    queryKey: ["ot-subcategories-featured", parentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("ot_categories")
        .select("id, internal_id, name_mn, name_en, icon_url")
        .eq("parent_internal_id", parentId)
        .eq("is_active", true)
        .order("display_order")
        .limit(8);
      return data || [];
    },
    staleTime: 1000 * 60 * 30,
    enabled: !!parentId,
  });

  if (!subcategories || subcategories.length === 0) return null;

  return (
    <div className="mt-4 mb-2">
      <h3 className="text-xs font-semibold text-muted-foreground mb-2 px-1">Онцлох дэд ангилалууд</h3>
      <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
        {subcategories.map((sub) => (
          <Link
            key={sub.internal_id}
            to={`/ot/browse/${sub.internal_id}`}
            className="flex flex-col items-center gap-1.5 group"
          >
            <div className="w-14 h-14 md:w-16 md:h-16 rounded-xl bg-muted/50 border flex items-center justify-center overflow-hidden group-hover:border-primary/30 transition-colors">
              {sub.icon_url ? (
                <img src={sub.icon_url} alt="" className="w-10 h-10 md:w-12 md:h-12 object-contain" />
              ) : (
                <Folder className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <span className="text-[10px] md:text-xs text-center text-muted-foreground group-hover:text-foreground line-clamp-2 leading-tight max-w-[70px]">
              {sub.name_mn || sub.name_en || sub.internal_id}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── Provider list for round-robin ──────────────────────────
const FEED_PROVIDERS = ["Poizon", "Taobao", "Taobao"]; // Taobao twice = includes Tmall results

// ─── Infinite Scroll Feed (alternating providers) ───────────
function InfiniteProductFeed({ categoryId, rootCategoryIds, globalProvider }: { categoryId: string | null; rootCategoryIds: string[]; globalProvider?: string }) {
  const observerTarget = useRef<HTMLDivElement>(null);

  const [randomPageOffset] = useState(() => Math.floor(Math.random() * 10));
  const orderOptions = ["Volume:Desc", "Price:Asc", "Price:Desc"];
  const [randomOrder] = useState(() => orderOptions[Math.floor(Math.random() * orderOptions.length)]);

  const getProviderForPage = useCallback((page: number): string => {
    // If a global provider is selected, always use it
    if (globalProvider) return globalProvider;
    return FEED_PROVIDERS[page % FEED_PROVIDERS.length];
  }, [globalProvider]);

  // Always provide a categoryId – cycle through root categories when "Бүгд" is selected
  const getCategoryForPage = useCallback((page: number): string | undefined => {
    if (categoryId) return categoryId;
    if (rootCategoryIds.length === 0) return undefined;
    return rootCategoryIds[page % rootCategoryIds.length];
  }, [categoryId, rootCategoryIds]);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ["home-infinite-feed", categoryId, randomPageOffset, randomOrder, rootCategoryIds.length, globalProvider],
    queryFn: ({ pageParam = 0 }) => {
      const provider = getProviderForPage(pageParam);
      const catId = getCategoryForPage(pageParam);
      const providerPage = Math.floor(pageParam / FEED_PROVIDERS.length) + randomPageOffset;
      return searchItems({
        categoryId: catId,
        provider,
        page: providerPage,
        pageSize: 20,
        orderBy: randomOrder,
      });
    },
    getNextPageParam: (_lastPage, allPages) => {
      if (allPages.length < 60) return allPages.length;
      return undefined;
    },
    initialPageParam: 0,
    staleTime: 1000 * 60 * 5,
    enabled: rootCategoryIds.length > 0 || categoryId !== null,
  });

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage]
  );

  useEffect(() => {
    const el = observerTarget.current;
    if (!el) return;
    const observer = new IntersectionObserver(handleObserver, { threshold: 0.1 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [handleObserver]);

  // Deduplicate items
  const allItems = useMemo(() => {
    const items = data?.pages.flatMap((p) => p.items) || [];
    const seen = new Set<string>();
    return items.filter(item => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }, [data]);

  return (
    <>
      {isLoading ? (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1 md:gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
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
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1 md:gap-3">
          {allItems.map((product) => (
            <OtProductCardComponent key={product.id} product={product} />
          ))}
        </div>
      )}

      <div ref={observerTarget} className="h-10 flex items-center justify-center">
        {isFetchingNextPage && (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        )}
      </div>
    </>
  );
}

// ─── Home Section Block ─────────────────────────────────────
function HomeSectionBlock({ section, globalProvider }: { section: ProviderSection; globalProvider?: string }) {
  // If a global provider is selected and this section is for a different provider, hide it
  if (globalProvider && section.provider_type !== globalProvider) return null;

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
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 md:gap-3">
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
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 md:gap-3">
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
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const { apiProvider } = useProviderSafe();
  const contentRef = useRef<HTMLDivElement>(null);

  // Scroll to top when category changes
  const handleCategorySelect = useCallback((id: string | null) => {
    setActiveCategoryId(id);
    // Scroll both window and any scrollable container to absolute top
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, []);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  // Fetch categories for tabs & swipe
  const { data: rootCategories } = useQuery({
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

  const categoryList = useMemo(() => rootCategories?.slice(0, 12) || [], [rootCategories]);

  // Build ordered list: [null, cat1, cat2, ...] for swipe navigation
  const orderedIds = useMemo(() => [null, ...categoryList.map(c => c.internal_id)], [categoryList]);
  const activeIndex = orderedIds.indexOf(activeCategoryId);

  const swipeToPrev = useCallback(() => {
    if (activeIndex > 0) handleCategorySelect(orderedIds[activeIndex - 1]);
  }, [activeIndex, orderedIds, handleCategorySelect]);

  const swipeToNext = useCallback(() => {
    if (activeIndex < orderedIds.length - 1) handleCategorySelect(orderedIds[activeIndex + 1]);
  }, [activeIndex, orderedIds, handleCategorySelect]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 60) {
      if (diff > 0) swipeToNext();
      else swipeToPrev();
    }
  }, [swipeToNext, swipeToPrev]);

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
      {/* Sticky header area on mobile: search + category tabs */}
      <div className={isMobile ? "sticky top-0 z-30 bg-background" : ""}>
        <div className="px-3 pt-3 pb-2 md:hidden">
          <HeaderSearch />
        </div>

        {/* Category tabs - always visible */}
        <div className="px-3 md:container border-b">
          <CategoryTabs activeId={activeCategoryId} onSelect={handleCategorySelect} categories={categoryList} />
        </div>
      </div>

      {/* Content area - swipeable on mobile */}
      <div
        ref={contentRef}
        className="px-1 md:container py-2 md:py-6"
        onTouchStart={isMobile ? handleTouchStart : undefined}
        onTouchEnd={isMobile ? handleTouchEnd : undefined}
      >
        {/* Show featured subcategories only when a category is selected */}
        {activeCategoryId && (
          <FeaturedSubcategories parentId={activeCategoryId} />
        )}

        <InfiniteProductFeed categoryId={activeCategoryId} rootCategoryIds={categoryList.map(c => c.internal_id)} globalProvider={apiProvider} />
      </div>
    </div>
  );
}
