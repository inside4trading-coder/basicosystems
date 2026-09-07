import { Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { posChannelAccentClass, posChannelRingClass } from "@/lib/posChannelStyle";
import {
  POS_SALES_CHANNELS,
  posChannel,
  type PosSalesChannelId,
} from "@/lib/posSalesChannels";

/**
 * Origen de la venta: obligatorio y sin preselección.
 * Es una dimensión distinta del método de pago.
 */
export function PosChannelPicker({
  channel,
  setChannel,
  channelDetail,
  setChannelDetail,
  compact,
}: {
  channel: PosSalesChannelId | null;
  setChannel: (c: PosSalesChannelId | null) => void;
  channelDetail: string;
  setChannelDetail: (d: string) => void;
  compact?: boolean;
}) {
  const def = channel ? posChannel(channel) : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-muted-foreground">
          Origen de la venta · obligatorio
        </p>
        {channel ? (
          <span className="flex items-center gap-1 text-[11px] font-bold text-primary">
            <Check className="h-3.5 w-3.5" />
            Confirmado
          </span>
        ) : (
          <span className="text-[11px] font-bold text-destructive">Sin seleccionar</span>
        )}
      </div>

      <div className={cn("grid grid-cols-3 gap-2", compact && "gap-1.5")}>
        {POS_SALES_CHANNELS.map((c) => {
          const active = channel === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setChannel(active ? null : c.id)}
              className={cn(
                "rounded-xl border px-3 py-3 text-sm font-black uppercase tracking-wide transition-all",
                active
                  ? cn(
                      posChannelAccentClass(c.id),
                      posChannelRingClass(c.id),
                      "border-transparent ring-2 ring-offset-2 ring-offset-background scale-[1.02]"
                    )
                  : "border-border/60 text-muted-foreground hover:border-primary/40"
              )}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {def?.requiresDetail ? (
        <div className="space-y-1">
          <p className="text-[11px] font-bold text-muted-foreground">
            {def.detailLabel ?? "Detalle del origen"}
          </p>
          <Input
            value={channelDetail}
            onChange={(e) => setChannelDetail(e.target.value)}
            placeholder={def.detailLabel ?? "Detalle del origen"}
            className="h-9 text-sm"
          />
        </div>
      ) : null}

      <p className="text-[11px] text-muted-foreground">
        El origen no es el método de pago: una venta por WhatsApp puede cobrarse con pago móvil.
      </p>
    </div>
  );
}
