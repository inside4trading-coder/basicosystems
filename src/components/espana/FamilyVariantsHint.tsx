import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Muestra las variantes REALES (tallas) que existen en inventario para la
 * familia de material de la receta. Solo lectura: no modifica recetas ni stock.
 */
export default function FamilyVariantsHint({
  materialType,
  familyName,
  familyColor,
  requestedSize,
}: {
  materialType: string | null;
  familyName: string | null;
  familyColor: string | null;
  requestedSize: string | null;
}) {
  const [sizes, setSizes] = useState<string[] | null>(null);

  useEffect(() => {
    if (!familyName) return;
    let cancelled = false;
    (async () => {
      let q = supabase
        .from("esp_material_items")
        .select("size,normalized_size,color,material_type")
        .eq("status", "active")
        .eq("name", familyName)
        .limit(200);
      if (materialType) q = q.eq("material_type", materialType);
      const { data } = await q;
      if (cancelled) return;
      const rows = ((data || []) as any[]).filter(
        (r) => (familyColor ? (r.color || "") === familyColor : true),
      );
      const list = Array.from(
        new Set(rows.map((r) => (r.size || r.normalized_size || "").toString().trim()).filter(Boolean)),
      );
      setSizes(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [materialType, familyName, familyColor]);

  if (!familyName) return null;

  return (
    <div className="text-[10px] text-muted-foreground mt-0.5">
      <span className="font-medium">{familyName}</span>
      {familyColor ? ` · ${familyColor}` : ""}
      {" — tallas reales en inventario: "}
      {sizes === null ? "cargando…" : sizes.length ? sizes.join(", ") : "ninguna"}
      {requestedSize ? ` · la talla pedida (${requestedSize}) no existe con ese nombre` : ""}
    </div>
  );
}
