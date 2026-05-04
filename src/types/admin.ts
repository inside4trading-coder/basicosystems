export type ObligationFrequency =
  | "unica"
  | "semanal"
  | "quincenal"
  | "mensual"
  | "bimestral"
  | "trimestral"
  | "semestral"
  | "anual";

export type ImportanceLevel = "critica" | "alta" | "media" | "baja";
export type UrgencyLevel = "critica" | "alta" | "media" | "baja";

export type InstanceStatus =
  | "pendiente"
  | "proximo_vencer"
  | "pagado"
  | "vencido"
  | "pausado"
  | "anulado";

export interface Obligation {
  id: string;
  name: string;
  category: string;
  provider: string;
  amount: number;
  currency: string;
  frequency: ObligationFrequency;
  due_day: number | null;
  importance: ImportanceLevel;
  responsible: string;
  payment_method: string;
  notes: string;
  status: "active" | "paused" | "cancelled";
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ObligationInstance {
  id: string;
  obligation_id: string;
  period_label: string;
  due_date: string;
  amount: number;
  currency: string;
  status: InstanceStatus;
  paid_at: string | null;
  paid_by: string;
  payment_reference: string;
  notes: string;
  payment_proof_urls?: string[] | null;
  created_at: string;
  updated_at: string;
  // joined from view
  obligation_name?: string;
  category?: string;
  provider?: string;
  frequency?: string;
  importance?: ImportanceLevel;
  responsible?: string;
  payment_method?: string;
  urgency?: UrgencyLevel;
}

export interface InstanceFilters {
  month?: string; // YYYY-MM
  category?: string;
  responsible?: string;
  status?: InstanceStatus;
  importance?: ImportanceLevel;
}

export interface AdminKPIs {
  totalDue: number;
  totalPaid: number;
  pendingCount: number;
  overdueCount: number;
  upcomingCount: number;
}

export function computeUrgency(dueDate: string): UrgencyLevel {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = dueDate.slice(0, 10).split("-").map(Number);
  const due = new Date(y, (m ?? 1) - 1, d ?? 1);
  due.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (days <= 0) return "critica";
  if (days <= 3) return "alta";
  if (days <= 7) return "media";
  return "baja";
}
