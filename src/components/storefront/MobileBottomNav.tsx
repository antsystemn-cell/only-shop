import { Link, useLocation } from "react-router-dom";
import { Home, Heart, LayoutGrid, ShoppingCart, User } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { CartDrawer } from "@/components/storefront/CartDrawer";

export function MobileBottomNav() {
  const location = useLocation();
  const { getItemCount } = useCart();
  const { wishlistIds } = useWishlist();
  const { user } = useAuth();

  const cartCount = getItemCount();
  const wishlistCount = wishlistIds.length;

  const isActive = (href: string) => {
    if (href === "/") return location.pathname === "/";
    return location.pathname.startsWith(href);
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
      <div className="flex items-center justify-around px-1 py-2">
        {/* Home */}
        <Link to="/" className="flex flex-col items-center gap-0.5 min-w-[56px]">
          <Home className={cn("h-5 w-5", isActive("/") ? "text-primary" : "text-muted-foreground")} />
          <span className={cn("text-[10px] font-medium", isActive("/") ? "text-primary" : "text-muted-foreground")}>Нүүр</span>
        </Link>

        {/* Wishlist */}
        <Link to="/wishlist" className="flex flex-col items-center gap-0.5 min-w-[56px]">
          <div className="relative">
            <Heart className={cn("h-5 w-5", isActive("/wishlist") ? "text-primary" : "text-muted-foreground", wishlistCount > 0 && "text-destructive fill-destructive")} />
            {wishlistCount > 0 && (
              <span className="absolute -top-1.5 -right-2 min-w-[14px] h-[14px] rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center px-0.5">
                {wishlistCount > 99 ? "99+" : wishlistCount}
              </span>
            )}
          </div>
          <span className={cn("text-[10px] font-medium", isActive("/wishlist") ? "text-primary" : "text-muted-foreground")}>Таалагдсан</span>
        </Link>

        {/* Categories - Center */}
        <Link to="/categories" className="flex flex-col items-center gap-0.5 min-w-[56px]">
          <div className={cn(
            "w-11 h-11 rounded-full flex items-center justify-center shadow-md -mt-5",
            "bg-primary text-primary-foreground ring-4 ring-card"
          )}>
            <LayoutGrid className="h-5 w-5" />
          </div>
          <span className={cn("text-[10px] font-medium", isActive("/categories") ? "text-primary" : "text-muted-foreground")}>Ангилал</span>
        </Link>

        {/* Cart */}
        <Sheet>
          <SheetTrigger asChild>
            <button className="flex flex-col items-center gap-0.5 min-w-[56px]">
              <div className="relative">
                <ShoppingCart className="h-5 w-5 text-muted-foreground" />
                {cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[14px] h-[14px] rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center px-0.5">
                    {cartCount > 99 ? "99+" : cartCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium text-muted-foreground">Сагс</span>
            </button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">
            <CartDrawer />
          </SheetContent>
        </Sheet>

        {/* Profile */}
        <Link to={user ? "/profile" : "/auth"} className="flex flex-col items-center gap-0.5 min-w-[56px]">
          <User className={cn("h-5 w-5", isActive("/profile") || isActive("/auth") ? "text-primary" : "text-muted-foreground")} />
          <span className={cn("text-[10px] font-medium", isActive("/profile") ? "text-primary" : "text-muted-foreground")}>Профайл</span>
        </Link>
      </div>
    </nav>
  );
}
