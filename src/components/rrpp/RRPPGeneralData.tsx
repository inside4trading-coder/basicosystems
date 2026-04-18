import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchConfig } from "@/hooks/useRRPPData";
import type { Contact, ContactType } from "@/types/rrpp";
import { CONTACT_TYPE_LABELS } from "./rrppConstants";

interface Props {
  contact: Contact;
  draft: Partial<Contact>;
  setDraft: (d: Partial<Contact>) => void;
  editing: boolean;
}

export function RRPPGeneralData({ contact, draft, setDraft, editing }: Props) {
  const [cities, setCities] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);

  useEffect(() => {
    fetchConfig("city").then((rows) => setCities(rows.map((r) => r.value))).catch(() => {});
    fetchConfig("contact_type").then((rows) => setTypes(rows.map((r) => r.value))).catch(() => {});
  }, []);

  const initials = (contact.name ?? "")
    .split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";

  const renderText = (label: string, key: keyof Contact, opts?: { type?: string; max?: number }) => (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {editing ? (
        <Input
          type={opts?.type ?? "text"}
          value={(draft[key] as string) ?? ""}
          onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
          maxLength={opts?.max ?? 120}
          className="mt-1"
        />
      ) : (
        <p className="mt-1 text-sm">{(contact[key] as string) || <span className="text-muted-foreground">—</span>}</p>
      )}
    </div>
  );

  return (
    <div className="kpi-card space-y-6">
      {/* Photo */}
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16">
          {(editing ? draft.photo_url : contact.photo_url) && (
            <AvatarImage src={(editing ? draft.photo_url : contact.photo_url) as string} />
          )}
          <AvatarFallback className="bg-secondary text-secondary-foreground font-bold">{initials}</AvatarFallback>
        </Avatar>
        {editing && (
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground">URL de foto</Label>
            <Input
              value={draft.photo_url ?? ""}
              onChange={(e) => setDraft({ ...draft, photo_url: e.target.value })}
              maxLength={500}
              className="mt-1"
              placeholder="https://…"
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderText("Nombre", "name", { max: 120 })}
        {renderText("Alias", "alias", { max: 80 })}

        <div>
          <Label className="text-xs text-muted-foreground">Tipo de contacto</Label>
          {editing ? (
            <Select
              value={(draft.contact_type as string) ?? contact.contact_type}
              onValueChange={(v) => setDraft({ ...draft, contact_type: v as ContactType })}
            >
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(CONTACT_TYPE_LABELS) as ContactType[]).map((k) => (
                  <SelectItem key={k} value={k}>{CONTACT_TYPE_LABELS[k]}</SelectItem>
                ))}
                {types.filter((t) => !(t in CONTACT_TYPE_LABELS)).map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="mt-1 text-sm">{CONTACT_TYPE_LABELS[contact.contact_type] ?? contact.contact_type}</p>
          )}
        </div>

        {renderText("Canal principal", "main_channel", { max: 80 })}
        {renderText("Teléfono", "phone", { max: 40 })}
        {renderText("Email", "email", { type: "email", max: 255 })}

        <div>
          <Label className="text-xs text-muted-foreground">Ciudad</Label>
          {editing ? (
            <>
              <Input
                list="rrpp-cities"
                value={draft.city ?? ""}
                onChange={(e) => setDraft({ ...draft, city: e.target.value })}
                maxLength={80}
                className="mt-1"
              />
              <datalist id="rrpp-cities">
                {cities.map((c) => <option key={c} value={c} />)}
              </datalist>
            </>
          ) : (
            <p className="mt-1 text-sm">{contact.city || <span className="text-muted-foreground">—</span>}</p>
          )}
        </div>

        {renderText("País", "country", { max: 80 })}
        {renderText("Responsable interno", "responsible", { max: 80 })}
        {renderText("Etiqueta principal", "main_tag", { max: 80 })}
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">Observaciones generales</Label>
        {editing ? (
          <Textarea
            rows={4}
            maxLength={1000}
            className="mt-1"
            value={draft.observations ?? ""}
            onChange={(e) => setDraft({ ...draft, observations: e.target.value })}
          />
        ) : (
          <p className="mt-1 text-sm whitespace-pre-wrap">
            {contact.observations || <span className="text-muted-foreground">—</span>}
          </p>
        )}
      </div>
    </div>
  );
}
