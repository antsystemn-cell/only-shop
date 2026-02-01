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
      <div className="flex flex-col items-center gap-2 md:gap-3">
        {/* Image Container - transparent background */}
        <div className="relative aspect-square w-full flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
          {category.image_url ? (
            <img
              src={category.image_url}
              alt={category.name_mn}
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Folder className="h-16 w-16 md:h-20 md:w-20 text-muted-foreground opacity-50" />
            </div>
          )}
        </div>
        
        {/* Label */}
        <h3 className="text-sm md:text-base font-medium text-foreground text-center group-hover:text-primary transition-colors">
          {category.name_mn}
        </h3>
      </div>
    </Link>
  );
}
