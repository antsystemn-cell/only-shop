import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Loader2, Package, FolderTree, ChevronRight, Home, ChevronDown, Folder, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
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

// ─── Breadcrumbs component ──────────────────────────────────
function CategoryBreadcrumbs({ category, allCategories }: { category: OtCat; allCategories: OtCat[] }) {
  // Build breadcrumb chain by walking up parent_internal_id
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
                to={`/ot/browse/${crumb.internal_id}`}
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

export default function OtCategoryBrowse() {
  const { internalId, slug } = useParams<{ internalId?: string; slug?: string }>();
  const resolvedSlug = internalId || slug;
  const navigate = useNavigate();
  const { apiProvider } = useProviderSafe();
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

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

  // Fetch current category - resolve by seo_alias OR internal_id
  const { data: category, isLoading: loadingCat } = useQuery({
    queryKey: ["ot-category", resolvedSlug],
    queryFn: async () => {
      // Try seo_alias first, then internal_id
      const { data: bySeo } = await supabase
        .from("ot_categories")
        .select("*")
        .eq("seo_alias", resolvedSlug!)
        .eq("is_active", true)
        .maybeSingle();
      if (bySeo) return bySeo as OtCat;

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
  const { data: subcategories } = useQuery({
    queryKey: ["ot-subcategories-db", internalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ot_categories")
        .select("*")
        .eq("parent_internal_id", internalId!)
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data as OtCat[];
    },
    enabled: !!internalId,
  });

  // Fetch products — either via API search (external_id means it has an API category) or by item_ids batch fetch
  // Always use internal_id (otc-XXX) for API search as it works for both Taobao and Poizon
  const { data: products, isLoading: loadingProducts } = useQuery({
    queryKey: ["ot-category-products", internalId, category?.external_id, category?.item_ids?.length, apiProvider, page],
    queryFn: async () => {
      if (!category) return [];
      // Strategy 1: category has external_id → use OT API search with internal_id
      if (category.external_id && category.provider_type) {
        const result = await searchItems({
          categoryId: category.internal_id,
          provider: apiProvider || category.provider_type,
          pageSize: 40,
          page,
        });
        return result.items;
      }
      // Strategy 2: category has item_ids → fetch items directly by ID
      if (category.item_ids?.length) {
        const pageItems = category.item_ids.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
        return fetchItemsByIds(pageItems);
      }
      return [];
    },
    enabled: !!category && (!!category.external_id || (category.item_ids?.length || 0) > 0),
    staleTime: 1000 * 60 * 10,
  });

  const totalPages = category?.item_ids?.length && !category.external_id
    ? Math.ceil(category.item_ids.length / PAGE_SIZE)
    : 0;

  const browseItemsKey = (products || []).map(p => p.id).join(",");
  const browseTitlesList = useMemo(() => (products || []).map(p => p.title), [browseItemsKey]);
  const browseTranslations = useTranslatedTitles(browseTitlesList);

  const displayName = category?.name_mn || category?.name_en || category?.name_ru || internalId;

  return (
    <div className="py-4 md:py-8 animate-fade-in">
      <div className="px-3 md:container mb-6">
        {/* Breadcrumbs */}
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
            onSelect={(id) => navigate(`/ot/browse/${id}`)}
          />
        </div>
      )}

      {/* Products */}
      {loadingProducts ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      ) : products && products.length > 0 ? (
        <>
          <div className="px-2 md:container grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 md:gap-4">
            {products.map((product) => (
              <OtProductCardComponent key={product.id} product={product} translatedTitle={browseTranslations[product.title]} />
            ))}
          </div>
          {/* Pagination for item_ids-based categories */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 py-6">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                ← Өмнөх
              </Button>
              <span className="text-sm text-muted-foreground">
                {page + 1} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                Дараах →
              </Button>
            </div>
          )}
        </>
      ) : (category?.external_id || (category?.item_ids?.length || 0) > 0) ? (
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
  onSelect: (internalId: string) => void;
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
                    autoFocus
                  />
                </div>
              </div>
            )}
            <div className="py-1">
              {filtered.map((sub) => (
                <button
                  key={sub.internal_id}
                  onClick={() => {
                    onSelect(sub.internal_id);
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
