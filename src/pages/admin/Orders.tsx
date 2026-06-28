import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { ShoppingCart, Phone, Truck, CheckCircle2, AlertTriangle } from "lucide-react";
import LocalOrdersTab from "./orders/LocalOrdersTab";

export default function Orders() {
  const { data: stats } = useQuery({
    queryKey: ["admin", "orders", "header-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("fulfillment_status, payment_status")
        .limit(10000);
      if (error) throw error;
      const rows = data || [];
      return {
        confirmed: rows.filter((o: any) => (o.fulfillment_status || "confirmed") === "confirmed").length,
        phoneConfirmed: rows.filter((o: any) => o.fulfillment_status === "phone_confirmed").length,
        outForDelivery: rows.filter((o: any) => o.fulfillment_status === "out_for_delivery").length,
        delivered: rows.filter((o: any) => o.fulfillment_status === "delivered").length,
        unpaid: rows.filter((o: any) => o.payment_status !== "paid" && o.fulfillment_status !== "cancelled").length,
      };
    },
  });

  const cards = [
    { label: "Шинэ захиалга", value: stats?.confirmed ?? 0, icon: ShoppingCart, color: "text-blue-600" },
    { label: "Утсаар баталгаажсан", value: stats?.phoneConfirmed ?? 0, icon: Phone, color: "text-cyan-600" },
    { label: "Хүргэлтэнд", value: stats?.outForDelivery ?? 0, icon: Truck, color: "text-purple-600" },
    { label: "Хүргэгдсэн", value: stats?.delivered ?? 0, icon: CheckCircle2, color: "text-green-600" },
    { label: "Төлөгдөөгүй", value: stats?.unpaid ?? 0, icon: AlertTriangle, color: "text-red-600" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Захиалга</h1>
        <p className="text-muted-foreground mt-1">Бүх захиалгуудыг нэг дороос харах, удирдах</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-3 text-center">
              <c.icon className={`h-5 w-5 mx-auto mb-1 ${c.color}`} />
              <div className="text-2xl font-bold">{c.value}</div>
              <div className="text-xs text-muted-foreground">{c.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <LocalOrdersTab />
    </div>
  );
}
