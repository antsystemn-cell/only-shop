import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  orderItemId: string | null;
  currentProductName: string;
}

export default function SwapOrderItemDialog({ open, onClose, orderItemId, currentProductName }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["swap-products", search],
    queryFn: async () => {
      let q = supabase
        .from("products")
        .select("id, name_mn, name, price, stock, images, sku")
        .eq("is_active", true)
        .order("stock", { ascending: false })
        .limit(50);
      if (search.trim()) {
        q = q.ilike("name_mn", `%${search.trim()}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const swap = useMutation({
    mutationFn: async () => {
      if (!orderItemId || !selectedId) throw new Error("Бараа сонгоно уу");
      const { error } = await supabase.rpc("swap_order_item_product", {
        p_order_item_id: orderItemId,
        p_new_product_id: selectedId,
        p_new_variant_id: null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      toast({ title: "Бараа амжилттай солигдлоо" });
      setSelectedId(null);
      setSearch("");
      onClose();
    },
    onError: (e: any) => toast({ title: "Алдаа", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Барааг солих</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">
            Одоогийн: <span className="font-medium text-foreground">{currentProductName}</span>
          </div>
          <div>
            <Label className="text-xs">Шинэ бараа хайх</Label>
            <div className="relative mt-1">
              <Search className="h-3.5 w-3.5 absolute left-2 top-2.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Барааны нэр..."
                className="pl-8 h-9"
              />
            </div>
          </div>
          <ScrollArea className="h-72 border rounded-md">
            {isLoading ? (
              <div className="p-4 flex justify-center"><Loader2 className="h-4 w-4 animate-spin" /></div>
            ) : (
              <div className="p-1">
                {products.map((p: any) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedId(p.id)}
                    className={`w-full text-left p-2 rounded flex items-center gap-2 hover:bg-muted ${
                      selectedId === p.id ? "bg-primary/10 ring-1 ring-primary" : ""
                    }`}
                  >
                    {p.images?.[0] && (
                      <img src={p.images[0]} alt="" className="w-10 h-10 rounded object-contain border bg-muted shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium line-clamp-1">{p.name_mn}</div>
                      <div className="text-xs text-muted-foreground">
                        {Number(p.price).toLocaleString()}₮ · Үлдэгдэл: {p.stock}
                      </div>
                    </div>
                  </button>
                ))}
                {!products.length && (
                  <p className="text-xs text-muted-foreground p-3 text-center">Бараа олдсонгүй</p>
                )}
              </div>
            )}
          </ScrollArea>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Болих</Button>
          <Button onClick={() => swap.mutate()} disabled={!selectedId || swap.isPending}>
            {swap.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
            Солих
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
