import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { Loader2, Package, FolderTree, ArrowLeft, ChevronRight, Home } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { OtProductCardComponent } from "@/components/storefront/OtProductCard";
import { searchItems, fetchItemsByIds } from "@/services/otApi";
import { useProviderSafe } from "@/contexts/ProviderContext";
import type { OtProductCard } from "@/types/otApi";

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
      <Link to="/ot/allcats" className="text-muted-foreground hover:text-foreground transition-colors">
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
  const { internalId } = useParams<{ internalId: string }>();
  const { apiProvider } = useProviderSafe();
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  // Fetch ALL categories for breadcrumb chain
  const { data: allCategories } = useQuery({
    queryKey: ["ot-all-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ot_categories")
        .select("id, internal_id, external_id, name_mn, name_en, name_ru, icon_url, provider_type, item_ids, parent_internal_id")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data as OtCat[];
    },
    staleTime: 1000 * 60 * 30,
  });

  // Fetch current category
  const { data: category, isLoading: loadingCat } = useQuery({
    queryKey: ["ot-category", internalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ot_categories")
        .select("*")
        .eq("internal_id", internalId!)
        .single();
      if (error) throw error;
      return data as OtCat;
    },
    enabled: !!internalId,
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

  // Fetch products — either via API search (external_id) or by item_ids batch fetch
  const { data: products, isLoading: loadingProducts } = useQuery({
    queryKey: ["ot-category-products", internalId, category?.external_id, category?.item_ids?.length, apiProvider, page],
    queryFn: async () => {
      if (!category) return [];
      // Strategy 1: category has external_id → use OT API search
      if (category.external_id && category.provider_type) {
        const result = await searchItems({
          categoryId: category.external_id,
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

      {/* Subcategories */}
      {subcategories && subcategories.length > 0 && (
        <div className="px-3 md:container mb-8">
          <h2 className="text-lg font-semibold mb-4">Дэд ангилалууд</h2>
          <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-8 gap-3">
            {subcategories.map((sub) => (
              <Link
                key={sub.internal_id}
                to={`/ot/browse/${sub.internal_id}`}
                className="group flex flex-col items-center gap-2"
              >
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-xl bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                  {sub.icon_url ? (
                    <img src={sub.icon_url} alt="" className="w-10 h-10 object-contain" />
                  ) : (
                    <FolderTree className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <span className="text-xs md:text-sm text-center line-clamp-2 group-hover:text-primary transition-colors">
                  {sub.name_mn || sub.name_en || sub.internal_id}
                </span>
              </Link>
            ))}
          </div>
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
              <OtProductCardComponent key={product.id} product={product} />
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
