// Listado de notas de producción libres con el detalle de materiales descontados por línea.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, NotebookPen, Plus } from "lucide-react";
import { formatDMY } from "@/lib/dateUtils";
import ProductionNoteDialog from "@/components/espana/ProductionNoteDialog";

interface NoteMaterial {
  id: string;
  material_name: string | null;
  material_sku: string | null;
  material_size: string | null;
  material_color: string | null;
  location_name: string | null;
  total_quantity: number;
  line_cost_eur: number | null;
  material_movement_id: string | null;
}
interface NoteRow {
  id: string;
  title: string;
  units: number;
  status: string;
  notes: string | null;
  created_at: string;
  total_cost_eur: number | null;
  esp_production_note_materials: NoteMaterial[];
}

const variantOf = (m: NoteMaterial) => [m.material_size, m.material_color].filter(Boolean).join(" / ");

export default function ProductionNotesSection() {
  const [rows, setRows] = useState<NoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("esp_production_notes")
      .select("id,title,units,status,notes,created_at,total_cost_eur,esp_production_note_materials(id,material_name,material_sku,material_size,material_color,location_name,total_quantity,line_cost_eur,material_movement_id)")
      .order("created_at", { ascending: false })
      .limit(50);
    setRows((data || []) as unknown as NoteRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <NotebookPen className="h-4 w-4" /> Notas de producción ({rows.length})
        </h3>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nueva nota de producción
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <Card className="p-4 text-xs text-muted-foreground">
          Sin notas de producción. Úsalas para producción libre (sin producto de catálogo) descontando blanks, DTF, etiquetas y packaging.
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {rows.map((n) => (
            <Card key={n.id} className="p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold truncate">{n.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatDMY(n.created_at)} · {n.units} unidad{n.units === 1 ? "" : "es"}
                    {n.total_cost_eur != null ? ` · ${Number(n.total_cost_eur).toFixed(2)} €` : ""}
                  </p>
                </div>
                <Badge variant={n.status === "consumed" ? "default" : "outline"} className="shrink-0">
                  {n.status === "consumed" ? "Descontada" : n.status === "cancelled" ? "Cancelada" : "Borrador"}
                </Badge>
              </div>

              <div>
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Materiales descontados</p>
                <ul className="mt-1 space-y-0.5 text-xs">
                  {n.esp_production_note_materials.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-2">
                      <span className="truncate">
                        {m.material_name}{variantOf(m) ? ` / ${variantOf(m)}` : ""}
                        {m.location_name ? <span className="text-muted-foreground"> · {m.location_name}</span> : null}
                      </span>
                      <span className="font-bold shrink-0">
                        x{Number(m.total_quantity)}
                        {!m.material_movement_id && <span className="ml-1 text-amber-600 font-normal">(sin descontar)</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {n.notes && <p className="text-[11px] text-muted-foreground">{n.notes}</p>}
            </Card>
          ))}
        </div>
      )}

      <ProductionNoteDialog open={open} onOpenChange={setOpen} onCreated={load} />
    </section>
  );
}
