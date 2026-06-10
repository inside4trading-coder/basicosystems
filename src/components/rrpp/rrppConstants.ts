import type { ContactType, RelationshipStatus } from "@/types/rrpp";

export const RELATIONSHIP_LABELS: Record<RelationshipStatus, string> = {
  nuevo: "Nuevo",
  contactado: "Contactado",
  envio_requerido: "Envío requerido",
  producto_listo_envio: "Listo para envío",
  producto_enviado: "Producto enviado",
  colaboracion_en_curso: "Colaboración en curso",
  colaboracion_exitosa: "Colaboración exitosa",
  no_colaboro: "No colaboró",
  descartado: "Descartado",
};

export const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
  influencer: "Influencer",
  lider_opinion: "Líder de opinión",
  creador_contenido: "Creador de contenido",
  modelo: "Modelo",
  embajador: "Embajador",
  aliado: "Aliado",
  colaborador: "Colaborador",
  allegado: "Allegado",
  estrategico: "Estratégico",
};

export const SOCIAL_CONTACT_TYPES: ContactType[] = [
  "influencer", "lider_opinion", "creador_contenido", "modelo", "embajador",
];

export function relationshipBadgeClass(status: RelationshipStatus): string {
  switch (status) {
    case "nuevo":
    case "descartado":
      return "status-badge-inactive";
    case "contactado":
    case "producto_enviado":
      return "status-badge-warning";
    case "colaboracion_en_curso":
      return "status-badge bg-blue-500/10 text-blue-600";
    case "colaboracion_exitosa":
      return "status-badge-success";
    case "no_colaboro":
      return "status-badge-error";
    default:
      return "status-badge-inactive";
  }
}

export function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
