import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function AdminObligationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/administracion")}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Volver
      </Button>
      <h1 className="text-2xl font-bold tracking-tight">Detalle de obligación</h1>
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">ID: {id}</p>
        </CardContent>
      </Card>
    </div>
  );
}
