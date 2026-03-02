import { Outlet, useLocation } from "react-router-dom";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { MobileBottomNav } from "./MobileBottomNav";
import { ProviderStrip } from "./ProviderStrip";
import { useIsMobile } from "@/hooks/use-mobile";

export function StorefrontLayout() {
  const isMobile = useIsMobile();
  const location = useLocation();

  // Hide header on mobile for pages that have their own search
  const isHomePage = location.pathname === "/";
  const isProviderPage = location.pathname.startsWith("/ot/provider/");
  const hideHeader = isMobile && (isHomePage || isProviderPage);

  return (
    <div className="min-h-screen flex flex-col">
      {!hideHeader && <Header />}
      <ProviderStrip />
      <main className="flex-1 pb-20 md:pb-0">
        <Outlet />
      </main>
      <Footer />
      <MobileBottomNav />
    </div>
  );
}
