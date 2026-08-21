// Nota de producción libre (España): texto manual + N líneas de materiales/blanks a descontar.
// No crea producto Woo ni de catálogo. Solo registra producción ligera y consumo de materiales.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertTriangle, Check, ChevronsUpDown, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { MATERIAL_TYPE_LABEL, MATERIAL_UNIT_LABEL } from "@/lib/espMaterials";

interface MaterialRow {
  id: string;
  name: string;
  sku: string | null;
  size: string | null;
  color: string | null;
  material_type: string;
  unit: string;
  unit_cost_eur: number | null;
}
interface LocationRow { id: string; name: string }
type StockMap = Record<string, Record<string, number>>; // materialId -> locationId -> qty

interface Line {
  key: string;
  groupName: string;      // nombre del material padre (grupo)
  materialId: string;     // variante concreta (talla/color) — obligatoria si el grupo tiene variantes
  locationId: string;
  qtyPerUnit: string;
}

const newLine = (locationId = ""): Line => ({
  key: Math.random().toString(36).slice(2),
  groupName: "",
  materialId: "",
  locationId,
  qtyPerUnit: "1",
});

export const variantText = (m: { size: string | null; color: string | null } | null | undefined) =>
  m ? [m.size, m.color].filter(Boolean).join(" / ") : "";

