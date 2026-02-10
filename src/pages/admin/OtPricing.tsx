import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AlertTriangle, DollarSign, Percent } from "lucide-react";
import { callWithOperatorSession } from "@/services/otSession";
import { normalizeOtResponse } from "@/utils/otNormalizer";

interface OtCurrency {
  Code: string;
  Sign: string;
  Description: string;
}

interface OtDiscountGroup {
  Id?: { Value?: number };
  Name?: string;
  Description?: string;
  IsDefault?: boolean;
  Discount?: { Percent?: number };
  DiscountIdentificationParametr?: {
    PurchaseVolume?: number;
    Providers?: { Content?: number[] };
  };
}

function ErrorAlert({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 text-destructive p-3 rounded-lg bg-destructive/10">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="text-sm">{message}</span>
    </div>
  );
}

export default function OtPricing() {
  const { data: currRaw, isLoading: currLoading } = useQuery<any>({
    queryKey: ["admin", "ot-currencies"],
    queryFn: async () => {
      try { return await callWithOperatorSession("getCurrencyList"); }
      catch (e: any) { return { success: false, error: e.message }; }
    },
    retry: false,
  });

  const { data: discountRaw, isLoading: discountLoading } = useQuery<any>({
    queryKey: ["admin", "ot-discounts"],
    queryFn: async () => {
      try { return await callWithOperatorSession("getDiscountGroupList"); }
      catch (e: any) { return { success: false, error: e.message }; }
    },
    retry: false,
  });

  const currencies = normalizeOtResponse<{ Content?: OtCurrency[] }>(currRaw);
  const discounts = normalizeOtResponse<{ Content?: OtDiscountGroup[] }>(discountRaw);

  const currList = currencies.data?.Content || [];
  const discList = discounts.data?.Content || [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">OT Үнийн мэдээлэл</h1>
        <p className="text-muted-foreground mt-1">Валют, хөнгөлөлтийн бүлэг</p>
      </div>

      <Tabs defaultValue="currencies">
        <TabsList>
          <TabsTrigger value="currencies">Валютын жагсаалт</TabsTrigger>
          <TabsTrigger value="discounts">Хөнгөлөлтийн бүлэг</TabsTrigger>
        </TabsList>

        <TabsContent value="currencies" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                Валютууд
                {currList.length > 0 && (
                  <Badge variant="secondary" className="ml-2">{currList.length}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {currLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : !currencies.success ? (
                <ErrorAlert message={currencies.error || "Валют ачаалж чадсангүй"} />
              ) : currList.length === 0 ? (
                <p className="text-sm text-muted-foreground">Валют олдсонгүй</p>
              ) : (
                <div className="rounded-md border overflow-auto max-h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20">Код</TableHead>
                        <TableHead className="w-16">Тэмдэг</TableHead>
                        <TableHead>Тайлбар</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currList.map((c) => (
                        <TableRow key={c.Code}>
                          <TableCell className="font-mono font-medium">{c.Code}</TableCell>
                          <TableCell className="text-lg">{c.Sign}</TableCell>
                          <TableCell className="text-muted-foreground">{c.Description}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="discounts" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Percent className="h-5 w-5 text-primary" />
                Хөнгөлөлтийн бүлгүүд
                {discList.length > 0 && (
                  <Badge variant="secondary" className="ml-2">{discList.length}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {discountLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : !discounts.success ? (
                <ErrorAlert message={discounts.error || "Хөнгөлөлт ачаалж чадсангүй"} />
              ) : discList.length === 0 ? (
                <p className="text-sm text-muted-foreground">Хөнгөлөлтийн бүлэг олдсонгүй</p>
              ) : (
                <div className="space-y-3">
                  {discList.map((d) => (
                    <div key={d.Id?.Value || d.Name} className="p-4 rounded-lg border bg-card space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{d.Name || "Нэргүй"}</span>
                          {d.IsDefault && <Badge>Үндсэн</Badge>}
                        </div>
                        <Badge variant="outline" className="text-lg px-3">
                          {d.Discount?.Percent ?? 0}%
                        </Badge>
                      </div>
                      {d.Description && (
                        <p className="text-sm text-muted-foreground">{d.Description}</p>
                      )}
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        {d.DiscountIdentificationParametr?.PurchaseVolume !== undefined && (
                          <span>Худалдан авалт: {d.DiscountIdentificationParametr.PurchaseVolume}+</span>
                        )}
                        {d.Id?.Value && <span>ID: {d.Id.Value}</span>}
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
