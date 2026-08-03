"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";

type Decision = "approved" | "rejected";

export default function NcmrMrbApprovalReviewPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const id = params.id;
  const taskId = searchParams.get("taskId") || "";

  const [record, setRecord] = useState<any>(null);
  const [task, setTask] = useState<any>(null);
  const [affectedItems, setAffectedItems] = useState<any[]>([]);
  const [userEmail, setUserEmail] = useState("");
  const [reviewerComment, setReviewerComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const normalizedUserEmail = normalizeEmail(userEmail);
  const normalizedAssigneeEmail = normalizeEmail(task?.assigned_to_email);
  const isAssignedReviewer =
    Boolean(normalizedUserEmail) &&
    normalizedUserEmail === normalizedAssigneeEmail;
  const isPending = String(task?.status || "").toLowerCase() === "pending";

  const riskLevel = useMemo(() => {
    return (
      record?.risk_level ||
      record?.risk_rating ||
      record?.risk_assessment ||
      "Not documented"
    );
  }, [record]);

  const load = async () => {
    setLoading(true);

    try {
      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError) throw new Error(userError.message);

      const email = normalizeEmail(userData?.user?.email);
      setUserEmail(email);

      if (!email) throw new Error("You must be logged in to review this MRB.");

      const [recordResult, taskResult, affectedResult] = await Promise.all([
        supabase.from("ncmrs").select("*").eq("id", id).maybeSingle(),
        supabase
          .from("approval_tasks")
          .select("*")
          .eq("id", taskId)
          .eq("entity_type", "ncmr")
          .eq("entity_id", id)
          .maybeSingle(),
        supabase
          .from("ncmr_affected_items")
          .select("*")
          .eq("ncmr_id", id)
          .order("created_at", { ascending: true }),
      ]);

      if (recordResult.error) throw new Error(recordResult.error.message);
      if (taskResult.error) throw new Error(taskResult.error.message);
      if (affectedResult.error) throw new Error(affectedResult.error.message);
      if (!recordResult.data) throw new Error("NCMR record not found.");
      if (!taskResult.data) throw new Error("MRB approval task not found.");

      const loadedTask = taskResult.data;

      if (
        !["mrb_approval", "ncmr_mrb_approval", "ncmr_mrb_review"].includes(
          String(loadedTask.task_type || "")
        )
      ) {
        throw new Error("This task is not an MRB approval task.");
      }

      if (
        normalizeEmail(loadedTask.assigned_to_email) !==
        normalizeEmail(email)
      ) {
        throw new Error(
          "This MRB approval task is assigned to another reviewer."
        );
      }

      setRecord(recordResult.data);
      setTask(loadedTask);
      setAffectedItems(affectedResult.data || []);
      setReviewerComment(loadedTask.approver_comment || "");
    } catch (error: any) {
      alert(error?.message || "Unable to load the MRB review package.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id && taskId) {
      load();
    } else {
      setLoading(false);
    }
  }, [id, taskId]);

  const addAuditLog = async (action: string, details: string) => {
    await supabase.from("audit_logs").insert({
      entity_type: "ncmr",
      entity_id: id,
      action,
      details,
      user_email: userEmail || "unknown",
    });
  };

  const notifyOwner = async (
    notificationType: string,
    title: string,
    message: string,
    severity: string
  ) => {
    const ownerEmail = normalizeEmail(
      record?.owner_email || record?.owner || record?.created_by
    );

    if (!ownerEmail) return;

    await supabase.from("notifications").insert({
      user_email: ownerEmail,
      assigned_role: "NCMR Owner",
      notification_type: notificationType,
      title,
      message,
      related_module: "ncmr",
      related_record_id: id,
      related_url: `/ncmrs/${id}`,
      severity,
      read_status: false,
      created_by: userEmail || null,
      delivery_frequency: "immediate",
      delivery_status: "in_app",
    });
  };

  const syncApproverConfiguration = async (
    status: Decision,
    signedAt: string
  ) => {
    await supabase
      .from("ncmr_mrb_approvers")
      .update({
        approval_status: status,
        approved_by: status === "approved" ? userEmail : null,
        approved_at: status === "approved" ? signedAt : null,
        rejected_by: status === "rejected" ? userEmail : null,
        rejected_at: status === "rejected" ? signedAt : null,
        approver_comment: reviewerComment.trim() || null,
      })
      .eq("ncmr_id", id)
      .eq("approver_email", normalizedUserEmail);
  };

  const completeMrbIfReady = async () => {
    const { data: currentTasks, error } = await supabase
      .from("approval_tasks")
      .select("*")
      .eq("entity_type", "ncmr")
      .eq("entity_id", id)
      .eq("task_type", "mrb_approval")
      .not("status", "in", '("cancelled","obsolete")');

    if (error) throw new Error(error.message);

    const requiredTasks = (currentTasks || []).filter(
      (item: any) => item.required !== false
    );

    if (requiredTasks.length === 0) return;

    const hasRejection = requiredTasks.some(
      (item: any) => String(item.status || "").toLowerCase() === "rejected"
    );

    if (hasRejection) return;

    const allApproved = requiredTasks.every(
      (item: any) => String(item.status || "").toLowerCase() === "approved"
    );

    if (!allApproved) return;

    const now = new Date().toISOString();
    const reviewerEmails = requiredTasks
      .map((item: any) => normalizeEmail(item.assigned_to_email))
      .filter(Boolean);

    const { error: updateError } = await supabase
      .from("ncmrs")
      .update({
        mrb_approved_by:
          reviewerEmails.join(", ") || "All Required MRB Reviewers",
        mrb_approved_at: now,
        mrb_signature_email_entered:
          reviewerEmails.join(", ") || "all_required_reviewers",
        mrb_signature_meaning:
          "MRB Approval: all required reviewers approved the submitted MRB package with electronic approval records.",
        review_status: "approved",
      })
      .eq("id", id);

    if (updateError) throw new Error(updateError.message);

    await addAuditLog(
      "mrb_approval_completed",
      `MRB approval completed after all required reviewers approved: ${reviewerEmails.join(", ")}.`
    );

    await notifyOwner(
      "ncmr_mrb_approved",
      `MRB approved: ${record?.ncmr_number || "NCMR"}`,
      `All required reviewers approved the MRB package. Implementation is now available.`,
      "success"
    );
  };

  const submitDecision = async (decision: Decision) => {
    if (!task || !record) return;

    if (!isAssignedReviewer) {
      alert("This task is not assigned to the logged-in reviewer.");
      return;
    }

    if (!isPending) {
      alert("This MRB approval task has already been completed.");
      return;
    }

    if (decision === "rejected" && !reviewerComment.trim()) {
      alert("A rejection rationale is required.");
      return;
    }

    const verb = decision === "approved" ? "approve" : "reject";
    const confirmed = window.confirm(
      `Electronic Signature:\n\nI ${verb} this MRB review package. My decision, identity, timestamp, and comment will become part of the official quality record.`
    );

    if (!confirmed) return;

    setSubmitting(true);

    try {
      const now = new Date().toISOString();
      const signatureMeaning = `MRB Approval: I ${verb} the submitted MRB review package.`;

      const { error: taskError } = await supabase
        .from("approval_tasks")
        .update({
          status: decision,
          approver_comment: reviewerComment.trim() || null,
          signature_meaning: signatureMeaning,
          signed_by: userEmail,
          signed_at: now,
        })
        .eq("id", task.id)
        .eq("assigned_to_email", normalizedUserEmail)
        .eq("status", "pending");

      if (taskError) throw new Error(taskError.message);

      await syncApproverConfiguration(decision, now);

      await addAuditLog(
        `mrb_approval_task_${decision}`,
        `${task.required_function || "MRB reviewer"} ${decision} by ${userEmail}. Reviewer comment: ${reviewerComment.trim() || "N/A"}.`
      );

      if (decision === "rejected") {
        await supabase
          .from("ncmrs")
          .update({
            review_status: "rejected",
          })
          .eq("id", id);

        await notifyOwner(
          "ncmr_mrb_rejected",
          `MRB review rejected: ${record?.ncmr_number || "NCMR"}`,
          `${userEmail} rejected the MRB package. Rationale: ${reviewerComment.trim()}`,
          "high"
        );
      } else {
        await completeMrbIfReady();
      }

      alert(`MRB review ${decision}.`);
      window.location.href = "/my-approval-tasks";
    } catch (error: any) {
      alert(error?.message || `Unable to ${verb} the MRB package.`);
      setSubmitting(false);
    }
  };

  if (loading) {
    return <main style={pageStyle}>Loading MRB review package...</main>;
  }

  if (!record || !task) {
    return (
      <main style={pageStyle}>
        <h1>MRB Review Package</h1>
        <p>The requested review package could not be loaded.</p>
        <Link href="/my-approval-tasks">Back to My Tasks</Link>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>QUALISPHERE ENTERPRISE APPROVAL ENGINE</div>
          <h1 style={{ margin: "6px 0" }}>MRB Review Package</h1>
          <p style={mutedStyle}>
            Read-only review of the NCMR record through the MRB approval gate.
          </p>
        </div>

        <div style={headerActionStyle}>
          <StatusBadge value={task.status || "pending"} />
          <Link href="/my-approval-tasks" style={secondaryLinkStyle}>
            Back to My Tasks
          </Link>
        </div>
      </header>

      <section style={summaryGridStyle}>
        <Summary label="NCMR" value={record.ncmr_number || id} />
        <Summary label="Reviewer" value={task.assigned_to_email || "N/A"} />
        <Summary label="Function / Job Title" value={task.required_function || "MRB Approval"} />
        <Summary label="Approve By" value={task.due_date || "Not set"} />
      </section>

      <ReadOnlySection title="1. Record Summary">
        <Field label="Issue Description" value={record.issue_description} wide />
        <Field label="Owner" value={record.owner_email || record.owner} />
        <Field label="Source" value={record.source} />
        <Field label="Department" value={record.department} />
        <Field label="Date Identified" value={record.date_identified || record.created_at} />
      </ReadOnlySection>

      <ReadOnlySection title="2. Affected Material">
        {affectedItems.length === 0 ? (
          <p style={mutedStyle}>No affected material rows were found.</p>
        ) : (
          <div style={{ display: "grid", gap: "10px" }}>
            {affectedItems.map((item, index) => (
              <div key={item.id || index} style={itemCardStyle}>
                <strong>Affected Item {index + 1}</strong>
                <div style={fieldGridStyle}>
                  <Field label="Part Number" value={item.product_part_number} />
                  <Field label="Part Description" value={item.part_description} />
                  <Field label="Revision" value={item.part_revision} />
                  <Field label="Lot Number" value={item.lot_number} />
                  <Field label="Work Order" value={item.workorder_number} />
                  <Field label="Quantity Affected" value={item.quantity_affected} />
                  <Field label="Quantity Quarantined" value={item.quarantined_quantity} />
                  <Field label="Disposition" value={item.product_disposition} />
                  <Field label="Disposition Justification" value={item.disposition_justification} wide />
                  <Field label="Quantity Accepted" value={item.quantity_accepted} />
                  <Field label="Quantity Rejected" value={item.quantity_rejected} />
                </div>
              </div>
            ))}
          </div>
        )}
      </ReadOnlySection>

      <ReadOnlySection title="3. Investigation / Root Cause">
        <Field label="Investigator" value={record.investigator} />
        <Field label="Problem Statement" value={record.problem_description} wide />
        <Field label="Investigation Summary" value={record.investigation_summary} wide />
        <Field label="Root Cause Category" value={record.root_cause_category} />
        <Field label="Root Cause Summary" value={record.root_cause} wide />
      </ReadOnlySection>

      <ReadOnlySection title="4. Risk Assessment">
        <Field label="Severity" value={record.severity} />
        <Field label="Risk Level / Assessment" value={riskLevel} wide />
      </ReadOnlySection>

      <ReadOnlySection title="5. Correction / Corrective Action Proposal">
        <Field
          label="Correction / Corrective Action Proposal"
          value={record.correction_action_proposal}
        />
        <Field
          label="Corrective Action Recommendation"
          value={record.corrective_action}
          wide
        />
      </ReadOnlySection>

      <ReadOnlySection title="6. Product Disposition">
        <Field
          label="Overall Product Disposition"
          value={record.product_disposition || record.disposition}
        />
        <Field
          label="Disposition Justification"
          value={record.disposition_justification}
          wide
        />
      </ReadOnlySection>

      <ReadOnlySection title="7. CAPA Governance">
        <Field
          label="CAPA Recommended"
          value={record.capa_recommended ? "Yes" : "No"}
        />
        <Field label="CAPA Decision" value={record.capa_decision} />
        <Field
          label="CAPA Decision Justification"
          value={
            record.capa_decision_justification ||
            record.capa_not_required_justification
          }
          wide
        />
      </ReadOnlySection>

      <ReadOnlySection title="8. Supplier Governance">
        <Field label="Supplier" value={record.supplier_name} />
        <Field label="Supplier ID" value={record.supplier_id} />
        <Field label="SCAR Recommended" value={record.scar_recommended ? "Yes" : "No"} />
        <Field label="SCAR Justification" value={record.scar_justification} wide />
      </ReadOnlySection>

      <ReadOnlySection title="9. MRB Approval Decision">
        <p style={mutedStyle}>
          Review only the information shown above. Downstream implementation,
          rework execution, verification, and closure sections are intentionally
          excluded from this approval package.
        </p>

        <label style={labelStyle}>Reviewer Comment</label>
        <textarea
          value={reviewerComment}
          onChange={(event) => setReviewerComment(event.target.value)}
          rows={5}
          disabled={!isPending || submitting}
          placeholder="Enter approval comments or the required rejection rationale."
          style={textareaStyle}
        />

        {isPending ? (
          <div style={buttonRowStyle}>
            <button
              type="button"
              onClick={() => submitDecision("approved")}
              disabled={submitting}
              style={approveButtonStyle}
            >
              {submitting ? "Submitting..." : "Approve MRB"}
            </button>
            <button
              type="button"
              onClick={() => submitDecision("rejected")}
              disabled={submitting}
              style={rejectButtonStyle}
            >
              Reject MRB
            </button>
          </div>
        ) : (
          <div style={completedPanelStyle}>
            <strong>Decision:</strong> {formatValue(task.status)}
            <br />
            <strong>Signed By:</strong> {task.signed_by || "N/A"}
            <br />
            <strong>Decision Date:</strong> {formatDateTime(task.signed_at)}
            <br />
            <strong>Comment:</strong> {task.approver_comment || "N/A"}
          </div>
        )}
      </ReadOnlySection>
    </main>
  );
}

