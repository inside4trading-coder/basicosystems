/**
 * Catálogo central de bancos del POS Sublime.
 * Añadir un banco aquí lo habilita en todos los métodos que lo requieran.
 */
export interface PosBank {
  id: string;
  label: string;
}

export const POS_BANKS: PosBank[] = [
  { id: "bnc", label: "BNC" },
  { id: "banco_off", label: "Banco OFF" },
];

export const posBankLabel = (id: string) => POS_BANKS.find((b) => b.id === id)?.label ?? id;
