import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AlertTriangle, Warehouse, Package } from "lucide-react";
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

interface WarehouseItem {
  Id?: string;
  Title?: string;
  Price?: { OriginalPrice?: number; ConvertedPrice?: number; CurrencySign?: string };
  Quantity?: number;
  ImageUrl?: string;
  MainPictureUrl?: string;
  IsActive?: boolean;
  CategoryId?: string;
  CategoryName?: string;
}

export default function OtWarehouse() {
  const { data: itemsRaw, isLoading: itemsLoading } = useQuery<any>({
    queryKey: ["admin", "ot-warehouse-items"],
    queryFn: async () => {
      try { return await callWithOperatorSession("searchWarehouseItems", { page: 0, pageSize: 50 }); }
      catch (e: any) { return { success: false, error: e.message }; }
    },
    retry: false,
  });

  const items = normalizeOtResponse<any>(itemsRaw);

  const itemList: WarehouseItem[] = (() => {
    const d = items.data;
    if (Array.isArray(d)) return d;
    if (Array.isArray(d?.Content)) return d.Content;
    if (Array.isArray(d?.Items?.Content)) return d.Items.Content;
    if (Array.isArray(d?.Items?.Item)) return d.Items.Item;
    return [];
  })();

  // Derive categories from items
  const categories = (() => {
    const catMap = new Map<string, { id: string; name: string; count: number }>();
    for (const item of itemList) {
      const catId = item.CategoryId || "unknown";
      const catName = item.CategoryName || catId;
      const existing = catMap.get(catId);
      if (existing) {
        existing.count++;
      } else {
        catMap.set(catId, { id: catId, name: catName, count: 1 });
      }
    }
    return Array.from(catMap.values());
  })();

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Агуулах</h1>
        <p className="text-muted-foreground mt-1">Агуулахын бараа, ангилал</p>
      </div>

      {/* Summary */}
      {!itemsLoading && items.success && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{itemList.length}</div>
              <p className="text-xs text-muted-foreground">Нийт бараа</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{categories.length}</div>
              <p className="text-xs text-muted-foreground">Ангилал</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{itemList.filter(i => i.IsActive !== false).length}</div>
              <p className="text-xs text-muted-foreground">Идэвхтэй бараа</p>
            </CardContent>
          </Card>
        </div>
      )}

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
                        {(item.ImageUrl || item.MainPictureUrl) ? (
                          <img src={item.ImageUrl || item.MainPictureUrl} alt="" className="w-10 h-10 object-cover rounded border" />
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
    </div>
  );
}