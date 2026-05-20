import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  History,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAdminData } from "@/hooks/useAdminData";
import { useAdminScope } from "@/contexts/AdminScope";
import type { ImportanceLevel, Obligation, ObligationFrequency, ObligationInstance } from "@/types/admin";
import {
  ALL_IMPORTANCE,
  IMPORTANCE_BADGE,
  IMPORTANCE_LABEL,
  STATUS_BADGE,
  STATUS_LABEL,
  URGENCY_BADGE,
  URGENCY_LABEL,
  fmtMoney,
  relativeDate,
} from "@/components/admin/adminConstants";
import { MarkPaidDialog } from "@/components/admin/MarkPaidDialog";
import { NewInstanceSheet } from "@/components/admin/NewInstanceSheet";
import { AdminDetailHeaderSkeleton } from "@/components/admin/AdminSkeletons";
import { parseLocalDate } from "@/lib/dateUtils";

const FREQUENCIES: { value: ObligationFrequency; label: string }[] = [
  { value: "unica", label: "Única" },
  { value: "semanal", label: "Semanal" },
  { value: "quincenal", label: "Quincenal" },
  { value: "mensual", label: "Mensual" },
  { value: "bimestral", label: "Bimestral" },
  { value: "trimestral", label: "Trimestral" },
  { value: "semestral", label: "Semestral" },
  { value: "anual", label: "Anual" },
];

const TEMPLATE_STATUS_LABEL: Record<string, string> = {
  active: "Activa",
  paused: "Pausada",
  cancelled: "Anulada",
};

const TEMPLATE_STATUS_BADGE: Record<string, string> = {
  active: "status-badge-success",
  paused: "status-badge-warning",
  cancelled: "status-badge-inactive",
};

type AuditEntry = {
  id: string;
  action: string;
  field_changed: string | null;
  old_value: string | null;
  new_value: string | null;
  performed_by: string | null;
  created_at: string;
};

