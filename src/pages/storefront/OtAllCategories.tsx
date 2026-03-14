import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ChevronRight, ChevronDown, Folder, FolderOpen, Loader2, Grid3X3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProviderSafe } from "@/contexts/ProviderContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getCategoryPath } from "@/utils/categoryUrl";

interface OtCat {
  id: string;
  internal_id: string;
  external_id: string | null;
  name_mn: string | null;
  name_en: string | null;
  icon_url: string | null;
  provider_type: string | null;
  parent_internal_id: string | null;
  depth: number | null;
  seo_alias: string | null;
}

// ─── Recursive Category Node ────────────────────────────────
function CategoryNode({
  cat,
  childrenMap,
  level = 0,
  defaultExpanded = false,
  searchTerm = "",
}: {
  cat: OtCat;
  childrenMap: Map<string, OtCat[]>;
  level?: number;
  defaultExpanded?: boolean;
  searchTerm?: string;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const children = childrenMap.get(cat.internal_id) || [];
  const hasChildren = children.length > 0;
  const name = cat.name_mn || cat.name_en || cat.internal_id;

  // Auto-expand if search matches a child
  const shouldShow = !searchTerm || name.toLowerCase().includes(searchTerm.toLowerCase());
  const childMatches = searchTerm
    ? children.some((c) => {
        const cName = c.name_mn || c.name_en || c.internal_id;
        return cName.toLowerCase().includes(searchTerm.toLowerCase());
      })
    : false;

  if (searchTerm && !shouldShow && !childMatches) return null;

  const isExpanded = expanded || (searchTerm ? childMatches : false);

  return (
    <div>
      <div
        className={`flex items-center gap-2 group rounded-lg transition-colors ${
          level === 0 ? "py-2.5 px-3" : "py-1.5 px-3"
        } hover:bg-muted/50`}
        style={{ paddingLeft: `${level * 20 + 12}px` }}
      >
        {/* Expand toggle */}
        {hasChildren ? (
          <button
            onClick={() => setExpanded(!isExpanded)}
            className="p-0.5 hover:bg-muted rounded shrink-0"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        ) : (
          <span className="w-5" />
        )}

        {/* Icon */}
        {cat.icon_url ? (
          <img src={cat.icon_url} alt="" className="w-6 h-6 object-contain shrink-0" />
        ) : isExpanded && hasChildren ? (
          <FolderOpen className="h-5 w-5 text-primary shrink-0" />
        ) : (
          <Folder className="h-5 w-5 text-muted-foreground shrink-0" />
        )}

        {/* Name as link */}
        <Link
          to={getCategoryPath(cat)}
          className={`flex-1 text-sm group-hover:text-primary transition-colors truncate ${
            level === 0 ? "font-semibold" : "font-medium text-muted-foreground"
          }`}
        >
          {name}
        </Link>

        {/* Provider badge */}
        {level === 0 && cat.provider_type && (
          <Badge
            variant="outline"
            className={`text-[10px] shrink-0 ${
              cat.provider_type === "Poizon"
                ? "border-emerald-500/30 text-emerald-600"
                : cat.provider_type === "Amazon"
                ? "border-blue-500/30 text-blue-600"
                : "border-orange-500/30 text-orange-600"
            }`}
          >
            {cat.provider_type}
          </Badge>
        )}

        {/* Children count */}
        {hasChildren && (
          <span className="text-[10px] text-muted-foreground shrink-0">
            {children.length}
          </span>
        )}
      </div>

      {/* Children */}
      {isExpanded && hasChildren && (
        <div className={level === 0 ? "border-l ml-6 border-border/50" : ""}>
          {children.map((child) => (
            <CategoryNode
              key={child.internal_id}
              cat={child}
              childrenMap={childrenMap}
              level={level + 1}
              searchTerm={searchTerm}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Grid View for Root Categories ──────────────────────────
function CategoryGrid({ categories, childrenMap }: { categories: OtCat[]; childrenMap: Map<string, OtCat[]> }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
      {categories.map((cat) => {
        const children = childrenMap.get(cat.internal_id) || [];
        const name = cat.name_mn || cat.name_en || cat.internal_id;

        return (
          <Link
            key={cat.internal_id}
            to={getCategoryPath(cat)}
            className="group border rounded-xl p-4 hover:border-primary/30 hover:shadow-sm transition-all bg-card"
          >
            <div className="flex items-start gap-3 mb-3">
              {cat.icon_url ? (
                <img src={cat.icon_url} alt="" className="w-10 h-10 object-contain shrink-0" />
              ) : (
                <Folder className="h-8 w-8 text-muted-foreground shrink-0" />
              )}
              <div className="min-w-0">
                <h3 className="font-semibold text-sm group-hover:text-primary transition-colors line-clamp-2">
                  {name}
                </h3>
                {cat.provider_type && (
                  <span className={`text-[10px] ${cat.provider_type === "Poizon" ? "text-emerald-600" : cat.provider_type === "Amazon" ? "text-blue-600" : "text-orange-600"}`}>
                    {cat.provider_type}
                  </span>
                )}
              </div>
            </div>
            {children.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {children.slice(0, 4).map((c) => (
                  <span key={c.internal_id} className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground truncate max-w-[120px]">
                    {c.name_mn || c.name_en || c.internal_id}
                  </span>
                ))}
                {children.length > 4 && (
                  <span className="text-[10px] text-muted-foreground">+{children.length - 4}</span>
                )}
              </div>
            )}
          </Link>
        );
      })}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────
export default function OtAllCategories() {
  const { apiProvider } = useProviderSafe();
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "tree">("grid");

  const { data: allCategories, isLoading } = useQuery({
    queryKey: ["ot-all-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ot_categories")
        .select("id, internal_id, external_id, name_mn, name_en, icon_url, provider_type, parent_internal_id, depth, seo_alias")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data as OtCat[];
    },
    staleTime: 1000 * 60 * 30,
  });

  // Build parent→children map
  const { rootCategories, childrenMap } = useMemo(() => {
    if (!allCategories) return { rootCategories: [], childrenMap: new Map<string, OtCat[]>() };

    const map = new Map<string, OtCat[]>();
    const roots: OtCat[] = [];

    for (const cat of allCategories) {
      if (!cat.parent_internal_id) {
        roots.push(cat);
      } else {
        const siblings = map.get(cat.parent_internal_id) || [];
        siblings.push(cat);
        map.set(cat.parent_internal_id, siblings);
      }
    }

    return { rootCategories: roots, childrenMap: map };
  }, [allCategories]);

  // Filter by provider
  const filteredRoots = useMemo(() => {
    let cats = rootCategories;
    if (apiProvider) {
      cats = cats.filter((c) => c.provider_type === apiProvider);
    }
    return cats;
  }, [rootCategories, apiProvider]);

  // Group by provider for display
  const groupedByProvider = useMemo(() => {
    const groups: Record<string, OtCat[]> = {};
    for (const cat of filteredRoots) {
      const key = cat.provider_type || "Бусад";
      if (!groups[key]) groups[key] = [];
      groups[key].push(cat);
    }
    return groups;
  }, [filteredRoots]);

  const totalCatCount = allCategories?.length || 0;

  return (
    <div className="py-4 md:py-8 animate-fade-in">
      <div className="px-3 md:container">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Бүх ангилалууд</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {filteredRoots.length} үндсэн ангилал · Нийт {totalCatCount} ангилал
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex border rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode("grid")}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === "grid" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                <Grid3X3 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("tree")}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === "tree" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                <FolderOpen className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <Input
            placeholder="Ангилал хайх..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              if (e.target.value && viewMode === "grid") setViewMode("tree");
            }}
            className="max-w-md"
          />
        </div>

        {/* Loading */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
        ) : viewMode === "grid" && !searchTerm ? (
          /* Grid View - grouped by provider */
          <div className="space-y-8">
            {Object.entries(groupedByProvider).map(([provider, cats]) => (
              <div key={provider}>
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="text-lg font-bold">{provider}</h2>
                  <Badge variant="secondary" className="text-xs">
                    {cats.length}
                  </Badge>
                </div>
                <CategoryGrid categories={cats} childrenMap={childrenMap} />
              </div>
            ))}
          </div>
        ) : (
          /* Tree View */
          <div className="border rounded-xl bg-card divide-y divide-border/50">
            {filteredRoots.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Folder className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Ангилал олдсонгүй</p>
              </div>
            ) : (
              filteredRoots.map((cat) => (
                <CategoryNode
                  key={cat.internal_id}
                  cat={cat}
                  childrenMap={childrenMap}
                  searchTerm={searchTerm}
                  defaultExpanded={!!searchTerm}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
