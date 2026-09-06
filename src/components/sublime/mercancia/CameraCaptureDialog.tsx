import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, RefreshCw, Trash2, Check } from "lucide-react";
import { toast } from "sonner";

interface Shot {
  file: File;
  previewUrl: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Se llama al pulsar "Listo" con todas las fotos tomadas. */
  onCapture: (files: File[]) => void;
  /** Se llama si la cámara en vivo no está disponible (fallback al input del sistema). */
  onUnavailable?: () => void;
}

export function CameraCaptureDialog({ open, onOpenChange, onCapture, onUnavailable }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [shots, setShots] = useState<Shot[]>([]);
  const [ready, setReady] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setReady(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("unsupported");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setReady(true);
      } catch {
        if (cancelled) return;
        onOpenChange(false);
        onUnavailable?.();
      }
    })();

    return () => {
      cancelled = true;
      stop();
    };
  }, [open, facing, onOpenChange, onUnavailable, stop]);

  useEffect(() => {
    if (!open) {
      setShots((prev) => {
        prev.forEach((s) => URL.revokeObjectURL(s.previewUrl));
        return [];
      });
      setFacing("environment");
    }
  }, [open]);

  const shoot = async () => {
    const video = videoRef.current;
    if (!video || !ready) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1080;
    canvas.height = video.videoHeight || 1440;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.9),
    );
    if (!blob) {
      toast.error("No se pudo capturar la foto.");
      return;
    }
    const file = new File([blob], `foto-${Date.now()}.jpg`, { type: "image/jpeg" });
    setShots((prev) => [...prev, { file, previewUrl: URL.createObjectURL(file) }]);
  };

  const removeShot = (idx: number) =>
    setShots((prev) => {
      const target = prev[idx];
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, i) => i !== idx);
    });

  const finish = () => {
    if (shots.length > 0) onCapture(shots.map((s) => s.file));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : finish())}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Camera className="h-4 w-4" /> Tomar fotos
          </DialogTitle>
        </DialogHeader>

        <div className="relative bg-black aspect-[3/4] w-full">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="h-full w-full object-cover"
          />
          <span className="absolute top-2 right-2 rounded-full bg-background/85 px-2 py-1 text-xs font-medium">
            {shots.length} foto{shots.length === 1 ? "" : "s"} tomada{shots.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            title="Cambiar cámara"
            onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>

          <button
            type="button"
            onClick={shoot}
            disabled={!ready}
            aria-label="Tomar foto"
            className="h-16 w-16 rounded-full border-4 border-primary bg-background disabled:opacity-50 active:scale-95 transition"
          />

          <Button type="button" onClick={finish}>
            <Check className="h-4 w-4 mr-1" /> Listo
          </Button>
        </div>

        {shots.length > 0 && (
          <div className="flex gap-2 overflow-x-auto px-4 pb-4">
            {shots.map((s, i) => (
              <div
                key={s.previewUrl}
                className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-border/60"
              >
                <img src={s.previewUrl} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeShot(i)}
                  className="absolute top-0.5 right-0.5 rounded bg-destructive/90 p-0.5 text-destructive-foreground"
                  title="Quitar"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
