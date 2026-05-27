import jsPDF from "jspdf";
import type { Collaboration } from "@/types/rrpp";
import type { RRPPBrand } from "@/hooks/useRRPPBrand";
import { RRPP_BRAND_LABELS } from "@/hooks/useRRPPBrand";
import { formatDMY } from "@/lib/dateUtils";

interface Params {
  collab: Collaboration;
  brand: RRPPBrand;
  contactName: string;
  contactAlias?: string;
}

const today = () => new formatDMY(Date());

export function generateShippingPdf({ collab, brand, contactName, contactAlias }: Params) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const M = 18;
  let y = 20;

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("ORDEN DE PREPARACIÓN — COLABORACIÓN RRPP", M, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(`Marca: ${RRPP_BRAND_LABELS[brand]}    ·    Generado: ${today()}`, M, y);
  doc.setTextColor(0);
  y += 8;
  doc.setDrawColor(220);
  doc.line(M, y, W - M, y);
  y += 8;

  // Instructions box
  doc.setFillColor(255, 247, 224);
  doc.setDrawColor(245, 200, 80);
  doc.roundedRect(M, y, W - M * 2, 24, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("INSTRUCCIONES PARA TIENDA", M + 4, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const instr =
    "El encargado de RRPP envía este documento al equipo de tienda para preparar el envío.\n" +
    "Verifica TALLAS, productos y datos del destinatario antes de despachar. Si falta información,\n" +
    "responde al encargado de RRPP antes de preparar el paquete.";
  doc.text(instr, M + 4, y + 11);
  y += 30;

  // Contact
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Contacto / Perfil", M, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Nombre: ${contactName}${contactAlias ? `  (@${contactAlias})` : ""}`, M, y);
  y += 8;

  // Pedido
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Datos del pedido", M, y);
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(180, 30, 30);
  doc.text("⚠ NO OLVIDES COLOCAR LA TALLA", M, y);
  doc.setTextColor(0);
  y += 6;
  doc.setFont("helvetica", "normal");
  y = drawField(doc, "Fecha de pedido", collab.send_date ? new formatDMY(Date(collab.send_date)) : "—", M, y);
  y = drawMulti(doc, "Productos", collab.products || "—", M, y, W - M * 2);
  y = drawMulti(doc, "Detalles del pedido", collab.order_details || "—", M, y, W - M * 2);
  y += 4;

  // Envío
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Datos de envío", M, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  if (brand === "basico_es") {
    y = drawField(doc, "Nombre", collab.shipping_name || "—", M, y);
    y = drawField(doc, "Apellido", collab.shipping_last_name || "—", M, y);
    y = drawField(doc, "Correo", collab.shipping_email || "—", M, y);
    y = drawField(doc, "Teléfono", collab.shipping_phone || "—", M, y);
    y = drawField(doc, "Código postal", collab.shipping_postal_code || "—", M, y);
    y = drawMulti(doc, "Dirección", collab.shipping_address || "—", M, y, W - M * 2);
  } else {
    y = drawField(doc, "Nombre", collab.shipping_name || "—", M, y);
    y = drawField(doc, "Apellido", collab.shipping_last_name || "—", M, y);
    y = drawField(doc, "Cédula", collab.shipping_id_number || "—", M, y);
    y = drawField(doc, "Teléfono", collab.shipping_phone || "—", M, y);
    y = drawMulti(doc, "Dirección oficina MRW", collab.shipping_address || "—", M, y, W - M * 2);
  }

  // Footer
  doc.setDrawColor(220);
  doc.line(M, 280, W - M, 280);
  doc.setFontSize(8);
  doc.setTextColor(140);
  doc.text("Documento generado automáticamente · BASICO Systems · RRPP", M, 286);

  const safeName = contactName.replace(/[^a-z0-9]+/gi, "_").slice(0, 40);
  doc.save(`Envio_RRPP_${safeName}_${collab.send_date ?? "sin-fecha"}.pdf`);
}

function drawField(doc: jsPDF, label: string, value: string, x: number, y: number): number {
  doc.setFont("helvetica", "bold");
  doc.text(`${label}:`, x, y);
  doc.setFont("helvetica", "normal");
  doc.text(value, x + 42, y);
  return y + 6;
}

function drawMulti(doc: jsPDF, label: string, value: string, x: number, y: number, maxWidth: number): number {
  doc.setFont("helvetica", "bold");
  doc.text(`${label}:`, x, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  const lines = doc.splitTextToSize(value, maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * 5 + 2;
}
