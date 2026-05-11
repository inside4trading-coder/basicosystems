import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const BASE = "https://basicoclothes.com/wp-json/wc-analytics";

async function wcStats(after: string, before: string) {
  const WC_KEY = Deno.env.get("WC_CONSUMER_KEY")!;
  const WC_SECRET = Deno.env.get("WC_CONSUMER_SECRET")!;
  const qs = new URLSearchParams({
    consumer_key: WC_KEY,
    consumer_secret: WC_SECRET,
    after,
    before,
    interval: "day",
    per_page: "1",
  });
  const res = await fetch(`${BASE}/reports/revenue/stats?${qs}`);
  const body = await res.json();
  const t = body?.totals || {};
  return {
    total_sales: Number(t.total_sales || 0),
    net_revenue: Number(t.net_revenue || 0),
    gross_sales: Number(t.gross_sales || 0),
    orders_count: Number(t.orders_count || 0),
    num_items_sold: Number(t.num_items_sold || 0),
    avg_order_value: Number(t.avg_order_value || 0),
    coupons: Number(t.coupons || 0),
    shipping: Number(t.shipping || 0),
    refunds: Number(t.refunds || 0),
    taxes: Number(t.taxes || 0),
  };
}

function toISO(d: Date) {
  return d.toISOString().replace(/\.\d{3}Z$/, "");
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const startStr = url.searchParams.get("start");
    const endStr = url.searchParams.get("end");
    if (!startStr || !endStr) throw new Error("start and end are required (YYYY-MM-DD)");

    const start = new Date(`${startStr}T00:00:00`);
    const end = new Date(`${endStr}T23:59:59`);

    // "Período anterior" = mismo rango desplazado 1 mes atrás (intermensual, igual que WooCommerce)
    const prevStart = new Date(start); prevStart.setMonth(prevStart.getMonth() - 1);
    const prevEnd = new Date(end); prevEnd.setMonth(prevEnd.getMonth() - 1);

    const yoyStart = new Date(start); yoyStart.setFullYear(yoyStart.getFullYear() - 1);
    const yoyEnd = new Date(end); yoyEnd.setFullYear(yoyEnd.getFullYear() - 1);

    const [current, prev, yoy] = await Promise.all([
      wcStats(toISO(start), toISO(end)),
      wcStats(toISO(prevStart), toISO(prevEnd)),
      wcStats(toISO(yoyStart), toISO(yoyEnd)),
    ]);

    return new Response(JSON.stringify({
      current, prev, yoy,
      ranges: {
        current: { start: toISO(start), end: toISO(end) },
        prev: { start: toISO(prevStart), end: toISO(prevEnd) },
        yoy: { start: toISO(yoyStart), end: toISO(yoyEnd) },
      },
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
