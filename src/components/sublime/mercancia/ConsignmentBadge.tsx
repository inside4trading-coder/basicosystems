import { Badge } from "@/components/ui/badge";
import { useMerchBrandConfig } from "./brand";

export function ConsignmentBadge({ percentage }: { percentage: number | null | undefined }) {
  const { label } = useMerchBrandConfig();
  const pct = Number(percentage ?? 0);
  return (
    <Badge variant="outline" className="border-amber-500/50 text-amber-700 dark:text-amber-400 text-[10px] whitespace-nowrap">
      CONSIGNACIÓN · {pct}% {label}
    </Badge>
  );
}
