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
const INVENTORY_PREVIEW_TTL_MINUTES = 15;

function previewGeneratedAt(log: any): number | null {
  const raw = log?.request_payload?.preview_generated_at ?? log?.created_at ?? null;
  if (!raw) return null;
  const t = new Date(raw).getTime();
  return isNaN(t) ? null : t;
}

function isPreviewExpired(log: any): boolean {
  const t = previewGeneratedAt(log);
  if (t === null) return true;
  return Date.now() - t >= INVENTORY_PREVIEW_TTL_MINUTES * 60000;
}

async function fetchWooStock(endpoint: string, auth: string): Promise<{ ok: boolean; stock: number; body: any; status: number }> {
  const r = await fetch(endpoint, { headers: { Authorization: auth, "Content-Type": "application/json" } });
  const body = await r.json();
  return { ok: r.ok, stock: Number(body?.stock_quantity ?? 0), body, status: r.status };
}

interface Body {
  production_unit_id?: string;
  action_type?: "stock_increase" | "stock_decrease" | "stock_set";
  quantity?: number;
  action?: "preview" | "confirm" | "regenerate";
  preview_log_id?: string; // requerido en confirm / regenerate
  preview_source?: string; // generated_on_confirm | regenerated | manual_preview

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
    // ACTION: REGENERATE (actualiza la MISMA entrada preparada con stock Woo actual)
    // ============================================================
    if (action === "regenerate") {
      if (!body.preview_log_id) return json({ error: "preview_log_id required" }, 400);

      const { data: preview, error: pErr } = await admin
        .from("core_woo_write_logs")
        .select("*")
        .eq("id", body.preview_log_id)
        .maybeSingle();
      if (pErr || !preview) return json({ error: "Entrada preparada no encontrada" }, 404);
      if (preview.status !== "preview") {
        return json({
          error:
            preview.status === "confirmed" || preview.status === "success"
              ? "Esta entrada ya fue confirmada. No se puede actualizar."
              : `La entrada está en estado '${preview.status}' y no puede actualizarse.`,
        }, 409);
      }

      const ck = Deno.env.get("WC_CONSUMER_KEY");
      const cs = Deno.env.get("WC_CONSUMER_SECRET");
      if (!ck || !cs) return json({ error: "Faltan credenciales WooCommerce." }, 500);
      if (!preview.woo_product_id) return json({ error: "Falta woo_product_id" }, 400);

      const endpoint = preview.woo_variation_id
        ? `${WC_BASE}/products/${preview.woo_product_id}/variations/${preview.woo_variation_id}`
        : `${WC_BASE}/products/${preview.woo_product_id}`;
      const auth = "Basic " + btoa(`${ck}:${cs}`);

      let live: { ok: boolean; stock: number; body: any; status: number };
      try {
        live = await fetchWooStock(endpoint, auth);
      } catch (e: any) {
        return json({ error: `Error consultando Woo: ${e?.message ?? String(e)}` }, 502);
      }
      if (!live.ok) return json({ error: `GET Woo falló: ${live.status}`, details: live.body }, 502);

      const delta = Number(preview.quantity_delta ?? 1);
      const newExpected =
        preview.action_type === "stock_set" ? Number(preview.stock_after_expected ?? 0) : live.stock + delta;

      const { data: updated, error: uErr } = await admin
        .from("core_woo_write_logs")
        .update({
          stock_before: live.stock,
          stock_after_expected: newExpected,
          error_message: null,
          request_payload: {
            ...(preview.request_payload ?? {}),
            target: endpoint,
            method: "PUT",
            body: { stock_quantity: newExpected, manage_stock: true },
            preview_generated_at: new Date().toISOString(),
            woo_stock_checked_before_at: new Date().toISOString(),
            preview_source: "regenerated",
            regenerated_by: userId,

          },
        })
        .eq("id", preview.id)
        .eq("status", "preview")
        .select()
        .single();
      if (uErr) return json({ error: uErr.message }, 500);

      // Sincronizar caché local
      if (preview.core_variant_id) {
        await admin.from("core_product_variants").update({ woo_stock_quantity: live.stock }).eq("id", preview.core_variant_id);
      } else if (preview.core_product_id) {
        await admin.from("core_products").update({ woo_stock_quantity: live.stock }).eq("id", preview.core_product_id);
      }

      return json({ ok: true, mode, regenerated: true, preview: updated });
    }

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
      // Vencimiento: nunca escribir con un snapshot viejo.
      if (isPreviewExpired(preview)) {
        return json({
          ok: false,
          expired_preview: true,
          message:
            `Esta entrada fue preparada hace más de ${INVENTORY_PREVIEW_TTL_MINUTES} minutos. ` +
            `Actualiza el stock esperado para usar el stock Woo actual antes de confirmar.`,
        }, 409);
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

      // Recalcular status real desde procesos antes de validar.
      // Esto corrige unidades que quedaron en 'in_production' por una reimpresión
      // u otro update con estado local stale, pero cuyos procesos están todos completed/skipped.
      if (unit.status !== "completed") {
        const { data: procs } = await admin
          .from("core_production_unit_processes")
          .select("status")
          .eq("production_unit_id", unit.id);
        const list = procs || [];
        const allDone = list.length > 0 && list.every((p: any) => p.status === "completed" || p.status === "skipped");
        if (allDone) {
          await admin.from("core_production_units").update({ status: "completed" }).eq("id", unit.id);
          unit.status = "completed";
        }
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
      let wooCheckedBeforeAt: string | null = null;
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
          return json({
            error: "No se pudo consultar el stock actual de WooCommerce. No se ingresó la prenda.",
            woo_unavailable: true,
            details: getRespBody,
          }, 502);
        }
        realStockBefore = Number(getRespBody?.stock_quantity ?? 0);
        wooCheckedBeforeAt = new Date().toISOString();

      } catch (e: any) {
        await admin.from("core_woo_write_logs").update({
          status: "failed",
          error_message: `Error consultando Woo: ${e?.message ?? String(e)}`,
        }).eq("id", preview.id);
        return json({
          error: "No se pudo consultar el stock actual de WooCommerce. No se ingresó la prenda.",
          woo_unavailable: true,
          details: e?.message ?? String(e),
        }, 502);
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

      const confirmedAt = new Date().toISOString();
      const previewSource =
        (preview.request_payload as any)?.preview_source ?? "reused_valid_preview";
      await admin.from("core_woo_write_logs").update({
        status: "confirmed",
        confirmed_by: userId,
        confirmed_at: confirmedAt,
        request_payload: {
          ...((preview.request_payload as any) ?? {}),
          target: endpoint,
          method: "PUT",
          body: writeBody,
          preview_source: previewSource,
          woo_stock_checked_before_at: wooCheckedBeforeAt,
          confirmed_at: confirmedAt,
        },
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

      // 8) Verificación post-escritura: releer stock real en Woo y comparar con esperado.
      let verifiedStock: number | null = null;
      let verifyError: string | null = null;
      try {
        const vResp = await fetch(endpoint, { headers: { Authorization: auth } });
        const vBody = await vResp.json();
        if (vResp.ok) verifiedStock = Number(vBody?.stock_quantity ?? NaN);
        else verifyError = `GET verificación falló: ${vResp.status}`;
      } catch (e: any) {
        verifyError = e?.message ?? String(e);
      }
      if (verifiedStock !== null && Number.isNaN(verifiedStock)) verifiedStock = null;

      const wooCheckedAfterAt = new Date().toISOString();
      const stockReal = verifiedStock ?? confirmedStock;
      const verified = verifyError === null && stockReal === newStock;

      await admin.from("core_woo_write_logs").update({
        ...(verifiedStock !== null && verifiedStock !== confirmedStock
          ? { stock_after_confirmed: verifiedStock }
          : {}),
        request_payload: {
          ...((preview.request_payload as any) ?? {}),
          target: endpoint,
          method: "PUT",
          body: writeBody,
          preview_source: previewSource,
          woo_stock_checked_before_at: wooCheckedBeforeAt,
          woo_stock_checked_after_at: wooCheckedAfterAt,
          confirmed_at: confirmedAt,
        },
      }).eq("id", preview.id);

      return json({
        ok: true,
        mode,
        confirmed: true,
        stock_after_confirmed: confirmedStock,
        verification: {
          verified,
          verify_error: verifyError,
          preview_source: previewSource,
          woo_stock_checked_before_at: wooCheckedBeforeAt,
          woo_stock_checked_after_at: wooCheckedAfterAt,
          confirmed_at: confirmedAt,
          unit_code: preview.unit_code ?? null,
          sku: preview.variant_sku ?? preview.sku ?? null,

          size: preview.size ?? null,
          woo_product_id: preview.woo_product_id ?? null,
          woo_variation_id: preview.woo_variation_id ?? null,
          stock_before: realStockBefore,
          delta: newStock - realStockBefore,
          stock_expected: newStock,
          stock_real: stockReal,
          difference: stockReal - newStock,
          checked_at: new Date().toISOString(),
        },
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
        "id, unit_code, status, production_order_id, core_product_id, core_variant_id, sku, variant_sku, inventory_variant_override_enabled, inventory_override_variant_id, inventory_override_variant_sku",
      )
      .eq("id", body.production_unit_id)
      .maybeSingle();
    if (unitErr || !unit) return json({ error: "Unidad no encontrada" }, 404);

    // Variante efectiva para inventario: override manual (admin/partner) o la original.
    const overrideOn =
      (unit as any).inventory_variant_override_enabled === true &&
      !!(unit as any).inventory_override_variant_id;
    const effVariantId = overrideOn
      ? (unit as any).inventory_override_variant_id
      : (unit as any).core_variant_id;
    const effVariantSku = overrideOn
      ? ((unit as any).inventory_override_variant_sku ?? (unit as any).variant_sku)
      : (unit as any).variant_sku;

    const { data: product } = await admin
      .from("core_products")
      .select("id, woo_product_id, woo_sku, woo_stock_quantity")
      .eq("id", (unit as any).core_product_id)
      .maybeSingle();

    const { data: variant } = effVariantId
      ? await admin
        .from("core_product_variants")
        .select("id, woo_variation_id, woo_sku, woo_stock_quantity, size, variant_label")
        .eq("id", effVariantId)
        .maybeSingle()
      : { data: null as any };

    // === Stock real de WooCommerce (fuente de verdad para el preview) ===
    const consumerKey = Deno.env.get("WC_CONSUMER_KEY");
    const consumerSecret = Deno.env.get("WC_CONSUMER_SECRET");
    const wooProductId = (product as any)?.woo_product_id ?? null;
    const wooVariationId = (variant as any)?.woo_variation_id ?? null;

    let stock_before = Number(
      (variant as any)?.woo_stock_quantity ??
        (product as any)?.woo_stock_quantity ??
        0,
    );
    let usedLiveWoo = false;
    let liveFetchError: string | null = null;
    let wooCheckedBeforeAt: string | null = null;

    if (consumerKey && consumerSecret && wooProductId) {
      const endpoint = wooVariationId
        ? `${WC_BASE}/products/${wooProductId}/variations/${wooVariationId}`
        : `${WC_BASE}/products/${wooProductId}`;
      const auth = "Basic " + btoa(`${consumerKey}:${consumerSecret}`);
      try {
        const r = await fetch(endpoint, {
          headers: { Authorization: auth, "Content-Type": "application/json" },
        });
        const j = await r.json();
        if (r.ok) {
          stock_before = Number(j?.stock_quantity ?? 0);
          usedLiveWoo = true;
          wooCheckedBeforeAt = new Date().toISOString();
          // Sincronizar caché local para que la UI no muestre valores viejos
          if (wooVariationId && (unit as any).core_variant_id) {
            await admin
              .from("core_product_variants")
              .update({ woo_stock_quantity: stock_before })
              .eq("id", (unit as any).core_variant_id);
          } else if ((unit as any).core_product_id) {
            await admin
              .from("core_products")
              .update({ woo_stock_quantity: stock_before })
              .eq("id", (unit as any).core_product_id);
          }
        } else {
          liveFetchError = `GET Woo ${r.status}`;
        }
      } catch (e: any) {
        liveFetchError = e?.message ?? String(e);
      }
    } else {
      liveFetchError = !wooProductId
        ? "Falta woo_product_id"
        : "Faltan credenciales WooCommerce";
    }

    // BLINDAJE: nunca preparar una entrada con stock cacheado.
    // Sin lectura real de Woo no se puede ingresar la prenda.
    if (!usedLiveWoo) {
      return json({
        error: "No se pudo consultar el stock actual de WooCommerce. No se ingresó la prenda.",
        woo_unavailable: true,
        details: liveFetchError,
      }, 502);
    }



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
          woo_product_id: wooProductId,
          woo_variation_id: wooVariationId,
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

    // Si hay una entrada preparada activa, SIEMPRE se actualiza la misma fila
    // (nunca se duplica): se refrescan snapshot de stock y marca de tiempo.
    const { data: existingPreview } = await admin
      .from("core_woo_write_logs")
      .select("*")
      .eq("idempotency_key", idempotency_key)
      .eq("status", "preview")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingPreview) {
      const targetPath = wooVariationId
        ? `products/${wooProductId}/variations/${wooVariationId}`
        : `products/${wooProductId}`;
      const { data: refreshed } = await admin
        .from("core_woo_write_logs")
        .update({
          stock_before,
          stock_after_expected,
          error_message: null,
          request_payload: {
            ...((existingPreview as any).request_payload ?? {}),
            target: targetPath,
            method: "PUT",
            body: { stock_quantity: stock_after_expected, manage_stock: true },
            preview_generated_at: new Date().toISOString(),
            woo_stock_checked_before_at: wooCheckedBeforeAt,
            preview_source: body.preview_source ?? "regenerated",
          },

        })
        .eq("id", (existingPreview as any).id)
        .eq("status", "preview")
        .select()
        .maybeSingle();

      return json({
        ok: true,
        mode,
        reused_preview: true,
        regenerated: usedLiveWoo,
        warning: mode === "dry_run" ? "No se escribirá en WooCommerce." : "Entrada preparada lista para confirmar.",
        live_woo: usedLiveWoo,
        live_fetch_error: liveFetchError,
        preview: refreshed ?? existingPreview,
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
          preview_generated_at: new Date().toISOString(),
          woo_stock_checked_before_at: wooCheckedBeforeAt,
          preview_source: body.preview_source ?? "manual_preview",
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
