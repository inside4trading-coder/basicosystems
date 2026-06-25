import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Copy, Check, Upload, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { CANALES, type CanalConfig, type MetodoAporte } from "./canales";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

// Convierte "1.234,56" → 1234.56  |  "1234.56" → 1234.56
function parseMonto(raw: string): number {
  if (!raw) return NaN;
  const cleaned = raw.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  return Number(cleaned);
}

// Formatea mientras el usuario escribe: separador miles "." y decimales ","
function formatMontoInput(raw: string): string {
  let v = raw.replace(/[^\d,]/g, "");
  // sólo una coma
  const firstComma = v.indexOf(",");
  if (firstComma !== -1) {
    v = v.slice(0, firstComma + 1) + v.slice(firstComma + 1).replace(/,/g, "");
  }
  const [intPart, decPart] = v.split(",");
  const intClean = (intPart || "").replace(/^0+(?=\d)/, "");
  const intFmt = intClean ? Number(intClean).toLocaleString("es-VE") : "";
  if (decPart === undefined) return intFmt;
  return `${intFmt || "0"},${decPart.slice(0, 2)}`;
}

function buildSchema(canal: CanalConfig | null) {
  const needsEmail = !!canal?.fields.email;
  const needsTel = !!canal?.fields.telefono;
  const needsRef = !!canal?.fields.referencia;
  const needsSender = !!canal?.fields.senderName;
  return z.object({
    nombre: z.string().trim().min(2, "Mínimo 2 caracteres").max(120),
    email: needsEmail
      ? z.string().trim().email("Correo inválido").max(200)
      : z.string().trim().max(200).optional().or(z.literal("")),
    telefono: needsTel
      ? z.string().trim().min(6, "Teléfono inválido").max(40)
      : z.string().trim().max(40).optional().or(z.literal("")),
    fecha_pago: z.string().min(1, "Requerido"),
    monto: z
      .string()
      .min(1, "Requerido")
      .refine((v) => parseMonto(v) > 0, "Monto inválido"),
    referencia: needsRef
      ? z.string().trim().min(3, "Mínimo 3 caracteres").max(120)
      : z.string().trim().max(120).optional().or(z.literal("")),
    sender_name: needsSender
      ? z.string().trim().min(2, "Mínimo 2 caracteres").max(120)
      : z.string().trim().max(120).optional().or(z.literal("")),
    es_anonimo: z.boolean().default(false),
  });
}


type FormValues = z.infer<typeof schema>;

