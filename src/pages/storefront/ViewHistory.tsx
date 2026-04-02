import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Trash2, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface ViewedItem {
  id: string;
  provider: string;
  provider_product_id: string;
  canonical_key: string;
  title_snapshot: string;
  image_snapshot: string;
  price_snapshot: number;
  currency: string;
  product_url: string;
  last_viewed_at: string;
  view_count: number;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Саяхан";
  if (mins < 60) return `${mins} мин`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} цаг`;
  const days = Math.floor(hrs / 24);
  return `${days} өдөр`;
}

function formatPrice(price: number) {
  return new Intl.NumberFormat("mn-MN").format(Math.round(price)) + "₮";
}

export default function ViewHistory() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<ViewedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      if (user?.id) {
        const { data } = await supabase
          .from("recently_viewed" as any)
          .select("*")
          .eq("user_id", user.id)
          .order("last_viewed_at", { ascending: false })
          .limit(100);
        setItems((data as any[]) || []);
      } else {
        setItems([]);
      }
    } catch {
      setItems([]);
    }
    setIsLoading(false);
  }, [user]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const removeItem = async (canonicalKey: string) => {
    if (user?.id) {
      await supabase.from("recently_viewed" as any).delete().eq("user_id", user.id).eq("canonical_key", canonicalKey);
    }
    setItems((prev) => prev.filter((i) => i.canonical_key !== canonicalKey));
    toast.success("Устгагдлаа");
  };

  const clearAll = async () => {
    if (user?.id) {
      await supabase.from("recently_viewed" as any).delete().eq("user_id", user.id);
    }
    setItems([]);
    toast.success("Бүх түүх устгагдлаа");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold">Үзсэн түүх</h1>
              <p className="text-xs text-muted-foreground">{items.length} бараа</p>
            </div>
          </div>
          {items.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-1" />Бүгдийг устгах
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Бүх түүхийг устгах уу?</AlertDialogTitle>
                  <AlertDialogDescription>Энэ үйлдлийг буцаах боломжгүй.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Болих</AlertDialogCancel>
                  <AlertDialogAction onClick={clearAll}>Устгах</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
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
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
              <Clock className="h-10 w-10 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold mb-2">Үзсэн түүх хоосон</h2>
            <p className="text-muted-foreground text-sm mb-6 max-w-xs">
              Та барааны дэлгэрэнгүй хуудсуудыг үзсэн тохиолдолд энд харагдана
            </p>
            <Button onClick={() => navigate("/shop")}>Бараа үзэх</Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {items.map((item) => (
              <Card key={item.canonical_key} className="relative group overflow-hidden border-border/50 hover:shadow-md transition-shadow">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button className="absolute top-1.5 right-1.5 z-10 bg-background/80 backdrop-blur-sm rounded-full p-1.5" aria-label="Устгах">
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Устгах уу?</AlertDialogTitle>
                      <AlertDialogDescription>Энэ барааг үзсэн түүхээсээ устгахдаа итгэлтэй байна уу?</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Үгүй</AlertDialogCancel>
                      <AlertDialogAction onClick={() => removeItem(item.canonical_key)}>Тийм</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Link to={item.product_url} className="block">
                  <div className="relative aspect-square bg-muted overflow-hidden">
                    <img src={item.image_snapshot} alt={item.title_snapshot} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  </div>
                  <div className="p-2.5 space-y-1">
                    <p className="text-xs text-foreground line-clamp-2 leading-tight min-h-[2rem]">{item.title_snapshot}</p>
                    <p className="text-sm font-bold text-primary">{formatPrice(item.price_snapshot)}</p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />{timeAgo(item.last_viewed_at)}
                    </p>
                  </div>
                </Link>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
