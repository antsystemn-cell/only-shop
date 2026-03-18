import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Folder } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProviderSafe } from "@/contexts/ProviderContext";
import { getCategoryPath } from "@/utils/categoryUrl";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

interface OtCat {
  id: string;
  internal_id: string;
  name_mn: string | null;
  name_en: string | null;
  icon_url: string | null;
  provider_type: string | null;
  item_ids: string[];
  seo_alias: string | null;
}

export function OtCategoryStrip() {
  const { apiProvider } = useProviderSafe();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: categories } = useQuery({
    queryKey: ["ot-root-categories-strip", apiProvider],
    queryFn: async () => {
      let query = supabase
        .from("ot_categories")
        .select("id, internal_id, name_mn, name_en, icon_url, provider_type, item_ids, seo_alias")
        .is("parent_internal_id", null)
        .eq("is_active", true)
        .order("display_order");
      if (apiProvider) {
        query = query.eq("provider_type", apiProvider);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as OtCat[];
    },
    staleTime: 1000 * 60 * 30,
  });

  if (!categories || categories.length === 0) return null;

  const filtered = search
    ? categories.filter((c) => {
        const name = c.name_mn || c.name_en || c.internal_id;
        return name.toLowerCase().includes(search.toLowerCase());
      })
    : categories;

  return (
    <div className="py-3 md:py-4 bg-primary/95">
      <div className="md:container">
        <div className="flex items-center gap-2 px-3 md:px-0">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="gap-2 h-9 text-sm font-medium bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white"
              >
                <Folder className="h-4 w-4" />
                Ангилал сонгох
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
                  {filtered.map((cat) => (
                    <Link
                      key={cat.internal_id}
                      to={getCategoryPath(cat)}
                      onClick={() => { setOpen(false); setSearch(""); }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors hover:bg-muted"
                    >
                      {cat.icon_url ? (
                        <img src={cat.icon_url} alt="" className="w-5 h-5 object-contain" />
                      ) : (
                        <Folder className="h-4 w-4 text-muted-foreground" />
                      )}
                      {cat.name_mn || cat.name_en || cat.internal_id}
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
