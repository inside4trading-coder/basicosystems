import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Loader2, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MaterialOption {
  id: string;
  material_type: string;
  sku: string | null;
  name: string;
  color: string | null;
  size: string | null;
  available: number;
}

export const materialOptionLabel = (o: MaterialOption | null | undefined) =>
  o ? [o.name, o.size ? `talla ${o.size}` : null, o.color].filter(Boolean).join(" · ") : "";

interface Props {
  locationId: string | null | undefined;
  materialType: string;
  familyName?: string | null;
  familyColor?: string | null;
  excludeId?: string | null;
  onSelect: (opt: MaterialOption) => void;
  disabled?: boolean;
}

/** Selector de material alternativo real del inventario (mismo tipo, misma sede). */
export default function MaterialOverridePicker({
  locationId, materialType, familyName, familyColor, excludeId, onSelect, disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<MaterialOption[]>([]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    (async () => {
      const { data: items } = await supabase
        .from("esp_material_items")
        .select("id,material_type,sku,name,color,size")
        .eq("material_type", materialType)
        .neq("status", "archived")
        .order("name");
      const ids = ((items || []) as any[]).map((i) => i.id);
      let stockMap: Record<string, number> = {};
      if (ids.length > 0) {
        let q = supabase.from("esp_material_stock").select("material_id,quantity_on_hand").in("material_id", ids);
        if (locationId) q = q.eq("location_id", locationId);
        const { data: stock } = await q;
        for (const s of (stock || []) as any[]) stockMap[s.material_id] = Number(s.quantity_on_hand || 0);
      }
      const fam = (n: string | null, c: string | null) =>
        (familyName && n === familyName && (!familyColor || c === familyColor)) ? 0 : 1;
      const opts: MaterialOption[] = ((items || []) as any[])
        .filter((i) => i.id !== excludeId)
        .map((i) => ({ ...i, available: stockMap[i.id] ?? 0 }))
        .sort((a, b) => fam(a.name, a.color) - fam(b.name, b.color) || b.available - a.available || a.name.localeCompare(b.name));
      setOptions(opts);
      setLoading(false);
    })();
  }, [open, materialType, locationId, excludeId, familyName, familyColor]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 text-xs" disabled={disabled}>
          <Repeat className="h-3 w-3 mr-1" /> Cambiar material
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-1 max-h-72 overflow-y-auto">
        {loading ? (
          <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando inventario…</div>
        ) : options.length === 0 ? (
          <p className="p-3 text-xs text-muted-foreground">No hay otros materiales de este tipo en inventario.</p>
        ) : (
          options.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => { setOpen(false); onSelect(o); }}
              className={cn(
                "w-full text-left px-2 py-1.5 rounded hover:bg-muted/60 text-xs flex items-center justify-between gap-2",
                o.available <= 0 && "opacity-50",
              )}
            >
              <span className="min-w-0">
                <span className="font-medium block truncate">{materialOptionLabel(o)}</span>
                {o.sku && <span className="font-mono text-[10px] text-muted-foreground">{o.sku}</span>}
              </span>
              <span className={cn("font-mono text-[10px] shrink-0", o.available > 0 ? "text-emerald-600" : "text-amber-600")}>
                stock {o.available}
              </span>
            </button>
          ))
        )}
      </PopoverContent>
    </Popover>
  );
}
