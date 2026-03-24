import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingDown, Clock, AlertTriangle, ExternalLink, Zap } from "lucide-react";
import { format, subDays, startOfDay } from "date-fns";

export default function OtBilling() {
  // Get last 30 days paid calls
  const { data: recentLogs } = useQuery({
    queryKey: ["otapi-billing-logs"],
    queryFn: async () => {
      const from = startOfDay(subDays(new Date(), 30)).toISOString();
      const { data, error } = await supabase
        .from("otapi_logs")
        .select("method, is_paid, is_cache_hit, created_at")
        .gte("created_at", from)
        .limit(1000);
      if (error) throw error;
      return data || [];
    },
  });

  const totalCalls30d = recentLogs?.length || 0;
  const paidCalls30d = recentLogs?.filter((l) => l.is_paid && !l.is_cache_hit).length || 0;
  const cacheHits30d = recentLogs?.filter((l) => l.is_cache_hit).length || 0;

  // Estimate daily burn
  const daysWithData = new Set(recentLogs?.map((l) => format(new Date(l.created_at), "yyyy-MM-dd"))).size || 1;
  const dailyBurnRate = Math.round(paidCalls30d / daysWithData);

  // Top cost methods
  const methodCost = new Map<string, number>();
  recentLogs?.forEach((l) => {
    if (l.is_paid && !l.is_cache_hit) {
      methodCost.set(l.method, (methodCost.get(l.method) || 0) + 1);
    }
  });
  const topMethods = Array.from(methodCost.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Savings calculation
  const savedCalls = cacheHits30d;
  const savingsPercent = totalCalls30d > 0 ? ((savedCalls / totalCalls30d) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">OTAPI Биллинг</h1>
        <p className="text-sm text-muted-foreground">Зардал, хэмнэлт, баланс тооцоо</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Сарын төлбөртэй дуудлага</span>
            </div>
            <div className="text-3xl font-bold">{paidCalls30d.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="h-4 w-4 text-green-600" />
              <span className="text-xs text-muted-foreground">Кэшээр хэмнэсэн</span>
            </div>
            <div className="text-3xl font-bold text-green-600">{savedCalls.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">{savingsPercent}% хэмнэлт</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Өдрийн дундаж</span>
            </div>
            <div className="text-3xl font-bold">{dailyBurnRate.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">төлбөртэй дуудлага/өдөр</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Нийт (30 хоног)</span>
            </div>
            <div className="text-3xl font-bold">{totalCalls30d.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Top cost methods + Top-up */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Хамгийн их зардалтай методууд</CardTitle>
            <CardDescription>Сүүлийн 30 хоногийн төлбөртэй дуудлагаар</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topMethods.map(([method, count], i) => (
                <div key={method} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={i === 0 ? "destructive" : "secondary"} className="text-xs">#{i + 1}</Badge>
                    <span className="font-mono text-sm">{method}</span>
                  </div>
                  <span className="font-bold">{count.toLocaleString()}</span>
                </div>
              ))}
              {topMethods.length === 0 && <p className="text-muted-foreground text-sm text-center py-4">Мэдээлэл алга</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">OTAPI баланс цэнэглэх</CardTitle>
            <CardDescription>OTCommerce дансандаа баланс нэмэх</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg border bg-muted/30 space-y-2">
              <p className="text-sm">OTCommerce админ руу нэвтэрч баланс цэнэглэнэ:</p>
              <ol className="list-decimal list-inside text-sm space-y-1 text-muted-foreground">
                <li>OTCommerce Billing хуудас руу орох</li>
                <li>Дүнгээ сонгон төлбөр хийх</li>
                <li>Баланс автоматаар нэмэгдэнэ</li>
              </ol>
            </div>
            <Button className="w-full" onClick={() => window.open("https://billing.otcommerce.com", "_blank")}>
              <ExternalLink className="h-4 w-4 mr-2" /> OTCommerce Billing руу очих
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Cost optimization insights */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> Зардал бууруулах зөвлөмж
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {topMethods.length > 0 && topMethods[0][1] > paidCalls30d * 0.4 && (
              <div className="flex gap-2 items-start p-3 rounded-lg bg-amber-50 border border-amber-200">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">{topMethods[0][0]} хэт их зарцуулж байна</p>
                  <p className="text-xs text-muted-foreground">Нийт төлбөртэй дуудлагын {((topMethods[0][1] / Math.max(paidCalls30d, 1)) * 100).toFixed(0)}%-ийг эзэлж байна. Cache TTL-ийг нэмэгдүүлэх хэрэгтэй.</p>
                </div>
              </div>
            )}
            {Number(savingsPercent) < 40 && totalCalls30d > 100 && (
              <div className="flex gap-2 items-start p-3 rounded-lg bg-amber-50 border border-amber-200">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Cache hit rate бага ({savingsPercent}%)</p>
                  <p className="text-xs text-muted-foreground">40%-иас дээш байвал зохимжтой. TTL нэмэгдүүлэх, давхардсан дуудлага хасах.</p>
                </div>
              </div>
            )}
            {dailyBurnRate > 500 && (
              <div className="flex gap-2 items-start p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Өдрийн зарцуулалт өндөр ({dailyBurnRate})</p>
                  <p className="text-xs text-muted-foreground">Bot хамгаалалт, ForceUpdate хасах, кэш сайжруулах хэрэгтэй.</p>
                </div>
              </div>
            )}
            {totalCalls30d < 10 && (
              <p className="text-sm text-muted-foreground text-center py-4">Хангалттай мэдээлэл цуглаагүй байна. Логууд ирж эхэлсний дараа зөвлөмж харагдана.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
