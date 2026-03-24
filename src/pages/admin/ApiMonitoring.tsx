import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { RefreshCw, Activity, Database, Zap, Shield, TrendingDown, BarChart3 } from "lucide-react";
import { getPerformanceStats, clearAllCache } from "@/services/apiCache";
import { getCallStatistics } from "@/services/otApi";
import { toast } from "sonner";

export default function ApiMonitoring() {
  const [refreshKey, setRefreshKey] = useState(0);

  const clientStats = getPerformanceStats();

  const { data: otapiStats, isLoading: otapiLoading, refetch: refetchOtapi } = useQuery({
    queryKey: ["admin", "otapi-call-stats", refreshKey],
    queryFn: async () => {
      try {
        return await getCallStatistics();
      } catch {
        return null;
      }
    },
    staleTime: 1000 * 60 * 5,
  });

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1);
    refetchOtapi();
  };

  const handleClearCache = () => {
    clearAllCache();
    toast.success("Клиент кэш цэвэрлэгдлээ");
    setRefreshKey((k) => k + 1);
  };

  const hitRateNum = parseInt(clientStats.cacheHitRate) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">OTAPI хяналт</h2>
          <p className="text-muted-foreground text-sm">API дуудлагын статистик, кэш, гүйцэтгэл</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleClearCache}>
            <Database className="h-4 w-4 mr-1" /> Кэш цэвэрлэх
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-1" /> Шинэчлэх
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
              <Activity className="h-4 w-4" /> Нийт хүсэлт
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clientStats.totalRequests}</div>
            <p className="text-xs text-muted-foreground">Энэ сешн дотор</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
              <Zap className="h-4 w-4" /> Кэш хит
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{clientStats.cacheHits}</div>
            <Progress value={hitRateNum} className="h-2 mt-1" />
            <p className="text-xs text-muted-foreground mt-1">{clientStats.cacheHitRate} хит рейт</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
              <TrendingDown className="h-4 w-4" /> Хэмнэсэн
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{clientStats.savedApiCalls}</div>
            <p className="text-xs text-muted-foreground">API дуудлага хэмнэгдсэн</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
              <Shield className="h-4 w-4" /> Кэш хэмжээ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clientStats.cacheSize}</div>
            <p className="text-xs text-muted-foreground">
              {clientStats.inflightSize} дуудлага явж байна • {clientStats.queuedRequests} хүлээгдэж байна
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Method Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" /> Метод тус бүрийн статистик
          </CardTitle>
        </CardHeader>
        <CardContent>
          {clientStats.topMethods.length === 0 ? (
            <p className="text-sm text-muted-foreground">Одоогоор дуудлага алга</p>
          ) : (
            <div className="space-y-3">
              {clientStats.topMethods.map((m) => (
                <div key={m.method} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <code className="text-xs bg-muted px-2 py-0.5 rounded">{m.method}</code>
                    <Badge variant={m.hitRate > 50 ? "default" : m.hitRate > 0 ? "secondary" : "destructive"}>
                      {m.hitRate}% хит
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium">{m.totalCalls}</span> дуудлага •{" "}
                    <span className="text-green-600 font-medium">{m.cacheHits}</span> кэшлэгдсэн
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Slow Requests */}
      {clientStats.slowRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-destructive">Удаан хүсэлтүүд (&gt;1.5s)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {clientStats.slowRequests.map((r, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <code className="text-xs bg-muted px-2 py-0.5 rounded truncate max-w-[300px]">{r.key}</code>
                  <Badge variant="destructive">{r.duration}ms</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* OTAPI Server Stats */}
      <Card>
        <CardHeader>
          <CardTitle>OTAPI серверийн статистик</CardTitle>
        </CardHeader>
        <CardContent>
          {otapiLoading ? (
            <p className="text-sm text-muted-foreground">Уншиж байна...</p>
          ) : otapiStats ? (
            <pre className="text-xs bg-muted p-4 rounded overflow-auto max-h-60">
              {JSON.stringify(otapiStats, null, 2)}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">Статистик авах боломжгүй</p>
          )}
        </CardContent>
      </Card>

      {/* Recent requests log */}
      <Card>
        <CardHeader>
          <CardTitle>Сүүлийн хүсэлтүүд</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-64 overflow-auto space-y-1">
            {clientStats.recentRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">Хүсэлт алга</p>
            ) : (
              clientStats.recentRequests.map((r, i) => (
                <div key={i} className="flex items-center justify-between text-xs py-1 border-b last:border-0">
                  <code className="truncate max-w-[300px] text-muted-foreground">{r.key}</code>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={r.cacheHit ? "default" : "outline"} className="text-[10px]">
                      {r.cacheHit ? "HIT" : "MISS"}
                    </Badge>
                    <span className={r.duration > 1000 ? "text-destructive" : "text-muted-foreground"}>
                      {r.duration}ms
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
