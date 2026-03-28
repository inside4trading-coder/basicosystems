import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Card } from "@/components/ui/card";
import { Plus, Trash2, Loader2, Save, ChevronDown, Users, Filter, Ban } from "lucide-react";
import { toast } from "sonner";

// --- Types ---

type FieldType = "number" | "date" | "text" | "array" | "status";

interface FieldDef {
  value: string;
  label: string;
  type: FieldType;
  column: string; // actual DB column in customers_cache
}

const FIELDS: FieldDef[] = [
  { value: "total_orders", label: "Nº compras", type: "number", column: "orders_count" },
  { value: "total_spent", label: "Total gastado ($)", type: "number", column: "total_spent" },
  { value: "last_order_date", label: "Última compra", type: "date", column: "last_order_date" },
  { value: "city", label: "Ciudad", type: "text", column: "billing_city" },
  { value: "country", label: "País", type: "text", column: "billing_country" },
  { value: "state", label: "Estado/Región", type: "text", column: "billing_state" },
  { value: "created_at", label: "Fecha de registro", type: "date", column: "date_created" },
];

const OPERATORS: Record<FieldType, { value: string; label: string }[]> = {
  number: [
    { value: "gt", label: "Mayor que" },
    { value: "lt", label: "Menor que" },
    { value: "eq", label: "Igual a" },
    { value: "between", label: "Entre" },
  ],
  date: [
    { value: "less_than_days", label: "Hace menos de X días" },
    { value: "more_than_days", label: "Hace más de X días" },
    { value: "between_dates", label: "Entre fechas" },
  ],
  text: [
    { value: "contains", label: "Contiene" },
    { value: "not_contains", label: "No contiene" },
    { value: "equals", label: "Es igual a" },
  ],
  array: [
    { value: "contains", label: "Contiene" },
    { value: "not_contains", label: "No contiene" },
  ],
  status: [
    { value: "equals", label: "Es igual a" },
  ],
};

export interface Condition {
  id: string;
  field: string;
  operator: string;
  value: string;
  value2?: string; // for "between"
  logic: "AND" | "OR";
}

export interface SegmentFilter {
  conditions: Condition[];
  exclusions: Condition[];
  logic: "AND" | "OR";
}

interface SegmentBuilderProps {
  onFilterChange: (filter: SegmentFilter, count: number | null) => void;
  initialFilter?: SegmentFilter;
}

const createCondition = (): Condition => ({
  id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
  field: "total_orders",
  operator: "gt",
  value: "",
  logic: "AND",
});

function getFieldDef(fieldValue: string): FieldDef {
  return FIELDS.find((f) => f.value === fieldValue) || FIELDS[0];
}

// --- Condition Row ---

