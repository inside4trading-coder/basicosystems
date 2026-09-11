import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Circle, Search, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { HubHeader } from "@/components/sublime/hub/HubHeader";
import { InvThumb } from "@/components/sublime/inventario/InvThumb";
import { useSublimeInventory, useSublimeLocations } from "@/hooks/useSublimeInventory";
import { posBlockers } from "@/lib/sublimeInventory";
import { PREP_CHECKLIST, prepDone, prepPercent, prepStatus } from "@/lib/sublimePrep";
import { PREPARATION_LABEL } from "@/types/sublimeHub";

export default function SublimePreparacion() {
  const navigate = useNavigate();
  const { data, isLoading } = useSublimeInventory();
  const { data: locations = [] } = useSublimeLocations();
  const [q, setQ] = useState("");
  const [onlyPending, setOnlyPending] = useState(true);

  const posLocationIds = useMemo(
    () => new Set(locations.filter((l) => l.sells_in_pos && l.is_active).map((l) => l.id)),
    [locations]
  );

  const cards = useMemo(() => {
    const rows = data?.rows ?? [];
    const byProduct = new Map<string, typeof rows>();
    for (const r of rows) {
      const list = byProduct.get(r.product.id) ?? [];
      list.push(r);
      byProduct.set(r.product.id, list);
    }
    return Array.from(byProduct.entries())
      .map(([productId, list]) => {
        const product = list[0].product;
        const variants = list.map((r) => r.variant);
        const input = { product, variants };
        const pct = prepPercent(input);
        const done = prepDone(input);
        const status = prepStatus(pct, !!product.woo_product_id);
        const posReady = list.filter((r) => {
          const posStock = r.stocks
            .filter((s) => posLocationIds.has(s.location_id))
            .reduce((a, s) => a + Number(s.quantity_available ?? 0), 0);
          return posBlockers({ product, variant: r.variant, posStock }).length === 0;
        }).length;
        const units = list.reduce(
          (a, r) => a + r.stocks.reduce((b, s) => b + Number(s.quantity_on_hand ?? 0), 0),
          0
        );
        return { productId, product, list, variants, pct, done, status, posReady, units };
      })
      .sort((a, b) => a.pct - b.pct || a.product.name.localeCompare(b.product.name));
  }, [data, posLocationIds]);

  const filtered = cards.filter((c) => {
    if (onlyPending && c.pct >= 100) return false;
    if (!q.trim()) return true;
    const text = `${c.product.name} ${c.product.brand ?? ""} ${c.variants.map((v) => v.sku ?? "").join(" ")}`;
    return text.toLowerCase().includes(q.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <HubHeader
        icon={Sparkles}
        title="Preparación de producto"
        subtitle="Productos reales del catálogo Sublime que aún deben completarse para vender y publicar"
        actions={
          <Button variant={onlyPending ? "default" : "outline"} onClick={() => setOnlyPending((v) => !v)}>
            {onlyPending ? "Viendo pendientes" : "Viendo todos"}
          </Button>
        }
      />

      <Card className="p-3 rounded-2xl border-border/60">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar producto, marca o SKU…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </Card>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando catálogo real…</p>
      ) : filtered.length === 0 ? (
        <Card className="p-8 rounded-2xl border-border/60 text-center text-sm text-muted-foreground">
          No hay productos que coincidan.
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((c) => (
            <Card key={c.productId} className="p-5 rounded-2xl border-border/60 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <InvThumb url={c.product.main_image_url} alt={c.product.name} />
                  <div className="min-w-0">
                    <p className="font-bold text-foreground truncate">{c.product.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {c.product.brand || "Sin marca"} · {c.product.category || "Sin categoría"}
                    </p>
                  </div>
                </div>
                <Badge variant={c.status === "published" ? "default" : "secondary"}>
                  {PREPARATION_LABEL[c.status]}
                </Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <p className="text-muted-foreground">Variantes</p>
                  <p className="font-semibold tabular-nums">{c.variants.length}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Unidades</p>
                  <p className="font-semibold tabular-nums">{c.units}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Tallas</p>
                  <p className="font-semibold truncate">
                    {c.variants.map((v) => v.size).filter(Boolean).join(", ") || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">POS</p>
                  <p className={`font-semibold ${c.posReady > 0 ? "text-emerald-600" : "text-muted-foreground"}`}>
                    {c.posReady > 0 ? `Listo (${c.posReady}/${c.variants.length})` : "No listo"}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Preparación web</span>
                  <span className="font-semibold tabular-nums">{c.pct}%</span>
                </div>
                <Progress value={c.pct} />
                <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
                  {PREP_CHECKLIST.map((item) => {
                    const ok = c.done[item.key];
                    return (
                      <span
                        key={item.key}
                        className={`inline-flex items-center gap-1 text-xs ${ok ? "text-foreground" : "text-muted-foreground"}`}
                      >
                        {ok ? <Check className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
                        {item.label}
                      </span>
                    );
                  })}
                </div>
              </div>

              <Button className="w-full" onClick={() => navigate(`/sublime/mercancia/preparar/${c.productId}`)}>
                Continuar preparación
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
