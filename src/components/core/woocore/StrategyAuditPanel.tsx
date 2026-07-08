import { Loader2 } from "lucide-react";

interface Props { entries: any[]; loading: boolean; }

export function StrategyAuditPanel({ entries, loading }: Props) {
  if (loading) return <div className="p-8 text-center text-muted-foreground"><Loader2 className="inline animate-spin mr-2" />Cargando auditoría…</div>;
  if (entries.length === 0) return <div className="p-8 text-center text-muted-foreground text-sm">Sin decisiones registradas.</div>;
  return (
    <div className="overflow-x-auto border rounded-lg">
      <table className="w-full text-xs">
        <thead className="bg-muted/50 border-b">
          <tr className="text-left">
            <th className="p-2">Fecha</th>
            <th className="p-2">Tipo</th>
            <th className="p-2">Woo</th>
            <th className="p-2">Core</th>
            <th className="p-2">Antes</th>
            <th className="p-2">Después</th>
            <th className="p-2">Razón</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e: any) => (
            <tr key={e.id} className="border-b">
              <td className="p-2 whitespace-nowrap">{new Date(e.created_at).toLocaleString()}</td>
              <td className="p-2 font-mono text-[10px]">{e.decision_type}</td>
              <td className="p-2">{e.woo_product_id ?? "—"}</td>
              <td className="p-2 font-mono text-[10px]">{e.core_product_id ? e.core_product_id.slice(0, 8) : "—"}</td>
              <td className="p-2"><pre className="text-[10px] whitespace-pre-wrap max-w-[200px]">{e.previous_values ? JSON.stringify(e.previous_values) : "—"}</pre></td>
              <td className="p-2"><pre className="text-[10px] whitespace-pre-wrap max-w-[200px]">{e.new_values ? JSON.stringify(e.new_values) : "—"}</pre></td>
              <td className="p-2 max-w-[200px]">{e.reason ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
