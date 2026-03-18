import { useState } from "react";
import { ChevronDown, Folder, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Tables } from "@/integrations/supabase/types";

type Category = Tables<"categories">;

interface ShopCategoryStripProps {
  categories: Category[];
  activeCategoryId: string | null;
  onSelect: (id: string | null) => void;
}

export function ShopCategoryStrip({ categories, activeCategoryId, onSelect }: ShopCategoryStripProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  if (!categories || categories.length === 0) return null;

  const activeCategory = categories.find((c) => c.id === activeCategoryId);
  const filtered = search
    ? categories.filter((c) => c.name_mn.toLowerCase().includes(search.toLowerCase()))
    : categories;

  const handleSelect = (id: string | null) => {
    onSelect(id);
    setOpen(false);
    setSearch("");
  };

  return (
    <div className="bg-secondary/50 border-b">
      <div className="md:container">
        <div className="flex items-center gap-2 px-3 md:px-0 py-3">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="gap-2 h-9 text-sm font-medium"
              >
                {activeCategory ? (
                  <div className="flex items-center gap-2">
                    {activeCategory.image_url && (
                      <img src={activeCategory.image_url} alt="" className="w-5 h-5 object-contain" />
                    )}
                    {activeCategory.name_mn}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Folder className="h-4 w-4" />
                    Бүх ангилал
                  </div>
                )}
                <ChevronDown className="h-3.5 w-3.5 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0" align="start">
              {categories.length > 5 && (
                <div className="p-2 border-b">
                  <Input
                    placeholder="Ангилал хайх..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              )}
              <ScrollArea className={filtered.length > 8 ? "h-64" : undefined}>
                <div className="p-1">
                  <button
                    onClick={() => handleSelect(null)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                      !activeCategoryId ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
                    }`}
                  >
                    <Folder className="h-4 w-4" />
                    Бүгд
                  </button>
                  {filtered.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => handleSelect(cat.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                        activeCategoryId === cat.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
                      }`}
                    >
                      {cat.image_url ? (
                        <img src={cat.image_url} alt="" className="w-5 h-5 object-contain" loading="lazy" />
                      ) : (
                        <Folder className="h-4 w-4 text-muted-foreground" />
                      )}
                      {cat.name_mn}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>

          {activeCategoryId && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 text-muted-foreground"
              onClick={() => onSelect(null)}
            >
              Цэвэрлэх <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
