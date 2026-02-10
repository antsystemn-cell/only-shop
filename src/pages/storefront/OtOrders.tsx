import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getAnonymousSession } from "@/services/otSession";
import {
  searchOtOrders,
  getSalesOrderDetails,
  cancelSalesOrder,
} from "@/services/otApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ArrowLeft,
  Package,
  Loader2,
  ChevronRight,
  Calendar,
  Eye,
  XCircle,
  ShoppingBag,
  RefreshCw,
} from "lucide-react";

interface OtOrder {
  Id?: string;
  StatusId?: string;
  StatusName?: string;
  TotalPrice?: { ConvertedPriceValue?: number; CurrencySign?: string };
  CreationDate?: string;
  OrderLines?: { Items?: OtOrderLine[] };
  [key: string]: any;
}

interface OtOrderLine {
  Id?: string;
  ItemTitle?: string;
  ImageUrl?: string;
  Quantity?: number;
  TotalPrice?: { ConvertedPriceValue?: number; CurrencySign?: string };
  StatusName?: string;
  [key: string]: any;
}

const OT_STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  InWork: { label: "Боловсруулж буй", variant: "default" },
  Created: { label: "Үүсгэсэн", variant: "secondary" },
  Purchased: { label: "Худалдаж авсан", variant: "default" },
  Shipped: { label: "Хүргэгдэж буй", variant: "default" },
  Received: { label: "Хүлээн авсан", variant: "default" },
  Cancelled: { label: "Цуцлагдсан", variant: "destructive" },
  Completed: { label: "Дууссан", variant: "default" },
};

