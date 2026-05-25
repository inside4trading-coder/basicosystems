import { supabase } from "@/integrations/supabase/client";

export interface CoreAuditEntry {
  table: string;
  recordId?: string | null;
  action: string;
  field?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
}

function toText(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

export async function logCoreAudit(entry: CoreAuditEntry): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from("core_audit_logs").insert({
    table_name: entry.table,
    record_id: entry.recordId ?? null,
    action: entry.action,
    field_changed: entry.field ?? null,
    old_value: toText(entry.oldValue),
    new_value: toText(entry.newValue),
    performed_by: user?.email ?? user?.id ?? null,
  });
}
