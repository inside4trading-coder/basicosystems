import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Landing from "./pages/Landing";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import OperatorPortal from "@/pages/operario/OperatorPortal";
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
import SublimeMercancia from "./pages/sublime/SublimeMercancia";
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
import CoreProductImports from "./pages/core/CoreProductImports";
import CoreProductEditor from "./pages/core/CoreProductEditor";
import CoreWooCandidates from "./pages/core/CoreWooCandidates";
import CoreRestockControl from "./pages/core/CoreRestockControl";
import CoreFabricationFunds from "./pages/core/CoreFabricationFunds";
import CoreProductionNeeds from "./pages/core/CoreProductionNeeds";
import CoreProductionOrders from "./pages/core/CoreProductionOrders";
import CoreQRTravelSheets from "./pages/core/CoreQRTravelSheets";
import CoreScanning from "./pages/core/CoreScanning";
import CoreFactoryOperators from "./pages/core/CoreFactoryOperators";
import CorePayroll from "./pages/core/CorePayroll";
import CoreInventory from "./pages/core/CoreInventory";
import CoreDispatches from "./pages/core/CoreDispatches";
import CoreMercanciaTransito from "./pages/core/CoreMercanciaTransito";
import CoreReports from "./pages/core/CoreReports";
import CoreWooCoreMap from "./pages/core/CoreWooCoreMap";
import EspanaLayout from "./pages/espana/EspanaLayout";
import EspanaDashboard from "./pages/espana/EspanaDashboard";
import EspanaConfiguracion from "./pages/espana/EspanaConfiguracion";
import EspanaPlaceholder from "./pages/espana/EspanaPlaceholder";
import EspanaProductos from "./pages/espana/EspanaProductos";
import EspanaInventario from "./pages/espana/EspanaInventario";
import EspanaPOS from "./pages/espana/EspanaPOS";
import EspanaVentas from "./pages/espana/EspanaVentas";
import EspanaWooCommerce from "./pages/espana/EspanaWooCommerce";
import EspanaWooOrders from "./pages/espana/EspanaWooOrders";
import EspanaFabricacion from "./pages/espana/EspanaFabricacion";
import EspanaBlanksDTF from "./pages/espana/EspanaBlanksDTF";
import EspanaWooProblemas from "./pages/espana/EspanaWooProblemas";
import EspanaWooReclasificar from "./pages/espana/EspanaWooReclasificar";
import EspanaEtiquetas from "./pages/espana/EspanaEtiquetas";
import PosPublico from "./pages/pos-publico/PosPublico";
import FondoTransparente from "./pages/FondoTransparente";
import FuerzaVenezuela from "./pages/FuerzaVenezuela";
import EstudioVisual from "./pages/EstudioVisual";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const FUNDACION_HOSTS = new Set(["fundacionbasico.com", "www.fundacionbasico.com"]);
const isFundacionHost =
  typeof window !== "undefined" && FUNDACION_HOSTS.has(window.location.hostname);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route
              path="/"
              element={isFundacionHost ? <FuerzaVenezuela /> : <Landing />}
            />
            <Route path="/login" element={<Login />} />
            <Route path="/pos/:locationSlug/:publicToken" element={<PosPublico />} />
            <Route path="/operario" element={<OperatorPortal />} />
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
              <Route path="/sublime/mercancia" element={<SublimeMercancia />} />
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
                <Route path="productos/pendientes" element={<CoreWooCandidates />} />
                <Route path="productos/importaciones" element={<CoreProductImports />} />
                <Route path="productos/nuevo" element={<CoreProductEditor />} />
                <Route path="productos/:id" element={<CoreProductEditor />} />
                <Route path="control-reposicion" element={<CoreRestockControl />} />
                <Route path="mapa-woo-core" element={<CoreWooCoreMap />} />
                <Route path="partidas-fabricacion" element={<CoreFabricationFunds />} />
                <Route path="necesidades" element={<CoreProductionNeeds />} />
                <Route path="ordenes-produccion" element={<CoreProductionOrders />} />
                <Route path="qr" element={<CoreQRTravelSheets />} />
                <Route path="escaneo" element={<CoreScanning />} />
                <Route path="operarios" element={<CoreFactoryOperators />} />
                <Route path="nomina" element={<CorePayroll />} />
                <Route path="inventario" element={<CoreInventory />} />
                <Route path="despachos" element={<CoreDispatches />} />
                <Route path="mercancia-transito" element={<CoreMercanciaTransito />} />
                <Route path="reportes" element={<CoreReports />} />
              </Route>
              <Route path="/espana" element={<EspanaLayout />}>
                <Route index element={<EspanaDashboard />} />
                <Route path="configuracion" element={<EspanaConfiguracion />} />
                <Route path="reportes" element={<EspanaPlaceholder title="Reportes España" description="Ventas por canal, sede, método de pago, productos más vendidos, stock y fabricación pendiente." />} />
                <Route path="ventas" element={<EspanaVentas />} />
                <Route path="pos" element={<EspanaPOS />} />
                <Route path="woocommerce" element={<EspanaWooCommerce />} />
                <Route path="woocommerce/pedidos" element={<EspanaWooOrders />} />
                <Route path="woocommerce/problemas" element={<EspanaWooProblemas />} />
                <Route path="woocommerce/reclasificar" element={<EspanaWooReclasificar />} />
                <Route path="productos" element={<EspanaProductos />} />
                <Route path="inventario" element={<EspanaInventario />} />
                <Route path="fabricacion" element={<EspanaFabricacion />} />
                <Route path="blanks-dtf" element={<EspanaBlanksDTF />} />
                <Route path="etiquetas" element={<EspanaEtiquetas />} />
              </Route>
              <Route path="/fondo-transparente" element={<FondoTransparente />} />
              <Route path="/estudio-visual" element={<EstudioVisual />} />
            </Route>
            <Route path="/crew/incidencias" element={<CrewIncidencias />} />
            <Route path="/sublime/fichaje" element={<SublimeFichajePublico />} />
            <Route
              path="/fuerza-venezuela"
              element={isFundacionHost ? <Navigate to="/" replace /> : <FuerzaVenezuela />}
            />
            <Route path="*" element={<NotFound />} />

          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
