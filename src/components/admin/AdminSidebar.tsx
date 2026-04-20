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
  DollarSign,
  Megaphone,
  FileText,
  Settings,
  ChevronDown,
  Star,
  Activity,
  Shield,
  MessageSquare,
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

interface MenuItem {
  title: string;
  url: string;
  icon: React.ElementType;
}

interface MenuGroup {
  label: string;
  items: MenuItem[];
  defaultOpen?: boolean;
}

const menuGroups: MenuGroup[] = [
  {
    label: "Ерөнхий",
    defaultOpen: true,
    items: [
      { title: "Хянах самбар", url: "/admin", icon: LayoutDashboard },
    ],
  },
  {
    label: "Захиалга",
    defaultOpen: true,
    items: [
      { title: "Борлуулалт", url: "/admin/sales", icon: ShoppingCart },
      { title: "Захиалга удирдах", url: "/admin/orders", icon: ShoppingCart },
      { title: "Хүргэлт & Үйл ажиллагаа", url: "/admin/delivery-ops", icon: Truck },
    ],
  },
  {
    label: "Бэлэн бараа",
    defaultOpen: true,
    items: [
      { title: "Бараа удирдах", url: "/admin/products", icon: Package },
      { title: "Ангилал", url: "/admin/categories", icon: FolderTree },
      { title: "Брэнд удирдах", url: "/admin/brands", icon: Tags },
      { title: "Хүргэлтийн тохиргоо", url: "/admin/delivery", icon: Truck },
      { title: "Үнийн удирдлага", url: "/admin/pricing", icon: DollarSign },
      { title: "Сэтгэгдэл & Үнэлгээ", url: "/admin/reviews", icon: Star },
    ],
  },
  {
    label: "Контент",
    items: [
      { title: "Хуудсууд", url: "/admin/content", icon: FileText },
      { title: "Баннер удирдах", url: "/admin/banners", icon: Image },
      { title: "SEO тохиргоо", url: "/admin/seo", icon: Megaphone },
      { title: "Мэдээллийн товхимол", url: "/admin/newsletter", icon: Megaphone },
    ],
  },
  {
    label: "Хэрэглэгч",
    items: [
      { title: "Хэрэглэгчид", url: "/admin/users", icon: Users },
      { title: "Админууд & Эрх", url: "/admin/permissions", icon: Users },
    ],
  },
  {
    label: "Мониторинг & Лог",
    items: [
      { title: "Хэрэглэгчийн лог", url: "/admin/user-activity-log", icon: Users },
    ],
  },
  {
    label: "Тохиргоо",
    items: [
      { title: "Ерөнхий тохиргоо", url: "/admin/settings", icon: Settings },
      { title: "Үндсэн SEO тохиргоо", url: "/admin/settings-seo", icon: Megaphone },
      { title: "PWA тохиргоо", url: "/admin/pwa-settings", icon: Megaphone },
      { title: "Нэвтрэлтийн тохиргоо", url: "/admin/auth-settings", icon: Shield },
      { title: "SMS Gateway", url: "/admin/sms-gateway", icon: MessageSquare },
      { title: "Захиалгын тохиргоо", url: "/admin/settings-orders", icon: Settings },
      { title: "Системийн хэрэгсэл", url: "/admin/system-tools", icon: Activity },
    ],
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
    if (path === "/admin") return location.pathname === "/admin";
    return location.pathname.startsWith(path);
  };

  const isGroupActive = (group: MenuGroup) =>
    group.items.some((item) => isActive(item.url));

  return (
    <Sidebar className="border-r-0" collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <img src={onlyLogo} alt="Only Logo" className="w-10 h-10 object-contain shrink-0" />
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-bold text-lg text-sidebar-foreground">Only</span>
              <span className="text-xs text-sidebar-foreground/60">Админ самбар</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="overflow-y-auto">
        {menuGroups.map((group) => (
          <Collapsible
            key={group.label}
            defaultOpen={group.defaultOpen || isGroupActive(group)}
          >
            <SidebarGroup>
              <CollapsibleTrigger className="w-full">
                <SidebarGroupLabel className="text-sidebar-foreground/50 flex items-center justify-between cursor-pointer hover:text-sidebar-foreground/80 transition-colors">
                  {!collapsed && group.label}
                  {!collapsed && <ChevronDown className="h-3 w-3" />}
                </SidebarGroupLabel>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => (
                      <SidebarMenuItem key={item.url}>
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
                            {!collapsed && <span className="text-sm">{item.title}</span>}
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        ))}
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
