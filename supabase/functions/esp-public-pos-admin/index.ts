import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const admin = createClient(SUPABASE_URL, SERVICE_KEY);

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function slugify(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401);
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: claims, error: authErr } = await userClient.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (authErr || !claims?.claims?.sub) return json({ error: 'unauthorized' }, 401);
    const userId = claims.claims.sub as string;

    const { data: rolesData } = await admin.from('user_roles').select('role').eq('user_id', userId);
    const roles = (rolesData || []).map((r: any) => r.role);
    if (!roles.includes('admin') && !roles.includes('manager')) return json({ error: 'forbidden' }, 403);

    const { action, location_id, slug: rawSlug, pin, enabled } = await req.json();
    if (!action || !location_id) return json({ error: 'invalid' }, 400);

    const { data: loc } = await admin.from('esp_locations').select('id,name,public_pos_slug,public_pos_token').eq('id', location_id).maybeSingle();
    if (!loc) return json({ error: 'not_found' }, 404);

    const update: Record<string, unknown> = {};

    if (action === 'enable') {
      const slug = (rawSlug ? slugify(rawSlug) : loc.public_pos_slug) || slugify(loc.name) || `sede-${loc.id.slice(0, 8)}`;
      update.public_pos_slug = slug;
      update.public_pos_enabled = true;
      if (!loc.public_pos_token) {
        update.public_pos_token = randomToken();
        update.public_pos_created_at = new Date().toISOString();
      }
    } else if (action === 'disable') {
      update.public_pos_enabled = false;
    } else if (action === 'regenerate_token') {
      update.public_pos_token = randomToken();
      update.public_pos_created_at = new Date().toISOString();
    } else if (action === 'set_slug') {
      if (!rawSlug) return json({ error: 'invalid_slug' }, 400);
      update.public_pos_slug = slugify(rawSlug);
    } else if (action === 'set_pin') {
      update.public_pos_pin = pin ? String(pin) : null;
    } else if (action === 'set_enabled') {
      update.public_pos_enabled = !!enabled;
    } else {
      return json({ error: 'unknown_action' }, 400);
    }

    const { data: updated, error } = await admin.from('esp_locations').update(update).eq('id', location_id).select('*').maybeSingle();
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true, location: updated });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
