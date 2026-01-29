import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  ShoppingCart,
  Eye,
  ChevronDown,
} from "lucide-react";
import { format } from "date-fns";

interface Order {
  id: string;
  order_number: string;
  status: string;
  subtotal: number;
  delivery_fee: number;
  total: number;
  delivery_type: string | null;
  payment_status: string | null;
  created_at: string;
  profiles?: {
    full_name: string | null;
    email: string;
    phone: string | null;
  } | null;
}

const statusOptions = [
  { value: "pending", label: "Хүлээгдэж байна", color: "bg-yellow-100 text-yellow-800" },
  { value: "processing", label: "Бэлтгэгдэж байна", color: "bg-blue-100 text-blue-800" },
  { value: "shipped", label: "Хүргэлтэд гарсан", color: "bg-purple-100 text-purple-800" },
  { value: "delivered", label: "Хүргэгдсэн", color: "bg-green-100 text-green-800" },
  { value: "cancelled", label: "Цуцлагдсан", color: "bg-red-100 text-red-800" },
];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("mn-MN").format(amount) + "₮";
}

export default function Orders() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch orders
  const { data: orders, isLoading } = useQuery({
    queryKey: ["admin", "orders", searchQuery, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });

      if (searchQuery) {
        query = query.or(`order_number.ilike.%${searchQuery}%`);
      }

      if (statusFilter && statusFilter !== "all") {
        query = query.eq("status", statusFilter as any);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Order[];
    },
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("orders")
        .update({ status: status as any })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      toast({
        title: "Төлөв шинэчлэгдлээ",
        description: "Захиалгын төлөв амжилттай солигдлоо",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Алдаа гарлаа",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    const s = statusOptions.find(opt => opt.value === status) || 
      { label: status, color: "bg-gray-100 text-gray-800" };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${s.color}`}>
        {s.label}
      </span>
    );
  };

  const getDeliveryType = (type: string | null) => {
    const types: Record<string, string> = {
      standard: "Стандарт",
      express: "Түргэн",
      rural: "Орон нутаг",
    };
    return types[type || "standard"] || type;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Захиалга харах</h1>
        <p className="text-muted-foreground mt-1">
          Бүх захиалгуудыг удирдах
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Захиалгын дугаараар хайх..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Бүх төлөв" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Бүх төлөв</SelectItem>
                {statusOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Orders table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            Захиалгын жагсаалт
            {orders && <Badge variant="secondary">{orders.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : orders && orders.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Захиалга</TableHead>
                    <TableHead>Хэрэглэгч</TableHead>
                    <TableHead>Хүргэлт</TableHead>
                    <TableHead className="text-right">Дүн</TableHead>
                    <TableHead className="text-center">Төлөв</TableHead>
                    <TableHead className="text-center">Огноо</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id} className="hover:bg-muted/50">
                      <TableCell>
                        <div className="font-mono text-sm font-medium">
                          {order.order_number}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {order.profiles?.full_name || "—"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {order.profiles?.email}
                        </div>
                        {order.profiles?.phone && (
                          <div className="text-xs text-muted-foreground">
                            {order.profiles.phone}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getDeliveryType(order.delivery_type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="font-medium">
                          {formatCurrency(Number(order.total))}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Хүргэлт: {formatCurrency(Number(order.delivery_fee))}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Select
                          value={order.status}
                          onValueChange={(value) => 
                            updateStatusMutation.mutate({ id: order.id, status: value })
                          }
                        >
                          <SelectTrigger className="w-40 h-8">
                            <SelectValue>
                              {getStatusBadge(order.status)}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {statusOptions.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                <span className={`px-2 py-0.5 rounded-full text-xs ${opt.color}`}>
                                  {opt.label}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-center text-sm text-muted-foreground">
                        {format(new Date(order.created_at), "yyyy-MM-dd HH:mm")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Захиалга олдсонгүй</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
