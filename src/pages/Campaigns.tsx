import { Button } from "@/components/ui/button";
import { Plus, Mail } from "lucide-react";

const mockCampaigns = [
  { name: "Lanzamiento SS26", date: "15 Mar 2026", recipients: 342, openRate: 32.1, clickRate: 8.4, bounced: 3, performance: "good" },
  { name: "Flash Sale -20%", date: "1 Mar 2026", recipients: 512, openRate: 28.7, clickRate: 5.2, bounced: 7, performance: "good" },
  { name: "Newsletter Febrero", date: "15 Feb 2026", recipients: 489, openRate: 18.3, clickRate: 3.1, bounced: 12, performance: "mid" },
  { name: "Rebajas Invierno", date: "10 Ene 2026", recipients: 398, openRate: 12.4, clickRate: 1.8, bounced: 15, performance: "bad" },
];

const perfClass: Record<string, string> = {
  good: "status-badge-success",
  mid: "status-badge-warning",
  bad: "status-badge-error",
};

const perfLabel: Record<string, string> = {
  good: "Excelente",
  mid: "Regular",
  bad: "Bajo",
};

export default function Campaigns() {
  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black tracking-tight">Email Campaigns</h2>
        <Button variant="brand" size="sm">
          <Plus className="h-4 w-4 mr-1" /> Nueva campaña
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Campañas enviadas", value: "4" },
          { label: "Tasa apertura media", value: "22.9%" },
          { label: "Total destinatarios", value: "1,741" },
        ].map((stat, i) => (
          <div key={stat.label} className="kpi-card animate-fade-in" style={{ animationDelay: `${i * 80}ms` }}>
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{stat.label}</span>
            <div className="text-2xl font-black tracking-tight mt-1">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Campaigns table */}
      <div className="bg-card rounded-lg border border-border overflow-hidden animate-fade-in" style={{ animationDelay: "0.3s" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Campaña</th>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Fecha</th>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Destinatarios</th>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Apertura</th>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Clics</th>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Performance</th>
            </tr>
          </thead>
          <tbody>
            {mockCampaigns.map((c) => (
              <tr key={c.name} className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="font-bold">{c.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{c.date}</td>
                <td className="px-4 py-3">{c.recipients}</td>
                <td className="px-4 py-3 font-bold">{c.openRate}%</td>
                <td className="px-4 py-3 hidden lg:table-cell">{c.clickRate}%</td>
                <td className="px-4 py-3">
                  <span className={perfClass[c.performance]}>{perfLabel[c.performance]}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
