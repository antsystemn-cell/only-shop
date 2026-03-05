import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  RefreshCw, AlertTriangle, Database, BarChart3, Shield,
  Globe, Server, CreditCard, Languages, Zap, CheckCircle2, XCircle,
  Lock, Users, FileText,
} from "lucide-react";
import {
  getCallStatistics,
  resetInstanceCaches,
  getMethodNamesForStatistics,
} from "@/services/otApi";
import { getPerformanceStats, clearAllCache } from "@/services/apiCache";
import { callWithOperatorSession } from "@/services/otSession";
import {
  normalizeOtResponse,
  type OtInstanceInfo,
  type OtCallStatistics,
} from "@/utils/otNormalizer";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

function formatNumber(n?: number) {
  if (n === undefined || n === null) return "—";
  return n.toLocaleString();
}

function formatDate(d?: string) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("mn-MN", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return d;
  }
}

function StatItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center p-3 rounded-lg bg-muted/50">
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

function ErrorAlert({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 text-destructive p-3 rounded-lg bg-destructive/10">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="text-sm">{message}</span>
    </div>
  );
}

function GatewayPerformancePanel() {
  const [stats, setStats] = useState(() => getPerformanceStats());

  const refreshStats = () => setStats(getPerformanceStats());

  const handleClearCache = () => {
    clearAllCache();
    setStats(getPerformanceStats());
    toast.success("Gateway кэш цэвэрлэгдлээ");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={refreshStats}>
          <RefreshCw className="h-3 w-3 mr-1" /> Шинэчлэх
        </Button>
        <Button size="sm" variant="destructive" onClick={handleClearCache}>
          Кэш цэвэрлэх
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatItem label="Нийт хүсэлт" value={stats.totalRequests} />
        <StatItem label="Кэш hit rate" value={stats.cacheHitRate} />
        <StatItem label="Дундаж хурд" value={stats.avgResponseTime} />
        <StatItem label="Кэш хэмжээ" value={stats.cacheSize} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatItem label="Идэвхтэй хүсэлт" value={stats.activeRequests} />
        <StatItem label="Дараалалд" value={stats.queuedRequests} />
        <StatItem label="Inflight" value={stats.inflightSize} />
        <StatItem label="Кэш hits" value={stats.cacheHits} />
      </div>

      {stats.slowRequests.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" /> Удаан хүсэлтүүд (&gt;1.5с)</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1 max-h-60 overflow-y-auto text-xs">
              {stats.slowRequests.map((r, i) => (
                <div key={i} className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="truncate max-w-[70%] font-mono">{r.key}</span>
                  <Badge variant="destructive" className="text-[10px]">{r.duration}ms</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {stats.recentRequests.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" /> Сүүлийн 20 хүсэлт</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1 max-h-80 overflow-y-auto text-xs">
              {[...stats.recentRequests].reverse().map((r, i) => (
                <div key={i} className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="truncate max-w-[55%] font-mono">{r.key}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant={r.cacheHit ? "secondary" : "outline"} className="text-[10px]">
                      {r.cacheHit ? "HIT" : "MISS"}
                    </Badge>
                    <span className={`font-mono ${r.duration > 1500 ? "text-destructive" : r.duration > 500 ? "text-yellow-600" : "text-green-600"}`}>
                      {r.duration}ms
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function SystemTools() {
  const [resetting, setResetting] = useState(false);

  const { data: statsRaw, isLoading: statsLoading, refetch: refetchStats } = useQuery<any>({
    queryKey: ["admin", "ot-statistics"],
    queryFn: async () => {
      try { return await getCallStatistics(); } catch (e: any) { return { success: false, error: e.message }; }
    },
    retry: false,
  });

  const { data: instanceRaw, isLoading: instanceLoading } = useQuery<any>({
    queryKey: ["admin", "ot-instance"],
    queryFn: async () => {
      try { return await callWithOperatorSession("getInstanceOptionsInfo"); } catch (e: any) { return { success: false, error: e.message }; }
    },
    retry: false,
  });

  const { data: blacklistRaw, isLoading: blacklistLoading } = useQuery<any>({
    queryKey: ["admin", "ot-blacklist"],
    queryFn: async () => {
      try { return await callWithOperatorSession("getBlackListContents", { page: 0 }); } catch (e: any) { return { success: false, error: e.message }; }
    },
    retry: false,
  });

  const { data: methodNamesRaw } = useQuery<any>({
    queryKey: ["admin", "ot-method-names"],
    queryFn: async () => {
      try { return await getMethodNamesForStatistics(); } catch (e: any) { return { success: false, error: e.message }; }
    },
    retry: false,
  });

  const stats = normalizeOtResponse<OtCallStatistics>(statsRaw);
  const instance = normalizeOtResponse<OtInstanceInfo>(instanceRaw);
  const blacklist = normalizeOtResponse<any[]>(blacklistRaw);
  const methodNames = normalizeOtResponse<any>(methodNamesRaw);

  const handleResetCache = async () => {
    setResetting(true);
    try {
      await resetInstanceCaches();
      toast.success("Кэш амжилттай цэвэрлэгдлээ");
      refetchStats();
    } catch (e: any) {
      toast.error("Алдаа: " + e.message);
    } finally {
      setResetting(false);
    }
  };

  const info = instance.data;
  const st = stats.data;

  // Build chart data from method statistics if available
  const methodStats = st?.OtapiAllCallStatistics?.CallStatisticsByMethodList || [];
  const chartData = methodStats
    .filter((m: any) => m.TotalCount > 0)
    .sort((a: any, b: any) => b.TotalCount - a.TotalCount)
    .slice(0, 15)
    .map((m: any) => ({
      name: m.MethodName?.replace(/^(Get|Search|Batch)/, "") || "Unknown",
      total: m.TotalCount || 0,
      daily: m.StatisticsByTimePeriod?.DailyCallCount || 0,
    }));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Системийн хэрэгслүүд</h1>
          <p className="text-muted-foreground mt-1">OT API статистик, тохиргоо, кэш, мониторинг</p>
        </div>
        <Button variant="destructive" onClick={handleResetCache} disabled={resetting}>
          <RefreshCw className={`h-4 w-4 mr-2 ${resetting ? "animate-spin" : ""}`} />
          Кэш цэвэрлэх
        </Button>
      </div>

      <Tabs defaultValue="gateway">
        <TabsList>
          <TabsTrigger value="gateway">Gateway</TabsTrigger>
          <TabsTrigger value="overview">Ерөнхий</TabsTrigger>
          <TabsTrigger value="statistics">Статистик</TabsTrigger>
          <TabsTrigger value="security">Аюулгүй байдал</TabsTrigger>
        </TabsList>

        {/* ── Gateway Performance Tab ── */}
        <TabsContent value="gateway" className="space-y-6">
          <GatewayPerformancePanel />
        </TabsContent>

        {/* ── Overview Tab ── */}
        <TabsContent value="overview" className="space-y-6">
          {/* Instance Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" /> Ерөнхий мэдээлэл
              </CardTitle>
            </CardHeader>
            <CardContent>
              {instanceLoading ? <Skeleton className="h-24 w-full" /> : !instance.success ? (
                <ErrorAlert message={instance.error || "Мэдээлэл ачаалж чадсангүй"} />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-1"><p className="text-xs text-muted-foreground">Вэб сайт</p><p className="font-medium">{info?.WebSite || "—"}</p></div>
                  <div className="space-y-1"><p className="text-xs text-muted-foreground">Үндсэн нийлүүлэгч</p><p className="font-medium">{info?.DefaultItemProvider || "—"}</p></div>
                  <div className="space-y-1"><p className="text-xs text-muted-foreground">Админ хэл</p><p className="font-medium">{info?.AdminPanelLanguage?.toUpperCase() || "—"}</p></div>
                  <div className="space-y-1"><p className="text-xs text-muted-foreground">Имэйл баталгаажуулалт</p>
                    <Badge variant={info?.IsEmailConfirmationUsed ? "default" : "secondary"}>{info?.IsEmailConfirmationUsed ? "Идэвхтэй" : "Идэвхгүй"}</Badge>
                  </div>
                  <div className="space-y-1"><p className="text-xs text-muted-foreground">IP шалгалт</p>
                    <Badge variant={info?.IsIPCheckUsed ? "default" : "secondary"}>{info?.IsIPCheckUsed ? "Идэвхтэй" : "Идэвхгүй"}</Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Hosting & Tariff */}
          {instance.success && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Server className="h-4 w-4 text-primary" /> Хостинг</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Нэр</span><span className="text-sm font-medium">{info?.Hosting?.Name || "—"}</span></div>
                  <div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">SSL</span>
                    <Badge variant={info?.Hosting?.FreeSslEnabled ? "default" : "destructive"}>{info?.Hosting?.FreeSslEnabled ? <><Lock className="h-3 w-3 mr-1" /> Идэвхтэй</> : "Идэвхгүй"}</Badge>
                  </div>
                  <div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Идэвхжсэн</span><span className="text-sm">{formatDate(info?.Hosting?.ActivationDate)}</span></div>
                  <div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Дуусах</span><span className="text-sm">{formatDate(info?.Hosting?.ExpirationDate)}</span></div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CreditCard className="h-4 w-4 text-primary" /> Тариф & Данс</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Тариф</span><span className="text-sm font-medium">{info?.Tariff?.Name || "—"}</span></div>
                  <div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Дуудлагын үнэ</span><span className="text-sm">${info?.Tariff?.CallPrice ?? "—"}</span></div>
                  <div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Сарын доод</span><span className="text-sm">${info?.Tariff?.MinimumRent ?? "—"}</span></div>
                  <div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Баланс</span><span className="text-sm font-bold">${info?.Account?.Balance ?? 0}</span></div>
                  <div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Өр</span><span className="text-sm">${info?.Account?.Debt ?? 0}</span></div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Features */}
          {instance.success && info?.Features && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5 text-primary" /> Идэвхтэй модулиуд <Badge variant="secondary" className="ml-2">{info.Features.length}</Badge></CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {info.Features.map((f) => (
                    <div key={f.Name} className="flex items-start gap-2 p-3 rounded-lg border bg-card">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                      <div><p className="text-sm font-medium">{f.Name}</p><p className="text-xs text-muted-foreground">{f.Description}</p></div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Languages */}
          {instance.success && info?.AvailableLanguages && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Languages className="h-5 w-5 text-primary" /> Хэлүүд</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {info.AvailableLanguages.map((lang) => (
                    <Badge key={lang.Name} variant="outline" className="px-3 py-1">{lang.Name.toUpperCase()} — {lang.Description}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Statistics Tab ── */}
        <TabsContent value="statistics" className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" /> API дуудлагын статистик</CardTitle></CardHeader>
            <CardContent>
              {statsLoading ? <Skeleton className="h-24 w-full" /> : !stats.success ? (
                <ErrorAlert message={stats.error || "Статистик ачаалж чадсангүй"} />
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <StatItem label="Нийт дуудлага" value={formatNumber(st?.OtapiAllCallStatistics?.TotalCount)} />
                    <StatItem label="Өнөөдөр" value={formatNumber(st?.OtapiAllCallStatistics?.StatisticsByTimePeriod?.DailyCallCount)} />
                    <StatItem label="Энэ 7 хоног" value={formatNumber(st?.OtapiAllCallStatistics?.StatisticsByTimePeriod?.WeeklyCallCount)} />
                    <StatItem label="Энэ сар" value={formatNumber(st?.OtapiAllCallStatistics?.StatisticsByTimePeriod?.MonthlyCallCount)} />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <StatItem label="Инстанс дуудлага (нийт)" value={formatNumber(st?.OtapiCallStatistics?.TotalCount)} />
                    <StatItem label="Идэвхтэй инстанс" value={formatNumber(st?.ActiveInstances)} />
                    <StatItem label="Тест инстанс" value={formatNumber(st?.ActiveTestInstances)} />
                  </div>

                  {/* Method breakdown chart */}
                  {chartData.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold mb-3">Топ 15 арга (нийт дуудлага)</h3>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData} layout="vertical" margin={{ left: 100 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" />
                            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                            <Tooltip />
                            <Bar dataKey="total" fill="hsl(var(--primary))" name="Нийт" radius={[0, 4, 4, 0]} />
                            <Bar dataKey="daily" fill="hsl(var(--primary) / 0.4)" name="Өнөөдөр" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* Available method names */}
                  {methodNames.success && Array.isArray(methodNames.data) && (
                    <div>
                      <h3 className="text-sm font-semibold mb-2">Бүртгэлтэй API аргууд ({methodNames.data.length})</h3>
                      <div className="flex flex-wrap gap-1">
                        {methodNames.data.map((m: string) => (
                          <Badge key={m} variant="outline" className="text-xs">{m}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Security Tab ── */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-primary" /> Хар жагсаалт</CardTitle></CardHeader>
            <CardContent>
              {blacklistLoading ? <Skeleton className="h-16 w-full" /> : !blacklist.success ? (
                <ErrorAlert message={blacklist.error || "Хар жагсаалт ачаалж чадсангүй"} />
              ) : Array.isArray(blacklist.data) && blacklist.data.length === 0 ? (
                <div className="flex items-center gap-2 text-muted-foreground py-4">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Хар жагсаалт хоосон байна</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {(blacklist.data as any[])?.map((item: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded border bg-muted/30">
                      <XCircle className="h-4 w-4 text-destructive shrink-0" />
                      <span className="text-sm">{item.Id || item.Name || JSON.stringify(item)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}