import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Folder, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type ProviderTab = "Poizon" | "Taobao";

interface OtCat {
  id: string;
  internal_id: string;
  name_mn: string | null;
  name_en: string | null;
  icon_url: string | null;
  provider_type: string | null;
  parent_internal_id: string | null;
}

export default function MobileCategories() {
  const [activeTab, setActiveTab] = useState<ProviderTab>("Poizon");
  const [search, setSearch] = useState("");

  // Poizon: show subcategories of otc-1465 directly; Taobao: show root categories
  const POIZON_ROOT_ID = "otc-1465";

  const { data: categories, isLoading } = useQuery({
    queryKey: ["mobile-categories", activeTab],
    queryFn: async () => {
      let query = supabase
        .from("ot_categories")
        .select("id, internal_id, name_mn, name_en, icon_url, provider_type, parent_internal_id")
        .eq("is_active", true)
        .order("display_order");

      if (activeTab === "Poizon") {
        query = query.eq("parent_internal_id", POIZON_ROOT_ID);
      } else {
        query = query.eq("provider_type", activeTab).is("parent_internal_id", null);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as OtCat[];
    },
    staleTime: 1000 * 60 * 30,
  });

  const filtered = categories?.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.name_mn?.toLowerCase().includes(q) ||
      c.name_en?.toLowerCase().includes(q)
    );
  });

  const tabs: { key: ProviderTab; label: string }[] = [
    { key: "Poizon", label: "Poizon (Dewu)" },
    { key: "Taobao", label: "Taobao" },
  ];

  return (
    <div className="pb-6 animate-fade-in">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="px-4 pt-4 pb-3">
          <h1 className="text-xl font-bold mb-3">Ангилал</h1>
          {/* Provider tabs */}
          <div className="flex gap-2 mb-3">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveTab(tab.key);
                  setSearch("");
                }}
                className={cn(
                  "flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all",
                  activeTab === tab.key
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ангилал хайх..."
              className="pl-9 h-10 rounded-xl bg-muted border-0"
            />
          </div>
        </div>
      </div>

      {/* Category list */}
      <div className="px-3 pt-3">
        {isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : filtered && filtered.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {filtered.map((cat) => (
              <Link
                key={cat.internal_id}
                to={`/ot/browse/${cat.internal_id}`}
                className="group flex items-center gap-3 px-3 py-3 rounded-xl bg-muted/50 hover:bg-muted active:scale-[0.98] transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-background flex items-center justify-center shrink-0">
                  {cat.icon_url ? (
                    <img
                      src={cat.icon_url}
                      alt={cat.name_mn || cat.name_en || ""}
                      className="w-7 h-7 object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <Folder className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <span className="text-sm font-medium text-foreground truncate">
                  {cat.name_mn || cat.name_en || cat.internal_id}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <Folder className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              {search ? "Хайлтад тохирох ангилал олдсонгүй" : "Ангилал олдсонгүй"}
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
