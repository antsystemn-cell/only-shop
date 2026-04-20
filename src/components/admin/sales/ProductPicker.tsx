import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Plus } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface PickedProduct {
  product_id: string;
  variant_id?: string | null;
  product_name: string;
  variant_name?: string | null;
  color?: string | null;
  size?: string | null;
  sku?: string | null;
  unit_price: number;
  unit_cost?: number;
  stock: number;
}

interface Props {
  onPick: (item: PickedProduct) => void;
}

export function ProductPicker({ onPick }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const { data: products } = useQuery({
    queryKey: ["picker-products", query],
    queryFn: async () => {
      let q = supabase
        .from("products")
        .select("id, name, name_mn, sku, price, stock, images, product_variants(id, name, color, size, sku_suffix, price, stock, is_active)")
        .eq("is_active", true)
        .limit(20);
      if (query) {
        q = q.or(`name.ilike.%${query}%,name_mn.ilike.%${query}%,sku.ilike.%${query}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const handlePick = (p: any, v?: any) => {
    onPick({
      product_id: p.id,
      variant_id: v?.id || null,
      product_name: p.name_mn || p.name,
      variant_name: v?.name || null,
      color: v?.color || null,
      size: v?.size || null,
      sku: v?.sku_suffix ? `${p.sku || ""}-${v.sku_suffix}` : p.sku,
      unit_price: Number(v?.price ?? p.price),
      unit_cost: 0,
      stock: v ? v.stock : p.stock,
    });
    setOpen(false);
    setQuery("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Plus className="w-4 h-4 mr-1" /> Бараа нэмэх
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-0" align="start">
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Нэр / SKU хайх"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
        <ScrollArea className="h-[320px]">
          <div className="p-2 space-y-1">
            {products?.map((p: any) => {
              const variants = (p.product_variants || []).filter((v: any) => v.is_active !== false);
              if (variants.length === 0) {
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handlePick(p)}
                    className="w-full text-left p-2 rounded hover:bg-accent flex items-center justify-between"
                  >
                    <div>
                      <div className="text-sm font-medium">{p.name_mn || p.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {p.sku || "—"} · {Number(p.price).toLocaleString()}₮
                      </div>
                    </div>
                    <Badge variant={p.stock > 0 ? "secondary" : "destructive"}>
                      {p.stock}
                    </Badge>
                  </button>
                );
              }
              return (
                <div key={p.id} className="border rounded">
                  <div className="px-2 py-1.5 text-sm font-medium bg-muted/40">
                    {p.name_mn || p.name}
                  </div>
                  <div className="divide-y">
                    {variants.map((v: any) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => handlePick(p, v)}
                        className="w-full text-left p-2 hover:bg-accent flex items-center justify-between"
                      >
                        <div className="text-xs">
                          {[v.color, v.size, v.name].filter(Boolean).join(" / ") || "Хувилбар"}
                          <div className="text-muted-foreground">
                            {Number(v.price ?? p.price).toLocaleString()}₮
                          </div>
                        </div>
                        <Badge variant={v.stock > 0 ? "secondary" : "destructive"}>
                          {v.stock}
                        </Badge>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
            {products?.length === 0 && (
              <div className="text-center text-sm text-muted-foreground p-6">
                Илэрц алга
              </div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
