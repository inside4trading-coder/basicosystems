import { useMemo, useState } from "react";
import { Link2, RefreshCcw, Search } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HubHeader } from "@/components/sublime/hub/HubHeader";
import { InvThumb } from "@/components/sublime/inventario/InvThumb";
import {
  useCreateProductFromWoo,
  useIgnoreWooItem,
  useLinkWooToVariant,
  useReadWooCatalog,
  useSublimeInventory,
  useSublimeLocations,
  useSublimeMappings,
  useSublimeWooCatalog,
  useWooReadJob,
  WOO_JOB_ACTIVE,
} from "@/hooks/useSublimeInventory";
import { normalizeName, posBlockers, variantDisplay, type SublimeWooCatalogRow } from "@/lib/sublimeInventory";
import {
  classifyWooCatalog,
  MATCH_METHOD_LABEL,
  persistedMethod,
  WOO_MAP_STATUS_LABEL,
  type WooClassified,
  type WooMapStatus,
} from "@/lib/sublimeWooMatch";
import { Link } from "react-router-dom";

const STATUS_STYLE: Record<WooMapStatus, string> = {
  mapped: "bg-emerald-600 text-white",
  possible: "bg-amber-500 text-white",
  unmapped: "",
  incomplete: "bg-destructive text-destructive-foreground",
  ignored: "opacity-60",
};

