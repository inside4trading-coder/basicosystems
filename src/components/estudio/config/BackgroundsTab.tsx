import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ImagePlus, Loader2, Plus, Save } from "lucide-react";
import {
  loadStudioBackgrounds,
  loadStudioBackgroundPrompts,
  saveStudioBackground,
  saveStudioBackgroundPrompts,
  slugifyBackgroundName,
  type StudioBackground,
} from "@/lib/estudioBackgrounds";
import { loadEnabledModels, modelLabel, type EnabledModel } from "@/lib/estudioModels";
import { resolveEstudioSignedUrl, uploadEstudioBackgroundImage } from "@/lib/estudioStorage";
import { describeEstudioLoadError } from "@/lib/estudioErrors";
import { EstudioLoadError } from "@/components/estudio/EstudioLoadError";
import { cn } from "@/lib/utils";

interface Draft {
  id?: string;
  name: string;
  cover_path: string | null;
  reference_path: string | null;
  is_active: boolean;
  sort_order: number;
}

const emptyDraft = (sortOrder: number): Draft => ({
  name: "",
  cover_path: null,
  reference_path: null,
  is_active: true,
  sort_order: sortOrder,
});

function ImageField({
  label,
  path,
  url,
  uploading,
  onPick,
}: {
  label: string;
  path: string | null;
  url: string | null;
  uploading: boolean;
  onPick: (file: File) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-2">
      <Label className="text-sm">{label}</Label>
      <div className="flex items-center gap-3">
        <div className="h-20 w-20 rounded-xl border overflow-hidden bg-muted shrink-0">
          {url ? (
            <img src={url} alt={label} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-[10px] text-muted-foreground text-center px-1">
              Sin imagen
            </div>
          )}
        </div>
        <input
          ref={ref}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPick(f);
            e.target.value = "";
          }}
        />
        <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => ref.current?.click()}>
          {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
          {path ? "Cambiar" : "Subir"}
        </Button>
      </div>
    </div>
  );
}