function ConditionRow({
  condition,
  index,
  onChange,
  onRemove,
  showLogic,
}: {
  condition: Condition;
  index: number;
  onChange: (c: Condition) => void;
  onRemove: () => void;
  showLogic: boolean;
}) {
  const fieldDef = getFieldDef(condition.field);
  const operators = OPERATORS[fieldDef.type] || OPERATORS.text;

  const handleFieldChange = (newField: string) => {
    const newDef = getFieldDef(newField);
    const newOps = OPERATORS[newDef.type] || OPERATORS.text;
    onChange({ ...condition, field: newField, operator: newOps[0].value, value: "", value2: "" });
  };

  return (
    <div className="space-y-2">
      {showLogic && (
        <div className="flex items-center justify-center">
          <button
            onClick={() => onChange({ ...condition, logic: condition.logic === "AND" ? "OR" : "AND" })}
            className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-border hover:bg-accent transition-colors"
          >
            {condition.logic}
          </button>
        </div>
      )}
      <div className="flex items-center gap-2 bg-muted/30 rounded-lg p-2 border border-border">
        {/* Field */}
        <Select value={condition.field} onValueChange={handleFieldChange}>
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FIELDS.map((f) => (
              <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Operator */}
        <Select value={condition.operator} onValueChange={(v) => onChange({ ...condition, operator: v })}>
          <SelectTrigger className="w-[180px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {operators.map((op) => (
              <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Value(s) */}
        <Input
          className="h-8 text-xs flex-1 min-w-[80px]"
          type={fieldDef.type === "number" ? "number" : fieldDef.type === "date" && condition.operator === "between_dates" ? "date" : "text"}
          placeholder={fieldDef.type === "date" && !condition.operator.includes("dates") ? "Días" : "Valor"}
          value={condition.value}
          onChange={(e) => onChange({ ...condition, value: e.target.value })}
        />

        {(condition.operator === "between" || condition.operator === "between_dates") && (
          <>
            <span className="text-xs text-muted-foreground">y</span>
            <Input
              className="h-8 text-xs flex-1 min-w-[80px]"
              type={fieldDef.type === "number" ? "number" : "date"}
              placeholder="Valor 2"
              value={condition.value2 || ""}
              onChange={(e) => onChange({ ...condition, value2: e.target.value })}
            />
          </>
        )}

        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive hover:text-destructive" onClick={onRemove}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// --- Main Component ---

export default function SegmentBuilder({ onFilterChange, initialFilter }: SegmentBuilderProps) {
  const [conditions, setConditions] = useState<Condition[]>(
    initialFilter?.conditions?.length ? initialFilter.conditions : [createCondition()]
  );
  const [exclusions, setExclusions] = useState<Condition[]>(initialFilter?.exclusions || []);
  const [showExclusions, setShowExclusions] = useState(initialFilter?.exclusions?.length ? true : false);
  const [counting, setCounting] = useState(false);
  const [matchCount, setMatchCount] = useState<number | null>(null);

  // Use ref to avoid infinite loop from onFilterChange dependency
  const onFilterChangeRef = useRef(onFilterChange);
  onFilterChangeRef.current = onFilterChange;

  // Saved segments
  const [savedSegments, setSavedSegments] = useState<{ id: string; name: string; filters: any }[]>([]);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);
  const [showSaveInput, setShowSaveInput] = useState(false);

  // Load saved segments on mount
  useEffect(() => {
    supabase
      .from("segments")
      .select("id, name, filters")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setSavedSegments(data);
      });
  }, []);

  // Build Supabase query filter from conditions
  const countMatches = useCallback(async () => {
    const hasAnyValue = conditions.some((c) => c.value.trim() !== "");
    if (!hasAnyValue && exclusions.every((c) => c.value.trim() === "")) {
      // No conditions set — count all
      const { count } = await supabase.from("customers_cache").select("*", { count: "exact", head: true }).limit(0);
      setMatchCount(count ?? 0);
      onFilterChangeRef.current({ conditions, exclusions, logic: "AND" }, count ?? 0);
      return;
    }

    setCounting(true);
    try {
      // We'll do this with a raw approach: build conditions client-side
      // For simplicity, fetch ids matching include conditions, then subtract exclusions
      let query: any = supabase.from("customers_cache").select("*", { count: "exact", head: true }).limit(0);

      // Apply inclusion conditions
      for (const c of conditions) {
        if (!c.value.trim()) continue;
        const col = getFieldDef(c.field).column;
        const fieldType = getFieldDef(c.field).type;

        if (fieldType === "number") {
          const num = parseFloat(c.value);
          if (c.operator === "gt") query = query.gt(col, num);
          else if (c.operator === "lt") query = query.lt(col, num);
          else if (c.operator === "eq") query = query.eq(col, num);
          else if (c.operator === "between" && c.value2) query = query.gte(col, num).lte(col, parseFloat(c.value2));
        } else if (fieldType === "date") {
          if (c.operator === "less_than_days") {
            const d = new Date();
            d.setDate(d.getDate() - parseInt(c.value));
            query = query.gte(col, d.toISOString());
          } else if (c.operator === "more_than_days") {
            const d = new Date();
            d.setDate(d.getDate() - parseInt(c.value));
            query = query.lte(col, d.toISOString());
          } else if (c.operator === "between_dates" && c.value2) {
            query = query.gte(col, c.value).lte(col, c.value2);
          }
        } else if (fieldType === "text" || fieldType === "array") {
          if (c.operator === "contains") query = query.ilike(col, `%${c.value}%`);
          else if (c.operator === "not_contains") query = query.not(col, "ilike", `%${c.value}%`);
          else if (c.operator === "equals") query = query.eq(col, c.value);
        }
      }

      const { count, error } = await query;
      if (error) throw error;

      // For exclusions, we'd need a more complex approach
      // For now, estimate by subtracting exclusion count
      let excludeCount = 0;
      if (exclusions.some((c) => c.value.trim())) {
        let exQuery: any = supabase.from("customers_cache").select("*", { count: "exact", head: true }).limit(0);
        for (const c of exclusions) {
          if (!c.value.trim()) continue;
          const col = getFieldDef(c.field).column;
          const fieldType = getFieldDef(c.field).type;

          if (fieldType === "number") {
            const num = parseFloat(c.value);
            if (c.operator === "gt") exQuery = exQuery.gt(col, num);
            else if (c.operator === "lt") exQuery = exQuery.lt(col, num);
            else if (c.operator === "eq") exQuery = exQuery.eq(col, num);
            else if (c.operator === "between" && c.value2) exQuery = exQuery.gte(col, num).lte(col, parseFloat(c.value2));
          } else if (fieldType === "date") {
            if (c.operator === "less_than_days") {
              const d = new Date();
              d.setDate(d.getDate() - parseInt(c.value));
              exQuery = exQuery.gte(col, d.toISOString());
            } else if (c.operator === "more_than_days") {
              const d = new Date();
              d.setDate(d.getDate() - parseInt(c.value));
              exQuery = exQuery.lte(col, d.toISOString());
            } else if (c.operator === "between_dates" && c.value2) {
              exQuery = exQuery.gte(col, c.value).lte(col, c.value2);
            }
          } else {
            if (c.operator === "contains") exQuery = exQuery.ilike(col, `%${c.value}%`);
            else if (c.operator === "not_contains") exQuery = exQuery.not(col, "ilike", `%${c.value}%`);
            else if (c.operator === "equals") exQuery = exQuery.eq(col, c.value);
          }
        }
        const { count: exCount } = await exQuery;
        excludeCount = exCount ?? 0;
      }

      const finalCount = Math.max(0, (count ?? 0) - excludeCount);
      setMatchCount(finalCount);
      onFilterChangeRef.current({ conditions, exclusions, logic: "AND" }, finalCount);
    } catch (err) {
      console.error("Count error:", err);
      setMatchCount(null);
    }
    setCounting(false);
  }, [conditions, exclusions]);

  // Debounced count
  useEffect(() => {
    const timer = setTimeout(() => { countMatches(); }, 600);
    return () => clearTimeout(timer);
  }, [countMatches]);

  const updateCondition = (id: string, updated: Condition, list: "include" | "exclude") => {
    if (list === "include") setConditions((prev) => prev.map((c) => (c.id === id ? updated : c)));
    else setExclusions((prev) => prev.map((c) => (c.id === id ? updated : c)));
  };

  const removeCondition = (id: string, list: "include" | "exclude") => {
    if (list === "include") setConditions((prev) => prev.filter((c) => c.id !== id));
    else setExclusions((prev) => prev.filter((c) => c.id !== id));
  };

  const loadSegment = (segId: string) => {
    const seg = savedSegments.find((s) => s.id === segId);
    if (!seg) return;
    const f = seg.filters as SegmentFilter;
    setConditions(f.conditions?.length ? f.conditions : [createCondition()]);
    setExclusions(f.exclusions || []);
    setShowExclusions(!!(f.exclusions?.length));
    toast.success(`Segmento "${seg.name}" cargado`);
  };

  const saveSegment = async () => {
    if (!saveName.trim()) return;
    setSaving(true);
    try {
      const filter: SegmentFilter = { conditions, exclusions, logic: "AND" };
      const insertPayload: any = { name: saveName, filters: filter, customer_count: matchCount ?? 0 };
      const { data, error } = await supabase
        .from("segments")
        .insert(insertPayload)
        .select("id, name, filters")
        .single();
      if (error) throw error;
      setSavedSegments((prev) => [data, ...prev]);
      setSaveName("");
      setShowSaveInput(false);
      toast.success("Segmento guardado");
    } catch (err: any) {
      toast.error(err.message || "Error guardando segmento");
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      {/* Saved segments loader */}
      {savedSegments.length > 0 && (
        <div>
          <Label className="text-xs font-bold uppercase tracking-wider">Cargar segmento guardado</Label>
          <Select onValueChange={loadSegment}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Seleccionar segmento..." />
            </SelectTrigger>
            <SelectContent>
              {savedSegments.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Inclusion conditions */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-primary" />
          <Label className="text-xs font-bold uppercase tracking-wider">Condiciones de inclusión</Label>
        </div>

        <div className="space-y-2">
          {conditions.map((c, i) => (
            <ConditionRow
              key={c.id}
              condition={c}
              index={i}
              onChange={(updated) => updateCondition(c.id, updated, "include")}
              onRemove={() => removeCondition(c.id, "include")}
              showLogic={i > 0}
            />
          ))}
        </div>

        <Button
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={() => setConditions((prev) => [...prev, createCondition()])}
        >
          <Plus className="h-3.5 w-3.5 mr-1" /> Añadir condición
        </Button>
      </div>

      {/* Real-time counter */}
      <Card className="p-4 bg-muted/30 border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            {counting ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Calculando...</span>
              </div>
            ) : (
              <span className="text-sm font-bold">
                {matchCount !== null ? `${matchCount.toLocaleString()} contactos coinciden` : "Añade condiciones para filtrar"}
              </span>
            )}
          </div>
          {matchCount !== null && !counting && (
            <Badge variant="outline" className="bg-primary/10 text-primary text-xs">
              {matchCount.toLocaleString()}
            </Badge>
          )}
        </div>
      </Card>

      {/* Exclusions */}
      <Collapsible open={showExclusions} onOpenChange={setShowExclusions}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground hover:text-foreground">
            <div className="flex items-center gap-2">
              <Ban className="h-3.5 w-3.5" />
              <span className="text-xs font-bold uppercase tracking-wider">Excluir contactos</span>
            </div>
            <ChevronDown className={`h-4 w-4 transition-transform ${showExclusions ? "rotate-180" : ""}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2 space-y-2">
          {exclusions.map((c, i) => (
            <ConditionRow
              key={c.id}
              condition={c}
              index={i}
              onChange={(updated) => updateCondition(c.id, updated, "exclude")}
              onRemove={() => removeCondition(c.id, "exclude")}
              showLogic={i > 0}
            />
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExclusions((prev) => [...prev, createCondition()])}
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Añadir exclusión
          </Button>
        </CollapsibleContent>
      </Collapsible>

      {/* Save segment */}
      <div className="flex items-center gap-2">
        {showSaveInput ? (
          <>
            <Input
              className="h-8 text-xs flex-1"
              placeholder="Nombre del segmento..."
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveSegment()}
            />
            <Button size="sm" onClick={saveSegment} disabled={saving || !saveName.trim()}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
              Guardar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowSaveInput(false); setSaveName(""); }}>
              Cancelar
            </Button>
          </>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setShowSaveInput(true)}>
            <Save className="h-3.5 w-3.5 mr-1" /> Guardar segmento
          </Button>
        )}
      </div>
    </div>
  );
}
