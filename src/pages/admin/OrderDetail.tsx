import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import OrderDetailSheet from "@/components/admin/OrderDetailSheet";
import { updateFulfillmentStatus, updatePaymentStatus } from "@/lib/orderService";

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();

  const { data: order, isLoading } = useQuery({
    queryKey: ["admin", "order-detail", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      if (data?.user_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("user_id, full_name, email, phone")
          .eq("user_id", data.user_id)
          .maybeSingle();
        return { ...data, profile: profile || null };
      }
      return data ? { ...data, profile: null } : null;
    },
  });

  const fulfillmentMutation = useMutation({
    mutationFn: ({ oldStatus, newStatus }: { oldStatus: string; newStatus: string }) =>
      updateFulfillmentStatus(id!, oldStatus, newStatus),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "order-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["admin", "orders-unified"] });
      toast({ title: "Төлөв шинэчлэгдлээ" });
    },
    onError: (e: any) => toast({ title: "Алдаа", description: e.message, variant: "destructive" }),
  });

  const paymentMutation = useMutation({
    mutationFn: ({ oldStatus, newStatus }: { oldStatus: string; newStatus: string }) =>
      updatePaymentStatus(id!, oldStatus, newStatus),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "order-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["admin", "orders-unified"] });
      toast({ title: "Төлбөрийн төлөв шинэчлэгдлээ" });
    },
    onError: (e: any) => toast({ title: "Алдаа", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="p-4 sm:p-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/admin/orders")} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" /> Захиалгууд руу буцах
      </Button>

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : !order ? (
        <div className="text-center py-12 text-muted-foreground">Захиалга олдсонгүй</div>
      ) : (
        <OrderDetailSheet
          order={order}
          open={true}
          onClose={() => navigate("/admin/orders")}
          onFulfillmentChange={(oldS, newS) => fulfillmentMutation.mutate({ oldStatus: oldS, newStatus: newS })}
          onPaymentChange={(oldS, newS) => paymentMutation.mutate({ oldStatus: oldS, newStatus: newS })}
          isMobile={isMobile}
        />
      )}
    </div>
  );
}
