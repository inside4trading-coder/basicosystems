// SOLO LECTURA: trae el catálogo completo de la tienda Woo de Sublime y lo
// guarda en la tabla espejo sublime_woo_catalog. Nunca escribe en Woo y nunca
// toca sublime_products / sublime_variants / sublime_stocks.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { authorizeAction } from "../_shared/authz.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function wooConfig() {
  const key = Deno.env.get("WC_SUBLIME_CONSUMER_KEY");
  const secret = Deno.env.get("WC_SUBLIME_CONSUMER_SECRET");
  const baseRaw = (Deno.env.get("WC_SUBLIME_BASE_URL") || "").trim();
  if (!key || !secret || !baseRaw) return null;
  const withProto = /^https?:\/\//i.test(baseRaw) ? baseRaw : `https://${baseRaw}`;
  return { key, secret, base: `${withProto.replace(/\/+$/, "")}/wp-json/wc/v3` };
}

async function wcFetchAll(cfg: NonNullable<ReturnType<typeof wooConfig>>, path: string, params: Record<string, string> = {}) {
  const out: any[] = [];
  let page = 1;
  for (;;) {
    const qs = new URLSearchParams({ per_page: "100", page: String(page), ...params });
    const res = await fetch(`${cfg.base}${path}?${qs}`, {
      headers: { Authorization: `Basic ${btoa(`${cfg.key}:${cfg.secret}`)}` },
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Woo ${res.status}: ${text.slice(0, 200)}`);
    const data = JSON.parse(text);
    if (!Array.isArray(data)) break;
    out.push(...data);
    const totalPages = Number(res.headers.get("X-WP-TotalPages") ?? "1");
    if (page >= totalPages || data.length === 0) break;
    page++;
  }
  return out;
}

function pickSizeColor(attrs: any[]): { size: string | null; color: string | null } {
  let size: string | null = null;
  let color: string | null = null;
  for (const a of Array.isArray(attrs) ? attrs : []) {
    const name = String(a?.name ?? "").toLowerCase();
    const option = a?.option ? String(a.option) : null;
    if (!option) continue;
    if (!size && (name.includes("talla") || name.includes("size") || name.includes("tama"))) size = option;
    if (!color && name.includes("color")) color = option;
  }
  return { size, color };
}

const num = (v: unknown) => {
  const n = Number(v);
  return v === "" || v == null || !Number.isFinite(n) ? null : n;
};

const ACTIVE = ["queued", "fetching_woo", "matching"];
const JOBS = "sublime_woo_read_jobs";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const { result, admin } = await authorizeAction(req, "sublime.manage", "sublime.woo.catalog_read");
  if (!result.ok) return json({ error: result.errorCode, message: result.message }, result.status);

  const cfg = wooConfig();
  if (!cfg) return json({ error: "woo_not_configured", message: "Faltan las credenciales de la tienda Woo de Sublime." }, 400);

  // Un solo job activo a la vez.
  const { data: active } = await admin.from(JOBS).select("*").in("status", ACTIVE).limit(1).maybeSingle();
  if (active) return json({ ok: true, already_running: true, job: active }, 200);

  const { data: job, error: jobErr } = await admin
    .from(JOBS)
    .insert({ status: "queued", started_at: new Date().toISOString() })
    .select("*")
    .single();
  if (jobErr) {
    if ((jobErr as any).code === "23505") {
      const { data: other } = await admin.from(JOBS).select("*").in("status", ACTIVE).limit(1).maybeSingle();
      return json({ ok: true, already_running: true, job: other }, 200);
    }
    return json({ error: "job_create_failed", message: jobErr.message }, 500);
  }

  const run = processCatalog(admin, cfg, job.id).catch(async (e) => {
    await admin
      .from(JOBS)
      .update({ status: "failed", error_message: (e as Error).message, finished_at: new Date().toISOString() })
      .eq("id", job.id);
  });
  // El trabajo continúa aunque el usuario cierre la pantalla o el navegador.
  (globalThis as any).EdgeRuntime?.waitUntil?.(run);

  return json({ ok: true, started: true, job }, 202);
});

async function processCatalog(admin: any, cfg: NonNullable<ReturnType<typeof wooConfig>>, jobId: string) {
  const setJob = (patch: Record<string, unknown>) => admin.from(JOBS).update(patch).eq("id", jobId);
  const fail = async (message: string) => {
    await setJob({ status: "failed", error_message: message, finished_at: new Date().toISOString() });
  };

  await setJob({ status: "fetching_woo" });

  let products: any[];
  try {
    products = await wcFetchAll(cfg, "/products", { status: "any" });
  } catch (e) {
    return await fail((e as Error).message);
  }
  await setJob({ total_items: products.length });

  const now = new Date().toISOString();
  const rows: any[] = [];
  let variationsCount = 0;

  let processed = 0;
  for (const p of products) {
    const img = Array.isArray(p.images) && p.images[0]?.src ? String(p.images[0].src) : null;

    rows.push({
      woo_product_id: Number(p.id),
      woo_variation_id: null,
      parent_id: null,
      woo_type: p.type ?? null,
      name: String(p.name ?? ""),
      sku: (p.sku ?? "").toString().trim() || null,
      size_label: null,
      color_label: null,
      attributes: p.attributes ?? null,
      price: num(p.price),
      regular_price: num(p.regular_price),
      stock_quantity: p.stock_quantity ?? null,
      stock_status: p.stock_status ?? null,
      woo_status: p.status ?? null,
      image_url: img,
      permalink: p.permalink ?? null,
      raw: { id: p.id, categories: p.categories?.map((c: any) => c.name) ?? [], variations: p.variations ?? [] },
      last_read_at: now,
    });
    if (p.type === "variable") {
      let vars: any[] = [];
      try {
        vars = await wcFetchAll(cfg, `/products/${p.id}/variations`, { status: "any" });
      } catch (e) {
        return json({ error: "woo_variations_failed", message: (e as Error).message, woo_product_id: p.id }, 502);
      }
      for (const v of vars) {
        const { size, color } = pickSizeColor(v.attributes);
        variationsCount++;
        rows.push({
          woo_product_id: Number(p.id),
          woo_variation_id: Number(v.id),
          parent_id: Number(p.id),
          woo_type: "variation",
          name: String(p.name ?? ""),
          sku: (v.sku ?? "").toString().trim() || null,
          size_label: size,
          color_label: color,
          attributes: v.attributes ?? null,
          price: num(v.price),
          regular_price: num(v.regular_price),
          stock_quantity: v.stock_quantity ?? null,
          stock_status: v.stock_status ?? null,
          woo_status: v.status ?? null,
          image_url: v.image?.src ? String(v.image.src) : img,
          permalink: v.permalink ?? p.permalink ?? null,
          raw: { id: v.id, parent: p.id },
          last_read_at: now,
        });
      }
    }
  }

  // Upsert por clave (woo_product_id, coalesce(variation,0)): se resuelve en
  // dos pasos porque PostgREST no soporta onConflict sobre índices con expresión.
  const { data: existing, error: exErr } = await admin
    .from("sublime_woo_catalog")
    .select("id, woo_product_id, woo_variation_id");
  if (exErr) return json({ error: "db_read_failed", message: exErr.message }, 500);
  const idByKey = new Map(
    (existing ?? []).map((r: any) => [`${r.woo_product_id}|${r.woo_variation_id ?? 0}`, r.id as string])
  );
  const inserts: any[] = [];
  let updated = 0;
  for (const r of rows) {
    const id = idByKey.get(`${r.woo_product_id}|${r.woo_variation_id ?? 0}`);
    if (id) {
      const { error } = await admin.from("sublime_woo_catalog").update(r).eq("id", id);
      if (error) return json({ error: "db_update_failed", message: error.message }, 500);
      updated++;
    } else inserts.push(r);
  }
  for (let i = 0; i < inserts.length; i += 200) {
    const { error } = await admin.from("sublime_woo_catalog").insert(inserts.slice(i, i + 200));
    if (error) return json({ error: "db_insert_failed", message: error.message }, 500);
  }

  return json({
    ok: true,
    products: products.length,
    variations: variationsCount,
    rows: rows.length,
    inserted: inserts.length,
    updated,
    read_at: now,
  });
});
