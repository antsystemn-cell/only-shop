import { Link } from "react-router-dom";
import type { OtProductCard } from "@/types/otApi";
import { Shield } from "lucide-react";

interface OtProductCardComponentProps {
  product: OtProductCard;
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

function getProviderLabel(providerType?: string) {
  const p = providerType?.toLowerCase();
  if (p === "taobao") return "Taobao";
  if (p === "tmall") return "Tmall";
  return providerType;
}

export function OtProductCardComponent({ product }: OtProductCardComponentProps) {
  const hasDiscount = product.originalPrice && product.originalPrice > product.price;
  const discountPercent = hasDiscount
    ? Math.round(((product.originalPrice! - product.price) / product.originalPrice!) * 100)
    : 0;

  const poizon = isPoizon(product.providerType);
  const taobao = isTaobaoOrTmall(product.providerType);

  return (
    <Link
      to={`/ot/product/${product.id}`}
      className="group block overflow-hidden rounded-lg shadow-sm hover:shadow-md transition-all duration-300"
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-white">
        <img
          src={product.imageUrl}
          alt={product.title}
          className="w-full h-full object-contain p-1 group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
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
      </div>

      {/* Info */}
      <div className="p-1.5 md:p-3">
        <h3 className="text-[11px] md:text-sm font-medium line-clamp-2 min-h-[2rem] md:min-h-[2.5rem] text-foreground group-hover:text-primary transition-colors">
          {product.title}
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
}
