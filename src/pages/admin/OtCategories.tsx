import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  FolderTree,
  Loader2,
  ChevronRight,
  ChevronDown,
  Search,
  Package,
} from "lucide-react";

interface OtCategory {
  id: string;
  internal_id: string;
  external_id: string | null;
  parent_internal_id: string | null;
  name_mn: string | null;
  name_en: string | null;
  name_ru: string | null;
  icon_url: string | null;
  provider_type: string | null;
  item_ids: string[];
  is_parent_on_provider: boolean;
  depth: number;
  display_order: number;
}

export default function OtCategories() {
  const [importing, setImporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch all OT categories
  const { data: categories, isLoading } = useQuery({
    queryKey: ["admin", "ot-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ot_categories")
        .select("*")
        .order("depth")
        .order("display_order");
      if (error) throw error;
      return data as OtCategory[];
    },
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

      toast({
        title: "Амжилттай импортлолоо!",
        description: `${data.total_inserted} категори оруулагдлаа`,
      });

      queryClient.invalidateQueries({ queryKey: ["admin", "ot-categories"] });
    } catch (err: any) {
      toast({
        title: "Импортлохад алдаа гарлаа",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const toggleExpand = (internalId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(internalId)) {
        next.delete(internalId);
      } else {
        next.add(internalId);
      }
      return next;
    });
  };

  // Build tree structure
  const rootCategories = categories?.filter((c) => !c.parent_internal_id) || [];
  const childrenMap = new Map<string, OtCategory[]>();
  categories?.forEach((c) => {
    if (c.parent_internal_id) {
      const existing = childrenMap.get(c.parent_internal_id) || [];
      existing.push(c);
      childrenMap.set(c.parent_internal_id, existing);
    }
  });

  const filteredRoots = searchTerm
    ? categories?.filter(
        (c) =>
          (c.name_mn || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
          (c.name_en || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.internal_id.toLowerCase().includes(searchTerm.toLowerCase())
      ) || []
    : rootCategories;

  const getDisplayName = (c: OtCategory) =>
    c.name_mn || c.name_en || c.name_ru || c.internal_id;

  const renderCategory = (cat: OtCategory) => {
    const children = childrenMap.get(cat.internal_id) || [];
    const hasChildren = children.length > 0;
    const isExpanded = expandedIds.has(cat.internal_id);

    return (
      <div key={cat.internal_id}>
        <TableRow className="hover:bg-muted/50">
          <TableCell>
            <div
              className="flex items-center gap-2 cursor-pointer"
              style={{ paddingLeft: searchTerm ? 0 : `${cat.depth * 24}px` }}
              onClick={() => hasChildren && toggleExpand(cat.internal_id)}
            >
              {hasChildren ? (
                isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )
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
          <TableCell className="text-muted-foreground text-xs font-mono">
            {cat.internal_id}
          </TableCell>
          <TableCell>
            {cat.provider_type && (
              <Badge variant={cat.provider_type === "Poizon" ? "default" : "secondary"}>
                {cat.provider_type}
              </Badge>
            )}
          </TableCell>
          <TableCell className="text-center">
            {cat.item_ids.length > 0 && (
              <Badge variant="outline" className="gap-1">
                <Package className="h-3 w-3" />
                {cat.item_ids.length}
              </Badge>
            )}
          </TableCell>
          <TableCell className="text-center text-muted-foreground">
            {children.length > 0 && children.length}
          </TableCell>
        </TableRow>
        {isExpanded && children.map(renderCategory)}
      </div>
    );
  };

  const totalItems = categories?.reduce((sum, c) => sum + (c.item_ids?.length || 0), 0) || 0;
  const poizonCount = categories?.filter((c) => c.provider_type === "Poizon").length || 0;
  const taobaoCount = categories?.filter((c) => c.provider_type === "Taobao").length || 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">OT Категори удирдлага</h1>
          <p className="text-muted-foreground mt-1">
            OT API каталогын ангилалуудыг импортлох, удирдах
          </p>
        </div>
        <div>
          <input
            type="file"
            accept=".xml"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="bg-primary hover:bg-primary/90"
          >
            {importing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            XML импортлох
          </Button>
        </div>
      </div>

      {/* Stats */}
      {categories && categories.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-muted-foreground">Нийт категори</p>
              <p className="text-2xl font-bold">{categories.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-muted-foreground">Poizon</p>
              <p className="text-2xl font-bold">{poizonCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-muted-foreground">Taobao</p>
              <p className="text-2xl font-bold">{taobaoCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-muted-foreground">Нийт бараа (curated)</p>
              <p className="text-2xl font-bold">{totalItems}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search + Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderTree className="h-5 w-5 text-primary" />
            Категорийн мод
            {categories && <Badge variant="secondary">{categories.length}</Badge>}
          </CardTitle>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Категори хайх..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredRoots.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ангилал</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>Нийлүүлэгч</TableHead>
                    <TableHead className="text-center">Бараа</TableHead>
                    <TableHead className="text-center">Дэд</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>{filteredRoots.map(renderCategory)}</TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <FolderTree className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>OT категори олдсонгүй</p>
              <p className="text-sm mt-1">XML файл импортлоно уу</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
