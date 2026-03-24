import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, TrendingUp, AlertTriangle, Activity, DollarSign, RefreshCw } from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

const COLORS = ["hsl(var(--primary))", "hsl(var(--destructive))", "hsl(var(--accent))", "#f59e0b", "#8b5cf6", "#06b6d4"];

export default function OtReports() {
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 7), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));

  // Fetch logs summary
  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ["otapi-logs", dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("otapi_logs")
        .select("*")
        .gte("created_at", startOfDay(new Date(dateFrom)).toISOString())
        .lte("created_at", endOfDay(new Date(dateTo)).toISOString())
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data || [];
    },
  });

  // Compute aggregated stats
  const totalCalls = logs?.length || 0;
  const paidCalls = logs?.filter((l) => l.is_paid && !l.is_cache_hit).length || 0;
  const cacheHits = logs?.filter((l) => l.is_cache_hit).length || 0;
  const errorCalls = logs?.filter((l) => l.error_code && l.error_code !== "Ok" && l.error_code !== "BatchError").length || 0;
  const cacheHitRate = totalCalls > 0 ? ((cacheHits / totalCalls) * 100).toFixed(1) : "0";
  const avgResponseTime = logs && logs.length > 0
    ? Math.round(logs.reduce((s, l) => s + (l.response_time_ms || 0), 0) / logs.length)
    : 0;

  // Method breakdown
  const methodMap = new Map<string, { total: number; paid: number; errors: number; cached: number; avgMs: number }>();
  logs?.forEach((l) => {
    const m = l.method || "unknown";
    const existing = methodMap.get(m) || { total: 0, paid: 0, errors: 0, cached: 0, avgMs: 0 };
    existing.total++;
    if (l.is_paid && !l.is_cache_hit) existing.paid++;
    if (l.is_cache_hit) existing.cached++;
    if (l.error_code && l.error_code !== "Ok" && l.error_code !== "BatchError") existing.errors++;
    existing.avgMs = Math.round((existing.avgMs * (existing.total - 1) + (l.response_time_ms || 0)) / existing.total);
    methodMap.set(m, existing);
  });
  const methodBreakdown = Array.from(methodMap.entries())
    .map(([method, stats]) => ({ method, ...stats }))
    .sort((a, b) => b.paid - a.paid);

  // Daily breakdown
  const dailyMap = new Map<string, { date: string; total: number; paid: number; errors: number; cached: number }>();
  logs?.forEach((l) => {
    const day = format(new Date(l.created_at), "yyyy-MM-dd");
    const existing = dailyMap.get(day) || { date: day, total: 0, paid: 0, errors: 0, cached: 0 };
    existing.total++;
    if (l.is_paid && !l.is_cache_hit) existing.paid++;
    if (l.is_cache_hit) existing.cached++;
    if (l.error_code && l.error_code !== "Ok" && l.error_code !== "BatchError") existing.errors++;
    dailyMap.set(day, existing);
  });
  const dailyData = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  // Top cost methods for pie chart
  const pieData = methodBreakdown.slice(0, 6).map((m) => ({ name: m.method, value: m.paid }));

  // Cost insights
  const insights: Array<{ type: "warning" | "info"; message: string }> = [];
  if (methodBreakdown.length > 0) {
    const topMethod = methodBreakdown[0];
    if (topMethod.paid > totalCalls * 0.4) {
      insights.push({ type: "warning", message: `⚠️ ${topMethod.method} хэрэглээний ${((topMethod.paid / Math.max(paidCalls, 1)) * 100).toFixed(0)}%-ийг эзэлж байна` });
    }
  }
  if (Number(cacheHitRate) < 30 && totalCalls > 50) {
    insights.push({ type: "warning", message: "⚠️ Cache hit rate маш бага (<30%). Кэш тохиргоог шалгана уу." });
  }
  if (errorCalls > totalCalls * 0.1 && totalCalls > 20) {
    insights.push({ type: "warning", message: `⚠️ Алдааны хувь ${((errorCalls / totalCalls) * 100).toFixed(1)}% - хэт их алдаа байна` });
  }

  const chartConfig = {
    total: { label: "Нийт", color: "hsl(var(--primary))" },
    paid: { label: "Төлбөртэй", color: "hsl(var(--destructive))" },
    cached: { label: "Кэш", color: "hsl(var(--accent))" },
    errors: { label: "Алдаа", color: "#f59e0b" },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">OTAPI Тайлан & Аналитик</h1>
          <p className="text-sm text-muted-foreground">API дуудлага, кэш, зардлын мониторинг</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" /> Шинэчлэх
        </Button>
      </div>

      {/* Date filter */}
      <div className="flex gap-3 items-center">
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-44" />
        <span className="text-muted-foreground">→</span>
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-44" />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-muted-foreground">Нийт дуудлага</div>
            <div className="text-2xl font-bold">{totalCalls.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-muted-foreground">Төлбөртэй</div>
            <div className="text-2xl font-bold text-destructive">{paidCalls.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-muted-foreground">Кэшээс</div>
            <div className="text-2xl font-bold text-green-600">{cacheHits.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-muted-foreground">Cache Hit %</div>
            <div className="text-2xl font-bold">{cacheHitRate}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-muted-foreground">Алдаа</div>
            <div className="text-2xl font-bold text-amber-600">{errorCalls}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-muted-foreground">Дундаж хугацаа</div>
            <div className="text-2xl font-bold">{avgResponseTime}ms</div>
          </CardContent>
        </Card>
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-600" /> Зөвлөмж</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {insights.map((i, idx) => (
              <p key={idx} className="text-sm">{i.message}</p>
            ))}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="methods">
        <TabsList>
          <TabsTrigger value="methods">Метод</TabsTrigger>
          <TabsTrigger value="daily">Өдөр тутам</TabsTrigger>
          <TabsTrigger value="charts">График</TabsTrigger>
        </TabsList>

        {/* Methods tab */}
        <TabsContent value="methods" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Метод тус бүрийн дуудлага</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-muted-foreground text-sm">Ачаалж байна...</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="py-2 pr-4">Метод</th>
                        <th className="py-2 pr-4 text-right">Нийт</th>
                        <th className="py-2 pr-4 text-right">Төлбөртэй</th>
                        <th className="py-2 pr-4 text-right">Кэш</th>
                        <th className="py-2 pr-4 text-right">Алдаа</th>
                        <th className="py-2 text-right">Дундаж (ms)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {methodBreakdown.map((m) => (
                        <tr key={m.method} className="border-b hover:bg-muted/50">
                          <td className="py-2 pr-4 font-mono text-xs">{m.method}</td>
                          <td className="py-2 pr-4 text-right">{m.total}</td>
                          <td className="py-2 pr-4 text-right">
                            <Badge variant={m.paid > paidCalls * 0.3 ? "destructive" : "secondary"}>
                              {m.paid}
                            </Badge>
                          </td>
                          <td className="py-2 pr-4 text-right text-green-600">{m.cached}</td>
                          <td className="py-2 pr-4 text-right text-amber-600">{m.errors}</td>
                          <td className="py-2 text-right">{m.avgMs}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {methodBreakdown.length === 0 && <p className="text-center text-muted-foreground py-8">Мэдээлэл алга</p>}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Daily tab */}
        <TabsContent value="daily" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Өдөр тутмын хэрэглээ</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="py-2 pr-4">Огноо</th>
                      <th className="py-2 pr-4 text-right">Нийт</th>
                      <th className="py-2 pr-4 text-right">Төлбөртэй</th>
                      <th className="py-2 pr-4 text-right">Кэш</th>
                      <th className="py-2 text-right">Алдаа</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyData.map((d) => (
                      <tr key={d.date} className="border-b hover:bg-muted/50">
                        <td className="py-2 pr-4">{d.date}</td>
                        <td className="py-2 pr-4 text-right font-medium">{d.total}</td>
                        <td className="py-2 pr-4 text-right text-destructive">{d.paid}</td>
                        <td className="py-2 pr-4 text-right text-green-600">{d.cached}</td>
                        <td className="py-2 text-right text-amber-600">{d.errors}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {dailyData.length === 0 && <p className="text-center text-muted-foreground py-8">Мэдээлэл алга</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Charts tab */}
        <TabsContent value="charts" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Daily usage chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Өдрийн дуудлага</CardTitle>
              </CardHeader>
              <CardContent>
                {dailyData.length > 0 ? (
                  <ChartContainer config={chartConfig} className="h-64">
                    <LineChart data={dailyData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line type="monotone" dataKey="total" stroke="var(--color-total)" strokeWidth={2} />
                      <Line type="monotone" dataKey="paid" stroke="var(--color-paid)" strokeWidth={2} />
                      <Line type="monotone" dataKey="cached" stroke="var(--color-cached)" strokeWidth={2} />
                    </LineChart>
                  </ChartContainer>
                ) : <p className="text-center text-muted-foreground py-12">Мэдээлэл алга</p>}
              </CardContent>
            </Card>

            {/* Method pie chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Зардлын бүтэц (Top 6)</CardTitle>
              </CardHeader>
              <CardContent>
                {pieData.length > 0 ? (
                  <ChartContainer config={chartConfig} className="h-64">
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                        {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <ChartTooltip />
                    </PieChart>
                  </ChartContainer>
                ) : <p className="text-center text-muted-foreground py-12">Мэдээлэл алга</p>}
              </CardContent>
            </Card>

            {/* Method bar chart */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4" /> Метод тус бүрийн дуудлага (Top 10)</CardTitle>
              </CardHeader>
              <CardContent>
                {methodBreakdown.length > 0 ? (
                  <ChartContainer config={chartConfig} className="h-72">
                    <BarChart data={methodBreakdown.slice(0, 10)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="method" type="category" width={180} tick={{ fontSize: 10 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="paid" fill="var(--color-paid)" name="Төлбөртэй" />
                      <Bar dataKey="cached" fill="var(--color-cached)" name="Кэш" />
                      <Bar dataKey="errors" fill="var(--color-errors)" name="Алдаа" />
                    </BarChart>
                  </ChartContainer>
                ) : <p className="text-center text-muted-foreground py-12">Мэдээлэл алга</p>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
