import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getExternalDeliveryRateList, getDeliveryCountryInfoList } from "@/services/otApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Calculator, Truck, Package, Globe } from "lucide-react";

export default function DeliveryCalculator() {
  const [weight, setWeight] = useState("1");
  const [countryCode, setCountryCode] = useState("MN");
  const [searchTriggered, setSearchTriggered] = useState(false);

  const { data: countriesData } = useQuery({
    queryKey: ["ot-delivery-countries"],
    queryFn: () => getDeliveryCountryInfoList() as Promise<any>,
    staleTime: 1000 * 60 * 60,
  });

  const countries = (countriesData as any)?.Result?.Items || [];

  const { data: ratesData, isLoading, isFetching } = useQuery({
    queryKey: ["ot-delivery-rates", weight, countryCode],
    queryFn: () => getExternalDeliveryRateList(weight, countryCode) as Promise<any>,
    enabled: searchTriggered && !!weight,
    staleTime: 1000 * 60 * 5,
  });

  const rates = (ratesData as any)?.Result?.Items || [];

  const handleCalculate = () => {
    setSearchTriggered(true);
  };

  return (
    <div className="container py-6 max-w-3xl animate-fade-in">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Calculator className="h-6 w-6 text-primary" />
        Хүргэлтийн тооцоолуур
      </h1>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label>Жин (кг)</Label>
              <div className="relative mt-1">
                <Package className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={weight}
                  onChange={(e) => { setWeight(e.target.value); setSearchTriggered(false); }}
                  className="pl-10"
                  placeholder="1.0"
                />
              </div>
            </div>
            <div>
              <Label>Улс</Label>
              <Select value={countryCode} onValueChange={(v) => { setCountryCode(v); setSearchTriggered(false); }}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Улс сонгох" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MN">Монгол</SelectItem>
                  {countries.map((c: any) => (
                    <SelectItem key={c.Code || c.Id} value={c.Code || c.Id}>
                      {c.Name || c.Code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={handleCalculate} className="w-full" disabled={!weight || isFetching}>
                {isFetching ? "Тооцоолж байна..." : "Тооцоолох"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading || isFetching ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : searchTriggered && rates.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Хүргэлтийн сонголтууд ({rates.length})
          </h2>
          {rates.map((rate: any, idx: number) => {
            const name = rate.Name || rate.DeliveryModeName || `Горим ${idx + 1}`;
            const price = rate.Price?.ConvertedPrice ?? rate.Price?.OriginalPrice ?? rate.TotalPrice;
            const currency = rate.Price?.CurrencySign || rate.CurrencySign || "¥";
            const days = rate.EstimatedDays || rate.DeliveryDays;
            const description = rate.Description || "";

            return (
              <Card key={idx}>
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Globe className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium">{name}</h3>
                      {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
                      {days && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Хүргэх хугацаа: ~{days} хоног
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    {price != null ? (
                      <span className="text-lg font-bold">
                        {new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(price)}{currency}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : searchTriggered ? (
        <div className="text-center py-12 text-muted-foreground">
          <Truck className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Хүргэлтийн мэдээлэл олдсонгүй</p>
        </div>
      ) : null}
    </div>
  );
}
