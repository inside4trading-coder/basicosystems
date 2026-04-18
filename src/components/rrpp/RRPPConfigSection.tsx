import { useEffect, useState } from "react";
import { Star, Plus, Trash2, Loader2, MapPin, Share2, Tag, Users2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const db = supabase as any;

type ConfigRow = { id: string; key: string; value: string; category: string };

const CATEGORIES = [
  { key: "contact_type", label: "Tipos de contacto", icon: Users2, hint: "Categorías que aparecen al crear un contacto" },
  { key: "city", label: "Ciudades", icon: MapPin, hint: "Autocomplete en formularios de contacto" },
  { key: "network", label: "Redes sociales disponibles", icon: Share2, hint: "Listado para registrar redes" },
  { key: "tag", label: "Etiquetas principales", icon: Tag, hint: "Etiquetas asignables a un contacto" },
  { key: "responsible", label: "Responsables internos", icon: Users2, hint: "Equipo asignable a contactos" },
] as const;

const titleCase = (s: string) =>
  s.trim().toLowerCase().split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

type CategoryDef = { key: string; label: string; icon: typeof Star; hint: string };

function CategoryEditor({ category, label, icon: Icon, hint }: { category: string; label: string; icon: typeof Star; hint: string }) {
  const [rows, setRows] = useState<ConfigRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newValue, setNewValue] = useState("");
  const [adding, setAdding] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await db
      .from("rrpp_config").select("id,key,value,category")
      .eq("category", category).order("value");
    if (error) toast.error(error.message);
    setRows((data ?? []) as ConfigRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [category]);

  const handleAdd = async () => {
    const value = category === "city" ? titleCase(newValue) : newValue.trim();
    if (!value) return;
    if (rows.some((r) => r.value.toLowerCase() === value.toLowerCase())) {
      toast.error("Ya existe ese valor"); return;
    }
    const key = value.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    setAdding(true);
    const { error } = await db.from("rrpp_config").insert({ category, key, value });
    setAdding(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Agregado");
    setNewValue("");
    load();
  };

  const handleDelete = async (row: ConfigRow) => {
    // Prevent delete for contact_type if used by any contact
    if (category === "contact_type") {
      const { count } = await db
        .from("rrpp_contacts").select("id", { count: "exact", head: true })
        .eq("contact_type", row.key);
      if ((count ?? 0) > 0) {
        toast.error("No se puede eliminar: hay contactos usando este tipo");
        return;
      }
    }
    const { error } = await db.from("rrpp_config").delete().eq("id", row.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Eliminado");
    load();
  };

  return (
    <div className="p-5 space-y-3">
      <div className="flex items-start gap-3">
        <Icon className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-bold text-sm">{label}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> Cargando…
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {rows.length === 0 && (
            <p className="text-xs text-muted-foreground italic">Sin valores registrados.</p>
          )}
          {rows.map((r) => (
            <span
              key={r.id}
              className="inline-flex items-center gap-1.5 bg-muted text-foreground text-xs px-2.5 py-1 rounded-full"
            >
              {r.value}
              <button
                onClick={() => handleDelete(r)}
                className="text-muted-foreground hover:text-destructive transition-colors"
                aria-label={`Eliminar ${r.value}`}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <Input
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          placeholder={`Nuevo valor para ${label.toLowerCase()}…`}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
          maxLength={80}
          className="h-9 text-sm"
        />
        <Button size="sm" onClick={handleAdd} disabled={adding || !newValue.trim()} className="gap-1.5">
          {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Agregar
        </Button>
      </div>
    </div>
  );
}

export function RRPPConfigSection() {
  return (
    <section className="animate-fade-in" style={{ animationDelay: "0.4s" }}>
      <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
        <Star className="h-4 w-4" /> RRPP
      </h3>
      <div className="bg-card rounded-lg border border-border divide-y divide-border">
        {CATEGORIES.map((c) => (
          <CategoryEditor key={c.key} category={c.key} label={c.label} icon={c.icon} hint={c.hint} />
        ))}
      </div>
    </section>
  );
}
