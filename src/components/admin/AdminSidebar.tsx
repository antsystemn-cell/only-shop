import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  FolderTree,
  ShoppingCart,
  Users,
  Truck,
  Image,
  LogOut,
  Tags,
} from "lucide-react";
import onlyLogo from "@/assets/only-logo.png";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const menuItems = [
  {
    title: "Хянах самбар",
    url: "/admin",
    icon: LayoutDashboard,
  },
  {
    title: "Бараа удирдах",
    url: "/admin/products",
    icon: Package,
  },
  {
    title: "Ангилал удирдах",
    url: "/admin/categories",
    icon: FolderTree,
  },
  {
    title: "Брэнд удирдах",
    url: "/admin/brands",
    icon: Tags,
  },
  {
    title: "Захиалга харах",
    url: "/admin/orders",
    icon: ShoppingCart,
  },
  {
    title: "Хэрэглэгч харах",
    url: "/admin/users",
    icon: Users,
  },
  {
    title: "Хүргэлтийн тохиргоо",
    url: "/admin/delivery",
    icon: Truck,
  },
  {
    title: "Баннер удирдах",
    url: "/admin/banners",
    icon: Image,
  },
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin/login");
  };

  const isActive = (path: string) => {
    if (path === "/admin") {
      return location.pathname === "/admin";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <Sidebar className="border-r-0" collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <img 
            src={onlyLogo} 
            alt="Only Logo" 
            className="w-10 h-10 object-contain shrink-0"
          />
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-bold text-lg text-sidebar-foreground">Only</span>
              <span className="text-xs text-sidebar-foreground/60">Админ самбар</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50">
            Үндсэн цэс
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                  >
                    <NavLink
                      to={item.url}
                      end={item.url === "/admin"}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                        isActive(item.url)
                          ? "bg-sidebar-primary text-sidebar-primary-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent"
                      )}
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-destructive"
          onClick={handleLogout}
        >
          <LogOut className="h-5 w-5" />
          {!collapsed && <span>Гарах</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
