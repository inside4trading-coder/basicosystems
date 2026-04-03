export type EmployeeStatus = "active" | "inactive" | "archived" | "graduated";

export interface RecurringTask {
  id: string;
  name: string;
  frequency: "daily" | "weekly" | "monthly";
  day: string;
  time: string;
  priority: "low" | "medium" | "high";
  area: string;
  responsible: string;
  active: boolean;
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
  current_salary: number | null;
  skills: string[];
  status: EmployeeStatus;
  observations: string;
  recurring_tasks: RecurringTask[];
  created_at: string;
  updated_at: string;
}
