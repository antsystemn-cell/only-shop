import { useMemo, memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Shield, ShoppingBag, Globe } from "lucide-react";
import { useProviderLogos, getProviderLogo } from "@/hooks/useProviderLogos";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import HeaderSearch from "@/components/storefront/HeaderSearch";
import { useProviderSafe } from "@/contexts/ProviderContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTranslatedTitles } from "@/hooks/useTranslatedTitles";
import { OtProductCardComponent } from "@/components/storefront/OtProductCard";
import type { OtProductCard } from "@/types/otApi";
import { searchItems, fetchItemsByIds } from "@/services/otApi";

// ─── Lightweight card from snapshot ─────────────────────────
interface SnapshotCard {
  id: string;
  title: string;
  imageUrl: string;
  price: number;
  originalPrice?: number;
  currency: string;
  providerType?: string;
}

function snapshotToProductCard(card: SnapshotCard): OtProductCard {
  return {
    id: card.id,
    title: card.title,
    imageUrl: card.imageUrl,
    price: card.price,
    originalPrice: card.originalPrice,
    currency: card.currency || "¥",
    providerType: card.providerType,
  };
}

// Shuffle helper
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
const HOME_PROVIDER_ORDER_KEY = "home_provider_order";

// Specific Dewu category IDs for fallback live fetching
const DEWU_HOME_CATEGORIES = ["otc-1368", "otc-1466", "otc-1470", "otc-1471", "otc-1467"];
const POIZON_GUARANTEED_CATEGORY_IDS = ["otc-1368", "otc-1466"];

function toPositiveInt(value: unknown, fallback: number) {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return Math.floor(num);
}

// ─── Icon map for segments ──────────────────────────────────
const ICON_MAP: Record<string, React.ReactNode> = {
  shield: <Shield className="h-4 w-4" />,
  shopping: <ShoppingBag className="h-4 w-4" />,
  globe: <Globe className="h-4 w-4" />,
};

