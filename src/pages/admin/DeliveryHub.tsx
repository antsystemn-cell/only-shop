import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Truck, Search, RefreshCw, Phone, Trash2, Printer, Store, User,
  Cloud, CloudOff, Clock, Package, AlertTriangle,
} from "lucide-react";
import { retryDeliverySync, retryAllFailedSyncs } from "@/lib/deliverySync";
import { formatCurrency, updateFulfillmentStatus, updatePaymentStatus } from "@/lib/orderService";

// Invalidate every downstream order list so Захиалга page & sidebar stats
// reflect DeliveryHub actions immediately.
const ORDER_QUERY_KEYS = [
  ["admin", "delivery-hub-orders"],
  ["admin", "orders-unified"],
  ["admin", "orders", "header-stats"],
  ["admin", "delivery-orders"],
];

// ------- Local status vocab (matches storefront DB values) -------
const FULFILLMENT_LABELS: Record<string, string> = {
  new: "Захиалга авсан",
  confirmed: "Захиалга баталгаажсан",
  preparing: "Бэлтгэгдэж буй",
  shipped: "Хүргэлтэнд гарсан",
  delivered: "Хүргэгдсэн",
  cancelled: "Цуцлагдсан",
};
const PAYMENT_LABELS: Record<string, string> = {
  pending: "Төлөгдөөгүй",
  paid: "Төлөгдсөн",
  refunded: "Буцаагдсан",
  failed: "Амжилтгүй",
};

// Border color of the card left stripe per fulfillment status
const BORDER_COLORS: Record<string, string> = {
  new: "border-l-amber-400",
  confirmed: "border-l-amber-500",
  preparing: "border-l-blue-400",
  shipped: "border-l-indigo-500",
  delivered: "border-l-green-500",
  cancelled: "border-l-red-500",
};
const BG_COLORS: Record<string, string> = {
  new: "bg-amber-50/40",
  confirmed: "bg-amber-50/40",
  preparing: "bg-blue-50/40",
  shipped: "bg-indigo-50/40",
  delivered: "bg-green-50/40",
  cancelled: "bg-red-50/30",
};

const SYNC_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  synced: { label: "Синк ✓", color: "bg-green-100 text-green-700", icon: Cloud },
  failed: { label: "Синк ✗", color: "bg-red-100 text-red-700", icon: CloudOff },
  pending: { label: "Хүлээгдэж", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  disabled: { label: "Идэвхгүй", color: "bg-gray-100 text-gray-600", icon: CloudOff },
};

function formatDate(iso: string) {
  const d = new Date(iso);
  const MONTHS = ["1-р сар","2-р сар","3-р сар","4-р сар","5-р сар","6-р сар","7-р сар","8-р сар","9-р сар","10-р сар","11-р сар","12-р сар"];
  return {
    day: d.getDate(),
    month: MONTHS[d.getMonth()],
    time: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
  };
}

