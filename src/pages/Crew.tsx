import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Users2, Plus, Loader2, AlertTriangle, MapPin, Calendar, Search, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { useCrewData } from "@/hooks/useCrewData";
import { AddEmployeeSheet } from "@/components/crew/AddEmployeeSheet";
import { EmployeeAvatar } from "@/components/crew/EmployeeAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { EmployeeStatus } from "@/types/crew";

const statusConfig: Record<EmployeeStatus, { label: string; className: string }> = {
  active: { label: "Activo", className: "status-badge-success" },
  inactive: { label: "Inactivo", className: "status-badge-warning" },
  archived: { label: "Archivado", className: "status-badge-inactive" },
  graduated: { label: "Egresado", className: "status-badge-inactive" },
};

export default function Crew() {
  const { employees, loading, error, addEmployee } = useCrewData();

  const navigate = useNavigate();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterPosition, setFilterPosition] = useState("all");
  const [filterLocation, setFilterLocation] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showArchived, setShowArchived] = useState(false);

  const uniquePositions = useMemo(() => [...new Set(employees.map((e) => e.position))].sort(), [employees]);
  const uniqueLocations = useMemo(() => [...new Set(employees.map((e) => e.location).filter(Boolean))].sort(), [employees]);

  const filtered = useMemo(() => {
    return employees.filter((e) => {
      if (!showArchived && e.status === "archived") return false;
      if (filterStatus !== "all" && e.status !== filterStatus) return false;
      if (filterPosition !== "all" && e.position !== filterPosition) return false;
      if (filterLocation !== "all" && e.location !== filterLocation) return false;
      if (search) {
        const q = search.toLowerCase();
        const match = `${e.first_name} ${e.last_name} ${e.position} ${e.internal_id}`.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [employees, search, filterPosition, filterLocation, filterStatus, showArchived]);

  const hasActiveFilters = search || filterPosition !== "all" || filterLocation !== "all" || filterStatus !== "all";

  const handleAddEmployee = async (data: Parameters<typeof addEmployee>[0]) => {
    try {
      await addEmployee(data);
      toast.success("Empleado agregado correctamente");
      setSheetOpen(false);
    } catch (err: any) {
      toast.error(err.message ?? "Error al agregar empleado");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <AlertTriangle className="h-10 w-10 text-destructive" />
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2">
            <Users2 className="h-6 w-6 text-primary" />
            Crew
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Gestión interna del equipo</p>
        </div>
        <Button onClick={() => setSheetOpen(true)} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-1" />
          Agregar empleado
        </Button>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, cargo o ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={filterPosition} onValueChange={setFilterPosition}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Cargo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los cargos</SelectItem>
            {uniquePositions.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filterLocation} onValueChange={setFilterLocation}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Sede/Área" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las sedes</SelectItem>
            {uniqueLocations.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Activo</SelectItem>
            <SelectItem value="inactive">Inactivo</SelectItem>
            <SelectItem value="graduated">Egresado</SelectItem>
          </SelectContent>
        </Select>

        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
          <Checkbox checked={showArchived} onCheckedChange={(v) => setShowArchived(!!v)} />
          Ver archivados
        </label>
      </div>

      {/* Employee Grid */}
      {filtered.length === 0 ? (
        <div className="kpi-card flex flex-col items-center justify-center py-16 gap-3">
          <Users2 className="h-10 w-10 text-muted-foreground/50" />
          <p className="font-semibold text-sm">No se encontraron empleados</p>
          <p className="text-xs text-muted-foreground">
            {hasActiveFilters ? "Intenta con otros filtros" : ""}
          </p>
          {!hasActiveFilters && employees.length === 0 && (
            <Button size="sm" onClick={() => setSheetOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Agrega el primer empleado
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((emp) => {
            const st = statusConfig[emp.status];
            return (
              <div
                key={emp.id}
                className="kpi-card relative cursor-pointer hover:ring-1 hover:ring-primary/30 transition-all"
                onClick={() => navigate(`/crew/${emp.id}`)}
              >
                {/* Internal ID */}
                <span className="absolute top-3 right-3 text-xs bg-muted rounded-full px-2 py-0.5 font-mono text-muted-foreground">
                  {emp.internal_id}
                </span>

                <div className="flex items-start gap-3">
                  <EmployeeAvatar
                    photoUrl={emp.photo_url}
                    firstName={emp.first_name}
                    lastName={emp.last_name}
                  />

                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="font-semibold text-sm truncate">{emp.first_name} {emp.last_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{emp.position}</p>

                    {emp.location && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {emp.location}
                      </p>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      <span className={st.className}>
                        {emp.status === "graduated" && <GraduationCap className="h-3 w-3 mr-1" />}
                        {st.label}
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground flex items-center gap-1 pt-0.5">
                      <Calendar className="h-3 w-3 shrink-0" />
                      {new Date(emp.start_date).toLocaleDateString("es-VE", { day: "2-digit", month: "short", year: "numeric" })}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AddEmployeeSheet open={sheetOpen} onOpenChange={setSheetOpen} onSave={handleAddEmployee} />
    </div>
  );
}
