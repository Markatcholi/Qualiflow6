import { supabase } from "./supabaseClient";

export const CONTROLLED_DOCUMENT_BUCKET = "controlled-documents";

function sanitizePathSegment(value: string | null | undefined, fallback = "document") {
  return String(value || fallback)
    .trim()
    .replace(/[^a-zA-Z0-9-_]/g, "_")
    .replace(/_+/g, "_") || fallback;
}

export async function getControlledDocumentTenantId() {
  const { data, error } = await supabase.rpc("qualisphere_current_controlled_documents_tenant");
  if (error) throw new Error(error.message);
  const tenantId = String(data || "").trim();
  if (!tenantId) throw new Error("Unable to resolve the active Controlled Documents Company Account.");
  return tenantId;
}

export async function buildControlledDocumentStoragePath({
  documentNumber,
  revision,
  area,
  fileName,
}: {
  documentNumber: string;
  revision: string;
  area?: string;
  fileName: string;
}) {
  const tenantId = await getControlledDocumentTenantId();
  const safeDocNumber = sanitizePathSegment(documentNumber);
  const safeRevision = sanitizePathSegment(revision, "rev");
  const safeArea = area ? `${sanitizePathSegment(area, "files")}/` : "";
  return `tenant/${tenantId}/${safeDocNumber}/${safeRevision}/${safeArea}${fileName}`;
}

export async function createControlledDocumentSignedUrl(filePath: string | null | undefined, expiresIn = 3600) {
  if (!filePath) return null;
  const { data, error } = await supabase.storage
    .from(CONTROLLED_DOCUMENT_BUCKET)
    .createSignedUrl(filePath, expiresIn);
  if (error) throw new Error(error.message);
  return data?.signedUrl || null;
}

export async function resolveControlledDocumentFileUrl({
  filePath,
  legacyUrl,
}: {
  filePath?: string | null;
  legacyUrl?: string | null;
}) {
  if (filePath?.startsWith("tenant/")) {
    return await createControlledDocumentSignedUrl(filePath);
  }
  return legacyUrl || null;
}
