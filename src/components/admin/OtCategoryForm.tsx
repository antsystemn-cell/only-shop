import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { getCategoryPath } from "@/utils/categoryUrl";

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
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingCategory: OtCategory | null;
  parentCategories: Array<{ internal_id: string; name_mn: string | null; name_en: string | null }>;
}

export function OtCategoryForm({ open, onOpenChange, editingCategory, parentCategories }: Props) {
  const queryClient = useQueryClient();
  const [nameMn, setNameMn] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [nameRu, setNameRu] = useState("");
  const [internalId, setInternalId] = useState("");
  const [externalId, setExternalId] = useState("");
  const [parentInternalId, setParentInternalId] = useState<string>("none");
  const [providerType, setProviderType] = useState<string>("Poizon");
  const [iconUrl, setIconUrl] = useState("");
  const [seoAlias, setSeoAlias] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [displayOrder, setDisplayOrder] = useState(0);

  useEffect(() => {
    if (editingCategory) {
      setNameMn(editingCategory.name_mn || "");
      setNameEn(editingCategory.name_en || "");
      setNameRu(editingCategory.name_ru || "");
      setInternalId(editingCategory.internal_id);
      setExternalId(editingCategory.external_id || "");
      setParentInternalId(editingCategory.parent_internal_id || "none");
      setProviderType(editingCategory.provider_type || "Poizon");
      setIconUrl(editingCategory.icon_url || "");
      setSeoAlias(editingCategory.seo_alias || "");
      setIsActive(editingCategory.is_active);
      setDisplayOrder(editingCategory.display_order);
    } else {
      setNameMn("");
      setNameEn("");
      setNameRu("");
      setInternalId("");
      setExternalId("");
      setParentInternalId("none");
      setProviderType("Poizon");
      setIconUrl("");
      setSeoAlias("");
      setIsActive(true);
      setDisplayOrder(0);
    }
  }, [editingCategory, open]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const parentId = parentInternalId === "none" ? null : parentInternalId;
      const parentCat = parentId ? parentCategories.find(c => c.internal_id === parentId) : null;
      // Calculate depth based on parent
      let depth = 0;
      if (parentId) {
        // Simple: we just set depth to parent's depth + 1, but we don't have parent depth here
        // For simplicity, set depth to 1 if has parent
        depth = 1;
      }

      const payload = {
        name_mn: nameMn || null,
        name_en: nameEn || null,
        name_ru: nameRu || null,
        parent_internal_id: parentId,
        provider_type: providerType,
        icon_url: iconUrl || null,
        seo_alias: seoAlias || null,
        is_active: isActive,
        display_order: displayOrder,
        external_id: externalId || null,
      };

      if (editingCategory) {
        const { error } = await supabase
          .from("ot_categories")
          .update(payload)
          .eq("id", editingCategory.id);
        if (error) throw error;
      } else {
        if (!internalId.trim()) throw new Error("Internal ID шаардлагатай");
        // Manual categories default to hidden (is_active=false) and source_type='manual'
        const { error } = await supabase
          .from("ot_categories")
          .insert([{ ...payload, internal_id: internalId.trim(), depth, source_type: 'manual', is_active: false }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "ot-categories"] });
      onOpenChange(false);
      toast.success(editingCategory ? "Категори шинэчлэгдлээ" : "Категори үүсгэгдлээ");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {editingCategory ? "Категори засах" : "Шинэ категори үүсгэх"}
            {editingCategory && (
              <a
                href={getCategoryPath(editingCategory)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-normal text-primary hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Хуудас үзэх
              </a>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {!editingCategory && (
            <div>
              <Label>Internal ID *</Label>
              <Input value={internalId} onChange={e => setInternalId(e.target.value)} placeholder="otc-custom-123" />
              <p className="text-xs text-muted-foreground mt-1">Давтагдахгүй ID (жишээ: otc-custom-shoes)</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Монгол нэр</Label>
              <Input value={nameMn} onChange={e => setNameMn(e.target.value)} placeholder="Гутал" />
            </div>
            <div>
              <Label>Англи нэр</Label>
              <Input value={nameEn} onChange={e => setNameEn(e.target.value)} placeholder="Shoes" />
            </div>
          </div>
          <div>
            <Label>Орос нэр</Label>
            <Input value={nameRu} onChange={e => setNameRu(e.target.value)} placeholder="Обувь" />
          </div>
          <div>
            <Label>External ID (OT API)</Label>
            <Input value={externalId} onChange={e => setExternalId(e.target.value)} placeholder="500000091" />
            <p className="text-xs text-muted-foreground mt-1">OT API-д хайлт хийхэд ашигладаг ID</p>
          </div>
          <div>
            <Label>Эцэг категори</Label>
            <Select value={parentInternalId} onValueChange={setParentInternalId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-60">
                <SelectItem value="none">— Үндсэн категори —</SelectItem>
                {parentCategories.map(c => (
                  <SelectItem key={c.internal_id} value={c.internal_id}>
                    {c.name_mn || c.name_en || c.internal_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Нийлүүлэгч</Label>
              <Select value={providerType} onValueChange={setProviderType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Poizon">Poizon</SelectItem>
                  <SelectItem value="Taobao">Taobao</SelectItem>
                  <SelectItem value="Amazon">Amazon</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Дараалал</Label>
              <Input type="number" value={displayOrder} onChange={e => setDisplayOrder(Number(e.target.value))} />
            </div>
          </div>
          <div>
            <Label>Icon URL</Label>
            <Input value={iconUrl} onChange={e => setIconUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div>
            <Label>URL Slug</Label>
            <Input value={seoAlias} onChange={e => setSeoAlias(e.target.value)} placeholder="fragrances" />
            <p className="text-xs text-muted-foreground mt-1">
              {seoAlias 
                ? `only.mn/category/${seoAlias}` 
                : `only.mn/category/${internalId || editingCategory?.internal_id || 'otc-xxx'}`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <Label>Идэвхтэй (харагдана)</Label>
          </div>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full">
            {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {editingCategory ? "Хадгалах" : "Үүсгэх"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
