import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { Loader2, Package, FolderTree, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { OtProductCardComponent } from "@/components/storefront/OtProductCard";
import { searchItems } from "@/services/otApi";
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

export default function OtCategoryBrowse() {
  const { internalId } = useParams<{ internalId: string }>();

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

  // Fetch products from item_ids using OT API search
  const { data: products, isLoading: loadingProducts } = useQuery({
    queryKey: ["ot-category-products", internalId, category?.item_ids],
    queryFn: async () => {
      if (!category?.item_ids?.length) return [];
      
      // Use searchItems with the category's external_id if it has one
      // Otherwise we'd need a batch item fetch which OT API supports
      if (category.external_id && category.provider_type) {
        const result = await searchItems({
          categoryId: category.external_id,
          provider: category.provider_type,
          pageSize: 40,
        });
        return result.items;
      }
      return [];
    },
    enabled: !!category && (!!category.external_id || (category.item_ids?.length || 0) > 0),
    staleTime: 1000 * 60 * 10,
  });

  const displayName = category?.name_mn || category?.name_en || category?.name_ru || internalId;

  return (
    <div className="py-6 md:py-8 animate-fade-in">
      {/* Header */}
      <div className="px-3 md:container mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Link to="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Нүүр
            </Button>
          </Link>
        </div>
        {loadingCat ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : (
          <>
            <h1 className="text-2xl md:text-3xl font-bold">{displayName}</h1>
            {category?.provider_type && (
              <span className="text-sm text-muted-foreground">
                {category.provider_type} · {category.item_ids?.length || 0} бараа
              </span>
            )}
          </>
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
        <div className="px-2 md:container grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 md:gap-4">
          {products.map((product) => (
            <OtProductCardComponent key={product.id} product={product} />
          ))}
        </div>
      ) : category?.external_id ? (
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
