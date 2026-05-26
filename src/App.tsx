import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Landing from "./pages/Landing";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Pedidos from "./pages/Pedidos";
import CRM from "./pages/CRM";
import Planning from "./pages/Planning";
import Campaigns from "./pages/Campaigns";
import CampaignWizard from "./pages/CampaignWizard";
import CampaignDetail from "./pages/CampaignDetail";
import Configuracion from "./pages/Configuracion";
import Llamadas from "./pages/Llamadas";
import Crew from "./pages/Crew";
import CrewProfile from "./pages/CrewProfile";
import CrewIncidencias from "./pages/CrewIncidencias";
import CrewRecurringTasksOverview from "./pages/CrewRecurringTasksOverview";
import RRPP from "./pages/RRPP";
import RRPPProfile from "./pages/RRPPProfile";
import Administracion from "./pages/Administracion";
import AdminObligationDetail from "./pages/AdminObligationDetail";
import SublimeFichajePublico from "./pages/SublimeFichajePublico";
import Sublime from "./pages/Sublime";
import SublimeAdminFichaje from "./pages/SublimeAdminFichaje";
import { AdminScopeProvider } from "@/contexts/AdminScope";
import CoreLayout from "./pages/core/CoreLayout";
import CoreDashboard from "./pages/core/CoreDashboard";
import CoreConfiguracion from "./pages/core/CoreConfiguracion";
import CorePlaceholder from "./pages/core/CorePlaceholder";
import CoreRawMaterials from "./pages/core/CoreRawMaterials";
import CoreImportTemplates from "./pages/core/CoreImportTemplates";
import CoreCostStructures from "./pages/core/CoreCostStructures";
import CoreCostStructureEditor from "./pages/core/CoreCostStructureEditor";
import CoreCostTemplates from "./pages/core/CoreCostTemplates";
import CoreCostTemplateEditor from "./pages/core/CoreCostTemplateEditor";
import CoreProducts from "./pages/core/CoreProducts";
import CoreProductEditor from "./pages/core/CoreProductEditor";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/pedidos" element={<Pedidos />} />
              <Route path="/crm" element={<CRM />} />
              <Route path="/planning" element={<Planning />} />
              <Route path="/crew" element={<Crew />} />
              <Route path="/crew/tareas-recurrentes" element={<CrewRecurringTasksOverview />} />
              <Route path="/crew/:id" element={<CrewProfile />} />
              <Route path="/rrpp" element={<RRPP />} />
              <Route path="/rrpp/:id" element={<RRPPProfile />} />
              <Route path="/campaigns" element={<Campaigns />} />
              <Route path="/campaigns/new" element={<CampaignWizard />} />
              <Route path="/campaigns/:id" element={<CampaignDetail />} />
              <Route path="/llamadas" element={<Llamadas />} />
              <Route path="/administracion" element={<Administracion />} />
              <Route path="/administracion/:id" element={<AdminObligationDetail />} />
              <Route path="/configuracion" element={<Configuracion />} />
              <Route path="/sublime" element={<Sublime />} />
              <Route path="/sublime/admin/fichaje" element={<SublimeAdminFichaje />} />
              <Route
                path="/sublime/admin/obligaciones"
                element={
                  <AdminScopeProvider scope="sublime">
                    <Administracion />
                  </AdminScopeProvider>
                }
              />
              <Route
                path="/sublime/admin/obligaciones/:id"
                element={
                  <AdminScopeProvider scope="sublime">
                    <AdminObligationDetail />
                  </AdminScopeProvider>
                }
              />
              <Route path="/core" element={<CoreLayout />}>
                <Route index element={<CoreDashboard />} />
                <Route path="configuracion" element={<CoreConfiguracion />} />
                <Route path="materia-prima" element={<CoreRawMaterials />} />
                <Route path="templates-carga" element={<CoreImportTemplates />} />
                <Route path="estructuras-costos" element={<CoreCostStructures />} />
                <Route path="estructuras-costos/nueva" element={<CoreCostStructureEditor />} />
                <Route path="estructuras-costos/:id" element={<CoreCostStructureEditor />} />
                <Route path="templates-costos" element={<CoreCostTemplates />} />
                <Route path="templates-costos/nuevo" element={<CoreCostTemplateEditor />} />
                <Route path="templates-costos/:id" element={<CoreCostTemplateEditor />} />
                <Route path="productos" element={<CoreProducts />} />
                <Route path="productos/nuevo" element={<CoreProductEditor />} />
                <Route path="productos/:id" element={<CoreProductEditor />} />
                <Route path="partidas-fabricacion" element={<CorePlaceholder title="Partidas de Fabricación" />} />
                <Route path="necesidades" element={<CorePlaceholder title="Necesidades de Producción" />} />
                <Route path="ordenes-produccion" element={<CorePlaceholder title="Órdenes de Producción" />} />
                <Route path="qr" element={<CorePlaceholder title="QR / Ficha Viajera" description="Generación e impresión 57×40 mm." />} />
                <Route path="escaneo" element={<CorePlaceholder title="Escaneo" description="Escaneo móvil con cámara." />} />
                <Route path="nomina" element={<CorePlaceholder title="Nómina" description="Cierre semanal y pagos." />} />
                <Route path="inventario" element={<CorePlaceholder title="Inventario" description="Movimientos y sincronización con WooCommerce." />} />
                <Route path="reportes" element={<CorePlaceholder title="Reportes" />} />
              </Route>
            </Route>
            <Route path="/crew/incidencias" element={<CrewIncidencias />} />
            <Route path="/sublime/fichaje" element={<SublimeFichajePublico />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
