import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { logStrategyDecision, type CoreProductLite } from "@/hooks/useWooCoreMap";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  coreProducts: CoreProductLite[];
}

export function LinkWooIdDialog({ open, onClose, onDone, coreProducts }: Props) {
  const [wooId, setWooId] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [selectedCore, setSelectedCore] = useState<string>("");

  async function lookup() {
    if (!wooId) return;
    setLoading(true);
    setPreview(null);
    try {
      const { data, error } = await supabase.functions.invoke("core-woo-map-lookup", {
        method: "GET" as any,
        body: undefined,
        headers: {},
      });
      // fallback: build URL manually since invoke doesn't support query params cleanly
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/core-woo-map-lookup?woo_product_id=${encodeURIComponent(wooId)}`;
      const sess = await supabase.auth.getSession();
      const token = sess.data.session?.access_token;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "lookup_failed");
      setPreview(j.product);
    } catch (e: any) {
      toast({ title: "No se encontró", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function confirm() {
    if (!preview) return;
    setLoading(true);
    try {
      const payload: any = {
        woo_product_id: Number(preview.id),
        woo_product_name: preview.name,
        woo_product_sku: preview.sku,
        woo_product_type: preview.type,
        woo_status: preview.status,
        woo_permalink: preview.permalink,
        woo_parent_id: preview.parent_id ?? null,
        woo_variations_count: preview.variations_count ?? 0,
        core_product_id: selectedCore || null,
        mapping_status: selectedCore ? "mapped" : "unmapped",
      };
      const { error } = await supabase.from("core_woo_product_map")
        .upsert(payload, { onConflict: "woo_product_id" });
      if (error) throw error;
      await logStrategyDecision({
        woo_product_id: Number(preview.id),
        core_product_id: selectedCore || null,
        decision_type: "map_to_core",
        new_values: { core_product_id: selectedCore || null },
      });
      toast({ title: "Vinculado", description: `Woo #${preview.id} guardado en el mapa.` });
      onDone();
      onClose();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Vincular Woo ID manual</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input placeholder="Woo Product ID" value={wooId} onChange={e => setWooId(e.target.value)} type="number" />
            <Button onClick={lookup} disabled={loading || !wooId}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}</Button>
          </div>
          {preview && (
            <div className="border rounded p-3 bg-muted/30 text-sm space-y-1">
              <div><b>ID:</b> {preview.id}</div>
              <div><b>Nombre:</b> {preview.name}</div>
              <div><b>SKU:</b> {preview.sku || "—"}</div>
              <div><b>Tipo:</b> {preview.type} · <b>Estado Woo:</b> {preview.status}</div>
              <div><b>Variaciones:</b> {preview.variations_count}</div>
              {preview.permalink && <a className="text-primary underline text-xs" href={preview.permalink} target="_blank">Abrir en Woo</a>}
              <div className="pt-2">
                <Label className="text-xs">Vincular a producto Core (opcional)</Label>
                <Select value={selectedCore} onValueChange={setSelectedCore}>
                  <SelectTrigger><SelectValue placeholder="No vincular todavía" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">— No vincular —</SelectItem>
                    {coreProducts.map(c => <SelectItem key={c.id} value={c.id}>{c.core_sku} · {c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={confirm} disabled={!preview || loading}>Guardar en el mapa</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
