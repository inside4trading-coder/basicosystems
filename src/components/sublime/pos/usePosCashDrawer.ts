import { useCallback, useState } from "react";

/**
 * Caja física simulada: apertura con efectivo inicial en Bs. y REF, y
 * movimientos de entrada/salida de efectivo por sesión de caja.
 * Estado en memoria, sin backend.
 */
export type PosCashMovementType = "opening" | "in" | "out";
export type PosCashCurrency = "VES" | "USD";

export interface PosCashMovement {
  id: string;
  type: PosCashMovementType;
  currency: PosCashCurrency;
  amount: number;
  reason: string;
  responsible: string;
  at: string;
}

export interface PosDrawerState {
  open: boolean;
  openedAt: string | null;
  movements: PosCashMovement[];
}

const emptyDrawer = (): PosDrawerState => ({ open: false, openedAt: null, movements: [] });

const now = () => new Date().toLocaleString("es-VE");

export function usePosCashDrawer() {
  const [drawers, setDrawers] = useState<Record<string, PosDrawerState>>({});

  const drawerOf = useCallback(
    (registerId: string) => drawers[registerId] ?? emptyDrawer(),
    [drawers]
  );

  const push = (registerId: string, m: Omit<PosCashMovement, "id" | "at">) =>
    setDrawers((d) => {
      const cur = d[registerId] ?? emptyDrawer();
      return {
        ...d,
        [registerId]: {
          ...cur,
          movements: [
            { ...m, id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, at: now() },
            ...cur.movements,
          ],
        },
      };
    });

  const openRegister = (
    registerId: string,
    p: { bs: number; ref: number; responsible: string; reason?: string }
  ) => {
    setDrawers((d) => ({
      ...d,
      [registerId]: { ...(d[registerId] ?? emptyDrawer()), open: true, openedAt: now() },
    }));
    const at = now();
    const base: PosCashMovement[] = [];
    if (p.bs > 0)
      base.push({
        id: `mov-${Date.now()}-bs`,
        type: "opening",
        currency: "VES",
        amount: p.bs,
        reason: p.reason || "Fondo inicial",
        responsible: p.responsible,
        at,
      });
    if (p.ref > 0)
      base.push({
        id: `mov-${Date.now()}-ref`,
        type: "opening",
        currency: "USD",
        amount: p.ref,
        reason: p.reason || "Fondo inicial",
        responsible: p.responsible,
        at,
      });
    setDrawers((d) => {
      const cur = d[registerId] ?? emptyDrawer();
      return { ...d, [registerId]: { ...cur, movements: [...base, ...cur.movements] } };
    });
  };

  const closeRegister = (registerId: string) =>
    setDrawers((d) => ({
      ...d,
      [registerId]: { ...(d[registerId] ?? emptyDrawer()), open: false },
    }));

  const addCash = (
    registerId: string,
    p: { currency: PosCashCurrency; amount: number; reason: string; responsible: string }
  ) => push(registerId, { type: "in", ...p });

  const removeCash = (
    registerId: string,
    p: { currency: PosCashCurrency; amount: number; reason: string; responsible: string }
  ) => push(registerId, { type: "out", ...p });

  return { drawerOf, openRegister, closeRegister, addCash, removeCash };
}

/** Saldo conceptual de la caja por moneda: aperturas y entradas suman, retiros restan. */
export function drawerBalance(movements: PosCashMovement[], currency: PosCashCurrency) {
  return movements
    .filter((m) => m.currency === currency)
    .reduce((a, m) => a + (m.type === "out" ? -m.amount : m.amount), 0);
}

export type PosCashDrawerApi = ReturnType<typeof usePosCashDrawer>;
