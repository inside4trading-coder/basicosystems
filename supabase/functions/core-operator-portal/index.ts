import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SALT = SERVICE_ROLE_KEY;

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 30;
const SESSION_DAYS = 7;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256(value: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const hashPin = (operatorId: string, pin: string) =>
  sha256(`${pin}:core-operario:${operatorId}:${SALT.slice(0, 24)}`);
const hashToken = (token: string) => sha256(`${token}:session:${SALT.slice(0, 24)}`);

// Mapa proceso -> rol de fábrica (mismo criterio que el escaneo admin)
const PROCESS_TO_ROLE: Record<string, string> = {
  corte: "cutter", cutter: "cutter", cortador: "cutter", cortadora: "cutter",
  costura: "sewer", sewer: "sewer", costurera: "sewer", costurero: "sewer",
  estampado: "printer", printer: "printer", estampador: "printer",
  bordado: "embroiderer", embroiderer: "embroiderer", bordador: "embroiderer",
  empaque: "packing", packing: "packing",
  logistica: "logistics", "logística": "logistics", logistics: "logistics",
  calidad: "quality", quality: "quality",
};

function norm(s?: string | null): string {
  return (s ?? "").toString().trim().toLowerCase();
}
function mapToRoleType(s?: string | null): string | null {
  const k = norm(s);
  if (!k) return null;
  return PROCESS_TO_ROLE[k] ?? null;
}

function extractRate(snap: unknown): number | null {
  if (snap === null || snap === undefined) return null;
  if (typeof snap === "number") return snap;
  if (typeof snap === "string" && snap.trim() !== "" && !isNaN(Number(snap))) return Number(snap);
  if (typeof snap === "object") {
    const o = snap as Record<string, unknown>;
    const keys = ["unit_cost", "rate", "amount", "value", "price", "payroll_amount", "cost"];
    for (const k of keys) if (typeof o[k] === "number") return o[k] as number;
    for (const k of keys) {
      const v = o[k];
      if (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v))) return Number(v);
    }
  }
  return null;
}

// Semana de nómina: viernes -> jueves (misma lógica que src/lib/corePayrollWeek.ts)
function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function payrollWeek(ref = new Date()) {
  const today = new Date(ref);
  today.setHours(0, 0, 0, 0);
  const daysSinceFri = (today.getDay() - 5 + 7) % 7;
  const start = new Date(today); start.setDate(today.getDate() - daysSinceFri);
  const end = new Date(start); end.setDate(start.getDate() + 6);
  const endExclusive = new Date(start); endExclusive.setDate(start.getDate() + 7);
  return { start: isoDate(start), end: isoDate(end), endExclusive: isoDate(endExclusive) };
}

type OperatorRow = {
  id: string;
  first_name: string;
  last_name: string | null;
  alias: string | null;
  photo_url: string | null;
  status: string;
  payroll_multiplier: number | null;
  portal_active: boolean;
  allowed_processes: string[] | null;
  pin_hash: string | null;
  pin_failed_attempts: number | null;
  pin_locked_until: string | null;
};

function fullName(o: { first_name: string; last_name: string | null; alias: string | null }) {
  return `${o.first_name}${o.last_name ? " " + o.last_name : ""}${o.alias ? " (" + o.alias + ")" : ""}`;
}

async function rolesOf(operatorId: string): Promise<string[]> {
  const { data } = await admin
    .from("core_factory_operator_roles")
    .select("role_type")
    .eq("operator_id", operatorId)
    .eq("status", "active");
  return ((data as { role_type: string }[]) ?? []).map((r) => r.role_type);
}

/** Procesos permitidos: allowed_processes manda; si está vacío, se derivan de los roles. */
function isProcessAllowed(
  op: OperatorRow,
  roles: string[],
  proc: { process_name: string | null; process_type: string | null; suggested_role: string | null },
): boolean {
  const allowed = (op.allowed_processes ?? []).map(norm).filter(Boolean);
  const tokens = [norm(proc.process_type), norm(proc.process_name), norm(proc.suggested_role)].filter(Boolean);
  if (allowed.length > 0) {
    if (tokens.some((t) => allowed.includes(t))) return true;
    // también permite que allowed_processes guarde role_types (cutter, sewer, ...)
    const roleTokens = tokens.map(mapToRoleType).filter(Boolean) as string[];
    return roleTokens.some((t) => allowed.includes(t));
  }
  if (roles.length === 0) return false;
  const needed = tokens.map(mapToRoleType).filter(Boolean) as string[];
  if (needed.length === 0) return true; // proceso sin rol identificable: no bloquear
  return needed.some((r) => roles.includes(r));
}

