import { useQuery } from "@tanstack/react-query";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useProviderSafe, type ProviderFilter } from "@/contexts/ProviderContext";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { User, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
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
  const { user, signOut } = useAuth();
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
    // Local/shop provider type
    if (item.provider_type === "Local" || item.slug === "shop") {
      setSelectedProvider("all");
      navigate("/shop");
      return;
    }

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

  const handleSignOut = async () => {
    await signOut();
    toast.success("Амжилттай гарлаа");
  };

  if (!items || items.length === 0) return null;

  const getIsActive = (item: StripItem) => {
    if (item.slug === "home") return selectedProvider === "all" && location.pathname === "/";
    if (item.provider_type === "Local" || item.slug === "shop") return location.pathname === "/shop";
    return toProviderFilter(item.provider_type) === selectedProvider;
  };

  return (
    <div className="w-full bg-secondary overflow-hidden">
      <div className="flex items-center gap-1 py-1.5 pl-3 md:container md:px-4">
        {/* Scrollable provider buttons */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide flex-1 min-w-0 pr-1">
          {items.map((item) => {
            const isActive = getIsActive(item);
            const isHome = item.slug === "home";

            // Home/Only item: just the logo, no border/frame
            if (isHome) {
              return (
                <button
                  key={item.id}
                  onClick={() => handleClick(item)}
                  className="shrink-0 transition-opacity hover:opacity-80"
                >
                  <img
                    src={item.logo_url || onlyLogo}
                    alt="Only"
                    className="h-8 w-auto object-contain"
                  />
                </button>
              );
            }

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

        {/* Mobile profile dropdown - same as desktop behavior */}
        {isMobile && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center justify-center h-[30px] w-[30px] rounded-full shrink-0 bg-secondary-foreground/10 text-secondary-foreground hover:bg-secondary-foreground/20 transition-colors mr-1.5"
                aria-label="Профайл"
              >
                <User className="w-3.5 h-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {user ? (
                <>
                  <div className="px-2 py-1.5 text-sm font-medium truncate">{user.email}</div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/profile">Миний профайл</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/orders">Миний захиалгууд</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/wallet">Данс / Wallet</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/favourite-vendors">Дуртай борлуулагчид</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/support">Тусламж</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                    <LogOut className="h-4 w-4 mr-2" />
                    Гарах
                  </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem asChild>
                  <Link to="/auth">Нэвтрэх / Бүртгүүлэх</Link>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