// ─── Segment Section (snapshot-first, fallback to live) ─────
const SegmentSection = memo(function SegmentSection({
  segment,
  logoUrl,
  pageSize,
}: {
  segment: {
    id: string;
    name: string;
    slug: string;
    title: string;
    subtitle: string;
    provider_type: string;
    source_type: string;
    category_ids: string[];
    manual_item_ids: string[];
    item_count: number;
    pool_size: number;
    icon_name: string | null;
    logo_url: string | null;
  };
  logoUrl?: string | null;
  pageSize: number;
}) {
  const navigate = useNavigate();
  const { setSelectedProvider } = useProviderSafe();

  // 1. Try to load cached snapshot first
  const { data: snapshot, isLoading: snapshotLoading } = useQuery({
    queryKey: ["homepage-snapshot", segment.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("homepage_segment_snapshots")
        .select("items, item_count, generated_at, expires_at")
        .eq("segment_id", segment.id)
        .gte("expires_at", new Date().toISOString())
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    staleTime: 1000 * 60 * 30, // 30min client-side
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // 2. If no snapshot, fallback to live OTAPI (existing behavior)
  const hasSnapshot = !!snapshot && Array.isArray(snapshot.items) && snapshot.items.length > 0;

  const { data: liveItems, isLoading: liveLoading } = useQuery({
    queryKey: ["home-showcase-live", segment.provider_type, JSON.stringify(segment.category_ids), pageSize],
    queryFn: async () => {
      const catIds = segment.category_ids.length > 0 ? segment.category_ids : [];
      let resolvedCatIds = catIds;

      if (resolvedCatIds.length === 0) {
        const { data: roots } = await supabase
          .from("ot_categories")
          .select("internal_id, external_id")
          .is("parent_internal_id", null)
          .eq("is_active", true)
          .eq("provider_type", segment.provider_type)
          .order("display_order")
          .limit(4);
        resolvedCatIds = (roots || []).map(c => c.external_id || c.internal_id);
      }

      if (resolvedCatIds.length === 0) return [];

      const nonGuaranteedCatIds = resolvedCatIds.slice(0, 2);
      const results = await Promise.allSettled(
        nonGuaranteedCatIds.map(async (catId) => {
          const result = await searchItems({
            categoryId: catId,
            provider: segment.provider_type,
            page: 0,
            pageSize: Math.min(pageSize, 24),
            orderBy: "Volume:Desc",
          });
          return result.items;
        })
      );

      const rest: OtProductCard[] = [];
      const seen = new Set<string>();
      for (const r of results) {
        if (r.status === "fulfilled") {
          for (const item of r.value) {
            if (!seen.has(item.id)) {
              seen.add(item.id);
              rest.push(item);
            }
          }
        }
      }

      const filtered = rest.filter(i => !i.id.startsWith("wh-") && i.providerType?.toLowerCase() !== "warehouse");
      return shuffle(filtered).slice(0, pageSize);
    },
    staleTime: 1000 * 60 * 15,
    refetchOnWindowFocus: false,
    enabled: !hasSnapshot && !snapshotLoading,
  });

  // Determine final items
  const items: OtProductCard[] = useMemo(() => {
    if (hasSnapshot) {
      return (snapshot.items as unknown as SnapshotCard[]).slice(0, pageSize).map(snapshotToProductCard);
    }
    return liveItems || [];
  }, [hasSnapshot, snapshot, liveItems, pageSize]);

  const loading = snapshotLoading || (!hasSnapshot && liveLoading);

  const itemsKey = items.map(p => p.id).join(",");
  const titlesList = useMemo(() => items.map(p => p.title), [itemsKey]);
  const translations = useTranslatedTitles(titlesList);

  const effectiveLogo = segment.logo_url || logoUrl;
  const icon = ICON_MAP[segment.icon_name || ""] || <ShoppingBag className="h-4 w-4" />;

  const handleViewAll = () => {
    const provType = segment.provider_type;
    const filter = provType === "Poizon" ? ("Poizon" as const) : provType === "Amazon" ? ("Amazon" as const) : ("Taobao" as const);
    setSelectedProvider(filter);
    if (provType === "Amazon") {
      navigate("/amazon");
    } else {
      navigate(`/ot/provider/${segment.slug}`);
    }
  };

  // Don't hide sections - show skeletons while loading, keep section visible even if empty temporarily
  if (!loading && items.length === 0) {
    // Still render section with skeletons briefly to avoid flash-of-nothing
    return null;
  }

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-primary/10 text-primary">
            {effectiveLogo ? (
              <img src={effectiveLogo} alt="" className="h-5 w-5 object-contain rounded-full" />
            ) : icon}
          </div>
          <div>
            <h2 className="text-sm md:text-lg font-bold">{segment.title || segment.name}</h2>
            <p className="text-[10px] md:text-xs text-muted-foreground">{segment.subtitle}</p>
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
            {items.map((product) => (
              <OtProductCardComponent key={product.id} product={product} translatedTitle={translations[product.title]} />
            ))}
          </div>
          {items.length > 0 && (
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

// ─── Home Page ───────────────────────────────────────────────
export default function Home() {
  const isMobile = useIsMobile();
  const { data: stripItems } = useProviderLogos();

  // Fetch segments from DB
  const { data: segments, isLoading: segmentsLoading } = useQuery({
    queryKey: ["homepage-segments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("homepage_segments")
        .select("*")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
  });

  // Fetch page sizes from admin settings (backward compat)
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

  const pageSizes: Record<string, number> = {
    Poizon: toPositiveInt(homeShowcaseSettings?.find(s => s.setting_key === HOME_POIZON_COUNT_KEY)?.setting_value, DEFAULT_HOME_PAGE_SIZE),
    Taobao: toPositiveInt(homeShowcaseSettings?.find(s => s.setting_key === HOME_TAOBAO_COUNT_KEY)?.setting_value, DEFAULT_HOME_PAGE_SIZE),
    Amazon: toPositiveInt(homeShowcaseSettings?.find(s => s.setting_key === HOME_AMAZON_COUNT_KEY)?.setting_value, DEFAULT_HOME_PAGE_SIZE),
  };

  // If no segments configured yet, use legacy provider order
  const { data: providerOrder } = useQuery({
    queryKey: ["home-provider-order"],
    queryFn: async () => {
      const { data } = await supabase
        .from("admin_settings")
        .select("setting_value")
        .eq("category", "storefront")
        .eq("setting_key", HOME_PROVIDER_ORDER_KEY)
        .maybeSingle();
      return Array.isArray(data?.setting_value) ? (data.setting_value as string[]) : ["Poizon", "Taobao", "Amazon"];
    },
    staleTime: 1000 * 60 * 5,
    enabled: !segmentsLoading && (!segments || segments.length === 0),
  });

  // Default segment configs for fallback when no DB segments exist
  const defaultSegments = useMemo(() => {
    if (segmentsLoading) return null; // Don't show defaults while loading DB segments
    if (segments && segments.length > 0) return null;
    const order = providerOrder || ["Poizon", "Taobao", "Amazon"];
    const defaults: Record<string, any> = {
      Poizon: {
        id: "default-poizon", name: "Poizon", slug: "poizon", title: "Poizon, Dewu",
        subtitle: "100% Оригинал", provider_type: "Poizon", source_type: "category_based",
        category_ids: DEWU_HOME_CATEGORIES, manual_item_ids: [], item_count: 24, pool_size: 60,
        icon_name: "shield", logo_url: null,
      },
      Taobao: {
        id: "default-taobao", name: "Taobao", slug: "taobao", title: "Taobao",
        subtitle: "Хүссэн бүхэн нэг дор", provider_type: "Taobao", source_type: "category_based",
        category_ids: [], manual_item_ids: [], item_count: 24, pool_size: 60,
        icon_name: "shopping", logo_url: null,
      },
      Amazon: {
        id: "default-amazon", name: "Amazon", slug: "amazon", title: "Amazon USA",
        subtitle: "Америкаас шууд", provider_type: "Amazon", source_type: "category_based",
        category_ids: [], manual_item_ids: [], item_count: 24, pool_size: 60,
        icon_name: "globe", logo_url: null,
      },
    };
    return order.map(p => defaults[p]).filter(Boolean);
  }, [segments, segmentsLoading, providerOrder]);

  const displaySegments = (segments && segments.length > 0) ? segments : (defaultSegments || []);

  return (
    <div className="animate-fade-in">
      {isMobile && (
        <div className="sticky top-0 z-30 bg-background px-3 pt-3 pb-2">
          <HeaderSearch />
        </div>
      )}

      <div className="px-1 md:container py-2 md:py-6 space-y-2">
      {segmentsLoading ? (
          // Show skeleton sections while segments load
          Array.from({ length: 3 }).map((_, i) => (
            <section key={`skel-${i}`} className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Skeleton className="h-8 w-8 rounded-md" />
                <div>
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24 mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1 md:gap-3">
                {Array.from({ length: 6 }).map((_, j) => (
                  <div key={j} className="overflow-hidden">
                    <Skeleton className="aspect-square" />
                    <div className="p-2 space-y-1.5">
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-2/3" />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))
        ) : (
          displaySegments.map((segment: any) => (
            <SegmentSection
              key={segment.id}
              segment={segment}
              logoUrl={getProviderLogo(stripItems, segment.provider_type)}
              pageSize={pageSizes[segment.provider_type] || segment.item_count || DEFAULT_HOME_PAGE_SIZE}
            />
          ))
        )}
      </div>
    </div>
  );
}
