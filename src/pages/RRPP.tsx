import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Star, Search, MapPin, User as UserIcon, Archive, BarChart3, Users, CalendarIcon } from "lucide-react";
import { fetchContacts, fetchConfig } from "@/hooks/useRRPPData";
import { supabase } from "@/integrations/supabase/client";
import type { Contact, ContactType, RelationshipStatus } from "@/types/rrpp";
import { useRRPPBrand, RRPP_BRAND_LABELS } from "@/hooks/useRRPPBrand";
import { BrandSwitcher } from "@/components/rrpp/BrandSwitcher";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { AddContactSheet } from "@/components/rrpp/AddContactSheet";
import RRPPDashboard from "@/components/rrpp/RRPPDashboard";
import {
  RELATIONSHIP_LABELS, CONTACT_TYPE_LABELS, SOCIAL_CONTACT_TYPES,
  relationshipBadgeClass, formatFollowers,
} from "@/components/rrpp/rrppConstants";
import { ContactGridSkeleton } from "@/components/rrpp/RRPPSkeletons";
import { AlertTriangle } from "lucide-react";
import { formatLocalDate, formatDMY, parseLocalDate } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";

type PeriodKey = "this_month" | "last_month" | "last_3_months" | "all" | "custom";

function periodRange(p: PeriodKey, customFrom?: Date, customTo?: Date): { from: Date; to: Date } | null {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  switch (p) {
    case "this_month":
      return { from: new Date(y, m, 1), to: endOfDay(new Date(y, m + 1, 0)) };
    case "last_month":
      return { from: new Date(y, m - 1, 1), to: endOfDay(new Date(y, m, 0)) };
    case "last_3_months":
      return { from: new Date(y, m - 2, 1), to: endOfDay(new Date(y, m + 1, 0)) };
    case "custom":
      if (!customFrom || !customTo) return null;
      return { from: new Date(customFrom.getFullYear(), customFrom.getMonth(), customFrom.getDate()), to: endOfDay(customTo) };
    case "all":
    default:
      return null;
  }
}

const ALL = "__all__";

