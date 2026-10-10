# QualiSphere shared document generation — staged rollout

This design is intentionally **not** a deployed converter. It establishes a single contract for future printing/PDF conversion across NCMR, CAPA, SCAR, Audit, Change Control, Equipment, Controlled Documents, Training, Management Review, Complaints and Governance.

## Today
- Existing report print actions remain unchanged.
- DCI manual final-PDF upload remains unchanged and available as fallback.
- No Gotenberg endpoint, credentials, billing, network exposure or automated conversion is enabled.
- PDF preparation is **not** PDF verification. DCI release must remain blocked until coordinator verification, training, formal approvals and post-approval gates pass.

## When the self-hosted worker is ready
1. Deploy private Gotenberg + a server-side authenticated conversion adapter. Never expose unauthenticated Gotenberg to the public internet.
2. Authenticate caller, resolve active tenant server-side, authorize module/document and validate immutable approved working master.
3. Queue/constrain conversions; use short-lived access and delete temporary files.
4. Verify output MIME/header, checksum, size and origin; write tenant-scoped immutable artifact and audit event.
5. Route every module through one service interface. Render structured reports as HTML/PDF; convert DOCX working masters through LibreOffice.
6. Require coordinator review and persistent verification tied to the exact PDF hash for controlled-document release.
7. Preserve browser printing/manual upload when worker is unavailable; do not bypass release controls.
8. Validate conversion fidelity, tenant isolation, error handling and load before production use.

## Production gates
TLS, secret management, least privilege, network isolation, malware/file validation, rate limits, timeouts, observability without document contents, retry/idempotency, incident recovery, software validation, and appropriate availability/capacity testing. A single worker is a single point of failure for automatic conversion.
