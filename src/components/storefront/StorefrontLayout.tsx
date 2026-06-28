import { Outlet, useLocation } from "react-router-dom";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { MobileBottomNav } from "./MobileBottomNav";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSeoDefaults } from "@/hooks/useSeoDefaults";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";

export function StorefrontLayout() {
  const isMobile = useIsMobile();
  const location = useLocation();
  const { data: seo } = useSeoDefaults();

  useDocumentMeta({
    title: seo?.siteTitle || "Онли",
    description: seo?.siteDescription,
    image: seo?.ogImage || undefined,
    url: `https://only.mn${location.pathname}`,
    type: "website",
  });

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {!isMobile && <Header />}
      <main className="flex-1 pb-16 md:pb-0">
        <Outlet />
      </main>
      <MobileBottomNav />
    </div>
  );
}
