import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Copy, Trash2, Eye, Upload, Link as LinkIcon, Camera } from "lucide-react";
import { toast } from "sonner";
import {
  resolvePhotoUrl,
  validatePhotoFile,
  validatePhotoUrl,
  copyPhotoUrl,
  downloadPhoto,
  type PhotoType,
} from "@/lib/sublimeMerch";
import { useMerchMutations } from "@/hooks/useSublimeMerch";

interface Props {
  itemId: string;
  type: PhotoType;
  photos: string[];
  allowUrlInput?: boolean;
  showBankTools?: boolean;
}

export function PhotoGallery({
  itemId,
  type,
  photos,
  allowUrlInput = false,
  showBankTools = false,
}: Props) {
  const { uploadPhotoToItem, removePhotoFromItem, addWebPhotoUrl } = useMerchMutations();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [urlInput, setUrlInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);

  const handleFiles = async (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        const check = validatePhotoFile(file);
        if (!check.ok) {
          toast.error(check.message);
          continue;
        }
        await uploadPhotoToItem.mutateAsync({ itemId, type, file });
      }
      toast.success("Foto(s) subida(s).");
    } catch (e: any) {
      toast.error(e?.message ?? "Error al subir foto");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
    }
  };


  const handleAddUrl = async () => {
    const check = validatePhotoUrl(urlInput);
    if (!check.ok) {
      toast.error(check.message);
      return;
    }
    try {
      await addWebPhotoUrl.mutateAsync({ itemId, url: urlInput.trim() });
      setUrlInput("");
      toast.success("URL agregada.");
    } catch (e: any) {
      toast.error(e?.message ?? "Error al agregar URL");
    }
  };

  const handleCopyAllUrls = async () => {
    if (photos.length === 0) return;
    const resolved = await Promise.all(photos.map((p) => resolvePhotoUrl(p)));
    await navigator.clipboard.writeText(resolved.filter(Boolean).join("\n"));
    toast.success(`${photos.length} URL(s) copiadas.`);
  };

  const handleDownloadAll = async () => {
    if (photos.length === 0) return;
    for (const [i, p] of photos.entries()) {
      await downloadPhoto(p, `foto-web-${i + 1}`);
      await new Promise((r) => setTimeout(r, 400));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
        >
          <Upload className="h-4 w-4 mr-2" />
          Subir
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setCameraOpen(true)}
          disabled={busy}
        >
          <Camera className="h-4 w-4 mr-2" />
          Cámara
        </Button>
        <CameraCaptureDialog
          open={cameraOpen}
          onOpenChange={setCameraOpen}
          onCapture={(files) => handleFiles(files)}
          onUnavailable={() => cameraRef.current?.click()}
        />

        {showBankTools && (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleCopyAllUrls}
              disabled={photos.length === 0}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copiar URLs
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleDownloadAll}
              disabled={photos.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Descargar fotos web
            </Button>
          </>
        )}
      </div>

      {allowUrlInput && (
        <div className="flex gap-2">
          <Input
            placeholder="https://…"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddUrl();
              }
            }}
          />
          <Button type="button" size="sm" onClick={handleAddUrl} disabled={!urlInput.trim()}>
            <LinkIcon className="h-4 w-4 mr-2" />
            Agregar
          </Button>
        </div>
      )}

      {showBankTools && (
        <p className="text-xs text-muted-foreground">{photos.length} foto(s) web</p>
      )}

      {photos.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Sin fotos.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {photos.map((p) => (
            <PhotoThumb
              key={p}
              url={p}
              onDelete={() =>
                removePhotoFromItem.mutate({ itemId, type, url: p })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PhotoThumb({ url, onDelete }: { url: string; onDelete: () => void }) {
  const [resolved, setResolved] = useState<string>("");
  useEffect(() => {
    let cancelled = false;
    resolvePhotoUrl(url).then((r) => {
      if (!cancelled) setResolved(r);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div className="relative group rounded-lg border border-border/60 overflow-hidden bg-muted/30 aspect-square">
      {resolved ? (
        <img src={resolved} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="h-full w-full animate-pulse bg-muted" />
      )}
      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1">
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="h-7 w-7"
          onClick={() => resolved && window.open(resolved, "_blank")}
          title="Ver"
        >
          <Eye className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="h-7 w-7"
          onClick={() => downloadPhoto(url)}
          title="Descargar"
        >
          <Download className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="h-7 w-7"
          onClick={() => copyPhotoUrl(url).then(() => toast.success("URL copiada."))}
          title="Copiar URL"
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="destructive"
          className="h-7 w-7"
          onClick={onDelete}
          title="Eliminar"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
