"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import {trainingEvidenceMode} from "../../../lib/trainingMatrix";
import ESignatureModal from "../../../components/ESignatureModal";
import { acknowledgeTraining } from "../../../services/trainingService";
import { resolveControlledDocumentFileUrl } from "../../../lib/controlledDocumentStorage";

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
  tenant_id?: string | null;
  training_evidence_storage_path?: string | null;
  training_evidence_file_name?: string | null;
  training_category?: string | null;
  training_completed_on?: string | null;
  training_valid_until?: string | null;
  recurring_evidence_mode?: string | null;
  approved_evaluation_attachment_required?: boolean | null;
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
  controlled_copy_file_path?: string | null;
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



export default function TrainingAssignmentDetailPage() {
  const params = useParams();
  const assignmentId = String(params?.id || "");

  const [assignment, setAssignment] = useState<TrainingAssignment | null>(null);
  const [documentRecord, setDocumentRecord] = useState<ControlledDocument | null>(null);
  const [signatures, setSignatures] = useState<ElectronicSignature[]>([]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState("");
  const [isTrainingCoordinator, setIsTrainingCoordinator] = useState(false);

  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [trainingComments, setTrainingComments] = useState("");

  const isRegisteredCertification = assignment?.training_category === "certification" && assignment?.assignment_source === "certification_register";
  const [certificateEvidenceError, setCertificateEvidenceError] = useState("");
  const openCertificateEvidence = async () => {
    if (!assignment?.training_evidence_storage_path) return;
    const result = await supabase.storage.from("training-completion-evidence").createSignedUrl(assignment.training_evidence_storage_path, 60);
    if (result.error || !result.data?.signedUrl) { setCertificateEvidenceError(result.error?.message || "Signed form unavailable."); return; }
    setCertificateEvidenceError("");
    window.open(result.data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const canManage =
    userRole === "admin" ||
    userRole === "approver" ||
    userRole === "vp_quality" ||
    userRole === "quality" ||
    userRole === "training_admin";

  const isAssignedUser = useMemo(() => {
    return normalizeEmail(assignment?.assigned_to_email) === normalizeEmail(userEmail);
  }, [assignment, userEmail]);

  const isTerminalTraining = ["completed", "waived", "cancelled", "withdrawn"].includes(assignment?.status || "");
  const canAdminDisposition = isTrainingCoordinator && !isTerminalTraining;

  const canCompleteTraining = Boolean(
    assignment &&
      assignment.status !== "completed" &&
      !isTerminalTraining &&
      isAssignedUser
  );

  const isOverdue = Boolean(
    !isTerminalTraining &&
      assignment?.due_date &&
      assignment.due_date < new Date().toISOString().slice(0, 10)
  );

  const [trainingDocumentUrl, setTrainingDocumentUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const resolveTrainingDocument = async () => {
      if (!documentRecord) {
        if (active) setTrainingDocumentUrl(null);
        return;
      }
      const isReleased = documentRecord.status === "release" || documentRecord.status === "effective";
      try {
        const resolved = isReleased
          ? await resolveControlledDocumentFileUrl({
              filePath: documentRecord.controlled_copy_file_path,
              legacyUrl: documentRecord.controlled_copy_file_url,
            })
          : documentRecord.file_url || null;
        if (active) setTrainingDocumentUrl(resolved);
      } catch (error: any) {
        console.warn("Unable to resolve training document URL:", error?.message || error);
        if (active) setTrainingDocumentUrl(null);
      }
    };
    resolveTrainingDocument();
    return () => { active = false; };
  }, [documentRecord]);

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
    const { data: tenant } = await supabase.rpc("qualisphere_resolve_training_tenant");
    if (tenant) {
      const { data: permitted } = await supabase.rpc("qualisphere_training_is_coordinator", { p_tenant: tenant });
      setIsTrainingCoordinator(permitted === true);
    } else setIsTrainingCoordinator(false);
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
    setEvidenceFile(null);

    if (loadedAssignment?.document_id) {
      const docRes = await supabase
        .from("controlled_documents")
        .select("id, document_number, title, revision, status, document_type, department, process_area, file_name, file_url, controlled_copy_file_name, controlled_copy_file_url, controlled_copy_file_path, controlled_copy_generated_at, effective_date")
        .eq("id", loadedAssignment.document_id)
        .maybeSingle();

      if (!docRes.error) {
        setDocumentRecord((docRes.data as ControlledDocument) || null);
      }
    } else {
      setDocumentRecord(null);
    }

    const signatureRes=await supabase.from("electronic_signatures").select("*").eq("module_name","training").eq("record_id",assignmentId).order("signed_at",{ascending:false});
    if(!signatureRes.error)setSignatures((signatureRes.data as ElectronicSignature[])||[]);

    setLoading(false);
  };

  useEffect(() => {
    if (assignmentId) fetchData();
  }, [assignmentId]);

  const administrativelyCloseTraining = async (status: "waived" | "cancelled" | "withdrawn") => {
    if (!assignment || !isTrainingCoordinator || isTerminalTraining) return;
    const reason = window.prompt("Reason for " + status + " training (required):");
    if (reason === null) return;
    if (!reason.trim()) { alert("A reason is required."); return; }
    setBusy(true);
    const { error } = await supabase.from("training_assignments")
      .update({
        status,
        training_comments: [assignment.training_comments, "Administrative action: " + status + " by " + userEmail + " on " + new Date().toISOString() + ". Reason: " + reason.trim()].filter(Boolean).join("\n")
      })
      .eq("id", assignment.id)
      .eq("tenant_id", assignment.tenant_id)
      .not("status", "in", '("completed","waived","cancelled","withdrawn")');
    setBusy(false);
    if (error) { alert(error.message); return; }
    await fetchData();
  };

  const updateAssignmentStatus = async (status: string) => {
    if (!assignment) return;

    const payload: any = { status };

    if (status === "in_progress") {
      payload.training_comments = trainingComments || "Training started.";
    }

    if (status === "waived") {
      if (!canManage || !isAssignedUser) {
        alert("Training waiver is not available from another employee\'s record.");
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
      alert("Only the assigned trainee can complete and electronically acknowledge this training.");
      return;
    }

    if (assignment.acknowledgement_required && !trainingDocumentUrl && assignment.document_id) {
      alert("A controlled document file is required before training can be acknowledged.");
      return;
    }

    const approvedFormRequired = assignment.training_category === "recurring" && assignment.approved_evaluation_attachment_required;
    const evidenceMode = trainingEvidenceMode(assignment);
    const attachmentRequired = approvedFormRequired || evidenceMode === "attachment" || evidenceMode === "both";
    if (attachmentRequired && !evidenceFile && !assignment.training_evidence_storage_path) {
      alert(approvedFormRequired ? "Upload the supervisor-approved evaluation form before completing training." : "Required training evidence must be attached before completion.");
      return;
    }

    setBusy(true);

    try {
      if (evidenceFile) {
        if (!assignment.tenant_id) throw new Error("Training tenant is missing.");
        if (evidenceFile.size > 10485760) throw new Error("Maximum evidence file size is 10 MB.");
        const extension = evidenceFile.name.split(".").pop()?.toLowerCase() || "bin";
        const path = `${assignment.tenant_id}/${assignment.id}/${crypto.randomUUID()}.${extension}`;
        const uploaded = await supabase.storage.from("training-completion-evidence").upload(path, evidenceFile, { upsert: false });
        if (uploaded.error) throw uploaded.error;
        const saved = await supabase.from("training_assignments").update({ training_evidence_storage_path: path, training_evidence_file_name: evidenceFile.name }).eq("id", assignment.id);
        if (saved.error) throw saved.error;
      }
      if (evidenceMode === "attachment") {
        const result=await supabase.from("training_assignments").update({status:"completed",training_completed_on:new Date().toISOString().slice(0,10),completed_at:new Date().toISOString(),completed_by:userEmail}).eq("id",assignment.id);
        if(result.error)throw result.error;
      } else await acknowledgeTraining({
        assignmentId: assignment.id,
        documentId: assignment.document_id,
        userEmail,
        userRole,
        meaning: meaning || "Acknowledge Training",
        reason: reason || "Training completed and acknowledged.",
      });

      setShowSignatureModal(false);
      setEvidenceFile(null);
      await fetchData();
      alert("Training completion recorded.");
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


  if (loading) {
    return <main style={pageStyle}>Loading Training Record...</main>;
  }

  if (!assignment) {
    return (
      <main style={pageStyle}>
        <h1>Training assignment not found</h1>
        <a href="/workspace" style={darkButtonStyle}>Return to Workspace</a>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>TRAINING RECORD</div>
          <h1 style={{ margin: "6px 0" }}>{isRegisteredCertification && documentRecord ? `${documentRecord.document_number} — ${documentRecord.title} — Rev ${documentRecord.revision}` : assignment.training_title || "Training Assignment"}</h1>
          {isRegisteredCertification ? <p style={subtleText}>Certification: {assignment.training_title || "Approved certification"}</p> : <p style={subtleText}>{assignment.training_description || "Controlled document training record."}</p>}
        </div>

        <div style={buttonRowStyle}>
          <a href="/workspace" style={darkButtonStyle}>Return to Workspace</a>
        </div>
      </header>

      {canManage && documentRecord && !isRegisteredCertification && (
        <div style={{ ...gridStyle, marginBottom: 16 }}>
          <Field label="SOP Number"><strong>{documentRecord.document_number}</strong></Field>
          <Field label="Revision"><strong>{documentRecord.revision}</strong></Field>
        </div>
      )}

      <section style={kpiGridStyle}>
        <div style={kpiCardStyle}><div style={kpiTitleStyle}>Training Status</div><StatusBadge status={isOverdue ? "overdue" : assignment.status || "assigned"} /></div>
        {!isRegisteredCertification && <div style={kpiCardStyle}><div style={kpiTitleStyle}>Due Date</div><strong>{assignment.due_date || "N/A"}</strong></div>}
        <div style={kpiCardStyle}><div style={kpiTitleStyle}>{isRegisteredCertification ? "Certification Date" : "Completion Date"}</div><strong>{isRegisteredCertification ? (assignment.training_completed_on || "N/A") : formatDateTime(assignment.completed_at)}</strong></div>
        {isRegisteredCertification && <div style={kpiCardStyle}><div style={kpiTitleStyle}>Expiration Date</div><strong>{assignment.training_valid_until || "No expiration"}</strong></div>}
      </section>

      {isRegisteredCertification && <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Approved Certification</h2>
        <div style={gridStyle}>
          <Field label="Certified Employee"><div>{assignment.assigned_to_email}</div></Field>
          <Field label="Registered By"><div>{assignment.completed_by || assignment.assigned_by_email || "N/A"}</div></Field>
          <Field label="Signed Certification Form"><div>{assignment.training_evidence_storage_path ? <button type="button" onClick={() => void openCertificateEvidence()}>View Signed Form</button> : "No signed form attached"}</div></Field>
        </div>
        {assignment.training_description && <p><strong>Registration Comments:</strong> {assignment.training_description}</p>}
        {certificateEvidenceError && <p role="alert" style={warningStyle}>{certificateEvidenceError}</p>}
      </section>}
      {canManage && !isRegisteredCertification ? (
        <section style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Administrative Assignment Details</h2>
          <div style={gridStyle}>
            <Field label="Assigned To"><div>{assignment.assigned_to_email}</div></Field>
            <Field label="Assigned By"><div>{assignment.assigned_by_email || "N/A"}</div></Field>
            <Field label="Role"><div>{assignment.role_name || "N/A"}</div></Field>
            <Field label="Department"><div>{assignment.department || "N/A"}</div></Field>
            <Field label="Assignment Source"><div>{assignment.assignment_source || "N/A"}</div></Field>
            <Field label="Acknowledgement Required"><div>{assignment.acknowledgement_required ? "Yes" : "No"}</div></Field>
            <Field label="Completed By"><div>{assignment.completed_by || "N/A"}</div></Field>
            <Field label="Acknowledged By"><div>{assignment.acknowledged_by || "N/A"}</div></Field>
          </div>
        </section>
      ) : null}

      {!canManage && (
      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Training Materials</h2>

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

              {canManage ? <a href={`/documents/${documentRecord.id}`} style={darkButtonStyle}>Open Document Workflow</a> : null}
            </div>
          </>
        ) : (
          <p style={subtleText}>No controlled document is linked to this training assignment.</p>
        )}
      </section>

      )}

      {(canCompleteTraining || (isAssignedUser && assignment.status === "assigned") || (canManage && !isTerminalTraining && assignment.supervisor_verification_required && !assignment.supervisor_verified_at)) ? <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Complete Training</h2>
        {canCompleteTraining ? <div style={{ marginBottom: 16 }}><label style={labelStyle}>{assignment.training_category === "recurring" && assignment.approved_evaluation_attachment_required ? "Supervisor-Approved Evaluation Form (required upload)" : ["attachment", "both"].includes(trainingEvidenceMode(assignment)) ? "Supporting Training Evidence (required upload)" : "Supporting Training Evidence (optional upload)"}</label><input type="file" onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)} disabled={busy} style={{ display: "block", marginTop: 8 }} /><p style={subtleText}>{assignment.training_evidence_file_name ? `Existing evidence: ${assignment.training_evidence_file_name}` : assignment.training_category === "recurring" && assignment.approved_evaluation_attachment_required ? "Upload the form already approved by your supervisor outside QualiSphere. No separate supervisor approval task is generated." : "Attach a training form, examination result, or practical assessment if available."}</p></div> : null}
        <div style={actionStackStyle}>
          {isAssignedUser && assignment.status === "assigned" ? (
            <button disabled={busy} onClick={() => updateAssignmentStatus("in_progress")} style={primaryButtonStyle}>
              Start Training
            </button>
          ) : null}

          {canCompleteTraining ? (
            <button disabled={busy} onClick={() => trainingEvidenceMode(assignment)==="attachment" ? void handleTrainingSignatureSubmit({meaning:"",reason:""}) : setShowSignatureModal(true)} style={primaryButtonStyle}>
              Complete Training
            </button>
          ) : null}

          {canManage && assignment.supervisor_verification_required ? (
            <button disabled={busy} onClick={verifySupervisor} style={secondaryButtonStyle}>
              Supervisor Verify
            </button>
          ) : null}

        </div>
      </section> : null}

      {canAdminDisposition && (
        <section style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Training Administration</h2>
          <p style={subtleText}>Coordinator actions require a reason and do not count as employee completion.</p>
          <div style={actionStackStyle}>
            <button disabled={busy} onClick={() => administrativelyCloseTraining("waived")} style={secondaryButtonStyle}>Waive Training</button>
            <button disabled={busy} onClick={() => administrativelyCloseTraining("cancelled")} style={secondaryButtonStyle}>Cancel Training</button>
            <button disabled={busy} onClick={() => administrativelyCloseTraining("withdrawn")} style={dangerButtonStyle}>Withdraw Training</button>
          </div>
        </section>
      )}

      {!isRegisteredCertification && <section style={cardStyle}>
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
      </section>}

      <ESignatureModal
        open={showSignatureModal}
        title="Training Approval Signature"
        actionLabel="Complete Training"
        fixedMeaning="Approve Training"
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
