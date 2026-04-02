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
      <div className="bg-card rounded-xl p-2 flex flex-col items-center gap-1.5 hover:shadow-md transition-shadow duration-200">
        <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl bg-accent flex items-center justify-center overflow-hidden">
          {category.image_url ? (
            <img
              src={category.image_url}
              alt={category.name_mn}
              className="w-10 h-10 md:w-14 md:h-14 object-contain group-hover:scale-110 transition-transform duration-300"
            />
          ) : (
            <Folder className="h-6 w-6 md:h-8 md:w-8 text-primary" />
          )}
        </div>
        <span className="text-[10px] md:text-xs font-medium text-foreground text-center leading-tight line-clamp-2">
          {category.name_mn}
        </span>
      </div>
    </Link>
  );
}
