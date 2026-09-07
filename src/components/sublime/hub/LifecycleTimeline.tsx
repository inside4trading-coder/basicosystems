import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LIFECYCLE_LABEL, LIFECYCLE_ORDER, type LifecycleEvent } from "@/types/sublimeHub";
import { defaultLifecycle, locationName, mockLifecycle } from "@/lib/sublimeMock";
import { MockNotice } from "./MockNotice";

export function getLifecycle(productId: string): LifecycleEvent[] {
  return mockLifecycle[productId] ?? defaultLifecycle;
}

export function LifecycleTimeline({ events }: { events: LifecycleEvent[] }) {
  const byStage = new Map(events.map((e) => [e.stage, e]));
  return (
    <ol className="relative pl-6">
      {LIFECYCLE_ORDER.map((stage, i) => {
        const ev = byStage.get(stage);
        const done = Boolean(ev?.at);
        return (
          <li key={stage} className="relative pb-5 last:pb-0">
            {i < LIFECYCLE_ORDER.length - 1 && (
              <span
                className={cn(
                  "absolute left-[-14px] top-5 h-full w-px",
                  done ? "bg-primary/40" : "bg-border"
                )}
              />
            )}
            <span
              className={cn(
                "absolute left-[-21px] top-1 flex h-4 w-4 items-center justify-center rounded-full border",
                done ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background"
              )}
            >
              {done ? <Check className="h-2.5 w-2.5" /> : null}
            </span>
            <div className={cn(!done && "opacity-50")}>
              <p className="text-sm font-semibold text-foreground">{LIFECYCLE_LABEL[stage]}</p>
              <p className="text-xs text-muted-foreground">
                {ev?.at ? ev.at : "Pendiente"}
                {ev?.user ? ` · ${ev.user}` : ""}
                {ev?.locationId ? ` · ${locationName(ev.locationId)}` : ""}
              </p>
              {ev?.note ? <p className="text-xs text-muted-foreground mt-0.5">{ev.note}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function LifecycleDialog({
  open,
  onOpenChange,
  productTitle,
  productId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  productTitle: string;
  productId: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Historial · {productTitle}</DialogTitle>
        </DialogHeader>
        <MockNotice text="Ciclo de vida de ejemplo, combinado con la información de compra y envío disponible." />
        <div className="pt-3">
          <LifecycleTimeline events={getLifecycle(productId)} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
