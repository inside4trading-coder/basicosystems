/**
 * Definición central de métodos de pago del POS Sublime.
 * Añadir un método nuevo aquí no requiere tocar la interfaz de cobro.
 */
export type PosPaymentMethodId =
  | "card"
  | "mobile_payment"
  | "cash_usd"
  | "cash_ves"
  | "zelle"
  | "transfer"
  | "cashea";

export type PosCurrency = "USD" | "VES";

export interface PosPaymentField {
  id: "bank" | "reference" | "terminal" | "holder" | "installments";
  label: string;
  required?: boolean;
  placeholder?: string;
}

export interface PosPaymentMethodDef {
  id: PosPaymentMethodId;
  label: string;
  currency: PosCurrency;
  hint?: string;
  fields: PosPaymentField[];
}

export const POS_PAYMENT_METHODS: PosPaymentMethodDef[] = [
  {
    id: "card",
    label: "Punto de venta",
    currency: "VES",
    fields: [
      { id: "terminal", label: "Terminal", required: true, placeholder: "Terminal 1" },
      { id: "reference", label: "Referencia", placeholder: "Últimos 6 dígitos" },
    ],
  },
  {
    id: "mobile_payment",
    label: "Pago móvil",
    currency: "VES",
    fields: [
      { id: "bank", label: "Banco", required: true, placeholder: "Banesco" },
      { id: "reference", label: "Referencia", required: true, placeholder: "004512" },
    ],
  },
  { id: "cash_usd", label: "Efectivo REF", currency: "USD", fields: [] },
  { id: "cash_ves", label: "Efectivo VES", currency: "VES", fields: [] },
  {
    id: "zelle",
    label: "Zelle",
    currency: "USD",
    fields: [
      { id: "holder", label: "Titular", placeholder: "Nombre del emisor" },
      { id: "reference", label: "Referencia", required: true, placeholder: "ZL-2291" },
    ],
  },
  {
    id: "transfer",
    label: "Transferencia",
    currency: "VES",
    fields: [
      { id: "bank", label: "Banco", required: true, placeholder: "Mercantil" },
      { id: "reference", label: "Referencia", required: true },
    ],
  },
  {
    id: "cashea",
    label: "Cashea",
    currency: "USD",
    hint: "Pago en cuotas",
    fields: [
      { id: "reference", label: "Orden Cashea", required: true },
      { id: "installments", label: "Cuotas", placeholder: "4" },
    ],
  },
];

export const posMethod = (id: PosPaymentMethodId): PosPaymentMethodDef =>
  POS_PAYMENT_METHODS.find((m) => m.id === id) ?? POS_PAYMENT_METHODS[0];
