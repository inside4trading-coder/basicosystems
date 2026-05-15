export type ClockEventType = "entrada" | "salida" | "inicio_descanso" | "fin_descanso";

export type ClockStatus =
  | "fuera_de_jornada"
  | "trabajando"
  | "en_descanso"
  | "jornada_completada"
  | "pendiente_revision"
  | "fichaje_bloqueado";

export interface SublimeStore {
  id: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  radius_meters: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export type GeoValidation =
  | { ok: true; distance: number; store: SublimeStore }
  | { ok: false; reason: "out_of_range" | "no_store" | "no_coords" | "no_position"; distance?: number; store?: SublimeStore };

export type WeeklySchedule = {
  mon: boolean; tue: boolean; wed: boolean; thu: boolean;
  fri: boolean; sat: boolean; sun: boolean;
};

export const EMPTY_SCHEDULE: WeeklySchedule = {
  mon: false, tue: false, wed: false, thu: false, fri: false, sat: false, sun: false,
};

export interface ClockSettings {
  employee_id: string;
  enabled: boolean;
  store_id: string | null;
  weekly_schedule: WeeklySchedule;
  entry_time: string | null;
  exit_time: string | null;
  break_start: string | null;
  break_end: string | null;
  break_minutes: number;
  late_tolerance_minutes: number;
  pin_hash: string | null;
  pin_set_at: string | null;
  blocked: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClockEvent {
  id: string;
  employee_id: string;
  store_id: string | null;
  event_type: ClockEventType;
  event_at: string;
  source: "pin" | "manual" | "admin";
  notes: string | null;
  created_at: string;
}

export const STATUS_LABEL: Record<ClockStatus, string> = {
  fuera_de_jornada: "Fuera de jornada",
  trabajando: "Trabajando",
  en_descanso: "En descanso",
  jornada_completada: "Jornada completada",
  pendiente_revision: "Pendiente de revisión",
  fichaje_bloqueado: "Fichaje bloqueado",
};

export const EVENT_LABEL: Record<ClockEventType, string> = {
  entrada: "Entrada",
  salida: "Salida",
  inicio_descanso: "Inicio de descanso",
  fin_descanso: "Fin de descanso",
};
