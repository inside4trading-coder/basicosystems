/**
 * Presentación monetaria del POS Sublime.
 * Bolívares es la moneda protagonista; REF es la referencia equivalente.
 * El cálculo interno sigue en unidades REF.
 */
import { cn } from "@/lib/utils";

export const bsAmount = (ref: number, rate: number) =>
  (ref * rate).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const bsFormat = (ref: number, rate: number) => `Bs. ${bsAmount(ref, rate)}`;

export const refAmount = (ref: number) =>
  ref.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const refFormat = (ref: number) => `REF ${refAmount(ref)}`;

/** Convierte un monto expresado en la moneda del método a REF. */
export const toRef = (amount: number, currency: "USD" | "VES", rate: number) =>
  currency === "VES" ? amount / rate : amount;

type MoneySize = "xs" | "sm" | "md" | "lg" | "xl";

const BS_SIZE: Record<MoneySize, string> = {
  xs: "text-[11px] font-bold",
  sm: "text-sm font-bold",
  md: "text-base font-black",
  lg: "text-2xl font-black",
  xl: "text-4xl font-black leading-none",
};

const REF_SIZE: Record<MoneySize, string> = {
  xs: "text-[9px]",
  sm: "text-[10px]",
  md: "text-[11px]",
  lg: "text-xs",
  xl: "text-sm",
};

export function Money({
  value,
  rate,
  size = "md",
  sign,
  align = "right",
  tone,
  strike,
  className,
}: {
  value: number;
  rate: number;
  size?: MoneySize;
  sign?: "+" | "-";
  align?: "left" | "right";
  tone?: "default" | "muted" | "destructive" | "primary";
  strike?: boolean;
  className?: string;
}) {
  const prefix = sign === "-" ? "−" : sign === "+" ? "+" : "";
  const toneCls =
    tone === "muted"
      ? "text-muted-foreground"
      : tone === "destructive"
        ? "text-destructive"
        : tone === "primary"
          ? "text-primary"
          : "text-foreground";

  return (
    <span
      className={cn(
        "inline-flex flex-col leading-tight",
        align === "right" ? "items-end text-right" : "items-start text-left",
        className
      )}
    >
      <span className={cn("num tabular-nums", BS_SIZE[size], toneCls, strike && "line-through opacity-60")}>
        {prefix}
        {bsFormat(value, rate)}
      </span>
      <span
        className={cn(
          "num tabular-nums uppercase tracking-wider text-muted-foreground",
          REF_SIZE[size],
          strike && "line-through opacity-60"
        )}
      >
        {prefix}
        {refFormat(value)}
      </span>
    </span>
  );
}

/** Variante en una sola línea: "Bs. 5.100,00 · REF 34,00". */
export function MoneyInline({
  value,
  rate,
  className,
}: {
  value: number;
  rate: number;
  className?: string;
}) {
  return (
    <span className={cn("num tabular-nums", className)}>
      <span className="font-bold text-foreground">{bsFormat(value, rate)}</span>{" "}
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{refFormat(value)}</span>
    </span>
  );
}
