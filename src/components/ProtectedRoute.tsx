import { Navigate, useLocation } from "react-router-dom";
import { useAuth, canAccessRoute, defaultRouteForRole } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Mail, ShieldAlert, LogOut } from "lucide-react";
import basicoLogo from "@/assets/basico-logo.png";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, role, loading, signOut } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // User is authenticated but has no role assigned → pending approval
  if (!role) {
    const handleLogout = async () => {
      await signOut();
    };
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary px-4">
        <div className="max-w-md w-full bg-card border border-border rounded-lg shadow-lg p-8 text-center animate-fade-in">
          <div className="flex justify-center mb-6">
            <img src={basicoLogo} alt="Basico" className="h-12 w-auto" />
          </div>
          <div className="flex justify-center mb-4">
            <div className="h-14 w-14 rounded-full bg-status-warning/15 flex items-center justify-center">
              <ShieldAlert className="h-7 w-7 text-status-warning" />
            </div>
          </div>
          <h1 className="text-xl font-black tracking-tight mb-2">
            Cuenta pendiente de aprobación
          </h1>
          <p className="text-sm text-muted-foreground mb-1">
            Tu cuenta se creó correctamente, pero aún no tiene permisos asignados.
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            Contacta a un administrador para que te dé acceso al sistema.
          </p>
          <div className="bg-muted rounded-md px-3 py-2 mb-6 inline-flex items-center gap-2 text-xs">
            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-mono">{user.email}</span>
          </div>
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </Button>
        </div>
      </div>
    );
  }

  // Role-based route guard
  if (!canAccessRoute(role, location.pathname)) {
    return <Navigate to={defaultRouteForRole(role)} replace />;
  }

  return <>{children}</>;
}
