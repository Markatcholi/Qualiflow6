import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { supabase } from "../lib/supabaseClient";

type ControlledDocument = {
  id: string;
  document_number: string;
  title: string;
  revision: string;
  status: string;
  effective_date: string | null;
  file_name: string | null;
  file_url: string | null;
  release_pdf_file_name?: string | null;
  release_pdf_file_path?: string | null;
  release_pdf_file_url?: string | null;
  controlled_copy_file_name?: string | null;
  controlled_copy_file_path?: string | null;
  controlled_copy_file_url?: string | null;
};

function sanitizePathSegment(value: string | null | undefined) {
  return String(value || "document")
    .trim()
    .replace(/[^a-zA-Z0-9-_]/g, "_")
    .replace(/_+/g, "_");
}

function formatDate(value: string | null | undefined) {
  if (!value) return "N/A";

  const raw = String(value).trim();
  const dateOnlyMatch = raw.match(/^\d{4}-\d{2}-\d{2}/);

  if (dateOnlyMatch) {
    return dateOnlyMatch[0];
  }

  return raw;
}

function isPdfFile(fileName?: string | null, fileUrl?: string | null) {
  const text = `${fileName || ""} ${fileUrl || ""}`.toLowerCase();
  return text.includes(".pdf") || text.includes("application/pdf");
}

async function fetchPdfBytes(url: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Unable to fetch release PDF. HTTP status: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType && !contentType.toLowerCase().includes("pdf")) {
    // Some Supabase public URLs may return octet-stream, so do not block solely on content-type.
    console.warn(`Release PDF content type is ${contentType}. Continuing based on file extension.`);
  }

  return await response.arrayBuffer();
}

function drawCenteredText({
  page,
  text,
  y,
  size,
  font,
  color = rgb(0.1, 0.1, 0.1),
}: {
  page: any;
  text: string;
  y: number;
  size: number;
  font: any;
  color?: any;
}) {
  const { width } = page.getSize();
  const textWidth = font.widthOfTextAtSize(text, size);
  page.drawText(text, {
    x: Math.max(24, (width - textWidth) / 2),
    y,
    size,
    font,
    color,
  });
}

function truncateForWidth({
  text,
  font,
  size,
  maxWidth,
}: {
  text: string;
  font: any;
  size: number;
  maxWidth: number;
}) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (font.widthOfTextAtSize(clean, size) <= maxWidth) return clean;

  let result = clean;
  while (result.length > 3 && font.widthOfTextAtSize(`${result}...`, size) > maxWidth) {
    result = result.slice(0, -1);
  }

  return `${result}...`;
}

async function stampPdf({
  sourcePdfBytes,
  doc,
}: {
  sourcePdfBytes: ArrayBuffer;
  doc: ControlledDocument;
}) {
  const pdfDoc = await PDFDocument.load(sourcePdfBytes, {
    ignoreEncryption: true,
  });

  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pages = pdfDoc.getPages();
  const totalPages = pages.length;
  const effectiveDate = formatDate(doc.effective_date);

  pages.forEach((page, index) => {
    const { width, height } = page.getSize();
    const pageNumber = index + 1;

    // Header background band for readability.
    page.drawRectangle({
      x: 0,
      y: height - 42,
      width,
      height: 42,
      color: rgb(1, 1, 1),
      opacity: 0.92,
    });

    // Header separator.
    page.drawLine({
      start: { x: 24, y: height - 42 },
      end: { x: width - 24, y: height - 42 },
      thickness: 0.7,
      color: rgb(0.78, 0.81, 0.86),
    });

    page.drawText("QUALIFLOW ENTERPRISE - RELEASED DOCUMENT", {
      x: 24,
      y: height - 16,
      size: 8.5,
      font: boldFont,
      color: rgb(0.05, 0.08, 0.14),
    });

    const releaseStatusText = "Status: RELEASE";
    const releaseStatusWidth = boldFont.widthOfTextAtSize(releaseStatusText, 8.5);
    page.drawText(releaseStatusText, {
      x: width - 24 - releaseStatusWidth,
      y: height - 16,
      size: 8.5,
      font: boldFont,
      color: rgb(0.05, 0.08, 0.14),
    });

    const title = truncateForWidth({
      text: doc.title || "Controlled Document",
      font: boldFont,
      size: 8,
      maxWidth: width - 48,
    });

    drawCenteredText({
      page,
      text: title,
      y: height - 28,
      size: 8,
      font: boldFont,
      color: rgb(0.05, 0.08, 0.14),
    });

    page.drawText(`Document Number: ${doc.document_number}`, {
      x: 24,
      y: height - 38,
      size: 7.5,
      font: regularFont,
      color: rgb(0.05, 0.08, 0.14),
    });

    drawCenteredText({
      page,
      text: `Revision: ${doc.revision}`,
      y: height - 38,
      size: 7.5,
      font: regularFont,
      color: rgb(0.05, 0.08, 0.14),
    });

    const effectiveText = `Effective Date: ${effectiveDate}`;
    const effectiveWidth = regularFont.widthOfTextAtSize(effectiveText, 7.5);
    page.drawText(effectiveText, {
      x: width - 24 - effectiveWidth,
      y: height - 38,
      size: 7.5,
      font: regularFont,
      color: rgb(0.05, 0.08, 0.14),
    });


    // Footer background band.
    page.drawRectangle({
      x: 0,
      y: 0,
      width,
      height: 30,
      color: rgb(1, 1, 1),
      opacity: 0.92,
    });

    page.drawLine({
      start: { x: 24, y: 30 },
      end: { x: width - 24, y: 30 },
      thickness: 0.7,
      color: rgb(0.78, 0.81, 0.86),
    });

    const footerLeft = `${doc.document_number} | Rev ${doc.revision} | Effective Date: ${effectiveDate} | Status: RELEASE`;
    page.drawText(footerLeft, {
      x: 24,
      y: 12,
      size: 7.5,
      font: regularFont,
      color: rgb(0.05, 0.08, 0.14),
    });

    const footerRight = `Page ${pageNumber} of ${totalPages}`;
    const footerRightWidth = regularFont.widthOfTextAtSize(footerRight, 7.5);
    page.drawText(footerRight, {
      x: width - 24 - footerRightWidth,
      y: 12,
      size: 7.5,
      font: regularFont,
      color: rgb(0.05, 0.08, 0.14),
    });
  });

  return await pdfDoc.save();
}

