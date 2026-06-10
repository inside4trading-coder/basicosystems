export type RelationshipStatus =
  | "nuevo"
  | "contactado"
  | "envio_requerido"
  | "producto_listo_envio"
  | "producto_enviado"
  | "colaboracion_en_curso"
  | "colaboracion_exitosa"
  | "no_colaboro"
  | "descartado";

export type ContactType =
  | "influencer"
  | "lider_opinion"
  | "creador_contenido"
  | "modelo"
  | "embajador"
  | "aliado"
  | "colaborador"
  | "allegado"
  | "estrategico";

export interface SocialMedia {
  id: string;
  contact_id: string;
  network: string;
  handle: string;
  followers: number;
  measured_at: string;
  created_at: string;
}

export interface Interaction {
  id: string;
  contact_id: string;
  date: string;
  type: string;
  channel: string;
  summary: string;
  result: string;
  next_action: string;
  responsible: string;
  observation: string;
  created_at: string;
}

export interface Collaboration {
  id: string;
  contact_id: string;
  send_date: string;
  products: string;
  received: boolean;
  collab_done: boolean;
  has_coupon: boolean;
  coupon_code: string;
  coupon_revenue: number;
  network_posted: string;
  post_date: string;
  post_observation: string;
  observations: string;
  created_at: string;
  // Unified flow fields
  order_details?: string;
  shipping_name?: string;
  shipping_last_name?: string;
  shipping_id_number?: string;
  shipping_email?: string;
  shipping_postal_code?: string;
  shipping_address?: string;
  shipping_city?: string;
  shipping_country?: string;
  shipping_phone?: string;
  tracking_number?: string;
  shipped_at?: string | null;
  published_at?: string | null;
  post_url?: string;
}

export interface PrivateNote {
  id: string;
  contact_id: string;
  date: string;
  author: string;
  note_type: string;
  content: string;
  privacy_level: string;
  created_at: string;
}

export interface Contact {
  id: string;
  photo_url: string | null;
  name: string;
  alias: string;
  contact_type: ContactType;
  main_channel: string;
  phone: string;
  email: string;
  city: string;
  country: string;
  responsible: string;
  main_tag: string;
  relationship_status: RelationshipStatus;
  observations: string;
  skills: string[];
  status: "active" | "archived";
  brand: "basico_ve" | "sublime" | "basico_es";
  created_by: string;
  created_at: string;
  updated_at: string;
  social_media?: SocialMedia[];
}

export interface ContactFilters {
  status?: "active" | "archived";
  contact_type?: ContactType;
  relationship_status?: RelationshipStatus;
  responsible?: string;
  search?: string;
}
