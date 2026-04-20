"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

export default function NcmrDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [record, setRecord] = useState<any>(null);
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
      .eq("id", id)
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
    return <main style={{ padding: "20px" }}>Loading...</main>;
  }

  if (!record) {
    return <main style={{ padding: "20px" }}>Record not found</main>;
  }

  return (
    <main style={{ padding: "20px", fontFamily: "Arial" }}>
      <h1>NCMR Investigation</h1>

      <p><strong>Title:</strong> {record.title}</p>
      <p><strong>Severity:</strong> {record.severity}</p>
      <p><strong>Status:</strong> {record.status}</p>

      <textarea
        placeholder="Problem Description"
        value={problemDescription}
        onChange={(e) => setProblemDescription(e.target.value)}
        rows={3}
        style={{ width: "100%", marginTop: "10px" }}
      />

      <textarea
        placeholder="Containment Action"
        value={containmentAction}
        onChange={(e) => setContainmentAction(e.target.value)}
        rows={3}
        style={{ width: "100%", marginTop: "10px" }}
      />

      <textarea
        placeholder="Investigation Summary"
        value={investigationSummary}
        onChange={(e) => setInvestigationSummary(e.target.value)}
        rows={3}
        style={{ width: "100%", marginTop: "10px" }}
      />

      <textarea
        placeholder="Root Cause"
        value={rootCause}
        onChange={(e) => setRootCause(e.target.value)}
        rows={3}
        style={{ width: "100%", marginTop: "10px" }}
      />

      <textarea
        placeholder="Risk Assessment"
        value={riskAssessment}
        onChange={(e) => setRiskAssessment(e.target.value)}
        rows={3}
        style={{ width: "100%", marginTop: "10px" }}
      />

      <textarea
        placeholder="Corrective Action"
        value={correctiveAction}
        onChange={(e) => setCorrectiveAction(e.target.value)}
        rows={3}
        style={{ width: "100%", marginTop: "10px" }}
      />

      <button onClick={saveInvestigation} style={{ marginTop: "10px" }}>
        Save Investigation
      </button>

      <br /><br />

      <a href="/ncmrs">Back to NCMRs</a>
    </main>
  );
}
