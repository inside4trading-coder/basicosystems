import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScanLine, Camera, Search, X, CheckCircle2, AlertTriangle, History, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { logCoreAudit } from "@/lib/coreAudit";
import { UnitInventorySection } from "@/components/core/UnitInventorySection";
import { useCameraTapFocus } from "@/hooks/useCameraTapFocus";
import { useCameraControls, SCANNER_VIDEO_CONSTRAINTS } from "@/hooks/useCameraControls";
import { FocusRing } from "@/components/core/CameraFocusRing";

type Unit = {
  id: string;
  unit_code: string;
  status: string;
  qr_token: string | null;
  production_order_id: string;
  production_order_line_id: string | null;
  core_product_id: string | null;
  core_variant_id: string | null;
  sku: string | null;
  variant_sku: string | null;
  variant_label: string | null;
  size: string | null;
  product_name?: string | null;
};

type UnitProcess = {
  id: string;
  production_unit_id: string;
  process_name: string;
  process_type: string | null;
  process_order: number;
  adds_to_payroll: boolean;
  suggested_role: string | null;
  rate_snapshot: any;
  status: string;
  completed_at: string | null;
  completed_by_operator_id: string | null;
  scanned_by_user_id: string | null;
  notes: string | null;
};

type Operator = {
  id: string;
  first_name: string;
  last_name: string | null;
  alias: string | null;
  status: string;
  role_types: string[];
  primary_role: string | null;
  payroll_multiplier: number;
};

// Map process_type / suggested_role to factory role_type
const PROCESS_TO_ROLE: Record<string, string> = {
  corte: "cutter", cutter: "cutter", cortador: "cutter", cortadora: "cutter",
  costura: "sewer", sewer: "sewer", costurera: "sewer", costurero: "sewer",
  estampado: "printer", printer: "printer", estampador: "printer",
  bordado: "embroiderer", embroiderer: "embroiderer", bordador: "embroiderer",
  empaque: "packing", packing: "packing",
  logistica: "logistics", "logística": "logistics", logistics: "logistics",
  calidad: "quality", quality: "quality",
};
function mapToRoleType(s?: string | null): string | null {
  if (!s) return null;
  const k = s.toLowerCase().trim();
  return PROCESS_TO_ROLE[k] || null;
}

type ScanEvent = {
  id: string;
  unit_code: string | null;
  process_name: string | null;
  operator_name_snapshot: string | null;
  event_type: string;
  status: string;
  notes: string | null;
  created_at: string;
};

function extractRate(snap: any): number | null {
  if (!snap) return null;
  if (typeof snap === "number") return snap;
  if (typeof snap === "object") {
    const candidates = ["unit_cost", "rate", "amount", "value", "price", "payroll_amount", "cost"];
    for (const k of candidates) if (typeof snap[k] === "number") return snap[k];
    for (const k of candidates) if (typeof snap[k] === "string" && !isNaN(Number(snap[k]))) return Number(snap[k]);
  }
  if (typeof snap === "string" && !isNaN(Number(snap))) return Number(snap);
  return null;
}

