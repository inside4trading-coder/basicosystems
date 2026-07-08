import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Props { open: boolean; onClose: () => void; onDone: () => void; ctx: any; }

export function SyncVariantsDialog({ open, onClose, onDone, ctx }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function run() {
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("core-woo-map-import-variants", {
        body: { woo_product_id: ctx.map.woo_product_id },
      });
      if (error) throw error;
      setResult(data);
      toast({ title: "Variantes sincronizadas", description: `${(data as any)?.woo_variations_detected ?? 0} detectadas` });
      onDone();
    } catch (e: any) {
      toast({ title: "Error sincronizando", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Sincronizar variantes desde Woo</DialogTitle></DialogHeader>
        <div className="text-sm space-y-2">
          <div><b>Producto:</b> {ctx.map.woo_product_name} <span className="text-muted-foreground">#{ctx.map.woo_product_id}</span></div>
          <p className="text-xs text-muted-foreground">Trae las variaciones Woo y actualiza el mapa. Si el producto está vinculado a Core, también sincroniza <code>core_product_variants</code>. Nunca borra.</p>
          {result && (
            <div className="border rounded p-3 bg-muted/30 text-xs space-y-1">
              <div>Detectadas en Woo: <b>{result.woo_variations_detected}</b></div>
              <div>Guardadas en mapa: <b>{result.variant_map_upserted}</b></div>
              <div>Variantes Core creadas: <b>{result.core_variants_created}</b></div>
              <div>Variantes Core actualizadas: <b>{result.core_variants_updated}</b></div>
              <div>Estado sync: <b>{result.sync_status}</b></div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
          <Button onClick={run} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}Sincronizar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
