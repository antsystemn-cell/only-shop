import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, GripVertical, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ProviderCategoryConfig } from "@/components/admin/ProviderCategoryConfig";

interface Section {
  id: string;
  provider_type: string;
  title: string;
  icon_name: string | null;
  search_query: string | null;
  category_id: string | null;
  order_by: string | null;
  page_size: number | null;
  display_order: number;
  is_active: boolean;
  show_on_home: boolean;
}

interface StripItem {
  id: string;
  name: string;
  slug: string;
  provider_type: string;
  logo_url: string | null;
  bg_color: string | null;
  text_color: string | null;
  display_order: number;
  is_active: boolean;
  show_categories: boolean;
}

const ICON_OPTIONS = [
  "sparkles", "star", "footprints", "droplets", "shirt", "home", "baby",
  "smartphone", "heart", "dumbbell", "shopping-bag", "trending-up", "package",
];

const HOME_POIZON_COUNT_KEY = "home_poizon_count";
const HOME_TAOBAO_COUNT_KEY = "home_taobao_count";
const HOME_AMAZON_COUNT_KEY = "home_amazon_count";
const HOME_PROVIDER_ORDER_KEY = "home_provider_order";
const DEFAULT_HOME_PAGE_SIZE = 24;

function SectionsManager({ providerType }: { providerType: string }) {
  const queryClient = useQueryClient();
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: sections, isLoading } = useQuery({
    queryKey: ["admin-provider-sections", providerType],
    queryFn: async () => {
      const { data } = await supabase
        .from("provider_sections")
        .select("*")
        .eq("provider_type", providerType)
        .order("display_order");
      return (data || []) as Section[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (section: Partial<Section>) => {
      if (section.id) {
        const { error } = await supabase
          .from("provider_sections")
          .update(section)
          .eq("id", section.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("provider_sections")
          .insert([{ ...section, provider_type: providerType } as any]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-provider-sections", providerType] });
      setIsDialogOpen(false);
      setEditingSection(null);
      toast.success("Хадгалагдлаа");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("provider_sections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-provider-sections", providerType] });
      toast.success("Устгагдлаа");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("provider_sections").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-provider-sections", providerType] });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    saveMutation.mutate({
      id: editingSection?.id,
      title: fd.get("title") as string,
      icon_name: fd.get("icon_name") as string || null,
      search_query: fd.get("search_query") as string || null,
      category_id: fd.get("category_id") as string || null,
      order_by: fd.get("order_by") as string || "Volume:Desc",
      page_size: Number(fd.get("page_size")) || 12,
      display_order: Number(fd.get("display_order")) || 0,
      show_on_home: fd.get("show_on_home") === "on",
    });
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold">{providerType} секцүүд</h3>
        <Dialog open={isDialogOpen} onOpenChange={(o) => { setIsDialogOpen(o); if (!o) setEditingSection(null); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1">
              <Plus className="h-4 w-4" /> Секц нэмэх
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingSection ? "Секц засах" : "Шинэ секц"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="title">Нэр</Label>
                <Input id="title" name="title" defaultValue={editingSection?.title || ""} required />
              </div>
              <div>
                <Label htmlFor="search_query">Хайлтын түлхүүр үг</Label>
                <Input id="search_query" name="search_query" defaultValue={editingSection?.search_query || ""} placeholder="shoes sneakers" />
              </div>
              <div>
                <Label htmlFor="category_id">Ангилалын ID (OT)</Label>
                <Input id="category_id" name="category_id" defaultValue={editingSection?.category_id || ""} placeholder="Хоосон байж болно" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="icon_name">Icon</Label>
                  <Select name="icon_name" defaultValue={editingSection?.icon_name || "package"}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ICON_OPTIONS.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="order_by">Эрэмбэ</Label>
                  <Select name="order_by" defaultValue={editingSection?.order_by || "Volume:Desc"}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Volume:Desc">Борлуулалт</SelectItem>
                      <SelectItem value="Price:Asc">Үнэ: Багаас</SelectItem>
                      <SelectItem value="Price:Desc">Үнэ: Ихээс</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="page_size">Бараа тоо</Label>
                  <Input id="page_size" name="page_size" type="number" defaultValue={editingSection?.page_size || 12} />
                </div>
                <div>
                  <Label htmlFor="display_order">Дараалал</Label>
                  <Input id="display_order" name="display_order" type="number" defaultValue={editingSection?.display_order || 0} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="show_on_home" name="show_on_home" defaultChecked={editingSection?.show_on_home ?? false} />
                <Label htmlFor="show_on_home">Нүүр хуудаст харуулах</Label>
              </div>
              <Button type="submit" disabled={saveMutation.isPending} className="w-full">
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Хадгалах
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Нэр</TableHead>
              <TableHead>Хайлт</TableHead>
              <TableHead>Icon</TableHead>
              <TableHead>Идэвхтэй</TableHead>
              <TableHead className="text-right">Үйлдэл</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sections?.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{s.display_order}</TableCell>
                <TableCell className="font-medium">{s.title}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{s.search_query || s.category_id || "-"}</TableCell>
                <TableCell>{s.icon_name || "-"}</TableCell>
                <TableCell>
                  <Switch checked={s.is_active} onCheckedChange={(v) => toggleMutation.mutate({ id: s.id, is_active: v })} />
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => { setEditingSection(s); setIsDialogOpen(true); }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => { if (confirm("Устгах уу?")) deleteMutation.mutate(s.id); }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function StripItemsManager() {
  const queryClient = useQueryClient();
  const [editingItem, setEditingItem] = useState<StripItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: items, isLoading } = useQuery({
    queryKey: ["admin-strip-items"],
    queryFn: async () => {
      const { data } = await supabase.from("provider_strip_items").select("*").order("display_order");
      return (data || []) as StripItem[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (item: Partial<StripItem>) => {
      if (item.id) {
        const { error } = await supabase.from("provider_strip_items").update(item).eq("id", item.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("provider_strip_items").insert([item as any]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-strip-items"] });
      setIsDialogOpen(false);
      setEditingItem(null);
      toast.success("Хадгалагдлаа");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("provider_strip_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-strip-items"] });
      toast.success("Устгагдлаа");
    },
  });

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    let logoUrl = editingItem?.logo_url || null;

    if (logoFile) {
      setUploading(true);
      const ext = logoFile.name.split(".").pop() || "png";
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("provider-logos")
        .upload(path, logoFile, { upsert: true });
      setUploading(false);
      if (uploadError) {
        toast.error("Лого upload алдаа: " + uploadError.message);
        return;
      }
      const { data: urlData } = supabase.storage.from("provider-logos").getPublicUrl(path);
      logoUrl = urlData.publicUrl;
    }

    const payload: Partial<StripItem> = {
      name: fd.get("name") as string,
      slug: fd.get("slug") as string,
      provider_type: fd.get("provider_type") as string,
      logo_url: logoUrl,
      display_order: Number(fd.get("display_order")) || 0,
      show_categories: fd.get("show_categories") === "on",
    };
    if (editingItem?.id) payload.id = editingItem.id;
    saveMutation.mutate(payload);
    setLogoFile(null);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold">Провайдер товчлуурууд</h3>
        <Dialog open={isDialogOpen} onOpenChange={(o) => { setIsDialogOpen(o); if (!o) setEditingItem(null); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1"><Plus className="h-4 w-4" /> Нэмэх</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingItem ? "Засах" : "Шинэ провайдер"}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Нэр</Label>
                <Input name="name" defaultValue={editingItem?.name || ""} required />
              </div>
              <div>
                <Label>Slug (URL)</Label>
                <Input name="slug" defaultValue={editingItem?.slug || ""} required placeholder="poizon" />
              </div>
              <div>
                <Label>Provider Type (OTAPI)</Label>
                <Input name="provider_type" defaultValue={editingItem?.provider_type || ""} required placeholder="Poizon" />
              </div>
              <div>
                <Label>Лого (зураг upload)</Label>
                {(editingItem?.logo_url || logoFile) && (
                  <div className="mb-2 flex items-center gap-2">
                    <img
                      src={logoFile ? URL.createObjectURL(logoFile) : editingItem?.logo_url || ""}
                      alt="logo preview"
                      className="h-10 w-10 rounded border object-contain bg-muted"
                    />
                    {editingItem?.logo_url && !logoFile && (
                      <span className="text-xs text-muted-foreground truncate max-w-[200px]">{editingItem.logo_url.split("/").pop()}</span>
                    )}
                  </div>
                )}
                <Input
                  type="file"
                  accept="image/png,image/svg+xml,image/jpeg,image/webp,image/x-icon"
                  onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                />
              </div>
              <div>
                <Label>Дараалал</Label>
                <Input name="display_order" type="number" defaultValue={editingItem?.display_order || 0} />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="show_categories" name="show_categories" defaultChecked={editingItem?.show_categories !== false} />
                <Label htmlFor="show_categories">Ангилалууд харуулах</Label>
              </div>
              <Button type="submit" disabled={saveMutation.isPending || uploading} className="w-full">
                {uploading ? "Лого upload хийж байна..." : "Хадгалах"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Нэр</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead className="text-right">Үйлдэл</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items?.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.display_order}</TableCell>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell>{item.slug}</TableCell>
                <TableCell>{item.provider_type}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => { setEditingItem(item); setIsDialogOpen(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => { if (confirm("Устгах уу?")) deleteMutation.mutate(item.id); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function HomeShowcaseSettingsManager() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin-home-showcase-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_settings")
        .select("id, setting_key, setting_value")
        .eq("category", "storefront")
        .in("setting_key", [HOME_POIZON_COUNT_KEY, HOME_TAOBAO_COUNT_KEY, HOME_AMAZON_COUNT_KEY]);
      if (error) throw error;
      return data || [];
    },
  });

  const getSettingValue = (settingKey: string) => {
    const existing = settings?.find((s) => s.setting_key === settingKey);
    const raw = existing?.setting_value;
    const parsed = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_HOME_PAGE_SIZE;
    return Math.floor(parsed);
  };

  const saveMutation = useMutation({
    mutationFn: async ({ poizonCount, taobaoCount }: { poizonCount: number; taobaoCount: number }) => {
      const payload = [
        { key: HOME_POIZON_COUNT_KEY, value: poizonCount, description: "Нүүр хуудасны Poizon барааны тоо" },
        { key: HOME_TAOBAO_COUNT_KEY, value: taobaoCount, description: "Нүүр хуудасны Taobao барааны тоо" },
      ];

      await Promise.all(
        payload.map(async (item) => {
          const existing = settings?.find((s) => s.setting_key === item.key);
          if (existing?.id) {
            const { error } = await supabase
              .from("admin_settings")
              .update({ setting_value: item.value })
              .eq("id", existing.id);
            if (error) throw error;
            return;
          }

          const { error } = await supabase.from("admin_settings").insert([
            {
              category: "storefront",
              setting_key: item.key,
              setting_value: item.value,
              description: item.description,
            },
          ]);
          if (error) throw error;
        })
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-home-showcase-settings"] });
      queryClient.invalidateQueries({ queryKey: ["home-showcase-settings"] });
      toast.success("Нүүр хуудасны барааны тоо хадгалагдлаа");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const poizonCount = Math.max(1, Number(fd.get("poizon_count")) || DEFAULT_HOME_PAGE_SIZE);
    const taobaoCount = Math.max(1, Number(fd.get("taobao_count")) || DEFAULT_HOME_PAGE_SIZE);
    saveMutation.mutate({ poizonCount, taobaoCount });
  };

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <form onSubmit={handleSave} className="space-y-4 rounded-lg border p-4 bg-card">
      <h3 className="font-semibold">Нүүр хуудсанд харагдах барааны тоо</h3>
      <p className="text-sm text-muted-foreground">Poizon болон Taobao тус бүр хэдэн бараа харагдахыг тохируулна.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="poizon_count">Poizon барааны тоо</Label>
          <Input
            id="poizon_count"
            name="poizon_count"
            type="number"
            min={1}
            defaultValue={getSettingValue(HOME_POIZON_COUNT_KEY)}
          />
        </div>
        <div>
          <Label htmlFor="taobao_count">Taobao барааны тоо</Label>
          <Input
            id="taobao_count"
            name="taobao_count"
            type="number"
            min={1}
            defaultValue={getSettingValue(HOME_TAOBAO_COUNT_KEY)}
          />
        </div>
      </div>

      <Button type="submit" disabled={saveMutation.isPending} className="gap-2">
        {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Хадгалах
      </Button>
    </form>
  );
}

const BLOCKED_VENDORS_KEY = "blocked_vendors";

function BlockedVendorsManager() {
  const queryClient = useQueryClient();
  const [newVendor, setNewVendor] = useState("");

  const { data: blockedVendors, isLoading } = useQuery({
    queryKey: ["admin-blocked-vendors"],
    queryFn: async () => {
      const { data } = await supabase
        .from("admin_settings")
        .select("id, setting_value")
        .eq("category", "storefront")
        .eq("setting_key", BLOCKED_VENDORS_KEY)
        .maybeSingle();
      const raw = data?.setting_value;
      return {
        id: data?.id,
        vendors: Array.isArray(raw) ? (raw as string[]) : [],
      };
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (vendors: string[]) => {
      if (blockedVendors?.id) {
        const { error } = await supabase
          .from("admin_settings")
          .update({ setting_value: vendors as any })
          .eq("id", blockedVendors.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("admin_settings").insert([{
          category: "storefront",
          setting_key: BLOCKED_VENDORS_KEY,
          setting_value: vendors as any,
          description: "Хасагдсан борлуулагчдын жагсаалт",
        }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-blocked-vendors"] });
      toast.success("Хадгалагдлаа");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleAdd = () => {
    const v = newVendor.trim();
    if (!v) return;
    const current = blockedVendors?.vendors || [];
    if (current.some((x) => x.toLowerCase() === v.toLowerCase())) {
      toast.error("Аль хэдийн нэмэгдсэн байна");
      return;
    }
    saveMutation.mutate([...current, v]);
    setNewVendor("");
  };

  const handleRemove = (vendor: string) => {
    const current = blockedVendors?.vendors || [];
    saveMutation.mutate(current.filter((x) => x !== vendor));
  };

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4 rounded-lg border p-4 bg-card">
      <h3 className="font-semibold">Хасагдсан борлуулагчид</h3>
      <p className="text-sm text-muted-foreground">
        Энд нэмсэн борлуулагчдын бараа хайлтын үр дүнд, нүүр хуудас болон бүх хуудсанд харагдахгүй.
      </p>

      <div className="flex gap-2">
        <Input
          value={newVendor}
          onChange={(e) => setNewVendor(e.target.value)}
          placeholder="Борлуулагчийн нэр (жнь: Dewu Only)"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
        />
        <Button onClick={handleAdd} disabled={saveMutation.isPending} size="sm">
          Нэмэх
        </Button>
      </div>

      <div className="space-y-1">
        {(blockedVendors?.vendors || []).length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">Хасагдсан борлуулагч байхгүй</p>
        ) : (
          (blockedVendors?.vendors || []).map((v) => (
            <div key={v} className="flex items-center justify-between rounded border px-3 py-2">
              <span className="text-sm">{v}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleRemove(v)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function ProviderSectionsAdmin() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Провайдер тохиргоо</h1>
        <p className="text-muted-foreground">Провайдер товчлуурууд болон секцүүдийг удирдах</p>
      </div>

      <Tabs defaultValue="strip">
        <TabsList className="flex-wrap">
          <TabsTrigger value="strip">Провайдер товчлуурууд</TabsTrigger>
          <TabsTrigger value="home-counts">Нүүрийн бараа тоо</TabsTrigger>
          <TabsTrigger value="blocked-vendors">Хасагдсан борлуулагчид</TabsTrigger>
          <TabsTrigger value="poizon">Poizon секцүүд</TabsTrigger>
          <TabsTrigger value="taobao">Taobao секцүүд</TabsTrigger>
          <TabsTrigger value="poizon-cats">Poizon ангилал</TabsTrigger>
          <TabsTrigger value="taobao-cats">Taobao ангилал</TabsTrigger>
        </TabsList>
        <TabsContent value="strip" className="mt-4">
          <StripItemsManager />
        </TabsContent>
        <TabsContent value="home-counts" className="mt-4">
          <HomeShowcaseSettingsManager />
        </TabsContent>
        <TabsContent value="blocked-vendors" className="mt-4">
          <BlockedVendorsManager />
        </TabsContent>
        <TabsContent value="poizon" className="mt-4">
          <SectionsManager providerType="Poizon" />
        </TabsContent>
        <TabsContent value="taobao" className="mt-4">
          <SectionsManager providerType="Taobao" />
        </TabsContent>
        <TabsContent value="poizon-cats" className="mt-4">
          <ProviderCategoryConfig providerType="Poizon" />
        </TabsContent>
        <TabsContent value="taobao-cats" className="mt-4">
          <ProviderCategoryConfig providerType="Taobao" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
