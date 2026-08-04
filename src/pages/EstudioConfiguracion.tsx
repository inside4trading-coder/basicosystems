import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import PromptTab from "@/components/estudio/config/PromptTab";
import BrandTab from "@/components/estudio/config/BrandTab";

export default function EstudioConfiguracion() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Configuración — Estudio Visual</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Prompts de IA por tipo de fotografía y plantilla de marca para las variantes de Instagram.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/estudio-visual">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="prompts" className="w-full">
        <TabsList>
          <TabsTrigger value="prompts">Prompt IA</TabsTrigger>
          <TabsTrigger value="brand">Plantilla Instagram</TabsTrigger>
        </TabsList>
        <TabsContent value="prompts" className="mt-6">
          <PromptTab />
        </TabsContent>
        <TabsContent value="brand" className="mt-6">
          <BrandTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
