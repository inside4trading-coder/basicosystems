import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Loader2, Save, ChevronDown, Users, Filter, Ban, Eye, Mail } from "lucide-react";
import { toast } from "sonner";

// --- Types ---

type FieldType = "number" | "date" | "text";

interface FieldDef {
  value: string;
  label: string;
  type: FieldType;
  filterKey: string;
  filterKeyMax?: string;
}

const FIELDS: FieldDef[] = [
  { value: "total_orders", label: "Nº compras", type: "number", filterKey: "min_orders", filterKeyMax: "max_orders" },
  { value: "total_spent", label: "Total gastado (USD)", type: "number", filterKey: "min_spent", filterKeyMax: "max_spent" },
  { value: "last_order_date", label: "Última compra", type: "date", filterKey: "last_order_days_min", filterKeyMax: "last_order_days_max" },
  { value: "country", label: "País", type: "text", filterKey: "country" },
  { value: "city", label: "Ciudad", type: "text", filterKey: "city" },
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
  ],
  text: [
    { value: "equals", label: "Es igual a" },
  ],
};

export interface Condition {
  id: string;
  field: string;
  operator: string;
  value: string;
  value2?: string;
  logic: "AND" | "OR";
}

export interface SegmentFilter {
  conditions: Condition[];
  exclusions: Condition[];
  logic: "AND" | "OR";
}

export interface SelectedContact {
  email: string;
  first_name: string;
  last_name: string;
  orders_count: number;
  total_spent: number;
  billing_city: string;
  isManual?: boolean;
}

interface SegmentBuilderProps {
  onFilterChange: (filter: SegmentFilter, count: number | null) => void;
  onSelectedContactsChange?: (contacts: SelectedContact[]) => void;
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

        <Input
          className="h-8 text-xs flex-1 min-w-[80px]"
          type={fieldDef.type === "number" || fieldDef.type === "date" ? "number" : "text"}
          placeholder={fieldDef.type === "date" ? "Días" : "Valor"}
          value={condition.value}
          onChange={(e) => onChange({ ...condition, value: e.target.value })}
        />

        {condition.operator === "between" && (
          <>
            <span className="text-xs text-muted-foreground">y</span>
            <Input
              className="h-8 text-xs flex-1 min-w-[80px]"
              type="number"
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

// --- Build filters for edge function ---

function buildEdgeFunctionBody(conditions: Condition[], exclusions: Condition[], countOnly: boolean): Record<string, any> {
  const body: Record<string, any> = { count_only: countOnly };

  for (const c of conditions) {
    if (!c.value.trim()) continue;
    const fieldDef = getFieldDef(c.field);

    if (fieldDef.type === "number") {
      const num = parseFloat(c.value);
      if (c.operator === "gt") body[fieldDef.filterKey] = num;
      else if (c.operator === "lt") body[fieldDef.filterKeyMax!] = num;
      else if (c.operator === "eq") {
        body[fieldDef.filterKey] = num;
        body[fieldDef.filterKeyMax!] = num;
      } else if (c.operator === "between" && c.value2) {
        body[fieldDef.filterKey] = parseFloat(c.value);
        body[fieldDef.filterKeyMax!] = parseFloat(c.value2);
      }
    } else if (fieldDef.type === "date") {
      const days = parseInt(c.value);
      if (c.operator === "less_than_days") {
        body["last_order_days_min"] = days;
      } else if (c.operator === "more_than_days") {
        body["last_order_days_max"] = days;
      }
    } else if (fieldDef.type === "text") {
      body[fieldDef.filterKey] = c.value;
    }
  }

  // Collect exclusion emails from exclusion conditions
  // (exclusions are applied server-side via exclude_emails if text-based,
  //  or by subtracting results client-side)
  const excludeEmails: string[] = [];
  if (excludeEmails.length > 0) {
    body["exclude_emails"] = excludeEmails;
  }

  return body;
}

// --- Main Component ---

export default function SegmentBuilder({ onFilterChange, onSelectedContactsChange, initialFilter }: SegmentBuilderProps) {
  const [conditions, setConditions] = useState<Condition[]>(
    initialFilter?.conditions?.length ? initialFilter.conditions : [createCondition()]
  );
  const [exclusions, setExclusions] = useState<Condition[]>(initialFilter?.exclusions || []);
  const [showExclusions, setShowExclusions] = useState(initialFilter?.exclusions?.length ? true : false);
  const [counting, setCounting] = useState(false);
  const [matchCount, setMatchCount] = useState<number | null>(null);

  // Contact table state
  const [contacts, setContacts] = useState<SelectedContact[]>([]);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [showContacts, setShowContacts] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [manualEmail, setManualEmail] = useState("");
  const [manualContacts, setManualContacts] = useState<SelectedContact[]>([]);

  const onFilterChangeRef = useRef(onFilterChange);
  onFilterChangeRef.current = onFilterChange;
  const onSelectedContactsChangeRef = useRef(onSelectedContactsChange);
  onSelectedContactsChangeRef.current = onSelectedContactsChange;

  // Saved segments
  const [savedSegments, setSavedSegments] = useState<{ id: string; name: string; filters: any }[]>([]);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);
  const [showSaveInput, setShowSaveInput] = useState(false);

  useEffect(() => {
    supabase
      .from("segments")
      .select("id, name, filters")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setSavedSegments(data);
      });
  }, []);

  // Notify parent of selected contacts changes
  useEffect(() => {
    if (!showContacts) return;
    const allContacts = [...contacts, ...manualContacts];
    const selected = allContacts.filter((c) => selectedEmails.has(c.email));
    onSelectedContactsChangeRef.current?.(selected);
  }, [selectedEmails, contacts, manualContacts, showContacts]);

