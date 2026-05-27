import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { BirthdayPerson } from "@/components/shared/CombinedBirthdays";

/**
 * Fetches birthday people from BOTH the crew (employees) and core operarios.
 * Used to display a unified "cumpleaños del mes" banner on both modules.
 */
export function useBirthdayPeople() {
  const [people, setPeople] = useState<BirthdayPerson[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [crewRes, opsRes] = await Promise.all([
        supabase.rpc("get_crew_employees"),
        supabase
          .from("core_factory_operators")
          .select("id, first_name, last_name, photo_url, birth_date, status"),
      ]);

      const crew: BirthdayPerson[] = (crewRes.data ?? [])
        .filter((e: any) => e.status === "active" && e.birth_date)
        .map((e: any) => ({
          id: e.id,
          first_name: e.first_name,
          last_name: e.last_name,
          photo_url: e.photo_url,
          birth_date: e.birth_date,
          source: "crew" as const,
        }));

      const ops: BirthdayPerson[] = (opsRes.data ?? [])
        .filter((o: any) => o.status === "active" && o.birth_date)
        .map((o: any) => ({
          id: o.id,
          first_name: o.first_name,
          last_name: o.last_name,
          photo_url: o.photo_url,
          birth_date: o.birth_date,
          source: "operario" as const,
        }));

      if (!cancelled) {
        setPeople([...crew, ...ops]);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { people, loading };
}
