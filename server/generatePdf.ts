import PDFDocument from "pdfkit";

interface HouseholdMember {
  name?: string;
  dateOfBirth?: string;
  dob?: string;
  medicaidId?: string;
  relationship?: string;
}

interface SubmissionData {
  referenceNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  cellPhone: string;
  medicaidId: string;
  supermarket: string;
  referralSource?: string | null;
  hipaaConsentAt: Date;
  createdAt: Date;
  formData: Record<string, unknown>;
}

/**
 * Generates a Household Attestation + HIPAA Consent PDF as a Buffer.
 * Uses only data already stored in the submissions table — no new DB columns needed.
 */
export async function generateAttestationPdf(sub: SubmissionData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "LETTER" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const fd = sub.formData as Record<string, unknown>;
    const householdMembers: HouseholdMember[] = (fd.householdMembers as HouseholdMember[]) || [];
    const guardianName = (fd.guardianName as string) || `${sub.firstName} ${sub.lastName}`;
    const signatureDataUrl = (fd.signatureDataUrl as string) || null;

    const GREEN = "#2d6a4f";
    const DARK = "#1a1a1a";
    const GRAY = "#555555";
    const LIGHT_GRAY = "#f5f5f5";
    const pageWidth = doc.page.width - 100; // accounting for margins

    // ─── Header ─────────────────────────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 80).fill(GREEN);
    doc.fillColor("white").fontSize(22).font("Helvetica-Bold")
      .text("FreshSelect Meals", 50, 20, { align: "left" });
    doc.fontSize(11).font("Helvetica")
      .text("Household Attestation & HIPAA Consent Record", 50, 48, { align: "left" });
    doc.fillColor(DARK);

    doc.moveDown(3.5);

    // ─── Reference & Date ────────────────────────────────────────────────────
    doc.fontSize(9).fillColor(GRAY).font("Helvetica")
      .text(`Reference #: ${sub.referenceNumber}   |   Generated: ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`, { align: "right" });

    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(50 + pageWidth, doc.y).stroke(GREEN);
    doc.moveDown(0.8);

    // ─── Section: Primary Member ─────────────────────────────────────────────
    sectionHeader(doc, "Primary Member Information", GREEN);

    const dob = fd.dateOfBirth as string | undefined;
    const address = [fd.streetAddress, fd.aptUnit, fd.city || "Brooklyn", fd.state || "NY", fd.zipcode].filter(Boolean).join(", ");

    twoColRow(doc, "Full Name", `${sub.firstName} ${sub.lastName}`, "Medicaid ID (CIN)", sub.medicaidId, DARK, GRAY, LIGHT_GRAY);
    twoColRow(doc, "Date of Birth", dob || "—", "Cell Phone", sub.cellPhone, DARK, GRAY, LIGHT_GRAY);
    twoColRow(doc, "Email", sub.email, "Vendor Selected", sub.supermarket, DARK, GRAY, LIGHT_GRAY);
    singleRow(doc, "Address", address, DARK, GRAY, LIGHT_GRAY);
    if (sub.referralSource) {
      singleRow(doc, "Referred By", sub.referralSource, DARK, GRAY, LIGHT_GRAY);
    }

    doc.moveDown(1);

    // ─── Section: Household Members ──────────────────────────────────────────
    sectionHeader(doc, "Household Members Attestation", GREEN);

    if (householdMembers.length === 0) {
      doc.fontSize(10).fillColor(GRAY).font("Helvetica-Oblique")
        .text("No additional household members listed.", { indent: 10 });
    } else {
      householdMembers.forEach((m, i) => {
        const name = m.name || `Member ${i + 1}`;
        const dob = m.dateOfBirth || m.dob || "—";
        const cin = m.medicaidId || "—";
        const rel = m.relationship || "—";
        twoColRow(doc, `Member ${i + 1}: ${name}`, `DOB: ${dob}`, "Medicaid ID", cin, DARK, GRAY, LIGHT_GRAY);
        if (rel !== "—") {
          doc.fontSize(9).fillColor(GRAY).font("Helvetica")
            .text(`   Relationship: ${rel}`, { indent: 10 });
        }
      });
    }

    doc.moveDown(1);

    // ─── Section: HIPAA Consent ───────────────────────────────────────────────
    sectionHeader(doc, "HIPAA Consent & Authorization", GREEN);

    const hipaaText =
      "I, the undersigned, hereby authorize FreshSelect Meals and its affiliated partners to use and disclose my " +
      "protected health information (PHI) as necessary to provide nutrition and food assistance services under the " +
      "Social Care Network (SCN) program. I understand that this information may be shared with Medicaid-managed " +
      "care organizations, community health workers, and authorized vendors solely for the purpose of coordinating " +
      "my care and food benefits. I have the right to revoke this authorization at any time by contacting " +
      "info@freshselectmeals.com. This consent was provided electronically at the time of application.";

    doc.fontSize(10).fillColor(DARK).font("Helvetica")
      .text(hipaaText, { indent: 10, lineGap: 3, width: pageWidth - 10 });

    doc.moveDown(0.8);

    // Consent timestamp box
    doc.rect(50, doc.y, pageWidth, 32).fill(LIGHT_GRAY);
    const consentY = doc.y + 8;
    doc.fillColor(DARK).fontSize(10).font("Helvetica-Bold")
      .text("✓  HIPAA Consent Granted", 62, consentY);
    doc.fillColor(GRAY).fontSize(9).font("Helvetica")
      .text(`Consented on: ${new Date(sub.hipaaConsentAt).toLocaleString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short" })}`, 62, consentY + 14);
    doc.moveDown(2.5);

    doc.moveDown(0.5);

    // ─── Section: Household Attestation Statement ────────────────────────────
    sectionHeader(doc, "Household Attestation Statement", GREEN);

    const attestText =
      "I attest that the information provided in this application is true and accurate to the best of my knowledge. " +
      "I understand that providing false information may result in disqualification from the program. " +
      "I confirm that all household members listed above are members of my household and that I am authorized " +
      "to submit this application on their behalf. I agree to notify FreshSelect Meals of any changes to my " +
      "household composition or eligibility status.";

    doc.fontSize(10).fillColor(DARK).font("Helvetica")
      .text(attestText, { indent: 10, lineGap: 3, width: pageWidth - 10 });

    doc.moveDown(1.2);

    // ─── Signature Block ─────────────────────────────────────────────────────
    sectionHeader(doc, "Electronic Signature", GREEN);

    doc.fontSize(10).fillColor(DARK).font("Helvetica")
      .text(`Signed by: `, { continued: true })
      .font("Helvetica-Bold")
      .text(guardianName);

    doc.moveDown(0.5);
    doc.fontSize(10).fillColor(DARK).font("Helvetica")
      .text(`Application submitted: ${new Date(sub.createdAt).toLocaleString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short" })}`);

    // Embed signature image if available
    if (signatureDataUrl && signatureDataUrl.startsWith("data:image/")) {
      try {
        const base64Data = signatureDataUrl.split(",")[1];
        const imgBuffer = Buffer.from(base64Data, "base64");
        doc.moveDown(0.5);
        doc.fontSize(9).fillColor(GRAY).font("Helvetica").text("Signature:");
        doc.image(imgBuffer, { width: 200, height: 60 });
      } catch {
        // If signature image fails, show text fallback
        doc.moveDown(0.3);
        doc.fontSize(9).fillColor(GRAY).font("Helvetica-Oblique")
          .text(`[Electronic signature on file — signed as: ${guardianName}]`);
      }
    } else {
      doc.moveDown(0.3);
      doc.fontSize(9).fillColor(GRAY).font("Helvetica-Oblique")
        .text(`[Electronic signature on file — signed as: ${guardianName}]`);
    }

    doc.moveDown(1.5);

    // ─── Footer ──────────────────────────────────────────────────────────────
    doc.moveTo(50, doc.y).lineTo(50 + pageWidth, doc.y).stroke(GREEN);
    doc.moveDown(0.5);
    doc.fontSize(8).fillColor(GRAY).font("Helvetica")
      .text(
        "FreshSelect Meals  |  info@freshselectmeals.com  |  718-307-4664  |  This document is confidential and intended for authorized use only.",
        { align: "center" }
      );

    doc.end();
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sectionHeader(doc: PDFKit.PDFDocument, title: string, color: string) {
  doc.fontSize(11).fillColor(color).font("Helvetica-Bold").text(title.toUpperCase());
  doc.moveDown(0.2);
  doc.moveTo(50, doc.y).lineTo(50 + doc.page.width - 100, doc.y).stroke(color);
  doc.moveDown(0.5);
}

function twoColRow(
  doc: PDFKit.PDFDocument,
  label1: string, val1: string,
  label2: string, val2: string,
  dark: string, gray: string, lightGray: string
) {
  const y = doc.y;
  const colW = (doc.page.width - 100) / 2 - 10;
  doc.rect(50, y, doc.page.width - 100, 26).fill(lightGray);
  doc.fillColor(gray).fontSize(8).font("Helvetica").text(label1, 58, y + 3, { width: colW });
  doc.fillColor(dark).fontSize(10).font("Helvetica").text(val1 || "—", 58, y + 13, { width: colW });
  doc.fillColor(gray).fontSize(8).font("Helvetica").text(label2, 58 + colW + 10, y + 3, { width: colW });
  doc.fillColor(dark).fontSize(10).font("Helvetica").text(val2 || "—", 58 + colW + 10, y + 13, { width: colW });
  doc.moveDown(1.4);
}

function singleRow(
  doc: PDFKit.PDFDocument,
  label: string, val: string,
  dark: string, gray: string, lightGray: string
) {
  const y = doc.y;
  const rowW = doc.page.width - 100;
  doc.rect(50, y, rowW, 26).fill(lightGray);
  doc.fillColor(gray).fontSize(8).font("Helvetica").text(label, 58, y + 3, { width: rowW - 16 });
  doc.fillColor(dark).fontSize(10).font("Helvetica").text(val || "—", 58, y + 13, { width: rowW - 16 });
  doc.moveDown(1.4);
}
