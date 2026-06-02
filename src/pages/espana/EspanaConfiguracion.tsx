import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Plus, Save } from "lucide-react";

interface Settings {
  id: string;
  module_active: boolean;
  country: string;
  currency: string;
  main_city: string | null;
  main_website: string | null;
  data_mode: string;
  woo_status: string;
  woo_connected: boolean;
  interpret_woo_unmanaged_as_made_to_order?: boolean;
  auto_create_fabrication_for_mto?: boolean;
  auto_decrement_web_stock?: boolean;
  web_stock_location_id?: string | null;
}

interface Location {
  id: string;
  name: string;
  code: string;
  type: string;
  city: string | null;
  country: string;
  currency: string;
  is_active: boolean;
  inventory_mode: string;
  connects_to_woo: boolean;
  notes: string | null;
}

interface Channel {
  id: string;
  name: string;
  key: string;
  type: string;
  location_id: string | null;
  is_active: boolean;
}

interface PaymentMethod {
  id: string;
  name: string;
  key: string;
  is_active: boolean;
  sort_order: number;
  color: string | null;
}

export default function EspanaConfiguracion() {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [payments, setPayments] = useState<PaymentMethod[]>([]);

  const reload = async () => {
    setLoading(true);
    const [s, l, c, p] = await Promise.all([
      supabase.from("esp_settings").select("*").limit(1).maybeSingle(),
      supabase.from("esp_locations").select("*").order("name"),
      supabase.from("esp_sales_channels").select("*").order("name"),
      supabase.from("esp_payment_methods").select("*").order("sort_order"),
    ]);
    if (s.data) setSettings(s.data as Settings);
    if (l.data) setLocations(l.data as Location[]);
    if (c.data) setChannels(c.data as Channel[]);
    if (p.data) setPayments(p.data as PaymentMethod[]);
    setLoading(false);
  };
  useEffect(() => { reload(); }, []);

  const saveSettings = async () => {
    if (!settings) return;
    const { error } = await supabase.from("esp_settings").update({
      module_active: settings.module_active,
      country: settings.country,
      currency: settings.currency,
      main_city: settings.main_city,
      main_website: settings.main_website,
      data_mode: settings.data_mode,
      woo_status: settings.woo_status,
      woo_connected: settings.woo_connected,
    }).eq("id", settings.id);
    if (error) toast.error(error.message);
    else toast.success("Configuración guardada");
  };

  if (loading) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Cargando…</div>;
  }

  return (
    <Tabs defaultValue="general" className="space-y-4">
      <TabsList className="flex flex-wrap h-auto">
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="sedes">Sedes / Ubicaciones</TabsTrigger>
        <TabsTrigger value="canales">Canales de venta</TabsTrigger>
        <TabsTrigger value="pagos">Métodos de pago</TabsTrigger>
        <TabsTrigger value="usuarios">Usuarios / Sedes</TabsTrigger>
        <TabsTrigger value="woo">WooCommerce España</TabsTrigger>
      </TabsList>

      {/* GENERAL */}
      <TabsContent value="general">
        <Card className="p-6 rounded-2xl max-w-3xl space-y-5">
          {settings && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-semibold">Estado del módulo</Label>
                  <p className="text-xs text-muted-foreground">Activa o pausa Basico España.</p>
                </div>
                <Switch
                  checked={settings.module_active}
                  onCheckedChange={(v) => setSettings({ ...settings, module_active: v })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>País</Label>
                  <Input value={settings.country} onChange={(e) => setSettings({ ...settings, country: e.target.value })} />
                </div>
                <div>
                  <Label>Moneda principal</Label>
                  <Input value={settings.currency} onChange={(e) => setSettings({ ...settings, currency: e.target.value })} />
                </div>
                <div>
                  <Label>Ciudad base</Label>
                  <Input value={settings.main_city ?? ""} onChange={(e) => setSettings({ ...settings, main_city: e.target.value })} />
                </div>
                <div>
                  <Label>Web principal</Label>
                  <Input value={settings.main_website ?? ""} onChange={(e) => setSettings({ ...settings, main_website: e.target.value })} />
                </div>
                <div>
                  <Label>Modo de datos</Label>
                  <Select value={settings.data_mode} onValueChange={(v) => setSettings({ ...settings, data_mode: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="conectado">Conectado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>WooCommerce España</Label>
                  <div className="flex items-center gap-2 h-10">
                    <Switch checked={settings.woo_connected} onCheckedChange={(v) => setSettings({ ...settings, woo_connected: v, woo_status: v ? "conectado" : "no_conectado" })} />
                    <Badge variant={settings.woo_connected ? "default" : "secondary"}>
                      {settings.woo_connected ? "Conectado" : "No conectado"}
                    </Badge>
                  </div>
                </div>
              </div>
              <Button onClick={saveSettings}><Save className="h-4 w-4 mr-2" />Guardar</Button>
            </>
          )}
        </Card>
      </TabsContent>

      {/* SEDES */}
      <TabsContent value="sedes">
        <SedesPanel locations={locations} reload={reload} />
      </TabsContent>

      {/* CANALES */}
      <TabsContent value="canales">
        <CanalesPanel channels={channels} locations={locations} reload={reload} />
      </TabsContent>

      {/* PAGOS */}
      <TabsContent value="pagos">
        <PagosPanel payments={payments} reload={reload} />
      </TabsContent>

      {/* USUARIOS */}
      <TabsContent value="usuarios">
        <UsuariosPanel locations={locations} />
      </TabsContent>

      {/* WOO */}
      <TabsContent value="woo">
        <WooEspanaPanel settings={settings} onUpdated={reload} />
      </TabsContent>
    </Tabs>
  );
}

/* ----- Sedes ----- */
function SedesPanel({ locations, reload }: { locations: Location[]; reload: () => void }) {
  const [rows, setRows] = useState(locations);
  useEffect(() => setRows(locations), [locations]);

  const updateRow = (id: string, patch: Partial<Location>) => {
    setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  };
  const save = async (row: Location) => {
    const { error } = await supabase.from("esp_locations").update({
      name: row.name, code: row.code, type: row.type, city: row.city,
      is_active: row.is_active, inventory_mode: row.inventory_mode,
      connects_to_woo: row.connects_to_woo, notes: row.notes,
    }).eq("id", row.id);
    if (error) toast.error(error.message); else toast.success("Sede actualizada");
  };
  const addNew = async () => {
    const code = `SEDE_${Date.now()}`;
    const { error } = await supabase.from("esp_locations").insert({
      name: "Nueva sede", code, type: "retail", country: "España", currency: "EUR", inventory_mode: "own_stock",
    });
    if (error) toast.error(error.message); else { toast.success("Sede creada"); reload(); }
  };

  return (
    <Card className="p-5 rounded-2xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold">Sedes / Ubicaciones</h3>
          <p className="text-xs text-muted-foreground">Cada sede puede tener inventario propio, vinculado, sin stock o conectado a WooCommerce.</p>
        </div>
        <Button size="sm" onClick={addNew}><Plus className="h-4 w-4 mr-1" />Nueva sede</Button>
      </div>
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end border-b border-border/50 pb-3">
            <div className="md:col-span-3">
              <Label className="text-xs">Nombre</Label>
              <Input value={row.name} onChange={(e) => updateRow(row.id, { name: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Código</Label>
              <Input value={row.code} onChange={(e) => updateRow(row.id, { code: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Tipo</Label>
              <Input value={row.type} onChange={(e) => updateRow(row.id, { type: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Ciudad</Label>
              <Input value={row.city ?? ""} onChange={(e) => updateRow(row.id, { city: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Inventario</Label>
              <Select value={row.inventory_mode} onValueChange={(v) => updateRow(row.id, { inventory_mode: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="own_stock">Stock propio</SelectItem>
                  <SelectItem value="linked_stock">Vinculado</SelectItem>
                  <SelectItem value="no_stock">Sin stock</SelectItem>
                  <SelectItem value="woo_stock">WooCommerce</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-1 flex flex-col gap-1">
              <Label className="text-xs">Activa</Label>
              <Switch checked={row.is_active} onCheckedChange={(v) => updateRow(row.id, { is_active: v })} />
            </div>
            <div className="md:col-span-12 flex justify-end">
              <Button size="sm" variant="outline" onClick={() => save(row)}>Guardar</Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ----- Canales ----- */
function CanalesPanel({ channels, locations, reload }: { channels: Channel[]; locations: Location[]; reload: () => void }) {
  const [rows, setRows] = useState(channels);
  useEffect(() => setRows(channels), [channels]);

  const update = (id: string, patch: Partial<Channel>) => setRows((r) => r.map((x) => x.id === id ? { ...x, ...patch } : x));
  const save = async (row: Channel) => {
    const { error } = await supabase.from("esp_sales_channels").update({
      name: row.name, key: row.key, type: row.type, location_id: row.location_id, is_active: row.is_active,
    }).eq("id", row.id);
    if (error) toast.error(error.message); else toast.success("Canal actualizado");
  };
  const addNew = async () => {
    const { error } = await supabase.from("esp_sales_channels").insert({
      name: "Nuevo canal", key: `canal_${Date.now()}`, type: "manual",
    });
    if (error) toast.error(error.message); else { toast.success("Canal creado"); reload(); }
  };

  return (
    <Card className="p-5 rounded-2xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold">Canales de venta</h3>
          <p className="text-xs text-muted-foreground">Online, retail, popup o manual. Cada canal puede vincularse a una sede.</p>
        </div>
        <Button size="sm" onClick={addNew}><Plus className="h-4 w-4 mr-1" />Nuevo canal</Button>
      </div>
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end border-b border-border/50 pb-3">
            <div className="md:col-span-3"><Label className="text-xs">Nombre</Label><Input value={row.name} onChange={(e) => update(row.id, { name: e.target.value })} /></div>
            <div className="md:col-span-2"><Label className="text-xs">Key</Label><Input value={row.key} onChange={(e) => update(row.id, { key: e.target.value })} /></div>
            <div className="md:col-span-2"><Label className="text-xs">Tipo</Label><Input value={row.type} onChange={(e) => update(row.id, { type: e.target.value })} /></div>
            <div className="md:col-span-3">
              <Label className="text-xs">Sede</Label>
              <Select value={row.location_id ?? "none"} onValueChange={(v) => update(row.id, { location_id: v === "none" ? null : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Sin sede —</SelectItem>
                  {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-1 flex flex-col gap-1"><Label className="text-xs">Activo</Label><Switch checked={row.is_active} onCheckedChange={(v) => update(row.id, { is_active: v })} /></div>
            <div className="md:col-span-1 flex justify-end"><Button size="sm" variant="outline" onClick={() => save(row)}>Guardar</Button></div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ----- Pagos ----- */
function PagosPanel({ payments, reload }: { payments: PaymentMethod[]; reload: () => void }) {
  const [rows, setRows] = useState(payments);
  useEffect(() => setRows(payments), [payments]);

  const update = (id: string, patch: Partial<PaymentMethod>) => setRows((r) => r.map((x) => x.id === id ? { ...x, ...patch } : x));
  const save = async (row: PaymentMethod) => {
    const { error } = await supabase.from("esp_payment_methods").update({
      name: row.name, key: row.key, is_active: row.is_active, sort_order: row.sort_order, color: row.color,
    }).eq("id", row.id);
    if (error) toast.error(error.message); else toast.success("Método actualizado");
  };
  const addNew = async () => {
    const { error } = await supabase.from("esp_payment_methods").insert({
      name: "Nuevo método", key: `metodo_${Date.now()}`, sort_order: (rows.length + 1),
    });
    if (error) toast.error(error.message); else { toast.success("Método creado"); reload(); }
  };

  return (
    <Card className="p-5 rounded-2xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold">Métodos de pago</h3>
          <p className="text-xs text-muted-foreground">Botones que verá el POS Móvil al cobrar.</p>
        </div>
        <Button size="sm" onClick={addNew}><Plus className="h-4 w-4 mr-1" />Nuevo método</Button>
      </div>
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end border-b border-border/50 pb-3">
            <div className="md:col-span-3"><Label className="text-xs">Nombre</Label><Input value={row.name} onChange={(e) => update(row.id, { name: e.target.value })} /></div>
            <div className="md:col-span-3"><Label className="text-xs">Key</Label><Input value={row.key} onChange={(e) => update(row.id, { key: e.target.value })} /></div>
            <div className="md:col-span-2"><Label className="text-xs">Orden</Label><Input type="number" value={row.sort_order} onChange={(e) => update(row.id, { sort_order: parseInt(e.target.value) || 0 })} /></div>
            <div className="md:col-span-2"><Label className="text-xs">Color</Label><Input type="color" value={row.color ?? "#737373"} onChange={(e) => update(row.id, { color: e.target.value })} /></div>
            <div className="md:col-span-1 flex flex-col gap-1"><Label className="text-xs">Activo</Label><Switch checked={row.is_active} onCheckedChange={(v) => update(row.id, { is_active: v })} /></div>
            <div className="md:col-span-1 flex justify-end"><Button size="sm" variant="outline" onClick={() => save(row)}>Guardar</Button></div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ----- Usuarios ----- */
interface UserAccess {
  id: string;
  user_id: string;
  default_location_id: string | null;
  can_choose_location: boolean;
  allowed_location_ids: string[];
}
function UsuariosPanel({ locations }: { locations: Location[] }) {
  const [rows, setRows] = useState<UserAccess[]>([]);
  const [profiles, setProfiles] = useState<{ id: string; email: string; full_name: string | null }[]>([]);

  const load = async () => {
    const [a, p] = await Promise.all([
      supabase.from("esp_user_location_access").select("*"),
      supabase.from("profiles").select("id,email,full_name").order("email"),
    ]);
    if (a.data) setRows(a.data as UserAccess[]);
    if (p.data) setProfiles(p.data as any);
  };
  useEffect(() => { load(); }, []);

  const upsert = async (userId: string, patch: Partial<UserAccess>) => {
    const existing = rows.find((r) => r.user_id === userId);
    if (existing) {
      const { error } = await supabase.from("esp_user_location_access").update(patch).eq("id", existing.id);
      if (error) toast.error(error.message); else { toast.success("Asignación actualizada"); load(); }
    } else {
      const { error } = await supabase.from("esp_user_location_access").insert({ user_id: userId, ...patch });
      if (error) toast.error(error.message); else { toast.success("Asignación creada"); load(); }
    }
  };

  return (
    <Card className="p-5 rounded-2xl space-y-4">
      <div>
        <h3 className="text-lg font-bold">Usuarios / Sedes</h3>
        <p className="text-xs text-muted-foreground">Asigna sede por defecto y si el usuario puede escoger sede al iniciar.</p>
      </div>
      <div className="space-y-3">
        {profiles.map((u) => {
          const access = rows.find((r) => r.user_id === u.id);
          return (
            <div key={u.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end border-b border-border/50 pb-3">
              <div className="md:col-span-4">
                <div className="text-sm font-medium">{u.full_name || u.email}</div>
                <div className="text-xs text-muted-foreground">{u.email}</div>
              </div>
              <div className="md:col-span-5">
                <Label className="text-xs">Sede por defecto</Label>
                <Select
                  value={access?.default_location_id ?? "none"}
                  onValueChange={(v) => upsert(u.id, { default_location_id: v === "none" ? null : v })}
                >
                  <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Sin asignar —</SelectItem>
                    {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-3 flex flex-col gap-1">
                <Label className="text-xs">Puede escoger sede</Label>
                <Switch
                  checked={access?.can_choose_location ?? false}
                  onCheckedChange={(v) => upsert(u.id, { can_choose_location: v })}
                />
              </div>
            </div>
          );
        })}
        {profiles.length === 0 && <p className="text-xs text-muted-foreground">No hay usuarios cargados.</p>}
      </div>
    </Card>
  );
}

/* ----- WooCommerce España ----- */
function WooEspanaPanel({ settings, onUpdated }: { settings: Settings | null; onUpdated: () => void }) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [policy, setPolicy] = useState({
    interpret_woo_unmanaged_as_made_to_order: settings?.interpret_woo_unmanaged_as_made_to_order ?? true,
    auto_create_fabrication_for_mto: settings?.auto_create_fabrication_for_mto ?? true,
    auto_decrement_web_stock: settings?.auto_decrement_web_stock ?? false,
  });
  useEffect(() => {
    setPolicy({
      interpret_woo_unmanaged_as_made_to_order: settings?.interpret_woo_unmanaged_as_made_to_order ?? true,
      auto_create_fabrication_for_mto: settings?.auto_create_fabrication_for_mto ?? true,
      auto_decrement_web_stock: settings?.auto_decrement_web_stock ?? false,
    });
  }, [settings?.id]);

  const test = async () => {
    setTesting(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("esp-woo-test");
      if (error) throw error;
      setResult(data);
      if (data?.ok) {
        toast.success("Conexión OK con basicoclothes.es");
        if (settings && !settings.woo_connected) {
          await supabase.from("esp_settings").update({ woo_connected: true, woo_status: "conectado" }).eq("id", settings.id);
          onUpdated();
        }
      } else {
        toast.error("La API respondió con error");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Error probando la conexión");
      setResult({ ok: false, error: e?.message });
    } finally {
      setTesting(false);
    }
  };

  const savePolicy = async () => {
    if (!settings) return;
    const { error } = await supabase.from("esp_settings").update(policy).eq("id", settings.id);
    if (error) toast.error(error.message);
    else { toast.success("Política guardada"); onUpdated(); }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <Card className="p-6 rounded-2xl space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold">WooCommerce España</h3>
            <p className="text-xs text-muted-foreground">Conexión read-only a basicoclothes.es vía REST API v3.</p>
          </div>
          <Badge variant={settings?.woo_connected ? "default" : "secondary"}>
            {settings?.woo_connected ? "Conectado" : "No conectado"}
          </Badge>
        </div>

        <div className="text-sm space-y-2">
          <div className="flex justify-between"><span className="text-muted-foreground">Web</span><span className="font-medium">basicoclothes.es</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Credenciales</span><span>Almacenadas en secretos (WC_ES_*)</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Moneda</span><span>EUR</span></div>
        </div>

        <Button onClick={test} disabled={testing}>
          {testing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Probando…</> : "Probar conexión"}
        </Button>

        {result && (
          <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto max-h-72">
{JSON.stringify(result, null, 2)}
          </pre>
        )}
      </Card>

      <Card className="p-6 rounded-2xl space-y-4">
        <div>
          <h3 className="text-lg font-bold">Política de stock web</h3>
          <p className="text-xs text-muted-foreground">Reglas globales para interpretar el catálogo Woo. No escribe en WooCommerce.</p>
        </div>

        <div className="flex items-start justify-between gap-3 border-b pb-3">
          <div>
            <Label className="font-semibold">Interpretar manage_stock=false como fabricación ligera</Label>
            <p className="text-xs text-muted-foreground">Productos Woo sin stock gestionado se marcan como made_to_order automáticamente.</p>
          </div>
          <Switch
            checked={policy.interpret_woo_unmanaged_as_made_to_order}
            onCheckedChange={(v) => setPolicy({ ...policy, interpret_woo_unmanaged_as_made_to_order: v })}
          />
        </div>

        <div className="flex items-start justify-between gap-3 border-b pb-3">
          <div>
            <Label className="font-semibold">Crear fabricación automática para made_to_order</Label>
            <p className="text-xs text-muted-foreground">Cada pedido Woo de un producto made_to_order genera una solicitud de fabricación.</p>
          </div>
          <Switch
            checked={policy.auto_create_fabrication_for_mto}
            onCheckedChange={(v) => setPolicy({ ...policy, auto_create_fabrication_for_mto: v })}
          />
        </div>

        <div className="flex items-start justify-between gap-3 border-b pb-3 opacity-70">
          <div>
            <Label className="font-semibold">Descontar inventario web automáticamente</Label>
            <p className="text-xs text-muted-foreground">Mantener apagado. Reservado para fases futuras.</p>
          </div>
          <Switch
            checked={policy.auto_decrement_web_stock}
            onCheckedChange={(v) => setPolicy({ ...policy, auto_decrement_web_stock: v })}
            disabled
          />
        </div>

        <div>
          <Label className="text-xs">Sede de stock web</Label>
          <Input value="" placeholder="(no activo todavía)" disabled />
        </div>

        <Button onClick={savePolicy}><Save className="h-4 w-4 mr-2" />Guardar política</Button>
      </Card>

      <p className="text-xs text-muted-foreground">
        Este módulo NO toca basicoclothes.com (Venezuela). Solo lectura sobre basicoclothes.es.
      </p>
    </div>
  );
}
