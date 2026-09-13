/**
 * Comprobante de venta Sublime.
 * Se genera SIEMPRE desde la venta ya registrada (nunca desde el carrito).
 * Los precios mostrados ya incluyen IVA: aquí no se suma ningún impuesto.
 */
import jsPDF from "jspdf";
import type { SaleRow } from "@/hooks/useSublimeSalesHistory";
import { refFormat } from "@/lib/posMoney";
import { posMethod } from "@/lib/posPaymentMethods";
import { posBankLabel } from "@/lib/posBanks";
import { posChannelLabel } from "@/lib/posSalesChannels";

export const NO_SESSION = "Sin sesión histórica";
export const WALK_IN = "Venta mostrador";

export const receiptDateTime = (iso: string) => new Date(iso).toLocaleString("es-VE");

export const receiptFileName = (sale: SaleRow) => `${sale.sale_number}.pdf`;

export const receiptSessionLabel = (sale: SaleRow) => sale.session_number ?? NO_SESSION;

export const receiptCustomerLabel = (sale: SaleRow) => sale.customer_name?.trim() || WALK_IN;

export const receiptPaymentLabel = (p: SaleRow["payments"][number]) =>
  [
    posMethod(p.method).label,
    p.bank ? posBankLabel(p.bank) : null,
    p.reference ? `Ref. ${p.reference}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

/** Encabezado común: los mismos datos en pantalla, impresión, PDF y WhatsApp. */
export function receiptHeaderRows(sale: SaleRow): [string, string][] {
  const rows: [string, string][] = [
    ["Fecha", receiptDateTime(sale.sold_at)],
    ["Cliente", receiptCustomerLabel(sale)],
    ["Cajero", sale.cashier_code ?? "—"],
    ["Caja", sale.register_code ?? "—"],
    ["Sesión", receiptSessionLabel(sale)],
    ["Origen", posChannelLabel(sale.sale_origin, sale.origin_detail ?? undefined)],
  ];
  if (sale.invoice_number) rows.push(["Factura", sale.invoice_number]);
  return rows;
}

/** Texto plano del comprobante: se usa para compartir y WhatsApp. */
export function receiptText(sale: SaleRow) {
  const lines: string[] = [];
  lines.push("SUBLIME");
  lines.push(`Comprobante ${sale.sale_number}`);
  for (const [k, v] of receiptHeaderRows(sale)) lines.push(`${k}: ${v}`);
  lines.push("");
  for (const i of sale.items) {
    const detail = [i.subtitle, i.sku].filter(Boolean).join(" · ");
    lines.push(`${i.qty} × ${i.title}${detail ? ` (${detail})` : ""} — ${refFormat(i.line_total_ref)}`);
    if (i.discount_ref > 0) lines.push(`   Descuento: ${refFormat(i.discount_ref)}`);
  }
  lines.push("");
  if (sale.discount_total_ref > 0) lines.push(`Descuentos: ${refFormat(sale.discount_total_ref)}`);
  lines.push(`TOTAL: ${refFormat(sale.total_ref)}`);
  for (const p of sale.payments) lines.push(`Pago: ${receiptPaymentLabel(p)} — ${refFormat(p.amount_ref)}`);
  lines.push("");
  lines.push("Precios con IVA incluido.");
  return lines.join("\n");
}

const esc = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Vista limpia para impresión: sin navegación ni botones, ancho de ticket térmico. */
export function receiptPrintHtml(sale: SaleRow) {
  const header = receiptHeaderRows(sale)
    .map(([k, v]) => `<div class="row"><span>${esc(k)}</span><b>${esc(v)}</b></div>`)
    .join("");
  const items = sale.items
    .map((i) => {
      const detail = [i.subtitle, i.sku].filter(Boolean).join(" · ");
      const disc =
        i.discount_ref > 0
          ? `<div class="muted">Descuento ${esc(refFormat(i.discount_ref))} · full ${esc(refFormat(i.unit_regular_ref))}</div>`
          : "";
      return `<div class="item"><div class="row"><b>${esc(i.title)}</b><b>${esc(refFormat(i.line_total_ref))}</b></div>
        <div class="muted">${esc(detail)}</div>
        <div class="muted">${i.qty} × ${esc(refFormat(i.unit_final_ref))}</div>${disc}</div>`;
    })
    .join("");
  const payments = sale.payments
    .map(
      (p) =>
        `<div class="row"><span>${esc(receiptPaymentLabel(p))}</span><b>${esc(refFormat(p.amount_ref))}</b></div>`
    )
    .join("");

  return `<!doctype html><html lang="es"><head><meta charset="utf-8" />
<title>${esc(sale.sale_number)}</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  * { box-sizing: border-box; }
  body { width: 72mm; margin: 0 auto; font-family: "Helvetica Neue", Arial, sans-serif; font-size: 11px; color: #000; }
  h1 { font-size: 18px; letter-spacing: .28em; margin: 0 0 2px; text-align: center; }
  .num { text-align: center; font-weight: 700; margin-bottom: 8px; }
  .row { display: flex; justify-content: space-between; gap: 8px; }
  .muted { color: #555; font-size: 10px; }
  .item { margin-bottom: 6px; }
  hr { border: none; border-top: 1px dashed #000; margin: 8px 0; }
  .total { display: flex; justify-content: space-between; font-size: 15px; font-weight: 800; }
  .foot { margin-top: 10px; text-align: center; font-size: 10px; color: #555; }
</style></head><body>
<h1>SUBLIME</h1>
<div class="num">${esc(sale.sale_number)}</div>
${header}
<hr />
${items}
<hr />
${sale.discount_total_ref > 0 ? `<div class="row"><span>Descuentos</span><b>− ${esc(refFormat(sale.discount_total_ref))}</b></div>` : ""}
<div class="total"><span>TOTAL</span><span>${esc(refFormat(sale.total_ref))}</span></div>
<hr />
${payments}
${sale.note ? `<hr /><div class="muted">${esc(sale.note)}</div>` : ""}
<div class="foot">Precios con IVA incluido.<br />Gracias por tu compra.</div>
<script>window.onload = function () { window.focus(); window.print(); };</script>
</body></html>`;
}

export function printSaleReceipt(sale: SaleRow) {
  const w = window.open("", "_blank", "width=420,height=720");
  if (!w) return false;
  w.document.write(receiptPrintHtml(sale));
  w.document.close();
  return true;
}

/** PDF del mismo comprobante, en formato de ticket. */
export function buildSaleReceiptPdf(sale: SaleRow) {
  const W = 80;
  const M = 5;
  const inner = W - M * 2;
  const height = 90 + sale.items.length * 14 + sale.payments.length * 5 + (sale.note ? 12 : 0);
  const doc = new jsPDF({ unit: "mm", format: [W, height] });
  let y = 10;

  const line = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(label, M, y);
    doc.text(value, W - M, y, { align: "right" });
    y += 4.2;
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("SUBLIME", W / 2, y, { align: "center" });
  y += 6;
  doc.setFontSize(10);
  doc.text(sale.sale_number, W / 2, y, { align: "center" });
  y += 6;

  doc.setFontSize(7.5);
  for (const [k, v] of receiptHeaderRows(sale)) line(k, v);

  y += 1;
  doc.setDrawColor(120);
  doc.line(M, y, W - M, y);
  y += 4;

  for (const i of sale.items) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    const title = doc.splitTextToSize(i.title, inner - 20) as string[];
    doc.text(title[0], M, y);
    doc.text(refFormat(i.line_total_ref), W - M, y, { align: "right" });
    y += 3.6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    const detail = [i.subtitle, i.sku].filter(Boolean).join(" · ");
    if (detail) {
      doc.text(doc.splitTextToSize(detail, inner) as string[], M, y);
      y += 3.2;
    }
    doc.text(`${i.qty} × ${refFormat(i.unit_final_ref)}`, M, y);
    y += 3.2;
    if (i.discount_ref > 0) {
      doc.text(`Descuento ${refFormat(i.discount_ref)}`, M, y);
      y += 3.2;
    }
    y += 1;
  }

  doc.line(M, y, W - M, y);
  y += 4.5;
  doc.setFontSize(7.5);
  if (sale.discount_total_ref > 0) line("Descuentos", `− ${refFormat(sale.discount_total_ref)}`);
  doc.setFontSize(10);
  line("TOTAL", refFormat(sale.total_ref), true);
  y += 1;
  doc.setFontSize(7.5);
  for (const p of sale.payments) line(receiptPaymentLabel(p), refFormat(p.amount_ref));

  if (sale.note) {
    y += 2;
    doc.setFont("helvetica", "italic");
    doc.text(doc.splitTextToSize(sale.note, inner) as string[], M, y);
    y += 5;
  }

  y += 3;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("Precios con IVA incluido.", W / 2, y, { align: "center" });

  return doc;
}

export function downloadSaleReceiptPdf(sale: SaleRow) {
  buildSaleReceiptPdf(sale).save(receiptFileName(sale));
}

export function saleReceiptPdfFile(sale: SaleRow) {
  const blob = buildSaleReceiptPdf(sale).output("blob");
  return new File([blob], receiptFileName(sale), { type: "application/pdf" });
}

/** Enlace de WhatsApp con el comprobante prellenado (sin API de WhatsApp). */
export function whatsappReceiptUrl(phone: string, sale: SaleRow) {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(receiptText(sale))}`;
}
