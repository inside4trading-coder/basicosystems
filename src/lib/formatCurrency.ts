// Safe currency formatter: Intl.NumberFormat throws RangeError for invalid
// ISO 4217 codes (por ejemplo "BCV" o "E"). Este helper degrada a un formato
// numérico + sufijo con el código tal cual, evitando que un dato malo tumbe
// toda la pantalla.
export function formatCurrencySafe(
  amount: number,
  currency: string | null | undefined,
  opts: Intl.NumberFormatOptions = { maximumFractionDigits: 0 },
): string {
  const code = (currency ?? "USD").trim().toUpperCase();
  try {
    return new Intl.NumberFormat("es-VE", {
      style: "currency",
      currency: code,
      ...opts,
    }).format(amount);
  } catch {
    const num = new Intl.NumberFormat("es-VE", opts).format(amount);
    return `${num} ${code}`;
  }
}
