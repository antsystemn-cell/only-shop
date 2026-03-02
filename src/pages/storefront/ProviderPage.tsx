import { useParams, Link } from "react-router-dom";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { Loader2, ChevronDown, Sparkles, Star, Footprints, Droplets, Shirt, Home, Baby, Smartphone, Heart, Dumbbell, ShoppingBag, TrendingUp, Package, Folder } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { searchItems, fetchItemsByIds } from "@/services/otApi";
import { OtProductCardComponent } from "@/components/storefront/OtProductCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import HeaderSearch from "@/components/storefront/HeaderSearch";
import { useProviderSafe, type ProviderFilter } from "@/contexts/ProviderContext";
import { useIsMobile } from "@/hooks/use-mobile";
import type { OtProductCard } from "@/types/otApi";

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

// ─── Category Tabs ──────────────────────────────────────────
function CategoryTabs({
  activeId,
  onSelect,
  categories,
}: {
  activeId: string | null;
  onSelect: (id: string | null) => void;
  categories: Array<{ internal_id: string; name_mn: string | null; name_en: string | null }>;
}) {
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

// ─── Featured Subcategories ─────────────────────────────────
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
          <Link key={sub.internal_id} to={`/ot/browse/${sub.internal_id}`} className="flex flex-col items-center gap-1.5 group">
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

// ─── Category metadata type ─────────────────────────────────
interface CategoryMeta {
  internal_id: string;
  has_api: boolean; // true if category can be searched via OT API (has external_id)
  item_ids?: string[] | null;
}

// ─── Infinite Product Feed ──────────────────────────────────
function InfiniteProductFeed({
  categoryId,
  categoryMetas,
  providerType,
}: {
  categoryId: string | null;
  categoryMetas: CategoryMeta[];
  providerType: string;
}) {
  const observerTarget = useRef<HTMLDivElement>(null);
  const [randomPageOffset] = useState(() => Math.floor(Math.random() * 10));
  const orderOptions = ["Volume:Desc", "Price:Asc", "Price:Desc"];
  const [randomOrder] = useState(() => orderOptions[Math.floor(Math.random() * orderOptions.length)]);

  // Find the active category's metadata
  const activeMeta = categoryId ? categoryMetas.find((m) => m.internal_id === categoryId) : null;
  const isCurated = !!(activeMeta && activeMeta.item_ids && activeMeta.item_ids.length > 0 && !activeMeta.has_api);

  // For "All" tab, only use categories that can be searched via API
  // Use internal_id (otc-XXX) for API search as it works for both Taobao and Poizon
  const apiCategoryIds = useMemo(
    () => categoryMetas.filter((m) => m.has_api).map((m) => m.internal_id),
    [categoryMetas]
  );

  // ─── Curated feed (item_ids based) ────────────────────────
  const PAGE_SIZE = 20;
  const curatedItemIds = useMemo(
    () => (isCurated && activeMeta?.item_ids ? activeMeta.item_ids : []),
    [isCurated, activeMeta]
  );
  const [curatedPage, setCuratedPage] = useState(0);

  // Reset curated page when category changes
  useEffect(() => {
    setCuratedPage(0);
  }, [categoryId]);

  const { data: curatedItems, isLoading: curatedLoading } = useQuery({
    queryKey: ["curated-feed", categoryId, curatedPage],
    queryFn: () => {
      const start = curatedPage * PAGE_SIZE;
      const pageIds = curatedItemIds.slice(start, start + PAGE_SIZE);
      return fetchItemsByIds(pageIds, 6);
    },
    staleTime: 1000 * 60 * 10,
    enabled: isCurated && curatedItemIds.length > 0,
  });

  const curatedTotalPages = Math.ceil(curatedItemIds.length / PAGE_SIZE);

  // ─── API-based infinite feed ──────────────────────────────
  // For specific category with API capability: use that internal_id
  const activeHasApi = activeMeta?.has_api;

  const apiEnabled = !isCurated && (apiCategoryIds.length > 0 || !!activeHasApi);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: apiLoading,
  } = useInfiniteQuery({
    queryKey: ["provider-infinite-feed", providerType, categoryId, randomPageOffset, randomOrder, apiCategoryIds.join(",")],
    queryFn: ({ pageParam = 0 }) => {
      let catId: string | undefined;
      if (activeHasApi && activeMeta) {
        catId = activeMeta.internal_id;
      } else if (apiCategoryIds.length > 0) {
        catId = apiCategoryIds[pageParam % apiCategoryIds.length];
      }
      // When a specific category is selected, start from page 0; only use randomPageOffset for "All" tab
      const providerPage = activeHasApi
        ? pageParam
        : Math.floor(pageParam / Math.max(apiCategoryIds.length, 1)) + randomPageOffset;
      return searchItems({
        categoryId: catId,
        provider: providerType,
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
    enabled: apiEnabled,
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

  const apiItems = useMemo(() => {
    const items = data?.pages.flatMap((p) => p.items) || [];
    const seen = new Set<string>();
    return items.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }, [data]);

  // ─── Render ───────────────────────────────────────────────
  const isLoading = isCurated ? curatedLoading : apiLoading;
  const displayItems: OtProductCard[] = isCurated ? (curatedItems || []) : apiItems;

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
          {displayItems.map((product) => (
            <OtProductCardComponent key={product.id} product={product} />
          ))}
        </div>
      )}

      {/* Curated pagination */}
      {isCurated && curatedTotalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={curatedPage === 0}
            onClick={() => setCuratedPage((p) => p - 1)}
          >
            Өмнөх
          </Button>
          <span className="text-xs text-muted-foreground">
            {curatedPage + 1} / {curatedTotalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={curatedPage >= curatedTotalPages - 1}
            onClick={() => setCuratedPage((p) => p + 1)}
          >
            Дараах
          </Button>
        </div>
      )}

      {/* API infinite scroll sentinel */}
      {!isCurated && (
        <div ref={observerTarget} className="h-10 flex items-center justify-center">
          {isFetchingNextPage && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
        </div>
      )}
    </>
  );
}

// ─── Main Provider Page ─────────────────────────────────────
export default function ProviderPage() {
  const { slug } = useParams<{ slug: string }>();
  const { setSelectedProvider } = useProviderSafe();
  const isMobile = useIsMobile();
  const contentRef = useRef<HTMLDivElement>(null);

  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

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

  // Sync ProviderContext
  useEffect(() => {
    if (providerInfo?.provider_type) {
      const filter: ProviderFilter =
        providerInfo.provider_type === "Poizon" ? "Poizon" : providerInfo.provider_type === "Taobao" ? "Taobao" : "all";
      setSelectedProvider(filter);
    }
  }, [providerInfo?.provider_type, setSelectedProvider]);

  const providerType = providerInfo?.provider_type;

  // Fetch provider-specific root categories
  const { data: rawRootCategories } = useQuery({
    queryKey: ["ot-root-categories-provider", providerType],
    queryFn: async () => {
      const { data } = await supabase
        .from("ot_categories")
        .select("id, internal_id, name_mn, name_en, icon_url, parent_internal_id, external_id, item_ids")
        .is("parent_internal_id", null)
        .eq("is_active", true)
        .eq("provider_type", providerType!)
        .order("display_order");
      return data || [];
    },
    staleTime: 1000 * 60 * 30,
    enabled: !!providerType,
  });

  // If only 1 root category (e.g. Poizon), expand to show its children as tabs
  const singleRootId = rawRootCategories?.length === 1 ? rawRootCategories[0].internal_id : null;

  const { data: childCategories } = useQuery({
    queryKey: ["ot-child-categories-provider", singleRootId],
    queryFn: async () => {
      const { data } = await supabase
        .from("ot_categories")
        .select("id, internal_id, name_mn, name_en, icon_url, parent_internal_id, external_id, item_ids")
        .eq("parent_internal_id", singleRootId!)
        .eq("is_active", true)
        .order("display_order");
      return data || [];
    },
    staleTime: 1000 * 60 * 30,
    enabled: !!singleRootId,
  });

  const rootCategories = singleRootId && childCategories && childCategories.length > 0
    ? childCategories
    : rawRootCategories || [];

  const categoryList = useMemo(() => rootCategories?.slice(0, 15) || [], [rootCategories]);
  const orderedIds = useMemo(() => [null, ...categoryList.map((c) => c.internal_id)], [categoryList]);
  const activeIndex = orderedIds.indexOf(activeCategoryId);

  // Scroll to top on category change
  const handleCategorySelect = useCallback((id: string | null) => {
    setActiveCategoryId(id);
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, []);

  // Swipe navigation
  const touchStartX = useRef(0);

  const swipeToPrev = useCallback(() => {
    if (activeIndex > 0) handleCategorySelect(orderedIds[activeIndex - 1]);
  }, [activeIndex, orderedIds, handleCategorySelect]);

  const swipeToNext = useCallback(() => {
    if (activeIndex < orderedIds.length - 1) handleCategorySelect(orderedIds[activeIndex + 1]);
  }, [activeIndex, orderedIds, handleCategorySelect]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const diff = touchStartX.current - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 60) {
        if (diff > 0) swipeToNext();
        else swipeToPrev();
      }
    },
    [swipeToNext, swipeToPrev]
  );

  // Reset category when switching providers
  useEffect(() => {
    setActiveCategoryId(null);
  }, [providerType]);

  if (!providerInfo) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Sticky header: search + category tabs */}
      <div className={isMobile ? "sticky top-0 z-30 bg-background" : ""}>
        {isMobile && (
          <div className="px-3 pt-3 pb-2">
            <HeaderSearch />
          </div>
        )}
        <div className="px-3 md:container border-b">
          <CategoryTabs activeId={activeCategoryId} onSelect={handleCategorySelect} categories={categoryList} />
        </div>
      </div>

      {/* Swipeable content */}
      <div
        ref={contentRef}
        className="px-1 md:container py-2 md:py-6"
        onTouchStart={isMobile ? handleTouchStart : undefined}
        onTouchEnd={isMobile ? handleTouchEnd : undefined}
      >
        {activeCategoryId && <FeaturedSubcategories parentId={activeCategoryId} />}

        <InfiniteProductFeed
          categoryId={activeCategoryId}
          categoryMetas={categoryList.map((c) => ({
            internal_id: c.internal_id,
            has_api: !!c.external_id,
            item_ids: c.item_ids,
          }))}
          providerType={providerType!}
        />
      </div>
    </div>
  );
}
