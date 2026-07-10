import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExternalPendingEventsList } from "./ExternalPendingEventsList";
import { ExternalOrdersList } from "./ExternalOrdersList";

export function ExternalReplenishmentPanel() {
  return (
    <Tabs defaultValue="pending">
      <TabsList>
        <TabsTrigger value="pending">Pendientes</TabsTrigger>
        <TabsTrigger value="orders">Órdenes</TabsTrigger>
        <TabsTrigger value="received">Recibidas</TabsTrigger>
      </TabsList>
      <TabsContent value="pending" className="mt-3">
        <ExternalPendingEventsList />
      </TabsContent>
      <TabsContent value="orders" className="mt-3">
        <ExternalOrdersList />
      </TabsContent>
      <TabsContent value="received" className="mt-3">
        <p className="text-sm text-muted-foreground mb-2">
          Órdenes recibidas completamente. La entrada a inventario queda pendiente para una próxima fase.
        </p>
        <ExternalOrdersList initialStatus="received" />
      </TabsContent>
    </Tabs>
  );
}
