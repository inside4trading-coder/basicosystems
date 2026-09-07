import { Info } from "lucide-react";
import { MOCK_NOTICE } from "@/lib/sublimeMock";

export function MockNotice({ text = MOCK_NOTICE }: { text?: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
      <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
      <span>{text}</span>
    </div>
  );
}