export async function generateControlledCopy({
  documentId,
  generatedBy,
}: {
  documentId: string;
  generatedBy: string;
}) {
  if (!documentId) {
    throw new Error("Document ID is required to generate a controlled copy.");
  }

  const { data, error } = await supabase
    .from("controlled_documents")
    .select(
      "id, document_number, title, revision, status, effective_date, file_name, file_url, release_pdf_file_name, release_pdf_file_path, release_pdf_file_url, controlled_copy_file_name, controlled_copy_file_path, controlled_copy_file_url"
    )
    .eq("id", documentId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Controlled document not found.");

  const doc = data as ControlledDocument;

  if (doc.status !== "approved" && doc.status !== "release") {
    throw new Error("Controlled copy can only be generated during release.");
  }

  if (!doc.release_pdf_file_url) {
    throw new Error("A final release PDF is required before generating a controlled copy.");
  }

  if (!isPdfFile(doc.release_pdf_file_name, doc.release_pdf_file_url)) {
    throw new Error("The final release file must be a PDF before it can be stamped as a controlled copy.");
  }

  const sourcePdfBytes = await fetchPdfBytes(doc.release_pdf_file_url);
  const stampedPdfBytes = await stampPdf({ sourcePdfBytes, doc });

  const safeDocNumber = sanitizePathSegment(doc.document_number);
  const safeRevision = sanitizePathSegment(doc.revision);
  const fileName = `${safeDocNumber}_Rev_${safeRevision}_Controlled_Copy.pdf`;
  const filePath = `controlled-copies/${safeDocNumber}/Rev-${safeRevision}/${fileName}`;

  // Convert pdf-lib Uint8Array output into a BlobPart that satisfies TypeScript/Vercel builds.
  const pdfArrayBuffer = new ArrayBuffer(stampedPdfBytes.byteLength);
  const pdfArray = new Uint8Array(pdfArrayBuffer);
  pdfArray.set(stampedPdfBytes);

  const pdfBlob = new Blob([pdfArrayBuffer], {
    type: "application/pdf",
  });

  const { error: uploadError } = await supabase.storage
    .from("controlled-documents")
    .upload(filePath, pdfBlob, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadError) throw new Error(uploadError.message);

  const { data: publicUrlData } = supabase.storage
    .from("controlled-documents")
    .getPublicUrl(filePath);

  const controlledCopyUrl = publicUrlData?.publicUrl || null;

  const { error: updateError } = await supabase
    .from("controlled_documents")
    .update({
      controlled_copy_file_name: fileName,
      controlled_copy_file_path: filePath,
      controlled_copy_file_url: controlledCopyUrl,
      controlled_copy_generated_at: new Date().toISOString(),
      controlled_copy_generated_by: generatedBy || "system",
    })
    .eq("id", documentId);

  if (updateError) throw new Error(updateError.message);

  return {
    fileName,
    filePath,
    fileUrl: controlledCopyUrl,
  };
}
