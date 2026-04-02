import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Folder } from "lucide-react";
import { CategoryCard } from "@/components/storefront/CategoryCard";

export default function MobileCategories() {
  const navigate = useNavigate();

  const { data: categories, isLoading } = useQuery({
    queryKey: ["all-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 10,
  });

  return (
    <div className="pb-6 animate-fade-in">
      <div className="px-4 pt-4 pb-3">
        <h1 className="text-xl font-bold mb-4">Ангилал</h1>
      </div>

      <div className="px-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : categories && categories.length > 0 ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {categories.map((category) => (
              <CategoryCard key={category.id} category={category} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <Folder className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">Ангилал байхгүй</p>
          </div>
        )}
      </div>
    </div>
  );
}