export default function AdminObligationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    fetchObligation,
    fetchInstancesByObligation,
    fetchAuditLog,
    updateObligation,
    updateInstance,
  } = useAdminData();

  const [obligation, setObligation] = useState<Obligation | null>(null);
  const [instances, setInstances] = useState<ObligationInstance[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<Obligation>>({});
  const [saving, setSaving] = useState(false);

  const [paidTarget, setPaidTarget] = useState<ObligationInstance | null>(null);
  const [newInstanceOpen, setNewInstanceOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [ob, inst, log] = await Promise.all([
        fetchObligation(id),
        fetchInstancesByObligation(id),
        fetchAuditLog(id),
      ]);
      setObligation(ob);
      setInstances(inst);
      setAudit(log);
    } catch (e: any) {
      setError(e?.message ?? "Error cargando obligación");
    } finally {
      setLoading(false);
    }
  }, [id, fetchObligation, fetchInstancesByObligation, fetchAuditLog]);

  useEffect(() => {
    load();
  }, [load]);

  const startEdit = () => {
    if (!obligation) return;
    setDraft({ ...obligation });
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraft({});
  };

  const saveEdit = async () => {
    if (!obligation) return;
    setSaving(true);
    try {
      const patch: Partial<Obligation> = {
        name: draft.name?.trim() || obligation.name,
        category: draft.category ?? obligation.category,
        provider: draft.provider ?? obligation.provider,
        amount: Number(draft.amount ?? obligation.amount) || 0,
        currency: draft.currency ?? obligation.currency,
        frequency: (draft.frequency ?? obligation.frequency) as ObligationFrequency,
        due_day: draft.due_day === null || draft.due_day === undefined
          ? null
          : Number(draft.due_day) || null,
        importance: (draft.importance ?? obligation.importance) as ImportanceLevel,
        responsible: draft.responsible ?? obligation.responsible,
        payment_method: draft.payment_method ?? obligation.payment_method,
        notes: draft.notes ?? obligation.notes,
      };
      await updateObligation(obligation.id, patch);
      toast.success("Obligación actualizada");
      setEditing(false);
      setDraft({});
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (status: "active" | "paused" | "cancelled") => {
    if (!obligation) return;
    try {
      await updateObligation(obligation.id, { status });
      toast.success(
        status === "active" ? "Obligación reactivada" :
        status === "paused" ? "Obligación pausada" : "Obligación anulada"
      );
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Error");
    }
  };

  const annulInstance = async (inst: ObligationInstance) => {
    try {
      await updateInstance(inst.id, { status: "anulado" });
      toast.success("Instancia anulada");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Error");
    }
  };

  if (loading) {
    return <AdminDetailHeaderSkeleton />;
  }

  if (error || !obligation) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/administracion")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Administración
        </Button>
        <Card>
          <CardContent className="pt-6 text-sm text-status-error">
            {error ?? "Obligación no encontrada"}
          </CardContent>
        </Card>
      </div>
    );
  }

  const v = (k: keyof Obligation) => (editing ? (draft[k] ?? obligation[k]) : obligation[k]);

  return (
    <div className="space-y-6">
      {/* Back nav */}
      <Link
        to="/administracion"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Administración
      </Link>

      {/* Header */}
      <div className="kpi-card">
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-start sm:justify-between gap-3 sm:gap-4">
          <div className="flex-1 min-w-0 space-y-2">
            {editing ? (
              <Input
                value={String(v("name") ?? "")}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="text-xl font-black h-auto py-2"
                maxLength={120}
              />
            ) : (
              <h1 className="text-lg sm:text-xl font-black tracking-tight flex items-center gap-2">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                {obligation.name}
              </h1>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{obligation.category}</Badge>
              <Badge variant="outline" className="capitalize">{obligation.frequency}</Badge>
              <span className={IMPORTANCE_BADGE[obligation.importance]}>
                {IMPORTANCE_LABEL[obligation.importance]}
              </span>
              <span className={TEMPLATE_STATUS_BADGE[obligation.status] ?? "status-badge-inactive"}>
                {TEMPLATE_STATUS_LABEL[obligation.status] ?? obligation.status}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              {obligation.provider && <span>{obligation.provider}</span>}
              {obligation.responsible && (
                <span className="inline-flex items-center gap-1">
                  <User className="h-3.5 w-3.5" /> {obligation.responsible}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <Button variant="outline" onClick={cancelEdit} disabled={saving}>
                  <X className="h-4 w-4 mr-1" /> Cancelar
                </Button>
                <Button variant="brand" onClick={saveEdit} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                  Guardar
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={startEdit}>
                  <Pencil className="h-4 w-4 mr-1" /> Editar
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setNewInstanceOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" /> Nueva instancia
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {obligation.status !== "paused" && (
                      <DropdownMenuItem onClick={() => setStatus("paused")}>Pausar obligación</DropdownMenuItem>
                    )}
                    {obligation.status !== "active" && (
                      <DropdownMenuItem onClick={() => setStatus("active")}>Reactivar</DropdownMenuItem>
                    )}
                    {obligation.status !== "cancelled" && (
                      <DropdownMenuItem
                        onClick={() => setStatus("cancelled")}
                        className="text-status-error focus:text-status-error"
                      >
                        Anular
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Template data */}
      <Card>
        <CardContent className="pt-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground mb-4">
            Datos de la plantilla
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Nombre">
              {editing ? (
                <Input value={String(v("name") ?? "")} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              ) : (<span>{obligation.name}</span>)}
            </Field>
            <Field label="Categoría">
              {editing ? (
                <Input value={String(v("category") ?? "")} onChange={(e) => setDraft({ ...draft, category: e.target.value })} />
              ) : (<span>{obligation.category}</span>)}
            </Field>
            <Field label="Proveedor">
              {editing ? (
                <Input value={String(v("provider") ?? "")} onChange={(e) => setDraft({ ...draft, provider: e.target.value })} />
              ) : (<span>{obligation.provider || "—"}</span>)}
            </Field>
            <Field label="Monto base">
              {editing ? (
                <Input
                  type="number"
                  step="0.01"
                  value={String(v("amount") ?? 0)}
                  onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) })}
                />
              ) : (<span className="font-semibold tabular-nums">{fmtMoney(obligation.amount, obligation.currency)}</span>)}
            </Field>
            <Field label="Moneda">
              {editing ? (
                <Select
                  value={String(v("currency") ?? "USD")}
                  onValueChange={(val) => setDraft({ ...draft, currency: val })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="VES">VES</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
              ) : (<span>{obligation.currency}</span>)}
            </Field>
            <Field label="Frecuencia">
              {editing ? (
                <Select
                  value={String(v("frequency") ?? "mensual")}
                  onValueChange={(val) => setDraft({ ...draft, frequency: val as ObligationFrequency })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FREQUENCIES.map((f) => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (<span className="capitalize">{obligation.frequency}</span>)}
            </Field>
            <Field label="Día de vencimiento">
              {editing ? (
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={String(v("due_day") ?? "")}
                  onChange={(e) =>
                    setDraft({ ...draft, due_day: e.target.value === "" ? null : Number(e.target.value) })
                  }
                />
              ) : (<span>{obligation.due_day ?? "—"}</span>)}
            </Field>
            <Field label="Importancia">
              {editing ? (
                <Select
                  value={String(v("importance") ?? "media")}
                  onValueChange={(val) => setDraft({ ...draft, importance: val as ImportanceLevel })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ALL_IMPORTANCE.map((i) => (
                      <SelectItem key={i} value={i}>{IMPORTANCE_LABEL[i]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span className={IMPORTANCE_BADGE[obligation.importance]}>{IMPORTANCE_LABEL[obligation.importance]}</span>
              )}
            </Field>
            <Field label="Responsable">
              {editing ? (
                <Input value={String(v("responsible") ?? "")} onChange={(e) => setDraft({ ...draft, responsible: e.target.value })} />
              ) : (<span>{obligation.responsible || "—"}</span>)}
            </Field>
            <Field label="Método de pago habitual">
              {editing ? (
                <Input value={String(v("payment_method") ?? "")} onChange={(e) => setDraft({ ...draft, payment_method: e.target.value })} />
              ) : (<span>{obligation.payment_method || "—"}</span>)}
            </Field>
            <div className="md:col-span-2">
              <Field label="Notas">
                {editing ? (
                  <Textarea
                    value={String(v("notes") ?? "")}
                    onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                    rows={3}
                    maxLength={2000}
                  />
                ) : (<span className="text-sm whitespace-pre-wrap">{obligation.notes || "—"}</span>)}
              </Field>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Instances history */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
              Historial de instancias ({instances.length})
            </h2>
            <Button variant="brand" size="sm" onClick={() => setNewInstanceOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Nueva instancia
            </Button>
          </div>

          {instances.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <ClipboardList className="h-10 w-10 mx-auto text-muted-foreground" />
              <div className="text-sm font-semibold">Sin instancias registradas</div>
              <Button variant="brand" size="sm" onClick={() => setNewInstanceOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Crear primera instancia
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Período</TableHead>
                    <TableHead>Vencimiento</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Urgencia</TableHead>
                    <TableHead>Pagado por</TableHead>
                    <TableHead>Referencia</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {instances.map((inst) => (
                    <TableRow key={inst.id}>
                      <TableCell className="font-medium">{inst.period_label}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {parseLocalDate(inst.due_date).toLocaleDateString("es-VE", { day: "2-digit", month: "short" })}
                        </div>
                        <div className="text-xs text-muted-foreground">{relativeDate(inst.due_date)}</div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">
                        {fmtMoney(inst.amount, inst.currency)}
                      </TableCell>
                      <TableCell>
                        <span className={STATUS_BADGE[inst.status]}>{STATUS_LABEL[inst.status]}</span>
                      </TableCell>
                      <TableCell>
                        {inst.urgency && inst.status !== "pagado" ? (
                          <span className={URGENCY_BADGE[inst.urgency]}>{URGENCY_LABEL[inst.urgency]}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{inst.paid_by || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{inst.payment_reference || "—"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {inst.status !== "pagado" && inst.status !== "anulado" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setPaidTarget(inst)}
                              className="text-status-success hover:text-status-success"
                            >
                              <CheckCircle className="h-4 w-4 mr-1" /> Pagar
                            </Button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {inst.status !== "anulado" && (
                                <DropdownMenuItem
                                  onClick={() => annulInstance(inst)}
                                  className="text-status-error focus:text-status-error"
                                >
                                  Anular instancia
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Audit trail */}
      <Card>
        <Collapsible open={auditOpen} onOpenChange={setAuditOpen}>
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
                  Auditoría ({audit.length})
                </span>
              </div>
              {auditOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-6 pb-6">
              {audit.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin actividad registrada</p>
              ) : (
                <div className="space-y-2">
                  {audit.map((a) => (
                    <div key={a.id} className="flex items-start gap-3 text-sm border-l-2 border-border pl-3 py-1">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{a.action}</div>
                        {a.new_value && (
                          <div className="text-xs text-muted-foreground truncate">{a.new_value}</div>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(a.created_at).toLocaleString("es-VE")}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      <MarkPaidDialog
        instance={paidTarget}
        open={!!paidTarget}
        onOpenChange={(v) => !v && setPaidTarget(null)}
        onSaved={async () => {
          setPaidTarget(null);
          await load();
        }}
      />

      <NewInstanceSheet
        obligation={obligation}
        open={newInstanceOpen}
        onOpenChange={setNewInstanceOpen}
        onCreated={load}
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      <div className="text-sm">{children}</div>
    </div>
  );
}
