import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft, MapPin, User as UserIcon, Calendar, Pencil, Tag,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { fetchContactById, updateContact } from "@/hooks/useRRPPData";
import type { Contact } from "@/types/rrpp";
import {
  RELATIONSHIP_LABELS, CONTACT_TYPE_LABELS, relationshipBadgeClass,
} from "@/components/rrpp/rrppConstants";
import { ContactActionsMenu } from "@/components/rrpp/ContactActionsMenu";
import { RRPPAuditTrail } from "@/components/rrpp/RRPPAuditTrail";
import { RRPPGeneralData } from "@/components/rrpp/RRPPGeneralData";
import { RRPPSocialMedia } from "@/components/rrpp/RRPPSocialMedia";
import { RRPPPipeline } from "@/components/rrpp/RRPPPipeline";
import { RRPPInteractions } from "@/components/rrpp/RRPPInteractions";
import { RRPPCollaborations } from "@/components/rrpp/RRPPCollaborations";
import { RRPPPrivateNotes } from "@/components/rrpp/RRPPPrivateNotes";
import { useRRPPPermissions } from "@/components/rrpp/useRRPPPermissions";
import { ProfileHeaderSkeleton, TabContentSkeleton } from "@/components/rrpp/RRPPSkeletons";
import { AlertTriangle } from "lucide-react";
import { formatDMY } from "@/lib/dateUtils";

const ALL_TABS = [
  { value: "general", label: "Datos generales" },
  { value: "social", label: "Redes sociales" },
  { value: "relacion", label: "Relación y colaboraciones" },
  { value: "interactions", label: "Interacciones" },
  { value: "notes", label: "Notas privadas" },
] as const;

type TabValue = typeof ALL_TABS[number]["value"];

