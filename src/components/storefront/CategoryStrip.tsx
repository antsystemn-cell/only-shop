import { Link } from "react-router-dom";
import { Folder } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Category = Tables<"categories">;

interface CategoryStripProps {
  categories: Category[];
}

export function CategoryStrip({ categories }: CategoryStripProps) {
  return (
    <div className="bg-[#1a1a1a] py-3 md:py-4">
      {/* Full-width on mobile, container on desktop */}
      <div className="md:container">
        <div className="flex items-center gap-2 md:gap-4 overflow-x-auto scrollbar-hide px-3 md:px-0 pb-1">
          {categories.map((category) => (
            <Link
              key={category.id}
              to={`/shop?category=${category.id}`}
              className="group flex flex-col items-center gap-1.5 md:gap-2 min-w-[60px] md:min-w-[90px] shrink-0"
            >
              {/* Icon/Image Container - smaller on mobile */}
              <div className="w-12 h-12 md:w-16 md:h-16 rounded-full md:rounded-lg overflow-hidden bg-white/10 flex items-center justify-center group-hover:bg-white/20 group-active:bg-white/25 transition-colors ring-2 ring-transparent group-hover:ring-white/20">
                {category.image_url ? (
                  <img
                    src={category.image_url}
                    alt={category.name_mn}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                ) : (
                  <Folder className="h-5 w-5 md:h-7 md:w-7 text-white/70" />
                )}
              </div>
              {/* Label - more compact on mobile */}
              <span className="text-[9px] md:text-xs text-white/80 text-center font-medium uppercase tracking-wide max-w-[60px] md:max-w-[90px] truncate group-hover:text-white transition-colors">
                {category.name_mn}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
