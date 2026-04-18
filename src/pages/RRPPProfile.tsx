import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { fetchContactById } from "@/hooks/useRRPPData";
import type { Contact } from "@/types/rrpp";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function RRPPProfile() {
  const { id } = useParams<{ id: string }>();
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchContactById(id)
      .then(setContact)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="p-6 space-y-6">
      <Link to="/rrpp">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-2" /> Volver
        </Button>
      </Link>

      {loading && <p className="text-muted-foreground">Cargando perfil…</p>}
      {error && <p className="text-destructive">Error: {error}</p>}
      {!loading && !contact && !error && (
        <Card className="p-12 text-center text-muted-foreground">
          Contacto no encontrado.
        </Card>
      )}

      {contact && (
        <Card className="p-6 space-y-4">
          <div>
            <h1 className="text-2xl font-bold">{contact.name}</h1>
            {contact.alias && <p className="text-muted-foreground">@{contact.alias}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="font-medium">Tipo:</span> {contact.contact_type}</div>
            <div><span className="font-medium">Estado:</span> {contact.relationship_status}</div>
            <div><span className="font-medium">Email:</span> {contact.email || "—"}</div>
            <div><span className="font-medium">Teléfono:</span> {contact.phone || "—"}</div>
            <div><span className="font-medium">Ciudad:</span> {contact.city || "—"}</div>
            <div><span className="font-medium">País:</span> {contact.country || "—"}</div>
            <div><span className="font-medium">Responsable:</span> {contact.responsible || "—"}</div>
            <div><span className="font-medium">Etiqueta:</span> {contact.main_tag || "—"}</div>
          </div>
        </Card>
      )}
    </div>
  );
}
