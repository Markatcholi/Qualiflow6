"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";

export default function ManagementReviewApprovalReviewPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const id = useMemo(() => {
    const raw = params?.id;
    return Array.isArray(raw) ? raw[0] : String(raw || "");
  }, [params]);

  const taskId = searchParams.get("taskId") || "";

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [signatureEmail, setSignatureEmail] = useState("");
  const [comment, setComment] = useState("");
  const [task, setTask] = useState<any>(null);
  const [review, setReview] = useState<any>(null);
  const [approver, setApprover] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setErrorMessage("");

      try {
        if (!id || !taskId) {
          throw new Error("A Management Review record and approval task are required.");
        }

        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) throw new Error(userError.message);

        const email = String(userData?.user?.email || "").trim().toLowerCase();
        if (!email) throw new Error("You must be signed in to review this approval package.");

        setUserEmail(email);
        setSignatureEmail(email);

        const { data: taskData, error: taskError } = await supabase
          .from("approval_tasks")
          .select("*")
          .eq("id", taskId)
          .eq("entity_type", "management_review")
          .eq("entity_id", id)
          .eq("task_type", "management_review_approval")
          .maybeSingle();

        if (taskError) throw new Error(taskError.message);
        if (!taskData) throw new Error("Management Review approval task was not found.");

        if (String(taskData.assigned_to_email || "").trim().toLowerCase() !== email) {
          throw new Error("This Management Review approval task is assigned to another user.");
        }

        const { data: reviewData, error: reviewError } = await supabase
          .from("management_reviews")
          .select("*, management_review_approvers(*)")
          .eq("id", id)
          .maybeSingle();

        if (reviewError) throw new Error(reviewError.message);
        if (!reviewData) throw new Error("Management Review record was not found.");
        if (!reviewData.report_snapshot_json) {
          throw new Error("This Management Review does not contain a generated report snapshot.");
        }

        const matchedApprover = (reviewData.management_review_approvers || []).find(
          (item: any) =>
            String(item.approver_email || "").trim().toLowerCase() === email
        );

        if (!matchedApprover) {
          throw new Error("No configured Management Review approver record matches this account.");
        }

        setTask(taskData);
        setReview(reviewData);
        setApprover(matchedApprover);
      } catch (error: any) {
        setErrorMessage(error?.message || "Unable to load Management Review approval package.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id, taskId]);

  const submitDecision = async (decision: "approved" | "rejected") => {
    if (!task || !review || !approver) return;

    if (String(task.status || "").toLowerCase() !== "pending") {
      alert("This approval task is no longer pending.");
      return;
    }

    if (String(review.approval_status || "").toLowerCase() !== "pending_approval") {
      alert("This Management Review is no longer pending approval.");
      return;
    }

    if (signatureEmail.trim().toLowerCase() !== userEmail) {
      alert("Electronic signature email does not match the logged-in user.");
      return;
    }

    if (decision === "rejected" && !comment.trim()) {
      alert("A rejection comment is required.");
      return;
    }

    const decisionLabel = decision === "approved" ? "approve" : "reject";
    const confirmed = window.confirm(
      `Electronic Signature\n\nI ${decisionLabel} the submitted read-only Management Review report ${review.review_number || ""}.\n\nMy authenticated identity and timestamp will become part of the official quality record.`
    );

    if (!confirmed) return;

    setSubmitting(true);

    try {
      const { data, error } = await supabase.rpc(
        "qualisphere_decide_management_review_approval",
        {
          p_task_id: task.id,
          p_decision: decision,
          p_comment: comment.trim() || null,
          p_signature_email: signatureEmail.trim().toLowerCase(),
        }
      );

      if (error) throw new Error(error.message);

      if (decision === "approved" && data?.all_approved) {
        alert("Management Review approved. All required approvers have signed and the report is now locked.");
      } else if (decision === "approved") {
        alert("Management Review report approved. Remaining approvers are still pending.");
      } else {
        alert("Management Review report rejected and returned for revision.");
      }

      router.push("/workspace");
      router.refresh();
    } catch (error: any) {
      alert(error?.message || "Unable to complete the Management Review approval decision.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <main style={pageStyle}>Loading Management Review approval package...</main>;
  }

  if (errorMessage) {
    return (
      <main style={pageStyle}>
        <section style={cardStyle}>
          <h1>Management Review Approval Package</h1>
          <p style={{ color: "#991b1b" }}>{errorMessage}</p>
          <a href="/workspace">Return to My Workspace</a>
        </section>
      </main>
    );
  }

  const snapshot = review?.report_snapshot_json || {};
  const config = snapshot.report_config || review?.report_config_json || {};
  const isPending =
    String(task?.status || "").toLowerCase() === "pending" &&
    String(review?.approval_status || "").toLowerCase() === "pending_approval";

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>QUALISPHERE MANAGEMENT REVIEW</div>
          <h1 style={{ margin: "4px 0" }}>Read-Only Approval Package</h1>
          <p style={{ margin: 0, color: "#475569" }}>
            This page contains only the generated Management Review report snapshot submitted for your approval.
          </p>
        </div>
        <a href="/workspace" style={backLinkStyle}>Back to My Workspace</a>
      </header>

      <section style={statusCardStyle}>
        <strong>Submitted report is read-only.</strong> Neither the report data nor the underlying Management Review workflow can be edited from this approval package.
      </section>

      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>Report Identification</h2>
        <InfoGrid
          entries={[
            ["Review Number", review?.review_number],
            ["Title", review?.review_title],
            ["Review Period Start", review?.review_period_start],
            ["Review Period End", review?.review_period_end],
            ["Review Date", review?.review_date],
            ["Site", review?.site],
            ["Business Unit", review?.business_unit],
            ["Prepared By", review?.prepared_by],
            ["Report Snapshot Generated", snapshot?.generated_at],
            ["Approval Status", review?.approval_status],
          ]}
        />
      </section>

      {config.executiveSummary !== false ? (
        <ReportSection title="Executive Summary">
          <p style={paragraphStyle}>
            {review?.executive_summary || snapshot?.executive?.auto_generated_summary || "No executive summary recorded."}
          </p>
          <MetricTable data={snapshot?.executive} exclude={["auto_generated_summary"]} />
        </ReportSection>
      ) : null}

      {config.ncmrPerformance ? <ReportSection title="NCMR Performance"><MetricTable data={snapshot?.ncmr} /></ReportSection> : null}
      {config.capaPerformance ? <ReportSection title="CAPA Performance"><MetricTable data={snapshot?.capa} /></ReportSection> : null}
      {config.capaEffectiveness ? <ReportSection title="CAPA Effectiveness"><MetricTable data={pick(snapshot?.capa, ["effectiveness_rate", "effective", "partially_effective", "not_effective", "awaiting_effectiveness", "effectiveness_overdue", "followup_required"])} /></ReportSection> : null}
      {config.scarPerformance ? <ReportSection title="SCAR Performance"><MetricTable data={snapshot?.scar} /></ReportSection> : null}
      {config.supplierQuality ? <ReportSection title="Supplier Quality"><MetricTable data={snapshot?.supplier_quality} /></ReportSection> : null}
      {config.auditPerformance ? <ReportSection title="Audit Performance"><MetricTable data={snapshot?.audits} /></ReportSection> : null}
      {config.oosPerformance ? <ReportSection title="OOS / OOT Performance"><MetricTable data={snapshot?.oos_oot} /></ReportSection> : null}
      {config.complaintPerformance ? <ReportSection title="Complaint Performance"><MetricTable data={snapshot?.complaints} /></ReportSection> : null}
      {config.changeControlPerformance ? <ReportSection title="Change Control Performance"><MetricTable data={snapshot?.change_control} /></ReportSection> : null}
      {config.documentControlPerformance ? <ReportSection title="Document Control Performance"><MetricTable data={snapshot?.document_control} /></ReportSection> : null}
      {config.trainingPerformance ? <ReportSection title="Training Performance"><MetricTable data={snapshot?.training} /></ReportSection> : null}
      {config.escalationQueues ? <ReportSection title="Escalation Queues"><MetricTable data={snapshot?.queues} /></ReportSection> : null}
      {config.executiveNotifications ? <ReportSection title="Executive Notifications"><MetricTable data={{ notifications: snapshot?.notifications || [] }} /></ReportSection> : null}
      {config.managementActions ? <ReportSection title="Management Actions"><MetricTable data={{ management_actions: snapshot?.management_actions || [] }} /></ReportSection> : null}
      {config.trendCharts ? <ReportSection title="Trend Data Included in Report Snapshot"><MetricTable data={snapshot?.trends} /></ReportSection> : null}

      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>Your Approval Assignment</h2>
        <InfoGrid
          entries={[
            ["Approver", approver?.approver_name],
            ["Email", approver?.approver_email],
            ["Role / Title", approver?.approver_role],
            ["Due Date", approver?.approver_due_date || task?.due_date],
            ["Task Status", task?.status],
          ]}
        />
        <div style={meaningBoxStyle}>
          <strong>Signature Meaning</strong>
          <p style={{ marginBottom: 0 }}>{approver?.signature_meaning || task?.signature_meaning || "I approve this Management Review report."}</p>
        </div>
      </section>

      {isPending ? (
        <section style={decisionCardStyle}>
          <h2 style={sectionTitleStyle}>Approval Decision</h2>
          <label style={labelStyle}>
            Re-enter Your Email for Electronic Signature
            <input
              value={signatureEmail}
              onChange={(event) => setSignatureEmail(event.target.value)}
              style={inputStyle}
              autoComplete="email"
            />
          </label>

          <label style={labelStyle}>
            Approval Comment / Rejection Rationale
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={5}
              placeholder="Optional for approval. Required for rejection."
              style={textareaStyle}
            />
          </label>

          <div style={buttonRowStyle}>
            <button
              type="button"
              disabled={submitting}
              onClick={() => submitDecision("approved")}
              style={approveButtonStyle}
            >
              {submitting ? "Submitting..." : "Approve & Sign"}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => submitDecision("rejected")}
              style={rejectButtonStyle}
            >
              Reject & Return for Revision
            </button>
          </div>
        </section>
      ) : (
        <section style={statusCardStyle}>
          This approval task is <strong>{String(task?.status || "complete")}</strong>. No further decision can be entered from this package.
        </section>
      )}
    </main>
  );
}

function ReportSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={cardStyle}>
      <h2 style={sectionTitleStyle}>{title}</h2>
      {children}
    </section>
  );
}

