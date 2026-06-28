import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Search, User, Phone, MapPin } from "lucide-react";
import {
  createManualOrder,
  ORDER_SOURCES,
  PAYMENT_STATUSES,
  formatCurrency,
  type ManualOrderItem,
  type OrderSource,
} from "@/lib/orderService";
import { triggerDeliverySync } from "@/lib/deliverySync";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreateOrderDialog({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Customer
  const [source, setSource] = useState<OrderSource>("phone");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [alternatePhone, setAlternatePhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerNote, setCustomerNote] = useState("");

  // Delivery
  const [district, setDistrict] = useState("");
  const [addressText, setAddressText] = useState("");
  const [deliveryNote, setDeliveryNote] = useState("");
  const [deliveryFee, setDeliveryFee] = useState("0");

  // Payment
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentStatus, setPaymentStatus] = useState<string>("");

  // Fulfillment location (branch / driver)
  const [fulfillmentLocationId, setFulfillmentLocationId] = useState<string>("");

  // Order
  const [internalNote, setInternalNote] = useState("");
  const [affectsInventory, setAffectsInventory] = useState(true);
  const [items, setItems] = useState<(ManualOrderItem & { image_url?: string })[]>([]);

  // Product search
  const [productSearch, setProductSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [matchedUserId, setMatchedUserId] = useState<string | null>(null);

  // Stock locations (branches / drivers)
  const { data: locations } = useQuery({
    queryKey: ["admin", "stock-locations-active"],
    queryFn: async () => {
      const { data } = await supabase
        .from("stock_locations")
        .select("id, name, icon, color")
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      return data || [];
    },
  });


  // Search products
  const { data: products } = useQuery({
    queryKey: ["admin", "products-search", productSearch],
    queryFn: async () => {
      if (!productSearch || productSearch.length < 2) return [];
      const { data } = await supabase
        .from("products")
        .select("id, name, name_mn, price, stock, images, sku")
        .or(`name.ilike.%${productSearch}%,name_mn.ilike.%${productSearch}%,sku.ilike.%${productSearch}%`)
        .eq("is_active", true)
        .limit(10);
      return data || [];
    },
    enabled: productSearch.length >= 2,
  });

  // Customer lookup
  const { data: customerResults } = useQuery({
    queryKey: ["admin", "customer-lookup", customerSearch],
    queryFn: async () => {
      if (!customerSearch || customerSearch.length < 3) return [];
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, phone")
        .or(`phone.ilike.%${customerSearch}%,full_name.ilike.%${customerSearch}%,email.ilike.%${customerSearch}%`)
        .limit(5);
      return data || [];
    },
    enabled: customerSearch.length >= 3,
  });

  const addProduct = (product: any) => {
    const existing = items.find((i) => i.product_id === product.id);
    if (existing) {
      setItems(items.map((i) =>
        i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i
      ));
    } else {
      setItems([...items, {
        product_id: product.id,
        product_name: product.name_mn || product.name,
        sku: product.sku,
        unit_price: product.price,
        quantity: 1,
        image_url: product.images?.[0],
      }]);
    }
    setProductSearch("");
  };

  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const updateQty = (idx: number, qty: number) => {
    if (qty < 1) return;
    setItems(items.map((item, i) => i === idx ? { ...item, quantity: qty } : item));
  };

  const selectCustomer = (profile: any) => {
    setCustomerName(profile.full_name || "");
    setCustomerPhone(profile.phone || "");
    setCustomerEmail(profile.email || "");
    setMatchedUserId(profile.user_id);
    setCustomerSearch("");
  };

  const subtotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const fee = parseFloat(deliveryFee) || 0;
  const total = subtotal + fee;

  const createMutation = useMutation({
    mutationFn: async () => {
      if (items.length === 0) throw new Error("Заавал бараа сонгоно уу");
      if (!customerPhone && !customerName) throw new Error("Захиалагчийн мэдээлэл оруулна уу");
      if (!paymentStatus) throw new Error("Төлбөр төлөгдсөн эсэхийг заавал сонгоно уу");
      if (!fulfillmentLocationId) throw new Error("Аль салбар / жолоочоос гарсныг заавал сонгоно уу");

      return createManualOrder({
        source,
        customer_name: customerName,
        customer_phone: customerPhone,
        alternate_phone: alternatePhone,
        customer_email: customerEmail,
        fulfillment_status: "confirmed",
        payment_status: paymentStatus,
        payment_method: paymentMethod,
        address_text: addressText,
        delivery_note: deliveryNote,
        district,
        delivery_fee: fee,
        discount_amount: 0,
        internal_note: internalNote,
        customer_note: customerNote,
        affects_inventory: affectsInventory,
        items,
        user_id: matchedUserId,
        fulfillment_location_id: fulfillmentLocationId,
      });
    },
    onSuccess: (order) => {
      if (order?.id) {
        triggerDeliverySync(order.id);
      }
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "delivery-orders"] });
      toast({ title: "Захиалга үүсгэгдлээ" });
      resetForm();
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "Алдаа", description: e.message, variant: "destructive" }),
  });

  const resetForm = () => {
    setSource("phone");
    setCustomerName(""); setCustomerPhone(""); setAlternatePhone(""); setCustomerEmail("");
    setCustomerNote(""); setDistrict(""); setAddressText(""); setDeliveryNote("");
    setDeliveryFee("0"); setPaymentMethod("cash"); setPaymentStatus("");
    setFulfillmentLocationId("");
    setInternalNote(""); setAffectsInventory(true); setItems([]); setMatchedUserId(null);
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Захиалга үүсгэх</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Source */}
          <div className="space-y-2">
            <Label>Эх үүсвэр / Суваг *</Label>
            <Select value={source} onValueChange={(v) => setSource(v as OrderSource)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ORDER_SOURCES.filter(s => s.value !== "website").map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Customer lookup */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1"><User className="h-3.5 w-3.5" />Захиалагч хайх</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Утас, нэр, имэйл..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            {customerResults && customerResults.length > 0 && (
              <div className="border rounded-md divide-y max-h-32 overflow-y-auto">
                {customerResults.map((p: any) => (
                  <button
                    key={p.user_id}
                    className="w-full text-left px-3 py-2 hover:bg-muted/50 text-sm"
                    onClick={() => selectCustomer(p)}
                  >
                    <div className="font-medium">{p.full_name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{p.phone} · {p.email}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Customer info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Нэр</Label>
              <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Захиалагчийн нэр" />
            </div>
            <div className="space-y-1">
              <Label>Утас *</Label>
              <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="99001122" />
            </div>
            <div className="space-y-1">
              <Label>Нэмэлт утас</Label>
              <Input value={alternatePhone} onChange={(e) => setAlternatePhone(e.target.value)} placeholder="Нэмэлт утас" />
            </div>
            <div className="space-y-1">
              <Label>Имэйл</Label>
              <Input value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="email@example.com" />
            </div>
          </div>

          {/* Delivery */}
          <div className="space-y-3">
            <Label className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />Хүргэлтийн мэдээлэл</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Дүүрэг / Бүс</Label>
                <Input value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="Баянзүрх" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Хүргэлтийн төлбөр (₮)</Label>
                <Input type="number" value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value)} min="0" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Дэлгэрэнгүй хаяг</Label>
              <Textarea value={addressText} onChange={(e) => setAddressText(e.target.value)} rows={2} placeholder="Байр, орц, тоот..." />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Хүргэлтийн тэмдэглэл</Label>
              <Input value={deliveryNote} onChange={(e) => setDeliveryNote(e.target.value)} placeholder="Чиглэл, ландмарк..." />
            </div>
          </div>

          {/* Products */}
          <div className="space-y-3">
            <Label className="flex items-center gap-1">
              Бараа сонгох <span className="text-destructive">*</span>
              {items.length === 0 && (
                <span className="ml-2 text-xs font-normal text-destructive">— заавал зөв барааг сонгоно уу</span>
              )}
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Барааны нэр, SKU хайх..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className={`pl-10 ${items.length === 0 ? "border-destructive/60 focus-visible:ring-destructive" : ""}`}
              />
            </div>
            {products && products.length > 0 && (
              <div className="border rounded-md divide-y max-h-40 overflow-y-auto">
                {products.map((p: any) => (
                  <button
                    key={p.id}
                    className="w-full text-left px-3 py-2 hover:bg-muted/50 text-sm flex items-center gap-3"
                    onClick={() => addProduct(p)}
                  >
                    {p.images?.[0] && <img src={p.images[0]} className="w-8 h-8 rounded object-contain border" alt="" />}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{p.name_mn || p.name}</div>
                      <div className="text-xs text-muted-foreground">{formatCurrency(p.price)} · Үлдэгдэл: {p.stock}</div>
                    </div>
                    <Plus className="h-4 w-4 text-primary shrink-0" />
                  </button>
                ))}
              </div>
            )}

            {/* Added items */}
            {items.length > 0 && (
              <div className="space-y-2 border rounded-md p-3">
                {items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    {item.image_url && <img src={item.image_url} className="w-8 h-8 rounded object-contain border" alt="" />}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{item.product_name}</div>
                      <div className="text-xs text-muted-foreground">{formatCurrency(item.unit_price)}</div>
                    </div>
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateQty(idx, parseInt(e.target.value) || 1)}
                      className="w-16 h-8 text-center text-sm"
                      min="1"
                    />
                    <span className="text-sm font-medium w-24 text-right">{formatCurrency(item.unit_price * item.quantity)}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeItem(idx)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Fulfillment Location (branch / driver) */}
          <div className="space-y-1">
            <Label className="flex items-center gap-1">
              Аль салбар / жолоочоос гарсан <span className="text-destructive">*</span>
            </Label>
            <Select value={fulfillmentLocationId} onValueChange={setFulfillmentLocationId}>
              <SelectTrigger className={!fulfillmentLocationId ? "border-destructive/60" : ""}>
                <SelectValue placeholder="Салбар эсвэл жолоочоо сонгоно уу" />
              </SelectTrigger>
              <SelectContent>
                {(locations || []).map((loc: any) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.icon ? `${loc.icon} ` : ""}{loc.name}
                  </SelectItem>
                ))}
                {(!locations || locations.length === 0) && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    Идэвхтэй салбар алга — Үлдэгдэл цэснээс нэмнэ үү
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>


          {/* Payment */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Төлбөрийн арга</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Бэлнээр</SelectItem>
                  <SelectItem value="transfer">Шилжүүлэг</SelectItem>
                  <SelectItem value="qpay">QPay</SelectItem>
                  <SelectItem value="card">Карт</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="flex items-center gap-1">
                Төлбөр төлөгдсөн эсэх <span className="text-destructive">*</span>
              </Label>
              <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                <SelectTrigger className={!paymentStatus ? "border-destructive/60" : ""}>
                  <SelectValue placeholder="Төлбөр орсон / ороогүйг сонгоно уу" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

          </div>

          {/* Notes & options */}
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Захиалагчийн тэмдэглэл</Label>
              <Textarea value={customerNote} onChange={(e) => setCustomerNote(e.target.value)} rows={2} placeholder="Захиалагчаас..." />
            </div>
            <div className="space-y-1">
              <Label>Дотоод тэмдэглэл</Label>
              <Textarea value={internalNote} onChange={(e) => setInternalNote(e.target.value)} rows={2} placeholder="Зөвхөн ажилтнуудад..." />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={affectsInventory} onCheckedChange={setAffectsInventory} />
              <Label>Нөөцөд нөлөөлөх</Label>
              {!affectsInventory && <Badge variant="outline" className="text-xs">Түүхэн бүртгэл</Badge>}
            </div>
          </div>

          {/* Totals */}
          <div className="border-t pt-3 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Барааны дүн:</span><span>{formatCurrency(subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Хүргэлт:</span><span>{formatCurrency(fee)}</span></div>
            <div className="flex justify-between font-bold text-base border-t pt-1.5"><span>Нийт:</span><span>{formatCurrency(total)}</span></div>
          </div>

          {/* Actions */}
          <div className="space-y-2 pt-2">
            {(items.length === 0 || !paymentStatus || !fulfillmentLocationId) && (
              <div className="text-xs text-destructive">
                Үргэлжлүүлэхийн тулд: бараа сонгох, төлбөрийн төлөв сонгох, салбар/жолооч сонгох шаардлагатай.
              </div>
            )}
            <div className="flex gap-3">
              <Button
                className="flex-1"
                onClick={() => createMutation.mutate()}
                disabled={
                  createMutation.isPending ||
                  items.length === 0 ||
                  !paymentStatus ||
                  !fulfillmentLocationId
                }
              >
                {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Захиалга үүсгэх
              </Button>
            </div>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
