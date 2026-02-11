import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertTriangle, Server, Plus, ChevronLeft, ChevronRight, RefreshCw,
} from "lucide-react";
import { getInstanceLogEntryList, addInstanceLogEntry } from "@/services/otApi";
import { normalizeOtResponse } from "@/utils/otNormalizer";
import { toast } from "sonner";

const LOG_LEVELS = ["Info", "Warning", "Error", "Debug"];

export default function InstanceLogs() {
  const [page, setPage] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [newLevel, setNewLevel] = useState("Info");
  const pageSize = 30;
  const qc = useQueryClient();

  const { data: raw, isLoading, refetch } = useQuery({
    queryKey: ["admin", "instance-logs", page],
    queryFn: () => getInstanceLogEntryList(page, pageSize),
  });

  const result = normalizeOtResponse<any>(raw);
  const entries = result.data?.Content || result.data?.LogEntryInfoList || [];
  const totalCount = result.data?.TotalCount ?? entries.length;

  const addMut = useMutation({
    mutationFn: () => addInstanceLogEntry(newMessage, newLevel),
    onSuccess: () => {
      toast.success("Лог бичлэг амжилттай нэмэгдлээ");
      setDialogOpen(false);
      setNewMessage("");
      qc.invalidateQueries({ queryKey: ["admin", "instance-logs"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const levelColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case "error": return "destructive";
      case "warning": return "secondary";
      default: return "outline";
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Инстанс логууд</h1>
          <p className="text-muted-foreground mt-1">OT инстансын системийн лог бичлэгүүд</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" /> Шинэчлэх
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> Лог нэмэх</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Шинэ лог бичлэг нэмэх</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Мессеж</label>
                  <Input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Лог мессеж..." />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Түвшин</label>
                  <Select value={newLevel} onValueChange={setNewLevel}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LOG_LEVELS.map((l) => (
                        <SelectItem key={l} value={l}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" onClick={() => addMut.mutate()} disabled={!newMessage.trim() || addMut.isPending}>
                  {addMut.isPending ? "Нэмж байна..." : "Нэмэх"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5 text-primary" />
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
              <span className="text-sm">{result.error || "Логууд ачаалж чадсангүй"}</span>
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
                      <TableHead>Түвшин</TableHead>
                      <TableHead>Мессеж</TableHead>
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
                        <TableCell>
                          <Badge variant={levelColor(entry.Level || entry.LogLevel)}>
                            {entry.Level || entry.LogLevel || "Info"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{entry.Message || entry.Description || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

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
