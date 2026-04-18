import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createContact, fetchConfig } from "@/hooks/useRRPPData";
import type { ContactType, RelationshipStatus } from "@/types/rrpp";
import { RELATIONSHIP_LABELS } from "./rrppConstants";

const schema = z.object({
  name: z.string().trim().min(1, "Nombre requerido").max(120),
  alias: z.string().trim().max(80).optional().or(z.literal("")),
  contact_type: z.string().min(1, "Selecciona el tipo"),
  main_channel: z.string().trim().max(80).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  email: z.string().trim().email("Email inválido").max(255).optional().or(z.literal("")),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  responsible: z.string().trim().max(80).optional().or(z.literal("")),
  relationship_status: z.string().min(1),
  observations: z.string().max(1000).optional().or(z.literal("")),
});

const DEFAULT_TYPES: { value: ContactType; label: string }[] = [
  { value: "influencer", label: "Influencer" },
  { value: "lider_opinion", label: "Líder de opinión" },
  { value: "creador_contenido", label: "Creador de contenido" },
  { value: "modelo", label: "Modelo" },
  { value: "embajador", label: "Embajador" },
  { value: "aliado", label: "Aliado" },
  { value: "colaborador", label: "Colaborador" },
  { value: "allegado", label: "Allegado" },
  { value: "estrategico", label: "Estratégico" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function AddContactSheet({ open, onOpenChange, onCreated }: Props) {
  const [saving, setSaving] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string>("");
  const [types, setTypes] = useState<{ value: string; label: string }[]>(DEFAULT_TYPES);
  const [cities, setCities] = useState<string[]>([]);
  const [form, setForm] = useState({
    name: "",
    alias: "",
    contact_type: "influencer",
    main_channel: "",
    phone: "",
    email: "",
    city: "",
    responsible: "",
    relationship_status: "nuevo" as RelationshipStatus,
    observations: "",
  });

  useEffect(() => {
    if (!open) return;
    fetchConfig("contact_type").then((rows) => {
      if (rows.length) setTypes(rows.map((r) => ({ value: r.key, label: r.value })));
    }).catch(() => {});
    fetchConfig("city").then((rows) => {
      setCities(rows.map((r) => r.value));
    }).catch(() => {});
  }, [open]);

  const initials = form.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "?";

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoUrl(String(reader.result));
    reader.readAsDataURL(file);
  };

  const reset = () => {
    setForm({
      name: "", alias: "", contact_type: "influencer", main_channel: "",
      phone: "", email: "", city: "", responsible: "",
      relationship_status: "nuevo", observations: "",
    });
    setPhotoUrl("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }
    setSaving(true);
    try {
      await createContact({
        ...parsed.data,
        contact_type: parsed.data.contact_type as ContactType,
        relationship_status: parsed.data.relationship_status as RelationshipStatus,
        photo_url: photoUrl || null,
      } as any);
      toast.success("Contacto creado");
      reset();
      onOpenChange(false);
      onCreated();
    } catch (err: any) {
      toast.error(err?.message ?? "Error al crear contacto");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="brand-heading text-xl">Agregar contacto</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              {photoUrl && <AvatarImage src={photoUrl} alt="preview" />}
              <AvatarFallback className="bg-secondary text-secondary-foreground font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <Label htmlFor="photo" className="text-xs text-muted-foreground">Foto (opcional)</Label>
              <Input id="photo" type="file" accept="image/*" onChange={handlePhoto} className="mt-1" />
            </div>
          </div>

          <div>
            <Label htmlFor="name">Nombre *</Label>
            <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={120} required />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="alias">Alias</Label>
              <Input id="alias" value={form.alias} onChange={(e) => setForm({ ...form, alias: e.target.value })} maxLength={80} />
            </div>
            <div>
              <Label htmlFor="contact_type">Tipo de contacto *</Label>
              <Select value={form.contact_type} onValueChange={(v) => setForm({ ...form, contact_type: v })}>
                <SelectTrigger id="contact_type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {types.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="main_channel">Canal principal</Label>
              <Input id="main_channel" placeholder="Instagram, TikTok…" value={form.main_channel} onChange={(e) => setForm({ ...form, main_channel: e.target.value })} maxLength={80} />
            </div>
            <div>
              <Label htmlFor="phone">Teléfono</Label>
              <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={40} />
            </div>
          </div>

          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={255} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="city">Ciudad</Label>
              <Input id="city" list="rrpp-cities" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} maxLength={80} />
              <datalist id="rrpp-cities">
                {cities.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div>
              <Label htmlFor="responsible">Responsable interno</Label>
              <Input id="responsible" value={form.responsible} onChange={(e) => setForm({ ...form, responsible: e.target.value })} maxLength={80} />
            </div>
          </div>

          <div>
            <Label htmlFor="relationship_status">Estado inicial</Label>
            <Select value={form.relationship_status} onValueChange={(v) => setForm({ ...form, relationship_status: v as RelationshipStatus })}>
              <SelectTrigger id="relationship_status"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(RELATIONSHIP_LABELS) as RelationshipStatus[]).map((k) => (
                  <SelectItem key={k} value={k}>{RELATIONSHIP_LABELS[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="observations">Notas breves</Label>
            <Textarea id="observations" rows={3} maxLength={1000} value={form.observations} onChange={(e) => setForm({ ...form, observations: e.target.value })} />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar contacto"}</Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
