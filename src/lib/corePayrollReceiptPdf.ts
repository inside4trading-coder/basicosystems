import jsPDF from "jspdf";
import { formatDMY } from "@/lib/dateUtils";

export type PayrollReceiptRun = {
  payroll_code: string | null;
  period_start: string | null;
  period_end: string | null;
  payment_date: string | null;
  status: string | null;
  bcv_rate?: number | null;
};

export type PayrollReceiptLine = {
  operator_name_snapshot: string | null;
  total_processes: number | null;
  subtotal_amount: number | null;
  adjustments_amount: number | null;
  total_amount: number | null;
  currency: string | null;
  status: string | null;
};

export type PayrollReceiptRow = {
  scanned_at: string | null;
  order_code: string | null;
  unit_code: string | null;
  product_name: string | null;
  variant_label: string | null;
  process_name: string | null;
  rate: number | null;
  amount: number | null;
};

export type PayrollReceiptAdjustment = {
  adjustment_type: string | null;
  amount: number | null;
  reason: string | null;
};

const DASH = "—";
const txt = (v: string | null | undefined) => (v && String(v).trim() ? String(v).trim() : DASH);
const money = (n: number | null | undefined, cur = "USD") =>
  n == null || isNaN(Number(n)) ? DASH : `${cur} ${Number(n).toFixed(2)}`;

