import { Outlet, useLocation } from "react-router-dom";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { MobileBottomNav } from "./MobileBottomNav";
import { ProviderStrip } from "./ProviderStrip";
import { useIsMobile } from "@/hooks/use-mobile";

export function StorefrontLayout() {
  const isMobile = useIsMobile();
  const location = useLocation();

  // Hide header on mobile for home page (/) - home has its own search
  const isHomePage = location.pathname === "/";
  const hideHeader = isMobile && isHomePage;

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
