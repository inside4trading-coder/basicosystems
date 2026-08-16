export type LogoPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center";

export interface EstudioBrandSettings {
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  logoPosition: LogoPosition;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`No se pudo cargar la imagen: ${src}`));
    img.src = src;
  });
}

/** Dibuja `img` cubriendo todo el canvas (mismo comportamiento que CSS object-fit: cover). */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) {
  const imgRatio = img.width / img.height;
  const targetRatio = w / h;
  let drawW: number;
  let drawH: number;
  if (imgRatio > targetRatio) {
    drawH = h;
    drawW = h * imgRatio;
  } else {
    drawW = w;
    drawH = w / imgRatio;
  }
  const dx = (w - drawW) / 2;
  const dy = (h - drawH) / 2;
  ctx.drawImage(img, dx, dy, drawW, drawH);
}

const LOGO_MARGIN = 48;

function logoRect(
  position: LogoPosition,
  canvasW: number,
  canvasH: number,
  logoW: number,
  logoH: number,
): { x: number; y: number } {
  switch (position) {
    case "top-left":
      return { x: LOGO_MARGIN, y: LOGO_MARGIN };
    case "top-right":
      return { x: canvasW - logoW - LOGO_MARGIN, y: LOGO_MARGIN };
    case "bottom-left":
      return { x: LOGO_MARGIN, y: canvasH - logoH - LOGO_MARGIN };
    case "center":
      return { x: (canvasW - logoW) / 2, y: (canvasH - logoH) / 2 };
    case "bottom-right":
    default:
      return { x: canvasW - logoW - LOGO_MARGIN, y: canvasH - logoH - LOGO_MARGIN };
  }
}

async function drawLogo(ctx: CanvasRenderingContext2D, canvasW: number, canvasH: number, brand: EstudioBrandSettings) {
  if (!brand.logoUrl) return;
  try {
    const logo = await loadImage(brand.logoUrl);
    const logoW = Math.round(canvasW * 0.16);
    const logoH = Math.round(logoW * (logo.height / logo.width));
    const { x, y } = logoRect(brand.logoPosition, canvasW, canvasH, logoW, logoH);
    ctx.drawImage(logo, x, y, logoW, logoH);
  } catch {
    // El logo es decorativo — si falla la carga, seguimos sin bloquear la generación.
  }
}

async function composeVariant(
  baseImageUrl: string,
  width: number,
  height: number,
  brand: EstudioBrandSettings,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D no disponible en este navegador.");

  const baseImg = await loadImage(baseImageUrl);
  drawCover(ctx, baseImg, width, height);
  await drawLogo(ctx, width, height, brand);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("No se pudo generar la imagen."))), "image/png");
  });
}

/** Recorta/compone la foto generada por IA al formato de post de feed de Instagram (1080x1080). */
export function composeInstagramFeed(baseImageUrl: string, brand: EstudioBrandSettings): Promise<Blob> {
  return composeVariant(baseImageUrl, 1080, 1080, brand);
}

/** Recorta/compone la foto generada por IA al formato de story/reel de Instagram (1080x1920). */
export function composeInstagramStory(baseImageUrl: string, brand: EstudioBrandSettings): Promise<Blob> {
  return composeVariant(baseImageUrl, 1080, 1920, brand);
}

/** Lienzo en píxeles para cada proporción del asistente. */
export const ASPECT_CANVAS: Record<string, { width: number; height: number }> = {
  "4:5": { width: 1080, height: 1350 },
  "1:1": { width: 1080, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
  "16:9": { width: 1920, height: 1080 },
};

/** Dibuja `img` completo dentro del área indicada, conservando su proporción (object-fit: contain). */
function drawContain(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  boxW: number,
  boxH: number,
  centerX: number,
  centerY: number,
): { width: number; height: number; bottom: number } {
  const scale = Math.min(boxW / img.width, boxH / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  const x = centerX - w / 2;
  const y = centerY - h / 2;
  ctx.drawImage(img, x, y, w, h);
  return { width: w, height: h, bottom: y + h };
}

/**
 * Composición real por capas (Fase 1): fondo base + PNG recortado de la prenda + sombra de
 * contacto simple. No pasa por ningún modelo generativo, así que la prenda no se altera.
 */
export async function composeCutoutOnBackground(
  backgroundUrl: string,
  cutoutUrl: string,
  aspect: string,
): Promise<Blob> {
  const { width, height } = ASPECT_CANVAS[aspect] ?? ASPECT_CANVAS["4:5"];
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D no disponible en este navegador.");

  const [bg, cutout] = await Promise.all([loadImage(backgroundUrl), loadImage(cutoutUrl)]);
  drawCover(ctx, bg, width, height);

  // La prenda ocupa como máximo el 78% del lienzo y queda ligeramente sobre el centro,
  // dejando aire abajo para la sombra de contacto.
  const boxW = width * 0.78;
  const boxH = height * 0.78;
  const centerY = height * 0.47;

  // Sombra de contacto: elipse difuminada bajo la prenda, dibujada antes que la capa.
  const probe = Math.min(boxW / cutout.width, boxH / cutout.height);
  const garmentH = cutout.height * probe;
  const garmentW = cutout.width * probe;
  const shadowY = centerY + garmentH / 2 - garmentH * 0.02;
  ctx.save();
  ctx.filter = "blur(24px)";
  ctx.fillStyle = "rgba(0, 0, 0, 0.32)";
  ctx.beginPath();
  ctx.ellipse(width / 2, shadowY, garmentW * 0.34, garmentH * 0.035, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  drawContain(ctx, cutout, boxW, boxH, width / 2, centerY);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("No se pudo componer la imagen."))),
      "image/png",
    );
  });
}
