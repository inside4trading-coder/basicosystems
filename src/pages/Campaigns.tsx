import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Mail, Eye, Copy, Trash2, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Campaign {
  id: string;
  name: string;
  subject: string | null;
  status: string;
  recipient_count: number | null;
  scheduled_at: string | null;
  sent_at: string | null;
  created_at: string | null;
  stats_json: any;
  segment_filter: any;
  brevo_campaign_id: number | null;
}

const statusBadge: Record<string, { label: string; className: string }> = {
  draft: { label: "Borrador", className: "bg-muted text-muted-foreground" },
  scheduled: { label: "Programada", className: "bg-[hsl(var(--status-warning))]/15 text-[hsl(var(--status-warning))] border-[hsl(var(--status-warning))]/30" },
  sent: { label: "Enviada", className: "bg-[hsl(var(--status-success))]/15 text-[hsl(var(--status-success))] border-[hsl(var(--status-success))]/30" },
};

const segmentLabels: Record<string, string> = {
  all: "Todos",
  new: "Nuevos (0)",
  first: "Primera compra (1)",
  recurring: "Recurrentes (2-4)",
  loyal: "Fieles (5-9)",
  vip: "VIP (10+)",
};

export default function Campaigns() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState<string | null>(null);

  const fetchCampaigns = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("campaigns")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Error cargando campañas");
      console.error(error);
    } else {
      setCampaigns((data as any[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchCampaigns(); }, []);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const { error } = await supabase.functions.invoke("brevo-campaigns", {
        body: { action: "delete", id: deleteId },
      });
      if (error) throw error;
      toast.success("Campaña eliminada");
      fetchCampaigns();
    } catch (err: any) {
      toast.error(err.message || "Error eliminando");
    }
    setDeleteId(null);
  };

  const handleDuplicate = async (id: string) => {
    setDuplicating(id);
    try {
      const { error } = await supabase.functions.invoke("brevo-campaigns", {
        body: { action: "duplicate", id },
      });
      if (error) throw error;
      toast.success("Campaña duplicada");
      fetchCampaigns();
    } catch (err: any) {
      toast.error(err.message || "Error duplicando");
    }
    setDuplicating(null);
  };

  const totalSent = campaigns.filter((c) => c.status === "sent").length;
  const totalRecipients = campaigns.reduce((acc, c) => acc + (c.recipient_count || 0), 0);
  const avgOpenRate =
    campaigns.filter((c) => c.stats_json?.openRate).length > 0
      ? (campaigns.reduce((acc, c) => acc + parseFloat(c.stats_json?.openRate || "0"), 0) /
          campaigns.filter((c) => c.stats_json?.openRate).length).toFixed(1)
      : "—";

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-xl sm:text-2xl font-black tracking-tight">Email Campaigns</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={fetchCampaigns} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button variant="brand" size="sm" onClick={() => navigate("/campaigns/new")}>
            <Plus className="h-4 w-4 mr-1" /> Nueva campaña
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Campañas enviadas", value: String(totalSent) },
          { label: "Tasa apertura media", value: avgOpenRate === "—" ? "—" : `${avgOpenRate}%` },
          { label: "Total destinatarios", value: totalRecipients.toLocaleString() },
        ].map((stat, i) => (
          <div key={stat.label} className="kpi-card animate-fade-in" style={{ animationDelay: `${i * 80}ms` }}>
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{stat.label}</span>
            <div className="text-2xl font-black tracking-tight mt-1">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Campaigns table */}
      <div className="bg-card rounded-lg border border-border overflow-hidden animate-fade-in" style={{ animationDelay: "0.3s" }}>
        {loading ? (
          <div className="p-12 text-center text-muted-foreground">Cargando campañas...</div>
        ) : campaigns.length === 0 ? (
          <div className="p-12 text-center">
            <Mail className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground font-medium">No hay campañas todavía</p>
            <p className="text-sm text-muted-foreground mt-1">Crea tu primera campaña de email</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Campaña</th>
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Estado</th>
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Segmento</th>
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Fecha</th>
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Enviados</th>
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Apertura</th>
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Clics</th>
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => {
                const badge = statusBadge[c.status] || statusBadge.draft;
                const segKey = c.segment_filter?.type || "all";
                return (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <span className="font-bold">{c.name}</span>
                        {c.subject && <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[200px]">{c.subject}</p>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={badge.className}>{badge.label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                      {segmentLabels[segKey] || segKey}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                      {c.sent_at
                        ? new Date(c.sent_at).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })
                        : c.scheduled_at
                        ? new Date(c.scheduled_at).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })
                        : "—"}
                    </td>
                    <td className="px-4 py-3">{c.recipient_count || 0}</td>
                    <td className="px-4 py-3 font-bold hidden lg:table-cell">{c.stats_json?.openRate ? `${c.stats_json.openRate}%` : "—"}</td>
                    <td className="px-4 py-3 hidden lg:table-cell">{c.stats_json?.clickRate ? `${c.stats_json.clickRate}%` : "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(`/campaigns/${c.id}`)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => handleDuplicate(c.id)}
                          disabled={duplicating === c.id}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(c.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar campaña?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer. Se eliminará también de Brevo.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