async function resolveSession(token: string): Promise<{ operator: OperatorRow; roles: string[]; sessionId: string } | null> {
  if (!token) return null;
  const th = await hashToken(token);
  const { data: sess } = await admin
    .from("core_operator_portal_sessions")
    .select("id, operator_id, expires_at, revoked_at")
    .eq("session_token_hash", th)
    .maybeSingle();
  if (!sess || sess.revoked_at) return null;
  if (new Date(sess.expires_at) < new Date()) return null;
  const { data: op } = await admin
    .from("core_factory_operators")
    .select("id, first_name, last_name, alias, photo_url, status, payroll_multiplier, portal_active, allowed_processes, pin_hash, pin_failed_attempts, pin_locked_until")
    .eq("id", sess.operator_id)
    .maybeSingle();
  if (!op || (op as OperatorRow).status !== "active" || !(op as OperatorRow).portal_active) return null;
  return { operator: op as OperatorRow, roles: await rolesOf(sess.operator_id), sessionId: sess.id };
}

async function buildDashboard(operatorId: string) {
  const week = payrollWeek();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data: weekEntries } = await admin
    .from("core_production_work_entries")
    .select("id, unit_code, production_unit_id, process_name, process_type, payroll_amount, payroll_status, created_at, core_product_id, core_variant_id, source")
    .eq("operator_id", operatorId)
    .gte("created_at", `${week.start}T00:00:00`)
    .lt("created_at", `${week.endExclusive}T00:00:00`)
    .order("created_at", { ascending: false });

  const all = (weekEntries as any[]) ?? [];
  const today = all.filter((e) => new Date(e.created_at) >= todayStart);

  const sum = (rows: any[]) => rows.reduce((a, r) => a + Number(r.payroll_amount ?? 0), 0);
  const uniqueUnits = (rows: any[]) => new Set(rows.map((r) => r.production_unit_id)).size;

  const byProcess: Record<string, { label: string; count: number; amount: number }> = {};
  for (const e of today) {
    const key = norm(e.process_type) || norm(e.process_name) || "otros";
    if (!byProcess[key]) byProcess[key] = { label: e.process_name || e.process_type || "Otros", count: 0, amount: 0 };
    byProcess[key].count += 1;
    byProcess[key].amount += Number(e.payroll_amount ?? 0);
  }

  // Últimos escaneos enriquecidos
  const recent = all.slice(0, 20);
  const productIds = Array.from(new Set(recent.map((r) => r.core_product_id).filter(Boolean)));
  const variantIds = Array.from(new Set(recent.map((r) => r.core_variant_id).filter(Boolean)));
  const [{ data: prods }, { data: vars }] = await Promise.all([
    productIds.length
      ? admin.from("core_products").select("id, name").in("id", productIds)
      : Promise.resolve({ data: [] as any[] }),
    variantIds.length
      ? admin.from("core_product_variants").select("id, size, color, variant_label").in("id", variantIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);
  const pMap = new Map(((prods as any[]) ?? []).map((p) => [p.id, p]));
  const vMap = new Map(((vars as any[]) ?? []).map((v) => [v.id, v]));

  return {
    week: { start: week.start, end: week.end },
    today: {
      processes: today.length,
      units: uniqueUnits(today),
      amount: Number(sum(today).toFixed(2)),
      last_scan_at: today[0]?.created_at ?? null,
    },
    week_totals: {
      processes: all.length,
      units: uniqueUnits(all),
      amount: Number(sum(all).toFixed(2)),
      pending: all.filter((e) => e.payroll_status === "pending").length,
    },
    by_process: Object.values(byProcess).sort((a, b) => b.amount - a.amount),
    recent: recent.map((e) => {
      const v = e.core_variant_id ? vMap.get(e.core_variant_id) : null;
      return {
        id: e.id,
        created_at: e.created_at,
        unit_code: e.unit_code,
        product_name: e.core_product_id ? pMap.get(e.core_product_id)?.name ?? null : null,
        variant: v ? [v.size, v.color].filter(Boolean).join(" / ") || v.variant_label : null,
        process_name: e.process_name,
        amount: Number(e.payroll_amount ?? 0),
        payroll_status: e.payroll_status,
        source: e.source,
      };
    }),
  };
}

function publicOperator(op: OperatorRow, roles: string[]) {
  return {
    id: op.id,
    name: `${op.first_name}${op.last_name ? " " + op.last_name : ""}`.trim(),
    alias: op.alias,
    photo_url: op.photo_url,
    roles,
    allowed_processes: op.allowed_processes ?? [],
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const action = String((body as any).action ?? "");
    const token = String((body as any).token ?? "");

    if (action === "list_operators") {
      const { data: ops } = await admin
        .from("core_factory_operators")
        .select("id, first_name, last_name, alias, photo_url, allowed_processes, pin_hash")
        .eq("status", "active")
        .eq("portal_active", true)
        .order("first_name");
      const list = ((ops as any[]) ?? []);
      const { data: allRoles } = await admin
        .from("core_factory_operator_roles")
        .select("operator_id, role_type")
        .eq("status", "active");
      const byOp: Record<string, string[]> = {};
      for (const r of ((allRoles as any[]) ?? [])) {
        (byOp[r.operator_id] ??= []).push(r.role_type);
      }
      return json({
        ok: true,
        operators: list.map((o) => ({
          id: o.id,
          name: `${o.first_name}${o.last_name ? " " + o.last_name : ""}`.trim(),
          alias: o.alias,
          photo_url: o.photo_url,
          roles: byOp[o.id] ?? [],
          allowed_processes: o.allowed_processes ?? [],
          pin_set: !!o.pin_hash,
        })),
      });
    }

    if (action === "login") {
      const operatorId = String((body as any).operator_id ?? "");
      const pin = String((body as any).pin ?? "").trim();
      const deviceLabel = (body as any).device_label ? String((body as any).device_label).slice(0, 120) : null;
      if (!/^[0-9a-f-]{36}$/i.test(operatorId)) return json({ ok: false, error: "Operario inválido" }, 400);
      if (!/^\d{6}$/.test(pin)) return json({ ok: false, error: "El PIN debe tener 6 dígitos" }, 400);

      const { data: opRaw } = await admin
        .from("core_factory_operators")
        .select("id, first_name, last_name, alias, photo_url, status, payroll_multiplier, portal_active, allowed_processes, pin_hash, pin_failed_attempts, pin_locked_until")
        .eq("id", operatorId)
        .maybeSingle();
      const op = opRaw as OperatorRow | null;
      if (!op || op.status !== "active" || !op.portal_active) {
        return json({ ok: false, error: "Perfil no disponible" }, 200);
      }
      if (op.pin_locked_until && new Date(op.pin_locked_until) > new Date()) {
        const until = new Date(op.pin_locked_until).toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" });
        return json({ ok: false, error: `Perfil bloqueado hasta ${until}.` }, 200);
      }
      if (!op.pin_hash) return json({ ok: false, error: "Este perfil aún no tiene PIN. Pídelo a tu supervisor." }, 200);

      const hash = await hashPin(op.id, pin);
      if (hash !== op.pin_hash) {
        const next = (op.pin_failed_attempts ?? 0) + 1;
        const willLock = next >= MAX_ATTEMPTS;
        await admin
          .from("core_factory_operators")
          .update({
            pin_failed_attempts: willLock ? 0 : next,
            pin_locked_until: willLock ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString() : op.pin_locked_until,
          })
          .eq("id", op.id);
        return json({
          ok: false,
          error: willLock
            ? `PIN incorrecto. Perfil bloqueado ${LOCKOUT_MINUTES} minutos.`
            : `PIN incorrecto. Te quedan ${MAX_ATTEMPTS - next} intentos.`,
        }, 200);
      }

      const plain = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
      const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const { error: sErr } = await admin.from("core_operator_portal_sessions").insert({
        operator_id: op.id,
        session_token_hash: await hashToken(plain),
        device_label: deviceLabel,
        expires_at: expiresAt,
      });
      if (sErr) throw sErr;

      await admin
        .from("core_factory_operators")
        .update({ pin_failed_attempts: 0, pin_locked_until: null, portal_last_login_at: new Date().toISOString() })
        .eq("id", op.id);

      const roles = await rolesOf(op.id);
      return json({
        ok: true,
        token: plain,
        expires_at: expiresAt,
        operator: publicOperator(op, roles),
        dashboard: await buildDashboard(op.id),
      });
    }

    if (action === "session") {
      const s = await resolveSession(token);
      if (!s) return json({ ok: false, error: "Sesión expirada" }, 200);
      return json({
        ok: true,
        operator: publicOperator(s.operator, s.roles),
        dashboard: await buildDashboard(s.operator.id),
      });
    }

    if (action === "logout") {
      if (token) {
        await admin
          .from("core_operator_portal_sessions")
          .update({ revoked_at: new Date().toISOString() })
          .eq("session_token_hash", await hashToken(token))
          .is("revoked_at", null);
      }
      return json({ ok: true });
    }

    if (action === "lookup_unit" || action === "register_process") {
      const s = await resolveSession(token);
      if (!s) return json({ ok: false, error: "Sesión expirada" }, 401);

      const code = String((body as any).code ?? "").trim();
      let unit: any = null;
      if (code) {
        const { data: byToken } = await admin
          .from("core_production_units")
          .select("*")
          .eq("qr_token", code)
          .maybeSingle();
        unit = byToken;
        if (!unit) {
          const { data: byCode } = await admin
            .from("core_production_units")
            .select("*")
            .eq("unit_code", code)
            .maybeSingle();
          unit = byCode;
        }
      } else if ((body as any).unit_id) {
        const { data } = await admin
          .from("core_production_units")
          .select("*")
          .eq("id", String((body as any).unit_id))
          .maybeSingle();
        unit = data;
      }
      if (!unit) return json({ ok: false, error: "QR no reconocido." }, 200);
      if (["cancelled", "canceled"].includes(norm(unit.status))) {
        return json({ ok: false, error: "Esta unidad fue cancelada." }, 200);
      }

      const [{ data: order }, { data: product }, { data: variant }, { data: procsRaw }] = await Promise.all([
        admin.from("core_production_orders").select("id, order_code, status").eq("id", unit.production_order_id).maybeSingle(),
        unit.core_product_id
          ? admin.from("core_products").select("id, name").eq("id", unit.core_product_id).maybeSingle()
          : Promise.resolve({ data: null }),
        unit.core_variant_id
          ? admin.from("core_product_variants").select("id, size, color, variant_label").eq("id", unit.core_variant_id).maybeSingle()
          : Promise.resolve({ data: null }),
        admin
          .from("core_production_unit_processes")
          .select("*")
          .eq("production_unit_id", unit.id)
          .order("process_order", { ascending: true }),
      ]);

      if (order && ["cancelled", "canceled"].includes(norm((order as any).status))) {
        return json({ ok: false, error: "Esta OP fue cancelada." }, 200);
      }

      const procs = ((procsRaw as any[]) ?? []);
      const multiplier = Number(s.operator.payroll_multiplier ?? 1);

      const isDone = (st: string) => st === "completed" || st === "skipped";
      const firstPendingOrder = procs.find((p) => !isDone(p.status))?.process_order ?? null;

      const decorated = procs.map((p) => {
        const rate = extractRate(p.rate_snapshot);
        const allowed = isProcessAllowed(s.operator, s.roles, p);
        let blockedReason: string | null = null;
        if (p.status === "completed") blockedReason = "Este proceso ya fue completado.";
        else if (!allowed) blockedReason = "Este proceso no está habilitado para tu perfil.";
        else if (firstPendingOrder !== null && p.process_order > firstPendingOrder) {
          blockedReason = "Hay un proceso anterior pendiente.";
        }
        return {
          id: p.id,
          process_name: p.process_name,
          process_type: p.process_type,
          process_order: p.process_order,
          status: p.status,
          adds_to_payroll: p.adds_to_payroll,
          rate,
          amount: rate != null ? Number((rate * multiplier).toFixed(2)) : null,
          allowed,
          blocked_reason: blockedReason,
          completed_at: p.completed_at,
        };
      });

      const unitPayload = {
        id: unit.id,
        unit_code: unit.unit_code,
        status: unit.status,
        order_code: (order as any)?.order_code ?? null,
        product_name: (product as any)?.name ?? null,
        variant:
          (variant as any)
            ? [(variant as any).size, (variant as any).color].filter(Boolean).join(" / ") ||
              (variant as any).variant_label
            : unit.size ?? unit.variant_label ?? null,
        size: unit.size,
      };

      if (action === "lookup_unit") {
        return json({ ok: true, unit: unitPayload, processes: decorated });
      }

      // ---- register_process ----
      const processId = String((body as any).process_id ?? "");
      const target = decorated.find((p) => p.id === processId);
      if (!target) return json({ ok: false, error: "Proceso no encontrado en esta unidad." }, 200);
      if (target.blocked_reason) return json({ ok: false, error: target.blocked_reason }, 200);

      // Idempotencia: relectura del estado real
      const { data: fresh } = await admin
        .from("core_production_unit_processes")
        .select("status")
        .eq("id", processId)
        .maybeSingle();
      if ((fresh as any)?.status === "completed") {
        return json({ ok: false, error: "Este proceso ya fue completado." }, 200);
      }
      const { data: dupe } = await admin
        .from("core_production_work_entries")
        .select("id")
        .eq("production_unit_process_id", processId)
        .maybeSingle();
      if (dupe) return json({ ok: false, error: "Este proceso ya fue completado." }, 200);

      const opName = fullName(s.operator);
      const missingRate = target.adds_to_payroll && target.rate == null;

      const { data: ev, error: evErr } = await admin
        .from("core_production_scan_events")
        .insert({
          production_unit_id: unit.id,
          production_unit_process_id: processId,
          production_order_id: unit.production_order_id,
          production_order_line_id: unit.production_order_line_id,
          core_product_id: unit.core_product_id,
          core_variant_id: unit.core_variant_id,
          unit_code: unit.unit_code,
          sku: unit.sku,
          variant_sku: unit.variant_sku,
          variant_label: unit.variant_label,
          size: unit.size,
          process_name: target.process_name,
          process_type: target.process_type,
          process_order: target.process_order,
          operator_id: s.operator.id,
          operator_name_snapshot: opName,
          event_type: "process_completed",
          status: "valid",
          source: "portal_operario",
        })
        .select()
        .single();
      if (evErr) throw evErr;

      await admin
        .from("core_production_unit_processes")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          completed_by_operator_id: s.operator.id,
        })
        .eq("id", processId);

      if (target.adds_to_payroll) {
        const { error: weErr } = await admin.from("core_production_work_entries").insert({
          scan_event_id: (ev as any).id,
          production_unit_id: unit.id,
          production_unit_process_id: processId,
          production_order_id: unit.production_order_id,
          core_product_id: unit.core_product_id,
          core_variant_id: unit.core_variant_id,
          unit_code: unit.unit_code,
          process_name: target.process_name,
          process_type: target.process_type,
          operator_id: s.operator.id,
          operator_name_snapshot: opName,
          rate_snapshot: target.rate,
          payroll_multiplier_snapshot: multiplier,
          currency: "USD",
          payroll_amount: target.amount,
          payroll_status: missingRate ? "missing_rate" : "pending",
          source: "portal_operario",
        });
        if (weErr && !weErr.message.includes("duplicate")) throw weErr;
      }

      // Cerrar unidad si todos sus procesos quedaron completados
      const { data: after } = await admin
        .from("core_production_unit_processes")
        .select("status")
        .eq("production_unit_id", unit.id);
      const allDone = ((after as any[]) ?? []).every((p) => p.status === "completed");
      if (allDone && unit.status !== "completed") {
        await admin.from("core_production_units").update({ status: "completed" }).eq("id", unit.id);
      }

      return json({
        ok: true,
        registered: {
          unit_code: unit.unit_code,
          process_name: target.process_name,
          amount: target.amount,
          missing_rate: missingRate,
        },
        dashboard: await buildDashboard(s.operator.id),
      });
    }

    return json({ ok: false, error: "Acción desconocida" }, 400);
  } catch (err) {
    return json({ ok: false, error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
