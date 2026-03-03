import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Shield, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { OtProductCardComponent } from "@/components/storefront/OtProductCard";
import { searchItems } from "@/services/otApi";
import { Skeleton } from "@/components/ui/skeleton";
import HeaderSearch from "@/components/storefront/HeaderSearch";
import { useProviderSafe } from "@/contexts/ProviderContext";
import { useIsMobile } from "@/hooks/use-mobile";
import type { OtProductCard } from "@/types/otApi";

// Shuffle array helper
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Specific Dewu category IDs to show on home
const DEWU_HOME_CATEGORIES = ["otc-1368", "otc-1466", "otc-1470", "otc-1471", "otc-1467"];

// ─── Static Provider Section ────────────────────────────────
function ProviderShowcase({
  title,
  subtitle,
  icon,
  providerType,
  slug,
  categoryIds,
  pageSize = 12,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  providerType: string;
  slug: string;
  categoryIds?: string[];
  pageSize?: number;
}) {
  const navigate = useNavigate();
  const { setSelectedProvider } = useProviderSafe();

  // Fetch category IDs: use provided list or fetch all root categories
  const { data: resolvedCatIds } = useQuery({
    queryKey: ["home-cat-ids", providerType, categoryIds],
    queryFn: async () => {
      if (categoryIds && categoryIds.length > 0) return categoryIds;
      const { data } = await supabase
        .from("ot_categories")
        .select("internal_id")
        .is("parent_internal_id", null)
        .eq("is_active", true)
        .eq("provider_type", providerType)
        .order("display_order");
      return data?.map((c) => c.internal_id) || [];
    },
    staleTime: 1000 * 60 * 60,
  });

  // Fetch products from categories and shuffle
  const { data: items, isLoading } = useQuery({
    queryKey: ["home-showcase", providerType, resolvedCatIds],
    queryFn: async () => {
      if (!resolvedCatIds || resolvedCatIds.length === 0) return [];
      const perCat = Math.ceil((pageSize * 2) / resolvedCatIds.length);
      const results = await Promise.allSettled(
        resolvedCatIds.map((catId) =>
          searchItems({
            categoryId: catId,
            provider: providerType,
            page: 0,
            pageSize: perCat,
            orderBy: "Volume:Desc",
          })
        )
      );
      const allItems: OtProductCard[] = [];
      const seen = new Set<string>();
      for (const r of results) {
        if (r.status === "fulfilled") {
          for (const item of r.value.items) {
            if (!seen.has(item.id)) {
              seen.add(item.id);
              allItems.push(item);
            }
          }
        }
      }
      return shuffle(allItems).slice(0, pageSize);
    },
    staleTime: 1000 * 60 * 10,
    enabled: !!resolvedCatIds && resolvedCatIds.length > 0,
  });

  const handleViewAll = () => {
    const filter = providerType === "Poizon" ? ("Poizon" as const) : ("Taobao" as const);
    setSelectedProvider(filter);
    navigate(`/ot/provider/${slug}`);
  };

  const loading = isLoading || !resolvedCatIds;

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-primary/10 text-primary">{icon}</div>
          <div>
            <h2 className="text-sm md:text-lg font-bold">{title}</h2>
            <p className="text-[10px] md:text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-7" onClick={handleViewAll}>
          Бүгдийг үзэх →
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1 md:gap-3">
          {Array.from({ length: pageSize }).map((_, i) => (
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
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1 md:gap-3">
            {(items || []).map((product) => (
              <OtProductCardComponent key={product.id} product={product} />
            ))}
          </div>
          {items && items.length > 0 && (
            <div className="flex justify-center mt-4">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleViewAll}>
                Бүгдийг үзэх
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default function Home() {
  const isMobile = useIsMobile();

  return (
    <div className="animate-fade-in">
      {/* Mobile search */}
      {isMobile && (
        <div className="sticky top-0 z-30 bg-background px-3 pt-3 pb-2">
          <HeaderSearch />
        </div>
      )}

      <div className="px-1 md:container py-2 md:py-6 space-y-2">
        {/* Poizon Section */}
        <ProviderShowcase
          title="Poizon, Dewu"
          subtitle="100% Оригинал"
          icon={<Shield className="h-4 w-4" />}
          providerType="Poizon"
          slug="poizon"
          categoryIds={DEWU_HOME_CATEGORIES}
          pageSize={20}
        />

        {/* Taobao Section */}
        <ProviderShowcase
          title="Taobao"
          subtitle="Хүссэн бүхэн нэг дор"
          icon={<ShoppingBag className="h-4 w-4" />}
          providerType="Taobao"
          slug="taobao"
          pageSize={20}
        />
      </div>
    </div>
  );
}
