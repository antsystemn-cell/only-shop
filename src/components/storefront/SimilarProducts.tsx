import { useMemo, useState, useEffect, useRef } from "react";
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
  /** If the product has a custom title override, pass it here so similar search uses it */
  customTitle?: string;
}

function isPoizon(providerType?: string) {
  const p = providerType?.toLowerCase();
  return p === "poizon" || p === "dewu";
}

export function SimilarProducts({ product, customTitle }: SimilarProductsProps) {
  const navigate = useNavigate();
  const poizon = isPoizon(product.providerType);

  // Poizon: fetch by categoryId; others with vendor: fetch by vendorId; fallback: search by title
  const categoryId = poizon ? product.categoryId : undefined;
  const vendorId = !poizon ? product.vendor?.id : undefined;
  // Use customTitle (override) for search if available, otherwise fall back to original title
  const searchQuery = !categoryId && !vendorId ? (customTitle || product.title) : undefined;

  const enabled = !!(categoryId || vendorId || searchQuery);

  // LAZY: Only fetch similar products when component is visible on screen
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setIsVisible(true); observer.disconnect(); } },
      { rootMargin: "200px" }
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["similar-products", product.id, categoryId, vendorId, searchQuery],
    queryFn: async () => {
      const result = await searchItems({
        categoryId,
        vendorId,
        query: searchQuery,
        provider: product.providerType,
        page: 0,
        pageSize: 12,
        orderBy: "Volume:Desc",
      });
      return result.items.filter((i) => i.id !== product.id).slice(0, 12);
    },
    enabled: enabled && isVisible,
    staleTime: 1000 * 60 * 15, // 15min cache
  });
  const similarItemsKey = (data || []).map(p => p.id).join(",");
  const titlesList = useMemo(() => (data || []).map(p => p.title), [similarItemsKey]);
  const translations = useTranslatedTitles(titlesList);

  if (!enabled) return <div ref={containerRef} />;

  const sectionTitle = poizon
    ? "Төстэй бараанууд"
    : vendorId
      ? `${product.vendorName || "Дэлгүүр"}-ийн бусад бараа`
      : "Төстэй бараанууд";

  const handleViewAll = () => {
    if (poizon && categoryId) {
      navigate(`/ot/category/${categoryId}`);
    } else if (vendorId) {
      navigate(`/ot?vendorId=${vendorId}&vendorName=${encodeURIComponent(product.vendorName || "")}`);
    } else if (searchQuery) {
      const params = new URLSearchParams({ q: searchQuery });
      if (product.providerType) params.set("provider", product.providerType);
      navigate(`/ot?${params.toString()}`);
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
