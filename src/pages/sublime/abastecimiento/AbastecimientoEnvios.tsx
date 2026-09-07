import { useState } from "react";
import { FileDown, Percent, Plus, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { ShipmentEditorDialog } from "@/components/sublime/mercancia/ShipmentEditorDialog";
import { ShipmentsManagerDialog } from "@/components/sublime/mercancia/ShipmentsManagerDialog";
import { PricingRulesDialog } from "@/components/sublime/mercancia/PricingRulesDialog";
import {
  useSublimeShipments,
  useSublimeBoxes,
  useSublimePricingRules,
  fetchAllSublimeMerchItemsForCsv,
} from "@/hooks/useSublimeMerch";
import { downloadSublimeMerchCsv } from "@/lib/sublimeMerch";

export default function AbastecimientoEnvios() {
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
      const items = await fetchAllSublimeMerchItemsForCsv("sublime");
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
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setOpenNewShip(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo envío
        </Button>
        <Button variant="outline" onClick={() => setOpenManage(true)}>
          <Truck className="h-4 w-4 mr-2" />
          Gestionar envíos y cajas
        </Button>
        <Button variant="outline" onClick={() => setOpenPricing(true)}>
          <Percent className="h-4 w-4 mr-2" />
          Configurar precios
        </Button>
        <Button variant="outline" onClick={handleExportCsv} disabled={exporting}>
          <FileDown className="h-4 w-4 mr-2" />
          {exporting ? "Exportando…" : "Exportar CSV"}
        </Button>
      </div>

      <Card className="p-5 rounded-2xl border-border/60">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Envíos activos
        </p>
        <p className="num text-3xl font-black tabular-nums text-foreground mt-1">
          {shipments.length}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {allBoxes.length} caja{allBoxes.length === 1 ? "" : "s"} registradas ·{" "}
          {pricingRules.length} regla{pricingRules.length === 1 ? "" : "s"} de precio
        </p>
      </Card>

      <ShipmentEditorDialog open={openNewShip} onOpenChange={setOpenNewShip} />
      <ShipmentsManagerDialog open={openManage} onOpenChange={setOpenManage} />
      <PricingRulesDialog open={openPricing} onOpenChange={setOpenPricing} />
    </div>
  );
}
