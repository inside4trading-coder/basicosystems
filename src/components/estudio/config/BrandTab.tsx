import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { estudioDb } from "@/lib/estudioDb";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, Upload, RefreshCw } from "lucide-react";
import { resolveEstudioSignedUrl } from "@/lib/estudioStorage";

const ESTUDIO_BUCKET = "estudio-visual";

interface BrandTemplate {
  id: string;
  logo_storage_path: string | null;
  primary_color: string;
  secondary_color: string;
  logo_position: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center";
  show_product_name: boolean;
  show_price: boolean;
  generate_story_variant: boolean;
}

const POSITION_OPTIONS: { value: BrandTemplate["logo_position"]; label: string }[] = [
  { value: "top-left", label: "Superior izquierda" },
  { value: "top-right", label: "Superior derecha" },
  { value: "bottom-left", label: "Inferior izquierda" },
  { value: "bottom-right", label: "Inferior derecha" },
  { value: "center", label: "Centro" },
];

export default function BrandTab() {
  const [brand, setBrand] = useState<BrandTemplate | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await estudioDb.from("estudio_brand_template").select("*").maybeSingle();

      if (error) {
        setLoadError(
          error.code === "PGRST205"
            ? "El módulo no está instalado en la base de datos todavía (falta aplicar su migración)."
            : "No se pudo cargar la plantilla de marca.",
        );
        return;
      }
      if (!data) {
        setLoadError("No hay ninguna plantilla de marca guardada todavía.");
        return;
      }

      setBrand(data as BrandTemplate);
      if (data.logo_storage_path) {
        setLogoPreview(await resolveEstudioSignedUrl(data.logo_storage_path));
      }
    } finally {
      // En `finally` para que la pestaña nunca se quede colgada en "Cargando…".
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const uploadLogo = async (file: File) => {
    if (!brand) return;
    const path = `logo/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from(ESTUDIO_BUCKET).upload(path, file, {
      contentType: file.type,
      upsert: true,
    });
    if (error) {
      toast.error("No se pudo subir el logo.");
      return;
    }
    setBrand({ ...brand, logo_storage_path: path });
    setLogoPreview(await resolveEstudioSignedUrl(path));
  };

  const save = async () => {
    if (!brand) return;
    setSaving(true);
    try {
      const { error } = await estudioDb
        .from("estudio_brand_template")
        .update({
          logo_storage_path: brand.logo_storage_path,
          primary_color: brand.primary_color,
          secondary_color: brand.secondary_color,
          logo_position: brand.logo_position,
          show_product_name: brand.show_product_name,
          show_price: brand.show_price,
          generate_story_variant: brand.generate_story_variant,
          updated_at: new Date().toISOString(),
        })
        .eq("id", brand.id);
      if (error) throw error;
      toast.success("Plantilla de marca guardada.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar la plantilla.");
    } finally {
      // En `finally` para que un fallo no deje el botón girando indefinidamente.
      setSaving(false);
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Cargando…</p>;

  if (!brand) {
    return (
      <Card className="p-6 rounded-2xl border-destructive/40 bg-destructive/5 space-y-3">
        <p className="text-sm text-destructive font-medium">
          {loadError ?? "No se pudo cargar la plantilla de marca."}
        </p>
        <p className="text-xs text-muted-foreground">
          Hasta que exista la plantilla no se pueden componer las variantes de Instagram.
        </p>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Reintentar
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-6 rounded-2xl space-y-6">
      <div>
        <Label className="mb-2 block">Logo</Label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/webp"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])}
        />
        <div className="flex items-center gap-4">
          <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" />
            {logoPreview ? "Cambiar logo" : "Subir logo"}
          </Button>
          {logoPreview && <img src={logoPreview} alt="Logo" className="h-12 w-auto" />}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <Label htmlFor="primaryColor">Color primario</Label>
          <div className="flex items-center gap-2">
            <Input
              id="primaryColor"
              type="color"
              className="w-16 h-10 p-1"
              value={brand.primary_color}
              onChange={(e) => setBrand({ ...brand, primary_color: e.target.value })}
            />
            <Input
              value={brand.primary_color}
              onChange={(e) => setBrand({ ...brand, primary_color: e.target.value })}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="secondaryColor">Color secundario</Label>
          <div className="flex items-center gap-2">
            <Input
              id="secondaryColor"
              type="color"
              className="w-16 h-10 p-1"
              value={brand.secondary_color}
              onChange={(e) => setBrand({ ...brand, secondary_color: e.target.value })}
            />
            <Input
              value={brand.secondary_color}
              onChange={(e) => setBrand({ ...brand, secondary_color: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div>
        <Label className="mb-2 block">Posición del logo</Label>
        <Select
          value={brand.logo_position}
          onValueChange={(v) => setBrand({ ...brand, logo_position: v as BrandTemplate["logo_position"] })}
        >
          <SelectTrigger className="w-full max-w-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {POSITION_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between max-w-md">
          <Label htmlFor="showName">Mostrar nombre del producto</Label>
          <Switch
            id="showName"
            checked={brand.show_product_name}
            onCheckedChange={(v) => setBrand({ ...brand, show_product_name: v })}
          />
        </div>
        <div className="flex items-center justify-between max-w-md">
          <Label htmlFor="showPrice">Mostrar precio</Label>
          <Switch
            id="showPrice"
            checked={brand.show_price}
            onCheckedChange={(v) => setBrand({ ...brand, show_price: v })}
          />
        </div>
        <div className="flex items-center justify-between max-w-md">
          <Label htmlFor="storyVariant">Generar también variante de Story (1080×1920)</Label>
          <Switch
            id="storyVariant"
            checked={brand.generate_story_variant}
            onCheckedChange={(v) => setBrand({ ...brand, generate_story_variant: v })}
          />
        </div>
      </div>

      <Button onClick={save} disabled={saving}>
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        Guardar plantilla
      </Button>
    </Card>
  );
}
