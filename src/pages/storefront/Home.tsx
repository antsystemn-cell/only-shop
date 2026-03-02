import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Loader2, Shield, ShoppingBag, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { OtProductCardComponent } from "@/components/storefront/OtProductCard";
import { searchItems } from "@/services/otApi";
import { Skeleton } from "@/components/ui/skeleton";
import HeaderSearch from "@/components/storefront/HeaderSearch";
import { useProviderSafe } from "@/contexts/ProviderContext";
import { useIsMobile } from "@/hooks/use-mobile";

// ─── Static Provider Section ────────────────────────────────
function ProviderShowcase({
  title,
  subtitle,
  icon,
  providerType,
  slug,
  pageSize = 12,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  providerType: string;
  slug: string;
  pageSize?: number;
}) {
  const navigate = useNavigate();
  const { setSelectedProvider } = useProviderSafe();

  const { data, isLoading } = useQuery({
    queryKey: ["home-provider-showcase", providerType],
    queryFn: () =>
      searchItems({
        provider: providerType,
        page: 0,
        pageSize,
        orderBy: "Volume:Desc",
      }),
    staleTime: 1000 * 60 * 10,
  });

  const items = data?.items || [];

  const handleViewAll = () => {
    const filter = providerType === "Poizon" ? "Poizon" as const : "Taobao" as const;
    setSelectedProvider(filter);
    navigate(`/ot/provider/${slug}`);
  };

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

      {isLoading ? (
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
              <OtProductCardComponent key={product.id} product={product} />
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
          pageSize={12}
        />

        {/* Taobao Section */}
        <ProviderShowcase
          title="Taobao"
          subtitle="Хүссэн бүхэн нэг дор"
          icon={<ShoppingBag className="h-4 w-4" />}
          providerType="Taobao"
          slug="taobao"
          pageSize={12}
        />
      </div>
    </div>
  );
}