interface Props {
  metodo: MetodoAporte | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AporteDialog({ metodo, open, onOpenChange }: Props) {
  const canal: CanalConfig | null = metodo ? CANALES[metodo] : null;
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      nombre: "",
      email: "",
      telefono: "",
      fecha_pago: today,
      monto: "",
      referencia: "",
      es_anonimo: false,
    },
  });

  const esAnonimo = watch("es_anonimo");

  function resetAll() {
    reset();
    setFile(null);
    setFileError(null);
    setSuccess(false);
    setSubmitting(false);
  }

  function handleClose(next: boolean) {
    if (submitting) return;
    if (!next) resetAll();
    onOpenChange(next);
  }

  async function copyValue(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      setTimeout(() => setCopied(null), 1500);
    } catch {}
  }

  function handleFile(f: File | null) {
    setFileError(null);
    if (!f) {
      setFile(null);
      return;
    }
    if (!ALLOWED_MIME.includes(f.type)) {
      setFileError("Formato no permitido. Usa JPG, PNG, WEBP o PDF.");
      return;
    }
    if (f.size > MAX_FILE_BYTES) {
      setFileError("El archivo supera 5 MB.");
      return;
    }
    setFile(f);
  }

  async function onSubmit(values: FormValues) {
    if (!canal) return;
    if (!file) {
      setFileError("El comprobante es obligatorio.");
      return;
    }
    setSubmitting(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
      const safeExt = ext.replace(/[^a-z0-9]/g, "").slice(0, 6) || "bin";
      const path = `aportes/${canal.metodo}/${Date.now()}-${crypto.randomUUID()}.${safeExt}`;

      const { error: upErr } = await supabase.storage
        .from("fondo-comprobantes")
        .upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
      if (upErr) throw upErr;

      const monto = parseMonto(values.monto);
      const { data, error } = await supabase.rpc("fondo_registrar_aporte_publico", {
        p_metodo: canal.metodo,
        p_nombre: values.nombre,
        p_email: values.email,
        p_telefono: values.telefono,
        p_fecha_pago: values.fecha_pago,
        p_monto: monto,
        p_moneda: canal.moneda,
        p_referencia: values.referencia,
        p_comprobante_path: path,
        p_es_anonimo: values.es_anonimo,
      });
      if (error) throw error;
      if (data && typeof data === "object" && "ok" in data && !(data as any).ok) {
        throw new Error("No se pudo registrar el aporte");
      }
      setSuccess(true);
    } catch (e: any) {
      toast({
        title: "No se pudo registrar tu aporte",
        description: e?.message || "Intenta de nuevo en unos segundos.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (!canal) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg bg-zinc-950 border-white/10 text-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="lowercase text-2xl font-bold tracking-tight">
            aportar por {canal.titulo}
          </DialogTitle>
          <DialogDescription className="text-zinc-400 lowercase text-xs">
            {canal.monedaLabel}
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-8 text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/30">
              <CheckCircle2 className="h-7 w-7 text-emerald-400" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold lowercase">¡gracias por aportar!</h3>
              <p className="text-sm text-zinc-400 max-w-sm mx-auto">
                Estamos verificando tu aporte. En cuanto lo confirmemos aparecerá
                publicado en la tabla pública del fondo.
              </p>
            </div>
            <div className="flex gap-2 justify-center pt-2">
              <Button
                variant="outline"
                className="bg-transparent border-white/20 text-white hover:bg-white/5"
                onClick={() => handleClose(false)}
              >
                cerrar
              </Button>
              <Button
                className="bg-[#E3001B] hover:bg-[#c30017] text-white"
                onClick={() => {
                  handleClose(false);
                  window.location.href = "/fuerza-venezuela#por-verificar";
                  window.location.reload();
                }}
              >
                ver mi aporte en la cola
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Datos del canal */}
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#E3001B] mb-3">
                datos para pagar
              </p>
              {canal.datosPendientes ? (
                <div className="flex items-start gap-2 text-sm text-amber-300/90">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <p>{canal.notaCanal}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {canal.datos.map((d) => (
                    <div
                      key={d.label}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                          {d.label}
                        </div>
                        <div className="font-mono text-white truncate">{d.value}</div>
                      </div>
                      {d.copy && (
                        <button
                          type="button"
                          onClick={() => copyValue(d.value)}
                          className="flex-shrink-0 p-2 rounded-md border border-white/10 hover:border-[#E3001B]/40 hover:bg-white/5 transition"
                          aria-label={`copiar ${d.label}`}
                        >
                          {copied === d.value ? (
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="h-3.5 w-3.5 text-zinc-400" />
                          )}
                        </button>
                      )}
                    </div>
                  ))}
                  {canal.notaCanal && (
                    <p className="text-xs text-zinc-500 pt-2 border-t border-white/5 mt-3">
                      {canal.notaCanal}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Formulario */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <FieldRow>
                <Field label="nombre completo" error={errors.nombre?.message}>
                  <Input
                    {...register("nombre")}
                    placeholder="tu nombre"
                    className="bg-white/5 border-white/10 text-white"
                  />
                </Field>
              </FieldRow>

              <FieldRow cols={2}>
                <Field label="correo" error={errors.email?.message}>
                  <Input
                    {...register("email")}
                    type="email"
                    placeholder="correo@ejemplo.com"
                    className="bg-white/5 border-white/10 text-white"
                  />
                </Field>
                <Field label="teléfono" error={errors.telefono?.message}>
                  <Input
                    {...register("telefono")}
                    placeholder="0414-1234567"
                    className="bg-white/5 border-white/10 text-white"
                  />
                </Field>
              </FieldRow>

              <FieldRow cols={2}>
                <Field label="fecha de pago" error={errors.fecha_pago?.message}>
                  <Input
                    {...register("fecha_pago")}
                    type="date"
                    max={today}
                    className="bg-white/5 border-white/10 text-white"
                  />
                </Field>
                <Field label={canal.montoLabel} error={errors.monto?.message}>
                  <Input
                    value={watch("monto")}
                    onChange={(e) =>
                      setValue("monto", formatMontoInput(e.target.value), {
                        shouldValidate: true,
                      })
                    }
                    inputMode="decimal"
                    placeholder={canal.montoPlaceholder}
                    className="bg-white/5 border-white/10 text-white font-mono"
                  />
                </Field>

              </FieldRow>

              <FieldRow>
                <Field
                  label="referencia / nº de operación"
                  error={errors.referencia?.message}
                >
                  <Input
                    {...register("referencia")}
                    placeholder="ej. 123456789"
                    className="bg-white/5 border-white/10 text-white"
                  />
                </Field>
              </FieldRow>

              <FieldRow>
                <Field label="comprobante de pago" error={fileError ?? undefined}>
                  <label className="flex items-center gap-3 cursor-pointer rounded-md border border-dashed border-white/15 bg-white/[0.02] hover:bg-white/[0.04] hover:border-[#E3001B]/40 transition px-4 py-3">
                    <Upload className="h-4 w-4 text-zinc-400 flex-shrink-0" />
                    <span className="text-sm text-zinc-300 truncate flex-1">
                      {file ? file.name : "adjuntar imagen o PDF (máx 5 MB)"}
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      className="hidden"
                      onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                </Field>
              </FieldRow>

              <label className="flex items-start gap-2 cursor-pointer">
                <Checkbox
                  checked={esAnonimo}
                  onCheckedChange={(v) => setValue("es_anonimo", v === true)}
                  className="mt-0.5 border-white/30 data-[state=checked]:bg-[#E3001B] data-[state=checked]:border-[#E3001B]"
                />
                <span className="text-xs text-zinc-400 leading-relaxed">
                  publicar mi aporte como anónimo (tu nombre no aparecerá en la
                  tabla pública, pero el equipo lo conserva internamente).
                </span>
              </label>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="bg-transparent border-white/20 text-white hover:bg-white/5"
                  onClick={() => handleClose(false)}
                  disabled={submitting}
                >
                  cancelar
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-[#E3001B] hover:bg-[#c30017] text-white"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> enviando...
                    </>
                  ) : (
                    "enviar aporte"
                  )}
                </Button>
              </div>
              <p className="text-[10px] text-zinc-500 leading-relaxed">
                tu correo y teléfono son privados, solo los usa el equipo del fondo
                para verificar el aporte. tu aporte queda en estado "por verificar"
                hasta que lo confirmemos.
              </p>
            </form>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function FieldRow({
  children,
  cols = 1,
}: {
  children: React.ReactNode;
  cols?: 1 | 2;
}) {
  return (
    <div className={cols === 2 ? "grid grid-cols-1 sm:grid-cols-2 gap-3" : ""}>
      {children}
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] uppercase tracking-wider text-zinc-400">
        {label}
      </Label>
      {children}
      {error && <p className="text-[11px] text-red-400">{error}</p>}
    </div>
  );
}
