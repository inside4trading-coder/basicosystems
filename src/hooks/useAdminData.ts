import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type {
  AdminKPIs,
  InstanceFilters,
  Obligation,
  ObligationInstance,
} from "@/types/admin";
import { computeUrgency } from "@/types/admin";

const VIEW = "admin_instances_view" as any;
const OBLIGATIONS = "admin_obligations" as any;
const INSTANCES = "admin_instances" as any;
const AUDIT = "admin_audit_log" as any;
const CONFIG = "admin_config" as any;

async function logAudit(entry: {
  action: string;
  obligation_id?: string | null;
  instance_id?: string | null;
  field_changed?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  performed_by?: string | null;
}) {
  await (supabase.from(AUDIT) as any).insert(entry);
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

  const fetchInstances = useCallback(async (filters: InstanceFilters = {}) => {
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
  }, [autoUpdateStaleStatuses]);

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
    await logAudit({
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
    await logAudit({ action: "create_obligation", obligation_id: row.id, new_value: row.name });
    await fetchObligations();
    return row as Obligation;
  }, [fetchObligations]);

  const createInstance = useCallback(async (data: Partial<ObligationInstance>) => {
    const { data: row, error } = await (supabase.from(INSTANCES) as any)
      .insert(data)
      .select()
      .single();
    if (error) throw error;
    await logAudit({
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
    await logAudit({
      action: "update_instance",
      instance_id: id,
      new_value: JSON.stringify(patch).slice(0, 500),
    });
    return row;
  }, []);

  const markAsPaid = useCallback(async (id: string, paidBy: string, ref: string) => {
    const today = new Date().toISOString().slice(0, 10);
    const { data: row, error } = await (supabase.from(INSTANCES) as any)
      .update({ status: "pagado", paid_at: today, paid_by: paidBy, payment_reference: ref })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    await logAudit({
      action: "mark_paid",
      instance_id: id,
      field_changed: "status",
      new_value: "pagado",
      performed_by: paidBy,
    });
    return row;
  }, []);

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
    markAsPaid,
    fetchConfig,
    fetchKPIs,
    refetch,
  };
}
