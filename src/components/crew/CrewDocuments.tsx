import { useState } from "react";
import { FileText, FileCheck, FileImage, FolderOpen, Calendar, Plus, X, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/hooks/useCrewAudit";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

interface EmployeeDocument {
  id: string;
  employee_id: string;
  name: string;
  doc_type: string;
  file_url: string;
  expiry_date: string | null;
  uploaded_by: string | null;
  created_at: string;
}

const docTypes = ["Cédula", "Contrato", "Constancia", "Permiso", "Documento firmado", "Otro"];

function getDocIcon(type: string) {
  if (type === "Documento firmado") return FileCheck;
  if (type === "Cédula") return FileImage;
  return FileText;
}

function getExpiryStatus(expiry: string | null) {
  if (!expiry) return null;
  const diff = (new Date(expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (diff < 0) return "expired";
  if (diff < 30) return "soon";
  return "ok";
}

export function CrewDocuments({ employeeId }: { employeeId: string }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["employee_documents", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_documents")
        .select("*")
        .eq("employee_id", employeeId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as EmployeeDocument[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (doc: EmployeeDocument) => {
      // Extract storage path from file_url
      const path = `${employeeId}/${doc.name}`;
      await supabase.storage.from("crew-documents").remove([path]);
      const { error } = await supabase.from("employee_documents").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee_documents", employeeId] });
      toast.success("Documento eliminado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setSheetOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />Subir documento
        </Button>
      </div>

      {docs.length === 0 ? (
        <div className="kpi-card">
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <FolderOpen className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-semibold text-muted-foreground">Sin documentos cargados</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {docs.map((doc) => {
            const Icon = getDocIcon(doc.doc_type);
            const expiry = getExpiryStatus(doc.expiry_date);
            return (
              <div key={doc.id} className="kpi-card p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
                    <p className="font-semibold text-sm truncate">{doc.name}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(doc)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <span className="text-xs border border-border rounded-full px-2 py-0.5 font-medium inline-block">{doc.doc_type}</span>
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(doc.created_at).toLocaleDateString("es-VE", { day: "2-digit", month: "short", year: "numeric" })}
                  </span>
                  {doc.expiry_date && (
                    <span className={`flex items-center gap-1 ${expiry === "expired" ? "text-destructive font-semibold" : expiry === "soon" ? "text-yellow-600 font-semibold" : ""}`}>
                      Vence: {new Date(doc.expiry_date).toLocaleDateString("es-VE", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                  )}
                </div>
                <Button variant="outline" size="sm" className="w-full mt-1" onClick={() => window.open(doc.file_url, "_blank")}>
                  <ExternalLink className="h-3.5 w-3.5 mr-1" />Ver archivo
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <UploadDocSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        employeeId={employeeId}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["employee_documents", employeeId] });
          setSheetOpen(false);
        }}
      />
    </div>
  );
}

function UploadDocSheet({ open, onOpenChange, employeeId, onSuccess }: {
  open: boolean; onOpenChange: (v: boolean) => void; employeeId: string; onSuccess: () => void;
}) {
  const [name, setName] = useState("");
  const [docType, setDocType] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [expiryDate, setExpiryDate] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => { setName(""); setDocType(""); setFile(null); setExpiryDate(""); };

  const handleSave = async () => {
    if (!name.trim()) { toast.error("El nombre es requerido"); return; }
    if (!docType) { toast.error("Selecciona un tipo"); return; }
    if (!file) { toast.error("Selecciona un archivo"); return; }
    setSaving(true);
    try {
      const ext = file.name.split(".").pop() || "pdf";
      const storagePath = `${employeeId}/${Date.now()}_${name.replace(/\s+/g, "_")}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("crew-documents").upload(storagePath, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("crew-documents").getPublicUrl(storagePath);
      // Since bucket is private, create signed URL
      const { data: signedData, error: signError } = await supabase.storage.from("crew-documents").createSignedUrl(storagePath, 60 * 60 * 24 * 365);
      if (signError) throw signError;

      const { error } = await supabase.from("employee_documents").insert({
        employee_id: employeeId,
        name: name.trim(),
        doc_type: docType,
        file_url: signedData.signedUrl,
        expiry_date: expiryDate || null,
      });
      if (error) throw error;
      toast.success("Documento subido");
      reset();
      onSuccess();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader><SheetTitle>Subir documento</SheetTitle></SheetHeader>
        <div className="space-y-4 mt-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nombre del documento</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" placeholder="Ej: Cédula de identidad" />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Tipo</label>
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar…" /></SelectTrigger>
              <SelectContent>
                {docTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Archivo</label>
            <Input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={(e) => setFile(e.target.files?.[0] || null)} className="mt-1" />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Fecha de vencimiento (opcional)</label>
            <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="mt-1" />
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Subiendo…</> : "Subir documento"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
