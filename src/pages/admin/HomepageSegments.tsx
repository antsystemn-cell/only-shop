import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Plus, RefreshCw, Trash2, GripVertical, Eye, EyeOff, Clock, Zap } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";

interface Segment {
  id: string;
  name: string;
  slug: string;
  title: string;
  subtitle: string | null;
  provider_type: string;
  source_type: string;
  category_ids: string[];
  search_query: string | null;
  search_order_by: string | null;
  manual_item_ids: string[];
  item_count: number;
  pool_size: number;
  cache_duration_days: number;
  is_active: boolean;
  display_order: number;
  icon_name: string | null;
  logo_url: string | null;
  visible_on: string;
  created_at: string;
}

interface Snapshot {
  id: string;
  segment_id: string;
  item_count: number;
  generated_at: string;
  expires_at: string;
  generation_source: string;
  otapi_calls_used: number;
}

export default function HomepageSegments() {
  const queryClient = useQueryClient();
  const [editingSegment, setEditingSegment] = useState<Segment | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const { data: segments, isLoading } = useQuery({
    queryKey: ["admin-homepage-segments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("homepage_segments")
        .select("*")
        .order("display_order");
      if (error) throw error;
      return (data || []) as Segment[];
    },
  });

  const { data: snapshots } = useQuery({
    queryKey: ["admin-segment-snapshots"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("homepage_segment_snapshots")
        .select("id, segment_id, item_count, generated_at, expires_at, generation_source, otapi_calls_used")
        .order("generated_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Snapshot[];
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("homepage_segments").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-homepage-segments"] });
      toast.success("Төлөв шинэчлэгдлээ");
    },
  });

  const deleteSegment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("homepage_segments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-homepage-segments"] });
      toast.success("Сегмент устгагдлаа");
    },
  });

  const regenerateSegment = useMutation({
    mutationFn: async (segmentId: string) => {
      const { data, error } = await supabase.functions.invoke("generate-homepage-snapshots", {
        body: { segmentId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-segment-snapshots"] });
      queryClient.invalidateQueries({ queryKey: ["homepage-snapshot"] });
      toast.success(`Snapshot шинэчлэгдлээ (${data?.results?.[0]?.itemCount || 0} бараа)`);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const regenerateAll = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("generate-homepage-snapshots", {
        body: {},
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-segment-snapshots"] });
      queryClient.invalidateQueries({ queryKey: ["homepage-snapshot"] });
      toast.success(`Бүх snapshot шинэчлэгдлээ (${data?.results?.length || 0} сегмент)`);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const getLatestSnapshot = (segmentId: string) => {
    return snapshots?.find(s => s.segment_id === segmentId);
  };

  const isExpired = (snap: Snapshot | undefined) => {
    if (!snap) return true;
    return new Date(snap.expires_at) < new Date();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Нүүр хуудасны сегментүүд</h1>
          <p className="text-sm text-muted-foreground">
            Нүүр хуудсан дээрх барааны секцүүдийг удирдах, кэшлэх тохиргоо
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => regenerateAll.mutate()}
            disabled={regenerateAll.isPending}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${regenerateAll.isPending ? "animate-spin" : ""}`} />
            Бүгдийг шинэчлэх
          </Button>
          <SegmentFormDialog
            open={isCreating}
            onOpenChange={setIsCreating}
            onSaved={() => {
              setIsCreating(false);
              queryClient.invalidateQueries({ queryKey: ["admin-homepage-segments"] });
            }}
          >
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" /> Шинэ сегмент
            </Button>
          </SegmentFormDialog>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {(segments || []).map((seg) => {
            const snap = getLatestSnapshot(seg.id);
            const expired = isExpired(snap);

            return (
              <Card key={seg.id} className={`${!seg.is_active ? "opacity-60" : ""}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 cursor-grab text-muted-foreground">
                      <GripVertical className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-sm">{seg.title || seg.name}</h3>
                        <Badge variant="outline" className="text-[10px]">{seg.provider_type}</Badge>
                        <Badge variant="secondary" className="text-[10px]">{seg.source_type}</Badge>
                        {seg.is_active ? (
                          <Badge className="text-[10px] bg-primary/10 text-primary">Идэвхтэй</Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px]">Идэвхгүй</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">{seg.subtitle}</p>

                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{seg.item_count} бараа</span>
                        <span>Пүүл: {seg.pool_size}</span>
                        <span>Кэш: {seg.cache_duration_days} хоног</span>
                        {snap ? (
                          <>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(snap.generated_at), "MM/dd HH:mm")}
                            </span>
                            <span>{snap.item_count} бараа кэшлэгдсэн</span>
                            <span>{snap.otapi_calls_used} OTAPI дуудлага</span>
                            {expired ? (
                              <Badge variant="destructive" className="text-[10px]">Хугацаа дууссан</Badge>
                            ) : (
                              <Badge className="text-[10px] bg-blue-100 text-blue-700">
                                {format(new Date(snap.expires_at), "MM/dd")} хүртэл
                              </Badge>
                            )}
                          </>
                        ) : (
                          <Badge variant="destructive" className="text-[10px]">Snapshot байхгүй</Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => regenerateSegment.mutate(seg.id)}
                        disabled={regenerateSegment.isPending}
                        title="Snapshot шинэчлэх"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${regenerateSegment.isPending ? "animate-spin" : ""}`} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => toggleActive.mutate({ id: seg.id, is_active: !seg.is_active })}
                      >
                        {seg.is_active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      </Button>
                      <SegmentFormDialog
                        segment={seg}
                        open={editingSegment?.id === seg.id}
                        onOpenChange={(open) => setEditingSegment(open ? seg : null)}
                        onSaved={() => {
                          setEditingSegment(null);
                          queryClient.invalidateQueries({ queryKey: ["admin-homepage-segments"] });
                        }}
                      >
                        <Button variant="ghost" size="sm" className="h-8 text-xs">Засах</Button>
                      </SegmentFormDialog>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => {
                          if (confirm("Устгах уу?")) deleteSegment.mutate(seg.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {(!segments || segments.length === 0) && (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <Zap className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Сегмент байхгүй байна. Шинэ сегмент үүсгэнэ үү.</p>
                <p className="text-xs mt-1">Сегмент үүсгэх хүртэл legacy тохиргоогоор ажиллана.</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Segment Form Dialog ─────────────────────────────────────
function SegmentFormDialog({
  segment,
  children,
  open,
  onOpenChange,
  onSaved,
}: {
  segment?: Segment;
  children: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const isEdit = !!segment;
  const [form, setForm] = useState({
    name: segment?.name || "",
    slug: segment?.slug || "",
    title: segment?.title || "",
    subtitle: segment?.subtitle || "",
    provider_type: segment?.provider_type || "Taobao",
    source_type: segment?.source_type || "category_based",
    category_ids: segment?.category_ids?.join(", ") || "",
    search_query: segment?.search_query || "",
    search_order_by: segment?.search_order_by || "Volume:Desc",
    manual_item_ids: segment?.manual_item_ids?.join(", ") || "",
    item_count: segment?.item_count || 24,
    pool_size: segment?.pool_size || 60,
    cache_duration_days: segment?.cache_duration_days || 7,
    display_order: segment?.display_order || 0,
    icon_name: segment?.icon_name || "",
    logo_url: segment?.logo_url || "",
    visible_on: segment?.visible_on || "both",
  });

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.name || !form.slug) {
      toast.error("Нэр болон slug шаардлагатай");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        slug: form.slug,
        title: form.title,
        subtitle: form.subtitle || null,
        provider_type: form.provider_type,
        source_type: form.source_type,
        category_ids: form.category_ids.split(",").map(s => s.trim()).filter(Boolean),
        search_query: form.search_query || null,
        search_order_by: form.search_order_by || "Volume:Desc",
        manual_item_ids: form.manual_item_ids.split(",").map(s => s.trim()).filter(Boolean),
        item_count: form.item_count,
        pool_size: form.pool_size,
        cache_duration_days: form.cache_duration_days,
        display_order: form.display_order,
        icon_name: form.icon_name || null,
        logo_url: form.logo_url || null,
        visible_on: form.visible_on,
      };

      if (isEdit && segment) {
        const { error } = await supabase.from("homepage_segments").update(payload).eq("id", segment.id);
        if (error) throw error;
        toast.success("Сегмент шинэчлэгдлээ");
      } else {
        const { error } = await supabase.from("homepage_segments").insert(payload);
        if (error) throw error;
        toast.success("Сегмент үүсгэгдлээ");
      }
      onSaved();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Сегмент засах" : "Шинэ сегмент"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Нэр</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Poizon" />
            </div>
            <div>
              <Label className="text-xs">Slug</Label>
              <Input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} placeholder="poizon" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Гарчиг</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Дэд гарчиг</Label>
              <Input value={form.subtitle} onChange={e => setForm(f => ({ ...f, subtitle: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Провайдер</Label>
              <Select value={form.provider_type} onValueChange={v => setForm(f => ({ ...f, provider_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Poizon">Poizon</SelectItem>
                  <SelectItem value="Taobao">Taobao</SelectItem>
                  <SelectItem value="Amazon">Amazon</SelectItem>
                  <SelectItem value="all">Бүгд</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Эх сурвалж</Label>
              <Select value={form.source_type} onValueChange={v => setForm(f => ({ ...f, source_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="category_based">Ангиллаар</SelectItem>
                  <SelectItem value="search_based">Хайлтаар</SelectItem>
                  <SelectItem value="manual">Гараар</SelectItem>
                  <SelectItem value="random_cached">Санамсаргүй (кэш)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Ангиллын ID-ууд (таслалаар)</Label>
            <Textarea value={form.category_ids} onChange={e => setForm(f => ({ ...f, category_ids: e.target.value }))} rows={2} placeholder="otc-1368, otc-1466" />
          </div>
          {form.source_type === "search_based" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Хайлтын query</Label>
                <Input value={form.search_query} onChange={e => setForm(f => ({ ...f, search_query: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Эрэмбэлэлт</Label>
                <Input value={form.search_order_by} onChange={e => setForm(f => ({ ...f, search_order_by: e.target.value }))} />
              </div>
            </div>
          )}
          {form.source_type === "manual" && (
            <div>
              <Label className="text-xs">Гараар оруулах ID-ууд (таслалаар)</Label>
              <Textarea value={form.manual_item_ids} onChange={e => setForm(f => ({ ...f, manual_item_ids: e.target.value }))} rows={2} />
            </div>
          )}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Барааны тоо</Label>
              <Input type="number" value={form.item_count} onChange={e => setForm(f => ({ ...f, item_count: Number(e.target.value) }))} />
            </div>
            <div>
              <Label className="text-xs">Пүүл хэмжээ</Label>
              <Input type="number" value={form.pool_size} onChange={e => setForm(f => ({ ...f, pool_size: Number(e.target.value) }))} />
            </div>
            <div>
              <Label className="text-xs">Кэш (хоног)</Label>
              <Input type="number" value={form.cache_duration_days} onChange={e => setForm(f => ({ ...f, cache_duration_days: Number(e.target.value) }))} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Дараалал</Label>
              <Input type="number" value={form.display_order} onChange={e => setForm(f => ({ ...f, display_order: Number(e.target.value) }))} />
            </div>
            <div>
              <Label className="text-xs">Icon нэр</Label>
              <Input value={form.icon_name} onChange={e => setForm(f => ({ ...f, icon_name: e.target.value }))} placeholder="shield" />
            </div>
            <div>
              <Label className="text-xs">Харагдах</Label>
              <Select value={form.visible_on} onValueChange={v => setForm(f => ({ ...f, visible_on: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">Бүгд</SelectItem>
                  <SelectItem value="desktop">Десктоп</SelectItem>
                  <SelectItem value="mobile">Мобайл</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Лого URL</Label>
            <Input value={form.logo_url} onChange={e => setForm(f => ({ ...f, logo_url: e.target.value }))} placeholder="https://..." />
          </div>
          <Button className="w-full" onClick={handleSave} disabled={saving}>
            {saving ? "Хадгалж байна..." : isEdit ? "Шинэчлэх" : "Үүсгэх"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