export default function OtOrders() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const [orders, setOrders] = useState<OtOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      const sessionId = await getAnonymousSession();
      const params: any = { sessionId, page, pageSize: 20 };
      if (statusFilter !== "all") params.statusId = statusFilter;
      const data: any = await searchOtOrders(params);
      const rawItems = data?.Result?.Items;
      setOrders(Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : []);
    } catch (err: any) {
      console.error("OT orders load error:", err);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    if (user) loadOrders();
  }, [user, loadOrders]);

  const viewDetail = async (orderId: string) => {
    try {
      setDetailLoading(true);
      setShowDetail(true);
      const data: any = await getSalesOrderDetails(orderId);
      setSelectedOrder(data?.Result || data);
    } catch (err: any) {
      toast.error("Дэлгэрэнгүй ачаалахад алдаа гарлаа");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCancel = async (orderId: string) => {
    try {
      await cancelSalesOrder(orderId, cancelReason || undefined);
      toast.success("Захиалга цуцлагдлаа");
      setCancelReason("");
      setShowDetail(false);
      await loadOrders();
    } catch (err: any) {
      toast.error(err.message || "Цуцлах үед алдаа гарлаа");
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-4xl">
      <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4" />
        Нүүр хуудас
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">OT Захиалгууд</h1>
          <p className="text-muted-foreground mt-1">Маркетплэйсийн захиалгуудын түүх</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Статус" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Бүгд</SelectItem>
              <SelectItem value="Created">Үүсгэсэн</SelectItem>
              <SelectItem value="InWork">Боловсруулж буй</SelectItem>
              <SelectItem value="Purchased">Худалдаж авсан</SelectItem>
              <SelectItem value="Shipped">Хүргэгдэж буй</SelectItem>
              <SelectItem value="Received">Хүлээн авсан</SelectItem>
              <SelectItem value="Cancelled">Цуцлагдсан</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={loadOrders}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : orders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-4 rounded-full bg-muted mb-4">
              <Package className="h-12 w-12 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Захиалга олдсонгүй</h3>
            <p className="text-muted-foreground mb-6">Та маркетплэйсээс бараа захиалаагүй байна</p>
            <Button asChild>
              <Link to="/ot">
                <ShoppingBag className="h-4 w-4 mr-2" />
                Маркетплэйс үзэх
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const statusInfo = OT_STATUS_MAP[order.StatusId || ""] || { label: order.StatusName || order.StatusId || "?", variant: "outline" as const };
            const lines = order.OrderLines?.Items || [];
            const totalPrice = order.TotalPrice;
            return (
              <Card key={order.Id} className="overflow-hidden hover:shadow-md transition-shadow">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Package className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-mono font-semibold text-sm">#{order.Id}</p>
                        {order.CreationDate && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(order.CreationDate).toLocaleDateString("mn-MN")}
                          </p>
                        )}
                      </div>
                    </div>
                    <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                  </div>

                  {lines.length > 0 && (
                    <>
                      <Separator className="my-3" />
                      <div className="flex items-center gap-3">
                        <div className="flex -space-x-2">
                          {lines.slice(0, 3).map((line, i) => (
                            <div
                              key={line.Id || i}
                              className="w-10 h-10 rounded bg-muted border-2 border-background overflow-hidden"
                              style={{ zIndex: 3 - i }}
                            >
                              {line.ImageUrl ? (
                                <img src={line.ImageUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <ShoppingBag className="h-3 w-3 text-muted-foreground" />
                                </div>
                              )}
                            </div>
                          ))}
                          {lines.length > 3 && (
                            <div className="w-10 h-10 rounded bg-muted border-2 border-background flex items-center justify-center text-xs font-medium">
                              +{lines.length - 3}
                            </div>
                          )}
                        </div>
                        <span className="text-sm text-muted-foreground flex-1">{lines.length} бараа</span>
                        {totalPrice && (
                          <span className="font-bold text-primary">
                            {totalPrice.CurrencySign || "¥"}{totalPrice.ConvertedPriceValue?.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </>
                  )}

                  <div className="flex justify-end mt-3 gap-2">
                    <Button variant="outline" size="sm" onClick={() => viewDetail(order.Id!)}>
                      <Eye className="h-4 w-4 mr-1" />
                      Дэлгэрэнгүй
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Pagination */}
          <div className="flex justify-center gap-2 pt-4">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              Өмнөх
            </Button>
            <Button variant="outline" size="sm" disabled={orders.length < 20} onClick={() => setPage((p) => p + 1)}>
              Дараах
            </Button>
          </div>
        </div>
      )}

      {/* Order Detail Dialog */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Захиалгын дэлгэрэнгүй</DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : selectedOrder ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Захиалгын №:</span>
                  <p className="font-mono font-semibold">#{selectedOrder.Id}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Статус:</span>
                  <p><Badge>{selectedOrder.StatusName || selectedOrder.StatusId}</Badge></p>
                </div>
                {selectedOrder.CreationDate && (
                  <div>
                    <span className="text-muted-foreground">Огноо:</span>
                    <p>{new Date(selectedOrder.CreationDate).toLocaleString("mn-MN")}</p>
                  </div>
                )}
                {selectedOrder.TotalPrice && (
                  <div>
                    <span className="text-muted-foreground">Нийт дүн:</span>
                    <p className="font-bold text-primary">
                      {selectedOrder.TotalPrice.CurrencySign || "¥"}
                      {selectedOrder.TotalPrice.ConvertedPriceValue?.toFixed(2)}
                    </p>
                  </div>
                )}
              </div>

              <Separator />

              {/* Order Lines */}
              <div className="space-y-3">
                <h4 className="font-semibold">Бараанууд</h4>
                {(selectedOrder.OrderLines?.Items || []).map((line: OtOrderLine, i: number) => (
                  <div key={line.Id || i} className="flex items-center gap-3 p-3 rounded-lg border">
                    <div className="w-14 h-14 rounded bg-muted overflow-hidden shrink-0">
                      {line.ImageUrl ? (
                        <img src={line.ImageUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm line-clamp-2">{line.ItemTitle || "Бараа"}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">Тоо: {line.Quantity || 1}</span>
                        {line.StatusName && <Badge variant="outline" className="text-xs">{line.StatusName}</Badge>}
                      </div>
                    </div>
                    {line.TotalPrice && (
                      <span className="text-sm font-medium shrink-0">
                        {line.TotalPrice.CurrencySign || "¥"}{line.TotalPrice.ConvertedPriceValue?.toFixed(2)}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Cancel button */}
              {selectedOrder.StatusId !== "Cancelled" && selectedOrder.StatusId !== "Completed" && (
                <>
                  <Separator />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="w-full">
                        <XCircle className="h-4 w-4 mr-2" />
                        Захиалга цуцлах
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Захиалга цуцлах уу?</AlertDialogTitle>
                        <AlertDialogDescription>Энэ үйлдлийг буцаах боломжгүй.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <Textarea
                        placeholder="Шалтгаан (заавал биш)"
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        className="mt-2"
                      />
                      <AlertDialogFooter>
                        <AlertDialogCancel>Буцах</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleCancel(selectedOrder.Id)}>
                          Цуцлах
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
