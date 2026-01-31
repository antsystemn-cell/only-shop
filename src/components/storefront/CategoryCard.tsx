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
      <div className="relative aspect-square rounded-xl overflow-hidden bg-secondary hover:shadow-xl transition-all duration-300">
        {category.image_url ? (
          <img
            src={category.image_url}
            alt={category.name_mn}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-secondary to-secondary/80">
            <Folder className="h-16 w-16 text-primary opacity-50" />
          </div>
        )}
        
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        
        {/* Content */}
        <div className="absolute inset-x-0 bottom-0 p-4">
          <h3 className="text-lg font-semibold text-white group-hover:text-primary transition-colors">
            {category.name_mn}
          </h3>
          {category.description && (
            <p className="text-sm text-white/70 line-clamp-1 mt-1">
              {category.description}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
