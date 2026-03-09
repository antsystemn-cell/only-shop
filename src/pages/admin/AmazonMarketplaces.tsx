import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Globe } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function AmazonMarketplaces() {
  const queryClient = useQueryClient();

  const { data: marketplaces, isLoading } = useQuery({
    queryKey: ["amazon-marketplaces-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("amazon_marketplaces")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: boolean }) => {
      const { error } = await supabase
        .from("amazon_marketplaces")
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["amazon-marketplaces-admin"] });
      toast({ title: "Шинэчлэгдлээ" });
    },
  });

  if (isLoading) {
    return <div className="flex items-center justify-center p-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Amazon Marketplace тохиргоо</h1>
        <p className="text-muted-foreground">Marketplace бүрийг идэвхжүүлэх, импорт/дэлгүүрт ашиглах тохиргоо</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Marketplace жагсаалт
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Marketplace</TableHead>
                <TableHead>Marketplace ID</TableHead>
                <TableHead>Бүс</TableHead>
                <TableHead>Валют</TableHead>
                <TableHead>Идэвхтэй</TableHead>
                <TableHead>Импорт</TableHead>
                <TableHead>Дэлгүүр</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {marketplaces?.map((mp) => (
                <TableRow key={mp.id}>
                  <TableCell className="font-medium">{mp.name}</TableCell>
                  <TableCell><Badge variant="outline">{mp.marketplace_id}</Badge></TableCell>
                  <TableCell>{mp.region}</TableCell>
                  <TableCell>{mp.currency}</TableCell>
                  <TableCell>
                    <Switch
                      checked={mp.is_enabled ?? false}
                      onCheckedChange={(v) => updateMutation.mutate({ id: mp.id, field: "is_enabled", value: v })}
                    />
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={mp.is_default_import ?? false}
                      onCheckedChange={(v) => updateMutation.mutate({ id: mp.id, field: "is_default_import", value: v })}
                    />
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={mp.is_default_storefront ?? false}
                      onCheckedChange={(v) => updateMutation.mutate({ id: mp.id, field: "is_default_storefront", value: v })}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
