import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  ShoppingCart, Truck, CheckCircle2, AlertTriangle, DollarSign,
  Plus, Download, Search, Eye, Copy, ChevronDown, ChevronRight,
  Printer, MoreHorizontal, ArrowRight, Ban,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { printDeliveryLabel } from "@/components/admin/DeliveryLabelPrint";
import { printInvoice } from "@/components/admin/InvoicePrint";
import { format } from "date-fns";
import {
  ORDER_SOURCES,
  FULFILLMENT_STATUSES,
  PAYMENT_STATUSES,
  updateFulfillmentStatus,
  updatePaymentStatus,
  getFulfillmentBadge,
  getPaymentBadge,
  getSourceLabel,
  formatCurrency,
} from "@/lib/orderService";
import {
  getFulfillmentMeta,
  getPaymentMeta,
} from "@/lib/statusLabels";
import CreateOrderDialog from "./orders/CreateOrderDialog";
import OrderDetailSheet from "@/components/admin/OrderDetailSheet";

type StatusTab = "all" | "confirmed" | "phone_confirmed" | "out_for_delivery" | "delivered" | "cancelled";

const STATUS_TABS: { value: StatusTab; label: string }[] = [
  { value: "all", label: "Бүгд" },
  { value: "confirmed", label: "Шинэ" },
  { value: "phone_confirmed", label: "Бэлтгэгдэж буй" },
  { value: "out_for_delivery", label: "Хүргэлтэнд" },
  { value: "delivered", label: "Хүргэгдсэн" },
  { value: "cancelled", label: "Цуцлагдсан" },
];

// Progress stages (cancelled handled separately)
const PROGRESS_STEPS = ["confirmed", "phone_confirmed", "out_for_delivery", "delivered"];

const SOURCE_COLOR: Record<string, string> = {
  website: "bg-purple-100 text-purple-700 border-purple-200",
};
function sourceBadgeColor(src: string) {
  return SOURCE_COLOR[src] || "bg-gray-100 text-gray-700 border-gray-200";
}

function progressStep(status: string): number {
  return PROGRESS_STEPS.indexOf(status);
}

