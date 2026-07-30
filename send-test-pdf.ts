/* ══════════════════════════════════════════════════════════════
   SEND — Email the Test PDF to buildwithutkarsh@gmail.com
   
   Usage:
     1. Create .env.local with: RESEND_API_KEY=re_xxxxxxxxxxxxx
     2. Run: npx tsx send-test-pdf.ts
   
   The script:
     - Reads .env.local for the Resend API key
     - Generates the same test PDF as test-pdf.ts
     - Emails it as an attachment via Resend
   ══════════════════════════════════════════════════════════════ */

import { generateTicketPDF } from "./lib/ticket/pdf";
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

/* ─── Load .env.local Manually ──────────────────────────── */

const envPath = join(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    // Strip surrounding quotes if any
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

/* ─── Test Data (matches test-pdf.ts) ────────────────────── */

const TEST_DATA = {
  pnr: "8123456789",
  trainName: "Mumbai Rajdhani",
  trainNumber: "12951",
  from: "Mumbai Central",
  fromCode: "BCT",
  to: "New Delhi",
  toCode: "NDLS",
  date: "15 Aug 2026",
  departure: "16:35",
  arrival: "08:30",
  duration: "15h 55m",
  coach: "B1",
  seat: "7",
  tier: "Lower",
  fare: 3245,
  class: "3A",
  passengerName: "Aarav Sharma",
  platform: "5",
  bookingTime: "10 Aug 2026, 02:15 PM",
};

/* ─── Main ───────────────────────────────────────────────── */

async function main() {
  console.log("═══════════════════════════════════════════════");
  console.log("  Send Test PDF via Email");
  console.log("═══════════════════════════════════════════════\n");

  // 1. Check Resend API key
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("  ✗ RESEND_API_KEY not found!");
    console.error("\n  Create .env.local in the project root with:");
    console.error("    RESEND_API_KEY=re_xxxxxxxxxxxxx\n");
    console.error("  Get a key at: https://resend.com/api-keys\n");
    process.exit(1);
  }

  const keyPreview = apiKey.slice(0, 6) + "...";
  console.log(`  ✓ Resend API key found: ${keyPreview}`);

  // 2. Generate PDF
  console.log("\n  1. Generating PDF...");
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await generateTicketPDF(TEST_DATA);
  } catch (err) {
    console.error(`  ✗ PDF generation failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  const sizeKB = (pdfBuffer.length / 1024).toFixed(1);
  console.log(`  ✓ PDF generated: ${sizeKB} KB`);

  // 3. Save a copy locally too
  const outputDir = join(process.cwd(), "test-output");
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });
  const localPath = join(outputDir, `ticket-${TEST_DATA.pnr}.pdf`);
  writeFileSync(localPath, pdfBuffer);
  console.log(`  ✓ Saved locally: ${localPath}`);

  // 4. Send via Resend
  console.log("\n  2. Sending email via Resend...");

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);

  const { data, error } = await resend.emails.send({
    from: "RAILY <onboarding@resend.dev>",
    to: ["buildwithutkarsh@gmail.com"],
    subject: `🎫 Your RAILY Ticket - ${TEST_DATA.trainName} (${TEST_DATA.trainNumber})`,
    html: `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: 'Courier New', monospace; background: #F5F2EA; color: #1E1E1E; padding: 40px 20px;">
        <div style="max-width: 520px; margin: 0 auto;">
          <div style="background: #1E1E1E; padding: 24px; text-align: center; border: 2px solid #1E1E1E;">
            <h1 style="color: #F5F2EA; font-size: 24px; margin: 0; letter-spacing: 0.15em;">🚆 RAILY</h1>
            <p style="color: #F5F2EA; font-size: 11px; margin: 8px 0 0; opacity: 0.7;">Simulated Booking Confirmation</p>
          </div>

          <div style="border: 2px solid #1E1E1E; padding: 24px; margin-top: 16px; background: #F5F2EA;">
            <p style="font-size: 10px; margin: 0 0 8px; letter-spacing: 0.15em; text-transform: uppercase; color: #787878;">PNR Number</p>
            <p style="font-size: 28px; font-weight: bold; letter-spacing: 0.05em; margin: 4px 0;">${TEST_DATA.pnr}</p>
          </div>

          <div style="border: 2px solid #1E1E1E; padding: 24px; margin-top: 16px; background: #F5F2EA;">
            <p style="font-size: 10px; margin: 0 0 8px; letter-spacing: 0.15em; text-transform: uppercase; color: #787878;">From the PDF generation test</p>
            <p style="font-size: 14px; font-weight: bold; margin: 4px 0;">${TEST_DATA.trainName} (${TEST_DATA.trainNumber})</p>
            <p style="font-size: 12px; color: #787878;">${TEST_DATA.fromCode} → ${TEST_DATA.toCode} · ${TEST_DATA.date}</p>
            <p style="font-size: 12px; color: #787878;">Coach ${TEST_DATA.coach} · Seat ${TEST_DATA.seat} (${TEST_DATA.tier}) · ₹${TEST_DATA.fare}</p>
          </div>

          <div style="border: 2px solid #1E1E1E; padding: 24px; margin-top: 16px; text-align: center; background: #F5F2EA;">
            <p style="font-size: 10px; color: #787878; letter-spacing: 0.1em;">✦ This is a simulated test ticket ✦</p>
            <p style="font-size: 10px; color: #787878;">Not valid for real travel on Indian Railways</p>
            <p style="font-size: 11px; color: #787878; margin-top: 16px;">PDF attached below ⬇</p>
          </div>
        </div>
      </body>
      </html>
    `,
    attachments: [
      {
        filename: `ticket-${TEST_DATA.pnr}.pdf`,
        content: pdfBuffer,
      },
    ],
  });

  if (error) {
    console.error(`  ✗ Resend error: ${error.message || JSON.stringify(error)}`);
    process.exit(1);
  }

  console.log(`  ✓ Email sent! Resend email ID: ${data?.id}`);
  console.log(`  ✓ Delivered to: buildwithutkarsh@gmail.com`);

  // 5. Summary
  console.log("\n═══════════════════════════════════════════════");
  console.log("  DONE ✓");
  console.log(`  PDF:   ${localPath} (${sizeKB} KB)`);
  console.log(`  Email: buildwithutkarsh@gmail.com`);
  console.log(`  Resend ID: ${data?.id}`);
  console.log("═══════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
