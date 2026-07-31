import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";

type OrderLike = {
  id: string;
  order_code: string;
  status: string;
  order_type?: string | null;
  priority?: string | null;
  sku: string | null;
  product_name: string | null;
  total_quantity: number;
  completed_quantity: number;
  pending_quantity: number;
  source: string;
  created_at: string;
  notes?: string | null;
  reason?: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  open: "Abierta",
  in_production: "En producción",
  partially_completed: "Parcial",
  completed: "Completada",
  closed: "Cerrada",
  cancelled: "Cancelada",
  manually_closed: "Cierre manual",
};

const pad = (n: number) => String(n).padStart(2, "0");
const dmy = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hms = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

const keyOf = (sku: string | null | undefined, size: string | null | undefined) =>
  `${(sku ?? "").trim().toUpperCase()}|${(size ?? "").trim().toUpperCase()}`;

export async function downloadProductionOrderBackupPdf(order: OrderLike) {
  const [{ data: lines }, { data: procs }, { data: links }, { data: units }] = await Promise.all([
    supabase.from("core_production_order_lines").select("*").eq("production_order_id", order.id),
    supabase
      .from("core_production_order_processes")
      .select("*")
      .eq("production_order_id", order.id)
      .order("process_order"),
    supabase
      .from("core_production_order_need_links")
      .select("*, core_production_needs(variant_sku, product_name, size, quantity_needed)")
      .eq("production_order_id", order.id),
    supabase
      .from("core_production_units")
      .select("variant_sku, size, status")
      .eq("production_order_id", order.id),
  ]);

  const lineRows = ((lines as any[]) ?? []) as any[];
  const procRows = ((procs as any[]) ?? []) as any[];
  const linkRows = ((links as any[]) ?? []) as any[];
  const unitRows = ((units as any[]) ?? []) as any[];

  const generatedByKey = new Map<string, number>();
  for (const u of unitRows) {
    const k = keyOf(u.variant_sku, u.size);
    generatedByKey.set(k, (generatedByKey.get(k) ?? 0) + 1);
  }

  const now = new Date();
  const created = new Date(order.created_at);
  const statusLabel = STATUS_LABEL[order.status] ?? order.status;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const H = 297;
  const M = 15;
  let y = 18;

  const ensureSpace = (needed: number) => {
    if (y + needed > H - 22) {
      doc.addPage();
      y = 18;
    }
  };

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("BASICO CORE", M, y);
  y += 6;
  doc.setFontSize(12);
  doc.text(
    `Respaldo Orden de Producción — ${order.order_code} — ${dmy(now)}`,
    M,
    y,
  );
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(`Código OP: ${order.order_code}`, M, y);
  doc.text(`Estado: ${statusLabel}`, M + 70, y);
  y += 4.5;
  doc.text(`Creada: ${dmy(created)} ${hms(created)}`, M, y);
  doc.text(`Generado: ${dmy(now)} ${hms(now)}`, M + 70, y);
  doc.setTextColor(0);
  y += 5;
  doc.setDrawColor(220);
  doc.line(M, y, W - M, y);
  y += 8;

  // Resumen
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Resumen", M, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Producto: ${order.product_name ?? "—"}`, M, y);
  y += 4.5;
  doc.text(`SKU: ${order.sku ?? "—"}`, M, y);
  y += 4.5;
  doc.text(
    `Total unidades: ${order.total_quantity}    ·    Pendientes: ${order.pending_quantity}    ·    Completadas: ${order.completed_quantity}`,
    M,
    y,
  );
  y += 4.5;
  doc.text(
    `Origen: ${order.source}    ·    Tipo: ${order.order_type ?? "—"}    ·    Prioridad: ${order.priority ?? "—"}`,
    M,
    y,
  );
  y += 4.5;
  doc.text(`Unidades generadas (QR): ${unitRows.length}`, M, y);
  y += 4.5;
  if (order.reason) {
    doc.text(`Motivo: ${order.reason}`, M, y);
    y += 4.5;
  }
  if (order.notes) {
    const notes = doc.splitTextToSize(`Notas: ${order.notes}`, W - M * 2) as string[];
    doc.text(notes, M, y);
    y += notes.length * 4.2;
  }
  y += 4;

  // Necesidades vinculadas
  if (linkRows.length) {
    ensureSpace(20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Necesidades vinculadas", M, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    for (const l of linkRows) {
      const n = l.core_production_needs ?? {};
      ensureSpace(6);
      const txt = `• ${n.variant_sku ?? "—"}  ${n.product_name ?? ""}${n.size ? ` / ${n.size}` : ""}  —  cant. ${l.quantity_linked ?? n.quantity_needed ?? "—"}`;
      doc.text(doc.splitTextToSize(txt, W - M * 2) as string[], M, y);
      y += 4.5;
    }
    y += 4;
  }

  // Tabla de líneas
  ensureSpace(24);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Productos / líneas", M, y);
  y += 6;

  const cols = [
    { label: "SKU", x: M, w: 32 },
    { label: "Producto", x: M + 32, w: 58 },
    { label: "Talla", x: M + 90, w: 22 },
    { label: "Ord.", x: M + 112, w: 22 },
    { label: "Gen.", x: M + 134, w: 22 },
    { label: "Compl.", x: M + 156, w: 24 },
  ];

  const drawHead = () => {
    doc.setFillColor(240, 240, 240);
    doc.rect(M, y - 4, W - M * 2, 6.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    for (const c of cols) doc.text(c.label, c.x + 1, y);
    y += 6;
    doc.setFont("helvetica", "normal");
  };
  drawHead();

  doc.setFontSize(8.5);
  if (lineRows.length === 0) {
    doc.text("Sin líneas registradas", M + 1, y);
    y += 6;
  }
  for (const l of lineRows) {
    ensureSpace(8);
    if (y === 18) drawHead();
    const gen = generatedByKey.get(keyOf(l.variant_sku ?? l.sku, l.size)) ?? 0;
    const vals = [
      String(l.variant_sku ?? l.sku ?? "—"),
      String(l.variant_label ?? order.product_name ?? "—"),
      String(l.size ?? "—"),
      String(l.quantity_ordered ?? 0),
      String(gen),
      String(l.quantity_completed ?? 0),
    ];
    vals.forEach((v, i) => {
      const c = cols[i];
      const t = (doc.splitTextToSize(v, c.w - 2) as string[])[0] ?? "";
      doc.text(t, c.x + 1, y);
    });
    y += 5.2;
    doc.setDrawColor(235);
    doc.line(M, y - 3.6, W - M, y - 3.6);
  }
  y += 6;

  // Procesos
  if (procRows.length) {
    ensureSpace(20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Procesos requeridos", M, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    for (const p of procRows) {
      ensureSpace(6);
      doc.text(
        `${p.process_order ?? "-"}. ${p.process_name}${p.suggested_role ? ` — ${p.suggested_role}` : ""}${p.adds_to_payroll ? " — nómina" : ""}`,
        M,
        y,
      );
      y += 4.5;
    }
  }

  // Pie en todas las páginas
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(130);
    doc.text(
      "Documento de respaldo operativo generado desde Basico Core",
      M,
      H - 12,
    );
    doc.text(`${dmy(now)} ${hms(now)}  ·  Pág. ${i}/${pages}`, W - M, H - 12, {
      align: "right",
    });
    doc.setTextColor(0);
  }

  doc.save(`${order.order_code}_respaldo_${ymd(now)}.pdf`);
}
