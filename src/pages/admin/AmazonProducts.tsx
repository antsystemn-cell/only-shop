import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Loader2, Package, MoreHorizontal, RefreshCw, Globe, Archive, CheckCircle, XCircle, FlaskConical } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function AmazonProducts() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: serverConfig } = useQuery({
    queryKey: ["amazon-config"],
    queryFn: async () => {
      const { data } = await supabase.functions.invoke("amazon-api", { body: { action: "getConfig" } });
      return data;
    },
  });

  const isSandbox = serverConfig?.sandbox === true;

  const { data: products, isLoading } = useQuery({
    queryKey: ["amazon-products", statusFilter],
    queryFn: async () => {
      const query = supabase
        .from("amazon_products")
        .select("*, amazon_product_store_settings(*)")
        .order("created_at", { ascending: false })
        .limit(100);

      const { data, error } = await query;
      if (error) throw error;

      if (statusFilter !== "all" && data) {
        return data.filter((p) => {
          const settings = Array.isArray(p.amazon_product_store_settings)
            ? p.amazon_product_store_settings[0]
            : p.amazon_product_store_settings;
          return (settings?.publish_status || "draft") === statusFilter;
        });
      }
      return data;
    },
  });

  const updatePublishMutation = useMutation({
    mutationFn: async ({ productId, status }: { productId: string; status: string }) => {
      const { error } = await supabase
        .from("amazon_product_store_settings")
        .upsert(
          { amazon_product_id: productId, publish_status: status, updated_at: new Date().toISOString() },
          { onConflict: "amazon_product_id" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["amazon-products"] });
      toast({ title: "Статус шинэчлэгдлээ" });
    },
  });

  const resyncMutation = useMutation({
    mutationFn: async (asin: string) => {
      const product = products?.find((p) => p.asin === asin);
      const { error } = await supabase.functions.invoke("amazon-api", {
        body: { action: "importProducts", params: { asins: [asin], marketplaceId: product?.marketplace_id } },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["amazon-products"] });
      toast({ title: "Синк амжилттай" });
    },
  });

  const filtered = products?.filter(
    (p) => !search || (p.title || "").toLowerCase().includes(search.toLowerCase()) || p.asin.includes(search)
  );

  const getPublishBadge = (product: any) => {
    const settings = Array.isArray(product.amazon_product_store_settings)
      ? product.amazon_product_store_settings[0]
      : product.amazon_product_store_settings;
    const status = settings?.publish_status || "draft";
    switch (status) {
      case "published":
        return (
          <Badge>
            <CheckCircle className="h-3 w-3 mr-1" />Нийтлэгдсэн
          </Badge>
        );
      case "archived":
        return (
          <Badge variant="secondary">
            <Archive className="h-3 w-3 mr-1" />Архивлагдсан
          </Badge>
        );
      default:
        return <Badge variant="outline">Ноорог</Badge>;
    }
  };

  const isSandboxProduct = (product: any) => {
    const raw = product.raw_payload as any;
    return raw?.sandbox === true || raw?.fixture === true;
  };

  if (isLoading) {
    return <div className="flex items-center justify-center p-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Amazon импортлогдсон бараа</h1>
          <p className="text-muted-foreground">Импортлогдсон бүх бараануудыг удирдах</p>
        </div>
        {isSandbox && (
          <Badge variant="secondary">
            <FlaskConical className="h-3 w-3 mr-1" /> Sandbox
          </Badge>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" /> Бараанууд ({filtered?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <Input placeholder="Нэр, ASIN-аар хайх..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Бүгд</SelectItem>
                <SelectItem value="published">Нийтлэгдсэн</SelectItem>
                <SelectItem value="draft">Ноорог</SelectItem>
                <SelectItem value="archived">Архивлагдсан</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Зураг</TableHead>
                <TableHead>Нэр</TableHead>
                <TableHead>ASIN</TableHead>
                <TableHead>Брэнд</TableHead>
                <TableHead>Marketplace</TableHead>
                <TableHead>Синк</TableHead>
                <TableHead>Нийтлэл</TableHead>
                <TableHead>Үйлдэл</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered?.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    {product.main_image ? (
                      <img src={product.main_image} alt="" className="w-12 h-12 object-cover rounded" />
                    ) : (
                      <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                        <Package className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="max-w-xs truncate font-medium">
                    {product.title || "—"}
                    {isSandboxProduct(product) && (
                      <Badge variant="outline" className="ml-2 text-amber-600 border-amber-400 text-[10px]">sandbox</Badge>
                    )}
                  </TableCell>
                  <TableCell><Badge variant="outline">{product.asin}</Badge></TableCell>
                  <TableCell>{product.brand || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary"><Globe className="h-3 w-3 mr-1" />{product.marketplace_id}</Badge>
                  </TableCell>
                  <TableCell>
                    <p className="text-xs text-muted-foreground">
                      {product.last_synced_at ? new Date(product.last_synced_at).toLocaleString("mn-MN") : "—"}
                    </p>
                  </TableCell>
                  <TableCell>{getPublishBadge(product)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => updatePublishMutation.mutate({ productId: product.id, status: "published" })}>
                          <CheckCircle className="h-4 w-4 mr-2" /> Нийтлэх
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updatePublishMutation.mutate({ productId: product.id, status: "draft" })}>
                          <XCircle className="h-4 w-4 mr-2" /> Ноорог болгох
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => resyncMutation.mutate(product.asin)}>
                          <RefreshCw className="h-4 w-4 mr-2" /> Дахин синк
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updatePublishMutation.mutate({ productId: product.id, status: "archived" })}>
                          <Archive className="h-4 w-4 mr-2" /> Архивлах
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {(!filtered || filtered.length === 0) && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Импортлогдсон бараа байхгүй байна
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
