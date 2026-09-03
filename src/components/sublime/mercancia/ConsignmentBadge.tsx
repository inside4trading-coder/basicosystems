import { Badge } from "@/components/ui/badge";

export function ConsignmentBadge({ percentage }: { percentage: number | null | undefined }) {
  const pct = Number(percentage ?? 0);
  return (
    <Badge variant="outline" className="border-amber-500/50 text-amber-700 dark:text-amber-400 text-[10px] whitespace-nowrap">
      CONSIGNACIÓN · {pct}% SUBLIME
    </Badge>
  );
}
