import { degrees, PDFDocument, rgb, StandardFonts } from "pdf-lib";
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
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return value;
  }
}

function getFileExtension(fileNameOrUrl: string | null | undefined) {
  const value = String(fileNameOrUrl || "").toLowerCase().split("?")[0];
  const parts = value.split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

async function fetchPdfBytes(url: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Unable to download the final release PDF for controlled-copy stamping.");
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType && !contentType.toLowerCase().includes("pdf")) {
    // Some Supabase public URLs may return octet-stream. Do not block solely on content type.
    console.warn("Release PDF content-type was not application/pdf:", contentType);
  }

  return await response.arrayBuffer();
}

function drawHeaderFooterAndWatermark({
  pdfDoc,
  doc,
}: {
  pdfDoc: PDFDocument;
  doc: ControlledDocument;
}) {
  const pages = pdfDoc.getPages();
  const totalPages = pages.length;
  const effectiveDate = formatDate(doc.effective_date);

  const helvetica = pdfDoc.embedStandardFont(StandardFonts.Helvetica);
  const helveticaBold = pdfDoc.embedStandardFont(StandardFonts.HelveticaBold);

  pages.forEach((page, index) => {
    const { width, height } = page.getSize();
    const pageNumber = index + 1;

    // Header white band to keep release metadata readable.
    page.drawRectangle({
      x: 0,
      y: height - 48,
      width,
      height: 48,
      color: rgb(1, 1, 1),
      opacity: 0.92,
    });

    page.drawLine({
      start: { x: 36, y: height - 48 },
      end: { x: width - 36, y: height - 48 },
      thickness: 0.8,
      color: rgb(0.82, 0.84, 0.87),
    });

    page.drawText("QUALIFLOW ENTERPRISE - CONTROLLED COPY", {
      x: 36,
      y: height - 18,
      size: 9,
      font: helveticaBold,
      color: rgb(0.07, 0.09, 0.15),
    });

    const title = doc.title || "Controlled Document";
    const titleMaxChars = 90;
    const displayTitle = title.length > titleMaxChars ? `${title.slice(0, titleMaxChars)}...` : title;

    page.drawText(displayTitle, {
      x: 36,
      y: height - 32,
      size: 8.5,
      font: helveticaBold,
      color: rgb(0.07, 0.09, 0.15),
    });

    page.drawText(`Document Number: ${doc.document_number}`, {
      x: 36,
      y: height - 43,
      size: 7.5,
      font: helvetica,
      color: rgb(0.07, 0.09, 0.15),
    });

    page.drawText(`Revision: ${doc.revision}`, {
      x: width / 2 - 40,
      y: height - 43,
      size: 7.5,
      font: helvetica,
      color: rgb(0.07, 0.09, 0.15),
    });

    page.drawText(`Effective Date: ${effectiveDate}`, {
      x: width - 155,
      y: height - 43,
      size: 7.5,
      font: helvetica,
      color: rgb(0.07, 0.09, 0.15),
    });

    // Watermark.
    page.drawText("CONTROLLED COPY", {
      x: width * 0.16,
      y: height * 0.42,
      size: 54,
      font: helveticaBold,
      color: rgb(0.75, 0.75, 0.75),
      rotate: degrees(35),
      opacity: 0.18,
    });

    // Footer white band.
    page.drawRectangle({
      x: 0,
      y: 0,
      width,
      height: 34,
      color: rgb(1, 1, 1),
      opacity: 0.92,
    });

    page.drawLine({
      start: { x: 36, y: 34 },
      end: { x: width - 36, y: 34 },
      thickness: 0.8,
      color: rgb(0.82, 0.84, 0.87),
    });

    page.drawText(`${doc.document_number} | Rev ${doc.revision} | Effective Date: ${effectiveDate}`, {
      x: 36,
      y: 16,
      size: 7.5,
      font: helvetica,
      color: rgb(0.07, 0.09, 0.15),
    });

    page.drawText(`Page ${pageNumber} of ${totalPages}`, {
      x: width - 92,
      y: 16,
      size: 7.5,
      font: helvetica,
      color: rgb(0.07, 0.09, 0.15),
    });
  });
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
    throw new Error("A final release PDF must be uploaded before controlled copy generation.");
  }

  const releasePdfExtension = getFileExtension(doc.release_pdf_file_name || doc.release_pdf_file_url);
  if (releasePdfExtension !== "pdf") {
    throw new Error("Final release file must be a PDF before controlled copy generation.");
  }

  const releasePdfBytes = await fetchPdfBytes(doc.release_pdf_file_url);
  const pdfDoc = await PDFDocument.load(releasePdfBytes, {
    ignoreEncryption: true,
  });

  drawHeaderFooterAndWatermark({ pdfDoc, doc });

  const stampedPdfBytes = await pdfDoc.save();

  const safeDocNumber = sanitizePathSegment(doc.document_number);
  const safeRevision = sanitizePathSegment(doc.revision);
  const fileName = `${safeDocNumber}_Rev_${safeRevision}_Controlled_Copy.pdf`;
  const filePath = `controlled-copies/${safeDocNumber}/Rev-${safeRevision}/${fileName}`;

  const pdfBlob = new Blob([stampedPdfBytes], {
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

  const generatedAt = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("controlled_documents")
    .update({
      controlled_copy_file_name: fileName,
      controlled_copy_file_path: filePath,
      controlled_copy_file_url: controlledCopyUrl,
      controlled_copy_generated_at: generatedAt,
      controlled_copy_generated_by: generatedBy || "system",
    })
    .eq("id", documentId);

  if (updateError) throw new Error(updateError.message);

  return {
    fileName,
    filePath,
    fileUrl: controlledCopyUrl,
    generatedAt,
    generatedBy: generatedBy || "system",
    sourceReleasePdf: doc.release_pdf_file_name || null,
    pagesStamped: pdfDoc.getPageCount(),
  };
}
