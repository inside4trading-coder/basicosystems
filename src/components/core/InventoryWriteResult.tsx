// Resultado visible de una entrada a inventario: éxito claro o alerta de stock no coincidente.
// Solo presentación (no toca OP, QR, procesos, nómina, partidas ni costos).
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertTriangle, Copy } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export type InventoryVerification = {
  verified: boolean;
  verify_error?: string | null;
  unit_code?: string | null;
  sku?: string | null;
  size?: string | null;
  woo_product_id?: number | string | null;
  woo_variation_id?: number | string | null;
  stock_before?: number | null;
  delta?: number | null;
  stock_expected?: number | null;
  stock_real?: number | null;
  difference?: number | null;
  checked_at?: string | null;
  user_email?: string | null;
  preview_source?: string | null;
  woo_stock_checked_before_at?: string | null;
  woo_stock_checked_after_at?: string | null;
  confirmed_at?: string | null;
};

const PREVIEW_SOURCE_LABEL: Record<string, string> = {
  generated_on_confirm: "generada ahora",
  regenerated: "actualizada antes de confirmar",
  reused_valid_preview: "reutilizada vigente",
  manual_preview: "preparada manualmente",
};

export function previewSourceLabel(v: InventoryVerification) {
  if (!v.preview_source) return "reutilizada vigente";
  return PREVIEW_SOURCE_LABEL[v.preview_source] ?? v.preview_source;
}

function dt(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

function skuLabel(v: InventoryVerification) {
  return [v.sku ?? "—", v.size ?? ""].filter(Boolean).join(" ");
}

export function buildInventoryReport(v: InventoryVerification) {
  return [
    "ALERTA INVENTARIO BASICO CORE",
    `Unidad: ${v.unit_code ?? "—"}`,
    `SKU: ${skuLabel(v)}`,
    `Entrada preparada: ${previewSourceLabel(v)}`,
    `Stock Woo consultado: ${dt(v.woo_stock_checked_before_at)}`,
    `Woo product: ${v.woo_product_id ?? "—"}`,
    `Woo variation: ${v.woo_variation_id ?? "—"}`,
    `Stock antes: ${v.stock_before ?? "—"}`,
    `Delta: ${v.delta != null ? (v.delta > 0 ? `+${v.delta}` : v.delta) : "—"}`,
    `Stock esperado: ${v.stock_expected ?? "—"}`,
    `Stock real: ${v.stock_real ?? "—"}`,
    `Verificación final Woo: ${dt(v.woo_stock_checked_after_at)}`,
    `Diferencia: ${v.difference ?? "—"}`,
    `Fecha: ${v.checked_at ? new Date(v.checked_at).toLocaleString() : new Date().toLocaleString()}`,
    `Usuario: ${v.user_email ?? "—"}`,
  ].join("\n");
}


export function InventoryWriteResult({
  verification,
  onDismiss,
}: {
  verification: InventoryVerification;
  onDismiss?: () => void;
}) {
  const v = verification;

  async function copyReport() {
    const text = buildInventoryReport(v);
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Reporte copiado", description: "Pégalo en WhatsApp o Slack." });
    } catch {
      toast({ title: "No se pudo copiar", description: text, variant: "destructive" });
    }
  }

  if (v.verified) {
    return (
      <div className="rounded-lg border border-green-600/40 bg-green-600/10 p-4 space-y-1">
        <p className="flex items-center gap-2 font-semibold text-green-700">
          <CheckCircle2 className="h-5 w-5" /> Prenda agregada exitosamente a inventario
        </p>
        <div className="text-sm text-foreground/90 space-y-0.5">
          <div>Unidad: <span className="font-mono">{v.unit_code ?? "—"}</span></div>
          <div>SKU: <span className="font-mono">{skuLabel(v)}</span></div>
          <div>Entrada preparada: <strong>{previewSourceLabel(v)}</strong></div>
          <div>Stock Woo consultado: {dt(v.woo_stock_checked_before_at)}</div>
          <div>Stock anterior: {v.stock_before ?? "—"}</div>
          <div>Agregado: {v.delta != null && v.delta > 0 ? `+${v.delta}` : v.delta ?? "—"}</div>
          <div>Stock esperado: {v.stock_expected ?? "—"}</div>
          <div>Stock final real: <strong>{v.stock_real ?? v.stock_expected ?? "—"}</strong></div>
          <div>Verificación: correcta {v.woo_stock_checked_after_at ? `· ${dt(v.woo_stock_checked_after_at)}` : ""}</div>

        </div>
        <p className="text-xs text-green-700 font-medium">Stock verificado correctamente.</p>
        {onDismiss && (
          <Button variant="ghost" size="sm" className="text-xs px-1" onClick={onDismiss}>
            Cerrar
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border-2 border-destructive bg-destructive/10 p-4 space-y-2">
      <p className="flex items-center gap-2 font-bold text-destructive">
        <AlertTriangle className="h-5 w-5" /> ALERTA: stock no coincidente
      </p>
      <p className="text-sm font-medium text-destructive">
        No continúes ingresando prendas de este SKU. Envía este reporte a tu superior.
      </p>
      <div className="text-sm space-y-0.5">
        <div>SKU: <span className="font-mono">{skuLabel(v)}</span></div>
        <div>Entrada preparada: {previewSourceLabel(v)}</div>
        <div>Stock Woo consultado: {dt(v.woo_stock_checked_before_at)}</div>
        <div>Verificación final Woo: {dt(v.woo_stock_checked_after_at)}</div>
        <div>Woo product: <span className="font-mono">{v.woo_product_id ?? "—"}</span></div>
        <div>Woo variation: <span className="font-mono">{v.woo_variation_id ?? "—"}</span></div>
        <div>Había: {v.stock_before ?? "—"}</div>
        <div>Se esperaba ingresar: {v.delta != null && v.delta > 0 ? `+${v.delta}` : v.delta ?? "—"}</div>
        <div>Stock esperado: {v.stock_expected ?? "—"}</div>
        <div>Stock real actual: <strong>{v.stock_real ?? "—"}</strong></div>
        <div>Diferencia: <strong>{v.difference ?? "—"}</strong></div>
        <div>Unidad: <span className="font-mono">{v.unit_code ?? "—"}</span></div>
        <div>Fecha: {v.checked_at ? new Date(v.checked_at).toLocaleString() : new Date().toLocaleString()}</div>
        <div>Usuario: {v.user_email ?? "—"}</div>
        {v.verify_error && <div className="text-xs text-muted-foreground">Detalle: {v.verify_error}</div>}
      </div>
      <p className="text-xs font-medium">
        Acción recomendada: enviar este mensaje a tu superior antes de continuar.
      </p>
      <div className="flex gap-2">
        <Button size="sm" variant="destructive" onClick={copyReport}>
          <Copy className="h-4 w-4 mr-1" /> Copiar reporte
        </Button>
        {onDismiss && (
          <Button size="sm" variant="outline" onClick={onDismiss}>
            Cerrar
          </Button>
        )}
      </div>
    </div>
  );
}
