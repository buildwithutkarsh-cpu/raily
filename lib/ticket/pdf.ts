/* ══════════════════════════════════════════════════════════════
   TICKET — PDF Generation
   
   Generates a railway ticket PDF using pdfkit with Indian
   Railways-style formatting. This is a simulated booking —
   no real IRCTC API is called.
   ══════════════════════════════════════════════════════════════ */

import PDFDocument from "pdfkit";

export interface TicketData {
  pnr: string;
  trainName: string;
  trainNumber: string;
  from: string;
  fromCode: string;
  to: string;
  toCode: string;
  date: string;
  departure: string;
  arrival: string;
  duration: string;
  coach: string;
  seat: string;
  tier: string;
  fare: number;
  class: string;
  passengerName: string;
  platform?: string;
  bookingTime: string;
}

const COLORS = {
  primary: [30, 30, 30] as [number, number, number],       // #1E1E1E
  red: [196, 30, 58] as [number, number, number],           // #C41E3A
  muted: [120, 120, 120] as [number, number, number],       // #787878
  light: [230, 230, 230] as [number, number, number],       // #E6E6E6
  white: [255, 255, 255] as [number, number, number],
  bg: [245, 242, 234] as [number, number, number],          // #F5F2EA
};

/**
 * Generate a PDF ticket buffer for a simulated railway booking.
 * Returns a Node.js Buffer suitable for email attachments.
 */