/** Mapeo Woo ↔ Hub. Woo solo se lee; el Hub decide. Nada se fusiona por nombre. */
export default function SublimeMapeoWoo() {
  const { data: woo = [], isLoading } = useSublimeWooCatalog();
  const { data: mappings = [] } = useSublimeMappings();
  const { data: inv } = useSublimeInventory();
  const { data: locations = [] } = useSublimeLocations();
  const read = useReadWooCatalog();
  const { data: job } = useWooReadJob();
  const link = useLinkWooToVariant();
  const create = useCreateProductFromWoo();
  const ignore = useIgnoreWooItem();

  const [status, setStatus] = useState<"all" | WooMapStatus>("all");
  const [q, setQ] = useState("");
  const [picker, setPicker] = useState<WooClassified | null>(null);
  const [pickerQ, setPickerQ] = useState("");

  const classified = useMemo(() => {
    const posLocs = new Set(locations.filter((l) => l.sells_in_pos && l.is_active).map((l) => l.id));
    const incomplete = new Set<string>();
    const references = new Map<string, string[]>();
    for (const r of inv?.rows ?? []) {
      const posStock = r.stocks.filter((s) => posLocs.has(s.location_id)).reduce((a, s) => a + Number(s.quantity_available ?? 0), 0);
      const b = posBlockers({ product: r.product, variant: r.variant, posStock }).filter((x) => x !== "no_stock");
      if (b.length) incomplete.add(r.variant.id);
    }
    return classifyWooCatalog(woo, {
      products: inv?.products ?? [],
      variants: inv?.variants ?? [],
      mappings,
      references,
      incompleteVariantIds: incomplete,
    });
  }, [woo, mappings, inv, locations]);

  const counts = useMemo(() => {
    const c: Record<WooMapStatus, number> = { mapped: 0, possible: 0, unmapped: 0, incomplete: 0, ignored: 0 };
    for (const x of classified) c[x.status]++;
    return c;
  }, [classified]);

  const visible = classified.filter((x) => {
    if (status !== "all" && x.status !== status) return false;
    if (q) {
      const s = normalizeName(q);
      const hay = normalizeName(`${x.row.name} ${x.row.sku ?? ""} ${x.row.woo_product_id} ${x.row.woo_variation_id ?? ""}`);
      if (!hay.includes(s)) return false;
    }
    return true;
  });

  const doRead = async () => {
    try {
      const r = await read.mutateAsync();
      toast.success(`Catálogo Woo leído: ${r.products} productos, ${r.variations} variaciones.`);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo leer el catálogo Woo.");
    }
  };

  const doLink = async (x: WooClassified, variantId: string, productId: string, method: Parameters<typeof persistedMethod>[0] | "manual") => {
    try {
      await link.mutateAsync({ row: x.row, variantId, productId, method: method === "manual" ? "manual" : persistedMethod(method) });
      toast.success("Vinculado al Inventario Maestro.");
      setPicker(null);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo vincular.");
    }
  };

  const doCreate = async (x: WooClassified) => {
    const family = woo.filter((r) => r.woo_product_id === x.row.woo_product_id);
    try {
      await create.mutateAsync({ rows: family });
      toast.success("Producto maestro creado. Categoría y costo quedan pendientes.");
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo crear el producto.");
    }
  };

  const pickerCandidates = useMemo(() => {
    if (!picker || !inv) return [];
    const s = normalizeName(pickerQ);
    return inv.rows
      .filter((r) => !s || normalizeName(`${r.product.name} ${r.variant.sku ?? ""} ${r.variant.size ?? ""} ${r.variant.color ?? ""}`).includes(s))
      .slice(0, 40);
  }, [picker, pickerQ, inv]);

  return (
    <div className="space-y-6">
      <HubHeader
        icon={Link2}
        title="Mapeo Woo ↔ Hub"
        subtitle="La tienda web solo se lee. El Inventario Maestro es la fuente de verdad; nada se fusiona solo por nombre."
        actions={
          <Button onClick={doRead} disabled={read.isPending}>
            <RefreshCcw className={`h-4 w-4 mr-2 ${read.isPending ? "animate-spin" : ""}`} />
            Leer catálogo Woo
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {(Object.keys(counts) as WooMapStatus[]).map((k) => (
          <Card
            key={k}
            onClick={() => setStatus(status === k ? "all" : k)}
            className={`rounded-2xl border-border/60 p-3 cursor-pointer ${status === k ? "ring-2 ring-primary" : ""}`}
          >
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{WOO_MAP_STATUS_LABEL[k]}</p>
            <p className="text-2xl font-semibold tabular-nums">{counts[k]}</p>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre, SKU o ID Woo" className="pl-8 w-64" />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as any)}>
          <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {(Object.keys(WOO_MAP_STATUS_LABEL) as WooMapStatus[]).map((k) => (
              <SelectItem key={k} value={k}>{WOO_MAP_STATUS_LABEL[k]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {woo.length > 0 && (
          <span className="text-xs text-muted-foreground">
            Última lectura: {new Date(Math.max(...woo.map((w) => +new Date(w.last_read_at)))).toLocaleString("es-VE")}
          </span>
        )}
      </div>

      <Card className="rounded-2xl border-border/60 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto Woo</TableHead>
              <TableHead>Variación</TableHead>
              <TableHead>SKU Woo</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead className="text-right">Stock Woo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Hub / Sugerencia</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((x) => {
              const r = x.row;
              const isParentVariable = !r.woo_variation_id && r.woo_type === "variable";
              return (
                <TableRow key={r.id} className={x.status === "ignored" ? "opacity-60" : ""}>
                  <TableCell>
                    <div className="flex items-center gap-2 min-w-[220px]">
                      <InvThumb url={r.image_url} alt={r.name} />
                      <div>
                        <p className="font-medium leading-tight">{r.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          #{r.woo_product_id}{r.woo_variation_id ? ` / var ${r.woo_variation_id}` : ""} · {r.woo_type} · {r.woo_status}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {r.woo_variation_id ? [r.size_label ?? "—", r.color_label ?? "—"].join(" · ") : isParentVariable ? "Padre" : "Simple"}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{r.sku ?? <span className="text-muted-foreground">sin SKU</span>}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.price ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.stock_quantity ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={x.status === "unmapped" ? "outline" : "default"} className={`whitespace-nowrap ${STATUS_STYLE[x.status]}`}>
                      {WOO_MAP_STATUS_LABEL[x.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {x.linked ? (
                      <span>
                        {x.linked.product?.name ?? "—"}
                        {x.linked.variant ? ` · ${variantDisplay(x.linked.variant)}` : ""}
                        {x.linked.variant?.sku ? ` · ${x.linked.variant.sku}` : ""}
                      </span>
                    ) : x.candidates.length ? (
                      <div className="space-y-1">
                        {x.candidates.slice(0, 3).map((c) => (
                          <div key={c.variant.id} className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px]">{MATCH_METHOD_LABEL[c.method]}</Badge>
                            <span>{c.product.name} · {variantDisplay(c.variant)}</span>
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-6 px-2 text-[11px]"
                              disabled={link.isPending}
                              onClick={() => doLink(x, c.variant.id, c.product.id, c.method)}
                            >
                              Confirmar
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {x.status === "ignored" ? (
                      <Button size="sm" variant="ghost" onClick={() => ignore.mutate({ row: r, ignore: false })}>Restaurar</Button>
                    ) : (
                      <>
                        {!isParentVariable && (
                          <Button size="sm" variant="outline" onClick={() => { setPicker(x); setPickerQ(""); }}>
                            {x.linked ? "Re-vincular" : "Vincular"}
                          </Button>
                        )}
                        {!x.linked && (
                          <Button size="sm" className="ml-1" disabled={create.isPending} onClick={() => doCreate(x)}>
                            Crear maestro
                          </Button>
                        )}
                        {x.linked?.product && (
                          <Button size="sm" variant="ghost" className="ml-1" asChild>
                            <Link to="/sublime/inventario/pendientes">Completar</Link>
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="ml-1" onClick={() => ignore.mutate({ row: r, ignore: true })}>
                          Ignorar
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                  {isLoading
                    ? "Cargando…"
                    : woo.length === 0
                      ? "Todavía no se ha leído la tienda. Pulsa «Leer catálogo Woo»."
                      : "Sin resultados para este filtro."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!picker} onOpenChange={(o) => !o && setPicker(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Vincular a producto/variante del Hub</DialogTitle>
          </DialogHeader>
          {picker && (
            <p className="text-sm text-muted-foreground">
              Woo: <b>{picker.row.name}</b> {picker.row.woo_variation_id ? `· ${picker.row.size_label ?? "—"} · ${picker.row.color_label ?? "—"}` : ""} {picker.row.sku ? `· ${picker.row.sku}` : ""}
            </p>
          )}
          <Input autoFocus value={pickerQ} onChange={(e) => setPickerQ(e.target.value)} placeholder="Buscar por nombre, SKU, talla o color" />
          <div className="max-h-[50vh] overflow-y-auto divide-y divide-border/40">
            {pickerCandidates.map((r) => (
              <div key={r.variant.id} className="flex items-center justify-between gap-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <InvThumb url={r.product.main_image_url} alt={r.product.name} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{r.product.name}</p>
                    <p className="text-xs text-muted-foreground">{variantDisplay(r.variant)} · {r.variant.sku ?? "sin SKU"}</p>
                  </div>
                </div>
                <Button size="sm" disabled={link.isPending} onClick={() => picker && doLink(picker, r.variant.id, r.product.id, "manual")}>
                  Vincular
                </Button>
              </div>
            ))}
            {pickerCandidates.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">Sin coincidencias.</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPicker(null)}>Cancelar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
