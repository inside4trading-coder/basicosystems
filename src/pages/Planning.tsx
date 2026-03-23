import { AlertTriangle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

const mockLists = [
  {
    name: "Por hacer",
    cards: [
      { title: "Diseñar lookbook primavera", labels: ["#E3001B"], due: "25 Mar 2026", member: "ML", overdue: false },
      { title: "Revisar stock camisetas", labels: ["#FFC107"], due: "20 Mar 2026", member: "CR", overdue: true },
    ],
  },
  {
    name: "En progreso",
    cards: [
      { title: "Shooting nueva colección", labels: ["#E3001B", "#4CAF50"], due: "28 Mar 2026", member: "AG", overdue: false },
    ],
  },
  {
    name: "Hecho",
    cards: [
      { title: "Publicar catálogo web", labels: ["#4CAF50"], due: "18 Mar 2026", member: "LM", overdue: false },
      { title: "Actualizar precios WooCommerce", labels: ["#FFC107"], due: "15 Mar 2026", member: "ML", overdue: false },
    ],
  },
];

export default function Planning() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black tracking-tight">Planning</h2>
        <div className="flex items-center gap-3">
          <select className="text-sm border border-border rounded-md px-3 py-2 bg-card font-semibold">
            <option>Producción SS26</option>
            <option>Marketing Q1</option>
            <option>Logística</option>
          </select>
          <Button variant="brand" size="sm">
            <Plus className="h-4 w-4 mr-1" /> Nueva card
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in">
        {mockLists.map((list) => (
          <div key={list.name} className="bg-muted/50 rounded-lg p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
              {list.name} ({list.cards.length})
            </h3>
            <div className="space-y-3">
              {list.cards.map((card) => (
                <div key={card.title} className="bg-card rounded-lg border border-border p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex gap-1 mb-2">
                    {card.labels.map((color) => (
                      <span key={color} className="w-8 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                    ))}
                  </div>
                  <p className="text-sm font-semibold mb-2">{card.title}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      {card.overdue && <AlertTriangle className="h-3 w-3 text-status-error" />}
                      <span className={card.overdue ? "text-status-error font-bold" : ""}>{card.due}</span>
                    </div>
                    <span className="w-6 h-6 rounded-full bg-secondary text-secondary-foreground text-[10px] font-bold flex items-center justify-center">
                      {card.member}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
