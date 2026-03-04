import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Shield, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { OtProductCardComponent } from "@/components/storefront/OtProductCard";
import { searchItems, fetchItemsByIds } from "@/services/otApi";
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

const DEFAULT_HOME_PAGE_SIZE = 24;
const HOME_POIZON_COUNT_KEY = "home_poizon_count";
const HOME_TAOBAO_COUNT_KEY = "home_taobao_count";

// Specific Dewu category IDs to show on home
const DEWU_HOME_CATEGORIES = ["otc-1368", "otc-1466", "otc-1470", "otc-1471", "otc-1467"];
const POIZON_GUARANTEED_CATEGORY_IDS = ["otc-1368", "otc-1466"];

function toPositiveInt(value: unknown, fallback: number) {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return Math.floor(num);
}

// ─── Static Provider Section ────────────────────────────────
function ProviderShowcase({
  title,
  subtitle,
  icon,
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
  providerType: string;
  slug: string;
  categoryIds?: string[];
  guaranteedCategoryIds?: string[];
  guaranteedPerCategory?: number;
  pageSize?: number;
}) {
  const navigate = useNavigate();
  const { setSelectedProvider } = useProviderSafe();
  // Unique seed per mount so guaranteed items are re-shuffled on every page visit
  const [shuffleSeed] = useState(() => Date.now());

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
    queryKey: ["home-showcase", providerType, resolvedCatIds, pageSize, guaranteedCategoryIds, guaranteedPerCategory, shuffleSeed],
    queryFn: async () => {
      if (!resolvedCatIds || resolvedCatIds.length === 0) return [];

      const guaranteedSet = new Set(guaranteedCategoryIds.filter((id) => resolvedCatIds.includes(id)));
      const targetGuaranteed = Math.max(0, guaranteedPerCategory);

      // For guaranteed categories, fetch item_ids from DB and use fetchItemsByIds
      // (these are parent categories with curated item_ids, searchItems returns 0 for them)
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

      // Non-guaranteed category IDs for searchItems
      const nonGuaranteedCatIds = resolvedCatIds.filter((id) => !guaranteedSet.has(id));

      const results = await Promise.allSettled(
        nonGuaranteedCatIds.map(async (catId) => {
          const perCat = Math.max(Math.ceil((pageSize * 3) / Math.max(nonGuaranteedCatIds.length, 1)), 6);
          const result = await searchItems({
            categoryId: catId,
            provider: providerType,
            page: 0,
            pageSize: perCat,
            orderBy: "Volume:Desc",
          });
          return result.items;
        })
      );

      // Fetch guaranteed items via fetchItemsByIds (pick random subset from item_ids)
      const guaranteedFetchResults = await Promise.allSettled(
        [...guaranteedSet].map(async (catId) => {
          const allIds = guaranteedItemIdsMap.get(catId) || [];
          if (allIds.length === 0) return [] as OtProductCard[];
          // Pick a random subset to fetch (more than needed, then shuffle & slice)
          const poolSize = Math.min(allIds.length, targetGuaranteed * 4);
          const shuffledIds = shuffle(allIds).slice(0, poolSize);
          const fetched = await fetchItemsByIds(shuffledIds, 6);
          return fetched;
        })
      );

      // Collect items per non-guaranteed category
      const perCatItems: Map<string, OtProductCard[]> = new Map();
      nonGuaranteedCatIds.forEach((catId, idx) => {
        const r = results[idx];
        if (r.status === "fulfilled") {
          const localSeen = new Set<string>();
          const catList: OtProductCard[] = [];
          for (const item of r.value) {
            if (!localSeen.has(item.id)) {
              localSeen.add(item.id);
              catList.push(item);
            }
          }
          perCatItems.set(catId, catList);
        }
      });

      // Pick guaranteed items from fetchItemsByIds results
      const guaranteed: OtProductCard[] = [];
      const guaranteedIds = new Set<string>();
      const guaranteedCatList = [...guaranteedSet];
      guaranteedCatList.forEach((catId, idx) => {
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

      // Collect remaining items (excluding guaranteed ones)
      const rest: OtProductCard[] = [];
      const restSeen = new Set<string>();
      for (const [, catItems] of perCatItems) {
        for (const item of catItems) {
          if (guaranteedIds.has(item.id) || restSeen.has(item.id)) continue;
          restSeen.add(item.id);
          rest.push(item);
        }
      }

      // Filter out warehouse items (wh- prefix or providerType "warehouse")
      const isWarehouse = (item: OtProductCard) =>
        item.id.startsWith("wh-") || item.providerType?.toLowerCase() === "warehouse";

      const filteredGuaranteed = guaranteed.filter((i) => !isWarehouse(i));
      const filteredRest = rest.filter((i) => !isWarehouse(i));

      const fillCount = Math.max(0, pageSize - filteredGuaranteed.length);
      return [...filteredGuaranteed, ...shuffle(filteredRest).slice(0, fillCount)];
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

  const { data: homeShowcaseSettings } = useQuery({
    queryKey: ["home-showcase-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_settings")
        .select("setting_key, setting_value")
        .eq("category", "storefront")
        .in("setting_key", [HOME_POIZON_COUNT_KEY, HOME_TAOBAO_COUNT_KEY]);
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
          providerType="Taobao"
          slug="taobao"
          pageSize={taobaoPageSize}
        />
      </div>
    </div>
  );
}

