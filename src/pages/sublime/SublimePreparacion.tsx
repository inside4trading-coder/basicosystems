import { useNavigate } from "react-router-dom";
import { Check, Circle, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { HubHeader } from "@/components/sublime/hub/HubHeader";
import { MockNotice } from "@/components/sublime/hub/MockNotice";
import { PREPARATION_LABEL } from "@/types/sublimeHub";
import {
  mockPreparationChecklist,
  mockPreparationState,
  mockProducts,
  mockVariants,
  usdFormat,
} from "@/lib/sublimeMock";

export default function SublimePreparacion() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <HubHeader
        icon={Sparkles}
        title="Preparación de producto"
        subtitle="Productos comprados o en tránsito que aún deben prepararse para publicación"
      />
      <MockNotice text="Avance de preparación de ejemplo. El SKU definitivo de cada variante nace en este flujo." />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {mockProducts.map((p) => {
          const done = mockPreparationState[p.id] ?? [];
          const pct = Math.round((done.length / mockPreparationChecklist.length) * 100);
          const variants = mockVariants.filter((v) => v.productId === p.id);
          const qty = variants.reduce((a, v) => a + v.quantity, 0);
          const cost = variants[0]?.unitCost ?? 0;
          const pvp = variants[0]?.pvp ?? 0;
          return (
            <Card key={p.id} className="p-5 rounded-2xl border-border/60 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-foreground">{p.provisionalName}</p>
                  <p className="text-xs text-muted-foreground">
                    Código fabricante: {p.manufacturerCode ?? "—"}
                  </p>
                </div>
                <Badge variant={p.preparation === "published" ? "default" : "secondary"}>
                  {PREPARATION_LABEL[p.preparation]}
                </Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <p className="text-muted-foreground">Cantidad</p>
                  <p className="font-semibold tabular-nums">{qty}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Tallas</p>
                  <p className="font-semibold">{variants.map((v) => v.size).join(", ") || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Costo unit.</p>
                  <p className="font-semibold tabular-nums">{usdFormat(cost)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">PVP sugerido</p>
                  <p className="font-semibold tabular-nums">{usdFormat(pvp)}</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Preparación</span>
                  <span className="font-semibold tabular-nums">{pct}%</span>
                </div>
                <Progress value={pct} />
                <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
                  {mockPreparationChecklist.map((c) => {
                    const ok = done.includes(c.key);
                    return (
                      <span
                        key={c.key}
                        className={`inline-flex items-center gap-1 text-xs ${ok ? "text-foreground" : "text-muted-foreground"}`}
                      >
                        {ok ? <Check className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
                        {c.label}
                      </span>
                    );
                  })}
                </div>
              </div>

              <Button className="w-full" onClick={() => navigate(`/sublime/mercancia/preparar/${p.id}`)}>
                Continuar preparación
              </Button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
