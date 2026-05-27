// BLOQUE 13 — Capa segura de escritura WooCommerce.
// Soporta:
//   - action: "preview" (dry_run) → solo simula y guarda preview.
//   - action: "confirm" (manual_confirm) → re-lee stock real y escribe.
// Campos permitidos: stock_quantity, manage_stock, stock_status.
// Prohibido: nombre, precio, descripción, imágenes, categorías, pedidos, etc.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_WOO_FIELDS = new Set(["stock_quantity", "manage_stock", "stock_status"]);
const WC_BASE = "https://basicoclothes.com/wp-json/wc/v3";

interface Body {
  production_unit_id?: string;
  action_type?: "stock_increase" | "stock_decrease" | "stock_set";
  quantity?: number;
  action?: "preview" | "confirm";
  preview_log_id?: string; // requerido en confirm
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    const userId = userRes?.user?.id ?? null;
    if (!userId) return json({ error: "unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roleSet = new Set((roles ?? []).map((r: any) => r.role));
    if (!roleSet.has("admin") && !roleSet.has("manager")) {
      return json({ error: "forbidden" }, 403);
    }

    const body: Body = await req.json().catch(() => ({}));
    const action = body.action ?? "preview";

    // Modo actual
    const { data: settings } = await admin
      .from("core_settings")
      .select("id, woo_write_mode")
      .limit(1)
      .maybeSingle();
    const mode: string = (settings as any)?.woo_write_mode ?? "dry_run";

    if (mode === "off") return json({ error: "woo_write_mode=off — escritura deshabilitada" }, 423);

    // ============================================================
    // ACTION: CONFIRM (manual_confirm — escritura real con re-read)
    // ============================================================
    if (action === "confirm") {
      if (mode !== "manual_confirm") {
        return json({ error: `Modo ${mode} no permite confirmar escritura. Cambia a manual_confirm.` }, 423);
      }
      if (!roleSet.has("admin") && !roleSet.has("manager")) {
        return json({ error: "forbidden" }, 403);
      }
      if (!body.preview_log_id) return json({ error: "preview_log_id required" }, 400);

      // Cargar preview
      const { data: preview, error: pErr } = await admin
        .from("core_woo_write_logs")
        .select("*")
        .eq("id", body.preview_log_id)
        .maybeSingle();
      if (pErr || !preview) return json({ error: "Preview no encontrado" }, 404);
      if (preview.status !== "preview") {
        return json({ error: `Preview ya está en estado '${preview.status}'.` }, 409);
      }
      if (preview.action_type !== "stock_increase") {
        return json({ error: "Solo stock_increase está habilitado en manual_confirm." }, 400);
      }
      if (Number(preview.quantity_delta) !== 1) {
        return json({ error: "Solo +1 por unidad está permitido." }, 400);
      }

      // Idempotencia fuerte
      const { data: active } = await admin
        .from("core_woo_write_logs")
        .select("id, status")
        .eq("idempotency_key", preview.idempotency_key)
        .in("status", ["confirmed", "success"])
        .neq("id", preview.id)
        .limit(1)
        .maybeSingle();
      if (active) {
        return json({
          ok: false,
          skipped: true,
          message: "Esta unidad ya fue ingresada o confirmada. No se puede duplicar.",
        }, 409);
      }

      // Cargar unidad
      const { data: unit } = await admin
        .from("core_production_units")
        .select("id, unit_code, status")
        .eq("id", preview.production_unit_id)
        .maybeSingle();
      if (!unit) return json({ error: "Unidad no encontrada" }, 404);
      if (unit.status === "entered_inventory") {
        return json({ ok: false, skipped: true, message: "Unidad ya marcada como entered_inventory." }, 409);
      }
      if (unit.status !== "completed") {
        return json({ error: `Unidad debe estar en completed. Estado actual: ${unit.status}` }, 409);
      }
      if (!preview.woo_product_id) return json({ error: "Falta woo_product_id" }, 400);
      if (preview.core_variant_id && !preview.woo_variation_id) {
        return json({ error: "Falta woo_variation_id" }, 400);
      }

      // Credenciales
      const consumerKey = Deno.env.get("WC_CONSUMER_KEY");
      const consumerSecret = Deno.env.get("WC_CONSUMER_SECRET");
      if (!consumerKey || !consumerSecret) {
        await admin.from("core_woo_write_logs").update({
          status: "failed",
          error_message: "Faltan credenciales WooCommerce para escritura.",
        }).eq("id", preview.id);
        return json({ error: "Faltan credenciales WooCommerce para escritura." }, 500);
      }
      const auth = "Basic " + btoa(`${consumerKey}:${consumerSecret}`);

      const endpoint = preview.woo_variation_id
        ? `${WC_BASE}/products/${preview.woo_product_id}/variations/${preview.woo_variation_id}`
        : `${WC_BASE}/products/${preview.woo_product_id}`;

      // 1) Re-leer stock real
      let realStockBefore: number;
      let getRespBody: any = null;
      try {
        const getResp = await fetch(endpoint, {
          headers: { Authorization: auth, "Content-Type": "application/json" },
        });
        getRespBody = await getResp.json();
        if (!getResp.ok) {
          await admin.from("core_woo_write_logs").update({
            status: "failed",
            error_message: `GET Woo falló: ${getResp.status}`,
            response_payload: getRespBody,
          }).eq("id", preview.id);
          return json({ error: `GET Woo falló: ${getResp.status}`, details: getRespBody }, 502);
        }
        realStockBefore = Number(getRespBody?.stock_quantity ?? 0);
      } catch (e: any) {
        await admin.from("core_woo_write_logs").update({
          status: "failed",
          error_message: `Error consultando Woo: ${e?.message ?? String(e)}`,
        }).eq("id", preview.id);
        return json({ error: `Error consultando Woo: ${e?.message ?? String(e)}` }, 502);
      }

      // 2) Validar que el stock no cambió desde preview
      if (Number(preview.stock_before) !== realStockBefore) {
        await admin.from("core_woo_write_logs").update({
          status: "failed",
          error_message: `stale_preview: stock cambió de ${preview.stock_before} a ${realStockBefore} en Woo.`,
          response_payload: { real_stock_before: realStockBefore, preview_stock_before: preview.stock_before },
        }).eq("id", preview.id);
        return json({
          ok: false,
          stale_preview: true,
          message: "El stock actual de WooCommerce cambió desde el preview. Regenera el preview antes de confirmar.",
          real_stock: realStockBefore,
          preview_stock: preview.stock_before,
        }, 409);
      }

      // 3) Marcar confirmed antes del PUT
      const newStock = realStockBefore + 1;
      const writeBody: Record<string, unknown> = {
        manage_stock: true,
        stock_quantity: newStock,
        stock_status: newStock > 0 ? "instock" : "outofstock",
      };
      for (const k of Object.keys(writeBody)) {
        if (!ALLOWED_WOO_FIELDS.has(k)) delete writeBody[k];
      }

      await admin.from("core_woo_write_logs").update({
        status: "confirmed",
        confirmed_by: userId,
        confirmed_at: new Date().toISOString(),
        request_payload: { target: endpoint, method: "PUT", body: writeBody },
      }).eq("id", preview.id);

      // 4) PUT a Woo
      let putRespBody: any = null;
      let putOk = false;
      try {
        const putResp = await fetch(endpoint, {
          method: "PUT",
          headers: { Authorization: auth, "Content-Type": "application/json" },
          body: JSON.stringify(writeBody),
        });
        putRespBody = await putResp.json();
        putOk = putResp.ok;
        if (!putOk) {
          await admin.from("core_woo_write_logs").update({
            status: "failed",
            error_message: `PUT Woo falló: ${putResp.status}`,
            response_payload: putRespBody,
          }).eq("id", preview.id);
          return json({ error: `PUT Woo falló: ${putResp.status}`, details: putRespBody }, 502);
        }
      } catch (e: any) {
        await admin.from("core_woo_write_logs").update({
          status: "failed",
          error_message: `Error escribiendo en Woo: ${e?.message ?? String(e)}`,
        }).eq("id", preview.id);
        return json({ error: `Error escribiendo en Woo: ${e?.message ?? String(e)}` }, 502);
      }

      const confirmedStock = Number(putRespBody?.stock_quantity ?? newStock);

      // 5) Log success
      await admin.from("core_woo_write_logs").update({
        status: "success",
        response_payload: putRespBody,
        stock_after_confirmed: confirmedStock,
      }).eq("id", preview.id);

      // 6) Marcar unidad entered_inventory
      await admin.from("core_production_units").update({
        status: "entered_inventory",
        updated_by: userId,
        entered_inventory_at: new Date().toISOString(),
        entered_inventory_by: userId,
        inventory_entry_source: "woo_manual_confirm",
      }).eq("id", preview.production_unit_id);

      // 7) Sincronizar stock local de la variante
      if (preview.core_variant_id) {
        await admin.from("core_product_variants").update({
          woo_stock_quantity: confirmedStock,
        }).eq("id", preview.core_variant_id);
      } else if (preview.core_product_id) {
        await admin.from("core_products").update({
          woo_stock_quantity: confirmedStock,
        }).eq("id", preview.core_product_id);
      }

      return json({
        ok: true,
        mode,
        confirmed: true,
        stock_after_confirmed: confirmedStock,
        response: putRespBody,
      });
    }

    // ============================================================
    // ACTION: PREVIEW (dry_run o manual_confirm — solo simula)
    // ============================================================
    const action_type = body.action_type ?? "stock_increase";
    const quantity = Number(body.quantity ?? 1);
    if (!body.production_unit_id) return json({ error: "production_unit_id required" }, 400);
    if (!["stock_increase", "stock_decrease", "stock_set"].includes(action_type)) {
      return json({ error: "invalid action_type" }, 400);
    }

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

    const idempotency_key = `${(unit as any).unit_code}::${action_type}`;

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
        warning: mode === "dry_run" ? "No se escribirá en WooCommerce." : "Preview listo para confirmar.",
        preview: existingPreview,
      });
    }

    const simulatedPayload: Record<string, unknown> = {
      stock_quantity: stock_after_expected,
      manage_stock: true,
    };
    for (const k of Object.keys(simulatedPayload)) {
      if (!ALLOWED_WOO_FIELDS.has(k)) delete simulatedPayload[k];
    }

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
      warning: mode === "dry_run" ? "No se escribirá en WooCommerce." : "Preview listo para confirmar.",
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
