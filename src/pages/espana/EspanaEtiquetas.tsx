import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Download, Printer, Copy, RefreshCw, Wand2, FileDown } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import QRCode from "qrcode";

interface Loc { id: string; name: string; code: string; inventory_mode: string; is_active: boolean }
interface Product { id: string; sku: string; name: string; price_eur: number | null; source: string | null; status: string }
interface Variant {
  id: string; product_id: string; variant_sku: string; size: string | null; color: string | null;
  scan_code: string | null; barcode: string | null; qr_code: string | null; status: string;
  price_eur: number | null;
}
interface Stock { location_id: string; variant_id: string; quantity_on_hand: number }

type LabelRow = {
  variant: Variant;
  product: Product;
  stockInLoc: number;
  qty: number;
  selected: boolean;
};

const resolveScanCode = (v: Variant) =>
  (v.scan_code || v.barcode || v.qr_code || v.variant_sku || "").trim();

export default function EspanaEtiquetas() {
  const { role } = useAuth();
  const canEditScan = role === "admin" || role === "manager";

  const [params, setParams] = useSearchParams();
  const [locs, setLocs] = useState<Loc[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [stock, setStock] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);

  const [locationId, setLocationId] = useState<string>(params.get("sede") || "");
  const [productId, setProductId] = useState<string>(params.get("producto") || "");
  const [q, setQ] = useState("");
  const [sizeFilter, setSizeFilter] = useState("");
  const [onlyWithStock, setOnlyWithStock] = useState(true);
  const [onlyMissingScan, setOnlyMissingScan] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  const [qtyMap, setQtyMap] = useState<Record<string, number>>({});
  const [selMap, setSelMap] = useState<Record<string, boolean>>({});

  // PDF options
  const [cols, setCols] = useState(3);
  const [rows, setRows] = useState(8);
  const [showPrice, setShowPrice] = useState(true);
  const [showQR, setShowQR] = useState(true);
  const [showText, setShowText] = useState(true);
  const [generating, setGenerating] = useState(false);

  const load = async () => {
    setLoading(true);
    const [l, p, v, s] = await Promise.all([
      supabase.from("esp_locations").select("id,name,code,inventory_mode,is_active").eq("is_active", true).order("name"),
      supabase.from("esp_products").select("id,sku,name,price_eur,source,status").order("name"),
      supabase.from("esp_product_variants").select("id,product_id,variant_sku,size,color,scan_code,barcode,qr_code,status,price_eur").order("sort_order"),
      supabase.from("esp_inventory_stock").select("location_id,variant_id,quantity_on_hand"),
    ]);
    if (l.data) setLocs(l.data as Loc[]);
    if (p.data) setProducts(p.data as Product[]);
    if (v.data) setVariants(v.data as Variant[]);
    if (s.data) setStock(s.data as Stock[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const productById = useMemo(() => Object.fromEntries(products.map(p => [p.id, p])), [products]);

  const stockMap = useMemo(() => {
    const m: Record<string, Record<string, number>> = {};
    stock.forEach((s) => {
      m[s.variant_id] = m[s.variant_id] || {};
      m[s.variant_id][s.location_id] = s.quantity_on_hand;
    });
    return m;
  }, [stock]);

  const rowsData: LabelRow[] = useMemo(() => {
    return variants
      .filter((v) => v.status === "active")
      .map((v) => {
        const product = productById[v.product_id];
        const stockInLoc = locationId ? (stockMap[v.id]?.[locationId] ?? 0) : Object.values(stockMap[v.id] || {}).reduce((a, b) => a + b, 0);
        return { variant: v, product, stockInLoc, qty: qtyMap[v.id] ?? (locationId ? Math.max(0, stockInLoc) : 1), selected: !!selMap[v.id] };
      })
      .filter((r) => r.product)
      .filter((r) => (productId ? r.variant.product_id === productId : true))
      .filter((r) => (sizeFilter ? (r.variant.size || "").toLowerCase() === sizeFilter.toLowerCase() : true))
      .filter((r) => (onlyWithStock && locationId ? r.stockInLoc > 0 : true))
      .filter((r) => (onlyMissingScan ? !r.variant.scan_code : true))
      .filter((r) => (sourceFilter === "all" ? true : (r.product.source || "manual") === sourceFilter))
      .filter((r) => {
        if (!q) return true;
        const s = `${r.product.name} ${r.product.sku} ${r.variant.variant_sku} ${r.variant.size ?? ""} ${r.variant.color ?? ""} ${r.variant.scan_code ?? ""}`.toLowerCase();
        return s.includes(q.toLowerCase());
      });
  }, [variants, productById, stockMap, locationId, productId, sizeFilter, onlyWithStock, onlyMissingScan, sourceFilter, q, qtyMap, selMap]);

  const missingCount = useMemo(() => variants.filter(v => v.status === "active" && !v.scan_code).length, [variants]);

  const updateQty = (vid: string, n: number) => setQtyMap((m) => ({ ...m, [vid]: Math.max(0, Math.floor(n || 0)) }));
  const toggleSel = (vid: string, on: boolean) => setSelMap((m) => ({ ...m, [vid]: on }));
  const toggleAll = (on: boolean) => setSelMap(Object.fromEntries(rowsData.map(r => [r.variant.id, on])));

  const editScanCode = async (v: Variant) => {
    const next = prompt("scan_code", v.scan_code || resolveScanCode(v));
    if (next === null) return;
    const trimmed = next.trim();
    const { error } = await supabase.from("esp_product_variants").update({ scan_code: trimmed || null }).eq("id", v.id);
    if (error) return toast.error(error.message);
    toast.success("scan_code actualizado");
    load();
  };

  const generateMissing = async () => {
    const missing = variants.filter(v => v.status === "active" && !v.scan_code);
    if (missing.length === 0) return toast.info("Todas las variantes ya tienen scan_code");
    if (!confirm(`Generar scan_code para ${missing.length} variantes usando barcode → qr_code → variant_sku?`)) return;
    let ok = 0, fail = 0;
    for (const v of missing) {
      const code = (v.barcode || v.qr_code || v.variant_sku || "").trim();
      if (!code) { fail++; continue; }
      const { error } = await supabase.from("esp_product_variants").update({ scan_code: code }).eq("id", v.id);
      if (error) fail++; else ok++;
    }
    toast.success(`Generados ${ok}${fail ? ` · Fallidos ${fail}` : ""}`);
    load();
  };

  const buildLabelsList = (source: "selected" | "location" | "all"): LabelRow[] => {
    let base = rowsData;
    if (source === "selected") base = base.filter(r => r.selected);
    if (source === "location") {
      if (!locationId) { toast.error("Selecciona una sede"); return []; }
      base = base.filter(r => r.stockInLoc > 0).map(r => ({ ...r, qty: r.stockInLoc }));
    }
    return base.filter(r => (r.qty || 0) > 0);
  };

  const currentLocationName = () => {
    const l = locs.find(x => x.id === locationId);
    return l?.code?.toLowerCase() || l?.name?.toLowerCase().replace(/\s+/g, "-") || "todas";
  };

  const generatePdf = async (source: "selected" | "location" | "all") => {
    const list = buildLabelsList(source);
    if (list.length === 0) return toast.error("Nada que imprimir");

    // Validations
    const anyMissing = list.some(r => !resolveScanCode(r.variant));
    if (anyMissing) return toast.error("Hay variantes sin scan_code ni fallback. Genera scan_code primero.");

    // Warn if qty > stock
    if (locationId) {
      const over = list.filter(r => r.qty > r.stockInLoc);
      if (over.length && !confirm(`${over.length} variantes tienen cantidad mayor al stock en la sede. ¿Continuar?`)) return;
    }

    setGenerating(true);
    try {
      // Expand qty
      const flat: { row: LabelRow; scan: string }[] = [];
      list.forEach((r) => {
        const scan = resolveScanCode(r.variant);
        for (let i = 0; i < r.qty; i++) flat.push({ row: r, scan });
      });

      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const pageW = 210, pageH = 297;
      const marginX = 8, marginY = 10;
      const c = Math.max(1, Math.min(6, cols));
      const rN = Math.max(1, Math.min(12, rows));
      const cellW = (pageW - marginX * 2) / c;
      const cellH = (pageH - marginY * 2) / rN;

      // Pre-render QRs
      const qrCache: Record<string, string> = {};
      if (showQR) {
        const uniq = Array.from(new Set(flat.map(f => f.scan)));
        for (const s of uniq) {
          try { qrCache[s] = await QRCode.toDataURL(s, { margin: 0, width: 220 }); } catch { /* ignore */ }
        }
      }

      let idx = 0;
      for (const item of flat) {
        const posInPage = idx % (c * rN);
        if (idx > 0 && posInPage === 0) doc.addPage();
        const col = posInPage % c;
        const row = Math.floor(posInPage / c);
        const x = marginX + col * cellW;
        const y = marginY + row * cellH;

        // Cell border (light)
        doc.setDrawColor(220);
        doc.setLineWidth(0.1);
        doc.rect(x + 1, y + 1, cellW - 2, cellH - 2);

        const padX = x + 3;
        let cursorY = y + 5;

        // Header
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(120);
        doc.text("BASICO", padX, cursorY);
        cursorY += 3;

        // Product name (truncate)
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(0);
        const nameLines = doc.splitTextToSize(item.row.product.name || "", cellW - 6 - (showQR ? 22 : 0));
        doc.text(nameLines.slice(0, 2), padX, cursorY);
        cursorY += nameLines.slice(0, 2).length * 3;

        // SKU / size / color
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(60);
        const meta = [item.row.variant.variant_sku, item.row.variant.size, item.row.variant.color].filter(Boolean).join(" · ");
        doc.text(meta, padX, cursorY);
        cursorY += 3;

        if (showPrice && (item.row.variant.price_eur ?? item.row.product.price_eur)) {
          const price = item.row.variant.price_eur ?? item.row.product.price_eur;
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.setTextColor(0);
          doc.text(`${Number(price).toFixed(2)} €`, padX, cursorY);
          cursorY += 4;
        }

        // QR (right side)
        if (showQR && qrCache[item.scan]) {
          const qrSize = Math.min(cellH - 6, 20);
          doc.addImage(qrCache[item.scan], "PNG", x + cellW - qrSize - 3, y + 2, qrSize, qrSize);
        }

        // Scan text at bottom
        if (showText) {
          doc.setFont("courier", "bold");
          doc.setFontSize(7);
          doc.setTextColor(0);
          doc.text(item.scan, padX, y + cellH - 3);
        }

        idx++;
      }

      const fname = `etiquetas-${currentLocationName()}-${new Date().toISOString().slice(0, 10)}.pdf`;
      doc.save(fname);
      toast.success(`PDF generado (${flat.length} etiquetas)`);
    } catch (e: any) {
      toast.error("Error generando PDF: " + (e?.message || e));
    } finally {
      setGenerating(false);
    }
  };

  const exportCsv = () => {
    const list = buildLabelsList("selected").length > 0 ? buildLabelsList("selected") : rowsData;
    const header = ["product_sku", "product_name", "variant_sku", "size", "color", "scan_code", "location_stock", "qty"];
    const lines = list.map(r => [
      r.product.sku, r.product.name, r.variant.variant_sku, r.variant.size ?? "", r.variant.color ?? "",
      resolveScanCode(r.variant), r.stockInLoc, r.qty,
    ].map(s => `"${String(s ?? "").replace(/"/g, '""')}"`).join(","));
    const blob = new Blob([header.join(",") + "\n" + lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `etiquetas-${currentLocationName()}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const setLocation = (v: string) => {
    setLocationId(v);
    setQtyMap({}); // reset qty so it recalculates from new sede
    if (v) params.set("sede", v); else params.delete("sede");
    setParams(params, { replace: true });
  };

  const allSelected = rowsData.length > 0 && rowsData.every(r => r.selected);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="num text-2xl font-black tracking-tight">Etiquetas / QR</h2>
          <p className="text-sm text-muted-foreground">Genera etiquetas escaneables para POS Móvil e inventario por sede.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {missingCount > 0 && (
            <Button variant="outline" onClick={generateMissing}>
              <Wand2 className="h-4 w-4 mr-2" />Generar scan_code faltantes ({missingCount})
            </Button>
          )}
          <Button variant="outline" onClick={exportCsv}><FileDown className="h-4 w-4 mr-2" />CSV</Button>
          <Button variant="outline" onClick={() => generatePdf("selected")} disabled={generating}>
            <Download className="h-4 w-4 mr-2" />PDF seleccionadas
          </Button>
          <Button onClick={() => generatePdf("location")} disabled={generating || !locationId}>
            <Printer className="h-4 w-4 mr-2" />PDF sede completa
          </Button>
        </div>
      </div>

      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Sede</Label>
            <Select value={locationId || "__all"} onValueChange={(v) => setLocation(v === "__all" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Todas las sedes</SelectItem>
                {locs.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Producto</Label>
            <Select value={productId || "__all"} onValueChange={(v) => setProductId(v === "__all" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="__all">Todos</SelectItem>
                {products.filter(p => p.status === "active").map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Talla</Label>
            <Input value={sizeFilter} onChange={(e) => setSizeFilter(e.target.value)} placeholder="Ej: M" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Buscar</Label>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="SKU, nombre, scan..." />
          </div>
        </div>
        <div className="flex flex-wrap gap-4 items-center text-sm">
          <label className="flex items-center gap-2">
            <Checkbox checked={onlyWithStock} onCheckedChange={(v) => setOnlyWithStock(!!v)} disabled={!locationId} />
            <span className={!locationId ? "text-muted-foreground" : ""}>Solo con stock &gt; 0 en sede</span>
          </label>
          <label className="flex items-center gap-2">
            <Checkbox checked={onlyMissingScan} onCheckedChange={(v) => setOnlyMissingScan(!!v)} />
            Solo sin scan_code
          </label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Fuente:</span>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="woo">Woo</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" variant="ghost" onClick={load}><RefreshCw className="h-3.5 w-3.5 mr-1" />Refrescar</Button>
        </div>
      </Card>

      <Card className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3 items-end">
          <div>
            <Label className="text-xs">Columnas</Label>
            <Input type="number" min={1} max={6} value={cols} onChange={(e) => setCols(Number(e.target.value))} />
          </div>
          <div>
            <Label className="text-xs">Filas</Label>
            <Input type="number" min={1} max={12} value={rows} onChange={(e) => setRows(Number(e.target.value))} />
          </div>
          <label className="flex items-center gap-2 text-sm mt-4">
            <Checkbox checked={showQR} onCheckedChange={(v) => setShowQR(!!v)} /> Mostrar QR
          </label>
          <label className="flex items-center gap-2 text-sm mt-4">
            <Checkbox checked={showPrice} onCheckedChange={(v) => setShowPrice(!!v)} /> Mostrar precio
          </label>
          <label className="flex items-center gap-2 text-sm mt-4">
            <Checkbox checked={showText} onCheckedChange={(v) => setShowText(!!v)} /> Texto scan
          </label>
        </div>
        <p className="text-[11px] text-muted-foreground mb-3">Formato A4 · {cols * rows} etiquetas por página aprox.</p>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"><Checkbox checked={allSelected} onCheckedChange={(v) => toggleAll(!!v)} /></TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>SKU variante</TableHead>
                <TableHead>Talla</TableHead>
                <TableHead>Color</TableHead>
                <TableHead className="text-right">Stock {locationId ? "sede" : "total"}</TableHead>
                <TableHead>scan_code</TableHead>
                <TableHead className="w-24 text-right">Etiquetas</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={10} className="text-center py-6 text-sm text-muted-foreground">Cargando…</TableCell></TableRow>}
              {!loading && rowsData.length === 0 && <TableRow><TableCell colSpan={10} className="text-center py-8 text-sm text-muted-foreground">Sin resultados.</TableCell></TableRow>}
              {rowsData.map((r) => {
                const scan = resolveScanCode(r.variant);
                const hasScan = !!r.variant.scan_code;
                return (
                  <TableRow key={r.variant.id}>
                    <TableCell><Checkbox checked={r.selected} onCheckedChange={(v) => toggleSel(r.variant.id, !!v)} /></TableCell>
                    <TableCell className="font-medium">{r.product.name}</TableCell>
                    <TableCell className="font-mono text-xs">{r.variant.variant_sku}</TableCell>
                    <TableCell>{r.variant.size || "—"}</TableCell>
                    <TableCell>{r.variant.color || "—"}</TableCell>
                    <TableCell className="text-right">{r.stockInLoc}</TableCell>
                    <TableCell className="font-mono text-xs">
                      <div className="flex items-center gap-1">
                        <span className={!hasScan ? "text-amber-600" : ""}>{scan || "—"}</span>
                        {scan && (
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0"
                            onClick={() => { navigator.clipboard.writeText(scan); toast.success("Copiado"); }}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Input type="number" min={0} value={r.qty}
                        onChange={(e) => updateQty(r.variant.id, Number(e.target.value))}
                        className="h-8 w-20 text-right" />
                    </TableCell>
                    <TableCell>
                      {!hasScan && <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-600/40">fallback</Badge>}
                      {hasScan && <Badge variant="outline" className="text-[10px]">ok</Badge>}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" title="Generar etiqueta"
                          onClick={() => { setSelMap({ [r.variant.id]: true }); setTimeout(() => generatePdf("selected"), 50); }}>
                          <Printer className="h-3.5 w-3.5" />
                        </Button>
                        {canEditScan && (
                          <Button size="sm" variant="ghost" title="Editar scan_code" onClick={() => editScanCode(r.variant)}>
                            <Wand2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
