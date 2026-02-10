import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AlertTriangle, Warehouse, FolderTree, Package, CheckCircle2, XCircle } from "lucide-react";
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

interface WarehouseCategory {
  Id?: string;
  Name?: string;
  ItemCount?: number;
}

interface WarehouseItem {
  Id?: string;
  Title?: string;
  Price?: { OriginalPrice?: number; ConvertedPrice?: number; CurrencySign?: string };
  Quantity?: number;
  ImageUrl?: string;
  IsActive?: boolean;
  CategoryId?: string;
}

export default function OtWarehouse() {
  const { data: catsRaw, isLoading: catsLoading } = useQuery<any>({
    queryKey: ["admin", "ot-warehouse-cats"],
    queryFn: async () => {
      try { return await callWithOperatorSession("getWarehouseCategories"); }
      catch (e: any) { return { success: false, error: e.message }; }
    },
    retry: false,
  });

  const { data: itemsRaw, isLoading: itemsLoading } = useQuery<any>({
    queryKey: ["admin", "ot-warehouse-items"],
    queryFn: async () => {
      try { return await callWithOperatorSession("searchWarehouseItems", { page: 0, pageSize: 50 }); }
      catch (e: any) { return { success: false, error: e.message }; }
    },
    retry: false,
  });

  const categories = normalizeOtResponse<any>(catsRaw);
  const items = normalizeOtResponse<any>(itemsRaw);

  const catList: WarehouseCategory[] = (() => {
    const d = categories.data;
    if (Array.isArray(d)) return d;
    if (d?.Content) return d.Content;
    if (d?.WarehouseCategoryInfoList?.Item) return d.WarehouseCategoryInfoList.Item;
    return [];
  })();

  const itemList: WarehouseItem[] = (() => {
    const d = items.data;
    if (Array.isArray(d)) return d;
    if (d?.Content) return d.Content;
    if (d?.Items?.Item) return d.Items.Item;
    if (d?.Items?.Content) return d.Items.Content;
    return [];
  })();

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Агуулах</h1>
        <p className="text-muted-foreground mt-1">Агуулахын бараа, ангилал</p>
      </div>

      <Tabs defaultValue="items">
        <TabsList>
          <TabsTrigger value="items">Бараанууд</TabsTrigger>
          <TabsTrigger value="categories">Ангилал</TabsTrigger>
        </TabsList>

        <TabsContent value="items" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Агуулахын бараа
                {itemList.length > 0 && <Badge variant="secondary">{itemList.length}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {itemsLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : !items.success ? (
                <ErrorAlert message={items.error || "Бараа ачаалж чадсангүй"} />
              ) : itemList.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-muted-foreground">
                  <Warehouse className="h-12 w-12 mb-3 opacity-50" />
                  <p>Агуулахад бараа байхгүй</p>
                  <p className="text-xs mt-1">OT API-р агуулахын бараа нэмэх боломжтой</p>
                </div>
              ) : (
                <div className="rounded-md border overflow-auto max-h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Зураг</TableHead>
                        <TableHead>Нэр</TableHead>
                        <TableHead className="text-right">Үнэ</TableHead>
                        <TableHead className="text-center">Тоо ширхэг</TableHead>
                        <TableHead className="text-center">Төлөв</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {itemList.map((item, i) => (
                        <TableRow key={item.Id || i}>
                          <TableCell>
                            {item.ImageUrl ? (
                              <img src={item.ImageUrl} alt="" className="w-10 h-10 object-cover rounded border" />
                            ) : (
                              <div className="w-10 h-10 bg-muted rounded flex items-center justify-center">
                                <Package className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">{item.Title || "—"}</TableCell>
                          <TableCell className="text-right">
                            {item.Price?.ConvertedPrice ?? item.Price?.OriginalPrice ?? "—"}
                            {item.Price?.CurrencySign && ` ${item.Price.CurrencySign}`}
                          </TableCell>
                          <TableCell className="text-center">{item.Quantity ?? "—"}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={item.IsActive !== false ? "default" : "secondary"}>
                              {item.IsActive !== false ? "Идэвхтэй" : "Идэвхгүй"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderTree className="h-5 w-5 text-primary" />
                Агуулахын ангилал
                {catList.length > 0 && <Badge variant="secondary">{catList.length}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {catsLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : !categories.success ? (
                <ErrorAlert message={categories.error || "Ангилал ачаалж чадсангүй"} />
              ) : catList.length === 0 ? (
                <p className="text-sm text-muted-foreground">Агуулахын ангилал олдсонгүй</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {catList.map((c, i) => (
                    <div key={c.Id || i} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                      <FolderTree className="h-5 w-5 text-primary shrink-0" />
                      <div>
                        <p className="font-medium text-sm">{c.Name || "—"}</p>
                        {c.ItemCount !== undefined && (
                          <p className="text-xs text-muted-foreground">{c.ItemCount} бараа</p>
                        )}
                      </div>
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
