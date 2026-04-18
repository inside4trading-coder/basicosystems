import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, RefreshCw, ExternalLink, Send, Eye, MousePointer, UserMinus, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface Campaign {
  id: string;
  name: string;
  subject: string | null;
  status: string;
  recipient_count: number | null;
  sent_at: string | null;
  brevo_campaign_id: number | null;
  stats_json: any;
  segment_filter: any;
  sender_name: string | null;
  sender_email: string | null;
  content: string | null;
}

const statusBadge: Record<string, { label: string; className: string }> = {
  draft: { label: "Borrador", className: "bg-muted text-muted-foreground" },
  scheduled: { label: "Programada", className: "bg-[hsl(var(--status-warning))]/15 text-[hsl(var(--status-warning))]" },
  sent: { label: "Enviada", className: "bg-[hsl(var(--status-success))]/15 text-[hsl(var(--status-success))]" },
};

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCampaign = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    else setRefreshing(true);

    try {
      const { data, error } = await supabase.functions.invoke("brevo-campaigns", {
        body: { action: "get", id },
      });
      if (error) throw error;
      const parsed = typeof data === "string" ? JSON.parse(data) : data;
      setCampaign(parsed);
    } catch (err: any) {
      toast.error("Error cargando campaña");
      console.error(err);
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { fetchCampaign(); }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Campaña no encontrada</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/campaigns")}>Volver</Button>
      </div>
    );
  }

  const stats = campaign.stats_json || {};
  const badge = statusBadge[campaign.status] || statusBadge.draft;

  // Mock hourly data for chart
  const hourlyData = Array.from({ length: 24 }, (_, i) => ({
    hour: `${i}h`,
    aperturas: stats.opened ? Math.round((stats.opened / 24) * (1 + Math.sin(i / 3) * 0.7)) : 0,
    clics: stats.clicked ? Math.round((stats.clicked / 24) * (1 + Math.sin(i / 4) * 0.5)) : 0,
  }));

  const kpis = [
    { label: "Enviados", value: stats.sent || campaign.recipient_count || 0, icon: Send, color: "text-foreground" },
    { label: "Aperturas", value: stats.opened || 0, sub: stats.openRate ? `${stats.openRate}%` : "—", icon: Eye, color: "text-[hsl(var(--status-success))]" },
    { label: "Clics", value: stats.clicked || 0, sub: stats.clickRate ? `${stats.clickRate}%` : "—", icon: MousePointer, color: "text-primary" },
    { label: "Bajas", value: stats.unsubscribed || 0, icon: UserMinus, color: "text-[hsl(var(--status-warning))]" },
    { label: "Rebotes", value: stats.bounced || 0, icon: AlertTriangle, color: "text-destructive" },
  ];

  return (
    <div className="max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => navigate("/campaigns")} className="shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl sm:text-2xl font-black tracking-tight truncate">{campaign.name}</h2>
              <Badge variant="outline" className={badge.className}>{badge.label}</Badge>
            </div>
            {campaign.subject && <p className="text-sm text-muted-foreground mt-0.5 truncate">{campaign.subject}</p>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchCampaign(false)} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? "animate-spin" : ""}`} /> Actualizar
          </Button>
          {campaign.brevo_campaign_id && (
            <Button variant="outline" size="sm" asChild>
              <a href={`https://app.brevo.com/marketing/campaigns/id/${campaign.brevo_campaign_id}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-1" /> Ver en Brevo
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="kpi-card animate-fade-in">
            <div className="flex items-center gap-2">
              <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{kpi.label}</span>
            </div>
            <div className="text-2xl font-black tracking-tight mt-2">{kpi.value.toLocaleString()}</div>
            {kpi.sub && <p className="text-xs text-muted-foreground">{kpi.sub}</p>}
          </div>
        ))}
      </div>

      {/* Chart */}
      {campaign.status === "sent" && (
        <Card className="animate-fade-in" style={{ animationDelay: "0.2s" }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider">Actividad primeras 24h</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="hour" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="aperturas" stroke="hsl(var(--status-success))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="clics" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Campaign info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider">Detalles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Remitente</span><span>{campaign.sender_name} &lt;{campaign.sender_email}&gt;</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Destinatarios</span><span className="font-bold">{campaign.recipient_count || 0}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Fecha envío</span><span>{campaign.sent_at ? new Date(campaign.sent_at).toLocaleString("es-ES") : "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">ID Brevo</span><span className="font-mono text-xs">{campaign.brevo_campaign_id || "—"}</span></div>
          </CardContent>
        </Card>

        {campaign.status === "draft" && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center h-full py-8">
              <p className="text-muted-foreground text-sm mb-3">Esta campaña aún no ha sido enviada</p>
              <Button variant="brand" onClick={() => navigate(`/campaigns/new`)}>
                <Send className="h-4 w-4 mr-1" /> Configurar envío
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
