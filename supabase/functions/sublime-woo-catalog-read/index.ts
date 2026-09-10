// SOLO LECTURA: trae el catálogo completo de la tienda Woo de Sublime y lo
// guarda en la tabla espejo sublime_woo_catalog. Nunca escribe en Woo y nunca
// toca sublime_products / sublime_variants / sublime_stocks.
//
// Procesamiento por LOTES persistentes: cada invocación procesa `batch_size`
// productos (página Woo), guarda el cursor y encadena la siguiente ejecución.
// Así no depende de la pantalla ni del límite de ejecución de una sola llamada.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { authorizeAction } from "../_shared/authz.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const JOBS = "sublime_woo_read_jobs";
const ACTIVE = ["queued", "fetching_woo", "matching"];
/** Un job activo sin latido durante este tiempo se considera interrumpido. */
const STALL_MS = 3 * 60 * 1000;

function wooConfig() {
  const key = Deno.env.get("WC_SUBLIME_CONSUMER_KEY");
  const secret = Deno.env.get("WC_SUBLIME_CONSUMER_SECRET");
  const baseRaw = (Deno.env.get("WC_SUBLIME_BASE_URL") || "").trim();
  if (!key || !secret || !baseRaw) return null;
  const withProto = /^https?:\/\//i.test(baseRaw) ? baseRaw : `https://${baseRaw}`;
  return { key, secret, base: `${withProto.replace(/\/+$/, "")}/wp-json/wc/v3` };
}

type Cfg = NonNullable<ReturnType<typeof wooConfig>>;

async function wcFetch(cfg: Cfg, path: string, params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params);
  const res = await fetch(`${cfg.base}${path}?${qs}`, {
    headers: { Authorization: `Basic ${btoa(`${cfg.key}:${cfg.secret}`)}` },
  });
  const text = await res.text();
  if (!res.ok) {
    const err = new Error(`Woo ${res.status}: ${text.slice(0, 200)}`);
    (err as any).httpStatus = res.status;
    throw err;
  }
  return { data: JSON.parse(text), headers: res.headers };
}

