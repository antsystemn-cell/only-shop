import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Search, Users, ChevronLeft, ChevronRight } from "lucide-react";
import { searchInstanceUserLogEntries } from "@/services/otApi";
import { normalizeOtResponse } from "@/utils/otNormalizer";

const ACTION_TYPES = [
  { value: "", label: "Бүгд" },
  { value: "Login", label: "Нэвтрэлт" },
  { value: "Registration", label: "Бүртгэл" },
  { value: "OrderCreation", label: "Захиалга үүсгэх" },
  { value: "PasswordChange", label: "Нууц үг солих" },
  { value: "ProfileUpdate", label: "Профайл шинэчлэх" },
];

export default function UserActivityLog() {
  const [userId, setUserId] = useState("");
  const [actionType, setActionType] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const { data: raw, isLoading } = useQuery({
    queryKey: ["admin", "user-log", userId, actionType, page],
    queryFn: () => searchInstanceUserLogEntries({ userId: userId || undefined, actionType: actionType || undefined, page, pageSize }),
  });

  const result = normalizeOtResponse<any>(raw);
  const entries = result.data?.Content || result.data?.LogEntryInfoList || [];
  const totalCount = result.data?.TotalCount ?? entries.length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Хэрэглэгчийн үйл ажиллагааны лог</h1>
        <p className="text-muted-foreground mt-1">OT системд бүртгэгдсэн хэрэглэгчийн үйлдлүүд</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="User ID-аар шүүх..."
                value={userId}
                onChange={(e) => { setUserId(e.target.value); setPage(0); }}
                className="w-full"
              />
            </div>
            <Select value={actionType} onValueChange={(v) => { setActionType(v); setPage(0); }}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Үйлдлийн төрөл" />
              </SelectTrigger>
              <SelectContent>
                {ACTION_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Лог бичлэгүүд
            {totalCount > 0 && <Badge variant="secondary">{totalCount}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : !result.success ? (
            <div className="flex items-center gap-2 text-destructive p-3 rounded-lg bg-destructive/10">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">{result.error || "Лог ачаалж чадсангүй"}</span>
            </div>
          ) : entries.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Лог бичлэг олдсонгүй</p>
          ) : (
            <>
              <div className="rounded-md border overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Огноо</TableHead>
                      <TableHead>Хэрэглэгч</TableHead>
                      <TableHead>Үйлдэл</TableHead>
                      <TableHead>IP хаяг</TableHead>
                      <TableHead>Дэлгэрэнгүй</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry: any, i: number) => (
                      <TableRow key={entry.Id || i}>
                        <TableCell className="text-sm whitespace-nowrap">
                          {entry.Date || entry.CreatedDate
                            ? new Date(entry.Date || entry.CreatedDate).toLocaleString("mn-MN")
                            : "—"}
                        </TableCell>
                        <TableCell className="text-sm font-mono">
                          {entry.UserId || entry.UserLogin || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{entry.ActionType || entry.Type || "—"}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{entry.IpAddress || "—"}</TableCell>
                        <TableCell className="text-sm max-w-[300px] truncate">
                          {entry.Description || entry.Message || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <span className="text-sm text-muted-foreground">
                  Хуудас {page + 1} / {Math.max(1, Math.ceil(totalCount / pageSize))}
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" disabled={entries.length < pageSize} onClick={() => setPage(p => p + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
