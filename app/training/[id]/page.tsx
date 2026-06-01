"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import ESignatureModal from "../../../components/ESignatureModal";
import { acknowledgeTraining } from "../../../services/trainingService";

type TrainingAssignment = {
  id: string;
  document_id: string | null;
  assigned_to_email: string;
  assigned_by_email: string | null;
  assignment_source: string | null;
  role_name: string | null;
  department: string | null;
  training_title: string | null;
  training_description: string | null;
  due_date: string | null;
  status: string | null;
  completed_at: string | null;
  completed_by: string | null;
  effectiveness_required: boolean | null;
  effectiveness_status: string | null;
  supervisor_verification_required: boolean | null;
  supervisor_verified_by: string | null;
  supervisor_verified_at: string | null;
  acknowledgement_required: boolean | null;
  acknowledged_at: string | null;
  acknowledged_by?: string | null;
  signature_id?: string | null;
  training_comments: string | null;
  created_at: string | null;
};

type ControlledDocument = {
  id: string;
  document_number: string;
  title: string;
  revision: string;
  status: string;
  document_type?: string | null;
  department?: string | null;
  process_area?: string | null;
  file_name?: string | null;
  file_url?: string | null;
  controlled_copy_file_name?: string | null;
  controlled_copy_file_url?: string | null;
  controlled_copy_generated_at?: string | null;
  effective_date?: string | null;
};

type ElectronicSignature = {
  id: string;
  module_name: string;
  record_id: string;
  action_type: string;
  signed_by: string;
  signer_role: string | null;
  signature_meaning: string;
  signature_reason: string | null;
  signed_at: string | null;
};

type EffectivenessCheck = {
  id: string;
  training_assignment_id: string;
  effectiveness_method: string | null;
  effectiveness_result: string | null;
  verified_by: string | null;
  verified_at: string | null;
  comments: string | null;
};

