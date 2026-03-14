import { useState, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Upload, FolderTree, Loader2, ChevronRight, ChevronDown, Search,
  Package, Plus, Pencil, ArrowUp, ArrowDown, Trash2, ListTree, RefreshCw,
  Eye, EyeOff, Globe, ShoppingBag, Shield, FileQuestion, ExternalLink,
} from "lucide-react";
import { getCategoryPath } from "@/utils/categoryUrl";
import { OtCategoryForm } from "@/components/admin/OtCategoryForm";
import { OtCategoryItemsManager } from "@/components/admin/OtCategoryItemsManager";

interface OtCategory {
  id: string;
  internal_id: string;
  external_id: string | null;
  parent_internal_id: string | null;
  name_mn: string | null;
  name_en: string | null;
  name_ru: string | null;
  name_zh: string | null;
  icon_url: string | null;
  provider_type: string | null;
  item_ids: string[];
  is_parent_on_provider: boolean;
  is_active: boolean;
  depth: number;
  display_order: number;
  seo_alias: string | null;
  source_type: string;
}

/** Provider badge color mapping */
const PROVIDER_STYLES: Record<string, { color: string; icon: React.ReactNode }> = {
  Poizon: { color: "border-emerald-500/30 text-emerald-600 bg-emerald-50", icon: <Shield className="h-3 w-3" /> },
  Taobao: { color: "border-orange-500/30 text-orange-600 bg-orange-50", icon: <ShoppingBag className="h-3 w-3" /> },
  Amazon: { color: "border-blue-500/30 text-blue-600 bg-blue-50", icon: <Globe className="h-3 w-3" /> },
};

