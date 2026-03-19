import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SeoDefaults {
  siteTitle: string;
  siteDescription: string;
  ogImage: string;
}

export function useSeoDefaults() {
  return useQuery({
    queryKey: ["seo-defaults"],
    queryFn: async (): Promise<SeoDefaults> => {
      const { data } = await supabase
        .from("admin_settings")
        .select("setting_key, setting_value")
        .eq("category", "seo");

      const get = (key: string) => {
        const row = data?.find((r) => r.setting_key === key);
        if (!row) return "";
        try {
          return JSON.parse(String(row.setting_value));
        } catch {
          return String(row.setting_value || "");
        }
      };

      return {
        siteTitle: get("seo_default_title") || "Онли",
        siteDescription: get("seo_default_description") || "",
        ogImage: get("social_og_image") || "",
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}
