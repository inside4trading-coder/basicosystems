import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shirt, ExternalLink, AlertTriangle, CheckCircle2 } from "lucide-react";

interface RecipeItem {
  id: string;
  material_id: string;
  quantity_per_unit: number;
  size_strategy: string;
}
interface Recipe {
  id: string;
  name: string | null;
  status: string;
  items: RecipeItem[];
}
interface Material {
  id: string;
  name: string;
  material_type: string;
  color: string | null;
  size: string | null;
}

export function ProductRecipeCard({ productId }: { productId: string }) {
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [materials, setMaterials] = useState<Record<string, Material>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: recipes } = await supabase
        .from("esp_product_material_recipes")
        .select("id,name,status")
        .eq("product_id", productId)
        .is("variant_id", null)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1);
      const r = recipes?.[0];
      if (!r) { setRecipe(null); setLoading(false); return; }
      const { data: items } = await supabase
        .from("esp_product_material_recipe_items")
        .select("id,material_id,quantity_per_unit,size_strategy")
        .eq("recipe_id", r.id);
      const itemList = (items || []) as RecipeItem[];
      const matIds = itemList.map(i => i.material_id);
      const { data: mats } = matIds.length
        ? await supabase.from("esp_material_items").select("id,name,material_type,color,size").in("id", matIds)
        : { data: [] as Material[] };
      const map: Record<string, Material> = {};
      (mats as Material[] | null)?.forEach(m => { map[m.id] = m; });
      setMaterials(map);
      setRecipe({ id: r.id, name: r.name, status: r.status, items: itemList });
      setLoading(false);
    })();
  }, [productId]);

  return (
    <div className="mt-5 border-t pt-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold flex items-center gap-2">
            <Shirt className="h-4 w-4" /> Receta de fabricación (Blank + DTF)
          </h4>
          <p className="text-xs text-muted-foreground">
            Materiales que se consumen cada vez que se fabrica una unidad. Se resuelve por talla automáticamente.
          </p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link to="/espana/blanks-dtf" target="_blank">
            <ExternalLink className="h-3.5 w-3.5 mr-1" /> Editar en Blanks/DTF
          </Link>
        </Button>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Cargando receta…</p>
      ) : !recipe ? (
        <div className="flex items-start gap-2 text-xs bg-amber-500/10 border border-amber-300/40 rounded p-3">
          <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600 shrink-0" />
          <div>
            <p className="font-semibold text-amber-800">Sin receta activa</p>
            <p className="text-amber-700/80 mt-0.5">
              Este producto es de fabricación ligera pero no tiene definido qué blank ni qué DTF consume.
              Créala desde <Link to="/espana/blanks-dtf" className="underline font-medium">Blanks/DTF → pestaña Recetas</Link>.
            </p>
          </div>
        </div>
      ) : (
        <div className="border rounded-lg divide-y">
          {recipe.items.length === 0 && (
            <div className="p-3 text-xs text-muted-foreground">La receta existe pero no tiene materiales.</div>
          )}
          {recipe.items.map(it => {
            const m = materials[it.material_id];
            const isBlank = m?.material_type === "blank";
            const isDtf = m?.material_type === "dtf";
            return (
              <div key={it.id} className="p-3 flex items-center gap-3 text-sm">
                <Badge variant={isDtf ? "default" : isBlank ? "secondary" : "outline"} className="uppercase text-[10px]">
                  {m?.material_type || "?"}
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{m?.name || "Material eliminado"}</p>
                  <p className="text-xs text-muted-foreground">
                    {m?.color ? `Color: ${m.color}` : null}
                    {m?.size ? ` · Talla base: ${m.size}` : null}
                    {it.size_strategy === "match_variant_size" && (
                      <span className="ml-1 inline-flex items-center gap-1 text-emerald-700">
                        <CheckCircle2 className="h-3 w-3" /> talla se resuelve por variante
                      </span>
                    )}
                  </p>
                </div>
                <div className="text-xs text-muted-foreground whitespace-nowrap">
                  {Number(it.quantity_per_unit)} × unidad
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
