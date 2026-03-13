import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Trash2, Clock, Package, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  getLocalHistory,
  getProviderLabel,
  PROVIDER_CONFIG,
  type StoredItem,
} from "@/hooks/useRecentlyViewed";
import { getGridImageUrl } from "@/utils/imageOptimizer";

const PAGE_SIZE = 30;

// Normalize provider for filtering
function norm(p: string) {
  const l = p.toLowerCase();
  return l === "dewu" ? "poizon" : l;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Саяхан";
  if (mins < 60) return `${mins} мин`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} цаг`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} өдөр`;
  return `${Math.floor(days / 30)} сар`;
}

function formatPrice(price: number, currency: string) {
  if (currency === "₮" || currency === "MNT") {
    return new Intl.NumberFormat("mn-MN").format(Math.round(price)) + "₮";
  }
  return `${currency}${price.toFixed(2)}`;
}

export default function ViewHistory() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<StoredItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [providerFilter, setProviderFilter] = useState("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [hasMore, setHasMore] = useState(true);

  // Fetch history
  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      if (user?.id) {
        // DB fetch for logged-in users
        const { data } = await supabase
          .from("recently_viewed" as any)
          .select("*")
          .eq("user_id", user.id)
          .order("last_viewed_at", { ascending: false })
          .limit(500);

        const rows = (data || []) as any[];
        setItems(
          rows.map((r: any) => ({
            provider: r.provider,
            provider_product_id: r.provider_product_id,
            canonical_key: r.canonical_key,
            title_snapshot: r.title_snapshot,
            image_snapshot: r.image_snapshot,
            price_snapshot: r.price_snapshot,
            currency: r.currency || "₮",
            product_url: r.product_url,
            first_viewed_at: r.first_viewed_at,
            last_viewed_at: r.last_viewed_at,
            view_count: r.view_count || 1,
          }))
        );
      } else {
        setItems(getLocalHistory());
      }
    } catch {
      setItems(getLocalHistory());
    }
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Available providers from data
  const availableProviders = useMemo(() => {
    const set = new Set(items.map((i) => norm(i.provider)));
    return Array.from(set).sort();
  }, [items]);

  // Filtered items
  const filtered = useMemo(() => {
    if (providerFilter === "all") return items;
    return items.filter((i) => norm(i.provider) === providerFilter);
  }, [items, providerFilter]);

  const displayed = filtered.slice(0, visibleCount);

  useEffect(() => {
    setHasMore(visibleCount < filtered.length);
  }, [visibleCount, filtered.length]);

  // Infinite scroll sentinel
  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) return;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting && hasMore) {
            setVisibleCount((c) => c + PAGE_SIZE);
          }
        },
        { rootMargin: "200px" }
      );
      obs.observe(node);
      return () => obs.disconnect();
    },
    [hasMore]
  );

  // Remove single item
  const removeItem = async (canonicalKey: string) => {
    if (user?.id) {
      await supabase
        .from("recently_viewed" as any)
        .delete()
        .eq("user_id", user.id)
        .eq("canonical_key", canonicalKey);
    }
    setItems((prev) => prev.filter((i) => i.canonical_key !== canonicalKey));
    // Also remove from localStorage
    const local = getLocalHistory().filter((i) => i.canonical_key !== canonicalKey);
    try { localStorage.setItem("only_recently_viewed", JSON.stringify(local)); } catch {}
    toast.success("Устгагдлаа");
  };

  // Clear all
  const clearAll = async () => {
    if (user?.id) {
      await supabase.from("recently_viewed" as any).delete().eq("user_id", user.id);
    }
    localStorage.removeItem("only_recently_viewed");
    setItems([]);
    toast.success("Бүх түүх устгагдлаа");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold">Үзсэн түүх</h1>
              <p className="text-xs text-muted-foreground">
                {filtered.length} бараа
              </p>
            </div>
          </div>
          {items.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-1" />
                  Бүгдийг устгах
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Бүх түүхийг устгах уу?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Энэ үйлдлийг буцаах боломжгүй.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Болих</AlertDialogCancel>
                  <AlertDialogAction onClick={clearAll}>Устгах</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        {/* Provider filter chips */}
        {availableProviders.length > 0 && (
          <div className="max-w-7xl mx-auto px-4 pb-3 flex gap-2 overflow-x-auto no-scrollbar">
            <button
              onClick={() => { setProviderFilter("all"); setVisibleCount(PAGE_SIZE); }}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                providerFilter === "all"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              Бүгд ({items.length})
            </button>
            {availableProviders.map((p) => {
              const count = items.filter((i) => norm(i.provider) === p).length;
              return (
                <button
                  key={p}
                  onClick={() => { setProviderFilter(p); setVisibleCount(PAGE_SIZE); }}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                    providerFilter === p
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {getProviderLabel(p)} ({count})
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="max-w-7xl mx-auto px-4 py-4">
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-square rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
              <Clock className="h-10 w-10 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold mb-2">Үзсэн түүх хоосон</h2>
            <p className="text-muted-foreground text-sm mb-6 max-w-xs">
              Та барааны дэлгэрэнгүй хуудсуудыг үзсэн тохиолдолд энд харагдана
            </p>
            <Button onClick={() => navigate("/ot")}>Бараа үзэх</Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {displayed.map((item) => (
                <HistoryCard
                  key={item.canonical_key}
                  item={item}
                  onRemove={() => removeItem(item.canonical_key)}
                />
              ))}
            </div>

            {/* Infinite scroll sentinel */}
            {hasMore && (
              <div ref={sentinelRef} className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── History Card ─────────────────────────────────────────────
function HistoryCard({
  item,
  onRemove,
}: {
  item: StoredItem;
  onRemove: () => void;
}) {
  const providerNorm = norm(item.provider);
  const isPoizon = providerNorm === "poizon";
  const config = PROVIDER_CONFIG[providerNorm];

  return (
    <Card className="group overflow-hidden border-border/50 hover:shadow-md transition-shadow">
      <Link to={item.product_url} className="block">
        <div className="relative aspect-square bg-muted overflow-hidden">
          <img
            src={getGridImageUrl(item.image_snapshot)}
            alt={item.title_snapshot}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          {/* Provider badge */}
          {isPoizon && (
            <div className="absolute top-1.5 left-1.5 bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
              100% Оригинал
            </div>
          )}
          {!isPoizon && config && (
            <div className={`absolute top-1.5 left-1.5 ${config.color} text-white text-[10px] font-bold px-1.5 py-0.5 rounded`}>
              {config.label}
            </div>
          )}
          {/* Remove button - always visible with confirmation */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                className="absolute top-1.5 right-1.5 bg-background/80 backdrop-blur-sm rounded-full p-1.5"
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
              <AlertDialogHeader>
                <AlertDialogTitle>Устгах уу?</AlertDialogTitle>
                <AlertDialogDescription>
                  Энэ барааг үзсэн түүхээсээ устгахдаа итгэлтэй байна уу?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Үгүй</AlertDialogCancel>
                <AlertDialogAction onClick={onRemove}>Тийм</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        <div className="p-2.5 space-y-1">
          <p className="text-xs text-foreground line-clamp-2 leading-tight min-h-[2rem]">
            {item.title_snapshot}
          </p>
          <p className="text-sm font-bold text-primary">
            {formatPrice(item.price_snapshot, item.currency)}
          </p>
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {timeAgo(item.last_viewed_at)}
          </p>
        </div>
      </Link>
    </Card>
  );
}
