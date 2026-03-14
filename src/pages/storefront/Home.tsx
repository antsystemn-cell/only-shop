import { useMemo, memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Shield, ShoppingBag, Globe } from "lucide-react";
import { useProviderLogos, getProviderLogo } from "@/hooks/useProviderLogos";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { OtProductCardComponent } from "@/components/storefront/OtProductCard";
import { searchItems, fetchItemsByIds } from "@/services/otApi";
import { Skeleton } from "@/components/ui/skeleton";
import HeaderSearch from "@/components/storefront/HeaderSearch";
import { useProviderSafe } from "@/contexts/ProviderContext";
import { useIsMobile } from "@/hooks/use-mobile";
import type { OtProductCard } from "@/types/otApi";
import { useTranslatedTitles } from "@/hooks/useTranslatedTitles";

// Shuffle array helper
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const DEFAULT_HOME_PAGE_SIZE = 24;
const HOME_POIZON_COUNT_KEY = "home_poizon_count";
const HOME_TAOBAO_COUNT_KEY = "home_taobao_count";
const HOME_AMAZON_COUNT_KEY = "home_amazon_count";

// Specific Dewu category IDs to show on home
const DEWU_HOME_CATEGORIES = ["otc-1368", "otc-1466", "otc-1470", "otc-1471", "otc-1467"];
const POIZON_GUARANTEED_CATEGORY_IDS = ["otc-1368", "otc-1466"];

function toPositiveInt(value: unknown, fallback: number) {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return Math.floor(num);
}

// ─── Static Provider Section (memoized) ────────────────────
const ProviderShowcase = memo(function ProviderShowcase({
  title,
  subtitle,
  icon,
  logoUrl,
  providerType,
  slug,
  categoryIds,
  guaranteedCategoryIds = [],
  guaranteedPerCategory = 0,
  pageSize = 12,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  logoUrl?: string | null;
  providerType: string;
  slug: string;
  categoryIds?: string[];
  guaranteedCategoryIds?: string[];
  guaranteedPerCategory?: number;
  pageSize?: number;
}) {
  const navigate = useNavigate();
  const { setSelectedProvider } = useProviderSafe();
  // Fetch category IDs: use provided list or fetch up to 4 root categories
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
        .order("display_order")
        .limit(4); // Only top 4 categories, not all 20+
      return data?.map((c) => c.internal_id) || [];
    },
    staleTime: 1000 * 60 * 60,
  });

  // Fetch products — max 3 OTAPI calls total (guaranteed + limited non-guaranteed)
  const { data: items, isLoading } = useQuery({
    queryKey: ["home-showcase", providerType, resolvedCatIds, pageSize, guaranteedCategoryIds, guaranteedPerCategory],
    queryFn: async () => {
      if (!resolvedCatIds || resolvedCatIds.length === 0) return [];

      const guaranteedSet = new Set(guaranteedCategoryIds.filter((id) => resolvedCatIds.includes(id)));
      const targetGuaranteed = Math.max(0, guaranteedPerCategory);

      // Fetch guaranteed items from DB item_ids
      const guaranteedItemIdsMap = new Map<string, string[]>();
      if (guaranteedSet.size > 0) {
        const { data: catRows } = await supabase
          .from("ot_categories")
          .select("internal_id, item_ids")
          .in("internal_id", [...guaranteedSet]);
        for (const row of catRows || []) {
          if (row.item_ids && row.item_ids.length > 0) {
            guaranteedItemIdsMap.set(row.internal_id, row.item_ids);
          }
        }
      }

      // Non-guaranteed: pick at most 2 categories to search (not all 20!)
      const nonGuaranteedCatIds = resolvedCatIds.filter((id) => !guaranteedSet.has(id)).slice(0, 2);

      const results = await Promise.allSettled(
        nonGuaranteedCatIds.map(async (catId) => {
          const result = await searchItems({
            categoryId: catId,
            provider: providerType,
            page: 0,
            pageSize: Math.min(pageSize, 24),
            orderBy: "Volume:Desc",
          });
          return result.items;
        })
      );

      // Fetch guaranteed items
      const guaranteedFetchResults = await Promise.allSettled(
        [...guaranteedSet].map(async (catId) => {
          const allIds = guaranteedItemIdsMap.get(catId) || [];
          if (allIds.length === 0) return [] as OtProductCard[];
          const poolSize = Math.min(allIds.length, targetGuaranteed * 4);
          const shuffledIds = shuffle(allIds).slice(0, poolSize);
          return fetchItemsByIds(shuffledIds, 6);
        })
      );

      // Collect guaranteed
      const guaranteed: OtProductCard[] = [];
      const guaranteedIds = new Set<string>();
      [...guaranteedSet].forEach((catId, idx) => {
        const r = guaranteedFetchResults[idx];
        if (r.status === "fulfilled" && r.value.length > 0) {
          const picked = shuffle(r.value).slice(0, targetGuaranteed);
          for (const product of picked) {
            if (!guaranteedIds.has(product.id)) {
              guaranteed.push(product);
              guaranteedIds.add(product.id);
            }
          }
        }
      });

      // Collect rest from non-guaranteed
      const rest: OtProductCard[] = [];
      const restSeen = new Set<string>();
      nonGuaranteedCatIds.forEach((catId, idx) => {
        const r = results[idx];
        if (r.status === "fulfilled") {
          for (const item of r.value) {
            if (!guaranteedIds.has(item.id) && !restSeen.has(item.id)) {
              restSeen.add(item.id);
              rest.push(item);
            }
          }
        }
      });

      // Filter warehouse items
      const isWarehouse = (item: OtProductCard) =>
        item.id.startsWith("wh-") || item.providerType?.toLowerCase() === "warehouse";

      const filteredGuaranteed = guaranteed.filter((i) => !isWarehouse(i));
      const filteredRest = rest.filter((i) => !isWarehouse(i));

      const fillCount = Math.max(0, pageSize - filteredGuaranteed.length);
      return [...filteredGuaranteed, ...shuffle(filteredRest).slice(0, fillCount)];
    },
    staleTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    enabled: !!resolvedCatIds && resolvedCatIds.length > 0,
  });

  const itemsKey = (items || []).map(p => p.id).join(",");
  const homeTitlesList = useMemo(() => (items || []).map(p => p.title), [itemsKey]);
  const homeTranslations = useTranslatedTitles(homeTitlesList);

  const handleViewAll = () => {
    const filter = providerType === "Poizon" ? ("Poizon" as const) : providerType === "Amazon" ? ("Amazon" as const) : ("Taobao" as const);
    setSelectedProvider(filter);
    navigate(`/ot/provider/${slug}`);
  };

  const loading = isLoading || !resolvedCatIds;

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-primary/10 text-primary">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="h-5 w-5 object-contain rounded-full" />
            ) : icon}
          </div>
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
              <OtProductCardComponent key={product.id} product={product} translatedTitle={homeTranslations[product.title]} />
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
});

