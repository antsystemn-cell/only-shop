import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Search, Package } from "lucide-react";
import { fetchProductDetail, type ProductDetail } from "@/services/otApi";

export default function CatalogItems() {
  const [itemId, setItemId] = useState("");
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Бараа засах</h1>
        <p className="text-muted-foreground mt-1">OT API барааны мэдээлэл харах, засах</p>
      </div>

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
            <Button onClick={handleSearch} disabled={loading}>Хайх</Button>
          </div>
        </CardContent>
      </Card>

      {loading && <Skeleton className="h-96 w-full" />}

      {product && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              {product.title}
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
                <div><Label className="text-muted-foreground">ID</Label><p className="font-mono">{product.id}</p></div>
                <div><Label className="text-muted-foreground">Үнэ</Label><p className="text-xl font-bold">{product.currency}{product.price}</p></div>
                {product.originalPrice && <div><Label className="text-muted-foreground">Үндсэн үнэ</Label><p className="line-through text-muted-foreground">{product.currency}{product.originalPrice}</p></div>}
                {product.vendorName && <div><Label className="text-muted-foreground">Дэлгүүр</Label><p>{product.vendorName}</p></div>}
                {product.brandName && <div><Label className="text-muted-foreground">Брэнд</Label><p>{product.brandName}</p></div>}
                <div><Label className="text-muted-foreground">Үлдэгдэл</Label><p>{product.quantity ?? "Мэдэгдэхгүй"}</p></div>
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
                <h3 className="font-semibold mb-2">Тохиргоо</h3>
                {product.configurators.map((c) => (
                  <div key={c.pid} className="mb-3">
                    <Label className="text-muted-foreground">{c.propertyName}</Label>
                    <div className="flex gap-2 flex-wrap mt-1">
                      {c.values.map((v) => (
                        <div key={v.id} className="flex items-center gap-1 px-2 py-1 border rounded text-sm">
                          {v.imageUrl && <img src={v.imageUrl} alt="" className="w-6 h-6 object-cover rounded" />}
                          {v.value}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
