import { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

interface AdminMetricCardProps {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
}

export function AdminMetricCard({ label, value, hint, icon: Icon }: AdminMetricCardProps) {
  return (
    <Card className="p-5 rounded-2xl border-border/60 hover:border-border transition-colors">
      <div className="flex items-start justify-between mb-4">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </div>
      <div className="text-3xl font-black tabular-nums text-foreground">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </Card>
  );
}
