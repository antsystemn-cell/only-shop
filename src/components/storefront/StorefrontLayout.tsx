import { Outlet } from "react-router-dom";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { MobileBottomNav } from "./MobileBottomNav";

export function StorefrontLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 pb-20 md:pb-0">
        <Outlet />
      </main>
      <Footer />
      <MobileBottomNav />
    </div>
  );
}
