/* ══════════════════════════════════════════════════════════════
   TICKET — Send Email API
   
   POST /api/ticket/send
   
   Receives booking data, generates a PDF ticket, and emails it
   to the user via Resend. This is a simulated booking — no real
   IRCTC API is called.
   ══════════════════════════════════════════════════════════════ */

import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { generateTicketPDF } from "@/lib/ticket-pdf";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface SendTicketRequest {
  email: string;
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
}

export async function POST(request: NextRequest) {
  try {
    const body: SendTicketRequest = await request.json();

    // ── Validation ──────────────────────────────────────────
    if (!body.email || !body.pnr || !body.trainName) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_INPUT",
            message: "Missing required fields: email, pnr, trainName",
          },
        },
        { status: 400 }
      );
    }

    if (!body.email.includes("@")) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_EMAIL",
            message: "Please provide a valid email address",
          },
        },
        { status: 400 }
      );
    }

    // ── Generate PDF ────────────────────────────────────────
    const pdfBuffer = await generateTicketPDF({
      pnr: body.pnr,
      trainName: body.trainName,
      trainNumber: body.trainNumber,
      from: body.from,
      fromCode: body.fromCode,
      to: body.to,
      toCode: body.toCode,
      date: body.date,
      departure: body.departure,
      arrival: body.arrival,
      duration: body.duration,
      coach: body.coach,
      seat: body.seat,
      tier: body.tier,
      fare: body.fare,
      class: body.class,
      passengerName: body.passengerName || "Passenger",
      platform: body.platform || "5",
      bookingTime: new Date().toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    });

    // ── Check if request is for download vs email ────────────
    const isExplicitDownload = body.email === "download@raily.app";
    const isEmailAvailable = !!process.env.RESEND_API_KEY;

    if (isExplicitDownload) {
      // User clicked Download — return PDF directly
      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="ticket-${body.pnr}.pdf"`,
          "X-Ticket-Info": "PDF ticket generated successfully.",
        },
      });
    }

    if (!isEmailAvailable) {
      // User wanted email but Resend is not configured
      return NextResponse.json({
        success: false,
        error: {
          code: "EMAIL_NOT_CONFIGURED",
          message:
            "Email service is not configured. Use the Download button to get your ticket PDF instead.",
        },
      });
    }

    // ── Send Email via Resend ───────────────────────────────
    const { data, error } = await resend!.emails.send({
      from: `RAILY <${process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev"}>`,
      to: [body.email],
      subject: `🎫 Your RAILY Ticket - ${body.trainName} (${body.trainNumber})`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: 'Courier New', monospace;
              background: #F5F2EA;
              color: #1E1E1E;
              margin: 0;
              padding: 0;
            }
            .container {
              max-width: 520px;
              margin: 0 auto;
              padding: 40px 20px;
            }
            .header {
              background: #1E1E1E;
              padding: 24px;
              text-align: center;
              border: 2px solid #1E1E1E;
            }
            .header h1 {
              color: #F5F2EA;
              font-size: 24px;
              margin: 0;
              letter-spacing: 0.15em;
              text-transform: uppercase;
            }
            .header p {
              color: #F5F2EA;
              font-size: 11px;
              margin: 8px 0 0;
              opacity: 0.7;
              letter-spacing: 0.1em;
              text-transform: uppercase;
            }
            .badge {
              display: inline-block;
              background: #1E1E1E;
              color: #F5F2EA;
              padding: 4px 12px;
              font-size: 10px;
              letter-spacing: 0.1em;
              text-transform: uppercase;
            }
            .card {
              border: 2px solid #1E1E1E;
              padding: 24px;
              margin-bottom: 16px;
              background: #F5F2EA;
            }
            .card h2 {
              font-size: 11px;
              margin: 0 0 8px;
              letter-spacing: 0.15em;
              text-transform: uppercase;
              color: #787878;
            }
            .pnr {
              font-size: 28px;
              font-weight: bold;
              letter-spacing: 0.05em;
              margin: 4px 0;
            }
            .train-name {
              font-size: 16px;
              font-weight: bold;
              margin: 4px 0;
            }
            .route {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin: 12px 0;
            }
            .station {
              text-align: center;
            }
            .station-code {
              font-size: 20px;
              font-weight: bold;
            }
            .station-name {
              font-size: 10px;
              color: #787878;
              margin-top: 2px;
            }
            .station-time {
              font-size: 11px;
              margin-top: 4px;
            }
            .arrow {
              font-size: 18px;
              color: #787878;
            }
            .details-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 12px;
              border-top: 1px dashed #d0d0d0;
              padding-top: 12px;
              margin-top: 12px;
            }
            .detail-item {
              text-align: center;
            }
            .detail-label {
              font-size: 9px;
              color: #787878;
              letter-spacing: 0.15em;
              text-transform: uppercase;
              margin-bottom: 4px;
            }
            .detail-value {
              font-size: 13px;
              font-weight: bold;
            }
            .footer {
              text-align: center;
              padding: 24px;
              border: 2px solid #1E1E1E;
              margin-top: 16px;
            }
            .footer p {
              font-size: 10px;
              color: #787878;
              margin: 4px 0;
              letter-spacing: 0.1em;
              text-transform: uppercase;
            }
            .button {
              display: inline-block;
              background: #C41E3A;
              color: #F5F2EA !important;
              text-decoration: none;
              padding: 12px 24px;
              font-size: 11px;
              letter-spacing: 0.15em;
              text-transform: uppercase;
              font-weight: bold;
              margin-top: 16px;
              border: 2px solid #C41E3A;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚆 RAILY</h1>
              <p>Simulated Booking Confirmation</p>
            </div>

            <div class="card" style="margin-top:16px;">
              <div style="text-align:center;">
                <span class="badge">CONFIRMED ✦</span>
              </div>
              <h2>PNR Number</h2>
              <div class="pnr">${body.pnr}</div>
            </div>

            <div class="card">
              <h2>Train</h2>
              <div class="train-name">${body.trainName}</div>
              <div style="font-size:11px;color:#787878;margin:2px 0;">
                ${body.trainNumber} · ${body.class}
              </div>
            </div>

            <div class="card">
              <h2>Journey</h2>
              <div style="font-size:10px;color:#787878;margin-bottom:8px;">
                ${body.date}
              </div>
              <div class="route">
                <div class="station">
                  <div class="station-code">${body.fromCode}</div>
                  <div class="station-name">${body.from}</div>
                  <div class="station-time">${body.departure}</div>
                </div>
                <div class="arrow">→</div>
                <div class="station">
                  <div class="station-code">${body.toCode}</div>
                  <div class="station-name">${body.to}</div>
                  <div class="station-time">${body.arrival}</div>
                </div>
              </div>
              <div style="text-align:center;font-size:10px;color:#787878;margin-top:8px;">
                ${body.duration}
              </div>
            </div>

            <div class="card">
              <h2>Passenger & Seat</h2>
              <div style="font-size:14px;font-weight:bold;margin:4px 0;">
                ${body.passengerName.toUpperCase()}
              </div>
              <div class="details-grid">
                <div class="detail-item">
                  <div class="detail-label">Coach</div>
                  <div class="detail-value">${body.coach}</div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">Seat</div>
                  <div class="detail-value">${body.seat} (${body.tier})</div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">Fare</div>
                  <div class="detail-value">₹${body.fare}</div>
                </div>
              </div>
            </div>

            <div class="footer">
              <p>✦ This is a simulated ticket ✦</p>
              <p>Not valid for real travel on Indian Railways</p>
              <p style="margin-top:12px;font-size:9px;">
                RAILY — AI OS for Indian Railways<br>
                PNR: ${body.pnr}
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
      attachments: [
        {
          filename: `ticket-${body.pnr}.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    if (error) {
      console.error("[Ticket API] Resend error:", error);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "EMAIL_FAILED",
            message: error.message || "Failed to send email",
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Ticket sent to your email!",
      data: {
        pnr: body.pnr,
        emailId: data?.id,
      },
    });
  } catch (err) {
    console.error("[Ticket API] Error:", err);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: err instanceof Error ? err.message : "Internal server error",
        },
      },
      { status: 500 }
    );
  }
}