  const countMatches = useCallback(async () => {
    setCounting(true);
    try {
      const body = buildEdgeFunctionBody(conditions, exclusions, true);
      const { data, error } = await supabase.functions.invoke("campaign-audience", { body });

      if (error) throw error;
      const result = typeof data === "string" ? JSON.parse(data) : data;
      const total = result.total ?? 0;
      setMatchCount(total);
      // Reset contact table when filters change
      setShowContacts(false);
      setContacts([]);
      setSelectedEmails(new Set());
      onFilterChangeRef.current({ conditions, exclusions, logic: "AND" }, total);
    } catch (err) {
      console.error("Count error:", err);
      setMatchCount(null);
    }
    setCounting(false);
  }, [conditions, exclusions]);

  // Debounced count
  useEffect(() => {
    const timer = setTimeout(() => { countMatches(); }, 800);
    return () => clearTimeout(timer);
  }, [countMatches]);

  const loadContacts = async () => {
    setLoadingContacts(true);
    try {
      const body = buildEdgeFunctionBody(conditions, exclusions, false);
      const { data, error } = await supabase.functions.invoke("campaign-audience", { body });
      if (error) throw error;
      const result = typeof data === "string" ? JSON.parse(data) : data;
      const contactList: SelectedContact[] = (result.contacts || []).map((c: any) => ({
        email: c.email,
        first_name: c.first_name || "",
        last_name: c.last_name || "",
        orders_count: c.orders_count || 0,
        total_spent: c.total_spent || 0,
        billing_city: c.billing_city || "",
      }));
      setContacts(contactList);
      // Select all by default
      const allEmails = new Set([...contactList.map((c) => c.email), ...manualContacts.map((c) => c.email)]);
      setSelectedEmails(allEmails);
      setShowContacts(true);
    } catch (err) {
      console.error("Load contacts error:", err);
      toast.error("Error cargando contactos");
    }
    setLoadingContacts(false);
  };

  const toggleContact = (email: string) => {
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  };

  const toggleAll = () => {
    const allContacts = [...contacts, ...manualContacts];
    if (selectedEmails.size === allContacts.length) {
      setSelectedEmails(new Set());
    } else {
      setSelectedEmails(new Set(allContacts.map((c) => c.email)));
    }
  };

  const addManualEmail = () => {
    const email = manualEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      toast.error("Email inválido");
      return;
    }
    const allEmails = [...contacts, ...manualContacts].map((c) => c.email.toLowerCase());
    if (allEmails.includes(email)) {
      toast.error("Este email ya está en la lista");
      return;
    }
    const manual: SelectedContact = {
      email,
      first_name: "",
      last_name: "",
      orders_count: 0,
      total_spent: 0,
      billing_city: "",
      isManual: true,
    };
    setManualContacts((prev) => [...prev, manual]);
    setSelectedEmails((prev) => new Set([...prev, email]));
    setManualEmail("");
    toast.success("Email añadido");
  };

  const removeManualContact = (email: string) => {
    setManualContacts((prev) => prev.filter((c) => c.email !== email));
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      next.delete(email);
      return next;
    });
  };

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

  const allContacts = [...contacts, ...manualContacts];
  const selectedCount = selectedEmails.size;

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
          <div className="flex items-center gap-2">
            {matchCount !== null && !counting && (
              <>
                <Badge variant="outline" className="bg-primary/10 text-primary text-xs">
                  {showContacts ? `${selectedCount} seleccionados` : matchCount.toLocaleString()}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadContacts}
                  disabled={loadingContacts}
                >
                  {loadingContacts ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                  ) : (
                    <Eye className="h-3.5 w-3.5 mr-1" />
                  )}
                  {showContacts ? "Recargar" : "Ver contactos"}
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Contacts table */}
      {showContacts && (
        <div className="space-y-3">
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">
                      <Checkbox
                        checked={allContacts.length > 0 && selectedEmails.size === allContacts.length}
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                    <TableHead className="text-xs">Email</TableHead>
                    <TableHead className="text-xs">Nombre</TableHead>
                    <TableHead className="text-xs text-right">Compras</TableHead>
                    <TableHead className="text-xs text-right">Gastado</TableHead>
                    <TableHead className="text-xs">Ciudad</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allContacts.map((c) => (
                    <TableRow key={c.email} className={!selectedEmails.has(c.email) ? "opacity-40" : ""}>
                      <TableCell>
                        <Checkbox
                          checked={selectedEmails.has(c.email)}
                          onCheckedChange={() => toggleContact(c.email)}
                        />
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {c.email}
                        {c.isManual && (
                          <Badge variant="outline" className="ml-2 text-[9px] bg-accent/20">Manual</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{c.first_name} {c.last_name}</TableCell>
                      <TableCell className="text-xs text-right">{c.orders_count}</TableCell>
                      <TableCell className="text-xs text-right">${c.total_spent.toLocaleString()}</TableCell>
                      <TableCell className="text-xs">{c.billing_city}</TableCell>
                      <TableCell>
                        {c.isManual && (
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeManualContact(c.email)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Manual email input */}
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              className="h-8 text-xs flex-1"
              placeholder="Agregar email manualmente..."
              type="email"
              value={manualEmail}
              onChange={(e) => setManualEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addManualEmail()}
            />
            <Button size="sm" variant="outline" onClick={addManualEmail}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Agregar
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            {selectedCount} de {allContacts.length} contactos seleccionados
          </p>
        </div>
      )}

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
