import { useState, type ReactNode } from "react";
import { Pencil } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface DropdownOption {
  value: string;
  label: string;
}

export interface ManageConfig {
  title: string;
  description?: string;
  /** Cuerpo del diálogo. Se monta al abrir y se desmonta al cerrar, así relee sus datos. */
  children: ReactNode;
  /** Se llama al cerrar, para que lo editado se refleje sin recargar la página. */
  onClose?: () => void;
}

function ManageDialog({
  manage,
  open,
  onOpenChange,
}: {
  manage: ManageConfig;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{manage.title}</DialogTitle>
          {manage.description && <DialogDescription>{manage.description}</DialogDescription>}
        </DialogHeader>
        {manage.children}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Un ajuste de la pantalla de generación: desplegable + lápiz que abre su administración
 * en un diálogo.
 *
 * El módulo no tiene sub-navegación: administrar la lista nunca saca al usuario de la
 * pantalla ni pierde la sesión de generación que tenga a medias.
 */
export function DropdownWithManageDialog({
  label,
  hint,
  value,
  onValueChange,
  options,
  placeholder,
  emptyMessage,
  manage,
}: {
  label: string;
  hint?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  /** Qué mostrar cuando no hay ninguna opción (ej. modelos sin habilitar). */
  emptyMessage?: string;
  manage?: ManageConfig;
}) {
  const [open, setOpen] = useState(false);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) manage?.onClose?.();
  };

  return (
    <div>
      <Label className="mb-2 block">{label}</Label>
      <div className="flex items-center gap-2">
        {options.length === 0 ? (
          <p className="text-sm text-muted-foreground flex-1">
            {emptyMessage ?? "No hay opciones disponibles."}
          </p>
        ) : (
          <Select value={value} onValueChange={onValueChange}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {manage && (
          <>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0"
              aria-label={`Administrar: ${manage.title}`}
              title={manage.title}
              onClick={() => setOpen(true)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <ManageDialog manage={manage} open={open} onOpenChange={handleOpenChange} />
          </>
        )}
      </div>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

/** Mismo diálogo de administración, para ajustes que no son un desplegable. */
export function ManageDialogButton({
  buttonLabel,
  manage,
}: {
  buttonLabel: string;
  manage: ManageConfig;
}) {
  const [open, setOpen] = useState(false);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) manage.onClose?.();
  };

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="mr-2 h-4 w-4" />
        {buttonLabel}
      </Button>
      <ManageDialog manage={manage} open={open} onOpenChange={handleOpenChange} />
    </>
  );
}
