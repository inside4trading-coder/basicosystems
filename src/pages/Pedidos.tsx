import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

const mockOrders = [
  { id: "#1247", client: "María López", products: "Camiseta Basic White x2", total: "€59.90", status: "completado", date: "22 Mar 2026" },
  { id: "#1246", client: "Carlos Ruiz", products: "Hoodie Oversize Black", total: "€89.00", status: "procesando", date: "22 Mar 2026" },
  { id: "#1245", client: "Ana García", products: "Jogger Essential Grey, Cap Red", total: "€112.50", status: "pendiente", date: "21 Mar 2026" },
  { id: "#1244", client: "Luis Martín", products: "Tote Bag Logo", total: "€24.90", status: "completado", date: "21 Mar 2026" },
  { id: "#1243", client: "Sara Fernández", products: "Camiseta Basic White", total: "€29.95", status: "cancelado", date: "20 Mar 2026" },
];

const statusClass: Record<string, string> = {
  completado: "status-badge-success",
  procesando: "status-badge-inactive",
  pendiente: "status-badge-warning",
  cancelado: "status-badge-error",
};

export default function Pedidos() {
  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black tracking-tight">Pedidos</h2>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar pedido..." className="pl-9 bg-card" />
        </div>
      </div>

      <div className="bg-card rounded-lg border border-border overflow-hidden animate-fade-in">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">ID</th>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Cliente</th>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Productos</th>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Total</th>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Estado</th>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {mockOrders.map((order) => (
              <tr key={order.id} className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer transition-colors">
                <td className="px-4 py-3 font-bold">{order.id}</td>
                <td className="px-4 py-3">{order.client}</td>
                <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{order.products}</td>
                <td className="px-4 py-3 font-bold">{order.total}</td>
                <td className="px-4 py-3">
                  <span className={statusClass[order.status]}>{order.status}</span>
                </td>
                <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{order.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
