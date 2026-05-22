"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type WorkflowStage = {
  key: string;
  label: string;
  completed: boolean;
  locked?: boolean;
  status?: string;
};

export default function EnterpriseCapaWorkflowPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [record, setRecord] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState("");
  const [activeSection, setActiveSection] = useState("intake");
  const [expandedSections, setExpandedSections] = useState<string[]>(["intake"]);

  const openSection = (key: string) => {
    setActiveSection(key);
    setExpandedSections((prev) =>
      prev.includes(key) ? prev : [...prev, key]
    );
  };

  const toggleSection = (key: string) => {
    setActiveSection(key);
    setExpandedSections((prev) =>
      prev.includes(key)
        ? prev.filter((section) => section !== key)
        : [...prev, key]
    );
  };

  const [investigationApprovalComments, setInvestigationApprovalComments] = useState("");
  const [closureApprovalComments, setClosureApprovalComments] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [cancellationJustification, setCancellationJustification] = useState("");

  const isLocked =
    record?.is_locked === true ||
    record?.status === "closed" ||
    record?.status === "cancelled";

  const investigationApproved =
    record?.investigation_approval_status === "approved";

  const closureApproved = record?.closure_approval_status === "approved";
  const implementationLocked = !investigationApproved || isLocked;
  const canApprove = userRole === "approver" || userRole === "vp_quality";

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
    setLoading(true);

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

    setRecord(data || null);
    setInvestigationApprovalComments(
      data?.investigation_approval_comments ||
        data?.investigation_rejection_comments ||
        ""
    );
    setClosureApprovalComments(
      data?.closure_approval_comments || data?.closure_rejection_comments || ""
    );
    setCancelReason(data?.cancel_reason || "");
    setCancellationJustification(data?.cancellation_justification || "");
    setLoading(false);
  };

  useEffect(() => {
    if (id) {
      fetchUserRole();
      fetchRecord();
    }
  }, [id]);

  const addAuditLog = async (action: string, details: string) => {
    await supabase.from("audit_logs").insert({
      entity_type: "capa",
      entity_id: id,
      action,
      details,
      user_email: userEmail || "unknown",
    });
  };

  const updateField = (field: string, value: any) => {
    if (isLocked) {
      alert("This CAPA record is locked and cannot be edited.");
      return;
    }

    setRecord((prev: any) => ({
      ...prev,
      [field]: value,
    }));
  };

  const saveField = async (field: string, value: any) => {
    if (isLocked) return;

    const { error } = await supabase
      .from("capas")
      .update({ [field]: value || null })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await addAuditLog("field_saved", `CAPA field saved: ${field}`);
  };

  const saveAll = async () => {
    if (isLocked) {
      alert("This CAPA record is locked and cannot be edited.");
      return;
    }

    const { error } = await supabase
      .from("capas")
      .update({
        problem_description: record.problem_description || null,
        scope_summary: record.scope_summary || null,
        affected_product: record.affected_product || null,
        affected_lot: record.affected_lot || null,
        affected_process: record.affected_process || null,
        affected_supplier: record.affected_supplier || null,
        potential_impact: record.potential_impact || null,

        containment_action: record.containment_action || null,
        containment_owner: record.containment_owner || null,
        containment_complete: record.containment_complete || null,
        containment_residual_risk: record.containment_residual_risk || null,

        investigation_objective: record.investigation_objective || null,
        evidence_reviewed: record.evidence_reviewed || null,
        investigation_findings: record.investigation_findings || null,
        investigation_summary:
          record.investigation_findings || record.investigation_summary || null,
        investigation_conclusion: record.investigation_conclusion || null,

        root_cause_method: record.root_cause_method || null,
        root_cause: record.root_cause || null,
        contributing_factors: record.contributing_factors || null,
        root_cause_verification: record.root_cause_verification || null,
        systemic_impact: record.systemic_impact || null,

        severity: record.severity || null,
        occurrence_rating: record.occurrence_rating || null,
        detection_rating: record.detection_rating || null,
        risk_level: record.risk_level || null,
        patient_safety_impact: record.patient_safety_impact || null,
        product_quality_impact: record.product_quality_impact || null,
        regulatory_impact: record.regulatory_impact || null,
        risk_rationale: record.risk_rationale || null,
        risk_assessment: record.risk_rationale || record.risk_assessment || null,
        capa_classification: record.capa_classification || null,

        corrective_action_plan: record.corrective_action_plan || null,
        action_plan: record.corrective_action_plan || null,
        corrective_action: record.corrective_action_plan || null,
        action_owner: record.action_owner || null,
        action_due_date: record.action_due_date || null,
        verification_method: record.verification_method || null,

        procedure_updated: record.procedure_updated || null,
        training_required: record.training_required || null,
        validation_required: record.validation_required || null,
        implementation_details: record.implementation_details || null,
        implementation: record.implementation_details || null,
        implementation_evidence: record.implementation_evidence || null,

        monitoring_method: record.monitoring_method || null,
        monitoring_period: record.monitoring_period || null,
        effectiveness_plan: record.monitoring_method || record.effectiveness_plan || null,
        effectiveness_check: record.effectiveness_check || null,
        effectiveness_rating: record.effectiveness_rating || null,
        effectiveness_result: record.effectiveness_rating || null,
        recurrence_detected: record.recurrence_detected || null,
        followup_capa_required: record.followup_capa_required || null,
        effectiveness_followup_action: record.effectiveness_followup_action || null,
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await addAuditLog("workflow_saved", "CAPA guided workflow saved.");
    alert("CAPA workflow saved.");
    fetchRecord();
  };

  const submitInvestigationApproval = async () => {
    if (isLocked) return;

    if (!record?.problem_description) return alert("Intake issue summary is required.");
    if (!record?.scope_summary) return alert("Scope summary is required.");
    if (!record?.containment_action) return alert("Containment action is required.");
    if (!record?.investigation_findings && !record?.investigation_summary) {
      return alert("Investigation findings are required.");
    }
    if (!record?.root_cause) return alert("Root cause is required.");
    if (!record?.severity) return alert("Severity is required.");
    if (!record?.risk_level) return alert("Risk level is required.");
    if (!record?.risk_rationale && !record?.risk_assessment) {
      return alert("Risk rationale is required.");
    }

    await saveAll();

    const now = new Date().toISOString();

    const { error } = await supabase
      .from("capas")
      .update({
        investigation_approval_status: "pending",
        investigation_submitted_by: userEmail || "unknown",
        investigation_submitted_at: now,
        status: "pending_investigation_approval",
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await addAuditLog(
      "investigation_submitted_for_approval",
      "CAPA investigation, root cause, and risk assessment submitted for approval."
    );

    alert("Investigation package submitted for approval.");
    fetchRecord();
  };

  const approveInvestigation = async () => {
    if (!canApprove) {
      alert("Only an approver or VP Quality can approve investigation.");
      return;
    }

    const confirmed = window.confirm(
      "Approve Investigation Package?\n\nThis confirms scope, containment, investigation, root cause, and risk/severity are adequate before corrective action implementation begins."
    );

    if (!confirmed) return;

    const now = new Date().toISOString();

    const { error } = await supabase
      .from("capas")
      .update({
        investigation_approval_status: "approved",
        investigation_approved_by: userEmail,
        investigation_approved_at: now,
        investigation_approval_comments: investigationApprovalComments || null,
        status: "implementation",
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await addAuditLog(
      "investigation_approved",
      "CAPA investigation package approved. Corrective action and implementation phases unlocked."
    );

    alert("Investigation package approved.");
    fetchRecord();
  };

  const rejectInvestigation = async () => {
    if (!canApprove) {
      alert("Only an approver or VP Quality can reject investigation.");
      return;
    }

    if (!investigationApprovalComments.trim()) {
      alert("Rejection comments are required.");
      return;
    }

    const confirmed = window.confirm("Reject investigation package and return for revision?");
    if (!confirmed) return;

    const now = new Date().toISOString();

    const { error } = await supabase
      .from("capas")
      .update({
        investigation_approval_status: "rejected",
        investigation_rejected_by: userEmail,
        investigation_rejected_at: now,
        investigation_rejection_comments: investigationApprovalComments,
        status: "investigation",
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await addAuditLog(
      "investigation_rejected",
      `CAPA investigation package rejected. Comments: ${investigationApprovalComments}`
    );

    alert("Investigation package rejected.");
    fetchRecord();
  };

  const markImplemented = async () => {
    if (implementationLocked) {
      alert("Corrective action and implementation are locked until investigation approval is complete.");
      return;
    }

    if (!record?.corrective_action_plan) return alert("Corrective action is required.");
    if (!record?.implementation_details) return alert("Implementation evidence is required.");

    await saveAll();

    const now = new Date().toISOString();

    const { error } = await supabase
      .from("capas")
      .update({
        implemented_by: userEmail || "unknown",
        implemented_at: now,
        status: "effectiveness_review",
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await addAuditLog(
      "implementation_completed",
      "CAPA implementation completed and moved to effectiveness review."
    );

    alert("Implementation marked complete.");
    fetchRecord();
  };

  const submitClosureApproval = async () => {
    if (isLocked) return;

    if (!investigationApproved) {
      alert("Investigation approval is required before closure.");
      return;
    }

    if (!record?.implemented_by) {
      alert("Implementation must be formally marked complete before closure.");
      return;
    }

    if (!record?.effectiveness_rating) return alert("Effectiveness rating is required.");
    if (!record?.effectiveness_check) return alert("Effectiveness results are required.");

    if (
      (record.effectiveness_rating === "partially_effective" ||
        record.effectiveness_rating === "not_effective") &&
      !record.effectiveness_followup_action
    ) {
      alert("Follow-up action is required for partially effective or not effective CAPAs.");
      return;
    }

    await saveAll();

    const now = new Date().toISOString();

    const { error } = await supabase
      .from("capas")
      .update({
        closure_approval_status: "pending",
        closure_submitted_by: userEmail || "unknown",
        closure_submitted_at: now,
        status: "pending_closure_approval",
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await addAuditLog(
      "closure_submitted_for_approval",
      "CAPA submitted for closure approval."
    );

    alert("CAPA submitted for closure approval.");
    fetchRecord();
  };

  const approveClosure = async () => {
    if (!canApprove) {
      alert("Only an approver or VP Quality can approve closure.");
      return;
    }

    const confirmed = window.confirm(
      "Electronic Signature:\n\nApprove final CAPA closure and permanently lock this CAPA record?"
    );

    if (!confirmed) return;

    const now = new Date().toISOString();

    const signatureMeaning =
      "I approve final CAPA closure and confirm the intake, scope, containment, investigation, root cause, risk assessment, corrective action, implementation, effectiveness verification, and closure review are complete.";

    const { error } = await supabase
      .from("capas")
      .update({
        closure_approval_status: "approved",
        closure_approved_by: userEmail,
        closure_approved_at: now,
        closure_approval_comments: closureApprovalComments || null,
        closure_signature_meaning: signatureMeaning,

        approved_by: userEmail,
        approved_at: now,
        signed_by: userEmail,
        signed_at: now,
        signature_meaning: signatureMeaning,
        capa_signature_meaning: signatureMeaning,
        capa_closed_by: userEmail,
        closed_at: now,

        status: "closed",
        is_locked: true,
        locked_by: userEmail,
        locked_at: now,
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await addAuditLog(
      "closure_approved_signed_locked",
      `CAPA closure approved and locked. Meaning: ${signatureMeaning}`
    );

    alert("CAPA approved, closed, and locked.");
    fetchRecord();
  };

  const rejectClosure = async () => {
    if (!canApprove) {
      alert("Only an approver or VP Quality can reject closure.");
      return;
    }

    if (!closureApprovalComments.trim()) {
      alert("Closure rejection comments are required.");
      return;
    }

    const confirmed = window.confirm("Reject closure and return to effectiveness review?");
    if (!confirmed) return;

    const now = new Date().toISOString();

    const { error } = await supabase
      .from("capas")
      .update({
        closure_approval_status: "rejected",
        closure_rejected_by: userEmail,
        closure_rejected_at: now,
        closure_rejection_comments: closureApprovalComments,
        status: "effectiveness_review",
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await addAuditLog(
      "closure_rejected",
      `CAPA closure rejected. Comments: ${closureApprovalComments}`
    );

    alert("Closure rejected.");
    fetchRecord();
  };

  const cancelCapa = async () => {
    if (isLocked) return;

    if (!canApprove) {
      alert("Only an approver or VP Quality can cancel a CAPA.");
      return;
    }

    if (!cancelReason.trim()) return alert("Cancel reason is required.");
    if (!cancellationJustification.trim()) {
      return alert("Cancellation justification is required.");
    }

    const confirmed = window.confirm(
      "Cancel this CAPA and lock the record?\n\nCancelled CAPAs remain part of the quality record and cannot be edited after cancellation."
    );

    if (!confirmed) return;

    const now = new Date().toISOString();

    const { error } = await supabase
      .from("capas")
      .update({
        status: "cancelled",
        cancel_reason: cancelReason,
        cancellation_justification: cancellationJustification,
        cancelled_by: userEmail,
        cancelled_at: now,
        is_locked: true,
        locked_by: userEmail,
        locked_at: now,
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await addAuditLog(
      "capa_cancelled_locked",
      `CAPA cancelled and locked. Reason: ${cancelReason}. Justification: ${cancellationJustification}`
    );

    alert("CAPA cancelled and locked.");
    fetchRecord();
  };

  const stages: WorkflowStage[] = useMemo(
    () => [
      { key: "intake", label: "Intake", completed: Boolean(record?.problem_description) },
      { key: "scope", label: "Scope", completed: Boolean(record?.scope_summary) },
      { key: "containment", label: "Containment", completed: Boolean(record?.containment_action) },
      {
        key: "investigation",
        label: "Investigation",
        completed: Boolean(record?.investigation_findings || record?.investigation_summary),
      },
      { key: "rootcause", label: "Root Cause", completed: Boolean(record?.root_cause) },
      { key: "risk", label: "Risk / Severity", completed: Boolean(record?.severity && record?.risk_level) },
      {
        key: "investigationapproval",
        label: "Investigation Approval",
        completed: investigationApproved,
        status: record?.investigation_approval_status,
      },
      {
        key: "correctiveaction",
        label: "Corrective Action",
        completed: Boolean(record?.corrective_action_plan),
        locked: implementationLocked,
      },
      {
        key: "implementation",
        label: "Implementation",
        completed: Boolean(record?.implemented_by || record?.implementation_details),
        locked: implementationLocked,
      },
      {
        key: "effectiveness",
        label: "Effectiveness",
        completed: Boolean(record?.effectiveness_rating && record?.effectiveness_check),
        locked: implementationLocked,
      },
      {
        key: "closure",
        label: "Closure / Cancel",
        completed: closureApproved || record?.status === "cancelled",
        status: record?.closure_approval_status,
      },
    ],
    [record, investigationApproved, closureApproved, implementationLocked]
  );

  const workflowHealth = getWorkflowHealth(record);
  const riskColor = getRiskColor(record?.risk_level || record?.severity);

  if (loading) {
    return <main style={{ padding: "24px", fontFamily: "Arial" }}>Loading CAPA workflow...</main>;
  }

  if (!record) {
    return <main style={{ padding: "24px", fontFamily: "Arial" }}>CAPA not found.</main>;
  }

  return (
    <main style={pageStyle}>
      <style>{`
        @media print {
          button, .no-print { display: none !important; }
          main { background: white !important; padding: 0 !important; }
          section, aside { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      <section style={headerCardStyle}>
        <div>
          <div style={eyebrowStyle}>ENTERPRISE CAPA EXECUTION WORKSPACE</div>
          <h1 style={{ margin: "6px 0" }}>
            {record.capa_number || "CAPA-PENDING"} — {record.title || "Untitled CAPA"}
          </h1>
          <p style={subtleText}>
            Intake → Scope → Containment → Investigation → Root Cause → Risk / Severity → Approval → Action → Implementation → Effectiveness → Closure.
          </p>
        </div>

        <div style={buttonRowStyle} className="no-print">
          <button onClick={() => window.print()} style={secondaryButtonStyle}>Print Workflow</button>
          <button onClick={saveAll} disabled={isLocked} style={buttonDisabledStyle(isLocked)}>Save All</button>
          <Link href="/capa" style={darkButtonStyle}>Back</Link>
        </div>
      </section>

      <section style={{ ...healthBannerStyle, borderLeft: `8px solid ${workflowHealth.color}` }}>
        <div>
          <div style={bannerLabelStyle}>CAPA WORKFLOW HEALTH</div>
          <div style={{ fontSize: "30px", fontWeight: 800, color: workflowHealth.color }}>
            {workflowHealth.label}
          </div>
        </div>

        <div style={badgeRowStyle}>
          <Badge label={record.status || "unknown"} color="#2563eb" />
          <Badge label={`Risk: ${record.risk_level || "Not Rated"}`} color={riskColor} />
          <Badge label={`Severity: ${record.severity || "Not Rated"}`} color={getRiskColor(record.severity)} />
          <Badge
            label={`Investigation: ${record.investigation_approval_status || "not_submitted"}`}
            color={investigationApproved ? "#15803d" : "#d97706"}
          />
          <Badge
            label={`Closure: ${record.closure_approval_status || "not_submitted"}`}
            color={closureApproved || isLocked ? "#15803d" : "#d97706"}
          />
        </div>
      </section>

      {isLocked ? (
        <section style={lockedBannerStyle}>
          🔒 CAPA RECORD LOCKED — {record.status === "cancelled" ? "Cancelled" : "Approved and closed"} quality record.
        </section>
      ) : null}

      <section style={summaryGridStyle}>
        <SummaryCard label="Owner" value={record.owner} />
        <SummaryCard label="Due Date" value={record.due_date} />
        <SummaryCard label="Supplier" value={record.supplier_name} />
        <SummaryCard label="Linked NCMR" value={record.linked_ncmr_title} />
        <SummaryCard label="Classification" value={record.capa_classification} />
        <SummaryCard label="Effectiveness" value={record.effectiveness_rating} />
      </section>

      <div style={workspaceStyle}>
        <aside style={railStyle} className="no-print">
          <h3 style={{ marginTop: 0 }}>Workflow Progress</h3>

          <div style={progressSummaryStyle}>
            <strong>{stages.filter((stage) => stage.completed).length} / {stages.length}</strong> phases complete
          </div>

          {stages.map((stage, index) => (
            <button
              key={stage.key}
              onClick={() => openSection(stage.key)}
              style={{
                ...railItemStyle,
                borderLeft: `6px solid ${
                  stage.completed ? "#15803d" : stage.locked ? "#9ca3af" : "#d97706"
                }`,
                background: activeSection === stage.key ? "#eff6ff" : "white",
              }}
            >
              <div style={{ fontWeight: 700 }}>
                {stage.completed ? "✓" : stage.locked ? "🔒" : "•"} {index + 1}. {stage.label}
              </div>
              <div style={{ color: "#6b7280", fontSize: "12px", marginTop: "4px" }}>
                {stage.completed ? "Complete" : stage.locked ? "Locked" : stage.status || "Pending"}
              </div>
            </button>
          ))}
        </aside>

        <div>
          <WorkflowCard sectionKey="intake" expanded={expandedSections.includes("intake")} onToggle={toggleSection} title="1. Intake" subtitle="Capture the issue and source of detection.">
            <Field label="Issue Summary">
              <textarea
                value={record.problem_description || ""}
                onChange={(e) => updateField("problem_description", e.target.value)}
                onBlur={(e) => saveField("problem_description", e.target.value)}
                disabled={isLocked}
                rows={4}
                style={textareaStyle(isLocked)}
              />
            </Field>

            <div style={formGridStyle}>
              <Field label="Detection Source">
                <input
                  value={record.detection_source || ""}
                  onChange={(e) => updateField("detection_source", e.target.value)}
                  onBlur={(e) => saveField("detection_source", e.target.value)}
                  disabled={isLocked}
                  style={inputStyle(isLocked)}
                />
              </Field>

              <Field label="CAPA Classification">
                <select
                  value={record.capa_classification || ""}
                  onChange={(e) => {
                    updateField("capa_classification", e.target.value);
                    saveField("capa_classification", e.target.value);
                  }}
                  disabled={isLocked}
                  style={inputStyle(isLocked)}
                >
                  <option value="">Select</option>
                  <option value="correction_only">Correction Only</option>
                  <option value="corrective_action">Corrective Action</option>
                  <option value="preventive_action">Preventive Action</option>
                  <option value="systemic_capa">Systemic CAPA</option>
                  <option value="supplier_capa">Supplier CAPA</option>
                </select>
              </Field>
            </div>
          </WorkflowCard>

          <WorkflowCard sectionKey="scope" expanded={expandedSections.includes("scope")} onToggle={toggleSection} title="2. Scope" subtitle="Define affected product, lot, process, supplier, and potential impact.">
            <Field label="Scope Summary">
              <textarea
                value={record.scope_summary || ""}
                onChange={(e) => updateField("scope_summary", e.target.value)}
                onBlur={(e) => saveField("scope_summary", e.target.value)}
                disabled={isLocked}
                rows={3}
                style={textareaStyle(isLocked)}
              />
            </Field>

            <div style={formGridStyle}>
              <InputField label="Affected Product" value={record.affected_product} field="affected_product" locked={isLocked} updateField={updateField} saveField={saveField} />
              <InputField label="Affected Lot" value={record.affected_lot} field="affected_lot" locked={isLocked} updateField={updateField} saveField={saveField} />
              <InputField label="Affected Process" value={record.affected_process} field="affected_process" locked={isLocked} updateField={updateField} saveField={saveField} />
              <InputField label="Affected Supplier" value={record.affected_supplier || record.supplier_name} field="affected_supplier" locked={isLocked} updateField={updateField} saveField={saveField} />
            </div>

            <TextField label="Potential Impact" value={record.potential_impact} field="potential_impact" locked={isLocked} updateField={updateField} saveField={saveField} rows={3} />
          </WorkflowCard>

          <WorkflowCard sectionKey="containment" expanded={expandedSections.includes("containment")} onToggle={toggleSection} title="3. Containment" subtitle="Define immediate correction, containment owner, and residual risk.">
            <div style={formGridStyle}>
              <TextField label="Containment Action" value={record.containment_action} field="containment_action" locked={isLocked} updateField={updateField} saveField={saveField} rows={4} />
              <InputField label="Containment Owner" value={record.containment_owner} field="containment_owner" locked={isLocked} updateField={updateField} saveField={saveField} />

              <Field label="Containment Complete">
                <select
                  value={record.containment_complete || ""}
                  onChange={(e) => {
                    updateField("containment_complete", e.target.value);
                    saveField("containment_complete", e.target.value);
                  }}
                  disabled={isLocked}
                  style={inputStyle(isLocked)}
                >
                  <option value="">Select</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                  <option value="not_required">Not Required</option>
                </select>
              </Field>
            </div>

            <TextField label="Residual Risk After Containment" value={record.containment_residual_risk} field="containment_residual_risk" locked={isLocked} updateField={updateField} saveField={saveField} rows={3} />
          </WorkflowCard>

          <WorkflowCard sectionKey="investigation" expanded={expandedSections.includes("investigation")} onToggle={toggleSection} title="4. Investigation" subtitle="Document objective, evidence reviewed, findings, and conclusion.">
            <div style={formGridStyle}>
              <TextField label="Investigation Objective" value={record.investigation_objective} field="investigation_objective" locked={isLocked} updateField={updateField} saveField={saveField} rows={3} />
              <TextField label="Evidence Reviewed" value={record.evidence_reviewed} field="evidence_reviewed" locked={isLocked} updateField={updateField} saveField={saveField} rows={3} />
              <TextField label="Investigation Findings" value={record.investigation_findings || record.investigation_summary} field="investigation_findings" locked={isLocked} updateField={updateField} saveField={saveField} rows={4} />
              <TextField label="Investigation Conclusion" value={record.investigation_conclusion} field="investigation_conclusion" locked={isLocked} updateField={updateField} saveField={saveField} rows={3} />
            </div>
          </WorkflowCard>

          <WorkflowCard sectionKey="rootcause" expanded={expandedSections.includes("rootcause")} onToggle={toggleSection} title="5. Root Cause" subtitle="Document root cause method, contributing factors, verification, and systemic impact.">
            <div style={formGridStyle}>
              <Field label="Root Cause Method">
                <select
                  value={record.root_cause_method || ""}
                  onChange={(e) => {
                    updateField("root_cause_method", e.target.value);
                    saveField("root_cause_method", e.target.value);
                  }}
                  disabled={isLocked}
                  style={inputStyle(isLocked)}
                >
                  <option value="">Select</option>
                  <option value="5_why">5 Why</option>
                  <option value="fishbone">Fishbone</option>
                  <option value="fault_tree">Fault Tree</option>
                  <option value="process_mapping">Process Mapping</option>
                  <option value="other">Other</option>
                </select>
              </Field>

              <TextField label="Primary Root Cause" value={record.root_cause} field="root_cause" locked={isLocked} updateField={updateField} saveField={saveField} rows={4} />
              <TextField label="Contributing Factors" value={record.contributing_factors} field="contributing_factors" locked={isLocked} updateField={updateField} saveField={saveField} rows={3} />
              <TextField label="Root Cause Verification Evidence" value={record.root_cause_verification} field="root_cause_verification" locked={isLocked} updateField={updateField} saveField={saveField} rows={3} />
              <TextField label="Systemic Impact" value={record.systemic_impact} field="systemic_impact" locked={isLocked} updateField={updateField} saveField={saveField} rows={3} />
            </div>
          </WorkflowCard>

          <WorkflowCard sectionKey="risk" expanded={expandedSections.includes("risk")} onToggle={toggleSection} title="6. Risk Assessment / Severity" subtitle="Assess severity, occurrence, detection, risk level, and quality/regulatory impact.">
            <div style={formGridStyle}>
              <SelectField label="Severity" field="severity" value={record.severity} locked={isLocked} updateField={updateField} saveField={saveField} options={["low", "medium", "high", "critical"]} />
              <SelectField label="Occurrence" field="occurrence_rating" value={record.occurrence_rating} locked={isLocked} updateField={updateField} saveField={saveField} options={["low", "medium", "high"]} />
              <SelectField label="Detection" field="detection_rating" value={record.detection_rating} locked={isLocked} updateField={updateField} saveField={saveField} options={["high_detection", "medium_detection", "low_detection"]} />
              <SelectField label="Risk Level" field="risk_level" value={record.risk_level} locked={isLocked} updateField={updateField} saveField={saveField} options={["low", "medium", "high", "critical"]} />
            </div>

            <div style={formGridStyle}>
              <TextField label="Patient Safety Impact" value={record.patient_safety_impact} field="patient_safety_impact" locked={isLocked} updateField={updateField} saveField={saveField} rows={3} />
              <TextField label="Product Quality Impact" value={record.product_quality_impact} field="product_quality_impact" locked={isLocked} updateField={updateField} saveField={saveField} rows={3} />
              <TextField label="Regulatory Impact" value={record.regulatory_impact} field="regulatory_impact" locked={isLocked} updateField={updateField} saveField={saveField} rows={3} />
              <TextField label="Risk Rationale" value={record.risk_rationale || record.risk_assessment} field="risk_rationale" locked={isLocked} updateField={updateField} saveField={saveField} rows={3} />
            </div>
          </WorkflowCard>

          <ApprovalCard
            sectionKey="investigationapproval"
            expanded={expandedSections.includes("investigationapproval")}
            onToggle={toggleSection}
            title="7. Investigation Approval"
            description="Approver reviews scope, containment, investigation, root cause, risk assessment, and severity before implementation begins."
            status={record.investigation_approval_status || "not_submitted"}
            comments={investigationApprovalComments}
            setComments={setInvestigationApprovalComments}
            submittedBy={record.investigation_submitted_by}
            submittedAt={record.investigation_submitted_at}
            approvedBy={record.investigation_approved_by}
            approvedAt={record.investigation_approved_at}
            rejectedBy={record.investigation_rejected_by}
            rejectedAt={record.investigation_rejected_at}
            disabled={isLocked}
            canApprove={canApprove}
            onSubmit={submitInvestigationApproval}
            onApprove={approveInvestigation}
            onReject={rejectInvestigation}
          />

          <WorkflowCard sectionKey="correctiveaction" expanded={expandedSections.includes("correctiveaction")} onToggle={toggleSection} title="8. Corrective Action" subtitle="Define corrective action, owner, due date, and verification method." locked={implementationLocked}>
            {implementationLocked && !isLocked ? <LockNotice /> : null}
            <div style={formGridStyle}>
              <TextField label="Corrective Action" value={record.corrective_action_plan} field="corrective_action_plan" locked={implementationLocked} updateField={updateField} saveField={saveField} rows={4} />
              <InputField label="Action Owner" value={record.action_owner} field="action_owner" locked={implementationLocked} updateField={updateField} saveField={saveField} />
              <Field label="Action Due Date">
                <input
                  type="date"
                  value={record.action_due_date || ""}
                  onChange={(e) => {
                    updateField("action_due_date", e.target.value);
                    saveField("action_due_date", e.target.value);
                  }}
                  disabled={implementationLocked}
                  style={inputStyle(implementationLocked)}
                />
              </Field>
              <TextField label="Verification Method" value={record.verification_method} field="verification_method" locked={implementationLocked} updateField={updateField} saveField={saveField} rows={3} />
            </div>
          </WorkflowCard>

          <WorkflowCard sectionKey="implementation" expanded={expandedSections.includes("implementation")} onToggle={toggleSection} title="9. Implementation" subtitle="Document implementation evidence and related QMS updates." locked={implementationLocked}>
            {implementationLocked && !isLocked ? <LockNotice /> : null}
            <div style={formGridStyle}>
              <YesNoField label="Procedure Updated" field="procedure_updated" value={record.procedure_updated} locked={implementationLocked} updateField={updateField} saveField={saveField} />
              <YesNoField label="Training Required" field="training_required" value={record.training_required} locked={implementationLocked} updateField={updateField} saveField={saveField} />
              <YesNoField label="Validation Required" field="validation_required" value={record.validation_required} locked={implementationLocked} updateField={updateField} saveField={saveField} />
            </div>

            <TextField label="Implementation Evidence" value={record.implementation_details || record.implementation_evidence} field="implementation_details" locked={implementationLocked} updateField={updateField} saveField={saveField} rows={4} />

            <button onClick={markImplemented} disabled={implementationLocked} style={buttonDisabledStyle(implementationLocked)}>
              Mark Implementation Complete
            </button>

            {record.implemented_by ? (
              <p style={{ color: "#15803d", fontWeight: 700 }}>
                Implemented by {record.implemented_by} at {record.implemented_at || "N/A"}
              </p>
            ) : null}
          </WorkflowCard>

          <WorkflowCard sectionKey="effectiveness" expanded={expandedSections.includes("effectiveness")} onToggle={toggleSection} title="10. Effectiveness" subtitle="Document monitoring method, monitoring period, results, recurrence, and final rating." locked={implementationLocked}>
            {implementationLocked && !isLocked ? <LockNotice /> : null}
            <div style={formGridStyle}>
              <TextField label="Monitoring Method" value={record.monitoring_method || record.effectiveness_plan} field="monitoring_method" locked={implementationLocked} updateField={updateField} saveField={saveField} rows={3} />
              <InputField label="Monitoring Period" value={record.monitoring_period} field="monitoring_period" locked={implementationLocked} updateField={updateField} saveField={saveField} />
              <TextField label="Effectiveness Results" value={record.effectiveness_check} field="effectiveness_check" locked={implementationLocked} updateField={updateField} saveField={saveField} rows={4} />

              <SelectField label="Effectiveness Rating" field="effectiveness_rating" value={record.effectiveness_rating} locked={implementationLocked} updateField={updateField} saveField={saveField} options={["effective", "partially_effective", "not_effective"]} />
              <YesNoField label="Recurrence Detected" field="recurrence_detected" value={record.recurrence_detected} locked={implementationLocked} updateField={updateField} saveField={saveField} />
              <YesNoField label="Follow-up CAPA Required" field="followup_capa_required" value={record.followup_capa_required} locked={implementationLocked} updateField={updateField} saveField={saveField} />
            </div>

            {(record.effectiveness_rating === "partially_effective" ||
              record.effectiveness_rating === "not_effective" ||
              record.followup_capa_required === "yes") ? (
              <TextField label="Follow-up Action" value={record.effectiveness_followup_action} field="effectiveness_followup_action" locked={implementationLocked} updateField={updateField} saveField={saveField} rows={3} />
            ) : null}
          </WorkflowCard>

          <ApprovalCard
            sectionKey="closure"
            expanded={expandedSections.includes("closure")}
            onToggle={toggleSection}
            title="11. Closure Approval"
            description="Final approval confirms CAPA completion, effectiveness, and closure readiness. Approval locks the record."
            status={record.closure_approval_status || "not_submitted"}
            comments={closureApprovalComments}
            setComments={setClosureApprovalComments}
            submittedBy={record.closure_submitted_by}
            submittedAt={record.closure_submitted_at}
            approvedBy={record.closure_approved_by || record.signed_by}
            approvedAt={record.closure_approved_at || record.signed_at}
            rejectedBy={record.closure_rejected_by}
            rejectedAt={record.closure_rejected_at}
            disabled={isLocked}
            canApprove={canApprove}
            onSubmit={submitClosureApproval}
            onApprove={approveClosure}
            onReject={rejectClosure}
          />

          {!isLocked ? (
            <WorkflowCard sectionKey="cancel" expanded={expandedSections.includes("cancel")} onToggle={toggleSection} title="Cancel CAPA" subtitle="Cancel only when initiated in error, duplicated, superseded, or no longer justified. Cancellation locks the record.">
              <div style={formGridStyle}>
                <Field label="Cancel Reason">
                  <select
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    disabled={isLocked}
                    style={inputStyle(isLocked)}
                  >
                    <option value="">Select</option>
                    <option value="initiated_in_error">Initiated in Error</option>
                    <option value="duplicate">Duplicate CAPA</option>
                    <option value="merged">Merged into Another CAPA</option>
                    <option value="issue_not_confirmed">Issue Not Confirmed</option>
                    <option value="superseded">Superseded</option>
                  </select>
                </Field>

                <Field label="Cancellation Justification">
                  <textarea
                    value={cancellationJustification}
                    onChange={(e) => setCancellationJustification(e.target.value)}
                    disabled={isLocked}
                    rows={3}
                    style={textareaStyle(isLocked)}
                  />
                </Field>
              </div>

              <button onClick={cancelCapa} disabled={isLocked || !canApprove} style={dangerButtonStyle}>
                Cancel and Lock CAPA
              </button>
            </WorkflowCard>
          ) : null}

          <section style={workflowCardStyle}>
            <h2 style={{ marginTop: 0 }}>Electronic Signature / Lock Evidence</h2>
            <div style={summaryGridStyle}>
              <SummaryCard label="Signed By" value={record.signed_by} />
              <SummaryCard label="Signed At" value={record.signed_at} />
              <SummaryCard label="Approved By" value={record.approved_by} />
              <SummaryCard label="Approved At" value={record.approved_at} />
              <SummaryCard label="Locked By" value={record.locked_by} />
              <SummaryCard label="Locked At" value={record.locked_at} />
            </div>

            {record.signature_meaning ? (
              <div style={evidenceBoxStyle}>
                <strong>Signature Meaning</strong>
                <p style={{ marginBottom: 0 }}>{record.signature_meaning}</p>
              </div>
            ) : null}

            {record.status === "cancelled" ? (
              <div style={evidenceBoxStyle}>
                <strong>Cancellation Evidence</strong>
                <p><strong>Reason:</strong> {record.cancel_reason || "N/A"}</p>
                <p><strong>Justification:</strong> {record.cancellation_justification || "N/A"}</p>
                <p><strong>Cancelled By:</strong> {record.cancelled_by || "N/A"}</p>
                <p><strong>Cancelled At:</strong> {record.cancelled_at || "N/A"}</p>
              </div>
            ) : null}
          </section>
        </div>

        <aside style={sidebarStyle}>
          <SidebarCard title="Governance Intelligence">
            <SidebarItem label="Risk Level" value={record.risk_level || "Not Rated"} />
            <SidebarItem label="Severity" value={record.severity || "Not Rated"} />
            <SidebarItem label="Recurrence" value={record.recurrence_count || 0} />
            <SidebarItem label="Supplier Risk" value={record.supplier_risk || "N/A"} />
          </SidebarCard>

          <SidebarCard title="Approval Status">
            <SidebarItem label="Investigation" value={record.investigation_approval_status || "Not Submitted"} />
            <SidebarItem label="Closure" value={record.closure_approval_status || "Not Submitted"} />
            <SidebarItem label="User Role" value={userRole || "none"} />
          </SidebarCard>

          <SidebarCard title="Related Records">
            <SidebarItem label="Supplier" value={record.supplier_name || "N/A"} />
            <SidebarItem label="Linked NCMR" value={record.linked_ncmr_title || "N/A"} />
            {record.followup_capa_id ? (
              <Link href={`/capa/${record.followup_capa_id}`}>Open Follow-up CAPA</Link>
            ) : null}
          </SidebarCard>
        </aside>
      </div>
    </main>
  );
}

function WorkflowCard({
  sectionKey,
  expanded,
  onToggle,
  title,
  subtitle,
  children,
  locked = false,
}: {
  sectionKey: string;
  expanded: boolean;
  onToggle: (key: string) => void;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  locked?: boolean;
}) {
  return (
    <section
      style={{
        ...workflowCardStyle,
        opacity: locked ? 0.82 : 1,
        borderLeft: `8px solid ${locked ? "#9ca3af" : expanded ? "#2563eb" : "#d1d5db"}`,
      }}
    >
      <button
        type="button"
        onClick={() => onToggle(sectionKey)}
        style={sectionHeaderButtonStyle}
      >
        <div>
          <h2 style={{ margin: "0 0 4px 0" }}>
            {expanded ? "▼" : "▶"} {title}
          </h2>
          <p style={subtleText}>{subtitle}</p>
        </div>
        <span style={sectionStatePillStyle}>
          {locked ? "Locked" : expanded ? "Open" : "Collapsed"}
        </span>
      </button>

      {expanded ? <div style={{ marginTop: "16px" }}>{children}</div> : null}
    </section>
  );
}

function ApprovalCard({
  sectionKey,
  expanded,
  onToggle,
  title,
  description,
  status,
  comments,
  setComments,
  submittedBy,
  submittedAt,
  approvedBy,
  approvedAt,
  rejectedBy,
  rejectedAt,
  disabled,
  canApprove,
  onSubmit,
  onApprove,
  onReject,
}: {
  sectionKey: string;
  expanded: boolean;
  onToggle: (key: string) => void;
  title: string;
  description: string;
  status: string;
  comments: string;
  setComments: (value: string) => void;
  submittedBy?: string;
  submittedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  disabled: boolean;
  canApprove: boolean;
  onSubmit: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const isApproved = status === "approved";
  const isPending = status === "pending";
  const isRejected = status === "rejected";

  return (
    <section
      style={{
        ...workflowCardStyle,
        borderLeft: `8px solid ${
          isApproved ? "#15803d" : isPending ? "#d97706" : isRejected ? "#dc2626" : "#6b7280"
        }`,
      }}
    >
      <button
        type="button"
        onClick={() => onToggle(sectionKey)}
        style={sectionHeaderButtonStyle}
      >
        <div>
          <h2 style={{ margin: "0 0 4px 0" }}>
            {expanded ? "▼" : "▶"} {title}
          </h2>
          <p style={subtleText}>{description}</p>
        </div>
        <span style={sectionStatePillStyle}>{status || "Not Submitted"}</span>
      </button>

      {expanded ? (
        <div style={{ marginTop: "16px" }}>
          <div style={summaryGridStyle}>
            <SummaryCard label="Status" value={status || "Not Submitted"} />
            <SummaryCard label="Submitted By" value={submittedBy} />
            <SummaryCard label="Submitted At" value={submittedAt} />
            <SummaryCard label="Approved By" value={approvedBy} />
            <SummaryCard label="Approved At" value={approvedAt} />
            <SummaryCard label="Rejected By" value={rejectedBy} />
            <SummaryCard label="Rejected At" value={rejectedAt} />
          </div>

          {!disabled && !isApproved ? (
            <>
              <Field label="Approval / Rejection Comments">
                <textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  rows={3}
                  style={textareaStyle(false)}
                />
              </Field>

              <div style={buttonRowStyle}>
                <button onClick={onSubmit} style={secondaryButtonStyle}>
                  Submit
                </button>

                {isPending && canApprove ? (
                  <>
                    <button onClick={onApprove} style={primaryButtonStyle}>
                      Approve
                    </button>
                    <button onClick={onReject} style={dangerButtonStyle}>
                      Reject
                    </button>
                  </>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "16px" }}>
      <label style={fieldLabelStyle}>{label}</label>
      <div style={{ marginTop: "6px" }}>{children}</div>
    </div>
  );
}

function InputField({
  label,
  value,
  field,
  locked,
  updateField,
  saveField,
}: {
  label: string;
  value: any;
  field: string;
  locked: boolean;
  updateField: (field: string, value: any) => void;
  saveField: (field: string, value: any) => void;
}) {
  return (
    <Field label={label}>
      <input
        value={value || ""}
        onChange={(e) => updateField(field, e.target.value)}
        onBlur={(e) => saveField(field, e.target.value)}
        disabled={locked}
        style={inputStyle(locked)}
      />
    </Field>
  );
}

function TextField({
  label,
  value,
  field,
  locked,
  updateField,
  saveField,
  rows = 3,
}: {
  label: string;
  value: any;
  field: string;
  locked: boolean;
  updateField: (field: string, value: any) => void;
  saveField: (field: string, value: any) => void;
  rows?: number;
}) {
  return (
    <Field label={label}>
      <textarea
        value={value || ""}
        onChange={(e) => updateField(field, e.target.value)}
        onBlur={(e) => saveField(field, e.target.value)}
        disabled={locked}
        rows={rows}
        style={textareaStyle(locked)}
      />
    </Field>
  );
}

function SelectField({
  label,
  value,
  field,
  locked,
  updateField,
  saveField,
  options,
}: {
  label: string;
  value: any;
  field: string;
  locked: boolean;
  updateField: (field: string, value: any) => void;
  saveField: (field: string, value: any) => void;
  options: string[];
}) {
  return (
    <Field label={label}>
      <select
        value={value || ""}
        onChange={(e) => {
          updateField(field, e.target.value);
          saveField(field, e.target.value);
        }}
        disabled={locked}
        style={inputStyle(locked)}
      >
        <option value="">Select</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {toLabel(option)}
          </option>
        ))}
      </select>
    </Field>
  );
}

function YesNoField({
  label,
  value,
  field,
  locked,
  updateField,
  saveField,
}: {
  label: string;
  value: any;
  field: string;
  locked: boolean;
  updateField: (field: string, value: any) => void;
  saveField: (field: string, value: any) => void;
}) {
  return (
    <Field label={label}>
      <select
        value={value || ""}
        onChange={(e) => {
          updateField(field, e.target.value);
          saveField(field, e.target.value);
        }}
        disabled={locked}
        style={inputStyle(locked)}
      >
        <option value="">Select</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
        <option value="not_required">Not Required</option>
      </select>
    </Field>
  );
}

function SummaryCard({ label, value }: { label: string; value: any }) {
  return (
    <div style={summaryCardStyle}>
      <div style={summaryLabelStyle}>{label}</div>
      <div style={summaryValueStyle}>{value || "N/A"}</div>
    </div>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        background: color,
        color: "white",
        padding: "5px 10px",
        borderRadius: "999px",
        fontSize: "12px",
        fontWeight: 700,
      }}
    >
      {label}
    </span>
  );
}

function LockNotice() {
  return (
    <div style={lockedNoticeStyle}>
      Investigation approval is required before this phase can be edited.
    </div>
  );
}

function SidebarCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={sidebarCardStyle}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      {children}
    </div>
  );
}

function SidebarItem({ label, value }: { label: string; value: any }) {
  return (
    <div style={sidebarItemStyle}>
      <strong>{label}</strong>
      <div>{value || "N/A"}</div>
    </div>
  );
}

function getWorkflowHealth(record: any) {
  if (record?.status === "closed") return { label: "Closed / Locked", color: "#15803d" };
  if (record?.status === "cancelled") return { label: "Cancelled / Locked", color: "#6b7280" };

  const risk = String(record?.risk_level || record?.severity || "").toLowerCase();

  if (risk === "critical") return { label: "Critical", color: "#991b1b" };
  if (risk === "high") return { label: "Elevated", color: "#dc2626" };
  if (record?.effectiveness_rating === "not_effective") {
    return { label: "Elevated", color: "#dc2626" };
  }

  return { label: "Controlled", color: "#15803d" };
}

function getRiskColor(value: any) {
  const normalized = String(value || "").toLowerCase();

  if (normalized === "critical") return "#991b1b";
  if (normalized === "high") return "#dc2626";
  if (normalized === "medium") return "#d97706";
  if (normalized === "low") return "#15803d";

  return "#6b7280";
}

function toLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const pageStyle: React.CSSProperties = {
  padding: "24px",
  background: "#f8fafc",
  minHeight: "100vh",
  fontFamily: "Arial, sans-serif",
};

const headerCardStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: "16px",
  background: "white",
  padding: "22px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "12px",
  flexWrap: "wrap",
  marginBottom: "20px",
};

const healthBannerStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: "16px",
  background: "white",
  padding: "22px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  flexWrap: "wrap",
  marginBottom: "20px",
};

const workspaceStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "260px minmax(0, 1fr) 280px",
  gap: "20px",
  alignItems: "start",
};

const railStyle: React.CSSProperties = {
  position: "sticky",
  top: "16px",
};

const railItemStyle: React.CSSProperties = {
  width: "100%",
  textAlign: "left",
  padding: "12px",
  marginBottom: "10px",
  border: "1px solid #d1d5db",
  borderRadius: "12px",
  background: "white",
  cursor: "pointer",
};

const sidebarStyle: React.CSSProperties = {
  position: "sticky",
  top: "16px",
};

const sidebarCardStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: "14px",
  background: "white",
  padding: "16px",
  marginBottom: "16px",
};

const sidebarItemStyle: React.CSSProperties = {
  borderBottom: "1px solid #e5e7eb",
  paddingBottom: "8px",
  marginBottom: "10px",
};

const workflowCardStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: "16px",
  background: "white",
  padding: "22px",
  marginBottom: "20px",
};

const summaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "14px",
  marginBottom: "20px",
};

const summaryCardStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: "12px",
  background: "#f9fafb",
  padding: "14px",
};

const summaryLabelStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 700,
  color: "#6b7280",
  marginBottom: "6px",
};

const summaryValueStyle: React.CSSProperties = {
  fontWeight: 700,
  whiteSpace: "pre-wrap",
};

const formGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
  gap: "18px",
};

const textareaStyle = (locked: boolean): React.CSSProperties => ({
  width: "100%",
  minHeight: "105px",
  padding: "12px",
  borderRadius: "10px",
  border: "1px solid #d1d5db",
  background: locked ? "#f3f4f6" : "white",
  color: locked ? "#6b7280" : "#111827",
});

const inputStyle = (locked: boolean): React.CSSProperties => ({
  width: "100%",
  padding: "10px",
  borderRadius: "10px",
  border: "1px solid #d1d5db",
  background: locked ? "#f3f4f6" : "white",
  color: locked ? "#6b7280" : "#111827",
});

const fieldLabelStyle: React.CSSProperties = {
  fontWeight: 700,
};

const eyebrowStyle: React.CSSProperties = {
  fontSize: "12px",
  letterSpacing: "0.08em",
  color: "#6b7280",
  fontWeight: 800,
};

const subtleText: React.CSSProperties = {
  color: "#6b7280",
};

const bannerLabelStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "#6b7280",
  fontWeight: 700,
};

const badgeRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
};

const buttonRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
};

const primaryButtonStyle: React.CSSProperties = {
  background: "#2563eb",
  color: "white",
  border: "none",
  borderRadius: "8px",
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 700,
};

const secondaryButtonStyle: React.CSSProperties = {
  background: "#15803d",
  color: "white",
  border: "none",
  borderRadius: "8px",
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 700,
};

const dangerButtonStyle: React.CSSProperties = {
  background: "#dc2626",
  color: "white",
  border: "none",
  borderRadius: "8px",
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 700,
};

const darkButtonStyle: React.CSSProperties = {
  background: "#111827",
  color: "white",
  borderRadius: "8px",
  padding: "10px 14px",
  textDecoration: "none",
  fontWeight: 700,
};

const buttonDisabledStyle = (disabled: boolean): React.CSSProperties => ({
  background: disabled ? "#9ca3af" : "#2563eb",
  color: "white",
  border: "none",
  borderRadius: "8px",
  padding: "10px 14px",
  cursor: disabled ? "not-allowed" : "pointer",
  fontWeight: 700,
});

const lockedBannerStyle: React.CSSProperties = {
  background: "#111827",
  color: "white",
  padding: "14px",
  borderRadius: "12px",
  fontWeight: 700,
  marginBottom: "20px",
};

const lockedNoticeStyle: React.CSSProperties = {
  padding: "10px",
  background: "#fefce8",
  border: "1px solid #facc15",
  borderRadius: "10px",
  marginBottom: "14px",
  color: "#92400e",
  fontWeight: 700,
};

const progressSummaryStyle: React.CSSProperties = {
  padding: "10px",
  borderRadius: "10px",
  background: "#f3f4f6",
  border: "1px solid #e5e7eb",
  marginBottom: "12px",
  color: "#374151",
  fontSize: "13px",
};

const sectionHeaderButtonStyle: React.CSSProperties = {
  width: "100%",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "12px",
  background: "transparent",
  border: "none",
  textAlign: "left",
  padding: 0,
  cursor: "pointer",
};

const sectionStatePillStyle: React.CSSProperties = {
  padding: "5px 10px",
  borderRadius: "999px",
  background: "#f3f4f6",
  color: "#374151",
  fontSize: "12px",
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const evidenceBoxStyle: React.CSSProperties = {
  marginTop: "16px",
  padding: "14px",
  background: "#f9fafb",
  borderRadius: "12px",
  border: "1px solid #d1d5db",
};
