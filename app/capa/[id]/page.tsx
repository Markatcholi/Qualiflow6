"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

export default function CapaDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [record, setRecord] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState("");

  const [owner, setOwner] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [problemDescription, setProblemDescription] = useState("");
  const [investigationSummary, setInvestigationSummary] = useState("");
  const [rootCause, setRootCause] = useState("");
  const [correctiveActionPlan, setCorrectiveActionPlan] = useState("");
  const [implementationDetails, setImplementationDetails] = useState("");
  const [effectiveness, setEffectiveness] = useState("");

  const fetchUserRole = async () => {
    const { data } = await supabase.auth.getUser();
    const email = data?.user?.email || "";
    setUserEmail(email);

    if (!email) return;

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_email", email)
      .maybeSingle();

    setUserRole(roleData?.role || "");
  };

  const fetchRecord = async () => {
    if (!id) return;

    const { data, error } = await supabase
      .from("capas")
      .select("*")
      .eq("id", id)
      .maybeSingle(); // ✅ FIXED

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
    setProblemDescription(data.problem_description || "");
    setInvestigationSummary(data.investigation_summary || "");
    setRootCause(data.root_cause || "");
    setCorrectiveActionPlan(data.corrective_action_plan || data.action_plan || "");
    setImplementationDetails(data.implementation_details || "");
    setEffectiveness(data.effectiveness_check || "");

    setLoading(false);
  };

  const saveCapa = async () => {
    const { error } = await supabase
      .from("capas")
      .update({
        owner,
        due_date: dueDate || null,
        problem_description: problemDescription,
        investigation_summary: investigationSummary,
        root_cause: rootCause,
        corrective_action_plan: correctiveActionPlan,
        action_plan: correctiveActionPlan,
        implementation_details: implementationDetails,
        effectiveness_check: effectiveness,
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    alert("CAPA saved");
    fetchRecord();
  };

  const markImplemented = async () => {
    if (!implementationDetails) {
      alert("Implementation details required");
      return;
    }

    const now = new Date().toISOString();

    const { error } = await supabase
      .from("capas")
      .update({
        implementation_details: implementationDetails,
        implemented_by: userEmail,
        implemented_at: now,
        status: "effectiveness_check",
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Implementation recorded");
    fetchRecord();
  };

  const closeCapa = async () => {
    if (userRole !== "approver") {
      alert("Only an approver can close CAPA.");
      return;
    }

    if (!problemDescription) return alert("Problem description required");
    if (!investigationSummary) return alert("Investigation required");
    if (!rootCause) return alert("Root cause required");
    if (!correctiveActionPlan) return alert("Action plan required");
    if (!implementationDetails) return alert("Implementation required");
    if (!effectiveness) return alert("Effectiveness required");

    const confirmClose = window.confirm(
      "Electronic Signature:\n\nConfirm CAPA closure."
    );

    if (!confirmClose) return;

    const now = new Date().toISOString();

    const { error } = await supabase
      .from("capas")
      .update({
        status: "closed",
        approved_by: userEmail,
        approved_at: now,
        signed_by: userEmail,
        signed_at: now,
        signature_meaning: "CAPA approved and closed",
        closed_at: now,
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    alert("CAPA closed");
    fetchRecord();
  };

  useEffect(() => {
    if (id) {
      fetchUserRole();
      fetchRecord();
    }
  }, [id]);

  if (loading) return <main style={{ padding: 20 }}>Loading...</main>;
  if (!record) return <main style={{ padding: 20 }}>CAPA not found</main>;

  return (
    <main style={{ padding: "20px", fontFamily: "Arial" }}>
      <h1>CAPA Workflow</h1>

      <p><strong>Email:</strong> {userEmail}</p>
      <p><strong>Role:</strong> {userRole}</p>

      <h2>1. Initiation</h2>
      <input
        value={owner}
        onChange={(e) => setOwner(e.target.value)}
        placeholder="Owner"
      /><br /><br />

      <input
        type="date"
        value={dueDate || ""}
        onChange={(e) => setDueDate(e.target.value)}
      /><br /><br />

      <textarea
        value={problemDescription}
        onChange={(e) => setProblemDescription(e.target.value)}
        placeholder="Problem Description"
      />

      <h2>2. Investigation</h2>
      <textarea
        value={investigationSummary}
        onChange={(e) => setInvestigationSummary(e.target.value)}
      />

      <h2>3. Root Cause</h2>
      <textarea
        value={rootCause}
        onChange={(e) => setRootCause(e.target.value)}
      />

      <h2>4. Action Plan</h2>
      <textarea
        value={correctiveActionPlan}
        onChange={(e) => setCorrectiveActionPlan(e.target.value)}
      />

      <h2>5. Implementation</h2>
      <textarea
        value={implementationDetails}
        onChange={(e) => setImplementationDetails(e.target.value)}
      />
      <br />
      <button onClick={markImplemented}>Mark Implemented</button>

      <h2>6. Effectiveness</h2>
      <textarea
        value={effectiveness}
        onChange={(e) => setEffectiveness(e.target.value)}
      />

      <br /><br />
      <button onClick={saveCapa}>Save</button>
      <button onClick={closeCapa} style={{ marginLeft: 10 }}>
        Close CAPA
      </button>

      <br /><br />
      <a href="/capa">Back</a>
    </main>
  );
}
