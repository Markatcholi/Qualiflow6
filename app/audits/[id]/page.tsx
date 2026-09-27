"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import {
  StatusBadge,
  EmptyStateCard,
  FormField,
  standardTextareaStyle,
  primaryButtonStyle,
} from "../../components/workflow/WorkflowComponents";

export default function AuditDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [audit, setAudit] = useState<any>(null);
  const [findings, setFindings] = useState<any[]>([]);
  const [escalationJustifications, setEscalationJustifications] = useState<Record<string, string>>({});
  const [planning, setPlanning] = useState<any>(null);
  const [planningMessage, setPlanningMessage] = useState("");
  const [execution, setExecution] = useState<any>(null);
  const [executionMessage, setExecutionMessage] = useState("");
  const [newFinding, setNewFinding] = useState({
    finding_title: "", finding_description: "", finding_severity: "observation",
    clause_reference: "", evidence: "", finding_owner: "", response_due_date: ""
  });
  const [findingMessage, setFindingMessage] = useState("");

  const fetchData = async () => {
    const tenantId = typeof window !== "undefined"
      ? window.localStorage.getItem("qualisphere_active_tenant_id") || ""
      : "";
    if (!tenantId) {
      setAudit(null);
      setFindings([]);
      return;
    }

    const auditRes = await supabase
      .from("audits")
      .select("*")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    const findingsRes = await supabase
      .from("audit_findings")
      .select("*")
      .eq("audit_id", id)
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true });

    if (auditRes.error) alert(auditRes.error.message);
    if (findingsRes.error) alert(findingsRes.error.message);

    setAudit(auditRes.data);
    setFindings(findingsRes.data || []);

    const map: Record<string, string> = {};
    (findingsRes.data || []).forEach((finding: any) => {
      map[finding.id] = finding.escalation_justification || "";
    });
    setEscalationJustifications(map);
  };

  useEffect(() => {
    if (id) fetchData();
  }, [id]);

  if (!audit) return <main style={{ padding: 20 }}>Loading audit...</main>;

  const isLocked = audit?.is_locked === true;

  const requiresEscalation = (finding: any) => {
    const severity = String(finding.finding_severity || "").toLowerCase();
    return (
      severity.includes("major") ||
      severity.includes("critical") ||
      severity.includes("high") ||
      severity.includes("systemic")
    );
  };

  const saveAuditPlanning = async () => {
    if (isLocked) return alert("This audit is locked and cannot be edited.");
    if (!planning?.audit_title?.trim()) return setPlanningMessage("Audit Title is required.");
    if (!planning?.audit_scope?.trim()) return setPlanningMessage("Audit Scope is required.");
    if (!planning?.audit_objectives?.trim()) return setPlanningMessage("Audit Objectives are required.");
    if (!planning?.audit_criteria?.trim()) return setPlanningMessage("Audit Criteria / Requirements are required.");
    if (!planning?.lead_auditor?.trim()) return setPlanningMessage("Lead Auditor is required.");
    if (!planning?.scheduled_start_date) return setPlanningMessage("Planned Start Date is required.");
    if (planning?.scheduled_end_date && planning.scheduled_end_date < planning.scheduled_start_date) {
      return setPlanningMessage("Planned End Date cannot be before Planned Start Date.");
    }

    setPlanningMessage("");
    const { error } = await supabase.from("audits").update({
      audit_title: planning.audit_title.trim(),
      audit_type: planning.audit_type,
      audit_objectives: planning.audit_objectives.trim(),
      audit_scope: planning.audit_scope.trim(),
      audit_criteria: planning.audit_criteria.trim(),
      lead_auditor: planning.lead_auditor.trim(),
      auditor: planning.lead_auditor.trim(),
      audit_team: planning.audit_team.trim() || null,
      scheduled_start_date: planning.scheduled_start_date,
      scheduled_end_date: planning.scheduled_end_date || null,
      audit_date: planning.scheduled_start_date,
      status: audit.status === "open" ? "planned" : audit.status,
    }).eq("id", id).eq("tenant_id", audit.tenant_id);

    if (error) return setPlanningMessage(error.message);

    await supabase.rpc("qualisphere_add_audit_log", {
      p_entity_type: "audit",
      p_entity_id: id,
      p_action: "audit_planning_saved",
      p_details: "Audit planning completed or updated.",
    });
    setPlanningMessage("Audit Planning saved.");
    await fetchData();
  };

  const saveAuditExecution = async () => {
    if (isLocked) return alert("This audit is locked and cannot be edited.");
    if (!execution?.actual_start_date) return setExecutionMessage("Actual Start Date is required.");
    if (!execution?.execution_notes?.trim()) return setExecutionMessage("Audit Execution Notes are required.");
    if (execution?.actual_end_date && execution.actual_end_date < execution.actual_start_date) {
      return setExecutionMessage("Actual End Date cannot be before Actual Start Date.");
    }

    setExecutionMessage("");
    const nextStatus = execution.actual_end_date ? "execution_complete" : "in_progress";
    const { error } = await supabase.from("audits").update({
      actual_start_date: execution.actual_start_date,
      actual_end_date: execution.actual_end_date || null,
      execution_notes: execution.execution_notes.trim(),
      status: audit.status === "closed" ? "closed" : nextStatus,
    }).eq("id", id).eq("tenant_id", audit.tenant_id);

    if (error) return setExecutionMessage(error.message);

    await supabase.rpc("qualisphere_add_audit_log", {
      p_entity_type: "audit",
      p_entity_id: id,
      p_action: "audit_execution_saved",
      p_details: execution.actual_end_date
        ? "Audit execution completed and documented."
        : "Audit execution started or updated.",
    });
    setExecutionMessage(execution.actual_end_date ? "Audit Execution completed." : "Audit Execution saved as In Progress.");
    await fetchData();
  };

  const addAuditFinding = async () => {
    if (isLocked) return alert("This audit is locked and cannot be edited.");
    if (!newFinding.finding_title.trim()) return setFindingMessage("Finding Title is required.");
    if (!newFinding.finding_description.trim()) return setFindingMessage("Finding Description is required.");
    if (!newFinding.clause_reference.trim()) return setFindingMessage("Requirement / Clause Reference is required.");
    if (!newFinding.evidence.trim()) return setFindingMessage("Objective Evidence is required.");
    if (!newFinding.finding_owner.trim()) return setFindingMessage("Finding Owner is required.");
    if (!newFinding.response_due_date) return setFindingMessage("Response Due Date is required.");

    setFindingMessage("");
    const { data: inserted, error } = await supabase.from("audit_findings").insert({
      tenant_id: audit.tenant_id, audit_id: id,
      finding_title: newFinding.finding_title.trim(),
      finding_description: newFinding.finding_description.trim(),
      finding_severity: newFinding.finding_severity,
      clause_reference: newFinding.clause_reference.trim(),
      evidence: newFinding.evidence.trim(),
      finding_owner: newFinding.finding_owner.trim(),
      response_due_date: newFinding.response_due_date,
      finding_status: "open",
    }).select().single();
    if (error) return setFindingMessage(error.message);

    await supabase.rpc("qualisphere_add_audit_log", {
      p_entity_type:"audit_finding", p_entity_id:inserted.id, p_action:"audit_finding_created",
      p_details:`Audit finding created in ${audit.audit_number || id}. Classification: ${newFinding.finding_severity}.`
    });
    setNewFinding({ finding_title:"", finding_description:"", finding_severity:"observation", clause_reference:"", evidence:"", finding_owner:"", response_due_date:"" });
    setFindingMessage("Finding added.");
    await fetchData();
  };

  const createScarFromFinding = async (finding: any) => {
    if (isLocked) return alert("This audit is locked and cannot be edited.");
    if (finding.linked_scar_id) return alert("This finding already has a linked SCAR.");

    const confirmed = window.confirm(
      "Create a linked SCAR from this audit finding? This will auto-populate the SCAR with audit finding details."
    );
    if (!confirmed) return;

    const { data: userData } = await supabase.auth.getUser();
    const userEmail = userData?.user?.email || "unknown";

    const scarTitle = `SCAR from Audit Finding - ${finding.finding_title || "Finding"}`;

    const description = [
      "SCAR initiated from audit finding.",
      audit.audit_number ? `Audit Number: ${audit.audit_number}` : "",
      audit.audit_title ? `Audit Title: ${audit.audit_title}` : "",
      finding.finding_title ? `Finding: ${finding.finding_title}` : "",
      finding.finding_description ? `Description: ${finding.finding_description}` : "",
      finding.finding_severity ? `Severity: ${finding.finding_severity}` : "",
    ]
      .filter(Boolean)
      .join("\\n");

    const { data: scarData, error: scarError } = await supabase
      .from("scars")
      .insert({
        tenant_id: audit.tenant_id,
        title: scarTitle,
        scar_title: scarTitle,
        status: "open",
        scar_status: "open",
        source_type: "audit_finding",
        source_audit_finding_id: finding.id,
        linked_audit_id: id,
        supplier_id: audit.supplier_id || null,
        linked_supplier_id: audit.supplier_id || null,
        supplier_name: audit.supplier_name || null,
        description,
        issue_summary:
          finding.finding_description ||
          finding.finding_title ||
          "Audit finding requiring supplier corrective action",
        issue_description: description,
        problem_description: description,
        severity: finding.finding_severity || null,
        risk_level: finding.finding_severity || null,
        initiated_by: userEmail,
        initiated_at: new Date().toISOString(),
        created_by: userEmail,
        created_from_module: "audit",
      })
      .select()
      .single();

    if (scarError) return alert(scarError.message);

    const { error: findingUpdateError } = await supabase
      .from("audit_findings")
      .update({
        linked_scar_id: scarData.id,
        scar_evaluation_outcome: "scar_opened",
      })
      .eq("id", finding.id);

    if (findingUpdateError) return alert(findingUpdateError.message);

    await Promise.all([
      supabase.rpc("qualisphere_add_audit_log", {
        p_entity_type: "audit_finding",
        p_entity_id: finding.id,
        p_action: "scar_created_from_audit_finding",
        p_details: `SCAR created from audit finding: ${scarTitle}.`,
      }),
      supabase.rpc("qualisphere_add_audit_log", {
        p_entity_type: "scar",
        p_entity_id: scarData.id,
        p_action: "scar_created_from_audit_finding",
        p_details: `SCAR created from audit finding ${finding.finding_title || finding.id}.`,
      }),
    ]);

    alert("Linked SCAR created.");
    fetchData();
  };

  const createCapaFromFinding = async (finding: any) => {
    if (isLocked) return alert("This audit is locked and cannot be edited.");
    if (finding.linked_capa_id) return alert("This finding already has a linked CAPA.");

    const confirmed = window.confirm(
      "Create a linked CAPA from this audit finding? Use CAPA for systemic, major, critical, or enterprise-level corrective action."
    );
    if (!confirmed) return;

    const { data: userData } = await supabase.auth.getUser();
    const userEmail = userData?.user?.email || "unknown";

    const capaTitle = `CAPA from Audit Finding - ${finding.finding_title || "Finding"}`;

    const description = [
      "CAPA initiated from audit finding.",
      audit.audit_number ? `Audit Number: ${audit.audit_number}` : "",
      audit.audit_title ? `Audit Title: ${audit.audit_title}` : "",
      audit.audit_type ? `Audit Type: ${audit.audit_type}` : "",
      audit.audit_scope ? `Audit Scope: ${audit.audit_scope}` : "",
      finding.finding_title ? `Finding: ${finding.finding_title}` : "",
      finding.finding_description ? `Description: ${finding.finding_description}` : "",
      finding.finding_severity ? `Severity: ${finding.finding_severity}` : "",
    ]
      .filter(Boolean)
      .join("\\n");

    const { data: capaData, error: capaError } = await supabase
      .from("capas")
      .insert({
        tenant_id: audit.tenant_id,
        title: capaTitle,
        problem_statement: finding.finding_title || "Audit finding",
        problem_description: description,
        capa_justification: "CAPA initiated from an audit finding requiring corrective action evaluation.",
        status: "open",
        source_type: "audit",
        capa_source: audit.audit_number || "Audit",
        capa_type: "corrective",
        source_audit_finding_id: finding.id,
        linked_audit_id: id,
        severity: finding.finding_severity || null,
        risk_level: finding.finding_severity || null,
        created_by: userEmail,
      })
      .select()
      .single();

    if (capaError) return alert(capaError.message);

    const { error: findingUpdateError } = await supabase
      .from("audit_findings")
      .update({
        linked_capa_id: capaData.id,
        capa_evaluation_outcome: "capa_opened",
      })
      .eq("id", finding.id);

    if (findingUpdateError) return alert(findingUpdateError.message);

    await Promise.all([
      supabase.rpc("qualisphere_add_audit_log", {
        p_entity_type: "audit_finding",
        p_entity_id: finding.id,
        p_action: "capa_created_from_audit_finding",
        p_details: `CAPA created from audit finding: ${capaTitle}.`,
      }),
      supabase.rpc("qualisphere_add_audit_log", {
        p_entity_type: "capa",
        p_entity_id: capaData.id,
        p_action: "capa_created_from_audit_finding",
        p_details: `CAPA created from audit finding ${finding.finding_title || finding.id}.`,
      }),
    ]);

    alert("Linked CAPA created.");
    fetchData();
  };

  const saveEscalationJustification = async (finding: any) => {
    if (isLocked) return alert("This audit is locked and cannot be edited.");

    const justification = escalationJustifications[finding.id] || "";
    if (!justification.trim()) return alert("Escalation justification is required.");

    const { data: userData } = await supabase.auth.getUser();
    const userEmail = userData?.user?.email || "unknown";

    const { error } = await supabase
      .from("audit_findings")
      .update({
        escalation_justification: justification,
        scar_evaluation_outcome: finding.linked_scar_id
          ? finding.scar_evaluation_outcome
          : "not_opened_with_justification",
        capa_evaluation_outcome: finding.linked_capa_id
          ? finding.capa_evaluation_outcome
          : "not_opened_with_justification",
      })
      .eq("id", finding.id);

    if (error) return alert(error.message);

    await supabase.rpc("qualisphere_add_audit_log", {
      p_entity_type: "audit_finding",
      p_entity_id: finding.id,
      p_action: "audit_finding_escalation_justification_saved",
      p_details: `Escalation justification saved: ${justification}`,
    });

    alert("Escalation justification saved.");
    fetchData();
  };

  const closeAudit = async () => {
    if (isLocked) return alert("This audit is already closed and locked.");

    const openFindings = findings.filter(
      (finding: any) => finding.finding_status !== "closed"
    );

    if (openFindings.length > 0) {
      alert("Cannot close audit while findings remain open.");
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const email = userData?.user?.email || "";

    if (!email) {
      alert("Unable to verify the logged-in user.");
      return;
    }

    const enteredEmail = window.prompt(
      "Electronic Signature Required\\n\\nRe-enter your email to close this audit:"
    );

    if (!enteredEmail) {
      alert("Audit closure cancelled. Email re-entry is required.");
      return;
    }

    if (enteredEmail.trim().toLowerCase() !== email.trim().toLowerCase()) {
      alert("Electronic signature email does not match logged-in user.");
      return;
    }

    const confirmed = window.confirm(
      "Electronic Signature:\\n\\nI confirm this audit has been reviewed, findings have been addressed or appropriately documented, and the audit is approved for closure."
    );

    if (!confirmed) return;

    const now = new Date().toISOString();
    const meaning =
      "I confirm this audit has been reviewed, findings have been addressed or appropriately documented, and the audit is approved for closure.";

    const { error } = await supabase
      .from("audits")
      .update({
        status: "closed",
        closed_at: now,
        closed_by: email,
        signed_by: email,
        signed_at: now,
        signature_email_entered: enteredEmail,
        signature_meaning: meaning,
        is_locked: true,
        locked_at: now,
        locked_by: email,
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    const { error: auditLogError } = await supabase.rpc(
      "qualisphere_add_audit_log",
      {
        p_entity_type: "audit",
        p_entity_id: id,
        p_action: "audit_closed_signature",
        p_details: `Audit closed with e-signature. Meaning: ${meaning}`,
      }
    );

    if (auditLogError) {
      console.warn("Audit closure audit log failed:", auditLogError.message);
    }

    alert("Audit closed and locked successfully.");
    await fetchData();
  };

  return (
    <main style={{ padding: 30, fontFamily: "Arial, sans-serif" }}>
      <div style={{ marginBottom: "16px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
        {!isLocked && (
          <button type="button" onClick={closeAudit} style={primaryButtonStyle}>
            Close Audit
          </button>
        )}

        <button onClick={() => window.open(`/audits/${id}/report`, "_blank")} style={primaryButtonStyle}>
          Audit Report
        </button>

        <Link href="/audits">Back to Audits</Link>
      </div>

      <h1>Audit Workflow</h1>

      {isLocked && (
        <div
          style={{
            padding: "12px",
            background: "#f3f4f6",
            border: "1px solid #9ca3af",
            borderRadius: "8px",
            marginBottom: "16px",
            color: "#374151",
            fontWeight: 600,
          }}
        >
          🔒 This record is locked after electronic signature and cannot be edited.
          <br />
          <span style={{ fontWeight: 400 }}>
            Locked At: {audit.locked_at || "N/A"} | Locked By: {audit.locked_by || "N/A"}
          </span>
        </div>
      )}

      <section style={sectionStyle}>
        <h2 style={{ marginTop: 0 }}>1. Audit Planning</h2>
        <p><strong>Audit Number:</strong> {audit.audit_number}</p>
        <p><strong>Status:</strong> <StatusBadge status={audit.status || "open"} /></p>

        {planning && (
          <>
            <FormField label="Audit Title">
              <input value={planning.audit_title} onChange={(e) => setPlanning({...planning, audit_title:e.target.value})} disabled={isLocked} style={inputStyle} />
            </FormField>
            <FormField label="Audit Type">
              <select value={planning.audit_type} onChange={(e) => setPlanning({...planning, audit_type:e.target.value})} disabled={isLocked} style={inputStyle}>
                <option value="internal_audit">Internal Audit</option>
                <option value="supplier_audit">Supplier Audit</option>
                <option value="process_audit">Process Audit</option>
                <option value="qms_audit">QMS Audit</option>
                <option value="regulatory_audit">Regulatory Audit</option>
              </select>
            </FormField>
            <FormField label="Audit Objectives">
              <textarea value={planning.audit_objectives} onChange={(e) => setPlanning({...planning, audit_objectives:e.target.value})} disabled={isLocked} rows={3} style={standardTextareaStyle} />
            </FormField>
            <FormField label="Audit Scope">
              <textarea value={planning.audit_scope} onChange={(e) => setPlanning({...planning, audit_scope:e.target.value})} disabled={isLocked} rows={3} style={standardTextareaStyle} />
            </FormField>
            <FormField label="Audit Criteria / Requirements">
              <textarea value={planning.audit_criteria} onChange={(e) => setPlanning({...planning, audit_criteria:e.target.value})} disabled={isLocked} rows={3} style={standardTextareaStyle} />
            </FormField>
            <div style={twoColumnStyle}>
              <FormField label="Lead Auditor">
                <input value={planning.lead_auditor} onChange={(e) => setPlanning({...planning, lead_auditor:e.target.value})} disabled={isLocked} style={inputStyle} />
              </FormField>
              <FormField label="Audit Team">
                <input value={planning.audit_team} onChange={(e) => setPlanning({...planning, audit_team:e.target.value})} disabled={isLocked} placeholder="Names or functions" style={inputStyle} />
              </FormField>
              <FormField label="Planned Start Date">
                <input type="date" value={planning.scheduled_start_date} onChange={(e) => setPlanning({...planning, scheduled_start_date:e.target.value})} disabled={isLocked} style={inputStyle} />
              </FormField>
              <FormField label="Planned End Date">
                <input type="date" value={planning.scheduled_end_date} onChange={(e) => setPlanning({...planning, scheduled_end_date:e.target.value})} disabled={isLocked} style={inputStyle} />
              </FormField>
            </div>
            {!isLocked && <button type="button" onClick={saveAuditPlanning} style={primaryButtonStyle}>Save Audit Planning</button>}
            {planningMessage && <p style={{fontWeight:600}}>{planningMessage}</p>}
          </>
        )}
      </section>

      <section style={sectionStyle}>
        <h2 style={{ marginTop: 0 }}>2. Audit Execution</h2>
        <p style={{ color:"#4b5563" }}>
          Document the actual audit activity and the objective evidence reviewed. Findings are recorded in the next section.
        </p>
        {execution && (
          <>
            <div style={twoColumnStyle}>
              <FormField label="Actual Start Date">
                <input type="date" value={execution.actual_start_date} onChange={(e) => setExecution({...execution, actual_start_date:e.target.value})} disabled={isLocked} style={inputStyle} />
              </FormField>
              <FormField label="Actual End Date">
                <input type="date" value={execution.actual_end_date} onChange={(e) => setExecution({...execution, actual_end_date:e.target.value})} disabled={isLocked} style={inputStyle} />
              </FormField>
            </div>
            <FormField label="Audit Execution Notes / Evidence Reviewed">
              <textarea
                value={execution.execution_notes}
                onChange={(e) => setExecution({...execution, execution_notes:e.target.value})}
                disabled={isLocked}
                rows={7}
                placeholder="Document activities performed, areas/processes assessed, records sampled, interviews conducted, and objective evidence reviewed."
                style={standardTextareaStyle}
              />
            </FormField>
            {!isLocked && <button type="button" onClick={saveAuditExecution} style={primaryButtonStyle}>Save Audit Execution</button>}
            {executionMessage && <p style={{fontWeight:600}}>{executionMessage}</p>}
          </>
        )}
      </section>

      <section style={sectionStyle}>
        <h2 style={{ marginTop: 0 }}>3. Findings</h2>
        {!isLocked && (
          <div style={{ border:"1px solid #d1d5db", borderRadius:"10px", padding:"14px", marginBottom:"18px", background:"#f9fafb" }}>
            <h3 style={{marginTop:0}}>Add Audit Finding</h3>
            <FormField label="Finding Title"><input value={newFinding.finding_title} onChange={(e)=>setNewFinding({...newFinding,finding_title:e.target.value})} style={inputStyle}/></FormField>
            <FormField label="Finding Classification">
              <select value={newFinding.finding_severity} onChange={(e)=>setNewFinding({...newFinding,finding_severity:e.target.value})} style={inputStyle}>
                <option value="observation">Observation</option><option value="minor">Minor Finding</option><option value="major">Major Finding</option>
              </select>
            </FormField>
            <FormField label="Finding Description"><textarea value={newFinding.finding_description} onChange={(e)=>setNewFinding({...newFinding,finding_description:e.target.value})} rows={4} style={standardTextareaStyle}/></FormField>
            <FormField label="Requirement / Clause Reference"><input value={newFinding.clause_reference} onChange={(e)=>setNewFinding({...newFinding,clause_reference:e.target.value})} style={inputStyle}/></FormField>
            <FormField label="Objective Evidence"><textarea value={newFinding.evidence} onChange={(e)=>setNewFinding({...newFinding,evidence:e.target.value})} rows={4} style={standardTextareaStyle}/></FormField>
            <div style={twoColumnStyle}>
              <FormField label="Finding Owner"><input value={newFinding.finding_owner} onChange={(e)=>setNewFinding({...newFinding,finding_owner:e.target.value})} style={inputStyle}/></FormField>
              <FormField label="Response Due Date"><input type="date" value={newFinding.response_due_date} onChange={(e)=>setNewFinding({...newFinding,response_due_date:e.target.value})} style={inputStyle}/></FormField>
            </div>
            <button type="button" onClick={addAuditFinding} style={primaryButtonStyle}>Add Finding</button>
            {findingMessage && <p style={{fontWeight:600}}>{findingMessage}</p>}
          </div>
        )}

        {findings.length === 0 ? (
          <EmptyStateCard
            title="No findings"
            message="Audit findings will appear here when they are added to the audit."
          />
        ) : (
          findings.map((f) => (
            <div key={f.id} style={{ border: "1px solid #d1d5db", borderRadius: "10px", padding: "14px", marginBottom: "14px", background: "white" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                <div>
                  <h3 style={{ marginTop: 0 }}>{f.finding_title}</h3>
                  <p><strong>Description:</strong> {f.finding_description}</p>
                  <p><strong>Classification:</strong> <StatusBadge status={f.finding_severity === "observation" ? "Observation" : f.finding_severity === "minor" ? "Minor Finding" : f.finding_severity === "major" ? "Major Finding" : f.finding_severity || "not set"} /></p>
                  <p><strong>Requirement / Clause:</strong> {f.clause_reference || "N/A"}</p>
                  <p><strong>Objective Evidence:</strong> {f.evidence || "N/A"}</p>
                  <p><strong>Finding Owner:</strong> {f.finding_owner || "N/A"}</p>
                  <p><strong>Response Due Date:</strong> {f.response_due_date || "N/A"}</p>
                  <p><strong>Status:</strong> <StatusBadge status={f.finding_status || "open"} /></p>
                </div>

                <div style={{ minWidth: "240px" }}>
                  <p>
                    <strong>Escalation Signal:</strong>{" "}
                    <StatusBadge status={requiresEscalation(f) ? "Evaluation Recommended" : "Evaluate as Needed"} />
                  </p>

                  <p>
                    <strong>SCAR:</strong>{" "}
                    {f.linked_scar_id ? (
                      <Link href={`/supplier-quality/scars/${f.linked_scar_id}`}>Open Linked SCAR</Link>
                    ) : (
                      <span>N/A</span>
                    )}
                  </p>

                  <p>
                    <strong>CAPA:</strong>{" "}
                    {f.linked_capa_id ? (
                      <Link href={`/capa/${f.linked_capa_id}`}>Open Linked CAPA</Link>
                    ) : (
                      <span>N/A</span>
                    )}
                  </p>
                </div>
              </div>

              <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "12px", marginTop: "12px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button type="button" onClick={() => createScarFromFinding(f)} disabled={isLocked || !!f.linked_scar_id}>
                  Create Linked SCAR
                </button>

                <button type="button" onClick={() => createCapaFromFinding(f)} disabled={isLocked || !!f.linked_capa_id}>
                  Create Linked CAPA
                </button>
              </div>

              <div style={{ marginTop: "12px" }}>
                <FormField label="Risk-Based Justification if SCAR/CAPA is Not Opened">
                  <textarea
                    value={escalationJustifications[f.id] || ""}
                    onChange={(e) =>
                      setEscalationJustifications({
                        ...escalationJustifications,
                        [f.id]: e.target.value,
                      })
                    }
                    disabled={isLocked}
                    rows={4}
                    style={standardTextareaStyle}
                  />
                </FormField>

                <button type="button" onClick={() => saveEscalationJustification(f)} disabled={isLocked}>
                  Save Escalation Justification
                </button>
              </div>
            </div>
          ))
        )}
      </section>
    </main>
  );
}

const sectionStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: "10px",
  padding: "14px",
  marginBottom: "20px",
  background: "white",
};

const inputStyle: React.CSSProperties = { width:"100%", maxWidth:"720px", padding:"8px", marginTop:"4px" };
const twoColumnStyle: React.CSSProperties = { display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(260px, 1fr))", gap:"12px" };
