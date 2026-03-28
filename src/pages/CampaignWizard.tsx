import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Check, Send, Loader2, Monitor, Smartphone, Eye } from "lucide-react";
import { toast } from "sonner";
import SegmentBuilder, { type SegmentFilter } from "@/components/campaigns/SegmentBuilder";

const STEPS = ["Configuración", "Audiencia", "Contenido", "Envío"];

// Removed old segmentOptions - now using SegmentBuilder

interface EmailBlock {
  id: string;
  type: "heading" | "text" | "image" | "button" | "divider";
  content: string;
  url?: string;
}

export default function CampaignWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [sending, setSending] = useState(false);
  const [syncingContacts, setSyncingContacts] = useState(false);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");

  // Step 1
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [senderName, setSenderName] = useState("Basico");
  const [senderEmail, setSenderEmail] = useState("hola@basicoclothes.com");

  // Step 2
  const [segmentFilter, setSegmentFilter] = useState<SegmentFilter | null>(null);
  const [contactCount, setContactCount] = useState<number | null>(null);
  const [listId, setListId] = useState<number | null>(null);

  // Step 3
  const [blocks, setBlocks] = useState<EmailBlock[]>([
    { id: "1", type: "heading", content: "¡Hola {{FNAME}}!" },
    { id: "2", type: "text", content: "Te traemos las últimas novedades de Basico." },
    { id: "3", type: "button", content: "Ver colección", url: "https://basicoclothes.es" },
  ]);

  // Step 4
  const [sendMode, setSendMode] = useState<"now" | "schedule">("now");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("10:00");

  const segmentLabel = segmentFilter?.conditions?.length ? `${segmentFilter.conditions.length} condición(es)` : "Todos los contactos";

  const canAdvance = () => {
    if (step === 0) return name.trim() && subject.trim();
    if (step === 1) return contactCount !== null && contactCount > 0;
    if (step === 2) return blocks.length > 0;
    return true;
  };

  const syncContacts = async () => {
    setSyncingContacts(true);
    try {
      const { data, error } = await supabase.functions.invoke("brevo-sync-contacts", {
        body: {
          segmentFilter: segmentFilter || { type: "all" },
          listName: `Basico_segment_${Date.now()}`,
        },
      });

      if (error) throw error;
      const result = typeof data === "string" ? JSON.parse(data) : data;
      setContactCount(result.contactCount || 0);
      setListId(result.listId);
      toast.success(`${result.contactCount} contactos sincronizados`);
    } catch (err: any) {
      toast.error(err.message || "Error sincronizando contactos");
      console.error(err);
    }
    setSyncingContacts(false);
  };

  const buildHtml = () => {
    const bodyHtml = blocks.map((b) => {
      switch (b.type) {
        case "heading":
          return `<h1 style="font-family:Inter,Arial,sans-serif;font-size:24px;font-weight:900;color:#0A0A0A;margin:0 0 16px;">${b.content}</h1>`;
        case "text":
          return `<p style="font-family:Inter,Arial,sans-serif;font-size:15px;color:#333;line-height:1.6;margin:0 0 16px;">${b.content}</p>`;
        case "image":
          return `<img src="${b.url || b.content}" alt="" style="max-width:100%;border-radius:8px;margin:0 0 16px;" />`;
        case "button":
          return `<table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;"><tr><td style="background-color:#E3001B;border-radius:6px;padding:12px 24px;"><a href="${b.url || '#'}" style="color:#ffffff;font-family:Inter,Arial,sans-serif;font-size:14px;font-weight:700;text-decoration:none;text-transform:uppercase;letter-spacing:1px;">${b.content}</a></td></tr></table>`;
        case "divider":
          return `<hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />`;
        default:
          return "";
      }
    }).join("\n");

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background-color:#f5f5f5;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;"><table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;"><tr><td style="padding:32px;">${bodyHtml}</td></tr><tr><td style="padding:16px 32px;background-color:#0A0A0A;text-align:center;"><p style="font-family:Inter,Arial,sans-serif;font-size:11px;color:#999;margin:0;">© ${new Date().getFullYear()} Basico Clothes. Todos los derechos reservados.</p></td></tr></table></td></tr></table></body></html>`;
  };

  const addBlock = (type: EmailBlock["type"]) => {
    const defaults: Record<string, string> = {
      heading: "Título",
      text: "Escribe tu texto aquí...",
      image: "",
      button: "Click aquí",
      divider: "",
    };
    setBlocks([...blocks, { id: Date.now().toString(), type, content: defaults[type], url: type === "button" ? "https://basicoclothes.es" : undefined }]);
  };

  const updateBlock = (id: string, field: string, value: string) => {
    setBlocks(blocks.map((b) => (b.id === id ? { ...b, [field]: value } : b)));
  };

  const removeBlock = (id: string) => {
    setBlocks(blocks.filter((b) => b.id !== id));
  };

  const handleSend = async () => {
    setSending(true);
    try {
      const scheduledAt = sendMode === "schedule" && scheduledDate
        ? new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString()
        : null;

      const { data, error } = await supabase.functions.invoke("brevo-campaigns", {
        body: {
          action: "create",
          name,
          subject,
          senderName,
          senderEmail,
          content: buildHtml(),
          listId,
          segmentFilter: segmentFilter || { type: "all" },
          recipientCount: contactCount,
          scheduledAt,
          sendNow: sendMode === "now",
        },
      });

      if (error) throw error;
      toast.success(sendMode === "now" ? "¡Campaña enviada!" : "Campaña programada");
      navigate("/campaigns");
    } catch (err: any) {
      toast.error(err.message || "Error creando campaña");
      console.error(err);
    }
    setSending(false);
  };

  const handleNext = async () => {
    if (step === 1 && !listId) {
      await syncContacts();
      return;
    }
    if (step < 3) setStep(step + 1);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/campaigns")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-2xl font-black tracking-tight">Nueva Campaña</h2>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div
              className={`flex items-center justify-center h-8 w-8 rounded-full text-xs font-bold shrink-0 transition-colors ${
                i < step
                  ? "bg-primary text-primary-foreground"
                  : i === step
                  ? "bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {i < step ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span className={`text-xs font-bold uppercase tracking-wider hidden sm:block ${i <= step ? "text-foreground" : "text-muted-foreground"}`}>
              {s}
            </span>
            {i < STEPS.length - 1 && <div className={`flex-1 h-px ${i < step ? "bg-primary" : "bg-border"}`} />}
          </div>
        ))}
      </div>

      {/* Step content */}
      <Card className="animate-fade-in">
        <CardContent className="pt-6">
          {/* Step 1: Config */}
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <Label className="text-xs font-bold uppercase tracking-wider">Nombre interno</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Lanzamiento SS26" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs font-bold uppercase tracking-wider">Asunto del email</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ej: ¡Descubre la nueva colección!" className="mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-bold uppercase tracking-wider">Nombre remitente</Label>
                  <Input value={senderName} onChange={(e) => setSenderName(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs font-bold uppercase tracking-wider">Email remitente</Label>
                  <Input value={senderEmail} onChange={(e) => setSenderEmail(e.target.value)} className="mt-1" />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Audience - Segment Builder */}
          {step === 1 && (
            <div className="space-y-4">
              <SegmentBuilder
                onFilterChange={(filter, count) => {
                  setSegmentFilter(filter);
                  setContactCount(count);
                  setListId(null);
                }}
                initialFilter={segmentFilter || undefined}
              />

              {contactCount !== null && contactCount > 0 && !listId && (
                <Button onClick={syncContacts} disabled={syncingContacts} className="w-full" variant="outline">
                  {syncingContacts ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                  {syncingContacts ? "Sincronizando..." : "Sincronizar contactos con Brevo"}
                </Button>
              )}

              {listId && (
                <div className="p-4 bg-muted/50 rounded-lg flex items-center justify-between">
                  <div>
                    <p className="font-bold">{contactCount?.toLocaleString()} contactos sincronizados</p>
                    <p className="text-xs text-muted-foreground">Listos para enviar en Brevo</p>
                  </div>
                  <Badge variant="outline" className="bg-primary/10 text-primary">
                    <Check className="h-3 w-3 mr-1" /> Listo
                  </Badge>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Content editor */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => addBlock("heading")}>Título</Button>
                  <Button size="sm" variant="outline" onClick={() => addBlock("text")}>Texto</Button>
                  <Button size="sm" variant="outline" onClick={() => addBlock("image")}>Imagen</Button>
                  <Button size="sm" variant="outline" onClick={() => addBlock("button")}>Botón</Button>
                  <Button size="sm" variant="outline" onClick={() => addBlock("divider")}>Separador</Button>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant={previewMode === "desktop" ? "default" : "ghost"} className="h-8 w-8" onClick={() => setPreviewMode("desktop")}>
                    <Monitor className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant={previewMode === "mobile" ? "default" : "ghost"} className="h-8 w-8" onClick={() => setPreviewMode("mobile")}>
                    <Smartphone className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Editor */}
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {blocks.map((block, idx) => (
                    <div key={block.id} className="border border-border rounded-lg p-3 space-y-2 bg-card">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-[10px]">{block.type.toUpperCase()}</Badge>
                        <Button variant="ghost" size="sm" className="h-6 text-xs text-destructive" onClick={() => removeBlock(block.id)}>✕</Button>
                      </div>
                      {block.type === "divider" ? (
                        <hr className="border-border" />
                      ) : block.type === "image" ? (
                        <Input placeholder="URL de la imagen" value={block.url || ""} onChange={(e) => updateBlock(block.id, "url", e.target.value)} />
                      ) : (
                        <>
                          {block.type === "heading" ? (
                            <Input value={block.content} onChange={(e) => updateBlock(block.id, "content", e.target.value)} className="font-bold" />
                          ) : block.type === "text" ? (
                            <Textarea value={block.content} onChange={(e) => updateBlock(block.id, "content", e.target.value)} rows={3} />
                          ) : (
                            <>
                              <Input value={block.content} onChange={(e) => updateBlock(block.id, "content", e.target.value)} placeholder="Texto del botón" />
                              <Input value={block.url || ""} onChange={(e) => updateBlock(block.id, "url", e.target.value)} placeholder="URL del botón" />
                            </>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>

                {/* Preview */}
                <div className={`border border-border rounded-lg overflow-hidden bg-muted/30 ${previewMode === "mobile" ? "max-w-[375px] mx-auto" : ""}`}>
                  <div className="bg-muted/50 px-3 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Eye className="h-3 w-3" /> Vista previa
                  </div>
                  <div className="p-4">
                    <div className="bg-card rounded-lg p-6 shadow-sm space-y-4">
                      {blocks.map((block) => {
                        switch (block.type) {
                          case "heading":
                            return <h1 key={block.id} className="text-xl font-black">{block.content.replace("{{FNAME}}", "María").replace("{{LNAME}}", "García")}</h1>;
                          case "text":
                            return <p key={block.id} className="text-sm text-muted-foreground leading-relaxed">{block.content.replace("{{FNAME}}", "María").replace("{{LNAME}}", "García").replace("{{EMAIL}}", "maria@email.com")}</p>;
                          case "image":
                            return block.url ? <img key={block.id} src={block.url} alt="" className="w-full rounded-lg" /> : <div key={block.id} className="w-full h-32 bg-muted rounded-lg flex items-center justify-center text-xs text-muted-foreground">Imagen</div>;
                          case "button":
                            return <div key={block.id}><a href="#" className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded-md text-xs font-bold uppercase tracking-wider">{block.content}</a></div>;
                          case "divider":
                            return <hr key={block.id} className="border-border" />;
                          default:
                            return null;
                        }
                      })}
                      <div className="border-t border-border pt-3 mt-6">
                        <p className="text-[10px] text-muted-foreground text-center">© {new Date().getFullYear()} Basico Clothes</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">Variables: <code className="bg-muted px-1 rounded">{"{{FNAME}}"}</code> <code className="bg-muted px-1 rounded">{"{{LNAME}}"}</code> <code className="bg-muted px-1 rounded">{"{{EMAIL}}"}</code></p>
            </div>
          )}

          {/* Step 4: Send */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="space-y-3">
                <Label className="text-xs font-bold uppercase tracking-wider">Modo de envío</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setSendMode("now")}
                    className={`p-4 rounded-lg border-2 text-left transition-colors ${sendMode === "now" ? "border-primary bg-primary/5" : "border-border"}`}
                  >
                    <p className="font-bold text-sm">Enviar ahora</p>
                    <p className="text-xs text-muted-foreground mt-1">Se enviará inmediatamente</p>
                  </button>
                  <button
                    onClick={() => setSendMode("schedule")}
                    className={`p-4 rounded-lg border-2 text-left transition-colors ${sendMode === "schedule" ? "border-primary bg-primary/5" : "border-border"}`}
                  >
                    <p className="font-bold text-sm">Programar</p>
                    <p className="text-xs text-muted-foreground mt-1">Elige fecha y hora</p>
                  </button>
                </div>
              </div>

              {sendMode === "schedule" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-bold uppercase tracking-wider">Fecha</Label>
                    <Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs font-bold uppercase tracking-wider">Hora</Label>
                    <Input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} className="mt-1" />
                  </div>
                </div>
              )}

              {/* Summary */}
              <Card className="bg-muted/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold uppercase tracking-wider">Resumen de campaña</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Nombre</span><span className="font-bold">{name}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Asunto</span><span className="font-bold">{subject}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Remitente</span><span>{senderName} &lt;{senderEmail}&gt;</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Segmento</span><span>{segmentLabel}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Contactos</span><span className="font-bold">{contactCount?.toLocaleString() || "—"}</span></div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Envío</span>
                    <span>{sendMode === "now" ? "Inmediato" : `${scheduledDate} ${scheduledTime}`}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation buttons */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => step > 0 ? setStep(step - 1) : navigate("/campaigns")} disabled={sending}>
          <ArrowLeft className="h-4 w-4 mr-1" /> {step === 0 ? "Cancelar" : "Anterior"}
        </Button>

        {step < 3 ? (
          <Button onClick={handleNext} disabled={!canAdvance() || syncingContacts} variant="brand">
            {syncingContacts ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
            {step === 1 && !listId ? "Sincronizar y avanzar" : "Siguiente"} <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={handleSend} disabled={sending || (sendMode === "schedule" && !scheduledDate)} variant="brand">
            {sending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
            {sending ? "Enviando..." : sendMode === "now" ? "Enviar campaña" : "Programar campaña"}
          </Button>
        )}
      </div>
    </div>
  );
}
