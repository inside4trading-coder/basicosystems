export type MetodoAporte = "pago_movil" | "zelle" | "binance" | "bizum";

export interface CanalConfig {
  metodo: MetodoAporte;
  titulo: string;
  monedaLabel: string; // visual badge
  moneda: "VES" | "USD" | "USDT"; // moneda con la que se guarda en BD
  montoLabel: string;
  montoPlaceholder: string;
  datos: { label: string; value: string; copy?: boolean }[];
  datosPendientes?: boolean;
  notaCanal?: string;
  // Campos del formulario:
  fields: {
    email: boolean;
    telefono: boolean;
    referencia: boolean;
    senderName: boolean; // "nombre de quien envía"
  };
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
    fields: { email: true, telefono: true, referencia: true, senderName: false },
  },
  zelle: {
    metodo: "zelle",
    titulo: "zelle",
    monedaLabel: "US$ · estados unidos",
    moneda: "USD",
    montoLabel: "monto en dólares (US$)",
    montoPlaceholder: "0.00",
    datos: [
      { label: "correo zelle", value: "sublimewallet@gmail.com", copy: true },
      { label: "titular", value: "Freddy Manuel Espinoza Fonseca", copy: true },
    ],
    notaCanal:
      "envía por zelle al correo indicado y luego sube el comprobante aquí.",
    fields: { email: false, telefono: false, referencia: true, senderName: true },
  },
  binance: {
    metodo: "binance",
    titulo: "binance pay",
    monedaLabel: "USDT · cripto",
    moneda: "USDT",
    montoLabel: "monto en usdt",
    montoPlaceholder: "0.00",
    datos: [
      { label: "nombre", value: "Basicoclothes", copy: true },
      { label: "binance pay id", value: "127509928", copy: true },
      { label: "correo", value: "paybasicoclothes@gmail.com", copy: true },
    ],
    notaCanal:
      "envía usdt por binance pay al ID o correo indicado y luego sube el comprobante aquí.",
    fields: { email: false, telefono: false, referencia: true, senderName: false },
  },
  bizum: {
    metodo: "bizum",
    titulo: "bizum",
    monedaLabel: "€ · españa (se contabiliza como US$ 1:1)",
    moneda: "USD", // por ahora los euros se cuentan como dólares
    montoLabel: "monto en euros (€)",
    montoPlaceholder: "0,00",
    datos: [
      { label: "teléfono bizum", value: "656375409", copy: true },
      { label: "titular", value: "Freddy Manuel Espinoza Fonseca", copy: true },
    ],
    notaCanal:
      "envía por bizum al número indicado y luego sube el comprobante aquí. de momento, los euros se contabilizan como dólares 1:1.",
    fields: { email: false, telefono: false, referencia: false, senderName: true },
  },
};