export default function Home() {
  const isMobile = useIsMobile();
  const { data: stripItems } = useProviderLogos();

  const { data: homeShowcaseSettings } = useQuery({
    queryKey: ["home-showcase-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_settings")
        .select("setting_key, setting_value")
        .eq("category", "storefront")
        .in("setting_key", [HOME_POIZON_COUNT_KEY, HOME_TAOBAO_COUNT_KEY, HOME_AMAZON_COUNT_KEY]);
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  const poizonPageSize = toPositiveInt(
    homeShowcaseSettings?.find((s) => s.setting_key === HOME_POIZON_COUNT_KEY)?.setting_value,
    DEFAULT_HOME_PAGE_SIZE
  );

  const taobaoPageSize = toPositiveInt(
    homeShowcaseSettings?.find((s) => s.setting_key === HOME_TAOBAO_COUNT_KEY)?.setting_value,
    DEFAULT_HOME_PAGE_SIZE
  );

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
          logoUrl={getProviderLogo(stripItems, "Poizon")}
          providerType="Poizon"
          slug="poizon"
          categoryIds={DEWU_HOME_CATEGORIES}
          guaranteedCategoryIds={POIZON_GUARANTEED_CATEGORY_IDS}
          guaranteedPerCategory={3}
          pageSize={poizonPageSize}
        />

        {/* Taobao Section */}
        <ProviderShowcase
          title="Taobao"
          subtitle="Хүссэн бүхэн нэг дор"
          icon={<ShoppingBag className="h-4 w-4" />}
          logoUrl={getProviderLogo(stripItems, "Taobao")}
          providerType="Taobao"
          slug="taobao"
          pageSize={taobaoPageSize}
        />
      </div>
    </div>
  );
}

