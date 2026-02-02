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
      <div className="flex gap-6 py-2 px-1">
        {brands.map((brand) => (
          <Link
            key={brand.name}
            to={`/shop?brand=${encodeURIComponent(brand.name)}`}
            className="flex flex-col items-center gap-3 min-w-[100px] group"
          >
            <Avatar className="h-20 w-20 md:h-24 md:w-24 border-2 border-border bg-background shadow-sm transition-all group-hover:border-primary group-hover:shadow-md group-hover:scale-105">
              {brand.logo_url ? (
                <AvatarImage 
                  src={brand.logo_url} 
                  alt={brand.name}
                  className="object-cover"
                />
              ) : null}
              <AvatarFallback className="bg-muted text-foreground font-bold text-xl">
                {brand.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors text-center truncate max-w-[100px] font-medium">
              {brand.name}
            </span>
          </Link>
        ))}
      </div>
      <ScrollBar orientation="horizontal" className="hidden" />
    </ScrollArea>
  );
}
