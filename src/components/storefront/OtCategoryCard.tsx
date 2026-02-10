import { Link } from "react-router-dom";
import { Folder } from "lucide-react";
import type { OtCategoryCard } from "@/types/otApi";

interface OtCategoryCardComponentProps {
  category: OtCategoryCard;
  basePath?: string;
}

export function OtCategoryCardComponent({ category, basePath = "/ot/category" }: OtCategoryCardComponentProps) {
  return (
    <Link
      to={`${basePath}/${category.id}`}
      className="group block"
    >
      <div className="flex flex-col items-center gap-3">
        <div className="relative w-20 h-20 md:w-24 md:h-24 flex items-center justify-center rounded-2xl bg-muted group-hover:bg-primary/10 transition-colors">
          {category.iconUrl ? (
            <img
              src={category.iconUrl}
              alt={category.name}
              className="w-12 h-12 md:w-16 md:h-16 object-contain"
              loading="lazy"
            />
          ) : (
            <Folder className="h-8 w-8 text-muted-foreground" />
          )}
        </div>
        <h3 className="text-xs md:text-sm font-medium text-center text-foreground group-hover:text-primary transition-colors line-clamp-2 max-w-[100px]">
          {category.name}
        </h3>
      </div>
    </Link>
  );
}