function InfoGrid({ entries }: { entries: Array<[string, any]> }) {
  return (
    <div style={infoGridStyle}>
      {entries.map(([label, value]) => (
        <div key={label} style={infoItemStyle}>
          <div style={infoLabelStyle}>{label}</div>
          <div style={infoValueStyle}>{formatValue(value)}</div>
        </div>
      ))}
    </div>
  );
}

function MetricTable({ data, exclude = [] }: { data: any; exclude?: string[] }) {
  if (!data || typeof data !== "object") {
    return <p style={paragraphStyle}>No data recorded in this report section.</p>;
  }

  const entries = Object.entries(data).filter(([key]) => !exclude.includes(key));
  if (entries.length === 0) return <p style={paragraphStyle}>No data recorded in this report section.</p>;

  return (
    <div style={{ display: "grid", gap: "10px" }}>
      {entries.map(([key, value]) => (
        <div key={key} style={metricRowStyle}>
          <strong style={{ minWidth: "220px" }}>{formatLabel(key)}</strong>
          <div style={{ flex: 1, overflowWrap: "anywhere" }}>{renderSnapshotValue(value)}</div>
        </div>
      ))}
    </div>
  );
}

function renderSnapshotValue(value: any): React.ReactNode {
  if (value === null || value === undefined || value === "") return "N/A";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (["string", "number"].includes(typeof value)) return String(value);

  if (Array.isArray(value)) {
    if (value.length === 0) return "None";
    return (
      <div style={{ display: "grid", gap: "8px" }}>
        {value.map((item, index) => (
          <div key={index} style={nestedValueStyle}>
            {typeof item === "object" && item !== null ? (
              <MetricTable data={item} />
            ) : (
              formatValue(item)
            )}
          </div>
        ))}
      </div>
    );
  }

  if (typeof value === "object") {
    return <MetricTable data={value} />;
  }

  return String(value);
}

