import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Save } from "lucide-react";
import { EstudioLoadError } from "@/components/estudio/EstudioLoadError";
import { describeEstudioLoadError } from "@/lib/estudioErrors";
import BackgroundsTab from "@/components/estudio/config/BackgroundsTab";
import {
  findBasePreset,
  loadStudioPromptPresets,
  saveStudioBasePrompt,
  type StudioBaseKind,
  type StudioPromptPreset,
} from "@/lib/estudioPrompts";

const BASE_SECTIONS: { kind: StudioBaseKind; title: string; description: string }[] = [
  {
    kind: "catalogo",
    title: "Foto para catálogo",
    description: "Prompt base para generar imagen limpia de e-commerce/catálogo.",
  },
  {
    kind: "transparente",
    title: "Fondo transparente",
    description: "Prompt base para recorte limpio y PNG/fondo transparente.",
  },
];

function BasePromptSection({
  title,
  description,
  value,
  onChange,
  onSave,
  saving,
}: {
  title: string;
  description: string;
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <Card className="p-6 rounded-2xl space-y-4">
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Textarea rows={8} value={value} onChange={(e) => onChange(e.target.value)} />
      <p className="text-xs text-muted-foreground">
        El modelo de IA se elige al generar, en el paso “Generar” del asistente.
      </p>
      <Button size="sm" onClick={onSave} disabled={saving}>
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        Guardar
      </Button>
    </Card>
  );
}

function UnderConstruction({ title }: { title: string }) {
  return (
    <Card className="p-6 rounded-2xl space-y-2">
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">En construcción. Todavía no hay prompt configurable.</p>
    </Card>
  );
}

export default function PromptTab() {
  const [presets, setPresets] = useState<StudioPromptPreset[]>([]);
  const [texts, setTexts] = useState<Record<StudioBaseKind, string>>({ catalogo: "", transparente: "" });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingKind, setSavingKind] = useState<StudioBaseKind | null>(null);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const rows = await loadStudioPromptPresets();
      setPresets(rows);
      setTexts({
        catalogo: findBasePreset(rows, "catalogo")?.prompt_text ?? "",
        transparente: findBasePreset(rows, "transparente")?.prompt_text ?? "",
      });
    } catch (e) {
      setLoadError(describeEstudioLoadError(e, "No se pudieron cargar los prompts base."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async (kind: StudioBaseKind) => {
    setSavingKind(kind);
    try {
      await saveStudioBasePrompt(presets, kind, texts[kind]);
      toast.success("Prompt guardado.");
      const rows = await loadStudioPromptPresets();
      setPresets(rows);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar el prompt.");
    }
    setSavingKind(null);
  };

  if (loading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (loadError) return <EstudioLoadError message={loadError} onRetry={load} />;

  return (
    <Tabs defaultValue="catalogo" className="space-y-4">
      <TabsList className="flex flex-wrap h-auto justify-start">
        <TabsTrigger value="catalogo" className="text-xs">
          Foto para catálogo
        </TabsTrigger>
        <TabsTrigger value="transparente" className="text-xs">
          Fondo transparente
        </TabsTrigger>
        <TabsTrigger value="dinamicos" className="text-xs">
          Prompts para fondos dinámicos
        </TabsTrigger>
        <TabsTrigger value="video" className="text-xs">
          Video corto
        </TabsTrigger>
        <TabsTrigger value="modelo" className="text-xs">
          Mockup con modelo
        </TabsTrigger>
      </TabsList>

      {BASE_SECTIONS.map((section) => (
        <TabsContent key={section.kind} value={section.kind}>
          <BasePromptSection
            title={section.title}
            description={section.description}
            value={texts[section.kind]}
            onChange={(v) => setTexts((prev) => ({ ...prev, [section.kind]: v }))}
            onSave={() => save(section.kind)}
            saving={savingKind === section.kind}
          />
        </TabsContent>
      ))}

      <TabsContent value="dinamicos" className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Cada fondo se configura por separado: portada, imagen de referencia y prompt por modelo.
        </p>
        <BackgroundsTab />
      </TabsContent>

      <TabsContent value="video">
        <UnderConstruction title="Video corto" />
      </TabsContent>
      <TabsContent value="modelo">
        <UnderConstruction title="Mockup con modelo" />
      </TabsContent>
    </Tabs>
  );
}
