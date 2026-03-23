import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import basicoLogo from "@/assets/basico-logo.png";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // TODO: integrate with Supabase auth
    setTimeout(() => {
      setLoading(false);
      navigate("/dashboard");
    }, 800);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary">
      <div
        className="w-full max-w-sm animate-fade-in"
        style={{ animationDelay: "0.1s" }}
      >
        <div className="bg-card rounded-lg shadow-xl p-8 border border-border">
          <div className="flex justify-center mb-8">
            <img src={basicoLogo} alt="Basico" className="h-14 w-auto" />
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@basicoclothes.es"
                required
                className="bg-background"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Contraseña
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="bg-background"
              />
            </div>

            <Button
              type="submit"
              variant="brand"
              size="lg"
              className="w-full"
              disabled={loading}
            >
              {loading ? "Entrando..." : "Iniciar sesión"}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground mt-6">
            Basico Systems — Panel de gestión
          </p>
        </div>
      </div>
    </div>
  );
}
