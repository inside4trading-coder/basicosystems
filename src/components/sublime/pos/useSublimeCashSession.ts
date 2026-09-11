import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const sb = supabase as any;

/**
 * Cajas y sesiones de caja REALES del POS Sublime.
 * La fuente de verdad es siempre el servidor: la pantalla solo consulta.
 * CAJA → SESIÓN → APERTURA → VENTAS → MOVIMIENTOS → CIERRE.
 */

export interface SublimeRegister {
  id: string;
  location_id: string;
  name: string;
  code: string | null;
  is_active: boolean;
}

export interface SublimeCashSession {
  id: string;
  register_id: string;
  location_id: string;
  session_number: string;
  cashier_user_id: string;
  cashier_name: string | null;
  status: "open" | "closed";
  opened_at: string;
  closed_at: string | null;
  opening_ref: number;
  opening_bs: number;
  counted_ref: number | null;
  counted_bs: number | null;
  expected_ref: number | null;
  expected_bs: number | null;
  difference_ref: number | null;
  difference_bs: number | null;
}

export interface SublimeCashMovement {
  id: string;
  movement_type: "opening" | "cash_in" | "cash_out" | "sale_cash" | "closing_adjustment";
  currency: "USD" | "VES";
  amount: number;
  note: string | null;
  created_at: string;
  sale_id: string | null;
}

export interface SublimeCashSessionSummary {
  session_id: string;
  session_number: string;
  status: string;
  opened_at: string;
  closed_at: string | null;
  opening_ref: number;
  opening_bs: number;
  expected_ref: number;
  expected_bs: number;
  sales_count: number;
  gross_ref: number;
  discount_ref: number;
  net_ref: number;
  by_method: { method: string; currency: string; amount: number; amount_ref: number }[];
  by_origin: { origin: string; sales: number; total_ref: number }[];
}

/** Cajas configuradas de la sede. */
export function useSublimeRegisters(locationId?: string | null) {
  return useQuery({
    queryKey: ["sublime_registers", locationId],
    enabled: !!locationId,
    queryFn: async () => {
      const { data, error } = await sb
        .from("sublime_registers")
        .select("*")
        .eq("location_id", locationId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as SublimeRegister[];
    },
  });
}

/** Sesión abierta de una caja: sobrevive refresh, navegación y cambio de equipo. */
export function useActiveCashSession(registerId?: string | null) {
  return useQuery({
    queryKey: ["sublime_cash_session", registerId],
    enabled: !!registerId,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await sb
        .from("sublime_cash_sessions")
        .select("*")
        .eq("register_id", registerId)
        .eq("status", "open")
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as SublimeCashSession | null;
    },
  });
}

/** Movimientos de efectivo de la sesión (libro de caja, no de inventario). */
export function useCashMovements(sessionId?: string | null) {
  return useQuery({
    queryKey: ["sublime_cash_movements", sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      const { data, error } = await sb
        .from("sublime_cash_movements")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SublimeCashMovement[];
    },
  });
}

/** Resumen calculado por el servidor: efectivo esperado, ventas, métodos y orígenes. */
export function useCashSessionSummary(sessionId?: string | null) {
  return useQuery({
    queryKey: ["sublime_cash_summary", sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      const { data, error } = await sb.rpc("sublime_cash_session_summary", {
        p_session_id: sessionId,
      });
      if (error) throw error;
      return data as SublimeCashSessionSummary;
    },
  });
}

function useCashInvalidation() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["sublime_cash_session"] });
    qc.invalidateQueries({ queryKey: ["sublime_cash_movements"] });
    qc.invalidateQueries({ queryKey: ["sublime_cash_summary"] });
  };
}

export function useOpenCashSession() {
  const invalidate = useCashInvalidation();
  return useMutation({
    mutationFn: async (p: {
      registerId: string;
      openingRef: number;
      openingBs: number;
      cashierName: string;
      note: string;
    }) => {
      const { data, error } = await sb.rpc("sublime_open_cash_session", {
        p_register_id: p.registerId,
        p_opening_ref: p.openingRef,
        p_opening_bs: p.openingBs,
        p_cashier_name: p.cashierName,
        p_note: p.note || null,
      });
      if (error) throw error;
      return data as { session_id: string; session_number: string; already_open: boolean };
    },
    onSuccess: invalidate,
  });
}

export function useRegisterCashMovement() {
  const invalidate = useCashInvalidation();
  return useMutation({
    mutationFn: async (p: {
      sessionId: string;
      type: "cash_in" | "cash_out";
      currency: "USD" | "VES";
      amount: number;
      note: string;
      idempotencyKey: string;
    }) => {
      const { data, error } = await sb.rpc("sublime_register_cash_movement", {
        p_session_id: p.sessionId,
        p_movement_type: p.type,
        p_currency: p.currency,
        p_amount: p.amount,
        p_note: p.note,
        p_idempotency_key: p.idempotencyKey,
      });
      if (error) throw error;
      return data as { movement_id: string; duplicate: boolean };
    },
    onSuccess: invalidate,
  });
}

export function useCloseCashSession() {
  const invalidate = useCashInvalidation();
  return useMutation({
    mutationFn: async (p: {
      sessionId: string;
      countedRef: number;
      countedBs: number;
      note: string;
    }) => {
      const { data, error } = await sb.rpc("sublime_close_cash_session", {
        p_session_id: p.sessionId,
        p_counted_ref: p.countedRef,
        p_counted_bs: p.countedBs,
        p_note: p.note || null,
      });
      if (error) throw error;
      return data as {
        session_id: string;
        already_closed: boolean;
        expected_ref: number;
        expected_bs: number;
        difference_ref: number;
        difference_bs: number;
      };
    },
    onSuccess: invalidate,
  });
}

/** Etiqueta legible de cada tipo de movimiento de caja. */
export const cashMovementLabel = (t: SublimeCashMovement["movement_type"]) =>
  t === "opening"
    ? "Apertura"
    : t === "cash_in"
      ? "Entrada"
      : t === "cash_out"
        ? "Retiro"
        : t === "sale_cash"
          ? "Venta en efectivo"
          : "Ajuste de cierre";
