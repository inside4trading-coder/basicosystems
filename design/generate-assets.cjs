/**
 * Genera los iconos y la tarjeta social a partir de los HTML de design/.
 *
 *   node design/generate-assets.cjs
 *
 * Produce en public/:
 *   favicon.ico             16 + 32 + 48 en un solo fichero, circular
 *   icon-192.png            192×192 circular
 *   icon-512.png            512×512 circular
 *   icon-512-maskable.png   512×512 a sangre, para la máscara de Android
 *   apple-touch-icon.png    180×180 a sangre, para la máscara de iOS
 *   og-basico-systems.jpg   1200×630, JPEG por peso (ver más abajo)
 *
 * Se captura con Playwright —ya está en las devDependencies— porque los
 * originales son HTML con la fuente Fixedsys, y así el icono usa exactamente
 * la misma tipografía que la landing. Cada tamaño se captura a su resolución
 * nativa en lugar de reescalar uno grande.
 */
const { chromium } = require("@playwright/test");
const path = require("path");
const fs = require("fs");

const RAIZ = path.resolve(__dirname, "..");
const PUBLIC = path.join(RAIZ, "public");
const urlDe = (f) => "file://" + path.join(__dirname, f).replace(/\\/g, "/");

/** Empaqueta varios PNG en un .ico. El formato admite PNG incrustado desde
 *  Vista, y es lo que hace cualquier generador moderno. */
function construirIco(pngs) {
  const n = pngs.length;
  const cabecera = Buffer.alloc(6);
  cabecera.writeUInt16LE(0, 0);      // reservado
  cabecera.writeUInt16LE(1, 2);      // tipo 1 = icono
  cabecera.writeUInt16LE(n, 4);      // número de imágenes
  const entradas = [];
  let offset = 6 + n * 16;
  for (const { size, buf } of pngs) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);   // ancho (0 significa 256)
    e.writeUInt8(size >= 256 ? 0 : size, 1);   // alto
    e.writeUInt8(0, 2);                        // colores de la paleta
    e.writeUInt8(0, 3);                        // reservado
    e.writeUInt16LE(1, 4);                     // planos
    e.writeUInt16LE(32, 6);                    // bits por píxel
    e.writeUInt32LE(buf.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += buf.length;
    entradas.push(e);
  }
  return Buffer.concat([cabecera, ...entradas, ...pngs.map((p) => p.buf)]);
}

(async () => {
  const navegador = await chromium.launch({ channel: "chrome" });

  /* ---------- Iconos ----------
     Blanco sobre azul primario #0A37FF: variante `onPrimary` del BrandMark.
     Va en todos los tamaños, no solo en el favicon — un icono que cambia de
     color según la resolución se lee como dos marcas distintas.

     El margen cambia según para qué es cada uno:
       · favicon  → el mínimo, la letra tiene que ser lo mayor posible a 16 px
       · apple    → algo más, iOS le redondea las esquinas
       · maskable → 20 %, Android le recorta un círculo y se come las esquinas */
  const TINTA = "#FFFFFF";
  /* Dos van a sangre en cuadrado y no en círculo, y no es un descuido:
       · maskable → Android le aplica su propia máscara y exige que el fondo
         llegue al borde; un círculo con esquinas transparentes se le rellena
         de negro por fuera.
       · apple    → iOS hace lo mismo, compone la transparencia sobre negro y
         luego redondea a su manera. */
  const encargos = [
    { size: 16,  margen: 0.06, forma: "circulo" },
    { size: 32,  margen: 0.06, forma: "circulo" },
    { size: 48,  margen: 0.06, forma: "circulo" },
    { size: 180, margen: 0.14, forma: "cuadrado", fichero: "apple-touch-icon.png" },
    { size: 192, margen: 0.06, forma: "circulo",  fichero: "icon-192.png" },
    { size: 512, margen: 0.06, forma: "circulo",  fichero: "icon-512.png" },
    { size: 512, margen: 0.20, forma: "cuadrado", fichero: "icon-512-maskable.png" },
  ];
  const capturas = {};
  for (const { size, margen, forma, fichero } of encargos) {
    const p = await navegador.newPage({ viewport: { width: size, height: size } });
    const q = `size=${size}&margen=${margen}&forma=${forma}&tinta=${encodeURIComponent(TINTA)}`;
    await p.goto(`${urlDe("icon.html")}?${q}`, { waitUntil: "load" });
    await p.evaluate(() => window.__icono);          // espera al encaje del glifo
    // omitBackground es imprescindible con la forma circular: por defecto
    // Playwright compone sobre blanco y las esquinas del círculo saldrían
    // blancas en vez de transparentes.
    const buf = await p.locator("canvas").screenshot({ omitBackground: true });
    if (fichero) fs.writeFileSync(path.join(PUBLIC, fichero), buf);
    else capturas[size] = buf;
    await p.close();
  }

  fs.writeFileSync(path.join(PUBLIC, "favicon.ico"),
    construirIco([16, 32, 48].map((size) => ({ size, buf: capturas[size] }))));

  /* ---------- Tarjeta social ----------
     1200×630 y NO al doble. Capturarla a 2400×1260 llevó el fichero a 529 kB, y
     WhatsApp sólo monta la vista previa grande por debajo de unos 300 kB: por
     encima degrada a un thumbnail cuadrado recortado del centro. 1200×630 es
     además la medida que documentan todas las plataformas.

     JPEG y no PNG: el fondo de la tarjeta es el degradado radial del hero, casi
     10.000 colores distintos, y en PNG pesaba 297 kB — bajo el umbral pero con
     3 kB de margen, que cualquier reajuste se come. En JPEG con croma sin
     submuestrear queda en ~100 kB. La tipografía es de contorno (Chakra Petch),
     no bitmap, así que no sufre con la compresión.

     Al cambiar formato o medidas hay que actualizar og:image, og:image:type y
     og:image:width/height en index.html: si no coinciden con el fichero,
     algunas plataformas descartan la imagen. */
  const og = await navegador.newPage({ viewport: { width: 1200, height: 630 } });
  await og.goto(urlDe("og-card.html"), { waitUntil: "load" });
  await og.evaluate(() => document.fonts.ready);
  await og.waitForTimeout(400);
  await og.screenshot({
    path: path.join(PUBLIC, "og-basico-systems.jpg"),
    type: "jpeg",
    quality: 88,
  });
  await og.close();

  await navegador.close();

  for (const f of ["favicon.ico", "icon-192.png", "icon-512.png", "icon-512-maskable.png",
                   "apple-touch-icon.png", "og-basico-systems.jpg"]) {
    const b = fs.statSync(path.join(PUBLIC, f)).size;
    console.log(`  ${f.padEnd(24)} ${(b / 1024).toFixed(1)} kB`);
  }
})();
