import { Link } from "react-router-dom";
import { Folder } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProviderSafe } from "@/contexts/ProviderContext";
import { getCategoryPath } from "@/utils/categoryUrl";

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

  return (
    <div className="py-3 md:py-4 bg-primary/95">
      <div className="md:container">
        <div className="flex items-center gap-2 md:gap-4 overflow-x-auto scrollbar-hide px-3 md:px-0">
          {categories.map((cat) => (
            <Link
              key={cat.internal_id}
              to={`/ot/browse/${cat.internal_id}`}
              className="group flex flex-col items-center gap-2 md:gap-3 min-w-[70px] md:min-w-[110px] shrink-0"
            >
              <div className="w-14 h-14 md:w-20 md:h-20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                {cat.icon_url ? (
                  <img
                    src={cat.icon_url}
                    alt={cat.name_mn || cat.name_en || ""}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <Folder className="h-6 w-6 md:h-8 md:w-8 text-white/70" />
                )}
              </div>
              <span className="text-[10px] md:text-sm text-white/80 text-center font-medium uppercase tracking-wide max-w-[70px] md:max-w-[110px] truncate group-hover:text-white transition-colors">
                {cat.name_mn || cat.name_en || cat.internal_id}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
