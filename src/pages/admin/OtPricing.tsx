import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, DollarSign, TrendingUp, Percent } from "lucide-react";
import {
  getCurrencyList,
  getDiscountGroupList,
} from "@/services/otApi";

export default function OtPricing() {
  const { data: currencies, isLoading: currLoading, refetch: refetchCurrencies } = useQuery<any>({
    queryKey: ["admin", "ot-currencies"],
    queryFn: async () => {
      try {
        return await getCurrencyList();
      } catch (e: any) {
        return { error: e.message };
      }
    },
    retry: false,
    enabled: false,
  });

  const { data: discountGroups, isLoading: discountLoading, refetch: refetchDiscounts } = useQuery<any>({
    queryKey: ["admin", "ot-discounts"],
    queryFn: async () => {
      try {
        return await getDiscountGroupList();
      } catch (e: any) {
        return { error: e.message };
      }
    },
    retry: false,
    enabled: false,
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">OT Үнийн мэдээлэл</h1>
        <p className="text-muted-foreground mt-1">OT API валют, хөнгөлөлтийн бүлэг</p>
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
                OT API Валют
              </CardTitle>
            </CardHeader>
            <CardContent>
              {currLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : currencies?.error ? (
                <div className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm">{currencies.error}</span>
                </div>
              ) : (
                <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto max-h-96">
                  {JSON.stringify(currencies, null, 2)}
                </pre>
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
              </CardTitle>
            </CardHeader>
            <CardContent>
              {discountLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : discountGroups?.error ? (
                <div className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm">{discountGroups.error}</span>
                </div>
              ) : (
                <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto max-h-96">
                  {JSON.stringify(discountGroups, null, 2)}
                </pre>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
