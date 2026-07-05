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

type ApprovalGateKey =
  | "initiation"
  | "investigation"
  | "action_plan"
  | "closure";

type CapaGateApprover = {
  id: string;
  capa_id: string;
  approval_gate: ApprovalGateKey | string;
  approver_email: string;
  approver_function: string | null;
  approver_job_title: string | null;
  approver_due_date: string | null;
  approver_role: string | null;
  approval_order: number | null;
  is_required: boolean | null;
  approval_status: string | null;
  source_template_id: string | null;
  created_at: string | null;
};

type CapaApprovalTask = {
  id: string;
  entity_type: string | null;
  entity_id: string | null;
  task_type: string | null;
  required_function: string | null;
  assigned_to_email: string | null;
  assigned_by_email: string | null;
  status: string | null;
  required: boolean | null;
  comments: string | null;
  signed_by: string | null;
  signed_at: string | null;
  approver_comment: string | null;
  created_at: string | null;
};

export default function EnterpriseCapaWorkflowPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [record, setRecord] = useState<any>(null);
  const [tasks, setTasks] = useState<CapaTask[]>([]);
  const [gateApprovers, setGateApprovers] = useState<CapaGateApprover[]>([]);
  const [approvalTasks, setApprovalTasks] = useState<CapaApprovalTask[]>([]);
  const [approvalMatrixTemplates, setApprovalMatrixTemplates] = useState<any[]>([]);
  const [selectedApprovalMatrixByGate, setSelectedApprovalMatrixByGate] =
    useState<Record<string, string>>({});
  const [manualApproverEmailByGate, setManualApproverEmailByGate] =
    useState<Record<string, string>>({});
  const [manualApproverFunctionByGate, setManualApproverFunctionByGate] =
    useState<Record<string, string>>({});
  const [manualApproverJobTitleByGate, setManualApproverJobTitleByGate] =
    useState<Record<string, string>>({});
  const [manualApproverDueDateByGate, setManualApproverDueDateByGate] =
    useState<Record<string, string>>({});
  const [manualApproverRoleByGate, setManualApproverRoleByGate] =
    useState<Record<string, string>>({});
  const [manualApproverRequiredByGate, setManualApproverRequiredByGate] =
    useState<Record<string, boolean>>({});
  const [loadingApprovals, setLoadingApprovals] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingField, setSavingField] = useState("");

  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState("");

  const [activeSection, setActiveSection] = useState("initiation");
  const [expandedSections, setExpandedSections] = useState<string[]>([
    "initiation",
  ]);

  const [initiationApprovalComments, setInitiationApprovalComments] =
    useState("");
  const [investigationApprovalComments, setInvestigationApprovalComments] =
    useState("");
  const [actionPlanApprovalComments, setActionPlanApprovalComments] =
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

  const currentUserEmail = String(userEmail || "").trim().toLowerCase();
  const recordOwnerEmail =
    String(record?.owner_email || "").trim().toLowerCase() ||
    (String(record?.owner || "").includes("@")
      ? String(record?.owner || "").trim().toLowerCase()
      : "") ||
    String(record?.created_by || "").trim().toLowerCase();

  const isRecordOwner =
    Boolean(currentUserEmail) &&
    Boolean(recordOwnerEmail) &&
    currentUserEmail === recordOwnerEmail;

  const canEditRecord = !isLocked && isRecordOwner;

  const readOnlyForNonOwner =
    Boolean(record) &&
    Boolean(currentUserEmail) &&
    Boolean(recordOwnerEmail) &&
    !isRecordOwner;

  const initiationApproved =
    record?.initiation_approval_status === "approved";

  const investigationApproved =
    record?.investigation_approval_status === "approved";

  const actionPlanApproved =
    record?.action_plan_approval_status === "approved";

  const closureApproved = record?.closure_approval_status === "approved";

  const evaluationLocked = !initiationApproved || !canEditRecord;
  const investigationLocked = !initiationApproved || !canEditRecord;
  const actionPlanPlanningLocked =
    !investigationApproved || actionPlanApproved || !canEditRecord;
  const implementationTaskAssignmentLocked = !actionPlanApproved || !canEditRecord;
  const implementationLocked = !actionPlanApproved || !canEditRecord;
  const effectivenessPlanLocked = !record?.implemented_by || !canEditRecord;

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
    const shouldShowLoading = !record;
    if (shouldShowLoading) {
      setLoading(true);
    }

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
    setInitiationApprovalComments(
      data?.initiation_approval_comments ||
        data?.initiation_rejection_comments ||
        ""
    );
    setInvestigationApprovalComments(
      data?.investigation_approval_comments ||
        data?.investigation_rejection_comments ||
        ""
    );
    setActionPlanApprovalComments(
      data?.action_plan_approval_comments ||
        data?.action_plan_rejection_comments ||
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

  const fetchApprovalMatrixTemplates = async () => {
    const { data, error } = await supabase
      .from("approval_matrix_templates")
      .select("*");

    if (error) {
      console.warn("Unable to load approval matrix templates:", error.message);
      setApprovalMatrixTemplates([]);
      return;
    }

    const capaTemplates = (data || []).filter((template: any) => {
      const templateModule = String(
        template?.module || template?.module_name || template?.template_module || ""
      ).toLowerCase();
      const isActive = template?.is_active !== false && template?.active !== false;

      return (
        isActive &&
        (templateModule === "capa" ||
          templateModule.includes("capa") ||
          templateModule.includes("corrective") ||
          templateModule.includes("preventive"))
      );
    });

    setApprovalMatrixTemplates(
      capaTemplates.sort((a: any, b: any) =>
        String(a.template_name || a.name || "").localeCompare(
          String(b.template_name || b.name || "")
        )
      )
    );
  };

  const fetchGateApprovers = async () => {
    if (!id) return;

    const { data, error } = await supabase
      .from("capa_gate_approvers")
      .select("*")
      .eq("capa_id", id)
      .order("approval_gate", { ascending: true })
      .order("approval_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.warn("Unable to load CAPA gate approvers:", error.message);
      setGateApprovers([]);
      return;
    }

    setGateApprovers((data as CapaGateApprover[]) || []);
  };

  const fetchApprovalTasks = async () => {
    if (!id) return;

    const { data, error } = await supabase
      .from("approval_tasks")
      .select("*")
      .eq("entity_type", "capa")
      .eq("entity_id", id)
      .order("created_at", { ascending: true });

    if (error) {
      console.warn("Unable to load CAPA approval tasks:", error.message);
      setApprovalTasks([]);
      return;
    }

    setApprovalTasks((data as CapaApprovalTask[]) || []);
  };

  useEffect(() => {
    if (id) {
      fetchUserRole();
      fetchRecord();
      fetchTasks();
      fetchApprovalMatrixTemplates();
      fetchGateApprovers();
      fetchApprovalTasks();
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


  const approvalGateLabels: Record<ApprovalGateKey, string> = {
    initiation: "Initiation Approval",
    investigation: "Investigation Approval",
    action_plan: "Action Plan Approval",
    closure: "Closure Approval",
  };

  const getCapaApprovalTaskType = (gate: ApprovalGateKey) =>
    `capa_${gate}_approval`;


  const approvalGateStatusFields: Record<ApprovalGateKey, any> = {
    initiation: {
      status: "initiation_approval_status",
      submittedBy: "initiation_submitted_by",
      submittedAt: "initiation_submitted_at",
      approvedBy: "initiation_approved_by",
      approvedAt: "initiation_approved_at",
      approvalComments: "initiation_approval_comments",
      rejectedBy: "initiation_rejected_by",
      rejectedAt: "initiation_rejected_at",
      rejectionComments: "initiation_rejection_comments",
      nextStatus: "evaluation",
      pendingStatus: "pending_initiation_approval",
      rejectedStatus: "initiation",
      matrixId: "initiation_approval_matrix_id",
    },
    investigation: {
      status: "investigation_approval_status",
      submittedBy: "investigation_submitted_by",
      submittedAt: "investigation_submitted_at",
      approvedBy: "investigation_approved_by",
      approvedAt: "investigation_approved_at",
      approvalComments: "investigation_approval_comments",
      rejectedBy: "investigation_rejected_by",
      rejectedAt: "investigation_rejected_at",
      rejectionComments: "investigation_rejection_comments",
      nextStatus: "action_plan",
      pendingStatus: "pending_investigation_approval",
      rejectedStatus: "investigation",
      matrixId: "investigation_approval_matrix_id",
    },
    action_plan: {
      status: "action_plan_approval_status",
      submittedBy: "action_plan_submitted_by",
      submittedAt: "action_plan_submitted_at",
      approvedBy: "action_plan_approved_by",
      approvedAt: "action_plan_approved_at",
      approvalComments: "action_plan_approval_comments",
      rejectedBy: "action_plan_rejected_by",
      rejectedAt: "action_plan_rejected_at",
      rejectionComments: "action_plan_rejection_comments",
      nextStatus: "implementation",
      pendingStatus: "pending_action_plan_approval",
      rejectedStatus: "action_plan",
      matrixId: "action_plan_approval_matrix_id",
    },
    closure: {
      status: "closure_approval_status",
      submittedBy: "closure_submitted_by",
      submittedAt: "closure_submitted_at",
      approvedBy: "closure_approved_by",
      approvedAt: "closure_approved_at",
      approvalComments: "closure_approval_comments",
      rejectedBy: "closure_rejected_by",
      rejectedAt: "closure_rejected_at",
      rejectionComments: "closure_rejection_comments",
      nextStatus: "closed",
      pendingStatus: "pending_closure_approval",
      rejectedStatus: "effectiveness_review",
      matrixId: "closure_approval_matrix_id",
    },
  };

  const normalizeApproverEmail = (email: any) =>
    String(email || "").trim().toLowerCase();

  const isValidEmailFormat = (email: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const getGateApprovers = (gate: ApprovalGateKey) =>
    gateApprovers.filter((approver) => approver.approval_gate === gate);

  const getGateApprovalTasks = (gate: ApprovalGateKey) =>
    approvalTasks.filter((task) => task.task_type === getCapaApprovalTaskType(gate));

  const getPendingGateApprovalTasks = (gate: ApprovalGateKey) =>
    getGateApprovalTasks(gate).filter(
      (task) => (task.status || "pending") === "pending"
    );

  const hasActiveGateApprovalTasks = (gate: ApprovalGateKey) =>
    getPendingGateApprovalTasks(gate).length > 0;

  const refreshApprovalEngine = async () => {
    await fetchGateApprovers();
    await fetchApprovalTasks();
    await fetchRecord();
  };

  const validateApproverEmails = async (emails: string[]) => {
    const normalizedEmails = Array.from(
      new Set(emails.map((email) => normalizeApproverEmail(email)).filter(Boolean))
    );

    if (normalizedEmails.length === 0) {
      return { valid: false, message: "At least one approver email is required." };
    }

    const invalidFormatEmails = normalizedEmails.filter(
      (email) => !isValidEmailFormat(email)
    );

    if (invalidFormatEmails.length > 0) {
      return {
        valid: false,
        message: `The following approver email(s) are not valid email addresses:\n\n${invalidFormatEmails.join("\n")}`,
      };
    }

    const { data, error } = await supabase
      .from("user_roles")
      .select("user_email")
      .in("user_email", normalizedEmails);

    if (error) {
      return {
        valid: false,
        message: `Unable to validate approver emails against system users: ${error.message}`,
      };
    }

    const validSystemUsers = new Set(
      (data || []).map((item: any) => normalizeApproverEmail(item.user_email))
    );

    const unknownUsers = normalizedEmails.filter(
      (email) => !validSystemUsers.has(email)
    );

    if (unknownUsers.length > 0) {
      return {
        valid: false,
        message: `The following approver email(s) are not valid QualiSphere users:\n\n${unknownUsers.join("\n")}\n\nPlease correct the approver list before submitting for approval.`,
      };
    }

    return { valid: true, message: "" };
  };

  const normalizeMatrixApproverRow = (row: any, index: number) => {
    const approverEmail =
      row?.approver_email ||
      row?.user_email ||
      row?.email ||
      row?.reviewer_email ||
      row?.assigned_to_email ||
      "";

    const approverFunction =
      row?.approver_function ||
      row?.function ||
      row?.function_name ||
      row?.required_function ||
      row?.department ||
      "";

    const approverJobTitle =
      row?.approver_job_title ||
      row?.job_title ||
      row?.title ||
      row?.approver_role ||
      row?.role ||
      row?.approval_role ||
      row?.reviewer_role ||
      "Approver";

    const approverRole =
      row?.approver_role ||
      row?.role ||
      row?.approval_role ||
      row?.reviewer_role ||
      approverJobTitle ||
      "Approver";

    const approvalOrder =
      row?.approval_order ??
      row?.display_order ??
      row?.sort_order ??
      row?.sequence ??
      row?.order_index ??
      index + 1;

    return {
      approver_email: normalizeApproverEmail(approverEmail),
      approver_function: String(approverFunction || "").trim(),
      approver_job_title: String(approverJobTitle || "Approver").trim(),
      approver_due_date: row?.approver_due_date || row?.due_date || null,
      approver_role: String(approverRole || approverJobTitle || "Approver").trim(),
      approval_order: Number(approvalOrder) || index + 1,
      is_required: true,
    };
  };

  const fetchApprovalMatrixRows = async (templateId: string) => {
    const candidateTables = [
      "approval_matrix_template_rows",
      "approval_matrix_reviewers",
      "approval_matrix_approvers",
      "approval_matrix_steps",
    ];

    for (const tableName of candidateTables) {
      const { data, error } = await supabase
        .from(tableName)
        .select("*")
        .eq("template_id", templateId);

      if (error) {
        console.warn(`Unable to load ${tableName}:`, error.message);
        continue;
      }

      if (data && data.length > 0) {
        return data
          .map((row: any, index: number) => normalizeMatrixApproverRow(row, index))
          .filter((row: any) => row.approver_email);
      }
    }

    return [];
  };

  const loadApproversFromMatrix = async (gate: ApprovalGateKey) => {
    if (hasActiveGateApprovalTasks(gate)) {
      alert("Approvers cannot be changed while this approval package has active tasks.");
      return;
    }

    const templateId = selectedApprovalMatrixByGate[gate];

    if (!templateId) {
      alert("Select an approval matrix first.");
      return;
    }

    const matrixRows = await fetchApprovalMatrixRows(templateId);

    if (matrixRows.length === 0) {
      alert("No approver rows were found for the selected approval matrix.");
      return;
    }

    const validation = await validateApproverEmails(
      matrixRows.map((row: any) => row.approver_email)
    );

    if (!validation.valid) {
      alert(`Approval matrix cannot be loaded.\n\n${validation.message}`);
      return;
    }

    const confirmed = window.confirm(
      "Load approvers from this approval matrix? Existing configured approvers for this gate will be replaced."
    );

    if (!confirmed) return;

    setLoadingApprovals(true);

    await supabase
      .from("capa_gate_approvers")
      .delete()
      .eq("capa_id", id)
      .eq("approval_gate", gate);

    const rowsToInsert = matrixRows.map((row: any, index: number) => ({
      capa_id: id,
      approval_gate: gate,
      approver_email: row.approver_email,
      approver_function: row.approver_function || null,
      approver_job_title: row.approver_job_title || row.approver_role || "Approver",
      approver_due_date: row.approver_due_date || null,
      approver_role: row.approver_role || row.approver_job_title || "Approver",
      approval_status: "configured",
      approval_order: row.approval_order || index + 1,
      is_required: true,
      source_template_id: templateId,
      signature_meaning: `${approvalGateLabels[gate]} requested from approval matrix.`,
      created_by: userEmail || "unknown",
    }));

    const { error } = await supabase.from("capa_gate_approvers").insert(rowsToInsert);

    if (error) {
      setLoadingApprovals(false);
      alert(error.message);
      return;
    }

    const matrixField = approvalGateStatusFields[gate].matrixId;
    await supabase.from("capas").update({ [matrixField]: templateId }).eq("id", id);

    await addAuditLog(
      "approval_matrix_loaded",
      `${approvalGateLabels[gate]} loaded ${rowsToInsert.length} approver(s) from approval matrix.`
    );

    setLoadingApprovals(false);
    await refreshApprovalEngine();
  };

  const addManualApprover = async (gate: ApprovalGateKey) => {
    if (hasActiveGateApprovalTasks(gate)) {
      alert("Approvers cannot be changed while this approval package has active tasks.");
      return;
    }

    const approverEmail = normalizeApproverEmail(manualApproverEmailByGate[gate]);
    const approverFunction = String(manualApproverFunctionByGate[gate] || "").trim();
    const approverJobTitle = String(manualApproverJobTitleByGate[gate] || "").trim();
    const approverDueDate = String(manualApproverDueDateByGate[gate] || "").trim();

    if (!approverFunction) {
      alert("Function is required.");
      return;
    }

    if (!approverJobTitle) {
      alert("Job title is required.");
      return;
    }

    if (!approverEmail) {
      alert("User email is required.");
      return;
    }

    if (!approverDueDate) {
      alert("Approval due date is required.");
      return;
    }

    if (
      getGateApprovers(gate).some(
        (approver) => normalizeApproverEmail(approver.approver_email) === approverEmail
      )
    ) {
      alert("This approver is already configured for this approval gate.");
      return;
    }

    const validation = await validateApproverEmails([approverEmail]);

    if (!validation.valid) {
      alert(`Manual approver cannot be added.\n\n${validation.message}`);
      return;
    }

    const nextOrder =
      getGateApprovers(gate).length > 0
        ? Math.max(
            ...getGateApprovers(gate).map(
              (approver) => Number(approver.approval_order) || 0
            )
          ) + 1
        : 1;

    const { error } = await supabase.from("capa_gate_approvers").insert({
      capa_id: id,
      approval_gate: gate,
      approver_email: approverEmail,
      approver_function: approverFunction,
      approver_job_title: approverJobTitle,
      approver_due_date: approverDueDate,
      approver_role: approverJobTitle,
      approval_status: "configured",
      approval_order: nextOrder,
      is_required: true,
      signature_meaning: `Manual ${approvalGateLabels[gate]} requested.`,
      created_by: userEmail || "unknown",
    });

    if (error) {
      alert(error.message);
      return;
    }

    await addAuditLog(
      "manual_approver_added",
      `${approvalGateLabels[gate]} approver added: ${approverFunction} / ${approverJobTitle} / ${approverEmail} / due ${approverDueDate}`
    );

    setManualApproverEmailByGate((prev) => ({ ...prev, [gate]: "" }));
    setManualApproverFunctionByGate((prev) => ({ ...prev, [gate]: "" }));
    setManualApproverJobTitleByGate((prev) => ({ ...prev, [gate]: "" }));
    setManualApproverDueDateByGate((prev) => ({ ...prev, [gate]: "" }));
    setManualApproverRoleByGate((prev) => ({ ...prev, [gate]: "" }));
    setManualApproverRequiredByGate((prev) => ({ ...prev, [gate]: true }));

    await refreshApprovalEngine();
  };

  const removeGateApprover = async (gate: ApprovalGateKey, approverId: string) => {
    if (hasActiveGateApprovalTasks(gate)) {
      alert("Approvers cannot be changed while this approval package has active tasks.");
      return;
    }

    const confirmed = window.confirm("Remove this approver from the approval gate?");
    if (!confirmed) return;

    const { error } = await supabase
      .from("capa_gate_approvers")
      .delete()
      .eq("id", approverId);

    if (error) {
      alert(error.message);
      return;
    }

    await addAuditLog(
      "manual_approver_removed",
      `${approvalGateLabels[gate]} approver removed.`
    );

    await refreshApprovalEngine();
  };

  const submitGateForApproval = async (gate: ApprovalGateKey, comments: string) => {
    const configuredApprovers = getGateApprovers(gate);

    if (configuredApprovers.length === 0) {
      alert("Configure at least one approver before submitting for approval.");
      return false;
    }

    const validation = await validateApproverEmails(
      configuredApprovers.map((approver) => approver.approver_email)
    );

    if (!validation.valid) {
      alert(`Approval package cannot be submitted.\n\n${validation.message}`);
      return false;
    }

    const taskType = getCapaApprovalTaskType(gate);

    await supabase
      .from("approval_tasks")
      .delete()
      .eq("entity_type", "capa")
      .eq("entity_id", id)
      .eq("task_type", taskType)
      .eq("status", "pending");

    const taskRows = configuredApprovers.map((approver, index) => ({
      entity_type: "capa",
      entity_id: id,
      task_type: taskType,
      task_title: `${approver.approver_job_title || approver.approver_role || "Approver"} — ${
        record?.capa_number || "CAPA"
      } ${approvalGateLabels[gate]}`,
      required_function:
        `${approver.approver_function || "Function Not Specified"} - ${
          approver.approver_job_title || approver.approver_role || "Approver"
        }`,
      approver_function: approver.approver_function || null,
      approver_job_title: approver.approver_job_title || approver.approver_role || null,
      due_date: approver.approver_due_date || null,
      assigned_to_email: normalizeApproverEmail(approver.approver_email),
      assigned_by_email: userEmail || "unknown",
      status: "pending",
      required: true,
      comments:
        comments ||
        `Please review ${record?.capa_number || "this CAPA"} for ${approvalGateLabels[gate]}.

Review the CAPA section and approve only if it is complete, justified, and compliant with procedure requirements.

This approval becomes part of the official electronic quality record.`,
    }));

    const { data: insertedTasks, error: taskError } = await supabase
      .from("approval_tasks")
      .insert(taskRows)
      .select();

    if (taskError) {
      alert(taskError.message);
      return false;
    }

    const now = new Date().toISOString();
    const fields = approvalGateStatusFields[gate];

    const { error } = await supabase
      .from("capas")
      .update({
        [fields.status]: "pending",
        [fields.submittedBy]: userEmail || "unknown",
        [fields.submittedAt]: now,
        status: fields.pendingStatus,
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return false;
    }

    if (insertedTasks && insertedTasks.length > 0) {
      const notifications = insertedTasks.map((task: any) => ({
        recipient_email: task.assigned_to_email,
        subject: `${approvalGateLabels[gate]} assigned: ${record?.capa_number || "CAPA"}`,
        body: `You have been assigned ${approvalGateLabels[gate]} for ${record?.capa_number || "this CAPA"}. Please open My Approval Tasks.`,
        entity_type: "capa",
        entity_id: id,
        task_id: task.id,
        status: "pending",
      }));

      await supabase.from("notification_queue").insert(notifications);
    }

    await addAuditLog(
      "approval_package_submitted",
      `${approvalGateLabels[gate]} submitted to My Approval Tasks with ${taskRows.length} approver task(s).`
    );

    await refreshApprovalEngine();
    return true;
  };

  // CAPA approvals are completed from /my-approval-tasks.

  const approveGateAutomatically = async (gate: ApprovalGateKey, comments: string) => {
    const now = new Date().toISOString();
    const fields = approvalGateStatusFields[gate];

    const updatePayload: any = {
      [fields.status]: "approved",
      [fields.approvedBy]: userEmail || "system",
      [fields.approvedAt]: now,
      [fields.approvalComments]: comments || null,
      status: fields.nextStatus,
    };

    if (gate === "closure") {
      const signatureMeaning =
        "I approve final CAPA closure and confirm the initiation, evaluation, investigation, root cause determination, action plan approval, implementation, effectiveness plan, effectiveness verification, execution tasks, and closure review are complete.";

      updatePayload.approved_by = userEmail;
      updatePayload.approved_at = now;
      updatePayload.signed_by = userEmail;
      updatePayload.signed_at = now;
      updatePayload.signature_meaning = signatureMeaning;
      updatePayload.capa_signature_meaning = signatureMeaning;
      updatePayload.capa_closed_by = userEmail;
      updatePayload.closed_at = now;
      updatePayload.status = "closed";
      updatePayload.is_locked = true;
      updatePayload.locked_by = userEmail;
      updatePayload.locked_at = now;
    }

    const { error } = await supabase
      .from("capas")
      .update(updatePayload)
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await addAuditLog(
      "approval_gate_auto_approved",
      `${approvalGateLabels[gate]} completed. All required approval tasks are approved.`
    );

    await notifyCapaOwner({
      title: `${approvalGateLabels[gate]} Approved`,
      message: `${record?.capa_number || "CAPA"} ${approvalGateLabels[gate]} is approved.`,
      notificationType: `capa_${gate}_approved`,
      severity: "info",
    });

    alert(`${approvalGateLabels[gate]} approved.`);
    await refreshApprovalEngine();
  };

  const rejectGateApproval = async (gate: ApprovalGateKey, comments: string) => {
    if (!canApprove) {
      alert("Only an approver or VP Quality can reject approval packages.");
      return;
    }

    if (!comments.trim()) {
      alert("Rejection comments are required.");
      return;
    }

    const confirmed = window.confirm(
      `Reject ${approvalGateLabels[gate]} and return for revision?`
    );
    if (!confirmed) return;

    const now = new Date().toISOString();
    const fields = approvalGateStatusFields[gate];

    const { error } = await supabase
      .from("capas")
      .update({
        [fields.status]: "rejected",
        [fields.rejectedBy]: userEmail,
        [fields.rejectedAt]: now,
        [fields.rejectionComments]: comments,
        status: fields.rejectedStatus,
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await supabase
      .from("approval_tasks")
      .update({
        task_status: "cancelled",
        cancelled_at: now,
        comments,
      })
      .eq("capa_id", id)
      .eq("approval_gate", gate)
      .eq("task_status", "pending");

    await addAuditLog(
      "approval_gate_rejected",
      `${approvalGateLabels[gate]} rejected. Comments: ${comments}`
    );

    await notifyCapaOwner({
      title: `${approvalGateLabels[gate]} Rejected`,
      message: `${record?.capa_number || "CAPA"} ${approvalGateLabels[gate]} was rejected. Comments: ${comments}`,
      notificationType: `capa_${gate}_rejected`,
      severity: "high",
    });

    alert(`${approvalGateLabels[gate]} rejected.`);
    await refreshApprovalEngine();
  };


  const getNormalizedRiskValue = (value: any) =>
    String(value || "").trim().toLowerCase();

  const calculateCapaRiskLevel = (
    severityValue: any,
    occurrenceValue: any,
    detectionValue: any
  ) => {
    const severityScore =
      getNormalizedRiskValue(severityValue) === "critical"
        ? 4
        : getNormalizedRiskValue(severityValue) === "high"
        ? 3
        : getNormalizedRiskValue(severityValue) === "medium"
        ? 2
        : getNormalizedRiskValue(severityValue) === "low"
        ? 1
        : 0;

    const occurrenceScore =
      getNormalizedRiskValue(occurrenceValue) === "high"
        ? 3
        : getNormalizedRiskValue(occurrenceValue) === "medium"
        ? 2
        : getNormalizedRiskValue(occurrenceValue) === "low"
        ? 1
        : 0;

    const detectionScore =
      getNormalizedRiskValue(detectionValue) === "low_detection"
        ? 3
        : getNormalizedRiskValue(detectionValue) === "medium_detection"
        ? 2
        : getNormalizedRiskValue(detectionValue) === "high_detection"
        ? 1
        : 0;

    const totalScore = severityScore + occurrenceScore + detectionScore;

    if (severityScore >= 4 || totalScore >= 9) return "critical";
    if (totalScore >= 7) return "high";
    if (totalScore >= 4) return "medium";
    if (totalScore > 0) return "low";

    return "";
  };

  const getEffectiveRiskLevel = () => {
    if (record?.risk_assessment_method === "manual") {
      return record?.risk_level || "";
    }

    if (record?.risk_override_enabled && record?.risk_override_level) {
      return record.risk_override_level;
    }

    return calculateCapaRiskLevel(
      record?.severity,
      record?.occurrence_rating,
      record?.detection_rating
    );
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
        relatedUrl: `/my-approval-tasks`,
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
    if (!canEditRecord) {
      alert("Only the CAPA owner can edit this in-process record. Approved or closed records require a controlled workflow return.");
      return;
    }

    setRecord((prev: any) => ({
      ...prev,
      [field]: value,
    }));
  };

  const saveField = async (field: string, value: any) => {
    if (!canEditRecord) return;

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

    // Refresh silently after save. Do not show the loading screen here,
    // because unmounting/remounting the page while typing causes the
    // active section to collapse and the page to jump back to Initiation.
    fetchRecord();
  };

  const saveAll = async () => {
    if (!canEditRecord) {
      alert("Only the CAPA owner can edit this in-process record. Approved or closed records require a controlled workflow return.");
      return;
    }

    const { error } = await supabase
      .from("capas")
      .update({
        problem_description: record.problem_description || record.problem_statement || null,
        problem_statement: record.problem_description || record.problem_statement || null,
        capa_type: record.capa_type || null,
        capa_source: record.capa_source || null,
        capa_justification: record.capa_justification || null,
        product_impact: record.product_impact || null,
        process_impact: record.process_impact || null,
        detection_source: record.detection_source || null,
        capa_classification: record.capa_classification || null,

        scope_summary: record.scope_summary || null,
        affected_product: record.affected_product || null,
        affected_lot: record.affected_lot || null,
        affected_process: record.affected_process || null,
        affected_supplier: record.affected_supplier || null,
        potential_impact: record.potential_impact || null,

        interim_controls_required: record.interim_controls_required || null,
        no_interim_controls_justification:
          record.no_interim_controls_justification || null,
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
        risk_assessment_method: record.risk_assessment_method || "automatic",
        risk_level:
          record.risk_assessment_method === "manual"
            ? record.risk_level || null
            : getEffectiveRiskLevel() || null,
        risk_override_enabled: record.risk_override_enabled || false,
        risk_override_level: record.risk_override_level || null,
        risk_override_justification: record.risk_override_justification || null,
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
        required_resources: record.required_resources || null,
        required_evidence: record.required_evidence || null,
        verification_method: record.verification_method || null,
        effectiveness_success_criteria: record.effectiveness_success_criteria || null,
        effectiveness_data_to_collect: record.effectiveness_data_to_collect || null,
        effectiveness_sample_size: record.effectiveness_sample_size || null,
        verification_owner: record.verification_owner || null,
        verification_due_date: record.verification_due_date || null,
        required_objective_evidence: record.required_objective_evidence || null,

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
    if (!canEditRecord) {
      alert("Only the CAPA owner can edit this in-process record. Approved or closed records require a controlled workflow return.");
      return;
    }

    if (implementationTaskAssignmentLocked) {
      alert(
        "Implementation task assignment is available only after action plan approval."
      );
      return;
    }

    if (!newTask.task_title.trim()) {
      alert("Task title is required.");
      return;
    }

    const taskOwnerEmail = normalizeEmail(newTask.owner);

    if (!taskOwnerEmail) {
      alert(
        "Task owner email is required. Notifications are sent to this email address."
      );
      return;
    }

    const { data: capaTask, error } = await supabase
      .from("capa_tasks")
      .insert({
        capa_id: id,
        task_type: newTask.task_type,
        task_title: newTask.task_title,
        task_description: newTask.task_description || null,
        owner: taskOwnerEmail,
        owner_email: taskOwnerEmail,
        due_date: newTask.due_date || null,
        status: "open",
        created_by: userEmail || "unknown",
        sequence_order: tasks.length + 1,
      })
      .select()
      .single();

    if (error) {
      alert(error.message);
      return;
    }

    const { data: centralTask, error: approvalTaskError } = await supabase
      .from("approval_tasks")
      .insert({
        entity_type: "capa",
        entity_id: id,
        task_type: "capa_implementation_task",
        task_title: newTask.task_title,
        required_function: newTask.task_title,
        due_date: newTask.due_date || null,
        assigned_to_email: taskOwnerEmail,
        assigned_by_email: userEmail || "unknown",
        status: "pending",
        required: true,
        comments:
          newTask.task_description ||
          `Please complete the assigned CAPA implementation task for ${record?.capa_number || "this CAPA"}.`,
        capa_task_id: capaTask?.id,
      })
      .select()
      .single();

    if (approvalTaskError) {
      alert(approvalTaskError.message);
      return;
    }

    await addAuditLog(
      "task_created",
      `CAPA implementation task created and routed to My Approval Tasks: ${newTask.task_title}`
    );

    await createNotification({
      userEmail: taskOwnerEmail,
      title: "CAPA Implementation Task Assigned",
      message: `You have been assigned a CAPA implementation task: ${newTask.task_title}`,
      notificationType: "capa_implementation_task_assigned",
      severity: "medium",
      relatedRecordId: id,
      relatedModule: "capa",
      relatedUrl: `/my-approval-tasks`,
      createdBy: userEmail,
      deduplicationKey: `CAPA_IMPLEMENTATION_TASK_${id}_${centralTask?.id || newTask.task_title}_${taskOwnerEmail}`,
    });

    if (centralTask?.id) {
      await supabase.from("notification_queue").insert({
        recipient_email: taskOwnerEmail,
        subject: `CAPA implementation task assigned: ${record?.capa_number || "CAPA"}`,
        body: `You have been assigned a CAPA implementation task for ${record?.capa_number || "this CAPA"}. Please open My Approval Tasks.`,
        entity_type: "capa",
        entity_id: id,
        task_id: centralTask.id,
        status: "pending",
      });
    }

    setNewTask({
      task_type: "corrective_action",
      task_title: "",
      task_description: "",
      owner: "",
      due_date: "",
    });

    fetchTasks();
    fetchApprovalTasks();
  };

  const updateTaskStatus = async (task: CapaTask, status: string) => {
    if (!canEditRecord) {
      alert("Only the CAPA owner can edit this in-process record. Approved or closed records require a controlled workflow return.");
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
        relatedUrl: `/my-approval-tasks`,
        createdBy: userEmail,
      });
    }

    fetchTasks();
  };

  const completeTask = async (task: CapaTask) => {
    if (isLocked || implementationLocked) {
      alert("CAPA task execution is locked until the action plan is approved.");
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

  const submitInitiationApproval = async () => {
    if (!canEditRecord) return;

    if (!record?.problem_description && !record?.problem_statement) {
      return alert("Problem statement is required before initiation approval.");
    }

    if (!record?.capa_justification) {
      return alert("CAPA justification is required before initiation approval.");
    }

    if (!record?.capa_type) {
      return alert("CAPA type is required before initiation approval.");
    }

    await saveAll();

    const submitted = await submitGateForApproval("initiation", initiationApprovalComments);
    if (submitted) {
      alert("CAPA initiation package submitted for approval.");
    }
  };

  const approveInitiation = async () => {
    await completeGateApproval("initiation", initiationApprovalComments);
  };
  const rejectInitiation = async () => {
    await rejectGateApproval("initiation", initiationApprovalComments);
  };
  const submitInvestigationApproval = async () => {
    if (!canEditRecord) return;

    if (!initiationApproved) return alert("Initiation approval is required before investigation approval.");
    if (!record?.scope_summary) return alert("Scope summary is required.");
    if (!record?.interim_controls_required) return alert("Interim Controls Required must be answered.");
    if (
      record?.interim_controls_required === "yes" &&
      !record?.containment_action
    ) {
      return alert("Interim control description is required when interim controls are required.");
    }
    if (
      record?.interim_controls_required === "no" &&
      !record?.no_interim_controls_justification
    ) {
      return alert("Rationale for no interim controls is required.");
    }
    if (!record?.investigation_findings && !record?.investigation_summary) {
      return alert("Investigation findings are required.");
    }
    if (!record?.root_cause) return alert("Root cause is required.");
    if (!record?.severity) return alert("Severity is required.");
    if (!getEffectiveRiskLevel()) return alert("Risk level is required.");
    if (!record?.risk_rationale && !record?.risk_assessment) {
      return alert("Risk rationale is required.");
    }

    await saveAll();

    const submitted = await submitGateForApproval("investigation", investigationApprovalComments);
    if (submitted) {
      alert("Investigation package submitted for approval.");
    }
  };

  const approveInvestigation = async () => {
    await completeGateApproval("investigation", investigationApprovalComments);
  };
  const rejectInvestigation = async () => {
    await rejectGateApproval("investigation", investigationApprovalComments);
  };
  const submitActionPlanApproval = async () => {
    if (!canEditRecord) return;

    if (!investigationApproved) {
      return alert("Investigation approval is required before action plan approval.");
    }

    if (!record?.corrective_action_plan) {
      return alert("Action plan is required.");
    }

    if (!record?.action_owner) {
      return alert("Action owner is required.");
    }

    if (!record?.action_due_date) {
      return alert("Action due date is required.");
    }

    if (!record?.verification_method) {
      return alert("Verification method is required.");
    }

    await saveAll();

    const submitted = await submitGateForApproval("action_plan", actionPlanApprovalComments);
    if (submitted) {
      alert("Action plan package submitted for approval.");
    }
  };

  const approveActionPlan = async () => {
    await completeGateApproval("action_plan", actionPlanApprovalComments);
  };
  const rejectActionPlan = async () => {
    await rejectGateApproval("action_plan", actionPlanApprovalComments);
  };
  const completeGateApproval = async (_gate: ApprovalGateKey, _comments: string) => {
    alert("CAPA approvals are completed from My Approval Tasks.");
  };

  const markImplemented = async () => {
    if (implementationLocked) {
      alert(
        "Implementation is locked until action plan approval is complete."
      );
      return;
    }

    if (!actionPlanApproved) {
      return alert("Action plan approval is required before implementation.");
    }

    if (!record?.corrective_action_plan) {
      return alert("Action plan is required.");
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
    if (!canEditRecord) return;

    if (!investigationApproved) {
      alert("Investigation approval is required before closure.");
      return;
    }

    if (!actionPlanApproved) {
      alert("Action plan approval is required before closure.");
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

    const submitted = await submitGateForApproval("closure", closureApprovalComments);
    if (submitted) {
      alert("CAPA submitted for closure approval.");
    }
  };

  const approveClosure = async () => {
    if (!tasksComplete) {
      alert("All CAPA execution tasks must be completed before closure approval.");
      return;
    }

    await completeGateApproval("closure", closureApprovalComments);
  };
  const rejectClosure = async () => {
    await rejectGateApproval("closure", closureApprovalComments);
  };
  const cancelCapa = async () => {
    if (!canEditRecord) return;

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
        key: "initiation",
        label: "Initiation",
        completed: Boolean(
          record?.problem_description &&
            record?.capa_justification &&
            record?.capa_type
        ),
      },
      {
        key: "evaluation",
        label: "Evaluation",
        completed: Boolean(
          record?.scope_summary &&
            record?.interim_controls_required &&
            (record?.interim_controls_required === "yes"
              ? record?.containment_action
              : record?.no_interim_controls_justification) &&
            record?.severity &&
            getEffectiveRiskLevel()
        ),
        locked: evaluationLocked,
      },
      {
        key: "investigation",
        label: "Investigation",
        completed: Boolean(
          record?.investigation_findings || record?.investigation_summary
        ),
        locked: investigationLocked,
      },
      {
        key: "rootcause",
        label: "Root Cause Determination",
        completed: Boolean(record?.root_cause),
        locked: investigationLocked,
      },
      {
        key: "actionplan",
        label: "Action Plan Proposal",
        completed: Boolean(record?.corrective_action_plan),
        locked: actionPlanPlanningLocked,
      },
      {
        key: "implementation",
        label: "Implementation",
        completed: Boolean(record?.implemented_by || record?.implementation_details),
        locked: implementationLocked,
      },
      {
        key: "effectivenessplan",
        label: "Effectiveness Plan",
        completed: Boolean(record?.verification_method && record?.effectiveness_success_criteria),
        locked: effectivenessPlanLocked,
      },
      {
        key: "effectiveness",
        label: "Effectiveness Verification",
        completed: Boolean(record?.effectiveness_rating && record?.effectiveness_check),
        locked: implementationLocked,
      },
    ],
    [
      record,
      initiationApproved,
      investigationApproved,
      actionPlanApproved,
      closureApproved,
      evaluationLocked,
      investigationLocked,
      actionPlanPlanningLocked,
      implementationLocked,
      effectivenessPlanLocked,
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
            Initiation → Evaluation → Investigation →
            Root Cause Determination → Action Plan →
            Implementation → Effectiveness Plan →
            Effectiveness Verification → Closure.
          </p>
        </div>

        <div style={buttonRowStyle} className="no-print">
          <button onClick={() => window.print()} style={secondaryButtonStyle}>
            Print Workflow
          </button>
          <button
            onClick={saveAll}
            disabled={!canEditRecord}
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

      {readOnlyForNonOwner ? (
        <section style={readOnlyBannerStyle}>
          👁️ READ ONLY — You are not the CAPA owner. You may review the record,
          but edits must be performed by the CAPA owner or through a controlled
          workflow return.
        </section>
      ) : null}

      <section style={summaryGridStyle}>
        <SummaryCard label="Owner" value={record.owner} />
        <SummaryCard label="Due Date" value={record.due_date} />
        <SummaryCard label="Supplier" value={record.supplier_name} />
        <SummaryCard label="Linked NCMR" value={record.linked_ncmr_title} />
        <SummaryCard label="CAPA Type" value={record.capa_type || record.capa_classification} />
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
            sectionKey="initiation"
            title="1. Initiation"
            subtitle="Document the CAPA type, source, problem statement, justification, and impact before Quality approval."
            expanded={expandedSections.includes("initiation")}
            onToggle={() => toggleSection("initiation")}
          >
            <div style={formGridStyle}>
              <Field label="CAPA Type">
                <select
                  value={record.capa_type || ""}
                  onChange={(e) => {
                    updateField("capa_type", e.target.value);
                    saveField("capa_type", e.target.value);
                  }}
                  disabled={!canEditRecord}
                  style={inputStyle(!canEditRecord)}
                >
                  <option value="">Select</option>
                  <option value="corrective">Corrective CAPA</option>
                  <option value="preventive">Preventive CAPA</option>
                </select>
              </Field>

              <Field label="CAPA Source">
                <input
                  value={record.capa_source || record.source_type || ""}
                  onChange={(e) => updateField("capa_source", e.target.value)}
                  onBlur={(e) => saveField("capa_source", e.target.value)}
                  disabled={!canEditRecord}
                  style={inputStyle(!canEditRecord)}
                />
              </Field>
            </div>

            <Field label="Problem Statement">
              <textarea
                value={record.problem_description || record.problem_statement || ""}
                onChange={(e) =>
                  updateField("problem_description", e.target.value)
                }
                onBlur={(e) => saveField("problem_description", e.target.value)}
                disabled={!canEditRecord}
                rows={4}
                style={textareaStyle(!canEditRecord)}
              />
            </Field>

            <Field label="Justification for CAPA">
              <textarea
                value={record.capa_justification || ""}
                onChange={(e) =>
                  updateField("capa_justification", e.target.value)
                }
                onBlur={(e) => saveField("capa_justification", e.target.value)}
                disabled={!canEditRecord}
                rows={3}
                style={textareaStyle(!canEditRecord)}
              />
            </Field>

            <div style={formGridStyle}>
              <Field label="Product Impact">
                <textarea
                  value={record.product_impact || record.product_quality_impact || ""}
                  onChange={(e) => updateField("product_impact", e.target.value)}
                  onBlur={(e) => saveField("product_impact", e.target.value)}
                  disabled={!canEditRecord}
                  rows={3}
                  style={textareaStyle(!canEditRecord)}
                />
              </Field>

              <Field label="Process Impact">
                <textarea
                  value={record.process_impact || record.affected_process || ""}
                  onChange={(e) => updateField("process_impact", e.target.value)}
                  onBlur={(e) => saveField("process_impact", e.target.value)}
                  disabled={!canEditRecord}
                  rows={3}
                  style={textareaStyle(!canEditRecord)}
                />
              </Field>

              <Field label="Patient Impact">
                <textarea
                  value={record.patient_safety_impact || ""}
                  onChange={(e) =>
                    updateField("patient_safety_impact", e.target.value)
                  }
                  onBlur={(e) =>
                    saveField("patient_safety_impact", e.target.value)
                  }
                  disabled={!canEditRecord}
                  rows={3}
                  style={textareaStyle(!canEditRecord)}
                />
              </Field>
            </div>


<ApprovalInlinePanel
            sectionKey="initiationapproval-inline"
            gateKey="initiation"
            title="Approvers / Submit Initiation for Approval"
            description="Quality approval confirms the CAPA is justified and may proceed to evaluation and investigation."
            status={record.initiation_approval_status || "not_submitted"}
            comments={initiationApprovalComments}
            setComments={setInitiationApprovalComments}
            submittedBy={record.initiation_submitted_by}
            submittedAt={record.initiation_submitted_at}
            approvedBy={record.initiation_approved_by}
            approvedAt={record.initiation_approved_at}
            rejectedBy={record.initiation_rejected_by}
            rejectedAt={record.initiation_rejected_at}
            disabled={!canEditRecord}
            canApprove={canApprove}
            expanded={expandedSections.includes("initiationapproval")}
            onToggle={() => toggleSection("initiationapproval")}
            approvalMatrixTemplates={approvalMatrixTemplates}
            selectedApprovalMatrixId={selectedApprovalMatrixByGate["initiation"] || ""}
            setSelectedApprovalMatrixId={(value) =>
              setSelectedApprovalMatrixByGate((prev) => ({ ...prev, initiation: value }))
            }
            manualApproverEmail={manualApproverEmailByGate["initiation"] || ""}
            setManualApproverEmail={(value) =>
              setManualApproverEmailByGate((prev) => ({ ...prev, initiation: value }))
            }
              manualApproverFunction={manualApproverFunctionByGate["initiation"] || ""}
              setManualApproverFunction={(value) =>
                setManualApproverFunctionByGate((prev) => ({ ...prev, initiation: value }))
              }
              manualApproverJobTitle={manualApproverJobTitleByGate["initiation"] || ""}
              setManualApproverJobTitle={(value) =>
                setManualApproverJobTitleByGate((prev) => ({ ...prev, initiation: value }))
              }
              manualApproverDueDate={manualApproverDueDateByGate["initiation"] || ""}
              setManualApproverDueDate={(value) =>
                setManualApproverDueDateByGate((prev) => ({ ...prev, initiation: value }))
              }
            manualApproverRole={manualApproverRoleByGate["initiation"] || manualApproverJobTitleByGate["initiation"] || ""}
            setManualApproverRole={(value) =>
              setManualApproverRoleByGate((prev) => ({ ...prev, initiation: value }))
            }
            manualApproverRequired={manualApproverRequiredByGate["initiation"] !== false}
            setManualApproverRequired={(value) =>
              setManualApproverRequiredByGate((prev) => ({ ...prev, initiation: value }))
            }
            configuredApprovers={getGateApprovers("initiation")}
            approvalTasks={getGateApprovalTasks("initiation")}
            loadingApprovals={loadingApprovals}
            onLoadMatrix={() => loadApproversFromMatrix("initiation")}
            onAddManualApprover={() => addManualApprover("initiation")}
            onRemoveApprover={(approverId) => removeGateApprover("initiation", approverId)}
            onSubmit={submitInitiationApproval}
            onApprove={approveInitiation}
            onReject={rejectInitiation}
          />
          </WorkflowCard>

          

          <WorkflowCard
            sectionKey="evaluation"
            title="3. Evaluation"
            subtitle="Define scope, interim controls, severity, occurrence, detection, risk assessment, impact, and rationale."
            locked={evaluationLocked}
            expanded={expandedSections.includes("evaluation")}
            onToggle={() => toggleSection("evaluation")}
          >
            {evaluationLocked && !isLocked ? (
              <p style={subtleText}>Initiation approval is required before Evaluation can be edited.</p>
            ) : null}

            <h3>Scope</h3>
            <Field label="Scope Summary">
              <textarea
                value={record.scope_summary || ""}
                onChange={(e) => updateField("scope_summary", e.target.value)}
                onBlur={(e) => saveField("scope_summary", e.target.value)}
                disabled={evaluationLocked}
                rows={3}
                style={textareaStyle(evaluationLocked)}
              />
            </Field>

            <div style={formGridStyle}>
              <Field label="Affected Product">
                <input
                  value={record.affected_product || ""}
                  onChange={(e) => updateField("affected_product", e.target.value)}
                  onBlur={(e) => saveField("affected_product", e.target.value)}
                  disabled={evaluationLocked}
                  style={inputStyle(evaluationLocked)}
                />
              </Field>

              <Field label="Affected Lot">
                <input
                  value={record.affected_lot || ""}
                  onChange={(e) => updateField("affected_lot", e.target.value)}
                  onBlur={(e) => saveField("affected_lot", e.target.value)}
                  disabled={evaluationLocked}
                  style={inputStyle(evaluationLocked)}
                />
              </Field>

              <Field label="Affected Process">
                <input
                  value={record.affected_process || ""}
                  onChange={(e) => updateField("affected_process", e.target.value)}
                  onBlur={(e) => saveField("affected_process", e.target.value)}
                  disabled={evaluationLocked}
                  style={inputStyle(evaluationLocked)}
                />
              </Field>

              <Field label="Affected Supplier">
                <input
                  value={record.affected_supplier || record.supplier_name || ""}
                  onChange={(e) => updateField("affected_supplier", e.target.value)}
                  onBlur={(e) => saveField("affected_supplier", e.target.value)}
                  disabled={evaluationLocked}
                  style={inputStyle(evaluationLocked)}
                />
              </Field>
            </div>

            <Field label="Potential Impact">
              <textarea
                value={record.potential_impact || ""}
                onChange={(e) => updateField("potential_impact", e.target.value)}
                onBlur={(e) => saveField("potential_impact", e.target.value)}
                disabled={evaluationLocked}
                rows={3}
                style={textareaStyle(evaluationLocked)}
              />
            </Field>

            <h3>Interim Controls</h3>
            <div style={formGridStyle}>
              <Field label="Interim Controls Required?">
                <select
                  value={record.interim_controls_required || ""}
                  onChange={(e) => {
                    updateField("interim_controls_required", e.target.value);
                    saveField("interim_controls_required", e.target.value);
                  }}
                  disabled={evaluationLocked}
                  style={inputStyle(evaluationLocked)}
                >
                  <option value="">Select</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </Field>

              {record.interim_controls_required === "yes" ? (
                <>
                  <Field label="Interim Control Description">
                    <textarea
                      value={record.containment_action || ""}
                      onChange={(e) => updateField("containment_action", e.target.value)}
                      onBlur={(e) => saveField("containment_action", e.target.value)}
                      disabled={evaluationLocked}
                      rows={4}
                      style={textareaStyle(evaluationLocked)}
                    />
                  </Field>

                  <Field label="Interim Control Owner">
                    <input
                      value={record.containment_owner || ""}
                      onChange={(e) => updateField("containment_owner", e.target.value)}
                      onBlur={(e) => saveField("containment_owner", e.target.value)}
                      disabled={evaluationLocked}
                      style={inputStyle(evaluationLocked)}
                    />
                  </Field>

                  <Field label="Interim Control Complete">
                    <select
                      value={record.containment_complete || ""}
                      onChange={(e) => {
                        updateField("containment_complete", e.target.value);
                        saveField("containment_complete", e.target.value);
                      }}
                      disabled={evaluationLocked}
                      style={inputStyle(evaluationLocked)}
                    >
                      <option value="">Select</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                      <option value="not_required">Not Required</option>
                    </select>
                  </Field>
                </>
              ) : null}
            </div>

            {record.interim_controls_required === "no" ? (
              <Field label="Rationale for No Interim Controls">
                <textarea
                  value={record.no_interim_controls_justification || ""}
                  onChange={(e) =>
                    updateField("no_interim_controls_justification", e.target.value)
                  }
                  onBlur={(e) =>
                    saveField("no_interim_controls_justification", e.target.value)
                  }
                  disabled={evaluationLocked}
                  rows={3}
                  style={textareaStyle(evaluationLocked)}
                />
              </Field>
            ) : null}

            <Field label="Residual Risk After Interim Controls">
              <textarea
                value={record.containment_residual_risk || ""}
                onChange={(e) =>
                  updateField("containment_residual_risk", e.target.value)
                }
                onBlur={(e) =>
                  saveField("containment_residual_risk", e.target.value)
                }
                disabled={evaluationLocked}
                rows={3}
                style={textareaStyle(evaluationLocked)}
              />
            </Field>

            <h3>Risk Assessment</h3>
            <div style={formGridStyle}>
              <Field label="Risk Assessment Method">
                <select
                  value={record.risk_assessment_method || "automatic"}
                  onChange={(e) => {
                    updateField("risk_assessment_method", e.target.value);
                    saveField("risk_assessment_method", e.target.value);
                  }}
                  disabled={evaluationLocked}
                  style={inputStyle(evaluationLocked)}
                >
                  <option value="automatic">Automatic</option>
                  <option value="manual">Manual</option>
                </select>
              </Field>

              <Field label="Severity">
                <select
                  value={record.severity || ""}
                  onChange={(e) => {
                    updateField("severity", e.target.value);
                    saveField("severity", e.target.value);
                  }}
                  disabled={evaluationLocked}
                  style={inputStyle(evaluationLocked)}
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
                  disabled={evaluationLocked}
                  style={inputStyle(evaluationLocked)}
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
                  disabled={evaluationLocked}
                  style={inputStyle(evaluationLocked)}
                >
                  <option value="">Select</option>
                  <option value="high_detection">High Detection</option>
                  <option value="medium_detection">Medium Detection</option>
                  <option value="low_detection">Low Detection</option>
                </select>
              </Field>
            </div>

            {record.risk_assessment_method === "manual" ? (
              <Field label="Risk Level">
                <select
                  value={record.risk_level || ""}
                  onChange={(e) => {
                    updateField("risk_level", e.target.value);
                    saveField("risk_level", e.target.value);
                  }}
                  disabled={evaluationLocked}
                  style={inputStyle(evaluationLocked)}
                >
                  <option value="">Select</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </Field>
            ) : (
              <div
                style={{
                  border: "1px solid #bfdbfe",
                  background: "#eff6ff",
                  padding: "12px",
                  borderRadius: "10px",
                  marginBottom: "12px",
                }}
              >
                <strong>Calculated Risk Level:</strong>{" "}
                {calculateCapaRiskLevel(
                  record.severity,
                  record.occurrence_rating,
                  record.detection_rating
                ) || "Not Calculated"}
              </div>
            )}

            {record.risk_assessment_method !== "manual" ? (
              <div style={formGridStyle}>
                <Field label="Override Calculated Risk?">
                  <YesNoSelect
                    value={record.risk_override_enabled ? "yes" : "no"}
                    onChange={(value) => {
                      updateField("risk_override_enabled", value === "yes");
                      saveField("risk_override_enabled", value === "yes");
                    }}
                    disabled={evaluationLocked}
                  />
                </Field>

                {record.risk_override_enabled ? (
                  <>
                    <Field label="Override Risk Level">
                      <select
                        value={record.risk_override_level || ""}
                        onChange={(e) => {
                          updateField("risk_override_level", e.target.value);
                          saveField("risk_override_level", e.target.value);
                        }}
                        disabled={evaluationLocked}
                        style={inputStyle(evaluationLocked)}
                      >
                        <option value="">Select</option>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                      </select>
                    </Field>

                    <Field label="Risk Override Justification">
                      <textarea
                        value={record.risk_override_justification || ""}
                        onChange={(e) =>
                          updateField("risk_override_justification", e.target.value)
                        }
                        onBlur={(e) =>
                          saveField("risk_override_justification", e.target.value)
                        }
                        disabled={evaluationLocked}
                        rows={3}
                        style={textareaStyle(evaluationLocked)}
                      />
                    </Field>
                  </>
                ) : null}
              </div>
            ) : null}

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
                  disabled={evaluationLocked}
                  rows={3}
                  style={textareaStyle(evaluationLocked)}
                />
              </Field>

              <Field label="Product Quality Impact">
                <textarea
                  value={record.product_quality_impact || record.product_impact || ""}
                  onChange={(e) =>
                    updateField("product_quality_impact", e.target.value)
                  }
                  onBlur={(e) =>
                    saveField("product_quality_impact", e.target.value)
                  }
                  disabled={evaluationLocked}
                  rows={3}
                  style={textareaStyle(evaluationLocked)}
                />
              </Field>

              <Field label="Regulatory Impact">
                <textarea
                  value={record.regulatory_impact || ""}
                  onChange={(e) => updateField("regulatory_impact", e.target.value)}
                  onBlur={(e) => saveField("regulatory_impact", e.target.value)}
                  disabled={evaluationLocked}
                  rows={3}
                  style={textareaStyle(evaluationLocked)}
                />
              </Field>

              <Field label="Risk Rationale">
                <textarea
                  value={record.risk_rationale || record.risk_assessment || ""}
                  onChange={(e) => updateField("risk_rationale", e.target.value)}
                  onBlur={(e) => saveField("risk_rationale", e.target.value)}
                  disabled={evaluationLocked}
                  rows={3}
                  style={textareaStyle(evaluationLocked)}
                />
              </Field>
            </div>
          </WorkflowCard>

          <WorkflowCard
            sectionKey="investigation"
            title="4. Investigation"
            subtitle="Document objective, evidence reviewed, findings, and conclusion."
            expanded={expandedSections.includes("investigation")}
            onToggle={() => toggleSection("investigation")}
            locked={investigationLocked}
          >
            {investigationLocked && !isLocked ? (
              <p style={subtleText}>Initiation approval is required before Investigation can be edited.</p>
            ) : null}
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
                  disabled={!canEditRecord}
                  rows={3}
                  style={textareaStyle(!canEditRecord)}
                />
              </Field>

              <Field label="Evidence Reviewed">
                <textarea
                  value={record.evidence_reviewed || ""}
                  onChange={(e) => updateField("evidence_reviewed", e.target.value)}
                  onBlur={(e) => saveField("evidence_reviewed", e.target.value)}
                  disabled={!canEditRecord}
                  rows={3}
                  style={textareaStyle(!canEditRecord)}
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
                  disabled={!canEditRecord}
                  rows={4}
                  style={textareaStyle(!canEditRecord)}
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
                  disabled={!canEditRecord}
                  rows={3}
                  style={textareaStyle(!canEditRecord)}
                />
              </Field>
            </div>
          </WorkflowCard>

          <WorkflowCard
            sectionKey="rootcause"
            title="5. Root Cause Determination"
            subtitle="Document root cause analysis method, verified root cause, contributing factors, verification, and systemic impact."
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
                  disabled={!canEditRecord}
                  style={inputStyle(!canEditRecord)}
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
                  disabled={!canEditRecord}
                  rows={4}
                  style={textareaStyle(!canEditRecord)}
                />
              </Field>

              <Field label="Contributing Factors">
                <textarea
                  value={record.contributing_factors || ""}
                  onChange={(e) =>
                    updateField("contributing_factors", e.target.value)
                  }
                  onBlur={(e) => saveField("contributing_factors", e.target.value)}
                  disabled={!canEditRecord}
                  rows={3}
                  style={textareaStyle(!canEditRecord)}
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
                  disabled={!canEditRecord}
                  rows={3}
                  style={textareaStyle(!canEditRecord)}
                />
              </Field>

              <Field label="Systemic Impact">
                <textarea
                  value={record.systemic_impact || ""}
                  onChange={(e) => updateField("systemic_impact", e.target.value)}
                  onBlur={(e) => saveField("systemic_impact", e.target.value)}
                  disabled={!canEditRecord}
                  rows={3}
                  style={textareaStyle(!canEditRecord)}
                />
              </Field>
            </div>


<ApprovalInlinePanel
            sectionKey="investigationapproval-inline"
            gateKey="investigation"
            title="Approvers / Submit Investigation for Approval"
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
            disabled={!canEditRecord}
            canApprove={canApprove}
            expanded={expandedSections.includes("investigationapproval")}
            onToggle={() => toggleSection("investigationapproval")}
            approvalMatrixTemplates={approvalMatrixTemplates}
            selectedApprovalMatrixId={selectedApprovalMatrixByGate["investigation"] || ""}
            setSelectedApprovalMatrixId={(value) =>
              setSelectedApprovalMatrixByGate((prev) => ({ ...prev, investigation: value }))
            }
            manualApproverEmail={manualApproverEmailByGate["investigation"] || ""}
            setManualApproverEmail={(value) =>
              setManualApproverEmailByGate((prev) => ({ ...prev, investigation: value }))
            }
              manualApproverFunction={manualApproverFunctionByGate["investigation"] || ""}
              setManualApproverFunction={(value) =>
                setManualApproverFunctionByGate((prev) => ({ ...prev, investigation: value }))
              }
              manualApproverJobTitle={manualApproverJobTitleByGate["investigation"] || ""}
              setManualApproverJobTitle={(value) =>
                setManualApproverJobTitleByGate((prev) => ({ ...prev, investigation: value }))
              }
              manualApproverDueDate={manualApproverDueDateByGate["investigation"] || ""}
              setManualApproverDueDate={(value) =>
                setManualApproverDueDateByGate((prev) => ({ ...prev, investigation: value }))
              }
            manualApproverRole={manualApproverRoleByGate["investigation"] || manualApproverJobTitleByGate["investigation"] || ""}
            setManualApproverRole={(value) =>
              setManualApproverRoleByGate((prev) => ({ ...prev, investigation: value }))
            }
            manualApproverRequired={manualApproverRequiredByGate["investigation"] !== false}
            setManualApproverRequired={(value) =>
              setManualApproverRequiredByGate((prev) => ({ ...prev, investigation: value }))
            }
            configuredApprovers={getGateApprovers("investigation")}
            approvalTasks={getGateApprovalTasks("investigation")}
            loadingApprovals={loadingApprovals}
            onLoadMatrix={() => loadApproversFromMatrix("investigation")}
            onAddManualApprover={() => addManualApprover("investigation")}
            onRemoveApprover={(approverId) => removeGateApprover("investigation", approverId)}
            onSubmit={submitInvestigationApproval}
            onApprove={approveInvestigation}
            onReject={rejectInvestigation}
          />
          </WorkflowCard>

          

          <WorkflowCard
            sectionKey="actionplan"
            title="7. Action Plan Proposal"
            subtitle="Define the corrective or preventive action plan, owner, due date, required resources, required evidence, and effectiveness plan."
            locked={actionPlanPlanningLocked}
            expanded={expandedSections.includes("actionplan")}
            onToggle={() => toggleSection("actionplan")}
          >
            {actionPlanPlanningLocked && !isLocked ? <LockNotice /> : null}

            <div style={formGridStyle}>
              <Field label={record.capa_type === "preventive" ? "Preventive Action Plan" : "Corrective Action Plan"}>
                <textarea
                  value={record.corrective_action_plan || ""}
                  onChange={(e) =>
                    updateField("corrective_action_plan", e.target.value)
                  }
                  onBlur={(e) => saveField("corrective_action_plan", e.target.value)}
                  disabled={actionPlanPlanningLocked}
                  rows={4}
                  style={textareaStyle(actionPlanPlanningLocked)}
                />
              </Field>

              <Field label="Action Owner">
                <input
                  value={record.action_owner || ""}
                  onChange={(e) => updateField("action_owner", e.target.value)}
                  onBlur={(e) => saveField("action_owner", e.target.value)}
                  disabled={actionPlanPlanningLocked}
                  style={inputStyle(actionPlanPlanningLocked)}
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
                  disabled={actionPlanPlanningLocked}
                  style={inputStyle(actionPlanPlanningLocked)}
                />
              </Field>

              <Field label="Verification Method">
                <textarea
                  value={record.verification_method || ""}
                  onChange={(e) => updateField("verification_method", e.target.value)}
                  onBlur={(e) => saveField("verification_method", e.target.value)}
                  disabled={actionPlanPlanningLocked}
                  rows={3}
                  style={textareaStyle(actionPlanPlanningLocked)}
                />
              </Field>

              <Field label="Required Resources">
                <textarea
                  value={record.required_resources || ""}
                  onChange={(e) => updateField("required_resources", e.target.value)}
                  onBlur={(e) => saveField("required_resources", e.target.value)}
                  disabled={actionPlanPlanningLocked}
                  rows={3}
                  style={textareaStyle(actionPlanPlanningLocked)}
                />
              </Field>

              <Field label="Required Evidence">
                <textarea
                  value={record.required_evidence || ""}
                  onChange={(e) => updateField("required_evidence", e.target.value)}
                  onBlur={(e) => saveField("required_evidence", e.target.value)}
                  disabled={actionPlanPlanningLocked}
                  rows={3}
                  style={textareaStyle(actionPlanPlanningLocked)}
                />
              </Field>
            </div>

<ApprovalInlinePanel
            sectionKey="actionplanapproval-inline"
            gateKey="action_plan"
            title="Approvers / Submit Action Plan for Approval"
            description="Approve the proposed action plan, implementation task assignments, and effectiveness plan before execution."
            status={record.action_plan_approval_status || "not_submitted"}
            comments={actionPlanApprovalComments}
            setComments={setActionPlanApprovalComments}
            submittedBy={record.action_plan_submitted_by}
            submittedAt={record.action_plan_submitted_at}
            approvedBy={record.action_plan_approved_by}
            approvedAt={record.action_plan_approved_at}
            rejectedBy={record.action_plan_rejected_by}
            rejectedAt={record.action_plan_rejected_at}
            disabled={!canEditRecord}
            canApprove={canApprove}
            expanded={expandedSections.includes("actionplanapproval")}
            onToggle={() => toggleSection("actionplanapproval")}
            approvalMatrixTemplates={approvalMatrixTemplates}
            selectedApprovalMatrixId={selectedApprovalMatrixByGate["action_plan"] || ""}
            setSelectedApprovalMatrixId={(value) =>
              setSelectedApprovalMatrixByGate((prev) => ({ ...prev, action_plan: value }))
            }
            manualApproverEmail={manualApproverEmailByGate["action_plan"] || ""}
            setManualApproverEmail={(value) =>
              setManualApproverEmailByGate((prev) => ({ ...prev, action_plan: value }))
            }
              manualApproverFunction={manualApproverFunctionByGate["action_plan"] || ""}
              setManualApproverFunction={(value) =>
                setManualApproverFunctionByGate((prev) => ({ ...prev, action_plan: value }))
              }
              manualApproverJobTitle={manualApproverJobTitleByGate["action_plan"] || ""}
              setManualApproverJobTitle={(value) =>
                setManualApproverJobTitleByGate((prev) => ({ ...prev, action_plan: value }))
              }
              manualApproverDueDate={manualApproverDueDateByGate["action_plan"] || ""}
              setManualApproverDueDate={(value) =>
                setManualApproverDueDateByGate((prev) => ({ ...prev, action_plan: value }))
              }
            manualApproverRole={manualApproverRoleByGate["action_plan"] || manualApproverJobTitleByGate["action_plan"] || ""}
            setManualApproverRole={(value) =>
              setManualApproverRoleByGate((prev) => ({ ...prev, action_plan: value }))
            }
            manualApproverRequired={manualApproverRequiredByGate["action_plan"] !== false}
            setManualApproverRequired={(value) =>
              setManualApproverRequiredByGate((prev) => ({ ...prev, action_plan: value }))
            }
            configuredApprovers={getGateApprovers("action_plan")}
            approvalTasks={getGateApprovalTasks("action_plan")}
            loadingApprovals={loadingApprovals}
            onLoadMatrix={() => loadApproversFromMatrix("action_plan")}
            onAddManualApprover={() => addManualApprover("action_plan")}
            onRemoveApprover={(approverId) => removeGateApprover("action_plan", approverId)}
            onSubmit={submitActionPlanApproval}
            onApprove={approveActionPlan}
            onReject={rejectActionPlan}
          />
          </WorkflowCard>

          <WorkflowCard
            sectionKey="implementationtasks"
            title="8. Implementation Task Assignment"
            subtitle="Assign implementation tasks after the action plan has been approved."
            locked={implementationTaskAssignmentLocked}
            expanded={expandedSections.includes("implementationtasks")}
            onToggle={() => toggleSection("implementationtasks")}
          >
            {implementationTaskAssignmentLocked && !isLocked ? <LockNotice /> : null}

            {!implementationTaskAssignmentLocked ? (
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

                  <Field label="Task Owner Email">
                    <input
                      type="email"
                      value={newTask.owner}
                      onChange={(e) =>
                        setNewTask({ ...newTask, owner: e.target.value })
                      }
                      placeholder="owner@company.com"
                      style={inputStyle(false)}
                    />
                    <div style={helperTextStyle}>
                      Notifications are sent to this email address.
                    </div>
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
                    locked={implementationLocked}
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
            title="9. Implementation"
            subtitle="Execute the approved action plan and complete assigned implementation tasks with evidence."
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
            sectionKey="effectivenessplan"
            title="11. Effectiveness Plan"
            subtitle="Define how CAPA success will be measured before effectiveness verification begins."
            locked={effectivenessPlanLocked}
            expanded={expandedSections.includes("effectivenessplan")}
            onToggle={() => toggleSection("effectivenessplan")}
          >
            {effectivenessPlanLocked && !isLocked ? (
              <p style={subtleText}>
                Implementation must be marked complete before the Effectiveness Plan can be edited.
              </p>
            ) : null}

            <div style={formGridStyle}>
              <Field label="Verification Method">
                <textarea
                  value={record.verification_method || record.monitoring_method || record.effectiveness_plan || ""}
                  onChange={(e) => updateField("verification_method", e.target.value)}
                  onBlur={(e) => saveField("verification_method", e.target.value)}
                  disabled={effectivenessPlanLocked}
                  rows={3}
                  style={textareaStyle(effectivenessPlanLocked)}
                />
              </Field>

              <Field label="Success Criteria">
                <textarea
                  value={record.effectiveness_success_criteria || ""}
                  onChange={(e) =>
                    updateField("effectiveness_success_criteria", e.target.value)
                  }
                  onBlur={(e) =>
                    saveField("effectiveness_success_criteria", e.target.value)
                  }
                  disabled={effectivenessPlanLocked}
                  rows={3}
                  style={textareaStyle(effectivenessPlanLocked)}
                />
              </Field>

              <Field label="Data to Collect">
                <textarea
                  value={record.effectiveness_data_to_collect || ""}
                  onChange={(e) =>
                    updateField("effectiveness_data_to_collect", e.target.value)
                  }
                  onBlur={(e) =>
                    saveField("effectiveness_data_to_collect", e.target.value)
                  }
                  disabled={effectivenessPlanLocked}
                  rows={3}
                  style={textareaStyle(effectivenessPlanLocked)}
                />
              </Field>

              <Field label="Sample Size">
                <input
                  value={record.effectiveness_sample_size || ""}
                  onChange={(e) =>
                    updateField("effectiveness_sample_size", e.target.value)
                  }
                  onBlur={(e) =>
                    saveField("effectiveness_sample_size", e.target.value)
                  }
                  disabled={effectivenessPlanLocked}
                  style={inputStyle(effectivenessPlanLocked)}
                />
              </Field>

              <Field label="Verification Owner">
                <input
                  value={record.verification_owner || ""}
                  onChange={(e) => updateField("verification_owner", e.target.value)}
                  onBlur={(e) => saveField("verification_owner", e.target.value)}
                  disabled={effectivenessPlanLocked}
                  style={inputStyle(effectivenessPlanLocked)}
                />
              </Field>

              <Field label="Verification Due Date">
                <input
                  type="date"
                  value={record.verification_due_date || ""}
                  onChange={(e) => {
                    updateField("verification_due_date", e.target.value);
                    saveField("verification_due_date", e.target.value);
                  }}
                  disabled={effectivenessPlanLocked}
                  style={inputStyle(effectivenessPlanLocked)}
                />
              </Field>
            </div>

            <Field label="Required Objective Evidence">
              <textarea
                value={record.required_objective_evidence || ""}
                onChange={(e) =>
                  updateField("required_objective_evidence", e.target.value)
                }
                onBlur={(e) =>
                  saveField("required_objective_evidence", e.target.value)
                }
                disabled={effectivenessPlanLocked}
                rows={3}
                style={textareaStyle(effectivenessPlanLocked)}
              />
            </Field>
          </WorkflowCard>

          <WorkflowCard
            sectionKey="effectiveness"
            title="12. Effectiveness Verification"
            subtitle="Execute the approved effectiveness plan and document results, recurrence, rating, evidence, and follow-up."
            locked={implementationLocked}
            expanded={expandedSections.includes("effectiveness")}
            onToggle={() => toggleSection("effectiveness")}
          >
            {implementationLocked && !isLocked ? <LockNotice /> : null}

            <div style={formGridStyle}>
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


<ApprovalInlinePanel
            sectionKey="closureapproval-inline"
            gateKey="closure"
            title="Approvers / Submit Closure for Approval"
            description="Final approval confirms implementation, task completion, effectiveness verification, and closure readiness. Approval locks the record."
            status={record.closure_approval_status || "not_submitted"}
            comments={closureApprovalComments}
            setComments={setClosureApprovalComments}
            submittedBy={record.closure_submitted_by}
            submittedAt={record.closure_submitted_at}
            approvedBy={record.closure_approved_by || record.signed_by}
            approvedAt={record.closure_approved_at || record.signed_at}
            rejectedBy={record.closure_rejected_by}
            rejectedAt={record.closure_rejected_at}
            disabled={!canEditRecord}
            canApprove={canApprove}
            expanded={expandedSections.includes("closure")}
            onToggle={() => toggleSection("closure")}
            approvalMatrixTemplates={approvalMatrixTemplates}
            selectedApprovalMatrixId={selectedApprovalMatrixByGate["closure"] || ""}
            setSelectedApprovalMatrixId={(value) =>
              setSelectedApprovalMatrixByGate((prev) => ({ ...prev, closure: value }))
            }
            manualApproverEmail={manualApproverEmailByGate["closure"] || ""}
            setManualApproverEmail={(value) =>
              setManualApproverEmailByGate((prev) => ({ ...prev, closure: value }))
            }
              manualApproverFunction={manualApproverFunctionByGate["closure"] || ""}
              setManualApproverFunction={(value) =>
                setManualApproverFunctionByGate((prev) => ({ ...prev, closure: value }))
              }
              manualApproverJobTitle={manualApproverJobTitleByGate["closure"] || ""}
              setManualApproverJobTitle={(value) =>
                setManualApproverJobTitleByGate((prev) => ({ ...prev, closure: value }))
              }
              manualApproverDueDate={manualApproverDueDateByGate["closure"] || ""}
              setManualApproverDueDate={(value) =>
                setManualApproverDueDateByGate((prev) => ({ ...prev, closure: value }))
              }
            manualApproverRole={manualApproverRoleByGate["closure"] || manualApproverJobTitleByGate["closure"] || ""}
            setManualApproverRole={(value) =>
              setManualApproverRoleByGate((prev) => ({ ...prev, closure: value }))
            }
            manualApproverRequired={manualApproverRequiredByGate["closure"] !== false}
            setManualApproverRequired={(value) =>
              setManualApproverRequiredByGate((prev) => ({ ...prev, closure: value }))
            }
            configuredApprovers={getGateApprovers("closure")}
            approvalTasks={getGateApprovalTasks("closure")}
            loadingApprovals={loadingApprovals}
            onLoadMatrix={() => loadApproversFromMatrix("closure")}
            onAddManualApprover={() => addManualApprover("closure")}
            onRemoveApprover={(approverId) => removeGateApprover("closure", approverId)}
            onSubmit={submitClosureApproval}
            onApprove={approveClosure}
            onReject={rejectClosure}
          />
          </WorkflowCard>

          

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
                    disabled={!canEditRecord}
                    style={inputStyle(!canEditRecord)}
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
                    disabled={!canEditRecord}
                    rows={3}
                    style={textareaStyle(!canEditRecord)}
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
    <div
      style={{
        border: "1px solid #d1d5db",
        borderRadius: "12px",
        padding: "14px",
        marginTop: "18px",
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
    </div>
  );
}

function ApprovalInlinePanel({
  sectionKey,
  gateKey,
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
  approvalMatrixTemplates,
  selectedApprovalMatrixId,
  setSelectedApprovalMatrixId,
  manualApproverEmail,
  setManualApproverEmail,
  manualApproverFunction,
  setManualApproverFunction,
  manualApproverJobTitle,
  setManualApproverJobTitle,
  manualApproverDueDate,
  setManualApproverDueDate,
  manualApproverRole,
  setManualApproverRole,
  manualApproverRequired,
  setManualApproverRequired,
  configuredApprovers,
  approvalTasks,
  loadingApprovals,
  onLoadMatrix,
  onAddManualApprover,
  onRemoveApprover,
  onToggle,
  onSubmit,
  onApprove,
  onReject,
}: {
  sectionKey: string;
  gateKey: ApprovalGateKey;
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
  approvalMatrixTemplates: any[];
  selectedApprovalMatrixId: string;
  setSelectedApprovalMatrixId: (value: string) => void;
  manualApproverEmail: string;
  setManualApproverEmail: (value: string) => void;
  manualApproverFunction: string;
  setManualApproverFunction: (value: string) => void;
  manualApproverJobTitle: string;
  setManualApproverJobTitle: (value: string) => void;
  manualApproverDueDate: string;
  setManualApproverDueDate: (value: string) => void;
  manualApproverRole: string;
  setManualApproverRole: (value: string) => void;
  manualApproverRequired: boolean;
  setManualApproverRequired: (value: boolean) => void;
  configuredApprovers: CapaGateApprover[];
  approvalTasks: CapaApprovalTask[];
  loadingApprovals: boolean;
  onLoadMatrix: () => void;
  onAddManualApprover: () => void;
  onRemoveApprover: (approverId: string) => void;
  onToggle: () => void;
  onSubmit: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const isApproved = status === "approved";
  const isPending = status === "pending";

  if (disabled || isApproved || isPending) {
    return null;
  }

  return (
    <div
      id={sectionKey}
      style={{
        borderTop: "1px solid #e5e7eb",
        marginTop: "18px",
        paddingTop: "18px",
      }}
    >
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <p style={{ ...subtleText, marginTop: 0 }}>{description}</p>

      <div
        style={{
          border: "1px solid #d1d5db",
          borderRadius: "10px",
          padding: "12px",
          marginBottom: "12px",
          background: "#f9fafb",
        }}
      >
        <h4 style={{ marginTop: 0 }}>Approval Assignments</h4>

        <div style={formGridStyle}>
          <Field label="Approval Matrix">
            <select
              value={selectedApprovalMatrixId}
              onChange={(e) => setSelectedApprovalMatrixId(e.target.value)}
              disabled={loadingApprovals}
              style={inputStyle(loadingApprovals)}
            >
              <option value="">Select approval matrix</option>
              {approvalMatrixTemplates.map((template: any) => (
                <option key={template.id} value={template.id}>
                  {template.template_name || template.name || "Approval Matrix"}
                </option>
              ))}
            </select>
          </Field>

          <div style={{ display: "flex", alignItems: "end" }}>
            <button
              type="button"
              onClick={onLoadMatrix}
              disabled={loadingApprovals}
              style={buttonDisabledStyle(loadingApprovals)}
            >
              Load Matrix
            </button>
          </div>
        </div>

        <div style={formGridStyle}>
          <Field label="Function">
            <input
              value={manualApproverFunction}
              onChange={(e) => setManualApproverFunction(e.target.value)}
              placeholder="Quality, Operations, Regulatory Affairs"
              disabled={loadingApprovals}
              style={inputStyle(loadingApprovals)}
            />
          </Field>

          <Field label="Job Title">
            <input
              value={manualApproverJobTitle}
              onChange={(e) => {
                setManualApproverJobTitle(e.target.value);
                setManualApproverRole(e.target.value);
              }}
              placeholder="Quality Manager, Quality Engineer"
              disabled={loadingApprovals}
              style={inputStyle(loadingApprovals)}
            />
          </Field>

          <Field label="User Email">
            <input
              type="email"
              value={manualApproverEmail}
              onChange={(e) => setManualApproverEmail(e.target.value)}
              placeholder="approver@company.com"
              disabled={loadingApprovals}
              style={inputStyle(loadingApprovals)}
            />
          </Field>

          <Field label="Due Date">
            <input
              type="date"
              value={manualApproverDueDate}
              onChange={(e) => setManualApproverDueDate(e.target.value)}
              disabled={loadingApprovals}
              style={inputStyle(loadingApprovals)}
            />
          </Field>

          <div style={{ display: "flex", alignItems: "end" }}>
            <button
              type="button"
              onClick={onAddManualApprover}
              disabled={loadingApprovals}
              style={buttonDisabledStyle(loadingApprovals)}
            >
              Add Approver
            </button>
          </div>
        </div>

        {configuredApprovers.length > 0 ? (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr>
                <th style={tableHeaderStyle}>Order</th>
                <th style={tableHeaderStyle}>Function</th>
                <th style={tableHeaderStyle}>Job Title</th>
                <th style={tableHeaderStyle}>User</th>
                <th style={tableHeaderStyle}>Due Date</th>
              </tr>
            </thead>
            <tbody>
              {configuredApprovers.map((approver) => (
                <tr key={approver.id}>
                  <td style={tableCellStyle}>{approver.approval_order || "-"}</td>
                  <td style={tableCellStyle}>{approver.approver_function || "N/A"}</td>
                  <td style={tableCellStyle}>{approver.approver_job_title || approver.approver_role || "N/A"}</td>
                  <td style={tableCellStyle}>{approver.approver_email}</td>
                  <td style={tableCellStyle}>{approver.approver_due_date || "N/A"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={subtleText}>No approvers configured.</p>
        )}
      </div>

      <Field label="Submission Comments">
        <textarea
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          rows={3}
          style={textareaStyle(false)}
        />
      </Field>

      <p style={{ ...subtleText, marginTop: "12px" }}>
        Adding an approver only prepares the approval package. The package is not routed until you click Submit for Approval.
      </p>

      <button onClick={onSubmit} style={primaryButtonStyle}>
        Submit for Approval
      </button>
    </div>
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
  const complete = task.status === "completed";

  return (
    <div
      style={{
        border: "1px solid #d1d5db",
        borderLeft: `6px solid ${complete ? "#16a34a" : isOverdue ? "#dc2626" : "#d97706"}`,
        borderRadius: "12px",
        padding: "14px",
        marginBottom: "12px",
        background: "#ffffff",
      }}
    >
      <h4 style={{ margin: "0 0 6px 0" }}>{task.task_title || "Implementation Task"}</h4>

      <div style={{ color: "#6b7280", marginBottom: "8px" }}>
        {formatTaskType(task.task_type)}
      </div>

      {task.task_description ? (
        <p style={{ marginTop: 0 }}>{task.task_description}</p>
      ) : null}

      <div style={formGridStyle}>
        <SummaryCard label="Owner" value={task.owner_email || task.owner} />
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
      ) : (
        <p style={{ ...subtleText, marginTop: "12px", marginBottom: 0 }}>
          This task is routed to the assignee's My Tasks work queue for execution.
        </p>
      )}
    </div>
  );
}

function formatTaskType(value: any) {
  return String(value || "task")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
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


const tableHeaderStyle: CSSProperties = {
  textAlign: "left",
  borderBottom: "1px solid #d1d5db",
  padding: "8px",
  background: "#f3f4f6",
};

const tableCellStyle: CSSProperties = {
  borderBottom: "1px solid #e5e7eb",
  padding: "8px",
};

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

const helperTextStyle: CSSProperties = {
  marginTop: "6px",
  fontSize: "12px",
  color: "#6b7280",
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


const primaryLinkStyle: CSSProperties = {
  display: "inline-block",
  background: "#2563eb",
  color: "white",
  padding: "8px 12px",
  borderRadius: "8px",
  textDecoration: "none",
  fontWeight: 700,
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

const readOnlyBannerStyle: CSSProperties = {
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1e3a8a",
  borderRadius: "12px",
  padding: "12px",
  marginBottom: "16px",
  fontWeight: 800,
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
