import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const mockCustomers = [
  { name: "María López", email: "maria@email.com", totalSpent: "€487.30", orders: 8, lastPurchase: "22 Mar 2026", segment: "VIP" },
  { name: "Carlos Ruiz", email: "carlos@email.com", totalSpent: "€89.00", orders: 1, lastPurchase: "22 Mar 2026", segment: "Único" },
  { name: "Ana García", email: "ana@email.com", totalSpent: "€245.60", orders: 4, lastPurchase: "15 Ene 2026", segment: "VIP" },
  { name: "Luis Martín", email: "luis@email.com", totalSpent: "€124.80", orders: 3, lastPurchase: "10 Mar 2026", segment: "Activo" },
  { name: "Sara Fernández", email: "sara@email.com", totalSpent: "€59.90", orders: 2, lastPurchase: "15 Oct 2025", segment: "Inactivo" },
];

const segmentClass: Record<string, string> = {
  VIP: "status-badge-error",
  Activo: "status-badge-success",
  Inactivo: "status-badge-warning",
  Único: "status-badge-inactive",
};

export default function CRM() {
  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-black tracking-tight">CRM</h2>
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar cliente..." className="pl-9 bg-card" />
          </div>
          <Button variant="brand" size="sm">Crear segmento</Button>
        </div>
      </div>

      {/* Segment filters */}
      <div className="flex gap-2 flex-wrap">
        {["Todos", "VIP", "Activo", "Inactivo", "Único"].map((seg) => (
          <button
            key={seg}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors ${
              seg === "Todos"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-foreground border-border hover:border-primary/50"
            }`}
          >
            {seg}
          </button>
        ))}
      </div>

      <div className="bg-card rounded-lg border border-border overflow-hidden animate-fade-in">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Nombre</th>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Email</th>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Total gastado</th>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Pedidos</th>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Última compra</th>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Segmento</th>
            </tr>
          </thead>
          <tbody>
            {mockCustomers.map((c) => (
              <tr key={c.email} className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer transition-colors">
                <td className="px-4 py-3 font-bold">{c.name}</td>
                <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{c.email}</td>
                <td className="px-4 py-3 font-bold">{c.totalSpent}</td>
                <td className="px-4 py-3 hidden lg:table-cell">{c.orders}</td>
                <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{c.lastPurchase}</td>
                <td className="px-4 py-3">
                  <span className={segmentClass[c.segment]}>{c.segment}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
