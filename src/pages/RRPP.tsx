import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Star } from "lucide-react";
import { fetchContacts } from "@/hooks/useRRPPData";
import type { Contact } from "@/types/rrpp";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function RRPP() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchContacts()
      .then(setContacts)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Star className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">RRPP</h1>
            <p className="text-sm text-muted-foreground">
              Gestión de relaciones públicas, influencers y aliados
            </p>
          </div>
        </div>
        <Button>Nuevo contacto</Button>
      </header>

      {loading && <p className="text-muted-foreground">Cargando contactos…</p>}
      {error && <p className="text-destructive">Error: {error}</p>}

      {!loading && !error && contacts.length === 0 && (
        <Card className="p-12 text-center text-muted-foreground">
          Aún no hay contactos registrados.
        </Card>
      )}

      {!loading && contacts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {contacts.map((c) => (
            <Link key={c.id} to={`/rrpp/${c.id}`}>
              <Card className="p-4 hover:border-primary transition-colors">
                <h3 className="font-semibold">{c.name}</h3>
                {c.alias && <p className="text-sm text-muted-foreground">@{c.alias}</p>}
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="px-2 py-1 rounded bg-secondary">{c.contact_type}</span>
                  <span className="px-2 py-1 rounded bg-secondary">{c.relationship_status}</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
