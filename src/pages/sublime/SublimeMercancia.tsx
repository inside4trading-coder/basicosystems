import { useMemo, useState } from "react";
import { Package, Plus, Truck, FileDown, Percent, ShoppingCart, Ship } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { ItemsUnassignedTab } from "@/components/sublime/mercancia/ItemsUnassignedTab";
import { ItemsInTransitTab } from "@/components/sublime/mercancia/ItemsInTransitTab";
import { ItemsAvailableTab } from "@/components/sublime/mercancia/ItemsAvailableTab";
import { ShipmentEditorDialog } from "@/components/sublime/mercancia/ShipmentEditorDialog";
import { ShipmentsManagerDialog } from "@/components/sublime/mercancia/ShipmentsManagerDialog";
import { PricingRulesDialog } from "@/components/sublime/mercancia/PricingRulesDialog";
import {
  useItemsCounts,
  useSublimeShipments,
  useSublimeBoxes,
  useSublimePricingRules,
  useSublimeMerchSummary,
  fetchAllSublimeMerchItemsForCsv,
} from "@/hooks/useSublimeMerch";
import {
  downloadSublimeMerchCsv,
  calculateStockValuePurchased,
  calculateStockValueInTransit,
  type StockValueSummary,
} from "@/lib/sublimeMerch";

export default function SublimeMercancia() {
  const { data: counts } = useItemsCounts();
  const { data: shipments = [] } = useSublimeShipments();
  const { data: allBoxes = [] } = useSublimeBoxes(null);
  const { data: pricingRules = [] } = useSublimePricingRules();
  const [openNewShip, setOpenNewShip] = useState(false);
  const [openManage, setOpenManage] = useState(false);
  const [openPricing, setOpenPricing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const items = await fetchAllSublimeMerchItemsForCsv();
      if (items.length === 0) {
        toast.info("No hay productos para exportar.");
        return;
      }
      downloadSublimeMerchCsv(items, shipments, allBoxes, pricingRules);
      toast.success(`CSV exportado (${items.length} productos)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al exportar");
    } finally {
      setExporting(false);
    }
  };


  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
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
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={handleExportCsv} disabled={exporting}>
            <FileDown className="h-4 w-4 mr-2" />
            {exporting ? "Exportando…" : "Exportar CSV"}
          </Button>
          <Button variant="outline" onClick={() => setOpenPricing(true)}>
            <Percent className="h-4 w-4 mr-2" />
            Configurar precios
          </Button>
          <Button variant="outline" onClick={() => setOpenManage(true)}>
            <Truck className="h-4 w-4 mr-2" />
            Gestionar envíos
          </Button>
          <Button onClick={() => setOpenNewShip(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo envío
          </Button>
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
          <ItemsInTransitTab />
        </TabsContent>

        <TabsContent value="available">
          <ItemsAvailableTab />
        </TabsContent>
      </Tabs>

      <ShipmentEditorDialog open={openNewShip} onOpenChange={setOpenNewShip} />
      <ShipmentsManagerDialog open={openManage} onOpenChange={setOpenManage} />
      <PricingRulesDialog open={openPricing} onOpenChange={setOpenPricing} />

    </div>
  );
}
