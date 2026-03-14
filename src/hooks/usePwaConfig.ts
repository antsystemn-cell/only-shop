import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PwaBannerConfig {
  enabled: boolean;
  title: string;
  subtitle: string;
  button_text: string;
  dismiss_days: number;
  position: "bottom" | "top" | "center";
  logo_url: string;
  bg_color: string;
  text_color: string;
  button_bg_color: string;
  button_text_color: string;
  border_radius: "sm" | "md" | "lg" | "xl" | "2xl";
  show_close_button: boolean;
}

const DEFAULTS: PwaBannerConfig = {
  enabled: true,
  title: "Only.mn апп суулгах",
  subtitle: "Илүү хурдан, илүү тохиромжтой хэрэглээ.",
  button_text: "Суулгах",
  dismiss_days: 7,
  position: "bottom",
  logo_url: "",
  bg_color: "",
  text_color: "",
  button_bg_color: "",
  button_text_color: "",
  border_radius: "2xl",
  show_close_button: true,
};

export function usePwaConfig() {
  return useQuery({
    queryKey: ["pwa-config"],
    queryFn: async (): Promise<PwaBannerConfig> => {
      const { data, error } = await supabase
        .from("admin_settings")
        .select("setting_value")
        .eq("setting_key", "pwa_install_banner")
        .maybeSingle();
      if (error || !data) return DEFAULTS;
      try {
        const parsed = typeof data.setting_value === "string"
          ? JSON.parse(data.setting_value)
          : data.setting_value;
        return { ...DEFAULTS, ...parsed };
      } catch {
        return DEFAULTS;
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}
