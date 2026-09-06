import { useCallback, useMemo, useState } from "react";
import type { NotionTask } from "@/hooks/usePlanningData";
import { deriveStatus, type DerivedStatus } from "@/lib/planningStatus";

const ME_KEY = "planning:me";

export type StatusFilter = DerivedStatus | "all";

export function usePlanningFilters() {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [person, setPerson] = useState<string | "all">("all");
  const [me, setMeState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(ME_KEY);
    } catch {
      return null;
    }
  });

  const setMe = useCallback((name: string | null) => {
    setMeState(name);
    try {
      if (name) localStorage.setItem(ME_KEY, name);
      else localStorage.removeItem(ME_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const apply = useCallback(
    (tasks: NotionTask[]) =>
      tasks.filter((t) => {
        if (status !== "all" && deriveStatus(t) !== status) return false;
        if (person !== "all" && !(t.assignee ?? []).some((a) => a.name === person)) return false;
        return true;
      }),
    [status, person],
  );

  return { status, setStatus, person, setPerson, me, setMe, apply };
}

/** People tagged in the given (visible period) tasks, sorted alphabetically. */
export function usePeopleOptions(tasks: NotionTask[]) {
  return useMemo(() => {
    const set = new Set<string>();
    for (const t of tasks) for (const a of t.assignee ?? []) if (a?.name) set.add(a.name);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [tasks]);
}
