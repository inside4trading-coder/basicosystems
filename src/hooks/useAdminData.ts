import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type {
  AdminKPIs,
  InstanceFilters,
  Obligation,
  ObligationInstance,
} from "@/types/admin";
import { computeUrgency } from "@/types/admin";
import { formatLocalDate } from "@/lib/dateUtils";
import { useAdminScope } from "@/contexts/AdminScope";

async function logAudit(auditTable: string, entry: {
  action: string;
  obligation_id?: string | null;
  instance_id?: string | null;
  field_changed?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  performed_by?: string | null;
}) {
  await (supabase.from(auditTable as any) as any).insert(entry);
}

const RECURRING_FREQUENCIES: Array<string> = [
  "semanal",
  "quincenal",
  "mensual",
  "bimestral",
  "trimestral",
  "semestral",
  "anual",
];

function monthsStep(freq: string): number {
  switch (freq) {
    case "mensual": return 1;
    case "bimestral": return 2;
    case "trimestral": return 3;
    case "semestral": return 6;
    case "anual": return 12;
    default: return 1; // semanal/quincenal handled separately
  }
}

function periodLabelFor(date: Date): string {
  return date
    .toLocaleDateString("es-VE", { month: "long", year: "numeric" })
    .replace(/^./, (c) => c.toUpperCase());
}

function generateDueDates(obligation: Obligation, monthsAhead: number, fromDate = new Date()): Array<{ due_date: string; period_label: string }> {
  const out: Array<{ due_date: string; period_label: string }> = [];
  const freq = obligation.frequency;
  const day = obligation.due_day ?? 1;
  const start = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);
  const endLimit = new Date(start.getFullYear(), start.getMonth() + monthsAhead, 1);

  if (freq === "semanal" || freq === "quincenal") {
    const stepDays = freq === "semanal" ? 7 : 14;
    const cursor = new Date(fromDate);
    cursor.setHours(0, 0, 0, 0);
    while (cursor < endLimit) {
      const d = new Date(cursor);
      out.push({
        due_date: formatLocalDate(d),
        period_label: d.toLocaleDateString("es-VE", { day: "2-digit", month: "short", year: "numeric" }),
      });
      cursor.setDate(cursor.getDate() + stepDays);
    }
    return out;
  }

  const step = monthsStep(freq);
  for (let i = 0; i < monthsAhead; i += step) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const lastDayOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, lastDayOfMonth));
    if (d < new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate())) continue;
    out.push({
      due_date: formatLocalDate(d),
      period_label: periodLabelFor(d),
    });
  }
  return out;
}

async function generateRecurringInstances(instancesTable: string, obligation: Obligation, monthsAhead = 12) {
  if (!RECURRING_FREQUENCIES.includes(obligation.frequency)) return;
  if (obligation.status !== "active") return;
  const targets = generateDueDates(obligation, monthsAhead);
  if (!targets.length) return;

  const { data: existing } = await (supabase.from(instancesTable as any) as any)
    .select("due_date,period_label")
    .eq("obligation_id", obligation.id);

  const existingKeys = new Set<string>(
    ((existing as any[]) ?? []).map((r) => `${r.due_date}|${r.period_label}`),
  );

  const toInsert = targets
    .filter((t) => !existingKeys.has(`${t.due_date}|${t.period_label}`))
    .map((t) => ({
      obligation_id: obligation.id,
      period_label: t.period_label,
      due_date: t.due_date,
      amount: obligation.amount ?? 0,
      currency: obligation.currency ?? "USD",
      status: "pendiente" as const,
    }));

  if (toInsert.length) {
    await (supabase.from(instancesTable as any) as any).insert(toInsert);
  }
}

