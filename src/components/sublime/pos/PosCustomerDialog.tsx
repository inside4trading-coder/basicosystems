import { useState } from "react";
import { AlertTriangle, UserRound } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  findCustomerDuplicates,
  useSublimeCustomers,
} from "@/hooks/useSublimeSalesHistory";

export interface PosCustomer {
  /** Presente cuando el cliente ya existe en la ficha de clientes. */
  id?: string;
  name: string;
  idCard: string;
  phone: string;
  email: string;
  birthDate: string;
  address: string;
}

const EMPTY: PosCustomer = { name: "", idCard: "", phone: "", email: "", birthDate: "", address: "" };

/** Buscador de clientes existentes (nombre, cédula/RIF, teléfono y correo). */
export function PosCustomerSearch({ onSelect }: { onSelect: (c: PosCustomer) => void }) {
  const [q, setQ] = useState("");
  const { data: customers = [], isLoading } = useSublimeCustomers();


  const list = customers
    .map((c) => ({
      id: c.id,
      name: c.name,
      idCard: c.id_card ?? "",
      phone: c.phone ?? "",
      email: c.email ?? "",
      birthDate: c.birth_date ?? "",
      address: c.address ?? "",
    }))
    .filter((c) =>
      `${c.name} ${c.idCard} ${c.phone} ${c.email}`.toLowerCase().includes(q.toLowerCase())
    );


  return (
    <div className="space-y-3">
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Nombre, cédula/RIF, teléfono o correo…"
        className="h-11"
      />
      <div className="space-y-2 max-h-[45vh] overflow-y-auto">
        {list.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelect(c)}
            className="w-full flex items-center gap-3 rounded-xl border border-border/60 p-3 text-left hover:border-primary/50 transition-colors"
          >
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <UserRound className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{c.name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {[c.idCard, c.phone, c.email].filter(Boolean).join(" · ") || "Sin datos de contacto"}
              </p>
            </div>
          </button>
        ))}
        {list.length === 0 && (
          <p className="text-sm text-muted-foreground py-6 text-center">
            {isLoading ? "Cargando clientes…" : "Sin coincidencias."}
          </p>
        )}
      </div>
    </div>
  );
}

/** Formulario de alta de cliente reutilizable dentro del flujo de cobro. */
export function PosCustomerForm({
  onSave,
  submitLabel = "Guardar y usar este cliente",
}: {
  onSave: (c: PosCustomer) => void;
  submitLabel?: string;
}) {
  const [draft, setDraft] = useState<PosCustomer>(EMPTY);
  const { data: customers = [] } = useSublimeCustomers();
  const duplicates = findCustomerDuplicates(
    { phone: draft.phone, email: draft.email, idCard: draft.idCard },
    customers
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Nombre / razón social" value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} />
        <Field label="Cédula / RIF" value={draft.idCard} onChange={(v) => setDraft({ ...draft, idCard: v })} />
        <Field label="Teléfono" value={draft.phone} onChange={(v) => setDraft({ ...draft, phone: v })} />
        <Field label="Correo" value={draft.email} onChange={(v) => setDraft({ ...draft, email: v })} />
        <Field label="Fecha de nacimiento" type="date" value={draft.birthDate} onChange={(v) => setDraft({ ...draft, birthDate: v })} />
        <Field label="Dirección" value={draft.address} onChange={(v) => setDraft({ ...draft, address: v })} />
      </div>
      {duplicates.length > 0 && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs space-y-1">
          <p className="flex items-center gap-2 font-semibold text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" /> Ya existe un cliente con estos datos.
          </p>
          {duplicates.slice(0, 3).map((c) => (
            <p key={c.id} className="text-muted-foreground">
              {c.name} · {[c.id_card, c.phone, c.email].filter(Boolean).join(" · ")}
            </p>
          ))}
        </div>
      )}
      <Button
        className="w-full"
        disabled={draft.name.trim() === ""}
        onClick={() => {
          onSave(draft);
          setDraft(EMPTY);
        }}
      >
        {submitLabel}
      </Button>
    </div>
  );

}

export function PosCustomerDialog({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (c: PosCustomer) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cliente de la venta</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="buscar">
          <TabsList className="w-full">
            <TabsTrigger value="buscar" className="flex-1">Buscar</TabsTrigger>
            <TabsTrigger value="nuevo" className="flex-1">Crear cliente</TabsTrigger>
          </TabsList>

          <TabsContent value="buscar" className="pt-3">
            <PosCustomerSearch onSelect={onSelect} />
          </TabsContent>

          <TabsContent value="nuevo" className="pt-3">
            <PosCustomerForm onSave={onSelect} submitLabel="Usar este cliente" />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
