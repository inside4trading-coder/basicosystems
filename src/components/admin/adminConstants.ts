import type { ImportanceLevel, InstanceStatus, UrgencyLevel } from "@/types/admin";

export const STATUS_LABEL: Record<InstanceStatus, string> = {
  pendiente: "Pendiente",
  proximo_vencer: "Próximo a vencer",
  pagado: "Pagado",
  vencido: "Vencido",
  pausado: "Pausado",
  anulado: "Anulado",
};

export const STATUS_BADGE: Record<InstanceStatus, string> = {
  pendiente: "status-badge-warning",
  proximo_vencer: "status-badge bg-orange-500/15 text-orange-600 dark:text-orange-400",
  pagado: "status-badge-success",
  vencido: "status-badge-error",
  pausado: "status-badge-inactive",
  anulado: "status-badge-inactive",
};

export const IMPORTANCE_LABEL: Record<ImportanceLevel, string> = {
  critica: "Crítica",
  alta: "Alta",
  media: "Media",
  baja: "Baja",
};

export const IMPORTANCE_BADGE: Record<ImportanceLevel, string> = {
  critica: "status-badge bg-status-error/12 text-status-error",
  alta: "status-badge bg-orange-500/15 text-orange-600 dark:text-orange-400",
  media: "status-badge-warning",
  baja: "status-badge-inactive",
};

export const URGENCY_BADGE: Record<UrgencyLevel, string> = IMPORTANCE_BADGE;
export const URGENCY_LABEL: Record<UrgencyLevel, string> = IMPORTANCE_LABEL;

export function relativeDate(due: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(due);
  d.setHours(0, 0, 0, 0);
  const days = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (days === 0) return "Hoy";
  if (days === 1) return "Mañana";
  if (days === -1) return "Ayer";
  if (days > 1) return `en ${days} días`;
  return `hace ${Math.abs(days)} días`;
}

export function fmtMoney(n: number, c = "USD") {
  return new Intl.NumberFormat("es-VE", { style: "currency", currency: c, maximumFractionDigits: 2 }).format(n || 0);
}

export const ALL_STATUSES: InstanceStatus[] = [
  "pendiente",
  "proximo_vencer",
  "pagado",
  "vencido",
  "pausado",
  "anulado",
];

export const ALL_IMPORTANCE: ImportanceLevel[] = ["critica", "alta", "media", "baja"];

export function importanceFromLabel(label: string): ImportanceLevel {
  const map: Record<string, ImportanceLevel> = {
    "Crítica": "critica",
    "Critica": "critica",
    "Alta": "alta",
    "Media": "media",
    "Baja": "baja",
  };
  return map[label] ?? "media";
}

export function frequencyFromLabel(label: string): string {
  const map: Record<string, string> = {
    "Única": "unica",
    "Unica": "unica",
    "Semanal": "semanal",
    "Quincenal": "quincenal",
    "Mensual": "mensual",
    "Bimestral": "bimestral",
    "Trimestral": "trimestral",
    "Semestral": "semestral",
    "Anual": "anual",
  };
  return map[label] ?? label.toLowerCase();
}
