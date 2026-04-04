import { supabase } from "@/integrations/supabase/client";

export async function logAudit(entry: {
  employee_id: string;
  action: string;
  field_changed?: string;
  old_value?: string;
  new_value?: string;
  performed_by?: string;
}) {
  try {
    await supabase.from("crew_audit_log").insert({
      employee_id: entry.employee_id,
      action: entry.action,
      field_changed: entry.field_changed || null,
      old_value: entry.old_value || null,
      new_value: entry.new_value || null,
      performed_by: entry.performed_by || null,
    });
  } catch {
    // Audit logging should never block the main operation
  }
}

export function logFieldChanges(
  employeeId: string,
  oldData: Record<string, any>,
  updates: Record<string, any>,
  performedBy?: string,
) {
  const fieldLabels: Record<string, string> = {
    first_name: "Nombre",
    last_name: "Apellido",
    cedula: "Cédula",
    phone: "Teléfono",
    position: "Cargo",
    location: "Sede/Área",
    start_date: "Fecha de inicio",
    current_salary: "Sueldo",
    status: "Estado",
    observations: "Observaciones",
    skills: "Skills",
  };

  const entries: Promise<void>[] = [];
  for (const [key, newVal] of Object.entries(updates)) {
    if (key === "updated_at" || key === "recurring_tasks") continue;
    const label = fieldLabels[key] || key;
    const oldVal = oldData[key];
    const oldStr = Array.isArray(oldVal) ? oldVal.join(", ") : String(oldVal ?? "");
    const newStr = Array.isArray(newVal) ? newVal.join(", ") : String(newVal ?? "");
    if (oldStr !== newStr) {
      entries.push(logAudit({
        employee_id: employeeId,
        action: "Actualizó",
        field_changed: label,
        old_value: oldStr || undefined,
        new_value: newStr || undefined,
        performed_by: performedBy,
      }));
    }
  }
  return Promise.all(entries);
}
