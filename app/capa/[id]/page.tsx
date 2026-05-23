"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import { createNotification, createRoleNotifications, normalizeEmail } from "../../../lib/notifications";

type WorkflowStage = {
  key: string;
  label: string;
  completed: boolean;
  locked?: boolean;
  status?: string;
};

type CapaTask = {
  id: string;
  capa_id: string;
  task_type: string | null;
  task_title: string | null;
  task_description: string | null;
  owner: string | null;
  owner_email: string | null;
  due_date: string | null;
  status: string | null;
  completion_evidence: string | null;
  completed_by: string | null;
  completed_at: string | null;
  signature_meaning: string | null;
  sequence_order: number | null;
  created_at: string | null;
  created_by: string | null;
};

export default function EnterpriseCapaWorkflowPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [record, setRecord] = useState<any>(null);
  const [tasks, setTasks] = useState<CapaTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingField, setSavingField] = useState("");

  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState("");

  const [activeSection, setActiveSection] = useState("intake");
  const [expandedSections, setExpandedSections] = useState<string[]>([
    "intake",
  ]);

  const [investigationApprovalComments, setInvestigationApprovalComments] =
    useState("");
  const [closureApprovalComments, setClosureApprovalComments] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [cancellationJustification, setCancellationJustification] =
    useState("");

  const [newTask, setNewTask] = useState({
    task_type: "corrective_action",
    task_title: "",
    task_description: "",
    owner: "",
    due_date: "",
  });

  const [taskEvidence, setTaskEvidence] = useState<Record<string, string>>({});

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

  const fetchTasks = async () => {
    if (!id) return;

    const { data, error } = await supabase
      .from("capa_tasks")
      .select("*")
      .eq("capa_id", id)
      .order("sequence_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setTasks((data as CapaTask[]) || []);
  };

  useEffect(() => {
    if (id) {
      fetchUserRole();
      fetchRecord();
      fetchTasks();
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


  const notifyCapaOwner = async ({
    title,
    message,
    notificationType,
    severity = "info",
  }: {
    title: string;
    message: string;
    notificationType: string;
    severity?: "info" | "medium" | "high" | "critical";
  }) => {
    const ownerEmail =
      normalizeEmail(record?.owner_email) ||
      normalizeEmail(record?.owner) ||
      normalizeEmail(userEmail);

    await createNotification({
      userEmail: ownerEmail,
      title,
      message,
      notificationType,
      severity,
      relatedRecordId: id,
      relatedModule: "capa",
      relatedUrl: `/capa/${id}`,
      createdBy: userEmail,
    });
  };

  const notifyApprovers = async ({
    title,
    message,
    notificationType,
    severity = "medium",
  }: {
    title: string;
    message: string;
    notificationType: string;
    severity?: "info" | "medium" | "high" | "critical";
  }) => {
    if (normalizeEmail(record?.investigation_approver_email)) {
      await createNotification({
        userEmail: record.investigation_approver_email,
        assignedRole: "approver",
        title,
        message,
        notificationType,
        severity,
        relatedRecordId: id,
        relatedModule: "capa",
        relatedUrl: `/capa/${id}`,
        createdBy: userEmail,
      });
    }

    await createRoleNotifications({
      role: "approver",
      title,
      message,
      notificationType,
      severity,
      relatedRecordId: id,
      relatedModule: "capa",
      relatedUrl: `/capa/${id}`,
      createdBy: userEmail,
    });

    await createRoleNotifications({
      role: "vp_quality",
      title,
      message,
      notificationType,
      severity,
      relatedRecordId: id,
      relatedModule: "capa",
      relatedUrl: `/capa/${id}`,
      createdBy: userEmail,
    });
  };

  const toggleSection = (key: string) => {
    setActiveSection(key);

    setExpandedSections((prev) =>
      prev.includes(key)
        ? prev.filter((section) => section !== key)
        : [...prev, key]
    );
  };

  const expandSection = (key: string) => {
    setActiveSection(key);

    setExpandedSections((prev) =>
      prev.includes(key) ? prev : [...prev, key]
    );
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

    setSavingField(field);

    const { error } = await supabase
      .from("capas")
      .update({ [field]: value || null })
      .eq("id", id);

    setSavingField("");

    if (error) {
      alert(error.message);
      return;
    }

    await addAuditLog("field_saved", `CAPA field saved: ${field}`);
    fetchRecord();
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
        problem_statement: record.problem_description || null,
        detection_source: record.detection_source || null,
        capa_classification: record.capa_classification || null,

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
        investigation:
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
        implementation_evidence:
          record.implementation_evidence || record.implementation_details || null,

        monitoring_method: record.monitoring_method || null,
        monitoring_period: record.monitoring_period || null,
        effectiveness_plan:
          record.monitoring_method || record.effectiveness_plan || null,
        effectiveness_check: record.effectiveness_check || null,
        effectiveness_rating: record.effectiveness_rating || null,
        effectiveness_result: record.effectiveness_rating || null,
        recurrence_detected: record.recurrence_detected || null,
        followup_capa_required: record.followup_capa_required || null,
        effectiveness_followup_action:
          record.effectiveness_followup_action || null,
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

  const createTask = async () => {
    if (isLocked) {
      alert("This CAPA record is locked and cannot be edited.");
      return;
    }

    if (implementationLocked) {
      alert(
        "Task creation is locked until investigation approval is complete."
      );
      return;
    }

    if (!newTask.task_title.trim()) {
      alert("Task title is required.");
      return;
    }

    const { error } = await supabase.from("capa_tasks").insert({
      capa_id: id,
      task_type: newTask.task_type,
      task_title: newTask.task_title,
      task_description: newTask.task_description || null,
      owner: newTask.owner || null,
      owner_email: normalizeEmail(newTask.owner),
      due_date: newTask.due_date || null,
      status: "open",
      created_by: userEmail || "unknown",
      sequence_order: tasks.length + 1,
    });

    if (error) {
      alert(error.message);
      return;
    }

    await addAuditLog(
      "task_created",
      `CAPA task created: ${newTask.task_title}`
    );

    await createNotification({
      userEmail: normalizeEmail(newTask.owner),
      title: "CAPA Task Assigned",
      message: `You have been assigned a CAPA task: ${newTask.task_title}`,
      notificationType: "task_assigned",
      severity: "medium",
      relatedRecordId: id,
      relatedModule: "capa",
      relatedUrl: `/capa/${id}`,
      createdBy: userEmail,
    });

    setNewTask({
      task_type: "corrective_action",
      task_title: "",
      task_description: "",
      owner: "",
      due_date: "",
    });

    fetchTasks();
  };

  const updateTaskStatus = async (task: CapaTask, status: string) => {
    if (isLocked) {
      alert("This CAPA record is locked and cannot be edited.");
      return;
    }

    const { error } = await supabase
      .from("capa_tasks")
      .update({ status })
      .eq("id", task.id);

    if (error) {
      alert(error.message);
      return;
    }

    await addAuditLog(
      "task_status_changed",
      `CAPA task status changed to ${status}: ${task.task_title}`
    );

    if (status === "blocked" || status === "pending_review") {
      await createNotification({
        userEmail: normalizeEmail(task.owner_email) || normalizeEmail(task.owner),
        title: status === "blocked" ? "CAPA Task Blocked" : "CAPA Task Pending Review",
        message: `Task "${task.task_title}" is now ${status}.`,
        notificationType: status === "blocked" ? "task_blocked" : "task_pending_review",
        severity: status === "blocked" ? "high" : "medium",
        relatedRecordId: id,
        relatedModule: "capa",
        relatedUrl: `/capa/${id}`,
        createdBy: userEmail,
      });
    }

    fetchTasks();
  };

  const completeTask = async (task: CapaTask) => {
    if (isLocked) {
      alert("This CAPA record is locked and cannot be edited.");
      return;
    }

    const evidence = taskEvidence[task.id] || task.completion_evidence || "";

    if (!evidence.trim()) {
      alert("Completion evidence is required before task completion.");
      return;
    }

    const confirmed = window.confirm(
      "Electronic Signature:\n\nI confirm this CAPA task was completed and completion evidence was reviewed."
    );

    if (!confirmed) return;

    const signatureMeaning =
      "I confirm this CAPA task was completed and completion evidence was reviewed.";

    const { error } = await supabase
      .from("capa_tasks")
      .update({
        status: "complete",
        completion_evidence: evidence,
        completed_by: userEmail || "unknown",
        completed_at: new Date().toISOString(),
        signature_meaning: signatureMeaning,
      })
      .eq("id", task.id);

    if (error) {
      alert(error.message);
      return;
    }

    await addAuditLog(
      "task_completed_signed",
      `CAPA task completed with electronic signature: ${task.task_title}`
    );

    setTaskEvidence((prev) => ({
      ...prev,
      [task.id]: "",
    }));

    fetchTasks();
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

    await notifyApprovers({
      title: "CAPA Investigation Approval Required",
      message: `${record?.capa_number || "CAPA"} requires investigation/root cause approval.`,
      notificationType: "investigation_approval_required",
      severity: record?.severity === "critical" || record?.risk_level === "critical" ? "critical" : "medium",
    });

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

    await notifyCapaOwner({
      title: "CAPA Investigation Approved",
      message: `${record?.capa_number || "CAPA"} investigation was approved. Corrective action and task execution are now available.`,
      notificationType: "investigation_approved",
      severity: "info",
    });

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

    const confirmed = window.confirm(
      "Reject investigation package and return for revision?"
    );
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

    await notifyCapaOwner({
      title: "CAPA Investigation Rejected",
      message: `${record?.capa_number || "CAPA"} investigation was rejected. Comments: ${investigationApprovalComments}`,
      notificationType: "investigation_rejected",
      severity: "high",
    });

    alert("Investigation package rejected.");
    fetchRecord();
  };

  const markImplemented = async () => {
    if (implementationLocked) {
      alert(
        "Corrective action and implementation are locked until investigation approval is complete."
      );
      return;
    }

    if (!record?.corrective_action_plan) {
      return alert("Corrective action is required.");
    }

    if (!record?.implementation_details) {
      return alert("Implementation evidence is required.");
    }

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

  const incompleteTasks = tasks.filter((task) => task.status !== "complete");
  const overdueTasks = tasks.filter((task) => isTaskOverdue(task));
  const tasksComplete = tasks.length === 0 || incompleteTasks.length === 0;

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

    if (!tasksComplete) {
      alert("All CAPA execution tasks must be completed before closure approval.");
      return;
    }

    if (!record?.effectiveness_rating) {
      return alert("Effectiveness rating is required.");
    }

    if (!record?.effectiveness_check) {
      return alert("Effectiveness results are required.");
    }

    if (
      (record.effectiveness_rating === "partially_effective" ||
        record.effectiveness_rating === "not_effective") &&
      !record.effectiveness_followup_action
    ) {
      alert(
        "Follow-up action is required for partially effective or not effective CAPAs."
      );
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

    await notifyApprovers({
      title: "CAPA Closure Approval Required",
      message: `${record?.capa_number || "CAPA"} is ready for final closure approval.`,
      notificationType: "closure_approval_required",
      severity: "medium",
    });

    alert("CAPA submitted for closure approval.");
    fetchRecord();
  };

  const approveClosure = async () => {
    if (!canApprove) {
      alert("Only an approver or VP Quality can approve closure.");
      return;
    }

    if (!tasksComplete) {
      alert("All CAPA execution tasks must be completed before closure approval.");
      return;
    }

    const confirmed = window.confirm(
      "Electronic Signature:\n\nApprove final CAPA closure and permanently lock this CAPA record?"
    );

    if (!confirmed) return;

    const now = new Date().toISOString();

    const signatureMeaning =
      "I approve final CAPA closure and confirm the intake, scope, containment, investigation, root cause, risk assessment, corrective action, implementation, effectiveness verification, execution tasks, and closure review are complete.";

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

    await notifyCapaOwner({
      title: "CAPA Closed and Locked",
      message: `${record?.capa_number || "CAPA"} has been approved, closed, electronically signed, and locked.`,
      notificationType: "capa_closed",
      severity: "info",
    });

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

    const confirmed = window.confirm(
      "Reject closure and return to effectiveness review?"
    );
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

    await notifyCapaOwner({
      title: "CAPA Closure Rejected",
      message: `${record?.capa_number || "CAPA"} closure was rejected. Comments: ${closureApprovalComments}`,
      notificationType: "closure_rejected",
      severity: "high",
    });

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
      {
        key: "intake",
        label: "Intake",
        completed: Boolean(record?.problem_description),
      },
      {
        key: "scope",
        label: "Scope",
        completed: Boolean(record?.scope_summary),
      },
      {
        key: "containment",
        label: "Containment",
        completed: Boolean(record?.containment_action),
      },
      {
        key: "investigation",
        label: "Investigation",
        completed: Boolean(
          record?.investigation_findings || record?.investigation_summary
        ),
      },
      {
        key: "rootcause",
        label: "Root Cause",
        completed: Boolean(record?.root_cause),
      },
      {
        key: "risk",
        label: "Risk / Severity",
        completed: Boolean(record?.severity && record?.risk_level),
      },
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
        key: "tasks",
        label: "Execution Tasks",
        completed: tasks.length > 0 && tasksComplete,
        locked: implementationLocked,
        status: `${tasks.length} task(s)`,
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
    [
      record,
      investigationApproved,
      closureApproved,
      implementationLocked,
      tasks,
      tasksComplete,
    ]
  );

  const workflowHealth = getWorkflowHealth(record, overdueTasks.length);
  const riskColor = getRiskColor(record?.risk_level || record?.severity);

  if (loading) {
    return (
      <main style={{ padding: "24px", fontFamily: "Arial" }}>
        Loading CAPA workflow...
      </main>
    );
  }

  if (!record) {
    return (
      <main style={{ padding: "24px", fontFamily: "Arial" }}>
        CAPA not found.
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <style>{`
        @media print {
          button, .no-print {
            display: none !important;
          }
          main {
            background: white !important;
            padding: 0 !important;
          }
          section, aside {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>

      <section style={headerCardStyle}>
        <div>
          <div style={eyebrowStyle}>ENTERPRISE CAPA EXECUTION WORKSPACE</div>
          <h1 style={{ margin: "6px 0" }}>
            {record.capa_number || "CAPA-PENDING"} —{" "}
            {record.title || "Untitled CAPA"}
          </h1>
          <p style={subtleText}>
            Intake → Scope → Containment → Investigation → Root Cause → Risk /
            Severity → Approval → Action → Tasks → Implementation →
            Effectiveness → Closure.
          </p>
        </div>

        <div style={buttonRowStyle} className="no-print">
          <button onClick={() => window.print()} style={secondaryButtonStyle}>
            Print Workflow
          </button>
          <button
            onClick={saveAll}
            disabled={isLocked}
            style={buttonDisabledStyle(isLocked)}
          >
            Save All
          </button>
          <Link href="/capa" style={darkButtonStyle}>
            Back
          </Link>
        </div>
      </section>

      <section
        style={{
          ...healthBannerStyle,
          borderLeft: `8px solid ${workflowHealth.color}`,
        }}
      >
        <div>
          <div style={bannerLabelStyle}>CAPA WORKFLOW HEALTH</div>
          <div
            style={{
              fontSize: "30px",
              fontWeight: 800,
              color: workflowHealth.color,
            }}
          >
            {workflowHealth.label}
          </div>
        </div>

        <div style={badgeRowStyle}>
          <Badge label={record.status || "unknown"} color="#2563eb" />
          <Badge label={`Risk: ${record.risk_level || "Not Rated"}`} color={riskColor} />
          <Badge
            label={`Severity: ${record.severity || "Not Rated"}`}
            color={getRiskColor(record.severity)}
          />
          <Badge
            label={`Tasks: ${tasks.length - incompleteTasks.length}/${tasks.length}`}
            color={incompleteTasks.length === 0 ? "#15803d" : "#d97706"}
          />
          <Badge
            label={`Overdue Tasks: ${overdueTasks.length}`}
            color={overdueTasks.length > 0 ? "#dc2626" : "#15803d"}
          />
          <Badge
            label={`Investigation: ${
              record.investigation_approval_status || "not_submitted"
            }`}
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
          🔒 CAPA RECORD LOCKED —{" "}
          {record.status === "cancelled"
            ? "Cancelled"
            : "Approved and closed"}{" "}
          quality record.
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

          {stages.map((stage, index) => (
            <button
              key={stage.key}
              onClick={() => toggleSection(stage.key)}
              style={{
                ...railItemStyle,
                borderLeft: `6px solid ${
                  stage.completed
                    ? "#15803d"
                    : stage.locked
                    ? "#9ca3af"
                    : "#d97706"
                }`,
                background: activeSection === stage.key ? "#eff6ff" : "white",
              }}
            >
              <div style={{ fontWeight: 700 }}>
                {expandedSections.includes(stage.key) ? "▼" : "▶"}{" "}
                {stage.completed ? "✓" : stage.locked ? "🔒" : "•"}{" "}
                {index + 1}. {stage.label}
              </div>
              <div
                style={{
                  color: "#6b7280",
                  fontSize: "12px",
                  marginTop: "4px",
                }}
              >
                {stage.completed
                  ? "Complete"
                  : stage.locked
                  ? "Locked"
                  : stage.status || "Pending"}
              </div>
            </button>
          ))}
        </aside>

        <div>
          <WorkflowCard
            sectionKey="intake"
            title="1. Intake"
            subtitle="Capture the issue and source of detection."
            expanded={expandedSections.includes("intake")}
            onToggle={() => toggleSection("intake")}
          >
            <Field label="Issue Summary">
              <textarea
                value={record.problem_description || ""}
                onChange={(e) =>
                  updateField("problem_description", e.target.value)
                }
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

          <WorkflowCard
            sectionKey="scope"
            title="2. Scope"
            subtitle="Define affected product, lot, process, supplier, and potential impact."
            expanded={expandedSections.includes("scope")}
            onToggle={() => toggleSection("scope")}
          >
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
              <Field label="Affected Product">
                <input
                  value={record.affected_product || ""}
                  onChange={(e) => updateField("affected_product", e.target.value)}
                  onBlur={(e) => saveField("affected_product", e.target.value)}
                  disabled={isLocked}
                  style={inputStyle(isLocked)}
                />
              </Field>

              <Field label="Affected Lot">
                <input
                  value={record.affected_lot || ""}
                  onChange={(e) => updateField("affected_lot", e.target.value)}
                  onBlur={(e) => saveField("affected_lot", e.target.value)}
                  disabled={isLocked}
                  style={inputStyle(isLocked)}
                />
              </Field>

              <Field label="Affected Process">
                <input
                  value={record.affected_process || ""}
                  onChange={(e) => updateField("affected_process", e.target.value)}
                  onBlur={(e) => saveField("affected_process", e.target.value)}
                  disabled={isLocked}
                  style={inputStyle(isLocked)}
                />
              </Field>

              <Field label="Affected Supplier">
                <input
                  value={record.affected_supplier || record.supplier_name || ""}
                  onChange={(e) => updateField("affected_supplier", e.target.value)}
                  onBlur={(e) => saveField("affected_supplier", e.target.value)}
                  disabled={isLocked}
                  style={inputStyle(isLocked)}
                />
              </Field>
            </div>

            <Field label="Potential Impact">
              <textarea
                value={record.potential_impact || ""}
                onChange={(e) => updateField("potential_impact", e.target.value)}
                onBlur={(e) => saveField("potential_impact", e.target.value)}
                disabled={isLocked}
                rows={3}
                style={textareaStyle(isLocked)}
              />
            </Field>
          </WorkflowCard>

          <WorkflowCard
            sectionKey="containment"
            title="3. Containment"
            subtitle="Define immediate correction, containment owner, and residual risk."
            expanded={expandedSections.includes("containment")}
            onToggle={() => toggleSection("containment")}
          >
            <div style={formGridStyle}>
              <Field label="Containment Action">
                <textarea
                  value={record.containment_action || ""}
                  onChange={(e) => updateField("containment_action", e.target.value)}
                  onBlur={(e) => saveField("containment_action", e.target.value)}
                  disabled={isLocked}
                  rows={4}
                  style={textareaStyle(isLocked)}
                />
              </Field>

              <Field label="Containment Owner">
                <input
                  value={record.containment_owner || ""}
                  onChange={(e) => updateField("containment_owner", e.target.value)}
                  onBlur={(e) => saveField("containment_owner", e.target.value)}
                  disabled={isLocked}
                  style={inputStyle(isLocked)}
                />
              </Field>

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

            <Field label="Residual Risk After Containment">
              <textarea
                value={record.containment_residual_risk || ""}
                onChange={(e) =>
                  updateField("containment_residual_risk", e.target.value)
                }
                onBlur={(e) =>
                  saveField("containment_residual_risk", e.target.value)
                }
                disabled={isLocked}
                rows={3}
                style={textareaStyle(isLocked)}
              />
            </Field>
          </WorkflowCard>

          <WorkflowCard
            sectionKey="investigation"
            title="4. Investigation"
            subtitle="Document objective, evidence reviewed, findings, and conclusion."
            expanded={expandedSections.includes("investigation")}
            onToggle={() => toggleSection("investigation")}
          >
            <div style={formGridStyle}>
              <Field label="Investigation Objective">
                <textarea
                  value={record.investigation_objective || ""}
                  onChange={(e) =>
                    updateField("investigation_objective", e.target.value)
                  }
                  onBlur={(e) =>
                    saveField("investigation_objective", e.target.value)
                  }
                  disabled={isLocked}
                  rows={3}
                  style={textareaStyle(isLocked)}
                />
              </Field>

              <Field label="Evidence Reviewed">
                <textarea
                  value={record.evidence_reviewed || ""}
                  onChange={(e) => updateField("evidence_reviewed", e.target.value)}
                  onBlur={(e) => saveField("evidence_reviewed", e.target.value)}
                  disabled={isLocked}
                  rows={3}
                  style={textareaStyle(isLocked)}
                />
              </Field>

              <Field label="Investigation Findings">
                <textarea
                  value={
                    record.investigation_findings ||
                    record.investigation_summary ||
                    ""
                  }
                  onChange={(e) =>
                    updateField("investigation_findings", e.target.value)
                  }
                  onBlur={(e) =>
                    saveField("investigation_findings", e.target.value)
                  }
                  disabled={isLocked}
                  rows={4}
                  style={textareaStyle(isLocked)}
                />
              </Field>

              <Field label="Investigation Conclusion">
                <textarea
                  value={record.investigation_conclusion || ""}
                  onChange={(e) =>
                    updateField("investigation_conclusion", e.target.value)
                  }
                  onBlur={(e) =>
                    saveField("investigation_conclusion", e.target.value)
                  }
                  disabled={isLocked}
                  rows={3}
                  style={textareaStyle(isLocked)}
                />
              </Field>
            </div>
          </WorkflowCard>

          <WorkflowCard
            sectionKey="rootcause"
            title="5. Root Cause"
            subtitle="Document root cause method, contributing factors, verification, and systemic impact."
            expanded={expandedSections.includes("rootcause")}
            onToggle={() => toggleSection("rootcause")}
          >
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

              <Field label="Primary Root Cause">
                <textarea
                  value={record.root_cause || ""}
                  onChange={(e) => updateField("root_cause", e.target.value)}
                  onBlur={(e) => saveField("root_cause", e.target.value)}
                  disabled={isLocked}
                  rows={4}
                  style={textareaStyle(isLocked)}
                />
              </Field>

              <Field label="Contributing Factors">
                <textarea
                  value={record.contributing_factors || ""}
                  onChange={(e) =>
                    updateField("contributing_factors", e.target.value)
                  }
                  onBlur={(e) => saveField("contributing_factors", e.target.value)}
                  disabled={isLocked}
                  rows={3}
                  style={textareaStyle(isLocked)}
                />
              </Field>

              <Field label="Root Cause Verification Evidence">
                <textarea
                  value={record.root_cause_verification || ""}
                  onChange={(e) =>
                    updateField("root_cause_verification", e.target.value)
                  }
                  onBlur={(e) =>
                    saveField("root_cause_verification", e.target.value)
                  }
                  disabled={isLocked}
                  rows={3}
                  style={textareaStyle(isLocked)}
                />
              </Field>

              <Field label="Systemic Impact">
                <textarea
                  value={record.systemic_impact || ""}
                  onChange={(e) => updateField("systemic_impact", e.target.value)}
                  onBlur={(e) => saveField("systemic_impact", e.target.value)}
                  disabled={isLocked}
                  rows={3}
                  style={textareaStyle(isLocked)}
                />
              </Field>
            </div>
          </WorkflowCard>

          <WorkflowCard
            sectionKey="risk"
            title="6. Risk Assessment / Severity"
            subtitle="Assess severity, occurrence, detection, risk level, and quality/regulatory impact."
            expanded={expandedSections.includes("risk")}
            onToggle={() => toggleSection("risk")}
          >
            <div style={formGridStyle}>
              <Field label="Severity">
                <select
                  value={record.severity || ""}
                  onChange={(e) => {
                    updateField("severity", e.target.value);
                    saveField("severity", e.target.value);
                  }}
                  disabled={isLocked}
                  style={inputStyle(isLocked)}
                >
                  <option value="">Select</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </Field>

              <Field label="Occurrence">
                <select
                  value={record.occurrence_rating || ""}
                  onChange={(e) => {
                    updateField("occurrence_rating", e.target.value);
                    saveField("occurrence_rating", e.target.value);
                  }}
                  disabled={isLocked}
                  style={inputStyle(isLocked)}
                >
                  <option value="">Select</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </Field>

              <Field label="Detection">
                <select
                  value={record.detection_rating || ""}
                  onChange={(e) => {
                    updateField("detection_rating", e.target.value);
                    saveField("detection_rating", e.target.value);
                  }}
                  disabled={isLocked}
                  style={inputStyle(isLocked)}
                >
                  <option value="">Select</option>
                  <option value="high_detection">High Detection</option>
                  <option value="medium_detection">Medium Detection</option>
                  <option value="low_detection">Low Detection</option>
                </select>
              </Field>

              <Field label="Risk Level">
                <select
                  value={record.risk_level || ""}
                  onChange={(e) => {
                    updateField("risk_level", e.target.value);
                    saveField("risk_level", e.target.value);
                  }}
                  disabled={isLocked}
                  style={inputStyle(isLocked)}
                >
                  <option value="">Select</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </Field>
            </div>

            <div style={formGridStyle}>
              <Field label="Patient Safety Impact">
                <textarea
                  value={record.patient_safety_impact || ""}
                  onChange={(e) =>
                    updateField("patient_safety_impact", e.target.value)
                  }
                  onBlur={(e) =>
                    saveField("patient_safety_impact", e.target.value)
                  }
                  disabled={isLocked}
                  rows={3}
                  style={textareaStyle(isLocked)}
                />
              </Field>

              <Field label="Product Quality Impact">
                <textarea
                  value={record.product_quality_impact || ""}
                  onChange={(e) =>
                    updateField("product_quality_impact", e.target.value)
                  }
                  onBlur={(e) =>
                    saveField("product_quality_impact", e.target.value)
                  }
                  disabled={isLocked}
                  rows={3}
                  style={textareaStyle(isLocked)}
                />
              </Field>

              <Field label="Regulatory Impact">
                <textarea
                  value={record.regulatory_impact || ""}
                  onChange={(e) => updateField("regulatory_impact", e.target.value)}
                  onBlur={(e) => saveField("regulatory_impact", e.target.value)}
                  disabled={isLocked}
                  rows={3}
                  style={textareaStyle(isLocked)}
                />
              </Field>

              <Field label="Risk Rationale">
                <textarea
                  value={record.risk_rationale || record.risk_assessment || ""}
                  onChange={(e) => updateField("risk_rationale", e.target.value)}
                  onBlur={(e) => saveField("risk_rationale", e.target.value)}
                  disabled={isLocked}
                  rows={3}
                  style={textareaStyle(isLocked)}
                />
              </Field>
            </div>
          </WorkflowCard>

          <ApprovalCard
            sectionKey="investigationapproval"
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
            expanded={expandedSections.includes("investigationapproval")}
            onToggle={() => toggleSection("investigationapproval")}
            onSubmit={submitInvestigationApproval}
            onApprove={approveInvestigation}
            onReject={rejectInvestigation}
          />

          <WorkflowCard
            sectionKey="correctiveaction"
            title="8. Corrective Action"
            subtitle="Define corrective action, owner, due date, and verification method."
            locked={implementationLocked}
            expanded={expandedSections.includes("correctiveaction")}
            onToggle={() => toggleSection("correctiveaction")}
          >
            {implementationLocked && !isLocked ? <LockNotice /> : null}

            <div style={formGridStyle}>
              <Field label="Corrective Action">
                <textarea
                  value={record.corrective_action_plan || ""}
                  onChange={(e) =>
                    updateField("corrective_action_plan", e.target.value)
                  }
                  onBlur={(e) => saveField("corrective_action_plan", e.target.value)}
                  disabled={implementationLocked}
                  rows={4}
                  style={textareaStyle(implementationLocked)}
                />
              </Field>

              <Field label="Action Owner">
                <input
                  value={record.action_owner || ""}
                  onChange={(e) => updateField("action_owner", e.target.value)}
                  onBlur={(e) => saveField("action_owner", e.target.value)}
                  disabled={implementationLocked}
                  style={inputStyle(implementationLocked)}
                />
              </Field>

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

              <Field label="Verification Method">
                <textarea
                  value={record.verification_method || ""}
                  onChange={(e) => updateField("verification_method", e.target.value)}
                  onBlur={(e) => saveField("verification_method", e.target.value)}
                  disabled={implementationLocked}
                  rows={3}
                  style={textareaStyle(implementationLocked)}
                />
              </Field>
            </div>
          </WorkflowCard>

          <WorkflowCard
            sectionKey="tasks"
            title="9. Execution Tasks"
            subtitle="Assign executable CAPA tasks with owners, due dates, evidence, and completion signatures."
            locked={implementationLocked}
            expanded={expandedSections.includes("tasks")}
            onToggle={() => toggleSection("tasks")}
          >
            {implementationLocked && !isLocked ? <LockNotice /> : null}

            {!implementationLocked ? (
              <>
                <div style={formGridStyle}>
                  <Field label="Task Type">
                    <select
                      value={newTask.task_type}
                      onChange={(e) =>
                        setNewTask({ ...newTask, task_type: e.target.value })
                      }
                      style={inputStyle(false)}
                    >
                      <option value="corrective_action">Corrective Action</option>
                      <option value="implementation">Implementation</option>
                      <option value="effectiveness">Effectiveness</option>
                      <option value="follow_up">Follow-up</option>
                    </select>
                  </Field>

                  <Field label="Task Title">
                    <input
                      value={newTask.task_title}
                      onChange={(e) =>
                        setNewTask({ ...newTask, task_title: e.target.value })
                      }
                      style={inputStyle(false)}
                    />
                  </Field>

                  <Field label="Owner">
                    <input
                      value={newTask.owner}
                      onChange={(e) =>
                        setNewTask({ ...newTask, owner: e.target.value })
                      }
                      style={inputStyle(false)}
                    />
                  </Field>

                  <Field label="Due Date">
                    <input
                      type="date"
                      value={newTask.due_date}
                      onChange={(e) =>
                        setNewTask({ ...newTask, due_date: e.target.value })
                      }
                      style={inputStyle(false)}
                    />
                  </Field>
                </div>

                <Field label="Task Description">
                  <textarea
                    value={newTask.task_description}
                    onChange={(e) =>
                      setNewTask({
                        ...newTask,
                        task_description: e.target.value,
                      })
                    }
                    rows={3}
                    style={textareaStyle(false)}
                  />
                </Field>

                <button onClick={createTask} style={primaryButtonStyle}>
                  Add Task
                </button>
              </>
            ) : null}

            <div style={{ marginTop: "20px" }}>
              {tasks.length === 0 ? (
                <p style={subtleText}>No CAPA execution tasks have been added.</p>
              ) : (
                tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    locked={isLocked}
                    evidence={taskEvidence[task.id] || ""}
                    setEvidence={(value) =>
                      setTaskEvidence((prev) => ({
                        ...prev,
                        [task.id]: value,
                      }))
                    }
                    isOverdue={isTaskOverdue(task)}
                    onStart={() => updateTaskStatus(task, "in_progress")}
                    onBlock={() => updateTaskStatus(task, "blocked")}
                    onPendingReview={() =>
                      updateTaskStatus(task, "pending_review")
                    }
                    onComplete={() => completeTask(task)}
                  />
                ))
              )}
            </div>
          </WorkflowCard>

          <WorkflowCard
            sectionKey="implementation"
            title="10. Implementation"
            subtitle="Document implementation evidence and related QMS updates."
            locked={implementationLocked}
            expanded={expandedSections.includes("implementation")}
            onToggle={() => toggleSection("implementation")}
          >
            {implementationLocked && !isLocked ? <LockNotice /> : null}

            <div style={formGridStyle}>
              <Field label="Procedure Updated">
                <YesNoSelect
                  value={record.procedure_updated}
                  onChange={(value) => {
                    updateField("procedure_updated", value);
                    saveField("procedure_updated", value);
                  }}
                  disabled={implementationLocked}
                />
              </Field>

              <Field label="Training Required">
                <YesNoSelect
                  value={record.training_required}
                  onChange={(value) => {
                    updateField("training_required", value);
                    saveField("training_required", value);
                  }}
                  disabled={implementationLocked}
                />
              </Field>

              <Field label="Validation Required">
                <YesNoSelect
                  value={record.validation_required}
                  onChange={(value) => {
                    updateField("validation_required", value);
                    saveField("validation_required", value);
                  }}
                  disabled={implementationLocked}
                />
              </Field>
            </div>

            <Field label="Implementation Evidence">
              <textarea
                value={
                  record.implementation_details ||
                  record.implementation_evidence ||
                  ""
                }
                onChange={(e) =>
                  updateField("implementation_details", e.target.value)
                }
                onBlur={(e) => saveField("implementation_details", e.target.value)}
                disabled={implementationLocked}
                rows={4}
                style={textareaStyle(implementationLocked)}
              />
            </Field>

            <button
              onClick={markImplemented}
              disabled={implementationLocked}
              style={buttonDisabledStyle(implementationLocked)}
            >
              Mark Implementation Complete
            </button>

            {record.implemented_by ? (
              <p style={{ color: "#15803d", fontWeight: 700 }}>
                Implemented by {record.implemented_by} at{" "}
                {record.implemented_at || "N/A"}
              </p>
            ) : null}
          </WorkflowCard>

          <WorkflowCard
            sectionKey="effectiveness"
            title="11. Effectiveness"
            subtitle="Document monitoring method, monitoring period, results, recurrence, and final rating."
            locked={implementationLocked}
            expanded={expandedSections.includes("effectiveness")}
            onToggle={() => toggleSection("effectiveness")}
          >
            {implementationLocked && !isLocked ? <LockNotice /> : null}

            <div style={formGridStyle}>
              <Field label="Monitoring Method">
                <textarea
                  value={record.monitoring_method || record.effectiveness_plan || ""}
                  onChange={(e) =>
                    updateField("monitoring_method", e.target.value)
                  }
                  onBlur={(e) => saveField("monitoring_method", e.target.value)}
                  disabled={implementationLocked}
                  rows={3}
                  style={textareaStyle(implementationLocked)}
                />
              </Field>

              <Field label="Monitoring Period">
                <input
                  value={record.monitoring_period || ""}
                  onChange={(e) => updateField("monitoring_period", e.target.value)}
                  onBlur={(e) => saveField("monitoring_period", e.target.value)}
                  disabled={implementationLocked}
                  style={inputStyle(implementationLocked)}
                />
              </Field>

              <Field label="Effectiveness Results">
                <textarea
                  value={record.effectiveness_check || ""}
                  onChange={(e) =>
                    updateField("effectiveness_check", e.target.value)
                  }
                  onBlur={(e) => saveField("effectiveness_check", e.target.value)}
                  disabled={implementationLocked}
                  rows={4}
                  style={textareaStyle(implementationLocked)}
                />
              </Field>

              <Field label="Effectiveness Rating">
                <select
                  value={record.effectiveness_rating || ""}
                  onChange={(e) => {
                    updateField("effectiveness_rating", e.target.value);
                    saveField("effectiveness_rating", e.target.value);
                  }}
                  disabled={implementationLocked}
                  style={inputStyle(implementationLocked)}
                >
                  <option value="">Select</option>
                  <option value="effective">Effective</option>
                  <option value="partially_effective">Partially Effective</option>
                  <option value="not_effective">Not Effective</option>
                </select>
              </Field>

              <Field label="Recurrence Detected">
                <YesNoSelect
                  value={record.recurrence_detected}
                  onChange={(value) => {
                    updateField("recurrence_detected", value);
                    saveField("recurrence_detected", value);
                  }}
                  disabled={implementationLocked}
                />
              </Field>

              <Field label="Follow-up CAPA Required">
                <YesNoSelect
                  value={record.followup_capa_required}
                  onChange={(value) => {
                    updateField("followup_capa_required", value);
                    saveField("followup_capa_required", value);
                  }}
                  disabled={implementationLocked}
                />
              </Field>
            </div>

            {(record.effectiveness_rating === "partially_effective" ||
              record.effectiveness_rating === "not_effective" ||
              record.followup_capa_required === "yes") ? (
              <Field label="Follow-up Action">
                <textarea
                  value={record.effectiveness_followup_action || ""}
                  onChange={(e) =>
                    updateField("effectiveness_followup_action", e.target.value)
                  }
                  onBlur={(e) =>
                    saveField("effectiveness_followup_action", e.target.value)
                  }
                  disabled={implementationLocked}
                  rows={3}
                  style={textareaStyle(implementationLocked)}
                />
              </Field>
            ) : null}
          </WorkflowCard>

          <ApprovalCard
            sectionKey="closure"
            title="12. Closure Approval"
            description="Final approval confirms CAPA completion, effectiveness, execution tasks, and closure readiness. Approval locks the record."
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
            expanded={expandedSections.includes("closure")}
            onToggle={() => toggleSection("closure")}
            onSubmit={submitClosureApproval}
            onApprove={approveClosure}
            onReject={rejectClosure}
          />

          {!isLocked ? (
            <WorkflowCard
              sectionKey="cancel"
              title="Cancel CAPA"
              subtitle="Cancel only when CAPA was initiated in error, duplicated, superseded, or no longer justified. Cancellation locks the record."
              expanded={expandedSections.includes("cancel")}
              onToggle={() => toggleSection("cancel")}
            >
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

              <button
                onClick={cancelCapa}
                disabled={isLocked || !canApprove}
                style={dangerButtonStyle}
              >
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
                <p>
                  <strong>Reason:</strong> {record.cancel_reason || "N/A"}
                </p>
                <p>
                  <strong>Justification:</strong>{" "}
                  {record.cancellation_justification || "N/A"}
                </p>
                <p>
                  <strong>Cancelled By:</strong> {record.cancelled_by || "N/A"}
                </p>
                <p>
                  <strong>Cancelled At:</strong> {record.cancelled_at || "N/A"}
                </p>
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

          <SidebarCard title="Execution Tasks">
            <SidebarItem label="Total Tasks" value={tasks.length} />
            <SidebarItem label="Open / Active" value={incompleteTasks.length} />
            <SidebarItem label="Overdue" value={overdueTasks.length} />
            <SidebarItem
              label="Completion"
              value={`${tasks.length - incompleteTasks.length}/${tasks.length}`}
            />
          </SidebarCard>

          <SidebarCard title="Approval Status">
            <SidebarItem
              label="Investigation"
              value={record.investigation_approval_status || "Not Submitted"}
            />
            <SidebarItem
              label="Closure"
              value={record.closure_approval_status || "Not Submitted"}
            />
            <SidebarItem label="User Role" value={userRole || "none"} />
          </SidebarCard>

          <SidebarCard title="Related Records">
            <SidebarItem label="Supplier" value={record.supplier_name || "N/A"} />
            <SidebarItem
              label="Linked NCMR"
              value={record.linked_ncmr_title || "N/A"}
            />
            {record.followup_capa_id ? (
              <Link href={`/capa/${record.followup_capa_id}`}>
                Open Follow-up CAPA
              </Link>
            ) : null}
          </SidebarCard>
        </aside>
      </div>
    </main>
  );
}

function WorkflowCard({
  sectionKey,
  title,
  subtitle,
  children,
  locked = false,
  expanded,
  onToggle,
}: {
  sectionKey: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  locked?: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <section
      style={{
        ...workflowCardStyle,
        opacity: locked ? 0.82 : 1,
        borderLeft: `8px solid ${locked ? "#9ca3af" : "#2563eb"}`,
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={collapseHeaderButtonStyle}
        aria-expanded={expanded}
        aria-controls={sectionKey}
      >
        <div>
          <h2 style={{ margin: "0 0 4px 0" }}>
            {expanded ? "▼" : "▶"} {title}
          </h2>
          <p style={{ ...subtleText, margin: 0 }}>{subtitle}</p>
        </div>
      </button>

      {expanded ? <div id={sectionKey}>{children}</div> : null}
    </section>
  );
}

function ApprovalCard({
  sectionKey,
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
  expanded,
  onToggle,
  onSubmit,
  onApprove,
  onReject,
}: {
  sectionKey: string;
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
  expanded: boolean;
  onToggle: () => void;
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
          isApproved
            ? "#15803d"
            : isPending
            ? "#d97706"
            : isRejected
            ? "#dc2626"
            : "#6b7280"
        }`,
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={collapseHeaderButtonStyle}
        aria-expanded={expanded}
        aria-controls={sectionKey}
      >
        <div>
          <h2 style={{ margin: "0 0 4px 0" }}>
            {expanded ? "▼" : "▶"} {title}
          </h2>
          <p style={{ ...subtleText, margin: 0 }}>{description}</p>
        </div>
      </button>

      {expanded ? (
        <div id={sectionKey}>
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

function TaskCard({
  task,
  locked,
  evidence,
  setEvidence,
  isOverdue,
  onStart,
  onBlock,
  onPendingReview,
  onComplete,
}: {
  task: CapaTask;
  locked: boolean;
  evidence: string;
  setEvidence: (value: string) => void;
  isOverdue: boolean;
  onStart: () => void;
  onBlock: () => void;
  onPendingReview: () => void;
  onComplete: () => void;
}) {
  const complete = task.status === "complete";

  return (
    <div
      style={{
        border: "1px solid #d1d5db",
        borderLeft: `6px solid ${
          complete ? "#15803d" : isOverdue ? "#dc2626" : "#d97706"
        }`,
        borderRadius: "12px",
        padding: "14px",
        marginBottom: "12px",
        background: isOverdue && !complete ? "#fef2f2" : "white",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: "260px" }}>
          <div style={{ fontWeight: 800 }}>{task.task_title}</div>
          <div style={{ color: "#6b7280", marginTop: "4px" }}>
            {task.task_type || "task"}
          </div>
          <p>{task.task_description || "No description provided."}</p>

          <div style={formGridStyle}>
            <SummaryCard label="Owner" value={task.owner} />
            <SummaryCard label="Due Date" value={task.due_date} />
            <SummaryCard
              label="Status"
              value={isOverdue && !complete ? "overdue" : task.status}
            />
            <SummaryCard label="Completed By" value={task.completed_by} />
          </div>

          {complete ? (
            <div style={evidenceBoxStyle}>
              <strong>Completion Signature</strong>
              <p style={{ marginBottom: 0 }}>
                {task.signature_meaning || "Task completed."}
              </p>
              <p style={{ marginBottom: 0 }}>
                Completed by {task.completed_by || "N/A"} at{" "}
                {task.completed_at || "N/A"}
              </p>
              <p style={{ marginBottom: 0 }}>
                Evidence: {task.completion_evidence || "N/A"}
              </p>
            </div>
          ) : null}
        </div>

        {!complete && !locked ? (
          <div style={{ minWidth: "240px" }}>
            <Field label="Completion Evidence">
              <textarea
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
                rows={3}
                style={textareaStyle(false)}
              />
            </Field>

            <div style={{ display: "grid", gap: "8px" }}>
              <button onClick={onStart}>Start</button>
              <button onClick={onPendingReview}>Pending Review</button>
              <button onClick={onBlock}>Blocked</button>
              <button onClick={onComplete} style={secondaryButtonStyle}>
                Complete with E-Signature
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: "16px" }}>
      <label style={fieldLabelStyle}>{label}</label>
      <div style={{ marginTop: "6px" }}>{children}</div>
    </div>
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

function YesNoSelect({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <select
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      style={inputStyle(disabled)}
    >
      <option value="">Select</option>
      <option value="yes">Yes</option>
      <option value="no">No</option>
      <option value="not_required">Not Required</option>
    </select>
  );
}

function LockNotice() {
  return (
    <div style={lockedNoticeStyle}>
      Investigation approval is required before this phase can be edited.
    </div>
  );
}

function SidebarCard({ title, children }: { title: string; children: ReactNode }) {
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

function isTaskOverdue(task: CapaTask) {
  if (task.status === "complete") return false;
  if (!task.due_date) return false;

  const today = new Date().toISOString().slice(0, 10);
  return task.due_date < today;
}

function getWorkflowHealth(record: any, overdueTaskCount: number) {
  if (record?.status === "closed") {
    return { label: "Closed / Locked", color: "#15803d" };
  }

  if (record?.status === "cancelled") {
    return { label: "Cancelled / Locked", color: "#6b7280" };
  }

  if (overdueTaskCount > 0) {
    return { label: "Elevated", color: "#dc2626" };
  }

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

const pageStyle: CSSProperties = {
  padding: "24px",
  background: "#f8fafc",
  minHeight: "100vh",
  fontFamily: "Arial, sans-serif",
};

const headerCardStyle: CSSProperties = {
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

const healthBannerStyle: CSSProperties = {
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

const workspaceStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "260px minmax(0, 1fr) 280px",
  gap: "20px",
  alignItems: "start",
};

const railStyle: CSSProperties = {
  position: "sticky",
  top: "16px",
};

const railItemStyle: CSSProperties = {
  width: "100%",
  textAlign: "left",
  padding: "12px",
  marginBottom: "10px",
  border: "1px solid #d1d5db",
  borderRadius: "12px",
  background: "white",
  cursor: "pointer",
};

const sidebarStyle: CSSProperties = {
  position: "sticky",
  top: "16px",
};

const sidebarCardStyle: CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: "14px",
  background: "white",
  padding: "16px",
  marginBottom: "16px",
};

const sidebarItemStyle: CSSProperties = {
  borderBottom: "1px solid #e5e7eb",
  paddingBottom: "8px",
  marginBottom: "10px",
};

const workflowCardStyle: CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: "16px",
  background: "white",
  padding: "22px",
  marginBottom: "20px",
};

const collapseHeaderButtonStyle: CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  background: "transparent",
  border: "none",
  padding: 0,
  marginBottom: "14px",
  cursor: "pointer",
};

const summaryGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "14px",
  marginBottom: "20px",
};

const summaryCardStyle: CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: "12px",
  background: "#f9fafb",
  padding: "14px",
};

const summaryLabelStyle: CSSProperties = {
  fontSize: "12px",
  fontWeight: 700,
  color: "#6b7280",
  marginBottom: "6px",
};

const summaryValueStyle: CSSProperties = {
  fontWeight: 700,
  whiteSpace: "pre-wrap",
};

const formGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
  gap: "18px",
};

const textareaStyle = (locked: boolean): CSSProperties => ({
  width: "100%",
  minHeight: "105px",
  padding: "12px",
  borderRadius: "10px",
  border: "1px solid #d1d5db",
  background: locked ? "#f3f4f6" : "white",
  color: locked ? "#6b7280" : "#111827",
});

const inputStyle = (locked: boolean): CSSProperties => ({
  width: "100%",
  padding: "10px",
  borderRadius: "10px",
  border: "1px solid #d1d5db",
  background: locked ? "#f3f4f6" : "white",
  color: locked ? "#6b7280" : "#111827",
});

const fieldLabelStyle: CSSProperties = {
  fontWeight: 700,
};

const eyebrowStyle: CSSProperties = {
  fontSize: "12px",
  letterSpacing: "0.08em",
  color: "#6b7280",
  fontWeight: 800,
};

const subtleText: CSSProperties = {
  color: "#6b7280",
};

const bannerLabelStyle: CSSProperties = {
  fontSize: "13px",
  color: "#6b7280",
  fontWeight: 700,
};

const badgeRowStyle: CSSProperties = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
};

const buttonRowStyle: CSSProperties = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
};

const primaryButtonStyle: CSSProperties = {
  background: "#2563eb",
  color: "white",
  border: "none",
  borderRadius: "8px",
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 700,
};

const secondaryButtonStyle: CSSProperties = {
  background: "#15803d",
  color: "white",
  border: "none",
  borderRadius: "8px",
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 700,
};

const dangerButtonStyle: CSSProperties = {
  background: "#dc2626",
  color: "white",
  border: "none",
  borderRadius: "8px",
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 700,
};

const darkButtonStyle: CSSProperties = {
  background: "#111827",
  color: "white",
  borderRadius: "8px",
  padding: "10px 14px",
  textDecoration: "none",
  fontWeight: 700,
};

const buttonDisabledStyle = (disabled: boolean): CSSProperties => ({
  background: disabled ? "#9ca3af" : "#2563eb",
  color: "white",
  border: "none",
  borderRadius: "8px",
  padding: "10px 14px",
  cursor: disabled ? "not-allowed" : "pointer",
  fontWeight: 700,
});

const lockedBannerStyle: CSSProperties = {
  background: "#111827",
  color: "white",
  padding: "14px",
  borderRadius: "12px",
  fontWeight: 700,
  marginBottom: "20px",
};

const lockedNoticeStyle: CSSProperties = {
  padding: "10px",
  background: "#fefce8",
  border: "1px solid #facc15",
  borderRadius: "10px",
  marginBottom: "14px",
  color: "#92400e",
  fontWeight: 700,
};

const evidenceBoxStyle: CSSProperties = {
  marginTop: "16px",
  padding: "14px",
  background: "#f9fafb",
  borderRadius: "12px",
  border: "1px solid #d1d5db",
};
