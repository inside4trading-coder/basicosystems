export type EmployeeStatus = "active" | "inactive" | "archived" | "graduated";

export interface RecurringTask {
  id: string;
  name: string;
  description?: string;
  frequency: "daily" | "interdaily" | "weekly" | "monthly";
  day: string;
  time: string;
  priority: "low" | "medium" | "high";
  area: string;
  responsible: string;
  active: boolean;
  sort_order?: number;
}

export interface Employee {
  id: string;
  internal_id: string;
  photo_url: string | null;
  first_name: string;
  last_name: string;
  cedula: string;
  phone: string;
  position: string;
  location: string;
  start_date: string;
  birth_date: string | null;
  current_salary: number | null;
  skills: string[];
  status: EmployeeStatus;
  observations: string;
  recurring_tasks: RecurringTask[];
  created_at: string;
  updated_at: string;
}
