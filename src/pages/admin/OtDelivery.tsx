import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AlertTriangle, Globe, DollarSign, CheckCircle2, XCircle } from "lucide-react";
import { getDeliveryCountryInfoList } from "@/services/otApi";
import { callWithOperatorSession } from "@/services/otSession";
import { normalizeOtResponse } from "@/utils/otNormalizer";

interface OtCountry {
  Id: string;
  Name: string;
  FlagImageUrl?: string;
  IsEuropeanUnion?: boolean;
}

interface OtDeliveryRate {
  Id: number;
  CountryCode: string;
  ExternalDeliveryTypeId: string;
  IsEnabled: number;
  Start: number;
  Step: number;
}

function ErrorAlert({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 text-destructive p-3 rounded-lg bg-destructive/10">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="text-sm">{message}</span>
    </div>
  );
}

export default function OtDelivery() {
  const { data: countriesRaw, isLoading: countriesLoading } = useQuery<any>({
    queryKey: ["admin", "ot-delivery-countries"],
    queryFn: async () => {
      try { return await getDeliveryCountryInfoList(); }
      catch (e: any) { return { success: false, error: e.message }; }
    },
    retry: false,
  });

  const { data: ratesRaw, isLoading: ratesLoading } = useQuery<any>({
    queryKey: ["admin", "ot-delivery-rates"],
    queryFn: async () => {
      try { return await callWithOperatorSession("getExternalDeliveryRateList", { weight: "1000", countryCode: "MN" }); }
      catch (e: any) { return { success: false, error: e.message }; }
    },
    retry: false,
  });

  const countries = normalizeOtResponse<{ Content?: OtCountry[] }>(countriesRaw);
  const rates = normalizeOtResponse<{ Content?: OtDeliveryRate[] }>(ratesRaw);

  const countryList = countries.data?.Content || [];
  const rateList = rates.data?.Content || [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">OT Хүргэлт & Геолокаци</h1>
        <p className="text-muted-foreground mt-1">Хүргэлтийн улсууд, тариф</p>
      </div>

      <Tabs defaultValue="countries">
        <TabsList>
          <TabsTrigger value="countries">Улсуудын жагсаалт</TabsTrigger>
          <TabsTrigger value="rates">Хүргэлтийн тариф</TabsTrigger>
        </TabsList>

        <TabsContent value="countries" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                Хүргэлтийн улсууд
                {countryList.length > 0 && (
                  <Badge variant="secondary" className="ml-2">{countryList.length}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {countriesLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : !countries.success ? (
                <ErrorAlert message={countries.error || "Улсууд ачаалж чадсангүй"} />
              ) : countryList.length === 0 ? (
                <p className="text-sm text-muted-foreground">Улс олдсонгүй</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {countryList.map((c) => (
                    <div key={c.Id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                      {c.FlagImageUrl && (
                        <img src={c.FlagImageUrl} alt={c.Name} className="w-8 h-6 object-cover rounded" />
                      )}
                      <div>
                        <p className="font-medium text-sm">{c.Name}</p>
                        <p className="text-xs text-muted-foreground">{c.Id}</p>
                      </div>
                      {c.IsEuropeanUnion && (
                        <Badge variant="outline" className="ml-auto text-xs">EU</Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rates" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                Хүргэлтийн тариф (1кг, Монгол)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ratesLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : !rates.success ? (
                <ErrorAlert message={rates.error || "Тариф ачаалж чадсангүй"} />
              ) : rateList.length === 0 ? (
                <p className="text-sm text-muted-foreground">Тариф олдсонгүй</p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Хүргэлтийн төрөл</TableHead>
                        <TableHead className="text-right">Эхлэх үнэ</TableHead>
                        <TableHead className="text-right">Алхам үнэ</TableHead>
                        <TableHead className="text-center">Төлөв</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rateList.map((r) => (
                        <TableRow key={r.Id}>
                          <TableCell>
                            <span className="font-mono text-sm">{r.ExternalDeliveryTypeId}</span>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {r.Start > 0 ? `₮${r.Start.toLocaleString()}` : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {r.Step > 0 ? `₮${r.Step.toLocaleString()}` : "—"}
                          </TableCell>
                          <TableCell className="text-center">
                            {r.IsEnabled ? (
                              <Badge variant="default" className="gap-1">
                                <CheckCircle2 className="h-3 w-3" /> Идэвхтэй
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="gap-1">
                                <XCircle className="h-3 w-3" /> Идэвхгүй
                              </Badge>
                            )}
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
      </Tabs>
    </div>
  );
}
