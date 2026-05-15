import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ClockEvent, ClockSettings, SublimeStore, WeeklySchedule } from "@/types/sublime";
import { EMPTY_SCHEDULE } from "@/types/sublime";

function normalizeSettings(row: any): ClockSettings {
  return {
    ...row,
    weekly_schedule: { ...EMPTY_SCHEDULE, ...(row.weekly_schedule ?? {}) } as WeeklySchedule,
  };
}

export function useSublimeStores() {
  const [stores, setStores] = useState<SublimeStore[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("sublime_stores")
      .select("*")
      .order("name", { ascending: true });
    setStores((data ?? []) as SublimeStore[]);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const createStore = async (input: Partial<SublimeStore> & { name: string }) => {
    const { data, error } = await supabase
      .from("sublime_stores")
      .insert({
        name: input.name,
        address: input.address ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        radius_meters: input.radius_meters ?? 75,
        active: input.active ?? true,
      })
      .select()
      .single();
    if (error) throw error;
    await refresh();
    return data as SublimeStore;
  };

  const updateStore = async (id: string, patch: Partial<SublimeStore>) => {
    const { error } = await supabase
      .from("sublime_stores")
      .update({
        ...(patch.name !== undefined && { name: patch.name }),
        ...(patch.address !== undefined && { address: patch.address }),
        ...(patch.latitude !== undefined && { latitude: patch.latitude }),
        ...(patch.longitude !== undefined && { longitude: patch.longitude }),
        ...(patch.radius_meters !== undefined && { radius_meters: patch.radius_meters }),
        ...(patch.active !== undefined && { active: patch.active }),
      })
      .eq("id", id);
    if (error) throw error;
    await refresh();
  };

  return { stores, loading, refresh, createStore, updateStore };
}

export function useSublimeClockSettings(employeeId: string | undefined) {
  const [settings, setSettings] = useState<ClockSettings | null>(null);
  const [recentEvents, setRecentEvents] = useState<ClockEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    const [{ data: s }, { data: ev }] = await Promise.all([
      supabase.from("sublime_clock_settings").select("*").eq("employee_id", employeeId).maybeSingle(),
      supabase
        .from("sublime_clock_events")
        .select("*")
        .eq("employee_id", employeeId)
        .order("event_at", { ascending: false })
        .limit(50),
    ]);
    setSettings(s ? normalizeSettings(s) : null);
    setRecentEvents((ev ?? []) as ClockEvent[]);
    setLoading(false);
  }, [employeeId]);

  useEffect(() => { refresh(); }, [refresh]);

  const upsert = async (patch: Partial<ClockSettings>) => {
    if (!employeeId) return;
    const base = settings ?? {
      employee_id: employeeId,
      enabled: false,
      store_id: null,
      weekly_schedule: EMPTY_SCHEDULE,
      entry_time: null,
      exit_time: null,
      break_start: null,
      break_end: null,
      break_minutes: 60,
      late_tolerance_minutes: 10,
      pin_hash: null,
      pin_set_at: null,
      blocked: false,
    } as Partial<ClockSettings>;
    const next = { ...base, ...patch, employee_id: employeeId };
    const { error } = await supabase
      .from("sublime_clock_settings")
      .upsert(next as any, { onConflict: "employee_id" });
    if (error) throw error;
    await refresh();
  };

  return { settings, recentEvents, loading, refresh, upsert };
}
