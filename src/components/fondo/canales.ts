export type MetodoAporte = "pago_movil" | "zelle" | "binance";

export interface CanalConfig {
  metodo: MetodoAporte;
  titulo: string;
  monedaLabel: string; // visual badge
  moneda: "VES" | "USD" | "USDT";
  montoLabel: string;
  montoPlaceholder: string;
  datos: { label: string; value: string; copy?: boolean }[];
  datosPendientes?: boolean;
  notaCanal?: string;
}

export const CANALES: Record<MetodoAporte, CanalConfig> = {
  pago_movil: {
    metodo: "pago_movil",
    titulo: "pago móvil",
    monedaLabel: "BS · venezuela",
    moneda: "VES",
    montoLabel: "monto en bolívares (Bs)",
    montoPlaceholder: "0,00",
    datos: [
      { label: "teléfono", value: "0424-5957541", copy: true },
      { label: "banco", value: "Banco de Venezuela (0102)", copy: true },
      { label: "cédula", value: "V-26.007.816", copy: true },
    ],
    notaCanal:
      "haz la transferencia o pago móvil al destinatario indicado y luego sube el comprobante aquí.",
  },
  zelle: {
    metodo: "zelle",
    titulo: "zelle",
    monedaLabel: "US$ · estados unidos",
    moneda: "USD",
    montoLabel: "monto en dólares (US$)",
    montoPlaceholder: "0.00",
    datos: [],
    datosPendientes: true,
    notaCanal:
      "estamos terminando de habilitar este canal. si quieres aportar ahora por zelle, escríbenos y te pasamos los datos.",
  },
  binance: {
    metodo: "binance",
    titulo: "binance",
    monedaLabel: "USDT · cripto",
    moneda: "USDT",
    montoLabel: "monto en usdt",
    montoPlaceholder: "0.00",
    datos: [],
    datosPendientes: true,
    notaCanal:
      "estamos terminando de habilitar este canal. si quieres aportar ahora por binance pay, escríbenos y te pasamos los datos.",
  },
};
