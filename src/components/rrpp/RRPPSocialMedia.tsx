import { useEffect, useState } from "react";
import { Plus, Share2, Trash2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { fetchConfig } from "@/hooks/useRRPPData";
import { formatFollowers } from "./rrppConstants";
import type { SocialMedia } from "@/types/rrpp";
import { formatDMY } from "@/lib/dateUtils";

const db = supabase as any;

const DEFAULT_NETWORKS = ["Instagram", "TikTok", "YouTube", "X", "Facebook", "LinkedIn"];

interface Props {
  contactId: string;
}

const todayStr = () => new Date().toISOString().slice(0, 10);
const emptyForm = () => ({
  network: "",
  handle: "",
  followers: 0,
  measured_at: todayStr(),
});

export function RRPPSocialMedia({ contactId }: Props) {
  const [records, setRecords] = useState<SocialMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [networks, setNetworks] = useState<string[]>(DEFAULT_NETWORKS);
  const [openSheet, setOpenSheet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm());

  const load = async () => {
    setLoading(true);
    const { data, error } = await db
      .from("rrpp_social_media")
      .select("*")
      .eq("contact_id", contactId)
      .order("measured_at", { ascending: false });
    if (error) { toast.error(error.message); }
    setRecords((data ?? []) as SocialMedia[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    fetchConfig("network").then((rows) => {
      const fromCfg = rows.map((r) => r.value);
      if (fromCfg.length) setNetworks(Array.from(new Set([...fromCfg, ...DEFAULT_NETWORKS])));
    }).catch(() => {});
    // eslint-disable-next-line
  }, [contactId]);

  const grouped = records.reduce<Record<string, SocialMedia[]>>((acc, r) => {
    (acc[r.network] = acc[r.network] ?? []).push(r);
    return acc;
  }, {});

  async function logAudit(action: string, newValue?: string) {
    const { data: u } = await supabase.auth.getUser();
    await db.from("rrpp_audit_log").insert({
      contact_id: contactId,
      action,
      field_changed: "social_media",
      new_value: newValue ?? null,
      performed_by: u.user?.email ?? u.user?.id ?? "system",
    });
  }

  const openNewNetwork = () => {
    setForm(emptyForm());
    setOpenSheet(true);
  };

  const openNewSample = (network: string, lastHandle: string) => {
    setForm({ network, handle: lastHandle, followers: 0, measured_at: todayStr() });
    setOpenSheet(true);
  };

  const handleSave = async () => {
    if (!form.network) return toast.error("Selecciona una red");
    if (!form.handle.trim()) return toast.error("El handle es requerido");
    setSaving(true);
    try {
      const { error } = await db.from("rrpp_social_media").insert({
        contact_id: contactId,
        network: form.network,
        handle: form.handle.trim(),
        followers: Number(form.followers) || 0,
        measured_at: form.measured_at,
      });
      if (error) throw error;
      await logAudit("social_add", `${form.network} @${form.handle} (${form.followers})`);
      toast.success("Muestreo guardado");
      setOpenSheet(false);
      setForm(emptyForm());
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (rec: SocialMedia) => {
    const { error } = await db.from("rrpp_social_media").delete().eq("id", rec.id);
    if (error) return toast.error(error.message);
    await logAudit("social_delete", `${rec.network} @${rec.handle}`);
    toast.success("Registro eliminado");
    load();
  };

  if (loading) {
    return <div className="kpi-card text-muted-foreground text-sm">Cargando redes…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={openNewNetwork}>
          <Plus className="h-4 w-4 mr-2" />Agregar red social
        </Button>
      </div>

      <Sheet open={openSheet} onOpenChange={setOpenSheet}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{form.network ? `Nuevo muestreo · ${form.network}` : "Nueva red social"}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div>
              <Label>Red</Label>
              <Select value={form.network} onValueChange={(v) => setForm({ ...form, network: v })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecciona red" /></SelectTrigger>
                <SelectContent>
                  {networks.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Handle *</Label>
              <Input
                value={form.handle}
                onChange={(e) => setForm({ ...form, handle: e.target.value })}
                maxLength={120}
                placeholder="@usuario"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Seguidores</Label>
              <Input
                type="number" min={0}
                value={form.followers}
                onChange={(e) => setForm({ ...form, followers: Number(e.target.value) })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Fecha de medición</Label>
              <Input
                type="date"
                value={form.measured_at}
                onChange={(e) => setForm({ ...form, measured_at: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button variant="ghost" onClick={() => setOpenSheet(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {Object.keys(grouped).length === 0 ? (
        <div className="kpi-card text-center py-16">
          <Share2 className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-semibold">Sin redes registradas</p>
          <p className="text-sm text-muted-foreground mt-1">
            Agrega la primera red para empezar a medir alcance.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(grouped).map(([network, recs]) => {
            const sorted = [...recs].sort((a, b) =>
              new Date(b.measured_at).getTime() - new Date(a.measured_at).getTime()
            );
            const latest = sorted[0];
            const prev = sorted[1];
            const trend = prev ? latest.followers - prev.followers : 0;
            const pct = prev && prev.followers > 0
              ? (trend / prev.followers) * 100
              : null;
            const TrendIcon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus;
            const trendClass = trend > 0
              ? "text-green-600 dark:text-green-400"
              : trend < 0
                ? "text-destructive"
                : "text-muted-foreground";

            return (
              <div key={network} className="kpi-card">
                <div className="flex items-start justify-between mb-3 gap-3">
                  <div className="min-w-0">
                    <h4 className="font-bold">{network}</h4>
                    <p className="text-sm text-muted-foreground truncate">@{latest.handle}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black">{formatFollowers(latest.followers)}</p>
                    {prev ? (
                      <p className={`text-xs flex items-center justify-end gap-1 font-semibold ${trendClass}`}>
                        <TrendIcon className="h-3 w-3" />
                        {trend > 0 ? "+" : trend < 0 ? "−" : ""}
                        {formatFollowers(Math.abs(trend))}
                        {pct !== null && (
                          <span className="opacity-80">
                            ({trend > 0 ? "+" : trend < 0 ? "−" : ""}{Math.abs(pct).toFixed(1)}%)
                          </span>
                        )}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Sin muestreo previo</p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end mb-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => openNewSample(network, latest.handle)}
                  >
                    <Plus className="h-3 w-3 mr-1" /> Nuevo muestreo
                  </Button>
                </div>

                <div className="space-y-2 max-h-48 overflow-auto">
                  {sorted.map((r, idx) => {
                    const next = sorted[idx + 1];
                    const d = next ? r.followers - next.followers : 0;
                    const dPct = next && next.followers > 0 ? (d / next.followers) * 100 : null;
                    const dClass = d > 0
                      ? "text-green-600 dark:text-green-400"
                      : d < 0
                        ? "text-destructive"
                        : "text-muted-foreground";
                    return (
                      <div key={r.id} className="flex items-center justify-between text-xs border-t pt-2">
                        <div className="min-w-0">
                          <p className="text-muted-foreground">{new formatDMY(Date(r.measured_at))}</p>
                          <p className="truncate">
                            @{r.handle} · {formatFollowers(r.followers)}
                            {next && (
                              <span className={`ml-2 font-semibold ${dClass}`}>
                                {d > 0 ? "+" : d < 0 ? "−" : ""}{formatFollowers(Math.abs(d))}
                                {dPct !== null && ` (${d > 0 ? "+" : d < 0 ? "−" : ""}${Math.abs(dPct).toFixed(1)}%)`}
                              </span>
                            )}
                          </p>
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Eliminar registro?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Se eliminará la medición de {network} del {new formatDMY(Date(r.measured_at))}.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(r)}>Eliminar</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
