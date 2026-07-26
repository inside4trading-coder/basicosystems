import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, Pencil, Plus, Package, PackageCheck } from "lucide-react";
import { toast } from "sonner";
import {
  useSublimeShipments,
  useShipmentBoxCounts,
  useSublimeBoxes,
  useMerchMutations,
  type SublimeMerchShipment,
  type SublimeMerchBox,
} from "@/hooks/useSublimeMerch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ShipmentEditorDialog } from "./ShipmentEditorDialog";
import { BoxEditorDialog } from "./BoxEditorDialog";


interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return "—";
  }
}

function ShipmentRow({
  shipment,
  boxCount,
  onEdit,
  onCreateBox,
  onEditBox,
}: {
  shipment: SublimeMerchShipment;
  boxCount: number;
  onEdit: () => void;
  onCreateBox: () => void;
  onEditBox: (b: SublimeMerchBox) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { data: boxes = [] } = useSublimeBoxes(expanded ? shipment.id : undefined);

  return (
    <>
      <TableRow>
        <TableCell className="w-8">
          <Collapsible open={expanded} onOpenChange={setExpanded}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 px-1">
                <ChevronDown
                  className={`h-4 w-4 transition ${expanded ? "" : "-rotate-90"}`}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent />
          </Collapsible>
        </TableCell>
        <TableCell className="font-medium">{shipment.shipment_number}</TableCell>
        <TableCell>
          <Badge variant="secondary">{shipment.status}</Badge>
        </TableCell>
        <TableCell>{fmtDate(shipment.sent_at)}</TableCell>
        <TableCell className="text-right">
          {Number(shipment.cost_per_kg_eur).toFixed(2)} €
        </TableCell>
        <TableCell className="text-right">{boxCount}</TableCell>
        <TableCell className="text-right">
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="sm" onClick={onCreateBox} title="Nueva caja">
              <Plus className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onEdit} title="Editar envío">
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={7} className="bg-muted/20">
            <div className="p-2 space-y-2">
              {boxes.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  Sin cajas en este envío.
                </p>
              ) : (
                <div className="grid gap-1">
                  {boxes.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-between text-sm border-b border-border/40 py-1"
                    >
                      <div className="flex items-center gap-2">
                        <Package className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-medium">{b.box_number}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {b.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {Number(b.weight_kg).toFixed(2)} kg
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEditBox(b)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export function ShipmentsManagerDialog({ open, onOpenChange }: Props) {
  const { data: shipments = [], isLoading } = useSublimeShipments();
  const { data: counts = {} } = useShipmentBoxCounts();
  const [editingShip, setEditingShip] = useState<SublimeMerchShipment | null>(null);
  const [openShip, setOpenShip] = useState(false);
  const [editingBox, setEditingBox] = useState<SublimeMerchBox | null>(null);
  const [openBox, setOpenBox] = useState(false);
  const [boxShipmentId, setBoxShipmentId] = useState<string | undefined>();

  const openNewShip = () => {
    setEditingShip(null);
    setOpenShip(true);
  };
  const openEditShip = (s: SublimeMerchShipment) => {
    setEditingShip(s);
    setOpenShip(true);
  };
  const openNewBox = (shipmentId: string) => {
    setEditingBox(null);
    setBoxShipmentId(shipmentId);
    setOpenBox(true);
  };
  const openEditBox = (b: SublimeMerchBox) => {
    setEditingBox(b);
    setBoxShipmentId(b.shipment_id);
    setOpenBox(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gestionar envíos</DialogTitle>
            <DialogDescription>
              Envíos, cajas y estado. Recepción disponible en Fase 3.
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-end">
            <Button size="sm" onClick={openNewShip}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo envío
            </Button>
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground p-4 text-center">Cargando…</p>
          ) : shipments.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4 text-center">
              Sin envíos aún. Crea el primero con "Nuevo envío".
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Nº envío</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Fecha envío</TableHead>
                    <TableHead className="text-right">€/kg</TableHead>
                    <TableHead className="text-right">Cajas</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shipments.map((s) => (
                    <ShipmentRow
                      key={s.id}
                      shipment={s}
                      boxCount={counts[s.id] ?? 0}
                      onEdit={() => openEditShip(s)}
                      onCreateBox={() => openNewBox(s.id)}
                      onEditBox={openEditBox}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ShipmentEditorDialog
        open={openShip}
        onOpenChange={setOpenShip}
        shipment={editingShip}
      />
      <BoxEditorDialog
        open={openBox}
        onOpenChange={setOpenBox}
        box={editingBox}
        defaultShipmentId={boxShipmentId}
      />
    </>
  );
}
