import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, FileText, Search } from "lucide-react";
import { format } from "date-fns";

const pageTypes = [
  { value: "page", label: "Хуудас" },
  { value: "news", label: "Мэдээ" },
  { value: "blog", label: "Блог" },
  { value: "guide", label: "Заавар" },
];

interface ContentPage {
  id: string;
  slug: string;
  title: string;
  content: string | null;
  page_type: string;
  status: string;
  seo_title: string | null;
  seo_description: string | null;
  display_order: number | null;
  created_at: string;
}

const defaultForm = {
  title: "", slug: "", content: "", page_type: "page", status: "draft",
  seo_title: "", seo_description: "", display_order: 0,
};

export default function Content() {
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<ContentPage | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const queryClient = useQueryClient();

  const { data: pages, isLoading } = useQuery({
    queryKey: ["admin", "content", search, typeFilter],
    queryFn: async () => {
      let q = supabase.from("content_pages").select("*").order("display_order");
      if (search) q = q.ilike("title", `%${search}%`);
      if (typeFilter !== "all") q = q.eq("page_type", typeFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data as ContentPage[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof defaultForm & { id?: string }) => {
      if (data.id) {
        const { error } = await supabase.from("content_pages").update(data).eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("content_pages").insert([data]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "content"] });
      toast.success(editing ? "Хуудас шинэчлэгдлээ" : "Хуудас нэмэгдлээ");
      handleClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("content_pages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "content"] });
      toast.success("Хуудас устгагдлаа");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleOpen = (page?: ContentPage) => {
    if (page) {
      setEditing(page);
      setForm({
        title: page.title, slug: page.slug, content: page.content || "",
        page_type: page.page_type, status: page.status,
        seo_title: page.seo_title || "", seo_description: page.seo_description || "",
        display_order: page.display_order || 0,
      });
    } else {
      setEditing(null);
      setForm(defaultForm);
    }
    setIsOpen(true);
  };

  const handleClose = () => { setIsOpen(false); setEditing(null); setForm(defaultForm); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const slug = form.slug || form.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    saveMutation.mutate({ ...form, slug, ...(editing ? { id: editing.id } : {}) });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Контент удирдлага</h1>
          <p className="text-muted-foreground mt-1">Мэдээ, блог, хуудас, заавар</p>
        </div>
        <Button onClick={() => handleOpen()}><Plus className="h-4 w-4 mr-2" />Хуудас нэмэх</Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Хайх..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Бүгд</SelectItem>
                {pageTypes.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" />Хуудсууд {pages && <Badge variant="secondary">{pages.length}</Badge>}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-muted animate-pulse rounded" />)}</div> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Гарчиг</TableHead>
                  <TableHead>Төрөл</TableHead>
                  <TableHead className="text-center">Төлөв</TableHead>
                  <TableHead>Огноо</TableHead>
                  <TableHead className="text-right">Үйлдэл</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pages?.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.title}</TableCell>
                    <TableCell><Badge variant="outline">{pageTypes.find((t) => t.value === p.page_type)?.label || p.page_type}</Badge></TableCell>
                    <TableCell className="text-center">
                      <Badge className={p.status === "published" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}>
                        {p.status === "published" ? "Нийтлэгдсэн" : "Ноорог"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{format(new Date(p.created_at), "yyyy-MM-dd")}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleOpen(p)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm("Устгах уу?")) deleteMutation.mutate(p.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
                {(!pages || pages.length === 0) && (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Хуудас олдсонгүй</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Хуудас засах" : "Шинэ хуудас"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Гарчиг *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
              <div className="space-y-2"><Label>Slug</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="auto-generated" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Төрөл</Label>
                <Select value={form.page_type} onValueChange={(v) => setForm({ ...form, page_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{pageTypes.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Төлөв</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Ноорог</SelectItem>
                    <SelectItem value="published">Нийтлэх</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2"><Label>Агуулга</Label><Textarea rows={10} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} /></div>
            <div className="space-y-2"><Label>SEO гарчиг</Label><Input value={form.seo_title} onChange={(e) => setForm({ ...form, seo_title: e.target.value })} /></div>
            <div className="space-y-2"><Label>SEO тайлбар</Label><Textarea rows={2} value={form.seo_description} onChange={(e) => setForm({ ...form, seo_description: e.target.value })} /></div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={handleClose}>Болих</Button>
              <Button type="submit" disabled={saveMutation.isPending}>{editing ? "Хадгалах" : "Нэмэх"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
