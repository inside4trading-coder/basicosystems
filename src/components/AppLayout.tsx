import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";

export function AppLayout() {
  const { role } = useAuth();
  const userRole = role ?? "partner";
  const location = useLocation();
  const isModule = (p: string) => p.startsWith("/core") || p.startsWith("/espana");
  const [open, setOpen] = useState(!isModule(location.pathname));

  useEffect(() => {
    setOpen(!isModule(location.pathname));
  }, [location.pathname]);

  return (
    <SidebarProvider open={open} onOpenChange={setOpen}>
      <div className="min-h-screen flex w-full">
        <AppSidebar userRole={userRole} />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b border-border bg-card px-3 sm:px-4 shrink-0">
            <SidebarTrigger className="mr-2 sm:mr-4" />
            <h1 className="text-xs sm:text-sm font-bold uppercase tracking-wide text-foreground truncate">
              Basico System
            </h1>
          </header>
          <main className="flex-1 overflow-auto p-3 sm:p-4 md:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
