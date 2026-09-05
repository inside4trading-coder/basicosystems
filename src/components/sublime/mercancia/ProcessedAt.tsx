import { formatDMY } from "@/lib/dateUtils";

/**
 * Muestra la fecha en que el producto fue registrado/procesado en el módulo.
 * Usa created_at, que se guarda automáticamente al crear el producto.
 */
export function ProcessedAt({
  value,
  className = "text-[10px] text-muted-foreground",
}: {
  value: string | null | undefined;
  className?: string;
}) {
  if (!value) return null;
  return <p className={className}>Procesado: {formatDMY(value)}</p>;
}
