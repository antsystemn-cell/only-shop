import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Activity, RefreshCw, AlertTriangle, Database, BarChart3, Shield,
} from "lucide-react";
import {
  getCallStatistics,
  resetInstanceCaches,
} from "@/services/otApi";
import { callWithOperatorSession } from "@/services/otSession";

export default function SystemTools() {
  const [resetting, setResetting] = useState(false);

  const { data: statistics, isLoading: statsLoading, refetch: refetchStats } = useQuery<any>({
    queryKey: ["admin", "ot-statistics"],
    queryFn: async () => {
      try {
        return await getCallStatistics();
      } catch (e: any) {
        return { error: e.message };
      }
    },
    retry: false,
  });

  const { data: instanceInfo, isLoading: instanceLoading } = useQuery<any>({
    queryKey: ["admin", "ot-instance"],
    queryFn: async () => {
      try {
        return await callWithOperatorSession("getInstanceOptionsInfo");
      } catch (e: any) {
        return { error: e.message };
      }
    },
    retry: false,
  });

  const { data: blacklist, isLoading: blacklistLoading } = useQuery<any>({
    queryKey: ["admin", "ot-blacklist"],
    queryFn: async () => {
      try {
        return await callWithOperatorSession("getBlackListContents", { page: 0 });
      } catch (e: any) {
        return { error: e.message };
      }
    },
    retry: false,
  });

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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Системийн хэрэгслүүд</h1>
          <p className="text-muted-foreground mt-1">OT API статистик, кэш, хар жагсаалт</p>
        </div>
        <Button variant="destructive" onClick={handleResetCache} disabled={resetting}>
          <RefreshCw className={`h-4 w-4 mr-2 ${resetting ? "animate-spin" : ""}`} />
          Кэш цэвэрлэх
        </Button>
      </div>

      {/* Instance Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Инстанс мэдээлэл
          </CardTitle>
        </CardHeader>
        <CardContent>
          {instanceLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : instanceInfo?.error ? (
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">{instanceInfo.error}</span>
            </div>
          ) : (
            <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto max-h-64">
              {JSON.stringify(instanceInfo, null, 2)}
            </pre>
          )}
        </CardContent>
      </Card>

      {/* API Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            API дуудлагын статистик
          </CardTitle>
        </CardHeader>
        <CardContent>
          {statsLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : statistics?.error ? (
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">{statistics.error}</span>
            </div>
          ) : (
            <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto max-h-64">
              {JSON.stringify(statistics, null, 2)}
            </pre>
          )}
        </CardContent>
      </Card>

      {/* Blacklist */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Хар жагсаалт
          </CardTitle>
        </CardHeader>
        <CardContent>
          {blacklistLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : blacklist?.error ? (
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">{blacklist.error}</span>
            </div>
          ) : (
            <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto max-h-64">
              {JSON.stringify(blacklist, null, 2)}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
