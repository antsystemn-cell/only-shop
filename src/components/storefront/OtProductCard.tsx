import { Link } from "react-router-dom";
import type { OtProductCard } from "@/types/otApi";

interface OtProductCardComponentProps {
  product: OtProductCard;
}

function formatMntPrice(price: number, currency: string) {
  if (currency === "₮" || currency === "MNT") {
    return new Intl.NumberFormat("mn-MN").format(Math.round(price)) + "₮";
  }
  return `${currency}${price.toFixed(2)}`;
}

export function OtProductCardComponent({ product }: OtProductCardComponentProps) {
  const hasDiscount = product.originalPrice && product.originalPrice > product.price;
  const discountPercent = hasDiscount
    ? Math.round(((product.originalPrice! - product.price) / product.originalPrice!) * 100)
    : 0;

  return (
    <Link
      to={`/ot/product/${product.id}`}
      className="group block rounded-xl border bg-card overflow-hidden hover:shadow-lg transition-all duration-300"
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-muted">
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
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="text-sm font-medium line-clamp-2 min-h-[2.5rem] text-foreground group-hover:text-primary transition-colors">
          {product.title}
        </h3>

        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-base font-bold text-primary">
            {formatMntPrice(product.price, product.currency)}
          </span>
          {hasDiscount && (
            <span className="text-xs text-muted-foreground line-through">
              {formatMntPrice(product.originalPrice!, product.currency)}
            </span>
          )}
        </div>

        {product.vendorName && (
          <p className="text-xs text-muted-foreground mt-1 truncate">
            {product.vendorName}
          </p>
        )}
      </div>
    </Link>
  );
}
