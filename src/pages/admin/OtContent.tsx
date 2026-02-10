import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, FileText, Image, FolderTree, ExternalLink } from "lucide-react";
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

interface MenuTreeItem {
  Id?: string;
  Title?: string;
  Url?: string;
  IsVisible?: boolean;
  Children?: { Item?: MenuTreeItem[] };
  SubItems?: MenuTreeItem[];
}

interface OtBanner {
  Id?: string;
  Name?: string;
  ImageUrl?: string;
  Url?: string;
  IsEnabled?: boolean;
  Position?: string;
}

export default function OtContent() {
  const { data: menuRaw, isLoading: menuLoading } = useQuery<any>({
    queryKey: ["admin", "ot-menu-tree"],
    queryFn: async () => {
      try { return await callWithOperatorSession("getContentMenuItemTree"); }
      catch (e: any) { return { success: false, error: e.message }; }
    },
    retry: false,
  });

  const { data: bannersRaw, isLoading: bannersLoading } = useQuery<any>({
    queryKey: ["admin", "ot-banners"],
    queryFn: async () => {
      try { return await callWithOperatorSession("getBannerSettings"); }
      catch (e: any) { return { success: false, error: e.message }; }
    },
    retry: false,
  });

  const { data: designRaw, isLoading: designLoading } = useQuery<any>({
    queryKey: ["admin", "ot-design"],
    queryFn: async () => {
      try { return await callWithOperatorSession("getApplicationDesignSettings"); }
      catch (e: any) { return { success: false, error: e.message }; }
    },
    retry: false,
  });

  const menu = normalizeOtResponse<any>(menuRaw);
  const banners = normalizeOtResponse<any>(bannersRaw);
  const design = normalizeOtResponse<any>(designRaw);

  const menuItems: MenuTreeItem[] = (() => {
    const d = menu.data;
    if (Array.isArray(d)) return d;
    if (d?.Content) return d.Content;
    if (d?.ContentMenuItemTree?.Item) return d.ContentMenuItemTree.Item;
    if (d?.Items) return d.Items;
    return d ? [d] : [];
  })();

  const bannerList: OtBanner[] = (() => {
    const d = banners.data;
    if (Array.isArray(d)) return d;
    if (d?.Content) return d.Content;
    if (d?.BannerList?.Item) return d.BannerList.Item;
    if (d?.Banners) return d.Banners;
    return [];
  })();

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">OT Контент</h1>
        <p className="text-muted-foreground mt-1">Мэдээ, баннер, цэсний бүтэц, загвар</p>
      </div>

      <Tabs defaultValue="menu">
        <TabsList>
          <TabsTrigger value="menu">Цэсний бүтэц</TabsTrigger>
          <TabsTrigger value="banners">OT Баннерууд</TabsTrigger>
          <TabsTrigger value="design">Загварын тохиргоо</TabsTrigger>
        </TabsList>

        <TabsContent value="menu" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderTree className="h-5 w-5 text-primary" />
                Контент цэсний бүтэц
              </CardTitle>
            </CardHeader>
            <CardContent>
              {menuLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : !menu.success ? (
                <ErrorAlert message={menu.error || "Цэс ачаалж чадсангүй"} />
              ) : menuItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">Цэсний зүйл олдсонгүй</p>
              ) : (
                <div className="space-y-1">
                  {menuItems.map((item, i) => (
                    <MenuItemRow key={item.Id || i} item={item} depth={0} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="banners" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Image className="h-5 w-5 text-primary" />
                OT API Баннерууд
                {bannerList.length > 0 && <Badge variant="secondary">{bannerList.length}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {bannersLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : !banners.success ? (
                <ErrorAlert message={banners.error || "Баннер ачаалж чадсангүй"} />
              ) : bannerList.length === 0 ? (
                <p className="text-sm text-muted-foreground">Баннер олдсонгүй</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {bannerList.map((b, i) => (
                    <div key={b.Id || i} className="p-4 rounded-lg border bg-card space-y-2">
                      {b.ImageUrl && (
                        <img src={b.ImageUrl} alt={b.Name || "Banner"} className="w-full h-32 object-cover rounded" />
                      )}
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{b.Name || "Баннер"}</span>
                        <Badge variant={b.IsEnabled !== false ? "default" : "secondary"}>
                          {b.IsEnabled !== false ? "Идэвхтэй" : "Идэвхгүй"}
                        </Badge>
                      </div>
                      {b.Url && (
                        <a href={b.Url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary flex items-center gap-1 hover:underline">
                          <ExternalLink className="h-3 w-3" />{b.Url}
                        </a>
                      )}
                      {b.Position && <p className="text-xs text-muted-foreground">Байрлал: {b.Position}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="design" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Загварын тохиргоо (BoxDesign / Elastic Theme)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {designLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : !design.success ? (
                <ErrorAlert message={design.error || "Загварын тохиргоо ачаалж чадсангүй"} />
              ) : (
                <RenderObjAsCards data={design.data} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MenuItemRow({ item, depth }: { item: MenuTreeItem; depth: number }) {
  const children = item.Children?.Item || item.SubItems || [];
  return (
    <div>
      <div className={`flex items-center gap-2 p-2 rounded hover:bg-muted/50`} style={{ paddingLeft: `${depth * 20 + 8}px` }}>
        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium">{item.Title || "—"}</span>
        {item.IsVisible === false && <Badge variant="secondary" className="text-xs">Нууцлагдсан</Badge>}
        {item.Url && (
          <a href={item.Url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary ml-auto hover:underline">
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
      {children.map((child, i) => (
        <MenuItemRow key={child.Id || i} item={child} depth={depth + 1} />
      ))}
    </div>
  );
}

function RenderObjAsCards({ data }: { data: any }) {
  if (!data || typeof data !== "object") return <p className="text-sm text-muted-foreground">Мэдээлэл байхгүй</p>;
  const entries = Object.entries(data).filter(([k]) => !["ErrorCode", "RequestId", "RequestTime"].includes(k));
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">Тохиргоо байхгүй</p>;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {entries.map(([key, value]) => (
        <div key={key} className="space-y-1 p-3 rounded-lg border">
          <p className="text-xs text-muted-foreground">{key.replace(/([A-Z])/g, " $1").trim()}</p>
          <p className="font-medium text-sm">
            {typeof value === "boolean" ? (
              <Badge variant={value ? "default" : "secondary"}>{value ? "Тийм" : "Үгүй"}</Badge>
            ) : typeof value === "object" && value !== null ? (
              <Badge variant="outline">{Array.isArray(value) ? `${value.length} зүйл` : `${Object.keys(value).length} тохиргоо`}</Badge>
            ) : (
              String(value ?? "—")
            )}
          </p>
        </div>
      ))}
    </div>
  );
}