export default function CoreScanning() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [unit, setUnit] = useState<Unit | null>(null);
  const [processes, setProcesses] = useState<UnitProcess[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [history, setHistory] = useState<ScanEvent[]>([]);
  const [recent, setRecent] = useState<ScanEvent[]>([]);
  const [manualCode, setManualCode] = useState("");
  const [loading, setLoading] = useState(false);

  // dialog: register process
  const [registerProc, setRegisterProc] = useState<UnitProcess | null>(null);
  const [operatorId, setOperatorId] = useState<string>("");
  const [noteText, setNoteText] = useState("");
  const [forceMissingRate, setForceMissingRate] = useState(false);
  const [showAllOperators, setShowAllOperators] = useState(false);
  const [confirmMismatch, setConfirmMismatch] = useState(false);

  // dialog: correction
  const [correctionProc, setCorrectionProc] = useState<UnitProcess | null>(null);
  const [correctionReason, setCorrectionReason] = useState("");
  const [correctionNote, setCorrectionNote] = useState("");

  // camera
  const [cameraOpen, setCameraOpen] = useState(false);
  const cameraDivRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<any>(null);
  const { ring, handleTapFocus, enableContinuousFocus, unsupportedMsg } = useCameraTapFocus();
  const cam = useCameraControls();
  const [camDeviceId, setCamDeviceId] = useState<string | null>(null);

  // Load active factory operators + recent scans
  useEffect(() => {
    (async () => {
      const [{ data: ops }, { data: opRoles }] = await Promise.all([
        supabase.from("core_factory_operators").select("id,first_name,last_name,alias,status,payroll_multiplier").eq("status", "active").order("first_name"),
        supabase.from("core_factory_operator_roles").select("operator_id,role_type,is_primary,status").eq("status", "active"),
      ]);
      const byOp: Record<string, { types: string[]; primary: string | null }> = {};
      for (const r of (opRoles as any[]) || []) {
        if (!byOp[r.operator_id]) byOp[r.operator_id] = { types: [], primary: null };
        byOp[r.operator_id].types.push(r.role_type);
        if (r.is_primary) byOp[r.operator_id].primary = r.role_type;
      }
      const list: Operator[] = ((ops as any[]) || []).map((o) => ({
        id: o.id, first_name: o.first_name, last_name: o.last_name, alias: o.alias, status: o.status,
        role_types: byOp[o.id]?.types || [], primary_role: byOp[o.id]?.primary || null,
        payroll_multiplier: Number(o.payroll_multiplier ?? 1.00),
      }));
      setOperators(list);

      const { data: r } = await supabase
        .from("core_production_scan_events")
        .select("id,unit_code,process_name,operator_name_snapshot,event_type,status,notes,created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      setRecent((r as ScanEvent[]) || []);
    })();
  }, []);

  // Load unit from URL ?unit=token
  useEffect(() => {
    const token = searchParams.get("unit");
    if (token) loadByToken(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function loadByToken(token: string) {
    setLoading(true);
    const trimmed = token.trim();
    // Try qr_token first, then unit_code
    let { data: u } = await supabase
      .from("core_production_units")
      .select("*")
      .eq("qr_token", trimmed)
      .maybeSingle();
    if (!u) {
      const { data: byCode } = await supabase
        .from("core_production_units")
        .select("*")
        .eq("unit_code", trimmed)
        .maybeSingle();
      u = byCode;
    }
    if (!u) {
      toast({ title: "Unidad no encontrada", description: trimmed, variant: "destructive" });
      setLoading(false);
      return;
    }
    // Enrich with real product name (variant_label/sku can be misleading e.g. "M")
    let product_name: string | null = null;
    if ((u as any).core_product_id) {
      const { data: prod } = await supabase
        .from("core_products")
        .select("name")
        .eq("id", (u as any).core_product_id)
        .maybeSingle();
      product_name = (prod as any)?.name ?? null;
    }
    setUnit({ ...(u as Unit), product_name });
    await loadProcesses((u as Unit).id);
    await loadHistory((u as Unit).id);
    setLoading(false);
  }

  async function loadProcesses(unitId: string) {
    const { data } = await supabase
      .from("core_production_unit_processes")
      .select("*")
      .eq("production_unit_id", unitId)
      .order("process_order", { ascending: true });
    setProcesses((data as UnitProcess[]) || []);
  }

  async function loadHistory(unitId: string) {
    const { data } = await supabase
      .from("core_production_scan_events")
      .select("id,unit_code,process_name,operator_name_snapshot,event_type,status,notes,created_at")
      .eq("production_unit_id", unitId)
      .order("created_at", { ascending: false });
    setHistory((data as ScanEvent[]) || []);
  }

  function extractToken(raw: string): string {
    const s = raw.trim();
    try {
      const url = new URL(s);
      const u = url.searchParams.get("unit");
      if (u) return u.trim();
    } catch { /* not absolute URL */ }
    const m = s.match(/[?&]unit=([^&\s#]+)/i);
    if (m) return decodeURIComponent(m[1]).trim();
    return s;
  }

  function openManual() {
    const v = extractToken(manualCode);
    if (!v) return;
    setSearchParams({ unit: v });
  }

  // Camera
  useEffect(() => {
    if (!cameraOpen) return;
    let cancelled = false;
    (async () => {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (cancelled || !cameraDivRef.current) return;
      const scanner = new Html5Qrcode(cameraDivRef.current.id);
      scannerRef.current = scanner;
      try {
        await scanner.start(
          (camDeviceId
            ? { deviceId: { exact: camDeviceId }, ...SCANNER_VIDEO_CONSTRAINTS }
            : { facingMode: "environment", ...SCANNER_VIDEO_CONSTRAINTS }) as any,
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decoded: string) => {
            try {
              const token = extractToken(decoded);
              setCameraOpen(false);
              setSearchParams({ unit: token });
            } catch { /* ignore */ }
          },
          () => { /* ignore decode errors */ },
        );
        setTimeout(() => {
          void enableContinuousFocus(cameraDivRef.current);
          void cam.probeCapabilities(cameraDivRef.current);
          if (cam.nearMode) void cam.applyNearMode(cameraDivRef.current, true);
        }, 600);
      } catch (e: any) {
        toast({ title: "Error de cámara", description: e?.message || String(e), variant: "destructive" });
        setCameraOpen(false);
      }
    })();
    return () => {
      cancelled = true;
      const s = scannerRef.current;
      if (s) {
        s.stop().catch(() => {}).finally(() => s.clear?.());
        scannerRef.current = null;
      }
    };
  }, [cameraOpen, camDeviceId, setSearchParams]);

  const pendingProcs = useMemo(() => processes.filter((p) => p.status === "pending"), [processes]);
  const completedProcs = useMemo(() => processes.filter((p) => p.status === "completed"), [processes]);

  const operatorById = (id: string) => operators.find((e) => e.id === id);

  function operatorFullName(op: Operator) {
    return `${op.first_name}${op.last_name ? " " + op.last_name : ""}${op.alias ? " (" + op.alias + ")" : ""}`;
  }

  async function refreshOrderCounts(orderId: string) {
    // Recompute completed/pending qty from lines based on units status
    const { data: lines } = await supabase
      .from("core_production_order_lines")
      .select("id, quantity_ordered, core_variant_id")
      .eq("production_order_id", orderId);
    if (!lines) return;
    let totalCompleted = 0;
    let totalOrdered = 0;
    for (const ln of lines as any[]) {
      const { count: completedCount } = await supabase
        .from("core_production_units")
        .select("id", { count: "exact", head: true })
        .eq("production_order_line_id", ln.id)
        .eq("status", "completed");
      const qc = completedCount || 0;
      totalCompleted += qc;
      totalOrdered += ln.quantity_ordered || 0;
      await supabase
        .from("core_production_order_lines")
        .update({
          quantity_completed: qc,
          quantity_pending: Math.max(0, (ln.quantity_ordered || 0) - qc),
        })
        .eq("id", ln.id);
    }
    const { data: ord } = await supabase
      .from("core_production_orders")
      .select("status, total_quantity")
      .eq("id", orderId)
      .maybeSingle();
    const total = ord?.total_quantity || totalOrdered;
    let newStatus = (ord as any)?.status;
    if (totalCompleted === 0) {
      newStatus = newStatus === "open" ? "open" : newStatus;
    } else if (totalCompleted >= total) {
      newStatus = "completed";
    } else {
      newStatus = "partially_completed";
    }
    await supabase
      .from("core_production_orders")
      .update({
        completed_quantity: totalCompleted,
        pending_quantity: Math.max(0, total - totalCompleted),
        status: newStatus,
      })
      .eq("id", orderId);
  }

  async function doRegister() {
    if (!unit || !registerProc) return;
    const proc = registerProc;

    // Re-check status (idempotency)
    const { data: fresh } = await supabase
      .from("core_production_unit_processes")
      .select("status")
      .eq("id", proc.id)
      .maybeSingle();
    if (fresh?.status === "completed") {
      toast({ title: "Este proceso ya fue registrado.", variant: "destructive" });
      setRegisterProc(null);
      await loadProcesses(unit.id);
      return;
    }

    const rate = extractRate(proc.rate_snapshot);
    const missingRate = proc.adds_to_payroll && (rate === null || rate === undefined);

    if (proc.adds_to_payroll && !operatorId) {
      toast({ title: "Operario obligatorio para procesos que suman a nómina.", variant: "destructive" });
      return;
    }
    // Soft warning: role mismatch
    if (operatorId) {
      const opCheck = operatorById(operatorId);
      if (opCheck && !operatorMatchesProc(opCheck, proc) && !confirmMismatch) {
        toast({
          title: "Operario sin rol sugerido",
          description: "Marca la casilla de confirmación para continuar.",
          variant: "destructive",
        });
        return;
      }
    }
    if (missingRate && !forceMissingRate) {
      toast({
        title: "Tarifa faltante",
        description: "Confirma para registrar igualmente (se marcará missing_rate).",
        variant: "destructive",
      });
      setForceMissingRate(true);
      return;
    }

    const op = operatorId ? operatorById(operatorId) : null;
    const opName = op ? operatorFullName(op) : null;
    const opRoles = op?.role_types || null;
    const { data: { user } } = await supabase.auth.getUser();

    // Insert scan event
    const { data: ev, error: evErr } = await supabase
      .from("core_production_scan_events")
      .insert({
        production_unit_id: unit.id,
        production_unit_process_id: proc.id,
        production_order_id: unit.production_order_id,
        production_order_line_id: unit.production_order_line_id,
        core_product_id: unit.core_product_id,
        core_variant_id: unit.core_variant_id,
        unit_code: unit.unit_code,
        sku: unit.sku,
        variant_sku: unit.variant_sku,
        variant_label: unit.variant_label,
        size: unit.size,
        process_name: proc.process_name,
        process_type: proc.process_type,
        process_order: proc.process_order,
        operator_id: operatorId || null,
        operator_name_snapshot: opName,
        scanned_by_user_id: user?.id || null,
        event_type: "process_completed",
        status: "valid",
        notes: noteText || null,
      })
      .select()
      .single();
    if (evErr) {
      toast({ title: "Error al registrar evento", description: evErr.message, variant: "destructive" });
      return;
    }

    // Mark process completed
    await supabase
      .from("core_production_unit_processes")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        completed_by_operator_id: operatorId || null,
        scanned_by_user_id: user?.id || null,
      })
      .eq("id", proc.id);

    // Work entry (if adds_to_payroll)
    if (proc.adds_to_payroll) {
      const payrollStatus = missingRate ? "missing_rate" : "pending";
      const multiplier = op?.payroll_multiplier ?? 1.00;
      const payrollAmount = rate != null ? Number((rate * multiplier).toFixed(2)) : null;
      const { error: weErr } = await supabase
        .from("core_production_work_entries")
        .insert({
          scan_event_id: ev.id,
          production_unit_id: unit.id,
          production_unit_process_id: proc.id,
          production_order_id: unit.production_order_id,
          core_product_id: unit.core_product_id,
          core_variant_id: unit.core_variant_id,
          unit_code: unit.unit_code,
          process_name: proc.process_name,
          process_type: proc.process_type,
          operator_id: operatorId || null,
          operator_name_snapshot: opName,
          rate_snapshot: rate,
          payroll_multiplier_snapshot: multiplier,
          currency: "USD",
          payroll_amount: payrollAmount,
          payroll_status: payrollStatus,
          scanned_by_user_id: user?.id || null,
          notes: noteText || null,
        });
      if (weErr && !weErr.message.includes("duplicate")) {
        toast({ title: "Aviso work entry", description: weErr.message });
      }
    }

    await logCoreAudit({
      table: "core_production_scan_events",
      recordId: ev.id,
      action: "process_completed",
      newValue: { unit: unit.unit_code, process: proc.process_name, operator: opName },
    });

    // Unit status: in_production / completed
    const { data: allProcs } = await supabase
      .from("core_production_unit_processes")
      .select("status")
      .eq("production_unit_id", unit.id);
    const all = allProcs || [];
    const anyDone = all.some((p: any) => p.status === "completed");
    const allDone = all.length > 0 && all.every((p: any) => p.status === "completed" || p.status === "skipped");
    const newUnitStatus = allDone ? "completed" : anyDone ? "in_production" : unit.status;
    if (newUnitStatus !== unit.status) {
      await supabase
        .from("core_production_units")
        .update({ status: newUnitStatus })
        .eq("id", unit.id);
      await logCoreAudit({
        table: "core_production_units",
        recordId: unit.id,
        action: "status_change",
        oldValue: unit.status,
        newValue: newUnitStatus,
      });
      if (allDone) {
        await refreshOrderCounts(unit.production_order_id);
      }
    }

    toast({
      title: proc.adds_to_payroll ? "Proceso registrado y enviado a nómina pendiente." : "Proceso registrado.",
    });
    setRegisterProc(null);
    setOperatorId("");
    setNoteText("");
    setForceMissingRate(false);
    await loadByToken(unit.qr_token || unit.unit_code);
    // refresh recent
    const { data: r } = await supabase
      .from("core_production_scan_events")
      .select("id,unit_code,process_name,operator_name_snapshot,event_type,status,notes,created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    setRecent((r as ScanEvent[]) || []);
  }

  async function doCorrection() {
    if (!unit || !correctionProc) return;
    if (!correctionReason.trim()) {
      toast({ title: "Motivo obligatorio", variant: "destructive" });
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    const { data: ev } = await supabase
      .from("core_production_scan_events")
      .insert({
        production_unit_id: unit.id,
        production_unit_process_id: correctionProc.id,
        production_order_id: unit.production_order_id,
        unit_code: unit.unit_code,
        process_name: correctionProc.process_name,
        process_type: correctionProc.process_type,
        process_order: correctionProc.process_order,
        scanned_by_user_id: user?.id || null,
        event_type: "correction",
        status: "valid",
        notes: `${correctionReason}${correctionNote ? " — " + correctionNote : ""}`,
      })
      .select()
      .single();
    await logCoreAudit({
      table: "core_production_scan_events",
      recordId: ev?.id,
      action: "correction_logged",
      newValue: { unit: unit.unit_code, process: correctionProc.process_name, reason: correctionReason },
    });
    toast({ title: "Corrección registrada." });
    setCorrectionProc(null);
    setCorrectionReason("");
    setCorrectionNote("");
    await loadHistory(unit.id);
  }

  // suggested operators for process — match role_type but never block
  function targetRoleFor(proc: UnitProcess): string | null {
    return mapToRoleType(proc.suggested_role) || mapToRoleType(proc.process_type) || mapToRoleType(proc.process_name);
  }
  const suggestedFor = (proc: UnitProcess): Operator[] => {
    const target = targetRoleFor(proc);
    if (!target) return operators;
    const matches = operators.filter((o) => o.role_types.includes(target));
    return matches.length ? matches : operators;
  };
  const operatorMatchesProc = (op: Operator, proc: UnitProcess) => {
    const target = targetRoleFor(proc);
    if (!target) return true;
    return op.role_types.includes(target);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Escaneo</h1>
          <p className="text-sm text-muted-foreground">
            Escanea el QR de una unidad y registra procesos completados.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setCameraOpen(true)} variant="brand">
            <Camera className="h-4 w-4" /> Escanear con cámara
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex gap-2 items-end flex-wrap">
          <div className="flex-1 min-w-[220px]">
            <Label htmlFor="manual">Código o token de unidad</Label>
            <Input
              id="manual"
              placeholder="OP-000001-L-001"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && openManual()}
            />
          </div>
          <Button onClick={openManual}>
            <Search className="h-4 w-4" /> Abrir
          </Button>
        </div>
      </Card>

      {loading && <Card className="p-6 text-center text-sm text-muted-foreground">Cargando...</Card>}

      {unit && (
        <Card className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="text-base px-3 py-1">{unit.unit_code}</Badge>
                <Badge variant="outline">{unit.status}</Badge>
                {unit.size && <Badge variant="secondary" className="text-base">Talla {unit.size}</Badge>}
              </div>
              <p className="text-sm">
                <span className="text-muted-foreground">Producto: </span>
                <span className="font-medium">
                  {unit.product_name || unit.sku || "—"}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                SKU: {unit.sku ?? "—"} · Variante: {unit.variant_sku ?? "—"}
                {unit.variant_label && unit.variant_label !== unit.size ? ` · ${unit.variant_label}` : ""}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => { setUnit(null); setProcesses([]); setHistory([]); setSearchParams({}); }}>
              <X className="h-4 w-4" /> Cerrar
            </Button>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Procesos pendientes</p>
            {processes.length === 0 ? (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
                <p className="font-medium flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" /> Esta unidad no tiene procesos generados.
                </p>
                <p className="text-xs mt-1">
                  Requiere reparación antes de registrar trabajo o ingresarla a inventario.
                  Ve a <span className="font-mono">Órdenes de Producción</span> y usa
                  el botón <em>Reparar procesos</em> en esta OP.
                </p>
              </div>
            ) : pendingProcs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todos los procesos completados.</p>
            ) : null}
            <div className="grid gap-2">
              {pendingProcs.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 border rounded-lg p-3">
                  <div>
                    <p className="font-medium">
                      {p.process_order + 1}. {p.process_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {p.process_type || "—"}
                      {p.adds_to_payroll && <Badge variant="secondary" className="ml-2">Nómina</Badge>}
                      {p.suggested_role && <span className="ml-2">Sugerido: {p.suggested_role}</span>}
                    </p>
                  </div>
                  <Button onClick={() => { setRegisterProc(p); setOperatorId(""); setNoteText(""); setForceMissingRate(false); }}>
                    Registrar
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {completedProcs.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Procesos completados</p>
              <div className="grid gap-2">
                {completedProcs.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 border rounded-lg p-3 bg-muted/30">
                    <div>
                      <p className="font-medium flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        {p.process_order + 1}. {p.process_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {p.completed_at && new Date(p.completed_at).toLocaleString()}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => { setCorrectionProc(p); setCorrectionReason(""); setCorrectionNote(""); }}>
                      <AlertTriangle className="h-4 w-4" /> Corrección
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <UnitInventorySection unit={unit} processes={processes} />

          <Tabs defaultValue="history">
            <TabsList>
              <TabsTrigger value="history"><History className="h-4 w-4 mr-1" /> Historial</TabsTrigger>
            </TabsList>
            <TabsContent value="history">
              <div className="space-y-1 text-sm">
                {history.length === 0 && <p className="text-muted-foreground">Sin eventos.</p>}
                {history.map((h) => (
                  <div key={h.id} className="flex justify-between gap-2 border-b py-2">
                    <div>
                      <span className="font-medium">{h.process_name}</span>
                      <Badge variant="outline" className="ml-2 text-[10px]">{h.event_type}</Badge>
                      {h.operator_name_snapshot && <span className="ml-2 text-muted-foreground"><User className="h-3 w-3 inline" /> {h.operator_name_snapshot}</span>}
                      {h.notes && <p className="text-xs text-muted-foreground">{h.notes}</p>}
                    </div>
                    <span className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </Card>
      )}

      {!unit && (
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Últimos escaneos</p>
          <div className="space-y-1 text-sm">
            {recent.length === 0 && <p className="text-muted-foreground">Aún no hay escaneos.</p>}
            {recent.map((h) => (
              <div key={h.id} className="flex justify-between border-b py-2">
                <div>
                  <span className="font-medium">{h.unit_code}</span>
                  <span className="ml-2">{h.process_name}</span>
                  <Badge variant="outline" className="ml-2 text-[10px]">{h.event_type}</Badge>
                  {h.operator_name_snapshot && <span className="ml-2 text-muted-foreground">{h.operator_name_snapshot}</span>}
                </div>
                <span className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Register process dialog */}
      <Dialog open={!!registerProc} onOpenChange={(o) => !o && setRegisterProc(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar proceso</DialogTitle>
            <DialogDescription>
              {registerProc?.process_name} — Unidad {unit?.unit_code}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="flex items-center justify-between">
                <span>Operario {registerProc?.adds_to_payroll && <span className="text-destructive">*</span>}</span>
                {registerProc && targetRoleFor(registerProc) && (
                  <button
                    type="button"
                    className="text-xs underline text-muted-foreground"
                    onClick={() => setShowAllOperators((v) => !v)}
                  >
                    {showAllOperators ? "Mostrar sugeridos" : "Ver todos"}
                  </button>
                )}
              </Label>
              <Select value={operatorId} onValueChange={(v) => { setOperatorId(v); setConfirmMismatch(false); }}>
                <SelectTrigger><SelectValue placeholder="Selecciona operario" /></SelectTrigger>
                <SelectContent>
                  {registerProc && (showAllOperators ? operators : suggestedFor(registerProc)).map((e) => {
                    const matches = operatorMatchesProc(e, registerProc);
                    return (
                      <SelectItem key={e.id} value={e.id}>
                        {operatorFullName(e)}{e.role_types.length > 0 && ` — ${e.role_types.join(", ")}`}{!matches && " ⚠"}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {registerProc && operatorId && !operatorMatchesProc(operatorById(operatorId)!, registerProc) && (
                <div className="mt-2 rounded border border-amber-400/50 bg-amber-100/40 p-2 text-xs">
                  <p className="font-medium">Este operario no tiene el rol sugerido para este proceso.</p>
                  <label className="flex items-center gap-2 mt-1">
                    <input type="checkbox" checked={confirmMismatch} onChange={(e) => setConfirmMismatch(e.target.checked)} />
                    Confirmo continuar igualmente
                  </label>
                </div>
              )}
            </div>
            <div>
              <Label>Observación</Label>
              <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Opcional" />
            </div>
            {registerProc?.adds_to_payroll && extractRate(registerProc.rate_snapshot) === null && (
              <div className="rounded border border-destructive/40 bg-destructive/10 p-3 text-sm">
                <p className="font-medium flex items-center gap-1"><AlertTriangle className="h-4 w-4" /> Tarifa faltante</p>
                <p className="text-xs">Se marcará el registro de nómina como <code>missing_rate</code>.</p>
              </div>
            )}
            {registerProc?.adds_to_payroll && extractRate(registerProc.rate_snapshot) !== null && (
              <p className="text-xs text-muted-foreground">
                Nómina pendiente: ${extractRate(registerProc.rate_snapshot)?.toFixed(2)}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegisterProc(null)}>Cancelar</Button>
            <Button onClick={doRegister}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Correction dialog */}
      <Dialog open={!!correctionProc} onOpenChange={(o) => !o && setCorrectionProc(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar corrección</DialogTitle>
            <DialogDescription>
              No reabre el proceso ni genera pago. Queda en historial.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Motivo <span className="text-destructive">*</span></Label>
              <Input value={correctionReason} onChange={(e) => setCorrectionReason(e.target.value)} />
            </div>
            <div>
              <Label>Observación</Label>
              <Textarea value={correctionNote} onChange={(e) => setCorrectionNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCorrectionProc(null)}>Cancelar</Button>
            <Button onClick={doCorrection}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Camera dialog */}
      <Dialog open={cameraOpen} onOpenChange={setCameraOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Escanear QR</DialogTitle>
            <DialogDescription>Apunta la cámara al código QR de la unidad.</DialogDescription>
          </DialogHeader>
          <div
            className="relative w-full"
            onClick={(e) => handleTapFocus(e, cameraDivRef.current)}
            onTouchStart={(e) => handleTapFocus(e, cameraDivRef.current)}
          >
            <div id="qr-camera-region" ref={cameraDivRef} className="w-full" />
            {ring && <FocusRing key={ring.id} x={ring.x} y={ring.y} />}
          </div>
          <div className="flex flex-wrap gap-2 justify-center pt-2">
            <Button
              size="sm"
              variant={cam.nearMode ? "default" : "outline"}
              onClick={() => void cam.applyNearMode(cameraDivRef.current, !cam.nearMode)}
            >
              Modo QR cercano
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                const id = await cam.nextDeviceId();
                if (id) { cam.resetTorch(); setCamDeviceId(id); }
              }}
            >
              Cambiar cámara
            </Button>
            {cam.torchSupported && (
              <Button size="sm" variant={cam.torchOn ? "default" : "outline"} onClick={() => void cam.toggleTorch(cameraDivRef.current)}>
                Luz
              </Button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground text-center">
            Para QR pequeños: activa Modo QR cercano y aleja un poco la etiqueta.
          </p>
          {unsupportedMsg && (
            <p className="text-[11px] text-muted-foreground text-center">{unsupportedMsg}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCameraOpen(false)}>
              <ScanLine className="h-4 w-4" /> Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
