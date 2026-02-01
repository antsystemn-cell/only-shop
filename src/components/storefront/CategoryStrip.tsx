import { Link } from "react-router-dom";
import { Folder } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
type Category = Tables<"categories">;
interface CategoryStripProps {
  categories: Category[];
}
export function CategoryStrip({
  categories
}: CategoryStripProps) {
  return <div className="py-3 md:py-4 bg-secondary">
      {/* Full-width on mobile, container on desktop */}
      <div className="md:container bg-secondary">
        <div className="flex items-center gap-2 md:gap-4 overflow-x-auto scrollbar-hide px-3 md:px-0">
          {categories.map(category => <Link key={category.id} to={`/shop?category=${category.id}`} className="group flex flex-col items-center gap-2 md:gap-3 min-w-[70px] md:min-w-[110px] shrink-0">
              {/* Icon/Image Container - larger, transparent */}
              <div className="w-14 h-14 md:w-20 md:h-20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                {category.image_url ? <img src={category.image_url} alt={category.name_mn} className="w-full h-full object-contain" /> : <Folder className="h-6 w-6 md:h-8 md:w-8 text-white/70" />}
              </div>
              {/* Label - slightly larger */}
              <span className="text-[10px] md:text-sm text-white/80 text-center font-medium uppercase tracking-wide max-w-[70px] md:max-w-[110px] truncate group-hover:text-white transition-colors">
                {category.name_mn}
              </span>
            </Link>)}
        </div>
      </div>
    </div>;
}