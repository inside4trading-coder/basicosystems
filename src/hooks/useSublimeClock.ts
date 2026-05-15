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

  const createStore = async (name: string, address?: string) => {
    const { data, error } = await supabase
      .from("sublime_stores")
      .insert({ name, address: address ?? null })
      .select()
      .single();
    if (error) throw error;
    await refresh();
    return data as SublimeStore;
  };

  return { stores, loading, refresh, createStore };
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
