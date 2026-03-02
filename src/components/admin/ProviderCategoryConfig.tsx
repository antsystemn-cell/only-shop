import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, GripVertical, Save, FolderTree } from "lucide-react";
import { toast } from "sonner";

interface ProviderCategory {
  id: string;
  internal_id: string;
  name_mn: string | null;
  name_en: string | null;
  icon_url: string | null;
  is_active: boolean;
  display_order: number;
  depth: number;
  parent_internal_id: string | null;
  external_id: string | null;
  item_ids: string[] | null;
}

export function ProviderCategoryConfig({ providerType }: { providerType: string }) {
  const queryClient = useQueryClient();
  const [editedNames, setEditedNames] = useState<Record<string, string>>({});
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const dragNodeRef = useRef<HTMLTableRowElement | null>(null);

  const { data: categories, isLoading } = useQuery({
    queryKey: ["admin-provider-categories", providerType],
    queryFn: async () => {
      const { data: roots } = await supabase
        .from("ot_categories")
        .select("*")
        .eq("provider_type", providerType)
        .is("parent_internal_id", null)
        .order("display_order");

      if (!roots || roots.length === 0) return [];

      if (roots.length === 1) {
        const { data: children } = await supabase
          .from("ot_categories")
          .select("*")
          .eq("parent_internal_id", roots[0].internal_id)
          .order("display_order");
        return (children || []) as ProviderCategory[];
      }

      return roots as ProviderCategory[];
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("ot_categories").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-provider-categories", providerType] });
      toast.success("Шинэчлэгдлээ");
    },
  });

  const batchReorderMutation = useMutation({
    mutationFn: async (updates: { id: string; display_order: number }[]) => {
      for (const u of updates) {
        const { error } = await supabase.from("ot_categories").update({ display_order: u.display_order }).eq("id", u.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-provider-categories", providerType] });
      toast.success("Дараалал хадгалагдлаа");
    },
  });

  const saveNameMutation = useMutation({
    mutationFn: async ({ id, name_mn }: { id: string; name_mn: string }) => {
      const { error } = await supabase.from("ot_categories").update({ name_mn }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin-provider-categories", providerType] });
      setEditedNames(prev => {
        const next = { ...prev };
        delete next[vars.id];
        return next;
      });
      toast.success("Нэр хадгалагдлаа");
    },
  });

  const handleDragStart = useCallback((e: React.DragEvent<HTMLTableRowElement>, index: number) => {
    setDragIndex(index);
    dragNodeRef.current = e.currentTarget;
    e.dataTransfer.effectAllowed = "move";
    // Make drag image semi-transparent
    requestAnimationFrame(() => {
      if (dragNodeRef.current) dragNodeRef.current.style.opacity = "0.4";
    });
  }, []);

  const handleDragEnd = useCallback(() => {
    if (dragNodeRef.current) dragNodeRef.current.style.opacity = "1";
    if (dragIndex !== null && overIndex !== null && dragIndex !== overIndex && categories) {
      const reordered = [...categories];
      const [moved] = reordered.splice(dragIndex, 1);
      reordered.splice(overIndex, 0, moved);
      const updates = reordered.map((cat, i) => ({ id: cat.id, display_order: i }));
      batchReorderMutation.mutate(updates);
    }
    setDragIndex(null);
    setOverIndex(null);
  }, [dragIndex, overIndex, categories, batchReorderMutation]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLTableRowElement>, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setOverIndex(index);
  }, []);

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (!categories || categories.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FolderTree className="h-10 w-10 mx-auto mb-2 opacity-50" />
        <p>{providerType} провайдерт ангилал олдсонгүй</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold">{providerType} — Ангиллын таб тохиргоо</h3>
          <p className="text-sm text-muted-foreground">Чирж зөөн дарааллыг өөрчлөх боломжтой</p>
        </div>
        <Badge variant="secondary">{categories.filter(c => c.is_active).length} / {categories.length} идэвхтэй</Badge>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10"></TableHead>
            <TableHead className="w-10">#</TableHead>
            <TableHead className="w-12">Icon</TableHead>
            <TableHead>Харуулах нэр (Монгол)</TableHead>
            <TableHead>Internal ID</TableHead>
            <TableHead className="text-center">Ил харуулах</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {categories.map((cat, idx) => {
            const editedName = editedNames[cat.id];
            const currentName = editedName !== undefined ? editedName : (cat.name_mn || "");
            const isNameChanged = editedName !== undefined && editedName !== (cat.name_mn || "");
            const isOverTarget = overIndex === idx && dragIndex !== null && dragIndex !== idx;

            return (
              <TableRow
                key={cat.id}
                draggable
                onDragStart={e => handleDragStart(e, idx)}
                onDragEnd={handleDragEnd}
                onDragOver={e => handleDragOver(e, idx)}
                onDragLeave={() => setOverIndex(null)}
                className={`${!cat.is_active ? "opacity-50" : ""} ${isOverTarget ? "border-t-2 border-primary" : ""} transition-colors`}
                style={{ cursor: "grab" }}
              >
                <TableCell className="px-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                </TableCell>
                <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                <TableCell>
                  {cat.icon_url ? (
                    <img src={cat.icon_url} alt="" className="w-8 h-8 object-contain" />
                  ) : (
                    <FolderTree className="h-4 w-4 text-muted-foreground" />
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Input
                      value={currentName}
                      onChange={e => setEditedNames(prev => ({ ...prev, [cat.id]: e.target.value }))}
                      className="h-8 max-w-[200px]"
                      onMouseDown={e => e.stopPropagation()}
                      draggable={false}
                    />
                    {isNameChanged && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => saveNameMutation.mutate({ id: cat.id, name_mn: currentName })}
                        disabled={saveNameMutation.isPending}
                      >
                        <Save className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{cat.name_en || ""}</p>
                </TableCell>
                <TableCell className="text-xs font-mono text-muted-foreground">{cat.internal_id}</TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={cat.is_active}
                    onCheckedChange={v => toggleMutation.mutate({ id: cat.id, is_active: v })}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
