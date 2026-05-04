import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { fetchStockMovements, getMovementTypeBadge, StockMovementRow } from "@/lib/inventory/stockService";
import { format } from "date-fns";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  productId: string;
  variantId: string | null;
  label: string;
  currentStock: number;
}

export function StockHistorySheet({ open, onOpenChange, productId, variantId, label, currentStock }: Props) {
  const [rows, setRows] = useState<StockMovementRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchStockMovements({
      productId,
      variantId: variantId || undefined,
      limit: 200,
    })
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [open, productId, variantId]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-base">Үлдэгдлийн түүх</SheetTitle>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-sm font-semibold">Одоогийн үлдэгдэл: {currentStock}</p>
        </SheetHeader>

        <div className="mt-4 space-y-1">
          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Ачааллаж байна...</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Хөдөлгөөний бичлэг алга</p>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
              {rows.map((r) => {
                const badge = getMovementTypeBadge(r.movement_type);
                const positive = r.quantity_change > 0;
                const zero = r.quantity_change === 0;
                const Icon = positive ? ArrowUp : zero ? Minus : ArrowDown;
                return (
                  <div key={r.id} className="relative pl-10 pb-4">
                    {/* Timeline dot */}
                    <div
                      className={`absolute left-2.5 top-1 w-3 h-3 rounded-full border-2 border-background ${
                        positive ? "bg-green-500" : zero ? "bg-muted-foreground" : "bg-destructive"
                      }`}
                    />
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${badge.color}`}>
                            {badge.label}
                          </Badge>
                          <span className="text-[11px] text-muted-foreground">
                            {format(new Date(r.created_at), "yyyy-MM-dd HH:mm")}
                          </span>
                        </div>
                        {(r.reason || r.note) && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {r.reason || r.note}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <div
                          className={`flex items-center gap-0.5 font-semibold text-sm ${
                            positive ? "text-green-600" : zero ? "text-muted-foreground" : "text-destructive"
                          }`}
                        >
                          <Icon className="h-3 w-3" />
                          {positive ? "+" : ""}
                          {r.quantity_change}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {r.quantity_before} → {r.quantity_after}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
