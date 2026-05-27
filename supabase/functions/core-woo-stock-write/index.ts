// BLOQUE 13 (preparación) — Capa segura de escritura WooCommerce.
// Esta función SOLO opera en dry_run: no envía nada a WooCommerce.
// Campos permitidos a futuro: stock_quantity, manage_stock, stock_status.
// Campos prohibidos: nombre, precio, descripción, imágenes, categorías,
// pedidos, estados de pedido, atributos, creación de productos o variaciones.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_WOO_FIELDS = new Set(["stock_quantity", "manage_stock", "stock_status"]);

interface Body {
  production_unit_id?: string;
  action_type?: "stock_increase" | "stock_decrease" | "stock_set";
  quantity?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller (JWT) — use anon client with bearer to read auth.uid()
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    const userId = userRes?.user?.id ?? null;
    if (!userId) {
      return json({ error: "unauthorized" }, 401);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Role gate: admin or manager
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roleSet = new Set((roles ?? []).map((r: any) => r.role));
    if (!roleSet.has("admin") && !roleSet.has("manager")) {
      return json({ error: "forbidden" }, 403);
    }

    const body: Body = await req.json().catch(() => ({}));
    const action_type = body.action_type ?? "stock_increase";
    const quantity = Number(body.quantity ?? 1);
    if (!body.production_unit_id) {
      return json({ error: "production_unit_id required" }, 400);
    }
    if (!["stock_increase", "stock_decrease", "stock_set"].includes(action_type)) {
      return json({ error: "invalid action_type" }, 400);
    }

    // 1) Modo actual
    const { data: settings } = await admin
      .from("core_settings")
      .select("id, woo_write_mode")
      .limit(1)
      .maybeSingle();
    const mode: string = (settings as any)?.woo_write_mode ?? "dry_run";

    if (mode === "off") {
      return json({ error: "woo_write_mode=off — escritura deshabilitada" }, 423);
    }
    if (mode !== "dry_run") {
      // manual_confirm/enabled aún no implementados — solo dry_run permitido
      return json(
        { error: `Modo ${mode} aún no implementado. Solo dry_run está activo en esta fase.` },
        423,
      );
    }

    // 2) Cargar unidad + producto + variante
    const { data: unit, error: unitErr } = await admin
      .from("core_production_units")
      .select(
        "id, unit_code, status, production_order_id, core_product_id, core_variant_id, sku, variant_sku",
      )
      .eq("id", body.production_unit_id)
      .maybeSingle();
    if (unitErr || !unit) return json({ error: "Unidad no encontrada" }, 404);

    const { data: product } = await admin
      .from("core_products")
      .select("id, woo_product_id, woo_sku, woo_stock_quantity")
      .eq("id", (unit as any).core_product_id)
      .maybeSingle();

    const { data: variant } = await admin
      .from("core_product_variants")
      .select("id, woo_variation_id, woo_sku, woo_stock_quantity, size, variant_label")
      .eq("id", (unit as any).core_variant_id)
      .maybeSingle();

    const stock_before = Number(
      (variant as any)?.woo_stock_quantity ??
        (product as any)?.woo_stock_quantity ??
        0,
    );
    let stock_after_expected = stock_before;
    if (action_type === "stock_increase") stock_after_expected = stock_before + quantity;
    if (action_type === "stock_decrease") stock_after_expected = stock_before - quantity;
    if (action_type === "stock_set") stock_after_expected = quantity;

    // 3) Idempotencia: production_unit_id + action_type
    const idempotency_key = `${(unit as any).unit_code}::${action_type}`;

    // Si ya hay confirmed/success con esa key → skipped
    const { data: existingActive } = await admin
      .from("core_woo_write_logs")
      .select("id, status")
      .eq("idempotency_key", idempotency_key)
      .in("status", ["confirmed", "success"])
      .limit(1)
      .maybeSingle();

    if (existingActive) {
      const { data: skipLog } = await admin
        .from("core_woo_write_logs")
        .insert({
          action_type,
          mode,
          source_type: "production_unit",
          source_id: (unit as any).id,
          production_unit_id: (unit as any).id,
          production_order_id: (unit as any).production_order_id,
          core_product_id: (unit as any).core_product_id,
          core_variant_id: (unit as any).core_variant_id,
          woo_product_id: (product as any)?.woo_product_id ?? null,
          woo_variation_id: (variant as any)?.woo_variation_id ?? null,
          sku: (unit as any).sku,
          variant_sku: (unit as any).variant_sku,
          stock_before,
          quantity_delta:
            action_type === "stock_set" ? null : (action_type === "stock_decrease" ? -quantity : quantity),
          stock_after_expected,
          status: "skipped",
          error_message:
            "Esta unidad ya fue preparada o ingresada a inventario. No se puede duplicar.",
          idempotency_key,
          created_by: userId,
        })
        .select()
        .single();
      return json({
        ok: false,
        skipped: true,
        reason: "idempotent_block",
        message:
          "Esta unidad ya fue preparada o ingresada a inventario. No se puede duplicar.",
        log: skipLog,
      });
    }

    // 4) Si ya hay preview activo, devolver el existente (no duplicar previews)
    const { data: existingPreview } = await admin
      .from("core_woo_write_logs")
      .select("*")
      .eq("idempotency_key", idempotency_key)
      .eq("status", "preview")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingPreview) {
      return json({
        ok: true,
        mode,
        reused_preview: true,
        warning: "No se escribirá en WooCommerce.",
        preview: existingPreview,
      });
    }

    // 5) Construir request_payload simulado (solo campos permitidos)
    const simulatedPayload: Record<string, unknown> = {
      stock_quantity: stock_after_expected,
      manage_stock: true,
    };
    for (const k of Object.keys(simulatedPayload)) {
      if (!ALLOWED_WOO_FIELDS.has(k)) delete simulatedPayload[k];
    }

    // 6) Insertar preview
    const { data: log, error: logErr } = await admin
      .from("core_woo_write_logs")
      .insert({
        action_type,
        mode,
        source_type: "production_unit",
        source_id: (unit as any).id,
        production_unit_id: (unit as any).id,
        production_order_id: (unit as any).production_order_id,
        core_product_id: (unit as any).core_product_id,
        core_variant_id: (unit as any).core_variant_id,
        woo_product_id: (product as any)?.woo_product_id ?? null,
        woo_variation_id: (variant as any)?.woo_variation_id ?? null,
        sku: (unit as any).sku,
        variant_sku: (unit as any).variant_sku,
        stock_before,
        quantity_delta:
          action_type === "stock_set" ? null : (action_type === "stock_decrease" ? -quantity : quantity),
        stock_after_expected,
        request_payload: {
          target: (variant as any)?.woo_variation_id
            ? `products/${(product as any)?.woo_product_id}/variations/${(variant as any)?.woo_variation_id}`
            : `products/${(product as any)?.woo_product_id}`,
          method: "PUT",
          body: simulatedPayload,
        },
        status: "preview",
        idempotency_key,
        created_by: userId,
      })
      .select()
      .single();

    if (logErr) return json({ error: logErr.message }, 500);

    return json({
      ok: true,
      mode,
      warning: "No se escribirá en WooCommerce.",
      preview: log,
    });
  } catch (e: any) {
    return json({ error: e?.message ?? String(e) }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