export default function RRPP() {
  const [brand, setBrand] = useRRPPBrand();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>(ALL);
  const [relFilter, setRelFilter] = useState<string>(ALL);
  const [respFilter, setRespFilter] = useState<string>(ALL);
  const [cityFilter, setCityFilter] = useState<string>("");
  const [showArchived, setShowArchived] = useState(false);

  const [typeOptions, setTypeOptions] = useState<{ value: string; label: string }[]>([]);
  const [cityOptions, setCityOptions] = useState<string[]>([]);

  const load = () => {
    setLoading(true);
    fetchContacts({ status: showArchived ? "archived" : "active" })
      .then(setContacts)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [showArchived]);

  useEffect(() => {
    fetchConfig("contact_type").then((rows) => {
      const opts = rows.length
        ? rows.map((r) => ({ value: r.key, label: r.value }))
        : (Object.keys(CONTACT_TYPE_LABELS) as ContactType[]).map((k) => ({ value: k, label: CONTACT_TYPE_LABELS[k] }));
      setTypeOptions(opts);
    }).catch(() => {});
    fetchConfig("city").then((rows) => setCityOptions(rows.map((r) => r.value))).catch(() => {});
  }, []);

  // Scope by brand first
  const brandContacts = useMemo(
    () => contacts.filter((c) => c.brand === brand),
    [contacts, brand]
  );

  const responsibles = useMemo(
    () => Array.from(new Set(brandContacts.map((c) => c.responsible).filter(Boolean))).sort(),
    [brandContacts]
  );

  const filtered = useMemo(() => {
    return brandContacts.filter((c) => {
      if (typeFilter !== ALL && c.contact_type !== typeFilter) return false;
      if (relFilter !== ALL && c.relationship_status !== relFilter) return false;
      if (respFilter !== ALL && c.responsible !== respFilter) return false;
      if (cityFilter.trim() && !c.city?.toLowerCase().includes(cityFilter.toLowerCase().trim())) return false;
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const hay = `${c.name} ${c.alias} ${c.city}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [brandContacts, search, typeFilter, relFilter, respFilter, cityFilter]);

  const hasFilters = search || typeFilter !== ALL || relFilter !== ALL || respFilter !== ALL || cityFilter;
  const clearFilters = () => {
    setSearch(""); setTypeFilter(ALL); setRelFilter(ALL); setRespFilter(ALL); setCityFilter("");
  };

  const initialsOf = (name: string) =>
    name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";

  const topSocial = (c: Contact) => {
    if (!c.social_media || c.social_media.length === 0) return null;
    return [...c.social_media].sort((a, b) => (b.followers ?? 0) - (a.followers ?? 0))[0];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">RRPP</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Operando para <span className="font-semibold text-foreground">{RRPP_BRAND_LABELS[brand]}</span>
            </p>
          </div>
          <Button onClick={() => setSheetOpen(true)} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" /> Agregar a {RRPP_BRAND_LABELS[brand].split(" / ")[0]}
          </Button>
        </div>
        <BrandSwitcher value={brand} onChange={setBrand} />
      </header>

      <Tabs defaultValue="dashboard" className="space-y-5">
        <TabsList>
          <TabsTrigger value="dashboard"><BarChart3 className="h-4 w-4 mr-1.5" /> Dashboard</TabsTrigger>
          <TabsTrigger value="contacts"><Users className="h-4 w-4 mr-1.5" /> Contactos</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <RRPPDashboard brand={brand} />
        </TabsContent>

        <TabsContent value="contacts" className="space-y-6">

      {/* Filters */}
      <div className="kpi-card !p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, alias o ciudad…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              maxLength={120}
            />
          </div>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger><SelectValue placeholder="Tipo de contacto" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos los tipos</SelectItem>
              {typeOptions.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={relFilter} onValueChange={setRelFilter}>
            <SelectTrigger><SelectValue placeholder="Estado de relación" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos los estados</SelectItem>
              {(Object.keys(RELATIONSHIP_LABELS) as RelationshipStatus[]).map((k) => (
                <SelectItem key={k} value={k}>{RELATIONSHIP_LABELS[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={respFilter} onValueChange={setRespFilter}>
            <SelectTrigger><SelectValue placeholder="Responsable" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos los responsables</SelectItem>
              {responsibles.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px] max-w-xs">
            <Input
              list="rrpp-city-filter"
              placeholder="Ciudad…"
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              maxLength={80}
            />
            <datalist id="rrpp-city-filter">
              {cityOptions.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <Switch id="archived" checked={showArchived} onCheckedChange={setShowArchived} />
            <Label htmlFor="archived" className="cursor-pointer text-sm">Ver archivados</Label>
          </div>
        </div>
      </div>

      {/* Body */}
      {loading && <ContactGridSkeleton />}
      {error && (
        <div className="kpi-card flex items-start gap-3 bg-status-error/10 border-status-error/20">
          <AlertTriangle className="h-5 w-5 text-status-error shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm">Error al cargar contactos</p>
            <p className="text-xs text-muted-foreground">{error}</p>
          </div>
        </div>
      )}

      {!loading && !error && brandContacts.length === 0 && !showArchived && (
        <div className="kpi-card text-center py-16">
          <Star className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-semibold">Sin contactos en {RRPP_BRAND_LABELS[brand]}</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">Empieza agregando el primer contacto comprometido.</p>
          <Button onClick={() => setSheetOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Agregar primer contacto
          </Button>
        </div>
      )}

      {!loading && !error && brandContacts.length === 0 && showArchived && (
        <div className="kpi-card text-center py-16">
          <Archive className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-semibold">No hay contactos archivados en esta marca</h3>
        </div>
      )}

      {!loading && !error && brandContacts.length > 0 && filtered.length === 0 && (
        <div className="kpi-card text-center py-16">
          <Search className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-semibold">Sin resultados</h3>
          <button onClick={clearFilters} className="text-sm text-primary hover:underline mt-2">
            Limpiar filtros
          </button>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => {
            const social = SOCIAL_CONTACT_TYPES.includes(c.contact_type) ? topSocial(c) : null;
            return (
              <Link key={c.id} to={`/rrpp/${c.id}`} className="block">
                <div className="kpi-card relative h-full">
                  {c.alias && (
                    <span className="absolute top-3 right-3 text-[10px] font-semibold uppercase tracking-wide bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">
                      @{c.alias}
                    </span>
                  )}

                  <div className="flex items-start gap-3">
                    <Avatar className="h-12 w-12 shrink-0">
                      {c.photo_url && <AvatarImage src={c.photo_url} alt={c.name} />}
                      <AvatarFallback className="bg-secondary text-secondary-foreground font-bold text-sm">
                        {initialsOf(c.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1 pr-14">
                      <h3 className="font-semibold truncate">{c.name}</h3>
                      <span className="inline-block mt-1 text-[10px] font-medium uppercase tracking-wide bg-muted text-muted-foreground px-2 py-0.5 rounded">
                        {CONTACT_TYPE_LABELS[c.contact_type] ?? c.contact_type}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                    {c.city && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3 w-3" /> <span className="truncate">{c.city}</span>
                      </div>
                    )}
                    {c.responsible && (
                      <div className="flex items-center gap-1.5">
                        <UserIcon className="h-3 w-3" /> <span className="truncate">{c.responsible}</span>
                      </div>
                    )}
                    {social && (
                      <div className="text-xs">
                        {social.network} · {formatFollowers(social.followers)}
                      </div>
                    )}
                  </div>

                  <div className="mt-3">
                    <span className={relationshipBadgeClass(c.relationship_status)}>
                      {RELATIONSHIP_LABELS[c.relationship_status] ?? c.relationship_status}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {hasFilters && filtered.length > 0 && (
        <div className="text-center">
          <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground">
            Limpiar filtros ({filtered.length} resultado{filtered.length !== 1 ? "s" : ""})
          </button>
        </div>
      )}
        </TabsContent>
      </Tabs>

      <AddContactSheet open={sheetOpen} onOpenChange={setSheetOpen} onCreated={load} brand={brand} />
    </div>
  );
}