function pick(source: any, keys: string[]) {
  if (!source || typeof source !== "object") return {};
  return keys.reduce((result: Record<string, any>, key) => {
    if (key in source) result[key] = source[key];
    return result;
  }, {});
}

function formatLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatValue(value: any) {
  if (value === null || value === undefined || value === "") return "N/A";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

const pageStyle: React.CSSProperties = {
  maxWidth: "1180px",
  margin: "0 auto",
  padding: "28px 20px 60px",
  background: "#f8fafc",
  minHeight: "100vh",
  color: "#0f172a",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "20px",
  alignItems: "flex-start",
  marginBottom: "20px",
};

const eyebrowStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 800,
  letterSpacing: "0.08em",
  color: "#475569",
};

const cardStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid #dbe3ee",
  borderRadius: "12px",
  padding: "20px",
  marginBottom: "16px",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
};

const statusCardStyle: React.CSSProperties = {
  ...cardStyle,
  background: "#eff6ff",
  borderColor: "#bfdbfe",
};

const decisionCardStyle: React.CSSProperties = {
  ...cardStyle,
  borderWidth: "2px",
  borderColor: "#94a3b8",
};

const sectionTitleStyle: React.CSSProperties = {
  marginTop: 0,
  borderBottom: "1px solid #e2e8f0",
  paddingBottom: "10px",
};

const paragraphStyle: React.CSSProperties = {
  whiteSpace: "pre-wrap",
  lineHeight: 1.6,
};

const infoGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "12px",
};

const infoItemStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  padding: "10px 12px",
  background: "#f8fafc",
};

const infoLabelStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#64748b",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const infoValueStyle: React.CSSProperties = {
  marginTop: "4px",
  fontWeight: 600,
};

const metricRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "16px",
  alignItems: "flex-start",
  borderBottom: "1px solid #eef2f7",
  paddingBottom: "8px",
};

const nestedValueStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  padding: "10px",
  background: "#f8fafc",
};

const meaningBoxStyle: React.CSSProperties = {
  marginTop: "16px",
  padding: "14px",
  borderRadius: "8px",
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
};

const labelStyle: React.CSSProperties = {
  display: "grid",
  gap: "6px",
  marginBottom: "14px",
  fontWeight: 700,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: "8px",
  fontWeight: 400,
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize: "vertical",
};

const buttonRowStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "10px",
  marginTop: "10px",
};

const approveButtonStyle: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: "8px",
  border: "1px solid #166534",
  background: "#166534",
  color: "white",
  fontWeight: 700,
  cursor: "pointer",
};

const rejectButtonStyle: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: "8px",
  border: "1px solid #991b1b",
  background: "white",
  color: "#991b1b",
  fontWeight: 700,
  cursor: "pointer",
};

const backLinkStyle: React.CSSProperties = {
  textDecoration: "none",
  fontWeight: 700,
  color: "#1d4ed8",
};
