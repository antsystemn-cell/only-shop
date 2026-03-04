import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProviderStripItem {
  id: string;
  name: string;
  slug: string;
  provider_type: string;
  logo_url: string | null;
}

export function useProviderLogos() {
  return useQuery({
    queryKey: ["provider-strip-items"],
    queryFn: async () => {
      const { data } = await supabase
        .from("provider_strip_items")
        .select("id, name, slug, provider_type, logo_url")
        .eq("is_active", true)
        .order("display_order");
      return (data || []) as ProviderStripItem[];
    },
    staleTime: 1000 * 60 * 60,
  });
}

/** Get logo URL for a provider type like "Poizon" or "Taobao" */
export function getProviderLogo(items: ProviderStripItem[] | undefined, providerType: string): string | null {
  if (!items) return null;
  const match = items.find((i) => i.provider_type === providerType);
  return match?.logo_url || null;
}
