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
  const [rootCauseCategory, setRootCauseCategory] = useState("");
  const [rootCauseOptions, setRootCauseOptions] = useState<any[]>([]);
  const [correctiveActionPlan, setCorrectiveActionPlan] = useState("");
  const [implementationDetails, setImplementationDetails] = useState("");
  const [effectiveness, setEffectiveness] = useState("");
  const [effectivenessRating, setEffectivenessRating] = useState("");
  const [effectivenessFollowupAction, setEffectivenessFollowupAction] = useState("");

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
    setRootCauseCategory(data.root_cause_category || "");
    setCorrectiveActionPlan(data.corrective_action_plan || data.action_plan || "");
    setImplementationDetails(data.implementation_details || "");
    setEffectiveness(data.effectiveness_check || "");
    setEffectivenessRating(data.effectiveness_rating || "");
    setEffectivenessFollowupAction(data.effectiveness_followup_action || "");
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
        root_cause_category: rootCauseCategory,
        corrective_action_plan: correctiveActionPlan,
        action_plan: correctiveActionPlan,
        implementation_details: implementationDetails,
        effectiveness_check: effectiveness,
        effectiveness_rating: effectivenessRating,
        effectiveness_followup_action: effectivenessFollowupAction,
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

  const createFollowupCapa = async () => {
    if (record?.followup_capa_id) {
      alert("A follow-up CAPA already exists.");
      return;
    }

    const { data: followup, error } = await supabase
      .from("capas")
      .insert({
        title: `Follow-up CAPA for ineffective action: ${record.title}`,
        status: "open",
        source_type: "capa_effectiveness",
        capa_source: "Ineffective CAPA",
        problem_description: `Original CAPA was rated Not Effective. Original CAPA: ${record.title}`,
        investigation_summary: effectiveness,
        root_cause: rootCause,
        root_cause_category: rootCauseCategory,
        corrective_action_plan: effectivenessFollowupAction,
        action_plan: effectivenessFollowupAction,
        linked_ncmr_title: record.linked_ncmr_title || null,
        ncmr_id: record.ncmr_id || null,
      })
      .select()
      .single();

    if (error) {
      alert(error.message);
      return;
    }

    const { error: updateError } = await supabase
      .from("capas")
      .update({
        followup_capa_id: followup.id,
        effectiveness_followup_action: effectivenessFollowupAction,
      })
      .eq("id", id);

    if (updateError) {
      alert(updateError.message);
      return;
    }

    await addAuditLog(
      "followup_capa_created",
      `Follow-up CAPA created because effectiveness rating was Not Effective. Follow-up CAPA ID: ${followup.id}`
    );

    alert("Follow-up CAPA created.");
    fetchRecord();
  };

  const closeCapa = async () => {
    if (userRole !== "approver" && userRole !== "vp_quality") {
      alert("Only an approver or VP Quality can close CAPA.");
      return;
    }

    if (!problemDescription) return alert("Problem description is required.");
    if (!investigationSummary) return alert("Investigation summary is required.");
    if (!rootCauseCategory) return alert("Root cause category is required.");
    if (!rootCause) return alert("Root cause is required.");
    if (!correctiveActionPlan) return alert("Corrective action plan is required.");
    if (!implementationDetails) return alert("Implementation details are required.");
    if (!record?.implemented_by) return alert("Implementation must be formally recorded before closure.");
    if (!effectivenessDueDate) return alert("Effectiveness due date is required before closure.");
    if (!effectiveness) return alert("Effectiveness check is required before closure.");
    if (!effectivenessRating) return alert("Effectiveness rating is required before closure.");

    if (effectivenessRating === "partially_effective" && !effectivenessFollowupAction) {
      return alert("Partially Effective requires a follow-up action.");
    }

    if (effectivenessRating === "not_effective") {
      if (!effectivenessFollowupAction) {
        return alert("Not Effective requires a follow-up action.");
      }

      if (!record?.followup_capa_id) {
        await createFollowupCapa();
        return alert("Follow-up CAPA was created. Review it before closing the original CAPA.");
      }
    }

    const confirmed = window.confirm(
      "Electronic Signature:\n\nI confirm this CAPA investigation, root cause, corrective action plan, implementation, effectiveness check, effectiveness rating, and closure review are complete."
    );

    if (!confirmed) return;

    const now = new Date().toISOString();
    const meaning =
      "I confirm this CAPA investigation, root cause, corrective action plan, implementation, effectiveness check, effectiveness rating, and closure review are complete.";

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
        root_cause_category: rootCauseCategory,
        corrective_action_plan: correctiveActionPlan,
        action_plan: correctiveActionPlan,
        implementation_details: implementationDetails,
        effectiveness_check: effectiveness,
        effectiveness_rating: effectivenessRating,
        effectiveness_followup_action: effectivenessFollowupAction,
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
      `CAPA closed with e-signature. Effectiveness rating: ${effectivenessRating}. Meaning: ${meaning}`
    );

    alert("CAPA closed");
    fetchRecord();
  };

  useEffect(() => {
    if (id) {
      fetchUserRole();
      fetchRecord();
      fetchRootCauseOptions();
    }
  }, [id]);

  if (loading) return <main style={{ padding: "20px" }}>Loading...</main>;
  if (!record) return <main style={{ padding: "20px" }}>CAPA not found</main>;

  return (
    <main style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>CAPA Controlled Workflow</h1>
      <button
  onClick={() => window.open(`/capa/${id}/report`, "_blank")}
>
  📄 <button
  onClick={() => window.open(`/capa/${id}/report`, "_blank")}
>
  CAPA Report
</button>
</button>

      <p><strong>Logged-in:</strong> {userEmail || "none"}</p>
      <p><strong>Role:</strong> {userRole || "none"}</p>

      <div style={{ marginBottom: "20px", padding: "12px", border: "1px solid #ccc" }}>
        <h2>Record Summary</h2>
        <p><strong>Title:</strong> {record.title}</p>
        <p><strong>Status:</strong> {record.status}</p>
        <p><strong>Linked NCMR:</strong> {record.linked_ncmr_title || "N/A"}</p>
        <p><strong>Effectiveness Rating:</strong> {record.effectiveness_rating || "Not rated"}</p>
        {record.followup_capa_id ? (
          <p>
            <strong>Follow-up CAPA:</strong>{" "}
            <a href={`/capa/${record.followup_capa_id}`}>Open Follow-up CAPA</a>
          </p>
        ) : null}
      </div>

      <section style={{ marginBottom: "20px" }}>
        <h2>1. Initiation</h2>

        <label>Owner</label><br />
        <input value={owner} onChange={(e) => setOwner(e.target.value)} style={{ padding: "8px", width: "300px", marginBottom: "12px" }} />

        <br />
        <label>CAPA Due Date</label><br />
        <input type="date" value={dueDate || ""} onChange={(e) => setDueDate(e.target.value)} style={{ padding: "8px", marginBottom: "12px" }} />

        <br />
        <label>Problem Description</label><br />
        <textarea value={problemDescription} onChange={(e) => setProblemDescription(e.target.value)} rows={4} style={{ width: "100%", maxWidth: "800px" }} />
      </section>

      <section style={{ marginBottom: "20px" }}>
        <h2>2. Investigation</h2>
        <textarea value={investigationSummary} onChange={(e) => setInvestigationSummary(e.target.value)} rows={4} style={{ width: "100%", maxWidth: "800px" }} />
      </section>

      <section style={{ marginBottom: "20px" }}>
        <h2>3. Root Cause</h2>

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
        <textarea value={rootCause} onChange={(e) => setRootCause(e.target.value)} rows={4} style={{ width: "100%", maxWidth: "800px" }} />
      </section>

      <section style={{ marginBottom: "20px" }}>
        <h2>4. Corrective Action Plan</h2>
        <textarea value={correctiveActionPlan} onChange={(e) => setCorrectiveActionPlan(e.target.value)} rows={4} style={{ width: "100%", maxWidth: "800px" }} />
      </section>

      <section style={{ marginBottom: "20px" }}>
        <h2>5. Implementation</h2>

        <textarea value={implementationDetails} onChange={(e) => setImplementationDetails(e.target.value)} rows={4} style={{ width: "100%", maxWidth: "800px" }} />

        <div style={{ marginTop: "12px" }}>
          <label>Effectiveness Due Date</label><br />
          <input type="date" value={effectivenessDueDate || ""} onChange={(e) => setEffectivenessDueDate(e.target.value)} style={{ padding: "8px" }} />
        </div>

        <div style={{ marginTop: "12px" }}>
          <button onClick={markImplemented}>Mark Implementation Complete</button>
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
        <textarea value={effectiveness} onChange={(e) => setEffectiveness(e.target.value)} rows={4} style={{ width: "100%", maxWidth: "800px" }} />

        <div style={{ marginTop: "12px" }}>
          <label>Effectiveness Rating</label><br />
          <select
            value={effectivenessRating}
            onChange={(e) => setEffectivenessRating(e.target.value)}
            style={{ padding: "8px", minWidth: "240px" }}
          >
            <option value="">Select rating</option>
            <option value="effective">Effective</option>
            <option value="partially_effective">Partially Effective</option>
            <option value="not_effective">Not Effective</option>
          </select>
        </div>

        {(effectivenessRating === "partially_effective" || effectivenessRating === "not_effective") ? (
          <div style={{ marginTop: "12px" }}>
            <label>Follow-up Action</label><br />
            <textarea
              value={effectivenessFollowupAction}
              onChange={(e) => setEffectivenessFollowupAction(e.target.value)}
              placeholder="Required for Partially Effective or Not Effective."
              rows={3}
              style={{ width: "100%", maxWidth: "800px" }}
            />
          </div>
        ) : null}

        {effectivenessRating === "not_effective" && !record.followup_capa_id ? (
          <div style={{ marginTop: "12px" }}>
            <button onClick={createFollowupCapa}>
              Create Follow-up CAPA
            </button>
          </div>
        ) : null}
      </section>

      <section style={{ marginBottom: "20px" }}>
        <h2>7. Approval / Closure</h2>

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
