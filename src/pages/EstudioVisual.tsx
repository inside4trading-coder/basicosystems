import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Sparkles, Download, ImagePlus } from "lucide-react";
import {
  uploadEstudioSourcePhoto,
  resolveEstudioSignedUrl,
  downloadEstudioImage,
  downloadBlob,
} from "@/lib/estudioStorage";
import {
  composeInstagramFeed,
  composeInstagramStory,
  type EstudioBrandSettings,
} from "@/lib/estudioCompositing";

type PhotoType = "fondo_blanco" | "modelo" | "mockup";

const PHOTO_TYPE_LABELS: Record<PhotoType, string> = {
  fondo_blanco: "Fondo blanco",
  modelo: "Con modelo",
  mockup: "Mockup lifestyle",
};

interface PromptPreset {
  id: string;
  name: string;
  photo_type: PhotoType;
  prompt_text: string;
  image_model: string;
  is_default: boolean;
}

interface ImageJob {
  id: string;
  created_at: string;
  status: string;
  photo_type: PhotoType;
  generated_image_path: string | null;
  instagram_feed_path: string | null;
  instagram_story_path: string | null;
  cost_usd: number | null;
  error_message: string | null;
}

export default function EstudioVisual() {
  const [photoType, setPhotoType] = useState<PhotoType>("fondo_blanco");
  const [presets, setPresets] = useState<PromptPreset[]>([]);
  const [promptText, setPromptText] = useState("");
  const [brand, setBrand] = useState<EstudioBrandSettings | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [productName, setProductName] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{
    generatedUrl: string;
    feedBlob: Blob | null;
    storyBlob: Blob | null;
    costUsd: number | null;
  } | null>(null);
  const [history, setHistory] = useState<ImageJob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadPresets = async () => {
    const { data } = await supabase.from("estudio_prompt_presets").select("*") as any;
    setPresets((data ?? []) as PromptPreset[]);
  };

  const loadBrand = async () => {
    const { data } = await (supabase.from("estudio_brand_template").select("*").maybeSingle() as any);
    if (!data) return;
    let logoUrl: string | null = null;
    if (data.logo_storage_path) {
      logoUrl = await resolveEstudioSignedUrl(data.logo_storage_path);
    }
    setBrand({
      logoUrl,
      primaryColor: data.primary_color,
      secondaryColor: data.secondary_color,
      logoPosition: data.logo_position,
      showProductName: data.show_product_name,
      showPrice: data.show_price,
    });
  };

  const loadHistory = async () => {
    const { data } = await (supabase
      .from("estudio_image_jobs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10) as any);
    setHistory((data ?? []) as ImageJob[]);
  };

  useEffect(() => {
    loadPresets();
    loadBrand();
    loadHistory();
  }, []);

  useEffect(() => {
    const defaultPreset = presets.find((p) => p.photo_type === photoType && p.is_default);
    setPromptText(defaultPreset?.prompt_text ?? "");
  }, [photoType, presets]);

  const onFileChange = (f: File | null) => {
    setFile(f);
    setResult(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(f ? URL.createObjectURL(f) : null);
  };

  const handleGenerate = async () => {
    if (!file) {
      toast.error("Sube una foto de la prenda primero.");
      return;
    }
    setGenerating(true);
    setResult(null);
    try {
      const sourcePhotoPath = await uploadEstudioSourcePhoto(file);

      const defaultPreset = presets.find((p) => p.photo_type === photoType && p.is_default);
      const promptOverride = promptText !== defaultPreset?.prompt_text ? promptText : undefined;

      const { data, error } = await supabase.functions.invoke("estudio-generate-image", {
        body: {
          sourcePhotoPath,
          photoType,
          promptOverride,
          productName: productName || undefined,
          productPrice: productPrice || undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const generatedUrl = await resolveEstudioSignedUrl(data.generatedImagePath);

      let feedBlob: Blob | null = null;
      let storyBlob: Blob | null = null;
      if (brand) {
        feedBlob = await composeInstagramFeed(generatedUrl, brand, { productName, productPrice });
        if ((brand as any).generateStoryVariant !== false) {
          storyBlob = await composeInstagramStory(generatedUrl, brand, { productName, productPrice });
        }
      }

      setResult({ generatedUrl, feedBlob, storyBlob, costUsd: data.costUsd ?? null });
      toast.success("Imagen generada correctamente.");
      loadHistory();
    } catch (e: any) {
      toast.error(e.message ?? "No se pudo generar la imagen.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Estudio Visual</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Genera la foto de estudio con IA y sus variantes para Instagram a partir de una foto de la prenda.
        </p>
      </div>

      <Card className="p-6 rounded-2xl space-y-5">
        <div>
          <Label className="mb-2 block">Tipo de fotografía</Label>
          <Tabs value={photoType} onValueChange={(v) => setPhotoType(v as PhotoType)}>
            <TabsList>
              {(Object.keys(PHOTO_TYPE_LABELS) as PhotoType[]).map((t) => (
                <TabsTrigger key={t} value={t}>
                  {PHOTO_TYPE_LABELS[t]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <div>
          <Label className="mb-2 block">Foto de la prenda</Label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
          />
          <div className="flex items-center gap-4">
            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
              <ImagePlus className="mr-2 h-4 w-4" />
              {file ? "Cambiar foto" : "Subir foto"}
            </Button>
            {previewUrl && (
              <img src={previewUrl} alt="Foto original" className="h-20 w-20 object-cover rounded-lg border" />
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <Label htmlFor="productName">Nombre del producto (opcional)</Label>
            <Input id="productName" value={productName} onChange={(e) => setProductName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="productPrice">Precio (opcional)</Label>
            <Input id="productPrice" value={productPrice} onChange={(e) => setProductPrice(e.target.value)} />
          </div>
        </div>

        <div>
          <Label htmlFor="prompt" className="mb-2 block">
            Prompt para esta generación
          </Label>
          <Textarea
            id="prompt"
            rows={5}
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Este cambio aplica solo a esta generación. Para guardarlo como default, ajústalo desde
            Configuración → Estudio Visual.
          </p>
        </div>

        <Button onClick={handleGenerate} disabled={generating || !file}>
          {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          Generar
        </Button>
      </Card>

      {result && (
        <Card className="p-6 rounded-2xl space-y-4">
          <h2 className="text-lg font-semibold">Resultado</h2>
          {result.costUsd != null && (
            <p className="text-xs text-muted-foreground">Costo de esta generación: ${result.costUsd.toFixed(4)} USD</p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Foto generada</p>
              <img src={result.generatedUrl} alt="Foto generada" className="w-full rounded-lg border" />
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadEstudioImage(result.generatedUrl, "estudio-foto.png")}
              >
                <Download className="mr-2 h-4 w-4" />
                Descargar
              </Button>
            </div>
            {result.feedBlob && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Instagram — Post (1080×1080)</p>
                <img src={URL.createObjectURL(result.feedBlob)} alt="Instagram feed" className="w-full rounded-lg border" />
                <Button variant="outline" size="sm" onClick={() => downloadBlob(result.feedBlob!, "instagram-feed.png")}>
                  <Download className="mr-2 h-4 w-4" />
                  Descargar
                </Button>
              </div>
            )}
            {result.storyBlob && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Instagram — Story (1080×1920)</p>
                <img src={URL.createObjectURL(result.storyBlob)} alt="Instagram story" className="w-full rounded-lg border" />
                <Button variant="outline" size="sm" onClick={() => downloadBlob(result.storyBlob!, "instagram-story.png")}>
                  <Download className="mr-2 h-4 w-4" />
                  Descargar
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}

      <Card className="p-6 rounded-2xl">
        <h2 className="text-lg font-semibold mb-4">Generaciones recientes</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay generaciones.</p>
        ) : (
          <div className="space-y-2">
            {history.map((job) => (
              <div key={job.id} className="flex items-center justify-between text-sm border-b py-2 last:border-0">
                <span>{PHOTO_TYPE_LABELS[job.photo_type]}</span>
                <span className="text-muted-foreground">{new Date(job.created_at).toLocaleString("es-VE")}</span>
                <span
                  className={
                    job.status === "completed"
                      ? "text-emerald-600"
                      : job.status === "failed"
                        ? "text-destructive"
                        : "text-muted-foreground"
                  }
                >
                  {job.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
