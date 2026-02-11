import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AlertTriangle, Store, Settings2, CheckCircle2, XCircle, Package, Info } from "lucide-react";
import { callWithOperatorSession } from "@/services/otSession";
import { normalizeOtResponse } from "@/utils/otNormalizer";

interface ProviderInfo {
  Id?: string;
  Name?: string;
  DisplayName?: string;
  IsEnabled?: boolean;
  SearchMethods?: Array<{ Name?: string; Description?: string }>;
}

interface PriceFormationGroup {
  Id?: { Value?: number };
  Name?: string;
  Description?: string;
  IsDefault?: boolean;
  Provider?: string;
  Markup?: number;
  MarkupPercent?: number;
}

function ErrorAlert({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 text-destructive p-3 rounded-lg bg-destructive/10">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="text-sm">{message}</span>
    </div>
  );
}

export default function OtProviders() {
  const { data: providerRaw, isLoading: providerLoading } = useQuery<any>({
    queryKey: ["admin", "ot-providers"],
    queryFn: async () => {
      try { return await callWithOperatorSession("getProviderSettings"); }
      catch (e: any) { return { success: false, error: e.message }; }
    },
    retry: false,
  });

  const { data: providerInfoRaw, isLoading: providerInfoLoading } = useQuery<any>({
    queryKey: ["admin", "ot-provider-info-list"],
    queryFn: async () => {
      try { return await callWithOperatorSession("getProviderInfoList"); }
      catch (e: any) { return { success: false, error: e.message }; }
    },
    retry: false,
  });

  const { data: priceRaw, isLoading: priceLoading } = useQuery<any>({
    queryKey: ["admin", "ot-price-formation"],
    queryFn: async () => {
      try { return await callWithOperatorSession("getPriceFormationGroupList"); }
      catch (e: any) { return { success: false, error: e.message }; }
    },
    retry: false,
  });

  const { data: priceSettingsRaw, isLoading: priceSettingsLoading } = useQuery<any>({
    queryKey: ["admin", "ot-price-formation-settings"],
    queryFn: async () => {
      try { return await callWithOperatorSession("getPriceFormationSettings"); }
      catch (e: any) { return { success: false, error: e.message }; }
    },
    retry: false,
  });

  // Provider common settings per type
  const { data: taobaoSettingsRaw } = useQuery<any>({
    queryKey: ["admin", "ot-provider-common", "Taobao"],
    queryFn: async () => {
      try { return await callWithOperatorSession("getProviderCommonSettings", { providerType: "Taobao" }); }
      catch (e: any) { return { success: false, error: e.message }; }
    },
    retry: false,
  });

  const { data: poizonSettingsRaw } = useQuery<any>({
    queryKey: ["admin", "ot-provider-common", "Poizon"],
    queryFn: async () => {
      try { return await callWithOperatorSession("getProviderCommonSettings", { providerType: "Poizon" }); }
      catch (e: any) { return { success: false, error: e.message }; }
    },
    retry: false,
  });

  const providers = normalizeOtResponse<any>(providerRaw);
  const providerInfo = normalizeOtResponse<any>(providerInfoRaw);
  const priceGroups = normalizeOtResponse<any>(priceRaw);
  const priceSettings = normalizeOtResponse<any>(priceSettingsRaw);
  const taobaoSettings = normalizeOtResponse<any>(taobaoSettingsRaw);
  const poizonSettings = normalizeOtResponse<any>(poizonSettingsRaw);

  const providerList: ProviderInfo[] = (() => {
    const d = providers.data;
    if (Array.isArray(d)) return d;
    if (Array.isArray(d?.Content)) return d.Content;
    if (Array.isArray(d?.ProviderInfoList?.Item)) return d.ProviderInfoList.Item;
    if (Array.isArray(d?.Providers)) return d.Providers;
    return d && typeof d === "object" && !Array.isArray(d) ? [d] : [];
  })();

  const providerInfoList: any[] = (() => {
    const d = providerInfo.data;
    if (Array.isArray(d)) return d;
    if (Array.isArray(d?.Content)) return d.Content;
    if (Array.isArray(d?.ProviderInfoList?.Item)) return d.ProviderInfoList.Item;
    return [];
  })();

  const priceGroupList: PriceFormationGroup[] = (() => {
    const d = priceGroups.data;
    if (Array.isArray(d)) return d;
    if (Array.isArray(d?.Content)) return d.Content;
    if (Array.isArray(d?.PriceFormationGroupInfoList?.Item)) return d.PriceFormationGroupInfoList.Item;
    return [];
  })();

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Нийлүүлэгчийн тохиргоо</h1>
        <p className="text-muted-foreground mt-1">Нийлүүлэгч, контракт, markup, хайлтын тохиргоо</p>
      </div>

      <Tabs defaultValue="providers">
        <TabsList>
          <TabsTrigger value="providers">Нийлүүлэгчид</TabsTrigger>
          <TabsTrigger value="info">Нийлүүлэгч дэлгэрэнгүй</TabsTrigger>
          <TabsTrigger value="pricing">Үнийн бүлэг</TabsTrigger>
          <TabsTrigger value="settings">Үнийн тохиргоо</TabsTrigger>
          <TabsTrigger value="common">Тохиргоо (Provider)</TabsTrigger>
        </TabsList>

        <TabsContent value="providers" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="h-5 w-5 text-primary" />Нийлүүлэгчид
                {providerList.length > 0 && <Badge variant="secondary">{providerList.length}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {providerLoading ? <Skeleton className="h-48 w-full" /> : !providers.success ? (
                <ErrorAlert message={providers.error || "Ачаалж чадсангүй"} />
              ) : providerList.length === 0 ? (
                <p className="text-sm text-muted-foreground">Олдсонгүй</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {providerList.map((p, i) => (
                    <div key={p.Id || i} className="p-4 rounded-lg border bg-card space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Package className="h-5 w-5 text-primary" />
                          <span className="font-medium text-lg">{p.DisplayName || p.Name || p.Id || "Нийлүүлэгч"}</span>
                        </div>
                        <Badge variant={p.IsEnabled !== false ? "default" : "secondary"}>
                          {p.IsEnabled !== false ? <><CheckCircle2 className="h-3 w-3 mr-1" />Идэвхтэй</> : <><XCircle className="h-3 w-3 mr-1" />Идэвхгүй</>}
                        </Badge>
                      </div>
                      {p.Id && <p className="text-xs text-muted-foreground">ID: {p.Id}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="info" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Info className="h-5 w-5 text-primary" />GetProviderInfoList</CardTitle>
            </CardHeader>
            <CardContent>
              {providerInfoLoading ? <Skeleton className="h-48 w-full" /> : !providerInfo.success ? (
                <ErrorAlert message={providerInfo.error || "Ачаалж чадсангүй"} />
              ) : providerInfoList.length === 0 ? (
                <p className="text-sm text-muted-foreground">Олдсонгүй</p>
              ) : (
                <div className="space-y-4">
                  {providerInfoList.map((p: any, i: number) => (
                    <div key={i} className="p-4 rounded-lg border space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-lg">{p.DisplayName || p.Name || p.Type || "Provider"}</span>
                        {p.Type && <Badge variant="outline">{p.Type}</Badge>}
                        {p.IsEnabled != null && <Badge variant={p.IsEnabled ? "default" : "secondary"}>{p.IsEnabled ? "Идэвхтэй" : "Идэвхгүй"}</Badge>}
                      </div>
                      {p.Description && <p className="text-sm text-muted-foreground">{p.Description}</p>}
                      <RenderSettings data={p} excludeKeys={["DisplayName", "Name", "Type", "IsEnabled", "Description"]} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pricing" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Settings2 className="h-5 w-5 text-primary" />Үнийн бүлгүүд {priceGroupList.length > 0 && <Badge variant="secondary">{priceGroupList.length}</Badge>}</CardTitle>
            </CardHeader>
            <CardContent>
              {priceLoading ? <Skeleton className="h-48 w-full" /> : !priceGroups.success ? (
                <ErrorAlert message={priceGroups.error || "Ачаалж чадсангүй"} />
              ) : priceGroupList.length === 0 ? (
                <p className="text-sm text-muted-foreground">Олдсонгүй</p>
              ) : (
                <div className="space-y-3">
                  {priceGroupList.map((g, i) => (
                    <div key={g.Id?.Value || i} className="p-4 rounded-lg border bg-card space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{g.Name || "Нэргүй"}</span>
                          {g.IsDefault && <Badge>Үндсэн</Badge>}
                          {g.Provider && <Badge variant="outline">{g.Provider}</Badge>}
                        </div>
                        {(g.Markup || g.MarkupPercent) && (
                          <Badge variant="outline" className="text-lg px-3">{g.MarkupPercent ? `${g.MarkupPercent}%` : `+${g.Markup}`}</Badge>
                        )}
                      </div>
                      {g.Description && <p className="text-sm text-muted-foreground">{g.Description}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Settings2 className="h-5 w-5 text-primary" />Үнийн ерөнхий тохиргоо</CardTitle></CardHeader>
            <CardContent>
              {priceSettingsLoading ? <Skeleton className="h-48 w-full" /> : !priceSettings.success ? (
                <ErrorAlert message={priceSettings.error || "Ачаалж чадсангүй"} />
              ) : (
                <RenderSettings data={priceSettings.data} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="common" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle>Taobao тохиргоо</CardTitle></CardHeader>
            <CardContent>
              {taobaoSettings?.success ? <RenderSettings data={taobaoSettings.data} /> : <ErrorAlert message={taobaoSettings?.error || "Ачаалж чадсангүй"} />}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Poizon тохиргоо</CardTitle></CardHeader>
            <CardContent>
              {poizonSettings?.success ? <RenderSettings data={poizonSettings.data} /> : <ErrorAlert message={poizonSettings?.error || "Ачаалж чадсангүй"} />}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RenderSettings({ data, excludeKeys = [] }: { data: any; excludeKeys?: string[] }) {
  if (!data || typeof data !== "object") return <p className="text-sm text-muted-foreground">Тохиргоо байхгүй</p>;
  const skipKeys = ["ErrorCode", "RequestId", "RequestTime", ...excludeKeys];
  const entries = Object.entries(data).filter(([k]) => !skipKeys.includes(k));
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">Тохиргоо байхгүй</p>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {entries.map(([key, value]) => (
        <div key={key} className="space-y-1 p-2 rounded border">
          <p className="text-xs text-muted-foreground">{key.replace(/([A-Z])/g, " $1").trim()}</p>
          <p className="font-medium text-sm">
            {typeof value === "boolean" ? (
              <Badge variant={value ? "default" : "secondary"}>{value ? "Тийм" : "Үгүй"}</Badge>
            ) : typeof value === "object" && value !== null ? (
              <Badge variant="outline">{Array.isArray(value) ? `${(value as any[]).length} зүйл` : `${Object.keys(value as object).length} тохиргоо`}</Badge>
            ) : (
              String(value ?? "—")
            )}
          </p>
        </div>
      ))}
    </div>
  );
}
