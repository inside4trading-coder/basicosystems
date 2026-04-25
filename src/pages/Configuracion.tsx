import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, UserPlus, Upload, Loader2, FileSpreadsheet, Lock, Users2, ShieldCheck } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { RRPPConfigSection } from "@/components/rrpp/RRPPConfigSection";
import { AdminConfigSection } from "@/components/admin/AdminConfigSection";
import { UserRolesPanel } from "@/components/configuracion/UserRolesPanel";
import { RolePermissionsPanel } from "@/components/configuracion/RolePermissionsPanel";


const integrations = [
  { name: "WooCommerce", description: "basicoclothes.es — Pedidos, CRM, Dashboard", connected: true },
  { name: "Brevo", description: "Email marketing — Campañas", connected: true },
  { name: "Notion", description: "Planning — Calendario editorial", connected: true },
  { name: "Zadarma", description: "Telefonía — Analítica de llamadas", connected: true },
];

interface CostRow {
  sku: string;
  product_name: string;
  analytic_category: string;
  collection: string;
  unit_cost_total: number;
  suggested_price: number | null;
}

export default function Configuracion() {
  const [csvData, setCsvData] = useState<CostRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split("\n").filter(l => l.trim());
      if (lines.length < 2) { toast.error("CSV vacío"); return; }

      const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
      const skuIdx = headers.indexOf("sku");
      const nameIdx = headers.indexOf("product_name");
      const catIdx = headers.indexOf("analytic_category");
      const colIdx = headers.indexOf("collection");
      const costIdx = headers.indexOf("unit_cost_total");
      const priceIdx = headers.indexOf("suggested_price");

      if (skuIdx === -1 || costIdx === -1) {
        toast.error("El CSV debe tener columnas: sku, unit_cost_total");
        return;
      }

      const rows: CostRow[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map(c => c.trim());
        if (!cols[skuIdx]) continue;
        rows.push({
          sku: cols[skuIdx],
          product_name: cols[nameIdx] || "",
          analytic_category: cols[catIdx] || "",
          collection: cols[colIdx] || "",
          unit_cost_total: parseFloat(cols[costIdx] || "0"),
          suggested_price: priceIdx >= 0 && cols[priceIdx] ? parseFloat(cols[priceIdx]) : null,
        });
      }

      setCsvData(rows);
      setShowPreview(true);
    };
    reader.readAsText(file);
  };

  const handleUpload = async () => {
    if (csvData.length === 0) return;
    setUploading(true);
    try {
      const rows = csvData.map(r => ({
        ...r,
        updated_at: new Date().toISOString(),
      }));
      const { error } = await supabase.from("product_costs").upsert(rows, { onConflict: "sku" });
      if (error) throw new Error(error.message);
      toast.success(`${rows.length} productos actualizados`);
      setCsvData([]);
      setShowPreview(false);
      if (fileRef.current) fileRef.current.value = "";
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 max-w-4xl">
      <h2 className="text-xl sm:text-2xl font-black tracking-tight">Configuración</h2>

      {/* Users — gestión real de roles */}
      <UserRolesPanel />

      {/* Permissions matrix — admin only */}
      <RolePermissionsPanel />

      {/* Integrations */}
      <section className="animate-fade-in" style={{ animationDelay: "0.1s" }}>
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Integraciones</h3>
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          {integrations.map((integ) => (
            <div key={integ.name} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-4 border-b border-border last:border-0">
              <div className="flex items-center gap-3 min-w-0">
                {integ.connected ? <CheckCircle className="h-5 w-5 text-status-success shrink-0" /> : <XCircle className="h-5 w-5 text-status-error shrink-0" />}
                <div className="min-w-0">
                  <p className="font-bold text-sm">{integ.name}</p>
                  <p className="text-xs text-muted-foreground">{integ.description}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="w-full sm:w-auto shrink-0">Probar conexión</Button>
            </div>
          ))}
        </div>
      </section>

      {/* Product Costs Upload */}
      <section className="animate-fade-in" style={{ animationDelay: "0.2s" }}>
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Costos de producto</h3>
        <div className="bg-card rounded-lg border border-border p-5 space-y-4">
          <p className="text-sm text-muted-foreground">
            Sube un CSV con columnas: <code className="text-xs bg-muted px-1 py-0.5 rounded font-mono">sku, product_name, analytic_category, collection, unit_cost_total, suggested_price</code>
          </p>
          <div className="flex items-center gap-3">
            <input ref={fileRef} type="file" accept=".csv" onChange={handleFileSelect} className="hidden" />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="gap-2">
              <FileSpreadsheet className="h-4 w-4" /> Seleccionar CSV
            </Button>
            {csvData.length > 0 && (
              <span className="text-xs text-muted-foreground">{csvData.length} filas cargadas</span>
            )}
          </div>

          {showPreview && csvData.length > 0 && (
            <div className="space-y-3">
              <div className="max-h-60 overflow-auto border border-border rounded-md">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted">
                    <tr>
                      <th className="text-left px-3 py-2 font-bold">SKU</th>
                      <th className="text-left px-3 py-2 font-bold">Producto</th>
                      <th className="text-left px-3 py-2 font-bold">Categoría</th>
                      <th className="text-right px-3 py-2 font-bold">Costo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {csvData.slice(0, 20).map((r) => (
                      <tr key={r.sku} className="border-t border-border/50">
                        <td className="px-3 py-1.5 font-mono">{r.sku}</td>
                        <td className="px-3 py-1.5">{r.product_name}</td>
                        <td className="px-3 py-1.5 capitalize">{r.analytic_category || "—"}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">${r.unit_cost_total.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {csvData.length > 20 && (
                <p className="text-xs text-muted-foreground">Mostrando 20 de {csvData.length} filas</p>
              )}
              <div className="flex gap-3">
                <Button size="sm" onClick={handleUpload} disabled={uploading} className="gap-2">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {uploading ? "Subiendo…" : "Importar costos"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setCsvData([]); setShowPreview(false); }}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Crew Section */}
      <section className="animate-fade-in" style={{ animationDelay: "0.3s" }}>
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
          <Users2 className="h-4 w-4" />Crew
        </h3>
        <div className="bg-card rounded-lg border border-border divide-y divide-border">
          {/* Passcode */}
          <CrewPasscodeConfig />
          {/* Permissions info */}
          <div className="p-5">
            <div className="flex items-start gap-3">
              <ShieldCheck className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-sm">Permisos de acceso</p>
                <p className="text-xs text-muted-foreground">
                  El módulo Crew es exclusivo para administradores. Los usuarios con rol <span className="font-semibold">partner</span> o <span className="font-semibold">manager</span> no tienen acceso.
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="status-badge-success">Admin — Acceso total</span>
                  <span className="status-badge-inactive">Manager — Sin acceso</span>
                  <span className="status-badge-inactive">Partner — Sin acceso</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* RRPP Configuration */}
      <RRPPConfigSection />

      {/* Administración Configuration */}
      <AdminConfigSection />
    </div>
  );
}

