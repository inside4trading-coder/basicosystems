/**
 * Cliente del Portal de Operario (BASICO CORE).
 * Habla con la edge function `core-operator-portal` y gestiona el token de sesión
 * y la preferencia de privacidad de montos por operario.
 */
import { supabase } from "@/integrations/supabase/client";

const TOKEN_KEY = "core_operator_portal_token";

export type PortalOperator = {
  id: string;
  name: string;
  alias: string | null;
  photo_url: string | null;
  roles: string[];
  allowed_processes: string[];
  pin_set?: boolean;
};

export type DashboardProcess = { label: string; count: number; amount: number };

export type PortalScan = {
  id: string;
  created_at: string;
  unit_code: string | null;
  product_name: string | null;
  variant: string | null;
  process_name: string | null;
  amount: number;
  payroll_status: string | null;
  source: string | null;
};

export type PortalDashboard = {
  week: { start: string; end: string };
  today: { processes: number; units: number; amount: number; last_scan_at: string | null };
  week_totals: { processes: number; units: number; amount: number; pending: number };
  by_process: DashboardProcess[];
  recent: PortalScan[];
  recent_today?: PortalScan[];
  recent_week?: PortalScan[];
};

export type PortalUnit = {
  id: string;
  unit_code: string;
  status: string;
  order_code: string | null;
  product_name: string | null;
  variant: string | null;
  size: string | null;
};

export type PortalProcess = {
  id: string;
  process_name: string | null;
  process_type: string | null;
  process_order: number;
  status: string;
  adds_to_payroll: boolean;
  rate: number | null;
  amount: number | null;
  allowed: boolean;
  out_of_order?: boolean;
  blocked_reason: string | null;
  completed_at: string | null;
};


export function getPortalToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
export function setPortalToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

/** Privacidad de montos: oculta por defecto, persistente por dispositivo y por operario. */
const AMOUNTS_DEVICE_KEY = "operator_amounts_visible_device";
export function amountsVisibleKey(operatorId: string) {
  return `operator_amounts_visible_${operatorId}`;
}
export function getAmountsVisible(operatorId: string): boolean {
  try {
    const own = localStorage.getItem(amountsVisibleKey(operatorId));
    if (own === "1") return true;
    if (own === "0") return false;
    // Sin preferencia guardada para este operario: hereda la del dispositivo.
    return localStorage.getItem(AMOUNTS_DEVICE_KEY) === "1";
  } catch {
    return false;
  }
}
export function setAmountsVisible(operatorId: string, visible: boolean) {
  try {
    localStorage.setItem(amountsVisibleKey(operatorId), visible ? "1" : "0");
    localStorage.setItem(AMOUNTS_DEVICE_KEY, visible ? "1" : "0");
  } catch {
    /* ignore */
  }

}

export const MASK = "******";
export function formatAmount(amount: number | null | undefined, visible: boolean): string {
  if (!visible) return MASK;
  return `$${Number(amount ?? 0).toFixed(2)}`;
}

async function call<T>(payload: Record<string, unknown>): Promise<T & { ok: boolean; error?: string }> {
  const { data, error } = await supabase.functions.invoke("core-operator-portal", { body: payload });
  if (error) {
    return { ok: false, error: error.message } as T & { ok: boolean; error?: string };
  }
  return data as T & { ok: boolean; error?: string };
}

export const portalApi = {
  listOperators: () => call<{ operators: PortalOperator[] }>({ action: "list_operators" }),
  login: (operator_id: string, pin: string) =>
    call<{ token: string; operator: PortalOperator; dashboard: PortalDashboard }>({
      action: "login",
      operator_id,
      pin,
      device_label: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 100) : null,
    }),
  setPin: (operator_id: string, pin: string) =>
    call<{ token: string; operator: PortalOperator; dashboard: PortalDashboard }>({
      action: "set_pin",
      operator_id,
      pin,
      device_label: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 100) : null,
    }),

  session: (token: string) =>
    call<{ operator: PortalOperator; dashboard: PortalDashboard }>({ action: "session", token }),
  logout: (token: string) => call<{}>({ action: "logout", token }),
  lookupUnit: (token: string, code: string) =>
    call<{ unit: PortalUnit; processes: PortalProcess[] }>({ action: "lookup_unit", token, code }),
  registerProcess: (token: string, code: string, process_id: string) =>
    call<{
      registered: { unit_code: string; process_name: string | null; amount: number | null; missing_rate: boolean };
      dashboard: PortalDashboard;
    }>({ action: "register_process", token, code, process_id }),
  adminSetPin: (operator_id: string, pin: string) =>
    call<{}>({ action: "admin_set_pin", operator_id, pin }),
  adminRevokeSessions: (operator_id: string) =>
    call<{}>({ action: "admin_revoke_sessions", operator_id }),
};

/** Extrae el token de unidad de un QR que puede venir como URL. */
export function extractUnitToken(raw: string): string {
  const s = raw.trim();
  try {
    const url = new URL(s);
    const u = url.searchParams.get("unit");
    if (u) return u.trim();
  } catch {
    /* no es URL absoluta */
  }
  const m = s.match(/[?&]unit=([^&\s#]+)/i);
  if (m) return decodeURIComponent(m[1]).trim();
  return s;
}
