import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_PWA_CONFIG, type PwaBannerConfig } from "@/types/pwa";

export function usePwaConfig() {
  return useQuery({
    queryKey: ["pwa-config"],
    queryFn: async (): Promise<PwaBannerConfig> => {
      const { data, error } = await supabase
        .from("admin_settings")
        .select("setting_value")
        .eq("setting_key", "pwa_install_banner")
        .maybeSingle();

      if (error || !data) return DEFAULT_PWA_CONFIG;

      try {
        const parsed =
          typeof data.setting_value === "string"
            ? JSON.parse(data.setting_value)
            : data.setting_value;

        return { ...DEFAULT_PWA_CONFIG, ...parsed };
      } catch {
        return DEFAULT_PWA_CONFIG;
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}