function CrewPasscodeConfig() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.from("crew_config").select("key").eq("key", "incident_passcode").maybeSingle()
      .then(({ data }) => setConfigured(!!data));
  }, []);

  const handleSave = async () => {
    if (newCode.length < 4 || newCode.length > 6 || !/^\d+$/.test(newCode)) {
      toast.error("El código debe tener 4-6 dígitos numéricos"); return;
    }
    if (newCode !== confirmCode) {
      toast.error("Los códigos no coinciden"); return;
    }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/crew-passcode`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ action: "update", new_passcode: newCode }),
        }
      );
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Error");
      toast.success("Código actualizado correctamente");
      setConfigured(true);
      setDialogOpen(false);
      setNewCode("");
      setConfirmCode("");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Lock className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="font-bold text-sm">Código de incidencias</p>
            <p className="text-xs text-muted-foreground">Contraseña para el acceso limitado de registro de incidencias</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {configured === null ? null : configured ? (
            <span className="status-badge-success">Configurado</span>
          ) : (
            <span className="status-badge-warning">Sin configurar</span>
          )}
          <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>Cambiar código</Button>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cambiar código de incidencias</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Ingresa un nuevo código de 4 a 6 dígitos numéricos.</p>
            <Input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={newCode}
              onChange={(e) => setNewCode(e.target.value.replace(/\D/g, ""))}
              placeholder="Nuevo código"
            />
            <Input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={confirmCode}
              onChange={(e) => setConfirmCode(e.target.value.replace(/\D/g, ""))}
              placeholder="Confirmar código"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
