import { Link } from "react-router-dom";
import { ShoppingCart, Search, Menu, X, User, LogOut, Heart } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/contexts/CartContext";
import { useOtCart } from "@/contexts/OtCartContext";
import { useAuth } from "@/contexts/AuthContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { OtCartDrawer } from "./OtCartDrawer";
import HeaderSearch from "./HeaderSearch";
import onlyLogo from "@/assets/only-logo.png";
import { toast } from "sonner";
export function Header() {
  const { getItemCount } = useCart();
  const { itemCount: otItemCount } = useOtCart();
  const { user, signOut, isLoading } = useAuth();
  const { wishlistIds } = useWishlist();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const itemCount = getItemCount() + otItemCount;
  const wishlistCount = wishlistIds.length;
  const handleSignOut = async () => {
    await signOut();
    toast.success("Амжилттай гарлаа");
  };
  const navLinks = [{
    href: "/",
    label: "Нүүр"
  }, {
    href: "/ot",
    label: "Маркетплэйс"
  }, {
    href: "/shop",
    label: "Дэлгүүр"
  }, {
    href: "/categories",
    label: "Ангилал"
  }];
  return <header className="sticky top-0 z-50 w-full border-b backdrop-blur bg-secondary">
      <div className="container flex h-16 items-center justify-between gap-4 bg-secondary">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <img src={onlyLogo} alt="Only" className="h-10 w-auto" />
          
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map(link => <Link key={link.href} to={link.href} className="text-sm font-medium transition-colors text-secondary-foreground">
              {link.label}
            </Link>)}
        </nav>

        {/* Search - Desktop */}
        <div className="hidden md:flex flex-1 max-w-lg">
          <HeaderSearch />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Search Toggle - Mobile */}
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setIsSearchOpen(!isSearchOpen)}>
            {isSearchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
          </Button>

          {/* Wishlist */}
          <Link to="/wishlist">
            <Button variant="ghost" size="icon" className="relative">
              <Heart className={`h-5 w-5 ${wishlistCount > 0 ? "text-red-500 fill-red-500" : ""}`} />
              {wishlistCount > 0 && <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-xs font-bold text-white flex items-center justify-center">
                  {wishlistCount > 99 ? "99+" : wishlistCount}
                </span>}
            </Button>
          </Link>

          {/* User Menu */}
          {!isLoading && <>
              {user ? <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <User className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <div className="px-2 py-1.5 text-sm font-medium truncate">
                      {user.email}
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/profile">Миний профайл</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/ot/orders">OT Захиалгууд</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/wallet">Данс / Wallet</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/favourite-vendors">Дуртай борлуулагчид</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/delivery-calculator">Хүргэлтийн тооцоолуур</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/support">Дэмжлэг</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/orders">Дотоод захиалгууд</Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                      <LogOut className="h-4 w-4 mr-2" />
                      Гарах
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu> : <Button variant="ghost" size="sm" asChild className="hidden sm:flex">
                  <Link to="/auth">Нэвтрэх</Link>
                </Button>}
            </>}

          {/* Cart */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <ShoppingCart className="h-5 w-5" />
                {itemCount > 0 && <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-xs font-bold text-primary-foreground flex items-center justify-center">
                    {itemCount > 99 ? "99+" : itemCount}
                  </span>}
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-lg">
              <OtCartDrawer />
            </SheetContent>
          </Sheet>

          {/* Mobile Menu */}
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Mobile Search */}
      {isSearchOpen && <div className="border-t p-4 md:hidden animate-fade-in">
          <HeaderSearch autoFocus onSearchComplete={() => setIsSearchOpen(false)} />
        </div>}

      {/* Mobile Navigation */}
      {isMobileMenuOpen && <nav className="border-t p-4 md:hidden animate-fade-in">
          <div className="flex flex-col gap-2">
            {navLinks.map(link => <Link key={link.href} to={link.href} className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors" onClick={() => setIsMobileMenuOpen(false)}>
                {link.label}
              </Link>)}
            <Link to="/wishlist" className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors flex items-center gap-2" onClick={() => setIsMobileMenuOpen(false)}>
              <Heart className={`h-4 w-4 ${wishlistCount > 0 ? "text-red-500 fill-red-500" : ""}`} />
              Хүслийн жагсаалт
              {wishlistCount > 0 && <span className="ml-auto bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{wishlistCount}</span>}
            </Link>
            {!user && <Link to="/auth" className="px-4 py-2 text-sm font-medium text-primary hover:bg-muted rounded-lg transition-colors" onClick={() => setIsMobileMenuOpen(false)}>
                Нэвтрэх / Бүртгүүлэх
              </Link>}
            {user && <>
                <Link to="/profile" className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors" onClick={() => setIsMobileMenuOpen(false)}>
                  Миний профайл
                </Link>
                <Link to="/ot/orders" className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors" onClick={() => setIsMobileMenuOpen(false)}>
                  OT Захиалгууд
                </Link>
                <Link to="/wallet" className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors" onClick={() => setIsMobileMenuOpen(false)}>
                  Данс / Wallet
                </Link>
                <Link to="/favourite-vendors" className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors" onClick={() => setIsMobileMenuOpen(false)}>
                  Дуртай борлуулагчид
                </Link>
                <Link to="/delivery-calculator" className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors" onClick={() => setIsMobileMenuOpen(false)}>
                  Хүргэлтийн тооцоолуур
                </Link>
                <Link to="/support" className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors" onClick={() => setIsMobileMenuOpen(false)}>
                  Дэмжлэг
                </Link>
                <Link to="/orders" className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors" onClick={() => setIsMobileMenuOpen(false)}>
                  Дотоод захиалгууд
                </Link>
                <button className="px-4 py-2 text-sm font-medium text-destructive hover:bg-muted rounded-lg transition-colors text-left" onClick={() => {
            handleSignOut();
            setIsMobileMenuOpen(false);
          }}>
                  Гарах
                </button>
              </>}
          </div>
        </nav>}
    </header>;
}