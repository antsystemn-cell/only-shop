import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  ShoppingCart,
  Star,
  Store,
  Minus,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchProductDetail, fetchProductDescription } from "@/services/otApi";
import { useOtCart } from "@/contexts/OtCartContext";
import { toast } from "sonner";

export default function OtProductDetail() {
  const { itemId } = useParams<{ itemId: string }>();
  const { addItem, isLoading: isCartLoading } = useOtCart();
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedConfigs, setSelectedConfigs] = useState<Record<string, string>>({});

  const { data: product, isLoading } = useQuery({
    queryKey: ["ot-product", itemId],
    queryFn: () => fetchProductDetail(itemId!),
    enabled: !!itemId,
    staleTime: 1000 * 60 * 10,
  });

  const { data: description } = useQuery({
    queryKey: ["ot-product-desc", itemId],
    queryFn: () => fetchProductDescription(itemId!),
    enabled: !!itemId,
    staleTime: 1000 * 60 * 10,
  });

  // Find matching configured item based on selected configurators
  const matchedConfig = useMemo(() => {
    if (!product?.configuredItems?.length || !Object.keys(selectedConfigs).length) return null;
    const selectedVids = Object.values(selectedConfigs);
    return product.configuredItems.find((ci) =>
      selectedVids.every((vid) => ci.configuratorIds.includes(vid))
    );
  }, [product, selectedConfigs]);

  const effectivePrice = matchedConfig?.price ?? product?.price ?? 0;
  const effectiveQuantity = matchedConfig?.quantity ?? product?.quantity;
  const effectiveImage = matchedConfig?.imageUrl || product?.images?.[selectedImage] || product?.imageUrl;

  const handleAddToCart = async () => {
    if (!product) return;
    // Build configurator string from selected configs
    let configurators: string | undefined;
    if (Object.keys(selectedConfigs).length > 0) {
      const parts = Object.entries(selectedConfigs)
        .filter(([, vid]) => vid)
        .map(([pid, vid]) => `<Item><Pid>${pid}</Pid><Vid>${vid}</Vid></Item>`)
        .join("");
      if (parts) {
        configurators = `<ItemConfigurationValues>${parts}</ItemConfigurationValues>`;
      }
    }
    try {
      await addItem(product.id, quantity, configurators);
    } catch {
      // toast already shown in context
    }
  };

  if (isLoading) {
    return (
      <div className="container py-8 animate-fade-in">
        <div className="grid md:grid-cols-2 gap-8">
          <Skeleton className="aspect-square rounded-xl" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-10 w-1/3" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container py-20 text-center">
        <p className="text-lg text-muted-foreground">Бараа олдсонгүй</p>
        <Link to="/ot">
          <Button className="mt-4">Маркетплэйс руу буцах</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container py-6 md:py-8 animate-fade-in">
      {/* Breadcrumbs */}
      {product.breadcrumbs.length > 0 && (
        <div className="flex items-center gap-1 text-sm text-muted-foreground mb-4 flex-wrap">
          <Link to="/ot" className="hover:text-foreground">Маркетплэйс</Link>
          {product.breadcrumbs.map((bc) => (
            <span key={bc.id} className="flex items-center gap-1">
              <span>/</span>
              <Link to={`/ot?category=${bc.id}`} className="hover:text-foreground">
                {bc.name}
              </Link>
            </span>
          ))}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6 md:gap-10">
        {/* Image Gallery */}
        <div>
          <div className="relative aspect-square rounded-xl overflow-hidden bg-muted border">
            <img
              src={effectiveImage}
              alt={product.title}
              className="w-full h-full object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/placeholder.svg";
              }}
            />
            {product.images.length > 1 && (
              <>
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full opacity-80 hover:opacity-100"
                  onClick={() =>
                    setSelectedImage((p) => (p - 1 + product.images.length) % product.images.length)
                  }
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full opacity-80 hover:opacity-100"
                  onClick={() =>
                    setSelectedImage((p) => (p + 1) % product.images.length)
                  }
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>

          {/* Thumbnails */}
          {product.images.length > 1 && (
            <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
              {product.images.slice(0, 8).map((img, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedImage(i)}
                  className={`w-16 h-16 rounded-lg border-2 overflow-hidden shrink-0 transition-colors ${
                    selectedImage === i ? "border-primary" : "border-transparent"
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="space-y-4">
          <h1 className="text-xl md:text-2xl font-bold leading-tight">
            {product.title}
          </h1>
          {product.externalTitle && product.externalTitle !== product.title && (
            <p className="text-sm text-muted-foreground">{product.externalTitle}</p>
          )}

          {/* Price */}
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold text-primary">
              {product.currency}{effectivePrice.toFixed(2)}
            </span>
            {product.originalPrice && product.originalPrice > effectivePrice && (
              <span className="text-lg text-muted-foreground line-through">
                {product.currency}{product.originalPrice.toFixed(2)}
              </span>
            )}
          </div>

          {/* Stock */}
          <div>
            {effectiveQuantity !== undefined && effectiveQuantity > 0 ? (
              <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                Нөөцөд байна ({effectiveQuantity})
              </Badge>
            ) : effectiveQuantity === 0 ? (
              <Badge variant="destructive">Дууссан</Badge>
            ) : null}
          </div>

          {/* Vendor */}
          {product.vendor && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Store className="h-4 w-4" />
              <span>{product.vendor.name}</span>
              {product.vendor.score && (
                <span className="flex items-center gap-1">
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  {product.vendor.score}
                </span>
              )}
            </div>
          )}

          {/* Configurators (variants) */}
          {product.configurators.map((config) => (
            <div key={config.pid} className="space-y-2">
              <h3 className="text-sm font-semibold">{config.propertyName}</h3>
              <div className="flex flex-wrap gap-2">
                {config.values.map((val) => {
                  const isSelected = selectedConfigs[config.pid] === val.id;
                  return (
                    <button
                      key={val.id}
                      onClick={() =>
                        setSelectedConfigs((prev) => ({
                          ...prev,
                          [config.pid]: isSelected ? "" : val.id,
                        }))
                      }
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                        isSelected
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      {val.imageUrl && (
                        <img
                          src={val.imageUrl}
                          alt={val.value}
                          className="w-6 h-6 rounded object-cover"
                        />
                      )}
                      <span className="line-clamp-1">{val.value}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Quantity + Add to Cart */}
          <div className="flex items-center gap-4 pt-2">
            <div className="flex items-center border rounded-lg">
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-12 text-center font-medium">{quantity}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10"
                onClick={() => setQuantity((q) => q + 1)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <Button
              size="lg"
              className="flex-1 gap-2"
              disabled={effectiveQuantity === 0 || isCartLoading}
              onClick={handleAddToCart}
            >
              <ShoppingCart className="h-5 w-5" />
              {isCartLoading ? "Нэмж байна..." : "Сагсанд нэмэх"}
            </Button>
          </div>

          {/* Features */}
          {product.features.length > 0 && (
            <div className="border rounded-lg p-4 space-y-2 mt-4">
              <h3 className="font-semibold text-sm">Үзүүлэлтүүд</h3>
              {product.features.map((f, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{f.name}</span>
                  <span className="font-medium">{f.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabs: Description */}
      {description && (
        <Tabs defaultValue="description" className="mt-8">
          <TabsList>
            <TabsTrigger value="description">Тайлбар</TabsTrigger>
          </TabsList>
          <TabsContent value="description">
            <div
              className="prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: description }}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
