/* ══════════════════════════════════════════════════════════════
   PDF Generation Test — Standalone Script
   
   Runs generateTicketPDF with realistic sample data and
   writes the output to test-output/ticket.pdf.
   Verifies the PDF is valid by checking its header and size.
   ══════════════════════════════════════════════════════════════ */

import { generateTicketPDF } from "./lib/ticket/pdf";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

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

async function main() {
  console.log("═══════════════════════════════════════════════");
  console.log("  PDF Generation Test");
  console.log("═══════════════════════════════════════════════\n");

  // 1. Generate the PDF
  console.log("  1. Generating PDF from ticket data...");
  console.log(`     Train : ${TEST_DATA.trainName} (${TEST_DATA.trainNumber})`);
  console.log(`     Route : ${TEST_DATA.fromCode} → ${TEST_DATA.toCode}`);
  console.log(`     PNR   : ${TEST_DATA.pnr}`);
  console.log(`     Seat  : ${TEST_DATA.coach}-${TEST_DATA.seat} (${TEST_DATA.tier})`);
  console.log(`     Fare  : ₹${TEST_DATA.fare}\n`);

  const startTime = Date.now();
  let pdfBuffer: Buffer;

  try {
    pdfBuffer = await generateTicketPDF(TEST_DATA);
  } catch (err) {
    console.error("  ✗ FAILED: generateTicketPDF threw an error:");
    console.error(`    ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  const duration = Date.now() - startTime;
  console.log(`  ✓ PDF generated in ${duration}ms`);

  // 2. Verify output is a valid Buffer
  if (!Buffer.isBuffer(pdfBuffer)) {
    console.error("  ✗ FAILED: Output is not a Buffer");
    process.exit(1);
  }
  console.log(`  ✓ Output is a valid Buffer`);

  // 3. Check PDF size
  const sizeKB = (pdfBuffer.length / 1024).toFixed(1);
  console.log(`  ✓ PDF size: ${sizeKB} KB (${pdfBuffer.length} bytes)`);

  if (pdfBuffer.length < 100) {
    console.error(`  ✗ FAILED: PDF too small (${pdfBuffer.length} bytes) — likely corrupt`);
    process.exit(1);
  }
  console.log(`  ✓ PDF size exceeds minimum threshold (100 bytes)`);

  // 4. Verify PDF header
  const header = pdfBuffer.slice(0, 5).toString("ascii");
  if (header !== "%PDF-") {
    console.error(`  ✗ FAILED: Invalid PDF header — got "${header}", expected "%PDF-"`);
    process.exit(1);
  }
  console.log(`  ✓ Valid PDF header: "${header}"`);

  // 5. Verify EOF marker
  const footer = pdfBuffer.slice(-30).toString("ascii");
  if (!footer.includes("%%EOF")) {
    console.error(`  ✗ FAILED: Missing %%EOF marker`);
    console.error(`    Footer: ${footer}`);
    process.exit(1);
  }
  console.log(`  ✓ PDF EOF marker present`);

  // 6. Verify PDF structural integrity.
  //    pdfkit encodes text in PDF content streams (PDFDocEncoding / UTF-16BE),
  //    so direct ASCII search is unreliable for most strings. Instead, we verify
  //    structural elements that confirm a valid, complete PDF was generated.
  const rawContent = pdfBuffer.toString("binary");

  // Check for PDF content stream markers
  const hasStream = rawContent.includes("stream") && rawContent.includes("endstream");
  const hasXref = rawContent.includes("xref");
  const hasTrailer = rawContent.includes("trailer");
  const hasPages = rawContent.includes("/Type /Pages") || rawContent.includes("/Type /Page");

  const pdfStructureChecks = [
    { name: "PDF content streams (stream/endstream)", pass: hasStream },
    { name: "Cross-reference table (xref)", pass: hasXref },
    { name: "Trailer dictionary", pass: hasTrailer },
    { name: "Page type definitions", pass: hasPages },
  ];

  let structureOk = true;
  for (const check of pdfStructureChecks) {
    if (check.pass) {
      console.log(`  ✓ ${check.name}`);
    } else {
      console.error(`  ✗ ${check.name} — PDF structure may be incomplete`);
      structureOk = false;
    }
  }

  // Reliable binary-visible content: short numeric/uppercase strings that pdfkit
  // often stores as literal PDF strings (parenthesized). Only check strings that
  // are known to appear as-is in pdfkit output.
  const reliableChecks = [
    { name: "PNR number (8123456789)", pass: rawContent.includes(TEST_DATA.pnr) },
    { name: "RAILY brand", pass: rawContent.includes("RAILY") },
  ];

  for (const check of reliableChecks) {
    if (check.pass) {
      console.log(`  ✓ ${check.name}`);
    } else {
      console.error(`  ✗ ${check.name} — critical content missing`);
      structureOk = false;
    }
  }

  if (!structureOk) {
    console.error("\n  ✗ PDF structural validation failed");
    process.exit(1);
  }

  // 7. Write to file for visual inspection
  const outputDir = join(process.cwd(), "test-output");
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = join(outputDir, `ticket-${TEST_DATA.pnr}.pdf`);
  writeFileSync(outputPath, pdfBuffer);
  console.log(`\n  ✓ PDF written to: ${outputPath}`);

  // 8. Summary
  console.log("\n═══════════════════════════════════════════════");
  console.log("  ALL CHECKS PASSED ✓");
  console.log(`  File: ${outputPath}`);
  console.log(`  Size: ${sizeKB} KB`);
  console.log(`  Time: ${duration}ms`);
  console.log("═══════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
