import { useState, useEffect, useCallback } from "react";
import { MapPin, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { searchDeliveryPickupPoints } from "@/services/otApi";

interface PickupPoint {
  Id: string;
  Name?: string;
  Address?: string;
  City?: string;
  Phone?: string;
  WorkingHours?: string;
  Description?: string;
}

interface Props {
  deliveryModeId?: string;
  selectedPointId: string;
  onSelect: (pointId: string) => void;
}

export function PickupPointSelector({ deliveryModeId, selectedPointId, onSelect }: Props) {
  const [points, setPoints] = useState<PickupPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadPoints = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await searchDeliveryPickupPoints(deliveryModeId) as any;
      const rawItems = data?.Result?.Items;
      setPoints(Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : []);
    } catch (err: any) {
      setError("Авах цэг ачаалахад алдаа гарлаа");
    } finally {
      setLoading(false);
    }
  }, [deliveryModeId]);

  useEffect(() => {
    loadPoints();
  }, [loadPoints]);

  const filtered = search
    ? points.filter(
        (p) =>
          (p.Name || "").toLowerCase().includes(search.toLowerCase()) ||
          (p.Address || "").toLowerCase().includes(search.toLowerCase()) ||
          (p.City || "").toLowerCase().includes(search.toLowerCase())
      )
    : points;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-destructive mb-2">{error}</p>
        <Button variant="outline" size="sm" onClick={loadPoints}>
          Дахин оролдох
        </Button>
      </div>
    );
  }

  if (points.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        Авах цэг олдсонгүй
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Авах цэг хайх..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {filtered.map((point) => (
          <button
            key={point.Id}
            onClick={() => onSelect(point.Id)}
            className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
              selectedPointId === point.Id
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            }`}
          >
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="font-medium text-sm">{point.Name || `Цэг #${point.Id}`}</p>
                {point.Address && (
                  <p className="text-xs text-muted-foreground mt-0.5">{point.Address}</p>
                )}
                <div className="flex flex-wrap gap-2 mt-1">
                  {point.City && (
                    <Badge variant="outline" className="text-xs">
                      {point.City}
                    </Badge>
                  )}
                  {point.WorkingHours && (
                    <span className="text-xs text-muted-foreground">{point.WorkingHours}</span>
                  )}
                </div>
              </div>
            </div>
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            "{search}" хайлтаар олдсонгүй
          </p>
        )}
      </div>
    </div>
  );
}
