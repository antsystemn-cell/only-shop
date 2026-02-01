import { Link } from "react-router-dom";
import { Folder } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Category = Tables<"categories">;

interface CategoryStripProps {
  categories: Category[];
}

export function CategoryStrip({ categories }: CategoryStripProps) {
  return (
    <div className="bg-[#1a1a1a] py-4">
      <div className="container">
        <div className="flex items-center justify-start gap-4 overflow-x-auto scrollbar-hide pb-2">
          {categories.map((category) => (
            <Link
              key={category.id}
              to={`/shop?category=${category.id}`}
              className="group flex flex-col items-center gap-2 min-w-[80px] md:min-w-[100px] px-2"
            >
              {/* Icon/Image Container */}
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-lg overflow-hidden bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                {category.image_url ? (
                  <img
                    src={category.image_url}
                    alt={category.name_mn}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                ) : (
                  <Folder className="h-8 w-8 text-white/70" />
                )}
              </div>
              {/* Label */}
              <span className="text-[10px] md:text-xs text-white/80 text-center font-medium uppercase tracking-wide whitespace-nowrap group-hover:text-white transition-colors">
                {category.name_mn}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
