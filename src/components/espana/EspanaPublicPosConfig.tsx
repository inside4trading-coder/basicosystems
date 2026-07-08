import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Copy, RefreshCw, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Loc {
  id: string;
  name: string;
  is_active: boolean;
  inventory_mode: string;
  public_pos_enabled?: boolean;
  public_pos_slug?: string | null;
  public_pos_token?: string | null;
  public_pos_pin?: string | null;
  public_pos_last_used_at?: string | null;
}

export function EspanaPublicPosConfig() {
  const [rows, setRows] = useState<Loc[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("esp_locations")
      .select("id,name,is_active,inventory_mode,public_pos_enabled,public_pos_slug,public_pos_token,public_pos_pin,public_pos_last_used_at")
      .order("name");
    if (error) toast.error(error.message);
    setRows((data || []) as Loc[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const call = async (location_id: string, action: string, extra: Record<string, unknown> = {}) => {
    setBusy(location_id + ":" + action);
    const { data, error } = await supabase.functions.invoke("esp-public-pos-admin", {
      body: { action, location_id, ...extra },
    });
    setBusy(null);
    if (error || (data as any)?.error) {
      toast.error(error?.message || (data as any)?.error || "Error");
      return;
    }
    toast.success("Actualizado");
    await load();
  };

  const linkFor = (loc: Loc) => {
    if (!loc.public_pos_slug || !loc.public_pos_token) return "";
    return `${window.location.origin}/pos/${loc.public_pos_slug}/${loc.public_pos_token}`;
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Link copiado");
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  if (loading) return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Cargando…</div>;

  const sellable = rows.filter(l => l.is_active && (l.inventory_mode === "own_stock" || l.inventory_mode === "linked_stock"));

  return (
    <div className="space-y-3">
      <Card className="p-4">
        <h3 className="font-bold text-sm mb-1">POS Público por sede</h3>
        <p className="text-xs text-muted-foreground">
          Genera un link público con token para que trabajadores en Pop Up / tiendas vendan sin iniciar sesión.
          El link carga la sede fija; el inventario se descuenta solo de esa sede.
        </p>
      </Card>

      {sellable.map((loc) => {
        const link = linkFor(loc);
        return (
          <Card key={loc.id} className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <h4 className="font-bold">{loc.name}</h4>
                {loc.public_pos_enabled ? (
                  <Badge className="bg-primary/15 text-primary">Activo</Badge>
                ) : (
                  <Badge variant="secondary">Inactivo</Badge>
                )}
                {loc.public_pos_last_used_at && (
                  <span className="text-[11px] text-muted-foreground">
                    Último uso: {new Date(loc.public_pos_last_used_at).toLocaleString()}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={!!loc.public_pos_enabled}
                  disabled={busy?.startsWith(loc.id)}
                  onCheckedChange={(v) => call(loc.id, v ? "enable" : "disable")}
                />
                <span className="text-xs">{loc.public_pos_enabled ? "Activo" : "Desactivado"}</span>
              </div>
            </div>

            {loc.public_pos_enabled && (
              <>
                <div className="grid sm:grid-cols-[1fr_auto] gap-2 items-end">
                  <div>
                    <label className="text-xs font-medium">Slug</label>
                    <Input
                      defaultValue={loc.public_pos_slug || ""}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v && v !== loc.public_pos_slug) call(loc.id, "set_slug", { slug: v });
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium">PIN opcional</label>
                    <Input
                      defaultValue={loc.public_pos_pin || ""}
                      placeholder="(vacío = sin PIN)"
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v !== (loc.public_pos_pin || "")) call(loc.id, "set_pin", { pin: v || null });
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium">Link público</label>
                  <div className="flex gap-2 items-center">
                    <Input readOnly value={link} className="font-mono text-xs" />
                    <Button size="icon" variant="outline" onClick={() => copy(link)} title="Copiar"><Copy className="h-4 w-4" /></Button>
                    <Button size="icon" variant="outline" onClick={() => window.open(link, "_blank")} title="Abrir"><ExternalLink className="h-4 w-4" /></Button>
                    <Button size="icon" variant="outline" disabled={busy === loc.id + ":regenerate_token"} onClick={() => call(loc.id, "regenerate_token")} title="Regenerar token">
                      <RefreshCw className={`h-4 w-4 ${busy === loc.id + ":regenerate_token" ? "animate-spin" : ""}`} />
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Regenerar el token invalida el link anterior.
                  </p>
                </div>
              </>
            )}
          </Card>
        );
      })}
    </div>
  );
}
