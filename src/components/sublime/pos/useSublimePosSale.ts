import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PosCartLine } from "./usePosCart";
import type { PosPaymentLine } from "./PosPaymentSheet";
import { posMethod } from "@/lib/posPaymentMethods";
import type { PosCustomer } from "./PosCustomerDialog";
import type { PosSalesChannelId } from "@/lib/posSalesChannels";

const sb = supabase as any;

export interface RegisterSaleInput {
  /** Clave del intento de cobro: el mismo intento nunca crea dos ventas. */
  idempotencyKey: string;
  locationId: string;
  channel: PosSalesChannelId;
  channelDetail: string;
  lines: PosCartLine[];
  payments: PosPaymentLine[];
  customer: PosCustomer | null;
  invoiceNumber: string;
  note: string;
  rate: number;
  registerCode: string;
  cashierCode: string;
  sessionCode: string;
  /** Sesión de caja abierta: sin ella el servidor rechaza la venta. */
  cashSessionId: string;
}

const toRef = (amount: number, currency: "USD" | "VES", rate: number) =>
  currency === "USD" ? amount : rate > 0 ? amount / rate : 0;

/**
 * Cobro real del POS Sublime.
 * Toda la venta (líneas, pagos, descuento de stock y movimiento auditable)
 * ocurre dentro de una única operación de base de datos: o entra completa o
 * no entra nada. El stock se vuelve a verificar en el servidor.
 */
export function useRegisterSublimePosSale() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: RegisterSaleInput) => {
      const items = input.lines.map((l) => ({
        line_kind: l.kind,
        product_id: l.product?.id ?? null,
        variant_id: l.variant?.id ?? null,
        sku: l.sku ?? null,
        title: l.title,
        subtitle: l.subtitle,
        qty: l.qty,
        unit_regular_ref: Number(l.regularPrice.toFixed(2)),
        unit_final_ref: Number(l.finalPrice.toFixed(2)),
        discount_ref: Number(l.discountTotal.toFixed(2)),
        line_total_ref: Number(l.lineTotal.toFixed(2)),
      }));

      const payments = input.payments.map((p) => {
        const def = posMethod(p.method);
        const amount = Number(p.amount) || 0;
        return {
          method: p.method,
          currency: def.currency,
          amount,
          amount_ref: Number(toRef(amount, def.currency, input.rate).toFixed(2)),
          bank: p.fields.bank ?? null,
          reference: p.fields.reference ?? null,
          extra: p.fields ?? {},
        };
      });

      const customer = input.customer
        ? {
            id: (input.customer as any).id ?? "",
            name: input.customer.name,
            id_card: input.customer.idCard,
            phone: input.customer.phone,
            email: input.customer.email,
            birth_date: input.customer.birthDate,
            address: input.customer.address,
          }
        : null;

      const { data, error } = await sb.rpc("sublime_register_pos_sale", {
        p_idempotency_key: input.idempotencyKey,
        p_location_id: input.locationId,
        p_sale_origin: input.channel,
        p_items: items,
        p_payments: payments,
        p_origin_detail: input.channelDetail || null,
        p_customer: customer,
        p_invoice_number: input.invoiceNumber || null,
        p_note: input.note || null,
        p_bcv_rate: input.rate,
        p_register_code: input.registerCode,
        p_cashier_code: input.cashierCode,
        p_session_code: input.sessionCode,
        p_cash_session_id: input.cashSessionId,
      });
      if (error) throw error;
      return data as { sale_id: string; sale_number: string; duplicate: boolean };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sublime_pos_catalog"] });
      qc.invalidateQueries({ queryKey: ["sublime_inv_all"] });
      qc.invalidateQueries({ queryKey: ["sublime_inv_movements"] });
      qc.invalidateQueries({ queryKey: ["sublime_pos_sales"] });
      qc.invalidateQueries({ queryKey: ["sublime_cash_movements"] });
      qc.invalidateQueries({ queryKey: ["sublime_cash_summary"] });
    },
  });
}
