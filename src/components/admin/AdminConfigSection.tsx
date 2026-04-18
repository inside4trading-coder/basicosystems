import { useEffect, useState } from "react";
import { Building2, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

const CONFIG = "admin_config" as any;
const OBLIGATIONS = "admin_obligations" as any;

interface ConfigItem {
  id: string;
  category: string;
  value: string;
  active: boolean;
  sort_order: number | null;
}

interface SubsectionProps {
  title: string;
  description?: string;
  category: string;
  items: ConfigItem[];
  usage: Record<string, number>; // value -> count
  onChange: () => void;
  readOnly?: boolean;
}

function ConfigSubsection({ title, description, category, items, usage, onChange, readOnly }: SubsectionProps) {
  const [newValue, setNewValue] = useState("");
  const [adding, setAdding] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const handleAdd = async () => {
    const v = newValue.trim();
    if (!v) return;
    if (items.some((i) => i.value.toLowerCase() === v.toLowerCase())) {
      toast.error("Ya existe");
      return;
    }
    setAdding(true);
    try {
      const nextOrder = (items[items.length - 1]?.sort_order ?? items.length) + 1;
      const { error } = await (supabase.from(CONFIG) as any).insert({
        category,
        value: v,
        active: true,
        sort_order: nextOrder,
      });
      if (error) throw error;
      toast.success(`${title} agregado`);
      setNewValue("");
      onChange();
    } catch (e: any) {
      toast.error(e?.message ?? "Error al agregar");
    } finally {
      setAdding(false);
    }
  };

  const handleRename = async (item: ConfigItem, newVal: string) => {
    const v = newVal.trim();
    if (!v || v === item.value) return;
    setSavingId(item.id);
    try {
      const { error } = await (supabase.from(CONFIG) as any).update({ value: v }).eq("id", item.id);
      if (error) throw error;
      toast.success("Actualizado");
      onChange();
    } catch (e: any) {
      toast.error(e?.message ?? "Error");
    } finally {
      setSavingId(null);
    }
  };

  const handleToggle = async (item: ConfigItem, active: boolean) => {
    setSavingId(item.id);
    try {
      const { error } = await (supabase.from(CONFIG) as any).update({ active }).eq("id", item.id);
      if (error) throw error;
      toast.success(active ? "Activado" : "Desactivado");
      onChange();
    } catch (e: any) {
      toast.error(e?.message ?? "Error");
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (item: ConfigItem) => {
    const count = usage[item.value] ?? 0;
    if (count > 0) {
      toast.error(`No se puede eliminar: ${count} obligaciones usan este valor`);
      return;
    }
    if (!confirm(`¿Eliminar "${item.value}"?`)) return;
    setSavingId(item.id);
    try {
      const { error } = await (supabase.from(CONFIG) as any).delete().eq("id", item.id);
      if (error) throw error;
      toast.success("Eliminado");
      onChange();
    } catch (e: any) {
      toast.error(e?.message ?? "Error");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="p-5 space-y-3">
      <div>
        <p className="font-bold text-sm">{title}</p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>

      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Sin valores configurados</p>
        ) : (
          items.map((item) => (
            <ConfigRow
              key={item.id}
              item={item}
              usageCount={usage[item.value] ?? 0}
              busy={savingId === item.id}
              readOnly={readOnly}
              onRename={(v) => handleRename(item, v)}
              onToggle={(v) => handleToggle(item, v)}
              onDelete={() => handleDelete(item)}
            />
          ))
        )}
      </div>

      {!readOnly && (
        <div className="flex items-center gap-2 pt-2">
          <Input
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder={`Agregar ${title.toLowerCase()}`}
            maxLength={120}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
            className="h-9"
          />
          <Button size="sm" variant="outline" onClick={handleAdd} disabled={adding || !newValue.trim()}>
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>
      )}
    </div>
  );
}

function ConfigRow({
  item,
  usageCount,
  busy,
  readOnly,
  onRename,
  onToggle,
  onDelete,
}: {
  item: ConfigItem;
  usageCount: number;
  busy: boolean;
  readOnly?: boolean;
  onRename: (v: string) => void;
  onToggle: (v: boolean) => void;
  onDelete: () => void;
}) {
  const [val, setVal] = useState(item.value);
  useEffect(() => setVal(item.value), [item.value]);

  return (
    <div className="flex items-center gap-2 group">
      <Input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => val.trim() !== item.value && onRename(val)}
        disabled={busy || readOnly}
        className="h-8 text-sm flex-1"
        maxLength={120}
      />
      {usageCount > 0 && (
        <Badge variant="outline" className="text-xs whitespace-nowrap">
          {usageCount} en uso
        </Badge>
      )}
      {!readOnly && (
        <>
          <div className="flex items-center gap-1.5">
            <Switch checked={item.active} onCheckedChange={onToggle} disabled={busy} />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-status-error opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={onDelete}
            disabled={busy || usageCount > 0}
            title={usageCount > 0 ? "No se puede eliminar: en uso" : "Eliminar"}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </>
      )}
    </div>
  );
}

export function AdminConfigSection() {
  const [items, setItems] = useState<ConfigItem[]>([]);
  const [usage, setUsage] = useState<Record<string, Record<string, number>>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: cfg, error: e1 }, { data: obl, error: e2 }] = await Promise.all([
        (supabase.from(CONFIG) as any).select("*").order("category").order("sort_order", { ascending: true }),
        (supabase.from(OBLIGATIONS) as any).select("category,responsible,payment_method,currency,frequency"),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      setItems((cfg ?? []) as ConfigItem[]);

      const counts: Record<string, Record<string, number>> = {
        obligation_category: {},
        responsible: {},
        payment_method: {},
        currency: {},
        frequency: {},
      };
      for (const o of obl ?? []) {
        if (o.category) counts.obligation_category[o.category] = (counts.obligation_category[o.category] ?? 0) + 1;
        if (o.responsible) counts.responsible[o.responsible] = (counts.responsible[o.responsible] ?? 0) + 1;
        if (o.payment_method) counts.payment_method[o.payment_method] = (counts.payment_method[o.payment_method] ?? 0) + 1;
        if (o.currency) counts.currency[o.currency] = (counts.currency[o.currency] ?? 0) + 1;
        if (o.frequency) counts.frequency[o.frequency] = (counts.frequency[o.frequency] ?? 0) + 1;
      }
      setUsage(counts);
    } catch (e: any) {
      toast.error(e?.message ?? "Error cargando configuración");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const byCategory = (cat: string) => items.filter((i) => i.category === cat);

  return (
    <section className="animate-fade-in" style={{ animationDelay: "0.4s" }}>
      <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
        <Building2 className="h-4 w-4" /> Administración
      </h3>
      <div className="bg-card rounded-lg border border-border divide-y divide-border">
        {loading ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <ConfigSubsection
              title="Categorías de obligaciones"
              description="Tipos de obligación (impuestos, servicios, alquileres, etc.)"
              category="obligation_category"
              items={byCategory("obligation_category")}
              usage={usage.obligation_category ?? {}}
              onChange={load}
            />
            <ConfigSubsection
              title="Responsables"
              description="Personas asignables como responsables de obligaciones"
              category="responsible"
              items={byCategory("responsible")}
              usage={usage.responsible ?? {}}
              onChange={load}
            />
            <ConfigSubsection
              title="Métodos de pago"
              description="Formas de pago habituales"
              category="payment_method"
              items={byCategory("payment_method")}
              usage={usage.payment_method ?? {}}
              onChange={load}
            />
            <ConfigSubsection
              title="Monedas"
              description="Monedas aceptadas para obligaciones"
              category="currency"
              items={byCategory("currency")}
              usage={usage.currency ?? {}}
              onChange={load}
            />
            <ConfigSubsection
              title="Frecuencias"
              description="Frecuencias de recurrencia (no editable en esta fase)"
              category="frequency"
              items={byCategory("frequency")}
              usage={usage.frequency ?? {}}
              onChange={load}
              readOnly
            />
          </>
        )}
      </div>
    </section>
  );
}