export default function BackgroundsTab({ startNew = false }: { startNew?: boolean }) {
  const [backgrounds, setBackgrounds] = useState<StudioBackground[]>([]);
  const [models, setModels] = useState<EnabledModel[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [prompts, setPrompts] = useState<Record<string, string>>({});
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [referenceUrl, setReferenceUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState<"cover" | "reference" | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [list, enabled] = await Promise.all([loadStudioBackgrounds(), loadEnabledModels("image")]);
      setBackgrounds(list);
      setModels(enabled);
      const entries = await Promise.all(
        list
          .filter((b) => b.cover_path)
          .map(async (b) => [b.id, await resolveEstudioSignedUrl(b.cover_path!)] as const),
      );
      setUrls(Object.fromEntries(entries));
    } catch (e) {
      setLoadError(describeEstudioLoadError(e, "No se pudieron cargar los fondos dinámicos."));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const startCreate = useCallback(() => {
    const next = backgrounds.length ? Math.max(...backgrounds.map((b) => b.sort_order)) + 1 : 1;
    setDraft(emptyDraft(next));
    setPrompts({});
    setCoverUrl(null);
    setReferenceUrl(null);
  }, [backgrounds]);

  const startedRef = useRef(false);
  useEffect(() => {
    if (startNew && !loading && !startedRef.current) {
      startedRef.current = true;
      startCreate();
    }
  }, [startNew, loading, startCreate]);

  const startEdit = async (bg: StudioBackground) => {
    setDraft({
      id: bg.id,
      name: bg.name,
      cover_path: bg.cover_path,
      reference_path: bg.reference_path,
      is_active: bg.is_active,
      sort_order: bg.sort_order,
    });
    setCoverUrl(bg.cover_path ? await resolveEstudioSignedUrl(bg.cover_path) : null);
    setReferenceUrl(bg.reference_path ? await resolveEstudioSignedUrl(bg.reference_path) : null);
    try {
      const rows = await loadStudioBackgroundPrompts(bg.id);
      setPrompts(Object.fromEntries(rows.map((r) => [r.model_id, r.prompt_text])));
    } catch {
      setPrompts({});
    }
  };

  const pickImage = async (field: "cover" | "reference", file: File) => {
    setUploading(field);
    try {
      const path = await uploadEstudioBackgroundImage(file);
      const url = await resolveEstudioSignedUrl(path);
      setDraft((prev) => (prev ? { ...prev, [`${field}_path`]: path } : prev));
      if (field === "cover") setCoverUrl(url);
      else setReferenceUrl(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo subir la imagen.");
    }
    setUploading(null);
  };

  const handleSave = async () => {
    if (!draft) return;
    if (!draft.name.trim()) {
      toast.error("Ponle un nombre al fondo.");
      return;
    }
    setSaving(true);
    try {
      const saved = await saveStudioBackground({
        id: draft.id,
        name: draft.name.trim(),
        slug: slugifyBackgroundName(draft.name) || `fondo-${Date.now()}`,
        cover_path: draft.cover_path,
        reference_path: draft.reference_path,
        is_active: draft.is_active,
        sort_order: draft.sort_order,
      });
      await saveStudioBackgroundPrompts(
        saved.id,
        Object.fromEntries(models.map((m) => [m.model_id, prompts[m.model_id] ?? ""])),
      );
      toast.success("Fondo guardado.");
      setDraft(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar el fondo.");
    }
    setSaving(false);
  };

  const configuredCount = useMemo(
    () => models.filter((m) => (prompts[m.model_id] ?? "").trim().length > 0).length,
    [models, prompts],
  );

  if (loading) return <p className="text-sm text-muted-foreground">Cargando fondos…</p>;
  if (loadError) return <EstudioLoadError message={loadError} onRetry={load} />;

  if (draft) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold">{draft.id ? "Editar fondo" : "Nuevo fondo"}</h3>
          <Button variant="ghost" size="sm" onClick={() => setDraft(null)} disabled={saving}>
            Volver
          </Button>
        </div>

        <Card className="p-4 rounded-2xl space-y-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">General</p>
          <div>
            <Label htmlFor="bg-name" className="mb-2 block text-sm">
              Nombre
            </Label>
            <Input
              id="bg-name"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Ej. Asfalto POV"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <ImageField
              label="Portada (card)"
              path={draft.cover_path}
              url={coverUrl}
              uploading={uploading === "cover"}
              onPick={(f) => pickImage("cover", f)}
            />
            <ImageField
              label="Imagen de referencia"
              path={draft.reference_path}
              url={referenceUrl}
              uploading={uploading === "reference"}
              onPick={(f) => pickImage("reference", f)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-xl border p-3">
              <Label htmlFor="bg-active" className="text-sm">
                Activo
              </Label>
              <Switch
                id="bg-active"
                checked={draft.is_active}
                onCheckedChange={(v) => setDraft({ ...draft, is_active: v })}
              />
            </div>
            <div>
              <Label htmlFor="bg-order" className="mb-2 block text-sm">
                Orden
              </Label>
              <Input
                id="bg-order"
                type="number"
                min={0}
                value={draft.sort_order}
                onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) || 0 })}
              />
            </div>
          </div>
        </Card>

        <Card className="p-4 rounded-2xl space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
              Prompt por modelo para este fondo
            </p>
            <span className="text-xs text-muted-foreground">
              {configuredCount} de {models.length} configurados
            </span>
          </div>
          {models.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay modelos de imagen habilitados. Habilítalos en “Modelos habilitados”.
            </p>
          ) : (
            <Tabs defaultValue={models[0].model_id}>
              <TabsList className="flex flex-wrap h-auto justify-start">
                {models.map((m) => (
                  <TabsTrigger key={m.model_id} value={m.model_id} className="text-xs">
                    {modelLabel(m)}
                    {(prompts[m.model_id] ?? "").trim() ? (
                      <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-primary inline-block" />
                    ) : null}
                  </TabsTrigger>
                ))}
              </TabsList>
              {models.map((m) => (
                <TabsContent key={m.model_id} value={m.model_id} className="pt-3">
                  <Textarea
                    rows={7}
                    value={prompts[m.model_id] ?? ""}
                    placeholder="Sin prompt configurado para este modelo."
                    onChange={(e) => setPrompts((prev) => ({ ...prev, [m.model_id]: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground mt-1 font-mono">{m.model_id}</p>
                </TabsContent>
              ))}
            </Tabs>
          )}
        </Card>

        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Guardar cambios
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Cada fondo tiene su propio prompt por modelo. Los inactivos no aparecen al generar.
        </p>
        <Button size="sm" onClick={startCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo fondo
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {backgrounds.map((bg) => (
          <button
            key={bg.id}
            type="button"
            onClick={() => startEdit(bg)}
            className={cn(
              "flex items-center gap-3 rounded-2xl border p-3 text-left transition-colors hover:bg-muted",
              !bg.is_active && "opacity-60",
            )}
          >
            <div className="h-14 w-14 rounded-xl overflow-hidden bg-muted shrink-0">
              {urls[bg.id] && <img src={urls[bg.id]} alt={bg.name} className="h-full w-full object-cover" />}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">{bg.name}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={bg.is_active ? "secondary" : "outline"} className="text-[10px]">
                  {bg.is_active ? "Activo" : "Inactivo"}
                </Badge>
                <span className="text-[11px] text-muted-foreground">Orden {bg.sort_order}</span>
              </div>
            </div>
          </button>
        ))}
        {backgrounds.length === 0 && (
          <p className="text-sm text-muted-foreground">Todavía no hay fondos.</p>
        )}
      </div>
    </div>
  );
}
