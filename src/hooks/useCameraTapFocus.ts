import { useCallback, useRef, useState } from "react";

type FocusRing = { x: number; y: number; id: number } | null;

/**
 * Tap-to-focus helper for camera preview containers (html5-qrcode renders a <video> inside).
 * Progressive enhancement: continuous focus on start, manual/pointsOfInterest on tap.
 * Never throws, never stops the stream.
 */
export function useCameraTapFocus() {
  const [ring, setRing] = useState<FocusRing>(null);
  const ringTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnedRef = useRef(false);
  const [unsupportedMsg, setUnsupportedMsg] = useState<string | null>(null);

  const getTrack = (container: HTMLElement | null): MediaStreamTrack | null => {
    try {
      const video = container?.querySelector("video") as HTMLVideoElement | null;
      const stream = video?.srcObject as MediaStream | null;
      return stream?.getVideoTracks?.()[0] ?? null;
    } catch {
      return null;
    }
  };

  /** Enable continuous autofocus if the device exposes it. Safe no-op otherwise. */
  const enableContinuousFocus = useCallback(async (container: HTMLElement | null) => {
    const track = getTrack(container);
    if (!track) return;
    try {
      const caps: any = track.getCapabilities?.() ?? {};
      if (Array.isArray(caps.focusMode) && caps.focusMode.includes("continuous")) {
        await track.applyConstraints({ advanced: [{ focusMode: "continuous" } as any] } as any);
      }
    } catch {
      /* ignore: unsupported */
    }
  }, []);

  /** Tap handler: shows a focus ring and attempts point focus. */
  const handleTapFocus = useCallback(
    (e: React.MouseEvent | React.TouchEvent, container: HTMLElement | null) => {
      const host = (e.currentTarget as HTMLElement) || container;
      const rect = host.getBoundingClientRect();
      const point = "touches" in e && e.touches?.[0] ? e.touches[0] : (e as React.MouseEvent);
      const px = (point as any).clientX - rect.left;
      const py = (point as any).clientY - rect.top;
      if (rect.width <= 0 || rect.height <= 0) return;

      setRing({ x: px, y: py, id: Date.now() });
      if (ringTimer.current) clearTimeout(ringTimer.current);
      ringTimer.current = setTimeout(() => setRing(null), 800);

      const x = Math.min(1, Math.max(0, px / rect.width));
      const y = Math.min(1, Math.max(0, py / rect.height));

      (async () => {
        const track = getTrack(container ?? host);
        if (!track) return;
        try {
          const caps: any = track.getCapabilities?.() ?? {};
          const advanced: any[] = [];
          if (caps.pointsOfInterest) advanced.push({ pointsOfInterest: [{ x, y }] });
          if (Array.isArray(caps.focusMode)) {
            if (caps.focusMode.includes("manual") && advanced.length) {
              advanced.push({ focusMode: "manual" });
            } else if (caps.focusMode.includes("single-shot")) {
              advanced.push({ focusMode: "single-shot" });
            } else if (caps.focusMode.includes("continuous")) {
              advanced.push({ focusMode: "continuous" });
            }
          }
          if (!advanced.length) {
            if (!warnedRef.current) {
              warnedRef.current = true;
              setUnsupportedMsg("Este dispositivo no permite enfoque manual desde el navegador.");
            }
            return;
          }
          await track.applyConstraints({ advanced } as any);
        } catch {
          if (!warnedRef.current) {
            warnedRef.current = true;
            setUnsupportedMsg("Este dispositivo no permite enfoque manual desde el navegador.");
          }
        }
      })();
    },
    [],
  );

  return { ring, handleTapFocus, enableContinuousFocus, unsupportedMsg };
}