export function generateTicketPDF(data: TicketData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [288, 600], // ~3" x 6.25" — ticket stub size
      margins: { top: 20, bottom: 20, left: 20, right: 20 },
      info: {
        Title: `RAILY Ticket - ${data.pnr}`,
        Author: "RAILY",
        Subject: "Railway Booking Confirmation",
        Keywords: "railway, ticket, indian railways, booking",
      },
    });

    const buffers: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => buffers.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    const pageWidth = 288;
    const leftMargin = 20;
    const rightMargin = 20;
    const contentWidth = pageWidth - leftMargin - rightMargin;
    let y = 20;

    /* ── Helper Functions ─────────────────────────────────── */

    function drawLine(yPos: number, color = COLORS.light) {
      doc
        .moveTo(leftMargin, yPos)
        .lineTo(pageWidth - rightMargin, yPos)
        .strokeColor(color)
        .lineWidth(0.5)
        .stroke();
    }

    function drawDashedLine(yPos: number) {
      let x = leftMargin;
      doc.moveTo(x, yPos);
      while (x < pageWidth - rightMargin) {
        x += 5;
        doc.lineTo(Math.min(x, pageWidth - rightMargin), yPos);
        x += 3;
        doc.moveTo(x, yPos);
      }
      doc.strokeColor(COLORS.light).lineWidth(0.5).stroke();
    }

    function centerText(text: string, yPos: number, size: number, color = COLORS.primary) {
      const width = doc.widthOfString(text);
      const x = (pageWidth - width) / 2;
      doc.fontSize(size).fillColor(color).text(text, x, yPos);
    }

    /* ── Header — RAILY Brand ────────────────────────────── */
    doc
      .rect(leftMargin - 4, y - 4, contentWidth + 8, 38)
      .fillColor(COLORS.primary)
      .fill();

    doc
      .font("Helvetica-Bold")
      .fontSize(16)
      .fillColor(COLORS.white)
      .text("RAILY", leftMargin + 8, y + 6, { width: contentWidth, align: "left" });

    doc
      .font("Helvetica")
      .fontSize(6)
      .fillColor(COLORS.white)
      .text("SIMULATED TICKET", leftMargin + 8, y + 24, {
        width: contentWidth,
        align: "left",
      });

    /* ── Status Badge ─────────────────────────────────────── */
    doc
      .fontSize(7)
      .fillColor(COLORS.white)
      .text("CONFIRMED ✦", pageWidth - rightMargin - 6, y + 8, { align: "right" });

    y += 44;

    /* ── PNR ──────────────────────────────────────────────── */
    drawLine(y);
    y += 6;

    doc
      .font("Helvetica")
      .fontSize(6)
      .fillColor(COLORS.muted)
      .text("PNR NUMBER", leftMargin, y);

    doc
      .font("Helvetica-Bold")
      .fontSize(18)
      .fillColor(COLORS.primary)
      .text(data.pnr, leftMargin, y + 8);
    y += 32;

    /* ── Train Info ───────────────────────────────────────── */
    drawLine(y);
    y += 6;

    doc
      .font("Helvetica")
      .fontSize(6)
      .fillColor(COLORS.muted)
      .text("TRAIN", leftMargin, y);

    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor(COLORS.primary)
      .text(`${data.trainName} (${data.trainNumber})`, leftMargin, y + 10);
    y += 24;

    /* ── Route — Departure → Arrival ──────────────────────── */
    drawLine(y);
    y += 8;

    // Departure station
    doc
      .font("Helvetica-Bold")
      .fontSize(14)
      .fillColor(COLORS.primary)
      .text(data.fromCode, leftMargin, y);

    doc
      .font("Helvetica")
      .fontSize(7)
      .fillColor(COLORS.muted)
      .text(data.from, leftMargin, y + 16);

    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(COLORS.primary)
      .text(data.departure, leftMargin, y + 28);

    // Arrow in the middle
    const arrowX = (pageWidth) / 2 - 8;
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor(COLORS.muted)
      .text("→", arrowX, y + 6);

    doc
      .fontSize(6)
      .fillColor(COLORS.muted)
      .text(data.duration, arrowX - 8, y + 20, {
        width: 28,
        align: "center",
      });

    // Arrival station
    doc
      .font("Helvetica-Bold")
      .fontSize(14)
      .fillColor(COLORS.primary)
      .text(data.toCode, pageWidth - rightMargin, y, { align: "right" });

    doc
      .font("Helvetica")
      .fontSize(7)
      .fillColor(COLORS.muted)
      .text(data.to, pageWidth - rightMargin - 10, y + 16, {
        width: contentWidth / 2,
        align: "right",
      });

    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(COLORS.primary)
      .text(data.arrival, pageWidth - rightMargin - 20, y + 28, { align: "right" });

    y += 48;

    /* ── Journey Details Grid ─────────────────────────────── */
    drawDashedLine(y);
    y += 6;

    const colW = contentWidth / 3;
    const details = [
      { label: "DATE", value: data.date },
      { label: "CLASS", value: data.class },
      { label: "PLATFORM", value: data.platform || "—" },
    ];

    details.forEach((d, i) => {
      const x = leftMargin + i * colW;
      doc
        .font("Helvetica")
        .fontSize(6)
        .fillColor(COLORS.muted)
        .text(d.label, x, y);

      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor(COLORS.primary)
        .text(d.value, x, y + 8);
    });

    y += 26;

    /* ── Coach & Seat ─────────────────────────────────────── */
    drawDashedLine(y);
    y += 6;

    const seatDetails = [
      { label: "COACH", value: data.coach },
      { label: "SEAT", value: `${data.seat} (${data.tier})` },
      { label: "FARE", value: `₹${data.fare}` },
    ];

    seatDetails.forEach((d, i) => {
      const x = leftMargin + i * colW;
      doc
        .font("Helvetica")
        .fontSize(6)
        .fillColor(COLORS.muted)
        .text(d.label, x, y);

      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor(COLORS.primary)
        .text(d.value, x, y + 8);
    });

    y += 26;

    /* ── Passenger ────────────────────────────────────────── */
    drawDashedLine(y);
    y += 6;

    doc
      .font("Helvetica")
      .fontSize(6)
      .fillColor(COLORS.muted)
      .text("PASSENGER", leftMargin, y);

    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor(COLORS.primary)
      .text(data.passengerName.toUpperCase(), leftMargin, y + 8);

    doc
      .font("Helvetica")
      .fontSize(6)
      .fillColor(COLORS.muted)
      .text(`1 Adult · ${data.coach}-${data.seat} (${data.tier})`, leftMargin, y + 20);

    y += 32;

    /* ── Booking Time ─────────────────────────────────────── */
    drawDashedLine(y);
    y += 6;

    doc
      .font("Helvetica")
      .fontSize(6)
      .fillColor(COLORS.muted)
      .text("BOOKED AT", leftMargin, y);

    doc
      .font("Helvetica")
      .fontSize(7)
      .fillColor(COLORS.primary)
      .text(data.bookingTime, leftMargin, y + 8);

    y += 22;

    /* ── Footer ──────────────────────────────────────────── */
    drawLine(y);
    y += 6;

    centerText("✦ SIMULATED TICKET · NOT VALID FOR REAL TRAVEL ✦", y, 6, COLORS.muted);
    y += 10;

    centerText("RAILY — AI OS for Indian Railways", y, 5, COLORS.muted);
    y += 8;

    centerText(`PNR: ${data.pnr}`, y, 5, COLORS.muted);

    /* ── Barcode at bottom ──────────────────────────────── */
    y = doc.page.height - 40;
    drawDashedLine(y);
    y += 6;

    // Simple visual barcode (alternating rectangles)
    const barcodeStr = data.pnr.replace(/\D/g, "");
    const barX = leftMargin;
    const barY = y;
    const barHeight = 14;
    let barXPos = barX;

    for (let i = 0; i < barcodeStr.length; i++) {
      const digit = parseInt(barcodeStr[i]);
      const width = 1 + (digit % 3);
      doc
        .rect(barXPos, barY, width, barHeight)
        .fillColor(digit % 2 === 0 ? COLORS.primary : COLORS.light)
        .fill();
      barXPos += width + 1;
    }

    y += barHeight + 6;
    centerText(data.pnr, y, 5, COLORS.muted);

    /* ── Finalize ─────────────────────────────────────────── */
    doc.end();
  });
}
