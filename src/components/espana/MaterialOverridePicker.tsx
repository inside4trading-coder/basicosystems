import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, Loader2, Repeat2 } from "lucide-react";
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

export const materialLabel = (m: { name?: string | null; size?: string | null; color?: string | null }) =>
  [m?.name || "Material", [m?.size, m?.color].filter(Boolean).join(" / ")].filter(Boolean).join(" · ");

/**
 * Selector de material real de inventario para sustituir el material previsto
 * por la receta en UNA fabricación concreta. No modifica recetas ni productos.
 */
export default function MaterialOverridePicker({
  locationId,
  materialType,
  familyName,
  familyColor,
  expectedMaterialId,
  value,
  requiredQty,
  onSelect,
  onClear,
}: {
  locationId: string | null;
  materialType: string | null;
  familyName: string | null;
  familyColor: string | null;
  expectedMaterialId: string | null;
  value: MaterialOption | null;
  requiredQty: number;
  onSelect: (m: MaterialOption) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<MaterialOption[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!open || loaded) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      let q = supabase
        .from("esp_material_items")
        .select("id,material_type,sku,name,color,size")
        .eq("status", "active")
        .order("name")
        .limit(500);
      if (materialType) q = q.eq("material_type", materialType);
      const { data } = await q;
      const items = (data || []) as any[];
      const ids = items.map((i) => i.id);
      const stockMap: Record<string, number> = {};
      if (ids.length && locationId) {
        const { data: stock } = await supabase
          .from("esp_material_stock")
          .select("material_id,quantity_on_hand")
          .eq("location_id", locationId)
          .in("material_id", ids);
        for (const s of (stock || []) as any[]) {
          stockMap[s.material_id] = (stockMap[s.material_id] || 0) + Number(s.quantity_on_hand || 0);
        }
      }
      if (cancelled) return;
      setOptions(items.map((i) => ({ ...i, available: stockMap[i.id] ?? 0 })) as MaterialOption[]);
      setLoading(false);
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [open, loaded, materialType, locationId]);

  const sorted = useMemo(() => {
    const fam = (m: MaterialOption) =>
      (!familyName || m.name === familyName) && (!familyColor || (m.color || "") === (familyColor || "")) ? 0 : 1;
    return [...options]
      .filter((m) => m.id !== expectedMaterialId)
      .sort((a, b) => fam(a) - fam(b) || a.name.localeCompare(b.name) || (a.size || "").localeCompare(b.size || ""));
  }, [options, familyName, familyColor, expectedMaterialId]);

  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]">
            <Repeat2 className="h-3 w-3 mr-1" />
            {value ? "Cambiar otro" : "Cambiar material"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[360px]" align="start">
          <Command filter={(v, s) => (v.toLowerCase().includes(s.toLowerCase()) ? 1 : 0)}>
            <CommandInput placeholder="Seleccionar material utilizado…" />
            <CommandList>
              {loading && (
                <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Cargando inventario…
                </div>
              )}
              <CommandEmpty>Sin materiales.</CommandEmpty>
              <CommandGroup>
                {sorted.map((m) => {
                  const enough = m.available >= requiredQty;
                  return (
                    <CommandItem
                      key={m.id}
                      value={`${m.name} ${m.size || ""} ${m.color || ""} ${m.sku || ""}`}
                      onSelect={() => { onSelect(m); setOpen(false); }}
                    >
                      <Check className={cn("mr-2 h-3.5 w-3.5", value?.id === m.id ? "opacity-100" : "opacity-0")} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-medium">{materialLabel(m)}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">
                          {m.sku || "sin SKU"} · stock {m.available}
                        </div>
                      </div>
                      {!enough && <span className="text-[10px] text-amber-600 ml-2 shrink-0">sin stock</span>}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value && (
        <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px] text-muted-foreground" onClick={onClear}>
          Deshacer
        </Button>
      )}
    </div>
  );
}
