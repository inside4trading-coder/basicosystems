import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, UserPlus, Upload, Loader2, FileSpreadsheet } from "lucide-react";
import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const mockUsers = [
  { name: "Admin Basico", email: "admin@basicoclothes.es", role: "admin" },
  { name: "Manager Uno", email: "manager@basicoclothes.es", role: "manager" },
  { name: "Partner Demo", email: "partner@basicoclothes.es", role: "partner" },
];

const integrations = [
  { name: "WooCommerce", description: "basicoclothes.es", connected: true },
  { name: "Trello", description: "Workspace Basico", connected: true },
  { name: "Brevo", description: "Email marketing", connected: false },
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
    <div className="space-y-8 max-w-4xl">
      <h2 className="text-2xl font-black tracking-tight">Configuración</h2>

      {/* Users */}
      <section className="animate-fade-in">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Usuarios del hub</h3>
          <Button variant="outline" size="sm">
            <UserPlus className="h-4 w-4 mr-1" /> Invitar usuario
          </Button>
        </div>
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          {mockUsers.map((user) => (
            <div key={user.email} className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0">
              <div>
                <p className="font-bold text-sm">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
              <select defaultValue={user.role}
                className="text-xs border border-border rounded-md px-2 py-1 bg-background font-semibold">
                <option value="admin">Admin Basico</option>
                <option value="manager">Manager Basico</option>
                <option value="partner">Partner Basico</option>
              </select>
            </div>
          ))}
        </div>
      </section>

      {/* Integrations */}
      <section className="animate-fade-in" style={{ animationDelay: "0.1s" }}>
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Integraciones</h3>
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          {integrations.map((integ) => (
            <div key={integ.name} className="flex items-center justify-between px-4 py-4 border-b border-border last:border-0">
              <div className="flex items-center gap-3">
                {integ.connected ? <CheckCircle className="h-5 w-5 text-status-success" /> : <XCircle className="h-5 w-5 text-status-error" />}
                <div>
                  <p className="font-bold text-sm">{integ.name}</p>
                  <p className="text-xs text-muted-foreground">{integ.description}</p>
                </div>
              </div>
              <Button variant="outline" size="sm">Probar conexión</Button>
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
    </div>
  );
}
