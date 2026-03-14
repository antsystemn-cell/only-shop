// ─── Amazon Category Browse Page ────────────────────────────
// Full provider-native category browsing with:
// - Nested category tree sidebar (desktop) / drawer (mobile)
// - OTAPI breadcrumb from GetProviderCategoryRootPath
// - Infinite-scroll product grid from BatchSearchItemsFrame
// - Search property filters when available
// - Lazy subcategory loading per branch
// - Deep link support (/amazon/category/:categoryId)

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import {
  Loader2, ChevronRight, ChevronDown, Home, FolderOpen, Folder,
  SlidersHorizontal, X, RefreshCw, ShoppingBag, ArrowLeft
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { OtProductCardComponent } from "@/components/storefront/OtProductCard";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTranslatedTitles } from "@/hooks/useTranslatedTitles";
import type { OtProductCard } from "@/types/otApi";
import type { SearchProperty } from "@/services/otApi";
import {
  getAmazonRootCategoryId,
  getProviderSubcategories,
  getCategoryRootPath,
  searchAmazonCategoryProducts,
  type NormalizedCategory,
  type BreadcrumbItem,
} from "@/services/amazonProvider";

// ─── Category Tree Node ─────────────────────────────────────

function CategoryTreeNode({
  category,
  activeCategoryId,
  onSelect,
  depth = 0,
}: {
  category: NormalizedCategory;
  activeCategoryId: string | null;
  onSelect: (id: string) => void;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const isActive = activeCategoryId === category.id;

  // Auto-expand if this node is in the active path
  // (determined by parent checking)

  const { data: children, isLoading } = useQuery({
    queryKey: ["amazon-tree-children", category.id],
    queryFn: () => getProviderSubcategories(category.id, depth + 1),
    enabled: expanded && category.hasChildren,
    staleTime: 1000 * 60 * 10,
  });

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (category.hasChildren) setExpanded(!expanded);
  };

  return (
    <div>
      <button
        onClick={() => onSelect(category.id)}
        className={cn(
          "w-full flex items-center gap-1.5 px-2 py-1.5 text-sm rounded-md transition-colors text-left",
          isActive
            ? "bg-primary/10 text-primary font-medium"
            : "text-foreground hover:bg-muted"
        )}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        {category.hasChildren ? (
          <span onClick={handleToggle} className="shrink-0 p-0.5 hover:bg-muted rounded">
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </span>
        ) : (
          <span className="w-4.5 shrink-0" />
        )}
        {category.hasChildren ? (
          expanded ? <FolderOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <Folder className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ShoppingBag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
        <span className="truncate">{category.title}</span>
      </button>

      {expanded && category.hasChildren && (
        <div>
          {isLoading ? (
            <div className="flex items-center gap-2 px-4 py-2" style={{ paddingLeft: `${24 + depth * 16}px` }}>
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Ачааллаж байна...</span>
            </div>
          ) : children && children.length > 0 ? (
            children.map((child) => (
              <CategoryTreeNode
                key={child.id}
                category={child}
                activeCategoryId={activeCategoryId}
                onSelect={onSelect}
                depth={depth + 1}
              />
            ))
          ) : (
            <div className="text-xs text-muted-foreground px-4 py-1" style={{ paddingLeft: `${24 + depth * 16}px` }}>
              Дэд ангилал байхгүй
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Category Sidebar ───────────────────────────────────────

function CategorySidebar({
  rootCategories,
  activeCategoryId,
  onSelect,
  isLoading,
}: {
  rootCategories: NormalizedCategory[];
  activeCategoryId: string | null;
  onSelect: (id: string) => void;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2 p-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-0.5 p-1 max-h-[calc(100vh-120px)] overflow-y-auto scrollbar-hide">
      {rootCategories.map((cat) => (
        <CategoryTreeNode
          key={cat.id}
          category={cat}
          activeCategoryId={activeCategoryId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

// ─── Breadcrumb ─────────────────────────────────────────────

function AmazonBreadcrumb({ items, onNavigate }: { items: BreadcrumbItem[]; onNavigate: (id: string | null) => void }) {
  return (
    <nav className="flex items-center gap-1 text-sm flex-wrap mb-3">
      <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
        <Home className="h-3.5 w-3.5" />
      </Link>
      <ChevronRight className="h-3 w-3 text-muted-foreground" />
      <button
        onClick={() => onNavigate(null)}
        className="text-muted-foreground hover:text-foreground transition-colors"
      >
        Amazon
      </button>
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={item.id} className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
            {isLast ? (
              <span className="font-medium text-foreground">{item.name}</span>
            ) : (
              <button
                onClick={() => onNavigate(item.id)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {item.name}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}

// ─── Search Property Filters ────────────────────────────────

function PropertyFilters({
  properties,
  activeFilters,
  onFilterChange,
}: {
  properties: SearchProperty[];
  activeFilters: Record<string, string>;
  onFilterChange: (propName: string, valueId: string | null) => void;
}) {
  const [expandedProp, setExpandedProp] = useState<string | null>(null);

  if (!properties.length) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-3">
      {properties.slice(0, 6).map((prop) => {
        const isExpanded = expandedProp === prop.propertyName;
        const activeValue = activeFilters[prop.propertyName];

        return (
          <div key={prop.propertyName} className="relative">
            <button
              onClick={() => setExpandedProp(isExpanded ? null : prop.propertyName)}
              className={cn(
                "flex items-center gap-1 px-3 py-1.5 rounded-full text-xs border transition-colors",
                activeValue
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:border-foreground/30"
              )}
            >
              <SlidersHorizontal className="h-3 w-3" />
              <span>{prop.propertyName}</span>
              {activeValue && (
                <X
                  className="h-3 w-3 ml-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    onFilterChange(prop.propertyName, null);
                  }}
                />
              )}
            </button>

            {isExpanded && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setExpandedProp(null)} />
                <div className="absolute top-full left-0 mt-1 z-20 bg-background border rounded-lg shadow-lg max-h-48 overflow-y-auto min-w-[160px]">
                  {prop.values.slice(0, 20).map((v) => (
                    <button
                      key={v.id}
                      onClick={() => {
                        onFilterChange(prop.propertyName, v.id);
                        setExpandedProp(null);
                      }}
                      className={cn(
                        "w-full text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors",
                        activeValue === v.id && "bg-primary/10 text-primary font-medium"
                      )}
                    >
                      {v.value} {v.itemCount ? `(${v.itemCount})` : ""}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Product Grid ───────────────────────────────────────────

function ProductGrid({ items }: { items: OtProductCard[] }) {
  const feedItemsKey = items.map((p) => p.id).join(",");
  const feedTitlesList = useMemo(() => items.map((p) => p.title), [feedItemsKey]);
  const feedTranslations = useTranslatedTitles(feedTitlesList);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-1 md:gap-3">
      {items.map((product) => (
        <OtProductCardComponent
          key={product.id}
          product={product}
          translatedTitle={feedTranslations[product.title]}
        />
      ))}
    </div>
  );
}

// ─── Main Page Component ────────────────────────────────────

export default function AmazonCategoryBrowse() {
  const { categoryId: urlCategoryId } = useParams<{ categoryId?: string }>();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});

  // The active category - from URL or root
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(urlCategoryId || null);

  // Sync URL → state
  useEffect(() => {
    setActiveCategoryId(urlCategoryId || null);
    setActiveFilters({});
  }, [urlCategoryId]);

  // ── Get Amazon root category ID from OTAPI ──
  const { data: rootCategoryId, isLoading: rootLoading } = useQuery({
    queryKey: ["amazon-root-id"],
    queryFn: getAmazonRootCategoryId,
    staleTime: 1000 * 60 * 30,
    retry: 2,
  });

  // ── Load root subcategories ──
  const { data: rootCategories = [], isLoading: rootCatsLoading } = useQuery({
    queryKey: ["amazon-root-cats", rootCategoryId],
    queryFn: () => getProviderSubcategories(rootCategoryId!, 0),
    enabled: !!rootCategoryId,
    staleTime: 1000 * 60 * 10,
  });

  // ── Breadcrumb for active category ──
  const { data: breadcrumbs = [] } = useQuery({
    queryKey: ["amazon-breadcrumb", activeCategoryId],
    queryFn: () => getCategoryRootPath(activeCategoryId!),
    enabled: !!activeCategoryId,
    staleTime: 1000 * 60 * 10,
  });

  // ── Subcategories of active category (for inline display) ──
  const { data: activeSubcats = [] } = useQuery({
    queryKey: ["amazon-active-subcats", activeCategoryId],
    queryFn: () => getProviderSubcategories(activeCategoryId!, 0),
    enabled: !!activeCategoryId,
    staleTime: 1000 * 60 * 10,
  });

  // ── Product listing with infinite scroll ──
  const effectiveCategoryId = activeCategoryId || rootCategoryId;

  const {
    data: productPages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: productsLoading,
  } = useInfiniteQuery({
    queryKey: ["amazon-products", effectiveCategoryId, JSON.stringify(activeFilters)],
    queryFn: ({ pageParam = 0 }) =>
      searchAmazonCategoryProducts(effectiveCategoryId!, {
        page: pageParam,
        pageSize: 40,
        properties: activeFilters,
      }),
    getNextPageParam: (lastPage, allPages) => {
      const loadedCount = allPages.reduce((sum, p) => sum + p.items.length, 0);
      if (loadedCount < lastPage.totalCount && allPages.length < 30) return allPages.length;
      return undefined;
    },
    initialPageParam: 0,
    enabled: !!effectiveCategoryId,
    staleTime: 1000 * 60 * 2,
  });

  // Deduplicated product items
  const allProducts = useMemo(() => {
    const items = productPages?.pages.flatMap((p) => p.items) || [];
    const seen = new Set<string>();
    return items.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }, [productPages]);

  // Search properties from first page
  const searchProperties = productPages?.pages[0]?.searchProperties || [];

  // ── Infinite scroll observer ──
  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage]
  );

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(handleObserver, { threshold: 0.1 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [handleObserver]);

  // ── Navigation ──
  const handleCategorySelect = useCallback(
    (id: string | null) => {
      if (id) {
        navigate(`/amazon/category/${id}`);
      } else {
        navigate("/amazon");
      }
      setMobileDrawerOpen(false);
      window.scrollTo(0, 0);
    },
    [navigate]
  );

  const handleFilterChange = useCallback((propName: string, valueId: string | null) => {
    setActiveFilters((prev) => {
      const next = { ...prev };
      if (valueId) {
        next[propName] = valueId;
      } else {
        delete next[propName];
      }
      return next;
    });
  }, []);

  // ── Loading state ──
  if (rootLoading || rootCatsLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // ── Active category title ──
  const activeCatTitle = activeCategoryId
    ? breadcrumbs[breadcrumbs.length - 1]?.name || "Amazon"
    : "Amazon USA";

  // ── Render ──
  return (
    <div className="animate-fade-in">
      {/* Mobile: sticky header with category drawer toggle */}
      {isMobile && (
        <div className="sticky top-0 z-30 bg-background border-b px-3 py-2 flex items-center gap-2">
          {activeCategoryId && (
            <button onClick={() => handleCategorySelect(null)} className="p-1">
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <Sheet open={mobileDrawerOpen} onOpenChange={setMobileDrawerOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Folder className="h-3.5 w-3.5" />
                Ангилалууд
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] p-0 pt-10">
              <div className="p-3 border-b">
                <h3 className="font-semibold text-sm">Amazon Ангилалууд</h3>
              </div>
              <CategorySidebar
                rootCategories={rootCategories}
                activeCategoryId={activeCategoryId}
                onSelect={handleCategorySelect}
                isLoading={false}
              />
            </SheetContent>
          </Sheet>
          <span className="text-sm font-medium truncate flex-1">{activeCatTitle}</span>
        </div>
      )}

      <div className={cn("flex", isMobile ? "" : "container py-4 gap-4")}>
        {/* Desktop sidebar */}
        {!isMobile && (
          <aside className="w-[240px] shrink-0 border-r pr-2">
            <h3 className="font-semibold text-sm px-2 py-2 border-b mb-2">Amazon Ангилалууд</h3>
            <CategorySidebar
              rootCategories={rootCategories}
              activeCategoryId={activeCategoryId}
              onSelect={handleCategorySelect}
              isLoading={false}
            />
          </aside>
        )}

        {/* Main content */}
        <main className={cn("flex-1 min-w-0", isMobile ? "px-1 py-2" : "")}>
          {/* Breadcrumb */}
          {!isMobile && (
            <AmazonBreadcrumb items={breadcrumbs} onNavigate={handleCategorySelect} />
          )}

          {/* Category title */}
          <h1 className={cn("font-bold mb-3", isMobile ? "text-lg px-2" : "text-xl")}>
            {activeCatTitle}
          </h1>

          {/* Inline subcategories chips */}
          {activeSubcats.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3 px-1">
              {activeSubcats.map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => handleCategorySelect(sub.id)}
                  className="px-3 py-1.5 rounded-full border text-xs hover:bg-muted transition-colors flex items-center gap-1"
                >
                  {sub.hasChildren && <Folder className="h-3 w-3 text-muted-foreground" />}
                  {sub.title}
                </button>
              ))}
            </div>
          )}

          {/* Filters */}
          <PropertyFilters
            properties={searchProperties}
            activeFilters={activeFilters}
            onFilterChange={handleFilterChange}
          />

          {/* Products */}
          {productsLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-1 md:gap-3">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i}>
                  <Skeleton className="aspect-square" />
                  <div className="p-2 space-y-1.5">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : allProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <ShoppingBag className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-sm">Энэ ангилалд бараа олдсонгүй</p>
              {Object.keys(activeFilters).length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => setActiveFilters({})}
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  Шүүлтүүр арилгах
                </Button>
              )}
            </div>
          ) : (
            <ProductGrid items={allProducts} />
          )}

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} className="h-10 flex items-center justify-center">
            {isFetchingNextPage && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
          </div>
        </main>
      </div>
    </div>
  );
}
