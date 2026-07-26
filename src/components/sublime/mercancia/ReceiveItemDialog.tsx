import { useEffect, useState } from "react";
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
import { ImageIcon } from "lucide-react";
import { toast } from "sonner";
import {
  useMerchMutations,
  type SublimeMerchItem,
  type SublimeMerchShipment,
  type SublimeMerchBox,
} from "@/hooks/useSublimeMerch";
import { resolvePhotoUrl } from "@/lib/sublimeMerch";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  item: SublimeMerchItem | null;
  shipment?: SublimeMerchShipment | null;
  box?: SublimeMerchBox | null;
}

export function ReceiveItemDialog({ open, onOpenChange, item, shipment, box }: Props) {
  const { markItemReceived } = useMerchMutations();
  const [thumb, setThumb] = useState<string>("");
  const primary = item?.fotos_origen?.[0] ?? item?.fotos_web?.[0] ?? null;

  useEffect(() => {
    let cancelled = false;
    if (!primary) {
      setThumb("");
      return;
    }
    resolvePhotoUrl(primary).then((r) => {
      if (!cancelled) setThumb(r);
    });
    return () => {
      cancelled = true;
    };
  }, [primary]);

  const confirm = async () => {
    if (!item) return;
    try {
      await markItemReceived.mutateAsync(item.id);
      toast.success("Producto recibido");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo marcar recibido");
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar recepción</AlertDialogTitle>
          <AlertDialogDescription>
            ¿Confirmas que esta prenda llegó a Venezuela?
          </AlertDialogDescription>
        </AlertDialogHeader>
        {item ? (
          <div className="flex gap-3 border rounded-md p-3 bg-muted/20">
            <div className="h-16 w-16 rounded-md bg-muted/40 border overflow-hidden flex items-center justify-center shrink-0">
              {thumb ? (
                <img src={thumb} alt="" className="h-full w-full object-cover" />
              ) : (
                <ImageIcon className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 text-sm space-y-0.5">
              <p className="font-semibold truncate">{item.name}</p>
              <p className="text-xs text-muted-foreground">
                SKU: {item.sku_web ?? "—"} · Cód: {item.codigo_fabricante ?? "—"}
              </p>
              <p className="text-xs text-muted-foreground">
                Envío: {shipment?.shipment_number ?? "—"} · Caja:{" "}
                {box?.box_number ?? "—"}
              </p>
            </div>
          </div>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              confirm();
            }}
            disabled={markItemReceived.isPending}
          >
            Confirmar recepción
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
