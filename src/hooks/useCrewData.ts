import { useState, useCallback } from "react";
import type { Employee } from "@/types/crew";

const mockEmployees: Employee[] = [
  {
    id: "1",
    internal_id: "CR-001",
    photo_url: null,
    first_name: "Carlos",
    last_name: "Mendoza",
    cedula: "V-18.432.567",
    phone: "+58 412-3456789",
    position: "Coordinador de Producción",
    location: "Caracas",
    start_date: "2023-03-15",
    current_salary: 850,
    skills: ["Gestión de inventario", "Excel avanzado", "Logística"],
    status: "active",
    observations: "Excelente desempeño en Q1 2026.",
    recurring_tasks: [
      { id: "t1", name: "Revisión de inventario", frequency: "daily", day: "Lunes a Viernes", time: "08:00", priority: "high", area: "Producción", responsible: "Carlos Mendoza", active: true },
    ],
    created_at: "2023-03-15T10:00:00Z",
    updated_at: "2026-03-01T14:30:00Z",
  },
  {
    id: "2",
    internal_id: "CR-002",
    photo_url: null,
    first_name: "María",
    last_name: "Rodríguez",
    cedula: "V-20.876.321",
    phone: "+58 414-9876543",
    position: "Diseñadora Gráfica",
    location: "Valencia",
    start_date: "2024-01-10",
    current_salary: 650,
    skills: ["Illustrator", "Photoshop", "Figma", "Branding"],
    status: "active",
    observations: "",
    recurring_tasks: [],
    created_at: "2024-01-10T09:00:00Z",
    updated_at: "2026-02-20T11:00:00Z",
  },
  {
    id: "3",
    internal_id: "CR-003",
    photo_url: null,
    first_name: "Andrés",
    last_name: "Gutiérrez",
    cedula: "V-22.145.890",
    phone: "+58 424-5551234",
    position: "Community Manager",
    location: "Caracas",
    start_date: "2024-06-01",
    current_salary: 500,
    skills: ["Redes sociales", "Copywriting", "Canva", "Analytics"],
    status: "active",
    observations: "En periodo de evaluación para aumento.",
    recurring_tasks: [
      { id: "t2", name: "Publicación de contenido", frequency: "daily", day: "Lunes a Sábado", time: "09:00", priority: "medium", area: "Marketing", responsible: "Andrés Gutiérrez", active: true },
    ],
    created_at: "2024-06-01T08:00:00Z",
    updated_at: "2026-03-15T16:00:00Z",
  },
  {
    id: "4",
    internal_id: "CR-004",
    photo_url: null,
    first_name: "Valentina",
    last_name: "Pérez",
    cedula: "V-19.567.234",
    phone: "+58 416-7778899",
    position: "Asistente Administrativa",
    location: "Maracaibo",
    start_date: "2023-09-20",
    current_salary: null,
    skills: ["Atención al cliente", "Facturación", "Google Workspace"],
    status: "archived",
    observations: "Finalizó contrato en diciembre 2025.",
    recurring_tasks: [],
    created_at: "2023-09-20T10:00:00Z",
    updated_at: "2025-12-31T18:00:00Z",
  },
];

export function useCrewData() {
  const [employees, setEmployees] = useState<Employee[]>(mockEmployees);
  const [loading] = useState(false);
  const [error] = useState<string | null>(null);

  const addEmployee = useCallback((data: Omit<Employee, "id" | "internal_id" | "skills" | "recurring_tasks" | "created_at" | "updated_at" | "current_salary" | "observations">) => {
    setEmployees((prev) => {
      const nextNum = prev.length + 1;
      const internal_id = `CR-${String(nextNum).padStart(3, "0")}`;
      const now = new Date().toISOString();
      const newEmp: Employee = {
        ...data,
        id: crypto.randomUUID(),
        internal_id,
        current_salary: null,
        skills: [],
        observations: "",
        recurring_tasks: [],
        created_at: now,
        updated_at: now,
      };
      return [...prev, newEmp];
    });
  }, []);

  return { employees, loading, error, addEmployee };
}
