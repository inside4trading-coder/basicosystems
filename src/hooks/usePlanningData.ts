import { useState, useEffect, useCallback } from "react";

export interface NotionDatabase {
  id: string;
  name: string;
  url: string;
  properties: Record<string, { type: string; name: string }>;
}

export interface NotionTask {
  id: string;
  name: string;
  assignee: { name: string; avatar_url: string | null }[];
  status: { name: string; color: string } | null;
  date: { start: string | null; end: string | null } | null;
  priority: { name: string; color: string } | null;
  area: string | null;
  notion_url: string;
  database_id: string;
  database_name: string;
}

async function callPlanningFunction(action: string, params = {}) {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const res = await fetch(
    `https://${projectId}.supabase.co/functions/v1/notion-planning`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
      },
      body: JSON.stringify({ action, ...params }),
    }
  );
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

export function usePlanningDatabases() {
  const [databases, setDatabases] = useState<NotionDatabase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await callPlanningFunction("list-databases");
      setDatabases(data.databases || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  return { databases, loading, error, refetch };
}

export function usePlanningTasks(
  selectedDatabaseId: string | "all",
  databases: NotionDatabase[]
) {
  const [tasks, setTasks] = useState<NotionTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!selectedDatabaseId || (selectedDatabaseId === "all" && databases.length === 0)) {
      setTasks([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (selectedDatabaseId === "all") {
        const results = await Promise.all(
          databases.map((db) =>
            callPlanningFunction("query-database", {
              database_id: db.id,
              database_name: db.name,
            })
          )
        );
        setTasks(results.flatMap((r) => r.tasks || []));
      } else {
        const data = await callPlanningFunction("query-database", {
          database_id: selectedDatabaseId,
          database_name: databases.find((db) => db.id === selectedDatabaseId)?.name,
        });
        setTasks(data.tasks || []);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [selectedDatabaseId, databases]);

  useEffect(() => { refetch(); }, [refetch]);

  return { tasks, loading, error, refetch };
}
