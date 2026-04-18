import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
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
import RRPP from "./pages/RRPP";
import RRPPProfile from "./pages/RRPPProfile";
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
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
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
              <Route path="/crew/:id" element={<CrewProfile />} />
              <Route path="/rrpp" element={<RRPP />} />
              <Route path="/rrpp/:id" element={<RRPPProfile />} />
              <Route path="/campaigns" element={<Campaigns />} />
              <Route path="/campaigns/new" element={<CampaignWizard />} />
              <Route path="/campaigns/:id" element={<CampaignDetail />} />
              <Route path="/llamadas" element={<Llamadas />} />
              <Route path="/configuracion" element={<Configuracion />} />
            </Route>
            <Route path="/crew/incidencias" element={<CrewIncidencias />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
