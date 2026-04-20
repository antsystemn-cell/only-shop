import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { adjustStock } from "@/lib/inventory/stockService";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  productId?: string | null;
  variantId?: string | null;
  currentStock: number;
  label: string;
  onDone?: () => void;
}

const TYPES = [
  { value: "restock", label: "Нөхөн дүүргэлт (+)" },
  { value: "manual_adjust", label: "Гараар тохируулга (±)" },
  { value: "return_to_stock", label: "Буцаалт (+)" },
  { value: "damaged_lost", label: "Эвдрэл/Алдагдал (−)" },
] as const;

export function StockAdjustmentDialog({
  open,
  onOpenChange,
  productId,
  variantId,
  currentStock,
  label,
  onDone,
}: Props) {
  const [movementType, setMovementType] = useState<(typeof TYPES)[number]["value"]>("restock");
  const [qty, setQty] = useState("1");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const change = (parseInt(qty || "0", 10) || 0) * (movementType === "damaged_lost" ? -1 : 1);
  const after = currentStock + (movementType === "manual_adjust" ? (parseInt(qty || "0", 10) || 0) : change);

  const submit = async () => {
    if (!qty || parseInt(qty, 10) === 0) {
      toast.error("Тоо хэмжээ оруулна уу");
      return;
    }
    setSaving(true);
    try {
      let finalChange = parseInt(qty, 10);
      if (movementType === "damaged_lost") finalChange = -Math.abs(finalChange);
      else if (movementType === "restock" || movementType === "return_to_stock")
        finalChange = Math.abs(finalChange);
      else if (movementType === "manual_adjust") finalChange = parseInt(qty, 10);

      await adjustStock({
        product_id: productId || null,
        variant_id: variantId || null,
        quantity_change: finalChange,
        movement_type: movementType,
        reason: reason || undefined,
        note: note || undefined,
      });
      toast.success("Үлдэгдэл шинэчлэгдлээ");
      onDone?.();
      onOpenChange(false);
      setQty("1");
      setReason("");
      setNote("");
    } catch (e: any) {
      toast.error(e.message || "Алдаа гарлаа");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Үлдэгдэл тохируулга</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg bg-muted p-3 text-sm">
            <div className="font-medium">{label}</div>
            <div className="text-muted-foreground">Одоогийн үлдэгдэл: {currentStock}</div>
          </div>

          <div className="space-y-2">
            <Label>Төрөл</Label>
            <Select value={movementType} onValueChange={(v) => setMovementType(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>
              Тоо хэмжээ {movementType === "manual_adjust" && "(сөрөг тоо бичиж болно)"}
            </Label>
            <Input
              type="number"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder={movementType === "manual_adjust" ? "Жишээ: -3 эсвэл 5" : "Жишээ: 10"}
            />
            <div className="text-xs text-muted-foreground">
              Шинэ үлдэгдэл: <span className="font-semibold text-foreground">{after}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Шалтгаан (заавал биш)</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Жишээ: Агуулахаас ирсэн" />
          </div>

          <div className="space-y-2">
            <Label>Тэмдэглэл</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Цуцлах
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Хадгалж байна..." : "Хадгалах"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
