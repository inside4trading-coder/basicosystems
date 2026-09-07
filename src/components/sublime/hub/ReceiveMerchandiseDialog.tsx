import { useMemo, useState } from "react";
import { CheckCircle2, PackageCheck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { locationName, mockLocations } from "@/lib/sublimeMock";
import { MockNotice } from "./MockNotice";

export interface ExpectedSize {
  size: string;
  expected: number;
}

/**
 * Prototipo visual de recepción. No escribe nada: la recepción real sigue
 * ocurriendo con el flujo existente del módulo de Mercancía.
 */
export function ReceiveMerchandiseDialog({
  open,
  onOpenChange,
  productTitle,
  expected,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  productTitle: string;
  expected: ExpectedSize[];
}) {
  const [received, setReceived] = useState<Record<string, number>>({});
  const [location, setLocation] = useState("loc-wh");
  const [done, setDone] = useState(false);

  const totalExpected = expected.reduce((a, e) => a + e.expected, 0);
  const totalReceived = useMemo(
    () => expected.reduce((a, e) => a + (received[e.size] ?? e.expected), 0),
    [expected, received]
  );
  const diffs = expected
    .map((e) => ({ size: e.size, diff: (received[e.size] ?? e.expected) - e.expected }))
    .filter((d) => d.diff !== 0);

  const reset = () => {
    setReceived({});
    setDone(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Recibir mercancía</DialogTitle>
        </DialogHeader>

        {done ? (
          <div className="py-6 text-center space-y-3">
            <CheckCircle2 className="h-10 w-10 text-primary mx-auto" />
            <p className="text-lg font-bold">{totalReceived} unidades creadas</p>
            <p className="text-sm text-muted-foreground">Ubicación: {locationName(location)}</p>
            <div className="mx-auto max-w-xs rounded-xl border border-border/60 p-3 text-left font-mono text-xs text-muted-foreground space-y-0.5">
              {Array.from({ length: Math.min(totalReceived, 4) }).map((_, i) => (
                <p key={i}>UNIT-{String(i + 1).padStart(6, "0")}</p>
              ))}
              {totalReceived > 4 && <p>… hasta UNIT-{String(totalReceived).padStart(6, "0")}</p>}
            </div>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <MockNotice text="Recepción simulada: por ahora no crea unidades ni modifica el inventario real." />
            <div>
              <p className="text-sm font-semibold text-foreground">{productTitle}</p>
              <p className="text-xs text-muted-foreground">Esperado: {totalExpected} unidades</p>
            </div>

            <div className="space-y-2">
              {expected.map((e) => (
                <div key={e.size} className="flex items-center gap-3">
                  <span className="w-16 text-sm font-semibold">{e.size}</span>
                  <span className="w-20 text-xs text-muted-foreground">Esperado {e.expected}</span>
                  <Input
                    type="number"
                    min={0}
                    className="h-11 max-w-[110px]"
                    value={received[e.size] ?? e.expected}
                    onChange={(ev) =>
                      setReceived((p) => ({ ...p, [e.size]: Math.max(0, Number(ev.target.value) || 0) }))
                    }
                  />
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label>Ubicación de destino</Label>
              <Select value={location} onValueChange={setLocation}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {mockLocations.filter((l) => l.kind !== "transit").map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-xl border border-border/60 p-3 text-sm">
              <p className="font-semibold">{totalReceived} recibidas</p>
              <p className="text-xs text-muted-foreground">
                {diffs.length === 0
                  ? "Sin diferencias"
                  : `Diferencia: ${diffs.map((d) => `${d.diff > 0 ? "+" : ""}${d.diff} ${d.size}`).join(", ")}`}
              </p>
            </div>

            <Button className="w-full h-12" onClick={() => setDone(true)}>
              <PackageCheck className="h-4 w-4 mr-2" />
              Confirmar recepción
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
