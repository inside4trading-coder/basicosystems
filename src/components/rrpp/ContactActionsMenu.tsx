import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { MoreVertical, Archive, RotateCcw, Trash2, Tag } from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { archiveContact, deleteContact, updateContact } from "@/hooks/useRRPPData";
import { RELATIONSHIP_LABELS } from "@/components/rrpp/rrppConstants";
import type { Contact, RelationshipStatus } from "@/types/rrpp";

interface Props {
  contact: Contact;
  onChanged: () => void;
  canDelete?: boolean;
  canArchive?: boolean;
}

export function ContactActionsMenu({ contact, onChanged, canDelete = true, canArchive = true }: Props) {
  const navigate = useNavigate();
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [busy, setBusy] = useState(false);

  const handleStatus = async (status: RelationshipStatus) => {
    if (status === contact.relationship_status) return;
    try {
      await updateContact(contact.id, { relationship_status: status });
      toast.success(`Estado: ${RELATIONSHIP_LABELS[status]}`);
      onChanged();
    } catch (e: any) { toast.error(e?.message ?? "Error"); }
  };

  const handleArchive = async () => {
    setBusy(true);
    try {
      await archiveContact(contact.id);
      toast.success("Contacto archivado");
      setArchiveOpen(false);
      onChanged();
    } catch (e: any) { toast.error(e?.message ?? "Error"); }
    finally { setBusy(false); }
  };

  const handleReactivate = async () => {
    try {
      await updateContact(contact.id, { status: "active" });
      toast.success("Contacto reactivado");
      onChanged();
    } catch (e: any) { toast.error(e?.message ?? "Error"); }
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      await deleteContact(contact.id);
      toast.success("Contacto eliminado");
      navigate("/rrpp");
    } catch (e: any) { toast.error(e?.message ?? "Error"); setBusy(false); }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon"><MoreVertical className="h-4 w-4" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuSub>
            <DropdownMenuSubTrigger><Tag className="h-4 w-4 mr-2" />Cambiar estado</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {(Object.keys(RELATIONSHIP_LABELS) as RelationshipStatus[]).map((k) => (
                <DropdownMenuItem key={k} onClick={() => handleStatus(k)}>
                  {RELATIONSHIP_LABELS[k]}
                  {contact.relationship_status === k && <span className="ml-auto text-xs">●</span>}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          {canArchive && (
            contact.status === "active" ? (
              <DropdownMenuItem onClick={() => setArchiveOpen(true)}>
                <Archive className="h-4 w-4 mr-2" />Archivar
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={handleReactivate}>
                <RotateCcw className="h-4 w-4 mr-2" />Reactivar
              </DropdownMenuItem>
            )
          )}
          {canDelete && (
            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4 mr-2" />Eliminar
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Archivar contacto?</AlertDialogTitle>
            <AlertDialogDescription>
              {contact.name} dejará de aparecer en la lista activa. Podrás reactivarlo desde "Ver archivados".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive} disabled={busy}>Archivar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar a {contact.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              No podrás revertir esta decisión. Se eliminarán también sus interacciones, colaboraciones y notas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>No</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={busy}
              className="bg-destructive hover:bg-destructive/90"
            >
              Sí, eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
