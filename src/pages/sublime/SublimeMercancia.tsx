import { Package } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ItemsUnassignedTab } from "@/components/sublime/mercancia/ItemsUnassignedTab";
import { useItemsCounts } from "@/hooks/useSublimeMerch";

export default function SublimeMercancia() {
  const { data: counts } = useItemsCounts();

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
          <Package className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">
            Sublime Mercancía
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Control de productos comprados, envíos, cajas y mercancía disponible.
          </p>
        </div>
      </div>

      <Tabs defaultValue="unassigned" className="space-y-4">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="unassigned">Compras sin asignar</TabsTrigger>
          <TabsTrigger value="in_transit">
            En camino
            {counts?.in_transit ? (
              <Badge variant="secondary" className="ml-2">
                {counts.in_transit}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="available">
            Disponible
            {counts?.available ? (
              <Badge variant="secondary" className="ml-2">
                {counts.available}
              </Badge>
            ) : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="unassigned">
          <ItemsUnassignedTab />
        </TabsContent>

        <TabsContent value="in_transit">
          <Card className="p-8 text-center text-sm text-muted-foreground">
            Disponible en la siguiente fase.
          </Card>
        </TabsContent>

        <TabsContent value="available">
          <Card className="p-8 text-center text-sm text-muted-foreground">
            Disponible en la siguiente fase.
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
