import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, Globe, Shield, Settings, Users, Languages } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { callWithOperatorSession } from "@/services/otSession";
import { normalizeOtResponse } from "@/utils/otNormalizer";
import { resetOtApiLanguageCache } from "@/services/otApi";
import { supabase } from "@/integrations/supabase/client";
import { resetTranslationMode } from "@/hooks/useTranslatedTitles";

function ErrorAlert({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 text-destructive p-3 rounded-lg bg-destructive/10">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="text-sm">{message}</span>
    </div>
  );
}

export default function OtSettings() {
  const { data: geoRaw, isLoading: geoLoading } = useQuery<any>({
    queryKey: ["admin", "ot-geolocation"],
    queryFn: async () => {
      try { return await callWithOperatorSession("getGeolocationSettings"); }
      catch (e: any) { return { success: false, error: e.message }; }
    },
    retry: false,
  });

  const { data: commonRaw, isLoading: commonLoading } = useQuery<any>({
    queryKey: ["admin", "ot-common-options"],
    queryFn: async () => {
      try { return await callWithOperatorSession("getCommonInstanceOptionsInfo"); }
      catch (e: any) { return { success: false, error: e.message }; }
    },
    retry: false,
  });

  const { data: collectionsRaw, isLoading: collectionsLoading } = useQuery<any>({
    queryKey: ["admin", "ot-collections-settings"],
    queryFn: async () => {
      try { return await callWithOperatorSession("getCollectionsSettings"); }
      catch (e: any) { return { success: false, error: e.message }; }
    },
    retry: false,
  });

  const { data: rolesRaw, isLoading: rolesLoading } = useQuery<any>({
    queryKey: ["admin", "ot-roles"],
    queryFn: async () => {
      try { return await callWithOperatorSession("getAvailableRoleList"); }
      catch (e: any) { return { success: false, error: e.message }; }
    },
    retry: false,
  });

  const geo = normalizeOtResponse<any>(geoRaw);
  const common = normalizeOtResponse<any>(commonRaw);
  const collections = normalizeOtResponse<any>(collectionsRaw);
  const roles = normalizeOtResponse<any>(rolesRaw);

  const roleList = (() => {
    const d = roles.data;
    if (Array.isArray(d)) return d;
    if (Array.isArray(d?.Content)) return d.Content;
    if (Array.isArray(d?.RoleInfoList?.Item)) return d.RoleInfoList.Item;
    return d && typeof d === "object" && !Array.isArray(d) ? [d] : [];
  })();

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">OT Тохиргоо</h1>
        <p className="text-muted-foreground mt-1">Геолокаци, нэвтрэлт, цуглуулга, эрхийн тохиргоо</p>
      </div>

      <Tabs defaultValue="translation">
        <TabsList className="flex-wrap">
          <TabsTrigger value="translation">Орчуулга</TabsTrigger>
          <TabsTrigger value="otapi-language">OTAPI хэлний тохиргоо</TabsTrigger>
          <TabsTrigger value="geolocation">Геолокаци</TabsTrigger>
          <TabsTrigger value="common">Ерөнхий</TabsTrigger>
          <TabsTrigger value="collections">Цуглуулга</TabsTrigger>
          <TabsTrigger value="roles">OT эрхүүд</TabsTrigger>
        </TabsList>

        <TabsContent value="translation" className="mt-4">
          <TranslationSettingsCard />
        </TabsContent>

        <TabsContent value="otapi-language" className="mt-4">
          <OtApiLanguageSettingsCard />
        </TabsContent>

        <TabsContent value="geolocation" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                Геолокацийн тохиргоо
              </CardTitle>
            </CardHeader>
            <CardContent>
              {geoLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : !geo.success ? (
                <ErrorAlert message={geo.error || "Геолокацийн тохиргоо ачаалж чадсангүй"} />
              ) : (
                <RenderSettings data={geo.data} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="common" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                OT ерөнхий тохиргоо
              </CardTitle>
            </CardHeader>
            <CardContent>
              {commonLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : !common.success ? (
                <ErrorAlert message={common.error || "Тохиргоо ачаалж чадсангүй"} />
              ) : (
                <RenderSettings data={common.data} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="collections" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Цуглуулгын тохиргоо
              </CardTitle>
            </CardHeader>
            <CardContent>
              {collectionsLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : !collections.success ? (
                <ErrorAlert message={collections.error || "Тохиргоо ачаалж чадсангүй"} />
              ) : (
                <RenderSettings data={collections.data} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                OT эрхүүд (Roles)
                {roleList.length > 0 && <Badge variant="secondary">{roleList.length}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {rolesLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : !roles.success ? (
                <ErrorAlert message={roles.error || "Эрхийн жагсаалт ачаалж чадсангүй"} />
              ) : roleList.length === 0 ? (
                <p className="text-sm text-muted-foreground">Эрх олдсонгүй</p>
              ) : (
                <div className="space-y-2">
                  {roleList.map((r: any, i: number) => (
                    <div key={r.Id || i} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-primary" />
                        <span className="font-medium">{r.Name || r.DisplayName || "—"}</span>
                      </div>
                      {r.Description && (
                        <span className="text-xs text-muted-foreground">{r.Description}</span>
                      )}
                      {r.Id && <Badge variant="outline" className="text-xs">ID: {typeof r.Id === "object" ? r.Id.Value : r.Id}</Badge>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RenderSettings({ data }: { data: any }) {
  if (!data || typeof data !== "object") {
    return <p className="text-sm text-muted-foreground">Тохиргоо байхгүй</p>;
  }
  const entries = Object.entries(data).filter(([k]) => !["ErrorCode", "RequestId", "RequestTime"].includes(k));
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">Тохиргоо байхгүй</p>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {entries.map(([key, value]) => (
        <div key={key} className="space-y-1 p-3 rounded-lg border">
          <p className="text-xs text-muted-foreground">{key.replace(/([A-Z])/g, " $1").trim()}</p>
          <p className="font-medium text-sm">
            {typeof value === "boolean" ? (
              <Badge variant={value ? "default" : "secondary"}>{value ? "Идэвхтэй" : "Идэвхгүй"}</Badge>
            ) : typeof value === "object" && value !== null ? (
              <Badge variant="outline">
                {Array.isArray(value) ? `${value.length} зүйл` : `${Object.keys(value).length} тохиргоо`}
              </Badge>
            ) : (
              String(value ?? "—")
            )}
          </p>
        </div>
      ))}
    </div>
  );
}

function TranslationSettingsCard() {
  const queryClient = useQueryClient();

  const { data: setting, isLoading } = useQuery({
    queryKey: ["admin", "translation-mode"],
    queryFn: async () => {
      const { data } = await supabase
        .from("admin_settings")
        .select("setting_value")
        .eq("setting_key", "translation_mode")
        .maybeSingle();
      if (data?.setting_value) {
        const val = typeof data.setting_value === "string" ? JSON.parse(data.setting_value) : data.setting_value;
        return val === "default" ? "default" : "ai";
      }
      return "ai";
    },
  });

  const [mode, setMode] = useState<"ai" | "default">("ai");

  useEffect(() => {
    if (setting) setMode(setting as "ai" | "default");
  }, [setting]);

  const saveMutation = useMutation({
    mutationFn: async (newMode: string) => {
      // Upsert the setting
      const { data: existing } = await supabase
        .from("admin_settings")
        .select("id")
        .eq("setting_key", "translation_mode")
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("admin_settings")
          .update({ setting_value: JSON.stringify(newMode) })
          .eq("setting_key", "translation_mode");
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("admin_settings")
          .insert({
            setting_key: "translation_mode",
            setting_value: JSON.stringify(newMode),
            category: "storefront",
            description: "Барааны нэрийн орчуулгын горим",
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "translation-mode"] });
      resetTranslationMode();
      toast.success("Орчуулгын тохиргоо хадгалагдлаа");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Languages className="h-5 w-5 text-primary" />
          Барааны нэрийн орчуулга
        </CardTitle>
        <CardDescription>
          Барааны нэрийг хэрхэн орчуулахыг сонгоно уу. AI орчуулга нь Хятад/Англи нэрийг Монгол руу автоматаар хөрвүүлнэ.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <RadioGroup value={mode} onValueChange={(v) => setMode(v as "ai" | "default")}>
          <div className="flex items-start gap-3 p-4 rounded-lg border hover:border-primary/50 transition-colors cursor-pointer" onClick={() => setMode("ai")}>
            <RadioGroupItem value="ai" id="mode-ai" className="mt-0.5" />
            <div className="space-y-1">
              <Label htmlFor="mode-ai" className="text-sm font-semibold cursor-pointer">
                🤖 AI Орчуулга ашиглах
              </Label>
              <p className="text-xs text-muted-foreground">
                Gemini AI ашиглан барааны нэрийг Хятад/Англи хэлнээс Монгол руу автоматаар орчуулна. 
                Орчуулсан нэрсийг кэшлэх тул нэг удаа орчуулагдсан нэр дахин орчуулагдахгүй.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 rounded-lg border hover:border-primary/50 transition-colors cursor-pointer" onClick={() => setMode("default")}>
            <RadioGroupItem value="default" id="mode-default" className="mt-0.5" />
            <div className="space-y-1">
              <Label htmlFor="mode-default" className="text-sm font-semibold cursor-pointer">
                📝 Үндсэн орчуулга ашиглах
              </Label>
              <p className="text-xs text-muted-foreground">
                OTAPI-ийн Монгол хэл дээрх орчуулгыг шууд ашиглана. AI орчуулга хийхгүй.
              </p>
            </div>
          </div>
        </RadioGroup>

        <Button 
          onClick={() => saveMutation.mutate(mode)} 
          disabled={saveMutation.isPending}
          className="w-full sm:w-auto"
        >
          {saveMutation.isPending ? "Хадгалж байна..." : "Хадгалах"}
        </Button>
      </CardContent>
    </Card>
  );
}

function OtApiLanguageSettingsCard() {
  const queryClient = useQueryClient();

  const { data: translationSettingsRaw, isLoading } = useQuery<any>({
    queryKey: ["admin", "ot-translation-settings"],
    queryFn: async () => {
      try { return await callWithOperatorSession("getTranslationSettings"); }
      catch (e: any) { return { success: false, error: e.message }; }
    },
    retry: false,
  });

  const { data: contentListRaw, isLoading: contentLoading } = useQuery<any>({
    queryKey: ["admin", "ot-translatable-content"],
    queryFn: async () => {
      try { return await callWithOperatorSession("getTranslatableContentList"); }
      catch (e: any) { return { success: false, error: e.message }; }
    },
    retry: false,
  });

  const { data: languageSetting, isLoading: languageSettingLoading } = useQuery<string>({
    queryKey: ["admin", "otapi-default-language"],
    queryFn: async () => {
      const { data } = await supabase
        .from("admin_settings")
        .select("setting_value")
        .eq("setting_key", "otapi_default_language")
        .maybeSingle();

      if (!data?.setting_value) return "mn";
      const value = typeof data.setting_value === "string" ? JSON.parse(data.setting_value) : data.setting_value;
      return typeof value === "string" && value.trim() ? value : "mn";
    },
  });

  const [selectedLanguage, setSelectedLanguage] = useState("mn");

  useEffect(() => {
    if (languageSetting) setSelectedLanguage(languageSetting);
  }, [languageSetting]);

  const saveLanguageMutation = useMutation({
    mutationFn: async (newLang: string) => {
      const { data: existing } = await supabase
        .from("admin_settings")
        .select("id")
        .eq("setting_key", "otapi_default_language")
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("admin_settings")
          .update({ setting_value: JSON.stringify(newLang) })
          .eq("setting_key", "otapi_default_language");
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("admin_settings")
          .insert({
            setting_key: "otapi_default_language",
            setting_value: JSON.stringify(newLang),
            category: "storefront",
            description: "OTAPI үндсэн хэл",
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      resetOtApiLanguageCache();
      queryClient.invalidateQueries({ queryKey: ["admin", "otapi-default-language"] });
      toast.success("OTAPI үндсэн хэл хадгалагдлаа");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const translationSettings = normalizeOtResponse<any>(translationSettingsRaw);
  const contentList = normalizeOtResponse<any>(contentListRaw);

  const contentItems = (() => {
    const d = contentList.data;
    if (!d) return [];
    if (Array.isArray(d)) return d;
    if (Array.isArray(d?.Content)) return d.Content;
    if (Array.isArray(d?.Content?.Item)) return d.Content.Item;
    if (d?.Content?.Item && typeof d.Content.Item === "object") return [d.Content.Item];
    return [];
  })();

  const languageOptions = (() => {
    const fallback = [
      { value: "mn", label: "Монгол (mn)" },
      { value: "khk", label: "Mongolian KHK (khk)" },
      { value: "en", label: "English (en)" },
      { value: "ru", label: "Русский (ru)" },
      { value: "zh-chs", label: "中文简体 (zh-chs)" },
    ];

    const rawLanguages = translationSettings.data?.Languages?.Content;
    if (!Array.isArray(rawLanguages) || rawLanguages.length === 0) return fallback;

    const mapped = rawLanguages
      .map((lang: any) => ({
        value: String(lang?.Name || "").trim(),
        label: `${lang?.Description || lang?.Name || "Unknown"} (${lang?.Name || "-"})`,
      }))
      .filter((lang: { value: string }) => Boolean(lang.value));

    return mapped.length > 0 ? mapped : fallback;
  })();

  const currentLanguageLabel =
    languageOptions.find((option) => option.value === selectedLanguage)?.label || `Монгол (mn)`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Languages className="h-5 w-5 text-primary" />
          OTAPI олон хэлний тохиргоо
        </CardTitle>
        <CardDescription>
          Энэ систем OTAPI үндсэн хэлийг дотоод тохиргооноос удирдаж байна (хуучин домэйнтэй хамааралгүй).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="p-4 rounded-lg border bg-primary/5 space-y-3">
          <h4 className="text-sm font-semibold">🌐 Үндсэн хэлний тохиргоо</h4>
          <p className="text-xs text-muted-foreground">
            OTAPI руу илгээх бүх API дуудлагын <code className="bg-muted px-1 rounded">language</code> параметр энэ сонголтоос удирдагдана.
          </p>

          {languageSettingLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                <SelectTrigger className="w-full sm:w-[280px]">
                  <SelectValue placeholder="Хэл сонгох" />
                </SelectTrigger>
                <SelectContent>
                  {languageOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                onClick={() => saveLanguageMutation.mutate(selectedLanguage)}
                disabled={saveLanguageMutation.isPending}
                className="w-full sm:w-auto"
              >
                {saveLanguageMutation.isPending ? "Хадгалж байна..." : "Хэл хадгалах"}
              </Button>
            </div>
          )}

          <Badge className="bg-primary text-primary-foreground">Идэвхтэй: {currentLanguageLabel}</Badge>
        </div>

        <div>
          <h4 className="text-sm font-semibold mb-2">📋 Серверийн орчуулгын мэдээлэл</h4>
          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : !translationSettings.success ? (
            <ErrorAlert message={translationSettings.error || "Орчуулгын мэдээлэл ачаалж чадсангүй"} />
          ) : (
            <RenderSettings data={translationSettings.data} />
          )}
        </div>

        <div>
          <h4 className="text-sm font-semibold mb-2">📄 Орчуулах боломжтой контентийн жагсаалт</h4>
          {contentLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : !contentList.success ? (
            <ErrorAlert message={contentList.error || "Контентийн жагсаалт ачаалж чадсангүй"} />
          ) : contentItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">Орчуулах боломжтой контент олдсонгүй</p>
          ) : (
            <div className="space-y-2">
              {contentItems.map((item: any, i: number) => (
                <div key={item.Id || i} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <div>
                    <span className="font-medium text-sm">{item.Description || item.Id || "—"}</span>
                  </div>
                  {item.Id && <Badge variant="outline" className="text-xs">{item.Id}</Badge>}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