function ReadOnlySection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={sectionStyle}>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      <div style={fieldGridStyle}>{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: any;
  wide?: boolean;
}) {
  return (
    <div style={wide ? wideFieldStyle : fieldStyle}>
      <div style={fieldLabelStyle}>{label}</div>
      <div style={fieldValueStyle}>{formatValue(value)}</div>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: any }) {
  return (
    <div style={summaryCardStyle}>
      <div style={summaryLabelStyle}>{label}</div>
      <div style={summaryValueStyle}>{formatValue(value)}</div>
    </div>
  );
}

function StatusBadge({ value }: { value: string }) {
  const normalized = String(value || "pending").toLowerCase();

  return (
    <span
      style={{
        ...badgeStyle,
        background:
          normalized === "approved"
            ? "#dcfce7"
            : normalized === "rejected"
              ? "#fee2e2"
              : "#fef3c7",
        color:
          normalized === "approved"
            ? "#166534"
            : normalized === "rejected"
              ? "#991b1b"
              : "#92400e",
      }}
    >
      {formatValue(value)}
    </span>
  );
}

function normalizeEmail(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function formatValue(value: any) {
  if (value === null || value === undefined || value === "") return "N/A";
  if (typeof value === "boolean") return value ? "Yes" : "No";

  return String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDateTime(value: any) {
  if (!value) return "N/A";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  padding: "24px",
  background: "#f8fafc",
  color: "#111827",
  fontFamily: "Arial, sans-serif",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
  flexWrap: "wrap",
  marginBottom: "18px",
};

const headerActionStyle: React.CSSProperties = {
  display: "flex",
  gap: "10px",
  alignItems: "center",
  flexWrap: "wrap",
};

const eyebrowStyle: React.CSSProperties = {
  color: "#2563eb",
  fontSize: "12px",
  fontWeight: 900,
  letterSpacing: "0.12em",
};

const mutedStyle: React.CSSProperties = {
  color: "#64748b",
  lineHeight: 1.5,
};

const summaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: "12px",
  marginBottom: "16px",
};

const summaryCardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #d1d5db",
  borderRadius: "12px",
  padding: "14px",
};

const summaryLabelStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: "12px",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

const summaryValueStyle: React.CSSProperties = {
  marginTop: "6px",
  fontWeight: 900,
  wordBreak: "break-word",
};

const sectionStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #d1d5db",
  borderRadius: "14px",
  padding: "18px",
  marginBottom: "16px",
  boxShadow: "0 4px 18px rgba(15,23,42,0.04)",
};

const fieldGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: "12px",
};

const fieldStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
  padding: "12px",
  background: "#f8fafc",
};

const wideFieldStyle: React.CSSProperties = {
  ...fieldStyle,
  gridColumn: "1 / -1",
};

const fieldLabelStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: "12px",
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const fieldValueStyle: React.CSSProperties = {
  marginTop: "6px",
  lineHeight: 1.55,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};

const itemCardStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: "10px",
  padding: "12px",
  background: "#ffffff",
  gridColumn: "1 / -1",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontWeight: 900,
  marginBottom: "6px",
  gridColumn: "1 / -1",
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  minHeight: "120px",
  border: "1px solid #cbd5e1",
  borderRadius: "10px",
  padding: "10px",
  boxSizing: "border-box",
  gridColumn: "1 / -1",
};

const buttonRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
  gridColumn: "1 / -1",
};

const approveButtonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: "9px",
  background: "#15803d",
  color: "#ffffff",
  padding: "10px 15px",
  fontWeight: 900,
  cursor: "pointer",
};

const rejectButtonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: "9px",
  background: "#b91c1c",
  color: "#ffffff",
  padding: "10px 15px",
  fontWeight: 900,
  cursor: "pointer",
};

const secondaryLinkStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: "9px",
  background: "#ffffff",
  color: "#334155",
  padding: "9px 13px",
  fontWeight: 900,
  textDecoration: "none",
};

const badgeStyle: React.CSSProperties = {
  display: "inline-flex",
  borderRadius: "999px",
  padding: "6px 10px",
  fontWeight: 900,
};

const completedPanelStyle: React.CSSProperties = {
  gridColumn: "1 / -1",
  border: "1px solid #cbd5e1",
  borderRadius: "10px",
  padding: "12px",
  background: "#f8fafc",
  lineHeight: 1.65,
};
