import { useEffect, useState } from "react";
import { BarChart3, Package, Users, Users2, ClipboardList, Mail, Phone, Settings, LogOut, Star, Building2, Store, Factory, Flag, HeartHandshake } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useNavigate } from "react-router-dom";
import { useAuth, canAccessRoute, subscribeRoleRoutes, type ProfileRole } from "@/hooks/useAuth";
import basicoLogo from "@/assets/basico-logo.png";
import { InstallAppButton } from "@/components/InstallAppButton";

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
  { title: "Resumen de ventas", url: "/dashboard", icon: BarChart3 },
  { title: "Pedidos", url: "/pedidos", icon: Package },
  { title: "Administración", url: "/administracion", icon: Building2 },
  { title: "Crew", url: "/crew", icon: Users2 },
  { title: "Planificación", url: "/planning", icon: ClipboardList },
  { title: "RRPP", url: "/rrpp", icon: Star },
  { title: "Llamadas", url: "/llamadas", icon: Phone },
  { title: "Campañas", url: "/campaigns", icon: Mail },
  { title: "CRM", url: "/crm", icon: Users },
  { title: "Sublime", url: "/sublime", icon: Store },
  { title: "Basico Core", url: "/core", icon: Factory },
  { title: "Basico España", url: "/espana", icon: Flag },
  { title: "Fondo Transparente", url: "/fondo-transparente", icon: HeartHandshake },
];

const adminItems = [
  { title: "Configuración", url: "/configuracion", icon: Settings },
];

export function AppSidebar({ userRole }: { userRole?: string }) {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [, force] = useState(0);

  // Re-render when role permissions change
  useEffect(() => {
    const unsub = subscribeRoleRoutes(() => force((n) => n + 1));
    return () => { unsub; };
  }, []);

  const showAdmin = userRole === "admin";
  const role = (userRole as ProfileRole | undefined) ?? null;
  const visibleItems = mainItems.filter((i) => canAccessRoute(role, i.url));


  const handleNavClick = () => {
    if (isMobile) setOpenMobile(false);
  };

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
            <InstallAppButton collapsed={collapsed} />
          </SidebarMenuItem>
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