export default function TrainingAssignmentDetailPage() {
  const params = useParams();
  const assignmentId = String(params?.id || "");

  const [assignment, setAssignment] = useState<TrainingAssignment | null>(null);
  const [documentRecord, setDocumentRecord] = useState<ControlledDocument | null>(null);
  const [signatures, setSignatures] = useState<ElectronicSignature[]>([]);
  const [effectivenessChecks, setEffectivenessChecks] = useState<EffectivenessCheck[]>([]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState("");

  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [effectivenessMethod, setEffectivenessMethod] = useState("");
  const [effectivenessResult, setEffectivenessResult] = useState("");
  const [effectivenessComments, setEffectivenessComments] = useState("");
  const [trainingComments, setTrainingComments] = useState("");

  const canManage =
    userRole === "admin" ||
    userRole === "approver" ||
    userRole === "vp_quality" ||
    userRole === "quality" ||
    userRole === "training_admin";

  const isAssignedUser = useMemo(() => {
    return normalizeEmail(assignment?.assigned_to_email) === normalizeEmail(userEmail);
  }, [assignment, userEmail]);

  const canCompleteTraining = Boolean(
    assignment &&
      assignment.status !== "completed" &&
      assignment.status !== "waived" &&
      (isAssignedUser || canManage)
  );

  const isOverdue = Boolean(
    assignment?.status !== "completed" &&
      assignment?.status !== "waived" &&
      assignment?.due_date &&
      assignment.due_date < new Date().toISOString().slice(0, 10)
  );

  const trainingDocumentUrl =
    documentRecord &&
    (documentRecord.status === "release" || documentRecord.status === "effective") &&
    documentRecord.controlled_copy_file_url
      ? documentRecord.controlled_copy_file_url
      : documentRecord?.file_url || null;

  const trainingDocumentLabel =
    documentRecord &&
    (documentRecord.status === "release" || documentRecord.status === "effective") &&
    documentRecord.controlled_copy_file_url
      ? "Open Controlled Copy"
      : "Open Training Document";

  const fetchUser = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const email = userData?.user?.email || "";
    setUserEmail(email);

    if (!email) return;

    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_email", email)
      .maybeSingle();

    setUserRole(data?.role || "user");
  };

  const fetchData = async () => {
    setLoading(true);
    await fetchUser();

    const assignmentRes = await supabase
      .from("training_assignments")
      .select("*")
      .eq("id", assignmentId)
      .maybeSingle();

    if (assignmentRes.error) {
      alert(assignmentRes.error.message);
      setLoading(false);
      return;
    }

    const loadedAssignment = assignmentRes.data as TrainingAssignment | null;
    setAssignment(loadedAssignment);
    setTrainingComments(loadedAssignment?.training_comments || "");

    if (loadedAssignment?.document_id) {
      const docRes = await supabase
        .from("controlled_documents")
        .select("id, document_number, title, revision, status, document_type, department, process_area, file_name, file_url, controlled_copy_file_name, controlled_copy_file_url, controlled_copy_generated_at, effective_date")
        .eq("id", loadedAssignment.document_id)
        .maybeSingle();

      if (!docRes.error) {
        setDocumentRecord((docRes.data as ControlledDocument) || null);
      }
    } else {
      setDocumentRecord(null);
    }

    const [signatureRes, effectivenessRes] = await Promise.all([
      supabase
        .from("electronic_signatures")
        .select("*")
        .eq("module_name", "training")
        .eq("record_id", assignmentId)
        .order("signed_at", { ascending: false }),
      supabase
        .from("training_effectiveness_checks")
        .select("*")
        .eq("training_assignment_id", assignmentId)
        .order("verified_at", { ascending: false }),
    ]);

    if (!signatureRes.error) setSignatures((signatureRes.data as ElectronicSignature[]) || []);
    if (!effectivenessRes.error) setEffectivenessChecks((effectivenessRes.data as EffectivenessCheck[]) || []);

    setLoading(false);
  };

  useEffect(() => {
    if (assignmentId) fetchData();
  }, [assignmentId]);

  const updateAssignmentStatus = async (status: string) => {
    if (!assignment) return;

    const payload: any = { status };

    if (status === "in_progress") {
      payload.training_comments = trainingComments || "Training started.";
    }

    if (status === "waived") {
      if (!canManage) {
        alert("Only training admin, quality, approver, admin, or VP Quality can waive training.");
        return;
      }

      payload.completed_at = new Date().toISOString();
      payload.completed_by = userEmail;
    }

    setBusy(true);

    const { error } = await supabase
      .from("training_assignments")
      .update(payload)
      .eq("id", assignment.id);

    setBusy(false);

    if (error) {
      alert(error.message);
      return;
    }

    fetchData();
  };

  const handleTrainingSignatureSubmit = async ({
    meaning,
    reason,
  }: {
    meaning: string;
    reason: string;
  }) => {
    if (!assignment) return;

    if (!canCompleteTraining) {
      alert("Only the assigned trainee or training administrator can complete this training.");
      return;
    }

    if (assignment.acknowledgement_required && !trainingDocumentUrl && assignment.document_id) {
      alert("A controlled document file is required before training can be acknowledged.");
      return;
    }

    setBusy(true);

    try {
      await acknowledgeTraining({
        assignmentId: assignment.id,
        documentId: assignment.document_id,
        userEmail,
        userRole,
        meaning: meaning || "Acknowledge Training",
        reason: reason || "Training completed and acknowledged.",
      });

      setShowSignatureModal(false);
      await fetchData();
      alert("Training completed and electronically signed.");
    } catch (error: any) {
      alert(error.message);
    }

    setBusy(false);
  };

  const verifySupervisor = async () => {
    if (!assignment) return;

    if (!canManage) {
      alert("Only training admin, quality, approver, admin, or VP Quality can verify training.");
      return;
    }

    setBusy(true);

    const { error } = await supabase
      .from("training_assignments")
      .update({
        supervisor_verified_by: userEmail,
        supervisor_verified_at: new Date().toISOString(),
      })
      .eq("id", assignment.id);

    setBusy(false);

    if (error) {
      alert(error.message);
      return;
    }

    fetchData();
  };

  const completeEffectiveness = async () => {
    if (!assignment) return;

    if (!canManage) {
      alert("Only training admin, quality, approver, admin, or VP Quality can complete effectiveness checks.");
      return;
    }

    if (!effectivenessMethod.trim() || !effectivenessResult.trim()) {
      alert("Effectiveness method and result are required.");
      return;
    }

    setBusy(true);

    const { error: checkError } = await supabase
      .from("training_effectiveness_checks")
      .insert({
        training_assignment_id: assignment.id,
        effectiveness_method: effectivenessMethod,
        effectiveness_result: effectivenessResult,
        verified_by: userEmail,
        verified_at: new Date().toISOString(),
        comments: effectivenessComments || null,
      });

    if (checkError) {
      alert(checkError.message);
      setBusy(false);
      return;
    }

    const { error } = await supabase
      .from("training_assignments")
      .update({
        effectiveness_status: "effectiveness_complete",
        status: assignment.status === "completed" ? "effectiveness_complete" : assignment.status,
      })
      .eq("id", assignment.id);

    setBusy(false);

    if (error) {
      alert(error.message);
      return;
    }

    setEffectivenessMethod("");
    setEffectivenessResult("");
    setEffectivenessComments("");
    fetchData();
  };

  if (loading) {
    return <main style={pageStyle}>Loading Training Record...</main>;
  }

  if (!assignment) {
    return (
      <main style={pageStyle}>
        <h1>Training assignment not found</h1>
        <a href="/training" style={darkButtonStyle}>Back to Training</a>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>TRAINING RECORD</div>
          <h1 style={{ margin: "6px 0" }}>{assignment.training_title || "Training Assignment"}</h1>
          <p style={subtleText}>{assignment.training_description || "Controlled document training record."}</p>
        </div>

        <div style={buttonRowStyle}>
          <a href="/training" style={darkButtonStyle}>Back to Training</a>
          <a href="/dashboard" style={darkButtonStyle}>Dashboard</a>
        </div>
      </header>

      <section style={kpiGridStyle}>
        <div style={kpiCardStyle}>
          <div style={kpiTitleStyle}>Status</div>
          <StatusBadge status={isOverdue ? "overdue" : assignment.status || "assigned"} />
        </div>
        <KpiCard title="Signatures" value={signatures.length} color="#2563eb" />
        <KpiCard title="Effectiveness Checks" value={effectivenessChecks.length} color="#7c3aed" />
        <div style={kpiCardStyle}>
          <div style={kpiTitleStyle}>Due Date</div>
          <div style={{ fontSize: "22px", fontWeight: 800, color: isOverdue ? "#dc2626" : "#111827" }}>
            {assignment.due_date || "N/A"}
          </div>
        </div>
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Assignment Details</h2>
        <div style={gridStyle}>
          <Field label="Assigned To"><div>{assignment.assigned_to_email}</div></Field>
          <Field label="Assigned By"><div>{assignment.assigned_by_email || "N/A"}</div></Field>
          <Field label="Role"><div>{assignment.role_name || "N/A"}</div></Field>
          <Field label="Department"><div>{assignment.department || "N/A"}</div></Field>
          <Field label="Assignment Source"><div>{assignment.assignment_source || "N/A"}</div></Field>
          <Field label="Acknowledgement Required"><div>{assignment.acknowledgement_required ? "Yes" : "No"}</div></Field>
          <Field label="Completed At"><div>{formatDateTime(assignment.completed_at)}</div></Field>
          <Field label="Completed By"><div>{assignment.completed_by || "N/A"}</div></Field>
          <Field label="Acknowledged At"><div>{formatDateTime(assignment.acknowledged_at)}</div></Field>
          <Field label="Acknowledged By"><div>{assignment.acknowledged_by || "N/A"}</div></Field>
        </div>

        <Field label="Training Comments">
          <textarea
            value={trainingComments}
            onChange={(e) => setTrainingComments(e.target.value)}
            rows={3}
            style={textareaStyle}
            disabled={assignment.status === "completed"}
          />
        </Field>
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Controlled Document</h2>

        {documentRecord ? (
          <>
            <div style={gridStyle}>
              <Field label="Document"><div>{documentRecord.document_number} Rev {documentRecord.revision}</div></Field>
              <Field label="Title"><div>{documentRecord.title}</div></Field>
              <Field label="Status"><StatusBadge status={documentRecord.status} /></Field>
              <Field label="Type"><div>{documentRecord.document_type || "N/A"}</div></Field>
              <Field label="Department"><div>{documentRecord.department || "N/A"}</div></Field>
              <Field label="Effective Date"><div>{documentRecord.effective_date || "N/A"}</div></Field>
              <Field label="Training Document Source">
                <div>
                  {(documentRecord.status === "release" || documentRecord.status === "effective") && documentRecord.controlled_copy_file_url
                    ? "Controlled Copy"
                    : "Working Copy"}
                </div>
              </Field>
            </div>

            <div style={buttonRowStyle}>
              {trainingDocumentUrl ? (
                <a href={trainingDocumentUrl} target="_blank" rel="noreferrer" style={primaryLinkStyle}>
                  {trainingDocumentLabel}
                </a>
              ) : (
                <span style={warningStyle}>No document file attached.</span>
              )}

              <a href={`/documents/${documentRecord.id}`} style={darkButtonStyle}>
                Open Document Workflow
              </a>
            </div>
          </>
        ) : (
          <p style={subtleText}>No controlled document is linked to this training assignment.</p>
        )}
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Training Actions</h2>
        <div style={actionStackStyle}>
          {assignment.status === "assigned" ? (
            <button disabled={busy} onClick={() => updateAssignmentStatus("in_progress")} style={primaryButtonStyle}>
              Start Training
            </button>
          ) : null}

          {canCompleteTraining ? (
            <button disabled={busy} onClick={() => setShowSignatureModal(true)} style={primaryButtonStyle}>
              Electronic Signature Required - Complete Training
            </button>
          ) : null}

          {canManage && assignment.supervisor_verification_required ? (
            <button disabled={busy} onClick={verifySupervisor} style={secondaryButtonStyle}>
              Supervisor Verify
            </button>
          ) : null}

          {canManage && assignment.status !== "completed" && assignment.status !== "waived" ? (
            <button disabled={busy} onClick={() => updateAssignmentStatus("waived")} style={dangerButtonStyle}>
              Waive Training
            </button>
          ) : null}
        </div>
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Electronic Signature Record</h2>

        {signatures.length === 0 ? (
          <p style={subtleText}>No electronic signature has been recorded for this training assignment.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Signed By</th>
                  <th style={thStyle}>Role</th>
                  <th style={thStyle}>Action</th>
                  <th style={thStyle}>Meaning</th>
                  <th style={thStyle}>Reason</th>
                  <th style={thStyle}>Signed At</th>
                </tr>
              </thead>
              <tbody>
                {signatures.map((signature) => (
                  <tr key={signature.id}>
                    <td style={tdStyle}>{signature.signed_by}</td>
                    <td style={tdStyle}>{signature.signer_role || "N/A"}</td>
                    <td style={tdStyle}>{signature.action_type}</td>
                    <td style={tdStyle}>{signature.signature_meaning}</td>
                    <td style={tdStyle}>{signature.signature_reason || "N/A"}</td>
                    <td style={tdStyle}>{formatDateTime(signature.signed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Effectiveness Check</h2>

        {assignment.effectiveness_required ? (
          <>
            <div style={gridStyle}>
              <Field label="Effectiveness Status"><div>{assignment.effectiveness_status || "pending"}</div></Field>
              <Field label="Supervisor Verification">
                <div>
                  {assignment.supervisor_verification_required
                    ? assignment.supervisor_verified_at
                      ? `Verified by ${assignment.supervisor_verified_by || "unknown"} on ${formatDateTime(assignment.supervisor_verified_at)}`
                      : "Required"
                    : "Not required"}
                </div>
              </Field>
            </div>

            {canManage ? (
              <div style={trainingCardStyle}>
                <h3 style={{ marginTop: 0 }}>Complete Effectiveness Check</h3>
                <input
                  placeholder="Method"
                  value={effectivenessMethod}
                  onChange={(e) => setEffectivenessMethod(e.target.value)}
                  style={inputStyle}
                />
                <input
                  placeholder="Result"
                  value={effectivenessResult}
                  onChange={(e) => setEffectivenessResult(e.target.value)}
                  style={inputStyle}
                />
                <textarea
                  placeholder="Comments"
                  value={effectivenessComments}
                  onChange={(e) => setEffectivenessComments(e.target.value)}
                  rows={3}
                  style={textareaStyle}
                />
                <button disabled={busy} onClick={completeEffectiveness} style={primaryButtonStyle}>
                  Complete Effectiveness
                </button>
              </div>
            ) : null}

            <h3>Effectiveness History</h3>
            {effectivenessChecks.length === 0 ? (
              <p style={subtleText}>No effectiveness checks recorded.</p>
            ) : (
              <div style={{ display: "grid", gap: "10px" }}>
                {effectivenessChecks.map((check) => (
                  <div key={check.id} style={trainingCardStyle}>
                    <strong>{check.effectiveness_result || "Result not specified"}</strong>
                    <div style={smallTextStyle}>Method: {check.effectiveness_method || "N/A"}</div>
                    <div style={smallTextStyle}>Verified by {check.verified_by || "unknown"} • {formatDateTime(check.verified_at)}</div>
                    {check.comments ? <p>{check.comments}</p> : null}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <p style={subtleText}>Effectiveness check is not required for this assignment.</p>
        )}
      </section>

      <ESignatureModal
        open={showSignatureModal}
        title="Training Acknowledgement Signature"
        actionLabel="Sign & Complete Training"
        onSubmit={handleTrainingSignatureSubmit}
        onClose={() => setShowSignatureModal(false)}
      />
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "12px" }}>
      <label style={labelStyle}>{label}</label>
      <div style={{ marginTop: "5px" }}>{children}</div>
    </div>
  );
}

function KpiCard({ title, value, color }: { title: string; value: number; color: string }) {
  return (
    <div style={{ ...kpiCardStyle, borderLeft: `8px solid ${color}` }}>
      <div style={kpiTitleStyle}>{title}</div>
      <div style={{ fontSize: "30px", fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "completed" || status === "effectiveness_complete" || status === "effective"
      ? "#15803d"
      : status === "overdue" || status === "rejected"
      ? "#dc2626"
      : status === "waived"
      ? "#6b7280"
      : status === "in_progress"
      ? "#2563eb"
      : "#d97706";

  return (
    <span
      style={{
        background: color,
        color: "white",
        borderRadius: "999px",
        padding: "3px 8px",
        fontSize: "12px",
        fontWeight: 700,
      }}
    >
      {status}
    </span>
  );
}

function normalizeEmail(value: string | null | undefined) {
  const text = String(value || "").trim().toLowerCase();
  if (!text || !text.includes("@")) return "";
  return text;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "N/A";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

const pageStyle: React.CSSProperties = { padding: "24px", background: "#f8fafc", minHeight: "100vh", fontFamily: "Arial, sans-serif" };
const headerStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-start", flexWrap: "wrap", marginBottom: "20px" };
const eyebrowStyle: React.CSSProperties = { fontSize: "12px", letterSpacing: "0.08em", color: "#6b7280", fontWeight: 800 };
const subtleText: React.CSSProperties = { color: "#6b7280" };
const cardStyle: React.CSSProperties = { background: "white", border: "1px solid #d1d5db", borderRadius: "16px", padding: "20px", marginBottom: "20px" };
const gridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "14px" };
const kpiGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px", marginBottom: "20px" };
const kpiCardStyle: React.CSSProperties = { background: "white", border: "1px solid #d1d5db", borderRadius: "14px", padding: "16px" };
const kpiTitleStyle: React.CSSProperties = { color: "#6b7280", marginBottom: "8px" };
const labelStyle: React.CSSProperties = { fontWeight: 700 };
const inputStyle: React.CSSProperties = { width: "100%", padding: "9px", borderRadius: "8px", border: "1px solid #d1d5db", marginBottom: "8px" };
const textareaStyle: React.CSSProperties = { width: "100%", padding: "9px", borderRadius: "8px", border: "1px solid #d1d5db", marginTop: "6px" };
const primaryButtonStyle: React.CSSProperties = { background: "#2563eb", color: "white", border: "none", padding: "10px 14px", borderRadius: "8px", fontWeight: 700, cursor: "pointer", marginRight: "8px" };
const secondaryButtonStyle: React.CSSProperties = { background: "#15803d", color: "white", border: "none", padding: "10px 14px", borderRadius: "8px", fontWeight: 700, cursor: "pointer", marginRight: "8px" };
const dangerButtonStyle: React.CSSProperties = { background: "#dc2626", color: "white", border: "none", padding: "10px 14px", borderRadius: "8px", fontWeight: 700, cursor: "pointer", marginRight: "8px" };
const darkButtonStyle: React.CSSProperties = { background: "#111827", color: "white", padding: "10px 14px", borderRadius: "8px", textDecoration: "none", fontWeight: 700, display: "inline-block" };
const primaryLinkStyle: React.CSSProperties = { background: "#2563eb", color: "white", padding: "9px 12px", borderRadius: "8px", textDecoration: "none", fontWeight: 700, display: "inline-block" };
const buttonRowStyle: React.CSSProperties = { display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center", marginTop: "12px", marginBottom: "12px" };
const actionStackStyle: React.CSSProperties = { display: "grid", gap: "8px", alignItems: "start" };
const smallTextStyle: React.CSSProperties = { fontSize: "12px", color: "#6b7280" };
const trainingCardStyle: React.CSSProperties = { border: "1px solid #d1d5db", borderRadius: "12px", padding: "14px", background: "#f9fafb", marginTop: "12px" };
const warningStyle: React.CSSProperties = { color: "#b45309", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "8px", padding: "8px", display: "inline-block" };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse" };
const thStyle: React.CSSProperties = { textAlign: "left", borderBottom: "1px solid #d1d5db", padding: "10px" };
const tdStyle: React.CSSProperties = { borderBottom: "1px solid #e5e7eb", padding: "10px", verticalAlign: "top" };
