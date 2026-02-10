import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, LayoutList, Settings2, Star, CheckCircle2 } from "lucide-react";
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

interface RatingList {
  Id?: string;
  Name?: string;
  Description?: string;
  Type?: string;
  ItemCount?: number;
  IsEnabled?: boolean;
  CategoryId?: string;
  Provider?: string;
}

interface AutoRatingSettings {
  IsEnabled?: boolean;
  Categories?: Array<{ Id?: string; Name?: string }>;
  Providers?: string[];
  UpdateInterval?: number;
}

export default function OtRatingLists() {
  const { data: ratingRaw, isLoading: ratingLoading } = useQuery<any>({
    queryKey: ["admin", "ot-rating-lists"],
    queryFn: async () => {
      try { return await callWithOperatorSession("batchSearchRatingLists", { page: 0, pageSize: 50 }); }
      catch (e: any) { return { success: false, error: e.message }; }
    },
    retry: false,
  });

  const { data: settingsRaw, isLoading: settingsLoading } = useQuery<any>({
    queryKey: ["admin", "ot-auto-rating-settings"],
    queryFn: async () => {
      try { return await callWithOperatorSession("getAutoRatingListsSettings"); }
      catch (e: any) { return { success: false, error: e.message }; }
    },
    retry: false,
  });

  const ratings = normalizeOtResponse<any>(ratingRaw);
  const settings = normalizeOtResponse<any>(settingsRaw);

  const ratingList: RatingList[] = (() => {
    const d = ratings.data;
    if (Array.isArray(d)) return d;
    if (Array.isArray(d?.Content)) return d.Content;
    if (Array.isArray(d?.RatingLists?.Item)) return d.RatingLists.Item;
    if (Array.isArray(d?.Items?.Item)) return d.Items.Item;
    return d && typeof d === "object" && !Array.isArray(d) ? [d] : [];
  })();

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Рэйтинг жагсаалт</h1>
        <p className="text-muted-foreground mt-1">Онцлох бараа, ангиллын рэйтинг, автомат жагсаалт</p>
      </div>

      <Tabs defaultValue="lists">
        <TabsList>
          <TabsTrigger value="lists">Жагсаалтууд</TabsTrigger>
          <TabsTrigger value="settings">Автомат тохиргоо</TabsTrigger>
        </TabsList>

        <TabsContent value="lists" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5 text-primary" />
                Рэйтинг жагсаалтууд
                {ratingList.length > 0 && <Badge variant="secondary">{ratingList.length}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ratingLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : !ratings.success ? (
                <ErrorAlert message={ratings.error || "Жагсаалт ачаалж чадсангүй"} />
              ) : ratingList.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-muted-foreground">
                  <LayoutList className="h-12 w-12 mb-3 opacity-50" />
                  <p>Рэйтинг жагсаалт олдсонгүй</p>
                  <p className="text-xs mt-1">OT API-р жагсаалт үүсгэж барааг нэмэх боломжтой</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {ratingList.map((r, i) => (
                    <div key={r.Id || i} className="p-4 rounded-lg border bg-card space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Star className="h-4 w-4 text-primary" />
                          <span className="font-medium">{r.Name || "Нэргүй"}</span>
                          {r.Type && <Badge variant="outline">{r.Type}</Badge>}
                          {r.Provider && <Badge variant="outline">{r.Provider}</Badge>}
                        </div>
                        <div className="flex items-center gap-2">
                          {r.ItemCount !== undefined && (
                            <Badge variant="secondary">{r.ItemCount} бараа</Badge>
                          )}
                          <Badge variant={r.IsEnabled !== false ? "default" : "secondary"}>
                            {r.IsEnabled !== false ? "Идэвхтэй" : "Идэвхгүй"}
                          </Badge>
                        </div>
                      </div>
                      {r.Description && <p className="text-sm text-muted-foreground">{r.Description}</p>}
                      {r.Id && <p className="text-xs text-muted-foreground">ID: {r.Id}</p>}
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
                Автомат рэйтинг тохиргоо
              </CardTitle>
            </CardHeader>
            <CardContent>
              {settingsLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : !settings.success ? (
                <ErrorAlert message={settings.error || "Тохиргоо ачаалж чадсангүй"} />
              ) : (
                <RenderAutoSettings data={settings.data} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RenderAutoSettings({ data }: { data: any }) {
  if (!data || typeof data !== "object") {
    return <p className="text-sm text-muted-foreground">Тохиргоо байхгүй</p>;
  }

  const entries = Object.entries(data).filter(([k]) => !["ErrorCode", "RequestId", "RequestTime"].includes(k));
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">Тохиргоо байхгүй</p>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
