import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCoreStatusRules, useUpdateStatusRule, type CoreStatusRule } from "@/hooks/useCoreStatusRules";
import { toast } from "@/hooks/use-toast";

const groupLabel: Record<CoreStatusRule["status_group"], string> = {
  confirmado: "Confirmado / entra a producción",
  pendiente: "Pendiente / monitoreado",
  excluido: "Excluido",
};

const groupVariant: Record<CoreStatusRule["status_group"], "default" | "secondary" | "destructive"> = {
  confirmado: "default",
  pendiente: "secondary",
  excluido: "destructive",
};

export default function WooStatusRulesTab() {
  const { data: rules = [], isLoading } = useCoreStatusRules();
  const update = useUpdateStatusRule();
  const [filter, setFilter] = useState<string>("all");

  const filtered = useMemo(
    () => filter === "all" ? rules : rules.filter(r => r.status_group === filter),
    [rules, filter]
  );

  const toggle = async (rule: CoreStatusRule, field: keyof CoreStatusRule, value: boolean) => {
    try {
      await update.mutateAsync({ id: rule.id, [field]: value } as any);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Card className="p-6 rounded-2xl space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="text-lg font-bold">Estados WooCommerce</h3>
          <p className="text-sm text-muted-foreground">Define qué estados entran a producción.</p>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[240px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los grupos</SelectItem>
            <SelectItem value="confirmado">Confirmado</SelectItem>
            <SelectItem value="pendiente">Pendiente</SelectItem>
            <SelectItem value="excluido">Excluido</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Estado</TableHead>
            <TableHead>Grupo</TableHead>
            <TableHead className="text-center">Producción</TableHead>
            <TableHead className="text-center">Monitoreado</TableHead>
            <TableHead className="text-center">Excluido</TableHead>
            <TableHead className="text-center">Activo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow><TableCell colSpan={6} className="text-muted-foreground">Cargando…</TableCell></TableRow>
          )}
          {filtered.map((r) => (
            <TableRow key={r.id}>
              <TableCell>
                <p className="font-medium">{r.canonical_name}</p>
                <code className="text-xs text-muted-foreground">{r.slug}</code>
              </TableCell>
              <TableCell>
                <Badge variant={groupVariant[r.status_group]}>{groupLabel[r.status_group]}</Badge>
              </TableCell>
              <TableCell className="text-center">
                <Switch checked={r.enters_production} onCheckedChange={(v) => toggle(r, "enters_production", v)} />
              </TableCell>
              <TableCell className="text-center">
                <Switch checked={r.monitored} onCheckedChange={(v) => toggle(r, "monitored", v)} />
              </TableCell>
              <TableCell className="text-center">
                <Switch checked={r.excluded} onCheckedChange={(v) => toggle(r, "excluded", v)} />
              </TableCell>
              <TableCell className="text-center">
                <Switch checked={r.active} onCheckedChange={(v) => toggle(r, "active", v)} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
