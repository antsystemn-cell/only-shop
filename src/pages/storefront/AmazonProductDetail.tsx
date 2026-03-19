import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Loader2, ShoppingBag, ChevronRight, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { getSeoImage } from "@/utils/seoHelpers";

export default function AmazonProductDetail() {
  const { asin } = useParams<{ asin: string }>();
  const [selectedImage, setSelectedImage] = useState(0);

  const { data: product, isLoading } = useQuery({
    queryKey: ["amazon-product-detail", asin],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("amazon_products")
        .select("*, amazon_product_store_settings(*), amazon_categories(*)")
        .eq("asin", asin!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!asin,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <ShoppingBag className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
        <h1 className="text-xl font-bold mb-2">Бараа олдсонгүй</h1>
        <Link to="/amazon">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Буцах
          </Button>
        </Link>
      </div>
    );
  }

  // Handle one-to-one relationship (may come as array or object)
  const settings = Array.isArray(product.amazon_product_store_settings)
    ? product.amazon_product_store_settings[0]
    : product.amazon_product_store_settings;

  const displayTitle = settings?.local_title_override || product.title;
  const displayDescription =
    settings?.local_description_override ||
    product.full_description ||
    product.short_description;
  const displayPrice =
    settings?.manual_price_override || product.source_price;

  // Build image gallery from main_image + image_gallery JSON array
  const galleryRaw = (product.image_gallery as any[]) || [];
  const galleryLinks = galleryRaw
    .map((i: any) => (typeof i === "string" ? i : i?.link || i?.url))
    .filter(Boolean);
  const images: string[] = product.main_image
    ? [product.main_image, ...galleryLinks]
    : galleryLinks;

  const attributes = (product.attributes || {}) as Record<string, any>;
  const dimensions = (product.dimensions || {}) as Record<string, any>;
  const category = product.amazon_categories;

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link to="/amazon" className="hover:text-foreground">
          Amazon
        </Link>
        <ChevronRight className="h-3 w-3" />
        {category && (
          <>
            <Link
              to={`/amazon?category=${category.id}`}
              className="hover:text-foreground"
            >
              {category.name}
            </Link>
            <ChevronRight className="h-3 w-3" />
          </>
        )}
        <span className="text-foreground truncate max-w-xs">
          {displayTitle}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Gallery */}
        <div className="space-y-3">
          <div className="aspect-square rounded-lg overflow-hidden bg-muted">
            {images[selectedImage] ? (
              <img
                src={images[selectedImage]}
                alt={displayTitle || ""}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ShoppingBag className="h-20 w-20 text-muted-foreground/20" />
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              {images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedImage(i)}
                  className={`w-16 h-16 rounded border-2 overflow-hidden shrink-0 ${
                    i === selectedImage ? "border-primary" : "border-transparent"
                  }`}
                >
                  <img
                    src={img}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge>Amazon</Badge>
            {product.brand && (
              <Badge variant="outline">{product.brand}</Badge>
            )}
          </div>

          <h1 className="text-2xl font-bold">{displayTitle}</h1>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">ASIN:</span>
            <Badge variant="secondary">{product.asin}</Badge>
          </div>

          {displayPrice && (
            <div className="text-3xl font-bold text-primary">
              {Number(displayPrice).toLocaleString()}
              <span className="text-lg font-normal ml-1">
                {product.source_currency || "USD"}
              </span>
            </div>
          )}

          <Separator />

          {/* Description */}
          {displayDescription && (
            <div>
              <h3 className="font-semibold mb-2">Тайлбар</h3>
              <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {displayDescription}
              </div>
            </div>
          )}

          <Separator />

          {/* Attributes */}
          {Object.keys(attributes).length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Шинж чанар</h3>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(attributes).map(([key, val]) => (
                  <div key={key} className="text-sm">
                    <span className="text-muted-foreground">{key}:</span>{" "}
                    <span className="font-medium">{String(val)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dimensions */}
          {Object.keys(dimensions).length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Хэмжээс</h3>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(dimensions).map(([key, val]) => (
                  <div key={key} className="text-sm">
                    <span className="text-muted-foreground">{key}:</span>{" "}
                    <span className="font-medium">{String(val)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