export default function DeliveryHub() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [syncFilter, setSyncFilter] = useState("all");
  const [hubStatusMap, setHubStatusMap] = useState<Record<string, any>>({});
  const [checkingIds, setCheckingIds] = useState<Set<string>>(new Set());
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: orders, isLoading } = useQuery({
    queryKey: ["admin", "delivery-hub-orders", search, statusFilter, syncFilter],
    queryFn: async () => {
      let q = supabase
        .from("orders")
        .select("id, order_number, customer_name, customer_phone, address_text, total, created_at, fulfillment_status, payment_status, delivery_sync_status, delivery_sync_error, delivery_external_id, source, order_items(id, quantity, product_name_snapshot)")
        .not("delivery_creation_mode", "eq", "none")
        .order("created_at", { ascending: false })
        .limit(300);
      if (statusFilter !== "all") q = q.eq("fulfillment_status", statusFilter);
      if (syncFilter !== "all") q = q.eq("delivery_sync_status", syncFilter as any);
      if (search) q = q.or(`order_number.ilike.%${search}%,customer_name.ilike.%${search}%,customer_phone.ilike.%${search}%,delivery_external_id.ilike.%${search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30_000,
  });

  const stats = {
    total: orders?.length || 0,
    synced: orders?.filter((o: any) => o.delivery_sync_status === "synced").length || 0,
    pending: orders?.filter((o: any) => o.delivery_sync_status === "pending").length || 0,
    failed: orders?.filter((o: any) => o.delivery_sync_status === "failed").length || 0,
  };

  // Auto-fetch Hub status once for synced orders so driver info appears without a click
  useEffect(() => {
    if (!orders) return;
    const targets = orders.filter(
      (o: any) => o.delivery_external_id && o.delivery_sync_status === "synced" && !hubStatusMap[o.id]
    ).slice(0, 25);
    if (!targets.length) return;
    (async () => {
      for (const o of targets) {
        try {
          const { data } = await supabase.functions.invoke("delivery-hub-proxy", {
            body: { action: "status_check", external_order_id: (o as any).delivery_external_id },
          });
          if (data) setHubStatusMap((m) => ({ ...m, [(o as any).id]: data }));
        } catch { /* ignore */ }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);

  const invalidateAll = () => {
    ORDER_QUERY_KEYS.forEach((k) => qc.invalidateQueries({ queryKey: k }));
  };

  // Push status/payment/driver changes to Swift Delivery Hub via portal proxy.
  const pushHub = async (payload: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("delivery-hub-proxy", { body: payload });
    if (error) throw new Error(error.message);
    if ((data as any)?.error) throw new Error((data as any).error);
    return data;
  };

  const updateFulfillment = useMutation({
    mutationFn: async ({ id, oldStatus, status, external }: { id: string; oldStatus: string; status: string; external?: string | null }) => {
      // Local update — writes status logs & fires delivery-notify-outbound.
      await updateFulfillmentStatus(id, oldStatus, status);
      // Also push through partner-portal so the Hub UI reflects it live.
      if (external) {
        try { await pushHub({ action: "update_fulfillment", order_id: id, status }); }
        catch (e: any) { console.warn("Hub sync (fulfillment) failed:", e.message); }
      }
    },
    onSuccess: () => { invalidateAll(); toast({ title: "Төлөв шинэчлэгдлээ" }); },
    onError: (e: any) => toast({ title: "Алдаа", description: e.message, variant: "destructive" }),
  });

  const updatePayment = useMutation({
    mutationFn: async ({ id, oldStatus, status, external }: { id: string; oldStatus: string; status: string; external?: string | null }) => {
      await updatePaymentStatus(id, oldStatus, status);
      if (external) {
        try { await pushHub({ action: "update_payment", order_id: id, status }); }
        catch (e: any) { console.warn("Hub sync (payment) failed:", e.message); }
      }
    },
    onSuccess: () => { invalidateAll(); toast({ title: "Төлбөрийн төлөв шинэчлэгдлээ" }); },
    onError: (e: any) => toast({ title: "Алдаа", description: e.message, variant: "destructive" }),
  });

  const assignDriver = useMutation({
    mutationFn: async ({ id, driver_id }: { id: string; driver_id: string | null }) => {
      await pushHub({ action: "assign_driver", order_id: id, driver_id });
      // Refresh Hub-side info for this order so the driver name appears.
      try {
        const { data } = await supabase.functions.invoke("delivery-hub-proxy", {
          body: { action: "status_check", order_id: id },
        });
        if (data) setHubStatusMap((m) => ({ ...m, [id]: data }));
      } catch { /* noop */ }
    },
    onSuccess: () => { invalidateAll(); toast({ title: "Жолооч хуваарилагдлаа" }); },
    onError: (e: any) => toast({ title: "Хуваарилах алдаа", description: e.message, variant: "destructive" }),
  });

  const deleteOrder = useMutation({
    mutationFn: async (id: string) => {
      const { error: itemsErr } = await supabase.from("order_items").delete().eq("order_id", id);
      if (itemsErr) throw itemsErr;
      const { error } = await supabase.from("orders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); toast({ title: "Захиалга устгагдлаа" }); },
    onError: (e: any) => toast({ title: "Алдаа", description: e.message, variant: "destructive" }),
  });

  const retryOne = useMutation({
    mutationFn: async (id: string) => {
      const r = await retryDeliverySync(id);
      if (!r.success) throw new Error(r.error);
      return r;
    },
    onSuccess: () => { invalidateAll(); toast({ title: "Синк амжилттай" }); },
    onError: (e: any) => toast({ title: "Синк алдаа", description: e.message, variant: "destructive" }),
  });

  const retryAll = useMutation({
    mutationFn: retryAllFailedSyncs,
    onSuccess: (d) => { invalidateAll(); toast({ title: `${d.synced || 0} захиалга синк хийгдлээ` }); },
  });

  // Load driver list once from Hub.
  const { data: drivers } = useQuery({
    queryKey: ["admin", "delivery-hub-drivers"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("delivery-hub-proxy", {
        body: { action: "list_drivers" },
      });
      if (error) throw error;
      return ((data as any)?.drivers || []) as Array<{ id: string; full_name?: string; name?: string; phone?: string }>;
    },
    staleTime: 5 * 60_000,
  });


  const checkStatus = async (order: any) => {
    if (!order.delivery_external_id) return;
    setCheckingIds((s) => new Set(s).add(order.id));
    try {
      const { data, error } = await supabase.functions.invoke("delivery-hub-proxy", {
        body: { action: "status_check", external_order_id: order.delivery_external_id },
      });
      if (error) throw error;
      setHubStatusMap((m) => ({ ...m, [order.id]: data }));
      toast({ title: "Hub төлөв шинэчлэгдлээ", description: data?.status || "—" });
    } catch (e: any) {
      toast({ title: "Алдаа", description: e.message, variant: "destructive" });
    } finally {
      setCheckingIds((s) => { const n = new Set(s); n.delete(order.id); return n; });
    }
  };

  const printLabel = (order: any) => {
    const w = window.open("", "_blank");
    if (!w) return;
    const items = order.order_items || [];
    const unpaidNote = order.payment_status !== "paid"
      ? `<div class="payment-note">⚠ ${PAYMENT_LABELS[order.payment_status] || "Төлөгдөөгүй"}${order.total ? ` — ₮${Number(order.total).toLocaleString()}` : ""}</div>`
      : "";
    w.document.write(`
      <html><head><title>${order.order_number}</title>
      <style>
        @page { size: 70mm 80mm; margin: 0; }
        body { margin: 0; padding: 4mm; font-family: sans-serif; font-size: 11px; width: 70mm; }
        .num { font-size: 12px; font-weight: bold; margin-bottom: 4px; }
        .name { font-size: 13px; font-weight: bold; }
        .row { margin-bottom: 2px; }
        .items { margin: 6px 0; }
        .footer { margin-top: 8px; font-size: 9px; text-align: center; border-top: 1px dashed #000; padding-top: 4px; }
        .payment-note { font-weight: bold; margin-top: 4px; padding: 2px 4px; border: 1px solid #000; }
      </style></head><body>
      <div class="num">${order.order_number}</div>
      <div class="name">${order.customer_name || ""}</div>
      <div>${order.customer_phone || ""}</div>
      <div>${order.address_text || ""}</div>
      <div class="items">${items.map((it: any) => `<div>${it.product_name_snapshot || "Бараа"} × ${it.quantity}</div>`).join("")}</div>
      ${unpaidNote}
      <div class="footer">Баярлалаа! 🙏</div>
      </body></html>
    `);
    w.document.close();
    w.print();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Truck className="h-7 w-7" />Хүргэлт удирдах
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Swift Delivery Hub-тай синк болсон захиалгуудыг энд удирдана</p>
        </div>
        <div className="flex gap-2">
          {(stats.failed + stats.pending) > 0 && (
            <Button variant="outline" onClick={() => retryAll.mutate()} disabled={retryAll.isPending}>
              <RefreshCw className={`h-4 w-4 mr-2 ${retryAll.isPending ? "animate-spin" : ""}`} />
              Бүгдийг дахин синк ({stats.failed + stats.pending})
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Нийт", value: stats.total, icon: Package, color: "text-blue-600" },
          { label: "Синк болсон", value: stats.synced, icon: Cloud, color: "text-green-600" },
          { label: "Хүлээгдэж", value: stats.pending, icon: Clock, color: "text-yellow-600" },
          { label: "Алдаа", value: stats.failed, icon: CloudOff, color: "text-red-600" },
        ].map((c) => (
          <Card key={c.label}>
            <CardContent className="p-3 text-center">
              <c.icon className={`h-5 w-5 mx-auto mb-1 ${c.color}`} />
              <div className="text-2xl font-bold">{c.value}</div>
              <div className="text-xs text-muted-foreground">{c.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Дугаар, нэр, утас, SHOP-ID..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[190px]"><SelectValue placeholder="Статус" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Бүх статус</SelectItem>
            {Object.entries(FULFILLMENT_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={syncFilter} onValueChange={setSyncFilter}>
          <SelectTrigger className="w-[170px]"><SelectValue placeholder="Синк" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Бүх синк</SelectItem>
            <SelectItem value="synced">Синк болсон</SelectItem>
            <SelectItem value="pending">Хүлээгдэж</SelectItem>
            <SelectItem value="failed">Алдаатай</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}</div>
      ) : orders?.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Захиалга байхгүй</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {orders?.map((o: any) => {
            const date = formatDate(o.created_at);
            const fs = o.fulfillment_status || "new";
            const ps = o.payment_status || "pending";
            const border = BORDER_COLORS[fs] || "border-l-gray-300";
            const bg = BG_COLORS[fs] || "";
            const sync = SYNC_LABELS[o.delivery_sync_status || "pending"] || SYNC_LABELS.pending;
            const hub = hubStatusMap[o.id];
            const items = o.order_items || [];

            return (
              <div key={o.id} className={`border border-border rounded-xl p-4 border-l-4 ${border} ${bg}`}>
                <div className="flex items-start gap-3">
                  {/* Date column */}
                  <div className="flex-shrink-0 w-14 text-center">
                    <p className="text-2xl font-bold text-foreground leading-none">{date.day}</p>
                    <p className="text-[10px] text-muted-foreground">{date.month}</p>
                    <p className="text-xs text-muted-foreground font-medium">{date.time}</p>
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Top row: name + badges */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-foreground">{o.customer_name || "Хэрэглэгч"}</p>
                          <Badge variant="outline" className="text-xs whitespace-nowrap gap-1">
                            <Store className="h-3 w-3" />
                            Only Shop
                          </Badge>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-medium inline-flex items-center gap-1 ${sync.color}`}>
                            <sync.icon className="h-3 w-3" />{sync.label}
                          </span>
                        </div>
                        {o.customer_phone && (
                          <a href={`tel:${o.customer_phone}`} className="text-primary font-medium text-sm flex items-center gap-1 mt-0.5">
                            <Phone className="h-3.5 w-3.5" />
                            {o.customer_phone}
                          </a>
                        )}
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {o.order_number}
                          {o.delivery_external_id && ` • ${o.delivery_external_id}`}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <Badge variant="secondary" className="text-xs whitespace-nowrap">{FULFILLMENT_LABELS[fs] || fs}</Badge>
                        <Badge variant={ps === "paid" ? "default" : "outline"} className="text-xs">
                          {PAYMENT_LABELS[ps] || ps}
                        </Badge>
                        {o.total > 0 && (
                          <p className="text-sm font-medium text-foreground">{formatCurrency(Number(o.total))}</p>
                        )}
                        {o.delivery_sync_error && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[11px] gap-1 border-destructive/40 text-destructive hover:text-destructive"
                            onClick={() => retryOne.mutate(o.id)}
                            disabled={retryOne.isPending}
                            title={o.delivery_sync_error}
                          >
                            <AlertTriangle className="h-3 w-3" />
                            Sync алдаа
                            <RefreshCw className={`h-3 w-3 ${retryOne.isPending ? "animate-spin" : ""}`} />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Address */}
                    {o.address_text && (
                      <p className="text-sm text-muted-foreground mt-1 break-words">{o.address_text}</p>
                    )}

                    {/* Items */}
                    {items.length > 0 && (
                      <div className="mt-2 space-y-0.5">
                        {items.map((item: any) => (
                          <div key={item.id} className="flex items-center gap-2 text-sm">
                            <span className="font-medium text-foreground">{item.product_name_snapshot || "Бараа"}</span>
                            <Badge variant="outline" className="text-xs px-1.5 py-0">{item.quantity} ш</Badge>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Hub-side info (driver, tracking) fetched from Swift Hub */}
                    {hub && (hub.driver_name || hub.tracking_code) && (
                      <div className="mt-2 text-xs bg-muted/40 rounded p-2 space-y-0.5">
                        {hub.driver_name && (
                          <div className="flex items-center gap-1.5">
                            <User className="h-3 w-3" />
                            <b>Жолооч:</b> {hub.driver_name}
                            {hub.driver_phone && <span className="text-muted-foreground">({hub.driver_phone})</span>}
                          </div>
                        )}
                        {hub.tracking_code && <div><b>Tracking:</b> <span className="font-mono">{hub.tracking_code}</span></div>}
                      </div>
                    )}

                    {/* Actions row */}
                    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border/50">
                      <Select
                        value={fs}
                        onValueChange={(val) => updateFulfillment.mutate({ id: o.id, status: val, external: o.delivery_external_id })}
                      >
                        <SelectTrigger className="w-[200px] h-9 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(FULFILLMENT_LABELS).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select
                        value={ps}
                        onValueChange={(val) => updatePayment.mutate({ id: o.id, status: val, external: o.delivery_external_id })}
                      >
                        <SelectTrigger className="w-[160px] h-9 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(PAYMENT_LABELS).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {o.delivery_external_id && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 text-xs gap-1"
                          onClick={() => checkStatus(o)}
                          disabled={checkingIds.has(o.id)}
                        >
                          <RefreshCw className={`h-3.5 w-3.5 ${checkingIds.has(o.id) ? "animate-spin" : ""}`} />
                          Hub төлөв
                        </Button>
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 text-xs"
                        onClick={() => printLabel(o)}
                      >
                        <Printer className="h-4 w-4 mr-1" /> Хэвлэх
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-9 text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Захиалга устгах уу?</AlertDialogTitle>
                            <AlertDialogDescription>
                              {o.order_number} — {o.customer_name} захиалгыг бүрмөсөн устгана. Энэ үйлдлийг буцаах боломжгүй.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Болих</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => deleteOrder.mutate(o.id)}
                            >
                              Устгах
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
