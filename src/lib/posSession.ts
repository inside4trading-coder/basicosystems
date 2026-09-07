/**
 * Estructura conceptual del POS Sublime:
 * SEDE → CAJA → SESIÓN DE CAJA → CAJERO → VENTAS.
 * Datos simulados: no hay backend en esta iteración.
 */
export interface PosStore {
  id: string;
  name: string;
}

export interface PosRegister {
  id: string;
  locationId: string;
  name: string;
}

export interface PosCashier {
  id: string;
  name: string;
}

export interface PosRegisterSession {
  id: string;
  registerId: string;
  cashierId: string;
  code: string;
  openedAt: string;
  closedAt?: string;
  open: boolean;
}

export const POS_STORE: PosStore = { id: "loc-bq", name: "Sublime Barquicenter" };

export const POS_REGISTERS: PosRegister[] = [
  { id: "reg-1", locationId: POS_STORE.id, name: "Caja 1" },
  { id: "reg-2", locationId: POS_STORE.id, name: "Caja 2" },
];

export const POS_CASHIERS: PosCashier[] = [
  { id: "csh-1", name: "Mari" },
  { id: "csh-2", name: "Carlos" },
  { id: "csh-3", name: "Andrea" },
];

export const POS_SESSIONS: PosRegisterSession[] = [
  {
    id: "ses-1",
    registerId: "reg-1",
    cashierId: "csh-1",
    code: "Sesión 001",
    openedAt: "10:00",
    open: true,
  },
  {
    id: "ses-2",
    registerId: "reg-2",
    cashierId: "csh-2",
    code: "Sesión 002",
    openedAt: "11:00",
    open: true,
  },
];

/** Contexto que sella cada venta. */
export interface PosSaleContext {
  locationId: string;
  locationName: string;
  registerId: string;
  registerName: string;
  posSessionId: string;
  sessionCode: string;
  cashierId: string;
  cashierName: string;
  registerOpen: boolean;
  rate: number;
  online: boolean;
}

export const posRegister = (id: string) => POS_REGISTERS.find((r) => r.id === id) ?? POS_REGISTERS[0];
export const posCashier = (id: string) => POS_CASHIERS.find((c) => c.id === id) ?? POS_CASHIERS[0];
export const posSessionOf = (registerId: string) =>
  POS_SESSIONS.find((s) => s.registerId === registerId) ?? POS_SESSIONS[0];

/** Turnos simulados para la maqueta de cierres. */
export interface PosShift {
  cashierName: string;
  registerName: string;
  sessionCode: string;
  from: string;
  to: string;
  salesCount: number;
  totalRef: number;
}

export const POS_SHIFTS: PosShift[] = [
  { cashierName: "Mari", registerName: "Caja 1", sessionCode: "Sesión 001", from: "10:00", to: "16:00", salesCount: 18, totalRef: 742 },
  { cashierName: "Carlos", registerName: "Caja 1", sessionCode: "Sesión 003", from: "16:00", to: "22:00", salesCount: 12, totalRef: 508 },
  { cashierName: "Andrea", registerName: "Caja 2", sessionCode: "Sesión 002", from: "11:00", to: "20:00", salesCount: 21, totalRef: 913 },
];
