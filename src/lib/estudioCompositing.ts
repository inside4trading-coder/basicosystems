export type LogoPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center";

export interface EstudioBrandSettings {
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  logoPosition: LogoPosition;
  showProductName: boolean;
  showPrice: boolean;
}

export interface EstudioOverlayText {
  productName?: string | null;
  productPrice?: string | null;
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

function drawTextBanner(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  brand: EstudioBrandSettings,
  overlay: EstudioOverlayText,
) {
  const lines: string[] = [];
  if (brand.showProductName && overlay.productName) lines.push(overlay.productName);
  if (brand.showPrice && overlay.productPrice) lines.push(overlay.productPrice);
  if (lines.length === 0) return;

  const bannerHeight = 44 + lines.length * 56;
  ctx.fillStyle = brand.secondaryColor;
  ctx.fillRect(0, canvasH - bannerHeight, canvasW, bannerHeight);

  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  lines.forEach((line, i) => {
    ctx.font = i === 0 ? "600 34px system-ui, sans-serif" : "400 28px system-ui, sans-serif";
    if (i === 0) ctx.fillStyle = brand.primaryColor === brand.secondaryColor ? "#ffffff" : brand.primaryColor;
    else ctx.fillStyle = "#ffffff";
    const y = canvasH - bannerHeight + 44 + i * 56;
    ctx.fillText(line, LOGO_MARGIN, y);
  });
}

async function composeVariant(
  baseImageUrl: string,
  width: number,
  height: number,
  brand: EstudioBrandSettings,
  overlay: EstudioOverlayText,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D no disponible en este navegador.");

  const baseImg = await loadImage(baseImageUrl);
  drawCover(ctx, baseImg, width, height);
  await drawLogo(ctx, width, height, brand);
  drawTextBanner(ctx, width, height, brand, overlay);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("No se pudo generar la imagen."))), "image/png");
  });
}

/** Recorta/compone la foto generada por IA al formato de post de feed de Instagram (1080x1080). */
export function composeInstagramFeed(
  baseImageUrl: string,
  brand: EstudioBrandSettings,
  overlay: EstudioOverlayText = {},
): Promise<Blob> {
  return composeVariant(baseImageUrl, 1080, 1080, brand, overlay);
}

/** Recorta/compone la foto generada por IA al formato de story/reel de Instagram (1080x1920). */
export function composeInstagramStory(
  baseImageUrl: string,
  brand: EstudioBrandSettings,
  overlay: EstudioOverlayText = {},
): Promise<Blob> {
  return composeVariant(baseImageUrl, 1080, 1920, brand, overlay);
}
