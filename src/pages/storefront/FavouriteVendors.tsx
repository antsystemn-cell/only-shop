import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Store, Star, Trash2, ExternalLink, Heart,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function FavouriteVendors() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const { data: vendors, isLoading } = useQuery({
    queryKey: ["favourite-vendors", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("favourite_vendors")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("favourite_vendors")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["favourite-vendors"] });
      toast({ title: "Борлуулагч хасагдлаа" });
      setDeleteTarget(null);
    },
    onError: (e: any) => toast({ title: "Алдаа", description: e.message, variant: "destructive" }),
  });

  if (!user) {
    return (
      <div className="container py-20 text-center">
        <Heart className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
        <h2 className="text-xl font-semibold mb-2">Нэвтэрнэ үү</h2>
        <p className="text-muted-foreground mb-4">Дуртай борлуулагчдыг харахын тулд нэвтрэх шаардлагатай</p>
        <Button onClick={() => navigate("/auth")}>Нэвтрэх</Button>
      </div>
    );
  }

  return (
    <div className="container py-6 max-w-4xl animate-fade-in">
      <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4" /> Нүүр хуудас
      </Link>

      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Store className="h-6 w-6 text-primary" />
        Дуртай борлуулагчид
      </h1>

      {isLoading ? (
        <div className="grid gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : vendors && vendors.length > 0 ? (
        <div className="grid gap-4">
          {vendors.map((v: any) => (
            <Card key={v.id} className="hover:shadow-md transition-shadow">
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Store className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium">{v.vendor_name || v.vendor_id}</h3>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
                      <span className="font-mono text-xs">ID: {v.vendor_id}</span>
                      {v.vendor_score != null && (
                        <span className="flex items-center gap-1">
                          <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                          {Number(v.vendor_score).toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {v.vendor_url && (
                    <a href={v.vendor_url} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="icon">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </a>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(v.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-muted-foreground">
          <Store className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium mb-1">Дуртай борлуулагч байхгүй</p>
          <p className="text-sm">Барааны дэлгэрэнгүй хуудсаас борлуулагчийг дуртай жагсаалтад нэмнэ үү</p>
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Борлуулагч хасах</AlertDialogTitle>
            <AlertDialogDescription>
              Энэ борлуулагчийг дуртай жагсаалтаас хасах уу?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Болих</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && removeMutation.mutate(deleteTarget)}>
              Хасах
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
