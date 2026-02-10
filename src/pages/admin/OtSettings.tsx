import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, Globe, Shield, Settings, Users, CheckCircle2, XCircle } from "lucide-react";
import { callWithOperatorSession } from "@/services/otSession";
import { normalizeOtResponse } from "@/utils/otNormalizer";

function ErrorAlert({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 text-destructive p-3 rounded-lg bg-destructive/10">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="text-sm">{message}</span>
    </div>
  );
}

export default function OtSettings() {
  const { data: geoRaw, isLoading: geoLoading } = useQuery<any>({
    queryKey: ["admin", "ot-geolocation"],
    queryFn: async () => {
      try { return await callWithOperatorSession("getGeolocationSettings"); }
      catch (e: any) { return { success: false, error: e.message }; }
    },
    retry: false,
  });

  const { data: commonRaw, isLoading: commonLoading } = useQuery<any>({
    queryKey: ["admin", "ot-common-options"],
    queryFn: async () => {
      try { return await callWithOperatorSession("getCommonInstanceOptionsInfo"); }
      catch (e: any) { return { success: false, error: e.message }; }
    },
    retry: false,
  });

  const { data: collectionsRaw, isLoading: collectionsLoading } = useQuery<any>({
    queryKey: ["admin", "ot-collections-settings"],
    queryFn: async () => {
      try { return await callWithOperatorSession("getCollectionsSettings"); }
      catch (e: any) { return { success: false, error: e.message }; }
    },
    retry: false,
  });

  const { data: rolesRaw, isLoading: rolesLoading } = useQuery<any>({
    queryKey: ["admin", "ot-roles"],
    queryFn: async () => {
      try { return await callWithOperatorSession("getAvailableRoleList"); }
      catch (e: any) { return { success: false, error: e.message }; }
    },
    retry: false,
  });

  const geo = normalizeOtResponse<any>(geoRaw);
  const common = normalizeOtResponse<any>(commonRaw);
  const collections = normalizeOtResponse<any>(collectionsRaw);
  const roles = normalizeOtResponse<any>(rolesRaw);

  const roleList = (() => {
    const d = roles.data;
    if (Array.isArray(d)) return d;
    if (Array.isArray(d?.Content)) return d.Content;
    if (Array.isArray(d?.RoleInfoList?.Item)) return d.RoleInfoList.Item;
    return d && typeof d === "object" && !Array.isArray(d) ? [d] : [];
  })();

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">OT Тохиргоо</h1>
        <p className="text-muted-foreground mt-1">Геолокаци, нэвтрэлт, цуглуулга, эрхийн тохиргоо</p>
      </div>

      <Tabs defaultValue="geolocation">
        <TabsList className="flex-wrap">
          <TabsTrigger value="geolocation">Геолокаци</TabsTrigger>
          <TabsTrigger value="common">Ерөнхий</TabsTrigger>
          <TabsTrigger value="collections">Цуглуулга</TabsTrigger>
          <TabsTrigger value="roles">OT эрхүүд</TabsTrigger>
        </TabsList>

        <TabsContent value="geolocation" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                Геолокацийн тохиргоо
              </CardTitle>
            </CardHeader>
            <CardContent>
              {geoLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : !geo.success ? (
                <ErrorAlert message={geo.error || "Геолокацийн тохиргоо ачаалж чадсангүй"} />
              ) : (
                <RenderSettings data={geo.data} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="common" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                OT ерөнхий тохиргоо
              </CardTitle>
            </CardHeader>
            <CardContent>
              {commonLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : !common.success ? (
                <ErrorAlert message={common.error || "Тохиргоо ачаалж чадсангүй"} />
              ) : (
                <RenderSettings data={common.data} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="collections" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Цуглуулгын тохиргоо
              </CardTitle>
            </CardHeader>
            <CardContent>
              {collectionsLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : !collections.success ? (
                <ErrorAlert message={collections.error || "Тохиргоо ачаалж чадсангүй"} />
              ) : (
                <RenderSettings data={collections.data} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                OT эрхүүд (Roles)
                {roleList.length > 0 && <Badge variant="secondary">{roleList.length}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {rolesLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : !roles.success ? (
                <ErrorAlert message={roles.error || "Эрхийн жагсаалт ачаалж чадсангүй"} />
              ) : roleList.length === 0 ? (
                <p className="text-sm text-muted-foreground">Эрх олдсонгүй</p>
              ) : (
                <div className="space-y-2">
                  {roleList.map((r: any, i: number) => (
                    <div key={r.Id || i} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-primary" />
                        <span className="font-medium">{r.Name || r.DisplayName || "—"}</span>
                      </div>
                      {r.Description && (
                        <span className="text-xs text-muted-foreground">{r.Description}</span>
                      )}
                      {r.Id && <Badge variant="outline" className="text-xs">ID: {typeof r.Id === "object" ? r.Id.Value : r.Id}</Badge>}
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

function RenderSettings({ data }: { data: any }) {
  if (!data || typeof data !== "object") {
    return <p className="text-sm text-muted-foreground">Тохиргоо байхгүй</p>;
  }
  const entries = Object.entries(data).filter(([k]) => !["ErrorCode", "RequestId", "RequestTime"].includes(k));
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">Тохиргоо байхгүй</p>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {entries.map(([key, value]) => (
        <div key={key} className="space-y-1 p-3 rounded-lg border">
          <p className="text-xs text-muted-foreground">{key.replace(/([A-Z])/g, " $1").trim()}</p>
          <p className="font-medium text-sm">
            {typeof value === "boolean" ? (
              <Badge variant={value ? "default" : "secondary"}>{value ? "Идэвхтэй" : "Идэвхгүй"}</Badge>
            ) : typeof value === "object" && value !== null ? (
              <Badge variant="outline">
                {Array.isArray(value) ? `${value.length} зүйл` : `${Object.keys(value).length} тохиргоо`}
              </Badge>
            ) : (
              String(value ?? "—")
            )}
          </p>
        </div>
      ))}
    </div>
  );
}
