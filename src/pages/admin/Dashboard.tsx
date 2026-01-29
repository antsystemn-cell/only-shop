import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Package,
  ShoppingCart,
  Users,
  TrendingUp,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ElementType;
  loading?: boolean;
}

function StatsCard({ title, value, change, icon: Icon, loading }: StatsCardProps) {
  if (loading) {
    return (
      <Card className="hover-lift">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-8 rounded" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-20 mb-2" />
          <Skeleton className="h-4 w-16" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="hover-lift">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {change !== undefined && (
          <div className={`flex items-center text-sm mt-1 ${change >= 0 ? "text-green-600" : "text-red-600"}`}>
            {change >= 0 ? (
              <ArrowUpRight className="h-4 w-4 mr-1" />
            ) : (
              <ArrowDownRight className="h-4 w-4 mr-1" />
            )}
            <span>{Math.abs(change)}% өнгөрсөн 7 хоногоос</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("mn-MN", {
    style: "decimal",
    minimumFractionDigits: 0,
  }).format(amount) + "₮";
}

export default function Dashboard() {
  // Fetch products count
  const { data: productsCount, isLoading: productsLoading } = useQuery({
    queryKey: ["admin", "products", "count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return count || 0;
    },
  });

  // Fetch orders data
  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ["admin", "orders", "stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, total, status, created_at");
      if (error) throw error;
      
      const totalRevenue = data?.reduce((sum, order) => sum + Number(order.total || 0), 0) || 0;
      const ordersCount = data?.length || 0;
      const pendingOrders = data?.filter(o => o.status === "pending").length || 0;
      
      return { totalRevenue, ordersCount, pendingOrders };
    },
  });

  // Fetch users count
  const { data: usersCount, isLoading: usersLoading } = useQuery({
    queryKey: ["admin", "users", "count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return count || 0;
    },
  });

  // Fetch recent orders
  const { data: recentOrders, isLoading: recentOrdersLoading } = useQuery({
    queryKey: ["admin", "orders", "recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          id,
          order_number,
          total,
          status,
          created_at,
          profiles!orders_user_id_fkey (
            full_name,
            email
          )
        `)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
  });

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      pending: { label: "Хүлээгдэж байна", className: "bg-yellow-100 text-yellow-800" },
      processing: { label: "Бэлтгэгдэж байна", className: "bg-blue-100 text-blue-800" },
      shipped: { label: "Хүргэлтэд гарсан", className: "bg-purple-100 text-purple-800" },
      delivered: { label: "Хүргэгдсэн", className: "bg-green-100 text-green-800" },
      cancelled: { label: "Цуцлагдсан", className: "bg-red-100 text-red-800" },
    };
    const s = statusMap[status] || { label: status, className: "bg-gray-100 text-gray-800" };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${s.className}`}>
        {s.label}
      </span>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold">Хянах самбар</h1>
        <p className="text-muted-foreground mt-1">
          Only дэлгүүрийн ерөнхий мэдээлэл
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Нийт орлого"
          value={ordersData ? formatCurrency(ordersData.totalRevenue) : "0₮"}
          change={12.5}
          icon={DollarSign}
          loading={ordersLoading}
        />
        <StatsCard
          title="Захиалга"
          value={ordersData?.ordersCount || 0}
          change={8.2}
          icon={ShoppingCart}
          loading={ordersLoading}
        />
        <StatsCard
          title="Бараа"
          value={productsCount || 0}
          icon={Package}
          loading={productsLoading}
        />
        <StatsCard
          title="Хэрэглэгч"
          value={usersCount || 0}
          change={15.3}
          icon={Users}
          loading={usersLoading}
        />
      </div>

      {/* Recent orders section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Сүүлийн захиалгууд
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentOrdersLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : recentOrders && recentOrders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">
                      Захиалгын дугаар
                    </th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">
                      Хэрэглэгч
                    </th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">
                      Дүн
                    </th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">
                      Төлөв
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order: any) => (
                    <tr key={order.id} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="py-3 px-2 font-mono text-sm">
                        {order.order_number}
                      </td>
                      <td className="py-3 px-2">
                        <div className="text-sm">{order.profiles?.full_name || "—"}</div>
                        <div className="text-xs text-muted-foreground">{order.profiles?.email}</div>
                      </td>
                      <td className="py-3 px-2 font-medium">
                        {formatCurrency(Number(order.total))}
                      </td>
                      <td className="py-3 px-2">{getStatusBadge(order.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Захиалга байхгүй байна</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
