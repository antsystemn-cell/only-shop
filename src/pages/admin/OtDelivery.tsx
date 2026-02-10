import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Truck, Globe, MapPin, AlertTriangle, DollarSign,
} from "lucide-react";
import {
  getDeliveryCountryInfoList,
  getExternalDeliveryRateList,
} from "@/services/otApi";

export default function OtDelivery() {
  const { data: countries, isLoading: countriesLoading } = useQuery<any>({
    queryKey: ["admin", "ot-delivery-countries"],
    queryFn: async () => {
      try {
        return await getDeliveryCountryInfoList();
      } catch (e: any) {
        return { error: e.message };
      }
    },
    retry: false,
  });

  const { data: rates, isLoading: ratesLoading } = useQuery<any>({
    queryKey: ["admin", "ot-delivery-rates"],
    queryFn: async () => {
      try {
        return await getExternalDeliveryRateList("1000", "MN");
      } catch (e: any) {
        return { error: e.message };
      }
    },
    retry: false,
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">OT Хүргэлт & Геолокаци</h1>
        <p className="text-muted-foreground mt-1">OT API хүргэлтийн тохиргоо</p>
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
              </CardTitle>
            </CardHeader>
            <CardContent>
              {countriesLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : countries?.error ? (
                <div className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm">{countries.error}</span>
                </div>
              ) : (
                <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto max-h-96">
                  {JSON.stringify(countries, null, 2)}
                </pre>
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
              ) : rates?.error ? (
                <div className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm">{rates.error}</span>
                </div>
              ) : (
                <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto max-h-96">
                  {JSON.stringify(rates, null, 2)}
                </pre>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
