import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Loader2, Package, FolderTree, ChevronRight, Home, ChevronDown, Folder, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { OtProductCardComponent } from "@/components/storefront/OtProductCard";
import { searchItems, fetchItemsByIds } from "@/services/otApi";
import { useProviderSafe } from "@/contexts/ProviderContext";
import type { OtProductCard } from "@/types/otApi";
import { useTranslatedTitles } from "@/hooks/useTranslatedTitles";
import { getCategoryPath } from "@/utils/categoryUrl";

interface OtCat {
  id: string;
  internal_id: string;
  external_id: string | null;
  name_mn: string | null;
  name_en: string | null;
  name_ru: string | null;
  icon_url: string | null;
  provider_type: string | null;
  item_ids: string[];
  parent_internal_id: string | null;
  seo_alias: string | null;
}

const PAGE_SIZE = 20;
const API_PAGE_SIZE = 40;

// ─── Breadcrumbs component ──────────────────────────────────
function CategoryBreadcrumbs({ category, allCategories }: { category: OtCat; allCategories: OtCat[] }) {
  const chain: OtCat[] = [];
  let current: OtCat | undefined = category;
  const catMap = new Map(allCategories.map((c) => [c.internal_id, c]));

  while (current) {
    chain.unshift(current);
    current = current.parent_internal_id ? catMap.get(current.parent_internal_id) : undefined;
  }

  return (
    <nav className="flex items-center gap-1 text-sm flex-wrap mb-4">
      <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
        <Home className="h-3.5 w-3.5" />
      </Link>
      <ChevronRight className="h-3 w-3 text-muted-foreground" />
      <Link to="/categories" className="text-muted-foreground hover:text-foreground transition-colors">
        Ангилалууд
      </Link>
      {chain.map((crumb, i) => {
        const isLast = i === chain.length - 1;
        const name = crumb.name_mn || crumb.name_en || crumb.internal_id;
        return (
          <span key={crumb.internal_id} className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
            {isLast ? (
              <span className="font-medium text-foreground">{name}</span>
            ) : (
              <Link
                to={getCategoryPath(crumb)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {name}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}

// ─── Product grid skeleton ──────────────────────────────────
function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="px-2 md:container grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 md:gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="aspect-square w-full rounded-lg" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export default function OtCategoryBrowse() {
  const { internalId, slug } = useParams<{ internalId?: string; slug?: string }>();
  const resolvedSlug = internalId || slug;
  const navigate = useNavigate();
  const { apiProvider } = useProviderSafe();
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Fetch ALL categories for breadcrumb chain
  const { data: allCategories } = useQuery({
    queryKey: ["ot-all-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ot_categories")
        .select("id, internal_id, external_id, name_mn, name_en, name_ru, icon_url, provider_type, item_ids, parent_internal_id, seo_alias")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data as OtCat[];
    },
    staleTime: 1000 * 60 * 30,
  });

  // Fetch current category
  const { data: category, isLoading: loadingCat } = useQuery({
    queryKey: ["ot-category", resolvedSlug],
    queryFn: async () => {
      // First try by seo_alias (active categories)
      const { data: bySeo } = await supabase
        .from("ot_categories")
        .select("*")
        .eq("seo_alias", resolvedSlug!)
        .eq("is_active", true)
        .maybeSingle();
      if (bySeo) return bySeo as OtCat;

      // Then try by seo_alias without is_active filter (direct URL access for hidden/manual categories)
      const { data: bySeoHidden } = await supabase
        .from("ot_categories")
        .select("*")
        .eq("seo_alias", resolvedSlug!)
        .maybeSingle();
      if (bySeoHidden) return bySeoHidden as OtCat;

      // Finally try by internal_id (always accessible via direct URL)
      const { data, error } = await supabase
        .from("ot_categories")
        .select("*")
        .eq("internal_id", resolvedSlug!)
        .single();
      if (error) throw error;
      return data as OtCat;
    },
    enabled: !!resolvedSlug,
  });

  // Fetch subcategories
  const categoryInternalId = category?.internal_id;
  const { data: subcategories } = useQuery({
    queryKey: ["ot-subcategories-db", categoryInternalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ot_categories")
        .select("*, seo_alias")
        .eq("parent_internal_id", categoryInternalId!)
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data as OtCat[];
    },
    enabled: !!categoryInternalId,
  });

  // Determine fetch mode
  const isApiCategory = !!(category?.external_id && category?.provider_type);
  const isItemIdsCategory = !isApiCategory && (category?.item_ids?.length || 0) > 0;
  const hasProducts = isApiCategory || isItemIdsCategory;

  // ─── Infinite scroll query ────────────────────────────────
  const {
    data: infiniteData,
    isLoading: loadingProducts,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ["ot-category-products-inf", categoryInternalId, category?.external_id, category?.item_ids?.length, apiProvider],
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      if (!category) return { items: [] as OtProductCard[], nextPage: undefined as number | undefined };

      if (isApiCategory) {
        const result = await searchItems({
          categoryId: category.external_id!,
          provider: apiProvider || category.provider_type!,
          pageSize: API_PAGE_SIZE,
          page: pageParam,
        });
        // If we got a full page, there's likely more
        const nextPage = result.items.length >= API_PAGE_SIZE ? pageParam + 1 : undefined;
        return { items: result.items, nextPage };
      }

      if (isItemIdsCategory && category.item_ids?.length) {
        const start = pageParam * PAGE_SIZE;
        const pageItems = category.item_ids.slice(start, start + PAGE_SIZE);
        if (pageItems.length === 0) return { items: [] as OtProductCard[], nextPage: undefined };
        const items = await fetchItemsByIds(pageItems);
        const nextPage = start + PAGE_SIZE < category.item_ids.length ? pageParam + 1 : undefined;
        return { items, nextPage };
      }

      return { items: [] as OtProductCard[], nextPage: undefined };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled: !!category && hasProducts,
    staleTime: 1000 * 60 * 10,
  });

  // Flatten all pages into single product list
  const allProducts = useMemo(
    () => infiniteData?.pages.flatMap((p) => p.items) || [],
    [infiniteData]
  );

  // ─── Intersection Observer for auto-loading ───────────────
  const observerCallback = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage]
  );

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(observerCallback, {
      rootMargin: "400px",
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [observerCallback]);

  // Translations
  const browseItemsKey = allProducts.map((p) => p.id).join(",");
  const browseTitlesList = useMemo(() => allProducts.map((p) => p.title), [browseItemsKey]);
  const browseTranslations = useTranslatedTitles(browseTitlesList);

  const displayName = category?.name_mn || category?.name_en || category?.name_ru || resolvedSlug;

  return (
    <div className="py-4 md:py-8 animate-fade-in">
      <div className="px-3 md:container mb-6">
        {category && allCategories && (
          <CategoryBreadcrumbs category={category} allCategories={allCategories} />
        )}

        {loadingCat ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : (
          <div className="flex items-center gap-3">
            {category?.icon_url && (
              <img src={category.icon_url} alt="" className="w-10 h-10 object-contain" />
            )}
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">{displayName}</h1>
              {category?.provider_type && (
                <span className="text-sm text-muted-foreground">
                  {category.provider_type} · {category.item_ids?.length || 0} бараа
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Subcategories dropdown */}
      {subcategories && subcategories.length > 0 && (
        <div className="px-3 md:container mb-4">
          <SubcategoryDropdownBrowse
            subcategories={subcategories}
            onSelect={(sub) => navigate(getCategoryPath(sub))}
          />
        </div>
      )}

      {/* Products */}
      {loadingProducts ? (
        <ProductGridSkeleton count={12} />
      ) : allProducts.length > 0 ? (
        <>
          <div className="px-2 md:container grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 md:gap-4">
            {allProducts.map((product) => (
              <OtProductCardComponent key={product.id} product={product} translatedTitle={browseTranslations[product.title]} />
            ))}
          </div>

          {/* Sentinel for infinite scroll */}
          <div ref={sentinelRef} className="h-1" />

          {isFetchingNextPage && (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}

          {!hasNextPage && allProducts.length > PAGE_SIZE && (
            <p className="text-center text-sm text-muted-foreground py-6">
              Бүх бараа ачааллаа
            </p>
          )}
        </>
      ) : hasProducts ? (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Бараа олдсонгүй</p>
        </div>
      ) : subcategories && subcategories.length > 0 ? null : (
        <div className="text-center py-12 text-muted-foreground">
          <FolderTree className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Энэ ангилалд бараа хуваарилагдаагүй байна</p>
        </div>
      )}
    </div>
  );
}

// ─── Subcategory dropdown for browse page ──────────────────
function SubcategoryDropdownBrowse({
  subcategories,
  onSelect,
}: {
  subcategories: OtCat[];
  onSelect: (cat: OtCat) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = subcategories.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return c.name_mn?.toLowerCase().includes(q) || c.name_en?.toLowerCase().includes(q);
  });

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-muted text-xs font-medium"
      >
        <span>Дэд ангилал сонгох ({subcategories.length})</span>
        <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => { setOpen(false); setSearch(""); }} />
          <div className="absolute left-0 right-0 top-full mt-1 bg-background border rounded-xl shadow-lg max-h-[50vh] overflow-y-auto z-20">
            {subcategories.length > 6 && (
              <div className="sticky top-0 bg-background p-2 border-b">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Хайх..."
                    className="pl-9 h-9 rounded-lg bg-muted border-0 text-sm"
                  />
                </div>
              </div>
            )}
            <div className="py-1">
              {filtered.map((sub) => (
                <button
                  key={sub.internal_id}
                  onClick={() => {
                    onSelect(sub);
                    setOpen(false);
                    setSearch("");
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/70 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    {sub.icon_url ? (
                      <img src={sub.icon_url} alt="" className="w-5 h-5 object-contain" />
                    ) : (
                      <Folder className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <span className="text-sm truncate">
                    {sub.name_mn || sub.name_en || sub.internal_id}
                  </span>
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="p-3 text-center text-sm text-muted-foreground">Олдсонгүй</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