export default function Orders() {
  const navigate = useNavigate();
  const [statusTab, setStatusTab] = useState<StatusTab>("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: orders, isLoading } = useQuery({
    queryKey: ["admin", "orders-unified", search, statusTab, sourceFilter, paymentFilter],
    queryFn: async () => {
      let q = supabase
        .from("orders")
        .select("*, order_items(*)")
        .order("created_at", { ascending: false })
        .limit(5000);

      if (search) {
        q = q.or(`order_number.ilike.%${search}%,customer_name.ilike.%${search}%,customer_phone.ilike.%${search}%`);
      }
      if (statusTab !== "all") q = q.eq("fulfillment_status", statusTab as any);
      if (sourceFilter !== "all") q = q.eq("source", sourceFilter as any);
      if (paymentFilter !== "all") q = q.eq("payment_status", paymentFilter as any);

      const { data, error } = await q;
      if (error) throw error;

      const userIds = [...new Set(data?.map((o) => o.user_id).filter(Boolean))];
      let profilesMap: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, email, phone")
          .in("user_id", userIds);
        profiles?.forEach((p) => { profilesMap[p.user_id] = p; });
      }
      return data?.map((o) => ({ ...o, profile: profilesMap[o.user_id || ""] || null })) || [];
    },
  });

  // Stats over ALL orders (not filtered) — separate query
  const { data: stats } = useQuery({
    queryKey: ["admin", "orders", "header-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("fulfillment_status, payment_status, total")
        .limit(10000);
      if (error) throw error;
      const rows = data || [];
      return {
        confirmed: rows.filter((o: any) => (o.fulfillment_status || "confirmed") === "confirmed").length,
        outForDelivery: rows.filter((o: any) => o.fulfillment_status === "out_for_delivery").length,
        delivered: rows.filter((o: any) => o.fulfillment_status === "delivered").length,
        unpaid: rows.filter((o: any) => o.payment_status !== "paid" && o.fulfillment_status !== "cancelled").length,
        revenue: rows
          .filter((o: any) => o.fulfillment_status !== "cancelled")
          .reduce((s: number, o: any) => s + Number(o.total || 0), 0),
      };
    },
  });

  const fulfillmentMutation = useMutation({
    mutationFn: async ({ id, oldStatus, newStatus }: { id: string; oldStatus: string; newStatus: string }) =>
      updateFulfillmentStatus(id, oldStatus, newStatus),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "orders-unified"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "orders", "header-stats"] });
      toast({ title: "Төлөв шинэчлэгдлээ" });
    },
    onError: (e: any) => toast({ title: "Алдаа", description: e.message, variant: "destructive" }),
  });

  const paymentMutation = useMutation({
    mutationFn: async ({ id, oldStatus, newStatus }: { id: string; oldStatus: string; newStatus: string }) =>
      updatePaymentStatus(id, oldStatus, newStatus),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "orders-unified"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "orders", "header-stats"] });
      toast({ title: "Төлбөрийн төлөв шинэчлэгдлээ" });
    },
    onError: (e: any) => toast({ title: "Алдаа", description: e.message, variant: "destructive" }),
  });

  const cards = useMemo(() => [
    { label: "Шинэ захиалга", value: stats?.confirmed ?? 0, icon: ShoppingCart, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Хүргэлтэнд гарсан", value: stats?.outForDelivery ?? 0, icon: Truck, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Хүргэгдсэн", value: stats?.delivered ?? 0, icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50" },
    { label: "Төлөгдөөгүй", value: stats?.unpaid ?? 0, icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50" },
    { label: "Нийт орлого", value: formatCurrency(stats?.revenue ?? 0), icon: DollarSign, color: "text-indigo-600", bg: "bg-indigo-50", isCurrency: true },
  ], [stats]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const getCustomer = (o: any) => {
    if (o.customer_name) return { name: o.customer_name, phone: o.customer_phone || "" };
    if (o.profile) return { name: o.profile.full_name || "—", phone: o.profile.phone || o.profile.email || "" };
    return { name: "—", phone: "" };
  };

  const exportCsv = () => {
    if (!orders || orders.length === 0) {
      toast({ title: "Захиалга байхгүй", variant: "destructive" });
      return;
    }
    const header = ["Дугаар", "Огноо", "Захиалагч", "Утас", "Суваг", "Биелэлт", "Төлбөр", "Дүн", "Хүргэлт"];
    const rows = orders.map((o: any) => {
      const c = getCustomer(o);
      return [
        o.order_number,
        format(new Date(o.created_at), "yyyy-MM-dd HH:mm"),
        c.name,
        c.phone,
        getSourceLabel(o.source || "website"),
        getFulfillmentBadge(o.fulfillment_status || "confirmed").label,
        getPaymentBadge(o.payment_status || "unpaid").label,
        Math.round(Number(o.total || 0)),
        o.address_text || "",
      ];
    });
    const csv = [header, ...rows]
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders-${format(new Date(), "yyyyMMdd-HHmm")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "CSV татаж авлаа" });
  };

  const copyOrderForExcel = (o: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const phone = o.customer_phone || o.profile?.phone || "";
    const items = (o.order_items || []).map((item: any) => {
      const s = item.product_snapshot || {};
      return item.product_name_snapshot || s.name || s.name_mn || s.title || "Бараа";
    });
    const lines = [phone, "", ...items, Math.round(Number(o.subtotal || 0)).toString(), "", "EasyShop", "Online", "", o.address_text || ""];
    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      toast({ title: "Хуулагдлаа" });
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 1. PAGE HEADER */}
      <div className="flex flex-col sm:flex-row justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Захиалга</h1>
          <p className="text-muted-foreground mt-1">Бүх захиалга — вэбсайт, гар, түүхэн борлуулалт</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv}>
            <Download className="h-4 w-4 mr-2" />
            CSV экспорт
          </Button>
          <Button onClick={() => setCreateOpen(true)} className="bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" />
            Захиалга үүсгэх
          </Button>
        </div>
      </div>

      {/* 2. STATS ROW */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${c.bg}`}>
                  <c.icon className={`h-5 w-5 ${c.color}`} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground truncate">{c.label}</div>
                  <div className={`font-bold ${c.isCurrency ? "text-lg" : "text-2xl"}`}>{c.value}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 3. FILTER BAR */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <Tabs value={statusTab} onValueChange={(v) => setStatusTab(v as StatusTab)}>
            <TabsList className="flex flex-wrap h-auto">
              {STATUS_TABS.map((t) => (
                <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="Бүх суваг" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Бүх суваг</SelectItem>
                {ORDER_SOURCES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="Бүх төлбөр" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Бүх төлбөр</SelectItem>
                {PAYMENT_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Дугаар, нэр, утас хайх..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. ORDERS TABLE */}
      <Card>
        <CardContent className="p-0 sm:p-6">
          {isLoading ? (
            <div className="space-y-3 p-4">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : !orders || orders.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Захиалга олдсонгүй</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead className="w-[200px]">Захиалга / Захиалагч</TableHead>
                    <TableHead className="w-[100px]">Суваг</TableHead>
                    <TableHead className="w-[150px] text-center">Биелэлт</TableHead>
                    <TableHead className="w-[140px] text-center">Төлбөр</TableHead>
                    <TableHead className="w-[110px] text-right">Дүн</TableHead>
                    <TableHead className="w-[120px]">Явц</TableHead>
                    <TableHead className="w-[100px] text-center">Огноо</TableHead>
                    <TableHead className="w-[90px] text-center">Үйлдэл</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((o: any) => {
                    const c = getCustomer(o);
                    const status = o.fulfillment_status || "confirmed";
                    const fb = getFulfillmentMeta(status);
                    const payStatus = o.payment_status || "unpaid";
                    const pb = getPaymentMeta(payStatus);
                    const src = o.source || "website";
                    const sb = { label: getSourceLabel(src), color: sourceBadgeColor(src) };
                    const isCancelled = status === "cancelled";
                    const curStep = progressStep(status);
                    const itemCount = o.order_items?.length || 0;
                    const hasItems = itemCount > 0;
                    return (
                      <>
                        <TableRow key={o.id} className="group hover:bg-muted/50 cursor-pointer" onClick={() => toggleExpand(o.id)}>
                          <TableCell className="py-2">
                            {hasItems && (
                              expanded.has(o.id)
                                ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </TableCell>
                          <TableCell className="py-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); navigate(`/admin/orders/${o.id}`); }}
                              className="font-mono text-sm font-bold text-primary hover:underline"
                            >
                              {o.order_number}
                            </button>
                            <div className="text-xs text-muted-foreground truncate max-w-[200px]">{c.phone || "—"}</div>
                            <div className="text-[11px] text-muted-foreground">{itemCount} бараа</div>
                          </TableCell>
                          <TableCell className="py-2">
                            <Badge variant="outline" className={`text-[10px] ${sb.color}`}>{sb.label}</Badge>
                          </TableCell>
                          <TableCell className="text-center py-2" onClick={(e) => e.stopPropagation()}>
                            <Select
                              value={status}
                              onValueChange={(v) => fulfillmentMutation.mutate({ id: o.id, oldStatus: status, newStatus: v })}
                            >
                              <SelectTrigger className="w-[150px] h-7 text-xs border-0 bg-transparent shadow-none p-0 hover:bg-muted/50">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${fb.color}`}>{fb.label}</span>
                              </SelectTrigger>
                              <SelectContent>
                                {FULFILLMENT_STATUSES.map((s) => {
                                  const m = getFulfillmentMeta(s.value);
                                  return (
                                    <SelectItem key={s.value} value={s.value}>
                                      <span className={`px-2 py-0.5 rounded-full text-xs ${m.color}`}>{m.label}</span>
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-center py-2" onClick={(e) => e.stopPropagation()}>
                            <Select
                              value={payStatus}
                              onValueChange={(v) => paymentMutation.mutate({ id: o.id, oldStatus: payStatus, newStatus: v })}
                            >
                              <SelectTrigger className="w-[130px] h-7 text-xs border-0 bg-transparent shadow-none p-0 hover:bg-muted/50">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${pb.color}`}>{pb.label}</span>
                              </SelectTrigger>
                              <SelectContent>
                                {PAYMENT_STATUSES.map((s) => {
                                  const m = getPaymentMeta(s.value);
                                  return (
                                    <SelectItem key={s.value} value={s.value}>
                                      <span className={`px-2 py-0.5 rounded-full text-xs ${m.color}`}>{m.label}</span>
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-right py-2">
                            <div className="font-bold text-sm">{formatCurrency(Number(o.total))}</div>
                          </TableCell>
                          <TableCell className="py-2">
                            <div className="flex items-center gap-1.5">
                              {PROGRESS_STEPS.map((_, i) => {
                                let cls = "bg-muted";
                                if (isCancelled) cls = "bg-red-400";
                                else if (i < curStep) cls = "bg-green-500";
                                else if (i === curStep) cls = "bg-blue-500";
                                return <span key={i} className={`w-2 h-2 rounded-full ${cls}`} />;
                              })}
                            </div>
                          </TableCell>
                          <TableCell className="text-center py-2 text-xs text-muted-foreground">
                            {format(new Date(o.created_at), "MM/dd HH:mm")}
                          </TableCell>
                          <TableCell className="py-2" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              {status === "delivered" && (
                                <>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Дэлгэрэнгүй" onClick={() => navigate(`/admin/orders/${o.id}`)}>
                                    <Eye className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Хэвлэх" onClick={() => printInvoice(o)}>
                                    <Printer className="h-3.5 w-3.5" />
                                  </Button>
                                </>
                              )}
                              {(status === "confirmed" || status === "phone_confirmed") && (
                                <Button
                                  size="sm"
                                  className="h-7 px-2.5 text-xs bg-primary hover:bg-primary/90"
                                  onClick={() => fulfillmentMutation.mutate({ id: o.id, oldStatus: status, newStatus: "out_for_delivery" })}
                                >
                                  Хүргэлт <ArrowRight className="h-3 w-3 ml-1" />
                                </Button>
                              )}
                              {status === "out_for_delivery" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2.5 text-xs"
                                  onClick={() => fulfillmentMutation.mutate({ id: o.id, oldStatus: status, newStatus: "delivered" })}
                                >
                                  Хүргэгдсэн <CheckCircle2 className="h-3 w-3 ml-1" />
                                </Button>
                              )}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Илүү"
                                  >
                                    <MoreHorizontal className="h-3.5 w-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => navigate(`/admin/orders/${o.id}`)}>
                                    <Eye className="h-4 w-4 mr-2" /> Дэлгэрэнгүй
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={(e) => copyOrderForExcel(o, e as any)}>
                                    <Copy className="h-4 w-4 mr-2" /> Excel хуулах
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => printInvoice(o)}>
                                    <Printer className="h-4 w-4 mr-2" /> Нэхэмжлэх хэвлэх
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => printDeliveryLabel(o)}>
                                    <Printer className="h-4 w-4 mr-2" /> Хүргэлтийн шошго
                                  </DropdownMenuItem>
                                  {!isCancelled && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        className="text-destructive focus:text-destructive"
                                        onClick={() => fulfillmentMutation.mutate({ id: o.id, oldStatus: status, newStatus: "cancelled" })}
                                      >
                                        <Ban className="h-4 w-4 mr-2" /> Цуцлах
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                        {expanded.has(o.id) && o.order_items?.map((item: any) => {
                          const s = item.product_snapshot || {};
                          const imgSrc = s.imageUrl || s.image_url || s.images?.[0];
                          return (
                            <TableRow key={item.id} className="bg-muted/30">
                              <TableCell></TableCell>
                              <TableCell colSpan={2} className="py-2">
                                <div className="flex items-center gap-3">
                                  {imgSrc && <img src={imgSrc} alt="" className="w-10 h-10 rounded object-contain border bg-muted" />}
                                  <div className="min-w-0">
                                    <div className="text-sm font-medium truncate">{item.product_name_snapshot || s.title || s.name || s.name_mn || "Бараа"}</div>
                                    {(item.color_snapshot || item.size_snapshot) && (
                                      <div className="text-xs text-muted-foreground mt-0.5">
                                        {item.color_snapshot && `Өнгө: ${item.color_snapshot}`}
                                        {item.size_snapshot && ` · Хэмжээ: ${item.size_snapshot}`}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-center text-sm py-2">×{item.quantity}</TableCell>
                              <TableCell className="text-right text-sm py-2" colSpan={2}>
                                {formatCurrency(Number(item.total_price))}
                              </TableCell>
                              <TableCell colSpan={3}></TableCell>
                            </TableRow>
                          );
                        })}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order detail sheet */}
      {(() => {
        const selectedOrder = orders?.find((o: any) => o.id === selectedOrderId) || null;
        return (
          <OrderDetailSheet
            order={selectedOrder}
            open={detailOpen}
            onClose={() => setDetailOpen(false)}
            onFulfillmentChange={(oldS, newS) => {
              if (selectedOrder) fulfillmentMutation.mutate({ id: selectedOrder.id, oldStatus: oldS, newStatus: newS });
            }}
            onPaymentChange={(oldS, newS) => {
              if (selectedOrder) paymentMutation.mutate({ id: selectedOrder.id, oldStatus: oldS, newStatus: newS });
            }}
            isMobile={isMobile}
          />
        );
      })()}

      <CreateOrderDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
