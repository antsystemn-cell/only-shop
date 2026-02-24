import { Folder } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Category = Tables<"categories">;

interface ShopCategoryStripProps {
  categories: Category[];
  activeCategoryId: string | null;
  onSelect: (id: string | null) => void;
}

export function ShopCategoryStrip({ categories, activeCategoryId, onSelect }: ShopCategoryStripProps) {
  if (!categories || categories.length === 0) return null;

  return (
    <div className="bg-secondary/50 border-b">
      <div className="md:container">
        <div className="flex items-center gap-3 md:gap-5 overflow-x-auto scrollbar-hide px-3 md:px-0 py-4">
          {/* "Бүгд" (All) button */}
          <button
            onClick={() => onSelect(null)}
            className={`group flex flex-col items-center gap-2 min-w-[72px] md:min-w-[100px] shrink-0 transition-all ${
              !activeCategoryId ? "opacity-100" : "opacity-60 hover:opacity-90"
            }`}
          >
            <div className={`w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center transition-all ${
              !activeCategoryId
                ? "bg-primary/15 ring-2 ring-primary"
                : "bg-muted group-hover:bg-primary/10"
            }`}>
              <Folder className={`h-7 w-7 md:h-8 md:w-8 ${
                !activeCategoryId ? "text-primary" : "text-muted-foreground"
              }`} />
            </div>
            <span className={`text-xs md:text-sm font-medium text-center ${
              !activeCategoryId ? "text-primary" : "text-foreground"
            }`}>
              Бүгд
            </span>
          </button>

          {categories.map((category) => {
            const isActive = activeCategoryId === category.id;
            return (
              <button
                key={category.id}
                onClick={() => onSelect(isActive ? null : category.id)}
                className={`group flex flex-col items-center gap-2 min-w-[72px] md:min-w-[100px] shrink-0 transition-all ${
                  isActive ? "opacity-100" : "opacity-60 hover:opacity-90"
                }`}
              >
                <div className={`w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center overflow-hidden transition-all ${
                  isActive
                    ? "ring-2 ring-primary bg-primary/15"
                    : "bg-muted group-hover:bg-primary/10"
                }`}>
                  {category.image_url ? (
                    <img
                      src={category.image_url}
                      alt={category.name_mn}
                      className="w-12 h-12 md:w-14 md:h-14 object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <Folder className={`h-7 w-7 md:h-8 md:w-8 ${
                      isActive ? "text-primary" : "text-muted-foreground"
                    }`} />
                  )}
                </div>
                <span className={`text-xs md:text-sm font-medium text-center line-clamp-2 max-w-[72px] md:max-w-[100px] ${
                  isActive ? "text-primary" : "text-foreground"
                }`}>
                  {category.name_mn}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
