"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

export default function NcmrDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [record, setRecord] = useState<any>(null);
  const [linkedCapa, setLinkedCapa] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState("");

  const [investigator, setInvestigator] = useState("");
  const [problemDescription, setProblemDescription] = useState("");
  const [containmentAction, setContainmentAction] = useState("");
  const [investigationSummary, setInvestigationSummary] = useState("");
  const [rootCause, setRootCause] = useState("");
  const [correctionActionProposal, setCorrectionActionProposal] = useState("");
  const [riskAssessment, setRiskAssessment] = useState("");
  const [productDisposition, setProductDisposition] = useState("");
  const [dispositionJustification, setDispositionJustification] = useState("");
  const [correctiveAction, setCorrectiveAction] = useState("");
  const [correctionImplementation, setCorrectionImplementation] = useState("");
  const [reviewStatus, setReviewStatus] = useState("draft");

  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [evidenceNotes, setEvidenceNotes] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const fetchUserRole = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const email = userData?.user?.email || "";
    setUserEmail(email);

    if (!email) return;

    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_email", email)
      .maybeSingle();

    setUserRole(data?.role || "");
  };

  const fetchLinkedCapa = async (capaId: string | null) => {
    if (!capaId) {
      setLinkedCapa(null);
      return;
    }

    const { data, error } = await supabase
  .from("capas")
  .select("*")
  .eq("id", id)
  .maybeSingle();

if (error) {
  alert(error.message);
  setLoading(false);
  return;
}

if (!data) {
  alert("CAPA record not found.");
  setRecord(null);
  setLoading(false);
  return;
}

    setLinkedCapa(data || null);
  };

  const fetchRecord = async () => {
    const { data, error } = await supabase
      .from("ncmrs")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setRecord(data);
    setInvestigator(data.investigator || "");
    setProblemDescription(data.problem_description || "");
    setContainmentAction(data.containment_action || "");
    setInvestigationSummary(data.investigation_summary || "");
    setRootCause(data.root_cause || "");
    setCorrectionActionProposal(data.correction_action_proposal || "");
    setRiskAssessment(data.risk_assessment || "");
    setProductDisposition(data.product_disposition || data.disposition || "");
    setDispositionJustification(data.disposition_justification || "");
    setCorrectiveAction(data.corrective_action || "");
    setCorrectionImplementation(data.correction_implementation || "");
    setReviewStatus(data.review_status || "draft");
    setEvidenceUrl(data.evidence_url || "");
    setEvidenceNotes(data.evidence_notes || "");

    await fetchLinkedCapa(data.capa_id || null);
    setLoading(false);
  };

  const addAuditLog = async (action: string, details: string) => {
    await supabase.from("audit_logs").insert({
      entity_type: "ncmr",
      entity_id: id,
      action,
      details,
      user_email: userEmail || "unknown",
    });
  };

  const createCapaFromNcmr = async () => {
    if (record?.capa_id) {
      alert("This NCMR already has a linked CAPA.");
      return;
    }

    const { data: capaData, error: capaError } = await supabase
      .from("capas")
      .insert({
        title: `CAPA for ${record.title}`,
        status: "open",
        source_type: "ncmr",
        capa_source: "NCMR",
        ncmr_id: id,
        linked_ncmr_title: record.title,
        problem_description: problemDescription || record.issue_description || record.title,
        root_cause: rootCause,
        corrective_action_plan: correctiveAction,
        action_plan: correctiveAction,
      })
      .select()
      .single();

    if (capaError) {
      alert(capaError.message);
      return;
    }

    const { error: ncmrError } = await supabase
      .from("ncmrs")
      .update({
        capa_id: capaData.id,
        capa_required: true,
      })
      .eq("id", id);

    if (ncmrError) {
      alert(ncmrError.message);
      return;
    }

    await addAuditLog(
      "capa_created_from_ncmr",
      `CAPA created and linked: ${capaData.title}`
    );

    alert("CAPA created and linked to this NCMR.");
    fetchRecord();
  };

  const uploadEvidence = async () => {
    if (!selectedFile) {
      alert("Please choose a file first.");
      return;
    }

    setUploading(true);

    const fileExt = selectedFile.name.split(".").pop();
    const filePath = `ncmrs/${id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("evidence")
      .upload(filePath, selectedFile, { upsert: false });

    if (uploadError) {
      alert(uploadError.message);
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from("evidence").getPublicUrl(filePath);

    setEvidenceUrl(data.publicUrl);
    setUploading(false);
    alert("Evidence uploaded. Click Save Workflow to store it.");
  };

  const saveWorkflow = async () => {
    const payload: any = {
      investigator,
      problem_description: problemDescription,
      containment_action: containmentAction,
      investigation_summary: investigationSummary,
      root_cause: rootCause,
      correction_action_proposal: correctionActionProposal,
      risk_assessment: riskAssessment,
      product_disposition: productDisposition,
      disposition: productDisposition,
      disposition_justification: dispositionJustification,
      corrective_action: correctiveAction,
      correction_implementation: correctionImplementation,
      review_status: reviewStatus,
      evidence_url: evidenceUrl,
      evidence_notes: evidenceNotes,
    };

    if (!record?.investigation_opened_at) {
      payload.investigation_opened_at = new Date().toISOString();
    }

    const { error } = await supabase.from("ncmrs").update(payload).eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await addAuditLog("workflow_saved", "NCMR workflow fields saved.");
    alert("NCMR workflow saved");
    fetchRecord();
  };

  const approveMrb = async () => {
    if (userRole !== "approver") {
      alert("Only an approver can approve MRB disposition.");
      return;
    }

    if (!riskAssessment) return alert("Risk assessment is required before MRB approval.");
    if (!productDisposition) return alert("Product disposition is required before MRB approval.");
    if (!dispositionJustification) return alert("Disposition justification is required before MRB approval.");

    const confirmed = window.confirm(
      "Electronic Signature:\n\nI have reviewed the nonconformance, risk assessment, and proposed disposition, and approve the MRB decision."
    );

    if (!confirmed) return;

    const now = new Date().toISOString();
    const meaning =
      "I have reviewed the nonconformance, risk assessment, and proposed disposition, and approve the MRB decision.";

    const { error } = await supabase
      .from("ncmrs")
      .update({
        product_disposition: productDisposition,
        disposition: productDisposition,
        disposition_justification: dispositionJustification,
        mrb_approved_by: userEmail,
        mrb_approved_at: now,
        mrb_signature_meaning: meaning,
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await addAuditLog("mrb_approved", `MRB approved. Meaning: ${meaning}`);
    alert("MRB approved");
    fetchRecord();
  };

  const markCorrectionImplemented = async () => {
    if (!correctionImplementation) {
      alert("Correction implementation must be documented.");
      return;
    }

    const now = new Date().toISOString();

    const { error } = await supabase
      .from("ncmrs")
      .update({
        correction_implementation: correctionImplementation,
        correction_implemented_by: userEmail,
        correction_implemented_at: now,
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await addAuditLog("correction_implemented", "Correction implementation documented.");
    alert("Correction implementation recorded");
    fetchRecord();
  };

  const closeNcmr = async () => {
    if (userRole !== "approver") return alert("Only an approver can close NCMR.");

    if (!problemDescription) return alert("Problem description is required.");
    if (!containmentAction) return alert("Containment action is required.");
    if (!investigationSummary) return alert("Investigation summary is required.");
    if (!rootCause) return alert("Root cause is required.");
    if (!correctionActionProposal) return alert("Correction / corrective action proposal is required.");
    if (!riskAssessment) return alert("Risk assessment is required.");
    if (!productDisposition) return alert("Product disposition is required.");
    if (!dispositionJustification) return alert("Disposition justification is required.");
    if (!record?.mrb_approved_by) return alert("MRB approval is required before closure.");
    if (!correctionImplementation) return alert("Correction implementation is required.");
    if (!record?.correction_implemented_by) {
      return alert("Correction implementation must be formally recorded before closure.");
    }

    const confirmed = window.confirm(
      "Electronic Signature:\n\nI confirm this NCMR investigation, risk assessment, disposition, MRB approval, correction implementation, and closure review are complete."
    );

    if (!confirmed) return;

    const now = new Date().toISOString();
    const meaning =
      "I confirm this NCMR investigation, risk assessment, disposition, MRB approval, correction implementation, and closure review are complete.";

    const { error } = await supabase
      .from("ncmrs")
      .update({
        status: "closed",
        review_status: "completed",
        closed_at: now,
        ncmr_closed_by: userEmail,
        ncmr_signature_meaning: meaning,
        investigation_completed_at: now,
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await addAuditLog("ncmr_closed_signature", `NCMR closed with e-signature. Meaning: ${meaning}`);
    alert("NCMR closed");
    fetchRecord();
  };

  useEffect(() => {
    if (id) {
      fetchUserRole();
      fetchRecord();
    }
  }, [id]);

  if (loading) {
    return <main style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>Loading...</main>;
  }

  if (!record) {
    return <main style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>Record not found</main>;
  }

  return (
    <main style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>NCMR Controlled Workflow</h1>

      <p><strong>Logged-in:</strong> {userEmail || "none"}</p>
      <p><strong>Role:</strong> {userRole || "none"}</p>

      <div style={{ marginBottom: "20px", padding: "12px", border: "1px solid #ccc" }}>
        <h2>Record Summary</h2>
        <p><strong>Title:</strong> {record.title}</p>
        <p><strong>Issue Description:</strong> {record.issue_description || "N/A"}</p>
        <p><strong>Part Number:</strong> {record.product_part_number || "N/A"}</p>
        <p><strong>Lot Number:</strong> {record.lot_number || "N/A"}</p>
        <p><strong>Work Order:</strong> {record.workorder_number || "N/A"}</p>
        <p><strong>Severity:</strong> {record.severity}</p>
        <p><strong>Status:</strong> {record.status}</p>
        <p><strong>CAPA Required:</strong> {record.capa_required ? "Yes" : "No"}</p>

        {linkedCapa ? (
          <p>
            <strong>Linked CAPA:</strong>{" "}
            <a href={`/capa/${linkedCapa.id}`}>{linkedCapa.title}</a>
          </p>
        ) : (
          <p><strong>Linked CAPA:</strong> None</p>
        )}

        {!linkedCapa ? (
          <button onClick={createCapaFromNcmr}>
            Create CAPA from this NCMR
          </button>
        ) : null}
      </div>

      <section style={{ marginBottom: "20px" }}>
        <h2>1. Initiation</h2>
        <p>This section is created from the NCMR initiation page.</p>
      </section>

      <section style={{ marginBottom: "20px" }}>
        <h2>2. Containment</h2>

        <label>Investigator</label><br />
        <input value={investigator} onChange={(e) => setInvestigator(e.target.value)} style={{ width: "100%", maxWidth: "500px", padding: "8px", marginBottom: "12px" }} />

        <br />
        <label>Problem Description</label><br />
        <textarea value={problemDescription} onChange={(e) => setProblemDescription(e.target.value)} rows={4} style={{ width: "100%", maxWidth: "800px", marginBottom: "12px" }} />

        <br />
        <label>Containment Action</label><br />
        <textarea value={containmentAction} onChange={(e) => setContainmentAction(e.target.value)} rows={4} style={{ width: "100%", maxWidth: "800px" }} />
      </section>

      <section style={{ marginBottom: "20px" }}>
        <h2>3. Investigation / Root Cause</h2>

        <label>Investigation Summary</label><br />
        <textarea value={investigationSummary} onChange={(e) => setInvestigationSummary(e.target.value)} rows={4} style={{ width: "100%", maxWidth: "800px", marginBottom: "12px" }} />

        <br />
        <label>Root Cause</label><br />
        <textarea value={rootCause} onChange={(e) => setRootCause(e.target.value)} rows={4} style={{ width: "100%", maxWidth: "800px" }} />
      </section>

      <section style={{ marginBottom: "20px" }}>
        <h2>4. Correction / Corrective Action Proposal</h2>

        <select value={correctionActionProposal} onChange={(e) => setCorrectionActionProposal(e.target.value)} style={{ padding: "8px", minWidth: "330px" }}>
          <option value="">Select proposal</option>
          <option value="no_correction_required">No correction required</option>
          <option value="immediate_correction_only">Immediate correction only</option>
          <option value="rework">Rework</option>
          <option value="repair">Repair</option>
          <option value="replace">Replace</option>
          <option value="scrap">Scrap</option>
          <option value="return_to_supplier">Return to supplier</option>
          <option value="process_correction">Process correction</option>
          <option value="training_required">Training required</option>
          <option value="procedure_update">Procedure update</option>
          <option value="supplier_corrective_action">Supplier corrective action</option>
          <option value="escalate_to_capa">Escalate to CAPA</option>
        </select>
      </section>

      <section style={{ marginBottom: "20px" }}>
        <h2>5. Risk Assessment</h2>
        <textarea value={riskAssessment} onChange={(e) => setRiskAssessment(e.target.value)} placeholder="Assess product, process, patient/user, regulatory, and quality risk." rows={4} style={{ width: "100%", maxWidth: "800px" }} />
      </section>

      <section style={{ marginBottom: "20px" }}>
        <h2>6. Product Disposition / MRB Decision</h2>

        <label>Product Disposition</label><br />
        <select value={productDisposition} onChange={(e) => setProductDisposition(e.target.value)} style={{ padding: "8px", minWidth: "240px", marginBottom: "12px" }}>
          <option value="">Select disposition</option>
          <option value="use_as_is">Use As Is</option>
          <option value="rework">Rework</option>
          <option value="repair">Repair</option>
          <option value="scrap">Scrap</option>
          <option value="return_to_supplier">Return to Supplier</option>
          <option value="sort_screen">Sort / Screen</option>
          <option value="hold_pending_decision">Hold Pending Decision</option>
        </select>

        <br />
        <label>Disposition Justification</label><br />
        <textarea value={dispositionJustification} onChange={(e) => setDispositionJustification(e.target.value)} placeholder="Justify disposition based on risk assessment and investigation." rows={4} style={{ width: "100%", maxWidth: "800px" }} />

        <div style={{ marginTop: "12px" }}>
          <button onClick={approveMrb}>Approve MRB Decision</button>
        </div>

        {record.mrb_approved_by ? (
          <div style={{ marginTop: "12px" }}>
            <strong>MRB Approved By:</strong> {record.mrb_approved_by}<br />
            <strong>MRB Approved At:</strong> {record.mrb_approved_at}<br />
            <strong>Signature Meaning:</strong> {record.mrb_signature_meaning}
          </div>
        ) : null}
      </section>

      <section style={{ marginBottom: "20px" }}>
        <h2>7. Corrective Action Recommendation</h2>
        <textarea value={correctiveAction} onChange={(e) => setCorrectiveAction(e.target.value)} rows={4} style={{ width: "100%", maxWidth: "800px" }} />
      </section>

      <section style={{ marginBottom: "20px" }}>
        <h2>8. Correction Implementation</h2>

        <textarea value={correctionImplementation} onChange={(e) => setCorrectionImplementation(e.target.value)} placeholder="Describe how the correction was implemented." rows={4} style={{ width: "100%", maxWidth: "800px" }} />

        <div style={{ marginTop: "12px" }}>
          <button onClick={markCorrectionImplemented}>
            Mark Correction Implemented
          </button>
        </div>

        {record.correction_implemented_by ? (
          <div style={{ marginTop: "12px" }}>
            <strong>Implemented By:</strong> {record.correction_implemented_by}<br />
            <strong>Implemented At:</strong> {record.correction_implemented_at}
          </div>
        ) : null}
      </section>

      <section style={{ marginBottom: "20px" }}>
        <h2>9. Evidence</h2>

        <input type="file" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
        <button onClick={uploadEvidence} disabled={uploading} style={{ marginLeft: "10px" }}>
          {uploading ? "Uploading..." : "Upload Evidence"}
        </button>

        <div style={{ marginTop: "12px" }}>
          <label>Evidence URL</label><br />
          <input value={evidenceUrl} onChange={(e) => setEvidenceUrl(e.target.value)} style={{ width: "100%", maxWidth: "800px", padding: "8px" }} />
        </div>

        <div style={{ marginTop: "12px" }}>
          <label>Evidence Notes</label><br />
          <textarea value={evidenceNotes} onChange={(e) => setEvidenceNotes(e.target.value)} rows={3} style={{ width: "100%", maxWidth: "800px" }} />
        </div>

        {record.evidence_url ? (
          <p>
            <strong>Saved Evidence:</strong>{" "}
            <a href={record.evidence_url} target="_blank" rel="noreferrer">
              Open Evidence
            </a>
          </p>
        ) : null}
      </section>

      <section style={{ marginBottom: "20px" }}>
        <h2>10. Closure</h2>

        <label>Review Status</label><br />
        <select value={reviewStatus} onChange={(e) => setReviewStatus(e.target.value)} style={{ padding: "8px", marginBottom: "12px" }}>
          <option value="draft">Draft</option>
          <option value="in_review">In Review</option>
          <option value="completed">Completed</option>
        </select>

        {record.ncmr_closed_by ? (
          <div style={{ marginTop: "12px" }}>
            <strong>NCMR Closed By:</strong> {record.ncmr_closed_by}<br />
            <strong>Closed At:</strong> {record.closed_at}<br />
            <strong>Signature Meaning:</strong> {record.ncmr_signature_meaning}
          </div>
        ) : null}
      </section>

      <button onClick={saveWorkflow} style={{ marginRight: "10px" }}>
        Save Workflow
      </button>

      <button onClick={closeNcmr} style={{ marginRight: "10px" }}>
        Close NCMR with E-Signature
      </button>

      <a href="/ncmrs">Back to NCMRs</a>
    </main>
  );
}
