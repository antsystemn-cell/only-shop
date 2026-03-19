import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Search, Package, ExternalLink, Copy, Loader2, ListPlus, Save, Pencil } from "lucide-react";
import { fetchProductDetail, type ProductDetail } from "@/services/otApi";
import { invalidateCacheByPrefix } from "@/services/apiCache";
import { supabase } from "@/integrations/supabase/client";

export default function CatalogItems() {
  const [itemId, setItemId] = useState("");
  const [bulkIds, setBulkIds] = useState("");
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [bulkProducts, setBulkProducts] = useState<ProductDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);

  const handleSearch = async () => {
    if (!itemId.trim()) return;
    setLoading(true);
    try {
      const detail = await fetchProductDetail(itemId.trim());
      setProduct(detail);
    } catch (e: any) {
      toast.error("Бараа олдсонгүй: " + e.message);
      setProduct(null);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkSearch = async () => {
    const ids = bulkIds.split(/[\n,;\s]+/).map(s => s.trim()).filter(Boolean);
    if (!ids.length) return;
    setBulkLoading(true);
    setBulkProducts([]);
    const results: ProductDetail[] = [];
    for (const id of ids.slice(0, 20)) {
      try {
        const detail = await fetchProductDetail(id);
        results.push(detail);
      } catch {
        // skip invalid
      }
    }
    setBulkProducts(results);
    setBulkLoading(false);
    toast.success(`${results.length}/${ids.length} бараа олдлоо`);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Бараа засах</h1>
        <p className="text-muted-foreground mt-1">OT API барааны мэдээлэл харах, нэр/сонголт засах</p>
      </div>

      <Tabs defaultValue="single">
        <TabsList>
          <TabsTrigger value="single"><Search className="h-4 w-4 mr-1" />Нэг бараа</TabsTrigger>
          <TabsTrigger value="bulk"><ListPlus className="h-4 w-4 mr-1" />Бөөнөөр хайх</TabsTrigger>
        </TabsList>

        <TabsContent value="single" className="mt-4 space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="OT API Item ID оруулах..."
                    value={itemId}
                    onChange={(e) => setItemId(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    className="pl-10"
                  />
                </div>
                <Button onClick={handleSearch} disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  Хайх
                </Button>
              </div>
            </CardContent>
          </Card>

          {loading && <Skeleton className="h-96 w-full" />}

          {product && <ProductDetailCard product={product} onUpdated={() => handleSearch()} />}
        </TabsContent>

        <TabsContent value="bulk" className="mt-4 space-y-4">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div>
                <Label>Item ID-нүүд (мөр бүрт нэг, таслалаар, эсвэл зайгаар тусгаарлах)</Label>
                <Textarea
                  placeholder={"643982511525\n644123456789\n644987654321"}
                  value={bulkIds}
                  onChange={(e) => setBulkIds(e.target.value)}
                  rows={5}
                  className="mt-1 font-mono text-sm"
                />
              </div>
              <div className="flex items-center gap-4">
                <Button onClick={handleBulkSearch} disabled={bulkLoading}>
                  {bulkLoading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  Бөөнөөр хайх (макс 20)
                </Button>
                <span className="text-sm text-muted-foreground">
                  {bulkIds.split(/[\n,;\s]+/).filter(Boolean).length} ID оруулсан
                </span>
              </div>
            </CardContent>
          </Card>

          {bulkLoading && <Skeleton className="h-48 w-full" />}

          {bulkProducts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  Олдсон бараанууд
                  <Badge variant="secondary">{bulkProducts.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {bulkProducts.map(p => (
                  <div key={p.id} className="flex items-center gap-4 p-3 border rounded-lg hover:bg-muted/50">
                    {p.imageUrl && <img src={p.imageUrl} alt="" className="w-14 h-14 object-cover rounded border shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium line-clamp-1">{p.title}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span className="font-mono">{p.id}</span>
                        {p.brandName && <Badge variant="outline" className="text-xs">{p.brandName}</Badge>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold">{p.currency}{p.price?.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Үлдэгдэл: {p.quantity ?? "?"}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => { setItemId(p.id); setProduct(p); }}>
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Product Detail Card with Editing ────────────────────────

function ProductDetailCard({ product, onUpdated }: { product: ProductDetail; onUpdated: () => void }) {
  const [titleOverride, setTitleOverride] = useState("");
  const [variantOverrides, setVariantOverrides] = useState<Record<string, string>>({});
  const [savingTitle, setSavingTitle] = useState(false);
  const [savingVariants, setSavingVariants] = useState(false);
  const [hasExistingOverride, setHasExistingOverride] = useState(false);

  // Load existing overrides when product changes
  useEffect(() => {
    setTitleOverride(product.title);
    // Initialize variant overrides from current values
    const vOverrides: Record<string, string> = {};
    product.configurators.forEach(c => {
      c.values.forEach(v => {
        vOverrides[v.id] = v.value;
      });
    });
    setVariantOverrides(vOverrides);

    // Check if override exists in DB
    supabase
      .from("catalog_item_overrides")
      .select("title_override, variant_overrides")
      .eq("item_id", product.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setHasExistingOverride(true);
          if (data.title_override) setTitleOverride(data.title_override);
          if (data.variant_overrides && typeof data.variant_overrides === "object") {
            const dbOverrides = data.variant_overrides as Record<string, string>;
            setVariantOverrides(prev => ({ ...prev, ...dbOverrides }));
          }
        } else {
          setHasExistingOverride(false);
        }
      });
  }, [product.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        item_id: product.id,
        title_override: titleOverride !== product.title ? titleOverride : null,
        variant_overrides: variantOverrides,
      };

      if (hasExistingOverride) {
        const { error } = await supabase
          .from("catalog_item_overrides")
          .update({ title_override: payload.title_override, variant_overrides: payload.variant_overrides as any })
          .eq("item_id", product.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("catalog_item_overrides")
          .insert(payload as any);
        if (error) throw error;
        setHasExistingOverride(true);
      }

      toast.success("Амжилттай хадгалагдлаа");
      // Invalidate product cache and refetch
      invalidateCacheByPrefix(`product:${product.id}`);
      onUpdated();
    } catch (e: any) {
      toast.error("Алдаа: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const copyId = () => {
    navigator.clipboard.writeText(product.id);
    toast.success("ID хуулагдлаа");
  };

  // Build a map: configuredItem -> its source price
  const configuredItemPriceMap = new Map<string, { price?: number; sourcePriceText?: string }>();
  product.configuredItems.forEach(ci => {
    configuredItemPriceMap.set(ci.id, {
      price: ci.price,
      sourcePriceText: ci.originalSourcePrice
        ? `${ci.originalSourceCurrency || ""}${ci.originalSourcePrice}`
        : undefined,
    });
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          <span className="line-clamp-1">{titleOverride || product.title}</span>
          {hasExistingOverride && <Badge variant="secondary" className="shrink-0">Засварлагдсан</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            {product.imageUrl && (
              <img src={product.imageUrl} alt={product.title} className="w-full max-w-sm rounded-lg border" />
            )}
            <div className="flex gap-2 mt-3 flex-wrap">
              {product.images.slice(0, 5).map((img, i) => (
                <img key={i} src={img} alt="" className="w-16 h-16 object-cover rounded border" />
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Label className="text-muted-foreground">ID</Label>
              <p className="font-mono">{product.id}</p>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={copyId}><Copy className="h-3 w-3" /></Button>
            </div>

            {/* Editable title */}
            <div className="space-y-1.5">
              <Label className="text-muted-foreground flex items-center gap-1">
                <Pencil className="h-3 w-3" /> Барааны нэр (засварлах)
              </Label>
              <Input
                value={titleOverride}
                onChange={(e) => setTitleOverride(e.target.value)}
                className="font-medium"
              />
            </div>

            <div><Label className="text-muted-foreground">Үнэ</Label><p className="text-xl font-bold">{product.currency}{product.price?.toLocaleString()}</p></div>
            {product.originalPrice && <div><Label className="text-muted-foreground">Үндсэн үнэ</Label><p className="line-through text-muted-foreground">{product.currency}{product.originalPrice?.toLocaleString()}</p></div>}
            {product.vendorName && <div><Label className="text-muted-foreground">Дэлгүүр</Label><p>{product.vendorName}</p></div>}
            {product.brandName && <div><Label className="text-muted-foreground">Брэнд</Label><p>{product.brandName}</p></div>}
            <div><Label className="text-muted-foreground">Үлдэгдэл</Label><p>{product.quantity ?? "Мэдэгдэхгүй"}</p></div>
            {product.externalUrl && (
              <a href={product.externalUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1">
                <ExternalLink className="h-3 w-3" /> Эх сурвалж руу очих
              </a>
            )}
          </div>
        </div>

        {product.features.length > 0 && (
          <div>
            <h3 className="font-semibold mb-2">Шинж чанарууд</h3>
            <div className="grid grid-cols-2 gap-2">
              {product.features.map((f, i) => (
                <div key={i} className="flex gap-2 text-sm">
                  <span className="text-muted-foreground">{f.name}:</span>
                  <span>{f.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {product.configurators.length > 0 && (
          <div>
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Pencil className="h-4 w-4" />
              Тохиргоо / Сонголтууд ({product.configurators.length})
            </h3>
            {product.configurators.map((c) => (
              <div key={c.pid} className="mb-4">
                <Label className="text-muted-foreground">{c.propertyName}</Label>
                <div className="space-y-2 mt-2">
                  {c.values.map((v) => {
                    // Find matching configuredItem to show source price
                    const matchingCIs = product.configuredItems.filter(ci =>
                      ci.configuratorIds.includes(v.id)
                    );
                    const sourcePrices = matchingCIs
                      .map(ci => ci.originalSourcePrice ? `${ci.originalSourceCurrency || ""}${ci.originalSourcePrice}` : null)
                      .filter(Boolean);
                    const uniquePrices = [...new Set(sourcePrices)];

                    return (
                      <div key={v.id} className="flex items-center gap-3 p-2 border rounded-lg bg-muted/30">
                        {v.imageUrl && <img src={v.imageUrl} alt="" className="w-8 h-8 object-cover rounded shrink-0" />}
                        <Input
                          value={variantOverrides[v.id] || ""}
                          onChange={(e) => setVariantOverrides(prev => ({ ...prev, [v.id]: e.target.value }))}
                          className="flex-1 h-8 text-sm"
                        />
                        {uniquePrices.length > 0 && (
                          <Badge variant="outline" className="shrink-0 text-xs">
                            Эх үнэ: {uniquePrices.join(" / ")}
                          </Badge>
                        )}
                        {matchingCIs.length > 0 && matchingCIs[0].price && (
                          <span className="text-xs text-muted-foreground shrink-0">
                            ₮{matchingCIs[0].price.toLocaleString()}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ConfiguredItems with source prices */}
        {product.configuredItems.length > 0 && (
          <div>
            <h3 className="font-semibold mb-2">Сонголтуудын үнийн мэдээлэл ({product.configuredItems.length})</h3>
            <div className="max-h-[300px] overflow-y-auto space-y-1">
              {product.configuredItems.map((ci) => (
                <div key={ci.id} className="flex items-center gap-3 p-2 border rounded text-sm">
                  {ci.imageUrl && <img src={ci.imageUrl} alt="" className="w-8 h-8 object-cover rounded shrink-0" />}
                  <span className="font-mono text-xs text-muted-foreground">{ci.id}</span>
                  <span className="text-xs">Тоо: {ci.quantity ?? "?"}</span>
                  {ci.originalSourcePrice && (
                    <Badge variant="outline" className="text-xs">
                      Эх: {ci.originalSourceCurrency}{ci.originalSourcePrice}
                    </Badge>
                  )}
                  {ci.price && (
                    <span className="font-medium ml-auto">₮{ci.price.toLocaleString()}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Save button */}
        <div className="flex justify-end pt-4 border-t">
          <Button onClick={handleSave} disabled={saving} size="lg">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Өөрчлөлт хадгалах
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
