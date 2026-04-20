"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type NcmrDetail = {
  id: string;
  title: string | null;
  severity: string | null;
  owner: string | null;
  status: string | null;
  capa_required: boolean | null;
  problem_description: string | null;
  containment_action: string | null;
  investigation_summary: string | null;
  root_cause: string | null;
  risk_assessment: string | null;
  corrective_action: string | null;
};

export default function NcmrDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [record, setRecord] = useState<NcmrDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const [problemDescription, setProblemDescription] = useState("");
  const [containmentAction, setContainmentAction] = useState("");
  const [investigationSummary, setInvestigationSummary] = useState("");
  const [rootCause, setRootCause] = useState("");
  const [riskAssessment, setRiskAssessment] = useState("");
  const [correctiveAction, setCorrectiveAction] = useState("");

  const fetchRecord = async () => {
    const { data, error } = await supabase
      .from("ncmrs")
      .select("*")
      .eq("id", params.id)
      .single();

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setRecord(data);
    setProblemDescription(data.problem_description || "");
    setContainmentAction(data.containment_action || "");
    setInvestigationSummary(data.investigation_summary || "");
    setRootCause(data.root_cause || "");
    setRiskAssessment(data.risk_assessment || "");
    setCorrectiveAction(data.corrective_action || "");
    setLoading(false);
  };

  const saveInvestigation = async () => {
    const { error } = await supabase
      .from("ncmrs")
      .update({
        problem_description: problemDescription,
        containment_action: containmentAction,
        investigation_summary: investigationSummary,
        root_cause: rootCause,
        risk_assessment: riskAssessment,
        corrective_action: correctiveAction,
      })
      .eq("id", params.id);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Investigation saved");
    fetchRecord();
  };

  useEffect(() => {
    fetchRecord();
  }, []);

  if (loading) {
    return <main style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>Loading...</main>;
  }

  if (!record) {
    return <main style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>Record not found.</main>;
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

      <button onClick={saveInvestigation} style={{ marginRight: "10px" }}>
        Save Investigation
      </button>

      <a href="/ncmrs">Back to NCMRs</a>
    </main>
  );
}
