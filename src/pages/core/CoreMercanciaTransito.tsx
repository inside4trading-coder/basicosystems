import { MercanciaModule } from "@/components/sublime/mercancia/MercanciaModule";
import { BASICO_MERCH_CONFIG } from "@/components/sublime/mercancia/brand";

export default function CoreMercanciaTransito() {
  return <MercanciaModule config={BASICO_MERCH_CONFIG} />;
}
