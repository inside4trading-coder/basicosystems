/**
 * Paleta de gráficas [B] SYSTEMS.
 * Escala azul del sistema; el rosa de alerta queda reservado para estados negativos.
 */
export const BRAND_CHART_COLORS = [
  "hsl(var(--blue-500))",
  "hsl(var(--blue-700))",
  "hsl(var(--blue-300))",
  "hsl(var(--blue-900))",
  "hsl(var(--studio-slate, 213 15% 40%))",
  "hsl(var(--muted-foreground))",
];

/** Color único para series simples (barras, líneas). */
export const BRAND_CHART_PRIMARY = "hsl(var(--blue-500))";

/** Reservado exclusivamente para alertas / valores negativos. */
export const BRAND_CHART_ALERT = "hsl(var(--destructive))";
