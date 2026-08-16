"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import {
  SectionCard,
  StatusBadge,
} from "../../components/QualityWorkflowComponents";

export default function NcmrDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [record, setRecord] = useState<any>(null);
  const [linkedCapa, setLinkedCapa] = useState<any>(null);
  const [linkedScar, setLinkedScar] = useState<any>(null);
  const [scarJustification, setScarJustification] = useState("");
  const [mrbApprovers, setMrbApprovers] = useState<any[]>([]);
  const [approvalMatrixTemplates, setApprovalMatrixTemplates] = useState<any[]>([]);
  const [selectedApprovalMatrixId, setSelectedApprovalMatrixId] = useState("");
  const [manualMrbApproverEmail, setManualMrbApproverEmail] = useState("");
  const [manualMrbApproverFunction, setManualMrbApproverFunction] = useState("");
  const [manualMrbApproverJobTitle, setManualMrbApproverJobTitle] = useState("");
  const [manualMrbApproverDueDate, setManualMrbApproverDueDate] = useState("");
  const [manualMrbApproverRole, setManualMrbApproverRole] = useState("MRB Approver");
  const [manualMrbApproverRequired, setManualMrbApproverRequired] = useState(true);
  const [submittingMrbApproval, setSubmittingMrbApproval] = useState(false);
  const [affectedItems, setAffectedItems] = useState<any[]>([]);
  const [auditTimeline, setAuditTimeline] = useState<any[]>([]);
  const [timelineFilter, setTimelineFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState("");

  const [investigator, setInvestigator] = useState("");
  const [problemDescription, setProblemDescription] = useState("");
  const [containmentAction, setContainmentAction] = useState("");
  const [investigationSummary, setInvestigationSummary] = useState("");
  const [rootCause, setRootCause] = useState("");
  const [rootCauseCategory, setRootCauseCategory] = useState("");
  const [rootCauseOptions, setRootCauseOptions] = useState<any[]>([]);
  const [dispositionOptions, setDispositionOptions] = useState<any[]>([]);
  const [correctionActionProposal, setCorrectionActionProposal] = useState("");
  const [correctiveAction, setCorrectiveAction] = useState("");
  const [riskAssessment, setRiskAssessment] = useState("");
  const [riskDetermination, setRiskDetermination] = useState<"" | "no_risk" | "overall_residual_risk">("");
  const [noRiskJustification, setNoRiskJustification] = useState("");
  const [severity, setSeverity] = useState("not_assessed");
  const [occurrenceRating, setOccurrenceRating] = useState("");
  const [detectionRating, setDetectionRating] = useState("");
  const [riskAssessmentMethod, setRiskAssessmentMethod] = useState<"automatic" | "manual">("automatic");
  const [riskLevel, setRiskLevel] = useState("");
  const [riskOverrideEnabled, setRiskOverrideEnabled] = useState(false);
  const [riskOverrideLevel, setRiskOverrideLevel] = useState("");
  const [riskOverrideJustification, setRiskOverrideJustification] = useState("");
  const [riskConfiguration, setRiskConfiguration] = useState<any>(null);
  const [riskMatrixRules, setRiskMatrixRules] = useState<any[]>([]);
  const [capaGovernanceConfiguration, setCapaGovernanceConfiguration] = useState<any>(null);
  const [capaGovernanceRules, setCapaGovernanceRules] = useState<any[]>([]);
  const [governanceConfigurationLoading, setGovernanceConfigurationLoading] = useState(false);
  const [capaJustification, setCapaJustification] = useState("");
  const [capaNotRequiredJustification, setCapaNotRequiredJustification] = useState("");
  const [capaEvaluationOutcome, setCapaEvaluationOutcome] = useState("");
  const [capaEvaluationRationale, setCapaEvaluationRationale] = useState("");
  const [capaRecommended, setCapaRecommended] = useState(false);
  const [capaDecision, setCapaDecision] = useState("");
  const [capaDecisionJustification, setCapaDecisionJustification] = useState("");
  const [productDisposition, setProductDisposition] = useState("");
  const [dispositionJustification, setDispositionJustification] = useState("");
  const [correctionImplementation, setCorrectionImplementation] = useState("");
  const [reviewStatus, setReviewStatus] = useState("draft");

  const [mrbSignatureEmail, setMrbSignatureEmail] = useState("");
  const [mrbAutoApprovalInProgress, setMrbAutoApprovalInProgress] = useState(false);
  const [closureSignatureEmail, setClosureSignatureEmail] = useState("");
  const [additionalMrbApprovers, setAdditionalMrbApprovers] = useState("");

  const [requireQualityApproval, setRequireQualityApproval] = useState(true);
  const [requireOperationsApproval, setRequireOperationsApproval] = useState(false);
  const [requireRegulatoryApproval, setRequireRegulatoryApproval] = useState(false);
  const [requireSupplyChainApproval, setRequireSupplyChainApproval] = useState(false);
  const [requireEngineeringApproval, setRequireEngineeringApproval] = useState(false);

  const [qualityApproverEmail, setQualityApproverEmail] = useState("");
  const [operationsApproverEmail, setOperationsApproverEmail] = useState("");
  const [regulatoryApproverEmail, setRegulatoryApproverEmail] = useState("");
  const [supplyChainApproverEmail, setSupplyChainApproverEmail] = useState("");
  const [engineeringApproverEmail, setEngineeringApproverEmail] = useState("");
  const [approvalTasks, setApprovalTasks] = useState<any[]>([]);
  const [correctionTasks, setCorrectionTasks] = useState<any[]>([]);
  const [reworkTasks, setReworkTasks] = useState<any[]>([]);

  const [implementationTaskType, setImplementationTaskType] = useState<
    "correction" | "corrective_action"
  >("correction");
  const [correctionTaskAssignee, setCorrectionTaskAssignee] = useState("");
  const [correctionTaskDueDate, setCorrectionTaskDueDate] = useState("");
  const [correctionTaskInstructions, setCorrectionTaskInstructions] = useState("");
  const [showAdditionalImplementationTaskForm, setShowAdditionalImplementationTaskForm] = useState(false);
  const [submittingImplementationTask, setSubmittingImplementationTask] = useState(false);

  const [reworkTaskAssignee, setReworkTaskAssignee] = useState("");
  const [reworkTaskDueDate, setReworkTaskDueDate] = useState("");
  const [reworkTaskInstructions, setReworkTaskInstructions] = useState("");
  const [reworkTaskAssignmentFiles, setReworkTaskAssignmentFiles] = useState<File[]>([]);
  const [editingReturnedReworkTaskId, setEditingReturnedReworkTaskId] = useState("");
  const [submittingReworkTask, setSubmittingReworkTask] = useState(false);
  const [investigationAttachmentFile, setInvestigationAttachmentFile] = useState<File | null>(null);
  const [uploadingInvestigationAttachment, setUploadingInvestigationAttachment] = useState(false);

  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [evidenceNotes, setEvidenceNotes] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationAttempted, setValidationAttempted] = useState(false);

  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [returnRevisionOpen, setReturnRevisionOpen] = useState(false);
  const [returnRevisionDestination, setReturnRevisionDestination] = useState("correction");
  const [returnRevisionJustification, setReturnRevisionJustification] = useState("");
  const [returnRevisionSubmitting, setReturnRevisionSubmitting] = useState(false);

  const [summaryIssueDescription, setSummaryIssueDescription] = useState("");
  const [summaryProductPartNumber, setSummaryProductPartNumber] = useState("");
  const [summaryLotNumber, setSummaryLotNumber] = useState("");
  const [summaryWorkorderNumber, setSummaryWorkorderNumber] = useState("");
  const [summaryOwner, setSummaryOwner] = useState("");


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

  const fetchDispositionOptions = async () => {
    const defaultDispositions = [
      { code: "accept_per_specification", label: "Accept Per Specification" },
      { code: "use_as_is", label: "Use As Is" },
      { code: "rework", label: "Rework" },
      { code: "scrap", label: "Scrap" },
      { code: "return_to_supplier", label: "Return to Supplier" },
    ];

    const normalizeOption = (item: any) => {
      const rawLabel =
        item?.label ||
        item?.name ||
        item?.disposition_label ||
        item?.disposition_name ||
        item?.title ||
        item?.code ||
        item?.value ||
        "";

      const rawCode =
        item?.code ||
        item?.value ||
        item?.disposition_code ||
        item?.disposition_value ||
        String(rawLabel)
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_+|_+$/g, "");

      return {
        id: item?.id || rawCode,
        code: rawCode,
        label: rawLabel || rawCode,
        is_active: item?.is_active,
        status: item?.status,
      };
    };

    const isActiveOption = (item: any) => {
      if (item?.is_active === false) return false;
      if (String(item?.status || "").toLowerCase() === "inactive") return false;
      return true;
    };

    const { data, error } = await supabase
      .from("md_dispositions")
      .select("*")
      .order("label");

    if (error) {
      console.warn("Unable to load md_dispositions:", error.message);
    }

    const loadedOptions = (data || [])
      .filter(isActiveOption)
      .map(normalizeOption)
      .filter((item: any) => item.code && item.label);

    const mergedByCode: Record<string, any> = {};

    [...defaultDispositions, ...loadedOptions].forEach((option: any) => {
      const normalized = normalizeOption(option);
      if (!normalized.code) return;
      mergedByCode[normalizeDispositionValue(normalized.code)] = normalized;
    });

    const mergedOptions = Object.values(mergedByCode).sort((a: any, b: any) =>
      String(a.label || "").localeCompare(String(b.label || ""))
    );

    setDispositionOptions(mergedOptions);
  };

  const fetchGovernanceConfigurations = async (ncmrRecord?: any) => {
    setGovernanceConfigurationLoading(true);

    try {
      const sourceRecord = ncmrRecord || record || {};

      const loadConfiguration = async (
        configurationType: "risk_assessment" | "capa_governance",
        stampedId?: string | null
      ) => {
        let query = supabase
          .from("qms_configuration_versions")
          .select("id,module_code,configuration_type,version_code,version_name,status,effective_at,activated_at")
          .eq("module_code", "NCMR")
          .eq("configuration_type", configurationType);

        if (stampedId) {
          query = query.eq("id", stampedId);
        } else {
          // Locked/approved historical records without a stamped configuration
          // retain their stored decisions and are not reinterpreted under today's rules.
          if (sourceRecord?.is_locked || sourceRecord?.mrb_approved_by) {
            return null;
          }
          query = query.eq("status", "active");
        }

        const { data, error } = await query
          .order("activated_at", { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        return data || null;
      };

      const riskConfig = await loadConfiguration(
        "risk_assessment",
        sourceRecord?.risk_configuration_version_id || null
      );

      const capaConfig = await loadConfiguration(
        "capa_governance",
        sourceRecord?.capa_governance_version_id || null
      );

      setRiskConfiguration(riskConfig);
      setCapaGovernanceConfiguration(capaConfig);

      if (riskConfig?.id) {
        const { data, error } = await supabase
          .from("qms_risk_matrix_rules")
          .select("*")
          .eq("configuration_version_id", riskConfig.id);

        if (error) throw error;
        setRiskMatrixRules(data || []);
      } else {
        setRiskMatrixRules([]);
      }

      if (capaConfig?.id) {
        const { data, error } = await supabase
          .from("qms_capa_governance_rules")
          .select("*")
          .eq("configuration_version_id", capaConfig.id);

        if (error) throw error;
        setCapaGovernanceRules(data || []);
      } else {
        setCapaGovernanceRules([]);
      }
    } catch (error: any) {
      console.error("Unable to load NCMR governance configuration:", error?.message || error);
      setRiskConfiguration(null);
      setRiskMatrixRules([]);
      setCapaGovernanceConfiguration(null);
      setCapaGovernanceRules([]);
    } finally {
      setGovernanceConfigurationLoading(false);
    }
  };

  const fetchLinkedCapa = async (capaId: string | null) => {
    if (!capaId) {
      setLinkedCapa(null);
      return;
    }

    const { data } = await supabase
      .from("capas")
      .select("*")
      .eq("id", capaId)
      .maybeSingle();

    setLinkedCapa(data || null);
  };

  const fetchLinkedScar = async (scarId: string | null) => {
    if (!scarId) {
      setLinkedScar(null);
      return;
    }

    const { data } = await supabase
      .from("scars")
      .select("*")
      .eq("id", scarId)
      .maybeSingle();

    setLinkedScar(data || null);
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

    const ncmrTemplates = (data || []).filter((template: any) => {
      const templateModule = String(template?.module || template?.module_name || "").toLowerCase();
      const isActive = template?.is_active !== false && template?.active !== false;

      return (
        isActive &&
        (templateModule === "ncmr" ||
          templateModule.includes("ncmr") ||
          templateModule.includes("nonconformance"))
      );
    });

    setApprovalMatrixTemplates(
      ncmrTemplates.sort((a: any, b: any) =>
        String(a.template_name || a.name || "").localeCompare(
          String(b.template_name || b.name || "")
        )
      )
    );
  };

  const fetchMrbApprovers = async () => {
    const { data, error } = await supabase
      .from("ncmr_mrb_reviewers")
      .select("*")
      .eq("ncmr_id", id)
      .order("approval_order", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setMrbApprovers(data || []);
  };

  const fetchAffectedItems = async () => {
    const { data, error } = await supabase
      .from("ncmr_affected_items")
      .select("*")
      .eq("ncmr_id", id)
      .order("created_at", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setAffectedItems(data || []);
  };

  const fetchApprovalTasks = async () => {
    const { data, error } = await supabase
      .from("approval_tasks")
      .select("*")
      .eq("entity_type", "ncmr")
      .eq("entity_id", id)
      .eq("task_type", "mrb_approval")
      .order("created_at", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setApprovalTasks(data || []);
  };

  const fetchCorrectionTasks = async () => {
    const { data, error } = await supabase
      .from("approval_tasks")
      .select("*")
      .eq("entity_type", "ncmr")
      .eq("entity_id", id)
      .in("task_type", ["correction_task", "corrective_action_task"])
      .order("created_at", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setCorrectionTasks(data || []);
  };

  const fetchReworkTasks = async () => {
    const { data, error } = await supabase
      .from("approval_tasks")
      .select("*")
      .eq("entity_type", "ncmr")
      .eq("entity_id", id)
      .eq("task_type", "rework_task")
      .order("created_at", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setReworkTasks(data || []);
  };

  const fetchAuditTimeline = async () => {
    const { data, error } = await supabase
      .from("audit_logs")
      .select("*")
      .eq("entity_type", "ncmr")
      .eq("entity_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setAuditTimeline(data || []);
  };


  const fetchRecord = async () => {
    const { data, error } = await supabase
      .from("ncmrs")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    if (!data) {
      alert("NCMR record not found.");
      setRecord(null);
      setLoading(false);
      return;
    }

    setRecord(data);
    setSummaryIssueDescription(data.issue_description || "");
    setSummaryProductPartNumber(data.product_part_number || "");
    setSummaryLotNumber(data.lot_number || "");
    setSummaryWorkorderNumber(data.workorder_number || "");
    setSummaryOwner(data.owner || "");
    setInvestigator(data.investigator || "");
    setProblemDescription(data.problem_description || "");
    setContainmentAction(data.containment_action || "");
    setInvestigationSummary(data.investigation_summary || "");
    setRootCause(data.root_cause || "");
    setRootCauseCategory(data.root_cause_category || "");
    setCorrectionActionProposal(data.correction_action_proposal || "");
    setCorrectiveAction(data.corrective_action || "");
    setRiskAssessment(data.risk_assessment || "");
    setRiskDetermination(
      data.risk_determination === "no_risk"
        ? "no_risk"
        : data.risk_determination === "overall_residual_risk"
          ? "overall_residual_risk"
          : data.risk_level === "no_risk"
            ? "no_risk"
            : (data.severity || data.occurrence_rating || data.detection_rating || data.risk_level)
              ? "overall_residual_risk"
              : ""
    );
    setNoRiskJustification(data.no_risk_justification || "");
    setSeverity(data.severity || "not_assessed");
    setOccurrenceRating(data.occurrence_rating || "");
    setDetectionRating(data.detection_rating || "");
    setRiskAssessmentMethod(data.risk_assessment_method === "manual" ? "manual" : "automatic");
    setRiskLevel(data.risk_level === "no_risk" ? "" : data.risk_level || "");
    setRiskOverrideEnabled(Boolean(data.risk_override_enabled));
    setRiskOverrideLevel(data.risk_override_level || "");
    setRiskOverrideJustification(data.risk_override_justification || "");
    setCapaJustification(data.capa_justification || "");
    setScarJustification(data.scar_justification || "");
    setCapaRecommended(data.capa_recommended || false);
    setCapaDecision(data.capa_decision || "");
    setCapaDecisionJustification(data.capa_decision_justification || "");
    setProductDisposition(data.product_disposition || data.disposition || "");
    setDispositionJustification(data.disposition_justification || "");
    setCorrectionImplementation(data.correction_implementation || "");
    setReviewStatus(data.review_status || "draft");
    setMrbSignatureEmail("");
    setClosureSignatureEmail("");
    setAdditionalMrbApprovers(data.mrb_additional_approvers || "");
    setEvidenceUrl(data.evidence_url || "");
    setEvidenceNotes(data.evidence_notes || "");

    await fetchLinkedCapa(data.linked_capa_id || data.capa_id || null);
    await fetchLinkedScar(data.linked_scar_id || null);
    await fetchGovernanceConfigurations(data);
    await fetchApprovalMatrixTemplates();
    await fetchMrbApprovers();
    await fetchAffectedItems();
    await fetchApprovalTasks();
    await fetchCorrectionTasks();
    await fetchReworkTasks();
    await fetchAuditTimeline();
    setLoading(false);
  };

  const addAuditLog = async (action: string, details: string) => {
    await supabase.from("audit_logs").insert({
      entity_type: "ncmr",
      entity_id: id,
      action,
      details,
      user_email: userEmail || "unknown",
    });

    fetchAuditTimeline();
  };

  const snapshotControlledNcmrDecision = async (
    decisionType: "risk_assessment" | "capa_governance",
    configurationVersionId: string | null | undefined,
    inputSnapshot: any,
    decisionSnapshot: any
  ) => {
    if (!configurationVersionId) {
      throw new Error(`Controlled ${decisionType.replace(/_/g, " ")} configuration version is missing.`);
    }

    const { error } = await supabase.rpc("snapshot_ncmr_qms_decision", {
      p_ncmr_id: id,
      p_decision_type: decisionType,
      p_configuration_version_id: configurationVersionId,
      p_input_snapshot: inputSnapshot,
      p_decision_snapshot: decisionSnapshot,
    });

    if (error) throw new Error(error.message);
  };

  const createInAppNotification = async ({
    recipientEmail,
    notificationType,
    title,
    message,
    severityLevel = "info",
    assignedRole = null,
    relatedUrl = null,
  }: {
    recipientEmail: string;
    notificationType: string;
    title: string;
    message: string;
    severityLevel?: string;
    assignedRole?: string | null;
    relatedUrl?: string | null;
  }) => {
    const normalizedRecipient = String(recipientEmail || "").trim().toLowerCase();
    if (!normalizedRecipient) return;

    const { error } = await supabase.from("notifications").insert({
      user_email: normalizedRecipient,
      assigned_role: assignedRole,
      notification_type: notificationType,
      title,
      message,
      related_module: "ncmr",
      related_record_id: id,
      related_url: relatedUrl,
      severity: severityLevel,
      read_status: false,
    });

    if (error) {
      console.warn("Unable to create in-app notification:", error.message);
    }
  };

  const syncNcmrOwnerAssignment = async (previousOwner: string, nextOwner: string) => {
    const previousEmail = normalizeApproverEmail(previousOwner);
    const nextEmail = normalizeApproverEmail(nextOwner);

    if (!nextEmail || previousEmail === nextEmail) return;

    if (!isValidEmailFormat(nextEmail)) {
      throw new Error("NCMR owner must be entered as a valid user email address.");
    }

    const ownerValidation = await validateApproverEmails([nextEmail]);
    if (!ownerValidation.valid) {
      throw new Error(ownerValidation.message);
    }

    const { error: cancelError } = await supabase
      .from("approval_tasks")
      .update({
        status: "cancelled",
        comments: `Cancelled because NCMR ownership was reassigned to ${nextEmail}.`,
      })
      .eq("entity_type", "ncmr")
      .eq("entity_id", id)
      .eq("task_type", "ncmr_owner")
      .eq("status", "pending");

    if (cancelError) throw new Error(cancelError.message);

    const { data: ownerTask, error: taskError } = await supabase
      .from("approval_tasks")
      .insert({
        entity_type: "ncmr",
        entity_id: id,
        task_type: "ncmr_owner",
        required_function: "NCMR Owner",
        task_title: `NCMR owner assignment: ${record?.ncmr_number || "NCMR"}`,
        task_instructions: "Coordinate the NCMR workflow and ensure required activities are completed on time.",
        assigned_to_email: nextEmail,
        assigned_by_email: userEmail || null,
        status: "pending",
        comments: "NCMR ownership assignment.",
      })
      .select("id")
      .single();

    if (taskError) throw new Error(taskError.message);

    await createInAppNotification({
      recipientEmail: nextEmail,
      notificationType: "ncmr_assignment",
      title: `NCMR assigned: ${record?.ncmr_number || "NCMR"}`,
      message: `You have been assigned as the owner of ${record?.ncmr_number || "this NCMR"}. Open My Workspace to review and coordinate the required activities.`,
      severityLevel: getEffectiveRiskLevel() === "critical" ? "critical" : getEffectiveRiskLevel() === "high" ? "high" : "info",
      assignedRole: "NCMR Owner",
    });

    await supabase.from("notification_queue").insert({
      recipient_email: nextEmail,
      subject: `NCMR assigned: ${record?.ncmr_number || "NCMR"}`,
      body: `You have been assigned as the owner of ${record?.ncmr_number || "this NCMR"}. Please log in to QualiSphere and open My Workspace.`,
      entity_type: "ncmr",
      entity_id: id,
      task_id: ownerTask?.id || null,
      status: "pending",
    });
  };

  const isMrbApproved = () => {
    return !!record?.mrb_approved_by;
  };

  const isPostMrbSectionLocked = () => {
    return !!record?.is_locked || !isMrbApproved() || !isCurrentNcmrOwner();
  };

  const isPreMrbSectionReadOnly = () => {
    return !isCurrentNcmrOwner() || !!record?.is_locked || !!record?.mrb_approved_by ||
      (hasPendingMrbApprovalTasks() && !hasRejectedMrbApprovalTask());
  };

  const formatIsoDate = (value: any) => {
    if (!value) return "N/A";
    try {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return String(value);
      const day = String(date.getDate()).padStart(2, "0");
      const month = date.toLocaleString("en-US", { month: "short" });
      return `${day}-${month}-${date.getFullYear()}`;
    } catch { return String(value); }
  };

  const formatIsoDateTime = (value: any) => {
    if (!value) return "N/A";
    try {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return String(value);
      return `${formatIsoDate(value)} ${date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`;
    } catch { return String(value); }
  };

  const alertMrbApprovalRequired = () => {
    alert("MRB approval is required before implementation, evidence, rework execution, or closure activities can begin.");
  };

  const toQuantityNumber = (value: any) => {
    if (value === null || value === undefined || value === "") return 0;
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : 0;
  };

  const normalizeDispositionValue = (value: any) => {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/-/g, "_");
  };

  const isUseAsIsDisposition = (value: any) => {
    const disposition = normalizeDispositionValue(value);
    return (
      disposition === "use_as_is" ||
      disposition === "useasis" ||
      disposition.includes("use_as_is")
    );
  };

  const isAcceptPerSpecDisposition = (value: any) => {
    const disposition = normalizeDispositionValue(value);
    return (
      disposition === "accept_per_specification" ||
      disposition === "accept_per_spec" ||
      disposition === "accept_per_specs" ||
      disposition === "acceptance_per_specification" ||
      disposition.includes("accept_per_spec")
    );
  };

  const isScrapDisposition = (value: any) => {
    const disposition = normalizeDispositionValue(value);
    return disposition === "scrap" || disposition.includes("scrap");
  };

  const isReturnToSupplierDisposition = (value: any) => {
    const disposition = normalizeDispositionValue(value);
    return (
      disposition === "return_to_supplier" ||
      disposition === "return_to_vendor" ||
      disposition === "rts" ||
      disposition.includes("return_to_supplier") ||
      disposition.includes("return_to_vendor")
    );
  };

  const isReworkDisposition = (value: any) => {
    const disposition = normalizeDispositionValue(value);
    return disposition === "rework" || disposition.includes("rework");
  };

  const isSupportedDisposition = (value: any) => {
    const disposition = normalizeDispositionValue(value);
    if (!disposition) return false;

    return dispositionOptions.some(
      (option: any) =>
        normalizeDispositionValue(
          option?.code || option?.value || option?.label || option?.name
        ) === disposition
    );
  };

  const requiresDispositionImplementation = (item: any) => {
    const disposition = item?.product_disposition;
    if (!disposition || isReworkDisposition(disposition)) return false;

    // Every configured non-Rework disposition remains a controlled MRB
    // disposition and therefore requires implementation confirmation.
    return isSupportedDisposition(disposition);
  };

  const getDispositionImplementationItems = () =>
    affectedItems.filter((item) => requiresDispositionImplementation(item));

  const getDispositionImplementationErrors = (item: any, label: string) => {
    const errors: string[] = [];
    const disposition = normalizeDispositionValue(item?.product_disposition);

    if (!requiresDispositionImplementation(item)) return errors;

    if (item?.disposition_implementation_status !== "completed") {
      errors.push(`${label}: approved ${formatDispositionLabel(disposition)} disposition has not been implemented.`);
      return errors;
    }

    const affectedQty = toQuantityNumber(item?.quantity_affected);
    const mrbAcceptedQty = toQuantityNumber(item?.quantity_accepted);
    const mrbRejectedQty = toQuantityNumber(item?.quantity_rejected);
    const finalAcceptedQty = toQuantityNumber(item?.final_quantity_accepted);
    const finalRejectedQty = toQuantityNumber(item?.final_quantity_rejected);

    const allowsDiscrepancy =
      disposition === "use_as_is" ||
      disposition === "accept_per_specification";

    const discrepancyQtyForReconciliation =
      allowsDiscrepancy && item?.quantity_discrepancy === true
        ? toQuantityNumber(item?.discrepancy_quantity)
        : 0;

    const finalReconciledQty =
      finalAcceptedQty + finalRejectedQty + discrepancyQtyForReconciliation;

    if (finalReconciledQty !== affectedQty) {
      errors.push(
        `${label}: final accepted + final rejected${discrepancyQtyForReconciliation > 0 ? " + discrepancy" : ""} quantity (${finalReconciledQty}) must equal initial affected quantity (${affectedQty}).`
      );
    }

    if (!allowsDiscrepancy && item?.quantity_discrepancy === true) {
      errors.push(`${label}: quantity discrepancy is only available for Use As Is or Accept Per Specification.`);
    }

    if (allowsDiscrepancy && item?.quantity_discrepancy === true) {
      const discrepancyQty = toQuantityNumber(item?.discrepancy_quantity);
      const discrepancyType = String(item?.discrepancy_type || "");
      const rationale = String(item?.discrepancy_rationale || "").trim();

      if (discrepancyQty <= 0) {
        errors.push(`${label}: discrepancy quantity must be greater than zero.`);
      }

      if (!["accepted_quantity", "rejected_quantity"].includes(discrepancyType)) {
        errors.push(`${label}: discrepancy type must identify Accepted Quantity or Rejected Quantity.`);
      }

      if (!rationale) {
        errors.push(`${label}: discrepancy rationale is required.`);
      }

      const acceptedDifference = Math.abs(finalAcceptedQty - mrbAcceptedQty);
      const rejectedDifference = Math.abs(finalRejectedQty - mrbRejectedQty);
      const selectedDifference =
        discrepancyType === "accepted_quantity"
          ? acceptedDifference
          : rejectedDifference;

      if (discrepancyQty > 0 && selectedDifference !== discrepancyQty) {
        errors.push(
          `${label}: discrepancy quantity (${discrepancyQty}) does not match the change in the selected MRB ${discrepancyType === "accepted_quantity" ? "Accepted" : "Rejected"} Quantity (${selectedDifference}).`
        );
      }
    }

    if (allowsDiscrepancy && item?.quantity_discrepancy !== true) {
      if (
        finalAcceptedQty !== mrbAcceptedQty ||
        finalRejectedQty !== mrbRejectedQty
      ) {
        errors.push(
          `${label}: when Quantity Discrepancy is No, final accepted/rejected quantities must equal the MRB-approved quantities.`
        );
      }
    }

    if (
      (disposition === "scrap" || disposition === "return_to_supplier") &&
      (finalAcceptedQty !== mrbAcceptedQty ||
        finalRejectedQty !== mrbRejectedQty)
    ) {
      errors.push(
        `${label}: ${formatDispositionLabel(disposition)} implementation must retain the MRB-approved accepted/rejected quantities.`
      );
    }

    return errors;
  };

  const areDispositionImplementationsComplete = () => {
    const items = getDispositionImplementationItems();
    if (items.length === 0) return true;

    return items.every(
      (item) => getDispositionImplementationErrors(item, "Affected item").length === 0
    );
  };

  const buildQuantityReconciliationErrors = (item: any, label: string) => {
    const errors: string[] = [];

    const affectedQty = toQuantityNumber(item?.quantity_affected);
    const quarantinedQty = toQuantityNumber(item?.quarantined_quantity);
    const acceptedQty = toQuantityNumber(item?.quantity_accepted);
    const rejectedQty = toQuantityNumber(item?.quantity_rejected);
    const disposition = item?.product_disposition;

    if (affectedQty <= 0) {
      errors.push(`${label}: affected quantity must be greater than zero.`);
    }

    if (quarantinedQty > affectedQty) {
      errors.push(`${label}: quarantined quantity (${quarantinedQty}) cannot exceed affected quantity (${affectedQty}).`);
    }

    if (acceptedQty + rejectedQty !== affectedQty) {
      errors.push(`${label}: accepted + rejected quantity (${acceptedQty + rejectedQty}) must equal affected quantity (${affectedQty}).`);
    }

    if (isUseAsIsDisposition(disposition)) {
      if (acceptedQty !== affectedQty || rejectedQty !== 0) {
        errors.push(`${label}: Use As Is requires accepted quantity to equal affected quantity (${affectedQty}) and rejected quantity to equal 0.`);
      }
    }

    if (isScrapDisposition(disposition) || isReturnToSupplierDisposition(disposition)) {
      if (acceptedQty !== 0 || rejectedQty !== affectedQty) {
        errors.push(`${label}: ${isScrapDisposition(disposition) ? "Scrap" : "Return to Supplier"} requires accepted quantity to equal 0 and rejected quantity to equal affected quantity (${affectedQty}).`);
      }
    }

    if (isAcceptPerSpecDisposition(disposition)) {
      if (acceptedQty + rejectedQty !== affectedQty) {
        errors.push(`${label}: Accept Per Specification requires accepted + rejected quantity to equal affected quantity (${affectedQty}).`);
      }
    }

    if (isReworkDisposition(disposition)) {
      if (acceptedQty !== 0 || rejectedQty !== affectedQty) {
        errors.push(`${label}: initial Rework disposition requires accepted quantity to equal 0 and rejected quantity to equal affected quantity (${affectedQty}). Final accepted/rejected quantities are entered after rework completion.`);
      }

      const finalAcceptedQty = toQuantityNumber(item?.final_rework_quantity_accepted);
      const finalRejectedQty = toQuantityNumber(item?.final_rework_quantity_rejected);

      if (finalAcceptedQty + finalRejectedQty > affectedQty) {
        errors.push(`${label}: final rework accepted + rejected quantity (${finalAcceptedQty + finalRejectedQty}) cannot exceed affected quantity (${affectedQty}).`);
      }

      if (item?.final_disposition_after_rework && finalAcceptedQty + finalRejectedQty !== affectedQty) {
        errors.push(`${label}: final rework accepted + rejected quantity (${finalAcceptedQty + finalRejectedQty}) must equal affected quantity (${affectedQty}) before closure.`);
      }
    }

    return errors;
  };

  const getAffectedItemReconciliationSummary = (item: any) => {
    const affectedQty = toQuantityNumber(item?.quantity_affected);
    const quarantinedQty = toQuantityNumber(item?.quarantined_quantity);
    const acceptedQty = toQuantityNumber(item?.quantity_accepted);
    const rejectedQty = toQuantityNumber(item?.quantity_rejected);
    const dispositionedQty = acceptedQty + rejectedQty;
    const remainingQty = affectedQty - dispositionedQty;
    const errors = buildQuantityReconciliationErrors(item, "Affected item");

    return {
      affectedQty,
      quarantinedQty,
      acceptedQty,
      rejectedQty,
      dispositionedQty,
      remainingQty,
      reconciled: errors.length === 0,
      errors,
    };
  };

  const renderDispositionOptions = () => (
    <>
      <option value="">Select disposition</option>
      {dispositionOptions.map((option: any) => (
        <option
          key={option.code || option.value || option.id || option.label}
          value={option.code || option.value || option.label}
        >
          {option.label || option.name || option.code || option.value}
        </option>
      ))}
    </>
  );

  const saveRecordSummary = async () => {
    if (record?.is_locked || record?.mrb_approved_by) {
      alert("Record summary cannot be edited after MRB approval or record lock.");
      return;
    }

    if (!summaryIssueDescription) {
      alert("Issue description is required.");
      return;
    }

    const previousOwner = String(record?.owner || "");
    const nextOwner = String(summaryOwner || "").trim().toLowerCase();

    try {
      await syncNcmrOwnerAssignment(previousOwner, nextOwner);
    } catch (assignmentError: any) {
      alert(`Unable to assign the NCMR owner.\n\n${assignmentError.message}`);
      return;
    }

    const { error } = await supabase
      .from("ncmrs")
      .update({
        issue_description: summaryIssueDescription,
        owner: nextOwner || null,
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await addAuditLog(
      "record_summary_updated",
      "NCMR record summary updated before MRB approval."
    );

    alert("Record summary saved.");
    fetchRecord();
  };

  const updateAffectedMaterial = async (
    itemId: string,
    productPartNumber: string,
    partDescription: string,
    partRevision: string,
    lotNumber: string,
    workorderNumber: string,
    quantityAffected: string,
    quarantinedQuantity: string
  ) => {
    if (record?.is_locked || record?.mrb_approved_by) {
      alert("Affected materials cannot be edited after MRB approval or record lock.");
      return;
    }

    const numericAffectedQty = toQuantityNumber(quantityAffected);
    const numericQuarantinedQty = toQuantityNumber(quarantinedQuantity);

    if (numericAffectedQty <= 0) {
      alert("Affected quantity must be greater than zero.");
      return;
    }

    if (numericQuarantinedQty > numericAffectedQty) {
      alert(`Quantity validation failed.\n\nAffected Quantity: ${numericAffectedQty}\nQuarantined Quantity: ${numericQuarantinedQty}\n\nQuarantined quantity cannot exceed affected quantity.`);
      return;
    }

    const { error } = await supabase
      .from("ncmr_affected_items")
      .update({
        product_part_number: productPartNumber || null,
        part_description: partDescription || null,
        part_revision: partRevision || null,
        lot_number: lotNumber || null,
        workorder_number: workorderNumber || null,
        quantity_affected: quantityAffected ? Number(quantityAffected) : null,
        quarantined_quantity: quarantinedQuantity ? Number(quarantinedQuantity) : null,
      })
      .eq("id", itemId);

    if (error) {
      alert(error.message);
      return;
    }

    await addAuditLog(
      "affected_material_updated",
      "Affected material information updated before MRB approval."
    );

    fetchAffectedItems();
  };

  const addAffectedMaterial = async () => {
    if (record?.is_locked || record?.mrb_approved_by) {
      alert("Affected materials cannot be added after MRB approval or record lock.");
      return;
    }

    const { error } = await supabase.from("ncmr_affected_items").insert({
      ncmr_id: id,
      product_part_number: null,
      part_description: null,
      part_revision: null,
      lot_number: null,
      workorder_number: null,
      quantity_affected: null,
      quarantined_quantity: null,
    });

    if (error) {
      alert(error.message);
      return;
    }

    await addAuditLog(
      "affected_material_added",
      "Additional affected material row added before MRB approval."
    );

    fetchAffectedItems();
  };

  const removeAffectedMaterial = async (itemId: string) => {
    if (record?.is_locked || record?.mrb_approved_by) {
      alert("Affected materials cannot be removed after MRB approval or record lock.");
      return;
    }

    const confirmed = window.confirm(
      "Remove this affected material row? This should only be done before MRB approval."
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("ncmr_affected_items")
      .delete()
      .eq("id", itemId);

    if (error) {
      alert(error.message);
      return;
    }

    await addAuditLog(
      "affected_material_removed",
      "Affected material row removed before MRB approval."
    );

    fetchAffectedItems();
  };

  const updateAffectedItemDisposition = async (
    itemId: string,
    productDisposition: string,
    dispositionJustification: string,
    quantityAccepted: string,
    quantityRejected: string,
    finalDispositionAfterRework: string,
    finalReworkQuantityAccepted: string,
    finalReworkQuantityRejected: string
  ) => {
    if (record?.is_locked) {
      alert("This record is locked after electronic signature and cannot be edited.");
      return;
    }

    const currentItemForLock = affectedItems.find((item) => item.id === itemId);
    const isFinalReworkVerificationSave = !!record?.mrb_approved_by && isReworkDisposition(currentItemForLock?.product_disposition) && productDisposition === (currentItemForLock?.product_disposition || "rework");
    if (record?.mrb_approved_by && !isFinalReworkVerificationSave) {
      alert("Approved MRB product disposition is read-only. Use Return for Revision if the approved disposition must change.");
      return;
    }

    if (!productDisposition) {
      alert("Disposition is required.");
      return;
    }

    if (!dispositionJustification) {
      alert("Disposition justification is required.");
      return;
    }

    const currentItem = affectedItems.find((item) => item.id === itemId);
    const quantityAffected = toQuantityNumber(currentItem?.quantity_affected);
    const quantityQuarantined = toQuantityNumber(currentItem?.quarantined_quantity);
    const acceptedQty = toQuantityNumber(quantityAccepted);
    const rejectedQty = toQuantityNumber(quantityRejected);
    const dispositionedQty = acceptedQty + rejectedQty;

    if (quantityAffected <= 0) {
      alert("Affected quantity must be entered and must be greater than zero before disposition can be saved.");
      return;
    }

    if (quantityQuarantined > quantityAffected) {
      alert(`Quantity reconciliation failed.\n\nAffected Quantity: ${quantityAffected}\nQuarantined Quantity: ${quantityQuarantined}\n\nQuarantined quantity cannot exceed affected quantity.`);
      return;
    }

    if (dispositionedQty > quantityAffected) {
      alert(`Quantity reconciliation failed.\n\nAffected Quantity: ${quantityAffected}\nAccepted + Rejected Quantity: ${dispositionedQty}\nOverage: ${dispositionedQty - quantityAffected}\n\nDisposition quantity cannot exceed affected quantity.`);
      return;
    }

    const normalizedDisposition = String(productDisposition || "").toLowerCase();

    if (
      normalizedDisposition === "scrap" ||
      normalizedDisposition === "return_to_supplier"
    ) {
      if (acceptedQty !== 0) {
        alert("For Scrap or Return to Supplier disposition, Accepted Quantity must equal 0.");
        return;
      }

      if (rejectedQty !== quantityAffected) {
        alert(`For Scrap or Return to Supplier disposition, Rejected Quantity must equal the affected quantity (${quantityAffected}).`);
        return;
      }
    }

    if (
      normalizedDisposition === "use_as_is" ||
      normalizedDisposition === "accept_per_specification" ||
      normalizedDisposition === "accept_per_spec" ||
      normalizedDisposition === "release"
    ) {
      if (acceptedQty + rejectedQty !== quantityAffected) {
        alert(`Accepted Quantity + Rejected Quantity must equal the affected quantity (${quantityAffected}).`);
        return;
      }
    }

    if (productDisposition === "rework") {
      if (acceptedQty !== 0 || rejectedQty !== quantityAffected) {
        alert(
          `Rework initial disposition validation failed.\n\nAffected Quantity: ${quantityAffected}\nAccepted Quantity: ${acceptedQty}\nRejected Quantity: ${rejectedQty}\n\nFor initial Rework disposition, Accepted Quantity must equal 0 and Rejected Quantity must equal the affected quantity (${quantityAffected}). Final accepted/rejected quantities are entered after the rework task is completed.`
        );
        return;
      }

      const finalAcceptedQty = toQuantityNumber(finalReworkQuantityAccepted);
      const finalRejectedQty = toQuantityNumber(finalReworkQuantityRejected);
      const finalDispositionedQty = finalAcceptedQty + finalRejectedQty;

      if (finalDispositionedQty > quantityAffected) {
        alert(`Final rework quantity reconciliation failed.\n\nAffected Quantity: ${quantityAffected}\nFinal Accepted + Final Rejected Quantity: ${finalDispositionedQty}\nOverage: ${finalDispositionedQty - quantityAffected}\n\nFinal rework quantities cannot exceed affected quantity.`);
        return;
      }
    }

    const proposedDispositionItem = {
      ...(currentItem || {}),
      product_disposition: productDisposition,
      quantity_accepted: acceptedQty,
      quantity_rejected: rejectedQty,
      final_disposition_after_rework: finalDispositionAfterRework,
      final_rework_quantity_accepted: finalReworkQuantityAccepted,
      final_rework_quantity_rejected: finalReworkQuantityRejected,
    };

    const dispositionValidationErrors = buildQuantityReconciliationErrors(
      proposedDispositionItem,
      "Affected item"
    );

    if (dispositionValidationErrors.length > 0) {
      alert(`Disposition quantity validation failed:\n\n${dispositionValidationErrors.join("\n")}`);
      return;
    }

    const { error } = await supabase
      .from("ncmr_affected_items")
      .update({
        product_disposition: productDisposition || null,
        disposition_justification: dispositionJustification || null,
        quantity_accepted: quantityAccepted ? Number(quantityAccepted) : null,
        quantity_rejected: quantityRejected ? Number(quantityRejected) : null,
        final_disposition_after_rework:
          productDisposition === "rework" ? finalDispositionAfterRework || null : null,
        final_rework_quantity_accepted:
          productDisposition === "rework" && finalReworkQuantityAccepted
            ? Number(finalReworkQuantityAccepted)
            : null,
        final_rework_quantity_rejected:
          productDisposition === "rework" && finalReworkQuantityRejected
            ? Number(finalReworkQuantityRejected)
            : null,
      })
      .eq("id", itemId);

    if (error) {
      alert(error.message);
      return;
    }

    await addAuditLog(
      "affected_item_disposition_updated",
      "Affected item disposition, quantity accepted/rejected, and rework final disposition fields updated."
    );

    fetchAffectedItems();
  };

  const getNormalizedRiskValue = (value: any) =>
    String(value || "")
      .trim()
      .toLowerCase();

  const normalizeDetectionForConfiguredMatrix = (value: any) =>
    getNormalizedRiskValue(value).replace(/_detection$/, "");

  const formatRiskLabel = (value: any) =>
    String(value || "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (character) => character.toUpperCase());

  // Automatic risk is now controlled by the versioned NCMR Risk Matrix.
  // No Risk is a separate documented determination and is never produced
  // by the 27-cell automatic matrix.
  const calculateNcmrRiskLevel = (
    severityValue: any,
    occurrenceValue: any,
    detectionValue: any
  ) => {
    if (riskDetermination === "no_risk") return "no_risk";

    const normalizedSeverity = getNormalizedRiskValue(severityValue);
    const normalizedOccurrence = getNormalizedRiskValue(occurrenceValue);
    const normalizedDetection = normalizeDetectionForConfiguredMatrix(detectionValue);

    if (!normalizedSeverity || normalizedSeverity === "not_assessed") return "";
    if (!normalizedOccurrence || !normalizedDetection) return "";

    const configuredRule = riskMatrixRules.find(
      (rule: any) =>
        getNormalizedRiskValue(rule?.severity) === normalizedSeverity &&
        getNormalizedRiskValue(rule?.occurrence) === normalizedOccurrence &&
        getNormalizedRiskValue(rule?.detection) === normalizedDetection
    );

    return configuredRule?.overall_risk || "";
  };

  const getEffectiveRiskLevel = () => {
    if (riskDetermination === "no_risk") {
      return "no_risk";
    }

    if (riskDetermination !== "overall_residual_risk") {
      // Historical locked records retain their stored controlled result.
      if ((record?.is_locked || record?.mrb_approved_by) && record?.risk_level) {
        return record?.risk_override_enabled && record?.risk_override_level
          ? record.risk_override_level
          : record.risk_level;
      }
      return "";
    }

    if (riskAssessmentMethod === "manual") {
      return riskLevel;
    }

    if (riskOverrideEnabled && riskOverrideLevel) {
      return riskOverrideLevel;
    }

    return calculateNcmrRiskLevel(severity, occurrenceRating, detectionRating);
  };

  const getRiskPersistencePayload = () => {
    if (riskDetermination === "no_risk") {
      return {
        risk_determination: "no_risk",
        no_risk_justification: noRiskJustification.trim() || null,
        severity: null,
        occurrence_rating: null,
        detection_rating: null,
        risk_assessment_method: "automatic",
        risk_level: "no_risk",
        risk_override_enabled: false,
        risk_override_level: null,
        risk_override_justification: null,
        risk_configuration_version_id: riskConfiguration?.id || record?.risk_configuration_version_id || null,
        risk_configuration_version_code: riskConfiguration?.version_code || record?.risk_configuration_version_code || null,
      };
    }

    return {
      risk_determination: riskDetermination || null,
      no_risk_justification: null,
      severity: severity === "not_assessed" ? null : severity,
      occurrence_rating: occurrenceRating || null,
      detection_rating: detectionRating || null,
      risk_assessment_method: riskAssessmentMethod,
      risk_level:
        riskAssessmentMethod === "manual"
          ? riskLevel || null
          : calculateNcmrRiskLevel(severity, occurrenceRating, detectionRating) || null,
      risk_override_enabled:
        riskAssessmentMethod === "automatic" ? riskOverrideEnabled : false,
      risk_override_level:
        riskAssessmentMethod === "automatic" && riskOverrideEnabled
          ? riskOverrideLevel || null
          : null,
      risk_override_justification:
        riskAssessmentMethod === "automatic" && riskOverrideEnabled
          ? riskOverrideJustification || null
          : null,
      risk_configuration_version_id:
        riskConfiguration?.id || record?.risk_configuration_version_id || null,
      risk_configuration_version_code:
        riskConfiguration?.version_code || record?.risk_configuration_version_code || null,
    };
  };

  const getRiskAssessmentValidationErrors = () => {
    const errors: string[] = [];

    if (!riskDetermination) {
      errors.push("Risk Determination is required.");
      return errors;
    }

    if (riskDetermination === "no_risk") {
      if (!noRiskJustification.trim()) {
        errors.push("No Risk Justification is required when Risk Determination is No Risk.");
      }
      return errors;
    }

    if (!riskConfiguration?.id && !(record?.is_locked || record?.mrb_approved_by)) {
      errors.push("Active Risk Assessment configuration could not be loaded.");
    }

    if (riskMatrixRules.length !== 27 && riskAssessmentMethod === "automatic") {
      errors.push(`Automatic Risk Matrix is incomplete. Expected 27 rules; loaded ${riskMatrixRules.length}.`);
    }

    if (severity === "not_assessed" || !severity) {
      errors.push("Severity is required.");
    }

    if (!occurrenceRating) {
      errors.push("Occurrence is required.");
    }

    if (!detectionRating) {
      errors.push("Detection is required.");
    }

    if (riskAssessmentMethod === "manual" && !riskLevel) {
      errors.push("Manual Risk Level is required when Risk Assessment Method is Manual.");
    }

    if (riskAssessmentMethod === "automatic" && riskOverrideEnabled) {
      if (!riskOverrideLevel) {
        errors.push("Override Risk Level is required when calculated risk is overridden.");
      }
      if (!riskOverrideJustification.trim()) {
        errors.push("Risk Override Justification is required when calculated risk is overridden.");
      }
    }

    if (
      riskAssessmentMethod === "automatic" &&
      !riskOverrideEnabled &&
      severity !== "not_assessed" &&
      occurrenceRating &&
      detectionRating &&
      !calculateNcmrRiskLevel(severity, occurrenceRating, detectionRating)
    ) {
      errors.push("Configured Overall Risk could not be determined.");
    }

    return errors;
  };

  const getCapaRecommendation = () => {
    const evaluation = evaluateCapaGovernance();
    return {
      recommended:
        evaluation.outcome === "recommended" ||
        evaluation.outcome === "required",
      reason: evaluation.rationale,
    };
  };

  const isNoCapaDecisionAccepted = () => {
    const recommendation = getCapaRecommendation();

    if (!recommendation.recommended) {
      return true;
    }

    if (record?.linked_capa_id || record?.capa_id || linkedCapa) {
      return true;
    }

    if (record?.capa_not_required_justification || capaNotRequiredJustification.trim()) {
      return true;
    }

    if (
      record?.capa_evaluation_outcome === "not_required" ||
      record?.capa_evaluation_outcome === "not_opened_with_justification"
    ) {
      return true;
    }

    return false;
  };

  const validateWorkflowForMrbApproval = () => {
    setValidationAttempted(true);
    const errors: string[] = [];

    if (!investigator) errors.push("Investigator is required before MRB approval.");
    if (!problemDescription) errors.push("Problem statement is required before MRB approval.");
    if (!investigationSummary) errors.push("Investigation summary is required before MRB approval.");
    if (!rootCauseCategory) errors.push("Root cause category is required before MRB approval.");
    if (!rootCause) errors.push("Root Cause Summary is required before MRB approval.");
    errors.push(...getRiskAssessmentValidationErrors().map((error) => `${error} Before MRB approval.`));

    if (!capaGovernanceConfiguration?.id && !(record?.is_locked || record?.mrb_approved_by)) {
      errors.push("Active CAPA Governance configuration could not be loaded.");
    }

    const capaRecommendation = getCapaRecommendation();

    if (
      capaRecommendation.recommended &&
      !record?.capa_id &&
      !isNoCapaDecisionAccepted()
    ) {
      errors.push("CAPA recommendation requires either a linked CAPA or a documented No-CAPA justification in CAPA Governance before MRB approval.");
    }

    if (!productDisposition) errors.push("Overall product disposition is required before MRB approval.");
    if (!dispositionJustification) errors.push("Overall disposition justification is required before MRB approval.");

    if (affectedItems.length === 0) {
      errors.push("At least one affected material item is required before MRB approval.");
    }

    affectedItems.forEach((item, index) => {
      const label = `Affected Item ${index + 1}`;

      if (!item.product_part_number && !item.lot_number && !item.workorder_number) {
        errors.push(`${label}: part number, lot number, or work order is required.`);
      }

      if (item.quantity_affected === null || item.quantity_affected === undefined) {
        errors.push(`${label}: quantity affected is required.`);
      }

      if (item.quarantined_quantity === null || item.quarantined_quantity === undefined) {
        errors.push(`${label}: quantity quarantined is required.`);
      }

      if (!item.product_disposition) errors.push(`${label}: disposition is required.`);
      if (!item.disposition_justification) errors.push(`${label}: disposition justification is required.`);

      if (item.quantity_accepted === null || item.quantity_accepted === undefined) {
        errors.push(`${label}: quantity accepted is required.`);
      }

      if (item.quantity_rejected === null || item.quantity_rejected === undefined) {
        errors.push(`${label}: quantity rejected is required.`);
      }

      const quantityReconciliationErrors = buildQuantityReconciliationErrors(item, label);
      errors.push(...quantityReconciliationErrors);

    });

    const mrbGovernanceErrors = requiredMrbApprovalsComplete();
    errors.push(...mrbGovernanceErrors);

    setValidationErrors(errors);
    return errors.length === 0;
  };

  const validateWorkflowForClosure = () => {
    setValidationAttempted(true);
    const errors: string[] = [];

    if (!record?.mrb_approved_by) errors.push("MRB approval is required before closure.");

    if (isCorrectionNotRequired()) {
      if (!correctiveAction.trim()) {
        errors.push("Correction not required requires documented justification before closure.");
      }
    }

    if (!investigationSummary) errors.push("Investigation summary is required before closure.");
    errors.push(...getRiskAssessmentValidationErrors().map((error) => `${error} Before closure.`));
    const closureCapaRecommendation = getCapaRecommendation();

    if (
      closureCapaRecommendation.recommended &&
      !record?.capa_id &&
      !isNoCapaDecisionAccepted()
    ) {
      errors.push("CAPA recommendation requires either a linked CAPA or a documented No-CAPA justification in CAPA Governance before closure.");
    }

    affectedItems.forEach((item, index) => {
      const label = `Affected Item ${index + 1}`;
      const quantityReconciliationErrors = buildQuantityReconciliationErrors(item, label);
      errors.push(...quantityReconciliationErrors);

      if (!isSupportedDisposition(item?.product_disposition)) {
        errors.push(`${label}: unsupported disposition. Select one of the approved NCMR disposition types.`);
      }

      errors.push(...getDispositionImplementationErrors(item, label));
    });

    const reworkItemsMissingFinalDisposition = affectedItems.filter(
      (item) =>
        item.product_disposition === "rework" &&
        (!item.final_disposition_after_rework ||
          item.final_rework_quantity_accepted === null ||
          item.final_rework_quantity_accepted === undefined ||
          item.final_rework_quantity_rejected === null ||
          item.final_rework_quantity_rejected === undefined)
    );

    if (reworkItemsMissingFinalDisposition.length > 0) {
      errors.push("Rework items require final disposition after rework with final accepted and rejected quantities before closure.");
    }

    const executionTaskErrors = requiredExecutionTasksComplete();
    errors.push(...executionTaskErrors);

    setValidationErrors(errors);
    return errors.length === 0;
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
      "MRB Approver";

    const approverRole =
      row?.approver_role ||
      row?.role ||
      row?.approval_role ||
      row?.reviewer_role ||
      approverJobTitle ||
      "MRB Approver";

    const approvalOrder =
      row?.approval_order ??
      row?.display_order ??
      row?.sort_order ??
      row?.sequence ??
      row?.order_index ??
      index + 1;

    const isRequired =
      row?.is_required === false || row?.required === false ? false : true;

    return {
      approver_email: String(approverEmail || "").trim().toLowerCase(),
      approver_function: String(approverFunction || "").trim(),
      approver_job_title: String(approverJobTitle || "MRB Approver").trim(),
      approver_due_date: row?.approver_due_date || row?.due_date || null,
      approver_role: String(approverRole || "MRB Approver").trim(),
      approval_order: Number(approvalOrder) || index + 1,
      is_required: isRequired,
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

  const getMrbApproverFunctionName = (approver: any, index: number) => {
    const functionName =
      approver?.approver_function ||
      approver?.required_function ||
      approver?.approver_role ||
      "MRB Approval";
    const jobTitle =
      approver?.approver_job_title ||
      approver?.approver_role ||
      "Approver";
    return `${functionName} - ${jobTitle}`;
  };

  const normalizeApproverEmail = (email: any) =>
    String(email || "").trim().toLowerCase();

  const isValidEmailFormat = (email: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const findDuplicateEmails = (emails: string[]) => {
    const seen = new Set<string>();
    const duplicates = new Set<string>();

    emails.forEach((email) => {
      const normalized = normalizeApproverEmail(email);
      if (!normalized) return;
      if (seen.has(normalized)) {
        duplicates.add(normalized);
      }
      seen.add(normalized);
    });

    return Array.from(duplicates);
  };

  const validateApproverEmails = async (emails: string[]) => {
    const normalizedEmails = Array.from(
      new Set(emails.map((email) => normalizeApproverEmail(email)).filter(Boolean))
    );

    if (normalizedEmails.length === 0) {
      return {
        valid: false,
        message: "At least one approver email is required.",
      };
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
        message: `The following approver email(s) are not valid QualiSphere users:\n\n${unknownUsers.join("\n")}\n\nPlease correct the approver list before submitting for MRB approval.`,
      };
    }

    return {
      valid: true,
      message: "",
    };
  };


  const getInvalidApproverEmails = async (emails: string[]) => {
    const normalizedEmails = Array.from(
      new Set(emails.map((email) => normalizeApproverEmail(email)).filter(Boolean))
    );

    const invalidFormatEmails = normalizedEmails.filter(
      (email) => !isValidEmailFormat(email)
    );

    const formatValidEmails = normalizedEmails.filter((email) =>
      isValidEmailFormat(email)
    );

    let unknownUsers: string[] = [];

    if (formatValidEmails.length > 0) {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_email")
        .in("user_email", formatValidEmails);

      if (error) {
        throw new Error(`Unable to validate approver emails against system users: ${error.message}`);
      }

      const validSystemUsers = new Set(
        (data || []).map((item: any) => normalizeApproverEmail(item.user_email))
      );

      unknownUsers = formatValidEmails.filter(
        (email) => !validSystemUsers.has(email)
      );
    }

    return Array.from(new Set([...invalidFormatEmails, ...unknownUsers]));
  };

  const validateConfiguredApproverRows = async (approvers: any[]) => {
    const emails = approvers
      .map((approver: any) => normalizeApproverEmail(approver.approver_email))
      .filter(Boolean);

    const duplicateEmails = findDuplicateEmails(emails);

    if (duplicateEmails.length > 0) {
      return {
        valid: false,
        message: `Duplicate MRB approver email(s) are not allowed:\n\n${duplicateEmails.join("\n")}`,
      };
    }

    return validateApproverEmails(emails);
  };

  const loadMrbApproversFromMatrix = async () => {
    if (isMrbApprovalConfigurationLocked()) {
      alert("MRB approval configuration cannot be changed while the current MRB approval package is pending.");
      return;
    }

    if (!selectedApprovalMatrixId) {
      alert("Select an approval matrix first.");
      return;
    }

    const matrixRows = await fetchApprovalMatrixRows(selectedApprovalMatrixId);

    if (matrixRows.length === 0) {
      alert("No approver rows were found for the selected approval matrix.");
      return;
    }

    const matrixValidation = await validateConfiguredApproverRows(matrixRows);

    if (!matrixValidation.valid) {
      alert(`Approval matrix cannot be loaded.\n\n${matrixValidation.message}`);
      return;
    }

    const confirmed = window.confirm(
      "Load approvers from this approval matrix? The current editable MRB reviewer configuration will be replaced. Historical approval tasks will not be changed."
    );

    if (!confirmed) return;

    const { error: replaceConfigurationError } = await supabase
      .from("ncmr_mrb_reviewers")
      .delete()
      .eq("ncmr_id", id);

    if (replaceConfigurationError) {
      alert(replaceConfigurationError.message);
      return;
    }

    const rowsToInsert = matrixRows.map((row: any, index: number) => ({
      ncmr_id: id,
      approver_email: row.approver_email,
      approver_function: row.approver_function || null,
      approver_job_title:
        row.approver_job_title || row.approver_role || "MRB Approver",
      approver_due_date: row.approver_due_date || null,
      approver_role:
        row.approver_role || row.approver_job_title || "MRB Approver",
      approval_status: "configured",
      approval_order: row.approval_order || index + 1,
      is_required: row.is_required !== false,
      source_template_id: selectedApprovalMatrixId,
      signature_meaning: "MRB approval requested from approval matrix.",
    }));

    const { error } = await supabase.from("ncmr_mrb_reviewers").insert(rowsToInsert);

    if (error) {
      alert(error.message);
      return;
    }

    await addAuditLog(
      "mrb_approval_matrix_loaded",
      `Loaded ${rowsToInsert.length} MRB approver(s) from approval matrix.`
    );

    alert("MRB approvers loaded from approval matrix.");
    fetchMrbApprovers();
  };

  const addManualMrbApprover = async () => {
    if (isMrbApprovalConfigurationLocked()) {
      alert("Approvers cannot be changed while the current MRB approval package is pending.");
      return;
    }

    const normalizedManualEmail = normalizeApproverEmail(
      manualMrbApproverEmail
    );
    const approverFunction = manualMrbApproverFunction.trim();
    const approverJobTitle = manualMrbApproverJobTitle.trim();
    const approverDueDate = manualMrbApproverDueDate.trim();

    if (!approverFunction) {
      alert("Function is required.");
      return;
    }

    if (!approverJobTitle) {
      alert("Job title is required.");
      return;
    }

    if (!normalizedManualEmail) {
      alert("Reviewer email is required.");
      return;
    }

    if (!approverDueDate) {
      alert("Approve By date is required.");
      return;
    }

    if (
      mrbApprovers.some(
        (approver: any) =>
          normalizeApproverEmail(approver.approver_email) ===
          normalizedManualEmail
      )
    ) {
      alert("This reviewer is already configured for MRB approval.");
      return;
    }

    const manualValidation = await validateApproverEmails([
      normalizedManualEmail,
    ]);

    if (!manualValidation.valid) {
      alert(`Reviewer cannot be added.\n\n${manualValidation.message}`);
      return;
    }

    const nextOrder =
      mrbApprovers.length > 0
        ? Math.max(
            ...mrbApprovers.map(
              (item: any) => Number(item.approval_order) || 0
            )
          ) + 1
        : 1;

    const { error } = await supabase.from("ncmr_mrb_reviewers").insert({
      ncmr_id: id,
      approver_email: normalizedManualEmail,
      approver_function: approverFunction,
      approver_job_title: approverJobTitle,
      approver_due_date: approverDueDate,
      approver_role:
        manualMrbApproverRole.trim() || approverJobTitle || "MRB Approver",
      approval_status: "configured",
      approval_order: nextOrder,
      is_required: manualMrbApproverRequired,
      signature_meaning: "Manual MRB approval requested.",
    });

    if (error) {
      alert(error.message);
      return;
    }

    await addAuditLog(
      "mrb_manual_approver_added",
      `MRB reviewer added: ${normalizedManualEmail}; Function: ${approverFunction}; Job Title: ${approverJobTitle}; Approve By: ${approverDueDate}.`
    );

    setManualMrbApproverEmail("");
    setManualMrbApproverFunction("");
    setManualMrbApproverJobTitle("");
    setManualMrbApproverDueDate("");
    setManualMrbApproverRole("MRB Approver");
    setManualMrbApproverRequired(true);
    await fetchMrbApprovers();
  };

  const removeMrbApprover = async (approver: any) => {
    if (isMrbApprovalConfigurationLocked()) {
      alert("MRB approval configuration cannot be changed while the current MRB approval package is pending.");
      return;
    }

    const approverEmail = normalizeApproverEmail(approver?.approver_email);
    const approverRole = approver?.approver_role || "MRB Approver";
    const approvalOrder = Number(approver?.approval_order || 0);

    const confirmed = window.confirm(
      `Remove this MRB approver from the configuration?\n\n${approverEmail || "Selected approver"}`
    );
    if (!confirmed) return;

    if (!approverEmail && !approver?.id) {
      alert("Unable to remove approver because the configuration row does not have an email or row id.");
      return;
    }

    let removedCount = 0;

    if (approver?.id) {
      const { data, error } = await supabase
        .from("ncmr_mrb_reviewers")
        .delete()
        .eq("id", approver.id)
        .select("id");

      if (error) {
        alert(error.message);
        return;
      }

      removedCount = data?.length || 0;
    }

    if (removedCount === 0 && approverEmail) {
      let deleteQuery = supabase
        .from("ncmr_mrb_reviewers")
        .delete()
        .eq("ncmr_id", id)
        .eq("approver_email", approverEmail);

      if (approvalOrder > 0) {
        deleteQuery = deleteQuery.eq("approval_order", approvalOrder);
      }

      const { data, error } = await deleteQuery.select("id");

      if (error) {
        alert(error.message);
        return;
      }

      removedCount = data?.length || 0;
    }

    if (removedCount === 0) {
      alert("No MRB approver row was removed. Try Reset MRB Approval Workflow, then reload the page and remove the approver again.");
      await fetchMrbApprovers();
      return;
    }

    await addAuditLog(
      "mrb_approver_removed",
      `MRB approver removed from configuration after approval workflow reset or before approval task generation. Approver: ${approverEmail || "unknown"}; Role: ${approverRole}. Rows removed: ${removedCount}.`
    );

    alert("MRB approver removed from configuration.");
    await fetchMrbApprovers();
    await fetchApprovalTasks();
  };

  const saveMrbGovernance = async () => {
    if (isMrbApprovalConfigurationLocked()) {
      alert("MRB governance cannot be changed while an active MRB approval package exists. Use Reset MRB Approval Workflow first if configuration changes are needed.");
      return;
    }

    await addAuditLog(
      "mrb_governance_saved",
      `MRB approver configuration saved with ${mrbApprovers.length} approver(s).`
    );

    alert("MRB approval configuration saved.");
    fetchMrbApprovers();
  };

  const validateWorkflowBeforeGeneratingMrbTasks = () => {
    const errors: string[] = [];

    // Full pre-MRB workflow-failure gate. Missing decision-package content
    // must stop MRB submission rather than first appearing at closure.
    if (!containmentAction.trim()) errors.push("Containment action is required before submitting for MRB approval.");
    if (!investigator.trim()) errors.push("Investigator is required before submitting for MRB approval.");
    if (!problemDescription.trim()) errors.push("Problem statement is required before submitting for MRB approval.");
    if (!investigationSummary.trim()) errors.push("Investigation summary is required before submitting for MRB approval.");
    if (!rootCauseCategory.trim()) errors.push("Root cause category is required before submitting for MRB approval.");
    if (!rootCause.trim()) errors.push("Root Cause Summary is required before submitting for MRB approval.");
    if (!correctionActionProposal.trim()) errors.push("Correction Proposal is required before submitting for MRB approval.");
    if (!correctiveAction.trim()) errors.push("Corrective Action Proposal / justification is required before submitting for MRB approval.");
    errors.push(...getRiskAssessmentValidationErrors().map((error) => `${error} Before submitting for MRB approval.`));

    if (!capaGovernanceConfiguration?.id && !(record?.is_locked || record?.mrb_approved_by)) {
      errors.push("Active CAPA Governance configuration could not be loaded.");
    }

    const capaRecommendation = getCapaRecommendation();
    if (capaRecommendation.recommended && !record?.capa_id && !isNoCapaDecisionAccepted()) {
      errors.push("CAPA recommendation requires either a linked CAPA or a documented No-CAPA justification in CAPA Governance before submitting for MRB approval.");
    }

    if (!productDisposition) errors.push("Overall product disposition is required before submitting for MRB approval.");
    if (!dispositionJustification.trim()) errors.push("Overall disposition justification is required before submitting for MRB approval.");

    if (affectedItems.length === 0) errors.push("At least one affected material item is required before submitting for MRB approval.");

    affectedItems.forEach((item, index) => {
      const label = `Affected Item ${index + 1}`;
      if (!item.product_part_number && !item.lot_number && !item.workorder_number) errors.push(`${label}: part number, lot number, or work order is required.`);
      if (item.quantity_affected === null || item.quantity_affected === undefined) errors.push(`${label}: quantity affected is required.`);
      if (item.quarantined_quantity === null || item.quarantined_quantity === undefined) errors.push(`${label}: quantity quarantined is required.`);
      if (!item.product_disposition) errors.push(`${label}: item disposition is required before submitting for MRB approval.`);
      if (!item.disposition_justification) errors.push(`${label}: item disposition justification is required before submitting for MRB approval.`);
      if (item.quantity_accepted === null || item.quantity_accepted === undefined) errors.push(`${label}: quantity accepted is required before submitting for MRB approval.`);
      if (item.quantity_rejected === null || item.quantity_rejected === undefined) errors.push(`${label}: quantity rejected is required before submitting for MRB approval.`);
      errors.push(...buildQuantityReconciliationErrors(item, label));
    });

    setValidationErrors(errors);
    setValidationAttempted(true);
    return errors;
  };

  const submitForMrbApproval = async () => {
    if (submittingMrbApproval) return;

    if (record?.is_locked || record?.mrb_approved_by) {
      alert("MRB approval cannot be submitted after approval completion or record lock.");
      return;
    }

    setSubmittingMrbApproval(true);

    const { data: existingPendingTasks, error: pendingTaskCheckError } =
      await supabase
        .from("approval_tasks")
        .select("id, assigned_to_email, required_function, status, created_at")
        .eq("entity_type", "ncmr")
        .eq("entity_id", id)
        .eq("task_type", "mrb_approval")
        .eq("status", "pending");

    if (pendingTaskCheckError) {
      alert(
        `Unable to verify the current MRB approval status.\n\n${pendingTaskCheckError.message}`
      );
      setSubmittingMrbApproval(false);
      return;
    }

    if ((existingPendingTasks || []).length > 0) {
      setApprovalTasks((currentTasks) => {
        const nonPendingTasks = currentTasks.filter(
          (item: any) =>
            !(
              item.task_type === "mrb_approval" &&
              String(item.status || "").toLowerCase() === "pending"
            )
        );

        return [...nonPendingTasks, ...(existingPendingTasks || [])];
      });

      setRecord((currentRecord: any) => ({
        ...(currentRecord || {}),
        review_status: "pending_approval",
      }));

      alert(
        "This MRB package has already been submitted and currently has pending reviewer tasks. A duplicate approval package was not created."
      );
      setSubmittingMrbApproval(false);
      return;
    }

    const preTaskValidationErrors = validateWorkflowBeforeGeneratingMrbTasks();

    if (preTaskValidationErrors.length > 0) {
      alert(`MRB approval cannot be submitted yet:\n\n${preTaskValidationErrors.join("\n")}`);
      setSubmittingMrbApproval(false);
      return;
    }

    const { error: workflowSaveError } = await supabase
      .from("ncmrs")
      .update({
        risk_assessment: riskAssessment,
        ...getRiskPersistencePayload(),
        capa_governance_version_id:
          capaGovernanceConfiguration?.id || record?.capa_governance_version_id || null,
        capa_governance_version_code:
          capaGovernanceConfiguration?.version_code || record?.capa_governance_version_code || null,
        product_disposition:
          productDisposition ||
          record?.product_disposition ||
          record?.disposition ||
          null,
        disposition:
          productDisposition ||
          record?.product_disposition ||
          record?.disposition ||
          null,
        disposition_justification:
          dispositionJustification ||
          record?.disposition_justification ||
          null,
        review_status: "pending_approval",
        mrb_approved_by: null,
        mrb_approved_at: null,
        mrb_signature_email_entered: null,
        mrb_signature_meaning: null,
      })
      .eq("id", id);

    if (workflowSaveError) {
      alert(workflowSaveError.message);
      setSubmittingMrbApproval(false);
      return;
    }

    try {
      const effectiveRisk = getEffectiveRiskLevel();
      const capaEvaluation = evaluateCapaGovernance();

      await snapshotControlledNcmrDecision(
        "risk_assessment",
        riskConfiguration?.id || record?.risk_configuration_version_id,
        riskDetermination === "no_risk"
          ? {
              risk_determination: "no_risk",
              no_risk_justification: noRiskJustification.trim(),
            }
          : {
              risk_determination: "overall_residual_risk",
              assessment_method: riskAssessmentMethod,
              severity,
              occurrence: occurrenceRating,
              detection: detectionRating,
              calculated_risk:
                riskAssessmentMethod === "automatic"
                  ? calculateNcmrRiskLevel(severity, occurrenceRating, detectionRating)
                  : null,
              override_enabled:
                riskAssessmentMethod === "automatic" ? riskOverrideEnabled : false,
              override_level:
                riskAssessmentMethod === "automatic" && riskOverrideEnabled
                  ? riskOverrideLevel
                  : null,
              override_justification:
                riskAssessmentMethod === "automatic" && riskOverrideEnabled
                  ? riskOverrideJustification
                  : null,
            },
        {
          final_effective_risk: effectiveRisk,
          risk_notes: riskAssessment || null,
        }
      );

      await snapshotControlledNcmrDecision(
        "capa_governance",
        capaGovernanceConfiguration?.id || record?.capa_governance_version_id,
        {
          final_effective_risk: effectiveRisk,
          recurrence_detected:
            record?.recurring_issue === true ||
            String(record?.recurrence_reason || "").toLowerCase().includes("recurr"),
        },
        {
          outcome: capaEvaluation.outcome,
          label: capaEvaluation.label,
          rationale: capaEvaluation.rationale,
          signals: capaEvaluation.signals,
        }
      );
    } catch (snapshotError: any) {
      alert(
        `MRB approval cannot be submitted because the controlled decision snapshot could not be recorded.\n\n${snapshotError.message}`
      );
      setSubmittingMrbApproval(false);
      return;
    }

    const requiredApprovers = mrbApprovers
      .filter((approver: any) => approver.is_required !== false)
      .filter((approver: any) => approver.approver_email);

    if (requiredApprovers.length === 0) {
      alert("At least one required reviewer must be configured before submitting for MRB approval.");
      setSubmittingMrbApproval(false);
      return;
    }

    const approverValidation = await validateConfiguredApproverRows(requiredApprovers);

    if (!approverValidation.valid) {
      alert(`MRB approval cannot be submitted.\n\n${approverValidation.message}`);
      setSubmittingMrbApproval(false);
      return;
    }

    const requiredTasks = requiredApprovers.map(
      (approver: any, index: number) => ({
        required: approver.is_required !== false,
        functionName: getMrbApproverFunctionName(approver, index),
        email: approver.approver_email,
        role:
          approver.approver_job_title ||
          approver.approver_role ||
          "MRB Approver",
        dueDate: approver.approver_due_date || null,
      })
    );

    const taskRows = requiredTasks.map((task) => ({
      entity_type: "ncmr",
      entity_id: id,
      task_type: "mrb_approval",
      required_function: task.functionName,
      assigned_to_email: task.email.trim().toLowerCase(),
      assigned_by_email: userEmail,
      due_date: task.dueDate,
      required: task.required,
      status: "pending",
      task_title: `MRB Approval: ${record?.ncmr_number || "NCMR"}`,
      comments: `Please review this NCMR for MRB approval.

NCMR: ${record?.ncmr_number || "NCMR"}
Severity: ${severity || "N/A"}

Review and verify:
• Problem statement
• Investigation summary
• Root cause
• Risk assessment
• Product disposition
• Quantity accepted/rejected
• Rework final disposition, if applicable

Approve only if the MRB decision is technically justified, risk-assessed, and compliant with procedure requirements.

Open this task from My Workspace to review the submitted read-only MRB package and record your decision.

This approval becomes part of the official electronic quality record. MRB approval is complete when all required reviewers approve.`,
    }));

    const { data: insertedTasks, error } = await supabase
      .from("approval_tasks")
      .insert(taskRows)
      .select();

    if (error) {
      alert(error.message);
      setSubmittingMrbApproval(false);
      return;
    }

    if (insertedTasks && insertedTasks.length > 0) {
      setApprovalTasks((currentTasks) => {
        const historicalTasks = currentTasks.filter(
          (item: any) =>
            !(
              item.task_type === "mrb_approval" &&
              String(item.status || "").toLowerCase() === "pending"
            )
        );

        return [...historicalTasks, ...insertedTasks];
      });

      setRecord((currentRecord: any) => ({
        ...(currentRecord || {}),
        review_status: "pending_approval",
      }));
      setReviewStatus("pending_approval");

      const notifications = insertedTasks.map((task) => ({
        recipient_email: task.assigned_to_email,
        subject: `MRB approval task assigned: ${record?.ncmr_number || "NCMR"}`,
        body: `You have been assigned an MRB approval task for ${record?.ncmr_number || "this NCMR"}. Please log in to QualiSphere and open My Workspace.`,
        entity_type: "ncmr",
        entity_id: id,
        task_id: task.id,
        status: "pending",
      }));

      await supabase.from("notification_queue").insert(notifications);

      await Promise.all(
        insertedTasks.map((task: any) =>
          createInAppNotification({
            recipientEmail: task.assigned_to_email,
            notificationType: "ncmr_approval",
            title: `MRB approval assigned: ${record?.ncmr_number || "NCMR"}`,
            message: `An MRB approval task for ${record?.ncmr_number || "this NCMR"} is waiting in My Workspace.`,
            severityLevel:
              severity === "critical"
                ? "critical"
                : severity === "high"
                  ? "high"
                  : "info",
            assignedRole: task.required_function || "MRB Approver",
            relatedUrl: `/ncmrs/${id}/approval-review?taskId=${task.id}`,
          })
        )
      );
    }

    const { error: reviewerStatusError } = await supabase
      .from("ncmr_mrb_reviewers")
      .update({
        approval_status: "submitted",
        updated_at: new Date().toISOString(),
      })
      .eq("ncmr_id", id)
      .in(
        "approver_email",
        requiredApprovers.map((approver: any) =>
          normalizeApproverEmail(approver.approver_email)
        )
      );

    if (reviewerStatusError) {
      alert(reviewerStatusError.message);
      setSubmittingMrbApproval(false);
      return;
    }

    await addAuditLog(
      "mrb_submitted_for_approval",
      `MRB submitted for approval to ${taskRows.length} required reviewer(s).`
    );

    alert(
      "MRB submitted for approval. Reviewer tasks are now available in My Workspace."
    );
    await Promise.all([
      fetchMrbApprovers(),
      fetchApprovalTasks(),
      fetchAuditTimeline(),
    ]);
    setSubmittingMrbApproval(false);
  };

  const isAuthorizedToResetMrbApprovalWorkflow = () => {
    const normalizedRole = String(userRole || "")
      .trim()
      .toLowerCase()
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ");

    const compactRole = normalizedRole.replace(/\s+/g, "");

    return (
      normalizedRole === "administrator" ||
      normalizedRole === "admin" ||
      normalizedRole === "quality manager" ||
      normalizedRole === "manager quality" ||
      normalizedRole === "vp quality" ||
      normalizedRole === "vp of quality" ||
      normalizedRole === "vice president quality" ||
      normalizedRole === "vice president of quality" ||
      compactRole === "vpquality" ||
      compactRole === "vpofquality" ||
      compactRole === "vicepresidentquality" ||
      compactRole === "vicepresidentofquality" ||
      compactRole === "qualitymanager"
    );
  };

  const getLatestMrbApprovalBoundaryAt = () => {
    const boundaryEvents = auditTimeline
      .filter((item: any) =>
        [
          "mrb_approval_workflow_reset",
          "mrb_approval_cycle_returned",
        ].includes(String(item.action || ""))
      )
      .map((item: any) => item.created_at)
      .filter(Boolean)
      .sort();

    return boundaryEvents.length > 0
      ? boundaryEvents[boundaryEvents.length - 1]
      : null;
  };

  const getActiveMrbApprovalTasks = () => {
    const latestBoundaryAt = getLatestMrbApprovalBoundaryAt();

    return approvalTasks
      .filter((approvalTask: any) => approvalTask.task_type === "mrb_approval")
      .filter(
        (approvalTask: any) =>
          approvalTask.status !== "cancelled" &&
          approvalTask.status !== "obsolete"
      )
      .filter((approvalTask: any) => {
        if (!latestBoundaryAt) return true;
        if (!approvalTask.created_at) return false;

        return (
          new Date(approvalTask.created_at).getTime() >
          new Date(latestBoundaryAt).getTime()
        );
      });
  };

  const hasActiveMrbApprovalWorkflow = () => {
    return getActiveMrbApprovalTasks().some(
      (task: any) => String(task.status || "").toLowerCase() === "pending"
    );
  };

  const hasPendingMrbApprovalTasks = () => {
    return getActiveMrbApprovalTasks().some(
      (task: any) => String(task.status || "").toLowerCase() === "pending"
    );
  };

  const isMrbApprovalConfigurationLocked = () => {
    if (record?.is_locked || record?.mrb_approved_by) return true;

    // Only a currently pending MRB package locks configuration.
    // Rejected, cancelled, obsolete, and historical tasks remain part of the
    // audit trail but must not prevent owner revision and resubmission.
    return hasPendingMrbApprovalTasks();
  };

  const fixMrbApprovalTaskIssues = async () => {
    if (record?.is_locked || record?.mrb_approved_by) {
      alert("Approval task issues cannot be fixed after MRB approval or record lock.");
      return;
    }

    const rowsWithEmail = mrbApprovers
      .filter((approver: any) => approver.approver_email)
      .sort((a: any, b: any) => {
        const orderA = Number(a.approval_order || 9999);
        const orderB = Number(b.approval_order || 9999);
        if (orderA !== orderB) return orderA - orderB;
        return String(a.created_at || "").localeCompare(String(b.created_at || ""));
      });

    if (rowsWithEmail.length === 0) {
      alert("No MRB approvers are configured.");
      return;
    }

    let invalidConfiguredEmails: string[] = [];

    try {
      invalidConfiguredEmails = await getInvalidApproverEmails(
        rowsWithEmail.map((approver: any) => approver.approver_email)
      );
    } catch (error: any) {
      alert(`Cannot fix MRB approval task issues.\n\n${error.message}`);
      return;
    }

    const invalidConfiguredEmailSet = new Set(invalidConfiguredEmails);

    const seenConfiguredEmails = new Set<string>();
    const duplicateConfiguredRows: any[] = [];
    const invalidConfiguredRows: any[] = [];
    const activeConfiguredApprovers: any[] = [];

    rowsWithEmail.forEach((approver: any) => {
      const email = normalizeApproverEmail(approver.approver_email);
      if (!email) return;

      if (invalidConfiguredEmailSet.has(email)) {
        if (!approver.approval_status || approver.approval_status === "pending") {
          invalidConfiguredRows.push(approver);
        }
        return;
      }

      if (seenConfiguredEmails.has(email)) {
        if (!approver.approval_status || approver.approval_status === "pending") {
          duplicateConfiguredRows.push(approver);
        }
        return;
      }

      seenConfiguredEmails.add(email);
      activeConfiguredApprovers.push(approver);
    });

    const activeRequiredApprovers = activeConfiguredApprovers.filter(
      (approver: any) => approver.is_required !== false
    );

    if (activeRequiredApprovers.length === 0) {
      alert(
        "No valid required MRB approvers remain after removing invalid or duplicate approver rows. Use Reset MRB Approval Workflow, then configure at least one valid approver."
      );
      return;
    }

    const configuredTaskKeys = new Set(
      activeRequiredApprovers.map((approver: any, index: number) =>
        `${getMrbApproverFunctionName(approver, index)}||${normalizeApproverEmail(approver.approver_email)}`
      )
    );

    const validConfiguredEmails = new Set(
      activeRequiredApprovers.map((approver: any) =>
        normalizeApproverEmail(approver.approver_email)
      )
    );

    const existingActiveTaskKeys = new Set(
      getActiveMrbApprovalTasks()
        .map((task: any) => `${task.required_function}||${normalizeApproverEmail(task.assigned_to_email)}`)
    );

    const missingApprovers = activeRequiredApprovers.filter((approver: any, index: number) => {
      const key = `${getMrbApproverFunctionName(approver, index)}||${normalizeApproverEmail(approver.approver_email)}`;
      return !existingActiveTaskKeys.has(key);
    });

    const obsoletePendingTasks = getActiveMrbApprovalTasks()
      .filter((task: any) => task.status === "pending")
      .filter((task: any) => {
        const taskEmail = normalizeApproverEmail(task.assigned_to_email);
        const taskKey = `${task.required_function}||${taskEmail}`;

        return (
          invalidConfiguredEmailSet.has(taskEmail) ||
          !validConfiguredEmails.has(taskEmail) ||
          !configuredTaskKeys.has(taskKey)
        );
      });

    if (
      missingApprovers.length === 0 &&
      duplicateConfiguredRows.length === 0 &&
      invalidConfiguredRows.length === 0 &&
      obsoletePendingTasks.length === 0
    ) {
      alert("No MRB approval task issues were found.");
      return;
    }

    const summaryLines = [
      invalidConfiguredRows.length > 0
        ? `${invalidConfiguredRows.length} invalid or unregistered pending approver configuration row(s) will be removed.`
        : "",
      duplicateConfiguredRows.length > 0
        ? `${duplicateConfiguredRows.length} duplicate pending approver configuration row(s) will be removed.`
        : "",
      obsoletePendingTasks.length > 0
        ? `${obsoletePendingTasks.length} obsolete or invalid pending approval task(s) will be cancelled.`
        : "",
      missingApprovers.length > 0
        ? `${missingApprovers.length} missing approval task(s) will be created.`
        : "",
      "",
      "Approved/rejected approval history will not be deleted or modified.",
    ].filter(Boolean);

    const confirmed = window.confirm(`Fix MRB approval task issues?\n\n${summaryLines.join("\n")}`);

    if (!confirmed) return;

    const approverRowsToRemove = [...invalidConfiguredRows, ...duplicateConfiguredRows];
    const approverRowIdsToRemove = Array.from(
      new Set(approverRowsToRemove.map((approver: any) => approver.id).filter(Boolean))
    );

    if (approverRowIdsToRemove.length > 0) {
      const { error: approverCleanupError } = await supabase
        .from("ncmr_mrb_reviewers")
        .delete()
        .in("id", approverRowIdsToRemove);

      if (approverCleanupError) {
        alert(approverCleanupError.message);
        return;
      }
    }

    if (obsoletePendingTasks.length > 0) {
      const obsoleteTaskIds = obsoletePendingTasks
        .map((task: any) => task.id)
        .filter(Boolean);

      const { error: obsoleteTaskError } = await supabase
        .from("approval_tasks")
        .update({
          status: "cancelled",
          comments:
            "Cancelled by MRB approval task issue recovery. The approver is invalid, unregistered, duplicated, or no longer part of the configured MRB approver list. Approval history was preserved.",
        })
        .in("id", obsoleteTaskIds);

      if (obsoleteTaskError) {
        alert(obsoleteTaskError.message);
        return;
      }
    }

    let insertedCount = 0;

    if (missingApprovers.length > 0) {
      const taskRows = missingApprovers.map((approver: any, index: number) => ({
        entity_type: "ncmr",
        entity_id: id,
        task_type: "mrb_approval",
        required_function: getMrbApproverFunctionName(approver, index),
        assigned_to_email: normalizeApproverEmail(approver.approver_email),
        assigned_by_email: userEmail,
        status: "pending",
        comments: `Please review this NCMR for MRB approval.

NCMR: ${record?.ncmr_number || "NCMR"}
Severity: ${severity || "N/A"}

This approval task was created by the MRB approval task issue recovery action. Existing approval history was not modified.`,
      }));

      const { data: insertedTasks, error } = await supabase
        .from("approval_tasks")
        .insert(taskRows)
        .select();

      if (error) {
        alert(error.message);
        return;
      }

      insertedCount = insertedTasks?.length || 0;

      if (insertedTasks && insertedTasks.length > 0) {
        const notifications = insertedTasks.map((task: any) => ({
          recipient_email: task.assigned_to_email,
          subject: `MRB approval task assigned: ${record?.ncmr_number || "NCMR"}`,
          body: `You have been assigned an MRB approval task for ${record?.ncmr_number || "this NCMR"}. Please log in to QualiSphere and open My Workspace.`,
          entity_type: "ncmr",
          entity_id: id,
          task_id: task.id,
          status: "pending",
        }));

        await supabase.from("notification_queue").insert(notifications);

      await Promise.all(
        insertedTasks.map((task: any) =>
          createInAppNotification({
            recipientEmail: task.assigned_to_email,
            notificationType: "ncmr_approval",
            title: `MRB approval assigned: ${record?.ncmr_number || "NCMR"}`,
            message: `An MRB approval task for ${record?.ncmr_number || "this NCMR"} is waiting in My Workspace.`,
            severityLevel: severity === "critical" ? "critical" : severity === "high" ? "high" : "info",
            assignedRole: task.required_function || "MRB Approver",
            relatedUrl: `/ncmrs/${id}/approval-review?taskId=${task.id}`,
          })
        )
      );
      }
    }

    await addAuditLog(
      "mrb_approval_task_issues_fixed",
      `MRB approval task issue recovery completed. Missing tasks created: ${insertedCount}. Invalid/unregistered approver rows removed: ${invalidConfiguredRows.length}. Duplicate approver configuration rows removed: ${duplicateConfiguredRows.length}. Obsolete/invalid pending tasks cancelled: ${obsoletePendingTasks.length}. Approval history was preserved.`
    );

    alert(
      `MRB approval task issue recovery complete.\n\nMissing tasks created: ${insertedCount}\nInvalid/unregistered configuration rows removed: ${invalidConfiguredRows.length}\nDuplicate configuration rows removed: ${duplicateConfiguredRows.length}\nObsolete/invalid pending tasks cancelled: ${obsoletePendingTasks.length}\n\nApproval history was preserved.`
    );

    fetchMrbApprovers();
    fetchApprovalTasks();
  };

  const resetMrbApprovalWorkflow = async () => {
    if (record?.is_locked || record?.mrb_approved_by) {
      alert("MRB approval workflow cannot be reset after MRB approval or record lock.");
      return;
    }

    if (!isAuthorizedToResetMrbApprovalWorkflow()) {
      alert("You are not authorized to reset the MRB approval workflow.");
      return;
    }

    const justification = window.prompt(
      "Reason for resetting the MRB approval workflow"
    );

    if (!justification || !justification.trim()) {
      alert("Reset justification is required.");
      return;
    }

    const activeTasks = getActiveMrbApprovalTasks();
    const pendingTasks = activeTasks.filter((task: any) => task.status === "pending");

    const confirmed = window.confirm(
      `Reset MRB approval workflow?\n\nPending approval tasks to cancel: ${pendingTasks.length}\nApproved/rejected approval history will be preserved.\n\nReason:\n${justification.trim()}`
    );

    if (!confirmed) return;

    if (pendingTasks.length > 0) {
      const pendingTaskIds = pendingTasks.map((task: any) => task.id).filter(Boolean);

      const { error: cancelError } = await supabase
        .from("approval_tasks")
        .update({
          status: "cancelled",
          comments:
            "Cancelled by authorized MRB approval workflow reset. Approval history was preserved.",
        })
        .in("id", pendingTaskIds);

      if (cancelError) {
        alert(cancelError.message);
        return;
      }
    }

    await addAuditLog(
      "mrb_approval_workflow_reset",
      `MRB approval workflow reset by ${userEmail || "unknown"} (${userRole || "unknown role"}). Reason: ${justification.trim()}. Pending tasks cancelled: ${pendingTasks.length}. Approved/rejected approval history preserved.`
    );

    alert(
      `MRB approval workflow reset complete.\n\nPending tasks cancelled: ${pendingTasks.length}\nApproved/rejected approval history preserved.\n\nYou may now update the MRB approval configuration and generate a new approval task package.`
    );

    fetchMrbApprovers();
    fetchApprovalTasks();
    fetchAuditTimeline();
  };



  const getRequiredMrbApprovalFunctions = () => {
    return mrbApprovers
      .filter((approver: any) => approver.is_required !== false)
      .filter((approver: any) => approver.approver_email)
      .map((approver: any, index: number) => ({
        required: true,
        functionName: getMrbApproverFunctionName(approver, index),
      }));
  };

  const hasRejectedMrbApprovalTask = () => {
    return (
      String(record?.review_status || "").toLowerCase() === "rejected" &&
      !hasPendingMrbApprovalTasks() &&
      !record?.mrb_approved_by
    );
  };

  const allRequiredMrbApprovalTasksApproved = () => {
    // Auto-completion is valid only for a deliberately submitted current cycle.
    // A returned MRB is reset to draft, so historical approvals cannot re-approve it.
    if (String(record?.review_status || "").toLowerCase() !== "pending_approval") {
      return false;
    }

    const requiredFunctions = getRequiredMrbApprovalFunctions();
    const activeApprovalTasks = getActiveMrbApprovalTasks();

    if (requiredFunctions.length === 0) {
      return false;
    }

    if (activeApprovalTasks.length === 0) {
      return false;
    }

    if (hasRejectedMrbApprovalTask()) {
      return false;
    }

    return requiredFunctions.every((item) =>
      activeApprovalTasks.some(
        (approvalTask) =>
          approvalTask.required_function === item.functionName &&
          approvalTask.status === "approved"
      )
    );
  };

  const requiredMrbApprovalsComplete = () => {
    const errors: string[] = [];

    const activeApprovalTasks = getActiveMrbApprovalTasks();

    // After an authorized reset or cancellation, historical configured approvers and
    // cancelled tasks should not block validation. A new approval package must be
    // generated before MRB can auto-approve.
    if (activeApprovalTasks.length === 0) {
      return errors;
    }

    const requiredFunctions = getRequiredMrbApprovalFunctions();

    requiredFunctions.forEach((item) => {
      const task = activeApprovalTasks.find(
        (approvalTask) =>
          approvalTask.required_function === item.functionName &&
          approvalTask.status === "approved"
      );

      if (!task) {
        errors.push(`${item.functionName} MRB approval task must be approved.`);
      }
    });

    return errors;
  };

  const completeMrbApprovalIfReady = async () => {
    if (mrbAutoApprovalInProgress) return;
    if (!record) return;
    if (record?.is_locked || record?.mrb_approved_by) return;
    if (!allRequiredMrbApprovalTasksApproved()) return;

    const workflowReady = validateWorkflowForMrbApproval();

    if (!workflowReady) {
      return;
    }

    setMrbAutoApprovalInProgress(true);

    const now = new Date().toISOString();
    const approvedReviewerEmails = getActiveMrbApprovalTasks()
      .filter((task: any) => task.status === "approved")
      .map((task: any) => normalizeApproverEmail(task.assigned_to_email))
      .filter(Boolean);

    const meaning =
      "MRB Approval: all required reviewers approved with electronic approval records.";

    const { error } = await supabase
      .from("ncmrs")
      .update({
        risk_assessment: riskAssessment || record?.risk_assessment || null,
        severity: severity || record?.severity || "not_assessed",
        occurrence_rating: occurrenceRating || record?.occurrence_rating || null,
        detection_rating: detectionRating || record?.detection_rating || null,
        risk_assessment_method: riskAssessmentMethod || record?.risk_assessment_method || "automatic",
        risk_level: riskAssessmentMethod === "manual" ? riskLevel || record?.risk_level || null : calculateNcmrRiskLevel(severity, occurrenceRating, detectionRating) || record?.risk_level || null,
        risk_override_enabled: riskAssessmentMethod === "automatic" ? riskOverrideEnabled : false,
        risk_override_level: riskAssessmentMethod === "automatic" && riskOverrideEnabled ? riskOverrideLevel || null : null,
        risk_override_justification: riskAssessmentMethod === "automatic" && riskOverrideEnabled ? riskOverrideJustification || null : null,
        capa_justification: capaJustification || record?.capa_justification || null,
        product_disposition: productDisposition || record?.product_disposition || record?.disposition || null,
        disposition: productDisposition || record?.product_disposition || record?.disposition || null,
        disposition_justification: dispositionJustification || record?.disposition_justification || null,
        mrb_approved_by:
          approvedReviewerEmails.join(", ") || "All Required MRB Reviewers",
        mrb_approved_at: now,
        mrb_signature_meaning: meaning,
        mrb_signature_email_entered:
          approvedReviewerEmails.join(", ") || "all_required_reviewers",
      })
      .eq("id", id);

    if (error) {
      setMrbAutoApprovalInProgress(false);
      alert(error.message);
      return;
    }

    await addAuditLog(
      "mrb_approval_completed",
      "MRB approval completed after all required reviewers approved."
    );

    alert("MRB approval is complete. All required reviewers approved.");
    setMrbAutoApprovalInProgress(false);
    fetchRecord();
  };

  const createCapaFromNcmr = async () => {
    if (record?.mrb_approved_by || record?.is_locked) {
      alert("This section is read-only after MRB approval or final record lock. Use the authorized Return for Revision workflow when a change to the approved MRB package is required.");
      return;
    }

    if (record?.is_locked) {
      alert("This record is locked after electronic signature and cannot be edited.");
      return;
    }

    if (record?.capa_id) {
      alert("This NCMR already has a linked CAPA.");
      return;
    }

    const { data: capaData, error: capaError } = await supabase
      .from("capas")
      .insert({
        title: `CAPA for ${record?.ncmr_number || "NCMR"}`,
        status: "open",
        source_type: "ncmr",
        capa_source: "NCMR",
        ncmr_id: id,
        linked_ncmr_title: record?.ncmr_number || null,
        problem_description:
          problemDescription || record.issue_description || record?.ncmr_number,
        investigation_summary: investigationSummary,
        root_cause: rootCause,
        root_cause_category: rootCauseCategory,
        corrective_action_plan: correctiveAction,
        action_plan: correctiveAction,
      })
      .select()
      .single();

    if (capaError) {
      alert(capaError.message);
      return;
    }

    const { error: ncmrError } = await supabase
      .from("ncmrs")
      .update({
        capa_id: capaData.id,
        capa_required: true,
        capa_recommended: true,
        capa_decision: "yes",
        capa_decision_justification: null,
        capa_justification: null,
      })
      .eq("id", id);

    if (ncmrError) {
      alert(ncmrError.message);
      return;
    }

    await addAuditLog(
      "capa_created_from_ncmr",
      `CAPA created and linked: ${capaData.title}`
    );

    alert("CAPA created and linked to this NCMR.");
    fetchRecord();
  };

  const isSupplierRelatedNcmr = () => {
    return !!record?.linked_supplier_id || !!record?.supplier_id || !!record?.supplier_name;
  };

  const evaluateScarGovernance = () => {
    const supplierPartRecorded =
      !!summaryProductPartNumber ||
      !!record?.product_part_number ||
      affectedItems.some((item: any) => !!item.product_part_number);

    const supplierRecurrence =
      record?.recurring_issue === true ||
      record?.supplier_capa_required === true ||
      record?.supplier_scar_required === true ||
      String(record?.recurrence_reason || "").toLowerCase().includes("recurr") ||
      String(record?.supplier_capa_reason || "").toLowerCase().includes("recurr") ||
      String(record?.supplier_scar_reason || "").toLowerCase().includes("recurr") ||
      String(record?.scar_reason || "").toLowerCase().includes("recurr");

    const triggers = [
      `${supplierPartRecorded ? "✓" : "✗"} Supplier Part Recorded`,
      `${supplierRecurrence ? "✓" : "✗"} Supplier Recurrence Detected`,
    ];

    if (supplierPartRecorded && supplierRecurrence) {
      return {
        outcome: "recommended",
        label: "SCAR Recommended",
        rationale:
          "SCAR is recommended because supplier part has been recorded and supplier recurrence has been detected.",
        triggers,
      };
    }

    return {
      outcome: "not_required",
      label: "SCAR Not Required",
      rationale:
        "SCAR is not automatically required because both supplier governance criteria have not been met. Supplier Part Recorded and Supplier Recurrence Detected are required for an automatic SCAR recommendation.",
      triggers,
    };
  };

  const createScarFromNcmr = async () => {
    if (record?.mrb_approved_by || record?.is_locked) {
      alert("This section is read-only after MRB approval or final record lock. Use the authorized Return for Revision workflow when a change to the approved MRB package is required.");
      return;
    }

    if (record?.is_locked) {
      alert("This record is locked and cannot be edited.");
      return;
    }

    if (record?.linked_scar_id || linkedScar) {
      alert("This NCMR already has a linked SCAR.");
      return;
    }

    if (!isSupplierRelatedNcmr()) {
      const confirmedNoSupplier = window.confirm(
        "This NCMR does not appear to have a linked supplier. Create a SCAR anyway?"
      );
      if (!confirmedNoSupplier) return;
    }

    const confirmed = window.confirm(
      "Create a linked SCAR from this NCMR? This will auto-populate supplier, issue, part, lot, severity, root cause, corrective action, and governance information where available."
    );

    if (!confirmed) return;

    const scarTitle = `SCAR for ${record?.ncmr_number || "NCMR"}`;
    const scarProblemDescription = [
      `SCAR initiated from NCMR: ${record?.ncmr_number || id}.`,
      problemDescription || record?.issue_description || "",
      summaryProductPartNumber ? `Part: ${summaryProductPartNumber}.` : "",
      summaryLotNumber ? `Lot: ${summaryLotNumber}.` : "",
      severity ? `Severity: ${severity}.` : "",
      productDisposition ? `Disposition: ${productDisposition}.` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const scarPayload: any = {
      title: scarTitle,
      scar_title: scarTitle,
      description: scarProblemDescription,
      issue_summary: record?.title || scarTitle,
      problem_description: scarProblemDescription,
      issue_description: scarProblemDescription,

      status: "open",
      scar_status: "open",

      source_type: "ncmr",
      created_from_module: "ncmr",
      created_by: userEmail || "unknown",
      initiated_by: userEmail || "unknown",
      initiated_at: new Date().toISOString(),

      linked_ncmr_id: id,
      source_ncmr_id: id,
      linked_ncmr_number: record?.ncmr_number || null,

      linked_supplier_id: record?.linked_supplier_id || record?.supplier_id || null,
      supplier_id: record?.linked_supplier_id || record?.supplier_id || null,
      supplier_name: record?.supplier_name || null,
      supplier_lot: record?.supplier_lot || null,

      root_cause: rootCause || null,
      corrective_action: correctiveAction || null,
      severity: severity || null,
      risk_level: evaluateScarGovernance().outcome,

      part_number: summaryProductPartNumber || record?.product_part_number || null,
      lot_number: summaryLotNumber || record?.lot_number || null,

      recurrence_flag: record?.recurring_issue === true,
    };

    const { data: scarData, error: scarError } = await supabase
      .from("scars")
      .insert(scarPayload)
      .select()
      .single();

    if (scarError) {
      alert(scarError.message);
      return;
    }

    const { error: ncmrUpdateError } = await supabase
      .from("ncmrs")
      .update({
        linked_scar_id: scarData.id,
        scar_required: true,
        scar_justification: null,
      })
      .eq("id", id);

    if (ncmrUpdateError) {
      alert(ncmrUpdateError.message);
      return;
    }

    await addAuditLog(
      "scar_created_from_ncmr",
      `SCAR created and linked from NCMR. SCAR title: ${scarTitle}.`
    );

    await supabase.from("audit_logs").insert({
      entity_type: "scar",
      entity_id: scarData.id,
      action: "scar_created_from_ncmr",
      details: `SCAR created from NCMR ${record?.ncmr_number || id}.`,
      user_email: userEmail || "unknown",
    });

    alert("Linked SCAR created.");
    fetchRecord();
  };

  const saveScarJustification = async () => {
    if (record?.mrb_approved_by || record?.is_locked) {
      alert("This section is read-only after MRB approval or final record lock. Use the authorized Return for Revision workflow when a change to the approved MRB package is required.");
      return;
    }

    if (record?.is_locked) {
      alert("This record is locked and cannot be edited.");
      return;
    }

    if (!scarJustification.trim()) {
      alert("SCAR justification is required.");
      return;
    }

    const { error } = await supabase
      .from("ncmrs")
      .update({
        scar_required: false,
        scar_justification: scarJustification,
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await addAuditLog(
      "scar_not_required_justification",
      `SCAR not opened. Justification: ${scarJustification}`
    );

    alert("SCAR justification saved.");
    fetchRecord();
  };

  const evaluateCapaGovernance = () => {
    const effectiveRisk = getNormalizedRiskValue(getEffectiveRiskLevel());
    const hasRecurrence =
      record?.recurring_issue === true ||
      String(record?.recurrence_reason || "").toLowerCase().includes("recurr");

    const enabledRules = capaGovernanceRules.filter(
      (rule: any) => rule?.is_enabled !== false
    );

    const riskRule = enabledRules.find(
      (rule: any) =>
        rule?.trigger_type === "risk_level" &&
        getNormalizedRiskValue(rule?.trigger_value) === effectiveRisk
    );

    const recurrenceRule = hasRecurrence
      ? enabledRules.find(
          (rule: any) =>
            rule?.trigger_type === "recurrence" &&
            rule?.trigger_value === "recurring_issue"
        )
      : null;

    const signals: string[] = [];

    if (effectiveRisk) {
      signals.push(`Final Effective Risk: ${formatRiskLabel(effectiveRisk)}.`);
    } else {
      signals.push("Final Effective Risk is not yet determined.");
    }

    signals.push(
      hasRecurrence ? "Recurring NCMR detected." : "No recurrence detected."
    );

    if (!capaGovernanceConfiguration?.id && !(record?.is_locked || record?.mrb_approved_by)) {
      return {
        outcome: "not_required",
        label: "CAPA Governance Configuration Unavailable",
        rationale:
          "The active CAPA Governance configuration could not be loaded. MRB submission is blocked until the controlled configuration is available.",
        signals,
      };
    }

    const candidateActions = [
      riskRule?.governance_action,
      recurrenceRule?.governance_action,
    ].filter(Boolean);

    const actionRank: Record<string, number> = {
      no_automatic_recommendation: 0,
      capa_recommended: 1,
      capa_required: 2,
    };

    const strongestAction = candidateActions.reduce(
      (strongest: string, action: string) =>
        (actionRank[action] ?? -1) > (actionRank[strongest] ?? -1)
          ? action
          : strongest,
      "no_automatic_recommendation"
    );

    if (strongestAction === "capa_required") {
      return {
        outcome: "required",
        label: "CAPA Required",
        rationale:
          "The active CAPA Governance configuration identifies CAPA as required based on Final Effective Risk and/or recurrence. A documented governance decision is required before MRB approval.",
        signals,
      };
    }

    if (strongestAction === "capa_recommended") {
      return {
        outcome: "recommended",
        label: "CAPA Recommended",
        rationale:
          "The active CAPA Governance configuration recommends CAPA based on Final Effective Risk and/or recurrence. If CAPA is not initiated, document the quality justification.",
        signals,
      };
    }

    return {
      outcome: "not_required",
      label: "No Automatic CAPA Recommendation",
      rationale:
        "The active CAPA Governance configuration does not automatically recommend CAPA for the current Final Effective Risk and recurrence status. CAPA may still be opened using documented quality judgment.",
      signals,
    };
  };

  const formatCapaEvaluationOutcome = (outcome: string | null | undefined) => {
    switch (outcome) {
      case "required":
        return "CAPA Required";
      case "recommended":
        return "CAPA Recommended";
      case "not_required":
        return "CAPA Not Required";
      case "capa_opened":
        return "CAPA Opened";
      case "not_opened_with_justification":
        return "CAPA Not Opened - Justification Documented";
      default:
        return outcome || evaluateCapaGovernance().label;
    }
  };

  const getCapaGovernanceSignal = () => {
    return evaluateCapaGovernance().signals.join(" ");
  };

  const saveCapaGovernanceEvaluation = async () => {
    if (record?.mrb_approved_by || record?.is_locked) {
      alert("This section is read-only after MRB approval or final record lock. Use the authorized Return for Revision workflow when a change to the approved MRB package is required.");
      return;
    }

    if (record?.is_locked) {
      alert("This record is locked and cannot be edited.");
      return;
    }

    const evaluation = evaluateCapaGovernance();

    const { error } = await supabase
      .from("ncmrs")
      .update({
        capa_required: evaluation.outcome === "required",
        capa_recommended:
          evaluation.outcome === "required" || evaluation.outcome === "recommended",
        capa_evaluation_outcome: evaluation.outcome,
        capa_evaluation_rationale: evaluation.rationale,
        capa_governance_version_id:
          capaGovernanceConfiguration?.id || record?.capa_governance_version_id || null,
        capa_governance_version_code:
          capaGovernanceConfiguration?.version_code || record?.capa_governance_version_code || null,
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await addAuditLog(
      "capa_governance_evaluated",
      `Governance Decision: ${evaluation.label}. Signal: ${evaluation.signals.join(" ")} Rationale: ${evaluation.rationale}`
    );

    alert("CAPA governance evaluation saved.");
    fetchRecord();
  };

  const createGovernedCapaFromNcmr = async () => {
    if (record?.mrb_approved_by || record?.is_locked) {
      alert("CAPA Governance is read-only after MRB approval or final record lock. Use Return for Revision when the approved governance decision must change.");
      return;
    }

    if (record?.is_locked) {
      alert("This record is locked and cannot be edited.");
      return;
    }

    if (record?.linked_capa_id || record?.capa_id || linkedCapa) {
      alert("This NCMR already has a linked CAPA.");
      return;
    }

    const evaluation = evaluateCapaGovernance();
    let governanceOverrideJustification = "";

    if (evaluation.outcome === "not_required") {
      const enteredJustification = window.prompt(
        "Governance Override\n\nThe governance engine determined that a CAPA is not required. Please provide the business or quality justification for opening a CAPA."
      );

      if (!enteredJustification || !enteredJustification.trim()) {
        alert("Governance override justification is required when opening a CAPA that is not recommended by the governance engine.");
        return;
      }

      governanceOverrideJustification = enteredJustification.trim();
    }

    const confirmed = window.confirm(
      governanceOverrideJustification
        ? "Create a linked CAPA from this NCMR with the documented governance override justification?"
        : "Create a linked CAPA from this NCMR? This will auto-populate the CAPA with the NCMR issue, risk, root cause, containment, and investigation information where available."
    );

    if (!confirmed) return;

    const capaTitle = `CAPA for ${record?.ncmr_number || "NCMR"}`;
    const capaProblemDescription = [
      `CAPA initiated from NCMR: ${record?.ncmr_number || id}.`,
      problemDescription || record?.issue_description || "",
      rootCause ? `Root Cause Summary: ${rootCause}` : "",
      containmentAction ? `Containment: ${containmentAction}` : "",
      investigationSummary ? `Investigation: ${investigationSummary}` : "",
      riskAssessment ? `Risk Assessment: ${riskAssessment}` : "",
      severity ? `Severity: ${severity}` : "",
      productDisposition ? `Disposition: ${productDisposition}` : "",
      governanceOverrideJustification
        ? `Governance Override Justification: ${governanceOverrideJustification}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    const { data: capaData, error: capaError } = await supabase
      .from("capas")
      .insert({
        title: capaTitle,
        status: "open",
        source_type: "ncmr",
        capa_source: governanceOverrideJustification
          ? "NCMR governance override"
          : "NCMR governance",
        ncmr_id: id,
        linked_ncmr_title: record?.ncmr_number || null,
        problem_description:
          problemDescription || record?.issue_description || capaProblemDescription,
        investigation_summary: investigationSummary || null,
        root_cause: rootCause || null,
        root_cause_category: rootCauseCategory || null,
        corrective_action_plan: correctiveAction || null,
        action_plan: correctiveAction || null,
        owner: summaryOwner || record?.owner || null,
        created_by: userEmail || "unknown",
        capa_type: "internal_capa",
      })
      .select()
      .single();

    if (capaError) {
      alert(capaError.message);
      return;
    }

    const evaluationRationale = governanceOverrideJustification
      ? `${evaluation.rationale}

Governance override justification for opening CAPA: ${governanceOverrideJustification}`
      : evaluation.rationale;

    const { error: ncmrUpdateError } = await supabase
      .from("ncmrs")
      .update({
        linked_capa_id: capaData.id,
        capa_id: capaData.id,
        capa_required: true,
        capa_evaluation_outcome: "capa_opened",
        capa_evaluation_rationale: evaluationRationale,
        capa_not_required_justification: null,
      })
      .eq("id", id);

    if (ncmrUpdateError) {
      alert(ncmrUpdateError.message);
      return;
    }

    await addAuditLog(
      "capa_created_from_ncmr",
      governanceOverrideJustification
        ? `CAPA created and linked from NCMR with governance override. CAPA title: ${capaTitle}. Override justification: ${governanceOverrideJustification}`
        : `CAPA created and linked from NCMR. CAPA title: ${capaTitle}.`
    );

    await supabase.from("audit_logs").insert({
      entity_type: "capa",
      entity_id: capaData.id,
      action: "capa_created_from_ncmr",
      details: governanceOverrideJustification
        ? `CAPA created from NCMR ${record?.ncmr_number || id} with governance override. Override justification: ${governanceOverrideJustification}`
        : `CAPA created from NCMR ${record?.ncmr_number || id}.`,
      user_email: userEmail || "unknown",
    });

    alert("Linked CAPA created.");
    fetchRecord();
  };

  const saveCapaNotRequiredJustification = async () => {
    if (record?.mrb_approved_by || record?.is_locked) {
      alert("This section is read-only after MRB approval or final record lock. Use the authorized Return for Revision workflow when a change to the approved MRB package is required.");
      return;
    }

    if (record?.is_locked) {
      alert("This record is locked and cannot be edited.");
      return;
    }

    if (!capaNotRequiredJustification.trim()) {
      alert("CAPA not-required justification is required.");
      return;
    }

    const evaluation = evaluateCapaGovernance();

    const { error } = await supabase
      .from("ncmrs")
      .update({
        capa_required: false,
        capa_evaluation_outcome: "not_opened_with_justification",
        capa_evaluation_rationale: evaluation.rationale,
        capa_not_required_justification: capaNotRequiredJustification,
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await addAuditLog(
      "capa_not_required_justification",
      `CAPA not opened. Risk-based justification: ${capaNotRequiredJustification}`
    );

    alert("CAPA risk-based justification saved.");
    fetchRecord();
  };

  const uploadInvestigationAttachment = async () => {
    if (isPreMrbSectionReadOnly()) {
      alert("Investigation / Root Cause Summary attachments are read-only after MRB approval, during a pending MRB approval package, or after final record lock.");
      return;
    }
    if (!investigationAttachmentFile) return alert("Choose an investigation attachment first.");
    setUploadingInvestigationAttachment(true);
    try {
      const safeName = investigationAttachmentFile.name.trim().replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/_+/g, "_");
      const storagePath = `ncmrs/${id}/investigation/${Date.now()}_${safeName}`;
      const upload = await supabase.storage.from("evidence").upload(storagePath, investigationAttachmentFile, { upsert: false, contentType: investigationAttachmentFile.type || undefined });
      if (upload.error) throw new Error(upload.error.message);
      const publicUrl = supabase.storage.from("evidence").getPublicUrl(storagePath).data.publicUrl;
      const currentAttachments = Array.isArray(record?.investigation_attachments) ? record.investigation_attachments : [];
      const attachment = { name: investigationAttachmentFile.name, url: publicUrl, storage_path: storagePath, uploaded_at: new Date().toISOString(), uploaded_by: userEmail || "unknown" };
      const { error } = await supabase.from("ncmrs").update({ investigation_attachments: [...currentAttachments, attachment] }).eq("id", id);
      if (error) throw new Error(error.message);
      await addAuditLog("investigation_attachment_added", `Optional Investigation / Root Cause Summary attachment added: ${investigationAttachmentFile.name}.`);
      setInvestigationAttachmentFile(null);
      alert("Investigation / Root Cause Summary attachment uploaded.");
      await fetchRecord();
    } catch (error: any) { alert(error?.message || "Unable to upload Investigation / Root Cause Summary attachment."); }
    finally { setUploadingInvestigationAttachment(false); }
  };

  const uploadEvidence = async () => {
    if (record?.is_locked) {
      alert("This record is locked after electronic signature and cannot be edited.");
      return;
    }

    if (!isMrbApproved()) {
      alertMrbApprovalRequired();
      return;
    }

    if (!selectedFile) {
      alert("Please choose a file first.");
      return;
    }

    setUploading(true);

    const fileExt = selectedFile.name.split(".").pop();
    const filePath = `ncmrs/${id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("evidence")
      .upload(filePath, selectedFile, { upsert: false });

    if (uploadError) {
      alert(uploadError.message);
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from("evidence").getPublicUrl(filePath);

    setEvidenceUrl(data.publicUrl);
    setUploading(false);
    alert("Evidence uploaded. Click Save Workflow to store it.");
  };

  const markContainmentComplete = async () => {
    if (record?.mrb_approved_by || record?.is_locked) {
      alert("This section is read-only after MRB approval or final record lock. Use the authorized Return for Revision workflow when a change to the approved MRB package is required.");
      return;
    }

    if (record?.is_locked) {
      alert("This record is locked after electronic signature and cannot be edited.");
      return;
    }

    if (!containmentAction.trim()) {
      alert("Containment action must be documented before marking containment complete.");
      return;
    }

    const confirmed = window.confirm(
      "Mark containment complete? This will record the current date/time and logged-in user for KPI tracking."
    );

    if (!confirmed) return;

    const now = new Date().toISOString();

    const { error } = await supabase
      .from("ncmrs")
      .update({
        containment_action: containmentAction,
        containment_completed_at: now,
        containment_completed_by: userEmail || "unknown",
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await addAuditLog(
      "containment_completed",
      `Containment marked complete by ${userEmail || "unknown"} at ${now}.`
    );

    alert("Containment marked complete.");
    fetchRecord();
  };

  const saveRiskAssessmentSection = async () => {
    if (record?.mrb_approved_by || record?.is_locked) {
      alert("This section is read-only after MRB approval or final record lock. Use the authorized Return for Revision workflow when a change to the approved MRB package is required.");
      return;
    }

    if (record?.is_locked) {
      alert("This record is locked after electronic signature and cannot be edited.");
      return;
    }

    const { error } = await supabase
      .from("ncmrs")
      .update({
        risk_assessment: riskAssessment,
        ...getRiskPersistencePayload(),
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await addAuditLog(
      "risk_assessment_saved",
      "Risk Determination, Overall/Residual Risk inputs when applicable, Final Effective Risk, configuration version, and any controlled override were saved from the Risk Assessment section."
    );

    alert("Risk assessment saved.");
    fetchRecord();
  };

  const saveMrbDispositionSection = async () => {
    if (record?.mrb_approved_by || record?.is_locked) {
      alert("This section is read-only after MRB approval or final record lock. Use the authorized Return for Revision workflow when a change to the approved MRB package is required.");
      return;
    }

    if (record?.is_locked) {
      alert("This record is locked after electronic signature and cannot be edited.");
      return;
    }

    const { error } = await supabase
      .from("ncmrs")
      .update({
        product_disposition: productDisposition,
        disposition: productDisposition,
        disposition_justification: dispositionJustification,
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await addAuditLog(
      "mrb_disposition_saved",
      "Overall product disposition and disposition justification were saved from the MRB disposition section."
    );

    alert("MRB disposition saved.");
    fetchRecord();
  };

  const saveWorkflow = async () => {
    if (record?.is_locked) {
      alert("This record is locked after electronic signature and cannot be edited.");
      return;
    }

    const capaRecommendation = getCapaRecommendation();

    const payload: any = record?.mrb_approved_by
      ? { review_status: reviewStatus, evidence_url: evidenceUrl, evidence_notes: evidenceNotes }
      : {
          investigator, problem_description: problemDescription, containment_action: containmentAction,
          investigation_summary: investigationSummary, root_cause: rootCause, root_cause_category: rootCauseCategory,
          correction_action_proposal: correctionActionProposal, corrective_action: correctiveAction, risk_assessment: riskAssessment, severity,
          occurrence_rating: occurrenceRating || null,
          detection_rating: detectionRating || null,
          risk_assessment_method: riskAssessmentMethod,
          risk_level: riskAssessmentMethod === "manual" ? riskLevel || null : calculateNcmrRiskLevel(severity, occurrenceRating, detectionRating) || null,
          risk_override_enabled: riskAssessmentMethod === "automatic" ? riskOverrideEnabled : false,
          risk_override_level: riskAssessmentMethod === "automatic" && riskOverrideEnabled ? riskOverrideLevel || null : null,
          risk_override_justification: riskAssessmentMethod === "automatic" && riskOverrideEnabled ? riskOverrideJustification || null : null,
          capa_recommended: capaRecommendation.recommended,
          capa_governance_version_id:
            capaGovernanceConfiguration?.id || record?.capa_governance_version_id || null,
          capa_governance_version_code:
            capaGovernanceConfiguration?.version_code || record?.capa_governance_version_code || null,
          capa_decision: capaRecommendation.recommended ? capaDecision || null : null,
          capa_decision_justification: capaRecommendation.recommended && capaDecision === "no" ? capaDecisionJustification : null,
          capa_justification: capaRecommendation.recommended && capaDecision === "no" ? capaDecisionJustification : capaJustification,
          product_disposition: productDisposition, disposition: productDisposition, disposition_justification: dispositionJustification,
          correction_implementation: correctionImplementation, review_status: reviewStatus, evidence_url: evidenceUrl, evidence_notes: evidenceNotes,
        };

    if (!record?.mrb_approved_by && !record?.investigation_opened_at) payload.investigation_opened_at = new Date().toISOString();

    const { error } = await supabase.from("ncmrs").update(payload).eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await addAuditLog("workflow_saved", "NCMR workflow fields saved.");

    if (
      capaRecommendation.recommended &&
      capaDecision === "yes" &&
      !record?.capa_id
    ) {
      const { data: capaData, error: capaError } = await supabase
        .from("capas")
        .insert({
          title: `CAPA for ${record?.ncmr_number || "NCMR"}`,
          status: "open",
          source_type: "ncmr",
          capa_source: "NCMR risk-based CAPA escalation decision",
          ncmr_id: id,
          linked_ncmr_title: record?.ncmr_number || null,
          problem_description:
            problemDescription || record.issue_description || record?.ncmr_number,
          investigation_summary: investigationSummary,
          root_cause: rootCause,
          root_cause_category: rootCauseCategory,
          corrective_action_plan: correctiveAction,
          action_plan: correctiveAction,
        })
        .select()
        .single();

      if (capaError) {
        alert(capaError.message);
        return;
      }

      const { error: ncmrUpdateError } = await supabase
        .from("ncmrs")
        .update({
          capa_id: capaData.id,
          capa_required: true,
          capa_recommended: true,
          capa_decision: "yes",
          capa_decision_justification: null,
          capa_justification: null,
        })
        .eq("id", id);

      if (ncmrUpdateError) {
        alert(ncmrUpdateError.message);
        return;
      }

      await addAuditLog(
        "risk_based_capa_created",
        "CAPA automatically created because CAPA recommendation was accepted."
      );

      alert("NCMR saved. CAPA created and linked based on risk-based CAPA decision.");
      fetchRecord();
      return;
    }

    if (
      capaRecommendation.recommended &&
      capaDecision === "no" &&
      !record?.capa_id
    ) {
      await supabase
        .from("ncmrs")
        .update({
          capa_required: false,
          capa_recommended: true,
          capa_decision: "no",
          capa_decision_justification: capaDecisionJustification,
          capa_justification: capaDecisionJustification,
        })
        .eq("id", id);

      await addAuditLog(
        "risk_based_no_capa_decision",
        `CAPA recommendation rejected with justification: ${capaDecisionJustification}`
      );
    }

    if (getEffectiveRiskLevel() === "critical" && record?.capa_id) {
      await supabase
        .from("ncmrs")
        .update({
          capa_required: evaluateCapaGovernance().outcome === "required",
        })
        .eq("id", id);
    }

    alert("NCMR workflow saved");
    fetchRecord();
  };

  const approveMrb = async () => {
    if (record?.is_locked) {
      alert("This record is locked after electronic signature and cannot be edited.");
      return;
    }

    const validationPassed = validateWorkflowForMrbApproval();

    if (!validationPassed) {
      alert("Workflow validation failed. Resolve all validation errors before MRB approval.");
      return;
    }

    const isApprover = userRole === "approver" || userRole === "vp_quality";
    const isVpQuality = userRole === "vp_quality";

    if (!isApprover) {
      alert("Only an approver or VP Quality can approve MRB disposition.");
      return;
    }

    if (!mrbSignatureEmail) {
      alert("Please re-enter your email before signing MRB approval.");
      return;
    }

    if (mrbSignatureEmail.trim().toLowerCase() !== userEmail.trim().toLowerCase()) {
      alert("Electronic signature email does not match the logged-in user.");
      return;
    }

    const directMrbRiskErrors = getRiskAssessmentValidationErrors();
    if (directMrbRiskErrors.length > 0) {
      return alert(`Risk assessment is incomplete:\n\n${directMrbRiskErrors.join("\n")}`);
    }

    const mrbCapaRecommendation = getCapaRecommendation();

    if (
      mrbCapaRecommendation.recommended &&
      !record?.capa_id &&
      !isNoCapaDecisionAccepted()
    ) {
      return alert("CAPA recommendation requires either a linked CAPA or a documented No-CAPA justification in CAPA Governance before MRB approval.");
    }

    if (!productDisposition) return alert("Product disposition is required before MRB approval.");
    if (!dispositionJustification) return alert("Disposition justification is required before MRB approval.");

    if (
      ["critical", "high"].includes(getEffectiveRiskLevel()) &&
      productDisposition === "use_as_is" &&
      !isVpQuality
    ) {
      alert("MRB rule: Use As Is disposition for High or Critical Final Effective Risk requires VP Quality approval.");
      return;
    }

    if (
      getEffectiveRiskLevel() === "high" &&
      productDisposition === "use_as_is" &&
      dispositionJustification.trim().length < 50
    ) {
      alert("MRB rule: High Final Effective Risk with Use As Is requires a stronger disposition justification.");
      return;
    }

    if (
      severity === "critical" &&
      productDisposition === "use_as_is" &&
      dispositionJustification.trim().length < 75
    ) {
      alert("MRB rule: Critical severity with Use As Is requires a detailed VP Quality justification.");
      return;
    }

    if (affectedItems.length > 0) {
      const itemsMissingDisposition = affectedItems.filter(
        (item) =>
          !item.product_disposition ||
          !item.disposition_justification ||
          item.quantity_accepted === null ||
          item.quantity_accepted === undefined ||
          item.quantity_rejected === null ||
          item.quantity_rejected === undefined
      );

      if (itemsMissingDisposition.length > 0) {
        alert("All affected items must have a disposition, justification, quantity accepted, and quantity rejected before overall MRB approval.");
        return;
      }

      const quantityErrors = affectedItems.flatMap((item, index) =>
        buildQuantityReconciliationErrors(item, `Affected Item ${index + 1}`)
      );

      if (quantityErrors.length > 0) {
        alert(`Quantity reconciliation failed before MRB approval:\n\n${quantityErrors.join("\n")}`);
        return;
      }

    }

    const confirmed = window.confirm(
      "Electronic Signature - MRB Approval:\n\nBy selecting OK, I certify that I am the logged-in user, I have reviewed the nonconformance record, investigation, Severity / Occurrence / Detection risk assessment, effective risk level, CAPA decision, product disposition, MRB approval tasks, and I approve the MRB decision.\n\nThis action will be recorded with signer identity, timestamp, and signature meaning."
    );

    if (!confirmed) return;

    const now = new Date().toISOString();

    const meaning =
      "MRB Approval: I certify that I am the logged-in user, I have reviewed the nonconformance record, investigation, Severity / Occurrence / Detection risk assessment, effective risk level, CAPA decision, product disposition, MRB approval tasks, and I approve the MRB decision.";

    const { error } = await supabase
      .from("ncmrs")
      .update({
        risk_assessment: riskAssessment,
        ...getRiskPersistencePayload(),
        capa_justification: capaJustification,
        product_disposition: productDisposition,
        disposition: productDisposition,
        disposition_justification: dispositionJustification,
        mrb_approved_by: userEmail,
        mrb_approved_at: now,
        mrb_signature_meaning: meaning,
        mrb_signature_email_entered: mrbSignatureEmail,
        mrb_additional_approvers: additionalMrbApprovers,
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    const approverEmails = additionalMrbApprovers
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter((email) => email && email !== userEmail.toLowerCase());

    if (approverEmails.length > 0) {
      const approverRows = approverEmails.map((email) => ({
        ncmr_id: id,
        approver_email: email,
        approver_role: "additional_mrb_approver",
        approval_status: "pending",
        signature_meaning: "Additional MRB approval requested.",
      }));

      const { error: approverError } = await supabase
        .from("ncmr_mrb_reviewers")
        .insert(approverRows);

      if (approverError) {
        alert(approverError.message);
        return;
      }
    }

    await addAuditLog(
      "mrb_approved",
      `MRB approved after enhanced e-signature. Severity: ${severity}. Disposition: ${productDisposition}. Approved by role: ${userRole}. Meaning: ${meaning}`
    );

    alert("MRB approved with electronic signature");
    fetchRecord();
  };

  const isElevatedNcmrAuthority = () => {
    const role = String(userRole || "").trim().toLowerCase();
    return ["administrator", "admin", "ncmr administrator", "vp quality", "vp_quality"].includes(role);
  };

  const isCurrentNcmrOwner = () =>
    normalizeApproverEmail(record?.owner || record?.owner_email) ===
    normalizeApproverEmail(userEmail);

  const getDisplayedNcmrModuleVersion = () => {
    const versionCode = String(record?.workflow_version_code || "").trim();
    if (!versionCode || versionCode.toUpperCase() === "NCMR-LEGACY") return "NCMR-1.0";
    return versionCode;
  };

  const cancelNcmr = async () => {
    if (!record || ["closed", "cancelled"].includes(String(record?.status || "").toLowerCase())) {
      alert("This NCMR is already closed or cancelled.");
      return;
    }
    if (!isCurrentNcmrOwner() && !isElevatedNcmrAuthority()) {
      alert("Only the current NCMR owner, Administrator, or VP Quality can cancel this NCMR.");
      return;
    }
    const justification = window.prompt("Cancellation justification is required:");
    if (!justification?.trim()) {
      alert("NCMR cancellation requires a justification.");
      return;
    }
    if (!window.confirm("Cancel this NCMR? Pending tasks will be cancelled. Completed work and approval history will be preserved.")) return;

    const { error: taskError } = await supabase
      .from("approval_tasks")
      .update({ status: "cancelled", comments: `Parent NCMR cancelled. Justification: ${justification.trim()}` })
      .eq("entity_type", "ncmr").eq("entity_id", id).eq("status", "pending");
    if (taskError) return alert(taskError.message);

    const { error } = await supabase.from("ncmrs").update({
      status: "cancelled",
      review_status: "cancelled",
      is_locked: true,
      closure_comments: `NCMR CANCELLED. Justification: ${justification.trim()}`,
    }).eq("id", id);
    if (error) return alert(error.message);

    await addAuditLog("ncmr_cancelled", `NCMR cancelled by ${userEmail}. Justification: ${justification.trim()}`);
    alert("NCMR cancelled.");
    await fetchRecord();
  };

  const openReturnAfterMrbApproval = () => {
    if (!record?.mrb_approved_by || !record?.mrb_approved_at) {
      alert("Return for Revision is available only after MRB approval.");
      return;
    }
    if (!isElevatedNcmrAuthority()) {
      alert("Only an NCMR Administrator or VP Quality can return an approved MRB for revision.");
      return;
    }
    if (["closed", "cancelled"].includes(String(record?.status || "").toLowerCase())) {
      alert("Closed or cancelled NCMRs cannot be returned for revision.");
      return;
    }

    setReturnRevisionDestination("correction");
    setReturnRevisionJustification("");
    setReturnRevisionOpen(true);
  };

  const returnAfterMrbApproval = async () => {
    const destination = returnRevisionDestination.trim().toLowerCase();
    const justification = returnRevisionJustification.trim();

    if (!destination) return alert("Select a Return To destination.");
    if (!justification) return alert("Return for Revision requires a justification.");

    setReturnRevisionSubmitting(true);
    try {
      const activeTasks = getActiveMrbApprovalTasks();
      const pendingTaskIds = activeTasks
        .filter((task: any) => String(task?.status || "").toLowerCase() === "pending")
        .map((task: any) => task.id)
        .filter(Boolean);

      if (pendingTaskIds.length > 0) {
        const { error: taskError } = await supabase
          .from("approval_tasks")
          .update({
            status: "cancelled",
            comments: `Approved MRB returned for revision. Destination: ${returnRevisionDestination}. Justification: ${justification}`,
          })
          .in("id", pendingTaskIds);
        if (taskError) throw new Error(taskError.message);
      }

      const { error } = await supabase.from("ncmrs").update({
        mrb_approved_by: null,
        mrb_approved_at: null,
        mrb_signature_email_entered: null,
        mrb_signature_meaning: null,
        review_status: "draft",
        is_locked: false,
      }).eq("id", id);
      if (error) throw new Error(error.message);

      const { error: supersedeDispositionImplementationError } = await supabase
        .from("ncmr_affected_items")
        .update({ disposition_implementation_status: "superseded" })
        .eq("ncmr_id", id)
        .eq("disposition_implementation_status", "completed");
      if (supersedeDispositionImplementationError) throw new Error(supersedeDispositionImplementationError.message);

      // This audit event is the hard approval-cycle boundary used by
      // getActiveMrbApprovalTasks(). Prior approved tasks remain historical
      // and can never auto-approve the newly returned workflow.
      await addAuditLog(
        "mrb_approval_cycle_returned",
        `Approved MRB returned by ${userEmail}. Destination: ${returnRevisionDestination}. Justification: ${justification}. Prior approval history preserved. A new MRB approval cycle is required.`
      );

      setReturnRevisionOpen(false);
      await fetchRecord();
      window.setTimeout(() => {
        const targetId: Record<string, string> = {
          "investigation / root cause summary": "ncmr-section-investigation",
          "correction": "ncmr-section-correction",
          "corrective action": "ncmr-section-corrective-action",
          "risk assessment": "ncmr-section-risk-assessment",
          "product disposition": "ncmr-section-product-disposition",
          "mrb preparation": "ncmr-section-mrb-approval",
        };
        document.getElementById(targetId[destination])?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
      alert(`MRB returned for revision to ${returnRevisionDestination}. Complete the revision and submit a new MRB approval package when ready.`);
    } catch (error: any) {
      alert(error?.message || "Unable to return the MRB for revision.");
    } finally {
      setReturnRevisionSubmitting(false);
    }
  };

  const getActiveImplementationTasks = () =>
    correctionTasks.filter(
      (task: any) =>
        String(task?.status || "").trim().toLowerCase() !== "cancelled"
    );

  const areAllActiveImplementationTasksVerified = () => {
    const activeTasks = getActiveImplementationTasks();

    return (
      activeTasks.length > 0 &&
      activeTasks.every(
        (task: any) =>
          String(task?.status || "").trim().toLowerCase() === "completed" &&
          String(task?.implementation_verification_status || "")
            .trim()
            .toLowerCase() === "verified" &&
          !!task?.implementation_verified_by &&
          !!task?.implementation_verified_at
      )
    );
  };

  const hasActiveOrCompletedReworkTask = () =>
    reworkTasks.some((task: any) =>
      ["pending", "returned", "completed"].includes(
        String(task?.status || "").trim().toLowerCase()
      )
    );

  const getReturnedReworkTask = () =>
    reworkTasks.find((task: any) => String(task?.status || "").trim().toLowerCase() === "returned") || null;

  const clearReworkTaskAssignmentDraft = () => {
    setReworkTaskAssignee("");
    setReworkTaskDueDate("");
    setReworkTaskInstructions("");
    setReworkTaskAssignmentFiles([]);
    setEditingReturnedReworkTaskId("");
  };

  const prepareReturnedReworkTaskForRevision = (task: any, clearAssignee = false) => {
    if (!task || String(task?.status || "").toLowerCase() !== "returned") {
      alert("Only a returned Rework task can be revised and resubmitted.");
      return;
    }
    setEditingReturnedReworkTaskId(task.id);
    setReworkTaskAssignee(clearAssignee ? "" : normalizeApproverEmail(task.assigned_to_email));
    setReworkTaskDueDate(task.due_date || "");
    setReworkTaskInstructions(task.task_instructions || task.comments || "");
    setReworkTaskAssignmentFiles([]);
    window.setTimeout(() => document.getElementById("rework-task-assignment-editor")?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  };

  const uploadReworkAssignmentAttachments = async (existingAttachments: any[] = []) => {
    if (reworkTaskAssignmentFiles.length === 0) return Array.isArray(existingAttachments) ? existingAttachments : [];
    const uploaded: any[] = [];
    for (let index = 0; index < reworkTaskAssignmentFiles.length; index += 1) {
      const file = reworkTaskAssignmentFiles[index];
      const safeName = file.name.trim().replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/_+/g, "_");
      const storagePath = `ncmrs/${id}/rework-assignment/${Date.now()}_${index + 1}_${safeName}`;
      const upload = await supabase.storage.from("evidence").upload(storagePath, file, { upsert: false, contentType: file.type || undefined });
      if (upload.error) throw new Error(`Unable to upload Rework assignment attachment ${file.name}: ${upload.error.message}`);
      const publicUrl = supabase.storage.from("evidence").getPublicUrl(storagePath).data.publicUrl;
      uploaded.push({ name: file.name, url: publicUrl, storage_path: storagePath, uploaded_at: new Date().toISOString(), uploaded_by: userEmail || "unknown" });
    }
    return [...(Array.isArray(existingAttachments) ? existingAttachments : []), ...uploaded];
  };

  const submitImplementationTask = async () => {
    if (record?.is_locked) {
      alert("This record is locked after electronic signature and cannot be edited.");
      return;
    }

    if (!isMrbApproved()) {
      alertMrbApprovalRequired();
      return;
    }

    if (!correctionTaskAssignee) {
      alert("Implementation task assignee email is required.");
      return;
    }

    if (!correctionTaskInstructions) {
      alert("Implementation task instructions are required.");
      return;
    }

    const taskType =
      implementationTaskType === "corrective_action"
        ? "corrective_action_task"
        : "correction_task";

    const implementationLabel =
      implementationTaskType === "corrective_action"
        ? "Corrective Action"
        : "Correction";

    const requiredFunction =
      implementationTaskType === "corrective_action"
        ? "Corrective Action Owner"
        : "Correction Owner";

    if (submittingImplementationTask) return;

    const normalizedAssignee = correctionTaskAssignee.trim().toLowerCase();
    const normalizedInstructions = correctionTaskInstructions.trim();
    const normalizedDueDate = correctionTaskDueDate || null;

    const { data: pendingImplementationTasks, error: pendingImplementationError } =
      await supabase
        .from("approval_tasks")
        .select("id, task_type, assigned_to_email, due_date, task_instructions, comments")
        .eq("entity_type", "ncmr")
        .eq("entity_id", id)
        .in("task_type", ["correction_task", "corrective_action_task"])
        .eq("status", "pending");

    if (pendingImplementationError) {
      alert(pendingImplementationError.message);
      return;
    }

    const exactDuplicate = (pendingImplementationTasks || []).some((task: any) => {
      const taskInstructions = String(task?.task_instructions || task?.comments || "").trim();
      const taskDueDate = task?.due_date || null;

      return (
        String(task?.task_type || "") === taskType &&
        normalizeApproverEmail(task?.assigned_to_email) === normalizedAssignee &&
        taskDueDate === normalizedDueDate &&
        taskInstructions === normalizedInstructions
      );
    });

    if (exactDuplicate) {
      alert(
        "An identical pending implementation task already exists for this assignee, due date, type, and instruction. A duplicate task was not submitted."
      );
      return;
    }

    setSubmittingImplementationTask(true);

    const { data: insertedTasks, error } = await supabase
      .from("approval_tasks")
      .insert({
        entity_type: "ncmr",
        entity_id: id,
        task_type: taskType,
        required_function: requiredFunction,
        task_title: `${implementationLabel} implementation for ${record?.ncmr_number || "NCMR"}`,
        task_instructions: normalizedInstructions,
        assigned_to_email: normalizedAssignee,
        assigned_by_email: userEmail,
        status: "pending",
        due_date: normalizedDueDate,
        comments: normalizedInstructions,
      })
      .select();

    if (error) {
      setSubmittingImplementationTask(false);
      alert(error.message);
      return;
    }

    if (insertedTasks && insertedTasks.length > 0) {
      const task = insertedTasks[0];
      const workPackageUrl = `/ncmrs/${id}/implementation?taskId=${task.id}`;

      await supabase.from("notification_queue").insert({
        recipient_email: correctionTaskAssignee.trim().toLowerCase(),
        subject: `${implementationLabel} implementation task assigned: ${record?.ncmr_number || "NCMR"}`,
        body: `You have been assigned a ${implementationLabel.toLowerCase()} implementation task for ${record?.ncmr_number || "this NCMR"}. Please log in to QualiSphere and open My Workspace.`,
        entity_type: "ncmr",
        entity_id: id,
        task_id: task.id,
        status: "pending",
      });

      await createInAppNotification({
        recipientEmail: correctionTaskAssignee,
        notificationType: "ncmr_implementation_assignment",
        title: `${implementationLabel} implementation assigned: ${record?.ncmr_number || "NCMR"}`,
        message: `A ${implementationLabel.toLowerCase()} implementation task for ${record?.ncmr_number || "this NCMR"} is waiting in My Workspace.`,
        severityLevel:
          severity === "critical"
            ? "critical"
            : severity === "high"
              ? "high"
              : "info",
        assignedRole: requiredFunction,
        relatedUrl: workPackageUrl,
      });
    }

    await addAuditLog(
      `${taskType}_submitted`,
      `${implementationLabel} implementation task submitted to ${correctionTaskAssignee}.`
    );

    alert(`${implementationLabel} implementation task submitted.`);
    setImplementationTaskType("correction");
    setCorrectionTaskAssignee("");
    setCorrectionTaskDueDate("");
    setCorrectionTaskInstructions("");
    setShowAdditionalImplementationTaskForm(false);
    setSubmittingImplementationTask(false);
    await fetchCorrectionTasks();
  };

  const submitReworkTask = async () => {
    if (submittingReworkTask) return;
    if (record?.is_locked) return alert("This record is locked after electronic signature and cannot be edited.");
    if (!isMrbApproved()) return alertMrbApprovalRequired();

    const normalizedAssignee = normalizeApproverEmail(reworkTaskAssignee);
    if (!normalizedAssignee) return alert("Rework task assignee email is required.");
    if (!reworkTaskInstructions.trim()) return alert("Rework task instructions are required.");

    const assigneeValidation = await validateApproverEmails([normalizedAssignee]);
    if (!assigneeValidation.valid) return alert(assigneeValidation.message);

    const editingReturnedTask = editingReturnedReworkTaskId
      ? reworkTasks.find((task: any) => task.id === editingReturnedReworkTaskId && String(task?.status || "").trim().toLowerCase() === "returned")
      : null;

    if (editingReturnedReworkTaskId && !editingReturnedTask) {
      alert("The returned Rework task is no longer available for revision. Reload the NCMR and try again.");
      clearReworkTaskAssignmentDraft();
      return;
    }

    if (!editingReturnedTask && hasActiveOrCompletedReworkTask()) {
      return alert("A pending, returned, or completed Rework task already exists. Resolve the existing task before creating another Rework task.");
    }

    setSubmittingReworkTask(true);
    try {
      const assignmentAttachments = await uploadReworkAssignmentAttachments(editingReturnedTask?.assignment_attachments || []);
      let task: any = null;

      if (editingReturnedTask) {
        const priorAssignee = normalizeApproverEmail(editingReturnedTask.assigned_to_email);
        const { data: updatedTask, error: updateError } = await supabase.from("approval_tasks").update({
          task_instructions: reworkTaskInstructions.trim(),
          assigned_to_email: normalizedAssignee,
          assigned_by_email: userEmail,
          due_date: reworkTaskDueDate || null,
          comments: reworkTaskInstructions.trim(),
          assignment_attachments: assignmentAttachments,
          status: "pending",
          returned_reason: null,
          returned_by: null,
          returned_at: null,
          implementation_verification_status: "pending",
          implementation_verification_comment: null,
          implementation_verified_by: null,
          implementation_verified_at: null,
        }).eq("id", editingReturnedTask.id).eq("entity_type", "ncmr").eq("entity_id", id).eq("task_type", "rework_task").eq("status", "returned").select("*").maybeSingle();
        if (updateError) throw new Error(updateError.message);
        if (!updatedTask) throw new Error("The returned Rework task could not be revised and resubmitted. Reload the page and try again.");
        task = updatedTask;
        await addAuditLog("rework_task_revised_resubmitted", `Returned Rework task revised and resubmitted by ${userEmail}. Prior assignee: ${priorAssignee || "N/A"}. New assignee: ${normalizedAssignee}.`);
      } else {
        const { data: insertedTask, error: insertError } = await supabase.from("approval_tasks").insert({
          entity_type: "ncmr", entity_id: id, task_type: "rework_task", required_function: "Rework Owner",
          task_title: `Rework task for ${record?.ncmr_number || "NCMR"}`, task_instructions: reworkTaskInstructions.trim(),
          assigned_to_email: normalizedAssignee, assigned_by_email: userEmail, status: "pending", due_date: reworkTaskDueDate || null,
          comments: reworkTaskInstructions.trim(), assignment_attachments: assignmentAttachments,
        }).select("*").single();
        if (insertError) throw new Error(insertError.message);
        task = insertedTask;
        await addAuditLog("rework_task_submitted", `Rework task submitted to ${normalizedAssignee}.`);
      }

      const reworkPackageUrl = `/ncmrs/${id}/rework?taskId=${task.id}`;
      await supabase.from("notification_queue").insert({
        recipient_email: normalizedAssignee,
        subject: editingReturnedTask ? `Rework task revised and resubmitted: ${record?.ncmr_number || "NCMR"}` : `Rework task assigned: ${record?.ncmr_number || "NCMR"}`,
        body: editingReturnedTask ? `A returned Rework task for ${record?.ncmr_number || "this NCMR"} was revised and resubmitted to you. Please log in to QualiSphere and open My Workspace.` : `You have been assigned a Rework task for ${record?.ncmr_number || "this NCMR"}. Please log in to QualiSphere and open My Workspace.`,
        entity_type: "ncmr", entity_id: id, task_id: task.id, status: "pending",
      });
      await createInAppNotification({
        recipientEmail: normalizedAssignee,
        notificationType: editingReturnedTask ? "ncmr_rework_resubmitted" : "ncmr_rework_assignment",
        title: editingReturnedTask ? `Rework task revised and resubmitted: ${record?.ncmr_number || "NCMR"}` : `Rework task assigned: ${record?.ncmr_number || "NCMR"}`,
        message: editingReturnedTask ? `A returned Rework task for ${record?.ncmr_number || "this NCMR"} was revised and resubmitted and is waiting in My Workspace.` : `A Rework task for ${record?.ncmr_number || "this NCMR"} is waiting in My Workspace.`,
        severityLevel: severity === "critical" ? "critical" : severity === "high" ? "high" : "info",
        assignedRole: "Rework Owner", relatedUrl: reworkPackageUrl,
      });
      alert(editingReturnedTask ? "Returned Rework task revised and resubmitted." : "Rework task submitted.");
      clearReworkTaskAssignmentDraft();
      await fetchReworkTasks();
    } catch (error: any) {
      alert(error?.message || "Unable to submit Rework task.");
    } finally {
      setSubmittingReworkTask(false);
    }
  };

  const hasReworkDisposition = () => {
    return (
      productDisposition === "rework" ||
      affectedItems.some((item) => item.product_disposition === "rework")
    );
  };

  const getCompletedReworkTask = () => {
    return reworkTasks.find((task) => task.status === "completed") || null;
  };

  const hasCompletedReworkTask = () => {
    return !!getCompletedReworkTask();
  };

  const getReworkAffectedItems = () => {
    return affectedItems.filter((item) => isReworkDisposition(item.product_disposition));
  };

  const isCorrectionNotRequired = () => {
    return correctionActionProposal === "no_correction_required";
  };

  const isCorrectionTaskRequired = () => {
    return !!correctionActionProposal && correctionActionProposal !== "no_correction_required";
  };

  const requiredExecutionTasksComplete = () => {
    const errors: string[] = [];

    if (isCorrectionTaskRequired()) {
      const activeImplementationTasks = getActiveImplementationTasks();

      if (activeImplementationTasks.length === 0) {
        errors.push(
          "At least one active Correction / Corrective Action implementation task is required before closure."
        );
      } else {
        const incompleteImplementationTasks = activeImplementationTasks.filter(
          (task: any) =>
            String(task?.status || "").trim().toLowerCase() !== "completed"
        );

        const unverifiedImplementationTasks = activeImplementationTasks.filter(
          (task: any) =>
            String(task?.status || "").trim().toLowerCase() === "completed" &&
            String(task?.implementation_verification_status || "")
              .trim()
              .toLowerCase() !== "verified"
        );

        if (incompleteImplementationTasks.length > 0) {
          errors.push(
            `All active Correction / Corrective Action implementation tasks must be completed before closure. ${incompleteImplementationTasks.length} task(s) remain incomplete.`
          );
        }

        if (unverifiedImplementationTasks.length > 0) {
          errors.push(
            `Every completed Correction / Corrective Action implementation task must be independently verified by the NCMR owner before closure. ${unverifiedImplementationTasks.length} task(s) remain unverified.`
          );
        }
      }
    }

    if (hasReworkDisposition()) {
      const activeReworkTasks = reworkTasks.filter(
        (task: any) =>
          String(task?.status || "").trim().toLowerCase() !== "cancelled"
      );

      if (activeReworkTasks.length === 0) {
        errors.push("At least one active rework task is required before closure when rework is applicable.");
      } else {
        const incompleteReworkTasks = activeReworkTasks.filter(
          (task: any) => String(task?.status || "").trim().toLowerCase() !== "completed"
        );
        const unverifiedReworkTasks = activeReworkTasks.filter(
          (task: any) =>
            String(task?.status || "").trim().toLowerCase() === "completed" &&
            String(task?.implementation_verification_status || "").trim().toLowerCase() !== "verified"
        );
        if (incompleteReworkTasks.length > 0) {
          errors.push(`All active rework tasks must be completed before closure when rework is applicable. ${incompleteReworkTasks.length} task(s) remain incomplete.`);
        }
        if (unverifiedReworkTasks.length > 0) {
          errors.push(`Every completed Rework task must be independently verified by the NCMR owner before closure. ${unverifiedReworkTasks.length} task(s) remain unverified.`);
        }
      }
    }

    return errors;
  };

  const saveDispositionImplementation = async (
    itemId: string,
    implementationNotes: string,
    quantityDiscrepancy: boolean,
    discrepancyQuantity: string,
    discrepancyType: string,
    discrepancyRationale: string,
    finalQuantityAccepted: string,
    finalQuantityRejected: string
  ) => {
    if (record?.is_locked) {
      alert("This record is locked after electronic signature and cannot be edited.");
      return;
    }

    if (!isMrbApproved()) {
      alertMrbApprovalRequired();
      return;
    }

    const item = affectedItems.find((affectedItem: any) => affectedItem.id === itemId);
    if (!item) {
      alert("Affected item not found.");
      return;
    }

    if (!requiresDispositionImplementation(item)) {
      alert("This disposition does not use the non-Rework Disposition Implementation pathway.");
      return;
    }

    if (!implementationNotes.trim()) {
      alert("Disposition implementation notes are required.");
      return;
    }

    const disposition = normalizeDispositionValue(item.product_disposition);
    const affectedQty = toQuantityNumber(item.quantity_affected);
    const mrbAcceptedQty = toQuantityNumber(item.quantity_accepted);
    const mrbRejectedQty = toQuantityNumber(item.quantity_rejected);
    const allowsDiscrepancy =
      disposition === "use_as_is" ||
      disposition === "accept_per_specification";

    let finalAcceptedQty = mrbAcceptedQty;
    let finalRejectedQty = mrbRejectedQty;
    let savedDiscrepancy = false;
    let savedDiscrepancyQty: number | null = null;
    let savedDiscrepancyType: string | null = null;
    let savedDiscrepancyRationale: string | null = null;

    if (allowsDiscrepancy && quantityDiscrepancy) {
      if (finalQuantityAccepted === "" || finalQuantityRejected === "") {
        alert("Final Quantity Accepted and Final Quantity Rejected are required when a quantity discrepancy is identified.");
        return;
      }

      finalAcceptedQty = toQuantityNumber(finalQuantityAccepted);
      finalRejectedQty = toQuantityNumber(finalQuantityRejected);
      savedDiscrepancy = true;
      savedDiscrepancyQty = toQuantityNumber(discrepancyQuantity);
      savedDiscrepancyType = discrepancyType || null;
      savedDiscrepancyRationale = discrepancyRationale.trim() || null;

      if (savedDiscrepancyQty <= 0) {
        alert("Discrepancy Quantity must be greater than zero.");
        return;
      }

      if (!["accepted_quantity", "rejected_quantity"].includes(savedDiscrepancyType || "")) {
        alert("Select whether the discrepancy is in Accepted Quantity or Rejected Quantity.");
        return;
      }

      if (!savedDiscrepancyRationale) {
        alert("Discrepancy Rationale is required.");
        return;
      }

      const selectedDifference =
        savedDiscrepancyType === "accepted_quantity"
          ? Math.abs(finalAcceptedQty - mrbAcceptedQty)
          : Math.abs(finalRejectedQty - mrbRejectedQty);

      if (selectedDifference !== savedDiscrepancyQty) {
        alert(
          `Discrepancy validation failed. Declared discrepancy ${savedDiscrepancyQty}; actual change in selected MRB quantity ${selectedDifference}.`
        );
        return;
      }
    }

    const discrepancyQtyForReconciliation =
      allowsDiscrepancy && savedDiscrepancy
        ? toQuantityNumber(savedDiscrepancyQty)
        : 0;

    const finalReconciledQty =
      finalAcceptedQty + finalRejectedQty + discrepancyQtyForReconciliation;

    if (finalReconciledQty !== affectedQty) {
      alert(
        savedDiscrepancy
          ? `Final quantity reconciliation failed. Final Accepted (${finalAcceptedQty}) + Final Rejected (${finalRejectedQty}) + Discrepancy (${discrepancyQtyForReconciliation}) must equal Initial Quantity (${affectedQty}).`
          : `Final quantity reconciliation failed. Final Accepted (${finalAcceptedQty}) + Final Rejected (${finalRejectedQty}) must equal Initial Quantity (${affectedQty}).`
      );
      return;
    }

    if (!allowsDiscrepancy) {
      finalAcceptedQty = mrbAcceptedQty;
      finalRejectedQty = mrbRejectedQty;
    }

    const now = new Date().toISOString();

    const { error } = await supabase
      .from("ncmr_affected_items")
      .update({
        disposition_implementation_status: "completed",
        disposition_implementation_notes: implementationNotes.trim(),
        disposition_implemented_by: userEmail,
        disposition_implemented_at: now,
        quantity_discrepancy: savedDiscrepancy,
        discrepancy_quantity: savedDiscrepancyQty,
        discrepancy_type: savedDiscrepancyType,
        discrepancy_rationale: savedDiscrepancyRationale,
        final_quantity_accepted: finalAcceptedQty,
        final_quantity_rejected: finalRejectedQty,
      })
      .eq("id", itemId)
      .eq("ncmr_id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await addAuditLog(
      "disposition_implementation_completed",
      `${formatDispositionLabel(disposition)} disposition implemented for affected item ${item.product_part_number || item.lot_number || itemId}. MRB Accepted/Rejected: ${mrbAcceptedQty}/${mrbRejectedQty}. Final Accepted/Rejected: ${finalAcceptedQty}/${finalRejectedQty}. Quantity discrepancy: ${savedDiscrepancy ? `Yes - ${savedDiscrepancyQty} (${savedDiscrepancyType})` : "No"}.`
    );

    alert("Disposition implementation recorded and final quantities reconciled.");
    await fetchAffectedItems();
  };

  const verifyImplementationTask = async (
    taskId: string,
    verificationComment: string
  ) => {
    if (record?.is_locked) {
      alert("This record is locked after electronic signature and cannot be edited.");
      return;
    }

    if (!isMrbApproved()) {
      alertMrbApprovalRequired();
      return;
    }

    const currentNcmrOwner = normalizeApproverEmail(
      record?.owner || record?.owner_email
    );
    const currentUser = normalizeApproverEmail(userEmail);

    if (!currentNcmrOwner || currentNcmrOwner !== currentUser) {
      alert("Only the current NCMR owner can verify Correction / Corrective Action implementation tasks.");
      return;
    }

    if (!verificationComment.trim()) {
      alert("Implementation verification comment is required.");
      return;
    }

    const task = correctionTasks.find((item: any) => item.id === taskId);

    if (!task) {
      alert("Implementation task was not found.");
      return;
    }

    if (String(task?.status || "").trim().toLowerCase() !== "completed") {
      alert("The task owner must complete this implementation task before the NCMR owner can verify it.");
      return;
    }

    if (
      String(task?.implementation_verification_status || "")
        .trim()
        .toLowerCase() === "verified"
    ) {
      alert("This implementation task has already been verified.");
      return;
    }

    const now = new Date().toISOString();

    const { data: verifiedTask, error } = await supabase
      .from("approval_tasks")
      .update({
        implementation_verification_status: "verified",
        implementation_verification_comment: verificationComment.trim(),
        implementation_verified_by: currentUser,
        implementation_verified_at: now,
      })
      .eq("id", taskId)
      .eq("entity_type", "ncmr")
      .eq("entity_id", id)
      .in("task_type", ["correction_task", "corrective_action_task"])
      .eq("status", "completed")
      .select("id")
      .maybeSingle();

    if (error) {
      alert(error.message);
      return;
    }

    if (!verifiedTask?.id) {
      alert("The implementation task could not be verified. Reload the page and confirm that the task is completed.");
      return;
    }

    await addAuditLog(
      "implementation_task_verified",
      `${task?.task_title || task?.required_function || "Implementation task"} independently verified by NCMR owner ${currentUser}. Verification: ${verificationComment.trim()}`
    );

    alert("Implementation task verification recorded.");
    await fetchCorrectionTasks();
  };

  const verifyReworkTask = async (taskId: string, verificationComment: string) => {
    if (record?.is_locked) return alert("This record is locked after electronic signature and cannot be edited.");
    if (!isMrbApproved()) return alertMrbApprovalRequired();

    const currentNcmrOwner = normalizeApproverEmail(record?.owner || record?.owner_email);
    const currentUser = normalizeApproverEmail(userEmail);
    if (!currentNcmrOwner || currentNcmrOwner !== currentUser) return alert("Only the current NCMR owner can verify Rework implementation.");
    if (!verificationComment.trim()) return alert("Rework implementation verification comment is required.");

    const task = reworkTasks.find((item: any) => item.id === taskId);
    if (!task) return alert("Rework task was not found.");
    if (String(task?.status || "").trim().toLowerCase() !== "completed") return alert("The Rework Owner must complete the Rework task before owner verification.");

    const outcomeErrors: string[] = [];
    getReworkAffectedItems().forEach((item: any, index: number) => {
      const affected = toQuantityNumber(item.quantity_affected);
      const accepted = toQuantityNumber(item.final_rework_quantity_accepted);
      const rejected = toQuantityNumber(item.final_rework_quantity_rejected);
      if (!item.final_disposition_after_rework) outcomeErrors.push(`Rework Item ${index + 1}: final disposition is missing.`);
      if (item.final_rework_quantity_accepted === null || item.final_rework_quantity_accepted === undefined || item.final_rework_quantity_rejected === null || item.final_rework_quantity_rejected === undefined) {
        outcomeErrors.push(`Rework Item ${index + 1}: final quantities are missing.`);
      } else if (accepted + rejected !== affected) {
        outcomeErrors.push(`Rework Item ${index + 1}: final accepted + final rejected (${accepted + rejected}) must equal affected quantity (${affected}).`);
      }
    });
    if (outcomeErrors.length > 0) return alert(`Rework verification cannot be recorded until the Rework Owner's final outcome is complete:\n\n${outcomeErrors.join("\n")}`);

    const now = new Date().toISOString();
    const { data: verifiedTask, error } = await supabase.from("approval_tasks").update({
      implementation_verification_status: "verified",
      implementation_verification_comment: verificationComment.trim(),
      implementation_verified_by: currentUser,
      implementation_verified_at: now,
    }).eq("id", taskId).eq("entity_type", "ncmr").eq("entity_id", id).eq("task_type", "rework_task").eq("status", "completed").select("id").maybeSingle();

    if (error) return alert(error.message);
    if (!verifiedTask?.id) return alert("The Rework task could not be verified. Reload the page and confirm that the task is completed.");

    await addAuditLog("rework_implementation_verified", `Rework task independently verified by NCMR owner ${currentUser}. Verification: ${verificationComment.trim()}`);
    alert("Rework implementation verification recorded.");
    await Promise.all([fetchReworkTasks(), fetchAffectedItems()]);
  };

  const closeNcmr = async () => {
    if (record?.is_locked) {
      alert("This record is locked after electronic signature and cannot be edited.");
      return;
    }

    if (!isMrbApproved()) {
      alertMrbApprovalRequired();
      return;
    }

    const validationPassed = validateWorkflowForClosure();

    if (!validationPassed) {
      alert("Workflow validation failed. Resolve all validation errors before closure.");
      return;
    }

    const currentNcmrOwner = normalizeApproverEmail(
      record?.owner || record?.owner_email
    );
    const currentUserForClosure = normalizeApproverEmail(userEmail);

    if (!currentNcmrOwner || currentNcmrOwner !== currentUserForClosure) {
      return alert("Only the current NCMR owner can close this NCMR.");
    }

    if (!problemDescription) return alert("Problem description is required.");
    if (!containmentAction) return alert("Containment action is required.");
    if (!investigationSummary) return alert("Investigation summary is required.");
    if (!rootCauseCategory) return alert("Root cause category is required.");
    if (!rootCause) return alert("Root Cause Summary is required.");
    if (!correctionActionProposal) return alert("Correction Proposal is required.");
    if (!correctiveAction) return alert("Corrective Action Proposal / justification is required.");
    const directClosureRiskErrors = getRiskAssessmentValidationErrors();
    if (directClosureRiskErrors.length > 0) {
      return alert(`Risk assessment is incomplete:\n\n${directClosureRiskErrors.join("\n")}`);
    }

    const closureCapaRecommendationDirect = getCapaRecommendation();

    if (
      closureCapaRecommendationDirect.recommended &&
      !record?.capa_id &&
      !isNoCapaDecisionAccepted()
    ) {
      return alert("CAPA recommendation requires either a linked CAPA or a documented No-CAPA justification in CAPA Governance before closure.");
    }

    if (!productDisposition) return alert("Product disposition is required.");
    if (!dispositionJustification) return alert("Disposition justification is required.");
    if (!record?.mrb_approved_by) return alert("MRB approval is required before closure.");

    if (isCorrectionNotRequired()) {
      if (!correctiveAction.trim()) {
        return alert("Correction not required requires documented justification before closure.");
      }
    }

    const closureQuantityErrors = affectedItems.flatMap((item, index) =>
      buildQuantityReconciliationErrors(item, `Affected Item ${index + 1}`)
    );

    if (closureQuantityErrors.length > 0) {
      return alert(`Quantity reconciliation failed before NCMR closure:\n\n${closureQuantityErrors.join("\n")}`);
    }

    if (!closureSignatureEmail) {
      return alert("Please re-enter your email before signing NCMR closure.");
    }

    if (closureSignatureEmail.trim().toLowerCase() !== userEmail.trim().toLowerCase()) {
      return alert("Closure electronic signature email does not match the logged-in user.");
    }

    const confirmed = window.confirm(
      "Electronic Signature - NCMR Closure:\n\nBy selecting OK, I certify that I am the logged-in user, I have completed final quality review of this NCMR, including investigation, Severity / Occurrence / Detection risk assessment, effective risk level, CAPA decision, disposition, MRB approval, correction implementation, evidence, and closure readiness.\n\nThis action will close and lock the record and will be recorded with signer identity, timestamp, and signature meaning."
    );

    if (!confirmed) return;

    const now = new Date().toISOString();
    const meaning =
      "NCMR Closure: I certify that I am the logged-in user, I have completed final quality review of this NCMR, including investigation, Severity / Occurrence / Detection risk assessment, effective risk level, CAPA decision, disposition, MRB approval, correction implementation, evidence, and closure readiness.";

    const { error } = await supabase
      .from("ncmrs")
      .update({
        status: "closed",
        review_status: "completed",
        closed_at: now,
        ncmr_closed_by: userEmail,
        ncmr_signature_meaning: meaning,
        ncmr_signature_email_entered: closureSignatureEmail,
        investigation_completed_at: now,
        is_locked: true,
        locked_at: now,
        locked_by: userEmail,
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await addAuditLog(
      "ncmr_closed_signature",
      `NCMR closed with e-signature. Meaning: ${meaning}`
    );

    alert("NCMR closed");
    fetchRecord();
  };

  useEffect(() => {
    if (!id || !record || isPreMrbSectionReadOnly()) return;

    const capaRecommendation = getCapaRecommendation();
    const payload: any = {
      investigator,
      problem_description: problemDescription,
      containment_action: containmentAction,
      investigation_summary: investigationSummary,
      root_cause: rootCause,
      root_cause_category: rootCauseCategory,
      correction_action_proposal: correctionActionProposal,
      corrective_action: correctiveAction,
      risk_assessment: riskAssessment,
      ...getRiskPersistencePayload(),
      capa_recommended: capaRecommendation.recommended,
      capa_governance_version_id:
        capaGovernanceConfiguration?.id || record?.capa_governance_version_id || null,
      capa_governance_version_code:
        capaGovernanceConfiguration?.version_code || record?.capa_governance_version_code || null,
      product_disposition: productDisposition,
      disposition: productDisposition,
      disposition_justification: dispositionJustification,
      review_status: reviewStatus,
    };

    const unchanged =
      String(record?.investigator || "") === investigator &&
      String(record?.problem_description || "") === problemDescription &&
      String(record?.containment_action || "") === containmentAction &&
      String(record?.investigation_summary || "") === investigationSummary &&
      String(record?.root_cause || "") === rootCause &&
      String(record?.root_cause_category || "") === rootCauseCategory &&
      String(record?.correction_action_proposal || "") === correctionActionProposal &&
      String(record?.corrective_action || "") === correctiveAction &&
      String(record?.risk_assessment || "") === riskAssessment &&
      String(record?.risk_determination || (record?.risk_level === "no_risk" ? "no_risk" : "")) === riskDetermination &&
      String(record?.no_risk_justification || "") === (riskDetermination === "no_risk" ? noRiskJustification : "") &&
      String(record?.risk_level || "") === String(getRiskPersistencePayload().risk_level || "") &&
      Boolean(record?.risk_override_enabled) === Boolean(getRiskPersistencePayload().risk_override_enabled) &&
      String(record?.risk_override_level || "") === String(getRiskPersistencePayload().risk_override_level || "") &&
      String(record?.risk_override_justification || "") === String(getRiskPersistencePayload().risk_override_justification || "") &&
      Boolean(record?.capa_recommended) === Boolean(capaRecommendation.recommended) &&
      String(record?.product_disposition || record?.disposition || "") === productDisposition &&
      String(record?.disposition_justification || "") === dispositionJustification &&
      String(record?.review_status || "draft") === reviewStatus;

    if (unchanged) return;

    setAutoSaveStatus("saving");
    const timer = window.setTimeout(async () => {
      if (!record?.investigation_opened_at) payload.investigation_opened_at = new Date().toISOString();
      const { error } = await supabase.from("ncmrs").update(payload).eq("id", id);
      if (error) {
        console.error("NCMR autosave failed:", error.message);
        setAutoSaveStatus("error");
        return;
      }
      setRecord((current: any) => current ? { ...current, ...payload } : current);
      setAutoSaveStatus("saved");
    }, 900);

    return () => window.clearTimeout(timer);
  }, [
    id, investigator, problemDescription, containmentAction, investigationSummary,
    rootCause, rootCauseCategory, correctionActionProposal, correctiveAction,
    riskAssessment, riskDetermination, noRiskJustification, severity, occurrenceRating, detectionRating, riskAssessmentMethod,
    riskLevel, riskOverrideEnabled, riskOverrideLevel, riskOverrideJustification,
    riskConfiguration?.id, riskMatrixRules, capaGovernanceConfiguration?.id, capaGovernanceRules,
    productDisposition, dispositionJustification, reviewStatus,
    record?.id, record?.mrb_approved_by, record?.is_locked, approvalTasks,
  ]);

  useEffect(() => {
    if (id) {
      fetchUserRole();
      fetchRecord();
      fetchRootCauseOptions();
      fetchDispositionOptions();
    }
  }, [id]);

  useEffect(() => {
    if (
      id &&
      record &&
      !record?.mrb_approved_by &&
      approvalTasks.length > 0 &&
      allRequiredMrbApprovalTasksApproved()
    ) {
      completeMrbApprovalIfReady();
    }
  }, [
    id,
    record?.id,
    record?.mrb_approved_by,
    approvalTasks,
    requireQualityApproval,
    requireOperationsApproval,
    requireRegulatoryApproval,
    requireSupplyChainApproval,
    requireEngineeringApproval,
  ]);

  if (loading) {
    return <main style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>Loading...</main>;
  }

  if (!record) {
    return <main style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>Record not found</main>;
  }

  const isLocked =
    record?.is_locked === true ||
    (hasPendingMrbApprovalTasks() && !hasRejectedMrbApprovalTask());
  const preMrbReadOnly = !isCurrentNcmrOwner() || isLocked || !!record?.mrb_approved_by;
  const canEditInitiation = !preMrbReadOnly;

  const workflowProgressSteps = [
    { label: "Initiation", complete: affectedItems.length > 0 && !!summaryIssueDescription },
    { label: "Containment", complete: !!containmentAction },
    { label: "Investigation", complete: !!investigator && !!problemDescription && !!investigationSummary && !!rootCauseCategory && !!rootCause },
    { label: "Correction", complete: !!correctionActionProposal },
    { label: "Corrective Action", complete: !!correctiveAction.trim() },
    { label: "Risk Assessment", complete: getRiskAssessmentValidationErrors().length === 0 },
    { label: "MRB Approval", complete: !!record?.mrb_approved_by },
    { label: "Disposition Implementation", complete: !!record?.mrb_approved_by && areDispositionImplementationsComplete() },
    { label: "Correction Implementation", complete: isCorrectionNotRequired() ? !!correctiveAction : areAllActiveImplementationTasksVerified() },
    { label: "Evidence", complete: !!evidenceUrl || !!record?.evidence_url },
    { label: "Closure", complete: !!record?.ncmr_closed_by || record?.status === "closed" },
  ];

  const completedWorkflowSteps = workflowProgressSteps.filter((step) => step.complete).length;
  const workflowPercentComplete = Math.round(
    (completedWorkflowSteps / workflowProgressSteps.length) * 100
  );

  const sectionStatusBadge = (complete: boolean, label = "Section") => {
    if (complete) {
      return (
        <span
          style={{
            border: "1px solid #86efac",
            background: "#f0fdf4",
            color: "#166534",
            borderRadius: "999px",
            padding: "4px 10px",
            fontSize: "12px",
            fontWeight: 700,
          }}
        >
          ✓ Complete
        </span>
      );
    }

    if (validationAttempted) {
      return (
        <span
          style={{
            border: "1px solid #fca5a5",
            background: "#fef2f2",
            color: "#991b1b",
            borderRadius: "999px",
            padding: "4px 10px",
            fontSize: "12px",
            fontWeight: 700,
          }}
        >
          ⚠ Needs Attention
        </span>
      );
    }

    return (
      <span
        style={{
          border: "1px solid #d1d5db",
          background: "#f9fafb",
          color: "#374151",
          borderRadius: "999px",
          padding: "4px 10px",
          fontSize: "12px",
          fontWeight: 700,
        }}
      >
        ○ Pending
      </span>
    );
  };

  const isInitiationComplete = affectedItems.length > 0 && !!summaryIssueDescription;
  const isContainmentComplete = !!containmentAction;
  const isInvestigationComplete = !!investigator && !!problemDescription && !!investigationSummary && !!rootCauseCategory && !!rootCause;
  const isCorrectionComplete = !!correctionActionProposal;
  const isCorrectiveActionComplete = !!correctiveAction.trim();
  const isRiskAssessmentComplete = getRiskAssessmentValidationErrors().length === 0;
  const isMrbComplete = !!record?.mrb_approved_by;
  const isDispositionImplementationComplete =
    !!record?.mrb_approved_by && areDispositionImplementationsComplete();
  const isImplementationComplete = isCorrectionNotRequired()
    ? !!correctiveAction
    : areAllActiveImplementationTasksVerified();
  const isEvidenceComplete = !!evidenceUrl || !!record?.evidence_url;
  const isClosureComplete = !!record?.ncmr_closed_by || record?.status === "closed";

  const recordAgeDays = record?.created_at
    ? Math.max(
        0,
        Math.floor(
          (new Date().getTime() - new Date(record.created_at).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      )
    : 0;

  const closureTargetDays = 45;
  const dispositionTargetDays = 15;

  const closureSlaStatus =
    record?.status === "closed"
      ? "Closed"
      : recordAgeDays > closureTargetDays
      ? "Overdue"
      : recordAgeDays > 35
      ? "At Risk"
      : "On Track";

  const dispositionSlaStatus =
    record?.mrb_approved_by
      ? "Complete"
      : recordAgeDays > dispositionTargetDays
      ? "Overdue"
      : recordAgeDays > 10
      ? "At Risk"
      : "On Track";

  const approvalHistory = approvalTasks.filter(
    (task) => task.status === "approved" || task.status === "rejected"
  );

  const filteredAuditTimeline = timelineFilter
    ? auditTimeline.filter((event) =>
        [event.action, event.details, event.user_email]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(timelineFilter.trim().toLowerCase())
      )
    : auditTimeline;

  const cancelCurrentFormChanges = () => {
    fetchRecord();
    setImplementationTaskType("correction");
    setCorrectionTaskAssignee("");
    setCorrectionTaskDueDate("");
    setCorrectionTaskInstructions("");
    setShowAdditionalImplementationTaskForm(false);
    setReworkTaskAssignee("");
    setReworkTaskDueDate("");
    setReworkTaskInstructions("");
    alert("Unsaved changes were reverted to the last saved record.");
  };

  const SectionSaveCancelActions = ({
    disabled = false,
  }: {
    onSave?: () => void;
    disabled?: boolean;
  }) => (
    <div style={{ marginTop: "12px", color: "#64748b", fontSize: "12px" }}>
      {disabled || preMrbReadOnly
        ? "Read-only"
        : autoSaveStatus === "saving"
          ? "Saving…"
          : autoSaveStatus === "error"
            ? "Autosave failed — retry by editing the field again."
            : autoSaveStatus === "saved"
              ? "✓ Saved automatically"
              : "Changes save automatically"}
    </div>
  );

  const metricCard = (label: string, value: any, helperText?: string) => (
    <div
      style={{
        border: "1px solid #d1d5db",
        borderRadius: "10px",
        padding: "12px",
        background: "#f9fafb",
      }}
    >
      <div style={{ color: "#4b5563", fontSize: "13px", marginBottom: "4px" }}>
        {label}
      </div>
      <div style={{ fontSize: "22px", fontWeight: 700 }}>{value}</div>
      {helperText ? (
        <div style={{ color: "#6b7280", fontSize: "12px", marginTop: "4px" }}>
          {helperText}
        </div>
      ) : null}
    </div>
  );

  return (
    <main style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>NCMR Controlled Workflow</h1>
      <div style={{ color: "#64748b", marginTop: "-10px", marginBottom: "14px", fontSize: "13px" }}>Module Version: {getDisplayedNcmrModuleVersion()}</div>

      {returnRevisionOpen ? (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ width: "100%", maxWidth: "560px", background: "white", borderRadius: "12px", padding: "20px", boxShadow: "0 20px 50px rgba(0,0,0,0.25)" }}>
            <h2 style={{ marginTop: 0 }}>Return Approved MRB for Revision</h2>
            <p style={{ color: "#475569" }}>Prior approval history will be preserved. The selected section will reopen for revision and a new MRB approval cycle will be required.</p>
            <label style={{ fontWeight: 700 }}>Return To</label><br />
            <select value={returnRevisionDestination} onChange={(e) => setReturnRevisionDestination(e.target.value)} disabled={returnRevisionSubmitting} style={{ width: "100%", padding: "9px", marginTop: "6px", marginBottom: "14px" }}>
              <option value="investigation / root cause summary">Investigation / Root Cause Summary</option>
              <option value="correction">Correction</option>
              <option value="corrective action">Corrective Action</option>
              <option value="risk assessment">Risk Assessment</option>
              <option value="product disposition">Product Disposition</option>
              <option value="mrb preparation">MRB Preparation</option>
            </select>
            <label style={{ fontWeight: 700 }}>Return Justification</label><br />
            <textarea value={returnRevisionJustification} onChange={(e) => setReturnRevisionJustification(e.target.value)} disabled={returnRevisionSubmitting} rows={4} style={{ width: "100%", marginTop: "6px" }} placeholder="Document why the approved MRB package is being returned for revision." />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px" }}>
              <button type="button" onClick={() => setReturnRevisionOpen(false)} disabled={returnRevisionSubmitting}>Cancel</button>
              <button type="button" onClick={returnAfterMrbApproval} disabled={returnRevisionSubmitting || !returnRevisionJustification.trim()}>
                {returnRevisionSubmitting ? "Returning…" : "Return for Revision"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* NCMR Executive Status Strip */}
      <div
        style={{
          border: "1px solid #d1d5db",
          borderRadius: "10px",
          padding: "12px",
          background: "#f9fafb",
          marginBottom: "16px",
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" }}>
          <div>
            <div style={{ color: "#4b5563", fontSize: "13px" }}>NCMR Number</div>
            <strong>{record.ncmr_number || "Pending Number"}</strong>
          </div>
          <div>
            <div style={{ color: "#4b5563", fontSize: "13px" }}>Workflow Status</div>
            <strong>{record.status || "open"}</strong>
          </div>
          <div>
            <div style={{ color: "#4b5563", fontSize: "13px" }}>Severity</div>
            <strong>{record.severity || "not_assessed"}</strong>
          </div>
          <div>
            <div style={{ color: "#4b5563", fontSize: "13px" }}>Risk Level</div>
            <strong>{getEffectiveRiskLevel() || record.risk_level || "not_assessed"}</strong>
          </div>
          <div>
            <div style={{ color: "#4b5563", fontSize: "13px" }}>MRB</div>
            <strong>{record.mrb_approved_by ? "Approved" : "Pending"}</strong>
          </div>
          <div>
            <div style={{ color: "#4b5563", fontSize: "13px" }}>Access Status</div>
            <strong>{!isCurrentNcmrOwner() ? "Read Only" : isLocked || record.is_locked ? "Locked" : "Editable"}</strong>
          </div>
        </div>
      </div>

      {/* Phase 3 Executive Workflow Summary */}
      {!["closed", "cancelled"].includes(String(record?.status || "").toLowerCase()) ? (
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "14px" }}>
          {(isCurrentNcmrOwner() || isElevatedNcmrAuthority()) ? (
            <button type="button" onClick={cancelNcmr}>Cancel NCMR</button>
          ) : null}
          {record?.mrb_approved_by && isElevatedNcmrAuthority() ? (
            <button type="button" onClick={openReturnAfterMrbApproval}>Return Approved MRB for Revision</button>
          ) : null}
        </div>
      ) : null}

      <SectionCard
        title="Executive Workflow Summary"
        subtitle="High-level NCMR health, aging, SLA, approval, and closure readiness indicators."
        defaultOpen={true}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "12px",
          }}
        >
          {metricCard("Record Age", `${recordAgeDays} day(s)`, "Days since NCMR creation")}
          {metricCard("Workflow Progress", `${workflowPercentComplete}%`, `${completedWorkflowSteps} of ${workflowProgressSteps.length} sections complete`)}
          {metricCard("Disposition SLA", dispositionSlaStatus, `Target: MRB disposition ≤ ${dispositionTargetDays} days`)}
          {metricCard("Closure SLA", closureSlaStatus, `Target: closure ≤ ${closureTargetDays} days`)}
          {metricCard("Approval Tasks", `${approvalTasks.filter((task) => task.status === "approved").length}/${approvalTasks.length}`, "Approved / total MRB approval tasks")}
          {metricCard("Timeline Events", auditTimeline.length, "Audit log activity count")}
        </div>

        <div
          style={{
            marginTop: "14px",
            border: "1px solid #cbd5e1",
            borderRadius: "8px",
            padding: "12px",
            background: "white",
          }}
        >
          <strong>Executive Readiness</strong>
          <div style={{ marginTop: "8px", display: "grid", gap: "6px" }}>
            <div>{isRiskAssessmentComplete ? "✓" : "○"} Risk assessment complete</div>
            <div>{isMrbComplete ? "✓" : "○"} MRB approval complete</div>
            <div>{isDispositionImplementationComplete ? "✓" : "○"} Disposition implementation complete</div>
            <div>{isImplementationComplete ? "✓" : "○"} Correction / Corrective Action implementation complete</div>
            <div>{isClosureComplete ? "✓" : "○"} NCMR closure complete</div>
          </div>
        </div>

        <div
          style={{
            marginTop: "14px",
            border: "1px solid #cbd5e1",
            borderRadius: "8px",
            padding: "12px",
            background: "white",
          }}
        >
          <strong>Quantity Reconciliation</strong>
          <div style={{ marginTop: "8px", display: "grid", gap: "8px" }}>
            {affectedItems.length === 0 ? (
              <div style={{ color: "#991b1b" }}>No affected material items have been entered.</div>
            ) : (
              affectedItems.map((item, index) => {
                const summary = getAffectedItemReconciliationSummary(item);
                return (
                  <div
                    key={item.id || index}
                    style={{
                      border: summary.reconciled ? "1px solid #86efac" : "1px solid #fca5a5",
                      background: summary.reconciled ? "#f0fdf4" : "#fef2f2",
                      color: summary.reconciled ? "#166534" : "#991b1b",
                      borderRadius: "8px",
                      padding: "10px",
                    }}
                  >
                    <strong>{summary.reconciled ? "✓" : "⚠"} Affected Item {index + 1}</strong>
                    <div style={{ fontSize: "13px", marginTop: "4px" }}>
                      Affected: {summary.affectedQty} | Quarantined: {summary.quarantinedQty} | Accepted: {summary.acceptedQty} | Rejected: {summary.rejectedQty} | Remaining: {summary.remainingQty}
                    </div>
                    {!summary.reconciled ? (
                      <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
                        {summary.errors.map((error) => (
                          <li key={error}>{error}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </SectionCard>

      {/* NCMR StatusBadge Row */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "16px" }}>
        <StatusBadge status={record.status || "open"} />
        <StatusBadge status={record.severity || "not_assessed"} />
        <StatusBadge status={record.review_status || "draft"} />
        {record.mrb_approved_by ? <StatusBadge status="MRB Approved" /> : <StatusBadge status="MRB Pending" />}
        {record.is_locked ? <StatusBadge status="Locked" /> : <StatusBadge status="Editable" />}
      </div>

      <div style={{ marginBottom: "16px" }}>
        <button
          onClick={() => window.open(`/ncmrs/${id}/report`, "_blank")}
          style={{
            padding: "10px 14px",
            background: "#2563eb",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: "600",
          }}
        >
          NCMR Report
        </button>
      </div>

      <p><strong>Logged-in:</strong> {userEmail || "none"}</p>
      <p><strong>Role:</strong> {userRole || "none"}</p>

      {/* Sticky NCMR Action Bar */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "white",
          border: "1px solid #d1d5db",
          borderRadius: "10px",
          padding: "12px",
          marginBottom: "16px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "12px",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div>
            <strong>Workflow Progress:</strong> {completedWorkflowSteps} / {workflowProgressSteps.length} complete ({workflowPercentComplete}%)
            <div
              style={{
                height: "8px",
                background: "#e5e7eb",
                borderRadius: "999px",
                overflow: "hidden",
                marginTop: "6px",
                width: "260px",
                maxWidth: "100%",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${workflowPercentComplete}%`,
                  background: workflowPercentComplete === 100 ? "#16a34a" : "#2563eb",
                }}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button onClick={saveWorkflow} disabled={isLocked}>
              Save Workflow
            </button>

            <button
              type="button"
              onClick={() => {
                const passed = validateWorkflowForMrbApproval();
                setTimeout(() => {
                  document.getElementById("workflow-validation-banner")?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  });
                }, 100);
                alert(passed ? "Workflow is ready for MRB approval." : "Workflow validation found open items. Review the warning badges and validation banner.");
              }}
              disabled={isLocked}
            >
              Validate for MRB
            </button>

            <button onClick={closeNcmr} disabled={isLocked}>
              Close NCMR
            </button>

            <button
              type="button"
              onClick={() => window.open(`/ncmrs/${id}/report`, "_blank")}
            >
              Print Report
            </button>

            <button
              type="button"
              onClick={() => window.print()}
            >
              Print Summary
            </button>

            {linkedCapa ? (
              <button
                type="button"
                onClick={() => window.open(`/capa/${linkedCapa.id}`, "_blank")}
              >
                Open CAPA
              </button>
            ) : null}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
            marginTop: "10px",
          }}
        >
          {workflowProgressSteps.map((step) => (
            <span
              key={step.label}
              style={{
                border: step.complete ? "1px solid #86efac" : "1px solid #d1d5db",
                background: step.complete ? "#f0fdf4" : "#f9fafb",
                color: step.complete ? "#166534" : "#374151",
                borderRadius: "999px",
                padding: "4px 10px",
                fontSize: "12px",
                fontWeight: 600,
              }}
            >
              {step.complete ? "✓" : "○"} {step.label}
            </span>
          ))}
        </div>
      </div>

      {validationErrors.length > 0 ? (
        <div
          id="workflow-validation-banner"
          style={{
            background: "#fef2f2",
            border: "1px solid #fca5a5",
            color: "#991b1b",
            padding: "12px",
            borderRadius: "8px",
            marginBottom: "16px",
          }}
        >
          <strong>Workflow Validation Errors</strong>
          <ul style={{ marginTop: "8px", marginBottom: 0 }}>
            {validationErrors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div
          id="workflow-validation-banner"
          style={{
            background: "#f0fdf4",
            border: "1px solid #86efac",
            color: "#166534",
            padding: "12px",
            borderRadius: "8px",
            marginBottom: "16px",
          }}
        >
          <strong>Workflow Validation:</strong> No active validation errors.
        </div>
      )}

      <div style={{ marginBottom: "20px", padding: "12px", border: "1px solid #ccc" }}>
        <h2>Record Summary</h2>

        {canEditInitiation ? (
          <p style={{ color: "#4b5563", fontSize: "14px" }}>
            Record summary can be edited before MRB approval. After MRB approval or record lock, this section becomes read-only.
          </p>
        ) : (
          <p style={{ color: "#6b7280", fontSize: "14px" }}>
            Record summary is read-only after MRB approval or record lock.
          </p>
        )}

        <div style={{ marginBottom: "12px" }}>
          <label>Issue Description</label>
          <br />
          <textarea
            value={summaryIssueDescription}
            onChange={(e) => setSummaryIssueDescription(e.target.value)}
            disabled={!canEditInitiation}
            rows={4}
            style={{ width: "100%", maxWidth: "900px", padding: "8px" }}
          />
        </div>

        <div style={{ marginBottom: "12px" }}>
          <label>Owner</label>
          <br />
          <input
            value={summaryOwner}
            onChange={(e) => setSummaryOwner(e.target.value)}
            disabled={!canEditInitiation}
            style={{ padding: "8px", width: "100%", maxWidth: "500px" }}
          />
        </div>

        {canEditInitiation ? (
          <button type="button" onClick={saveRecordSummary} style={{ marginBottom: "12px" }}>
            Save Record Summary
          </button>
        ) : null}

        <p><strong>Severity:</strong> {record.severity || "not_assessed"}</p>
        <p><strong>CAPA Required:</strong> {record.capa_required ? "Yes" : "No"}</p>
        <p><strong>CAPA Recommended:</strong> {record.capa_recommended ? "Yes" : "No"}</p>
        <p><strong>CAPA Decision:</strong> {record.capa_decision || "N/A"}</p>
        <p><strong>CAPA Decision Justification:</strong> {record.capa_decision_justification || record.capa_justification || "N/A"}</p>
        <p><strong>Status:</strong> {record.status}</p>

        {linkedCapa ? (
          <p>
            <strong>Linked CAPA:</strong>{" "}
            <a href={`/capa/${linkedCapa.id}`}>{linkedCapa.title}</a>
          </p>
        ) : (
          <p><strong>Linked CAPA:</strong> None</p>
        )}

        {!linkedCapa ? (
          <button onClick={createCapaFromNcmr} disabled={!canEditInitiation}>
            Create CAPA from this NCMR
          </button>
        ) : null}
      </div>

      <SectionCard
        title="1. Initiation"
        subtitle={isInitiationComplete ? "Complete: affected materials and initiation information are documented." : "Pending: document affected materials and initiation information."}
        defaultOpen={true}
        rightAction={sectionStatusBadge(isInitiationComplete, "Initiation")}
      >
        <p>This section is created from the NCMR initiation page.</p>

        <h3>Affected Materials / Multiple Parts and Lots</h3>

        {canEditInitiation ? (
          <p style={{ color: "#4b5563", fontSize: "14px" }}>
            Affected materials can be edited before MRB approval. Once MRB is approved, this section becomes read-only.
          </p>
        ) : (
          <p style={{ color: "#6b7280", fontSize: "14px" }}>
            Affected materials are read-only after MRB approval or record lock.
          </p>
        )}

        {affectedItems.length === 0 ? (
          <p>No additional affected items recorded.</p>
        ) : (
          <div style={{ display: "grid", gap: "10px" }}>
            {affectedItems.map((item) => (
              <AffectedMaterialEditCard
                key={item.id}
                item={item}
                canEdit={canEditInitiation}
                onSave={updateAffectedMaterial}
                onRemove={removeAffectedMaterial}
              />
            ))}
          </div>
        )}

        {canEditInitiation ? (
          <button
            type="button"
            onClick={addAffectedMaterial}
            style={{ marginTop: "12px" }}
          >
            + Add Affected Material
          </button>
        ) : null}

      </SectionCard>

      <SectionCard
        title="2. Containment"
        subtitle={isContainmentComplete ? "Complete: containment action is documented." : "Pending: document the containment action."}
        defaultOpen={true}
        rightAction={sectionStatusBadge(isContainmentComplete, "Containment")}
      >

        <label>Containment Action</label><br />
        <textarea
          value={containmentAction}
          onChange={(e) => setContainmentAction(e.target.value)}
          disabled={preMrbReadOnly}
          rows={4}
          style={{ width: "100%", maxWidth: "700px" }}
        />
          <div
            style={{
              marginTop: "10px",
              border: record?.containment_completed_at ? "1px solid #86efac" : "1px solid #bfdbfe",
              borderRadius: "8px",
              padding: "12px",
              background: record?.containment_completed_at ? "#f0fdf4" : "#eff6ff",
              maxWidth: "760px",
            }}
          >
            <h4 style={{ marginTop: 0 }}>Containment Completion</h4>
            {record?.containment_completed_at ? (
              <div style={{ color: "#166534" }}>
                <strong>Containment Completed By:</strong> {record.containment_completed_by || "N/A"}
                <br />
                <strong>Containment Completed At:</strong>{" "}
                {formatIsoDateTime(record.containment_completed_at)}
              </div>
            ) : (
              <p style={{ color: "#1e3a8a", marginTop: 0 }}>
                Mark containment complete once the containment action has been implemented.
                This timestamp feeds the Containment ≤ 5 Days KPI.
              </p>
            )}

            <button
              type="button"
              onClick={markContainmentComplete}
              disabled={preMrbReadOnly || !!record?.containment_completed_at}
              style={{ marginTop: "10px" }}
            >
              {record?.containment_completed_at ? "Containment Complete" : "Mark Containment Complete"}
            </button>
          </div>


        <SectionSaveCancelActions disabled={preMrbReadOnly} />
      </SectionCard>

      <div id="ncmr-section-investigation" />
      <SectionCard
        title="3. Investigation / Root Cause Summary"
        subtitle={isInvestigationComplete ? "Complete: investigator, problem statement, investigation, and Root Cause Summary are documented." : "Pending: document the investigator, problem statement, investigation summary, root cause category, and Root Cause Summary."}
        defaultOpen={true}
        rightAction={sectionStatusBadge(isInvestigationComplete, "Investigation")}
      >

        <label>Investigator</label><br />
        <input
          value={investigator}
          onChange={(e) => setInvestigator(e.target.value)}
          disabled={preMrbReadOnly}
          style={{ width: "100%", maxWidth: "500px", padding: "8px", marginBottom: "12px" }}
        />

        <br />
        <label>Problem Statement</label><br />
        <textarea
          value={problemDescription}
          onChange={(e) => setProblemDescription(e.target.value)}
          disabled={preMrbReadOnly}
          rows={4}
          style={{ width: "100%", maxWidth: "800px", marginBottom: "12px" }}
        />

        <br />
        <label>Investigation Summary</label><br />
        <textarea
          value={investigationSummary}
          onChange={(e) => setInvestigationSummary(e.target.value)}
          disabled={preMrbReadOnly}
          rows={4}
          style={{ width: "100%", maxWidth: "800px", marginBottom: "12px" }}
        />


        <div style={{ marginBottom: "16px" }}>
          <a
            href={`/ncmrs/${id}/collaboration`}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-block",
              background: "#2563eb",
              color: "white",
              padding: "8px 12px",
              borderRadius: "8px",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            Open Collaboration Thread
          </a>
          <p style={{ color: "#4b5563", fontSize: "14px", marginTop: "8px" }}>
            Optional collaboration is available when cross-functional investigation input is needed.
          </p>
        </div>

        <br />
        <br />
        <label>Root Cause Category</label><br />
        <select
          value={rootCauseCategory}
          onChange={(e) => setRootCauseCategory(e.target.value)}
          disabled={preMrbReadOnly}
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
        <label>Root Cause Summary</label><br />
        <textarea
          value={rootCause}
          onChange={(e) => setRootCause(e.target.value)}
          disabled={preMrbReadOnly}
          rows={4}
          style={{ width: "100%", maxWidth: "700px" }}
        />

        <div style={{ marginTop: "16px", border: "1px solid #dbeafe", background: "#f8fafc", borderRadius: "10px", padding: "12px", maxWidth: "850px" }}>
          <strong>Investigation / Root Cause Summary Attachment (Optional)</strong>
          <p style={{ color: "#64748b", fontSize: "13px", margin: "6px 0 10px" }}>Attach supporting investigation data, test results, photographs, analysis, or other objective evidence. Attachments become read-only with the approved MRB package.</p>
          {!preMrbReadOnly ? (
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
              <input type="file" onChange={(event) => { setInvestigationAttachmentFile(event.target.files?.[0] || null); event.currentTarget.value = ""; }} disabled={uploadingInvestigationAttachment} />
              <button type="button" onClick={uploadInvestigationAttachment} disabled={!investigationAttachmentFile || uploadingInvestigationAttachment}>{uploadingInvestigationAttachment ? "Uploading..." : "Upload Attachment"}</button>
              {investigationAttachmentFile ? <span style={{ fontSize: "13px", color: "#475569" }}>Selected: {investigationAttachmentFile.name}</span> : null}
            </div>
          ) : <div style={{ color: "#64748b", fontSize: "13px" }}>Read-only after MRB approval / record lock.</div>}
          {Array.isArray(record?.investigation_attachments) && record.investigation_attachments.length > 0 ? (
            <div style={{ display: "grid", gap: "7px", marginTop: "12px" }}>
              {record.investigation_attachments.map((attachment: any, index: number) => (
                <div key={`${attachment?.storage_path || attachment?.url || index}`} style={{ border: "1px solid #e2e8f0", background: "white", borderRadius: "8px", padding: "8px 10px" }}>
                  <a href={attachment?.url} target="_blank" rel="noreferrer">📎 {attachment?.name || `Investigation Attachment ${index + 1}`}</a>
                  <div style={{ color: "#64748b", fontSize: "12px", marginTop: "3px" }}>Uploaded by {attachment?.uploaded_by || "N/A"} · {formatIsoDateTime(attachment?.uploaded_at)}</div>
                </div>
              ))}
            </div>
          ) : <div style={{ marginTop: "10px", color: "#64748b", fontSize: "13px" }}>No Investigation / Root Cause Summary attachment added.</div>}
        </div>

        <SectionSaveCancelActions disabled={preMrbReadOnly} />
      </SectionCard>

      <div id="ncmr-section-correction" />
      <SectionCard
        title="4. Correction"
        subtitle={isCorrectionComplete ? "Complete: correction proposal is documented." : "Pending: document the immediate correction proposal."}
        defaultOpen={true}
        rightAction={sectionStatusBadge(isCorrectionComplete, "Correction")}
      >
        <label>Correction Proposal</label><br />
        <select
          value={correctionActionProposal}
          onChange={(e) => setCorrectionActionProposal(e.target.value)}
          disabled={preMrbReadOnly}
          style={{ padding: "8px", minWidth: "330px", marginBottom: "12px" }}
        >
          <option value="">Select correction proposal</option>
          <option value="no_correction_required">No correction required</option>
          <option value="immediate_correction_only">Immediate correction only</option>
          <option value="rework">Rework</option>
          <option value="repair">Repair</option>
          <option value="replace">Replace</option>
          <option value="scrap">Scrap</option>
          <option value="return_to_supplier">Return to supplier</option>
          <option value="process_correction">Process correction</option>
        </select>

        <p style={{ color: "#64748b", fontSize: "13px", marginTop: "4px" }}>
          Correction addresses the detected nonconformance. If no correction is required, select that option and document the rationale in Corrective Action.
        </p>

        <SectionSaveCancelActions disabled={preMrbReadOnly} />
      </SectionCard>

      <div id="ncmr-section-corrective-action" />
      <SectionCard
        title="5. Corrective Action"
        subtitle={isCorrectiveActionComplete ? "Complete: corrective action proposal or justification is documented." : "Pending: document the corrective action proposal or justification."}
        defaultOpen={true}
        rightAction={sectionStatusBadge(isCorrectiveActionComplete, "Corrective Action")}
      >
        <label>Corrective Action Proposal / Justification</label><br />
        <textarea
          value={correctiveAction}
          onChange={(e) => setCorrectiveAction(e.target.value)}
          disabled={preMrbReadOnly}
          rows={4}
          placeholder="Document the action proposed to address the cause and prevent recurrence. If no corrective action is required, document the justification."
          style={{ width: "100%", maxWidth: "800px" }}
        />

        <SectionSaveCancelActions disabled={preMrbReadOnly} />
      </SectionCard>

      <div id="ncmr-section-risk-assessment" />
      <SectionCard
        title="6. Risk Assessment"
        subtitle={isRiskAssessmentComplete ? "Complete: Risk Determination and Final Effective Risk are documented." : "Pending: select No Risk or complete the Overall/Residual Risk assessment."}
        defaultOpen={true}
        rightAction={sectionStatusBadge(isRiskAssessmentComplete, "Risk Assessment")}
      >
        <div style={{ maxWidth: "850px", marginBottom: "14px" }}>
          <label><strong>Risk Determination</strong></label><br />
          <select
            value={riskDetermination}
            onChange={(e) => {
              const nextValue = e.target.value as "" | "no_risk" | "overall_residual_risk";
              setRiskDetermination(nextValue);

              if (nextValue === "no_risk") {
                setSeverity("not_assessed");
                setOccurrenceRating("");
                setDetectionRating("");
                setRiskLevel("");
                setRiskOverrideEnabled(false);
                setRiskOverrideLevel("");
                setRiskOverrideJustification("");
              }

              if (nextValue === "overall_residual_risk") {
                setNoRiskJustification("");
              }
            }}
            disabled={preMrbReadOnly}
            style={{ width: "100%", maxWidth: "420px", padding: "8px" }}
          >
            <option value="">Select</option>
            <option value="no_risk">No Risk</option>
            <option value="overall_residual_risk">Overall/Residual Risk</option>
          </select>
        </div>

        {riskDetermination === "no_risk" ? (
          <div
            style={{
              border: "1px solid #fde68a",
              background: "#fffbeb",
              padding: "12px",
              borderRadius: "10px",
              maxWidth: "850px",
              marginBottom: "14px",
            }}
          >
            <label><strong>No Risk Justification *</strong></label><br />
            <textarea
              value={noRiskJustification}
              onChange={(e) => setNoRiskJustification(e.target.value)}
              disabled={preMrbReadOnly}
              rows={4}
              placeholder="Document the rationale supporting the No Risk determination."
              style={{ width: "100%", marginTop: "6px" }}
            />
          </div>
        ) : null}

        {riskDetermination === "overall_residual_risk" ? (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                gap: "12px",
                maxWidth: "950px",
              }}
            >
              <div>
                <label>Risk Assessment Method</label><br />
                <select
                  value={riskAssessmentMethod}
                  onChange={(e) => {
                    const nextMethod = e.target.value === "manual" ? "manual" : "automatic";
                    setRiskAssessmentMethod(nextMethod);
                    if (nextMethod === "manual") {
                      setRiskOverrideEnabled(false);
                      setRiskOverrideLevel("");
                      setRiskOverrideJustification("");
                    }
                  }}
                  disabled={preMrbReadOnly}
                  style={{ width: "100%", padding: "8px" }}
                >
                  <option value="automatic">Automatic</option>
                  <option value="manual">Manual</option>
                </select>
              </div>

              <div>
                <label>Severity</label><br />
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value)}
                  disabled={preMrbReadOnly}
                  style={{ width: "100%", padding: "8px" }}
                >
                  <option value="not_assessed">Select</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  {severity === "critical" ? (
                    <option value="critical">Critical (Legacy)</option>
                  ) : null}
                </select>
              </div>

              <div>
                <label>Occurrence</label><br />
                <select
                  value={occurrenceRating}
                  onChange={(e) => setOccurrenceRating(e.target.value)}
                  disabled={preMrbReadOnly}
                  style={{ width: "100%", padding: "8px" }}
                >
                  <option value="">Select</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div>
                <label>Detection</label><br />
                <select
                  value={detectionRating}
                  onChange={(e) => setDetectionRating(e.target.value)}
                  disabled={preMrbReadOnly}
                  style={{ width: "100%", padding: "8px" }}
                >
                  <option value="">Select</option>
                  <option value="high_detection">High Detection</option>
                  <option value="medium_detection">Medium Detection</option>
                  <option value="low_detection">Low Detection</option>
                </select>
              </div>
            </div>

            {riskAssessmentMethod === "manual" ? (
              <div style={{ marginTop: "14px", maxWidth: "420px" }}>
                <label>Manual Risk Level</label><br />
                <select
                  value={riskLevel}
                  onChange={(e) => setRiskLevel(e.target.value)}
                  disabled={preMrbReadOnly}
                  style={{ width: "100%", padding: "8px" }}
                >
                  <option value="">Select</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            ) : (
              <div
                style={{
                  border: "1px solid #bfdbfe",
                  background: "#eff6ff",
                  padding: "12px",
                  borderRadius: "10px",
                  marginTop: "14px",
                  maxWidth: "850px",
                }}
              >
                <strong>Calculated Overall Risk:</strong>{" "}
                {formatRiskLabel(
                  calculateNcmrRiskLevel(severity, occurrenceRating, detectionRating)
                ) || "Not Calculated"}
                <div style={{ marginTop: "6px", color: "#475569", fontSize: "12px" }}>
                  Controlled customer risk configuration applied.
                </div>
              </div>
            )}

            {riskAssessmentMethod === "automatic" ? (
              <div style={{ marginTop: "14px", maxWidth: "850px" }}>
                <label>Override Calculated Risk?</label><br />
                <select
                  value={riskOverrideEnabled ? "yes" : "no"}
                  onChange={(e) => {
                    const enabled = e.target.value === "yes";
                    setRiskOverrideEnabled(enabled);
                    if (!enabled) {
                      setRiskOverrideLevel("");
                      setRiskOverrideJustification("");
                    }
                  }}
                  disabled={preMrbReadOnly}
                  style={{ padding: "8px", minWidth: "180px" }}
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>

                {riskOverrideEnabled ? (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                      gap: "12px",
                      marginTop: "12px",
                    }}
                  >
                    <div>
                      <label>Override Risk Level</label><br />
                      <select
                        value={riskOverrideLevel}
                        onChange={(e) => setRiskOverrideLevel(e.target.value)}
                        disabled={preMrbReadOnly}
                        style={{ width: "100%", padding: "8px" }}
                      >
                        <option value="">Select</option>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                      </select>
                    </div>

                    <div>
                      <label>Risk Override Justification</label><br />
                      <textarea
                        value={riskOverrideJustification}
                        onChange={(e) => setRiskOverrideJustification(e.target.value)}
                        disabled={preMrbReadOnly}
                        rows={3}
                        style={{ width: "100%" }}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}

        <div style={{ marginTop: "14px", maxWidth: "850px" }}>
          <label>Risk Assessment Notes (Optional)</label><br />
          <textarea
            value={riskAssessment}
            onChange={(e) => setRiskAssessment(e.target.value)}
            disabled={preMrbReadOnly}
            placeholder="Optional rationale or supporting risk assessment notes."
            rows={3}
            style={{ width: "100%" }}
          />
        </div>

        <div
          style={{
            marginTop: "14px",
            border: "1px solid #d1d5db",
            borderRadius: "8px",
            padding: "10px 12px",
            background: "#f8fafc",
            maxWidth: "850px",
          }}
        >
          <strong>Final Effective Risk:</strong>{" "}
          {formatRiskLabel(getEffectiveRiskLevel()) || "Not Calculated"}
          {governanceConfigurationLoading ? (
            <span style={{ marginLeft: "8px", color: "#64748b", fontSize: "12px" }}>
              Loading controlled configuration…
            </span>
          ) : null}
        </div>

        {getCapaRecommendation().recommended && !linkedCapa ? (
          <div
            style={{
              border: "1px solid #bfdbfe",
              background: "#eff6ff",
              padding: "12px",
              borderRadius: "8px",
              marginTop: "14px",
              marginBottom: "12px",
              maxWidth: "850px",
            }}
          >
            <strong>CAPA Governance Signal:</strong>{" "}
            {`${formatRiskLabel(getEffectiveRiskLevel()) || "Not Assessed"} Risk`}
          </div>
        ) : null}

        {linkedCapa ? (
          <div
            style={{
              border: "1px solid #86efac",
              background: "#f0fdf4",
              padding: "12px",
              borderRadius: "8px",
              marginTop: "14px",
              maxWidth: "850px",
            }}
          >
            <strong>CAPA Linked:</strong> {linkedCapa.title}
          </div>
        ) : null}

        <SectionSaveCancelActions disabled={preMrbReadOnly} />
      </SectionCard>

      <div id="ncmr-section-product-disposition" />
      <SectionCard
        title="7. Product Disposition"
        subtitle={isMrbComplete ? "Complete: product disposition package is approved." : "Pending: complete overall and affected product disposition."}
        defaultOpen={true}
        rightAction={sectionStatusBadge(isMrbComplete, "MRB")}
      >

        <label>Product Disposition</label><br />
        <select
          value={productDisposition}
          onChange={(e) => setProductDisposition(e.target.value)}
          disabled={preMrbReadOnly}
          style={{ padding: "8px", minWidth: "240px", marginBottom: "12px" }}
        >
          <option value="">Select disposition</option>
            {dispositionOptions.map((option: any) => (
              <option
                key={option.code || option.value || option.id || option.label || option.name}
                value={option.code || option.value || option.label || option.name}
              >
                {option.label || option.name || option.disposition_label || option.disposition_name || option.code || option.value}
              </option>
            ))}
        </select>

        <br />
        <label>Disposition Justification</label><br />
        <textarea
          value={dispositionJustification}
          onChange={(e) => setDispositionJustification(e.target.value)}
          disabled={preMrbReadOnly}
          placeholder="Justify disposition based on risk assessment and investigation."
          rows={4}
          style={{ width: "100%", maxWidth: "700px" }}
        />

        <div style={{ marginTop: "18px" }}>
          <h3>Disposition by Affected Item</h3>
          <p style={{ color: "#4b5563", fontSize: "14px" }}>
            Add one disposition decision per affected item. Include quantity accepted and quantity rejected.
            If disposition is Rework, enter Accepted Quantity = 0 and Rejected Quantity = Quantity Impacted.
            Final rework disposition and final quantities are recorded by the Rework Owner in the dedicated Rework work package after MRB approval.
          </p>

          {affectedItems.length === 0 ? (
            <p>No additional affected items recorded.</p>
          ) : (
            <div style={{ display: "grid", gap: "12px" }}>
              {affectedItems.map((item) => (
                <AffectedItemCard
                  key={item.id}
                  item={item}
                  isLocked={preMrbReadOnly}
                  mrbApproved={!!record.mrb_approved_by}
                  dispositionOptions={dispositionOptions}
                  onSave={updateAffectedItemDisposition}
                />
              ))}
            </div>
          )}
        </div>


        <SectionSaveCancelActions onSave={saveMrbDispositionSection} />
      </SectionCard>

      <SectionCard
        title="8. CAPA Governance"
        subtitle={linkedCapa || record?.linked_capa_id || record?.capa_id ? "Complete: linked CAPA exists." : record?.capa_not_required_justification ? "Complete: CAPA not-required justification documented." : "Evaluate CAPA governance using Final Effective Risk, recurrence, and the active controlled governance configuration."}
        defaultOpen={false}
        rightAction={sectionStatusBadge(!!linkedCapa || !!record?.linked_capa_id || !!record?.capa_id || !!record?.capa_not_required_justification, "CAPA")}
      >
        <div
          style={{
            border: "1px solid #d1d5db",
            borderRadius: "10px",
            padding: "12px",
            background: "#f9fafb",
            marginBottom: "14px",
          }}
        >
          <h3 style={{ marginTop: 0 }}>Governance Decision Support</h3>
          <p style={{ color: "#4b5563", fontSize: "14px" }}>
            CAPA decisions are supported by the governance signal and documented quality judgment.
          </p>

          <div style={{ display: "grid", gap: "8px", maxWidth: "900px" }}>
            <div>
              <strong>Governance Decision:</strong>{" "}
              <StatusBadge status={formatCapaEvaluationOutcome(record?.capa_evaluation_outcome)} />
            </div>
            <div>
              <strong>Rationale:</strong>{" "}
              {record?.capa_evaluation_rationale || evaluateCapaGovernance().rationale}
            </div>
            <div>
              <strong>CAPA Governance Signal:</strong>{" "}
              {getCapaGovernanceSignal() || "No CAPA governance signal identified."}
            </div>
            <div>
              <strong>Configuration Control:</strong>{" "}
              Controlled customer CAPA governance configuration applied.
            </div>
          </div>
        </div>

        {linkedCapa || record?.linked_capa_id || record?.capa_id ? (
          <div
            style={{
              border: "1px solid #86efac",
              background: "#f0fdf4",
              borderRadius: "10px",
              padding: "12px",
              marginBottom: "14px",
            }}
          >
            <strong>Linked CAPA:</strong>{" "}
            <Link href={`/capa/${linkedCapa?.id || record?.linked_capa_id || record?.capa_id}`}>
              {linkedCapa?.title || "Open Linked CAPA"}
            </Link>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "14px" }}>
              <button type="button" onClick={saveCapaGovernanceEvaluation} disabled={preMrbReadOnly}>
                Save CAPA Evaluation
              </button>

              <button type="button" onClick={createGovernedCapaFromNcmr} disabled={preMrbReadOnly}>
                Create Linked CAPA
              </button>
            </div>

            <div>
              <label>Risk-Based Justification if CAPA is Not Opened</label>
              <br />
              <textarea
                value={capaNotRequiredJustification}
                onChange={(e) => setCapaNotRequiredJustification(e.target.value)}
                rows={4}
                disabled={preMrbReadOnly}
                placeholder="Document rationale if CAPA is recommended or required but not opened."
                style={{ width: "100%", maxWidth: "900px", padding: "8px" }}
              />
            </div>

            <button
              type="button"
              onClick={saveCapaNotRequiredJustification}
              disabled={preMrbReadOnly}
              style={{ marginTop: "10px" }}
            >
              Save No-CAPA Justification
            </button>
          </>
        )}

        {record?.capa_not_required_justification ? (
          <div style={{ marginTop: "12px", color: "#374151" }}>
            <strong>Saved No-CAPA Justification:</strong> {record.capa_not_required_justification}
          </div>
        ) : null}
      </SectionCard>

      <SectionCard
        title="9. Supplier / SCAR Governance"
        subtitle={linkedScar ? "Complete: linked SCAR exists for supplier governance." : scarJustification ? "Complete: no-SCAR justification documented." : "Evaluate SCAR using supplier part recorded and supplier recurrence detected."}
        defaultOpen={false}
        rightAction={sectionStatusBadge(!!linkedScar || !!scarJustification, "SCAR")}
      >
        {(() => {
          const scarEvaluation = evaluateScarGovernance();

          return (
            <div
              style={{
                border: "1px solid #d1d5db",
                borderRadius: "10px",
                padding: "12px",
                background: "#f9fafb",
                marginBottom: "14px",
              }}
            >
              <h3 style={{ marginTop: 0 }}>Supplier Governance</h3>
              <p style={{ color: "#4b5563", fontSize: "14px" }}>
                SCAR should be created through supplier risk-based decision making, not automatic supplier linkage alone.
              </p>

              <div style={{ display: "grid", gap: "8px", maxWidth: "900px" }}>
                <div>
                  <strong>Governance Decision:</strong>{" "}
                  <span
                    style={{
                      display: "inline-block",
                      border: "1px solid #d1d5db",
                      borderRadius: "999px",
                      padding: "3px 10px",
                      fontSize: "12px",
                      fontWeight: 700,
                      background: "white",
                    }}
                  >
                    {scarEvaluation.label}
                  </span>
                </div>

                <div>
                  <strong>Rationale:</strong> {scarEvaluation.rationale}
                </div>

                <div
                  style={{
                    border: "1px solid #bfdbfe",
                    background: "#eff6ff",
                    padding: "12px",
                    borderRadius: "8px",
                    marginTop: "4px",
                  }}
                >
                  <strong>SCAR Governance Signal</strong>
                  <ul style={{ marginBottom: 0 }}>
                    {scarEvaluation.triggers.map((trigger: string, index: number) => (
                      <li key={index}>{trigger}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          );
        })()}

        {linkedScar ? (
          <div
            style={{
              border: "1px solid #86efac",
              background: "#f0fdf4",
              borderRadius: "10px",
              padding: "12px",
              marginBottom: "14px",
            }}
          >
            <strong>Linked SCAR:</strong>{" "}
            <Link href={`/supplier-quality/scars/${linkedScar.id}`}>
              {linkedScar.scar_title || linkedScar.title || "Open Linked SCAR"}
            </Link>
          </div>
        ) : record?.linked_scar_id ? (
          <div
            style={{
              border: "1px solid #86efac",
              background: "#f0fdf4",
              borderRadius: "10px",
              padding: "12px",
              marginBottom: "14px",
            }}
          >
            <strong>Linked SCAR:</strong>{" "}
            <Link href={`/supplier-quality/scars/${record.linked_scar_id}`}>
              Open Linked SCAR
            </Link>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "14px" }}>
              <button type="button" onClick={createScarFromNcmr} disabled={preMrbReadOnly}>
                Create Linked SCAR
              </button>
            </div>

            <div>
              <label>Risk-Based Justification if SCAR is Not Opened</label>
              <br />
              <textarea
                value={scarJustification}
                onChange={(e) => setScarJustification(e.target.value)}
                rows={4}
                disabled={preMrbReadOnly}
                placeholder="Document the risk-based rationale if supplier corrective action is not required."
                style={{ width: "100%", maxWidth: "800px", padding: "8px" }}
              />
            </div>

            <button
              type="button"
              onClick={saveScarJustification}
              disabled={preMrbReadOnly}
              style={{ marginTop: "10px" }}
            >
              Save SCAR Justification
            </button>
          </>
        )}

        {record?.scar_justification ? (
          <div style={{ marginTop: "12px", color: "#374151" }}>
            <strong>Saved SCAR Justification:</strong> {record.scar_justification}
          </div>
        ) : null}
      </SectionCard>

      <div id="ncmr-section-mrb-approval" />
      <SectionCard
        title="10. MRB Approval"
        subtitle={isMrbComplete ? "Complete: all required MRB approvals are complete." : "Pending: generate approval tasks and complete MRB approval."}
        defaultOpen={true}
        rightAction={sectionStatusBadge(isMrbComplete, "MRB")}
      >

        <div
          style={{
            marginTop: "18px",
            border: "1px solid #d1d5db",
            borderRadius: "8px",
            padding: "12px",
            background: "#f9fafb",
          }}
        >
          <h3 style={{ marginTop: 0 }}>MRB Approval</h3>

          {record.mrb_approved_by ? (
            <div
              style={{
                border: "1px solid #86efac",
                borderRadius: "10px",
                padding: "14px",
                background: "#f0fdf4",
                color: "#166534",
              }}
            >
              <strong>MRB Approved</strong>
              <p style={{ margin: "6px 0 0" }}>
                All required reviewers approved the submitted MRB package.
                Implementation is unlocked.
              </p>
            </div>
          ) : hasActiveMrbApprovalWorkflow() ? (
            <div
              style={{
                border: "1px solid #bfdbfe",
                borderRadius: "10px",
                padding: "14px",
                background: "#eff6ff",
                color: "#1e3a8a",
              }}
            >
              <strong>MRB Approval Pending</strong>
              <p style={{ margin: "6px 0 0" }}>
                The MRB package has been submitted. Required reviewers will
                complete their decisions from My Workspace.
              </p>
            </div>
          ) : (
            <>
              {hasRejectedMrbApprovalTask() ? (
                <div
                  style={{
                    border: "1px solid #fca5a5",
                    borderRadius: "10px",
                    padding: "14px",
                    background: "#fef2f2",
                    color: "#991b1b",
                    marginBottom: "14px",
                  }}
                >
                  <strong>MRB Approval Rejected — Returned for Revision</strong>
                  <p style={{ margin: "6px 0 0" }}>
                    The prior approval cycle is complete and preserved in the
                    audit history. Revise the applicable NCMR information,
                    confirm or update the reviewer configuration below, and
                    submit a new MRB approval package.
                  </p>
                </div>
              ) : null}

              <p style={{ color: "#4b5563", fontSize: "14px" }}>
                Select an approval matrix or add reviewers manually. When the
                reviewer list is complete, submit the MRB package for approval.
                Required reviewers receive approval tasks in My Workspace.
              </p>

              <div
                style={{
                  display: "grid",
                  gap: "14px",
                  maxWidth: "1100px",
                }}
              >
                <div>
                  <label style={{ fontWeight: 800 }}>Approval Matrix</label>
                  <br />
                  <select
                    value={selectedApprovalMatrixId}
                    onChange={(event) =>
                      setSelectedApprovalMatrixId(event.target.value)
                    }
                    style={{
                      padding: "9px",
                      width: "100%",
                      maxWidth: "620px",
                      marginTop: "6px",
                    }}
                  >
                    <option value="">Select NCMR approval matrix</option>
                    {approvalMatrixTemplates.map((template: any) => (
                      <option key={template.id} value={template.id}>
                        {template.template_name ||
                          template.name ||
                          template.title ||
                          "Approval Matrix"}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={loadMrbApproversFromMatrix}
                    disabled={!selectedApprovalMatrixId}
                    style={{ marginTop: "8px" }}
                  >
                    Add MRB Approvers from Matrix
                  </button>
                </div>

                <div
                  style={{
                    border: "1px solid #d1d5db",
                    borderRadius: "10px",
                    padding: "12px",
                    background: "white",
                  }}
                >
                  <strong>Add MRB Approver</strong>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(190px, 1fr))",
                      gap: "10px",
                      marginTop: "10px",
                    }}
                  >
                    <div>
                      <label>Function</label>
                      <br />
                      <input
                        value={manualMrbApproverFunction}
                        onChange={(event) =>
                          setManualMrbApproverFunction(event.target.value)
                        }
                        placeholder="Quality, Operations, Regulatory..."
                        style={{ padding: "8px", width: "100%" }}
                      />
                    </div>

                    <div>
                      <label>Job Title</label>
                      <br />
                      <input
                        value={manualMrbApproverJobTitle}
                        onChange={(event) =>
                          setManualMrbApproverJobTitle(event.target.value)
                        }
                        placeholder="Quality Manager"
                        style={{ padding: "8px", width: "100%" }}
                      />
                    </div>

                    <div>
                      <label>Reviewer Email</label>
                      <br />
                      <input
                        type="email"
                        value={manualMrbApproverEmail}
                        onChange={(event) =>
                          setManualMrbApproverEmail(event.target.value)
                        }
                        placeholder="reviewer@company.com"
                        style={{ padding: "8px", width: "100%" }}
                      />
                    </div>

                    <div>
                      <label>Approve By</label>
                      <br />
                      <input
                        type="date"
                        value={manualMrbApproverDueDate}
                        onChange={(event) =>
                          setManualMrbApproverDueDate(event.target.value)
                        }
                        style={{ padding: "8px", width: "100%" }}
                      />
                    </div>

                    <label style={{ alignSelf: "end", paddingBottom: "8px" }}>
                      <input
                        type="checkbox"
                        checked={manualMrbApproverRequired}
                        onChange={(event) =>
                          setManualMrbApproverRequired(event.target.checked)
                        }
                      />{" "}
                      Required: {manualMrbApproverRequired ? "Yes" : "No"}
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={addManualMrbApprover}
                    style={{ marginTop: "10px" }}
                  >
                    + Add MRB Approver
                  </button>
                </div>
              </div>

              <h4>MRB Reviewers</h4>

              {mrbApprovers.length === 0 ? (
                <p>
                  No MRB reviewers configured. Select an approval matrix or add
                  reviewers manually.
                </p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      marginTop: "8px",
                      minWidth: "900px",
                    }}
                  >
                    <thead>
                      <tr>
                        <th style={approvalTableHeaderStyle}>Function</th>
                        <th style={approvalTableHeaderStyle}>Job Title</th>
                        <th style={approvalTableHeaderStyle}>
                          Reviewer Email
                        </th>
                        <th style={approvalTableHeaderStyle}>Required</th>
                        <th style={approvalTableHeaderStyle}>Approve By</th>
                        <th style={approvalTableHeaderStyle}>Action</th>
                      </tr>
                    </thead>

                    <tbody>
                      {mrbApprovers.map(
                        (approver: any, index: number) => (
                          <tr
                            key={
                              approver.id ||
                              `${approver.approver_email}-${index}`
                            }
                          >
                            <td style={approvalTableCellStyle}>
                              {approver.approver_function || "MRB Approval"}
                            </td>
                            <td style={approvalTableCellStyle}>
                              {approver.approver_job_title ||
                                approver.approver_role ||
                                "MRB Approver"}
                            </td>
                            <td style={approvalTableCellStyle}>
                              {approver.approver_email}
                            </td>
                            <td style={approvalTableCellStyle}>
                              {approver.is_required === false ? "No" : "Yes"}
                            </td>
                            <td style={approvalTableCellStyle}>
                              {formatIsoDate(approver.approver_due_date)}
                            </td>
                            <td style={approvalTableCellStyle}>
                              <button
                                type="button"
                                onClick={() =>
                                  removeMrbApprover(approver)
                                }
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              <div style={{ marginTop: "14px" }}>
                <button
                  type="button"
                  onClick={submitForMrbApproval}
                  disabled={
                    mrbApprovers.length === 0 || submittingMrbApproval
                  }
                  style={{
                    background: "#2563eb",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    padding: "10px 14px",
                    fontWeight: 800,
                    cursor:
                      mrbApprovers.length === 0 || submittingMrbApproval
                        ? "not-allowed"
                        : "pointer",
                    opacity:
                      mrbApprovers.length === 0 || submittingMrbApproval
                        ? 0.55
                        : 1,
                  }}
                >
                  {submittingMrbApproval
                    ? "Submitting..."
                    : "Submit for MRB Approval"}
                </button>
              </div>
            </>
          )}
        </div>

        {hasReworkDisposition() && record.mrb_approved_by ? (
          <div style={{ marginTop: "18px", border: "1px solid #bfdbfe", borderRadius: "8px", padding: "12px", background: "#eff6ff" }}>
            <h3 style={{ marginTop: 0 }}>Rework Task Assignment</h3>
            <p style={{ color: "#1f2937", fontSize: "14px" }}>Rework is applicable based on the approved MRB disposition. The NCMR owner may provide the task and an optional assignment attachment. A returned task must be revised/reassigned and resubmitted using the same task record.</p>

            {getReturnedReworkTask() && !editingReturnedReworkTaskId ? (
              <div style={{ marginBottom: "14px", border: "1px solid #facc15", borderRadius: "10px", padding: "12px", background: "#fefce8", color: "#854d0e" }}>
                <strong>Rework Task Returned — Owner Action Required</strong>
                <div style={{ marginTop: "8px" }}>
                  <strong>Assigned To:</strong> {getReturnedReworkTask()?.assigned_to_email || "N/A"}<br />
                  <strong>Returned By:</strong> {getReturnedReworkTask()?.returned_by || "N/A"}<br />
                  <strong>Returned At:</strong> {formatIsoDateTime(getReturnedReworkTask()?.returned_at)}<br />
                  <strong>Return Reason:</strong> {getReturnedReworkTask()?.returned_reason || "N/A"}
                </div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "12px" }}>
                  <button type="button" onClick={() => prepareReturnedReworkTaskForRevision(getReturnedReworkTask(), false)} disabled={isLocked}>Revise & Resubmit Rework Task</button>
                  <button type="button" onClick={() => prepareReturnedReworkTaskForRevision(getReturnedReworkTask(), true)} disabled={isLocked}>Reassign Returned Rework Task</button>
                </div>
              </div>
            ) : null}

            {(!hasActiveOrCompletedReworkTask() || !!editingReturnedReworkTaskId) ? (
              <div id="rework-task-assignment-editor" style={{ border: editingReturnedReworkTaskId ? "1px solid #facc15" : "none", background: editingReturnedReworkTaskId ? "#fffdf2" : "transparent", borderRadius: "10px", padding: editingReturnedReworkTaskId ? "12px" : "0" }}>
                {editingReturnedReworkTaskId ? <div style={{ fontWeight: 800, color: "#854d0e", marginBottom: "10px" }}>Revise / Reassign Returned Rework Task</div> : null}
                <div style={{ display: "grid", gap: "12px", maxWidth: "700px" }}>
                  <div><label>Assigned To Email</label><br /><input value={reworkTaskAssignee} onChange={(e) => setReworkTaskAssignee(e.target.value)} disabled={isLocked || submittingReworkTask} style={{ padding: "8px", width: "100%" }} /></div>
                  <div><label>Due Date</label><br /><input type="date" value={reworkTaskDueDate} onChange={(e) => setReworkTaskDueDate(e.target.value)} disabled={isLocked || submittingReworkTask} style={{ padding: "8px", width: "100%" }} /></div>
                </div>
                <div style={{ marginTop: "10px" }}><label>Rework Task</label><br /><textarea value={reworkTaskInstructions} onChange={(e) => setReworkTaskInstructions(e.target.value)} disabled={isLocked || submittingReworkTask} rows={4} placeholder="Describe the assigned Rework activity. The task may instruct the assignee to develop/review a detailed Rework instruction externally, execute it, inspect the material, and document final disposition." style={{ width: "100%", maxWidth: "700px" }} /></div>
                <div style={{ marginTop: "12px", maxWidth: "700px" }}>
                  <label><strong>Rework Task Assignment Attachment (Optional)</strong></label><br />
                  <input type="file" multiple disabled={isLocked || submittingReworkTask} onChange={(event) => { const files = Array.from(event.target.files || []) as File[]; setReworkTaskAssignmentFiles((current) => { const keys = new Set(current.map((file) => `${file.name}:${file.size}:${file.lastModified}`)); return [...current, ...files.filter((file) => !keys.has(`${file.name}:${file.size}:${file.lastModified}`))]; }); event.currentTarget.value = ""; }} style={{ marginTop: "6px" }} />
                  <div style={{ color: "#64748b", fontSize: "13px", marginTop: "6px" }}>Optional: attach an existing approved Rework instruction, traveler, drawing, protocol, or other information provided to the Rework Owner before execution.</div>
                  {editingReturnedReworkTaskId && Array.isArray(getReturnedReworkTask()?.assignment_attachments) && getReturnedReworkTask().assignment_attachments.length > 0 ? <div style={{ marginTop: "10px" }}><strong>Existing Assignment Attachment(s)</strong><div style={{ display: "grid", gap: "5px", marginTop: "5px" }}>{getReturnedReworkTask().assignment_attachments.map((attachment: any, index: number) => <a key={`existing-${attachment?.storage_path || attachment?.url || index}`} href={attachment?.url} target="_blank" rel="noreferrer">📎 {attachment?.name || `Assignment Attachment ${index + 1}`}</a>)}</div></div> : null}
                  {reworkTaskAssignmentFiles.length > 0 ? <div style={{ display: "grid", gap: "6px", marginTop: "10px" }}>{reworkTaskAssignmentFiles.map((file, index) => <div key={`${file.name}-${file.size}-${file.lastModified}`} style={{ display: "flex", justifyContent: "space-between", gap: "10px", border: "1px solid #e2e8f0", background: "white", borderRadius: "8px", padding: "8px 10px" }}><span>📎 {file.name}</span><button type="button" onClick={() => setReworkTaskAssignmentFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))} disabled={submittingReworkTask}>Remove</button></div>)}</div> : null}
                </div>
                <button type="button" onClick={submitReworkTask} disabled={isLocked || submittingReworkTask} style={{ marginTop: "12px" }}>{submittingReworkTask ? "Submitting..." : editingReturnedReworkTaskId ? "Resubmit Rework Task" : "Submit Rework Task"}</button>
                <button type="button" onClick={clearReworkTaskAssignmentDraft} disabled={isLocked || submittingReworkTask} style={{ marginTop: "12px", marginLeft: "8px" }}>{editingReturnedReworkTaskId ? "Cancel Revision" : "Cancel Rework Task Entry"}</button>
              </div>
            ) : !getReturnedReworkTask() ? (
              <div style={{ marginTop: "10px", border: "1px solid #bfdbfe", borderRadius: "8px", padding: "10px", background: "#eff6ff", color: "#1e3a8a" }}>Rework task assignment is locked because a pending or completed Rework task already exists.</div>
            ) : null}

            <div id="rework-verification" />
            <h4>Rework Task Status</h4>
            {reworkTasks.length === 0 ? <p>No rework tasks submitted.</p> : <TaskStatusList tasks={reworkTasks} />}

            {hasCompletedReworkTask() ? (
              <div style={{ marginTop: "18px", border: "1px solid #86efac", borderRadius: "8px", padding: "12px", background: "#f0fdf4" }}>
                <h3 style={{ marginTop: 0 }}>Rework Implementation Verification</h3>
                <p style={{ color: "#166534", fontSize: "14px" }}>Review the assigned Rework task, task completion comment, objective evidence, attachments, final disposition, and reconciled final quantities before independently verifying the Rework.</p>
                <div style={{ display: "grid", gap: "12px" }}>
                  {reworkTasks.filter((task: any) => String(task?.status || "").trim().toLowerCase() === "completed").map((task: any) => (
                    <ReworkOwnerVerificationCard key={task.id} task={task} items={getReworkAffectedItems()} canVerify={!record?.is_locked && normalizeApproverEmail(record?.owner || record?.owner_email) === normalizeApproverEmail(userEmail)} onVerify={verifyReworkTask} />
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ marginTop: "14px", border: "1px solid #facc15", borderRadius: "8px", padding: "10px", background: "#fefce8", color: "#854d0e" }}>Rework Implementation Verification unlocks after the active Rework task is completed.</div>
            )}
          </div>
        ) : null}


      </SectionCard>

      <SectionCard
        title="11. Disposition Implementation"
        subtitle={
          !isMrbApproved()
            ? "Pending: MRB approval is required before disposition implementation."
            : isDispositionImplementationComplete
            ? "Complete: all applicable non-Rework dispositions are implemented and reconciled."
            : "Pending: implement each applicable approved disposition and reconcile final quantities."
        }
        defaultOpen={false}
        rightAction={sectionStatusBadge(isDispositionImplementationComplete, "Disposition Implementation")}
      >
        {!isMrbApproved() ? (
          <div
            style={{
              border: "1px solid #facc15",
              background: "#fefce8",
              color: "#854d0e",
              padding: "12px",
              borderRadius: "8px",
              marginBottom: "12px",
            }}
          >
            <strong>MRB approval required</strong>
            <br />
            Approved item dispositions become available for implementation after MRB approval.
          </div>
        ) : getDispositionImplementationItems().length === 0 ? (
          <div
            style={{
              border: "1px solid #86efac",
              background: "#f0fdf4",
              color: "#166534",
              padding: "12px",
              borderRadius: "8px",
            }}
          >
            No separate non-Rework disposition implementation is required. Rework items continue through the dedicated Rework task and final disposition pathway.
          </div>
        ) : (
          <div style={{ display: "grid", gap: "14px" }}>
            <div
              style={{
                border: "1px solid #bfdbfe",
                background: "#eff6ff",
                color: "#1e3a8a",
                padding: "12px",
                borderRadius: "8px",
              }}
            >
              <strong>MRB decision is preserved.</strong> MRB Quantity Accepted and Quantity Rejected are read-only here. Disposition Implementation records what actually occurred. Use As Is and Accept Per Specification may document a controlled quantity discrepancy and final quantities without rewriting the approved MRB decision.
            </div>

            {getDispositionImplementationItems().map((item: any) => (
              <DispositionImplementationCard
                key={item.id}
                item={item}
                isLocked={isPostMrbSectionLocked()}
                onSave={saveDispositionImplementation}
              />
            ))}
          </div>
        )}

        <SectionSaveCancelActions />
      </SectionCard>

      <div id="correction-implementation" />
      <SectionCard
        title="12. Correction / Corrective Action Implementation"
        subtitle={isImplementationComplete ? "Complete: implementation requirements are satisfied." : isCorrectionNotRequired() ? "Pending: document correction-not-required justification." : "Pending: assign/complete a Correction or Corrective Action task and document implementation."}
        defaultOpen={false}
        rightAction={sectionStatusBadge(isImplementationComplete, "Implementation")}
      >

        {!isMrbApproved() ? (
          <div
            style={{
              border: "1px solid #facc15",
              background: "#fefce8",
              color: "#854d0e",
              padding: "12px",
              borderRadius: "8px",
              marginBottom: "12px",
            }}
          >
            <strong>MRB approval required</strong>
            <br />
            Implementation, evidence, rework execution, and closure activities unlock after MRB approval.
          </div>
        ) : null}

        {isCorrectionNotRequired() ? (
          <div
            style={{
              border: "1px solid #86efac",
              borderRadius: "8px",
              padding: "12px",
              background: "#f0fdf4",
              color: "#166534",
              marginBottom: "12px",
            }}
          >
            <h3 style={{ marginTop: 0 }}>Correction Not Required</h3>
            <p style={{ marginBottom: "8px" }}>
              Correction task assignment is skipped because the correction proposal is set to "No correction required."
            </p>
            <strong>Required Justification:</strong>
            <div style={{ marginTop: "6px", color: "#14532d" }}>
              {correctiveAction || "Document the justification in the Corrective Action section."}
            </div>
          </div>
        ) : (
<>
        <div
          style={{
            border: "1px solid #d1d5db",
            borderRadius: "8px",
            padding: "12px",
            background: "#f9fafb",
            marginBottom: "12px",
          }}
        >
          <h3 style={{ marginTop: 0 }}>Correction / Corrective Action Task Assignment</h3>
          <p style={{ color: "#4b5563", fontSize: "14px" }}>
            Choose the implementation type, then assign the work to an owner. The assignee completes only the assigned implementation package from My Workspace.
          </p>

          {(getActiveImplementationTasks().length === 0 || showAdditionalImplementationTaskForm) ? (
            <>
              {getActiveImplementationTasks().length > 0 ? (
                <div
                  style={{
                    border: "1px solid #bfdbfe",
                    background: "#eff6ff",
                    color: "#1e3a8a",
                    borderRadius: "8px",
                    padding: "10px",
                    marginBottom: "12px",
                  }}
                >
                  Add an independent Correction or Corrective Action implementation task. Existing tasks remain unchanged and independently traceable.
                </div>
              ) : null}

              <div style={{ display: "grid", gap: "12px", maxWidth: "700px" }}>
                <div>
                  <label>Implementation Type</label><br />
                  <select
                    value={implementationTaskType}
                    onChange={(e) =>
                      setImplementationTaskType(
                        e.target.value as "correction" | "corrective_action"
                      )
                    }
                    disabled={isPostMrbSectionLocked()}
                    style={{ padding: "8px", width: "100%" }}
                  >
                    <option value="correction">Correction</option>
                    <option value="corrective_action">Corrective Action</option>
                  </select>
                </div>

                <div>
                  <label>Assigned To Email</label><br />
                  <input
                    value={correctionTaskAssignee}
                    onChange={(e) => setCorrectionTaskAssignee(e.target.value)}
                    disabled={isPostMrbSectionLocked()}
                    style={{ padding: "8px", width: "100%" }}
                  />
                </div>

                <div>
                  <label>Due Date</label><br />
                  <input
                    type="date"
                    value={correctionTaskDueDate}
                    onChange={(e) => setCorrectionTaskDueDate(e.target.value)}
                    disabled={isPostMrbSectionLocked()}
                    style={{ padding: "8px", width: "100%" }}
                  />
                </div>
              </div>

              <div style={{ marginTop: "10px" }}>
                <label>Implementation Instructions</label><br />
                <textarea
                  value={correctionTaskInstructions}
                  onChange={(e) => setCorrectionTaskInstructions(e.target.value)}
                  disabled={isPostMrbSectionLocked()}
                  rows={3}
                  style={{ width: "100%", maxWidth: "700px" }}
                />
              </div>

              <button
                type="button"
                onClick={submitImplementationTask}
                disabled={isPostMrbSectionLocked() || submittingImplementationTask}
                style={{ marginTop: "10px" }}
              >
                {submittingImplementationTask ? "Submitting..." : "Submit Implementation Task"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCorrectionTaskAssignee("");
                  setCorrectionTaskDueDate("");
                  setCorrectionTaskInstructions("");
                  setImplementationTaskType("correction");
                  setShowAdditionalImplementationTaskForm(false);
                }}
                disabled={isPostMrbSectionLocked()}
                style={{ marginTop: "10px", marginLeft: "8px" }}
              >
                Cancel Implementation Task Entry
              </button>
            </>
          ) : (
            <div
              style={{
                marginTop: "10px",
                border: "1px solid #bfdbfe",
                borderRadius: "8px",
                padding: "10px",
                background: "#eff6ff",
                color: "#1e3a8a",
              }}
            >
              <div>
                The current implementation task assignment is submitted. Existing tasks remain independently traceable below.
              </div>
              <button
                type="button"
                onClick={() => {
                  setImplementationTaskType("correction");
                  setCorrectionTaskAssignee("");
                  setCorrectionTaskDueDate("");
                  setCorrectionTaskInstructions("");
                  setShowAdditionalImplementationTaskForm(true);
                }}
                disabled={isPostMrbSectionLocked()}
                style={{ marginTop: "10px" }}
              >
                Add Another Implementation Task
              </button>
            </div>
          )}

          <h4>Correction / Corrective Action Task Status & Verification</h4>
          {correctionTasks.length === 0 ? (
            <p>No implementation tasks submitted.</p>
          ) : (
            <ImplementationTaskVerificationList
              tasks={correctionTasks}
              canVerify={
                !isPostMrbSectionLocked() &&
                normalizeApproverEmail(record?.owner || record?.owner_email) ===
                  normalizeApproverEmail(userEmail)
              }
              onVerify={verifyImplementationTask}
            />
          )}
        </div>

</>
        )}

        <SectionSaveCancelActions />
      </SectionCard>

      <SectionCard
        title="13. Evidence"
        subtitle={isEvidenceComplete ? "Complete: evidence is linked." : "Optional/Pending: upload or link supporting evidence."}
        defaultOpen={false}
        rightAction={sectionStatusBadge(isEvidenceComplete, "Evidence")}
      >

        <input
          type="file"
          onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
          disabled={isPostMrbSectionLocked()}
        />
        <button
          onClick={uploadEvidence}
          disabled={uploading || isPostMrbSectionLocked()}
          style={{ marginLeft: "10px" }}
        >
          {uploading ? "Uploading..." : "Upload Evidence"}
        </button>

        <div style={{ marginTop: "12px" }}>
          <label>Evidence URL</label><br />
          <input
            value={evidenceUrl}
            onChange={(e) => setEvidenceUrl(e.target.value)}
            disabled={isPostMrbSectionLocked()}
            style={{ width: "100%", maxWidth: "800px", padding: "8px" }}
          />
        </div>

        <div style={{ marginTop: "12px" }}>
          <label>Evidence Notes</label><br />
          <textarea
            value={evidenceNotes}
            onChange={(e) => setEvidenceNotes(e.target.value)}
            rows={3}
            disabled={isPostMrbSectionLocked()}
            style={{ width: "100%", maxWidth: "700px" }}
          />
        </div>

        {record.evidence_url ? (
          <p>
            <strong>Saved Evidence:</strong>{" "}
            <a href={record.evidence_url} target="_blank" rel="noreferrer">
              Open Evidence
            </a>
          </p>
        ) : null}

        <SectionSaveCancelActions />
      </SectionCard>

      <SectionCard
        title="MRB Approval History"
        subtitle="Approval task decisions, signer identity, comments, and timestamps."
        defaultOpen={false}
        rightAction={
          <span
            style={{
              border: "1px solid #d1d5db",
              background: "#f9fafb",
              color: "#374151",
              borderRadius: "999px",
              padding: "4px 10px",
              fontSize: "12px",
              fontWeight: 700,
            }}
          >
            {approvalHistory.length} decision(s)
          </span>
        }
      >
        {approvalTasks.length === 0 ? (
          <p>No MRB approval tasks generated yet.</p>
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            {approvalTasks.map((task) => (
              <div
                key={task.id}
                style={{
                  border:
                    task.status === "approved"
                      ? "1px solid #86efac"
                      : task.status === "rejected"
                      ? "1px solid #fca5a5"
                      : "1px solid #facc15",
                  background:
                    task.status === "approved"
                      ? "#f0fdf4"
                      : task.status === "rejected"
                      ? "#fef2f2"
                      : "#fefce8",
                  borderRadius: "10px",
                  padding: "12px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                  <strong>{task.required_function || task.task_title || "Approval Task"}</strong>
                  <span>{task.status || "pending"}</span>
                </div>
                <div style={{ marginTop: "8px", fontSize: "14px" }}>
                  <div><strong>Assigned To:</strong> {task.assigned_to_email || "N/A"}</div>
                  <div><strong>Signed By:</strong> {task.signed_by || "N/A"}</div>
                  <div><strong>Signed At:</strong> {task.signed_at || "N/A"}</div>
                  <div><strong>Comment:</strong> {task.approver_comment || "N/A"}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="NCMR Timeline / Activity Feed"
        subtitle="Audit-ready history of major NCMR actions captured from audit logs."
        defaultOpen={false}
        rightAction={
          <span
            style={{
              border: "1px solid #d1d5db",
              background: "#f9fafb",
              color: "#374151",
              borderRadius: "999px",
              padding: "4px 10px",
              fontSize: "12px",
              fontWeight: 700,
            }}
          >
            {auditTimeline.length} event(s)
          </span>
        }
      >
        <div style={{ marginBottom: "12px" }}>
          <label>Filter timeline events</label><br />
          <input
            value={timelineFilter}
            onChange={(e) => setTimelineFilter(e.target.value)}
            placeholder="Search action, details, or user"
            style={{ width: "100%", maxWidth: "500px", padding: "8px" }}
          />

          {timelineFilter ? (
            <button
              type="button"
              onClick={() => setTimelineFilter("")}
              style={{ marginLeft: "8px" }}
            >
              Clear
            </button>
          ) : null}
        </div>

        {auditTimeline.length === 0 ? (
          <p>No activity recorded yet.</p>
        ) : filteredAuditTimeline.length === 0 ? (
          <p>No timeline events match the filter.</p>
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            {filteredAuditTimeline.map((event) => (
              <div
                key={event.id}
                style={{
                  border: "1px solid #d1d5db",
                  borderRadius: "10px",
                  padding: "12px",
                  background: "white",
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
                  <strong>{event.action || "Activity"}</strong>
                  <span style={{ color: "#4b5563", fontSize: "13px" }}>
                    {formatIsoDateTime(event.created_at)}
                  </span>
                </div>

                <div style={{ marginTop: "8px", color: "#374151" }}>
                  {event.details || "No details provided."}
                </div>

                <div style={{ marginTop: "8px", color: "#6b7280", fontSize: "13px" }}>
                  <strong>User:</strong> {event.user_email || "unknown"}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="14. Closure"
        subtitle={isClosureComplete ? "Complete: NCMR is closed and locked." : "Pending: complete closure review and e-signature."}
        defaultOpen={false}
        rightAction={sectionStatusBadge(isClosureComplete, "Closure")}
      >

        <label>Review Status</label><br />
        <select
          value={reviewStatus}
          onChange={(e) => setReviewStatus(e.target.value)}
          disabled={isPostMrbSectionLocked()}
          style={{ padding: "8px", marginBottom: "12px" }}
        >
          <option value="draft">Draft</option>
          <option value="in_review">In Review</option>
          <option value="completed">Completed</option>
        </select>

        <div
          style={{
            marginTop: "16px",
            border: "1px solid #cbd5e1",
            borderRadius: "8px",
            padding: "12px",
            background: "#f8fafc",
          }}
        >
          <h3 style={{ marginTop: 0 }}>Closure Electronic Signature</h3>
          <p style={{ color: "#4b5563", fontSize: "14px" }}>
            Signature Meaning: I certify that I am the logged-in user and I have completed final quality review of this NCMR, including investigation, risk assessment, CAPA decision, disposition, MRB approval, correction implementation, evidence, and closure readiness.
          </p>

          <label>Re-enter Your Email for Closure E-Signature</label><br />
          <input
            value={closureSignatureEmail}
            onChange={(e) => setClosureSignatureEmail(e.target.value)}
            placeholder={userEmail || "your.email@company.com"}
            disabled={isPostMrbSectionLocked()}
            style={{ width: "100%", maxWidth: "500px", padding: "8px" }}
          />

          <div style={{ marginTop: "8px", color: "#6b7280", fontSize: "13px" }}>
            <strong>Logged-in User:</strong> {userEmail || "none"}<br />
            <strong>Signature Timestamp:</strong> recorded automatically at closure
          </div>
        </div>

        {/* Section 9 Closure Action Buttons */}
        <div
          style={{
            border: "1px solid #d1d5db",
            borderRadius: "8px",
            padding: "12px",
            background: "#f9fafb",
            marginTop: "16px",
          }}
        >
          <h3 style={{ marginTop: 0 }}>Closure Actions</h3>
          <p style={{ color: "#4b5563", fontSize: "14px" }}>
            Save workflow updates, close the NCMR with e-signature, or return to the NCMR list.
          </p>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button onClick={saveWorkflow} disabled={isPostMrbSectionLocked()}>
              Save Workflow
            </button>

            <button onClick={closeNcmr} disabled={isPostMrbSectionLocked()}>
              Close NCMR with E-Signature
            </button>

            <a
              href="/ncmrs"
              style={{
                display: "inline-block",
                padding: "8px 12px",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
                textDecoration: "none",
                color: "#111827",
                background: "white",
              }}
            >
              Cancel / Back to NCMRs
            </a>
          </div>
        </div>

        {record.ncmr_closed_by ? (
          <div style={{ marginTop: "12px" }}>
            <strong>NCMR Closed By:</strong> {record.ncmr_closed_by}<br />
            <strong>Closed At:</strong> {record.closed_at}<br />
            <strong>Signature Email Entered:</strong> {record.ncmr_signature_email_entered || "N/A"}<br />
            <strong>Signature Meaning:</strong> {record.ncmr_signature_meaning}
          </div>
        ) : null}

      </SectionCard>

      <div style={{ marginTop: "20px" }}>
        <a href="/ncmrs">Back to NCMRs</a>
      </div>
    </main>
  );
}


function formatNcmrDate(value: any) { if (!value) return "N/A"; try { const date = new Date(value); if (Number.isNaN(date.getTime())) return String(value); const day=String(date.getDate()).padStart(2,"0"); const month=date.toLocaleString("en-US",{month:"short"}); return `${day}-${month}-${date.getFullYear()}`; } catch { return String(value); } }
function formatNcmrDateTime(value: any) { if (!value) return "N/A"; try { const date = new Date(value); if (Number.isNaN(date.getTime())) return String(value); return `${formatNcmrDate(value)} ${date.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"})}`; } catch { return String(value); } }

function ImplementationTaskVerificationList({
  tasks,
  canVerify,
  onVerify,
}: {
  tasks: any[];
  canVerify: boolean;
  onVerify: (taskId: string, verificationComment: string) => void;
}) {
  return (
    <div style={{ display: "grid", gap: "12px" }}>
      {tasks.map((task: any) => (
        <ImplementationTaskVerificationCard
          key={task.id}
          task={task}
          canVerify={canVerify}
          onVerify={onVerify}
        />
      ))}
    </div>
  );
}

function ImplementationTaskVerificationCard({
  task,
  canVerify,
  onVerify,
}: {
  task: any;
  canVerify: boolean;
  onVerify: (taskId: string, verificationComment: string) => void;
}) {
  const [verificationComment, setVerificationComment] = useState(
    task?.implementation_verification_comment || ""
  );

  useEffect(() => {
    setVerificationComment(task?.implementation_verification_comment || "");
  }, [task?.implementation_verification_comment]);

  const taskStatus = String(task?.status || "").trim().toLowerCase();
  const verificationStatus = String(
    task?.implementation_verification_status || "pending"
  )
    .trim()
    .toLowerCase();

  const isCancelled = taskStatus === "cancelled";
  const isCompleted = taskStatus === "completed";
  const isVerified =
    isCompleted &&
    verificationStatus === "verified" &&
    !!task?.implementation_verified_by &&
    !!task?.implementation_verified_at;

  const taskTypeLabel =
    task?.task_type === "corrective_action_task"
      ? "Corrective Action"
      : "Correction";

  const border = isCancelled
    ? "1px solid #d1d5db"
    : isVerified
    ? "1px solid #86efac"
    : isCompleted
    ? "1px solid #93c5fd"
    : "1px solid #facc15";

  const background = isCancelled
    ? "#f9fafb"
    : isVerified
    ? "#f0fdf4"
    : isCompleted
    ? "#eff6ff"
    : "#fefce8";

  return (
    <div
      style={{
        border,
        background,
        borderRadius: "10px",
        padding: "12px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "12px",
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: "10px",
        }}
      >
        <div>
          <strong>
            {taskTypeLabel}: {task?.task_title || task?.required_function || "Implementation Task"}
          </strong>
        </div>

        <div>
          <strong>Task Status:</strong>{" "}
          {taskStatus || "pending"}
          {isCompleted ? (
            <>
              {" "}• <strong>Owner Verification:</strong>{" "}
              {isVerified ? "Verified" : "Pending"}
            </>
          ) : null}
        </div>
      </div>

      <div
        style={{
          border: "1px solid #dbeafe",
          background: "#ffffff",
          borderRadius: "8px",
          padding: "10px",
          marginBottom: "10px",
        }}
      >
        <strong>Task Instructions</strong>
        <div style={{ marginTop: "5px", whiteSpace: "pre-wrap" }}>
          {task?.task_instructions || task?.comments || "N/A"}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "8px",
          marginBottom: "10px",
        }}
      >
        <div>
          <strong>Assigned To:</strong> {task?.assigned_to_email || "N/A"}
        </div>
        <div>
          <strong>Due Date:</strong> {formatNcmrDate(task?.due_date)}
        </div>
        <div>
          <strong>Completed By:</strong>{" "}
          {task?.completed_by || task?.signed_by || "N/A"}
        </div>
        <div>
          <strong>Completed At:</strong>{" "}
          {formatNcmrDateTime(task?.completed_at || task?.signed_at)}
        </div>
      </div>

      <div
        style={{
          border: "1px solid #e5e7eb",
          background: "#ffffff",
          borderRadius: "8px",
          padding: "10px",
          marginBottom: "10px",
        }}
      >
        <strong>Task Owner Completion Comment</strong>
        <div style={{ marginTop: "5px", whiteSpace: "pre-wrap" }}>
          {task?.completion_comment || task?.approver_comment || "N/A"}
        </div>
      </div>

      <div style={{ border: "1px solid #e5e7eb", background: "#ffffff", borderRadius: "8px", padding: "10px", marginBottom: "10px" }}>
        <strong>Task Owner Completion Evidence</strong>
        {Array.isArray(task?.task_attachments) && task.task_attachments.length > 0 ? (
          <div style={{ display: "grid", gap: "7px", marginTop: "8px" }}>{task.task_attachments.map((attachment: any, index: number) => (
            <div key={`${attachment?.storage_path || attachment?.url || index}`}><a href={attachment?.url} target="_blank" rel="noreferrer">📎 {attachment?.name || `Completion Attachment ${index + 1}`}</a><div style={{ color: "#64748b", fontSize: "12px", marginTop: "3px" }}>Uploaded by {attachment?.uploaded_by || "N/A"} · {formatNcmrDateTime(attachment?.uploaded_at)}</div></div>
          ))}</div>
        ) : <div style={{ marginTop: "5px", color: "#64748b" }}>No optional completion attachment was provided.</div>}
      </div>

      {isCancelled ? (
        <div style={{ color: "#6b7280" }}>
          This task is cancelled and does not require implementation verification.
        </div>
      ) : !isCompleted ? (
        <div
          style={{
            border: "1px solid #facc15",
            background: "#fefce8",
            color: "#854d0e",
            borderRadius: "8px",
            padding: "10px",
          }}
        >
          Owner verification becomes available after the assigned task owner completes this task.
        </div>
      ) : isVerified ? (
        <div
          style={{
            border: "1px solid #86efac",
            background: "#f0fdf4",
            color: "#166534",
            borderRadius: "8px",
            padding: "10px",
          }}
        >
          <strong>✓ Independently Verified by NCMR Owner</strong>
          <div style={{ marginTop: "6px", whiteSpace: "pre-wrap" }}>
            <strong>Verification:</strong>{" "}
            {task?.implementation_verification_comment || "N/A"}
          </div>
          <div style={{ marginTop: "6px" }}>
            <strong>Verified By:</strong>{" "}
            {task?.implementation_verified_by || "N/A"}
            <br />
            <strong>Verified At:</strong>{" "}
            {formatNcmrDateTime(task?.implementation_verified_at)}
          </div>
        </div>
      ) : (
        <div
          style={{
            border: "1px solid #93c5fd",
            background: "#eff6ff",
            borderRadius: "8px",
            padding: "10px",
          }}
        >
          <label>
            <strong>NCMR Owner Implementation Verification</strong>
          </label>
          <br />
          <textarea
            value={verificationComment}
            onChange={(event) => setVerificationComment(event.target.value)}
            rows={4}
            placeholder="Document the independent review and verification of this specific completed task."
            disabled={!canVerify}
            style={{
              width: "100%",
              maxWidth: "900px",
              marginTop: "6px",
            }}
          />

          <div style={{ marginTop: "8px" }}>
            <button
              type="button"
              onClick={() => onVerify(task.id, verificationComment)}
              disabled={!canVerify || !verificationComment.trim()}
            >
              Verify This Implementation Task
            </button>
          </div>

          {!canVerify ? (
            <div style={{ marginTop: "8px", color: "#1e3a8a" }}>
              Only the current NCMR owner can record implementation verification.
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function TaskStatusList({ tasks }: { tasks: any[] }) {
  return (
    <div style={{ display: "grid", gap: "10px" }}>
      {tasks.map((task) => {
        const status = String(task?.status || "").trim().toLowerCase();
        return (
          <div key={task.id} style={{ border: status === "completed" ? "1px solid #86efac" : status === "rejected" ? "1px solid #fca5a5" : "1px solid #facc15", background: status === "completed" ? "#f0fdf4" : status === "rejected" ? "#fef2f2" : "#fefce8", borderRadius: "8px", padding: "10px" }}>
            <strong>{task.task_title || task.required_function}</strong> — {task.status}<br />
            <strong>Assigned To:</strong> {task.assigned_to_email}<br />
            <strong>Due Date:</strong> {formatNcmrDate(task.due_date)}<br />
            <strong>Completed By:</strong> {task.completed_by || task.signed_by || "N/A"}<br />
            <strong>Completed At:</strong> {formatNcmrDateTime(task.completed_at || task.signed_at)}<br />
            <strong>Completion Comment:</strong> {task.completion_comment || task.approver_comment || "N/A"}
            {status === "returned" ? <div style={{ marginTop: "8px", border: "1px solid #facc15", background: "#fffdf2", borderRadius: "7px", padding: "8px" }}><strong>Returned By:</strong> {task?.returned_by || "N/A"}<br /><strong>Returned At:</strong> {formatNcmrDateTime(task?.returned_at)}<br /><strong>Return Reason:</strong> {task?.returned_reason || "N/A"}</div> : null}
            {Array.isArray(task?.assignment_attachments) && task.assignment_attachments.length > 0 ? <div style={{ marginTop: "8px" }}><strong>Assignment Attachment:</strong><div style={{ display: "grid", gap: "5px", marginTop: "5px" }}>{task.assignment_attachments.map((attachment: any, index: number) => <div key={`${attachment?.storage_path || attachment?.url || index}`}><a href={attachment?.url} target="_blank" rel="noreferrer">📎 {attachment?.name || `Assignment Attachment ${index + 1}`}</a></div>)}</div></div> : null}
            {Array.isArray(task?.task_attachments) && task.task_attachments.length > 0 ? <div style={{ marginTop: "8px" }}><strong>Completion Evidence:</strong><div style={{ display: "grid", gap: "5px", marginTop: "5px" }}>{task.task_attachments.map((attachment: any, index: number) => <div key={`${attachment?.storage_path || attachment?.url || index}`}><a href={attachment?.url} target="_blank" rel="noreferrer">📎 {attachment?.name || `Completion Attachment ${index + 1}`}</a><span style={{ color: "#64748b", fontSize: "12px", marginLeft: "8px" }}>{formatNcmrDateTime(attachment?.uploaded_at)}</span></div>)}</div></div> : null}
          </div>
        );
      })}
    </div>
  );
}

function MrbApproverAssignmentRow({
  label,
  required,
  setRequired,
  email,
  setEmail,
  disabled,
}: {
  label: string;
  required: boolean;
  setRequired: (value: boolean) => void;
  email: string;
  setEmail: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(160px, 220px) 1fr",
        gap: "10px",
        alignItems: "center",
        marginBottom: "8px",
      }}
    >
      <label>
        <input
          type="checkbox"
          checked={required}
          onChange={(e) => setRequired(e.target.checked)}
          disabled={disabled}
        />{" "}
        {label}
      </label>

      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={`${label} approver email`}
        disabled={disabled || !required}
        style={{ padding: "8px", width: "100%" }}
      />
    </div>
  );
}

function AffectedMaterialEditCard({
  item,
  canEdit,
  onSave,
  onRemove,
}: {
  item: any;
  canEdit: boolean;
  onSave: (
    itemId: string,
    productPartNumber: string,
    partDescription: string,
    partRevision: string,
    lotNumber: string,
    workorderNumber: string,
    quantityAffected: string,
    quarantinedQuantity: string
  ) => void;
  onRemove: (itemId: string) => void;
}) {
  const [productPartNumber, setProductPartNumber] = useState(
    item.product_part_number || ""
  );
  const [partDescription, setPartDescription] = useState(item.part_description || "");
  const [partRevision, setPartRevision] = useState(item.part_revision || "");
  const [lotNumber, setLotNumber] = useState(item.lot_number || "");
  const [workorderNumber, setWorkorderNumber] = useState(
    item.workorder_number || ""
  );
  const [quantityAffected, setQuantityAffected] = useState(
    item.quantity_affected !== null && item.quantity_affected !== undefined
      ? String(item.quantity_affected)
      : ""
  );
  const [quarantinedQuantity, setQuarantinedQuantity] = useState(
    item.quarantined_quantity !== null && item.quarantined_quantity !== undefined
      ? String(item.quarantined_quantity)
      : ""
  );

  useEffect(() => {
    setProductPartNumber(item.product_part_number || "");
    setPartDescription(item.part_description || "");
    setPartRevision(item.part_revision || "");
    setLotNumber(item.lot_number || "");
    setWorkorderNumber(item.workorder_number || "");
    setQuantityAffected(
      item.quantity_affected !== null && item.quantity_affected !== undefined
        ? String(item.quantity_affected)
        : ""
    );
    setQuarantinedQuantity(
      item.quarantined_quantity !== null && item.quarantined_quantity !== undefined
        ? String(item.quarantined_quantity)
        : ""
    );
  }, [
    item.product_part_number,
    item.part_description,
    item.part_revision,
    item.lot_number,
    item.workorder_number,
    item.quantity_affected,
    item.quarantined_quantity,
  ]);

  return (
    <div
      style={{
        border: "1px solid #d1d5db",
        borderRadius: "8px",
        padding: "12px",
        background: "#f9fafb",
      }}
    >
      <div style={{ marginBottom: "10px" }}>
        <strong>
          {[productPartNumber, partDescription, partRevision].filter(Boolean).join(" • ") || "Affected Material"}
        </strong>
      </div>

      <div style={{ display: "grid", gap: "12px", maxWidth: "700px" }}>
        <div>
          <label>Part Number</label>
          <br />
          <input
            value={productPartNumber}
            onChange={(e) => setProductPartNumber(e.target.value)}
            disabled={!canEdit}
            style={{ padding: "8px", width: "100%" }}
          />
        </div>

        <div>
          <label>Part Description</label>
          <br />
          <input
            value={partDescription}
            onChange={(e) => setPartDescription(e.target.value)}
            disabled={!canEdit}
            style={{ padding: "8px", width: "100%" }}
          />
        </div>

        <div>
          <label>Part Revision</label>
          <br />
          <input
            value={partRevision}
            onChange={(e) => setPartRevision(e.target.value)}
            disabled={!canEdit}
            style={{ padding: "8px", width: "100%" }}
          />
        </div>

        <div>
          <label>Lot Number</label>
          <br />
          <input
            value={lotNumber}
            onChange={(e) => setLotNumber(e.target.value)}
            disabled={!canEdit}
            style={{ padding: "8px", width: "100%" }}
          />
        </div>

        <div>
          <label>Work Order</label>
          <br />
          <input
            value={workorderNumber}
            onChange={(e) => setWorkorderNumber(e.target.value)}
            disabled={!canEdit}
            style={{ padding: "8px", width: "100%" }}
          />
        </div>

        <div>
          <label>Qty Affected</label>
          <br />
          <input
            type="number"
            value={quantityAffected}
            onChange={(e) => setQuantityAffected(e.target.value)}
            disabled={!canEdit}
            style={{ padding: "8px", width: "100%" }}
          />
        </div>

        <div>
          <label>Qty Quarantined</label>
          <br />
          <input
            type="number"
            value={quarantinedQuantity}
            onChange={(e) => setQuarantinedQuantity(e.target.value)}
            disabled={!canEdit}
            style={{ padding: "8px", width: "100%" }}
          />
        </div>
      </div>

      {canEdit ? (
        <div style={{ marginTop: "10px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() =>
              onSave(
                item.id,
                productPartNumber,
                partDescription,
                partRevision,
                lotNumber,
                workorderNumber,
                quantityAffected,
                quarantinedQuantity
              )
            }
          >
            Save Affected Material
          </button>

          <button type="button" onClick={() => onRemove(item.id)}>
            Remove
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ReworkOwnerVerificationCard({
  task, items, canVerify, onVerify,
}: {
  task: any; items: any[]; canVerify: boolean;
  onVerify: (taskId: string, verificationComment: string) => void;
}) {
  const [verificationComment, setVerificationComment] = useState(task?.implementation_verification_comment || "");
  useEffect(() => { setVerificationComment(task?.implementation_verification_comment || ""); }, [task?.implementation_verification_comment]);

  const isVerified =
    String(task?.implementation_verification_status || "").toLowerCase() === "verified" &&
    !!task?.implementation_verified_by &&
    !!task?.implementation_verified_at;

  return (
    <div style={{ border: isVerified ? "1px solid #86efac" : "1px solid #93c5fd", background: isVerified ? "#f0fdf4" : "#fff", borderRadius: "10px", padding: "14px" }}>
      <div style={{ marginBottom: "12px" }}>
        <strong>Approved Rework Instructions</strong>
        <div style={{ marginTop: "6px", whiteSpace: "pre-wrap", border: "1px solid #bfdbfe", background: "#eff6ff", borderRadius: "8px", padding: "10px" }}>
          {task?.task_instructions || task?.comments || "N/A"}
        </div>
      </div>

      <div style={{ marginBottom: "12px" }}>
        <strong>Rework Owner Completion Comment</strong>
        <div style={{ marginTop: "6px", whiteSpace: "pre-wrap", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "10px" }}>
          {task?.completion_comment || task?.approver_comment || "N/A"}
        </div>
      </div>

      <div style={{ marginBottom: "12px" }}>
        <strong>Rework Completion Evidence</strong>
        {Array.isArray(task?.task_attachments) && task.task_attachments.length > 0 ? (
          <div style={{ display: "grid", gap: "6px", marginTop: "7px" }}>
            {task.task_attachments.map((attachment: any, index: number) => (
              <div key={`${attachment?.storage_path || attachment?.url || index}`}>
                <a href={attachment?.url} target="_blank" rel="noreferrer">📎 {attachment?.name || `Rework Attachment ${index + 1}`}</a>
                <span style={{ color: "#64748b", fontSize: "12px", marginLeft: "8px" }}>{formatNcmrDateTime(attachment?.uploaded_at)}</span>
              </div>
            ))}
          </div>
        ) : <div style={{ marginTop: "5px", color: "#64748b" }}>No optional completion attachment was provided.</div>}
      </div>

      <div style={{ display: "grid", gap: "10px", marginBottom: "12px" }}>
        {items.map((item: any, index: number) => {
          const affected = Number(item?.quantity_affected || 0);
          const accepted = Number(item?.final_rework_quantity_accepted || 0);
          const rejected = Number(item?.final_rework_quantity_rejected || 0);
          const reconciled = accepted + rejected === affected;
          return (
            <div key={item.id || index} style={{ border: reconciled ? "1px solid #86efac" : "1px solid #fca5a5", background: reconciled ? "#f0fdf4" : "#fef2f2", borderRadius: "8px", padding: "10px" }}>
              <strong>Final Rework Outcome — {item?.product_part_number || "Part N/A"} / Lot {item?.lot_number || "N/A"}</strong>
              <div style={{ marginTop: "6px" }}>
                <strong>MRB Disposition:</strong> Rework<br/>
                <strong>Final Disposition After Rework:</strong> {formatDispositionLabel(item?.final_disposition_after_rework)}<br/>
                <strong>Final Quantity Accepted:</strong> {item?.final_rework_quantity_accepted ?? "N/A"}<br/>
                <strong>Final Quantity Rejected:</strong> {item?.final_rework_quantity_rejected ?? "N/A"}<br/>
                <strong>Reconciliation:</strong> {accepted} + {rejected} = {accepted+rejected} / Affected {affected} — {reconciled ? "✓ Reconciled":"⚠ Not Reconciled"}
              </div>
            </div>
          );
        })}
      </div>

      {isVerified ? (
        <div style={{ border: "1px solid #86efac", background: "#f0fdf4", color: "#166534", borderRadius: "8px", padding: "10px" }}>
          <strong>✓ Independently Verified by NCMR Owner</strong>
          <div style={{ marginTop: "6px", whiteSpace: "pre-wrap" }}><strong>Verification:</strong> {task?.implementation_verification_comment || "N/A"}</div>
          <div style={{ marginTop: "6px" }}><strong>Verified By:</strong> {task?.implementation_verified_by || "N/A"}<br/><strong>Verified At:</strong> {formatNcmrDateTime(task?.implementation_verified_at)}</div>
        </div>
      ) : (
        <div style={{ border: "1px solid #93c5fd", background: "#eff6ff", borderRadius: "8px", padding: "10px" }}>
          <label><strong>NCMR Owner Rework Implementation Verification</strong></label><br/>
          <textarea value={verificationComment} onChange={(e)=>setVerificationComment(e.target.value)} rows={4} placeholder="Verify that the completed Rework, evidence, attachments, final disposition, and reconciled quantities align with the approved Rework instructions." disabled={!canVerify} style={{ width:"100%", maxWidth:"900px", marginTop:"6px" }}/>
          <div style={{ marginTop:"8px" }}><button type="button" onClick={()=>onVerify(task.id,verificationComment)} disabled={!canVerify || !verificationComment.trim()}>Verify Rework Implementation</button></div>
          {!canVerify ? <div style={{ marginTop:"8px", color:"#1e3a8a" }}>Only the current NCMR owner can record Rework implementation verification.</div> : null}
        </div>
      )}
    </div>
  );
}


function formatDispositionLabel(value: any) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  if (normalized === "use_as_is") return "Use As Is";
  if (normalized === "accept_per_specification") return "Accept Per Specification";
  if (normalized === "scrap") return "Scrap";
  if (normalized === "return_to_supplier") return "Return to Supplier";
  if (normalized === "rework") return "Rework";

  return String(value || "Disposition")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function DispositionImplementationCard({
  item,
  isLocked,
  onSave,
}: {
  item: any;
  isLocked: boolean;
  onSave: (
    itemId: string,
    implementationNotes: string,
    quantityDiscrepancy: boolean,
    discrepancyQuantity: string,
    discrepancyType: string,
    discrepancyRationale: string,
    finalQuantityAccepted: string,
    finalQuantityRejected: string
  ) => void;
}) {
  const disposition = String(item?.product_disposition || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  const allowsDiscrepancy =
    disposition === "use_as_is" ||
    disposition === "accept_per_specification";

  const mrbAccepted = Number(item?.quantity_accepted || 0);
  const mrbRejected = Number(item?.quantity_rejected || 0);
  const affectedQuantity = Number(item?.quantity_affected || 0);

  const [implementationNotes, setImplementationNotes] = useState(
    item?.disposition_implementation_notes || ""
  );
  const [quantityDiscrepancy, setQuantityDiscrepancy] = useState(
    item?.quantity_discrepancy === true
  );
  const [discrepancyQuantity, setDiscrepancyQuantity] = useState(
    item?.discrepancy_quantity !== null &&
      item?.discrepancy_quantity !== undefined
      ? String(item.discrepancy_quantity)
      : ""
  );
  const [discrepancyType, setDiscrepancyType] = useState(
    item?.discrepancy_type || ""
  );
  const [discrepancyRationale, setDiscrepancyRationale] = useState(
    item?.discrepancy_rationale || ""
  );
  const [finalQuantityAccepted, setFinalQuantityAccepted] = useState(
    item?.final_quantity_accepted !== null &&
      item?.final_quantity_accepted !== undefined
      ? String(item.final_quantity_accepted)
      : String(mrbAccepted)
  );
  const [finalQuantityRejected, setFinalQuantityRejected] = useState(
    item?.final_quantity_rejected !== null &&
      item?.final_quantity_rejected !== undefined
      ? String(item.final_quantity_rejected)
      : String(mrbRejected)
  );

  useEffect(() => {
    setImplementationNotes(item?.disposition_implementation_notes || "");
    setQuantityDiscrepancy(item?.quantity_discrepancy === true);
    setDiscrepancyQuantity(
      item?.discrepancy_quantity !== null &&
        item?.discrepancy_quantity !== undefined
        ? String(item.discrepancy_quantity)
        : ""
    );
    setDiscrepancyType(item?.discrepancy_type || "");
    setDiscrepancyRationale(item?.discrepancy_rationale || "");
    setFinalQuantityAccepted(
      item?.final_quantity_accepted !== null &&
        item?.final_quantity_accepted !== undefined
        ? String(item.final_quantity_accepted)
        : String(Number(item?.quantity_accepted || 0))
    );
    setFinalQuantityRejected(
      item?.final_quantity_rejected !== null &&
        item?.final_quantity_rejected !== undefined
        ? String(item.final_quantity_rejected)
        : String(Number(item?.quantity_rejected || 0))
    );
  }, [
    item?.disposition_implementation_notes,
    item?.quantity_discrepancy,
    item?.discrepancy_quantity,
    item?.discrepancy_type,
    item?.discrepancy_rationale,
    item?.final_quantity_accepted,
    item?.final_quantity_rejected,
    item?.quantity_accepted,
    item?.quantity_rejected,
  ]);

  const displayedFinalAccepted =
    allowsDiscrepancy && quantityDiscrepancy
      ? Number(finalQuantityAccepted || 0)
      : mrbAccepted;
  const displayedFinalRejected =
    allowsDiscrepancy && quantityDiscrepancy
      ? Number(finalQuantityRejected || 0)
      : mrbRejected;

  const displayedDiscrepancyQuantity =
    allowsDiscrepancy && quantityDiscrepancy
      ? Number(discrepancyQuantity || 0)
      : 0;

  const displayedReconciledQuantity =
    displayedFinalAccepted + displayedFinalRejected + displayedDiscrepancyQuantity;

  const reconciled = displayedReconciledQuantity === affectedQuantity;

  const status = String(
    item?.disposition_implementation_status || "not_started"
  ).toLowerCase();

  return (
    <div
      style={{
        border:
          status === "completed" && reconciled
            ? "1px solid #86efac"
            : "1px solid #d1d5db",
        background:
          status === "completed" && reconciled ? "#f0fdf4" : "#f9fafb",
        borderRadius: "10px",
        padding: "14px",
      }}
    >
      <h3 style={{ marginTop: 0 }}>
        {formatDispositionLabel(disposition)} —{" "}
        {item?.product_part_number || "Part N/A"} / Lot{" "}
        {item?.lot_number || "Lot N/A"}
      </h3>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
          gap: "10px",
          marginBottom: "12px",
        }}
      >
        <div><strong>Initial Quantity</strong><div style={{ marginTop: "4px" }}>{affectedQuantity}</div></div>
        <div><strong>MRB Quantity Accepted</strong><div style={{ marginTop: "4px" }}>{mrbAccepted}</div></div>
        <div><strong>MRB Quantity Rejected</strong><div style={{ marginTop: "4px" }}>{mrbRejected}</div></div>
        <div>
          <strong>Implementation Status</strong>
          <div style={{ marginTop: "4px" }}>
            {status === "completed"
              ? "Completed"
              : status === "superseded"
              ? "Superseded — Reconfirmation Required"
              : "Not Started"}
          </div>
        </div>
      </div>

      {allowsDiscrepancy ? (
        <div style={{ marginBottom: "12px" }}>
          <label><strong>Quantity Discrepancy?</strong></label><br />
          <select
            value={quantityDiscrepancy ? "yes" : "no"}
            onChange={(event) => {
              const hasDiscrepancy = event.target.value === "yes";
              setQuantityDiscrepancy(hasDiscrepancy);
              if (!hasDiscrepancy) {
                setDiscrepancyQuantity("");
                setDiscrepancyType("");
                setDiscrepancyRationale("");
                setFinalQuantityAccepted(String(mrbAccepted));
                setFinalQuantityRejected(String(mrbRejected));
              }
            }}
            disabled={isLocked}
            style={{ padding: "8px", minWidth: "180px", marginTop: "4px" }}
          >
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </div>
      ) : null}

      {allowsDiscrepancy && quantityDiscrepancy ? (
        <div style={{ border: "1px solid #facc15", background: "#fefce8", borderRadius: "8px", padding: "12px", marginBottom: "12px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px" }}>
            <div>
              <label>Discrepancy Quantity</label><br />
              <input type="number" min="0" value={discrepancyQuantity} onChange={(e) => setDiscrepancyQuantity(e.target.value)} disabled={isLocked} style={{ padding: "8px", width: "100%" }} />
            </div>
            <div>
              <label>Discrepancy Type</label><br />
              <select value={discrepancyType} onChange={(e) => setDiscrepancyType(e.target.value)} disabled={isLocked} style={{ padding: "8px", width: "100%" }}>
                <option value="">Select quantity</option>
                <option value="accepted_quantity">Accepted Quantity</option>
                <option value="rejected_quantity">Rejected Quantity</option>
              </select>
            </div>
            <div>
              <label>Final Quantity Accepted</label><br />
              <input type="number" min="0" value={finalQuantityAccepted} onChange={(e) => setFinalQuantityAccepted(e.target.value)} disabled={isLocked} style={{ padding: "8px", width: "100%" }} />
            </div>
            <div>
              <label>Final Quantity Rejected</label><br />
              <input type="number" min="0" value={finalQuantityRejected} onChange={(e) => setFinalQuantityRejected(e.target.value)} disabled={isLocked} style={{ padding: "8px", width: "100%" }} />
            </div>
          </div>
          <div style={{ marginTop: "10px" }}>
            <label>Discrepancy Rationale</label><br />
            <textarea value={discrepancyRationale} onChange={(e) => setDiscrepancyRationale(e.target.value)} disabled={isLocked} rows={3} style={{ width: "100%", maxWidth: "850px" }} />
          </div>
        </div>
      ) : null}

      {!allowsDiscrepancy ? (
        <div style={{ border: "1px solid #e5e7eb", background: "white", borderRadius: "8px", padding: "10px", marginBottom: "12px" }}>
          Final quantities remain equal to the MRB-approved quantities for <strong>{formatDispositionLabel(disposition)}</strong>.
        </div>
      ) : null}

      <div style={{ marginBottom: "12px" }}>
        <label>Disposition Implementation Notes</label><br />
        <textarea
          value={implementationNotes}
          onChange={(e) => setImplementationNotes(e.target.value)}
          disabled={isLocked}
          rows={4}
          placeholder={`Document how the approved ${formatDispositionLabel(disposition)} disposition was implemented.`}
          style={{ width: "100%", maxWidth: "850px" }}
        />
      </div>

      <div
        style={{
          border: reconciled ? "1px solid #86efac" : "1px solid #fca5a5",
          background: reconciled ? "#f0fdf4" : "#fef2f2",
          color: reconciled ? "#166534" : "#991b1b",
          borderRadius: "8px",
          padding: "10px",
          marginBottom: "12px",
        }}
      >
        <strong>Final Quantity Reconciliation:</strong>{" "}
        {displayedFinalAccepted} Accepted + {displayedFinalRejected} Rejected
        {displayedDiscrepancyQuantity > 0 ? (
          <> + {displayedDiscrepancyQuantity} Discrepancy</>
        ) : null}{" "}
        = {displayedReconciledQuantity} / Initial {affectedQuantity} —{" "}
        {reconciled ? "✓ Reconciled" : "⚠ Not Reconciled"}
      </div>

      <button
        type="button"
        onClick={() =>
          onSave(
            item.id,
            implementationNotes,
            allowsDiscrepancy ? quantityDiscrepancy : false,
            discrepancyQuantity,
            discrepancyType,
            discrepancyRationale,
            allowsDiscrepancy && quantityDiscrepancy ? finalQuantityAccepted : String(mrbAccepted),
            allowsDiscrepancy && quantityDiscrepancy ? finalQuantityRejected : String(mrbRejected)
          )
        }
        disabled={isLocked}
      >
        {status === "completed" ? "Update Disposition Implementation" : "Record Disposition Implemented"}
      </button>

      {item?.disposition_implemented_by ? (
        <div style={{ marginTop: "10px", fontSize: "14px" }}>
          <strong>Implemented By:</strong> {item.disposition_implemented_by}<br />
          <strong>Implemented At:</strong> {formatNcmrDateTime(item.disposition_implemented_at)}
        </div>
      ) : null}
    </div>
  );
}

function AffectedItemCard({
  item,
  isLocked,
  mrbApproved,
  dispositionOptions,
  onSave,
}: {
  item: any;
  isLocked: boolean;
  mrbApproved: boolean;
  dispositionOptions: any[];
  onSave: (
    itemId: string,
    productDisposition: string,
    dispositionJustification: string,
    quantityAccepted: string,
    quantityRejected: string,
    finalDispositionAfterRework: string,
    finalReworkQuantityAccepted: string,
    finalReworkQuantityRejected: string
  ) => void;
}) {
  const [productDisposition, setProductDisposition] = useState(
    item.product_disposition || ""
  );
  const [dispositionJustification, setDispositionJustification] = useState(
    item.disposition_justification || ""
  );
  const [quantityAccepted, setQuantityAccepted] = useState(
    item.quantity_accepted !== null && item.quantity_accepted !== undefined
      ? String(item.quantity_accepted)
      : ""
  );
  const [quantityRejected, setQuantityRejected] = useState(
    item.quantity_rejected !== null && item.quantity_rejected !== undefined
      ? String(item.quantity_rejected)
      : ""
  );
  const [finalDispositionAfterRework, setFinalDispositionAfterRework] = useState(
    item.final_disposition_after_rework || ""
  );
  const [finalReworkQuantityAccepted, setFinalReworkQuantityAccepted] = useState(
    item.final_rework_quantity_accepted !== null &&
      item.final_rework_quantity_accepted !== undefined
      ? String(item.final_rework_quantity_accepted)
      : ""
  );
  const [finalReworkQuantityRejected, setFinalReworkQuantityRejected] = useState(
    item.final_rework_quantity_rejected !== null &&
      item.final_rework_quantity_rejected !== undefined
      ? String(item.final_rework_quantity_rejected)
      : ""
  );

  useEffect(() => {
    setProductDisposition(item.product_disposition || "");
    setDispositionJustification(item.disposition_justification || "");
    setQuantityAccepted(
      item.quantity_accepted !== null && item.quantity_accepted !== undefined
        ? String(item.quantity_accepted)
        : ""
    );
    setQuantityRejected(
      item.quantity_rejected !== null && item.quantity_rejected !== undefined
        ? String(item.quantity_rejected)
        : ""
    );
    setFinalDispositionAfterRework(item.final_disposition_after_rework || "");
    setFinalReworkQuantityAccepted(
      item.final_rework_quantity_accepted !== null &&
        item.final_rework_quantity_accepted !== undefined
        ? String(item.final_rework_quantity_accepted)
        : ""
    );
    setFinalReworkQuantityRejected(
      item.final_rework_quantity_rejected !== null &&
        item.final_rework_quantity_rejected !== undefined
        ? String(item.final_rework_quantity_rejected)
        : ""
    );
  }, [
    item.product_disposition,
    item.disposition_justification,
    item.quantity_accepted,
    item.quantity_rejected,
    item.final_disposition_after_rework,
    item.final_rework_quantity_accepted,
    item.final_rework_quantity_rejected,
  ]);

  return (
    <div
      style={{
        border: "1px solid #d1d5db",
        borderRadius: "8px",
        padding: "12px",
        background: "#f9fafb",
      }}
    >
      <h4 style={{ marginTop: 0 }}>
        Disposition Item — {item.product_part_number || "Part N/A"} / Lot{" "}
        {item.lot_number || "Lot N/A"}
      </h4>

      <div style={{ display: "grid", gap: "12px", maxWidth: "700px" }}>
        <div>
          <label>Disposition</label>
          <br />
          <select
            value={productDisposition}
            onChange={(e) => setProductDisposition(e.target.value)}
            disabled={isLocked}
            style={{ padding: "8px", width: "100%" }}
          >
            <option value="">Select disposition</option>
            {dispositionOptions.map((option: any) => (
              <option
                key={option.code || option.value || option.id || option.label || option.name}
                value={option.code || option.value || option.label || option.name}
              >
                {option.label || option.name || option.disposition_label || option.disposition_name || option.code || option.value}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>Quantity Accepted</label>
          <br />
          <input
            type="number"
            value={quantityAccepted}
            onChange={(e) => setQuantityAccepted(e.target.value)}
            disabled={isLocked}
            style={{ padding: "8px", width: "100%" }}
          />
        </div>

        <div>
          <label>Quantity Rejected</label>
          <br />
          <input
            type="number"
            value={quantityRejected}
            onChange={(e) => setQuantityRejected(e.target.value)}
            disabled={isLocked}
            style={{ padding: "8px", width: "100%" }}
          />
        </div>

        <div>
          <label>Disposition Justification</label>
          <br />
          <textarea
            value={dispositionJustification}
            onChange={(e) => setDispositionJustification(e.target.value)}
            disabled={isLocked}
            rows={4}
            style={{ width: "100%" }}
          />
        </div>

        {productDisposition === "rework" ? (
          <div
            style={{
              border: "1px solid #bfdbfe",
              borderRadius: "8px",
              padding: "10px",
              background: "#eff6ff",
              color: "#1e3a8a",
            }}
          >
            Rework selected. Enter Accepted Quantity = 0 and Rejected Quantity = Quantity Impacted.
            Final rework disposition and final quantities are recorded by the Rework Owner in the dedicated Rework work package after MRB approval.
          </div>
        ) : null}

        <button
          type="button"
          onClick={() =>
            onSave(
              item.id,
              productDisposition,
              dispositionJustification,
              quantityAccepted,
              quantityRejected,
              finalDispositionAfterRework,
              finalReworkQuantityAccepted,
              finalReworkQuantityRejected
            )
          }
          disabled={isLocked}
          style={{ width: "fit-content" }}
        >
          Save Item Disposition
        </button>

        <div
          style={{
            border: productDisposition ? "1px solid #86efac" : "1px solid #facc15",
            background: productDisposition ? "#f0fdf4" : "#fefce8",
            borderRadius: "8px",
            padding: "10px",
          }}
        >
          <strong>Item Disposition Status:</strong>{" "}
          {productDisposition ? "Disposition saved or pending save" : "Pending item disposition"}
        </div>
      </div>
    </div>
  );

}

const approvalTableHeaderStyle: React.CSSProperties = {
  textAlign: "left",
  borderBottom: "1px solid #d1d5db",
  padding: "8px",
  background: "#f8fafc",
  whiteSpace: "nowrap",
};

const approvalTableCellStyle: React.CSSProperties = {
  borderBottom: "1px solid #e5e7eb",
  padding: "8px",
  verticalAlign: "top",
};