export default function OtCategories() {
  const [importing, setImporting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [visibilityFilter, setVisibilityFilter] = useState<string>("all");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Form & Items dialogs
  const [formOpen, setFormOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<OtCategory | null>(null);
  const [itemsManagerOpen, setItemsManagerOpen] = useState(false);
  const [itemsManagerCat, setItemsManagerCat] = useState<OtCategory | null>(null);

  const { data: categories, isLoading } = useQuery({
    queryKey: ["admin", "ot-categories"],
    queryFn: async () => {
      // Fetch all categories in batches to avoid the 1000-row default limit
      const allData: OtCategory[] = [];
      const batchSize = 1000;
      let from = 0;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from("ot_categories")
          .select("*")
          .order("depth")
          .order("display_order")
          .range(from, from + batchSize - 1);
        if (error) throw error;
        if (data && data.length > 0) {
          allData.push(...(data as OtCategory[]));
          from += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }
      return allData;
    },
  });

  // Toggle visibility (is_active) — optimistic update
  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("ot_categories").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, is_active }) => {
      await queryClient.cancelQueries({ queryKey: ["admin", "ot-categories"] });
      const prev = queryClient.getQueryData<OtCategory[]>(["admin", "ot-categories"]);
      queryClient.setQueryData<OtCategory[]>(["admin", "ot-categories"], (old) =>
        old?.map((c) => (c.id === id ? { ...c, is_active } : c))
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["admin", "ot-categories"], ctx.prev);
      toast.error("Алдаа гарлаа");
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.is_active ? "Категори нээгдлээ" : "Категори нуугдлаа");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["admin", "ot-categories"] }),
  });

  // Reorder
  const reorderMutation = useMutation({
    mutationFn: async ({ id, display_order }: { id: string; display_order: number }) => {
      const { error } = await supabase.from("ot_categories").update({ display_order }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "ot-categories"] }),
  });

  // Delete
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ot_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "ot-categories"] });
      toast.success("Категори устгагдлаа");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const xmlContent = await file.text();
      const { data, error } = await supabase.functions.invoke("import-ot-categories", {
        body: { xml_content: xmlContent },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Import failed");
      toast.success(`${data.total_inserted} категори оруулагдлаа`);
      queryClient.invalidateQueries({ queryKey: ["admin", "ot-categories"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleOtapiSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-ot-categories", { body: {} });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Sync failed");
      toast.success(`${data.total_inserted} категори шинэчлэгдлээ. Провайдерууд: ${data.providers?.join(", ")}`);
      queryClient.invalidateQueries({ queryKey: ["admin", "ot-categories"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSyncing(false);
    }
  };

  const toggleExpand = (internalId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(internalId) ? next.delete(internalId) : next.add(internalId);
      return next;
    });
  };

  // Build tree
  const childrenMap = useMemo(() => {
    const map = new Map<string, OtCategory[]>();
    categories?.forEach((c) => {
      if (c.parent_internal_id) {
        const existing = map.get(c.parent_internal_id) || [];
        existing.push(c);
        map.set(c.parent_internal_id, existing);
      }
    });
    return map;
  }, [categories]);

  const rootCategories = categories?.filter((c) => !c.parent_internal_id) || [];

  // Apply filters
  const filteredRoots = useMemo(() => {
    let list = searchTerm
      ? categories?.filter(
          (c) =>
            (c.name_mn || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
            (c.name_en || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.internal_id.toLowerCase().includes(searchTerm.toLowerCase())
        ) || []
      : rootCategories;

    if (providerFilter !== "all") {
      list = list.filter((c) => c.provider_type === providerFilter);
    }
    if (sourceFilter !== "all") {
      list = list.filter((c) => (c.source_type || "otapi-provider") === sourceFilter);
    }
    if (visibilityFilter !== "all") {
      const wantActive = visibilityFilter === "visible";
      list = list.filter((c) => c.is_active === wantActive);
    }
    return list;
  }, [searchTerm, categories, rootCategories, providerFilter, sourceFilter, visibilityFilter]);

  const parentCandidates = useMemo(
    () => categories?.filter(c => c.depth === 0 || c.depth === 1).map(c => ({
      internal_id: c.internal_id,
      name_mn: c.name_mn,
      name_en: c.name_en,
    })) || [],
    [categories]
  );

  const getDisplayName = (c: OtCategory) => c.name_mn || c.name_en || c.name_ru || c.internal_id;

  const getSiblings = (cat: OtCategory) => {
    if (cat.parent_internal_id) {
      return childrenMap.get(cat.parent_internal_id) || [];
    }
    return rootCategories;
  };

  const moveUp = (cat: OtCategory) => {
    const siblings = getSiblings(cat);
    const idx = siblings.findIndex(c => c.id === cat.id);
    if (idx <= 0) return;
    const above = siblings[idx - 1];
    reorderMutation.mutate({ id: cat.id, display_order: above.display_order });
    reorderMutation.mutate({ id: above.id, display_order: cat.display_order });
  };

  const moveDown = (cat: OtCategory) => {
    const siblings = getSiblings(cat);
    const idx = siblings.findIndex(c => c.id === cat.id);
    if (idx < 0 || idx >= siblings.length - 1) return;
    const below = siblings[idx + 1];
    reorderMutation.mutate({ id: cat.id, display_order: below.display_order });
    reorderMutation.mutate({ id: below.id, display_order: cat.display_order });
  };

  const renderCategory = (cat: OtCategory) => {
    const children = childrenMap.get(cat.internal_id) || [];
    const hasChildren = children.length > 0;
    const isExpanded = expandedIds.has(cat.internal_id);
    const sourceType = cat.source_type || "otapi-provider";
    const isManual = sourceType === "manual";
    const providerStyle = cat.provider_type ? PROVIDER_STYLES[cat.provider_type] : null;

    return (
      <div key={cat.internal_id}>
        <TableRow className={`hover:bg-muted/50 ${!cat.is_active ? "opacity-50" : ""}`}>
          {/* Category name with tree indentation */}
          <TableCell>
            <div
              className="flex items-center gap-2 cursor-pointer"
              style={{ paddingLeft: searchTerm ? 0 : `${cat.depth * 24}px` }}
              onClick={() => hasChildren && toggleExpand(cat.internal_id)}
            >
              {hasChildren ? (
                isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />
              ) : (
                <span className="w-4" />
              )}
              {cat.icon_url ? (
                <img src={cat.icon_url} alt="" className="w-6 h-6 object-contain" />
              ) : (
                <FolderTree className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="font-medium">{getDisplayName(cat)}</span>
            </div>
          </TableCell>

          {/* Provider badge */}
          <TableCell>
            {cat.provider_type && providerStyle ? (
              <Badge variant="outline" className={`gap-1 text-[10px] ${providerStyle.color}`}>
                {providerStyle.icon}
                {cat.provider_type}
              </Badge>
            ) : cat.provider_type ? (
              <Badge variant="secondary" className="text-[10px]">{cat.provider_type}</Badge>
            ) : null}
          </TableCell>

          {/* Source type badge */}
          <TableCell>
            {isManual ? (
              <Badge variant="outline" className="gap-1 text-[10px] border-amber-500/30 text-amber-600 bg-amber-50">
                <FileQuestion className="h-3 w-3" />
                Гараар
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 text-[10px] border-primary/20 text-primary/70">
                OTAPI
              </Badge>
            )}
          </TableCell>

          {/* Curated items count */}
          <TableCell className="text-center">
            {(cat.item_ids?.length || 0) > 0 && (
              <Badge variant="outline" className="gap-1 cursor-pointer" onClick={() => { setItemsManagerCat(cat); setItemsManagerOpen(true); }}>
                <Package className="h-3 w-3" />
                {cat.item_ids.length}
              </Badge>
            )}
          </TableCell>

          {/* Visibility toggle — eye icon */}
          <TableCell className="text-center">
            <button
              onClick={() => toggleMutation.mutate({ id: cat.id, is_active: !cat.is_active })}
              className={`inline-flex items-center justify-center h-8 w-8 rounded-md transition-colors ${
                cat.is_active
                  ? "text-primary hover:bg-primary/10"
                  : "text-muted-foreground hover:bg-muted"
              }`}
              title={cat.is_active ? "Нууцлах (frontend-д харагдахгүй)" : "Нээх (frontend-д харагдана)"}
            >
              {cat.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
          </TableCell>

          {/* Actions */}
          <TableCell>
            <div className="flex items-center gap-0.5 justify-end">
              <Button variant="ghost" size="icon" className="h-7 w-7" asChild title="Категорын хуудас руу үсрэх">
                <a href={getCategoryPath(cat)} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveUp(cat)}>
                <ArrowUp className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveDown(cat)}>
                <ArrowDown className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setItemsManagerCat(cat); setItemsManagerOpen(true); }}>
                <Package className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingCat(cat); setFormOpen(true); }}>
                <Pencil className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => {
                if (confirm(`"${getDisplayName(cat)}" категори болон түүний доорх бүх дэд ангилалууд устгагдана. Устгах уу?`)) {
                  deleteMutation.mutate(cat.id);
                }
              }}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </TableCell>
        </TableRow>
        {isExpanded && children.map(renderCategory)}
      </div>
    );
  };

  const totalItems = categories?.reduce((sum, c) => sum + (c.item_ids?.length || 0), 0) || 0;
  const activeCount = categories?.filter(c => c.is_active).length || 0;
  const manualCount = categories?.filter(c => (c.source_type || "otapi-provider") === "manual").length || 0;
  const providerCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    categories?.forEach((c) => {
      const p = c.provider_type || "Бусад";
      counts[p] = (counts[p] || 0) + 1;
    });
    return counts;
  }, [categories]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">OT Категори удирдлага</h1>
          <p className="text-muted-foreground mt-1">Ангилалуудыг үүсгэх, засах, харагдах байдлыг удирдах</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={handleOtapiSync} disabled={syncing} variant="outline" className="gap-1">
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            OTAPI-аас шинэчлэх
          </Button>
          <Button onClick={() => { setEditingCat(null); setFormOpen(true); }} variant="outline" className="gap-1">
            <Plus className="h-4 w-4" /> Категори нэмэх
          </Button>
          <input type="file" accept=".xml" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
          <Button onClick={() => fileInputRef.current?.click()} disabled={importing}>
            {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            XML импортлох
          </Button>
        </div>
      </div>

      {/* Stats */}
      {categories && categories.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-muted-foreground">Нийт</p>
              <p className="text-2xl font-bold">{categories.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-muted-foreground flex items-center gap-1"><Eye className="h-3 w-3" /> Харагдах</p>
              <p className="text-2xl font-bold text-primary">{activeCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-muted-foreground flex items-center gap-1"><EyeOff className="h-3 w-3" /> Нуугдсан</p>
              <p className="text-2xl font-bold text-muted-foreground">{categories.length - activeCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-muted-foreground">Гараар үүсгэсэн</p>
              <p className="text-2xl font-bold text-amber-600">{manualCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-muted-foreground">Нийт бараа</p>
              <p className="text-2xl font-bold">{totalItems}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListTree className="h-5 w-5 text-primary" />
            Категорийн мод
            {categories && <Badge variant="secondary">{categories.length}</Badge>}
          </CardTitle>

          {/* Search & Filters row */}
          <div className="flex flex-col md:flex-row gap-2 mt-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Категори хайх..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
            </div>
            <Select value={providerFilter} onValueChange={setProviderFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Нийлүүлэгч" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Бүх нийлүүлэгч</SelectItem>
                <SelectItem value="Poizon">Poizon ({providerCounts["Poizon"] || 0})</SelectItem>
                <SelectItem value="Taobao">Taobao ({providerCounts["Taobao"] || 0})</SelectItem>
                <SelectItem value="Amazon">Amazon ({providerCounts["Amazon"] || 0})</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-[130px]"><SelectValue placeholder="Эх сурвалж" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Бүх эх сурвалж</SelectItem>
                <SelectItem value="otapi-provider">OTAPI</SelectItem>
                <SelectItem value="manual">Гараар</SelectItem>
              </SelectContent>
            </Select>
            <Select value={visibilityFilter} onValueChange={setVisibilityFilter}>
              <SelectTrigger className="w-[130px]"><SelectValue placeholder="Харагдах" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Бүгд</SelectItem>
                <SelectItem value="visible">Харагдах</SelectItem>
                <SelectItem value="hidden">Нуугдсан</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filteredRoots.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ангилал</TableHead>
                    <TableHead>Нийлүүлэгч</TableHead>
                    <TableHead>Эх сурвалж</TableHead>
                    <TableHead className="text-center">Бараа</TableHead>
                    <TableHead className="text-center">Харагдах</TableHead>
                    <TableHead className="text-right">Үйлдэл</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>{filteredRoots.map(renderCategory)}</TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <FolderTree className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>OT категори олдсонгүй</p>
              <p className="text-sm mt-1">XML файл импортлох эсвэл шинэ категори нэмнэ үү</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <OtCategoryForm
        open={formOpen}
        onOpenChange={setFormOpen}
        editingCategory={editingCat}
        parentCategories={parentCandidates}
      />

      {itemsManagerCat && (
        <OtCategoryItemsManager
          open={itemsManagerOpen}
          onOpenChange={setItemsManagerOpen}
          categoryId={itemsManagerCat.id}
          categoryName={getDisplayName(itemsManagerCat)}
          currentItemIds={itemsManagerCat.item_ids || []}
        />
      )}
    </div>
  );
}
