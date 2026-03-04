import { useQuery } from "@tanstack/react-query";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useProviderSafe, type ProviderFilter } from "@/contexts/ProviderContext";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { User } from "lucide-react";
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

function toProviderFilter(providerType: string): ProviderFilter {
  if (providerType === "Poizon") return "Poizon";
  if (providerType === "Taobao") return "Taobao";
  return "all";
}

export function ProviderStrip() {
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedProvider, setSelectedProvider } = useProviderSafe();
  const { user } = useAuth();
  const isMobile = useIsMobile();

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

  const handleClick = (item: StripItem) => {
    const filter = item.slug === "home" ? "all" : toProviderFilter(item.provider_type);
    setSelectedProvider(filter);

    const isOnProviderPage = location.pathname.startsWith("/ot/provider/");
    if (item.slug === "home") {
      if (isOnProviderPage || location.pathname !== "/") navigate("/");
    } else {
      if (!isOnProviderPage || !location.pathname.includes(item.slug)) {
        navigate(`/ot/provider/${item.slug}`);
      }
    }
  };

  if (!items || items.length === 0) return null;

  const getIsActive = (item: StripItem) => {
    if (item.slug === "home") return selectedProvider === "all";
    return toProviderFilter(item.provider_type) === selectedProvider;
  };

  return (
    <div className="w-full bg-secondary overflow-hidden">
      <div className="container flex items-center gap-2 py-1.5">
        {/* Scrollable provider buttons */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide flex-1 min-w-0">
          {items.map((item) => {
            const isActive = getIsActive(item);
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
                  <img src={onlyLogo} alt="" className="w-5 h-5 object-contain rounded-full" />
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

        {/* Mobile profile button - always visible, not inside scroll */}
        {isMobile && (
          <>
            <div className="w-px h-6 bg-border shrink-0" />
            <Link
              to={user ? "/profile" : "/auth"}
              className="flex items-center justify-center w-8 h-8 rounded-full shrink-0 bg-secondary-foreground/10 text-secondary-foreground hover:bg-secondary-foreground/20 transition-colors"
              aria-label="Профайл"
            >
              <User className="w-4 h-4" />
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
