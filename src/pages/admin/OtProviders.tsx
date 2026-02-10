import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AlertTriangle, Store, Settings2, CheckCircle2, XCircle, Package } from "lucide-react";
import { callWithOperatorSession } from "@/services/otSession";
import { normalizeOtResponse } from "@/utils/otNormalizer";

interface ProviderInfo {
  Id?: string;
  Name?: string;
  DisplayName?: string;
  IsEnabled?: boolean;
  SearchMethods?: Array<{ Name?: string; Description?: string }>;
  Settings?: Record<string, unknown>;
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

  const providers = normalizeOtResponse<any>(providerRaw);
  const priceGroups = normalizeOtResponse<any>(priceRaw);
  const priceSettings = normalizeOtResponse<any>(priceSettingsRaw);

  const providerList: ProviderInfo[] = (() => {
    const d = providers.data;
    if (Array.isArray(d)) return d;
    if (d?.Content) return d.Content;
    if (d?.ProviderInfoList?.Item) return d.ProviderInfoList.Item;
    if (d?.Providers) return d.Providers;
    return d ? [d] : [];
  })();

  const priceGroupList: PriceFormationGroup[] = (() => {
    const d = priceGroups.data;
    if (Array.isArray(d)) return d;
    if (d?.Content) return d.Content;
    if (d?.PriceFormationGroupInfoList?.Item) return d.PriceFormationGroupInfoList.Item;
    return [];
  })();

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Нийлүүлэгчийн тохиргоо</h1>
        <p className="text-muted-foreground mt-1">Taobao, Poizon нийлүүлэгчийн тохиргоо, үнийн бүлэг</p>
      </div>

      <Tabs defaultValue="providers">
        <TabsList>
          <TabsTrigger value="providers">Нийлүүлэгчид</TabsTrigger>
          <TabsTrigger value="pricing">Үнийн бүлэг</TabsTrigger>
          <TabsTrigger value="settings">Үнийн тохиргоо</TabsTrigger>
        </TabsList>

        <TabsContent value="providers" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="h-5 w-5 text-primary" />
                Нийлүүлэгчид
                {providerList.length > 0 && <Badge variant="secondary">{providerList.length}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {providerLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : !providers.success ? (
                <ErrorAlert message={providers.error || "Нийлүүлэгчийн мэдээлэл ачаалж чадсангүй"} />
              ) : providerList.length === 0 ? (
                <p className="text-sm text-muted-foreground">Нийлүүлэгч олдсонгүй</p>
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
                          {p.IsEnabled !== false ? (
                            <><CheckCircle2 className="h-3 w-3 mr-1" /> Идэвхтэй</>
                          ) : (
                            <><XCircle className="h-3 w-3 mr-1" /> Идэвхгүй</>
                          )}
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

        <TabsContent value="pricing" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-primary" />
                Үнийн бүлгүүд (Price Formation)
                {priceGroupList.length > 0 && <Badge variant="secondary">{priceGroupList.length}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {priceLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : !priceGroups.success ? (
                <ErrorAlert message={priceGroups.error || "Үнийн бүлэг ачаалж чадсангүй"} />
              ) : priceGroupList.length === 0 ? (
                <p className="text-sm text-muted-foreground">Үнийн бүлэг олдсонгүй</p>
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
                          <Badge variant="outline" className="text-lg px-3">
                            {g.MarkupPercent ? `${g.MarkupPercent}%` : `+${g.Markup}`}
                          </Badge>
                        )}
                      </div>
                      {g.Description && <p className="text-sm text-muted-foreground">{g.Description}</p>}
                      {g.Id?.Value && <p className="text-xs text-muted-foreground">ID: {g.Id.Value}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-primary" />
                Үнийн ерөнхий тохиргоо
              </CardTitle>
            </CardHeader>
            <CardContent>
              {priceSettingsLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : !priceSettings.success ? (
                <ErrorAlert message={priceSettings.error || "Тохиргоо ачаалж чадсангүй"} />
              ) : (
                <RenderSettings data={priceSettings.data} />
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {entries.map(([key, value]) => (
        <div key={key} className="space-y-1">
          <p className="text-xs text-muted-foreground">{key.replace(/([A-Z])/g, " $1").trim()}</p>
          <p className="font-medium text-sm">
            {typeof value === "boolean" ? (
              <Badge variant={value ? "default" : "secondary"}>{value ? "Идэвхтэй" : "Идэвхгүй"}</Badge>
            ) : typeof value === "object" ? (
              JSON.stringify(value) === "{}" ? "—" : <Badge variant="outline">{Object.keys(value as object).length} тохиргоо</Badge>
            ) : (
              String(value || "—")
            )}
          </p>
        </div>
      ))}
    </div>
  );
}