export function generatePayrollReceiptPdf(
  run: PayrollReceiptRun,
  line: PayrollReceiptLine,
  rows: PayrollReceiptRow[],
  adjustments: PayrollReceiptAdjustment[],
  statusLabel?: string
) {
  const cur = line.currency ?? "USD";
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const M = 12;
  let y = 16;

  const ensure = (needed: number) => {
    if (y + needed > 282) {
      doc.addPage();
      y = 18;
    }
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("BASICO CORE — Comprobante de Nómina", M, y);
  doc.setFontSize(12);
  doc.text(txt(run.payroll_code), W - M, y, { align: "right" });
  y += 5;
  doc.setDrawColor(150);
  doc.line(M, y, W - M, y);
  y += 7;

  const period =
    run.period_start || run.period_end
      ? `${run.period_start ? formatDMY(run.period_start) : DASH} → ${run.period_end ? formatDMY(run.period_end) : DASH}`
      : DASH;

  const info: [string, string][] = [
    ["Código nómina", txt(run.payroll_code)],
    ["Período", period],
    ["Fecha de pago", run.payment_date ? formatDMY(run.payment_date) : DASH],
    ["Estado", txt(statusLabel ?? run.status)],
    ["Operario", txt(line.operator_name_snapshot)],
    ["Procesos / trabajos", line.total_processes != null ? String(line.total_processes) : String(rows.length)],
    ["Subtotal", money(line.subtotal_amount, cur)],
    ["Ajustes", money(line.adjustments_amount, cur)],
    ["Total USD", money(line.total_amount, cur)],
  ];

  doc.setFontSize(9.5);
  for (const [k, v] of info) {
    ensure(6);
    doc.setFont("helvetica", "bold");
    doc.text(`${k}:`, M, y);
    doc.setFont("helvetica", "normal");
    doc.text(v, M + 42, y, { maxWidth: W - M - 42 - M });
    y += 5.2;
  }

  y += 4;

  // Detalle de trabajos
  ensure(20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Detalle de trabajos", M, y);
  y += 5;

  const cols = { fecha: M, op: M + 20, unit: M + 44, prod: M + 78, var: M + 118, proc: M + 138, rate: M + 164, amt: W - M };
  doc.setFontSize(7.8);
  const head = () => {
    doc.setFont("helvetica", "bold");
    doc.text("Fecha", cols.fecha, y);
    doc.text("OP", cols.op, y);
    doc.text("Unidad / QR", cols.unit, y);
    doc.text("Producto", cols.prod, y);
    doc.text("Variante", cols.var, y);
    doc.text("Proceso", cols.proc, y);
    doc.text("Tarifa", cols.rate, y);
    doc.text("Monto", cols.amt, y, { align: "right" });
    y += 2;
    doc.line(M, y, W - M, y);
    y += 4;
    doc.setFont("helvetica", "normal");
  };
  head();

  const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

  if (rows.length === 0) {
    doc.text("Sin trabajos vinculados", M, y);
    y += 5;
  }

  for (const r of rows) {
    if (y + 6 > 282) {
      doc.addPage();
      y = 18;
      doc.setFontSize(7.8);
      head();
    }
    doc.text(r.scanned_at ? formatDMY(r.scanned_at) : DASH, cols.fecha, y);
    doc.text(clip(txt(r.order_code), 12), cols.op, y);
    doc.text(clip(txt(r.unit_code), 19), cols.unit, y);
    doc.text(clip(txt(r.product_name), 22), cols.prod, y);
    doc.text(clip(txt(r.variant_label), 11), cols.var, y);
    doc.text(clip(txt(r.process_name), 14), cols.proc, y);
    doc.text(r.rate != null ? Number(r.rate).toFixed(2) : DASH, cols.rate, y);
    doc.text(r.amount != null ? Number(r.amount).toFixed(2) : DASH, cols.amt, y, { align: "right" });
    y += 4.4;
  }

  y += 4;

  // Resumen por proceso
  const byProcess = new Map<string, { qty: number; total: number }>();
  for (const r of rows) {
    const key = txt(r.process_name);
    const prev = byProcess.get(key) ?? { qty: 0, total: 0 };
    prev.qty += 1;
    prev.total += Number(r.amount ?? 0);
    byProcess.set(key, prev);
  }

  ensure(18);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text("Resumen por proceso", M, y);
  y += 5.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  for (const [name, v] of Array.from(byProcess.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    ensure(6);
    doc.text(`${name} x${v.qty}`, M, y);
    doc.text(money(v.total, cur), W - M, y, { align: "right" });
    y += 4.8;
  }
  if (byProcess.size === 0) {
    doc.text(DASH, M, y);
    y += 4.8;
  }

  // Ajustes
  if (adjustments.length > 0) {
    y += 3;
    ensure(14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.text("Ajustes", M, y);
    y += 5.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    for (const a of adjustments) {
      ensure(6);
      doc.text(clip(`${txt(a.adjustment_type)} — ${txt(a.reason)}`, 80), M, y);
      doc.text(money(a.amount, cur), W - M, y, { align: "right" });
      y += 4.8;
    }
  }

  // Totales
  y += 3;
  ensure(24);
  doc.line(M, y, W - M, y);
  y += 5;
  doc.setFontSize(9.5);
  doc.setFont("helvetica", "normal");
  doc.text("Subtotal", M, y);
  doc.text(money(line.subtotal_amount, cur), W - M, y, { align: "right" });
  y += 5;
  doc.text("Ajustes", M, y);
  doc.text(money(line.adjustments_amount, cur), W - M, y, { align: "right" });
  y += 5.5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("TOTAL USD", M, y);
  doc.text(money(line.total_amount, cur), W - M, y, { align: "right" });
  y += 16;

  // Firmas
  ensure(26);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.line(M, y, M + 70, y);
  doc.line(W - M - 70, y, W - M, y);
  y += 4.5;
  doc.text("Firma operario", M, y);
  doc.text("Firma responsable", W - M - 70, y);
  y += 8;
  doc.setFontSize(8);
  doc.setTextColor(130);
  doc.text("Documento generado automáticamente · BASICO CORE · Nómina", M, y);
  doc.setTextColor(0);

  const safeCode = txt(run.payroll_code).replace(/[^A-Za-z0-9-]+/g, "-");
  const safeOp = txt(line.operator_name_snapshot).replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  doc.save(`BASICO-NOMINA-${safeCode}-${safeOp || "OPERARIO"}.pdf`);
}
