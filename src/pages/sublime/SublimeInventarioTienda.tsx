import { InventoryLocationView } from "@/components/sublime/hub/InventoryLocationView";

export default function SublimeInventarioTienda() {
  return (
    <InventoryLocationView
      locationCode="BQ"
      title="Sublime Barquicenter"
      subtitle="Existencias oficiales en tienda: esta es la fuente de stock vendible en POS"
      showPosStatus
    />
  );
}
