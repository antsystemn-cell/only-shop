import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Save, Megaphone, Globe, Image as ImageIcon, Upload } from "lucide-react";

export default function Seo() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin", "settings", "seo"],
    queryFn: async () => {
      const { data, error } = await supabase.from("admin_settings").select("*").eq("category", "seo");
      if (error) throw error;
      return data;
    },
  });

  const getSetting = (key: string) => {
    const s = settings?.find((s) => s.setting_key === key);
    try { return s ? JSON.parse(String(s.setting_value)) : ""; } catch { return s?.setting_value || ""; }
  };

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ogImage, setOgImage] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (settings) {
      setTitle(getSetting("seo_default_title"));
      setDescription(getSetting("seo_default_description"));
      setOgImage(getSetting("social_og_image"));
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const { error } = await supabase.from("admin_settings").update({ setting_value: JSON.stringify(value) }).eq("setting_key", key);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "settings", "seo"] });
      queryClient.invalidateQueries({ queryKey: ["seo-defaults"] });
      toast.success("Хадгалагдлаа");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `seo/og-image-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("banners").upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("banners").getPublicUrl(path);
      setOgImage(urlData.publicUrl);
      toast.success("Зураг хуулагдлаа");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  if (isLoading) return <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Үндсэн SEO тохиргоо</h1>
        <p className="text-muted-foreground mt-1">Сайтын ерөнхий Website Info, хайлтын үр дүн, link preview-ийн үндсэн мэдээллийг удирдана</p>
      </div>

      {/* Site Title */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Globe className="h-4 w-4" />Сайтын SEO гарчиг</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Only - Онлайн дэлгүүр" maxLength={70} />
          <p className="text-xs text-muted-foreground">{title.length}/70 тэмдэгт. Хайлтын үр дүн болон browser tab дээр харагдана.</p>
          <Button size="sm" onClick={() => saveMutation.mutate({ key: "seo_default_title", value: title })} disabled={saveMutation.isPending}>
            <Save className="h-4 w-4 mr-2" />Хадгалах
          </Button>
        </CardContent>
      </Card>

      {/* Site Description */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Megaphone className="h-4 w-4" />Сайтын SEO тайлбар</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Сайтын тайлбар..." rows={3} maxLength={160} />
          <p className="text-xs text-muted-foreground">{description.length}/160 тэмдэгт. Google хайлтын үр дүн болон link preview дээр харагдана.</p>
          <Button size="sm" onClick={() => saveMutation.mutate({ key: "seo_default_description", value: description })} disabled={saveMutation.isPending}>
            <Save className="h-4 w-4 mr-2" />Хадгалах
          </Button>
        </CardContent>
      </Card>

      {/* OG Image */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><ImageIcon className="h-4 w-4" />Social sharing зураг (OG Image)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Линк хуваалцахад харагдах зураг. Хамгийн тохиромжтой хэмжээ: 1200x630px</p>
          {ogImage && (
            <div className="rounded-lg overflow-hidden border max-w-md">
              <img src={ogImage} alt="OG Image preview" className="w-full h-auto object-cover" />
            </div>
          )}
          <div className="flex items-center gap-3">
            <Input value={ogImage} onChange={(e) => setOgImage(e.target.value)} placeholder="https://... зургийн URL" className="flex-1" />
            <label className="cursor-pointer">
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              <Button variant="outline" size="sm" asChild disabled={uploading}>
                <span><Upload className="h-4 w-4 mr-1" />{uploading ? "..." : "Upload"}</span>
              </Button>
            </label>
          </div>
          <Button size="sm" onClick={() => saveMutation.mutate({ key: "social_og_image", value: ogImage })} disabled={saveMutation.isPending}>
            <Save className="h-4 w-4 mr-2" />Хадгалах
          </Button>
        </CardContent>
      </Card>

      {/* Live Preview */}
      <Card>
        <CardHeader><CardTitle className="text-base">📱 Link Preview (Урьдчилсан харагдац)</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">Линк хуваалцахад ийм харагдана:</p>
          <div className="border rounded-lg overflow-hidden max-w-md bg-muted/30">
            {ogImage ? (
              <img src={ogImage} alt="Preview" className="w-full h-40 object-cover" />
            ) : (
              <div className="w-full h-40 bg-muted flex items-center justify-center text-muted-foreground text-sm">Зураг тохируулаагүй</div>
            )}
            <div className="p-3 space-y-1">
              <p className="text-xs text-muted-foreground uppercase">only.mn</p>
              <p className="font-semibold text-sm line-clamp-2">{title || "Сайтын нэр"}</p>
              <p className="text-xs text-muted-foreground line-clamp-2">{description || "Сайтын тайлбар"}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
