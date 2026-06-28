import { Link } from "react-router-dom";
import { ShoppingCart, Search, User, LogOut, Heart, Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CartDrawer } from "./CartDrawer";
import HeaderSearch from "./HeaderSearch";
import onlyLogo from "@/assets/only-logo.png";
import { toast } from "sonner";

export function Header() {
  const { getItemCount } = useCart();
  const { user, signOut, isLoading } = useAuth();
  const { wishlistIds } = useWishlist();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const itemCount = getItemCount();
  const wishlistCount = wishlistIds.length;

  const handleSignOut = async () => {
    await signOut();
    toast.success("Амжилттай гарлаа");
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-card shadow-sm">
      <div className="container flex h-14 items-center justify-between gap-3">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <img src={onlyLogo} alt="Only" className="h-8 w-auto" />
        </Link>

        {/* Spacer */}
        <div className="flex-1" />


        {/* Action Icons */}
        <div className="flex items-center gap-1">
          {/* Wishlist */}
          <Link to="/wishlist">
            <Button variant="ghost" size="icon" className="relative rounded-full h-9 w-9">
              <Heart className={`h-5 w-5 ${wishlistCount > 0 ? "text-destructive fill-destructive" : "text-muted-foreground"}`} />
              {wishlistCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground flex items-center justify-center">
                  {wishlistCount > 99 ? "99+" : wishlistCount}
                </span>
              )}
            </Button>
          </Link>

          {/* Cart */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="relative rounded-full h-9 w-9">
                <ShoppingCart className="h-5 w-5 text-muted-foreground" />
                {itemCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary text-[10px] font-bold text-primary-foreground flex items-center justify-center">
                    {itemCount > 99 ? "99+" : itemCount}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-lg">
              <CartDrawer />
            </SheetContent>
          </Sheet>

          {/* Profile */}
          {!isLoading && (
            <>
              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="rounded-full h-9 w-9">
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <div className="px-2 py-1.5 text-sm font-medium truncate">{user.email}</div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild><Link to="/profile">Миний профайл</Link></DropdownMenuItem>
                    <DropdownMenuItem asChild><Link to="/orders">Миний захиалгууд</Link></DropdownMenuItem>
                    <DropdownMenuItem asChild><Link to="/wallet">Данс / Wallet</Link></DropdownMenuItem>
                    <DropdownMenuItem asChild><Link to="/support">Тусламж</Link></DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                      <LogOut className="h-4 w-4 mr-2" />
                      Гарах
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button variant="ghost" size="sm" asChild className="hidden md:flex rounded-full text-sm">
                  <Link to="/auth">Нэвтрэх</Link>
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
