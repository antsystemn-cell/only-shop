import { useQuery } from "@tanstack/react-query";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import onlyLogo from "@/assets/only-logo.png";

interface StripItem {
  id: string;
  name: string;
  slug: string;
  provider_type: string;
  logo_url: string | null;
  bg_color: string | null;
  text_color: string | null;
}

export function ProviderStrip() {
  const navigate = useNavigate();
  const location = useLocation();

  const { data: items } = useQuery({
    queryKey: ["provider-strip-items"],
    queryFn: async () => {
      const { data } = await supabase
        .from("provider_strip_items")
        .select("*")
        .eq("is_active", true)
        .order("display_order");
      return (data || []) as StripItem[];
    },
    staleTime: 1000 * 60 * 60,
  });

  // Determine active slug from current path
  const getActiveSlug = () => {
    const path = location.pathname;
    if (path.startsWith("/ot/provider/")) {
      return path.split("/ot/provider/")[1]?.split("/")[0] || "home";
    }
    return "home";
  };

  const activeSlug = getActiveSlug();

  const handleClick = (item: StripItem) => {
    if (item.slug === "home") {
      navigate("/");
    } else {
      navigate(`/ot/provider/${item.slug}`);
    }
  };

  if (!items || items.length === 0) return null;

  return (
    <div className="w-full bg-secondary overflow-hidden">
      <div className="container flex items-center gap-2 py-1.5 overflow-x-auto scrollbar-hide">
        {items.map((item) => {
          const isActive = activeSlug === item.slug;
          return (
            <button
              key={item.id}
              onClick={() => handleClick(item)}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap shrink-0 border ${
                isActive
                  ? "bg-card text-foreground border-border shadow-sm"
                  : "bg-secondary-foreground/10 text-secondary-foreground border-transparent hover:bg-secondary-foreground/20"
              }`}
            >
              {item.logo_url ? (
                <img src={item.logo_url} alt="" className="w-5 h-5 object-contain rounded-full" />
              ) : item.slug === "home" ? (
                <img src={onlyLogo} alt="" className="w-5 h-5 object-contain" />
              ) : (
                <span className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                  {item.name.charAt(0)}
                </span>
              )}
              {item.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
