import { useEffect, useMemo, useState } from "react";
import {
  Users, UserPlus, Trophy, TrendingUp, Send, Megaphone, Gift, DollarSign,
  PhoneCall, AlertTriangle, Loader2, Sparkles, Target, Pencil, Check, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  RELATIONSHIP_LABELS, CONTACT_TYPE_LABELS, formatFollowers,
} from "@/components/rrpp/rrppConstants";
import type { Contact, Collaboration, Interaction, RelationshipStatus, ContactType } from "@/types/rrpp";
import { useRRPPGoals, type BrandGoals } from "@/hooks/useRRPPGoals";
import { RRPP_BRAND_LABELS, type RRPPBrand } from "@/hooks/useRRPPBrand";

const db = supabase as any;

type RangeKey = "this_month" | "last_month" | "last_3" | "last_6" | "year" | "all";

const RANGE_LABELS: Record<RangeKey, string> = {
  this_month: "Este mes",
  last_month: "Mes anterior",
  last_3: "Últimos 3 meses",
  last_6: "Últimos 6 meses",
  year: "Este año",
  all: "Todo el historial",
};

function rangeBounds(key: RangeKey): { from: Date | null; to: Date | null } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (key) {
    case "this_month":
      return { from: new Date(y, m, 1), to: new Date(y, m + 1, 1) };
    case "last_month":
      return { from: new Date(y, m - 1, 1), to: new Date(y, m, 1) };
    case "last_3":
      return { from: new Date(y, m - 2, 1), to: new Date(y, m + 1, 1) };
    case "last_6":
      return { from: new Date(y, m - 5, 1), to: new Date(y, m + 1, 1) };
    case "year":
      return { from: new Date(y, 0, 1), to: new Date(y + 1, 0, 1) };
    case "all":
      return { from: null, to: null };
  }
}

function inRange(dateStr: string | null | undefined, from: Date | null, to: Date | null): boolean {
  if (!dateStr) return false;
  if (!from || !to) return true;
  const t = new Date(dateStr).getTime();
  return t >= from.getTime() && t < to.getTime();
}

interface Stat {
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ReactNode;
  accent?: "primary" | "success" | "warning" | "error" | "info";
}

const ACCENT_CLASSES: Record<NonNullable<Stat["accent"]>, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-status-success/10 text-status-success",
  warning: "bg-status-warning/10 text-status-warning",
  error: "bg-status-error/10 text-status-error",
  info: "bg-blue-500/10 text-blue-600",
};

function StatCard({ s }: { s: Stat }) {
  return (
    <div className="kpi-card flex items-start gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${ACCENT_CLASSES[s.accent ?? "primary"]}`}>
        {s.icon}
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">{s.label}</div>
        <div className="text-2xl font-black leading-tight">{s.value}</div>
        {s.hint && <div className="text-[11px] text-muted-foreground mt-0.5">{s.hint}</div>}
      </div>
    </div>
  );
}

