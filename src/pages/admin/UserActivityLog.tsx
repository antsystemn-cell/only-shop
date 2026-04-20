import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, Search } from "lucide-react";
import { format } from "date-fns";
import { AUDIT_ACTION_LABELS, getAuditActionBadge } from "@/lib/audit/auditService";

const ENTITY_TYPES = [
  { value: "all", label: "Бүх төрөл" },
  { value: "order", label: "Захиалга" },
  { value: "product", label: "Бараа" },
  { value: "expense", label: "Зардал" },
  { value: "stock", label: "Үлдэгдэл" },
  { value: "user", label: "Хэрэглэгч" },
  { value: "settings", label: "Тохиргоо" },
];

export default function UserActivityLog() {
  const [entityType, setEntityType] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "audit-logs", entityType, actionFilter, search],
    queryFn: async () => {
      let q = supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);

      if (entityType !== "all") q = q.eq("entity_type", entityType);
      if (actionFilter !== "all") q = q.eq("action", actionFilter);
      if (search) q = q.ilike("entity_id", `%${search}%`);

      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  // Resolve user emails (best-effort)
  const userIds = Array.from(new Set((data || []).map((r: any) => r.user_id).filter(Boolean)));
  const { data: profiles } = useQuery({
    queryKey: ["admin", "audit-log-profiles", userIds],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, email, full_name")
        .in("user_id", userIds);
      return data ?? [];
    },
  });
  const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Хэрэглэгчийн үйл ажиллагааны лог</h1>
        <p className="text-muted-foreground mt-1">Админ ажилтнуудын үйлдлийн түүх</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Лог бичлэгүүд
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Entity ID хайх…"
                className="pl-9"
              />
            </div>
            <Select value={entityType} onValueChange={setEntityType}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ENTITY_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Бүх үйлдэл</SelectItem>
                {Object.entries(AUDIT_ACTION_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Огноо</TableHead>
                  <TableHead>Хэрэглэгч</TableHead>
                  <TableHead>Үйлдэл</TableHead>
                  <TableHead>Төрөл</TableHead>
                  <TableHead>Entity ID</TableHead>
                  <TableHead>Дэлгэрэнгүй</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={6}>
                        <Skeleton className="h-8 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : (data?.length ?? 0) === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Лог бичлэг алга
                    </TableCell>
                  </TableRow>
                ) : (
                  data!.map((row: any) => {
                    const badge = getAuditActionBadge(row.action);
                    const prof: any = row.user_id ? profileMap.get(row.user_id) : null;
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {format(new Date(row.created_at), "yyyy-MM-dd HH:mm:ss")}
                        </TableCell>
                        <TableCell className="text-xs">
                          {prof ? (
                            <div>
                              <div className="font-medium">{prof.full_name || prof.email}</div>
                              {prof.full_name && (
                                <div className="text-muted-foreground">{prof.email}</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Систем</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={badge.color} variant="secondary">{badge.label}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">{row.entity_type}</TableCell>
                        <TableCell className="font-mono text-[10px] max-w-[160px] truncate">
                          {row.entity_id || "—"}
                        </TableCell>
                        <TableCell>
                          {row.details && Object.keys(row.details).length > 0 ? (
                            <details className="text-xs">
                              <summary className="cursor-pointer text-muted-foreground">харах</summary>
                              <pre className="mt-1 bg-muted p-2 rounded text-[10px] max-w-[280px] overflow-auto">
{JSON.stringify(row.details, null, 2)}
                              </pre>
                            </details>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
