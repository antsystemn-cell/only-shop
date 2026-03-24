import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Monitor, Copy, Bot } from "lucide-react";
import { subDays, startOfDay } from "date-fns";

export default function OtDiagnostics() {
  const { data: logs } = useQuery({
    queryKey: ["otapi-diagnostics"],
    queryFn: async () => {
      const from = startOfDay(subDays(new Date(), 7)).toISOString();
      const { data, error } = await supabase
        .from("otapi_logs")
        .select("*")
        .gte("created_at", from)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data || [];
    },
  });

  // Top cost pages
  const pageMap = new Map<string, { total: number; paid: number }>();
  logs?.forEach((l) => {
    const page = l.page_source || "unknown";
    const existing = pageMap.get(page) || { total: 0, paid: 0 };
    existing.total++;
    if (l.is_paid && !l.is_cache_hit) existing.paid++;
    pageMap.set(page, existing);
  });
  const topPages = Array.from(pageMap.entries())
    .map(([page, stats]) => ({ page, ...stats }))
    .sort((a, b) => b.paid - a.paid)
    .slice(0, 10);

  // Duplicate detection - same params_hash repeated within short time
  const hashCounts = new Map<string, number>();
  logs?.forEach((l) => {
    if (l.params_hash && !l.is_cache_hit) {
      hashCounts.set(l.params_hash, (hashCounts.get(l.params_hash) || 0) + 1);
    }
  });
  const duplicates = Array.from(hashCounts.entries())
    .filter(([_, count]) => count > 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // Session frequency (potential bot detection)
  const sessionCounts = new Map<string, number>();
  logs?.forEach((l) => {
    if (l.session_id) {
      sessionCounts.set(l.session_id, (sessionCounts.get(l.session_id) || 0) + 1);
    }
  });
  const suspiciousSessions = Array.from(sessionCounts.entries())
    .filter(([_, count]) => count > 50)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">OTAPI Оношлогоо</h1>
        <p className="text-sm text-muted-foreground">Давхардал, бот, зардлын цоорхой илрүүлэх (7 хоног)</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top cost pages */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Monitor className="h-4 w-4" /> Хуудас тус бүрийн зардал</CardTitle>
            <CardDescription>Аль хуудаснаас хамгийн их API дуудлага гарч байна</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topPages.map((p) => (
                <div key={p.page} className="flex items-center justify-between text-sm">
                  <span className="font-mono text-xs truncate max-w-[200px]">{p.page}</span>
                  <div className="flex gap-2">
                    <span className="text-muted-foreground">{p.total}</span>
                    <Badge variant={p.paid > 50 ? "destructive" : "secondary"} className="text-xs">{p.paid} paid</Badge>
                  </div>
                </div>
              ))}
              {topPages.length === 0 && <p className="text-center text-muted-foreground py-4 text-sm">Мэдээлэл алга</p>}
            </div>
          </CardContent>
        </Card>

        {/* Duplicate requests */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Copy className="h-4 w-4" /> Давхардсан дуудлагууд</CardTitle>
            <CardDescription>Ижил параметрээр 3-аас дээш удаа давтагдсан</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {duplicates.map(([hash, count]) => (
                <div key={hash} className="flex items-center justify-between text-sm">
                  <span className="font-mono text-xs truncate max-w-[200px]">{hash}</span>
                  <Badge variant={count > 10 ? "destructive" : "outline"} className="text-xs">{count}x</Badge>
                </div>
              ))}
              {duplicates.length === 0 && <p className="text-center text-muted-foreground py-4 text-sm">Давхардал илрээгүй ✓</p>}
            </div>
          </CardContent>
        </Card>

        {/* Suspicious sessions (bot detection) */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Bot className="h-4 w-4" /> Сэжигтэй сессионууд</CardTitle>
            <CardDescription>50-аас дээш дуудлага хийсэн сесс (бот байж болзошгүй)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {suspiciousSessions.map(([session, count]) => (
                <div key={session} className="flex items-center justify-between text-sm">
                  <span className="font-mono text-xs truncate max-w-[300px]">{session}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive" className="text-xs">{count} дуудлага</Badge>
                    <AlertTriangle className="h-3 w-3 text-amber-500" />
                  </div>
                </div>
              ))}
              {suspiciousSessions.length === 0 && <p className="text-center text-muted-foreground py-4 text-sm">Сэжигтэй трафик илрээгүй ✓</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
