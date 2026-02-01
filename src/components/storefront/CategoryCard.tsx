import { Link } from "react-router-dom";
import { Folder } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Category = Tables<"categories">;

interface CategoryCardProps {
  category: Category;
}

export function CategoryCard({ category }: CategoryCardProps) {
  return (
    <Link
      to={`/shop?category=${category.id}`}
      className="group block"
    >
      <div className="flex flex-col items-center gap-3 md:gap-4">
        {/* Image Container - larger, transparent background */}
        <div className="relative aspect-square w-full max-w-[180px] md:max-w-[220px] mx-auto flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
          {category.image_url ? (
            <img
              src={category.image_url}
              alt={category.name_mn}
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Folder className="h-20 w-20 md:h-24 md:w-24 text-muted-foreground opacity-50" />
            </div>
          )}
        </div>
        
        {/* Label */}
        <h3 className="text-base md:text-lg font-medium text-foreground text-center group-hover:text-primary transition-colors">
          {category.name_mn}
        </h3>
      </div>
    </Link>
  );
}
