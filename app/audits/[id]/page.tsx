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
  const [findingResponses, setFindingResponses] = useState<Record<string, any>>({});
  const [responseMessages, setResponseMessages] = useState<Record<string, string>>({});
  const [verificationNotes, setVerificationNotes] = useState<Record<string, string>>({});
  const [verificationMessages, setVerificationMessages] = useState<Record<string, string>>({});
  const [closureApproverEmail, setClosureApproverEmail] = useState("");
  const [closureDueDate, setClosureDueDate] = useState("");
  const [closureMessage, setClosureMessage] = useState("");
  const [closureTasks, setClosureTasks] = useState<any[]>([]);
  const [currentUserEmail, setCurrentUserEmail] = useState("");
  const [reviewerComment, setReviewerComment] = useState("");
  const [reviewerSignatureEmail, setReviewerSignatureEmail] = useState("");

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
    if (auditRes.data) {
      setPlanning({
        audit_title: auditRes.data.audit_title || "",
        audit_type: auditRes.data.audit_type || "internal_audit",
        audit_objectives: auditRes.data.audit_objectives || "",
        audit_scope: auditRes.data.audit_scope || "",
        audit_criteria: auditRes.data.audit_criteria || "",
        lead_auditor: auditRes.data.lead_auditor || auditRes.data.owner_email || auditRes.data.auditor || "",
        lead_auditor_email: auditRes.data.lead_auditor_email || auditRes.data.owner_email || "",
        audit_team: auditRes.data.audit_team || "",
        scheduled_start_date: auditRes.data.scheduled_start_date || auditRes.data.audit_date || "",
        scheduled_end_date: auditRes.data.scheduled_end_date || "",
      });
      setExecution({
        actual_start_date: auditRes.data.actual_start_date || "",
        actual_end_date: auditRes.data.actual_end_date || "",
        execution_notes: auditRes.data.execution_notes || "",
      });
    }
    setClosureApproverEmail(auditRes.data?.closure_approver_email || "");
    setFindings(findingsRes.data || []);
    const closureTaskRes = await supabase.from("approval_tasks").select("*")
      .eq("entity_type","audit").eq("entity_id",id).eq("task_type","audit_closure_approval")
      .order("created_at",{ascending:false});
    setClosureTasks(closureTaskRes.data || []);

    const map: Record<string, string> = {};
    (findingsRes.data || []).forEach((finding: any) => {
      map[finding.id] = finding.escalation_justification || "";
    });
    setEscalationJustifications(map);
    const responseMap: Record<string, any> = {};
    (findingsRes.data || []).forEach((finding: any) => {
      responseMap[finding.id] = {
        auditee_response: finding.auditee_response || "",
        correction: finding.correction || "",
        corrective_action: finding.corrective_action || "",
      };
    });
    setFindingResponses(responseMap);
    const verificationMap: Record<string, string> = {};
    (findingsRes.data || []).forEach((finding: any) => {
      verificationMap[finding.id] = finding.verification_notes || "";
    });
    setVerificationNotes(verificationMap);
  };

  useEffect(() => {
    if (id) fetchData();
    supabase.auth.getUser().then(({data}) => setCurrentUserEmail((data?.user?.email || "").toLowerCase()));
  }, [id]);

  if (!audit) return <main style={{ padding: 20 }}>Loading audit...</main>;

  const isPendingClosureApproval = audit?.closure_approval_status === "pending";
  const isLocked = audit?.is_locked === true || isPendingClosureApproval;

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
      lead_auditor_email: planning.lead_auditor_email?.trim().toLowerCase() || audit.owner_email || null,
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

    const findingOwnerEmail = String(newFinding.finding_owner || "").trim().toLowerCase();
    const { error: responseTaskError } = await supabase.from("approval_tasks").insert({
      entity_type:"audit_finding", entity_id:inserted.id, task_type:"audit_finding_response",
      required_function:"Finding Owner", assigned_to_email:findingOwnerEmail,
      assigned_by_email:currentUserEmail || audit.owner_email || null, status:"pending",
      due_date:newFinding.response_due_date || null, record_number:audit.audit_number,
      task_title:`Audit Finding Response — ${audit.audit_number || audit.audit_title}`,
      task_instructions:`Provide the auditee response, correction/immediate action, and corrective action for finding: ${newFinding.finding_title}.`
    });
    if (responseTaskError) {
      await supabase.from("audit_findings").delete().eq("id", inserted.id).eq("tenant_id", audit.tenant_id);
      return setFindingMessage(`Finding assignment failed: ${responseTaskError.message}`);
    }

    await supabase.rpc("qualisphere_add_audit_log", {
      p_entity_type:"audit_finding", p_entity_id:inserted.id, p_action:"audit_finding_created",
      p_details:`Audit finding created in ${audit.audit_number || id}. Classification: ${newFinding.finding_severity}.`
    });
    setNewFinding({ finding_title:"", finding_description:"", finding_severity:"observation", clause_reference:"", evidence:"", finding_owner:"", response_due_date:"" });
    setFindingMessage("Finding added.");
    await fetchData();
  };

  const saveFindingResponse = async (finding: any) => {
    if (isLocked) return alert("This audit is locked and cannot be edited.");
    if (String(finding.finding_owner || "").trim().toLowerCase() !== currentUserEmail) {
      return setResponseMessages({...responseMessages,[finding.id]:"Only the assigned Finding Owner can submit this response from My Workspace."});
    }
    if (finding.finding_status === "closed") return alert("This finding is already closed.");
    const response = findingResponses[finding.id] || {};
    if (!String(response.auditee_response || "").trim()) {
      return setResponseMessages({...responseMessages, [finding.id]:"Auditee Response is required."});
    }
    if (!String(response.correction || "").trim()) {
      return setResponseMessages({...responseMessages, [finding.id]:"Correction / Immediate Action is required."});
    }
    if (finding.finding_severity !== "observation" && !String(response.corrective_action || "").trim()) {
      return setResponseMessages({...responseMessages, [finding.id]:"Corrective Action is required for Minor and Major Findings."});
    }

    const { error } = await supabase.from("audit_findings").update({
      auditee_response: String(response.auditee_response).trim(),
      correction: String(response.correction).trim(),
      corrective_action: String(response.corrective_action || "").trim() || null,
      finding_status: "response_submitted",
    }).eq("id", finding.id).eq("tenant_id", audit.tenant_id);
    if (error) return setResponseMessages({...responseMessages, [finding.id]:error.message});

    const now = new Date().toISOString();
    await supabase.from("approval_tasks").update({
      status:"completed", completed_by:currentUserEmail, completed_at:now,
      completion_comment:"Finding response submitted for Lead Auditor verification."
    }).eq("entity_type","audit_finding").eq("entity_id",finding.id)
      .eq("task_type","audit_finding_response").eq("status","pending")
      .eq("assigned_to_email",currentUserEmail);

    const verifierEmail = String(audit.lead_auditor_email || "").trim().toLowerCase();
    if (!verifierEmail) return setResponseMessages({...responseMessages,[finding.id]:"Lead Auditor Email must be configured in Audit Planning before the response can be routed for verification."});
    const { data:existingVerification } = await supabase.from("approval_tasks").select("id,status").eq("entity_type","audit_finding").eq("entity_id",finding.id).eq("task_type","audit_finding_verification").eq("status","pending").maybeSingle();
    if (!existingVerification) {
      const { error: verificationTaskError } = await supabase.from("approval_tasks").insert({
        entity_type:"audit_finding", entity_id:finding.id, task_type:"audit_finding_verification",
        required_function:"Lead Auditor", assigned_to_email:verifierEmail, assigned_by_email:currentUserEmail || null,
        status:"pending", due_date:finding.response_due_date || null, record_number:audit.audit_number,
        task_title:`Audit Finding Response Verification — ${audit.audit_number || audit.audit_title}`,
        task_instructions:`Review the submitted response, correction, corrective action, and escalation evaluation for finding: ${finding.finding_title}. Accept and close or return for additional action.`
      });
      if (verificationTaskError) return setResponseMessages({...responseMessages,[finding.id]:verificationTaskError.message});
    }

    await supabase.rpc("qualisphere_add_audit_log", {
      p_entity_type:"audit_finding", p_entity_id:finding.id,
      p_action:"audit_finding_response_submitted",
      p_details:"Auditee response, correction, and corrective action were submitted for verification."
    });
    setResponseMessages({...responseMessages, [finding.id]:"Response submitted for verification."});
    await fetchData();
  };

  const verifyFinding = async (finding: any, decision: "accept" | "return") => {
    if (isLocked) return alert("This audit is locked and cannot be edited.");
    if (finding.finding_status !== "response_submitted") {
      return setVerificationMessages({...verificationMessages,[finding.id]:"A response must be submitted before verification."});
    }
    const { data:verificationTask } = await supabase.from("approval_tasks").select("*").eq("entity_type","audit_finding").eq("entity_id",finding.id).eq("task_type","audit_finding_verification").eq("status","pending").maybeSingle();
    if (!verificationTask || String(verificationTask.assigned_to_email || "").toLowerCase() !== currentUserEmail) {
      return setVerificationMessages({...verificationMessages,[finding.id]:"Only the assigned Lead Auditor can verify this finding from the routed My Workspace task."});
    }
    const escalationComplete = !!finding.linked_scar_id || !!finding.linked_capa_id || !!String(finding.escalation_justification || "").trim();
    if (finding.finding_severity === "major" && !escalationComplete) {
      return setVerificationMessages({...verificationMessages,[finding.id]:"Major Finding requires CAPA/SCAR linkage or a saved risk-based justification before verification can be completed."});
    }
    const notes = String(verificationNotes[finding.id] || "").trim();
    if (!notes) return setVerificationMessages({...verificationMessages,[finding.id]:"Verification Notes are required."});

    const { data:userData } = await supabase.auth.getUser();
    const email = userData?.user?.email || "";
    if (!email) return setVerificationMessages({...verificationMessages,[finding.id]:"Unable to verify the logged-in reviewer."});

    const now = new Date().toISOString();
    const update = decision === "accept"
      ? { verification_notes:notes, verified_by:email, verified_at:now, finding_status:"closed", closed_at:now }
      : { verification_notes:notes, verified_by:null, verified_at:null, finding_status:"returned_for_action", closed_at:null };

    const { error } = await supabase.from("audit_findings").update(update)
      .eq("id",finding.id).eq("tenant_id",audit.tenant_id);
    if (error) return setVerificationMessages({...verificationMessages,[finding.id]:error.message});

    const { error:verificationTaskUpdateError } = await supabase.from("approval_tasks").update({
      status: decision === "accept" ? "completed" : "rejected",
      approver_comment: notes,
      signed_by: email,
      signed_at: now,
      signature_meaning: decision === "accept" ? "Audit finding response verified and accepted." : "Audit finding response returned for additional action."
    }).eq("id",verificationTask.id);
    if (verificationTaskUpdateError) return setVerificationMessages({...verificationMessages,[finding.id]:verificationTaskUpdateError.message});

    if (decision === "return") {
      const findingOwner = String(finding.finding_owner || "").trim().toLowerCase();
      if (!findingOwner) return setVerificationMessages({...verificationMessages,[finding.id]:"Finding was returned, but Finding Owner email is missing."});
      const { data:existingResponseTask, error:existingResponseTaskError } = await supabase.from("approval_tasks")
        .select("id").eq("entity_type","audit_finding").eq("entity_id",finding.id)
        .eq("task_type","audit_finding_response").eq("status","pending").maybeSingle();
      if (existingResponseTaskError) return setVerificationMessages({...verificationMessages,[finding.id]:`Finding was returned, but QualiSphere could not check the Finding Owner task: ${existingResponseTaskError.message}`});
      if (!existingResponseTask) {
        const { error:returnTaskError } = await supabase.from("approval_tasks").insert({
          entity_type:"audit_finding", entity_id:finding.id, task_type:"audit_finding_response",
          required_function:"Finding Owner", assigned_to_email:findingOwner, assigned_by_email:email,
          status:"pending", due_date:finding.response_due_date || null, record_number:audit.audit_number,
          task_title:`Audit Finding Response — ${audit.audit_number || audit.audit_title}`,
          task_instructions:`Finding returned by Lead Auditor for additional action. Response Verification Notes: ${notes}`
        });
        if (returnTaskError) return setVerificationMessages({...verificationMessages,[finding.id]:`Finding was returned, but the Finding Owner Workspace task could not be created: ${returnTaskError.message}`});
      }
    }

    await supabase.rpc("qualisphere_add_audit_log", {
      p_entity_type:"audit_finding", p_entity_id:finding.id,
      p_action:decision === "accept" ? "audit_finding_verified_closed" : "audit_finding_returned_for_action",
      p_details:decision === "accept"
        ? `Finding response verified and finding closed by ${email}. Verification: ${notes}`
        : `Finding returned for additional action by ${email}. Verification: ${notes}`
    });
    setVerificationMessages({...verificationMessages,[finding.id]:decision === "accept" ? "Finding response verified and finding closed." : "Finding returned for additional action."});
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

  const submitAuditClosureApproval = async () => {
    if (isLocked) return alert("This audit is already closed and locked.");
    if (findings.some((finding:any)=>finding.finding_status !== "closed")) return setClosureMessage("All findings must be verified and closed before closure approval.");
    const approver = closureApproverEmail.trim().toLowerCase();
    if (!approver) return setClosureMessage("Closure Approver Email is required.");
    if (!closureDueDate) return setClosureMessage("Closure Approval Due Date is required.");
    const {data:userData}=await supabase.auth.getUser();
    const ownerEmail=(userData?.user?.email||"").toLowerCase();
    if (!ownerEmail) return setClosureMessage("Unable to identify the logged-in audit owner.");
    if (approver === ownerEmail) return setClosureMessage("Closure approver must be different from the submitting audit owner.");

    const pending = closureTasks.find((t:any)=>t.task_type==="audit_closure_approval" && t.status==="pending");
    if (pending) return setClosureMessage("A closure approval is already pending.");

    const ownerReturnTasks = closureTasks.filter((t:any)=>t.task_type==="audit_closure_rework" && t.status==="pending" && (t.assigned_to_email || "").toLowerCase()===ownerEmail);
    if (ownerReturnTasks.length > 0) {
      const now = new Date().toISOString();
      const { error: returnCompleteError } = await supabase.from("approval_tasks").update({
        status: "completed",
        completion_comment: "Audit closure rejection addressed and resubmitted for approval.",
        completed_by: ownerEmail,
        completed_at: now,
      }).in("id", ownerReturnTasks.map((t:any)=>t.id));
      if (returnCompleteError) return setClosureMessage(returnCompleteError.message);
    }

    const {error:taskError}=await supabase.from("approval_tasks").insert({
      entity_type:"audit", entity_id:id, task_type:"audit_closure_approval",
      required_function:"Audit Closure Approver", assigned_to_email:approver,
      assigned_by_email:ownerEmail, status:"pending", due_date:closureDueDate, record_number:audit.audit_number,
      task_title:`Audit Closure Approval — ${audit.audit_number || audit.audit_title}`,
      task_instructions:"Review the complete audit record, verified findings, responses, corrective actions, and escalation decisions. Approve or reject audit closure."
    });
    if(taskError) return setClosureMessage(taskError.message);
    const now=new Date().toISOString();
    const {error:auditError}=await supabase.from("audits").update({
      closure_approval_status:"pending",closure_approver_email:approver,
      closure_submitted_by:ownerEmail,closure_submitted_at:now,status:"pending_closure_approval"
    }).eq("id",id).eq("tenant_id",audit.tenant_id);
    if(auditError) return setClosureMessage(auditError.message);
    await supabase.rpc("qualisphere_add_audit_log",{p_entity_type:"audit",p_entity_id:id,p_action:"audit_closure_submitted_for_approval",p_details:`Audit closure submitted to ${approver}.`});
    setClosureMessage("Audit closure submitted to My Workspace.");
    await fetchData();
  };

  const decideAuditClosure = async (decision: "approved" | "rejected") => {
    const task = closureTasks.find((t:any) => t.status === "pending");
    if (!task) return setClosureMessage("No pending Audit Closure Approval task was found.");
    if ((task.assigned_to_email || "").toLowerCase() !== currentUserEmail) return setClosureMessage("Only the assigned closure approver can make this decision.");
    if (reviewerSignatureEmail.trim().toLowerCase() !== currentUserEmail) return setClosureMessage("Electronic signature email must match the logged-in reviewer.");
    if (decision === "rejected" && !reviewerComment.trim()) return setClosureMessage("Reviewer comment is required when rejecting audit closure.");
    if (!window.confirm(`Electronic Signature:\n\nI ${decision === "approved" ? "approve" : "reject"} closure of this audit.`)) return;
    const now = new Date().toISOString();
    const { error: taskError } = await supabase.from("approval_tasks").update({
      status: decision,
      approver_comment: reviewerComment,
      signature_meaning: `I ${decision === "approved" ? "approve" : "reject"} closure of this audit.`,
      signed_by: currentUserEmail,
      signed_at: now,
    }).eq("id", task.id).eq("assigned_to_email", task.assigned_to_email);
    if (taskError) return setClosureMessage(taskError.message);
    const auditUpdate = decision === "approved"
      ? { closure_approval_status:"approved", closure_decision_comment:reviewerComment, status:"closed", closed_at:now, closed_by:currentUserEmail, signed_by:currentUserEmail, signed_at:now, signature_meaning:"Audit closure approved through Audit Review Package.", signature_email_entered:currentUserEmail, is_locked:true, locked_at:now, locked_by:currentUserEmail }
      : { closure_approval_status:"rejected", closure_decision_comment:reviewerComment, status:"execution_complete" };
    const { error: auditError } = await supabase.from("audits").update(auditUpdate).eq("id", id).eq("tenant_id", audit.tenant_id);
    if (auditError) return setClosureMessage(auditError.message);
    if (decision === "approved") {
      const { error: staleReturnError } = await supabase.from("approval_tasks").update({
        status: "completed",
        completion_comment: "Superseded by final Audit closure approval.",
        completed_by: currentUserEmail,
        completed_at: now,
      }).eq("entity_type", "audit").eq("entity_id", id).eq("task_type", "audit_closure_rework").eq("status", "pending");
      if (staleReturnError) return setClosureMessage(`Audit closure approved, but owner return-task cleanup failed: ${staleReturnError.message}`);
    }
    if (decision === "rejected") {
      const returnOwner = String(audit.closure_submitted_by || task.assigned_by_email || "").trim().toLowerCase();
      if (!returnOwner) return setClosureMessage("Audit closure was rejected, but the original submitter could not be identified for return.");
      const existingReturn = closureTasks.find((t:any) => t.task_type === "audit_closure_rework" && t.status === "pending");
      if (!existingReturn) {
        const { error: returnTaskError } = await supabase.from("approval_tasks").insert({
          entity_type: "audit",
          entity_id: id,
          task_type: "audit_closure_rework",
          required_function: "Audit Owner",
          assigned_to_email: returnOwner,
          assigned_by_email: currentUserEmail,
          status: "pending",
          record_number: audit.audit_number,
          task_title: `Audit Closure Rejected — Action Required — ${audit.audit_number || audit.audit_title}`,
          task_instructions: `Audit closure was rejected by ${currentUserEmail}. Reviewer comment: ${reviewerComment}. Review the audit, address the rejection, and resubmit closure approval.`,
          comments: reviewerComment,
        });
        if (returnTaskError) return setClosureMessage(`Audit closure was rejected, but the return-to-owner task could not be created: ${returnTaskError.message}`);
      }
    }
    await supabase.rpc("qualisphere_add_audit_log",{p_entity_type:"audit",p_entity_id:id,p_action:`audit_closure_${decision}`,p_details:`Audit closure ${decision} by ${currentUserEmail}. Comment: ${reviewerComment || "N/A"}`});
    setClosureMessage(`Audit closure ${decision}.`);
    setReviewerComment("");
    setReviewerSignatureEmail("");
    await fetchData();
  };

  return (
    <main style={{ padding: 30, fontFamily: "Arial, sans-serif" }}>
      <div style={{ marginBottom: "16px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
        <button onClick={() => window.open(`/audits/${id}/report`, "_blank")} style={primaryButtonStyle}>
          Audit Report
        </button>

        <Link href="/audits">Back to Audits</Link>
      </div>

      <h1>Audit Workflow</h1>

      {isPendingClosureApproval && (
        <div style={{padding:"12px",background:"#fffbeb",border:"1px solid #f59e0b",borderRadius:"8px",marginBottom:"16px",fontWeight:600}}>
          🔒 Closure approval is pending. This submitted audit package is read-only until the reviewer approves or rejects it.
        </div>
      )}

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

              <div style={{ borderTop:"1px solid #e5e7eb", paddingTop:"12px", marginTop:"12px" }}>
                <h4 style={{marginTop:0}}>4. Finding Response / Corrective Action</h4>
                {String(f.finding_owner || "").trim().toLowerCase() !== currentUserEmail && f.finding_status !== "closed" && (
                  <p><StatusBadge status={f.finding_status || "open"} /> Response is assigned to <strong>{f.finding_owner}</strong> through My Workspace.</p>
                )}
                <FormField label="Auditee Response">
                  <textarea value={findingResponses[f.id]?.auditee_response || ""} onChange={(e)=>setFindingResponses({...findingResponses,[f.id]:{...(findingResponses[f.id]||{}),auditee_response:e.target.value}})} disabled={isLocked || f.finding_status === "closed" || String(f.finding_owner || "").trim().toLowerCase() !== currentUserEmail} rows={4} style={standardTextareaStyle}/>
                </FormField>
                <FormField label="Correction / Immediate Action">
                  <textarea value={findingResponses[f.id]?.correction || ""} onChange={(e)=>setFindingResponses({...findingResponses,[f.id]:{...(findingResponses[f.id]||{}),correction:e.target.value}})} disabled={isLocked || f.finding_status === "closed" || String(f.finding_owner || "").trim().toLowerCase() !== currentUserEmail} rows={4} style={standardTextareaStyle}/>
                </FormField>
                <FormField label={f.finding_severity === "observation" ? "Corrective Action (Optional for Observation)" : "Corrective Action"}>
                  <textarea value={findingResponses[f.id]?.corrective_action || ""} onChange={(e)=>setFindingResponses({...findingResponses,[f.id]:{...(findingResponses[f.id]||{}),corrective_action:e.target.value}})} disabled={isLocked || f.finding_status === "closed" || String(f.finding_owner || "").trim().toLowerCase() !== currentUserEmail} rows={4} style={standardTextareaStyle}/>
                </FormField>
                {!isLocked && f.finding_status !== "closed" && String(f.finding_owner || "").trim().toLowerCase() === currentUserEmail && <button type="button" onClick={()=>saveFindingResponse(f)} style={primaryButtonStyle}>Submit Response for Verification</button>}
                {responseMessages[f.id] && <p style={{fontWeight:600}}>{responseMessages[f.id]}</p>}
              </div>

              <div style={{ borderTop:"1px solid #e5e7eb", paddingTop:"12px", marginTop:"12px" }}>
                <h4 style={{marginTop:0}}>5. Response Verification</h4>
                {f.finding_status === "closed" ? (
                  <>
                    <p><strong>Verification:</strong> <StatusBadge status="Verified / Closed" /></p>
                    <p><strong>Verification Notes:</strong> {f.verification_notes || "N/A"}</p>
                    <p><strong>Verified By:</strong> {f.verified_by || "N/A"}</p>
                    <p><strong>Verified At:</strong> {f.verified_at || "N/A"}</p>
                  </>
                ) : (
                  <>
                    <FormField label="Verification Notes">
                      <textarea value={verificationNotes[f.id] || ""} onChange={(e)=>setVerificationNotes({...verificationNotes,[f.id]:e.target.value})} disabled={isLocked || f.finding_status !== "response_submitted"} rows={4} style={standardTextareaStyle}/>
                    </FormField>
                    {f.finding_status === "response_submitted" ? (
                      <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
                        <button type="button" onClick={()=>verifyFinding(f,"accept")} disabled={isLocked} style={primaryButtonStyle}>Accept & Close Finding</button>
                        <button type="button" onClick={()=>verifyFinding(f,"return")} disabled={isLocked}>Return for Additional Action</button>
                      </div>
                    ) : <p><StatusBadge status={f.finding_status || "open"} /> Submit the finding response before verification.</p>}
                    {verificationMessages[f.id] && <p style={{fontWeight:600}}>{verificationMessages[f.id]}</p>}
                  </>
                )}
              </div>

              <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "12px", marginTop: "12px" }}><h4 style={{marginTop:0}}>Escalation Evaluation — Complete Before Response Verification</h4><div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button type="button" onClick={() => createScarFromFinding(f)} disabled={isLocked || !!f.linked_scar_id}>
                  Create Linked SCAR
                </button>

                <button type="button" onClick={() => createCapaFromFinding(f)} disabled={isLocked || !!f.linked_capa_id}>
                  Create Linked CAPA
                </button>
              </div></div>

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
      </section>      <section style={sectionStyle}>
        <h2 style={{marginTop:0}}>6. Audit Closure Approval</h2>
        <p><strong>Closure Approval Status:</strong> <StatusBadge status={audit.closure_approval_status || "not_submitted"} /></p>
        <p><strong>Submitted By:</strong> {audit.closure_submitted_by || "N/A"}</p>
        <p><strong>Submitted At:</strong> {audit.closure_submitted_at || "N/A"}</p>
        <p><strong>Closure Approver:</strong> {audit.closure_approver_email || "N/A"}</p>
        {(() => {
          const currentClosureTask = closureTasks
            .filter((task:any) => task.task_type === "audit_closure_approval")
            .sort((a:any,b:any) => String(b.created_at || "").localeCompare(String(a.created_at || "")))[0];
          if (!currentClosureTask) return null;
          return (
            <div style={{marginBottom:"12px"}}>
              <h3>Reviewer Approval Status</h3>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",border:"1px solid #dbe3ee"}}>
                  <thead>
                    <tr>
                      <th style={{padding:"9px",textAlign:"left",background:"#f8fafc",borderBottom:"1px solid #dbe3ee"}}>Function</th>
                      <th style={{padding:"9px",textAlign:"left",background:"#f8fafc",borderBottom:"1px solid #dbe3ee"}}>Approver</th>
                      <th style={{padding:"9px",textAlign:"left",background:"#f8fafc",borderBottom:"1px solid #dbe3ee"}}>Email</th>
                      <th style={{padding:"9px",textAlign:"left",background:"#f8fafc",borderBottom:"1px solid #dbe3ee"}}>Status</th>
                      <th style={{padding:"9px",textAlign:"left",background:"#f8fafc",borderBottom:"1px solid #dbe3ee"}}>Decision Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{padding:"9px"}}>{currentClosureTask.required_function || "Audit Closure Approver"}</td>
                      <td style={{padding:"9px"}}>{currentClosureTask.assigned_to_name || currentClosureTask.assigned_to_email?.split("@")[0] || "—"}</td>
                      <td style={{padding:"9px"}}>{currentClosureTask.assigned_to_email || "—"}</td>
                      <td style={{padding:"9px"}}><StatusBadge status={currentClosureTask.status}/></td>
                      <td style={{padding:"9px"}}>{currentClosureTask.signed_at ? new Date(currentClosureTask.signed_at).toLocaleString() : "—"}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}
        {!isLocked && audit.closure_approval_status !== "pending" && audit.closure_approval_status !== "approved" && (
          <>
            <FormField label="Closure Approver Email"><input type="email" value={closureApproverEmail} onChange={(e)=>setClosureApproverEmail(e.target.value)} style={inputStyle}/></FormField>
            <FormField label="Closure Approval Due Date"><input type="date" value={closureDueDate} onChange={(e)=>setClosureDueDate(e.target.value)} style={inputStyle}/></FormField>
            <button type="button" onClick={submitAuditClosureApproval} style={primaryButtonStyle}>Submit Audit for Closure Approval</button>
          </>
        )}
        {audit.closure_approval_status === "pending" && closureTasks.some((t:any) => t.status === "pending" && (t.assigned_to_email || "").toLowerCase() === currentUserEmail) && (
          <div style={{marginTop:"18px",padding:"16px",border:"2px solid #2563eb",borderRadius:"10px",background:"#eff6ff"}}>
            <h3 style={{marginTop:0}}>Reviewer Decision</h3>
            <p>Review the complete read-only audit package above, then approve or reject closure.</p>
            <FormField label="Reviewer Comment">
              <textarea value={reviewerComment} onChange={(e)=>setReviewerComment(e.target.value)} rows={4} style={standardTextareaStyle} placeholder="Enter approval comment or rejection rationale. Required for rejection." />
            </FormField>
            <FormField label="Re-enter Your Email for E-Signature">
              <input type="email" value={reviewerSignatureEmail} onChange={(e)=>setReviewerSignatureEmail(e.target.value)} style={inputStyle} />
            </FormField>
            <div style={{display:"flex",gap:"10px",flexWrap:"wrap"}}>
              <button type="button" onClick={()=>decideAuditClosure("approved")} style={primaryButtonStyle}>Approve Audit Closure</button>
              <button type="button" onClick={()=>decideAuditClosure("rejected")}>Reject Audit Closure</button>
            </div>
          </div>
        )}
        {closureMessage && <p style={{fontWeight:600}}>{closureMessage}</p>}
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
