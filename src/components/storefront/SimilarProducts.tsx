import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { searchItems } from "@/services/otApi";
import { OtProductCardComponent } from "@/components/storefront/OtProductCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import type { ProductDetail } from "@/services/otApi";
import { useTranslatedTitles } from "@/hooks/useTranslatedTitles";

interface SimilarProductsProps {
  product: ProductDetail;
}

function isPoizon(providerType?: string) {
  const p = providerType?.toLowerCase();
  return p === "poizon" || p === "dewu";
}

export function SimilarProducts({ product }: SimilarProductsProps) {
  const navigate = useNavigate();
  const poizon = isPoizon(product.providerType);

  // Poizon: fetch by categoryId; Taobao: fetch by vendorId
  const categoryId = poizon ? product.categoryId : undefined;
  const vendorId = !poizon ? product.vendor?.id : undefined;

  const enabled = !!(categoryId || vendorId);

  const { data, isLoading } = useQuery({
    queryKey: ["similar-products", product.id, categoryId, vendorId],
    queryFn: async () => {
      const result = await searchItems({
        categoryId,
        vendorId,
        provider: product.providerType,
        page: 0,
        pageSize: 20,
        orderBy: "Volume:Desc",
      });
      // Filter out the current product
      return result.items.filter((i) => i.id !== product.id).slice(0, 12);
    },
    enabled,
    staleTime: 1000 * 60 * 10,
  });
  const similarItemsKey = (data || []).map(p => p.id).join(",");
  const titlesList = useMemo(() => (data || []).map(p => p.title), [similarItemsKey]);
  const translations = useTranslatedTitles(titlesList);

  if (!enabled) return null;

  const sectionTitle = poizon ? "Төстэй бараанууд" : `${product.vendorName || "Дэлгүүр"}-ийн бусад бараа`;

  const handleViewAll = () => {
    if (poizon && categoryId) {
      navigate(`/ot/category/${categoryId}`);
    } else if (vendorId) {
      navigate(`/ot?vendorId=${vendorId}&vendorName=${encodeURIComponent(product.vendorName || "")}`);
    }
  };

  if (isLoading) {
    return (
      <section className="mt-10">
        <h2 className="text-lg font-bold mb-4">{sectionTitle}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1 md:gap-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="aspect-square" />
              <div className="p-2 space-y-1.5">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (!data || data.length === 0) return null;

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">{sectionTitle}</h2>
        <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={handleViewAll}>
          Бүгдийг үзэх →
        </Button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1 md:gap-3">
        {data.map((item) => (
          <OtProductCardComponent key={item.id} product={item} translatedTitle={translations[item.title]} />
        ))}
      </div>
      {data.length >= 10 && (
        <div className="flex justify-center mt-4">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleViewAll}>
            Бүгдийг үзэх
          </Button>
        </div>
      )}
    </section>
  );
}
