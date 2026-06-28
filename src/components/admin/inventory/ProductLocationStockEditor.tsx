import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Loader2, Save } from "lucide-react";

interface Props {
  productId: string;
}

interface Location {
  id: string;
  name: string;
  color: string;
  is_active: boolean;
  display_order: number;
}

interface LocationStock {
  id?: string;
  location_id: string;
  quantity: number;
  note?: string | null;
}

export default function ProductLocationStockEditor({ productId }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [values, setValues] = useState<Record<string, number>>({});

  const { data: locations, isLoading: loadingLocs } = useQuery({
    queryKey: ["stock-locations", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_locations")
        .select("*")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data as Location[];
    },
  });

  const { data: current, isLoading: loadingStock } = useQuery({
    queryKey: ["product-location-stock", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_location_stock")
        .select("*")
        .eq("product_id", productId);
      if (error) throw error;
      return data as LocationStock[];
    },
    enabled: !!productId,
  });

  useEffect(() => {
    if (!current) return;
    const map: Record<string, number> = {};
    current.forEach((r) => {
      map[r.location_id] = r.quantity || 0;
    });
    setValues(map);
  }, [current]);

  const save = useMutation({
    mutationFn: async () => {
      const rows = Object.entries(values).map(([location_id, quantity]) => ({
        product_id: productId,
        location_id,
        quantity: Number(quantity) || 0,
      }));
      if (rows.length === 0) return;
      const { error } = await supabase
        .from("product_location_stock")
        .upsert(rows, { onConflict: "product_id,location_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product-location-stock", productId] });
      qc.invalidateQueries({ queryKey: ["admin", "stock-locations", "counts"] });
      toast({ title: "Байршлын үлдэгдэл хадгалагдлаа" });
    },
    onError: (e: any) =>
      toast({ title: "Алдаа", description: e.message, variant: "destructive" }),
  });

  const total = Object.values(values).reduce((s, n) => s + (Number(n) || 0), 0);

  if (loadingLocs || loadingStock) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mx-auto" />
      </div>
    );
  }

  if (!locations || locations.length === 0) {
    return (
      <Card className="p-3 text-sm text-muted-foreground">
        Байршил тохируулаагүй байна. Үлдэгдэл → Байршил хэсгээс нэмнэ үү.
      </Card>
    );
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          <h4 className="font-medium text-sm">Байршил тус бүрийн үлдэгдэл</h4>
        </div>
        <div className="text-xs text-muted-foreground">
          Нийлбэр: <span className="font-semibold text-foreground">{total}</span>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {locations.map((loc) => (
          <div key={loc.id} className="space-y-1">
            <Label className="text-xs flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: loc.color }}
              />
              {loc.name}
            </Label>
            <Input
              type="number"
              min="0"
              value={values[loc.id] ?? ""}
              onChange={(e) =>
                setValues({
                  ...values,
                  [loc.id]: e.target.value === "" ? 0 : parseInt(e.target.value),
                })
              }
              placeholder="0"
            />
          </div>
        ))}
      </div>
      <div className="flex justify-end pt-1">
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? (
            <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5 mr-1" />
          )}
          Хадгалах
        </Button>
      </div>
    </Card>
  );
}
