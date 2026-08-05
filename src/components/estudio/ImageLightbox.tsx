import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

/** Vista previa a pantalla completa de una imagen generada. */
export function ImageLightbox({
  url,
  title,
  onClose,
}: {
  url: string | null;
  title?: string;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!url} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl p-2 sm:p-4">
        <DialogTitle className="sr-only">{title ?? "Vista previa"}</DialogTitle>
        {url && (
          <img
            src={url}
            alt={title ?? "Vista previa de la imagen generada"}
            className="w-full max-h-[80vh] object-contain rounded-lg"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
