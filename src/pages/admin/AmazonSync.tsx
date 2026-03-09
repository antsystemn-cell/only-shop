import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, RefreshCw, Activity, AlertTriangle, CheckCircle, Clock, XCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function AmazonSync() {
  const queryClient = useQueryClient();

  const { data: syncJobs, isLoading: jobsLoading } = useQuery({
    queryKey: ["amazon-sync-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("amazon_sync_jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    refetchInterval: 5000,
  });

  const { data: apiLogs, isLoading: logsLoading } = useQuery({
    queryKey: ["amazon-api-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("amazon_api_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const retryFailed = async () => {
    try {
      const failedJobs = syncJobs?.filter((j) => j.status === "failed" && (j.retry_count || 0) < (j.max_retries || 3));
      if (!failedJobs?.length) {
        toast({ title: "Дахин оролдох ажил алга" });
        return;
      }
      for (const job of failedJobs) {
        await supabase
          .from("amazon_sync_jobs")
          .update({ status: "pending", retry_count: (job.retry_count || 0) + 1 })
          .eq("id", job.id);
      }
      toast({ title: `${failedJobs.length} ажил дахин эхлүүлэгдлээ` });
      queryClient.invalidateQueries({ queryKey: ["amazon-sync-jobs"] });
    } catch (e: any) {
      toast({ title: "Алдаа", description: e.message, variant: "destructive" });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed": return <Badge className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />Дууссан</Badge>;
      case "running": return <Badge className="bg-blue-600"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Ажиллаж байна</Badge>;
      case "failed": return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Алдаатай</Badge>;
      case "pending": return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Хүлээгдэж байна</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const failedCount = syncJobs?.filter((j) => j.status === "failed").length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Amazon синк & логууд</h1>
          <p className="text-muted-foreground">Синк ажлууд, API лог, алдааны мэдээлэл</p>
        </div>
        <Button variant="outline" onClick={retryFailed} disabled={failedCount === 0}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Алдаатай ажлуудыг дахин оролдох ({failedCount})
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Нийт ажил</p>
            <p className="text-2xl font-bold">{syncJobs?.length || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Амжилттай</p>
            <p className="text-2xl font-bold text-green-600">
              {syncJobs?.filter((j) => j.status === "completed").length || 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Алдаатай</p>
            <p className="text-2xl font-bold text-red-600">{failedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">API дуудлага</p>
            <p className="text-2xl font-bold">{apiLogs?.length || 0}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="jobs">
        <TabsList>
          <TabsTrigger value="jobs">Синк ажлууд</TabsTrigger>
          <TabsTrigger value="logs">API логууд</TabsTrigger>
        </TabsList>

        <TabsContent value="jobs">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Синк ажлууд
              </CardTitle>
            </CardHeader>
            <CardContent>
              {jobsLoading ? (
                <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Төрөл</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead>Эхэлсэн</TableHead>
                      <TableHead>Дууссан</TableHead>
                      <TableHead>Оролдлого</TableHead>
                      <TableHead>Алдаа</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {syncJobs?.map((job) => (
                      <TableRow key={job.id}>
                        <TableCell className="font-medium">{job.job_type}</TableCell>
                        <TableCell>{getStatusBadge(job.status || "pending")}</TableCell>
                        <TableCell className="text-sm">
                          {job.started_at ? new Date(job.started_at).toLocaleString("mn-MN") : "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {job.finished_at ? new Date(job.finished_at).toLocaleString("mn-MN") : "—"}
                        </TableCell>
                        <TableCell>{job.retry_count}/{job.max_retries}</TableCell>
                        <TableCell className="max-w-xs truncate text-sm text-red-600">
                          {job.error_message || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!syncJobs || syncJobs.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          Синк ажил байхгүй байна
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                API дуудлагын лог
              </CardTitle>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Үйлдэл</TableHead>
                      <TableHead>Marketplace</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead>Хариу код</TableHead>
                      <TableHead>Хугацаа (ms)</TableHead>
                      <TableHead>Алдаа</TableHead>
                      <TableHead>Огноо</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {apiLogs?.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-medium">{log.operation_name}</TableCell>
                        <TableCell>{log.marketplace_id || "—"}</TableCell>
                        <TableCell>
                          <Badge variant={log.status === "success" ? "default" : "destructive"}>
                            {log.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{log.response_code || "—"}</TableCell>
                        <TableCell>{log.duration_ms || "—"}</TableCell>
                        <TableCell className="max-w-xs truncate text-sm text-red-600">
                          {log.error_message || "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {new Date(log.created_at).toLocaleString("mn-MN")}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!apiLogs || apiLogs.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          API лог байхгүй байна
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
