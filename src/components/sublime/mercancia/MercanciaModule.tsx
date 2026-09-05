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
import { MerchBrandProvider, useMerchBrandConfig, type MerchBrandConfig } from "@/components/sublime/mercancia/brand";
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

export function MercanciaModule({ config }: { config?: MerchBrandConfig }) {
  return (
    <MerchBrandProvider config={config}>
      <MercanciaContent />
    </MerchBrandProvider>
  );
}

function MercanciaContent() {
  const { brand, title, subtitle } = useMerchBrandConfig();
  const { data: counts } = useItemsCounts();
  const { data: shipments = [] } = useSublimeShipments();
  const { data: allBoxes = [] } = useSublimeBoxes(null);
  const { data: pricingRules = [] } = useSublimePricingRules();
  const [openNewShip, setOpenNewShip] = useState(false);
  const [openManage, setOpenManage] = useState(false);
  const [openPricing, setOpenPricing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { data: summaryData } = useSublimeMerchSummary();
  const { purchased, inTransit } = useMemo(() => {
    const items = summaryData?.items ?? [];
    const ships = summaryData?.shipments ?? [];
    return {
      purchased: calculateStockValuePurchased(items),
      inTransit: calculateStockValueInTransit(items, ships),
    };
  }, [summaryData]);

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const items = await fetchAllSublimeMerchItemsForCsv(brand);
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
            <h1 className="num text-3xl sm:text-4xl font-black text-foreground tracking-tight">
              {title}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StockValueCard
          label="Stock value merch comprada"
          hint="Productos comprados sin envío asignado."
          summary={purchased}
          icon={ShoppingCart}
        />
        <StockValueCard
          label="Stock value merch en camino"
          hint="Productos asignados a envío/caja en tránsito."
          summary={inTransit}
          icon={Ship}
        />
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

function StockValueCard({
  label,
  hint,
  summary,
  icon: Icon,
}: {
  label: string;
  hint: string;
  summary: StockValueSummary;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const amount = new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(summary.amountEur);
  return (
    <Card className="p-5 rounded-2xl border-border/60">
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </div>
      <div className="num text-3xl font-black tabular-nums text-foreground">{amount}</div>
      <div className="text-xs text-muted-foreground mt-1">
        {summary.itemCount} producto{summary.itemCount === 1 ? "" : "s"} · {summary.unitCount} unidad
        {summary.unitCount === 1 ? "" : "es"}
      </div>
      <div className="text-xs text-muted-foreground mt-1">{hint}</div>
    </Card>
  );
}
