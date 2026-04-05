import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Employee, EmployeeStatus, RecurringTask } from "@/types/crew";

export function useCrewData() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: empRows, error: empErr } = await supabase
        .from("employees")
        .select("*")
        .order("created_at", { ascending: true });

      if (empErr) throw empErr;

      const { data: taskRows, error: taskErr } = await supabase
        .from("recurring_tasks")
        .select("*");

      if (taskErr) throw taskErr;

      const tasksByEmployee = new Map<string, RecurringTask[]>();
      for (const t of taskRows ?? []) {
        const list = tasksByEmployee.get(t.employee_id) ?? [];
        list.push({
          id: t.id,
          name: t.name,
          frequency: t.frequency as RecurringTask["frequency"],
          day: t.day ?? "",
          time: t.time ?? "",
          priority: t.priority as RecurringTask["priority"],
          area: t.area ?? "",
          responsible: t.responsible ?? "",
          active: t.active,
        });
        tasksByEmployee.set(t.employee_id, list);
      }

      const mapped: Employee[] = (empRows ?? []).map((e) => ({
        id: e.id,
        internal_id: e.internal_id,
        photo_url: e.photo_url,
        first_name: e.first_name,
        last_name: e.last_name,
        cedula: e.cedula ?? "",
        phone: e.phone ?? "",
        position: e.position,
        location: e.location ?? "",
        start_date: e.start_date,
        current_salary: e.current_salary ? Number(e.current_salary) : null,
        skills: e.skills ?? [],
        status: (e.status ?? "active") as EmployeeStatus,
        observations: e.observations ?? "",
        recurring_tasks: tasksByEmployee.get(e.id) ?? [],
        created_at: e.created_at,
        updated_at: e.updated_at,
      }));

      setEmployees(mapped);
    } catch (err: any) {
      console.error("Error fetching employees:", err);
      setError(err.message ?? "Error al cargar empleados");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const addEmployee = useCallback(async (data: {
    first_name: string;
    last_name: string;
    cedula: string;
    phone: string;
    position: string;
    location: string;
    start_date: string;
    status: EmployeeStatus;
    photo_url: string | null;
  }) => {
    const { error: insertErr } = await supabase.from("employees").insert({
      first_name: data.first_name,
      last_name: data.last_name,
      cedula: data.cedula,
      phone: data.phone,
      position: data.position,
      location: data.location,
      start_date: data.start_date,
      status: data.status,
      photo_url: data.photo_url,
      internal_id: "", // trigger will auto-generate
    });
    if (insertErr) throw insertErr;
    await fetchEmployees();
  }, [fetchEmployees]);

  const updateEmployee = useCallback(async (id: string, updates: Partial<Employee>) => {
    const { recurring_tasks, ...dbUpdates } = updates as any;
    const cleanUpdates: Record<string, any> = { ...dbUpdates, updated_at: new Date().toISOString() };
    // Remove non-DB fields
    delete cleanUpdates.internal_id;
    delete cleanUpdates.created_at;
    delete cleanUpdates.id;

    if (Object.keys(cleanUpdates).length > 1) { // more than just updated_at
      const { error: updateErr } = await supabase
        .from("employees")
        .update(cleanUpdates)
        .eq("id", id);
      if (updateErr) throw updateErr;
    }

    await fetchEmployees();
  }, [fetchEmployees]);

  const deleteEmployee = useCallback(async (id: string) => {
    const { error: delErr } = await supabase
      .from("employees")
      .delete()
      .eq("id", id);
    if (delErr) throw delErr;
    setEmployees((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const changeStatus = useCallback(async (id: string, status: EmployeeStatus) => {
    const { error: upErr } = await supabase
      .from("employees")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (upErr) throw upErr;
    await fetchEmployees();
  }, [fetchEmployees]);

  // Recurring tasks helpers
  const addRecurringTask = useCallback(async (employeeId: string, task: Omit<RecurringTask, "id">) => {
    const { error: insertErr } = await supabase.from("recurring_tasks").insert({
      employee_id: employeeId,
      name: task.name,
      frequency: task.frequency,
      day: task.day,
      time: task.time,
      priority: task.priority,
      area: task.area,
      responsible: task.responsible,
      active: task.active,
    });
    if (insertErr) throw insertErr;
    await fetchEmployees();
  }, [fetchEmployees]);

  const toggleRecurringTask = useCallback(async (taskId: string, currentActive: boolean) => {
    const { error: upErr } = await supabase
      .from("recurring_tasks")
      .update({ active: !currentActive })
      .eq("id", taskId);
    if (upErr) throw upErr;
    await fetchEmployees();
  }, [fetchEmployees]);

  const deleteRecurringTask = useCallback(async (taskId: string) => {
    const { error: delErr } = await supabase
      .from("recurring_tasks")
      .delete()
      .eq("id", taskId);
    if (delErr) throw delErr;
    await fetchEmployees();
  }, [fetchEmployees]);

  return {
    employees, loading, error, refetch: fetchEmployees,
    addEmployee, updateEmployee, deleteEmployee, changeStatus,
    addRecurringTask, toggleRecurringTask, deleteRecurringTask,
  };
}
