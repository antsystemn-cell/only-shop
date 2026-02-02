import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface Brand {
  name: string;
  logo_url?: string | null;
}

interface BrandCarouselProps {
  brands: Brand[];
}

export function BrandCarousel({ brands }: BrandCarouselProps) {
  if (!brands || brands.length === 0) return null;

  return (
    <ScrollArea className="w-full whitespace-nowrap">
      <div className="flex gap-4 py-2 px-1">
        {brands.map((brand) => (
          <Link
            key={brand.name}
            to={`/shop?brand=${encodeURIComponent(brand.name)}`}
            className="flex flex-col items-center gap-2 min-w-[72px] group"
          >
            <Avatar className="h-14 w-14 md:h-16 md:w-16 border-2 border-border bg-background shadow-sm transition-all group-hover:border-primary group-hover:shadow-md group-hover:scale-105">
              {brand.logo_url ? (
                <AvatarImage 
                  src={brand.logo_url} 
                  alt={brand.name}
                  className="object-contain p-1"
                />
              ) : null}
              <AvatarFallback className="bg-muted text-foreground font-bold text-lg">
                {brand.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors text-center truncate max-w-[72px]">
              {brand.name}
            </span>
          </Link>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