function mapInstance(row: any): ObligationInstance {
  const due = row.due_date as string;
  return {
    id: row.id,
    obligation_id: row.obligation_id ?? "",
    period_label: row.period_label ?? "",
    due_date: due,
    amount: Number(row.amount ?? 0),
    currency: row.currency ?? "USD",
    status: row.status,
    paid_at: row.paid_at ?? null,
    paid_by: row.paid_by ?? "",
    payment_reference: row.payment_reference ?? "",
    notes: row.notes ?? "",
    payment_proof_urls: Array.isArray(row.payment_proof_url) ? row.payment_proof_url : (row.payment_proof_url ? [row.payment_proof_url] : null),
    created_at: row.created_at,
    updated_at: row.updated_at,
    obligation_name: row.obligation_name ?? row.name ?? undefined,
    category: row.category ?? undefined,
    provider: row.provider ?? undefined,
    frequency: row.frequency ?? undefined,
    importance: row.importance ?? undefined,
    responsible: row.responsible ?? undefined,
    payment_method: row.payment_method ?? undefined,
    urgency: row.urgency ?? (due ? computeUrgency(due) : undefined),
  };
}

export function useAdminData() {
  const scope = useAdminScope();
  const VIEW = scope.view as any;
  const OBLIGATIONS = scope.obligations as any;
  const INSTANCES = scope.instances as any;
  const AUDIT = scope.audit as any;
  const CONFIG = scope.config as any;
  const audit = (entry: Parameters<typeof logAudit>[1]) => logAudit(AUDIT, entry);

  const [instances, setInstances] = useState<ObligationInstance[]>([]);
  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const autoUpdateStaleStatuses = useCallback(async (rows: ObligationInstance[]) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in7 = new Date(today);
    in7.setDate(in7.getDate() + 7);
    const todayStr = today.toISOString().slice(0, 10);
    const in7Str = in7.toISOString().slice(0, 10);

    const toVencido: string[] = [];
    const toProximo: string[] = [];

    for (const r of rows) {
      if (r.status !== "pendiente") continue;
      if (r.due_date < todayStr) {
        toVencido.push(r.id);
        r.status = "vencido";
      } else if (r.due_date <= in7Str) {
        toProximo.push(r.id);
        r.status = "proximo_vencer";
      }
    }

    const ops: Promise<unknown>[] = [];
    if (toVencido.length) {
      ops.push((supabase.from(INSTANCES) as any).update({ status: "vencido" }).in("id", toVencido));
    }
    if (toProximo.length) {
      ops.push((supabase.from(INSTANCES) as any).update({ status: "proximo_vencer" }).in("id", toProximo));
    }
    if (ops.length) await Promise.all(ops);
    return rows;
  }, []);

  const ensureInstancesForMonth = useCallback(async (month: string) => {
    const [y, m] = month.split("-").map(Number);
    const monthStart = new Date(y, m - 1, 1);
    const monthEnd = new Date(y, m, 1);
    const today = new Date();
    // Only generate if month is current or future
    if (monthEnd <= new Date(today.getFullYear(), today.getMonth(), 1)) return;

    const { data: oblig } = await (supabase.from(OBLIGATIONS) as any)
      .select("*")
      .eq("status", "active")
      .in("frequency", RECURRING_FREQUENCIES);

    const list = (oblig ?? []) as Obligation[];
    if (!list.length) return;

    // Generate up to this month + 1 ahead from today
    const monthsAhead = Math.max(
      1,
      (y - today.getFullYear()) * 12 + (m - 1 - today.getMonth()) + 2,
    );
    await Promise.all(list.map((o) => generateRecurringInstances(INSTANCES, o, monthsAhead)));
  }, []);

  const fetchInstances = useCallback(async (filters: InstanceFilters = {}) => {
    if (filters.month) {
      await ensureInstancesForMonth(filters.month);
    }
    let query = (supabase.from(VIEW) as any).select("*").order("due_date", { ascending: true });

    if (filters.month) {
      const [y, m] = filters.month.split("-").map(Number);
      const start = new Date(y, m - 1, 1).toISOString().slice(0, 10);
      const end = new Date(y, m, 1).toISOString().slice(0, 10);
      query = query.gte("due_date", start).lt("due_date", end);
    }
    if (filters.category) query = query.eq("category", filters.category);
    if (filters.responsible) query = query.eq("responsible", filters.responsible);
    if (filters.status) query = query.eq("status", filters.status);
    if (filters.importance) query = query.eq("importance", filters.importance);

    const { data, error } = await query;
    if (error) throw error;
    const mapped = (data ?? []).map(mapInstance);
    await autoUpdateStaleStatuses(mapped);
    setInstances(mapped);
    return mapped;
  }, [autoUpdateStaleStatuses, ensureInstancesForMonth]);

  const fetchObligations = useCallback(async () => {
    const { data, error } = await (supabase.from(OBLIGATIONS) as any)
      .select("*")
      .neq("status", "cancelled")
      .order("name", { ascending: true });
    if (error) throw error;
    setObligations((data ?? []) as Obligation[]);
    return (data ?? []) as Obligation[];
  }, []);

  const fetchObligation = useCallback(async (id: string) => {
    const { data, error } = await (supabase.from(OBLIGATIONS) as any)
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data as Obligation;
  }, []);

  const fetchInstancesByObligation = useCallback(async (obligationId: string) => {
    const { data, error } = await (supabase.from(VIEW) as any)
      .select("*")
      .eq("obligation_id", obligationId)
      .order("due_date", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapInstance);
  }, []);

  const fetchAuditLog = useCallback(async (obligationId: string) => {
    const { data, error } = await (supabase.from(AUDIT) as any)
      .select("*")
      .eq("obligation_id", obligationId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return (data ?? []) as Array<{
      id: string;
      action: string;
      field_changed: string | null;
      old_value: string | null;
      new_value: string | null;
      performed_by: string | null;
      created_at: string;
    }>;
  }, []);

  const updateObligation = useCallback(async (id: string, patch: Partial<Obligation>) => {
    const { data: row, error } = await (supabase.from(OBLIGATIONS) as any)
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    await audit({
      action: "update_obligation",
      obligation_id: id,
      new_value: JSON.stringify(patch).slice(0, 500),
    });
    return row as Obligation;
  }, []);

  const createObligation = useCallback(async (data: Partial<Obligation>) => {
    const { data: row, error } = await (supabase.from(OBLIGATIONS) as any)
      .insert(data)
      .select()
      .single();
    if (error) throw error;
    await audit({ action: "create_obligation", obligation_id: row.id, new_value: row.name });
    // Seed 12 months of recurring instances if applicable
    try {
      await generateRecurringInstances(INSTANCES, row as Obligation, 12);
    } catch (err) {
      console.warn("[admin] failed to seed recurring instances", err);
    }
    await fetchObligations();
    return row as Obligation;
  }, [fetchObligations]);

  const createInstance = useCallback(async (data: Partial<ObligationInstance>) => {
    const { data: row, error } = await (supabase.from(INSTANCES) as any)
      .insert(data)
      .select()
      .single();
    if (error) throw error;
    await audit({
      action: "create_instance",
      instance_id: row.id,
      obligation_id: row.obligation_id,
      new_value: row.period_label,
    });
    return row;
  }, []);

  const updateInstance = useCallback(async (id: string, patch: Partial<ObligationInstance>) => {
    const { data: row, error } = await (supabase.from(INSTANCES) as any)
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    await audit({
      action: "update_instance",
      instance_id: id,
      new_value: JSON.stringify(patch).slice(0, 500),
    });
    return row;
  }, []);

  const updateInstanceAndFuture = useCallback(
    async (
      id: string,
      patch: Partial<ObligationInstance>,
      obligationId: string,
      dueDate: string,
    ) => {
      // 1. Update current instance
      const { data: row, error } = await (supabase.from(INSTANCES) as any)
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;

      // 2. Build "structural" patch (no per-month fields)
      const futurePatch: Record<string, unknown> = {};
      if ("amount" in patch) futurePatch.amount = patch.amount;
      if ("currency" in patch) futurePatch.currency = patch.currency;
      if ("notes" in patch) futurePatch.notes = patch.notes;
      if (
        "status" in patch &&
        patch.status &&
        ["pendiente", "proximo_vencer", "pausado"].includes(patch.status as string)
      ) {
        futurePatch.status = patch.status;
      }

      let bulkCount = 0;
      if (Object.keys(futurePatch).length > 0) {
        const { data: bulk, error: bulkErr } = await (supabase.from(INSTANCES) as any)
          .update(futurePatch)
          .eq("obligation_id", obligationId)
          .gt("due_date", dueDate)
          .in("status", ["pendiente", "proximo_vencer", "pausado"])
          .select("id");
        if (bulkErr) throw bulkErr;
        bulkCount = bulk?.length ?? 0;
      }

      await audit({
        action: "update_instance_bulk",
        instance_id: id,
        obligation_id: obligationId,
        new_value: `current + ${bulkCount} futuras · ${JSON.stringify(futurePatch).slice(0, 400)}`,
      });
      return { row, bulkCount };
    },
    [],
  );

  const markAsPaid = useCallback(
    async (id: string, paidBy: string, ref: string, proofPaths: string[] = [], existingPaths: string[] = []) => {
      const today = new Date().toISOString().slice(0, 10);
      const merged = [...existingPaths, ...proofPaths];
      const patch: Record<string, unknown> = {
        status: "pagado",
        paid_at: today,
        paid_by: paidBy,
        payment_reference: ref,
      };
      if (merged.length > 0) patch.payment_proof_url = merged;
      const { data: row, error } = await (supabase.from(INSTANCES) as any)
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      await audit({
        action: "mark_paid",
        instance_id: id,
        field_changed: "status",
        new_value: merged.length > 0 ? `pagado (${merged.length} comprobante${merged.length === 1 ? "" : "s"})` : "pagado",
        performed_by: paidBy,
      });
      return row;
    },
    [],
  );

  const updatePaymentInfo = useCallback(
    async (id: string, patch: { paid_at?: string; paid_by?: string; payment_reference?: string; payment_proof_url?: string[] | null }) => {
      const { data: row, error } = await (supabase.from(INSTANCES) as any)
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      await audit({
        action: "update_payment_info",
        instance_id: id,
        new_value: JSON.stringify(patch).slice(0, 400),
      });
      return row;
    },
    [],
  );

  const fetchConfig = useCallback(async (category: string) => {
    const { data, error } = await (supabase.from(CONFIG) as any)
      .select("*")
      .eq("category", category)
      .eq("active", true)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return (data ?? []) as Array<{ id: string; category: string; value: string }>;
  }, []);

  const fetchKPIs = useCallback(async (month: string): Promise<AdminKPIs> => {
    const [y, m] = month.split("-").map(Number);
    const start = new Date(y, m - 1, 1).toISOString().slice(0, 10);
    const end = new Date(y, m, 1).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);

    const { data, error } = await (supabase.from(INSTANCES) as any)
      .select("amount,status,due_date")
      .gte("due_date", start)
      .lt("due_date", end);
    if (error) throw error;

    let totalDue = 0;
    let totalPaid = 0;
    let pendingCount = 0;
    let overdueCount = 0;
    let upcomingCount = 0;

    for (const r of data ?? []) {
      const amt = Number(r.amount ?? 0);
      totalDue += amt;
      if (r.status === "pagado") totalPaid += amt;
      if (r.status === "pendiente" || r.status === "proximo_vencer") {
        pendingCount += 1;
        if (r.due_date < today) overdueCount += 1;
        else upcomingCount += 1;
      }
      if (r.status === "vencido") overdueCount += 1;
    }

    return { totalDue, totalPaid, pendingCount, overdueCount, upcomingCount };
  }, []);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([fetchInstances(), fetchObligations()]);
    } catch (e: any) {
      setError(e?.message ?? "Error cargando datos");
    } finally {
      setLoading(false);
    }
  }, [fetchInstances, fetchObligations]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return {
    instances,
    obligations,
    loading,
    error,
    fetchInstances,
    fetchObligations,
    fetchObligation,
    fetchInstancesByObligation,
    fetchAuditLog,
    createObligation,
    updateObligation,
    createInstance,
    updateInstance,
    updateInstanceAndFuture,
    markAsPaid,
    updatePaymentInfo,
    fetchConfig,
    fetchKPIs,
    refetch,
  };
}
