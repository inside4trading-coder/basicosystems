/**
 * Registro de auditoría del POS (en memoria).
 * Toda acción sensible queda atribuida a cajero, caja y sesión, lista para
 * persistirse cuando exista backend.
 */
export type PosAuditAction =
  | "sale"
  | "discount"
  | "price_change"
  | "void"
  | "return"
  | "reprint"
  | "suspend"
  | "resume"
  | "open_register"
  | "close_register"
  | "change_cashier"
  | "change_register";

export interface PosAuditEntry {
  id: string;
  action: PosAuditAction;
  detail: string;
  cashierId: string;
  cashierName: string;
  registerId: string;
  registerName: string;
  posSessionId: string;
  locationId: string;
  at: string;
}

const log: PosAuditEntry[] = [];

export function posAudit(
  action: PosAuditAction,
  detail: string,
  ctx: {
    cashierId: string;
    cashierName: string;
    registerId: string;
    registerName: string;
    posSessionId: string;
    locationId: string;
  }
): PosAuditEntry {
  const entry: PosAuditEntry = {
    id: `aud-${Date.now()}-${log.length}`,
    action,
    detail,
    at: new Date().toISOString(),
    ...ctx,
  };
  log.unshift(entry);
  return entry;
}

export const posAuditLog = () => [...log];
