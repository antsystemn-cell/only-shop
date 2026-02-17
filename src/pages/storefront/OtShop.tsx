import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import {
  Search,
  ChevronRight,
  ChevronDown,
  SlidersHorizontal,
  X,
  Loader2,
  Shield,
  TrendingUp,
  Sparkles,
  ShoppingBag,
  Folder,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { OtProductCardComponent } from "@/components/storefront/OtProductCard";
import { searchItems, fetchRootCategories, fetchSubcategories } from "@/services/otApi";
import { Skeleton } from "@/components/ui/skeleton";
import SearchFilters from "@/components/storefront/SearchFilters";
import { useIsMobile } from "@/hooks/use-mobile";
import { useProviderSafe } from "@/contexts/ProviderContext";
import { supabase } from "@/integrations/supabase/client";
import type { OtProductCard } from "@/types/otApi";

// ─── Category sidebar component ─────────────────────────────

function CategorySidebar({ onSelect, selectedId }: { onSelect: (id: string) => void; selectedId?: string }) {
  const { data: dbCategories } = useQuery({
    queryKey: ["ot-sidebar-categories"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ot_categories")
        .select("id, internal_id, name_mn, name_en, icon_url, parent_internal_id, depth")
        .eq("is_active", true)
        .order("display_order");
      return data || [];
    },
    staleTime: 1000 * 60 * 30,
  });

  const { data: apiCategories } = useQuery({
    queryKey: ["ot-root-categories"],
    queryFn: fetchRootCategories,
    staleTime: 1000 * 60 * 30,
  });

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const rootCats = dbCategories?.filter(c => !c.parent_internal_id) || [];
  const getChildren = (parentInternalId: string) =>
    dbCategories?.filter(c => c.parent_internal_id === parentInternalId) || [];

  const toggleExpand = (internalId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(internalId)) next.delete(internalId);
      else next.add(internalId);
      return next;
    });
  };

  // Use DB categories if available, otherwise fall back to API categories
  const hasDbCats = rootCats.length > 0;

  if (!hasDbCats && apiCategories) {
    return (
      <div className="space-y-1">
        <h3 className="font-semibold text-sm mb-3 px-2">Ангилалууд</h3>
        {apiCategories.map(cat => (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
              selectedId === cat.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
            }`}
          >
            {cat.iconUrl && <img src={cat.iconUrl} className="w-5 h-5 object-contain" alt="" />}
            <span className="truncate">{cat.name}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      <h3 className="font-semibold text-sm mb-3 px-2">Ангилалууд</h3>
      {rootCats.map(cat => {
        const children = getChildren(cat.internal_id);
        const isExpanded = expandedIds.has(cat.internal_id);
        const catName = cat.name_mn || cat.name_en || cat.internal_id;
        return (
          <div key={cat.internal_id}>
            <div className="flex items-center">
              <button
                onClick={() => onSelect(cat.internal_id)}
                className={`flex-1 text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                  selectedId === cat.internal_id ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
                }`}
              >
                {cat.icon_url ? (
                  <img src={cat.icon_url} className="w-5 h-5 object-contain shrink-0" alt="" />
                ) : (
                  <Folder className="w-4 h-4 text-muted-foreground shrink-0" />
                )}
                <span className="truncate">{catName}</span>
              </button>
              {children.length > 0 && (
                <button onClick={() => toggleExpand(cat.internal_id)} className="p-1 hover:bg-muted rounded">
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
              )}
            </div>
            {isExpanded && children.length > 0 && (
              <div className="ml-4 border-l pl-2 space-y-0.5 mt-0.5">
                {children.map(child => (
                  <button
                    key={child.internal_id}
                    onClick={() => onSelect(child.internal_id)}
                    className={`w-full text-left px-3 py-1.5 rounded-md text-xs transition-colors ${
                      selectedId === child.internal_id ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    {child.name_mn || child.name_en || child.internal_id}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Product Section with infinite scroll ───────────────────

interface HomeSectionProps {
  title: string;
  icon: React.ReactNode;
  iconBg: string;
  queryKey: string;
  searchParams: Record<string, any>;
  initialPageSize?: number;
  providerOverride?: string;
}

function HomeSection({ title, icon, iconBg, queryKey, searchParams, initialPageSize = 10, providerOverride }: HomeSectionProps) {
  const observerRef = useRef<HTMLDivElement>(null);
  const { apiProvider } = useProviderSafe();

  // Merge provider: section-specific provider takes precedence, then global filter
  const effectiveParams = {
    ...searchParams,
    ...(providerOverride ? { provider: providerOverride } : apiProvider ? { provider: apiProvider } : {}),
  };

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ["ot-home-section", queryKey, apiProvider],
    queryFn: ({ pageParam = 0 }) =>
      searchItems({
        ...effectiveParams,
        page: pageParam,
        pageSize: initialPageSize,
      }),
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, p) => sum + p.items.length, 0);
      if (loaded < lastPage.totalCount) return allPages.length;
      return undefined;
    },
    initialPageParam: 0,
    staleTime: 1000 * 60 * 15,
  });

  const allItems = data?.pages.flatMap(p => p.items) || [];

  if (!isLoading && allItems.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <div className={`p-2 rounded-lg ${iconBg}`}>{icon}</div>
        <h2 className="text-lg md:text-xl font-bold">{title}</h2>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-1.5 md:gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-card overflow-hidden">
              <Skeleton className="aspect-square" />
              <div className="p-2 md:p-3 space-y-2">
                <Skeleton className="h-3 md:h-4 w-full" />
                <Skeleton className="h-3 md:h-4 w-2/3" />
                <Skeleton className="h-4 md:h-5 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-1.5 md:gap-4">
            {allItems.map((product) => (
              <OtProductCardComponent key={product.id} product={product} />
            ))}
          </div>
          {hasNextPage && (
            <div className="flex justify-center mt-4" ref={observerRef}>
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

// ─── Search Results Section ─────────────────────────────────

function SearchResultsSection({
  searchParams: sp,
  updateParam,
  updateMultipleParams,
}: {
  searchParams: URLSearchParams;
  updateParam: (key: string, value: string | null) => void;
  updateMultipleParams: (updates: Record<string, string | null>) => void;
}) {
  const isMobile = useIsMobile();
  const { apiProvider } = useProviderSafe();
  const query = sp.get("q") || "";
  const categoryId = sp.get("category") || "";
  const orderBy = sp.get("sort") || "";
  const minPrice = sp.get("minPrice") || "";
  const maxPrice = sp.get("maxPrice") || "";
  const urlProvider = sp.get("provider") || "";
  const imageUrl = sp.get("imageUrl") || "";
  const pageSize = 40;

  // Use URL provider if set, otherwise global provider context
  const effectiveProvider = urlProvider || apiProvider || "";

  const selectedProperties: Record<string, string> = {};
  sp.forEach((value, key) => {
    if (key.startsWith("prop_")) selectedProperties[key.slice(5)] = value;
  });

  const propertiesForApi = Object.keys(selectedProperties).length > 0 ? selectedProperties : undefined;

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ["ot-search", query, categoryId, orderBy, minPrice, maxPrice, effectiveProvider, imageUrl, JSON.stringify(selectedProperties)],
    queryFn: ({ pageParam = 0 }) =>
      searchItems({
        query: query || undefined,
        categoryId: categoryId || undefined,
        page: pageParam,
        pageSize,
        orderBy: orderBy || undefined,
        minPrice: minPrice || undefined,
        maxPrice: maxPrice || undefined,
        provider: effectiveProvider || undefined,
        imageUrl: imageUrl || undefined,
        properties: propertiesForApi,
      }),
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, p) => sum + p.items.length, 0);
      if (loaded < lastPage.totalCount) return allPages.length;
      return undefined;
    },
    initialPageParam: 0,
    enabled: !!(query || categoryId || imageUrl),
    staleTime: 1000 * 60 * 5,
  });

  const firstPage = data?.pages[0];
  const allItems = data?.pages.flatMap(p => p.items) || [];
  const totalCount = firstPage?.totalCount || 0;

  const activeFilterCount = [minPrice, maxPrice, effectiveProvider, imageUrl].filter(Boolean).length + Object.keys(selectedProperties).length;

  const handleClearAllFilters = () => {
    const newParams = new URLSearchParams();
    if (query) newParams.set("q", query);
    if (categoryId) newParams.set("category", categoryId);
  };

  const filtersContent = (
    <SearchFilters
      minPrice={minPrice}
      maxPrice={maxPrice}
      provider={effectiveProvider}
      imageUrl={imageUrl}
      searchProperties={firstPage?.searchProperties || []}
      selectedProperties={selectedProperties}
      onMinPriceChange={(v) => updateParam("minPrice", v || null)}
      onMaxPriceChange={(v) => updateParam("maxPrice", v || null)}
      onProviderChange={(v) => updateParam("provider", v || null)}
      onImageSearch={(url) => updateParam("imageUrl", url || null)}
      onPropertyChange={(name, val) => updateParam(`prop_${name}`, val || null)}
      onClearAll={handleClearAllFilters}
    />
  );

  return (
    <div className="flex gap-6">
      {!isMobile && (
        <aside className="w-56 flex-shrink-0 hidden md:block">
          {filtersContent}
        </aside>
      )}
      <div className="flex-1 min-w-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Хайж байна..." : `${totalCount} бараа олдлоо`}
          </p>
          <div className="flex items-center gap-2">
            {isMobile && (
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1">
                    <SlidersHorizontal className="h-4 w-4" />
                    Шүүлтүүр
                    {activeFilterCount > 0 && (
                      <span className="bg-primary text-primary-foreground rounded-full text-xs w-5 h-5 flex items-center justify-center">
                        {activeFilterCount}
                      </span>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 p-4 pt-10">
                  <SheetHeader>
                    <SheetTitle>Шүүлтүүр</SheetTitle>
                  </SheetHeader>
                  <div className="mt-4">{filtersContent}</div>
                </SheetContent>
              </Sheet>
            )}
            <Select
              value={orderBy || "default"}
              onValueChange={(v) => updateParam("sort", v === "default" ? null : v)}
            >
              <SelectTrigger className="w-[140px] md:w-[160px]">
                <SelectValue placeholder="Эрэмбэлэх" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Хамааралтай</SelectItem>
                <SelectItem value="Price:Asc">Үнэ: Багаас</SelectItem>
                <SelectItem value="Price:Desc">Үнэ: Ихээс</SelectItem>
                <SelectItem value="Volume:Desc">Борлуулалт</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Subcategories */}
        {firstPage?.subCategories && firstPage.subCategories.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-3">Дэд ангилалууд</h3>
            <div className="flex flex-wrap gap-2">
              {firstPage.subCategories.slice(0, 12).map((cat) => (
                <Button key={cat.id} variant="outline" size="sm" onClick={() => updateParam("category", cat.id)}>
                  {cat.name}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Products */}
        {isLoading ? (
          <div className="grid grid-cols-3 md:grid-cols-3 gap-1.5 md:gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="rounded-xl border bg-card overflow-hidden">
                <Skeleton className="aspect-square" />
                <div className="p-2 md:p-3 space-y-2">
                  <Skeleton className="h-3 md:h-4 w-full" />
                  <Skeleton className="h-3 md:h-4 w-2/3" />
                  <Skeleton className="h-4 md:h-5 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : allItems.length > 0 ? (
          <>
            <div className="grid grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-1.5 md:gap-4">
              {allItems.map((product) => (
                <OtProductCardComponent key={product.id} product={product} />
              ))}
            </div>
            {hasNextPage && (
              <div className="flex justify-center mt-6">
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                >
                  {isFetchingNextPage ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronDown className="h-4 w-4" />}
                  Илүү ихийг харах
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-20">
            <p className="text-lg text-muted-foreground">Бараа олдсонгүй</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Mobile Category Strip ──────────────────────────────────

function MobileCategoryStrip({ onSelect, selectedId }: { onSelect: (id: string) => void; selectedId?: string }) {
  const { data: dbCategories } = useQuery({
    queryKey: ["ot-sidebar-categories"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ot_categories")
        .select("id, internal_id, name_mn, name_en, icon_url, parent_internal_id, depth")
        .eq("is_active", true)
        .is("parent_internal_id", null)
        .order("display_order");
      return data || [];
    },
    staleTime: 1000 * 60 * 30,
  });

  const { data: apiCategories } = useQuery({
    queryKey: ["ot-root-categories"],
    queryFn: fetchRootCategories,
    staleTime: 1000 * 60 * 30,
  });

  const cats = dbCategories && dbCategories.length > 0
    ? dbCategories.map(c => ({ id: c.internal_id, name: c.name_mn || c.name_en || c.internal_id, iconUrl: c.icon_url }))
    : (apiCategories || []).map(c => ({ id: c.id, name: c.name, iconUrl: c.iconUrl }));

  if (cats.length === 0) return null;

  return (
    <div className="mb-3 -mx-2 px-2 overflow-x-auto scrollbar-hide">
      <div className="flex gap-2 pb-1">
        {cats.map(cat => (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium whitespace-nowrap transition-colors shrink-0 ${
              selectedId === cat.id
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card border-border hover:bg-muted"
            }`}
          >
            {cat.iconUrl && <img src={cat.iconUrl} className="w-4 h-4 object-contain" alt="" />}
            {cat.name}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────

export default function OtShop() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(searchParams.get("q") || "");
  const isMobile = useIsMobile();

  const query = searchParams.get("q") || "";
  const categoryId = searchParams.get("category") || "";
  const imageUrl = searchParams.get("imageUrl") || "";
  const provider = searchParams.get("provider") || "";

  const isSearchMode = !!(query || categoryId || imageUrl);

  const updateParam = useCallback((key: string, value: string | null) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) newParams.set(key, value);
    else newParams.delete(key);
    if (key !== "page") newParams.delete("page");
    setSearchParams(newParams);
  }, [searchParams, setSearchParams]);

  const updateMultipleParams = useCallback((updates: Record<string, string | null>) => {
    const newParams = new URLSearchParams(searchParams);
    let resetPage = false;
    for (const [key, value] of Object.entries(updates)) {
      if (value) newParams.set(key, value);
      else newParams.delete(key);
      if (key !== "page") resetPage = true;
    }
    if (resetPage) newParams.delete("page");
    setSearchParams(newParams);
  }, [searchParams, setSearchParams]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) updateParam("q", searchInput.trim());
  };

  const handleCategorySelect = (catId: string) => {
    updateParam("category", catId);
  };

  // Active filter chips
  const minPrice = searchParams.get("minPrice") || "";
  const maxPrice = searchParams.get("maxPrice") || "";
  const selectedProperties: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    if (key.startsWith("prop_")) selectedProperties[key.slice(5)] = value;
  });

  return (
    <div className="animate-fade-in">
      {/* Search bar - mobile only (desktop has header search) */}
      <div className="px-3 pt-3 pb-2 md:hidden">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Бараа хайх..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button type="submit" size="sm">Хайх</Button>
        </form>
      </div>

      <div className="container px-2 md:px-4 py-4 md:py-8">
      {/* Desktop search */}
      <div className="hidden md:block mb-6">
        <form onSubmit={handleSearch} className="flex gap-2 max-w-2xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Бараа хайх... (англиар бичнэ үү)"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button type="submit">Хайх</Button>
        </form>
      </div>

      {/* Active filter chips */}
      {(query || categoryId || provider || minPrice || maxPrice || imageUrl || Object.keys(selectedProperties).length > 0) && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {query && (
            <Button variant="secondary" size="sm" className="gap-1" onClick={() => { updateParam("q", null); setSearchInput(""); }}>
              "{query}" <X className="h-3 w-3" />
            </Button>
          )}
          {categoryId && (
            <Button variant="secondary" size="sm" className="gap-1" onClick={() => updateParam("category", null)}>
              Ангилал <X className="h-3 w-3" />
            </Button>
          )}
          {provider && (
            <Button variant="secondary" size="sm" className="gap-1" onClick={() => updateParam("provider", null)}>
              {provider} <X className="h-3 w-3" />
            </Button>
          )}
          {(minPrice || maxPrice) && (
            <Button variant="secondary" size="sm" className="gap-1" onClick={() => updateMultipleParams({ minPrice: null, maxPrice: null })}>
              ¥{minPrice || "0"} — ¥{maxPrice || "∞"} <X className="h-3 w-3" />
            </Button>
          )}
          {imageUrl && (
            <Button variant="secondary" size="sm" className="gap-1" onClick={() => updateParam("imageUrl", null)}>
              Зургаар хайлт <X className="h-3 w-3" />
            </Button>
          )}
          {Object.entries(selectedProperties).map(([name]) => (
            <Button key={name} variant="secondary" size="sm" className="gap-1" onClick={() => updateParam(`prop_${name}`, null)}>
              {name} <X className="h-3 w-3" />
            </Button>
          ))}
        </div>
      )}

      {/* Mobile horizontal category strip */}
      {isMobile && !isSearchMode && (
        <MobileCategoryStrip onSelect={handleCategorySelect} selectedId={categoryId} />
      )}

      <div className="flex gap-6">
        {/* Sidebar - always visible on desktop */}
        {!isMobile && (
          <aside className="w-56 flex-shrink-0 hidden md:block">
            <div className="sticky top-20 space-y-6 max-h-[calc(100vh-120px)] overflow-y-auto pr-2">
              <CategorySidebar onSelect={handleCategorySelect} selectedId={categoryId} />
            </div>
          </aside>
        )}

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {isSearchMode ? (
            <SearchResultsSection
              searchParams={searchParams}
              updateParam={updateParam}
              updateMultipleParams={updateMultipleParams}
            />
          ) : (
            <>
              {/* 100% Оригинал - Poizon */}
              <HomeSection
                title="100% Оригинал"
                icon={<Shield className="h-5 w-5 text-primary" />}
                iconBg="bg-primary/10"
                queryKey="poizon-original"
                searchParams={{ query: "shoes", orderBy: "Volume:Desc" }}
                providerOverride="Poizon"
                initialPageSize={12}
              />

              {/* Онцлох бараа - Featured (admin configured) */}
              <HomeSection
                title="Онцлох бараа"
                icon={<Sparkles className="h-5 w-5 text-amber-500" />}
                iconBg="bg-amber-500/10"
                queryKey="featured"
                searchParams={{ query: "fashion", orderBy: "Volume:Desc" }}
                initialPageSize={12}
              />

              {/* Шилдэг борлуулалттай */}
              <HomeSection
                title="Шилдэг борлуулалттай"
                icon={<TrendingUp className="h-5 w-5 text-green-500" />}
                iconBg="bg-green-500/10"
                queryKey="best-sellers"
                searchParams={{ query: "bag", orderBy: "Volume:Desc" }}
                initialPageSize={12}
              />

              {/* Taobao & Tmall */}
              <HomeSection
                title="Taobao & Tmall"
                icon={<ShoppingBag className="h-5 w-5 text-orange-500" />}
                iconBg="bg-orange-500/10"
                queryKey="taobao-tmall"
                searchParams={{ query: "clothing accessories electronics home", orderBy: "Volume:Desc" }}
                providerOverride="Taobao"
                initialPageSize={20}
              />
            </>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