async function wcFetchAllPages(cfg: Cfg, path: string) {
  const out: any[] = [];
  let page = 1;
  for (;;) {
    const { data, headers } = await wcFetch(cfg, path, { per_page: "100", page: String(page), status: "any" });
    if (!Array.isArray(data)) break;
    out.push(...data);
    const totalPages = Number(headers.get("X-WP-TotalPages") ?? "1");
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

function adminClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

function isStalled(job: any) {
  return ACTIVE.includes(job.status) && Date.now() - new Date(job.updated_at).getTime() > STALL_MS;
}

/** Encadena el siguiente lote en una nueva ejecución de la propia función. */
function scheduleNextBatch(jobId: string) {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/sublime-woo-catalog-read`;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const p = fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, "x-internal-key": key },
    body: JSON.stringify({ __batch: jobId }),
  }).catch((e) => console.log(JSON.stringify({ job_id: jobId, chain_error: String(e) })));
  (globalThis as any).EdgeRuntime?.waitUntil?.(p);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const body = await req.json().catch(() => ({} as any));
  const internalKey = req.headers.get("x-internal-key");
  const isInternal = !!body?.__batch && internalKey && internalKey === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  const cfg = wooConfig();

  // ---- Ejecución interna de un lote -------------------------------------
  if (isInternal) {
    if (!cfg) return json({ error: "woo_not_configured" }, 400);
    const admin = adminClient();
    const run = processBatch(admin, cfg, String(body.__batch));
    (globalThis as any).EdgeRuntime?.waitUntil?.(run);
    return json({ ok: true, batch: true }, 202);
  }

  // ---- Llamada del usuario ----------------------------------------------
  const { result, admin } = await authorizeAction(req, "sublime.manage", "sublime.woo.catalog_read");
  if (!result.ok) return json({ error: result.errorCode, message: result.message }, result.status);

  const cancelJobId = typeof body?.cancel_job_id === "string" ? body.cancel_job_id : null;
  if (cancelJobId) {
    const { data: cancelled, error: cancelError } = await admin
      .from(JOBS)
      .update({
        status: "cancelled",
        finished_at: new Date().toISOString(),
        error_message: "Cancelado manualmente.",
      })
      .eq("id", cancelJobId)
      .in("status", ACTIVE)
      .select("*")
      .maybeSingle();
    if (cancelError) return json({ error: "cancel_failed", message: cancelError.message }, 500);
    if (!cancelled) return json({ error: "job_not_active", message: "La actualización ya no está activa." }, 409);
    console.log(JSON.stringify({ job_id: cancelJobId, status: "cancelled", at: new Date().toISOString() }));
    return json({ ok: true, cancelled: true, job: cancelled });
  }

  if (!cfg) return json({ error: "woo_not_configured", message: "Faltan las credenciales de la tienda Woo de Sublime." }, 400);

  const resume = body?.resume === true;

  const { data: active } = await admin.from(JOBS).select("*").in("status", ACTIVE).limit(1).maybeSingle();
  if (active) {
    if (resume || isStalled(active)) {
      await admin.from(JOBS).update({ status: "fetching_woo", error_message: null }).eq("id", active.id);
      scheduleNextBatch(active.id);
      return json({ ok: true, resumed: true, job: active }, 202);
    }
    return json({ ok: true, already_running: true, job: active }, 200);
  }

  if (resume) {
    const { data: last } = await admin
      .from(JOBS)
      .select("*")
      .eq("status", "failed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (last) {
      await admin.from(JOBS).update({ status: "fetching_woo", error_message: null, finished_at: null }).eq("id", last.id);
      scheduleNextBatch(last.id);
      return json({ ok: true, resumed: true, job: last }, 202);
    }
  }

  const { data: job, error: jobErr } = await admin
    .from(JOBS)
    .insert({ status: "fetching_woo", started_at: new Date().toISOString(), cursor_page: 1, processed_items: 0, error_items: [] })
    .select("*")
    .single();
  if (jobErr) {
    if ((jobErr as any).code === "23505") {
      const { data: other } = await admin.from(JOBS).select("*").in("status", ACTIVE).limit(1).maybeSingle();
      return json({ ok: true, already_running: true, job: other }, 200);
    }
    return json({ error: "job_create_failed", message: jobErr.message }, 500);
  }

  scheduleNextBatch(job.id);
  return json({ ok: true, started: true, job }, 202);
});

async function processBatch(admin: any, cfg: Cfg, jobId: string) {
  const setJob = (patch: Record<string, unknown>) => admin.from(JOBS).update(patch).eq("id", jobId);
  const fail = async (message: string) => {
    console.log(JSON.stringify({ job_id: jobId, status: "failed", error: message, at: new Date().toISOString() }));
    await setJob({ status: "failed", error_message: message, finished_at: new Date().toISOString() });
  };

  const { data: job, error: jobErr } = await admin.from(JOBS).select("*").eq("id", jobId).maybeSingle();
  if (jobErr || !job) return;
  if (!ACTIVE.includes(job.status)) return;

  const page = Math.max(1, Number(job.cursor_page) || 1);
  const perPage = Math.min(50, Math.max(10, Number(job.batch_size) || 25));
  const processedBefore = Number(job.processed_items) || 0;
  const errorItems: any[] = Array.isArray(job.error_items) ? job.error_items : [];

  let products: any[] = [];
  let totalItems = Number(job.total_items) || 0;
  let totalPages = 1;
  try {
    const { data, headers } = await wcFetch(cfg, "/products", { per_page: String(perPage), page: String(page), status: "any" });
    products = Array.isArray(data) ? data : [];
    totalItems = Number(headers.get("X-WP-Total") ?? totalItems) || totalItems;
    totalPages = Number(headers.get("X-WP-TotalPages") ?? "1") || 1;
  } catch (e) {
    return await fail(`${(e as Error).message} (página ${page})`);
  }

  const now = new Date().toISOString();
  const rows: any[] = [];

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
        vars = await wcFetchAllPages(cfg, `/products/${p.id}/variations`);
      } catch (e) {
        // Un producto con error no bloquea la actualización completa.
        errorItems.push({
          woo_product_id: Number(p.id),
          http_status: (e as any).httpStatus ?? null,
          error: (e as Error).message,
          at: new Date().toISOString(),
        });
        console.log(JSON.stringify({ job_id: jobId, page, woo_product_id: p.id, error: (e as Error).message }));
        continue;
      }
      for (const v of vars) {
        const { size, color } = pickSizeColor(v.attributes);
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

  // Upsert por clave (woo_product_id, coalesce(variation,0)): dos pasos porque
  // PostgREST no soporta onConflict sobre índices con expresión.
  if (rows.length) {
    const ids = [...new Set(rows.map((r) => r.woo_product_id))];
    const { data: existing, error: exErr } = await admin
      .from("sublime_woo_catalog")
      .select("id, woo_product_id, woo_variation_id")
      .in("woo_product_id", ids);
    if (exErr) return await fail(exErr.message);
    const idByKey = new Map(
      (existing ?? []).map((r: any) => [`${r.woo_product_id}|${r.woo_variation_id ?? 0}`, r.id as string]),
    );
    const inserts: any[] = [];
    for (const r of rows) {
      const id = idByKey.get(`${r.woo_product_id}|${r.woo_variation_id ?? 0}`);
      if (id) {
        const { error } = await admin.from("sublime_woo_catalog").update(r).eq("id", id);
        if (error) return await fail(error.message);
      } else inserts.push(r);
    }
    for (let i = 0; i < inserts.length; i += 200) {
      const { error } = await admin.from("sublime_woo_catalog").insert(inserts.slice(i, i + 200));
      if (error) return await fail(error.message);
    }
  }

  const processedAfter = processedBefore + products.length;
  console.log(
    JSON.stringify({
      job_id: jobId,
      page,
      items_received: products.length,
      processed_before: processedBefore,
      processed_after: processedAfter,
      total_items: totalItems,
      at: new Date().toISOString(),
    }),
  );

  const done = products.length === 0 || page >= totalPages;
  await setJob({
    status: done ? "matching" : "fetching_woo",
    cursor_page: page + 1,
    processed_items: processedAfter,
    total_items: totalItems,
    error_items: errorItems,
    error_message: null,
  });

  if (!done) {
    scheduleNextBatch(jobId);
    return;
  }

  await finalize(admin, jobId, processedAfter, totalItems, errorItems);
}

async function finalize(admin: any, jobId: string, processed: number, totalItems: number, errorItems: any[]) {
  const { data: rows } = await admin.from("sublime_woo_catalog").select("woo_product_id, woo_variation_id");
  const { data: maps } = await admin
    .from("sublime_channel_mappings")
    .select("external_product_id, external_variation_id, status")
    .eq("channel", "woo");
  const mapStatus = new Map<string, string>();
  for (const m of maps ?? []) mapStatus.set(`${m.external_product_id}|${m.external_variation_id ?? 0}`, m.status);
  let mapped = 0, ignored = 0, unmapped = 0;
  for (const r of rows ?? []) {
    const s = mapStatus.get(`${r.woo_product_id}|${r.woo_variation_id ?? 0}`);
    if (s === "mapped") mapped++;
    else if (s === "ignored") ignored++;
    else unmapped++;
  }

  await admin
    .from(JOBS)
    .update({
      status: "completed",
      finished_at: new Date().toISOString(),
      total_items: totalItems,
      processed_items: processed,
      mapped_count: mapped,
      ignored_count: ignored,
      unmapped_count: unmapped,
      possible_match_count: 0,
      incomplete_count: 0,
      error_items: errorItems,
      error_message: errorItems.length ? `${errorItems.length} producto(s) con error de lectura.` : null,
    })
    .eq("id", jobId);
}