export default function RRPPProfile() {
  const { id } = useParams<{ id: string }>();
  const perms = useRRPPPermissions();
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tabs visible to current role
  const visibleTabs = useMemo(() => {
    if (perms.role === "limited") {
      return ALL_TABS.filter((t) => t.value === "relacion" || t.value === "interactions");
    }
    return ALL_TABS.filter((t) => t.value !== "notes" || perms.canViewPrivateNotes);
  }, [perms.role, perms.canViewPrivateNotes]);

  const defaultTab: TabValue = visibleTabs[0]?.value ?? "general";
  const [tab, setTab] = useState<TabValue>(defaultTab);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<Contact>>({});
  const [saving, setSaving] = useState(false);

  // Tab switch guard
  const [pendingTab, setPendingTab] = useState<TabValue | null>(null);

  // Reset tab if current one becomes hidden
  useEffect(() => {
    if (!visibleTabs.some((t) => t.value === tab)) setTab(defaultTab);
  }, [visibleTabs, tab, defaultTab]);

  const load = () => {
    if (!id) return;
    setLoading(true);
    fetchContactById(id)
      .then((c) => { setContact(c); setDraft(c ?? {}); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const initials = useMemo(() => {
    const n = contact?.name ?? "";
    return n.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
  }, [contact?.name]);

  const startEdit = () => { setDraft(contact ?? {}); setEditing(true); };
  const cancelEdit = () => { setDraft(contact ?? {}); setEditing(false); };

  const saveEdit = async () => {
    if (!contact) return;
    if (!draft.name?.trim()) { toast.error("El nombre es requerido"); return; }
    setSaving(true);
    try {
      const patch: Partial<Contact> = {};
      (Object.keys(draft) as (keyof Contact)[]).forEach((k) => {
        if (JSON.stringify((draft as any)[k]) !== JSON.stringify((contact as any)[k])) {
          (patch as any)[k] = (draft as any)[k];
        }
      });
      if (Object.keys(patch).length === 0) {
        setEditing(false);
        return;
      }
      await updateContact(contact.id, patch);
      toast.success("Cambios guardados");
      setEditing(false);
      load();
    } catch (e: any) { toast.error(e?.message ?? "Error al guardar"); }
    finally { setSaving(false); }
  };

  const handleTabChange = (next: string) => {
    const v = next as TabValue;
    if (editing) { setPendingTab(v); return; }
    setTab(v);
  };

  const confirmDiscardAndSwitch = () => {
    if (!pendingTab) return;
    setDraft(contact ?? {});
    setEditing(false);
    setTab(pendingTab);
    setPendingTab(null);
  };

  const saveAndSwitch = async () => {
    await saveEdit();
    if (pendingTab) { setTab(pendingTab); setPendingTab(null); }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Link to="/rrpp"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />RRPP</Button></Link>
        <ProfileHeaderSkeleton />
        <TabContentSkeleton />
      </div>
    );
  }
  if (error) {
    return (
      <div>
        <div className="kpi-card flex items-start gap-3 bg-status-error/10 border-status-error/20">
          <AlertTriangle className="h-5 w-5 text-status-error shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm">Error al cargar el perfil</p>
            <p className="text-xs text-muted-foreground">{error}</p>
          </div>
        </div>
      </div>
    );
  }
  if (!contact) {
    return (
      <div className="space-y-4">
        <Link to="/rrpp"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />RRPP</Button></Link>
        <div className="kpi-card text-center py-16 text-muted-foreground">Contacto no encontrado.</div>
      </div>
    );
  }

  const created = new formatDMY(Date(contact.created_at));

  return (
    <div className="space-y-6">
      <Link to="/rrpp">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-2" /> RRPP
        </Button>
      </Link>

      {/* Header */}
      <div className="kpi-card">
        <div className="flex items-start gap-4 flex-wrap">
          <Avatar className="h-20 w-20 shrink-0">
            {contact.photo_url && <AvatarImage src={contact.photo_url} alt={contact.name} />}
            <AvatarFallback className="bg-secondary text-secondary-foreground font-bold text-xl">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-[200px]">
            <div className="flex items-center gap-3 flex-wrap">
              {editing ? (
                <Input
                  value={draft.name ?? ""}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  className="text-xl font-black max-w-md"
                  maxLength={120}
                />
              ) : (
                <h1 className="text-xl font-black tracking-tight">{contact.name}</h1>
              )}
              {contact.alias && !editing && (
                <span className="text-[10px] font-semibold uppercase tracking-wide bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">
                  @{contact.alias}
                </span>
              )}
              {contact.status === "archived" && (
                <span className="status-badge-inactive">Archivado</span>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="text-[10px] font-medium uppercase tracking-wide bg-muted text-muted-foreground px-2 py-0.5 rounded">
                {CONTACT_TYPE_LABELS[contact.contact_type] ?? contact.contact_type}
              </span>
              {contact.city && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{contact.city}</span>}
              {contact.responsible && <span className="flex items-center gap-1"><UserIcon className="h-3.5 w-3.5" />{contact.responsible}</span>}
              <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{created}</span>
              {contact.main_tag && <span className="flex items-center gap-1"><Tag className="h-3.5 w-3.5" />{contact.main_tag}</span>}
            </div>

            <div className="mt-3">
              <span className={relationshipBadgeClass(contact.relationship_status)}>
                {RELATIONSHIP_LABELS[contact.relationship_status]}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {perms.canEditGeneral && (
              editing ? (
                <>
                  <Button variant="ghost" onClick={cancelEdit} disabled={saving}>Cancelar</Button>
                  <Button onClick={saveEdit} disabled={saving || perms.role === "limited"}>
                    {saving ? "Guardando…" : "Guardar"}
                  </Button>
                </>
              ) : (
                <Button variant="outline" size="sm" onClick={startEdit}>
                  <Pencil className="h-4 w-4 mr-2" /> Editar
                </Button>
              )
            )}
            {(perms.canArchive || perms.canDeleteContact) && (
              <ContactActionsMenu
                contact={contact}
                onChanged={load}
                canDelete={perms.canDeleteContact}
                canArchive={perms.canArchive}
              />
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={handleTabChange}>
        <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
          <TabsList className="w-max">
            {visibleTabs.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="whitespace-nowrap">{t.label}</TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="general" className="mt-4">
          <RRPPGeneralData contact={contact} draft={draft} setDraft={setDraft} editing={editing} />
        </TabsContent>
        <TabsContent value="social" className="mt-4">
          <RRPPSocialMedia contactId={contact.id} />
        </TabsContent>
        <TabsContent value="relacion" className="mt-4 space-y-6">
          <RRPPPipeline contact={contact} onChanged={load} />
          <RRPPCollaborations
            contactId={contact.id}
            brand={contact.brand}
            contactName={contact.name}
            contactAlias={contact.alias}
            onPipelineChanged={load}
          />
        </TabsContent>
        <TabsContent value="interactions" className="mt-4">
          <RRPPInteractions contactId={contact.id} />
        </TabsContent>
        {perms.canViewPrivateNotes && (
          <TabsContent value="notes" className="mt-4">
            <RRPPPrivateNotes contactId={contact.id} />
          </TabsContent>
        )}
      </Tabs>

      {/* Audit trail */}
      <RRPPAuditTrail contactId={contact.id} />

      {/* Switch tab guard */}
      <AlertDialog open={pendingTab !== null} onOpenChange={(o) => { if (!o) setPendingTab(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Guardar cambios?</AlertDialogTitle>
            <AlertDialogDescription>
              Tienes cambios sin guardar. ¿Quieres guardarlos antes de cambiar de pestaña?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={confirmDiscardAndSwitch}>Descartar</AlertDialogCancel>
            <AlertDialogAction onClick={saveAndSwitch} disabled={saving}>Guardar y continuar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

