// Fase 2B compact: mensajes claros para bloqueos de política de reposición
// devueltos por edge functions (409 policy_blocked).

export const POLICY_ACTION_MESSAGES: Record<string, string> = {
  manual_cost_review:
    "Este producto tiene costo manual, pero no tiene estructura fabricable. Revisa si debe fabricarse o si solo debe usarse como costo referencial.",
  external_supplier_review:
    "Este producto está marcado como proveedor externo. No debe entrar a producción interna.",
  block_no_restock:
    "Este producto está marcado como no restock. No debe reponerse.",
  block_exit:
    "Este producto está en salida. No debe fabricarse ni reponerse.",
  block_ignored:
    "Este producto está ignorado por política Core.",
  suggest_replacement:
    "Este producto fue reemplazado. Revisa el producto sustituto sugerido.",
};

export const POLICY_ACTION_LABELS: Record<string, string> = {
  manual_cost_review: "Costo manual · revisión",
  external_supplier_review: "Proveedor externo",
  block_no_restock: "No restock",
  block_exit: "En salida",
  block_ignored: "Ignorado",
  suggest_replacement: "Reemplazo sugerido",
  allow_internal_factory: "Fabricación interna",
};

export type BlockedLine = {
  sku?: string | null;
  variant_sku?: string | null;
  core_variant_id?: string | null;
  core_product_id?: string | null;
  woo_product_id?: number | null;
  woo_variation_id?: number | null;
  action: string;
  message?: string | null;
  quantity?: number | null;
  unit_cost?: number | null;
  replacement_product_id?: string | null;
  replacement_woo_product_id?: number | null;
  external_supplier_name?: string | null;
  external_supplier_unit_cost_usd?: number | null;
};

export function describePolicyAction(action: string): string {
  return (
    POLICY_ACTION_MESSAGES[action] ??
    "Este producto está bloqueado por política de reposición."
  );
}

// Lee un error devuelto por supabase.functions.invoke y detecta si es un
// bloqueo por política. Devuelve las líneas o null.
export async function parsePolicyBlocked(
  error: any,
  data: any,
): Promise<{ blocked: BlockedLine[]; message?: string } | null> {
  // Caso 1: la function devolvió 200 con { error: "policy_blocked", blocked_lines }
  if (data && typeof data === "object" && data.error === "policy_blocked") {
    return { blocked: data.blocked_lines ?? [], message: data.message };
  }
  // Caso 2: la function devolvió 409 → supabase-js lanza FunctionsHttpError
  // y guarda la Response original en error.context.
  const ctx = error?.context;
  if (ctx && typeof ctx.json === "function") {
    try {
      const body = await ctx.json();
      if (body?.error === "policy_blocked") {
        return { blocked: body.blocked_lines ?? [], message: body.message };
      }
    } catch (_) {}
  }
  return null;
}

export function summarizeBlockedLines(lines: BlockedLine[]): string {
  return lines
    .map((l) => {
      const parts = [
        POLICY_ACTION_LABELS[l.action] ?? l.action,
        l.sku ?? "",
        l.variant_sku ?? "",
        l.quantity != null ? `cant ${l.quantity}` : "",
        l.replacement_woo_product_id
          ? `reemplazo Woo #${l.replacement_woo_product_id}`
          : "",
        l.external_supplier_name
          ? `proveedor ${l.external_supplier_name}`
          : "",
      ].filter(Boolean);
      return `- ${parts.join(" · ")}: ${l.message ?? describePolicyAction(l.action)}`;
    })
    .join("\n");
}
