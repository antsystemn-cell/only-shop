import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Truck, Search, RefreshCw, Phone, MapPin, Cloud, CloudOff, Clock,
  X, User, Package, ExternalLink, CheckCircle2,
} from "lucide-react";
import { retryDeliverySync, retryAllFailedSyncs } from "@/lib/deliverySync";
import { formatCurrency } from "@/lib/orderService";
import { format } from "date-fns";

const HUB_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  new: { label: "Шинэ", color: "bg-blue-100 text-blue-700" },
  confirmed: { label: "Баталгаажсан", color: "bg-cyan-100 text-cyan-700" },
  assigned: { label: "Жолооч томилогдсон", color: "bg-indigo-100 text-indigo-700" },
  picked_up: { label: "Авсан", color: "bg-purple-100 text-purple-700" },
  in_transit: { label: "Замд", color: "bg-amber-100 text-amber-700" },
  delivered: { label: "Хүргэгдсэн", color: "bg-green-100 text-green-700" },
  cancelled: { label: "Цуцлагдсан", color: "bg-red-100 text-red-700" },
  failed: { label: "Амжилтгүй", color: "bg-red-100 text-red-700" },
};

const SYNC_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  synced: { label: "Синк ✓", color: "bg-green-100 text-green-700", icon: Cloud },
  failed: { label: "Синк ✗", color: "bg-red-100 text-red-700", icon: CloudOff },
  pending: { label: "Хүлээгдэж", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  disabled: { label: "Идэвхгүй", color: "bg-gray-100 text-gray-600", icon: CloudOff },
};

