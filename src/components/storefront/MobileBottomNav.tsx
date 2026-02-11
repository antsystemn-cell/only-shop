import { Link, useLocation } from "react-router-dom";
import { Home, Megaphone, LayoutGrid, Heart, ShoppingCart } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useOtCartSafe } from "@/contexts/OtCartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { UnifiedCartDrawer } from "@/components/storefront/UnifiedCartDrawer";

export function MobileBottomNav() {
  const location = useLocation();
  const { getItemCount } = useCart();
  const { itemCount: otItemCount } = useOtCartSafe();
  const { wishlistIds } = useWishlist();
  
  const cartCount = getItemCount() + otItemCount;
  const wishlistCount = wishlistIds.length;

  const navItems = [
    { href: "/", label: "Нүүр", icon: Home },
    { href: "/ot", label: "Маркет", icon: Megaphone },
    { href: "/categories", label: "Ангилал", icon: LayoutGrid, isCenter: true },
    { href: "/wishlist", label: "Таалагдсан", icon: Heart, badge: wishlistCount },
    { href: "cart-drawer", label: "Сагс", icon: ShoppingCart, badge: cartCount, isCartDrawer: true },
  ];

  const isActive = (href: string) => {
    if (href === "/") return location.pathname === "/";
    return location.pathname.startsWith(href);
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border safe-area-pb">
      <div className="flex items-end justify-around px-2 pt-2 pb-2">
        {navItems.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;

          if (item.isCenter) {
            // Center prominent button
            return (
              <Link
                key={item.href}
                to={item.href}
                className="flex flex-col items-center justify-center w-16 -mt-6"
              >
                <div className={cn(
                  "w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform",
                  "bg-primary text-primary-foreground",
                  "ring-4 ring-background",
                  active && "scale-110"
                )}>
                  <Icon className="h-6 w-6" />
                </div>
                <span className={cn(
                  "text-[10px] mt-1 font-medium",
                  active ? "text-primary" : "text-muted-foreground"
                )}>
                  {item.label}
                </span>
              </Link>
            );
          }

          // Cart drawer item
          if ((item as any).isCartDrawer) {
            return (
              <Sheet key="cart-drawer">
                <SheetTrigger asChild>
                  <button className="flex flex-col items-center justify-center gap-1 py-1 w-16 relative">
                    <div className="relative h-6 w-6 flex items-center justify-center">
                      <Icon className={cn("h-6 w-6 transition-colors text-muted-foreground")} />
                      {item.badge && item.badge > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center px-1">
                          {item.badge > 99 ? "99+" : item.badge}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {item.label}
                    </span>
                  </button>
                </SheetTrigger>
                <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">
                  <UnifiedCartDrawer />
                </SheetContent>
              </Sheet>
            );
          }

          return (
            <Link
              key={item.href}
              to={item.href}
              className="flex flex-col items-center justify-center gap-1 py-1 w-16 relative"
            >
              <div className="relative h-6 w-6 flex items-center justify-center">
                <Icon className={cn(
                  "h-6 w-6 transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                  item.href === "/wishlist" && wishlistCount > 0 && "text-red-500 fill-red-500"
                )} />
                {item.badge && item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center px-1">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </div>
              <span className={cn(
                "text-[10px] font-medium",
                active ? "text-primary" : "text-muted-foreground"
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
