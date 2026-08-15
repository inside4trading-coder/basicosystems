import { useEffect, useRef } from "react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  composeCutoutOnBackground,
  type CompositionParams,
} from "@/lib/estudioCompositing";

interface CompositionControlsProps {
  backgroundUrl: string | null;
  cutoutUrl: string | null;
  aspect: string;
  params: CompositionParams;
  onChange: (params: CompositionParams) => void;
}

function SliderRow({
  label,
  value,
  min,
  max,
  suffix = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">
          {value}
          {suffix}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={1}
        onValueChange={([v]) => onChange(v)}
      />
    </div>
  );
}

/**
 * Controles de composición por capas + preview local en canvas.
 * El preview usa exactamente la misma función que la generación final, así que lo que se ve
 * es lo que se guarda. No interviene ningún modelo de IA.
 */
export function CompositionControls({
  backgroundUrl,
  cutoutUrl,
  aspect,
  params,
  onChange,
}: CompositionControlsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas || !backgroundUrl || !cutoutUrl) return;
    // El preview reutiliza el canvas montado; el blob resultante se descarta.
    composeCutoutOnBackground(backgroundUrl, cutoutUrl, aspect, params, canvas).catch(() => {
      if (!cancelled) return;
    });
    return () => {
      cancelled = true;
    };
  }, [backgroundUrl, cutoutUrl, aspect, params]);

  const set = (patch: Partial<CompositionParams>) => onChange({ ...params, ...patch });

  return (
    <div className="space-y-4">
      <p className="text-xs text-emerald-600 dark:text-emerald-500">
        Modo Compuesto: usaremos tu PNG recortado como capa real sobre el fondo. No se llamará a
        IA.
      </p>

      <div className="rounded-xl border overflow-hidden bg-muted/40">
        {backgroundUrl && cutoutUrl ? (
          <canvas ref={canvasRef} className="w-full h-auto block" />
        ) : (
          <div className="p-6 text-xs text-muted-foreground text-center">
            Elige un fondo y sube el PNG recortado para ver el preview.
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SliderRow
          label="Escala de prenda"
          value={params.cutout_scale}
          min={40}
          max={120}
          suffix="%"
          onChange={(v) => set({ cutout_scale: v })}
        />
        <SliderRow
          label="Posición X"
          value={params.cutout_offset_x}
          min={-50}
          max={50}
          onChange={(v) => set({ cutout_offset_x: v })}
        />
        <SliderRow
          label="Posición Y"
          value={params.cutout_offset_y}
          min={-50}
          max={50}
          onChange={(v) => set({ cutout_offset_y: v })}
        />
        <div className="flex items-center justify-between gap-3">
          <Label className="text-xs text-muted-foreground">Sombra</Label>
          <Switch
            checked={params.shadow_enabled}
            onCheckedChange={(checked) => set({ shadow_enabled: checked })}
          />
        </div>
        {params.shadow_enabled && (
          <>
            <SliderRow
              label="Intensidad de sombra"
              value={params.shadow_intensity}
              min={0}
              max={100}
              onChange={(v) => set({ shadow_intensity: v })}
            />
            <SliderRow
              label="Blur de sombra"
              value={params.shadow_blur}
              min={0}
              max={100}
              onChange={(v) => set({ shadow_blur: v })}
            />
          </>
        )}
      </div>
    </div>
  );
}

export default CompositionControls;
