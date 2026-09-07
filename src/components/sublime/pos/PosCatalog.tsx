import { useMemo, useState } from "react";
import { ScanLine, Search, Shirt } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { usdFormat, variantLabel } from "@/lib/sublimeMock";
import { posCatalog, posCategories, type PosCatalogEntry } from "./usePosCart";

export function PosCatalog({
  onPick,
  onScan,
}: {
  onPick: (entry: PosCatalogEntry) => void;
  onScan: () => void;
}) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string>("all");

  const entries = useMemo(
    () =>
      posCatalog.filter((e) => {
        const matchCat = category === "all" || e.product.category === category;
        const text = `${e.product.title} ${e.variant.sku} ${e.variant.size} ${e.variant.color} ${
          e.product.manufacturerCode ?? ""
        }`.toLowerCase();
        return matchCat && (q.trim() === "" || text.includes(q.toLowerCase()));
      }),
    [q, category]
  );

  return (
    <div className="flex flex-col min-h-0 gap-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por producto, SKU o código…"
            className="h-12 pl-10 text-base"
          />
        </div>
        <Button size="lg" variant="outline" className="h-12" onClick={onScan}>
          <ScanLine className="h-5 w-5 mr-2" />
          Identificar
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Chip active={category === "all"} onClick={() => setCategory("all")}>
          Todo
        </Chip>
        {posCategories.map((c) => (
          <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
            {c}
          </Chip>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {entries.map((e) => (
            <ProductCard key={e.variant.id} entry={e} onPick={() => onPick(e)} />
          ))}
          {entries.length === 0 && (
            <p className="text-sm text-muted-foreground col-span-full py-10 text-center">
              Sin resultados para esta búsqueda.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
        active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function ProductCard({ entry, onPick }: { entry: PosCatalogEntry; onPick: () => void }) {
  const out = entry.storeStock <= 0;
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => !out && onPick()}
      onKeyDown={(ev) => ev.key === "Enter" && !out && onPick()}
      className={cn(
        "rounded-2xl border-border/60 overflow-hidden text-left transition-all",
        out ? "opacity-50 cursor-not-allowed" : "hover:border-primary/50 hover:shadow-lg cursor-pointer"
      )}
    >
      <div className="aspect-square bg-muted flex items-center justify-center">
        <Shirt className="h-10 w-10 text-muted-foreground/50" />
      </div>
      <div className="p-3 space-y-0.5">
        <p className="font-bold text-sm text-foreground leading-tight line-clamp-2">
          {entry.product.title}
        </p>
        <p className="text-xs text-muted-foreground">{variantLabel(entry.variant)}</p>
        <p className="font-mono text-[10px] text-muted-foreground/80">{entry.variant.sku}</p>
        <div className="flex items-baseline justify-between pt-1">
          <span className="num text-lg font-black tabular-nums text-foreground">
            {usdFormat(entry.variant.pvp)}
          </span>
          <span className={cn("text-xs font-semibold", out ? "text-destructive" : "text-muted-foreground")}>
            {out ? "Sin stock" : `${entry.storeStock} disp.`}
          </span>
        </div>
      </div>
    </Card>
  );
}
