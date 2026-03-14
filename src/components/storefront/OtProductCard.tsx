import { memo, useCallback } from "react";
import { Link } from "react-router-dom";
import type { OtProductCard } from "@/types/otApi";
import { Heart, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getGridImageUrl } from "@/utils/imageOptimizer";
import { prefetchProductDetail } from "@/services/otApi";
import { useWishlist } from "@/contexts/WishlistContext";

interface OtProductCardComponentProps {
  product: OtProductCard;
  translatedTitle?: string;
}

function formatMntPrice(price: number, currency: string) {
  if (currency === "₮" || currency === "MNT") {
    return new Intl.NumberFormat("mn-MN").format(Math.round(price)) + "₮";
  }
  return `${currency}${price.toFixed(2)}`;
}

function isPoizon(providerType?: string) {
  return providerType?.toLowerCase() === "poizon" || providerType?.toLowerCase() === "dewu";
}

function isTaobaoOrTmall(providerType?: string) {
  const p = providerType?.toLowerCase();
  return p === "taobao" || p === "tmall";
}

function isWarehouse(providerType?: string) {
  return providerType?.toLowerCase() === "warehouse";
}

function isAmazon(providerType?: string) {
  return providerType?.toLowerCase() === "amazon";
}

function getProviderLabel(providerType?: string) {
  const p = providerType?.toLowerCase();
  if (p === "taobao") return "Taobao";
  if (p === "tmall") return "Tmall";
  if (p === "warehouse") return "Агуулах";
  return providerType;
}

export const OtProductCardComponent = memo(function OtProductCardComponent({ product, translatedTitle }: OtProductCardComponentProps) {
  const { isInWishlist, toggleWishlist, isLoading } = useWishlist();
  const displayTitle = translatedTitle || product.title;
  const hasDiscount = product.originalPrice && product.originalPrice > product.price;
  const discountPercent = hasDiscount
    ? Math.round(((product.originalPrice! - product.price) / product.originalPrice!) * 100)
    : 0;

  const poizon = isPoizon(product.providerType);
  const taobao = isTaobaoOrTmall(product.providerType);
  const warehouse = isWarehouse(product.providerType);
  const amazon = isAmazon(product.providerType);
  const inWishlist = isInWishlist(product.id);
  
  // Prefetch product detail on hover/touch for instant navigation
  const handlePrefetch = useCallback(() => {
    prefetchProductDetail(product.id);
  }, [product.id]);

  const handleToggleWishlist = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    void toggleWishlist(product.id);
  }, [product.id, toggleWishlist]);

  // Use optimized thumbnail URL for grid
  const gridImageUrl = getGridImageUrl(product.imageUrl);

  return (
    <Link
      to={`/ot/product/${product.id}`}
      className="group block overflow-hidden rounded-lg shadow-sm hover:shadow-md transition-all duration-300"
      onMouseEnter={handlePrefetch}
      onTouchStart={handlePrefetch}
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-white">
        <Button
          variant="secondary"
          size="icon"
          className="absolute top-2 right-2 z-10 h-7 w-7 rounded-full"
          onClick={handleToggleWishlist}
          disabled={isLoading}
          aria-label={inWishlist ? "Хүслийн жагсаалтаас хасах" : "Хүслийн жагсаалтад нэмэх"}
        >
          <Heart className={`h-4 w-4 ${inWishlist ? "fill-destructive text-destructive" : "text-muted-foreground"}`} />
        </Button>

        <img
          src={gridImageUrl}
          alt={product.title}
          className="w-full h-full object-contain p-1 group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
          decoding="async"
          width={310}
          height={310}
          onError={(e) => {
            (e.target as HTMLImageElement).src = "/placeholder.svg";
          }}
        />
        {hasDiscount && discountPercent > 0 && (
          <span className="absolute top-2 left-2 bg-destructive text-destructive-foreground text-xs font-bold px-2 py-1 rounded-md">
            -{discountPercent}%
          </span>
        )}
        {/* Provider badges on image */}
        {poizon && (
          <span className="absolute bottom-1.5 left-1.5 flex items-center gap-0.5 bg-emerald-600 text-white text-[9px] md:text-[10px] font-bold px-1.5 py-0.5 rounded">
            <Shield className="h-2.5 w-2.5" />
            100% Оригинал
          </span>
        )}
        {taobao && (
          <span className="absolute bottom-1.5 left-1.5 bg-orange-500 text-white text-[9px] md:text-[10px] font-medium px-1.5 py-0.5 rounded">
            {getProviderLabel(product.providerType)}
          </span>
        )}
        {warehouse && (
          <span className="absolute bottom-1.5 left-1.5 bg-primary text-primary-foreground text-[9px] md:text-[10px] font-medium px-1.5 py-0.5 rounded">
            Агуулах
          </span>
        )}
        {amazon && (
          <span className="absolute bottom-1.5 left-1.5 flex items-center gap-0.5 text-white text-[9px] md:text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'linear-gradient(135deg, #002868, #BF0A30)' }}>
            <svg viewBox="0 0 16 12" className="h-2.5 w-3.5 shrink-0" fill="none">
              <rect width="16" height="12" rx="1" fill="#002868"/>
              <rect y="0" width="16" height="1.5" fill="#BF0A30"/>
              <rect y="3" width="16" height="1.5" fill="#fff"/>
              <rect y="4.5" width="16" height="1.5" fill="#BF0A30"/>
              <rect y="7.5" width="16" height="1.5" fill="#fff"/>
              <rect y="9" width="16" height="1.5" fill="#BF0A30"/>
              <rect y="10.5" width="16" height="1.5" fill="#fff"/>
              <rect width="7" height="6" fill="#002868"/>
            </svg>
            Америкаас
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-1.5 md:p-3">
        <h3 className="text-[11px] md:text-sm font-medium line-clamp-2 min-h-[2rem] md:min-h-[2.5rem] text-foreground group-hover:text-primary transition-colors">
          {displayTitle}
        </h3>

        <div className="mt-1 md:mt-2 flex items-baseline gap-1 md:gap-2">
          <span className="text-xs md:text-base font-bold text-primary">
            {formatMntPrice(product.price, product.currency)}
          </span>
          {hasDiscount && (
            <span className="text-[9px] md:text-xs text-muted-foreground line-through hidden md:inline">
              {formatMntPrice(product.originalPrice!, product.currency)}
            </span>
          )}
        </div>

        {product.vendorName && (
          <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5 md:mt-1 truncate hidden md:block">
            {product.vendorName}
          </p>
        )}
      </div>
    </Link>
  );
});
