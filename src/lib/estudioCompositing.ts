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

/** Ajustes visibles de la composición por capas (escala, posición y sombra de contacto). */
export interface CompositionParams {
  /** Porcentaje del lienzo que puede ocupar la prenda (40–120). */
  cutout_scale: number;
  /** Desplazamiento horizontal en porcentaje del ancho (-50 a 50). */
  cutout_offset_x: number;
  /** Desplazamiento vertical en porcentaje del alto (-50 a 50). */
  cutout_offset_y: number;
  shadow_enabled: boolean;
  /** Opacidad de la sombra (0–100). */
  shadow_intensity: number;
  /** Difuminado de la sombra (0–100). */
  shadow_blur: number;
}

export const DEFAULT_COMPOSITION_PARAMS: CompositionParams = {
  cutout_scale: 80,
  cutout_offset_x: 0,
  cutout_offset_y: 0,
  shadow_enabled: true,
  shadow_intensity: 35,
  shadow_blur: 45,
};

/**
 * Composición real por capas (Fase 1): fondo base + PNG recortado de la prenda + sombra de
 * contacto simple. No pasa por ningún modelo generativo, así que la prenda no se altera.
 * `target` permite reutilizar un canvas ya montado (preview en vivo) en lugar de crear uno nuevo.
 */
export async function composeCutoutOnBackground(
  backgroundUrl: string,
  cutoutUrl: string,
  aspect: string,
  params: CompositionParams = DEFAULT_COMPOSITION_PARAMS,
  target?: HTMLCanvasElement,
): Promise<Blob> {
  const { width, height } = ASPECT_CANVAS[aspect] ?? ASPECT_CANVAS["4:5"];
  const canvas = target ?? document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D no disponible en este navegador.");

  const [bg, cutout] = await Promise.all([loadImage(backgroundUrl), loadImage(cutoutUrl)]);
  ctx.clearRect(0, 0, width, height);
  drawCover(ctx, bg, width, height);

  const scale = Math.min(Math.max(params.cutout_scale, 40), 120) / 100;
  const boxW = width * scale;
  const boxH = height * scale;
  const centerX = width / 2 + (width * params.cutout_offset_x) / 100;
  const centerY = height * 0.47 + (height * params.cutout_offset_y) / 100;

  const fit = Math.min(boxW / cutout.width, boxH / cutout.height);
  const garmentW = cutout.width * fit;
  const garmentH = cutout.height * fit;

  // Sombra de contacto: elipse difuminada justo bajo la prenda, dibujada antes que la capa.
  if (params.shadow_enabled && params.shadow_intensity > 0) {
    const opacity = Math.min(Math.max(params.shadow_intensity, 0), 100) / 100;
    const blurPx = (Math.min(Math.max(params.shadow_blur, 0), 100) / 100) * 60;
    ctx.save();
    ctx.filter = `blur(${blurPx}px)`;
    ctx.fillStyle = `rgba(0, 0, 0, ${opacity})`;
    ctx.beginPath();
    ctx.ellipse(
      centerX,
      centerY + garmentH / 2 - garmentH * 0.02,
      garmentW * 0.34,
      garmentH * 0.035,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.restore();
  }

  drawContain(ctx, cutout, boxW, boxH, centerX, centerY);


  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("No se pudo componer la imagen."))),
      "image/png",
    );
  });
}
