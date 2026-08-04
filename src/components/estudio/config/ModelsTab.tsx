import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { estudioDb } from "@/lib/estudioDb";
import { readEdgeFunctionError } from "@/lib/estudioErrors";
import { estimatedImageCost, type CatalogModel, type EnabledModel, type ModelKind } from "@/lib/estudioModels";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Image as ImageIcon, Clapperboard } from "lucide-react";

interface Row {
  modelId: string;
  name: string;
  kind: ModelKind;
  enabled: boolean;
  estimatedCost: number | null;
  /** Está en `estudio_enabled_models` pero ya no aparece en el catálogo de OpenRouter. */
  missingFromCatalog?: boolean;
}

export default function ModelsTab() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setCatalogError(null);

    const { data: enabledRows } = await estudioDb.from("estudio_enabled_models").select("*");
    const enabled = (enabledRows ?? []) as EnabledModel[];
    const enabledMap = new Map(enabled.map((e) => [`${e.kind}:${e.model_id}`, e]));

    let catalog: { image: CatalogModel[]; video: CatalogModel[] } | null = null;
    try {
      const { data, error } = await supabase.functions.invoke("estudio-list-models");
      if (error) throw new Error(await readEdgeFunctionError(error));
      if (data?.error) throw new Error(data.error);
      catalog = data;
    } catch (e) {
      setCatalogError(e instanceof Error ? e.message : "No se pudo leer el catálogo de OpenRouter.");
    }

    const next: Row[] = [];
    const seen = new Set<string>();

    for (const kind of ["image", "video"] as ModelKind[]) {
      for (const m of catalog?.[kind] ?? []) {
        const key = `${kind}:${m.id}`;
        seen.add(key);
        next.push({
          modelId: m.id,
          name: m.name,
          kind,
          enabled: enabledMap.get(key)?.is_enabled ?? false,
          estimatedCost: estimatedImageCost(m),
        });
      }
    }

    // Modelos habilitados que ya no existen en el catálogo: hay que verlos para poder
    // desactivarlos, porque si se usan la generación falla.
    for (const e of enabled) {
      const key = `${e.kind}:${e.model_id}`;
      if (seen.has(key)) continue;
      next.push({
        modelId: e.model_id,
        name: e.label ?? e.model_id,
        kind: e.kind,
        enabled: e.is_enabled,
        estimatedCost: null,
        missingFromCatalog: true,
      });
    }

    setRows(next);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = async (row: Row, value: boolean) => {
    setSavingId(`${row.kind}:${row.modelId}`);
    setRows((prev) =>
      prev.map((r) => (r.modelId === row.modelId && r.kind === row.kind ? { ...r, enabled: value } : r)),
    );

    const { error } = await estudioDb.from("estudio_enabled_models").upsert(
      {
        model_id: row.modelId,
        kind: row.kind,
        label: row.name,
        is_enabled: value,
      },
      { onConflict: "model_id,kind" },
    );
    setSavingId(null);

    if (error) {
      toast.error("No se pudo guardar el cambio.");
      setRows((prev) =>
        prev.map((r) => (r.modelId === row.modelId && r.kind === row.kind ? { ...r, enabled: !value } : r)),
      );
      return;
    }
    toast.success(value ? "Modelo habilitado." : "Modelo deshabilitado.");
  };

  if (loading) return <p className="text-sm text-muted-foreground">Cargando catálogo…</p>;

  const section = (kind: ModelKind, title: string, Icon: typeof ImageIcon, hint: string) => {
    const items = rows.filter((r) => r.kind === kind);
    return (
      <Card className="p-6 rounded-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold">{title}</h3>
          </div>
          <span className="text-xs text-muted-foreground">
            {items.filter((i) => i.enabled).length} de {items.length} habilitados
          </span>
        </div>
        <p className="text-xs text-muted-foreground">{hint}</p>

        {items.length === 0 && (
          <p className="text-sm text-muted-foreground">No hay modelos disponibles.</p>
        )}

        <div className="space-y-1">
          {items.map((row) => {
            const key = `${row.kind}:${row.modelId}`;
            return (
              <div key={key} className="flex items-center justify-between gap-4 border-b py-2 last:border-0">
                <div className="min-w-0">
                  <Label htmlFor={key} className="font-medium block truncate">
                    {row.name}
                    {row.missingFromCatalog && (
                      <span className="ml-2 text-xs text-destructive">ya no existe en OpenRouter</span>
                    )}
                  </Label>
                  <p className="text-xs text-muted-foreground font-mono truncate">{row.modelId}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {row.estimatedCost != null && (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      ≈ ${row.estimatedCost.toFixed(3)}/img
                    </span>
                  )}
                  {savingId === key ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : (
                    <Switch
                      id={key}
                      checked={row.enabled}
                      onCheckedChange={(v) => toggle(row, v)}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Solo los modelos habilitados aquí aparecen al generar. Sirve para evitar que se elija
          por error un modelo mucho más caro.
        </p>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Actualizar catálogo
        </Button>
      </div>

      {catalogError && (
        <Card className="p-4 rounded-2xl border-destructive/40 bg-destructive/5">
          <p className="text-sm text-destructive">{catalogError}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Se muestran solo los modelos ya guardados. Revisa que `OPENROUTER_API_KEY` esté
            configurada y que la función `estudio-list-models` esté desplegada.
          </p>
        </Card>
      )}

      {section(
        "image",
        "Modelos de imagen",
        ImageIcon,
        "El costo mostrado es una estimación por imagen a partir del precio por token que publica OpenRouter.",
      )}
      {section(
        "video",
        "Modelos de video",
        Clapperboard,
        "OpenRouter no publica el precio de video por adelantado: el costo real se conoce al terminar cada generación.",
      )}
    </div>
  );
}
