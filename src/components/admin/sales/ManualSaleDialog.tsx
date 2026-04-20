import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Trash2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  createManualSale,
  findPotentialDuplicate,
  SALE_SOURCE_TYPES,
  type CreateManualSaleParams,
  type ManualSaleItemInput,
} from "@/lib/sales/salesService";
import { ProductPicker, type PickedProduct } from "./ProductPicker";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultHistorical?: boolean;
}

interface LineItem extends PickedProduct {
  quantity: number;
}

export function ManualSaleDialog({ open, onOpenChange, defaultHistorical = false }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [items, setItems] = useState<LineItem[]>([]);
  const [sourceType, setSourceType] = useState<string>(
    defaultHistorical ? "historical_sale" : "admin_manual_sale"
  );
  const [saleDate, setSaleDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentStatus, setPaymentStatus] = useState<"paid" | "unpaid">("paid");
  const [discount, setDiscount] = useState("0");
  const [deliveryFee, setDeliveryFee] = useState("0");
  const [notes, setNotes] = useState("");
  const [addressText, setAddressText] = useState("");
  const [affectsInventory, setAffectsInventory] = useState(true);
  const [shouldCreateDelivery, setShouldCreateDelivery] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<any[] | null>(null);
  const [forceSubmit, setForceSubmit] = useState(false);

  const isHistorical = sourceType === "historical_sale";

  const subtotal = useMemo(
    () => items.reduce((s, i) => s + i.unit_price * i.quantity, 0),
    [items]
  );
  const total = subtotal - Number(discount || 0) + Number(deliveryFee || 0);

  const reset = () => {
    setItems([]);
    setSourceType(defaultHistorical ? "historical_sale" : "admin_manual_sale");
    setSaleDate(new Date().toISOString().slice(0, 16));
    setCustomerName("");
    setCustomerPhone("");
    setPaymentMethod("cash");
    setPaymentStatus("paid");
    setDiscount("0");
    setDeliveryFee("0");
    setNotes("");
    setAddressText("");
    setAffectsInventory(true);
    setShouldCreateDelivery(false);
    setDuplicateWarning(null);
    setForceSubmit(false);
  };

  const mutation = useMutation({
    mutationFn: async (params: CreateManualSaleParams) => createManualSale(params),
    onSuccess: async (orderId, params) => {
      const { logAudit } = await import("@/lib/audit/auditService");
      await logAudit({
        action: params.is_historical ? "historical_import" : "manual_sale",
        entity_type: "order",
        entity_id: orderId,
        details: {
          source_type: params.source_type,
          total_items: params.items.length,
          customer_phone: params.customer_phone,
        },
      });
      toast({ title: "Борлуулалт амжилттай үүслээ" });
      qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      qc.invalidateQueries({ queryKey: ["admin", "sales"] });
      reset();
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({
        title: "Алдаа гарлаа",
        description: err?.message || String(err),
        variant: "destructive",
      });
    },
  });

  const handleAdd = (p: PickedProduct) => {
    setItems((prev) => {
      const existing = prev.find(
        (i) => i.product_id === p.product_id && i.variant_id === p.variant_id
      );
      if (existing) {
        return prev.map((i) =>
          i === existing ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { ...p, quantity: 1 }];
    });
  };

  const updateItem = (idx: number, patch: Partial<LineItem>) => {
    setItems((prev) => prev.map((i, k) => (k === idx ? { ...i, ...patch } : i)));
  };
  const removeItem = (idx: number) =>
    setItems((prev) => prev.filter((_, k) => k !== idx));

  const buildParams = (): CreateManualSaleParams => ({
    source_type: sourceType as any,
    is_historical: isHistorical,
    sale_date: new Date(saleDate).toISOString(),
    customer_name: customerName || null,
    customer_phone: customerPhone || null,
    customer_email: null,
    payment_method: paymentMethod,
    payment_status: paymentStatus,
    fulfillment_status: paymentStatus === "paid" ? "delivered" : "confirmed",
    should_create_delivery: shouldCreateDelivery,
    affects_inventory: affectsInventory,
    affects_analytics: true,
    affects_revenue: true,
    discount_amount: Number(discount || 0),
    delivery_fee: Number(deliveryFee || 0),
    notes: notes || null,
    internal_note: null,
    address_text: addressText || null,
    items: items.map<ManualSaleItemInput>((i) => ({
      product_id: i.product_id,
      variant_id: i.variant_id,
      product_name: i.product_name,
      sku: i.sku,
      variant_name: i.variant_name,
      color: i.color,
      size: i.size,
      unit_price: i.unit_price,
      unit_cost: i.unit_cost || 0,
      quantity: i.quantity,
    })),
  });

  const handleSubmit = async () => {
    if (items.length === 0) {
      toast({ title: "Бараа сонгоно уу", variant: "destructive" });
      return;
    }

    // Stock validation
    const overStock = items.find((i) => affectsInventory && i.quantity > i.stock);
    if (overStock && !forceSubmit) {
      toast({
        title: `${overStock.product_name} — нөөц хүрэлцэхгүй`,
        description: `Үлдэгдэл: ${overStock.stock}`,
        variant: "destructive",
      });
      return;
    }

    // Duplicate check for historical
    if (isHistorical && customerPhone && !forceSubmit) {
      const dups = await findPotentialDuplicate(
        customerPhone,
        new Date(saleDate).toISOString(),
        total
      );
      if (dups.length > 0) {
        setDuplicateWarning(dups);
        return;
      }
    }

    mutation.mutate(buildParams());
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isHistorical ? "Түүхэн борлуулалт оруулах" : "Гар захиалга оруулах"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Source + Date */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Эх үүсвэр</Label>
                <Select value={sourceType} onValueChange={setSourceType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SALE_SOURCE_TYPES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Огноо / цаг</Label>
                <Input
                  type="datetime-local"
                  value={saleDate}
                  onChange={(e) => setSaleDate(e.target.value)}
                />
              </div>
            </div>

            {/* Items */}
            <div className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-medium text-sm">Бараа</div>
                <ProductPicker onPick={handleAdd} />
              </div>
              {items.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-6">
                  Бараа сонгоогүй
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map((i, idx) => {
                    const lowStock = affectsInventory && i.quantity > i.stock;
                    return (
                      <div
                        key={idx}
                        className="grid grid-cols-12 gap-2 items-center p-2 border rounded"
                      >
                        <div className="col-span-5 text-sm">
                          <div className="font-medium">{i.product_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {[i.color, i.size, i.variant_name].filter(Boolean).join(" / ") || ""}
                            {" · "}Үлдэгдэл: <Badge variant={i.stock > 0 ? "outline" : "destructive"} className="ml-1">{i.stock}</Badge>
                          </div>
                        </div>
                        <Input
                          type="number"
                          min={1}
                          value={i.quantity}
                          onChange={(e) =>
                            updateItem(idx, { quantity: Math.max(1, Number(e.target.value)) })
                          }
                          className={`col-span-2 ${lowStock ? "border-destructive" : ""}`}
                        />
                        <Input
                          type="number"
                          value={i.unit_price}
                          onChange={(e) => updateItem(idx, { unit_price: Number(e.target.value) })}
                          className="col-span-2"
                        />
                        <Input
                          type="number"
                          placeholder="Өртөг"
                          value={i.unit_cost || 0}
                          onChange={(e) => updateItem(idx, { unit_cost: Number(e.target.value) })}
                          className="col-span-2"
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => removeItem(idx)}
                          className="col-span-1"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Customer */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Үйлчлүүлэгчийн нэр</Label>
                <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
              </div>
              <div>
                <Label>Утас</Label>
                <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
              </div>
            </div>

            <div>
              <Label>Хаяг (заавал биш)</Label>
              <Input value={addressText} onChange={(e) => setAddressText(e.target.value)} />
            </div>

            {/* Payment */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <Label>Төлбөрийн арга</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Бэлэн</SelectItem>
                    <SelectItem value="transfer">Дансаар</SelectItem>
                    <SelectItem value="qpay">QPay</SelectItem>
                    <SelectItem value="card">Карт</SelectItem>
                    <SelectItem value="other">Бусад</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Төлбөрийн төлөв</Label>
                <Select value={paymentStatus} onValueChange={(v) => setPaymentStatus(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">Төлөгдсөн</SelectItem>
                    <SelectItem value="unpaid">Төлөгдөөгүй</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Хямдрал</Label>
                <Input
                  type="number"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                />
              </div>
              <div>
                <Label>Хүргэлт</Label>
                <Input
                  type="number"
                  value={deliveryFee}
                  onChange={(e) => setDeliveryFee(e.target.value)}
                />
              </div>
            </div>

            {/* Toggles */}
            <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">Нөөцөөс хасах</Label>
                  <p className="text-xs text-muted-foreground">
                    Үлдэгдэлээс барааг хасах
                  </p>
                </div>
                <Switch checked={affectsInventory} onCheckedChange={setAffectsInventory} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">Хүргэлтийн хүсэлт автоматаар үүсгэх</Label>
                  <p className="text-xs text-muted-foreground">
                    Идэвхгүй үед: ямар ч хүргэлтийн API дуудагдахгүй
                  </p>
                </div>
                <Switch checked={shouldCreateDelivery} onCheckedChange={setShouldCreateDelivery} />
              </div>
            </div>

            <div>
              <Label>Тэмдэглэл</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>

            {/* Total */}
            <div className="border-t pt-3 flex justify-between text-sm">
              <div>
                Дэд дүн: <strong>{subtotal.toLocaleString()}₮</strong>
              </div>
              <div className="text-lg font-bold">
                Нийт: {total.toLocaleString()}₮
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Цуцлах
            </Button>
            <Button onClick={handleSubmit} disabled={mutation.isPending}>
              {mutation.isPending ? "Хадгалж байна..." : "Хадгалах"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!duplicateWarning} onOpenChange={() => setDuplicateWarning(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              Боломжит давхардал илэрлээ
            </AlertDialogTitle>
            <AlertDialogDescription>
              Энэ утас, огноо, дүнтэй ижил {duplicateWarning?.length} захиалга олдсон.
              Үргэлжлүүлж хадгалах уу?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="text-xs space-y-1 max-h-40 overflow-y-auto">
            {duplicateWarning?.map((d) => (
              <div key={d.order_id} className="p-2 bg-muted rounded">
                <strong>{d.order_number}</strong> · {d.total.toLocaleString()}₮ ·{" "}
                {new Date(d.sale_date).toLocaleString()}
              </div>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDuplicateWarning(null)}>
              Цуцлах
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setForceSubmit(true);
                setDuplicateWarning(null);
                mutation.mutate(buildParams());
              }}
            >
              Үргэлжлүүлэх
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
