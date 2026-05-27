import { useState } from "react";
import { FileText, FileCheck, FileImage, FolderOpen, Calendar, Plus, X, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDMY } from "@/lib/dateUtils";

interface OperatorDocument {
  id: string;
  operator_id: string;
  name: string;
  doc_type: string;
  file_url: string;
  expiry_date: string | null;
  uploaded_by: string | null;
  created_at: string;
}

const BUCKET = "core-operator-documents";
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

export function OperatorDocuments({ operatorId }: { operatorId: string }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const qc = useQueryClient();

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["operator_documents", operatorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("core_factory_operator_documents")
        .select("*")
        .eq("operator_id", operatorId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as OperatorDocument[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (doc: OperatorDocument) => {
      if (doc.file_url && !doc.file_url.startsWith("http")) {
        await supabase.storage.from(BUCKET).remove([doc.file_url]);
      }
      const { error } = await supabase.from("core_factory_operator_documents").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["operator_documents", operatorId] });
      toast.success("Documento eliminado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Array.from({ length: 2 }).map((_, i) => (<Skeleton key={i} className="h-24 rounded-lg" />))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Documentos</span>
        <Button size="sm" variant="outline" onClick={() => setSheetOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />Subir
        </Button>
      </div>

      {docs.length === 0 ? (
        <div className="kpi-card flex flex-col items-center justify-center py-6 gap-2">
          <FolderOpen className="h-6 w-6 text-muted-foreground/40" />
          <p className="text-xs text-muted-foreground">Sin documentos</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {docs.map((doc) => {
            const Icon = getDocIcon(doc.doc_type);
            const expiry = getExpiryStatus(doc.expiry_date);
            return (
              <div key={doc.id} className="kpi-card p-3 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <p className="font-semibold text-sm truncate">{doc.name}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(doc)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <span className="text-[10px] border border-border rounded-full px-2 py-0.5 font-medium inline-block">{doc.doc_type}</span>
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDMY(doc.created_at)}</span>
                  {doc.expiry_date && (
                    <span className={expiry === "expired" ? "text-destructive font-semibold" : expiry === "soon" ? "text-yellow-600 font-semibold" : ""}>
                      Vence: {formatDMY(doc.expiry_date)}
                    </span>
                  )}
                </div>
                <OpenDocButton fileUrl={doc.file_url} />
              </div>
            );
          })}
        </div>
      )}

      <UploadSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        operatorId={operatorId}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ["operator_documents", operatorId] });
          setSheetOpen(false);
        }}
      />
    </div>
  );
}

function OpenDocButton({ fileUrl }: { fileUrl: string }) {
  const [loading, setLoading] = useState(false);
  const handleOpen = async () => {
    setLoading(true);
    try {
      if (fileUrl.startsWith("http")) { window.open(fileUrl, "_blank"); return; }
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(fileUrl, 3600);
      if (error || !data?.signedUrl) throw error || new Error("No se pudo abrir");
      window.open(data.signedUrl, "_blank");
    } catch (e: any) {
      toast.error(e?.message || "Error al abrir archivo");
    } finally { setLoading(false); }
  };
  return (
    <Button variant="outline" size="sm" className="w-full" onClick={handleOpen} disabled={loading}>
      {loading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5 mr-1" />}
      {loading ? "Abriendo…" : "Ver archivo"}
    </Button>
  );
}

function UploadSheet({ open, onOpenChange, operatorId, onSuccess }: {
  open: boolean; onOpenChange: (v: boolean) => void; operatorId: string; onSuccess: () => void;
}) {
  const [name, setName] = useState("");
  const [docType, setDocType] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [expiryDate, setExpiryDate] = useState("");
  const [saving, setSaving] = useState(false);
  const reset = () => { setName(""); setDocType(""); setFile(null); setExpiryDate(""); };

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Nombre requerido"); return; }
    if (!docType) { toast.error("Selecciona un tipo"); return; }
    if (!file) { toast.error("Selecciona un archivo"); return; }
    setSaving(true);
    try {
      const ext = file.name.split(".").pop() || "pdf";
      const storagePath = `${operatorId}/${Date.now()}_${name.replace(/\s+/g, "_")}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(storagePath, file);
      if (upErr) throw upErr;
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("core_factory_operator_documents").insert({
        operator_id: operatorId,
        name: name.trim(),
        doc_type: docType,
        file_url: storagePath,
        expiry_date: expiryDate || null,
        uploaded_by: user?.id ?? null,
      });
      if (error) throw error;
      toast.success("Documento subido");
      reset();
      onSuccess();
    } catch (e: any) {
      toast.error(e.message);
    } finally { setSaving(false); }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader><SheetTitle>Subir documento</SheetTitle></SheetHeader>
        <div className="space-y-4 mt-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nombre</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" placeholder="Ej: Cédula" />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Tipo</label>
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar…" /></SelectTrigger>
              <SelectContent>{docTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Archivo</label>
            <Input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={(e) => setFile(e.target.files?.[0] || null)} className="mt-1" />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Vencimiento (opcional)</label>
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
