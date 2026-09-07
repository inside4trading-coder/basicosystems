import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  Circle,
  History,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { HubHeader } from "@/components/sublime/hub/HubHeader";
import { MockNotice } from "@/components/sublime/hub/MockNotice";
import { LifecycleDialog } from "@/components/sublime/hub/LifecycleTimeline";
import {
  mockPreparationChecklist,
  mockPreparationState,
  mockProducts,
  mockVariants,
  usdFormat,
} from "@/lib/sublimeMock";
import { PREPARATION_LABEL } from "@/types/sublimeHub";

type VariantRow = { id: string; size: string; color: string; quantity: number; sku: string };

export default function SublimePrepararProducto() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const product = mockProducts.find((p) => p.id === id) ?? mockProducts[0];

  const [title, setTitle] = useState(product.title);
  const [brand, setBrand] = useState(product.brand ?? "");
  const [category, setCategory] = useState(product.category ?? "");
  const [collection, setCollection] = useState(product.collection ?? "");
  const [color, setColor] = useState("");
  const [description, setDescription] = useState(product.description ?? "");
  const [tags, setTags] = useState(product.tags.join(", "));
  const [aiBusy, setAiBusy] = useState<string | null>(null);

  const [variants, setVariants] = useState<VariantRow[]>(() =>
    mockVariants
      .filter((v) => v.productId === product.id)
      .map((v) => ({ id: v.id, size: v.size, color: v.color, quantity: v.quantity, sku: v.sku }))
  );

  const baseVariant = mockVariants.find((v) => v.productId === product.id);
  const purchase = baseVariant ? baseVariant.unitCost * 0.78 : 0;
  const shipping = baseVariant ? baseVariant.unitCost * 0.22 : 0;
  const totalCost = purchase + shipping;
  const [margin, setMargin] = useState(120);
  const iva = 16;
  const suggested = totalCost * (1 + margin / 100) * (1 + iva / 100);
  const [manualPvp, setManualPvp] = useState<string>("");
  const finalPvp = manualPvp.trim() === "" ? suggested : Number(manualPvp) || 0;

  const [imagesOpen, setImagesOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<string[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [channels, setChannels] = useState<string[]>(["sublime.com.ve"]);

  const doneKeys = mockPreparationState[product.id] ?? [];
  const pct = Math.round((doneKeys.length / mockPreparationChecklist.length) * 100);

  const consignmentBreakdown = useMemo(() => {
    if (product.acquisition !== "consignment" || !product.consignmentPct) return null;
    const commission = (finalPvp * product.consignmentPct) / 100;
    const ivaPart = finalPvp - finalPvp / (1 + iva / 100);
    return {
      commission,
      ivaPart,
      supplier: finalPvp - commission - ivaPart,
    };
  }, [product, finalPvp]);

  const runAi = (kind: string) => {
    setAiBusy(kind);
    window.setTimeout(() => {
      setAiBusy(null);
      if (kind === "title") setTitle(`${product.brand ?? "Sublime"} ${product.category ?? "Prenda"} vintage`);
      if (kind === "description")
        setDescription(
          "Pieza seleccionada a mano por Sublime. Corte clásico, tejido resistente y detalles originales de época."
        );
      if (kind === "seo") setTags("vintage, sublime, segunda mano, barquisimeto");
      toast.success("Contenido generado (simulado).");
    }, 900);
  };

  const generateImages = () => {
    setImagesOpen(true);
    setGenerating(true);
    setGenerated([]);
    window.setTimeout(() => {
      setGenerating(false);
      setGenerated(["Imagen 1", "Imagen 2", "Imagen 3"]);
    }, 1400);
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" className="-ml-2" onClick={() => navigate("/sublime/mercancia/preparacion")}>
        <ArrowLeft className="h-4 w-4 mr-2" /> Volver a Preparación
      </Button>

      <HubHeader
        icon={Sparkles}
        title="Preparar producto"
        subtitle={product.provisionalName}
        actions={
          <>
            <Button variant="outline" onClick={() => setHistoryOpen(true)}>
              <History className="h-4 w-4 mr-2" /> Ver historial
            </Button>
            <Badge variant="secondary" className="self-center">{PREPARATION_LABEL[product.preparation]}</Badge>
          </>
        }
      />
      <MockNotice text="Workspace de prototipo: los cambios no se guardan todavía en el sistema real." />

      {/* A. Datos de origen */}
      <Card className="p-5 rounded-2xl border-border/60 space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">A · Datos de origen</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <Field label="Nombre provisional" value={product.provisionalName} />
          <Field label="Código fabricante" value={product.manufacturerCode ?? "—"} />
          <Field label="Costo compra" value={usdFormat(purchase)} />
          <Field label="Envío" value={usdFormat(shipping)} />
          <Field label="Costo total unitario" value={usdFormat(totalCost)} />
          <Field label="Tallas" value={variants.map((v) => v.size).join(", ") || "—"} />
          <Field label="Cantidades" value={String(variants.reduce((a, v) => a + v.quantity, 0))} />
          <Field
            label="Adquisición"
            value={product.acquisition === "consignment" ? `Consignación ${product.consignmentPct}%` : "Propia"}
          />
          <Field label="SKU web (legacy)" value={product.legacyWebSku ?? "—"} />
        </div>
      </Card>

      {/* B. Producto */}
      <Card className="p-5 rounded-2xl border-border/60 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">B · Producto</h2>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" disabled={aiBusy !== null} onClick={() => runAi("title")}>
              {aiBusy === "title" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wand2 className="h-4 w-4 mr-2" />}
              Título con IA
            </Button>
            <Button size="sm" variant="outline" disabled={aiBusy !== null} onClick={() => runAi("description")}>
              {aiBusy === "description" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wand2 className="h-4 w-4 mr-2" />}
              Descripción con IA
            </Button>
            <Button size="sm" variant="outline" disabled={aiBusy !== null} onClick={() => runAi("seo")}>
              {aiBusy === "seo" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wand2 className="h-4 w-4 mr-2" />}
              SEO con IA
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Labeled label="Título"><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Labeled>
          <Labeled label="Marca"><Input value={brand} onChange={(e) => setBrand(e.target.value)} /></Labeled>
          <Labeled label="Categoría"><Input value={category} onChange={(e) => setCategory(e.target.value)} /></Labeled>
          <Labeled label="Colección"><Input value={collection} onChange={(e) => setCollection(e.target.value)} /></Labeled>
          <Labeled label="Color principal"><Input value={color} onChange={(e) => setColor(e.target.value)} /></Labeled>
          <Labeled label="Etiquetas"><Input value={tags} onChange={(e) => setTags(e.target.value)} /></Labeled>
        </div>
        <Labeled label="Descripción">
          <Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Labeled>
      </Card>

      {/* C. Variantes */}
      <Card className="p-5 rounded-2xl border-border/60 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">C · Variantes</h2>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setVariants((p) => [
                ...p,
                { id: `new-${p.length + 1}`, size: "", color: "", quantity: 0, sku: "" },
              ])
            }
          >
            Añadir variante
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          El SKU nace aquí, a nivel de variante. Cada unidad física recibirá luego su propio UNIT ID.
        </p>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Talla</TableHead>
                <TableHead>Color</TableHead>
                <TableHead>Cantidad</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {variants.map((v, i) => (
                <TableRow key={v.id}>
                  <TableCell><Input className="h-9 w-24" value={v.size} onChange={(e) => setVariants((p) => p.map((x, j) => j === i ? { ...x, size: e.target.value } : x))} /></TableCell>
                  <TableCell><Input className="h-9 w-32" value={v.color} onChange={(e) => setVariants((p) => p.map((x, j) => j === i ? { ...x, color: e.target.value } : x))} /></TableCell>
                  <TableCell><Input className="h-9 w-24" type="number" value={v.quantity} onChange={(e) => setVariants((p) => p.map((x, j) => j === i ? { ...x, quantity: Number(e.target.value) || 0 } : x))} /></TableCell>
                  <TableCell><Input className="h-9 w-44 font-mono text-xs" value={v.sku} onChange={(e) => setVariants((p) => p.map((x, j) => j === i ? { ...x, sku: e.target.value } : x))} /></TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => setVariants((p) => p.filter((_, j) => j !== i))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* D. Precio */}
      <Card className="p-5 rounded-2xl border-border/60 space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">D · Precio</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <Field label="Compra" value={usdFormat(purchase)} />
          <Field label="Costo de envío" value={usdFormat(shipping)} />
          <Field label="Costo total unitario" value={usdFormat(totalCost)} />
          <Field label="IVA" value={`${iva}%`} />
        </div>
        <Separator />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Labeled label="Margen (%)">
            <Input type="number" value={margin} onChange={(e) => setMargin(Number(e.target.value) || 0)} />
          </Labeled>
          <Labeled label="PVP sugerido">
            <Input readOnly value={usdFormat(suggested)} />
          </Labeled>
          <Labeled label="PVP manual">
            <Input placeholder="Opcional" value={manualPvp} onChange={(e) => setManualPvp(e.target.value)} />
          </Labeled>
        </div>
        <div className="rounded-xl border border-border/60 p-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">PVP final</p>
          <p className="num text-2xl font-black tabular-nums">{usdFormat(finalPvp)}</p>
        </div>
        {consignmentBreakdown && (
          <div className="rounded-xl border border-border/60 p-3 space-y-1 text-sm">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Consignación</p>
            <p>Porcentaje Sublime: <span className="font-semibold">{product.consignmentPct}%</span></p>
            <p>Comisión Sublime: <span className="font-semibold tabular-nums">{usdFormat(consignmentBreakdown.commission)}</span></p>
            <p>IVA (Sublime): <span className="font-semibold tabular-nums">{usdFormat(consignmentBreakdown.ivaPart)}</span></p>
            <p>Monto proveedor: <span className="font-semibold tabular-nums">{usdFormat(consignmentBreakdown.supplier)}</span></p>
            <p className="text-xs text-muted-foreground">La comisión de consignación no es lo mismo que el margen propio.</p>
          </div>
        )}
      </Card>

      {/* E. Imágenes */}
      <Card className="p-5 rounded-2xl border-border/60 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">E · Imágenes</h2>
          <Button size="sm" variant="outline" onClick={generateImages}>
            <Wand2 className="h-4 w-4 mr-2" /> Generar imágenes con IA
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ImageBlock title="Imágenes de referencia" />
          <ImageBlock title="Imágenes para web" />
        </div>
      </Card>

      {/* F. Publicación */}
      <Card className="p-5 rounded-2xl border-border/60 space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">F · Publicación</h2>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Estado de preparación</span>
            <span className="font-semibold tabular-nums">{pct}%</span>
          </div>
          <Progress value={pct} />
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1">
          {mockPreparationChecklist.map((c) => {
            const ok = doneKeys.includes(c.key);
            return (
              <span key={c.key} className={`inline-flex items-center gap-1 text-sm ${ok ? "text-foreground" : "text-muted-foreground"}`}>
                {ok ? <Check className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />} {c.label}
              </span>
            );
          })}
        </div>
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Canales</p>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={channels.includes("sublime.com.ve")}
              onCheckedChange={(v) =>
                setChannels(v ? ["sublime.com.ve"] : [])
              }
            />
            sublime.com.ve
          </label>
          <p className="text-xs text-muted-foreground">Otros canales se habilitarán más adelante.</p>
        </div>
        <Button className="w-full h-12" onClick={() => toast.success("Publicación simulada: el producto quedaría listo en sublime.com.ve.")}>
          Publicar producto
        </Button>
      </Card>

      <Dialog open={imagesOpen} onOpenChange={setImagesOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Generar imágenes con IA</DialogTitle>
          </DialogHeader>
          {generating ? (
            <div className="py-10 text-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground">Generando 3 imágenes…</p>
            </div>
          ) : (
            <div className="space-y-3">
              <MockNotice text="Resultados simulados. Se conectará con el generador visual ya existente en Basico." />
              {generated.map((g) => (
                <div key={g} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 p-3">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
                      <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <span className="text-sm font-medium">{g}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => toast.success(`${g} aprobada.`)}>Aprobar</Button>
                    <Button size="sm" variant="ghost" onClick={generateImages}>Regenerar</Button>
                    <Button size="sm" variant="ghost" onClick={() => setGenerated((p) => p.filter((x) => x !== g))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <LifecycleDialog open={historyOpen} onOpenChange={setHistoryOpen} productTitle={product.title} productId={product.id} />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold text-foreground">{value}</p>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function ImageBlock({ title }: { title: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-4 space-y-2">
      <p className="text-sm font-semibold">{title}</p>
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="aspect-square rounded-lg bg-muted flex items-center justify-center">
            <ImageIcon className="h-5 w-5 text-muted-foreground" />
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Ejemplo visual.</p>
    </div>
  );
}
