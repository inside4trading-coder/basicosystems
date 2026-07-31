// Continuación del flujo operativo tras revalidar una fila de "Requieren atención".
// Solo crea/actualiza necesidades de producción (fabricación interna) e idempotencia.
// NO toca Woo, ni OP, ni QR/unidades, ni inventario, ni movimientos financieros.
import { supabase } from "@/integrations/supabase/client";
import type { PolicyEvent } from "@/hooks/useReplenishmentPolicyEvents";
import type { RevalidationResult } from "@/lib/coreRevalidate";

export type FlowResult = {
  ok: boolean;
  message: string;
  needId?: string | null;
  created?: boolean;
  quantity?: number;
  route?: string | null;
  reason?: string;
};

const OPEN_STATUSES = ["pending", "review", "approved", "partially_converted"];
const NO_NEED_LIFECYCLE = new Set(["no_restock", "exit", "replaced", "archived", "ignored"]);

function idempotencyKey(row: PolicyEvent, variantId: string) {
  return `refresh:${row.woo_order_id ?? "-"}:${row.woo_order_item_id ?? "-"}:${variantId}`;
}

function existingNeedIdFromRow(row: PolicyEvent): string | null {
  const fromEvent = (row.resolution_data as any)?.created_need_id;
  if (fromEvent) return String(fromEvent);
  const fromMov =
    (row.unlinkedCoreResolution as any)?.created_need_id ??
    (row.pendingClassificationResolution as any)?.created_need_id;
  return fromMov ? String(fromMov) : null;
}

/**
 * Continúa la ruta operativa después de una revalidación exitosa.
 * Devuelve ok=false cuando el evento NO debe cerrarse.
 */
export async function continueOperationalFlow(
  row: PolicyEvent,
  rev: RevalidationResult,
): Promise<FlowResult> {
  const route = rev.route ?? null;
  const productId = rev.coreProductId ?? row.core_product_id ?? null;
  const variantId = rev.coreVariantId ?? row.core_variant_id ?? null;

  // Ciclos de vida que no generan reposición interna
  if (rev.lifecycleStatus && NO_NEED_LIFECYCLE.has(rev.lifecycleStatus)) {
    return { ok: true, message: "Sin reposición (no restock), evento cerrado.", route };
  }
  if (route === "external_supplier") {
    return { ok: true, message: "Proveedor externo, sin necesidad interna.", route };
  }
  if (route && route !== "internal_factory") {
    return { ok: true, message: "Sin necesidad interna para esta ruta.", route };
  }
  if (rev.restockEnabled === false) {
    return { ok: true, message: "Reposición desactivada, sin necesidad interna.", route };
  }

  // A partir de aquí: fabricación interna (o ruta desconocida con vínculo Core)
  if (!productId || !variantId) {
    return {
      ok: false,
      reason: "missing_core_link",
      message: "Falta vínculo Core (producto/variante) para crear la necesidad.",
      route,
    };
  }

  // --- Idempotencia 1: el evento ya generó una necesidad
  const already = existingNeedIdFromRow(row);
  if (already) {
    return { ok: true, message: "La necesidad ya existía, sin duplicar.", needId: already, route };
  }

  // --- Idempotencia 2: el movimiento origen ya está vinculado
  if (row.sourceMovementId) {
    const { data: linked } = await supabase
      .from("core_production_need_sources")
      .select("production_need_id")
      .eq("fabrication_fund_movement_id", row.sourceMovementId)
      .maybeSingle();
    if ((linked as any)?.production_need_id) {
      return {
        ok: true,
        message: "La necesidad ya existía para este movimiento, sin duplicar.",
        needId: (linked as any).production_need_id,
        route,
      };
    }
  }

  const key = idempotencyKey(row, variantId);
  const qty = Number(row.quantity ?? 0) > 0 ? Number(row.quantity) : 1;

  // Necesidad abierta del mismo variant
  const { data: openNeeds, error: openErr } = await supabase
    .from("core_production_needs")
    .select("id, quantity_needed, quantity_converted_to_order, notes, status")
    .eq("core_variant_id", variantId)
    .eq("need_type", "sale_generated")
    .in("status", OPEN_STATUSES)
    .order("created_at", { ascending: false });
  if (openErr) {
    return { ok: false, reason: "lookup_failed", message: openErr.message, route };
  }

  // --- Idempotencia 3: misma clave lógica ya procesada
  const dup = (openNeeds ?? []).find((n: any) => String(n.notes ?? "").includes(key));
  if (dup) {
    return { ok: true, message: "La necesidad ya existía, sin duplicar.", needId: dup.id, route };
  }

  const existing = (openNeeds ?? [])[0] as any | undefined;

  // Datos de producto/variante para etiquetas
  const [{ data: prod }, { data: variant }] = await Promise.all([
    supabase.from("core_products").select("name, core_sku").eq("id", productId).maybeSingle(),
    supabase
      .from("core_product_variants")
      .select("size, variant_label, variant_sku, woo_sku")
      .eq("id", variantId)
      .maybeSingle(),
  ]);

  let needId: string;
  let created = false;

  if (existing) {
    const newNeeded = Number(existing.quantity_needed ?? 0) + qty;
    const pending = newNeeded - Number(existing.quantity_converted_to_order ?? 0);
    const { error: upErr } = await supabase
      .from("core_production_needs")
      .update({
        quantity_needed: newNeeded,
        quantity_pending: pending,
        notes: [existing.notes, key].filter(Boolean).join(" | "),
      })
      .eq("id", existing.id);
    if (upErr) return { ok: false, reason: "update_failed", message: upErr.message, route };
    needId = existing.id;
  } else {
    const { data: ins, error: insErr } = await supabase
      .from("core_production_needs")
      .insert({
        need_type: "sale_generated",
        status: "pending",
        priority: "media",
        core_product_id: productId,
        core_variant_id: variantId,
        sku: (prod as any)?.core_sku ?? null,
        variant_sku: (variant as any)?.variant_sku ?? (variant as any)?.woo_sku ?? null,
        product_name: (prod as any)?.name ?? null,
        variant_label: (variant as any)?.variant_label ?? null,
        size: (variant as any)?.size ?? null,
        quantity_needed: qty,
        quantity_approved: 0,
        quantity_converted_to_order: 0,
        quantity_pending: qty,
        source: "attention_refresh",
        reason: "Revalidación de Requieren atención",
        notes: key,
      })
      .select("id")
      .single();
    if (insErr || !ins) {
      return {
        ok: false,
        reason: "insert_failed",
        message: insErr?.message ?? "No se pudo crear la necesidad.",
        route,
      };
    }
    needId = (ins as any).id;
    created = true;
  }

  // Vincular origen (solo si hay movimiento de partida)
  if (row.sourceMovementId) {
    await supabase.from("core_production_need_sources").insert({
      production_need_id: needId,
      fabrication_fund_movement_id: row.sourceMovementId,
      source_order_id: row.woo_order_id ?? null,
      source_order_item_id: row.woo_order_item_id ?? null,
      quantity: qty,
      amount: row.amount ?? null,
      currency: "USD",
    });
  }

  return {
    ok: true,
    created,
    needId,
    quantity: qty,
    route: route ?? "internal_factory",
    message: created
      ? `Necesidad creada (${qty} uds).`
      : `Necesidad actualizada (+${qty} uds).`,
  };
}
