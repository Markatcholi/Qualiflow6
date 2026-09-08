"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import ManagementReviewSnapshotReport from "../components/ManagementReviewSnapshotReport";

export default function PrintManagementReview() {
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [review, setReview] = useState<any>(null);
  const [reportMode, setReportMode] = useState<"electronic" | "wet">("electronic");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setErrorMessage("");

      try {
        const params = new URLSearchParams(window.location.search);
        const reviewId = params.get("review_id") || params.get("reviewId") || "";
        const requestedMode = params.get("mode") === "wet" ? "wet" : "electronic";

        if (!reviewId) {
          throw new Error("A Management Review record is required to generate this controlled report.");
        }

        const { data, error } = await supabase
          .from("management_reviews")
          .select("*, management_review_approvers(*)")
          .eq("id", reviewId)
          .maybeSingle();

        if (error) throw new Error(error.message);
        if (!data) throw new Error("Management Review record was not found.");
        if (!data.report_snapshot_json) {
          throw new Error("This Management Review does not contain a generated report snapshot.");
        }

        if (requestedMode === "wet") {
          const printSigning = resolvePrintSigning(data);
          const wetSigners = Array.isArray(printSigning?.signers) ? printSigning.signers : [];
          if (printSigning?.enabled !== true || wetSigners.length === 0) {
            throw new Error("This Management Review was not configured with Print & Sign signers.");
          }
        }

        setReportMode(requestedMode);
        setReview(data);
      } catch (error: any) {
        setErrorMessage(error?.message || "Unable to load Management Review report.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  if (loading) {
    return <main style={pageStyle}>Loading Management Review report...</main>;
  }

  if (errorMessage || !review) {
    return (
      <main style={pageStyle}>
        <section style={cardStyle}>
          <h1>Management Review Report</h1>
          <p style={{ color: "#991b1b" }}>{errorMessage || "Unable to load report."}</p>
        </section>
      </main>
    );
  }

  const snapshot = review.report_snapshot_json || {};
  const config = snapshot.report_config || review.report_config_json || {};
  const approvers = Array.isArray(review.management_review_approvers)
    ? review.management_review_approvers
    : [];
  const period = formatPeriod(review.review_period_start, review.review_period_end);
  const wetSignatureMode = reportMode === "wet";
  const resolvedPrintSigning = resolvePrintSigning(review);
  const reportSnapshot = wetSignatureMode
    ? { ...snapshot, print_signing: resolvedPrintSigning }
    : snapshot;

  return (
    <main style={pageStyle}>
      <style>{printCss}</style>

      <div className="no-print" style={{ marginBottom: 18 }}>
        <button type="button" onClick={() => window.print()} style={buttonStyle}>
          {wetSignatureMode ? "Print Wet-Signature Report / Save as PDF" : "Print / Save as PDF"}
        </button>
      </div>

      <header style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>QUALISPHERE ENTERPRISE QMS</div>
          <h1 style={{ margin: "4px 0 8px" }}>{review.review_title || "Management Review Report"}</h1>
          <div><strong>Review Number:</strong> {review.review_number || "N/A"}</div>
          <div><strong>Review Period:</strong> {period}</div>
          <div><strong>Review Date:</strong> {review.review_date || "N/A"}</div>
          <div><strong>Site:</strong> {review.site || "N/A"}</div>
          <div><strong>Business Unit:</strong> {review.business_unit || "N/A"}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div><strong>Prepared By:</strong> {review.prepared_by || "N/A"}</div>
          <div><strong>Snapshot Generated:</strong> {formatDateTime(snapshot.generated_at)}</div>
          {wetSignatureMode ? (
            <div><strong>Report Type:</strong> Wet Signature Copy</div>
          ) : (
            <>
              <div><strong>Approval Status:</strong> {review.approval_status || review.status || "draft"}</div>
              <div><strong>Locked:</strong> {review.is_locked ? "Yes" : "No"}</div>
              {review.locked_at ? <div><strong>Locked At:</strong> {formatDateTime(review.locked_at)}</div> : null}
            </>
          )}
        </div>
      </header>

      <section style={noticeStyle}>
        {wetSignatureMode ? (
          <>
            <strong>Wet-signature report:</strong> This copy is rendered from the saved Management Review report snapshot and is intended only for configured physical signatures. Wet signatures do not close or lock the Management Review record; electronic approval in QualiSphere remains required.
          </>
        ) : (
          <>
            <strong>Controlled report source:</strong> This report is rendered from the saved Management Review report snapshot. It does not recalculate live QMS data when opened or printed.
          </>
        )}
      </section>

      <ManagementReviewSnapshotReport
        snapshot={reportSnapshot}
        config={config}
        executiveSummary={review.executive_summary}
        showPrintSignatureBlocks={wetSignatureMode}
      />

      {!wetSignatureMode ? (
      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>Approval Record</h2>
        {approvers.length === 0 ? (
          <p>No approvers were configured for this Management Review.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Approver</th>
                  <th style={thStyle}>Role / Title</th>
                  <th style={thStyle}>Due Date</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Signed By</th>
                  <th style={thStyle}>Signed At</th>
                </tr>
              </thead>
              <tbody>
                {approvers.map((approver: any) => (
                  <tr key={approver.id}>
                    <td style={tdStyle}>{approver.approver_name || approver.approver_email || "N/A"}</td>
                    <td style={tdStyle}>{approver.approver_role || "N/A"}</td>
                    <td style={tdStyle}>{approver.approver_due_date || "N/A"}</td>
                    <td style={tdStyle}>{approver.approval_status || "configured"}</td>
                    <td style={tdStyle}>{approver.signed_by || "N/A"}</td>
                    <td style={tdStyle}>{formatDateTime(approver.signed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      ) : null}

      <footer style={footerStyle}>
        QualiSphere Enterprise QMS | Management Review | {period} | {review.review_number || "N/A"}{wetSignatureMode ? " | Wet Signature Copy" : ""}
      </footer>
    </main>
  );
}

function resolvePrintSigning(review: any) {
  const snapshotConfig = review?.report_snapshot_json?.print_signing;
  const savedConfig = review?.report_config_json?.print_signing;

  if (
    snapshotConfig?.enabled === true &&
    Array.isArray(snapshotConfig?.signers) &&
    snapshotConfig.signers.length > 0
  ) {
    return snapshotConfig;
  }

  if (
    savedConfig?.enabled === true &&
    Array.isArray(savedConfig?.signers) &&
    savedConfig.signers.length > 0
  ) {
    return savedConfig;
  }

  return snapshotConfig || savedConfig || {};
}

function formatPeriod(start?: string | null, end?: string | null) {
  if (!start && !end) return "Not entered";
  if (start && end) return `${start} through ${end}`;
  return start || end || "Not entered";
}

function formatDateTime(value?: string | null) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

const pageStyle: React.CSSProperties = {
  padding: 28,
  background: "#f8fafc",
  color: "#0f172a",
  minHeight: "100vh",
  fontFamily: "Arial, sans-serif",
};
const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 28,
  background: "#fff",
  border: "1px solid #dbe3ee",
  borderRadius: 14,
  padding: 24,
  marginBottom: 18,
};
const eyebrowStyle: React.CSSProperties = { color: "#475569", fontWeight: 700, letterSpacing: ".08em", fontSize: 12 };
const noticeStyle: React.CSSProperties = { background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 12, padding: 16, marginBottom: 18, lineHeight: 1.5 };
const cardStyle: React.CSSProperties = { background: "#fff", border: "1px solid #dbe3ee", borderRadius: 14, padding: 24, marginBottom: 20 };
const sectionTitleStyle: React.CSSProperties = { margin: "0 0 18px", borderBottom: "1px solid #dbe3ee", paddingBottom: 12 };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse" };
const thStyle: React.CSSProperties = { textAlign: "left", borderBottom: "1px solid #cbd5e1", padding: "10px 8px", background: "#f8fafc" };
const tdStyle: React.CSSProperties = { borderBottom: "1px solid #e2e8f0", padding: "10px 8px", verticalAlign: "top" };
const buttonStyle: React.CSSProperties = { padding: "10px 16px", borderRadius: 8, border: "1px solid #94a3b8", cursor: "pointer", fontWeight: 700 };
const footerStyle: React.CSSProperties = { marginTop: 24, paddingTop: 12, borderTop: "1px solid #cbd5e1", color: "#64748b", fontSize: 12 };

const printCss = `
@media print {
  .no-print { display: none !important; }
  body { background: white !important; }
  main { padding: 0 !important; background: white !important; }
  section { break-inside: avoid; }
}
`;