function BreakdownCard({
  title,
  icon,
  rows,
}: {
  title: string;
  icon: React.ReactNode;
  rows: { label: string; value: number; pct?: number }[];
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="kpi-card">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">{icon}</div>
        <h3 className="font-bold text-sm">{title}</h3>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">Sin datos en este período</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.label}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold truncate">{r.label}</span>
                <span className="text-muted-foreground tabular-nums">
                  {r.value}
                  {typeof r.pct === "number" && <span className="ml-1.5 text-[10px]">({r.pct.toFixed(0)}%)</span>}
                </span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${(r.value / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MonthlyTrendCard({ data }: { data: { label: string; added: number; converted: number }[] }) {
  const max = Math.max(1, ...data.flatMap((d) => [d.added, d.converted]));
  return (
    <div className="kpi-card lg:col-span-2">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
          <TrendingUp className="h-4 w-4" />
        </div>
        <div>
          <h3 className="font-bold text-sm">Tendencia mensual</h3>
          <p className="text-[11px] text-muted-foreground">Perfiles agregados vs convertidos exitosamente</p>
        </div>
      </div>
      {data.length === 0 ? (
        <p className="text-xs text-muted-foreground py-8 text-center">Sin datos en este período</p>
      ) : (
        <>
          <div className="flex items-end gap-2 h-32">
            {data.map((d) => (
              <div key={d.label} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                <div className="w-full flex items-end justify-center gap-0.5 h-24">
                  <div
                    className="w-1/2 bg-primary rounded-t transition-all"
                    style={{ height: `${(d.added / max) * 100}%`, minHeight: d.added > 0 ? "2px" : "0" }}
                    title={`Agregados: ${d.added}`}
                  />
                  <div
                    className="w-1/2 bg-status-success rounded-t transition-all"
                    style={{ height: `${(d.converted / max) * 100}%`, minHeight: d.converted > 0 ? "2px" : "0" }}
                    title={`Convertidos: ${d.converted}`}
                  />
                </div>
                <span className="text-[10px] font-semibold text-muted-foreground truncate w-full text-center">
                  {d.label}
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-3 justify-center">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
              <span className="w-2.5 h-2.5 rounded-sm bg-primary" /> Agregados
            </span>
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
              <span className="w-2.5 h-2.5 rounded-sm bg-status-success" /> Convertidos
            </span>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------- Monthly Goals (now from DB per brand via useRRPPGoals) ----------------


function GoalRow({
  label,
  current,
  goal,
  accent,
}: {
  label: string;
  current: number;
  goal: number;
  accent: "primary" | "warning" | "success";
}) {
  const pct = goal > 0 ? Math.min(100, (current / goal) * 100) : 0;
  const reached = current >= goal && goal > 0;
  const remaining = Math.max(0, goal - current);
  const barColor =
    reached ? "bg-status-success"
    : accent === "primary" ? "bg-primary"
    : accent === "warning" ? "bg-status-warning"
    : "bg-status-success";

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-bold">{label}</span>
        <span className="text-xs tabular-nums font-semibold">
          <span className={reached ? "text-status-success" : "text-foreground"}>{current}</span>
          <span className="text-muted-foreground"> / {goal}</span>
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-[10px] text-muted-foreground">{pct.toFixed(0)}% completado</span>
        <span className={`text-[10px] font-semibold ${reached ? "text-status-success" : "text-muted-foreground"}`}>
          {reached ? "✓ Meta alcanzada" : `Faltan ${remaining}`}
        </span>
      </div>
    </div>
  );
}

function MonthlyGoalsCard({
  current,
  goals,
  onSave,
  brandLabel,
}: {
  current: { added: number; activations: number; successful: number };
  goals: BrandGoals;
  onSave: (g: BrandGoals) => void;
  brandLabel: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<BrandGoals>(goals);

  useEffect(() => { setDraft(goals); }, [goals]);

  const monthLabel = new Date().toLocaleDateString("es-VE", { month: "long", year: "numeric" });

  return (
    <div className="kpi-card">
      <div className="flex items-start justify-between mb-4 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Target className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-sm">Metas del mes · {brandLabel}</h3>
            <p className="text-[11px] text-muted-foreground capitalize truncate">{monthLabel}</p>
          </div>
        </div>
        {editing ? (
          <div className="flex items-center gap-1">
            <button
              onClick={() => { onSave(draft); setEditing(false); }}
              className="p-1.5 rounded-md bg-status-success/10 text-status-success hover:bg-status-success/20"
              title="Guardar"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              onClick={() => { setDraft(goals); setEditing(false); }}
              className="p-1.5 rounded-md bg-muted text-muted-foreground hover:text-foreground"
              title="Cancelar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="p-1.5 rounded-md bg-muted text-muted-foreground hover:text-foreground"
            title="Editar metas"
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          {[
            { key: "captaciones" as const, label: "Captaciones (perfiles agregados)" },
            { key: "activaciones" as const, label: "Activaciones (productos enviados)" },
            { key: "colaboraciones" as const, label: "Colaboraciones exitosas" },
          ].map((f) => (
            <div key={f.key}>
              <label className="text-[11px] font-semibold text-muted-foreground block mb-1">{f.label}</label>
              <input
                type="number"
                min={0}
                value={draft[f.key]}
                onChange={(e) => setDraft({ ...draft, [f.key]: Math.max(0, Number(e.target.value) || 0) })}
                className="w-full px-3 py-1.5 rounded-md border border-border bg-background text-sm"
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <GoalRow label="Captaciones" current={current.added} goal={goals.captaciones} accent="primary" />
          <GoalRow label="Activaciones" current={current.activations} goal={goals.activaciones} accent="warning" />
          <GoalRow label="Colaboraciones exitosas" current={current.successful} goal={goals.colaboraciones} accent="success" />
        </div>
      )}
    </div>
  );
}

export default function RRPPDashboard({ brand }: { brand: RRPPBrand }) {
  const [range, setRange] = useState<RangeKey>("this_month");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [collabs, setCollabs] = useState<Collaboration[]>([]);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { goals, save: persistGoals } = useRRPPGoals(brand);

  const saveGoals = async (g: BrandGoals) => {
    try {
      await persistGoals(g);
    } catch (e) {
      console.error("Error saving goals", e);
    }
  };


  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      db.from("rrpp_contacts").select("*, social_media:rrpp_social_media(*)"),
      db.from("rrpp_collaborations").select("*"),
      db.from("rrpp_interactions").select("*"),
    ])
      .then(([c, co, i]: any[]) => {
        if (cancelled) return;
        if (c.error) throw c.error;
        if (co.error) throw co.error;
        if (i.error) throw i.error;
        setContacts((c.data ?? []) as Contact[]);
        setCollabs((co.data ?? []) as Collaboration[]);
        setInteractions((i.data ?? []) as Interaction[]);
      })
      .catch((e: any) => !cancelled && setError(e.message ?? String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  const { from, to } = useMemo(() => rangeBounds(range), [range]);

  // Scope by active brand (contacts have brand; collabs+interactions linked via contact_id)
  const brandContactIds = useMemo(
    () => new Set(contacts.filter((c) => c.brand === brand).map((c) => c.id)),
    [contacts, brand]
  );
  const scopedContacts = useMemo(() => contacts.filter((c) => c.brand === brand), [contacts, brand]);
  const scopedCollabs = useMemo(() => collabs.filter((co) => brandContactIds.has(co.contact_id)), [collabs, brandContactIds]);
  const scopedInteractions = useMemo(() => interactions.filter((i) => brandContactIds.has(i.contact_id)), [interactions, brandContactIds]);

  const data = useMemo(() => {
    const inRng = (d?: string | null) => inRange(d, from, to);
    const contactsB = scopedContacts;
    const collabsB = scopedCollabs;
    const interactionsB = scopedInteractions;


    const addedContacts = contactsB.filter((c) => inRng(c.created_at));
    const allActiveContacts = contactsB.filter((c) => c.status === "active");

    // Conversions: relationship_status = "colaboracion_exitosa" updated in range,
    // approximated by collaborations marked done in range (more precise) + fallback by updated_at.
    const collabsInRange = collabsB.filter((co) => inRng(co.created_at) || inRng(co.send_date) || inRng(co.post_date));
    const successfulCollabs = collabsInRange.filter((co) => co.collab_done);
    const successfulContactIds = new Set(successfulCollabs.map((co) => co.contact_id));
    const convertedCount = successfulContactIds.size;

    // Conversion rate over contacts created in the same range (avoids inflating with old base)
    const conversionRate = addedContacts.length > 0
      ? (addedContacts.filter((c) => c.relationship_status === "colaboracion_exitosa").length / addedContacts.length) * 100
      : 0;

    // Advances: any interaction in range (= "avance")
    const interactionsInRange = interactionsB.filter((i) => inRng(i.date) || inRng(i.created_at));


    // Products sent / received
    const productsSent = collabsInRange.filter((co) => !!co.send_date).length;
    const productsReceived = collabsInRange.filter((co) => co.received).length;

    // Posts published
    const postsPublished = collabsInRange.filter((co) => !!co.post_date).length;

    // Coupons & revenue
    const couponRevenue = collabsInRange.reduce((sum, co) => sum + (Number(co.coupon_revenue) || 0), 0);
    const couponsActive = collabsInRange.filter((co) => co.has_coupon && co.coupon_code).length;

    // Breakdown: by contact type (added in range)
    const byType = new Map<ContactType, number>();
    for (const c of addedContacts) {
      byType.set(c.contact_type, (byType.get(c.contact_type) ?? 0) + 1);
    }
    const typeRows = Array.from(byType.entries())
      .map(([k, v]) => ({ label: CONTACT_TYPE_LABELS[k] ?? k, value: v, pct: (v / Math.max(1, addedContacts.length)) * 100 }))
      .sort((a, b) => b.value - a.value);

    // Breakdown: by relationship status (over all active, gives current pipeline)
    const byStatus = new Map<RelationshipStatus, number>();
    for (const c of allActiveContacts) {
      byStatus.set(c.relationship_status, (byStatus.get(c.relationship_status) ?? 0) + 1);
    }
    const statusRows = Array.from(byStatus.entries())
      .map(([k, v]) => ({ label: RELATIONSHIP_LABELS[k] ?? k, value: v, pct: (v / Math.max(1, allActiveContacts.length)) * 100 }))
      .sort((a, b) => b.value - a.value);

    // Breakdown: by responsible (added in range)
    const byResp = new Map<string, number>();
    for (const c of addedContacts) {
      const r = c.responsible?.trim() || "Sin asignar";
      byResp.set(r, (byResp.get(r) ?? 0) + 1);
    }
    const respRows = Array.from(byResp.entries())
      .map(([k, v]) => ({ label: k, value: v }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    // Breakdown: by city (added in range, top 6)
    const byCity = new Map<string, number>();
    for (const c of addedContacts) {
      const city = c.city?.trim() || "Sin ciudad";
      byCity.set(city, (byCity.get(city) ?? 0) + 1);
    }
    const cityRows = Array.from(byCity.entries())
      .map(([k, v]) => ({ label: k, value: v }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    // Top contacts by reach (sum of followers across networks) — overall, not by range
    const reachRows = allActiveContacts
      .map((c) => ({
        label: c.name,
        value: (c.social_media ?? []).reduce((s, sm) => s + (Number(sm.followers) || 0), 0),
      }))
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)
      .map((r) => ({ label: r.label, value: r.value }));

    // Monthly trend (last N months based on range, capped 6-12)
    const monthsToShow =
      range === "this_month" || range === "last_month" ? 6
      : range === "last_3" ? 6
      : range === "last_6" ? 6
      : range === "year" ? 12
      : 12;

    const now = new Date();
    const trend: { label: string; added: number; converted: number }[] = [];
    for (let i = monthsToShow - 1; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const inMonth = (d?: string | null) => {
        if (!d) return false;
        const t = new Date(d).getTime();
        return t >= start.getTime() && t < end.getTime();
      };
      const added = contactsB.filter((c) => inMonth(c.created_at)).length;
      const monthCollabIds = new Set(
        collabsB.filter((co) => co.collab_done && (inMonth(co.post_date) || inMonth(co.created_at)))
          .map((co) => co.contact_id)
      );
      trend.push({
        label: start.toLocaleDateString("es-VE", { month: "short" }),
        added,
        converted: monthCollabIds.size,
      });
    }

    return {
      addedCount: addedContacts.length,
      activeBase: allActiveContacts.length,
      convertedCount,
      conversionRate,
      advances: interactionsInRange.length,
      productsSent,
      productsReceived,
      postsPublished,
      couponRevenue,
      couponsActive,
      typeRows,
      statusRows,
      respRows,
      cityRows,
      reachRows,
      trend,
    };
  }, [scopedContacts, scopedCollabs, scopedInteractions, from, to, range]);

  // Monthly goal progress — always current month, independent of range filter, scoped by brand
  const monthProgress = useMemo(() => {
    const { from: mFrom, to: mTo } = rangeBounds("this_month");
    const inMonth = (d?: string | null) => inRange(d, mFrom, mTo);
    const added = scopedContacts.filter((c) => inMonth(c.created_at)).length;
    const monthCollabs = scopedCollabs.filter((co) => inMonth(co.created_at) || inMonth(co.send_date) || inMonth(co.post_date));
    const activations = monthCollabs.filter((co) => !!co.send_date || !!co.shipped_at).length;
    const successful = new Set(monthCollabs.filter((co) => co.collab_done).map((co) => co.contact_id)).size;
    return { added, activations, successful };
  }, [scopedContacts, scopedCollabs]);

  if (loading) {
    return (
      <div className="kpi-card p-12 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Cargando dashboard…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="kpi-card flex items-start gap-3 bg-status-error/10 border-status-error/20">
        <AlertTriangle className="h-5 w-5 text-status-error shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-sm">Error al cargar el dashboard</p>
          <p className="text-xs text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  const stats: Stat[] = [
    {
      label: "Perfiles agregados",
      value: data.addedCount,
      hint: RANGE_LABELS[range].toLowerCase(),
      icon: <UserPlus className="h-5 w-5" />,
      accent: "primary",
    },
    {
      label: "Convertidos exitosamente",
      value: data.convertedCount,
      hint: `${data.conversionRate.toFixed(0)}% conversión sobre nuevos`,
      icon: <Trophy className="h-5 w-5" />,
      accent: "success",
    },
    {
      label: "Avances / interacciones",
      value: data.advances,
      hint: "Llamadas, mensajes, reuniones…",
      icon: <PhoneCall className="h-5 w-5" />,
      accent: "info",
    },
    {
      label: "Base activa total",
      value: data.activeBase,
      hint: "Contactos no archivados",
      icon: <Users className="h-5 w-5" />,
      accent: "primary",
    },
    {
      label: "Productos enviados",
      value: data.productsSent,
      hint: `${data.productsReceived} confirmados como recibidos`,
      icon: <Send className="h-5 w-5" />,
      accent: "warning",
    },
    {
      label: "Posts publicados",
      value: data.postsPublished,
      hint: "Colaboraciones con contenido",
      icon: <Megaphone className="h-5 w-5" />,
      accent: "info",
    },
    {
      label: "Cupones activos",
      value: data.couponsActive,
      hint: "Generados en el período",
      icon: <Gift className="h-5 w-5" />,
      accent: "primary",
    },
    {
      label: "Ingresos por cupones",
      value: new Intl.NumberFormat("es-VE", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(data.couponRevenue),
      hint: "Atribuidos a colaboraciones",
      icon: <DollarSign className="h-5 w-5" />,
      accent: "success",
    },
  ];

  return (
    <div className="space-y-5">
      {/* Range selector */}
      <div className="flex flex-wrap items-center gap-2">
        <Sparkles className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground mr-1">Período:</span>
        {(Object.keys(RANGE_LABELS) as RangeKey[]).map((k) => (
          <button
            key={k}
            onClick={() => setRange(k)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              range === k
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {RANGE_LABELS[k]}
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((s) => <StatCard key={s.label} s={s} />)}
      </div>

      {/* Trend + status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <MonthlyTrendCard data={data.trend} />
        <BreakdownCard
          title="Pipeline (estado actual)"
          icon={<TrendingUp className="h-4 w-4" />}
          rows={data.statusRows}
        />
      </div>

      {/* Breakdowns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <BreakdownCard
          title="Por tipo de contacto"
          icon={<Users className="h-4 w-4" />}
          rows={data.typeRows}
        />
        <BreakdownCard
          title="Por responsable"
          icon={<UserPlus className="h-4 w-4" />}
          rows={data.respRows}
        />
        <BreakdownCard
          title="Por ciudad"
          icon={<Sparkles className="h-4 w-4" />}
          rows={data.cityRows}
        />
      </div>

      {/* Top reach */}
      {data.reachRows.length > 0 && (
        <div className="kpi-card">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
              <Megaphone className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Top alcance</h3>
              <p className="text-[11px] text-muted-foreground">Suma de seguidores en todas las redes</p>
            </div>
          </div>
          <div className="space-y-2">
            {data.reachRows.map((r) => {
              const max = Math.max(1, ...data.reachRows.map((x) => x.value));
              return (
                <div key={r.label}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold truncate">{r.label}</span>
                    <span className="text-muted-foreground tabular-nums">{formatFollowers(r.value)}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${(r.value / max) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Monthly goals */}
      <MonthlyGoalsCard current={monthProgress} goals={goals} onSave={saveGoals} brandLabel={RRPP_BRAND_LABELS[brand]} />
    </div>
  );
}
