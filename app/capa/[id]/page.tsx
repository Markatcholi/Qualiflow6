"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

export default function CapaDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [record, setRecord] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState("");

  const [owner, setOwner] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [effectivenessDueDate, setEffectivenessDueDate] = useState("");
  const [problemDescription, setProblemDescription] = useState("");
  const [investigationSummary, setInvestigationSummary] = useState("");
  const [rootCause, setRootCause] = useState("");
  const [correctiveActionPlan, setCorrectiveActionPlan] = useState("");
  const [implementationDetails, setImplementationDetails] = useState("");
  const [effectiveness, setEffectiveness] = useState("");

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

  const fetchRecord = async () => {
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
      alert("CAPA not found.");
      setRecord(null);
      setLoading(false);
      return;
    }

    setRecord(data);
    setOwner(data.owner || "");
    setDueDate(data.due_date || "");
    setEffectivenessDueDate(data.effectiveness_due_date || "");
    setProblemDescription(data.problem_description || "");
    setInvestigationSummary(data.investigation_summary || "");
    setRootCause(data.root_cause || "");
    setCorrectiveActionPlan(data.corrective_action_plan || data.action_plan || "");
    setImplementationDetails(data.implementation_details || "");
    setEffectiveness(data.effectiveness_check || "");
    setEvidenceUrl(data.evidence_url || "");
    setEvidenceNotes(data.evidence_notes || "");
    setLoading(false);
  };

  const addAuditLog = async (action: string, details: string) => {
    await supabase.from("audit_logs").insert({
      entity_type: "capa",
      entity_id: id,
      action,
      details,
      user_email: userEmail || "unknown",
    });
  };

  const uploadEvidence = async () => {
    if (!selectedFile) {
      alert("Please choose a file first.");
      return;
    }

    setUploading(true);

    const fileExt = selectedFile.name.split(".").pop();
    const filePath = `capas/${id}/${Date.now()}.${fileExt}`;

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
    alert("Evidence uploaded. Click Save CAPA Workflow to store it.");
  };

  const saveCapaWorkflow = async () => {
    const { error } = await supabase
      .from("capas")
      .update({
        owner,
        due_date: dueDate || null,
        effectiveness_due_date: effectivenessDueDate || null,
        problem_description: problemDescription,
        investigation_summary: investigationSummary,
        root_cause: rootCause,
        corrective_action_plan: correctiveActionPlan,
        action_plan: correctiveActionPlan,
        implementation_details: implementationDetails,
        effectiveness_check: effectiveness,
        evidence_url: evidenceUrl,
        evidence_notes: evidenceNotes,
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await addAuditLog("workflow_saved", "CAPA workflow fields saved.");
    alert("CAPA workflow saved");
    fetchRecord();
  };

  const markImplemented = async () => {
    if (!implementationDetails) {
      alert("Implementation details are required.");
      return;
    }

    if (!effectivenessDueDate) {
      alert("Effectiveness due date is required before marking implementation complete.");
      return;
    }

    const now = new Date().toISOString();

    const { error } = await supabase
      .from("capas")
      .update({
        implementation_details: implementationDetails,
        effectiveness_due_date: effectivenessDueDate,
        implemented_by: userEmail,
        implemented_at: now,
        status: "effectiveness_check",
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await addAuditLog("implemented", "CAPA implementation documented and moved to effectiveness check.");
    alert("CAPA implementation recorded");
    fetchRecord();
  };

  const closeCapa = async () => {
    if (userRole !== "approver" && userRole !== "vp_quality") {
      alert("Only an approver or VP Quality can close CAPA.");
      return;
    }

    if (!problemDescription) return alert("Problem description is required.");
    if (!investigationSummary) return alert("Investigation summary is required.");
    if (!rootCause) return alert("Root cause is required.");
    if (!correctiveActionPlan) return alert("Corrective action plan is required.");
    if (!implementationDetails) return alert("Implementation details are required.");
    if (!record?.implemented_by) return alert("Implementation must be formally recorded before closure.");
    if (!effectivenessDueDate) return alert("Effectiveness due date is required before closure.");
    if (!effectiveness) return alert("Effectiveness check is required before closure.");

    const confirmed = window.confirm(
      "Electronic Signature:\n\nI confirm this CAPA investigation, root cause, corrective action plan, implementation, effectiveness check, and closure review are complete."
    );

    if (!confirmed) return;

    const now = new Date().toISOString();
    const meaning =
      "I confirm this CAPA investigation, root cause, corrective action plan, implementation, effectiveness check, and closure review are complete.";

    const { error } = await supabase
      .from("capas")
      .update({
        status: "closed",
        owner,
        due_date: dueDate || null,
        effectiveness_due_date: effectivenessDueDate || null,
        problem_description: problemDescription,
        investigation_summary: investigationSummary,
        root_cause: rootCause,
        corrective_action_plan: correctiveActionPlan,
        action_plan: correctiveActionPlan,
        implementation_details: implementationDetails,
        effectiveness_check: effectiveness,
        approved_by: userEmail,
        approved_at: now,
        signed_by: userEmail,
        signed_at: now,
        signature_meaning: meaning,
        capa_closed_by: userEmail,
        capa_signature_meaning: meaning,
        closed_at: now,
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await addAuditLog(
      "capa_closed_signature",
      `CAPA closed with e-signature. Meaning: ${meaning}`
    );

    alert("CAPA closed");
    fetchRecord();
  };

  useEffect(() => {
    if (id) {
      fetchUserRole();
      fetchRecord();
    }
  }, [id]);

  if (loading) {
    return <main style={{ padding: "20px" }}>Loading...</main>;
  }

  if (!record) {
    return <main style={{ padding: "20px" }}>CAPA not found</main>;
  }

  return (
    <main style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>CAPA Controlled Workflow</h1>

      <p><strong>Logged-in:</strong> {userEmail || "none"}</p>
      <p><strong>Role:</strong> {userRole || "none"}</p>

      <div style={{ marginBottom: "20px", padding: "12px", border: "1px solid #ccc" }}>
        <h2>Record Summary</h2>
        <p><strong>Title:</strong> {record.title}</p>
        <p><strong>Status:</strong> {record.status}</p>
        <p><strong>Linked NCMR:</strong> {record.linked_ncmr_title || "N/A"}</p>
        <p><strong>Created:</strong> {record.created_at || "N/A"}</p>
        <p><strong>Closed:</strong> {record.closed_at || "Not closed"}</p>
      </div>

      <section style={{ marginBottom: "20px" }}>
        <h2>1. Initiation</h2>

        <label>Owner</label><br />
        <input
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          style={{ padding: "8px", width: "300px", marginBottom: "12px" }}
        />

        <br />
        <label>CAPA Due Date</label><br />
        <input
          type="date"
          value={dueDate || ""}
          onChange={(e) => setDueDate(e.target.value)}
          style={{ padding: "8px", marginBottom: "12px" }}
        />

        <br />
        <label>Problem Description</label><br />
        <textarea
          value={problemDescription}
          onChange={(e) => setProblemDescription(e.target.value)}
          placeholder="Describe why this CAPA was initiated."
          rows={4}
          style={{ width: "100%", maxWidth: "800px" }}
        />
      </section>

      <section style={{ marginBottom: "20px" }}>
        <h2>2. Investigation</h2>

        <label>Investigation Summary</label><br />
        <textarea
          value={investigationSummary}
          onChange={(e) => setInvestigationSummary(e.target.value)}
          placeholder="Summarize investigation activities and findings."
          rows={4}
          style={{ width: "100%", maxWidth: "800px" }}
        />
      </section>

      <section style={{ marginBottom: "20px" }}>
        <h2>3. Root Cause</h2>

        <label>Root Cause</label><br />
        <textarea
          value={rootCause}
          onChange={(e) => setRootCause(e.target.value)}
          placeholder="Document verified root cause."
          rows={4}
          style={{ width: "100%", maxWidth: "800px" }}
        />
      </section>

      <section style={{ marginBottom: "20px" }}>
        <h2>4. Corrective Action Plan</h2>

        <label>Corrective Action Plan</label><br />
        <textarea
          value={correctiveActionPlan}
          onChange={(e) => setCorrectiveActionPlan(e.target.value)}
          placeholder="Define corrective/preventive action plan."
          rows={4}
          style={{ width: "100%", maxWidth: "800px" }}
        />
      </section>

      <section style={{ marginBottom: "20px" }}>
        <h2>5. Implementation</h2>

        <label>Implementation Details</label><br />
        <textarea
          value={implementationDetails}
          onChange={(e) => setImplementationDetails(e.target.value)}
          placeholder="Describe how the corrective action was implemented."
          rows={4}
          style={{ width: "100%", maxWidth: "800px" }}
        />

        <div style={{ marginTop: "12px" }}>
          <label>Effectiveness Due Date</label><br />
          <input
            type="date"
            value={effectivenessDueDate || ""}
            onChange={(e) => setEffectivenessDueDate(e.target.value)}
            style={{ padding: "8px" }}
          />
        </div>

        <div style={{ marginTop: "12px" }}>
          <button onClick={markImplemented}>
            Mark Implementation Complete
          </button>
        </div>

        {record.implemented_by ? (
          <div style={{ marginTop: "12px" }}>
            <strong>Implemented By:</strong> {record.implemented_by}<br />
            <strong>Implemented At:</strong> {record.implemented_at}<br />
            <strong>Effectiveness Due Date:</strong> {record.effectiveness_due_date || "N/A"}
          </div>
        ) : null}
      </section>

      <section style={{ marginBottom: "20px" }}>
        <h2>6. Effectiveness Check</h2>

        <label>Effectiveness Check</label><br />
        <textarea
          value={effectiveness}
          onChange={(e) => setEffectiveness(e.target.value)}
          placeholder="Document effectiveness evidence and conclusion."
          rows={4}
          style={{ width: "100%", maxWidth: "800px" }}
        />
      </section>

      <section style={{ marginBottom: "20px" }}>
        <h2>7. Evidence</h2>

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
            style={{ padding: "8px", width: "100%", maxWidth: "800px" }}
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
        <h2>8. Approval / Closure</h2>

        {record.signed_by ? (
          <div>
            <strong>Electronic Signature:</strong><br />
            Signed by: {record.signed_by}<br />
            Signed at: {record.signed_at}<br />
            Meaning: {record.signature_meaning}
          </div>
        ) : (
          <p>CAPA has not been signed closed.</p>
        )}
      </section>

      <button onClick={saveCapaWorkflow} style={{ marginRight: "10px" }}>
        Save CAPA Workflow
      </button>

      <button onClick={closeCapa} style={{ marginRight: "10px" }}>
        Close CAPA with E-Signature
      </button>

      <a href="/capa">Back to CAPA</a>
    </main>
  );
}
