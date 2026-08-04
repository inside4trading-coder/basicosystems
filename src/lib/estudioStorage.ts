import { supabase } from "@/integrations/supabase/client";

export const ESTUDIO_BUCKET = "estudio-visual";
export const ESTUDIO_PHOTO_ACCEPTED_MIME = ["image/jpeg", "image/png", "image/webp"];
export const ESTUDIO_PHOTO_MAX_BYTES = 10 * 1024 * 1024;

export function validateEstudioPhotoFile(file: File): { ok: boolean; message?: string } {
  if (!ESTUDIO_PHOTO_ACCEPTED_MIME.includes(file.type)) {
    return { ok: false, message: "Solo puedes subir imágenes JPG, PNG o WEBP." };
  }
  if (file.size > ESTUDIO_PHOTO_MAX_BYTES) {
    return { ok: false, message: "La imagen supera el límite de 10 MB." };
  }
  return { ok: true };
}

function extForMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

export async function uploadEstudioSourcePhoto(file: File): Promise<string> {
  const check = validateEstudioPhotoFile(file);
  if (!check.ok) throw new Error(check.message);
  const ext = extForMime(file.type);
  const path = `originales/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from(ESTUDIO_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}

const signedUrlCache = new Map<string, { url: string; exp: number }>();

export async function resolveEstudioSignedUrl(path: string): Promise<string> {
  const cached = signedUrlCache.get(path);
  const now = Date.now();
  if (cached && cached.exp > now + 60_000) return cached.url;
  const { data, error } = await supabase.storage
    .from(ESTUDIO_BUCKET)
    .createSignedUrl(path, 60 * 60);
  if (error || !data?.signedUrl) return "";
  signedUrlCache.set(path, { url: data.signedUrl, exp: now + 55 * 60 * 1000 });
  return data.signedUrl;
}

export async function downloadEstudioImage(path: string, filename: string): Promise<void> {
  const resolved = await resolveEstudioSignedUrl(path);
  if (!resolved) return;
  try {
    const res = await fetch(resolved);
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objUrl), 1000);
  } catch {
    window.open(resolved, "_blank");
  }
}

/** Descarga un Blob generado en el navegador (ej. las variantes de Instagram compuestas en Canvas). */
export function downloadBlob(blob: Blob, filename: string): void {
  const objUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objUrl), 1000);
}
