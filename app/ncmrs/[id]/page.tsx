"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

export default function NcmrDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [record, setRecord] = useState<any>(null);
  const [linkedCapa, setLinkedCapa] = useState<any>(null);
  const [mrbApprovers, setMrbApprovers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState("");

  const [investigator, setInvestigator] = useState("");
  const [problemDescription, setProblemDescription] = useState("");
  const [containmentAction, setContainmentAction] = useState("");
  const [investigationSummary, setInvestigationSummary] = useState("");
  const [rootCause, setRootCause] = useState("");
  const [rootCauseCategory, setRootCauseCategory] = useState("");
  const [rootCauseOptions, setRootCauseOptions] = useState<any[]>([]);
  const [correctionActionProposal, setCorrectionActionProposal] = useState("");
  const [correctiveAction, setCorrectiveAction] = useState("");
  const [riskAssessment, setRiskAssessment] = useState("");
  const [severity, setSeverity] = useState("not_assessed");
  const [capaJustification, setCapaJustification] = useState("");
  const [productDisposition, setProductDisposition] = useState("");
  const [dispositionJustification, setDispositionJustification] = useState("");
  const [correctionImplementation, setCorrectionImplementation] = useState("");
  const [reviewStatus, setReviewStatus] = useState("draft");

  const [mrbSignatureEmail, setMrbSignatureEmail] = useState("");
  const [additionalMrbApprovers, setAdditionalMrbApprovers] = useState("");

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

  const fetchRootCauseOptions = async () => {
    const { data, error } = await supabase
      .from("md_root_cause_categories")
      .select("*")
      .eq("is_active", true)
      .order("label");

    if (error) {
      alert(error.message);
      return;
    }

    setRootCauseOptions(data || []);
  };

  const fetchLinkedCapa = async (capaId: string | null) => {
    if (!capaId) {
      setLinkedCapa(null);
      return;
    }

    const { data } = await supabase
      .from("capas")
      .select("*")
      .eq("id", capaId)
      .maybeSingle();

    setLinkedCapa(data || null);
  };

  const fetchMrbApprovers = async () => {
    const { data, error } = await supabase
      .from("ncmr_mrb_approvers")
      .select("*")
      .eq("ncmr_id", id)
      .order("created_at", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setMrbApprovers(data || []);
  };

  const fetchRecord = async () => {
    const { data, error } = await supabase
      .from("ncmrs")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    if (!data) {
      alert("NCMR record not found.");
      setRecord(null);
      setLoading(false);
      return;
    }

    setRecord(data);
    setInvestigator(data.investigator || "");
    setProblemDescription(data.problem_description || "");
    setContainmentAction(data.containment_action || "");
    setInvestigationSummary(data.investigation_summary || "");
    setRootCause(data.root_cause || "");
    setRootCauseCategory(data.root_cause_category || "");
    setCorrectionActionProposal(data.correction_action_proposal || "");
    setCorrectiveAction(data.corrective_action || "");
    setRiskAssessment(data.risk_assessment || "");
    setSeverity(data.severity || "not_assessed");
    setCapaJustification(data.capa_justification || "");
    setProductDisposition(data.product_disposition || data.disposition || "");
    setDispositionJustification(data.disposition_justification || "");
    setCorrectionImplementation(data.correction_implementation || "");
    setReviewStatus(data.review_status || "draft");
    setMrbSignatureEmail("");
    setAdditionalMrbApprovers(data.mrb_additional_approvers || "");
    setEvidenceUrl(data.evidence_url || "");
    setEvidenceNotes(data.evidence_notes || "");

    await fetchLinkedCapa(data.capa_id || null);
    await fetchMrbApprovers();
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
        problem_description:
          problemDescription || record.issue_description || record.title,
        investigation_summary: investigationSummary,
        root_cause: rootCause,
        root_cause_category: rootCauseCategory,
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
        capa_justification: null,
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
    if (severity === "major" && !record?.capa_id && !capaJustification) {
      alert("For Major severity, CAPA is required OR justification must be provided.");
      return;
    }

    const payload: any = {
      investigator,
      problem_description: problemDescription,
      containment_action: containmentAction,
      investigation_summary: investigationSummary,
      root_cause: rootCause,
      root_cause_category: rootCauseCategory,
      correction_action_proposal: correctionActionProposal,
      corrective_action: correctiveAction,
      risk_assessment: riskAssessment,
      severity,
      capa_justification: capaJustification,
      product_disposition: productDisposition,
      disposition: productDisposition,
      disposition_justification: dispositionJustification,
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

    if (severity === "critical" && !record?.capa_id) {
      const { data: capaData, error: capaError } = await supabase
        .from("capas")
        .insert({
          title: `CAPA for ${record.title}`,
          status: "open",
          source_type: "ncmr",
          capa_source: "Severity-based trigger: critical",
          ncmr_id: id,
          linked_ncmr_title: record.title,
          problem_description:
            problemDescription || record.issue_description || record.title,
          investigation_summary: investigationSummary,
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

      const { error: ncmrUpdateError } = await supabase
        .from("ncmrs")
        .update({
          capa_id: capaData.id,
          capa_required: true,
          capa_justification: null,
        })
        .eq("id", id);

      if (ncmrUpdateError) {
        alert(ncmrUpdateError.message);
        return;
      }

      await addAuditLog(
        "critical_severity_capa_trigger",
        "CAPA automatically created because NCMR severity was assessed as critical."
      );

      alert("NCMR saved. CAPA automatically created because severity is Critical.");
      fetchRecord();
      return;
    }

    if (severity === "major" && !record?.capa_id && capaJustification) {
      await supabase
        .from("ncmrs")
        .update({
          capa_required: false,
          capa_justification: capaJustification,
        })
        .eq("id", id);

      await addAuditLog(
        "major_severity_no_capa_justification",
        `Major severity assessed with no CAPA. Justification: ${capaJustification}`
      );
    }

    if (severity === "major" && record?.capa_id) {
      await supabase
        .from("ncmrs")
        .update({ capa_required: true })
        .eq("id", id);
    }

    alert("NCMR workflow saved");
    fetchRecord();
  };

  const approveMrb = async () => {
    const isApprover = userRole === "approver" || userRole === "vp_quality";
    const isVpQuality = userRole === "vp_quality";

    if (!isApprover) {
      alert("Only an approver or VP Quality can approve MRB disposition.");
      return;
    }

    if (!mrbSignatureEmail) {
      alert("Please re-enter your email before signing MRB approval.");
      return;
    }

    if (mrbSignatureEmail.trim().toLowerCase() !== userEmail.trim().toLowerCase()) {
      alert("Electronic signature email does not match the logged-in user.");
      return;
    }

    if (!riskAssessment) return alert("Risk assessment is required before MRB approval.");
    if (severity === "not_assessed") return alert("Severity must be assessed before MRB approval.");

    if (severity === "major" && !record?.capa_id && !capaJustification) {
      return alert("For Major severity, CAPA is required OR justification must be provided before MRB approval.");
    }

    if (severity === "critical" && !record?.capa_id) {
      return alert("Critical severity requires a linked CAPA before MRB approval. Save workflow first to auto-create CAPA.");
    }

    if (!productDisposition) return alert("Product disposition is required before MRB approval.");
    if (!dispositionJustification) return alert("Disposition justification is required before MRB approval.");

    if (
      (severity === "critical" || severity === "major") &&
      productDisposition === "use_as_is" &&
      !isVpQuality
    ) {
      alert("MRB rule: Use As Is disposition for Major or Critical severity requires VP Quality approval.");
      return;
    }

    if (
      severity === "major" &&
      productDisposition === "use_as_is" &&
      dispositionJustification.trim().length < 50
    ) {
      alert("MRB rule: Major severity with Use As Is requires a stronger disposition justification.");
      return;
    }

    if (
      severity === "critical" &&
      productDisposition === "use_as_is" &&
      dispositionJustification.trim().length < 75
    ) {
      alert("MRB rule: Critical severity with Use As Is requires a detailed VP Quality justification.");
      return;
    }

    const confirmed = window.confirm(
      "Electronic Signature:\n\nI have reviewed the nonconformance, risk assessment, severity, CAPA decision, product disposition, MRB rules, and approve the MRB decision."
    );

    if (!confirmed) return;

    const now = new Date().toISOString();

    const meaning =
      "I have reviewed the nonconformance, risk assessment, severity, CAPA decision, product disposition, MRB rules, and approve the MRB decision.";

    const { error } = await supabase
      .from("ncmrs")
      .update({
        risk_assessment: riskAssessment,
        severity,
        capa_justification: capaJustification,
        product_disposition: productDisposition,
        disposition: productDisposition,
        disposition_justification: dispositionJustification,
        mrb_approved_by: userEmail,
        mrb_approved_at: now,
        mrb_signature_meaning: meaning,
        mrb_signature_email_entered: mrbSignatureEmail,
        mrb_additional_approvers: additionalMrbApprovers,
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    const approverEmails = additionalMrbApprovers
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter((email) => email && email !== userEmail.toLowerCase());

    if (approverEmails.length > 0) {
      const approverRows = approverEmails.map((email) => ({
        ncmr_id: id,
        approver_email: email,
        approver_role: "additional_mrb_approver",
        approval_status: "pending",
        signature_meaning: "Additional MRB approval requested.",
      }));

      const { error: approverError } = await supabase
        .from("ncmr_mrb_approvers")
        .insert(approverRows);

      if (approverError) {
        alert(approverError.message);
        return;
      }
    }

    await addAuditLog(
      "mrb_approved",
      `MRB approved after enhanced e-signature. Severity: ${severity}. Disposition: ${productDisposition}. Approved by role: ${userRole}. Meaning: ${meaning}`
    );

    alert("MRB approved with electronic signature");
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
    if (userRole !== "approver" && userRole !== "vp_quality") {
      return alert("Only an approver or VP Quality can close NCMR.");
    }

    if (!problemDescription) return alert("Problem description is required.");
    if (!containmentAction) return alert("Containment action is required.");
    if (!investigationSummary) return alert("Investigation summary is required.");
    if (!rootCauseCategory) return alert("Root cause category is required.");
    if (!rootCause) return alert("Root cause is required.");
    if (!correctionActionProposal) return alert("Correction / corrective action proposal is required.");
    if (!correctiveAction) return alert("Corrective action recommendation is required.");
    if (!riskAssessment) return alert("Risk assessment is required.");
    if (severity === "not_assessed") return alert("Severity must be assessed.");

    if (severity === "major" && !record?.capa_id && !capaJustification) {
      return alert("For Major severity, CAPA is required OR justification must be provided before closure.");
    }

    if (severity === "critical" && !record?.capa_id) {
      return alert("Critical severity requires a linked CAPA before closure.");
    }

    if (!productDisposition) return alert("Product disposition is required.");
    if (!dispositionJustification) return alert("Disposition justification is required.");
    if (!record?.mrb_approved_by) return alert("MRB approval is required before closure.");
    if (!correctionImplementation) return alert("Correction implementation is required.");

    if (!record?.correction_implemented_by) {
      return alert("Correction implementation must be formally recorded before closure.");
    }

    const confirmed = window.confirm(
      "Electronic Signature:\n\nI confirm this NCMR investigation, risk assessment, severity assessment, CAPA decision, disposition, MRB approval, correction implementation, and closure review are complete."
    );

    if (!confirmed) return;

    const now = new Date().toISOString();
    const meaning =
      "I confirm this NCMR investigation, risk assessment, severity assessment, CAPA decision, disposition, MRB approval, correction implementation, and closure review are complete.";

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

    await addAuditLog(
      "ncmr_closed_signature",
      `NCMR closed with e-signature. Meaning: ${meaning}`
    );

    alert("NCMR closed");
    fetchRecord();
  };

  useEffect(() => {
    if (id) {
      fetchUserRole();
      fetchRecord();
      fetchRootCauseOptions();
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
        <p><strong>Severity:</strong> {record.severity || "not_assessed"}</p>
        <p><strong>CAPA Required:</strong> {record.capa_required ? "Yes" : "No"}</p>
        <p><strong>CAPA Justification:</strong> {record.capa_justification || "N/A"}</p>
        <p><strong>Status:</strong> {record.status}</p>

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
        <input
          value={investigator}
          onChange={(e) => setInvestigator(e.target.value)}
          style={{ width: "100%", maxWidth: "500px", padding: "8px", marginBottom: "12px" }}
        />

        <br />
        <label>Problem Description</label><br />
        <textarea
          value={problemDescription}
          onChange={(e) => setProblemDescription(e.target.value)}
          rows={4}
          style={{ width: "100%", maxWidth: "800px", marginBottom: "12px" }}
        />

        <br />
        <label>Containment Action</label><br />
        <textarea
          value={containmentAction}
          onChange={(e) => setContainmentAction(e.target.value)}
          rows={4}
          style={{ width: "100%", maxWidth: "800px" }}
        />
      </section>

      <section style={{ marginBottom: "20px" }}>
        <h2>3. Investigation / Root Cause</h2>

        <label>Investigation Summary</label><br />
        <textarea
          value={investigationSummary}
          onChange={(e) => setInvestigationSummary(e.target.value)}
          rows={4}
          style={{ width: "100%", maxWidth: "800px", marginBottom: "12px" }}
        />

        <br />
        <label>Root Cause Category</label><br />
        <select
          value={rootCauseCategory}
          onChange={(e) => setRootCauseCategory(e.target.value)}
          style={{ padding: "8px", minWidth: "300px", marginBottom: "12px" }}
        >
          <option value="">Select category</option>
          {rootCauseOptions.map((opt) => (
            <option key={opt.id} value={opt.code}>
              {opt.label}
            </option>
          ))}
        </select>

        <br />
        <label>Root Cause</label><br />
        <textarea
          value={rootCause}
          onChange={(e) => setRootCause(e.target.value)}
          rows={4}
          style={{ width: "100%", maxWidth: "800px" }}
        />
      </section>

      <section style={{ marginBottom: "20px" }}>
        <h2>4. Correction / Corrective Action Proposal</h2>

        <label>Correction / Corrective Action Proposal</label><br />
        <select
          value={correctionActionProposal}
          onChange={(e) => setCorrectionActionProposal(e.target.value)}
          style={{ padding: "8px", minWidth: "330px", marginBottom: "12px" }}
        >
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

        <br />
        <label>Corrective Action Recommendation</label><br />
        <textarea
          value={correctiveAction}
          onChange={(e) => setCorrectiveAction(e.target.value)}
          rows={4}
          style={{ width: "100%", maxWidth: "800px" }}
        />
      </section>

      <section style={{ marginBottom: "20px" }}>
        <h2>5. Risk Assessment</h2>

        <label>Risk Assessment</label><br />
        <textarea
          value={riskAssessment}
          onChange={(e) => setRiskAssessment(e.target.value)}
          placeholder="Assess product, process, patient/user, regulatory, and quality risk."
          rows={4}
          style={{ width: "100%", maxWidth: "800px" }}
        />

        <div style={{ marginTop: "12px" }}>
          <label>Severity</label><br />
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            style={{ padding: "8px", minWidth: "180px" }}
          >
            <option value="not_assessed">Not Assessed</option>
            <option value="minor">Minor</option>
            <option value="major">Major</option>
            <option value="critical">Critical</option>
          </select>
        </div>

        {severity === "major" && !linkedCapa ? (
          <div style={{ marginTop: "12px" }}>
            <label>Justification for No CAPA</label><br />
            <textarea
              value={capaJustification}
              onChange={(e) => setCapaJustification(e.target.value)}
              placeholder="Required if severity is Major and no CAPA is linked."
              rows={3}
              style={{ width: "100%", maxWidth: "800px" }}
            />
          </div>
        ) : null}

        {severity === "critical" && !linkedCapa ? (
          <p style={{ color: "red", marginTop: "12px" }}>
            Critical severity requires CAPA. Save Workflow will automatically create one.
          </p>
        ) : null}
      </section>

      <section style={{ marginBottom: "20px" }}>
        <h2>6. Product Disposition / MRB Decision</h2>

        <label>Product Disposition</label><br />
        <select
          value={productDisposition}
          onChange={(e) => setProductDisposition(e.target.value)}
          style={{ padding: "8px", minWidth: "240px", marginBottom: "12px" }}
        >
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
        <textarea
          value={dispositionJustification}
          onChange={(e) => setDispositionJustification(e.target.value)}
          placeholder="Justify disposition based on risk assessment and investigation."
          rows={4}
          style={{ width: "100%", maxWidth: "800px" }}
        />

        <div style={{ marginTop: "12px" }}>
          <label>Re-enter Your Email for MRB E-Signature</label><br />
          <input
            value={mrbSignatureEmail}
            onChange={(e) => setMrbSignatureEmail(e.target.value)}
            placeholder={userEmail || "your.email@company.com"}
            style={{ width: "100%", maxWidth: "500px", padding: "8px" }}
          />
        </div>

        <div style={{ marginTop: "12px" }}>
          <label>Additional MRB Approvers</label><br />
          <textarea
            value={additionalMrbApprovers}
            onChange={(e) => setAdditionalMrbApprovers(e.target.value)}
            placeholder="Enter comma-separated approver emails"
            rows={3}
            style={{ width: "100%", maxWidth: "800px" }}
          />
        </div>

        <div style={{ marginTop: "12px" }}>
          <button onClick={approveMrb}>Approve MRB Decision</button>
        </div>

        {record.mrb_approved_by ? (
          <div style={{ marginTop: "12px" }}>
            <strong>MRB Approved By:</strong> {record.mrb_approved_by}<br />
            <strong>MRB Approved At:</strong> {record.mrb_approved_at}<br />
            <strong>Signature Email Entered:</strong> {record.mrb_signature_email_entered || "N/A"}<br />
            <strong>Signature Meaning:</strong> {record.mrb_signature_meaning}
          </div>
        ) : null}

        {mrbApprovers.length > 0 ? (
          <div style={{ marginTop: "12px" }}>
            <strong>Additional MRB Approvers:</strong>
            <ul>
              {mrbApprovers.map((approver) => (
                <li key={approver.id}>
                  {approver.approver_email} — {approver.approval_status}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section style={{ marginBottom: "20px" }}>
        <h2>7. Correction Implementation</h2>

        <textarea
          value={correctionImplementation}
          onChange={(e) => setCorrectionImplementation(e.target.value)}
          placeholder="Describe how the correction was implemented."
          rows={4}
          style={{ width: "100%", maxWidth: "800px" }}
        />

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
        <h2>8. Evidence</h2>

        <input
          type="file"
          onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
        />
        <button
          onClick={uploadEvidence}
          disabled={uploading}
          style={{ marginLeft: "10px" }}
        >
          {uploading ? "Uploading..." : "Upload Evidence"}
        </button>

        <div style={{ marginTop: "12px" }}>
          <label>Evidence URL</label><br />
          <input
            value={evidenceUrl}
            onChange={(e) => setEvidenceUrl(e.target.value)}
            style={{ width: "100%", maxWidth: "800px", padding: "8px" }}
          />
        </div>

        <div style={{ marginTop: "12px" }}>
          <label>Evidence Notes</label><br />
          <textarea
            value={evidenceNotes}
            onChange={(e) => setEvidenceNotes(e.target.value)}
            rows={3}
            style={{ width: "100%", maxWidth: "800px" }}
          />
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
        <h2>9. Closure</h2>

        <label>Review Status</label><br />
        <select
          value={reviewStatus}
          onChange={(e) => setReviewStatus(e.target.value)}
          style={{ padding: "8px", marginBottom: "12px" }}
        >
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
