import { BarChart3, Package, Users, Users2, ClipboardList, Mail, Phone, Settings, LogOut, Star } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import basicoLogo from "@/assets/basico-logo.png";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const mainItems = [
  { title: "Dashboard", url: "/dashboard", icon: BarChart3 },
  { title: "Pedidos", url: "/pedidos", icon: Package },
  { title: "CRM", url: "/crm", icon: Users },
  { title: "Planning", url: "/planning", icon: ClipboardList },
  { title: "Crew", url: "/crew", icon: Users2, adminOnly: true },
  { title: "RRPP", url: "/rrpp", icon: Star, roles: ["admin", "rrpp", "marketing"] },
  { title: "Campaigns", url: "/campaigns", icon: Mail },
  { title: "Llamadas", url: "/llamadas", icon: Phone },
];

const adminItems = [
  { title: "Configuración", url: "/configuracion", icon: Settings },
];

export function AppSidebar({ userRole }: { userRole?: string }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const showAdmin = userRole === "admin";
  const visibleItems = mainItems.filter(i => {
    if ((i as any).adminOnly && userRole !== "admin") return false;
    if ((i as any).roles && !(i as any).roles.includes(userRole)) return false;
    if (userRole === "partner") return ["/dashboard", "/planning"].includes(i.url);
    return true;
  });

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <div className="p-4 flex items-center justify-center border-b border-sidebar-border">
        {collapsed ? (
          <span className="text-sidebar-primary font-black text-lg">B</span>
        ) : (
          <img src={basicoLogo} alt="Basico" className="h-10 w-auto" />
        )}
      </div>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className="hover:bg-sidebar-accent/50 rounded-md transition-colors"
                      activeClassName="bg-sidebar-primary text-sidebar-primary-foreground font-semibold"
                    >
                      <item.icon className="mr-3 h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {showAdmin && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end
                        className="hover:bg-sidebar-accent/50 rounded-md transition-colors"
                        activeClassName="bg-sidebar-primary text-sidebar-primary-foreground font-semibold"
                      >
                        <item.icon className="mr-3 h-4 w-4 shrink-0" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleLogout}
              className="hover:bg-sidebar-accent/50 rounded-md text-sidebar-foreground/70"
            >
              <LogOut className="mr-3 h-4 w-4 shrink-0" />
              {!collapsed && <span>Cerrar sesión</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
