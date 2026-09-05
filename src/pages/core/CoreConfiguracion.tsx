import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import GeneralTab from "@/components/core/config/GeneralTab";
import SkuTab from "@/components/core/config/SkuTab";
import QrLabelTab from "@/components/core/config/QrLabelTab";
import LocationsTab from "@/components/core/config/LocationsTab";
import WooStatusRulesTab from "@/components/core/config/WooStatusRulesTab";
import RolesTab from "@/components/core/config/RolesTab";

export default function CoreConfiguracion() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="num text-3xl font-black tracking-tight">Configuración Core</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Parámetros base del módulo de fábrica Basico Core.
        </p>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="sku">SKU</TabsTrigger>
          <TabsTrigger value="qr">Etiquetas QR</TabsTrigger>
          <TabsTrigger value="locations">Sedes / Ubicaciones</TabsTrigger>
          <TabsTrigger value="woo">Estados WooCommerce</TabsTrigger>
          <TabsTrigger value="roles">Roles Core</TabsTrigger>
        </TabsList>
        <TabsContent value="general" className="mt-6"><GeneralTab /></TabsContent>
        <TabsContent value="sku" className="mt-6"><SkuTab /></TabsContent>
        <TabsContent value="qr" className="mt-6"><QrLabelTab /></TabsContent>
        <TabsContent value="locations" className="mt-6"><LocationsTab /></TabsContent>
        <TabsContent value="woo" className="mt-6"><WooStatusRulesTab /></TabsContent>
        <TabsContent value="roles" className="mt-6"><RolesTab /></TabsContent>
      </Tabs>
    </div>
  );
}
