/**
 * Shared document-generation contract for QualiSphere modules.
 *
 * This is an integration boundary, not an enabled conversion endpoint.
 * Never send controlled-document bytes to an unconfigured or untrusted service.
 * Existing browser printing and manual PDF upload remain operational.
 */
export type QualiSphereReportModule =
  | "ncmr" | "capa" | "scar" | "audit" | "change_control"
  | "equipment" | "controlled_documents" | "training"
  | "management_review" | "complaints" | "governance";

export type DocumentGenerationFormat = "pdf";
export type DocumentGenerationSource =
  | { kind: "approved_working_master"; documentId: string; revision: string }
  | { kind: "rendered_report"; recordId: string; templateVersion: string };

export interface DocumentGenerationRequest {
  tenantId: string;
  module: QualiSphereReportModule;
  source: DocumentGenerationSource;
  outputFormat: DocumentGenerationFormat;
  idempotencyKey: string;
}

export type DocumentGenerationResult =
  | { status: "completed"; storagePath: string; sha256: string; generatedAt: string }
  | { status: "unavailable" | "failed"; code: string; retryable: boolean };

/**
 * Intended server-side integration only:
 * - derive tenant/user from verified session, never trust caller-supplied tenantId
 * - enforce module permissions and approved source version before conversion
 * - fetch source from tenant-scoped storage using short-lived authorization
 * - call a private Gotenberg worker, with size/time/concurrency limits
 * - verify PDF, persist immutable output + hash, and write audit event
 * - no document bytes in logs; remove transient conversion artifacts
 * - keep manual PDF upload as a fully governed fallback
 *
 * No client-side code should call the conversion worker directly.
 */
export const DOCUMENT_GENERATION_ENABLED = false as const;
