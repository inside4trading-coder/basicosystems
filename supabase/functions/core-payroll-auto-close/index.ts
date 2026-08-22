// Cierre automático de la nómina semanal (viernes → jueves, hora Venezuela).
// Se ejecuta por cron los viernes 03:59 UTC = jueves 23:59 America/Caracas.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const VE_OFFSET_MS = 4 * 60 * 60 * 1000; // UTC-4 fijo (Venezuela no usa DST)
const LOCK_MINUTES = 10;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Semana operativa cerrada (viernes → jueves) en hora Caracas. */
function payrollWeek(now: Date, offsetWeeks = 0) {
  // "Ahora" desplazado a hora Caracas para decidir el día de la semana.
  const ve = new Date(now.getTime() - VE_OFFSET_MS);
  const veMidnight = new Date(Date.UTC(ve.getUTCFullYear(), ve.getUTCMonth(), ve.getUTCDate()));
  const dow = veMidnight.getUTCDay(); // viernes = 5
  const daysSinceFri = (dow - 5 + 7) % 7;
  const start = new Date(veMidnight.getTime() + (-daysSinceFri + offsetWeeks * 7) * 86400000);
  const end = new Date(start.getTime() + 6 * 86400000);
  const endExclusive = new Date(start.getTime() + 7 * 86400000);
  return {
    start: isoDate(start),
    end: isoDate(end),
    endExclusive: isoDate(endExclusive),
    payment: isoDate(endExclusive),
    // Límites reales en UTC (00:00 Caracas = 04:00 UTC)
    startUtc: new Date(start.getTime() + VE_OFFSET_MS).toISOString(),
    endUtc: new Date(endExclusive.getTime() + VE_OFFSET_MS).toISOString(),
  };
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart <= bEnd && bStart <= aEnd;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let offsetWeeks = 0;
  try {
    const body = await req.json();
    if (body && typeof body.offset_weeks === "number") offsetWeeks = body.offset_weeks;
  } catch { /* sin body */ }

  const week = payrollWeek(new Date(), offsetWeeks);
  const nowIso = new Date().toISOString();
  const lockUntil = new Date(Date.now() + LOCK_MINUTES * 60000).toISOString();

  const finish = async (status: string, message: string, extra: Record<string, unknown> = {}) => {
    await supabase
      .from("core_payroll_auto_close_runs")
      .update({ status, message, finished_at: new Date().toISOString(), lock_expires_at: null, ...extra })
      .eq("period_start", week.start);
    return { status, message, ...extra };
  };

  try {
    // 1) Single-flight: una fila por semana; si existe y sigue bloqueada o ya terminó, salir.
    const { data: existingCtrl } = await supabase
      .from("core_payroll_auto_close_runs")
      .select("*")
      .eq("period_start", week.start)
      .maybeSingle();

    if (existingCtrl) {
      const locked = existingCtrl.lock_expires_at && existingCtrl.lock_expires_at > nowIso;
      if (locked) return json({ ok: true, skipped: "locked", period: week.start });
      if (existingCtrl.status === "created") {
        return json({ ok: true, skipped: "already_created", period: week.start });
      }
      await supabase
        .from("core_payroll_auto_close_runs")
        .update({ status: "running", message: null, lock_expires_at: lockUntil, finished_at: null })
        .eq("id", existingCtrl.id);
    } else {
      const { error: insErr } = await supabase.from("core_payroll_auto_close_runs").insert({
        period_start: week.start,
        period_end: week.end,
        payment_date: week.payment,
        status: "running",
        lock_expires_at: lockUntil,
      });
      if (insErr) return json({ ok: true, skipped: "race", period: week.start });
    }

    // 2) Guarda de solape con nóminas existentes.
    const { data: runs } = await supabase
      .from("core_payroll_runs")
      .select("id,payroll_code,period_start,period_end,status");
    const conflict = (runs ?? []).find(
      (r) => !["cancelled", "merged"].includes(r.status) && overlaps(week.start, week.end, r.period_start, r.period_end),
    );
    if (conflict) {
      const res = await finish("skipped_existing", `Ya existe ${conflict.payroll_code ?? conflict.id} para ese período`);
      return json({ ok: true, ...res });
    }

    // 3) Trabajos elegibles de la semana (rango en hora Caracas).
    const { data: entries, error: entriesErr } = await supabase
      .from("core_production_work_entries")
      .select("*")
      .eq("payroll_status", "pending")
      .gte("created_at", week.startUtc)
      .lt("created_at", week.endUtc);
    if (entriesErr) throw new Error(entriesErr.message);

    const ids = (entries ?? []).map((e) => e.id);
    const linked = new Set<string>();
    if (ids.length) {
      const { data: links } = await supabase
        .from("core_payroll_work_entry_links")
        .select("work_entry_id")
        .in("work_entry_id", ids);
      (links ?? []).forEach((l) => linked.add(l.work_entry_id as string));
    }
    const valid = (entries ?? []).filter(
      (e) => e.operator_id && Number(e.payroll_amount ?? 0) > 0 && !linked.has(e.id),
    );

    if (valid.length === 0) {
      const res = await finish("skipped_empty", "No había trabajos pendientes en el período");
      return json({ ok: true, ...res });
    }

    // 4) Crear la nómina.
    const byOp = new Map<string, typeof valid>();
    valid.forEach((e) => {
      const arr = byOp.get(e.operator_id as string) ?? [];
      arr.push(e);
      byOp.set(e.operator_id as string, arr);
    });
    const subtotal = valid.reduce((s, e) => s + Number(e.payroll_amount ?? 0), 0);

    const { data: run, error: runErr } = await supabase
      .from("core_payroll_runs")
      .insert({
        period_start: week.start,
        period_end: week.end,
        payment_date: week.payment,
        status: "draft",
        total_amount: subtotal,
        operators_count: byOp.size,
        work_entries_count: valid.length,
        generated_by_system: true,
        generation_source: "auto_close_thursday_23_59_ve",
      })
      .select()
      .single();
    if (runErr || !run) throw new Error(runErr?.message ?? "No se pudo crear la nómina");

    for (const [opId, es] of byOp.entries()) {
      const sub = es.reduce((s, e) => s + Number(e.payroll_amount ?? 0), 0);
      const { data: line } = await supabase
        .from("core_payroll_operator_lines")
        .insert({
          payroll_run_id: run.id,
          operator_id: opId,
          operator_name_snapshot: es[0].operator_name_snapshot,
          total_processes: es.length,
          subtotal_amount: sub,
          total_amount: sub,
          status: "pending_review",
        })
        .select()
        .single();
      if (!line) continue;
      await supabase.from("core_payroll_work_entry_links").insert(
        es.map((e) => ({
          payroll_run_id: run.id,
          payroll_operator_line_id: line.id,
          work_entry_id: e.id,
          operator_id: opId,
          amount: Number(e.payroll_amount ?? 0),
          currency: e.currency ?? "USD",
        })),
      );
      await supabase
        .from("core_production_work_entries")
        .update({ payroll_status: "included_in_payroll" })
        .in("id", es.map((e) => e.id));
    }

    await supabase.from("core_audit_logs").insert({
      table_name: "core_payroll_runs",
      record_id: run.id,
      action: "payroll_auto_generated",
      new_value: JSON.stringify({
        period_start: week.start,
        period_end: week.end,
        payment_date: week.payment,
        total: subtotal,
        operators: byOp.size,
        entries: valid.length,
      }),
      performed_by: "system:auto_close",
    });

    const res = await finish("created", `Nómina ${run.payroll_code ?? run.id} generada automáticamente`, {
      payroll_run_id: run.id,
      work_entries_count: valid.length,
      operators_count: byOp.size,
      total_amount: subtotal,
    });
    return json({ ok: true, ...res, payroll_code: run.payroll_code });
  } catch (err) {
    const msg = (err as Error).message ?? "Error desconocido";
    await finish("error", msg);
    return json({ ok: false, error: msg, period: week.start }, 500);
  }
});
