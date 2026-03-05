import { useState } from "react";
import { Link } from "react-router-dom";
import { Folder, Search } from "lucide-react";
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

  const { data: categories, isLoading } = useQuery({
    queryKey: ["mobile-categories", activeTab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ot_categories")
        .select("id, internal_id, name_mn, name_en, icon_url, provider_type, parent_internal_id")
        .eq("provider_type", activeTab)
        .is("parent_internal_id", null)
        .eq("is_active", true)
        .order("display_order");
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

      {/* Category grid */}
      <div className="px-3 pt-4">
        {isLoading ? (
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2 animate-pulse">
                <div className="w-16 h-16 rounded-2xl bg-muted" />
                <div className="w-12 h-3 rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : filtered && filtered.length > 0 ? (
          <div className="grid grid-cols-4 gap-y-5 gap-x-2">
            {filtered.map((cat) => (
              <Link
                key={cat.internal_id}
                to={`/ot/browse/${cat.internal_id}`}
                className="group flex flex-col items-center gap-2"
              >
                <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center group-active:scale-95 transition-transform">
                  {cat.icon_url ? (
                    <img
                      src={cat.icon_url}
                      alt={cat.name_mn || cat.name_en || ""}
                      className="w-10 h-10 object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <Folder className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <span className="text-[11px] font-medium text-center text-foreground leading-tight line-clamp-2 max-w-[72px]">
                  {cat.name_mn || cat.name_en || cat.internal_id}
                </span>
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
