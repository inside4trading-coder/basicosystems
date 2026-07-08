import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { slug, token, pin } = await req.json();
    if (!slug || !token) {
      return json({ error: 'invalid' }, 400);
    }
    const { data: loc } = await admin
      .from('esp_locations')
      .select('id,name,public_pos_enabled,public_pos_token,public_pos_pin')
      .eq('public_pos_slug', slug)
      .maybeSingle();

    if (!loc || !loc.public_pos_enabled || !loc.public_pos_token || loc.public_pos_token !== token) {
      return json({ error: 'invalid' }, 401);
    }
    const needsPin = !!loc.public_pos_pin;
    if (needsPin) {
      if (!pin) return json({ needs_pin: true }, 200);
      if (pin !== loc.public_pos_pin) return json({ error: 'invalid_pin' }, 401);
    }

    const { data: pays } = await admin
      .from('esp_payment_methods')
      .select('id,name,key,color,sort_order,location_id,is_active')
      .eq('is_active', true)
      .order('sort_order');

    const paymentMethods = (pays || []).filter((p: any) => !p.location_id || p.location_id === loc.id);

    const { data: channels } = await admin
      .from('esp_sales_channels')
      .select('id,name,key,location_id,is_active')
      .eq('is_active', true);
    const channel = (channels || []).find((c: any) => c.location_id === loc.id) || (channels || [])[0] || null;

    await admin
      .from('esp_locations')
      .update({ public_pos_last_used_at: new Date().toISOString() })
      .eq('id', loc.id);

    return json({
      location: { id: loc.id, name: loc.name },
      payment_methods: paymentMethods.map((p: any) => ({ id: p.id, name: p.name, key: p.key, color: p.color })),
      channel_id: channel?.id || null,
      needs_pin: needsPin,
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