export default function DeliveryHub() {
  const [search, setSearch] = useState("");
  const [syncFilter, setSyncFilter] = useState("all");
  const [hubStatusMap, setHubStatusMap] = useState<Record<string, any>>({});
  const [checkingIds, setCheckingIds] = useState<Set<string>>(new Set());
  const [cancelOrder, setCancelOrder] = useState<any>(null);
  const [cancelNote, setCancelNote] = useState("");
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: orders, isLoading } = useQuery({
    queryKey: ["admin", "delivery-hub-orders", search, syncFilter],
    queryFn: async () => {
      let q = supabase
        .from("orders")
        .select("id, order_number, customer_name, customer_phone, address_text, total, created_at, fulfillment_status, payment_status, delivery_sync_status, delivery_sync_error, delivery_external_id, delivery_attempt_count, delivery_last_attempt_at, order_items(id, quantity, product_name_snapshot)")
        .not("delivery_creation_mode", "eq", "none")
        .order("created_at", { ascending: false })
        .limit(300);
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

  const retryOne = useMutation({
    mutationFn: async (id: string) => {
      const r = await retryDeliverySync(id);
      if (!r.success) throw new Error(r.error);
      return r;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "delivery-hub-orders"] }); toast({ title: "Синк амжилттай" }); },
    onError: (e: any) => toast({ title: "Алдаа", description: e.message, variant: "destructive" }),
  });

  const retryAll = useMutation({
    mutationFn: retryAllFailedSyncs,
    onSuccess: (d) => { qc.invalidateQueries({ queryKey: ["admin", "delivery-hub-orders"] }); toast({ title: `${d.synced || 0} захиалга синк хийгдлээ` }); },
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
      toast({ title: "Төлөв шинэчлэгдлээ", description: data?.status || "—" });
    } catch (e: any) {
      toast({ title: "Алдаа", description: e.message, variant: "destructive" });
    } finally {
      setCheckingIds((s) => { const n = new Set(s); n.delete(order.id); return n; });
    }
  };

  const cancelMut = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("delivery-hub-proxy", {
        body: {
          action: "status_update",
          external_order_id: cancelOrder.delivery_external_id,
          status: "cancelled",
          note: cancelNote || "Админ цуцаллаа",
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "Hub руу цуцлах хүсэлт илгээгдлээ" });
      setCancelOrder(null); setCancelNote("");
      qc.invalidateQueries({ queryKey: ["admin", "delivery-hub-orders"] });
    },
    onError: (e: any) => toast({ title: "Алдаа", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Truck className="h-7 w-7" />Хүргэлт (Swift Hub)</h1>
          <p className="text-muted-foreground mt-1 text-sm">Swift Delivery Hub-тай синк болсон захиалгууд</p>
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

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Дугаар, нэр, утас, SHOP-ID хайх..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={syncFilter} onValueChange={setSyncFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Бүх төлөв</SelectItem>
            <SelectItem value="synced">Синк болсон</SelectItem>
            <SelectItem value="pending">Хүлээгдэж</SelectItem>
            <SelectItem value="failed">Алдаатай</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}</div>
      ) : orders?.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Захиалга байхгүй</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {orders?.map((o: any) => {
            const sync = SYNC_LABELS[o.delivery_sync_status || "pending"] || SYNC_LABELS.pending;
            const hub = hubStatusMap[o.id];
            const hubStatus = hub?.status ? HUB_STATUS_LABELS[hub.status] : null;
            const items = o.order_items || [];
            return (
              <Card key={o.id}>
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-bold">{o.order_number}</span>
                        {o.delivery_external_id && (
                          <Badge variant="outline" className="text-[10px] font-mono">{o.delivery_external_id}</Badge>
                        )}
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium inline-flex items-center gap-1 ${sync.color}`}>
                          <sync.icon className="h-3 w-3" />{sync.label}
                        </span>
                        {hubStatus && (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${hubStatus.color}`}>
                            Hub: {hubStatus.label}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1 text-foreground font-medium"><User className="h-3 w-3" />{o.customer_name || "—"}</span>
                        {o.customer_phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{o.customer_phone}</span>}
                        <span className="font-medium text-foreground">{formatCurrency(Number(o.total))}</span>
                        <span>{format(new Date(o.created_at), "MM/dd HH:mm")}</span>
                      </div>
                      {o.address_text && (
                        <div className="flex items-start gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                          <span className="truncate">{o.address_text}</span>
                        </div>
                      )}
                      {hub && (
                        <div className="text-xs bg-muted/40 rounded p-2 space-y-0.5">
                          {hub.driver_name && <div><b>Жолооч:</b> {hub.driver_name} {hub.driver_phone && `(${hub.driver_phone})`}</div>}
                          {hub.tracking_code && <div><b>Tracking:</b> <span className="font-mono">{hub.tracking_code}</span></div>}
                          {hub.payment_status && <div><b>Төлбөр:</b> {hub.payment_status}</div>}
                        </div>
                      )}
                      {o.delivery_sync_error && (
                        <div className="text-xs text-destructive bg-red-50 rounded p-2">⚠ {o.delivery_sync_error}</div>
                      )}
                      {items.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          {items.map((i: any) => `${i.product_name_snapshot || "Бараа"} ×${i.quantity}`).join(", ")}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5 shrink-0">
                      {o.delivery_sync_status === "synced" && o.delivery_external_id && (
                        <>
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => checkStatus(o)} disabled={checkingIds.has(o.id)}>
                            <RefreshCw className={`h-3 w-3 mr-1 ${checkingIds.has(o.id) ? "animate-spin" : ""}`} />
                            Hub төлөв
                          </Button>
                          {o.fulfillment_status !== "delivered" && o.fulfillment_status !== "cancelled" && (
                            <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => setCancelOrder(o)}>
                              <X className="h-3 w-3 mr-1" />Цуцлах
                            </Button>
                          )}
                        </>
                      )}
                      {(o.delivery_sync_status === "failed" || o.delivery_sync_status === "pending") && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => retryOne.mutate(o.id)} disabled={retryOne.isPending}>
                          <RefreshCw className={`h-3 w-3 mr-1 ${retryOne.isPending ? "animate-spin" : ""}`} />
                          Дахин синк
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!cancelOrder} onOpenChange={(o) => !o && setCancelOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hub дээр захиалга цуцлах</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              <b>{cancelOrder?.order_number}</b> ({cancelOrder?.delivery_external_id}) захиалгыг Swift Delivery Hub дээр цуцална.
            </p>
            <div>
              <Label>Тайлбар</Label>
              <Textarea value={cancelNote} onChange={(e) => setCancelNote(e.target.value)} placeholder="Цуцлах шалтгаан..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOrder(null)}>Буцах</Button>
            <Button variant="destructive" onClick={() => cancelMut.mutate()} disabled={cancelMut.isPending}>
              {cancelMut.isPending ? "Илгээж байна..." : "Цуцлах"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
