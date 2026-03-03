import { useState, useMemo } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Plus, X, ExternalLink, Package } from "lucide-react";
import { toast } from "sonner";
import { fetchItemsByIds } from "@/services/otApi";
import type { OtProductCard } from "@/types/otApi";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: string;
  categoryName: string;
  currentItemIds: string[];
}

export function OtCategoryItemsManager({ open, onOpenChange, categoryId, categoryName, currentItemIds }: Props) {
  const queryClient = useQueryClient();
  const [newItemId, setNewItemId] = useState("");
  const [localItemIds, setLocalItemIds] = useState<string[]>([]);

  // Sync from parent when dialog opens
  useState(() => {
    setLocalItemIds(currentItemIds || []);
  });

  // Reset when opening
  const handleOpenChange = (o: boolean) => {
    if (o) setLocalItemIds(currentItemIds || []);
    onOpenChange(o);
  };

  // Fetch item details for display
  const { data: itemDetails, isLoading: loadingItems } = useQuery({
    queryKey: ["category-items-detail", categoryId, localItemIds.join(",")],
    queryFn: () => fetchItemsByIds(localItemIds, 8, { includeUnavailable: true }),
    enabled: open && localItemIds.length > 0,
    staleTime: 1000 * 60 * 10,
  });

  const addItem = () => {
    const id = newItemId.trim();
    if (!id) return;
    if (localItemIds.includes(id)) {
      toast.error("Энэ бараа аль хэдийн нэмэгдсэн байна");
      return;
    }
    setLocalItemIds(prev => [...prev, id]);
    setNewItemId("");
  };

  const removeItem = (id: string) => {
    setLocalItemIds(prev => prev.filter(i => i !== id));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("ot_categories")
        .update({ item_ids: localItemIds })
        .eq("id", categoryId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "ot-categories"] });
      onOpenChange(false);
      toast.success(`${localItemIds.length} бараа хадгалагдлаа`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {categoryName} - Бараа удирдлага
          </DialogTitle>
        </DialogHeader>

        {/* Add new item */}
        <div className="flex gap-2">
          <Input
            value={newItemId}
            onChange={e => setNewItemId(e.target.value)}
            placeholder="Барааны OT Item ID оруулах..."
            onKeyDown={e => e.key === "Enter" && addItem()}
          />
          <Button onClick={addItem} size="sm" className="shrink-0 gap-1">
            <Plus className="h-4 w-4" /> Нэмэх
          </Button>
        </div>

        <div className="text-sm text-muted-foreground">
          Нийт: <Badge variant="secondary">{localItemIds.length}</Badge> бараа
        </div>

        {/* Item list */}
        <div className="h-[400px] overflow-y-auto overscroll-contain pr-1 border rounded-md">
          {localItemIds.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>Бараа байхгүй байна</p>
              <p className="text-xs mt-1">OT Item ID оруулж бараа нэмнэ үү</p>
            </div>
          ) : (
            <div className="space-y-1">
              {localItemIds.map((itemId, idx) => {
                const detail = itemDetails?.find((d: OtProductCard) => d.id === itemId);
                return (
                  <div key={itemId} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 group">
                    <span className="text-xs text-muted-foreground w-6">{idx + 1}</span>
                    {detail?.imageUrl ? (
                      <img src={detail.imageUrl} alt="" className="w-10 h-10 rounded object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                        <Package className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {detail?.title || itemId}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">{itemId}</p>
                    </div>
                    {detail && (
                      <a
                        href={`/ot/product/${itemId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <ExternalLink className="h-4 w-4 text-muted-foreground" />
                      </a>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                      onClick={() => removeItem(itemId)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-2 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            Болих
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="flex-1">
            {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Хадгалах
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
