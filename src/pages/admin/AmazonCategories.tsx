import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, FolderTree, RefreshCw, Link2, AlertTriangle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function AmazonCategories() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [syncing, setSyncing] = useState(false);

  const { data: categories, isLoading } = useQuery({
    queryKey: ["amazon-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("amazon_categories")
        .select("*, amazon_category_mappings(*)")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: localCategories } = useQuery({
    queryKey: ["local-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("id, name_mn").order("name_mn");
      if (error) throw error;
      return data;
    },
  });

  const mapMutation = useMutation({
    mutationFn: async ({ amazonCatId, localCatId }: { amazonCatId: string; localCatId: string | null }) => {
      if (localCatId) {
        const { error } = await supabase
          .from("amazon_category_mappings")
          .upsert({
            amazon_category_id: amazonCatId,
            local_category_id: localCatId,
            is_active: true,
            mapping_type: "manual",
          }, { onConflict: "amazon_category_id" });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("amazon_category_mappings")
          .delete()
          .eq("amazon_category_id", amazonCatId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["amazon-categories"] });
      toast({ title: "Маппинг хадгалагдлаа" });
    },
  });

  const syncCategories = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("amazon-api", {
        body: { action: "syncCategories" },
      });
      if (error) throw error;
      toast({ title: "Ангилал синк хийгдлээ", description: `${data?.count || 0} ангилал` });
      queryClient.invalidateQueries({ queryKey: ["amazon-categories"] });
    } catch (e: any) {
      toast({ title: "Алдаа", description: e.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const filtered = categories?.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const unmappedCount = categories?.filter(
    (c) => !c.amazon_category_mappings || (Array.isArray(c.amazon_category_mappings) ? c.amazon_category_mappings.length === 0 : !c.amazon_category_mappings)
  ).length;

  if (isLoading) {
    return <div className="flex items-center justify-center p-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Amazon ангилал маппинг</h1>
          <p className="text-muted-foreground">Amazon ангилалуудыг дотоод ангилалтай холбох</p>
        </div>
        <Button onClick={syncCategories} disabled={syncing}>
          {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Ангилал синк хийх
        </Button>
      </div>

      {unmappedCount && unmappedCount > 0 && (
        <Card className="border-yellow-500/50 bg-yellow-500/5">
          <CardContent className="flex items-center gap-3 py-3">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            <p className="text-sm">{unmappedCount} маппинг хийгдээгүй ангилал байна</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderTree className="h-5 w-5" />
            Ангилалууд ({filtered?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="Ангилал хайх..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-4 max-w-sm"
          />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Amazon ангилал</TableHead>
                <TableHead>Browse Node</TableHead>
                <TableHead>Marketplace</TableHead>
                <TableHead>Бараа тоо</TableHead>
                <TableHead>Дотоод ангилал</TableHead>
                <TableHead>Статус</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered?.map((cat) => {
                const mapping = cat.amazon_category_mappings?.[0];
                return (
                  <TableRow key={cat.id}>
                    <TableCell className="font-medium">{cat.name}</TableCell>
                    <TableCell><Badge variant="outline">{cat.browse_node_id || "—"}</Badge></TableCell>
                    <TableCell>{cat.marketplace_id}</TableCell>
                    <TableCell>{cat.product_count}</TableCell>
                    <TableCell>
                      <Select
                        value={mapping?.local_category_id || "none"}
                        onValueChange={(v) =>
                          mapMutation.mutate({
                            amazonCatId: cat.id,
                            localCatId: v === "none" ? null : v,
                          })
                        }
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Сонгох..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— Маппинггүй —</SelectItem>
                          {localCategories?.map((lc) => (
                            <SelectItem key={lc.id} value={lc.id}>{lc.name_mn}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {mapping ? (
                        <Badge>
                          <Link2 className="h-3 w-3 mr-1" />Холбогдсон
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Холбогдоогүй</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {(!filtered || filtered.length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Ангилал олдсонгүй. Эхлээд синк хийнэ үү.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