export default function ProductionNoteDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [stock, setStock] = useState<StockMap>({});
  const [loading, setLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [units, setUnits] = useState("1");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([newLine()]);
  const [openPickerFor, setOpenPickerFor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    (async () => {
      const [mats, locs, st] = await Promise.all([
        supabase.from("esp_material_items")
          .select("id,name,sku,size,color,material_type,unit,unit_cost_eur")
          .eq("status", "active").order("name").limit(3000),
        supabase.from("esp_locations").select("id,name").eq("is_active", true).order("name"),
        supabase.from("esp_material_stock").select("material_id,location_id,quantity_on_hand").limit(10000),
      ]);
      if (mats.error) toast.error(mats.error.message);
      setMaterials((mats.data || []) as MaterialRow[]);
      const locRows = (locs.data || []) as LocationRow[];
      setLocations(locRows);
      const map: StockMap = {};
      for (const s of (st.data || []) as any[]) {
        map[s.material_id] = map[s.material_id] || {};
        map[s.material_id][s.location_id] = Number(s.quantity_on_hand || 0);
      }
      setStock(map);
      setLines([newLine(locRows[0]?.id || "")]);
      setLoading(false);
    })();
  }, [open]);

  // Agrupa materiales por nombre: cada fila con talla/color distinta es una variante del grupo.
  const groups = useMemo(() => {
    const g = new Map<string, MaterialRow[]>();
    for (const m of materials) {
      const arr = g.get(m.name) || [];
      arr.push(m);
      g.set(m.name, arr);
    }
    return g;
  }, [materials]);

  const groupList = useMemo(() => [...groups.entries()].map(([name, rows]) => ({ name, rows })), [groups]);

  const unitsNum = Math.max(0, Math.floor(Number(units) || 0));
  const patch = (key: string, p: Partial<Line>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...p } : l)));

  const stockOf = (materialId: string, locationId: string) => stock[materialId]?.[locationId] ?? 0;
  const stockTotal = (materialId: string) =>
    Object.values(stock[materialId] || {}).reduce((s, n) => s + n, 0);

  const computed = lines.map((l) => {
    const rows = l.groupName ? groups.get(l.groupName) || [] : [];
    const hasVariants = rows.length > 1;
    const material = materials.find((m) => m.id === l.materialId) || null;
    const per = Number(l.qtyPerUnit);
    const total = Number.isFinite(per) && per > 0 ? per * unitsNum : 0;
    const available = material && l.locationId ? stockOf(material.id, l.locationId) : 0;
    const enough = total > 0 && available >= total;
    const complete = !!material && !!l.locationId && total > 0 && (!hasVariants || !!l.materialId);
    return { line: l, rows, hasVariants, material, total, available, enough, complete };
  });

  const shortages = computed.filter((c) => c.complete && !c.enough);
  const valid =
    title.trim().length > 2 &&
    unitsNum > 0 &&
    computed.length > 0 &&
    computed.every((c) => c.complete);

  const totalCost = computed.reduce(
    (s, c) => s + (c.material?.unit_cost_eur ? Number(c.material.unit_cost_eur) * c.total : 0),
    0,
  );

  const reset = () => { setTitle(""); setUnits("1"); setNotes(""); setLines([newLine(locations[0]?.id || "")]); };

  const submit = async (allowNegative = false) => {
    if (!valid || saving) return;
    if (shortages.length > 0 && !allowNegative) return;
    setSaving(true);
    const { data: userRes } = await supabase.auth.getUser();
    const createdBy = userRes?.user?.id || null;

    const { data: note, error: noteErr } = await supabase
      .from("esp_production_notes")
      .insert({
        title: title.trim(),
        units: unitsNum,
        location_id: lines[0]?.locationId || null,
        notes: notes.trim() || null,
        status: "draft",
        ...(createdBy ? { created_by: createdBy } : {}),
      })
      .select("id")
      .single();
    if (noteErr || !note) { setSaving(false); toast.error(noteErr?.message || "No se pudo crear la nota"); return; }

    const payload = computed.map((c) => {
      const loc = locations.find((l) => l.id === c.line.locationId) || null;
      const cost = c.material?.unit_cost_eur != null ? Number(c.material.unit_cost_eur) : null;
      return {
        note_id: note.id,
        material_id: c.material!.id,
        location_id: c.line.locationId,
        quantity_per_unit: Number(c.line.qtyPerUnit),
        total_quantity: c.total,
        material_name: c.material!.name,
        material_sku: c.material!.sku,
        material_size: c.material!.size,
        material_color: c.material!.color,
        material_type: c.material!.material_type,
        location_name: loc?.name || null,
        unit_cost_eur: cost,
        line_cost_eur: cost != null ? cost * c.total : null,
        ...(createdBy ? { created_by: createdBy } : {}),
      };
    });

    const { error: linesErr } = await supabase.from("esp_production_note_materials").insert(payload);
    if (linesErr) {
      await supabase.from("esp_production_notes").delete().eq("id", note.id);
      setSaving(false); toast.error(linesErr.message); return;
    }

    const { data: res, error: rpcErr } = await supabase.rpc("esp_consume_production_note" as any, {
      p_note_id: note.id,
      p_allow_negative: allowNegative,
    });
    setSaving(false);
    if (rpcErr) { toast.error(rpcErr.message); return; }
    const out = res as any;
    if (out?.ok === false && out?.error === "insufficient_stock") {
      const list = (out.shortages || []).map((s: any) => `${s.name}${s.variant ? " / " + s.variant : ""} (req. ${s.required}, disp. ${s.available})`).join(" · ");
      toast.error(`Stock insuficiente: ${list}`);
      return;
    }
    toast.success(`Nota creada · ${out?.movements ?? payload.length} materiales descontados`);
    reset();
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" /> Nueva nota de producción
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-3 space-y-1.5">
                <Label>Nota *</Label>
                <Input
                  value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300}
                  placeholder="Ej. 2 franelas Engras XL logo personalizado"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Unidades *</Label>
                <Input type="number" min={1} step={1} value={units} onChange={(e) => setUnits(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2 border-t pt-3">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Materiales / blanks a descontar
              </Label>

              {computed.map((c, idx) => {
                const l = c.line;
                return (
                  <Card key={l.key} className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-muted-foreground">Material {idx + 1}</span>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7"
                        disabled={lines.length === 1}
                        onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                      <div className="sm:col-span-5">
                        <Popover open={openPickerFor === l.key} onOpenChange={(o) => setOpenPickerFor(o ? l.key : null)}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                              <span className={cn("truncate", !l.groupName && "text-muted-foreground")}>
                                {l.groupName || "Buscar blank / material…"}
                              </span>
                              <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            className="p-0 w-[--radix-popover-trigger-width] max-w-[560px]"
                            align="start"
                            onWheel={(e) => e.stopPropagation()}
                            onTouchMove={(e) => e.stopPropagation()}
                          >
                            <Command filter={(value, search) => value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0}>
                              <CommandInput placeholder="Nombre, SKU, talla o color…" />
                              <CommandList className="max-h-[260px] overflow-y-auto overscroll-contain">

                                <CommandEmpty>Sin materiales.</CommandEmpty>
                                <CommandGroup>
                                  {groupList.map((g) => {
                                    const first = g.rows[0];
                                    const totalStock = g.rows.reduce((s, r) => s + stockTotal(r.id), 0);
                                    return (
                                      <CommandItem
                                        key={g.name}
                                        value={`${g.name} ${g.rows.map((r) => `${r.sku || ""} ${r.size || ""} ${r.color || ""}`).join(" ")}`}
                                        onSelect={() => {
                                          setOpenPickerFor(null);
                                          patch(l.key, {
                                            groupName: g.name,
                                            materialId: g.rows.length === 1 ? g.rows[0].id : "",
                                          });
                                        }}
                                      >
                                        <Check className={cn("mr-2 h-4 w-4", l.groupName === g.name ? "opacity-100" : "opacity-0")} />
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center gap-2">
                                            <span className="truncate font-medium">{g.name}</span>
                                            <Badge variant="outline" className="text-[10px]">
                                              {MATERIAL_TYPE_LABEL[first.material_type] || first.material_type}
                                            </Badge>
                                          </div>
                                          <div className="text-[11px] text-muted-foreground truncate">
                                            {g.rows.length > 1 ? `${g.rows.length} variantes` : (variantText(first) || "Sin variantes")}
                                            {first.sku ? ` · ${first.sku}` : ""} · stock {totalStock}
                                            {first.unit_cost_eur != null ? ` · ${Number(first.unit_cost_eur).toFixed(2)} €` : ""}
                                          </div>
                                        </div>
                                      </CommandItem>
                                    );
                                  })}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div className="sm:col-span-3">
                        <Select
                          value={l.materialId}
                          onValueChange={(v) => patch(l.key, { materialId: v })}
                          disabled={!l.groupName || !c.hasVariants}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={
                              !l.groupName ? "Variante" : c.hasVariants ? "Talla / color *" : (variantText(c.rows[0]) || "Sin variantes")
                            } />
                          </SelectTrigger>
                          <SelectContent>
                            {c.rows.map((r) => (
                              <SelectItem key={r.id} value={r.id}>
                                {variantText(r) || r.sku || "Variante"}
                                {l.locationId ? ` · stock ${stockOf(r.id, l.locationId)}` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="sm:col-span-2">
                        <Select value={l.locationId} onValueChange={(v) => patch(l.key, { locationId: v })}>
                          <SelectTrigger><SelectValue placeholder="Sede" /></SelectTrigger>
                          <SelectContent>
                            {locations.map((loc) => <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="sm:col-span-2">
                        <Input
                          type="number" min={0.01} step="any" value={l.qtyPerUnit}
                          onChange={(e) => patch(l.key, { qtyPerUnit: e.target.value })}
                          placeholder="x unidad"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
                      <span className="text-muted-foreground">
                        Total a descontar: <span className="font-bold text-foreground">{c.total || 0}</span>
                        {c.material ? ` ${MATERIAL_UNIT_LABEL[c.material.unit] || c.material.unit}` : ""}
                      </span>
                      {c.material && l.locationId && (
                        <span className={cn(c.enough ? "text-emerald-600" : "text-destructive font-bold")}>
                          Stock sede: {c.available}
                        </span>
                      )}
                      {c.material?.unit_cost_eur != null && (
                        <span className="text-muted-foreground">
                          Coste: {(Number(c.material.unit_cost_eur) * c.total).toFixed(2)} €
                        </span>
                      )}
                      {c.hasVariants && !l.materialId && (
                        <span className="text-amber-600 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> Selecciona la variante exacta
                        </span>
                      )}
                    </div>
                  </Card>
                );
              })}

              <Button variant="outline" size="sm" onClick={() => setLines((prev) => [...prev, newLine(locations[0]?.id || "")])}>
                <Plus className="h-4 w-4 mr-1" /> Agregar material
              </Button>
            </div>

            {shortages.length > 0 && (
              <Card className="p-3 border-l-4 border-l-destructive bg-destructive/5 text-xs">
                <p className="font-bold flex items-center gap-1 text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5" /> Stock insuficiente
                </p>
                <ul className="mt-1 list-disc pl-4 text-muted-foreground">
                  {shortages.map((c) => (
                    <li key={c.line.key}>
                      {c.material?.name}{variantText(c.material) ? ` / ${variantText(c.material)}` : ""} — requiere {c.total}, disponible {c.available}
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            <div className="space-y-1.5 border-t pt-3">
              <Label>Notas internas</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={1000} />
            </div>

            <p className="text-[11px] text-muted-foreground">
              {totalCost > 0 && <span className="font-bold text-foreground">Coste estimado {totalCost.toFixed(2)} €. </span>}
              Al confirmar se descuenta cada línea con su propio movimiento de inventario referenciado a la nota.
              No se crea producto de catálogo ni nada en WooCommerce.
            </p>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          {shortages.length > 0 && valid && (
            <Button variant="outline" onClick={() => submit(true)} disabled={saving}>
              Descontar igualmente
            </Button>
          )}
          <Button onClick={() => submit(false)} disabled={!valid || saving || shortages.length > 0}>
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Crear y descontar{computed.length > 0 ? ` (${computed.length})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
