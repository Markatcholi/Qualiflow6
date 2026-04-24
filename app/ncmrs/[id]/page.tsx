"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

export default function NcmrDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [record, setRecord] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [investigator, setInvestigator] = useState("");
  const [problemDescription, setProblemDescription] = useState("");
  const [containmentAction, setContainmentAction] = useState("");
  const [investigationSummary, setInvestigationSummary] = useState("");
  const [rootCause, setRootCause] = useState("");
  const [correctionActionProposal, setCorrectionActionProposal] = useState("");
  const [riskAssessment, setRiskAssessment] = useState("");
  const [correctiveAction, setCorrectiveAction] = useState("");
  const [correctionImplementation, setCorrectionImplementation] = useState("");
  const [reviewStatus, setReviewStatus] = useState("draft");

  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [evidenceNotes, setEvidenceNotes] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

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
    setCorrectiveAction(data.corrective_action || "");
    setCorrectionImplementation(data.correction_implementation || "");
    setReviewStatus(data.review_status || "draft");
    setEvidenceUrl(data.evidence_url || "");
    setEvidenceNotes(data.evidence_notes || "");
    setLoading(false);
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
      .upload(filePath, selectedFile, {
        upsert: false,
      });

    if (uploadError) {
      alert(uploadError.message);
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from("evidence").getPublicUrl(filePath);

    setEvidenceUrl(data.publicUrl);
    setUploading(false);
    alert("Evidence uploaded. Click Save Investigation to store it on the record.");
  };

  const saveInvestigation = async () => {
    const payload: any = {
      investigator,
      problem_description: problemDescription,
      containment_action: containmentAction,
      investigation_summary: investigationSummary,
      root_cause: rootCause,
      correction_action_proposal: correctionActionProposal,
      risk_assessment: riskAssessment,
      corrective_action: correctiveAction,
      correction_implementation: correctionImplementation,
      review_status: reviewStatus,
      evidence_url: evidenceUrl,
      evidence_notes: evidenceNotes,
    };

    if (!record?.investigation_opened_at) {
      payload.investigation_opened_at = new Date().toISOString();
    }

    if (reviewStatus === "completed" && !record?.investigation_completed_at) {
      payload.investigation_completed_at = new Date().toISOString();
    }

    const { error } = await supabase.from("ncmrs").update(payload).eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Investigation saved");
    fetchRecord();
  };

  const closeNcmr = async () => {
    if (!problemDescription) {
      alert("Problem description is required before closure.");
      return;
    }

    if (!containmentAction) {
      alert("Containment action is required before closure.");
      return;
    }

    if (!investigationSummary) {
      alert("Investigation summary is required before closure.");
      return;
    }

    if (!rootCause) {
      alert("Root cause is required before closure.");
      return;
    }

    if (!correctionActionProposal) {
      alert("Correction / corrective action proposal is required before closure.");
      return;
    }

    if (!riskAssessment) {
      alert("Risk assessment is required before closure.");
      return;
    }

    if (!correctiveAction) {
      alert("Corrective action recommendation is required before closure.");
      return;
    }

    if (!correctionImplementation) {
      alert("Correction implementation is required before closure.");
      return;
    }

    const confirmClose = window.confirm(
      "Are you sure you want to close this NCMR? This confirms the investigation, risk assessment, correction proposal, and implementation are complete."
    );

    if (!confirmClose) return;

    const now = new Date().toISOString();

    const { error } = await supabase
      .from("ncmrs")
      .update({
        status: "closed",
        closed_at: now,
        review_status: "completed",
        investigator,
        problem_description: problemDescription,
        containment_action: containmentAction,
        investigation_summary: investigationSummary,
        root_cause: rootCause,
        correction_action_proposal: correctionActionProposal,
        risk_assessment: riskAssessment,
        corrective_action: correctiveAction,
        correction_implementation: correctionImplementation,
        investigation_completed_at: now,
        evidence_url: evidenceUrl,
        evidence_notes: evidenceNotes,
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    alert("NCMR closed");
    fetchRecord();
  };

  useEffect(() => {
    if (id) {
      fetchRecord();
    }
  }, [id]);

  if (loading) {
    return (
      <main style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
        Loading...
      </main>
    );
  }

  if (!record) {
    return (
      <main style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
        Record not found
      </main>
    );
  }

  return (
    <main style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>NCMR Investigation Workflow</h1>

      <div style={{ marginBottom: "20px" }}>
        <p><strong>Title:</strong> {record.title}</p>
        <p><strong>Severity:</strong> {record.severity}</p>
        <p><strong>Owner:</strong> {record.owner}</p>
        <p><strong>Status:</strong> {record.status}</p>
        <p><strong>CAPA Required:</strong> {record.capa_required ? "Yes" : "No"}</p>
        <p><strong>Investigation Opened:</strong> {record.investigation_opened_at || "Not started"}</p>
        <p><strong>Investigation Completed:</strong> {record.investigation_completed_at || "Not completed"}</p>
      </div>

      <h2>1. Containment</h2>

      <div style={{ marginBottom: "12px" }}>
        <label>Investigator</label><br />
        <input
          value={investigator}
          onChange={(e) => setInvestigator(e.target.value)}
          style={{ width: "100%", maxWidth: "500px", padding: "8px" }}
        />
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label>Problem Description</label><br />
        <textarea
          value={problemDescription}
          onChange={(e) => setProblemDescription(e.target.value)}
          rows={4}
          style={{ width: "100%", maxWidth: "800px" }}
        />
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label>Containment Action</label><br />
        <textarea
          value={containmentAction}
          onChange={(e) => setContainmentAction(e.target.value)}
          rows={4}
          style={{ width: "100%", maxWidth: "800px" }}
        />
      </div>

      <h2>2. Investigation</h2>

      <div style={{ marginBottom: "12px" }}>
        <label>Investigation Summary</label><br />
        <textarea
          value={investigationSummary}
          onChange={(e) => setInvestigationSummary(e.target.value)}
          rows={4}
          style={{ width: "100%", maxWidth: "800px" }}
        />
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label>Root Cause</label><br />
        <textarea
          value={rootCause}
          onChange={(e) => setRootCause(e.target.value)}
          rows={4}
          style={{ width: "100%", maxWidth: "800px" }}
        />
      </div>

      <h2>3. Correction / Corrective Action Proposal</h2>

      <div style={{ marginBottom: "12px" }}>
        <label>Correction / Corrective Action Proposal</label><br />
        <select
          value={correctionActionProposal}
          onChange={(e) => setCorrectionActionProposal(e.target.value)}
          style={{ padding: "8px", minWidth: "320px" }}
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
      </div>

      <h2>4. Risk Assessment</h2>

      <div style={{ marginBottom: "12px" }}>
        <label>Risk Assessment</label><br />
        <textarea
          value={riskAssessment}
          onChange={(e) => setRiskAssessment(e.target.value)}
          rows={4}
          style={{ width: "100%", maxWidth: "800px" }}
        />
      </div>

      <h2>5. Product Disposition / Corrective Action</h2>

      <div style={{ marginBottom: "12px" }}>
        <label>Corrective Action Recommendation</label><br />
        <textarea
          value={correctiveAction}
          onChange={(e) => setCorrectiveAction(e.target.value)}
          rows={4}
          style={{ width: "100%", maxWidth: "800px" }}
        />
      </div>

      <h2>6. Correction Implementation</h2>

      <div style={{ marginBottom: "12px" }}>
        <label>Correction Implementation</label><br />
        <textarea
          value={correctionImplementation}
          onChange={(e) => setCorrectionImplementation(e.target.value)}
          placeholder="Describe how the correction was implemented"
          rows={4}
          style={{ width: "100%", maxWidth: "800px" }}
        />
      </div>

      <h2>7. Evidence</h2>

      <div style={{ marginBottom: "12px" }}>
        <label>Upload Evidence File</label><br />
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
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label>Evidence URL</label><br />
        <input
          value={evidenceUrl}
          onChange={(e) => setEvidenceUrl(e.target.value)}
          placeholder="Uploaded file URL will appear here"
          style={{ width: "100%", maxWidth: "800px", padding: "8px" }}
        />
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label>Evidence Notes</label><br />
        <textarea
          value={evidenceNotes}
          onChange={(e) => setEvidenceNotes(e.target.value)}
          rows={3}
          style={{ width: "100%", maxWidth: "800px" }}
        />
      </div>

      {record.evidence_url ? (
        <div style={{ marginBottom: "12px" }}>
          <strong>Saved Evidence:</strong>{" "}
          <a href={record.evidence_url} target="_blank" rel="noreferrer">
            Open Evidence
          </a>
        </div>
      ) : null}

      <h2>8. Review / Closure</h2>

      <div style={{ marginBottom: "12px" }}>
        <label>Review Status</label><br />
        <select
          value={reviewStatus}
          onChange={(e) => setReviewStatus(e.target.value)}
          style={{ padding: "8px" }}
        >
          <option value="draft">Draft</option>
          <option value="in_review">In Review</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      <button onClick={saveInvestigation} style={{ marginRight: "10px" }}>
        Save Investigation
      </button>

      <button onClick={closeNcmr} style={{ marginRight: "10px" }}>
        Close NCMR
      </button>

      <a href="/ncmrs">Back to NCMRs</a>
    </main>
  );
}
