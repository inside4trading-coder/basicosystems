import { supabase } from "@/integrations/supabase/client";
import type { Contact, ContactFilters } from "@/types/rrpp";

// Tables aren't in generated types yet — cast client to any for these queries.
const db = supabase as any;

async function logAudit(params: {
  contact_id?: string | null;
  action: string;
  field_changed?: string | null;
  old_value?: string | null;
  new_value?: string | null;
}) {
  const { data: userData } = await supabase.auth.getUser();
  const performed_by = userData.user?.email ?? userData.user?.id ?? "system";
  await db.from("rrpp_audit_log").insert({
    contact_id: params.contact_id ?? null,
    action: params.action,
    field_changed: params.field_changed ?? null,
    old_value: params.old_value ?? null,
    new_value: params.new_value ?? null,
    performed_by,
  });
}

export async function fetchContacts(filters: ContactFilters = {}): Promise<Contact[]> {
  let q = db
    .from("rrpp_contacts")
    .select("*, social_media:rrpp_social_media(*)")
    .order("created_at", { ascending: false });

  if (filters.status) q = q.eq("status", filters.status);
  else q = q.eq("status", "active");

  if (filters.contact_type) q = q.eq("contact_type", filters.contact_type);
  if (filters.relationship_status) q = q.eq("relationship_status", filters.relationship_status);
  if (filters.responsible) q = q.eq("responsible", filters.responsible);
  if (filters.search) {
    const s = `%${filters.search}%`;
    q = q.or(`name.ilike.${s},alias.ilike.${s},email.ilike.${s},main_tag.ilike.${s}`);
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Contact[];
}

export async function fetchContactById(id: string): Promise<Contact | null> {
  const { data, error } = await db
    .from("rrpp_contacts")
    .select("*, social_media:rrpp_social_media(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as Contact | null;
}

export async function createContact(payload: Partial<Contact>): Promise<Contact> {
  const { data: userData } = await supabase.auth.getUser();
  const insertPayload = { ...payload, created_by: userData.user?.id ?? null };
  const { data, error } = await db
    .from("rrpp_contacts")
    .insert(insertPayload)
    .select()
    .single();
  if (error) throw error;
  await logAudit({ contact_id: data.id, action: "create", new_value: data.name });
  return data as Contact;
}

export async function updateContact(id: string, patch: Partial<Contact>): Promise<Contact> {
  const { data: prev } = await db.from("rrpp_contacts").select("*").eq("id", id).maybeSingle();
  const { data, error } = await db
    .from("rrpp_contacts")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;

  // Log every changed field
  if (prev) {
    for (const key of Object.keys(patch)) {
      const oldVal = (prev as any)[key];
      const newVal = (patch as any)[key];
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        await logAudit({
          contact_id: id,
          action: "update",
          field_changed: key,
          old_value: oldVal == null ? null : String(oldVal),
          new_value: newVal == null ? null : String(newVal),
        });
      }
    }
  }
  return data as Contact;
}

export async function archiveContact(id: string): Promise<void> {
  const { error } = await db.from("rrpp_contacts").update({ status: "archived" }).eq("id", id);
  if (error) throw error;
  await logAudit({ contact_id: id, action: "archive", field_changed: "status", new_value: "archived" });
}

export async function deleteContact(id: string): Promise<void> {
  const { error } = await db.from("rrpp_contacts").delete().eq("id", id);
  if (error) throw error;
  await logAudit({ contact_id: id, action: "delete" });
}

export async function fetchConfig(category: string): Promise<Array<{ key: string; value: string }>> {
  const { data, error } = await db
    .from("rrpp_config")
    .select("key,value")
    .eq("category", category)
    .order("key");
  if (error) throw error;
  return data ?? [];
}
