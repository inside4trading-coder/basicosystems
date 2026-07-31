import { useCallback, useRef, useState } from "react";

/**
 * Camera enhancement helpers for QR scanners: near mode (zoom), torch and camera switching.
 * Progressive enhancement — every capability check is safe and never throws.
 */
export function useCameraControls() {
  const [nearMode, setNearMode] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [zoomSupported, setZoomSupported] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const deviceIndex = useRef(0);

  const getTrack = (container: HTMLElement | null): MediaStreamTrack | null => {
    try {
      const video = container?.querySelector("video") as HTMLVideoElement | null;
      const stream = video?.srcObject as MediaStream | null;
      return stream?.getVideoTracks?.()[0] ?? null;
    } catch {
      return null;
    }
  };

  /** Inspect the live track and record which extras are available. */
  const probeCapabilities = useCallback(async (container: HTMLElement | null) => {
    const track = getTrack(container);
    if (!track) return;
    try {
      const caps: any = track.getCapabilities?.() ?? {};
      setTorchSupported(!!caps.torch);
      setZoomSupported(!!caps.zoom);
    } catch {
      /* ignore */
    }
    try {
      const list = await navigator.mediaDevices?.enumerateDevices?.();
      if (list) setDevices(list.filter((d) => d.kind === "videoinput"));
    } catch {
      /* ignore */
    }
  }, []);

  /** Apply (or clear) a modest zoom for reading small QR codes up close. */
  const applyNearMode = useCallback(async (container: HTMLElement | null, enabled: boolean) => {
    setNearMode(enabled);
    const track = getTrack(container);
    if (!track) return;
    try {
      const caps: any = track.getCapabilities?.() ?? {};
      if (!caps.zoom) return;
      const min = caps.zoom.min ?? 1;
      const max = caps.zoom.max ?? 1;
      const target = enabled ? Math.min(max, Math.max(min, 2)) : min;
      await track.applyConstraints({ advanced: [{ zoom: target } as any] } as any);
    } catch {
      /* ignore: unsupported */
    }
  }, []);

  const toggleTorch = useCallback(async (container: HTMLElement | null) => {
    const track = getTrack(container);
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as any] } as any);
      setTorchOn(next);
    } catch {
      /* ignore */
    }
  }, [torchOn]);

  /** Returns the deviceId of the next available camera, or null when there is only one. */
  const nextDeviceId = useCallback(async (): Promise<string | null> => {
    let list = devices;
    if (list.length < 2) {
      try {
        const all = await navigator.mediaDevices?.enumerateDevices?.();
        list = (all ?? []).filter((d) => d.kind === "videoinput");
        setDevices(list);
      } catch {
        return null;
      }
    }
    if (list.length < 2) return null;
    deviceIndex.current = (deviceIndex.current + 1) % list.length;
    return list[deviceIndex.current]?.deviceId ?? null;
  }, [devices]);

  const resetTorch = useCallback(() => setTorchOn(false), []);

  return {
    nearMode,
    applyNearMode,
    torchOn,
    torchSupported,
    toggleTorch,
    resetTorch,
    zoomSupported,
    devices,
    nextDeviceId,
    probeCapabilities,
  };
}

/** Safe video constraints shared by scanners: rear camera, moderate resolution. */
export const SCANNER_VIDEO_CONSTRAINTS = {
  width: { ideal: 1280 },
  height: { ideal: 720 },
} as const;

/**
 * Starts an html5-qrcode scanner with progressively simpler constraints.
 * Never includes focus/zoom/torch in the initial request — those are applied
 * afterwards, only when the live track supports them.
 */
export async function startScannerWithFallback(
  scanner: any,
  deviceId: string | null,
  config: any,
  onDecode: (text: string) => void,
): Promise<void> {
  const attempts: any[] = [];
  if (deviceId) attempts.push({ deviceId: { exact: deviceId } });
  attempts.push({ facingMode: { ideal: "environment" }, ...SCANNER_VIDEO_CONSTRAINTS });
  attempts.push({ facingMode: "environment" });
  attempts.push(true);

  let lastError: any = null;
  for (const constraint of attempts) {
    try {
      await scanner.start(constraint, config, onDecode, () => { /* ignore decode errors */ });
      return;
    } catch (e: any) {
      lastError = e;
      console.error("[scanner] getUserMedia failed", e?.name, e?.message ?? e, constraint);
    }
  }
  throw lastError ?? new Error("No se pudo iniciar la cámara.");
}

