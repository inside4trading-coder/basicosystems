import jsPDF from "jspdf";

export type DispatchPdfHeader = {
  dispatch_number: string | null;
  status: string;
  destination_location_name: string | null;
  factory_responsible: string | null;
  carrier_name: string | null;
  notes: string | null;
  closed_at: string | null;
  sent_at: string | null;
};

export type DispatchPdfUnit = {
  unit_code: string;
  product_name: string | null;
  sku: string | null;
  size: string | null;
  order_code?: string | null;
};

const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function groupUnits(units: DispatchPdfUnit[]) {
  const map = new Map<string, { product: string; sku: string; size: string; qty: number }>();
  for (const u of units) {
    const sku = (u.sku ?? "—").trim();
    const size = (u.size ?? "—").trim();
    const product = (u.product_name ?? "—").trim();
    const key = `${product}|${sku}|${size}`;
    const prev = map.get(key);
    if (prev) prev.qty += 1;
    else map.set(key, { product, sku, size, qty: 1 });
  }
  return Array.from(map.values()).sort(
    (a, b) => a.product.localeCompare(b.product) || a.sku.localeCompare(b.sku) || a.size.localeCompare(b.size)
  );
}

function buildPdf(
  kind: "factory" | "reception",
  header: DispatchPdfHeader,
  units: DispatchPdfUnit[]
): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const M = 14;
  let y = 16;

  const title = kind === "factory" ? "DESPACHO FÁBRICA → TIENDA" : "RECEPCIÓN DE MERCANCÍA";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(title, M, y);
  doc.setFontSize(13);
  doc.text(header.dispatch_number ?? "SIN NÚMERO", W - M, y, { align: "right" });
  y += 6;
  doc.setDrawColor(150);
  doc.line(M, y, W - M, y);
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  const orders = Array.from(new Set(units.map((u) => u.order_code).filter(Boolean))) as string[];
  const rows: [string, string][] =
    kind === "factory"
      ? [
          ["Sede destino", header.destination_location_name ?? "—"],
          ["Responsable fábrica", header.factory_responsible ?? "—"],
          ["Fecha/hora cierre", fmt(header.closed_at)],
          ["Transportista", header.carrier_name ?? "—"],
          ["Total prendas", String(units.length)],
          ["OP asociadas", orders.length ? orders.join(", ") : "—"],
        ]
      : [
          ["Sede destino", header.destination_location_name ?? "—"],
          ["Fecha/hora salida", fmt(header.sent_at ?? header.closed_at)],
          ["Transportista", header.carrier_name ?? "—"],
          ["Total prendas esperadas", String(units.length)],
          ["OP asociadas", orders.length ? orders.join(", ") : "—"],
        ];

  for (const [k, v] of rows) {
    doc.setFont("helvetica", "bold");
    doc.text(`${k}:`, M, y);
    doc.setFont("helvetica", "normal");
    doc.text(String(v), M + 42, y, { maxWidth: W - M - 42 - M });
    y += 5.2;
  }

  if (header.notes) {
    doc.setFont("helvetica", "bold");
    doc.text("Observaciones:", M, y);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(header.notes, W - M - 42 - M) as string[];
    doc.text(lines, M + 42, y);
    y += 5.2 * lines.length;
  }

  y += 4;

  // Resumen agrupado
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Resumen por producto / SKU / talla", M, y);
  y += 5;
  doc.setFontSize(9);
  doc.text("Producto", M, y);
  doc.text("SKU", M + 88, y);
  doc.text("Talla", M + 130, y);
  doc.text("Cant.", W - M, y, { align: "right" });
  y += 2;
  doc.line(M, y, W - M, y);
  y += 4.5;
  doc.setFont("helvetica", "normal");

  const ensure = (needed: number) => {
    if (y + needed > 282) {
      doc.addPage();
      y = 18;
    }
  };

  for (const g of groupUnits(units)) {
    ensure(6);
    doc.text(String(g.product).slice(0, 48), M, y);
    doc.text(g.sku, M + 88, y);
    doc.text(g.size, M + 130, y);
    doc.text(String(g.qty), W - M, y, { align: "right" });
    y += 4.8;
  }

  y += 2;
  doc.setFont("helvetica", "bold");
  doc.line(M, y, W - M, y);
  y += 5;
  doc.text(`TOTAL PRENDAS: ${units.length}`, M, y);
  y += 8;

  // Detalle por unidad
  ensure(20);
  doc.setFontSize(11);
  doc.text("Detalle de unidades", M, y);
  y += 5;
  doc.setFontSize(8.5);
  doc.text(kind === "reception" ? "OK" : "#", M, y);
  doc.text("Unit code", M + 10, y);
  doc.text("Producto", M + 68, y);
  doc.text("SKU", M + 138, y);
  doc.text("Talla", W - M, y, { align: "right" });
  y += 2;
  doc.line(M, y, W - M, y);
  y += 4.2;
  doc.setFont("helvetica", "normal");

  units.forEach((u, i) => {
    ensure(6);
    if (kind === "reception") {
      doc.rect(M, y - 3, 3.4, 3.4);
    } else {
      doc.text(String(i + 1), M, y);
    }
    doc.text(u.unit_code, M + 10, y);
    doc.text(String(u.product_name ?? "—").slice(0, 38), M + 68, y);
    doc.text(String(u.sku ?? "—"), M + 138, y);
    doc.text(String(u.size ?? "—"), W - M, y, { align: "right" });
    y += 4.4;
  });

  y += 10;
  ensure(50);

  if (kind === "factory") {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text("SALIDA DE FÁBRICA", M, y);
    y += 12;
    doc.setFont("helvetica", "normal");
    doc.line(M, y, M + 70, y);
    doc.line(W - M - 70, y, W - M, y);
    y += 4.5;
    doc.setFontSize(8.5);
    doc.text("Firma responsable fábrica", M, y);
    doc.text("Firma transportista / quien retira", W - M - 70, y);
    y += 8;
    doc.text("Fecha: ____ / ____ / ______", M, y);
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text("RECIBIDO CONFORME", M, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text("Total recibido: __________        Faltantes: __________        Sobrantes: __________", M, y);
    y += 8;
    doc.setFont("helvetica", "bold");
    doc.text("Diferencias / observaciones:", M, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    for (let i = 0; i < 3; i++) {
      doc.line(M, y + i * 6, W - M, y + i * 6);
    }
    y += 24;
    doc.line(M, y, M + 70, y);
    doc.line(W - M - 70, y, W - M, y);
    y += 4.5;
    doc.text("Responsable tienda (nombre y firma)", M, y);
    doc.text("Fecha y hora de recepción", W - M - 70, y);
  }

  return doc;
}

export function downloadDispatchFactoryPdf(header: DispatchPdfHeader, units: DispatchPdfUnit[]) {
  const doc = buildPdf("factory", header, units);
  doc.save(`${header.dispatch_number ?? "DESPACHO"}-fabrica.pdf`);
}

export function downloadDispatchReceptionPdf(header: DispatchPdfHeader, units: DispatchPdfUnit[]) {
  const doc = buildPdf("reception", header, units);
  doc.save(`${header.dispatch_number ?? "DESPACHO"}-recepcion.pdf`);
}

export function printBothDispatchPdfs(header: DispatchPdfHeader, units: DispatchPdfUnit[]) {
  const factory = buildPdf("factory", header, units);
  const reception = buildPdf("reception", header, units);
  // Combina: añade las páginas del PDF de recepción al de fábrica para imprimir ambos.
  const recPages = reception.getNumberOfPages();
  for (let i = 1; i <= recPages; i++) {
    // jsPDF no permite merge nativo; se abre cada documento en su propia ventana.
    break;
  }
  const openDoc = (d: jsPDF) => {
    const url = d.output("bloburl") as unknown as string;
    window.open(url, "_blank");
  };
  openDoc(factory);
  openDoc(reception);
}
