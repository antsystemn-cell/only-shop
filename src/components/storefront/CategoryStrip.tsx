import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronDown, Folder } from "lucide-react";
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

interface CategoryStripProps {
  categories: Category[];
}

export function CategoryStrip({ categories }: CategoryStripProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [searchParams] = useSearchParams();
  const activeCategoryId = searchParams.get("category");

  if (!categories || categories.length === 0) return null;

  const activeCategory = categories.find((c) => c.id === activeCategoryId);
  const filtered = search
    ? categories.filter((c) => c.name_mn.toLowerCase().includes(search.toLowerCase()))
    : categories;

  return (
    <div className="py-3 md:py-4 bg-secondary">
      <div className="md:container bg-secondary">
        <div className="flex items-center gap-2 px-3 md:px-0">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2 h-9 text-sm font-medium bg-background/80">
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
                  <Link
                    to="/shop"
                    onClick={() => { setOpen(false); setSearch(""); }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                      !activeCategoryId ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
                    }`}
                  >
                    <Folder className="h-4 w-4" />
                    Бүгд
                  </Link>
                  {filtered.map((cat) => (
                    <Link
                      key={cat.id}
                      to={`/shop?category=${cat.id}`}
                      onClick={() => { setOpen(false); setSearch(""); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                        activeCategoryId === cat.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
                      }`}
                    >
                      {cat.image_url ? (
                        <img src={cat.image_url} alt="" className="w-5 h-5 object-contain" />
                      ) : (
                        <Folder className="h-4 w-4 text-muted-foreground" />
                      )}
                      {cat.name_mn}
                    </Link>
                  ))}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}
