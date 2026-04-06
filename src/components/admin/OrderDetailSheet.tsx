import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import {
  ShoppingCart, User, MapPin, Phone, Mail,
  Package, MessageSquare, Clock, Printer, RefreshCw, Cloud, CloudOff,
} from "lucide-react";
import { printDeliveryLabel } from "@/components/admin/DeliveryLabelPrint";
import { retryDeliverySync } from "@/lib/deliverySync";
import { format } from "date-fns";
import {
  FULFILLMENT_STATUSES,
  PAYMENT_STATUSES,
  getFulfillmentBadge,
  getPaymentBadge,
  getSourceLabel,
  formatCurrency,
} from "@/lib/orderService";

interface OrderDetailSheetProps {
  order: any;
  open: boolean;
  onClose: () => void;
  onFulfillmentChange: (oldS: string, newS: string) => void;
  onPaymentChange: (oldS: string, newS: string) => void;
  isMobile: boolean;
}

function SyncRetryButton({ orderId }: { orderId: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const mutation = useMutation({
    mutationFn: () => retryDeliverySync(orderId).then(r => { if (!r.success) throw new Error(r.error); return r; }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin"] }); toast({ title: "Синк амжилттай" }); },
    onError: (e: any) => toast({ title: "Синк алдаа", description: e.message, variant: "destructive" }),
  });
  return (
    <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
      <RefreshCw className={`h-3 w-3 mr-1 ${mutation.isPending ? "animate-spin" : ""}`} />Дахин
    </Button>
  );
}

export default function OrderDetailSheet({
  order, open, onClose, onFulfillmentChange, onPaymentChange, isMobile,
}: OrderDetailSheetProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [notes, setNotes] = useState("");

  const { data: statusLogs } = useQuery({
    queryKey: ["order-status-logs", order?.id],
    queryFn: async () => {
      if (!order?.id) return [];
      const { data } = await supabase
        .from("order_status_logs")
        .select("*")
        .eq("order_id", order.id)
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!order?.id && open,
  });

  const saveNotesMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("orders")
        .update({ internal_note: notes } as any)
        .eq("id", order.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      toast({ title: "Тэмдэглэл хадгалагдлаа" });
    },
  });

  if (!order) return null;

  const fb = getFulfillmentBadge((order as any).fulfillment_status || "confirmed");
  const pb = getPaymentBadge(order.payment_status || "pending");
  const deliveryAddress = order.delivery_address || {};
  const cust = order.customer_name || order.profile?.full_name || "—";
  const custPhone = order.customer_phone || order.profile?.phone || "";

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className={`${isMobile ? "w-full" : "w-full sm:max-w-lg"} overflow-y-auto p-0`}>
        <SheetHeader className="p-4 pb-2 sticky top-0 bg-background z-10 border-b">
          <SheetTitle className="flex items-center gap-2 text-base">
            <ShoppingCart className="h-4 w-4" />
            {order.order_number}
            <Button variant="outline" size="sm" className="h-7 ml-auto" onClick={() => printDeliveryLabel(order)}>
              <Printer className="h-3.5 w-3.5 mr-1" />Хэвлэх
            </Button>
            <Badge variant="outline" className="text-[10px]">{getSourceLabel((order as any).source || "website")}</Badge>
          </SheetTitle>
        </SheetHeader>

        <div className="p-4 space-y-4">
          {/* Status controls */}
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="p-3">
                <Label className="text-muted-foreground text-xs">Биелэлт</Label>
                <Select
                  value={(order as any).fulfillment_status || "confirmed"}
                  onValueChange={(v) => onFulfillmentChange((order as any).fulfillment_status || "confirmed", v)}
                >
                  <SelectTrigger className="mt-1 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FULFILLMENT_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <Label className="text-muted-foreground text-xs">Төлбөр</Label>
                <Select
                  value={order.payment_status || "pending"}
                  onValueChange={(v) => onPaymentChange(order.payment_status || "pending", v)}
                >
                  <SelectTrigger className="mt-1 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          </div>

          {/* Financial */}
          <Card>
            <CardContent className="p-3 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Барааны дүн:</span><span>{formatCurrency(Number(order.subtotal))}</span></div>
              {Number((order as any).discount_amount) > 0 && (
                <div className="flex justify-between text-red-600"><span>Хөнгөлөлт:</span><span>-{formatCurrency(Number((order as any).discount_amount))}</span></div>
              )}
              <div className="flex justify-between"><span className="text-muted-foreground">Хүргэлт:</span><span>{formatCurrency(Number(order.delivery_fee))}</span></div>
              <div className="flex justify-between font-bold border-t pt-1.5"><span>Нийт:</span><span>{formatCurrency(Number(order.total))}</span></div>
            </CardContent>
          </Card>

          {/* Delivery Sync Status */}
          {(order as any).fulfillment_status !== "draft" && (
            <Card>
              <CardContent className="p-3 text-sm space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium flex items-center gap-1.5">
                    {(order as any).delivery_sync_status === "synced" ? (
                      <><Cloud className="h-3 w-3 text-green-600" />Хүргэлт синк</>
                    ) : (order as any).delivery_sync_status === "failed" ? (
                      <><CloudOff className="h-3 w-3 text-red-600" />Синк алдаа</>
                    ) : (
                      <><Clock className="h-3 w-3 text-yellow-600" />Синк хүлээгдэж</>
                    )}
                  </span>
                  {((order as any).delivery_sync_status === "failed" || (order as any).delivery_sync_status === "pending") && (
                    <SyncRetryButton orderId={order.id} />
                  )}
                </div>
                {(order as any).delivery_sync_error && (
                  <p className="text-xs text-destructive bg-destructive/10 p-1.5 rounded">{(order as any).delivery_sync_error}</p>
                )}
                {(order as any).delivery_external_id && (
                  <p className="text-xs text-muted-foreground">ID: {(order as any).delivery_external_id}</p>
                )}
                {(order as any).delivery_attempt_count > 0 && (
                  <p className="text-xs text-muted-foreground">Оролдлого: {(order as any).delivery_attempt_count}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Customer */}
          <Card>
            <CardContent className="p-3 space-y-1.5 text-sm">
              <div className="flex items-center gap-2"><User className="h-3 w-3 text-muted-foreground" />{cust}</div>
              {custPhone && <div className="flex items-center gap-2"><Phone className="h-3 w-3 text-muted-foreground" />{custPhone}</div>}
              {(order.customer_email || order.profile?.email) && (
                <div className="flex items-center gap-2"><Mail className="h-3 w-3 text-muted-foreground" /><span className="truncate">{order.customer_email || order.profile?.email}</span></div>
              )}
              {(order as any).alternate_phone && (
                <div className="flex items-center gap-2"><Phone className="h-3 w-3 text-muted-foreground" />{(order as any).alternate_phone} (нэмэлт)</div>
              )}
            </CardContent>
          </Card>

          {/* Address */}
          {((order as any).address_text || Object.keys(deliveryAddress).length > 0) && (
            <Card>
              <CardContent className="p-3 text-sm space-y-1">
                <div className="flex items-center gap-2 text-xs font-medium"><MapPin className="h-3 w-3" />Хүргэлтийн хаяг</div>
                {deliveryAddress.district && <p className="text-xs text-muted-foreground">{deliveryAddress.city}, {deliveryAddress.district}</p>}
                {(order as any).address_text && <p className="text-xs text-muted-foreground">{(order as any).address_text}</p>}
                {deliveryAddress.street_address && !((order as any).address_text) && <p className="text-xs text-muted-foreground">{deliveryAddress.street_address}</p>}
                {(order as any).delivery_note && <p className="text-xs text-muted-foreground italic">📝 {(order as any).delivery_note}</p>}
                {deliveryAddress.phone && <p className="text-xs text-muted-foreground">Утас: {deliveryAddress.phone}</p>}
              </CardContent>
            </Card>
          )}

          {/* Items */}
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <Package className="h-4 w-4" /> Бараанууд ({order.order_items?.length || 0})
            </h4>
            <div className="space-y-2">
              {order.order_items?.map((item: any) => {
                const snapshot = item.product_snapshot || {};
                const imgSrc = snapshot.imageUrl || snapshot.image_url || snapshot.images?.[0];
                return (
                  <div key={item.id} className="flex gap-3 p-3 border rounded-lg">
                    {imgSrc && <img src={imgSrc} alt="" className="w-12 h-12 rounded object-contain border bg-muted shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium line-clamp-2">{item.product_name_snapshot || snapshot.title || snapshot.name || snapshot.name_mn || "Бараа"}</div>
                      {(item.color_snapshot || item.size_snapshot) && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {item.color_snapshot && `Өнгө: ${item.color_snapshot}`}
                          {item.size_snapshot && ` · ${item.size_snapshot}`}
                        </div>
                      )}
                      {snapshot.configurators && <p className="text-xs text-muted-foreground mt-0.5">🏷️ {snapshot.configurators}</p>}
                      <div className="text-xs text-muted-foreground mt-0.5">{formatCurrency(Number(item.unit_price))} × {item.quantity}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-medium text-sm">{formatCurrency(Number(item.total_price))}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Internal note */}
          <Card>
            <CardContent className="p-3 space-y-2">
              <Label className="text-xs flex items-center gap-1"><MessageSquare className="h-3 w-3" />Дотоод тэмдэглэл</Label>
              <Textarea value={notes || (order as any).internal_note || ""} onChange={(e) => setNotes(e.target.value)} placeholder="Ажилтнуудад..." rows={2} />
              <Button size="sm" onClick={() => saveNotesMutation.mutate()}>Хадгалах</Button>
            </CardContent>
          </Card>

          {/* Status history */}
          {statusLogs && statusLogs.length > 0 && (
            <Card>
              <CardContent className="p-3">
                <Label className="text-xs flex items-center gap-1 mb-2"><Clock className="h-3 w-3" />Төлвийн түүх</Label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {statusLogs.map((log: any) => (
                    <div key={log.id} className="text-xs border-l-2 border-primary/20 pl-2 py-1">
                      <div className="text-muted-foreground">{format(new Date(log.created_at), "MM/dd HH:mm")}</div>
                      {log.new_fulfillment_status && (
                        <div>Биелэлт: {log.old_fulfillment_status || "—"} → <strong>{log.new_fulfillment_status}</strong></div>
                      )}
                      {log.new_payment_status && (
                        <div>Төлбөр: {log.old_payment_status || "—"} → <strong>{log.new_payment_status}</strong></div>
                      )}
                      {log.note && <div className="text-muted-foreground italic">{log.note}</div>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Timeline */}
          <Card>
            <CardContent className="p-3 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground text-xs">Үүсгэсэн:</span><span className="text-xs">{format(new Date(order.created_at), "yyyy-MM-dd HH:mm")}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground text-xs">Шинэчилсэн:</span><span className="text-xs">{format(new Date(order.updated_at), "yyyy-MM-dd HH:mm")}</span></div>
              {(order as any).confirmed_at && <div className="flex justify-between"><span className="text-muted-foreground text-xs">Баталгаажсан:</span><span className="text-xs">{format(new Date((order as any).confirmed_at), "yyyy-MM-dd HH:mm")}</span></div>}
              {(order as any).delivered_at && <div className="flex justify-between"><span className="text-muted-foreground text-xs">Хүргэгдсэн:</span><span className="text-xs">{format(new Date((order as any).delivered_at), "yyyy-MM-dd HH:mm")}</span></div>}
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}
