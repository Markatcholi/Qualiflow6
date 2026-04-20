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
  const [riskAssessment, setRiskAssessment] = useState("");
  const [correctiveAction, setCorrectiveAction] = useState("");
  const [reviewStatus, setReviewStatus] = useState("draft");

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
    setRiskAssessment(data.risk_assessment || "");
    setCorrectiveAction(data.corrective_action || "");
    setReviewStatus(data.review_status || "draft");
    setLoading(false);
  };

  const saveInvestigation = async () => {
    const payload: any = {
      investigator: investigator,
      problem_description: problemDescription,
      containment_action: containmentAction,
      investigation_summary: investigationSummary,
      root_cause: rootCause,
      risk_assessment: riskAssessment,
      corrective_action: correctiveAction,
      review_status: reviewStatus,
    };

    if (!record?.investigation_opened_at) {
      payload.investigation_opened_at = new Date().toISOString();
    }

    if (reviewStatus === "completed" && !record?.investigation_completed_at) {
      payload.investigation_completed_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("ncmrs")
      .update(payload)
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Investigation saved");
    fetchRecord();
  };

  useEffect(() => {
    if (id) {
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
      <h1>NCMR Investigation</h1>

      <div style={{ marginBottom: "20px" }}>
        <p><strong>Title:</strong> {record.title}</p>
        <p><strong>Severity:</strong> {record.severity}</p>
        <p><strong>Owner:</strong> {record.owner}</p>
        <p><strong>Status:</strong> {record.status}</p>
        <p><strong>CAPA Required:</strong> {record.capa_required ? "Yes" : "No"}</p>
        <p><strong>Investigation Opened:</strong> {record.investigation_opened_at || "Not started"}</p>
        <p><strong>Investigation Completed:</strong> {record.investigation_completed_at || "Not completed"}</p>
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label>Investigator</label>
        <br />
        <input
          value={investigator}
          onChange={(e) => setInvestigator(e.target.value)}
          style={{ width: "100%", maxWidth: "500px", padding: "8px" }}
        />
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label>Problem Description</label>
        <br />
        <textarea
          value={problemDescription}
          onChange={(e) => setProblemDescription(e.target.value)}
          rows={4}
          style={{ width: "100%", maxWidth: "800px" }}
        />
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label>Containment Action</label>
        <br />
        <textarea
          value={containmentAction}
          onChange={(e) => setContainmentAction(e.target.value)}
          rows={4}
          style={{ width: "100%", maxWidth: "800px" }}
        />
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label>Investigation Summary</label>
        <br />
        <textarea
          value={investigationSummary}
          onChange={(e) => setInvestigationSummary(e.target.value)}
          rows={4}
          style={{ width: "100%", maxWidth: "800px" }}
        />
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label>Root Cause</label>
        <br />
        <textarea
          value={rootCause}
          onChange={(e) => setRootCause(e.target.value)}
          rows={4}
          style={{ width: "100%", maxWidth: "800px" }}
        />
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label>Risk Assessment</label>
        <br />
        <textarea
          value={riskAssessment}
          onChange={(e) => setRiskAssessment(e.target.value)}
          rows={4}
          style={{ width: "100%", maxWidth: "800px" }}
        />
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label>Corrective Action Recommendation</label>
        <br />
        <textarea
          value={correctiveAction}
          onChange={(e) => setCorrectiveAction(e.target.value)}
          rows={4}
          style={{ width: "100%", maxWidth: "800px" }}
        />
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label>Review Status</label>
        <br />
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

      <a href="/ncmrs">Back to NCMRs</a>
    </main>
  );
}
