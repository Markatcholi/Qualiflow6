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
  const [manualMrbApproverRole, setManualMrbApproverRole] = useState("MRB Approver");
  const [manualMrbApproverRequired, setManualMrbApproverRequired] = useState(true);
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
  const [severity, setSeverity] = useState("not_assessed");
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

  const [correctionTaskAssignee, setCorrectionTaskAssignee] = useState("");
  const [correctionTaskDueDate, setCorrectionTaskDueDate] = useState("");
  const [correctionTaskInstructions, setCorrectionTaskInstructions] = useState("");

  const [reworkTaskAssignee, setReworkTaskAssignee] = useState("");
  const [reworkTaskDueDate, setReworkTaskDueDate] = useState("");
  const [reworkTaskInstructions, setReworkTaskInstructions] = useState("");

  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [evidenceNotes, setEvidenceNotes] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationAttempted, setValidationAttempted] = useState(false);

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
      { code: "repair", label: "Repair" },
      { code: "scrap", label: "Scrap" },
      { code: "return_to_supplier", label: "Return to Supplier" },
      { code: "sort_screen", label: "Sort / Screen" },
      { code: "hold_pending_decision", label: "Hold Pending Decision" },
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

    const candidateTables = [
      "md_dispositions",
      "md_ncmr_dispositions",
      "md_product_dispositions",
      "md_disposition_types",
    ];

    let loadedOptions: any[] = [];

    for (const tableName of candidateTables) {
      const { data, error } = await supabase
        .from(tableName)
        .select("*");

      if (error) {
        console.warn(`Unable to load ${tableName}:`, error.message);
        continue;
      }

      if (data && data.length > 0) {
        loadedOptions = data
          .filter(isActiveOption)
          .map(normalizeOption)
          .filter((item: any) => item.code && item.label);

        if (loadedOptions.length > 0) {
          break;
        }
      }
    }

    const mergedByCode: Record<string, any> = {};

    [...defaultDispositions, ...loadedOptions].forEach((option: any) => {
      const normalized = normalizeOption(option);
      if (!normalized.code) return;
      mergedByCode[normalized.code] = normalized;
    });

    const mergedOptions = Object.values(mergedByCode).sort((a: any, b: any) =>
      String(a.label || "").localeCompare(String(b.label || ""))
    );

    setDispositionOptions(mergedOptions);
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
      .from("ncmr_mrb_approvers")
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
      .eq("task_type", "correction_task")
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
    setSeverity(data.severity || "not_assessed");
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

    const { error } = await supabase
      .from("ncmrs")
      .update({
        issue_description: summaryIssueDescription,
        owner: summaryOwner || null,
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

  const getCapaRecommendation = () => {
    const reasons: string[] = [];

    if (severity === "critical") {
      reasons.push("Critical severity requires CAPA escalation review.");
    }

    if (severity === "major") {
      reasons.push("Major severity requires documented CAPA decision.");
    }

    if (record?.recurring_issue) {
      reasons.push("Recurring issue was identified.");
    }

    if (correctionActionProposal === "escalate_to_capa") {
      reasons.push("Correction / corrective action proposal indicates escalation to CAPA.");
    }

    return {
      recommended: reasons.length > 0,
      reason: reasons.join(" "),
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
    if (!problemDescription) errors.push("Problem description is required before MRB approval.");
    if (!investigationSummary) errors.push("Investigation summary is required before MRB approval.");
    if (!rootCauseCategory) errors.push("Root cause category is required before MRB approval.");
    if (!rootCause) errors.push("Root cause is required before MRB approval.");
    if (!riskAssessment) errors.push("Risk assessment is required before MRB approval.");
    if (severity === "not_assessed") errors.push("Severity must be assessed before MRB approval.");

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
    } else {
      if (!correctionImplementation) errors.push("Correction implementation is required before closure.");
      if (!record?.correction_implemented_by) {
        errors.push("Correction implementation must be formally recorded before closure.");
      }
    }

    if (!investigationSummary) errors.push("Investigation summary is required before closure.");
    if (!riskAssessment) errors.push("Risk assessment is required before closure.");
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

    const approverRole =
      row?.approver_role ||
      row?.role ||
      row?.approval_role ||
      row?.reviewer_role ||
      row?.required_function ||
      row?.function_name ||
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
    const role = approver?.approver_role || approver?.required_function || "MRB Approver";
    const email = approver?.approver_email || approver?.assigned_to_email || "approver";
    return `${role} - ${email}`;
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
        message: `The following approver email(s) are not valid QualiSphere users:\n\n${unknownUsers.join("\n")}\n\nPlease correct the approver list before generating MRB approval tasks.`,
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
    if (record?.is_locked || record?.mrb_approved_by || hasActiveMrbApprovalWorkflow()) {
      alert("MRB approval configuration cannot be changed after approval tasks are generated or MRB is approved.");
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
      "Load approvers from this approval matrix? Existing pending MRB approver configuration rows will be replaced."
    );

    if (!confirmed) return;

    await supabase
      .from("ncmr_mrb_approvers")
      .delete()
      .eq("ncmr_id", id)
      .eq("approval_status", "pending");

    const rowsToInsert = matrixRows.map((row: any, index: number) => ({
      ncmr_id: id,
      approver_email: row.approver_email,
      approver_role: row.approver_role,
      approval_status: "pending",
      approval_order: row.approval_order || index + 1,
      is_required: row.is_required !== false,
      source_template_id: selectedApprovalMatrixId,
      signature_meaning: "MRB approval requested from approval matrix.",
    }));

    const { error } = await supabase.from("ncmr_mrb_approvers").insert(rowsToInsert);

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
    if (record?.is_locked || record?.mrb_approved_by || hasActiveMrbApprovalWorkflow()) {
      alert("MRB approval configuration cannot be changed after approval tasks are generated or MRB is approved.");
      return;
    }

    if (!manualMrbApproverEmail.trim()) {
      alert("Approver email is required.");
      return;
    }

    const normalizedManualEmail = normalizeApproverEmail(manualMrbApproverEmail);

    if (mrbApprovers.some((approver: any) => normalizeApproverEmail(approver.approver_email) === normalizedManualEmail)) {
      alert("This approver is already configured for this MRB approval.");
      return;
    }

    const manualValidation = await validateApproverEmails([normalizedManualEmail]);

    if (!manualValidation.valid) {
      alert(`Manual approver cannot be added.\n\n${manualValidation.message}`);
      return;
    }

    const nextOrder =
      mrbApprovers.length > 0
        ? Math.max(...mrbApprovers.map((item: any) => Number(item.approval_order) || 0)) + 1
        : 1;

    const { error } = await supabase.from("ncmr_mrb_approvers").insert({
      ncmr_id: id,
      approver_email: normalizedManualEmail,
      approver_role: manualMrbApproverRole.trim() || "MRB Approver",
      approval_status: "pending",
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
      `Manual MRB approver added: ${normalizedManualEmail}`
    );

    setManualMrbApproverEmail("");
    setManualMrbApproverRole("MRB Approver");
    setManualMrbApproverRequired(true);
    fetchMrbApprovers();
  };

  const removeMrbApprover = async (approverId: string) => {
    if (record?.is_locked || record?.mrb_approved_by || hasActiveMrbApprovalWorkflow()) {
      alert("MRB approval configuration cannot be changed after approval tasks are generated or MRB is approved.");
      return;
    }

    const confirmed = window.confirm("Remove this MRB approver from the configuration?");
    if (!confirmed) return;

    const { error } = await supabase
      .from("ncmr_mrb_approvers")
      .delete()
      .eq("id", approverId);

    if (error) {
      alert(error.message);
      return;
    }

    await addAuditLog("mrb_approver_removed", "MRB approver removed from configuration.");
    fetchMrbApprovers();
  };

  const saveMrbGovernance = async () => {
    if (record?.is_locked || record?.mrb_approved_by || hasActiveMrbApprovalWorkflow()) {
      alert("MRB governance cannot be changed after approval tasks are generated, MRB approval, or record lock.");
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

    if (!riskAssessment) errors.push("Risk assessment is required before generating MRB approval tasks.");
    if (severity === "not_assessed") errors.push("Severity must be assessed before generating MRB approval tasks.");
    if (!productDisposition) errors.push("Overall product disposition is required before generating MRB approval tasks.");
    if (!dispositionJustification) errors.push("Overall disposition justification is required before generating MRB approval tasks.");

    if (affectedItems.length === 0) {
      errors.push("At least one affected item is required before generating MRB approval tasks.");
    }

    affectedItems.forEach((item, index) => {
      const label = `Affected Item ${index + 1}`;

      if (!item.product_disposition) errors.push(`${label}: item disposition is required before generating MRB approval tasks.`);
      if (!item.disposition_justification) errors.push(`${label}: item disposition justification is required before generating MRB approval tasks.`);
      if (item.quantity_accepted === null || item.quantity_accepted === undefined) {
        errors.push(`${label}: quantity accepted is required before generating MRB approval tasks.`);
      }
      if (item.quantity_rejected === null || item.quantity_rejected === undefined) {
        errors.push(`${label}: quantity rejected is required before generating MRB approval tasks.`);
      }

      errors.push(...buildQuantityReconciliationErrors(item, label));
    });

    setValidationErrors(errors);
    setValidationAttempted(true);

    return errors;
  };

  const generateMrbApprovalTasks = async () => {
    if (record?.is_locked || record?.mrb_approved_by) {
      alert("Approval tasks cannot be generated after MRB approval or record lock.");
      return;
    }

    const preTaskValidationErrors = validateWorkflowBeforeGeneratingMrbTasks();

    if (preTaskValidationErrors.length > 0) {
      alert(`MRB approval tasks cannot be generated yet:\n\n${preTaskValidationErrors.join("\n")}`);
      return;
    }

    const { error: workflowSaveError } = await supabase
      .from("ncmrs")
      .update({
        risk_assessment: riskAssessment,
        severity,
        product_disposition: productDisposition || record?.product_disposition || record?.disposition || null,
        disposition: productDisposition || record?.product_disposition || record?.disposition || null,
        disposition_justification: dispositionJustification || record?.disposition_justification || null,
      })
      .eq("id", id);

    if (workflowSaveError) {
      alert(workflowSaveError.message);
      return;
    }

    const requiredApprovers = mrbApprovers
      .filter((approver: any) => approver.is_required !== false)
      .filter((approver: any) => approver.approver_email);

    if (requiredApprovers.length === 0) {
      alert("At least one required MRB approver must be configured before generating approval tasks.");
      return;
    }

    const approverValidation = await validateConfiguredApproverRows(requiredApprovers);

    if (!approverValidation.valid) {
      alert(`Cannot generate MRB approval tasks.\n\n${approverValidation.message}`);
      return;
    }

    const requiredTasks = requiredApprovers.map((approver: any, index: number) => ({
      required: true,
      functionName: getMrbApproverFunctionName(approver, index),
      email: approver.approver_email,
      role: approver.approver_role || "MRB Approver",
    }));

    await supabase
      .from("approval_tasks")
      .delete()
      .eq("entity_type", "ncmr")
      .eq("entity_id", id)
      .eq("task_type", "mrb_approval")
      .eq("status", "pending");

    const taskRows = requiredTasks.map((task) => ({
      entity_type: "ncmr",
      entity_id: id,
      task_type: "mrb_approval",
      required_function: task.functionName,
      assigned_to_email: task.email.trim().toLowerCase(),
      assigned_by_email: userEmail,
      status: "pending",
      comments: `Please review this NCMR for MRB approval.

NCMR: ${record?.ncmr_number || "NCMR"}
Severity: ${severity || "N/A"}

Review and verify:
• Problem description
• Investigation summary
• Root cause
• Risk assessment
• Product disposition
• Quantity accepted/rejected
• Rework final disposition, if applicable

Approve only if the MRB decision is technically justified, risk-assessed, and compliant with procedure requirements.

This approval becomes part of the official electronic quality record. MRB will auto-approve after all required parallel approval tasks are approved.`,
    }));

    const { data: insertedTasks, error } = await supabase
      .from("approval_tasks")
      .insert(taskRows)
      .select();

    if (error) {
      alert(error.message);
      return;
    }

    if (insertedTasks && insertedTasks.length > 0) {
      const notifications = insertedTasks.map((task) => ({
        recipient_email: task.assigned_to_email,
        subject: `MRB approval task assigned: ${record?.ncmr_number || "NCMR"}`,
        body: `You have been assigned an MRB approval task for ${record?.ncmr_number || "this NCMR"}. Please log in to QualiFlow and open My Approval Tasks.`,
        entity_type: "ncmr",
        entity_id: id,
        task_id: task.id,
        status: "pending",
      }));

      await supabase.from("notification_queue").insert(notifications);
    }

    await addAuditLog("mrb_approval_tasks_generated", `Generated ${taskRows.length} parallel MRB approval task(s).`);

    alert("Parallel MRB approval tasks generated. MRB will auto-approve after all required approvers approve.");
    fetchRecord();
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

  const getLatestMrbApprovalResetAt = () => {
    const resetEvents = auditTimeline
      .filter((item: any) => item.action === "mrb_approval_workflow_reset")
      .map((item: any) => item.created_at)
      .filter(Boolean)
      .sort();

    return resetEvents.length > 0 ? resetEvents[resetEvents.length - 1] : null;
  };

  const getActiveMrbApprovalTasks = () => {
    const latestResetAt = getLatestMrbApprovalResetAt();

    return approvalTasks
      .filter((approvalTask: any) => approvalTask.task_type === "mrb_approval")
      .filter(
        (approvalTask: any) =>
          approvalTask.status !== "cancelled" &&
          approvalTask.status !== "obsolete"
      )
      .filter((approvalTask: any) => {
        if (!latestResetAt) return true;
        if (!approvalTask.created_at) return false;
        return new Date(approvalTask.created_at).getTime() > new Date(latestResetAt).getTime();
      });
  };

  const hasActiveMrbApprovalWorkflow = () => {
    return getActiveMrbApprovalTasks().length > 0;
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
        .from("ncmr_mrb_approvers")
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
          body: `You have been assigned an MRB approval task for ${record?.ncmr_number || "this NCMR"}. Please log in to QualiSphere and open My Approval Tasks.`,
          entity_type: "ncmr",
          entity_id: id,
          task_id: task.id,
          status: "pending",
        }));

        await supabase.from("notification_queue").insert(notifications);
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
    return getActiveMrbApprovalTasks().some(
      (approvalTask) =>
        approvalTask.task_type === "mrb_approval" &&
        approvalTask.status === "rejected"
    );
  };

  const allRequiredMrbApprovalTasksApproved = () => {
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

    const requiredFunctions = getRequiredMrbApprovalFunctions();
    const activeApprovalTasks = getActiveMrbApprovalTasks();

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

  const autoApproveMrbIfReady = async () => {
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
    const meaning =
      "MRB Auto Approval: all required MRB approval tasks were approved in parallel with electronic approval records.";

    const { error } = await supabase
      .from("ncmrs")
      .update({
        risk_assessment: riskAssessment || record?.risk_assessment || null,
        severity: severity || record?.severity || "not_assessed",
        capa_justification: capaJustification || record?.capa_justification || null,
        product_disposition: productDisposition || record?.product_disposition || record?.disposition || null,
        disposition: productDisposition || record?.product_disposition || record?.disposition || null,
        disposition_justification: dispositionJustification || record?.disposition_justification || null,
        mrb_approved_by: "System Auto Approval",
        mrb_approved_at: now,
        mrb_signature_meaning: meaning,
        mrb_signature_email_entered: "system_auto_approval",
      })
      .eq("id", id);

    if (error) {
      setMrbAutoApprovalInProgress(false);
      alert(error.message);
      return;
    }

    await addAuditLog(
      "mrb_auto_approved",
      "MRB automatically approved after all required parallel MRB approval tasks were approved."
    );

    alert("MRB automatically approved. All required MRB approval tasks are complete.");
    setMrbAutoApprovalInProgress(false);
    fetchRecord();
  };

  const createCapaFromNcmr = async () => {
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
        title: `CAPA for ${record.title}`,
        status: "open",
        source_type: "ncmr",
        capa_source: "NCMR",
        ncmr_id: id,
        linked_ncmr_title: record.title,
        problem_description:
          problemDescription || record.issue_description || record.title,
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
      !!summaryProductPartNumber || !!record?.product_part_number;

    const supplierRecurrence =
      record?.recurring_issue === true ||
      record?.supplier_capa_required === true ||
      record?.supplier_scar_required === true ||
      String(record?.recurrence_reason || "").toLowerCase().includes("recurr") ||
      String(record?.supplier_capa_reason || "").toLowerCase().includes("recurr") ||
      String(record?.supplier_scar_reason || "").toLowerCase().includes("recurr") ||
      String(record?.scar_reason || "").toLowerCase().includes("recurr");

    const triggers: string[] = [];

    if (supplierPartRecorded) {
      triggers.push("Supplier part recorded.");
    }

    if (supplierRecurrence) {
      triggers.push("Supplier recurrence identified.");
    }

    if (supplierPartRecorded && supplierRecurrence) {
      return {
        outcome: "recommended",
        label: "SCAR Recommended",
        rationale:
          "SCAR is recommended because supplier part information is recorded and supplier recurrence has been identified. Quality judgment should determine whether supplier corrective action is required.",
        triggers,
      };
    }

    return {
      outcome: "not_required",
      label: "SCAR Not Required",
      rationale:
        "SCAR is not automatically required because the supplier governance criteria were not both met. Supplier part recorded and supplier recurrence are required for an automatic SCAR recommendation.",
      triggers: triggers.length > 0 ? triggers : ["No supplier governance signal identified."],
    };
  };

  const createScarFromNcmr = async () => {
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

    const scarTitle = `SCAR for ${record?.ncmr_number || record?.title || "NCMR"}`;
    const scarProblemDescription = [
      `SCAR initiated from NCMR: ${record?.ncmr_number || record?.title || id}.`,
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
      details: `SCAR created from NCMR ${record?.ncmr_number || record?.title || id}.`,
      user_email: userEmail || "unknown",
    });

    alert("Linked SCAR created.");
    fetchRecord();
  };

  const saveScarJustification = async () => {
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
    const severityValue = String(severity || record?.severity || "").toLowerCase();
    const riskText = [
      riskAssessment,
      record?.risk_assessment,
      problemDescription,
      investigationSummary,
      rootCause,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const recurrenceText = [
      record?.recurrence_reason,
      record?.recurrence_analysis,
      record?.recurrence_summary,
      record?.capa_trigger_reason,
      capaJustification,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const isCritical = severityValue.includes("critical");
    const isMajor = severityValue.includes("major");
    const hasRecurrence =
      recurrenceText.includes("recurr") ||
      recurrenceText.includes("third") ||
      recurrenceText.includes("3") ||
      record?.capa_required === true;

    const hasCustomerImpact =
      riskText.includes("customer") ||
      riskText.includes("field") ||
      riskText.includes("complaint") ||
      riskText.includes("patient");

    const hasSystemicSignal =
      riskText.includes("systemic") ||
      riskText.includes("trend") ||
      riskText.includes("repeat") ||
      recurrenceText.includes("trend");

    if (isCritical || (isMajor && hasRecurrence) || hasCustomerImpact || hasSystemicSignal) {
      return {
        outcome: "required",
        label: "CAPA Required",
        rationale:
          "CAPA is required based on severity, recurrence, customer impact, systemic signal, or an applicable governance rule. If CAPA is not opened, a risk-based justification is required.",
      };
    }

    if (isMajor || hasRecurrence) {
      return {
        outcome: "recommended",
        label: "CAPA Recommended",
        rationale:
          "CAPA is recommended based on recurrence and applicable governance rules. Quality judgment should determine whether a CAPA should be initiated.",
      };
    }

    return {
      outcome: "not_required",
      label: "CAPA Not Required",
      rationale:
        "CAPA is not required based on the available NCMR data and applicable governance rules. If CAPA is opened, document the business or quality justification for the governance override.",
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
    const recommendation = getCapaRecommendation();
    const signals: string[] = [];

    if (recommendation.reason) {
      signals.push(recommendation.reason);
    }

    if (record?.capa_evaluation_rationale) {
      signals.push(record.capa_evaluation_rationale);
    }

    if (signals.length === 0) {
      signals.push(evaluateCapaGovernance().rationale);
    }

    return signals.join(" ");
  };

  const saveCapaGovernanceEvaluation = async () => {
    if (record?.is_locked) {
      alert("This record is locked and cannot be edited.");
      return;
    }

    const evaluation = evaluateCapaGovernance();

    const { error } = await supabase
      .from("ncmrs")
      .update({
        capa_required: evaluation.outcome === "required",
        capa_evaluation_outcome: evaluation.outcome,
        capa_evaluation_rationale: evaluation.rationale,
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await addAuditLog(
      "capa_governance_evaluated",
      `${evaluation.label}: ${evaluation.rationale}`
    );

    alert("CAPA governance evaluation saved.");
    fetchRecord();
  };

  const createGovernedCapaFromNcmr = async () => {
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

    const capaTitle = `CAPA for ${record?.ncmr_number || record?.title || "NCMR"}`;
    const capaProblemDescription = [
      `CAPA initiated from NCMR: ${record?.ncmr_number || record?.title || id}.`,
      problemDescription || record?.issue_description || "",
      rootCause ? `Root Cause: ${rootCause}` : "",
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
        linked_ncmr_title: record?.title || record?.ncmr_number || null,
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
        ? `CAPA created from NCMR ${record?.ncmr_number || record?.title || id} with governance override. Override justification: ${governanceOverrideJustification}`
        : `CAPA created from NCMR ${record?.ncmr_number || record?.title || id}.`,
      user_email: userEmail || "unknown",
    });

    alert("Linked CAPA created.");
    fetchRecord();
  };

  const saveCapaNotRequiredJustification = async () => {
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

  const uploadEvidence = async () => {
    if (record?.is_locked) {
      alert("This record is locked after electronic signature and cannot be edited.");
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
    if (record?.is_locked) {
      alert("This record is locked after electronic signature and cannot be edited.");
      return;
    }

    const { error } = await supabase
      .from("ncmrs")
      .update({
        risk_assessment: riskAssessment,
        severity,
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await addAuditLog(
      "risk_assessment_saved",
      "Risk assessment and severity were saved from the Risk Assessment section."
    );

    alert("Risk assessment saved.");
    fetchRecord();
  };

  const saveMrbDispositionSection = async () => {
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
      severity,
      capa_recommended: capaRecommendation.recommended,
      capa_decision: capaRecommendation.recommended ? capaDecision || null : null,
      capa_decision_justification:
        capaRecommendation.recommended && capaDecision === "no"
          ? capaDecisionJustification
          : null,
      capa_justification:
        capaRecommendation.recommended && capaDecision === "no"
          ? capaDecisionJustification
          : capaJustification,
      product_disposition: productDisposition,
      disposition: productDisposition,
      disposition_justification: dispositionJustification,
      correction_implementation: correctionImplementation,
      review_status: reviewStatus,
      evidence_url: evidenceUrl,
      evidence_notes: evidenceNotes,
    };

    if (!record?.investigation_opened_at) {
      payload.investigation_opened_at = new Date().toISOString();
    }

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
          title: `CAPA for ${record.title}`,
          status: "open",
          source_type: "ncmr",
          capa_source: "NCMR risk-based CAPA escalation decision",
          ncmr_id: id,
          linked_ncmr_title: record.title,
          problem_description:
            problemDescription || record.issue_description || record.title,
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

    if (severity === "major" && record?.capa_id) {
      await supabase
        .from("ncmrs")
        .update({ capa_required: true })
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

    if (!riskAssessment) return alert("Risk assessment is required before MRB approval.");
    if (severity === "not_assessed") return alert("Severity must be assessed before MRB approval.");

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
      (severity === "critical" || severity === "major") &&
      productDisposition === "use_as_is" &&
      !isVpQuality
    ) {
      alert("MRB rule: Use As Is disposition for Major or Critical severity requires VP Quality approval.");
      return;
    }

    if (
      severity === "major" &&
      productDisposition === "use_as_is" &&
      dispositionJustification.trim().length < 50
    ) {
      alert("MRB rule: Major severity with Use As Is requires a stronger disposition justification.");
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
      "Electronic Signature - MRB Approval:\n\nBy selecting OK, I certify that I am the logged-in user, I have reviewed the nonconformance record, investigation, risk assessment, severity assessment, CAPA decision, product disposition, MRB approval tasks, and I approve the MRB decision.\n\nThis action will be recorded with signer identity, timestamp, and signature meaning."
    );

    if (!confirmed) return;

    const now = new Date().toISOString();

    const meaning =
      "MRB Approval: I certify that I am the logged-in user, I have reviewed the nonconformance record, investigation, risk assessment, severity assessment, CAPA decision, product disposition, MRB approval tasks, and I approve the MRB decision.";

    const { error } = await supabase
      .from("ncmrs")
      .update({
        risk_assessment: riskAssessment,
        severity,
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
        .from("ncmr_mrb_approvers")
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

  const generateCorrectionTask = async () => {
    if (record?.is_locked) {
      alert("This record is locked after electronic signature and cannot be edited.");
      return;
    }

    if (!correctionTaskAssignee) {
      alert("Correction task assignee email is required.");
      return;
    }

    if (!correctionTaskInstructions) {
      alert("Correction task instructions are required.");
      return;
    }

    const { data: insertedTasks, error } = await supabase
      .from("approval_tasks")
      .insert({
        entity_type: "ncmr",
        entity_id: id,
        task_type: "correction_task",
        required_function: "Correction Owner",
        task_title: `Correction task for ${record?.ncmr_number || "NCMR"}`,
        task_instructions: correctionTaskInstructions,
        assigned_to_email: correctionTaskAssignee.trim().toLowerCase(),
        assigned_by_email: userEmail,
        status: "pending",
        due_date: correctionTaskDueDate || null,
        comments: correctionTaskInstructions,
      })
      .select();

    if (error) {
      alert(error.message);
      return;
    }

    if (insertedTasks && insertedTasks.length > 0) {
      await supabase.from("notification_queue").insert({
        recipient_email: correctionTaskAssignee.trim().toLowerCase(),
        subject: `Correction task assigned: ${record?.ncmr_number || "NCMR"}`,
        body: `You have been assigned a correction task for ${record?.ncmr_number || "this NCMR"}. Please log in to QualiFlow and open My Tasks.`,
        entity_type: "ncmr",
        entity_id: id,
        task_id: insertedTasks[0].id,
        status: "pending",
      });
    }

    await addAuditLog(
      "correction_task_generated",
      `Correction task assigned to ${correctionTaskAssignee}.`
    );

    alert("Correction task generated.");
    setCorrectionTaskAssignee("");
    setCorrectionTaskDueDate("");
    setCorrectionTaskInstructions("");
    fetchCorrectionTasks();
  };

  const generateReworkTask = async () => {
    if (record?.is_locked) {
      alert("This record is locked after electronic signature and cannot be edited.");
      return;
    }

    if (!reworkTaskAssignee) {
      alert("Rework task assignee email is required.");
      return;
    }

    if (!reworkTaskInstructions) {
      alert("Rework task instructions are required.");
      return;
    }

    const { data: insertedTasks, error } = await supabase
      .from("approval_tasks")
      .insert({
        entity_type: "ncmr",
        entity_id: id,
        task_type: "rework_task",
        required_function: "Rework Owner",
        task_title: `Rework task for ${record?.ncmr_number || "NCMR"}`,
        task_instructions: reworkTaskInstructions,
        assigned_to_email: reworkTaskAssignee.trim().toLowerCase(),
        assigned_by_email: userEmail,
        status: "pending",
        due_date: reworkTaskDueDate || null,
        comments: reworkTaskInstructions,
      })
      .select();

    if (error) {
      alert(error.message);
      return;
    }

    if (insertedTasks && insertedTasks.length > 0) {
      await supabase.from("notification_queue").insert({
        recipient_email: reworkTaskAssignee.trim().toLowerCase(),
        subject: `Rework task assigned: ${record?.ncmr_number || "NCMR"}`,
        body: `You have been assigned a rework task for ${record?.ncmr_number || "this NCMR"}. Please log in to QualiFlow and open My Tasks.`,
        entity_type: "ncmr",
        entity_id: id,
        task_id: insertedTasks[0].id,
        status: "pending",
      });
    }

    await addAuditLog(
      "rework_task_generated",
      `Rework task assigned to ${reworkTaskAssignee}.`
    );

    alert("Rework task generated.");
    setReworkTaskAssignee("");
    setReworkTaskDueDate("");
    setReworkTaskInstructions("");
    fetchReworkTasks();
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
      const completedCorrectionTask = correctionTasks.find(
        (task) => task.status === "completed"
      );

      if (!completedCorrectionTask) {
        errors.push("At least one correction task must be completed before closure.");
      }
    }

    if (hasReworkDisposition()) {
      const completedReworkTask = getCompletedReworkTask();

      if (!completedReworkTask) {
        errors.push("At least one rework task must be completed before closure when rework is applicable.");
      }
    }

    return errors;
  };

  const markCorrectionImplemented = async () => {
    if (record?.is_locked) {
      alert("This record is locked after electronic signature and cannot be edited.");
      return;
    }

    if (!correctionImplementation) {
      alert("Correction implementation must be documented.");
      return;
    }

    const now = new Date().toISOString();

    const { error } = await supabase
      .from("ncmrs")
      .update({
        correction_implementation: correctionImplementation,
        correction_implemented_by: userEmail,
        correction_implemented_at: now,
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await addAuditLog("correction_implemented", "Correction implementation documented.");
    alert("Correction implementation recorded");
    fetchRecord();
  };

  const closeNcmr = async () => {
    if (record?.is_locked) {
      alert("This record is locked after electronic signature and cannot be edited.");
      return;
    }

    const validationPassed = validateWorkflowForClosure();

    if (!validationPassed) {
      alert("Workflow validation failed. Resolve all validation errors before closure.");
      return;
    }

    if (userRole !== "approver" && userRole !== "vp_quality") {
      return alert("Only an approver or VP Quality can close NCMR.");
    }

    if (!problemDescription) return alert("Problem description is required.");
    if (!containmentAction) return alert("Containment action is required.");
    if (!investigationSummary) return alert("Investigation summary is required.");
    if (!rootCauseCategory) return alert("Root cause category is required.");
    if (!rootCause) return alert("Root cause is required.");
    if (!correctionActionProposal) return alert("Correction / corrective action proposal is required.");
    if (!correctiveAction) return alert("Corrective action recommendation is required.");
    if (!riskAssessment) return alert("Risk assessment is required.");
    if (severity === "not_assessed") return alert("Severity must be assessed.");

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
    if (!isCorrectionNotRequired() && !correctionImplementation) return alert("Correction implementation is required.");

    if (isCorrectionNotRequired()) {
      if (!correctiveAction.trim()) {
        return alert("Correction not required requires documented justification before closure.");
      }
    } else {
      if (!record?.correction_implemented_by) {
        return alert("Correction implementation must be formally recorded before closure.");
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
      "Electronic Signature - NCMR Closure:\n\nBy selecting OK, I certify that I am the logged-in user, I have completed final quality review of this NCMR, including investigation, risk assessment, severity assessment, CAPA decision, disposition, MRB approval, correction implementation, evidence, and closure readiness.\n\nThis action will close and lock the record and will be recorded with signer identity, timestamp, and signature meaning."
    );

    if (!confirmed) return;

    const now = new Date().toISOString();
    const meaning =
      "NCMR Closure: I certify that I am the logged-in user, I have completed final quality review of this NCMR, including investigation, risk assessment, severity assessment, CAPA decision, disposition, MRB approval, correction implementation, evidence, and closure readiness.";

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
      autoApproveMrbIfReady();
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

  const isLocked = record?.is_locked === true;
  const canEditInitiation = !isLocked && !record?.mrb_approved_by;

  const workflowProgressSteps = [
    { label: "Initiation", complete: affectedItems.length > 0 && !!summaryIssueDescription },
    { label: "Containment", complete: !!investigator && !!problemDescription && !!containmentAction },
    { label: "Investigation", complete: !!investigationSummary && !!rootCauseCategory && !!rootCause },
    { label: "Correction Proposal", complete: !!correctionActionProposal && !!correctiveAction },
    { label: "Risk Assessment", complete: !!riskAssessment && severity !== "not_assessed" },
    { label: "MRB Approval", complete: !!record?.mrb_approved_by },
    { label: "Implementation", complete: isCorrectionNotRequired() ? !!correctiveAction : !!record?.correction_implemented_by },
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
  const isContainmentComplete = !!investigator && !!problemDescription && !!containmentAction;
  const isInvestigationComplete = !!investigationSummary && !!rootCauseCategory && !!rootCause;
  const isCorrectionProposalComplete = !!correctionActionProposal && !!correctiveAction;
  const isRiskAssessmentComplete = !!riskAssessment && severity !== "not_assessed";
  const isMrbComplete = !!record?.mrb_approved_by;
  const isImplementationComplete = isCorrectionNotRequired() ? !!correctiveAction : !!record?.correction_implemented_by;
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
    setCorrectionTaskAssignee("");
    setCorrectionTaskDueDate("");
    setCorrectionTaskInstructions("");
    setReworkTaskAssignee("");
    setReworkTaskDueDate("");
    setReworkTaskInstructions("");
    alert("Unsaved changes were reverted to the last saved record.");
  };

  const SectionSaveCancelActions = ({
    onSave,
  }: {
    onSave?: () => void;
  }) => (
    <div
      style={{
        display: "flex",
        gap: "8px",
        flexWrap: "wrap",
        marginTop: "14px",
        borderTop: "1px solid #e5e7eb",
        paddingTop: "12px",
      }}
    >
      <button type="button" onClick={onSave || saveWorkflow} disabled={isLocked}>
        Save Section
      </button>
      <button type="button" onClick={cancelCurrentFormChanges} disabled={isLocked}>
        Cancel Section Changes
      </button>
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
            <div style={{ color: "#4b5563", fontSize: "13px" }}>MRB</div>
            <strong>{record.mrb_approved_by ? "Approved" : "Pending"}</strong>
          </div>
          <div>
            <div style={{ color: "#4b5563", fontSize: "13px" }}>Lock Status</div>
            <strong>{record.is_locked ? "Locked" : "Editable"}</strong>
          </div>
        </div>
      </div>

      {/* Phase 3 Executive Workflow Summary */}
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
            <div>{isImplementationComplete ? "✓" : "○"} Correction implementation complete</div>
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

            <button onClick={() => alert("MRB approval is now completed automatically after all required parallel approval tasks are approved.")} disabled={isLocked || !!record?.mrb_approved_by}>
              Approve MRB
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
        subtitle={isContainmentComplete ? "Complete: containment information is documented." : "Pending: document investigator, problem description, and containment action."}
        defaultOpen={true}
        rightAction={sectionStatusBadge(isContainmentComplete, "Containment")}
      >

        <label>Investigator</label><br />
        <input
          value={investigator}
          onChange={(e) => setInvestigator(e.target.value)}
          style={{ width: "100%", maxWidth: "500px", padding: "8px", marginBottom: "12px" }}
        />

        <br />
        <label>Problem Description</label><br />
        <textarea
          value={problemDescription}
          onChange={(e) => setProblemDescription(e.target.value)}
          rows={4}
          style={{ width: "100%", maxWidth: "800px", marginBottom: "12px" }}
        />

        <br />
        <label>Containment Action</label><br />
        <textarea
          value={containmentAction}
          onChange={(e) => setContainmentAction(e.target.value)}
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
                {new Date(record.containment_completed_at).toLocaleString()}
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
              disabled={isLocked || !!record?.containment_completed_at}
              style={{ marginTop: "10px" }}
            >
              {record?.containment_completed_at ? "Containment Complete" : "Mark Containment Complete"}
            </button>
          </div>


        <SectionSaveCancelActions />
      </SectionCard>

      <SectionCard
        title="3. Investigation / Root Cause"
        subtitle={isInvestigationComplete ? "Complete: investigation and root cause are documented." : "Pending: document investigation summary, root cause category, and root cause."}
        defaultOpen={true}
        rightAction={sectionStatusBadge(isInvestigationComplete, "Investigation")}
      >

        <label>Investigation Summary</label><br />
        <textarea
          value={investigationSummary}
          onChange={(e) => setInvestigationSummary(e.target.value)}
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
        <textarea
          value={rootCause}
          onChange={(e) => setRootCause(e.target.value)}
          rows={4}
          style={{ width: "100%", maxWidth: "700px" }}
        />

        <SectionSaveCancelActions />
      </SectionCard>

      <SectionCard
        title="4. Correction / Corrective Action Proposal"
        subtitle={isCorrectionProposalComplete ? "Complete: correction proposal and recommendation are documented." : "Pending: document correction proposal and corrective action recommendation."}
        defaultOpen={false}
        rightAction={sectionStatusBadge(isCorrectionProposalComplete, "Correction Proposal")}
      >

        <label>Correction / Corrective Action Proposal</label><br />
        <select
          value={correctionActionProposal}
          onChange={(e) => setCorrectionActionProposal(e.target.value)}
          style={{ padding: "8px", minWidth: "330px", marginBottom: "12px" }}
        >
          <option value="">Select proposal</option>
          <option value="no_correction_required">No correction required</option>
          <option value="immediate_correction_only">Immediate correction only</option>
          <option value="rework">Rework</option>
          <option value="repair">Repair</option>
          <option value="replace">Replace</option>
          <option value="scrap">Scrap</option>
          <option value="return_to_supplier">Return to supplier</option>
          <option value="process_correction">Process correction</option>
          <option value="training_required">Training required</option>
          <option value="procedure_update">Procedure update</option>
          <option value="supplier_corrective_action">Supplier corrective action</option>
          <option value="escalate_to_capa">Escalate to CAPA</option>
        </select>

        <br />
        <label>Corrective Action Recommendation</label><br />
        <textarea
          value={correctiveAction}
          onChange={(e) => setCorrectiveAction(e.target.value)}
          rows={4}
          style={{ width: "100%", maxWidth: "700px" }}
        />

        <SectionSaveCancelActions />
      </SectionCard>

      <SectionCard
        title="5. Risk Assessment"
        subtitle={isRiskAssessmentComplete ? "Complete: risk assessment and severity are documented." : "Pending: document risk assessment and severity."}
        defaultOpen={true}
        rightAction={sectionStatusBadge(isRiskAssessmentComplete, "Risk Assessment")}
      >

        <label>Risk Assessment</label><br />
        <textarea
          value={riskAssessment}
          onChange={(e) => setRiskAssessment(e.target.value)}
          placeholder="Assess product, process, patient/user, regulatory, and quality risk."
          rows={4}
          style={{ width: "100%", maxWidth: "700px" }}
        />

        <div style={{ marginTop: "12px" }}>
          <label>Severity</label><br />
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            style={{ padding: "8px", minWidth: "180px" }}
          >
            <option value="not_assessed">Not Assessed</option>
            <option value="minor">Minor</option>
            <option value="major">Major</option>
            <option value="critical">Critical</option>
          </select>
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
            <strong>CAPA Governance Signal</strong>
            <p style={{ marginTop: "8px", marginBottom: 0 }}>
              {getCapaRecommendation().reason} CAPA decision is managed in the CAPA Governance section before MRB Approval.
            </p>
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

        <SectionSaveCancelActions onSave={saveRiskAssessmentSection} />
      </SectionCard>

      <SectionCard
        title="6. Product Disposition"
        subtitle={isMrbComplete ? "Complete: product disposition package is approved." : "Pending: complete overall and affected product disposition."}
        defaultOpen={true}
        rightAction={sectionStatusBadge(isMrbComplete, "MRB")}
      >

        <label>Product Disposition</label><br />
        <select
          value={productDisposition}
          onChange={(e) => setProductDisposition(e.target.value)}
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
          placeholder="Justify disposition based on risk assessment and investigation."
          rows={4}
          style={{ width: "100%", maxWidth: "700px" }}
        />

        <div style={{ marginTop: "18px" }}>
          <h3>Disposition by Affected Item</h3>
          <p style={{ color: "#4b5563", fontSize: "14px" }}>
            Add one disposition decision per affected item. Include quantity accepted and quantity rejected.
            If disposition is Rework, enter Accepted Quantity = 0 and Rejected Quantity = Quantity Impacted.
            Final rework disposition becomes available after MRB approval and rework task completion.
          </p>

          {affectedItems.length === 0 ? (
            <p>No additional affected items recorded.</p>
          ) : (
            <div style={{ display: "grid", gap: "12px" }}>
              {affectedItems.map((item) => (
                <AffectedItemCard
                  key={item.id}
                  item={item}
                  isLocked={isLocked}
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
        title="7. CAPA Governance"
        subtitle={linkedCapa || record?.linked_capa_id || record?.capa_id ? "Complete: linked CAPA exists." : record?.capa_not_required_justification ? "Complete: CAPA not-required justification documented." : "Evaluate whether CAPA is required based on recurrence, severity, risk, or governance rules."}
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
              <strong>Current Evaluation:</strong>{" "}
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
              <button type="button" onClick={saveCapaGovernanceEvaluation} disabled={isLocked}>
                Save CAPA Evaluation
              </button>

              <button type="button" onClick={createGovernedCapaFromNcmr} disabled={isLocked}>
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
                disabled={isLocked}
                placeholder="Document rationale if CAPA is recommended or required but not opened."
                style={{ width: "100%", maxWidth: "900px", padding: "8px" }}
              />
            </div>

            <button
              type="button"
              onClick={saveCapaNotRequiredJustification}
              disabled={isLocked}
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
        title="8. Supplier / SCAR Governance"
        subtitle={linkedScar ? "Complete: linked SCAR exists for supplier governance." : scarJustification ? "Complete: no-SCAR justification documented." : "Evaluate whether supplier corrective action is required based on supplier involvement, recurrence, severity, and risk."}
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
                  <strong>Current Evaluation:</strong>{" "}
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
              <button type="button" onClick={createScarFromNcmr} disabled={isLocked}>
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
                disabled={isLocked}
                placeholder="Document the risk-based rationale if supplier corrective action is not required."
                style={{ width: "100%", maxWidth: "800px", padding: "8px" }}
              />
            </div>

            <button
              type="button"
              onClick={saveScarJustification}
              disabled={isLocked}
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

      <SectionCard
        title="9. MRB Approval"
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
          <h3 style={{ marginTop: 0 }}>MRB Approval Configuration</h3>
          <p style={{ color: "#4b5563", fontSize: "14px" }}>
            Configure MRB approvers using an approval matrix or manually add named approvers. Approvers complete their tasks from My Approval Tasks. MRB auto-approves after all required approval tasks are approved.
          </p>

          {approvalTasks.length > 0 || record.mrb_approved_by ? (
            <div
              style={{
                border: "1px solid #bfdbfe",
                borderRadius: "8px",
                padding: "10px",
                background: "#eff6ff",
                marginBottom: "12px",
                color: "#1e3a8a",
              }}
            >
              MRB approval configuration is locked because approval tasks have been generated or MRB approval is complete.
            </div>
          ) : null}

          <div style={{ display: "grid", gap: "12px", maxWidth: "900px" }}>
            <div>
              <label>Approval Matrix</label>
              <br />
              <select
                value={selectedApprovalMatrixId}
                onChange={(e) => setSelectedApprovalMatrixId(e.target.value)}
                disabled={isLocked || !!record.mrb_approved_by || approvalTasks.length > 0}
                style={{ padding: "8px", width: "100%", maxWidth: "600px" }}
              >
                <option value="">Select NCMR approval matrix</option>
                {approvalMatrixTemplates.map((template: any) => (
                  <option key={template.id} value={template.id}>
                    {template.template_name || template.name || template.title || "Approval Matrix"}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={loadMrbApproversFromMatrix}
                disabled={isLocked || !!record.mrb_approved_by || approvalTasks.length > 0 || !selectedApprovalMatrixId}
                style={{ marginTop: "8px" }}
              >
                Load Approvers from Matrix
              </button>
            </div>

            <div
              style={{
                border: "1px solid #d1d5db",
                borderRadius: "8px",
                padding: "10px",
                background: "white",
              }}
            >
              <strong>Manual Approver</strong>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "10px",
                  marginTop: "10px",
                }}
              >
                <div>
                  <label>Approver Email</label>
                  <br />
                  <input
                    value={manualMrbApproverEmail}
                    onChange={(e) => setManualMrbApproverEmail(e.target.value)}
                    disabled={isLocked || !!record.mrb_approved_by || approvalTasks.length > 0}
                    placeholder="approver@company.com"
                    style={{ padding: "8px", width: "100%" }}
                  />
                </div>
                <div>
                  <label>Role / Function</label>
                  <br />
                  <input
                    value={manualMrbApproverRole}
                    onChange={(e) => setManualMrbApproverRole(e.target.value)}
                    disabled={isLocked || !!record.mrb_approved_by || approvalTasks.length > 0}
                    placeholder="Quality / Operations / VP Quality"
                    style={{ padding: "8px", width: "100%" }}
                  />
                </div>
                <label style={{ alignSelf: "end" }}>
                  <input
                    type="checkbox"
                    checked={manualMrbApproverRequired}
                    onChange={(e) => setManualMrbApproverRequired(e.target.checked)}
                    disabled={isLocked || !!record.mrb_approved_by || approvalTasks.length > 0}
                  />{" "}
                  Required approval
                </label>
              </div>
              <button
                type="button"
                onClick={addManualMrbApprover}
                disabled={isLocked || !!record.mrb_approved_by || approvalTasks.length > 0}
                style={{ marginTop: "10px" }}
              >
                + Add Approver
              </button>
            </div>
          </div>

          <h4>Configured MRB Approvers</h4>
          {mrbApprovers.length === 0 ? (
            <p>No MRB approvers configured yet. Select an approval matrix or add manual approvers.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "8px" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #d1d5db", padding: "8px" }}>Order</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #d1d5db", padding: "8px" }}>Approver</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #d1d5db", padding: "8px" }}>Role</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #d1d5db", padding: "8px" }}>Required</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #d1d5db", padding: "8px" }}>Status</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #d1d5db", padding: "8px" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {mrbApprovers.map((approver: any, index: number) => (
                  <tr key={approver.id || `${approver.approver_email}-${index}`}>
                    <td style={{ borderBottom: "1px solid #e5e7eb", padding: "8px" }}>{approver.approval_order || index + 1}</td>
                    <td style={{ borderBottom: "1px solid #e5e7eb", padding: "8px" }}>{approver.approver_email}</td>
                    <td style={{ borderBottom: "1px solid #e5e7eb", padding: "8px" }}>{approver.approver_role || "MRB Approver"}</td>
                    <td style={{ borderBottom: "1px solid #e5e7eb", padding: "8px" }}>{approver.is_required === false ? "No" : "Yes"}</td>
                    <td style={{ borderBottom: "1px solid #e5e7eb", padding: "8px" }}>{approver.approval_status || "pending"}</td>
                    <td style={{ borderBottom: "1px solid #e5e7eb", padding: "8px" }}>
                      <button
                        type="button"
                        onClick={() => removeMrbApprover(approver.id)}
                        disabled={isLocked || !!record.mrb_approved_by || approvalTasks.length > 0}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "12px" }}>
            <button type="button" onClick={saveMrbGovernance} disabled={isLocked || !!record.mrb_approved_by || approvalTasks.length > 0}>
              Save Configuration
            </button>
            <button type="button" onClick={generateMrbApprovalTasks} disabled={isLocked || !!record.mrb_approved_by || hasActiveMrbApprovalWorkflow() || mrbApprovers.length === 0}>
              Generate Approval Tasks
            </button>
            <button type="button" onClick={fixMrbApprovalTaskIssues} disabled={isLocked || !!record.mrb_approved_by || mrbApprovers.length === 0}>
              Fix Approval Task Issues
            </button>
            <button type="button" onClick={resetMrbApprovalWorkflow} disabled={isLocked || !!record.mrb_approved_by || !isAuthorizedToResetMrbApprovalWorkflow()}>
              Reset MRB Approval Workflow
            </button>
          </div>

          <h4>Approval Task Status</h4>
          {approvalTasks.length === 0 ? (
            <p>No MRB approval tasks generated yet.</p>
          ) : (
            <div style={{ display: "grid", gap: "10px" }}>
              {approvalTasks.map((task) => (
                <div
                  key={task.id}
                  style={{
                    border: task.status === "approved" ? "1px solid #86efac" : task.status === "rejected" ? "1px solid #fca5a5" : "1px solid #facc15",
                    background: task.status === "approved" ? "#f0fdf4" : task.status === "rejected" ? "#fef2f2" : "#fefce8",
                    borderRadius: "8px",
                    padding: "10px",
                  }}
                >
                  <strong>{task.required_function}</strong> — {task.status}
                  <br />
                  <strong>Assigned To:</strong> {task.assigned_to_email}
                  <br />
                  <strong>Signed By:</strong> {task.signed_by || "N/A"}
                  <br />
                  <strong>Signed At:</strong> {task.signed_at || "N/A"}
                  <br />
                  <strong>Approver Comment:</strong> {task.approver_comment || "N/A"}
                </div>
              ))}
            </div>
          )}
        </div>

        {record.mrb_approved_by ? (
          <div style={{ marginTop: "12px" }}>
            <strong>MRB Approved By:</strong> {record.mrb_approved_by}<br />
            <strong>MRB Approved At:</strong> {record.mrb_approved_at}<br />
            <strong>Signature Email Entered:</strong> {record.mrb_signature_email_entered || "System Auto Approval"}<br />
            <strong>Signature Meaning:</strong> {record.mrb_signature_meaning}
          </div>
        ) : null}

        <div style={{ marginTop: "12px" }}>
          <button onClick={() => alert("MRB approval is completed automatically after all required approval tasks are approved.")} disabled={isLocked}>Approve MRB Decision</button>
        </div>

        {hasReworkDisposition() && record.mrb_approved_by ? (
          <div
            style={{
              marginTop: "18px",
              border: "1px solid #bfdbfe",
              borderRadius: "8px",
              padding: "12px",
              background: "#eff6ff",
            }}
          >
            <h3 style={{ marginTop: 0 }}>Rework Task Assignment</h3>
            <p style={{ color: "#1f2937", fontSize: "14px" }}>
              Rework is applicable based on the approved MRB disposition. Assign rework execution after MRB approval.
            </p>

            <div style={{ display: "grid", gap: "12px", maxWidth: "700px" }}>
              <div>
                <label>Assigned To Email</label><br />
                <input
                  value={reworkTaskAssignee}
                  onChange={(e) => setReworkTaskAssignee(e.target.value)}
                  disabled={isLocked}
                  style={{ padding: "8px", width: "100%" }}
                />
              </div>

              <div>
                <label>Due Date</label><br />
                <input
                  type="date"
                  value={reworkTaskDueDate}
                  onChange={(e) => setReworkTaskDueDate(e.target.value)}
                  disabled={isLocked}
                  style={{ padding: "8px", width: "100%" }}
                />
              </div>
            </div>

            <div style={{ marginTop: "10px" }}>
              <label>Rework Task Instructions</label><br />
              <textarea
                value={reworkTaskInstructions}
                onChange={(e) => setReworkTaskInstructions(e.target.value)}
                disabled={isLocked}
                rows={3}
                style={{ width: "100%", maxWidth: "700px" }}
              />
            </div>

            <button type="button" onClick={generateReworkTask} disabled={isLocked} style={{ marginTop: "10px" }}>
              Generate Rework Task
            </button>
            <button
              type="button"
              onClick={() => {
                setReworkTaskAssignee("");
                setReworkTaskDueDate("");
                setReworkTaskInstructions("");
              }}
              disabled={isLocked}
              style={{ marginTop: "10px", marginLeft: "8px" }}
            >
              Cancel Rework Task Entry
            </button>

            <h4>Rework Task Status</h4>
            {reworkTasks.length === 0 ? <p>No rework tasks generated.</p> : <TaskStatusList tasks={reworkTasks} />}

            {hasCompletedReworkTask() ? (
              <div
                style={{
                  marginTop: "18px",
                  border: "1px solid #86efac",
                  borderRadius: "8px",
                  padding: "12px",
                  background: "#f0fdf4",
                }}
              >
                <h3 style={{ marginTop: 0 }}>Rework Verification & Final Disposition</h3>
                <p style={{ color: "#166534", fontSize: "14px" }}>
                  Rework task completion has been recorded. Document the final disposition and quantity outcome for each reworked item before closure.
                </p>

                {getReworkAffectedItems().length === 0 ? (
                  <p>No rework disposition items found.</p>
                ) : (
                  <div style={{ display: "grid", gap: "12px" }}>
                    {getReworkAffectedItems().map((item) => (
                      <ReworkVerificationCard
                        key={item.id}
                        item={item}
                        isLocked={isLocked}
                        onSave={updateAffectedItemDisposition}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div
                style={{
                  marginTop: "14px",
                  border: "1px solid #facc15",
                  borderRadius: "8px",
                  padding: "10px",
                  background: "#fefce8",
                  color: "#854d0e",
                }}
              >
                Rework Verification & Final Disposition unlocks after a rework task is completed.
              </div>
            )}
          </div>
        ) : null}

        <div
          style={{
            marginTop: "18px",
            border: record?.mrb_approved_by ? "1px solid #86efac" : hasRejectedMrbApprovalTask() ? "1px solid #fca5a5" : "1px solid #bfdbfe",
            borderRadius: "8px",
            padding: "12px",
            background: record?.mrb_approved_by ? "#f0fdf4" : hasRejectedMrbApprovalTask() ? "#fef2f2" : "#eff6ff",
          }}
        >
          <h3 style={{ marginTop: 0 }}>MRB Auto Approval Status</h3>
          {record?.mrb_approved_by ? (
            <p style={{ color: "#166534" }}>
              MRB approved automatically after all required parallel approval tasks were approved.
            </p>
          ) : hasRejectedMrbApprovalTask() ? (
            <p style={{ color: "#991b1b" }}>
              One or more MRB approval tasks have been rejected. Resolve the rejection before MRB can be approved.
            </p>
          ) : (
            <p style={{ color: "#1e3a8a" }}>
              MRB will auto-approve when all required approval tasks are approved. No separate final MRB approval signature is required.
            </p>
          )}

          <div style={{ fontSize: "13px", color: "#374151" }}>
            Required approvals complete: {requiredMrbApprovalsComplete().length === 0 && approvalTasks.length > 0 ? "Yes" : "No"}
          </div>
        </div>


      </SectionCard>

      <SectionCard
        title="10. Correction Implementation"
        subtitle={isImplementationComplete ? "Complete: correction implementation is satisfied." : isCorrectionNotRequired() ? "Pending: document correction-not-required justification." : "Pending: assign/complete correction task and document implementation."}
        defaultOpen={false}
        rightAction={sectionStatusBadge(isImplementationComplete, "Implementation")}
      >

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
              {correctiveAction || "Document the justification in the Correction / Corrective Action Proposal section."}
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
          <h3 style={{ marginTop: 0 }}>Correction Task Assignment</h3>
          <p style={{ color: "#4b5563", fontSize: "14px" }}>
            Assign the correction or corrective action execution to an owner. The owner completes the task from My Tasks.
          </p>

          <div style={{ display: "grid", gap: "12px", maxWidth: "700px" }}>
            <div>
              <label>Assigned To Email</label><br />
              <input
                value={correctionTaskAssignee}
                onChange={(e) => setCorrectionTaskAssignee(e.target.value)}
                disabled={isLocked}
                style={{ padding: "8px", width: "100%" }}
              />
            </div>

            <div>
              <label>Due Date</label><br />
              <input
                type="date"
                value={correctionTaskDueDate}
                onChange={(e) => setCorrectionTaskDueDate(e.target.value)}
                disabled={isLocked}
                style={{ padding: "8px", width: "100%" }}
              />
            </div>
          </div>

          <div style={{ marginTop: "10px" }}>
            <label>Correction Task Instructions</label><br />
            <textarea
              value={correctionTaskInstructions}
              onChange={(e) => setCorrectionTaskInstructions(e.target.value)}
              disabled={isLocked}
              rows={3}
              style={{ width: "100%", maxWidth: "700px" }}
            />
          </div>

          <button type="button" onClick={generateCorrectionTask} disabled={isLocked} style={{ marginTop: "10px" }}>
            Generate Correction Task
          </button>
          <button
            type="button"
            onClick={() => {
              setCorrectionTaskAssignee("");
              setCorrectionTaskDueDate("");
              setCorrectionTaskInstructions("");
            }}
            disabled={isLocked}
            style={{ marginTop: "10px", marginLeft: "8px" }}
          >
            Cancel Correction Task Entry
          </button>

          <h4>Correction Task Status</h4>
          {correctionTasks.length === 0 ? <p>No correction tasks generated.</p> : <TaskStatusList tasks={correctionTasks} />}
        </div>

        <textarea
          value={correctionImplementation}
          onChange={(e) => setCorrectionImplementation(e.target.value)}
          placeholder="Describe how the correction was implemented."
          rows={4}
          style={{ width: "100%", maxWidth: "700px" }}
        />

        <div style={{ marginTop: "12px" }}>
          <button onClick={markCorrectionImplemented} disabled={isLocked}>
            Mark Correction Implemented
          </button>
        </div>

        {record.correction_implemented_by ? (
          <div style={{ marginTop: "12px" }}>
            <strong>Implemented By:</strong> {record.correction_implemented_by}<br />
            <strong>Implemented At:</strong> {record.correction_implemented_at}
          </div>
        ) : null}

</>
        )}

        <SectionSaveCancelActions />
      </SectionCard>

      <SectionCard
        title="11. Evidence"
        subtitle={isEvidenceComplete ? "Complete: evidence is linked." : "Optional/Pending: upload or link supporting evidence."}
        defaultOpen={false}
        rightAction={sectionStatusBadge(isEvidenceComplete, "Evidence")}
      >

        <input
          type="file"
          onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
        />
        <button
          onClick={uploadEvidence}
          disabled={uploading}
          style={{ marginLeft: "10px" }}
        >
          {uploading ? "Uploading..." : "Upload Evidence"}
        </button>

        <div style={{ marginTop: "12px" }}>
          <label>Evidence URL</label><br />
          <input
            value={evidenceUrl}
            onChange={(e) => setEvidenceUrl(e.target.value)}
            style={{ width: "100%", maxWidth: "800px", padding: "8px" }}
          />
        </div>

        <div style={{ marginTop: "12px" }}>
          <label>Evidence Notes</label><br />
          <textarea
            value={evidenceNotes}
            onChange={(e) => setEvidenceNotes(e.target.value)}
            rows={3}
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
                    {event.created_at ? new Date(event.created_at).toLocaleString() : "N/A"}
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
        title="12. Closure"
        subtitle={isClosureComplete ? "Complete: NCMR is closed and locked." : "Pending: complete closure review and e-signature."}
        defaultOpen={false}
        rightAction={sectionStatusBadge(isClosureComplete, "Closure")}
      >

        <label>Review Status</label><br />
        <select
          value={reviewStatus}
          onChange={(e) => setReviewStatus(e.target.value)}
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
            disabled={isLocked}
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
            <button onClick={saveWorkflow} disabled={isLocked}>
              Save Workflow
            </button>

            <button onClick={closeNcmr} disabled={isLocked}>
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


function TaskStatusList({ tasks }: { tasks: any[] }) {
  return (
    <div style={{ display: "grid", gap: "10px" }}>
      {tasks.map((task) => (
        <div
          key={task.id}
          style={{
            border:
              task.status === "completed"
                ? "1px solid #86efac"
                : task.status === "rejected"
                ? "1px solid #fca5a5"
                : "1px solid #facc15",
            background:
              task.status === "completed"
                ? "#f0fdf4"
                : task.status === "rejected"
                ? "#fef2f2"
                : "#fefce8",
            borderRadius: "8px",
            padding: "10px",
          }}
        >
          <strong>{task.task_title || task.required_function}</strong> — {task.status}
          <br />
          <strong>Assigned To:</strong> {task.assigned_to_email}
          <br />
          <strong>Due Date:</strong> {task.due_date || "N/A"}
          <br />
          <strong>Completed By:</strong> {task.completed_by || task.signed_by || "N/A"}
          <br />
          <strong>Completed At:</strong> {task.completed_at || task.signed_at || "N/A"}
          <br />
          <strong>Completion Comment:</strong> {task.completion_comment || task.approver_comment || "N/A"}
        </div>
      ))}
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

function ReworkVerificationCard({
  item,
  isLocked,
  onSave,
}: {
  item: any;
  isLocked: boolean;
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
    item.final_disposition_after_rework,
    item.final_rework_quantity_accepted,
    item.final_rework_quantity_rejected,
  ]);

  return (
    <div
      style={{
        border: "1px solid #bbf7d0",
        borderRadius: "8px",
        padding: "12px",
        background: "white",
        display: "grid",
        gap: "12px",
      }}
    >
      <h4 style={{ margin: 0 }}>
        Rework Verification — {item.product_part_number || "Part N/A"} / Lot {item.lot_number || "Lot N/A"}
      </h4>

      <div style={{ fontSize: "13px", color: "#374151" }}>
        Original impacted quantity: {item.quantity_affected ?? "N/A"} | Initial rework rejected quantity: {item.quantity_rejected ?? "N/A"}
      </div>

      <div>
        <label>Final Disposition After Rework</label>
        <br />
        <select
          value={finalDispositionAfterRework}
          onChange={(e) => setFinalDispositionAfterRework(e.target.value)}
          disabled={isLocked}
          style={{ padding: "8px", width: "100%" }}
        >
          <option value="">Select final disposition</option>
          <option value="accepted_after_rework">Accepted After Rework</option>
          <option value="scrap_after_rework">Scrap After Rework</option>
          <option value="additional_rework_required">Additional Rework Required</option>
          <option value="use_as_is_after_rework">Use As Is After Rework</option>
        </select>
      </div>

      <div>
        <label>Final Rework Quantity Accepted</label>
        <br />
        <input
          type="number"
          value={finalReworkQuantityAccepted}
          onChange={(e) => setFinalReworkQuantityAccepted(e.target.value)}
          disabled={isLocked}
          style={{ padding: "8px", width: "100%" }}
        />
      </div>

      <div>
        <label>Final Rework Quantity Rejected</label>
        <br />
        <input
          type="number"
          value={finalReworkQuantityRejected}
          onChange={(e) => setFinalReworkQuantityRejected(e.target.value)}
          disabled={isLocked}
          style={{ padding: "8px", width: "100%" }}
        />
      </div>

      <button
        type="button"
        disabled={isLocked}
        style={{ width: "fit-content" }}
        onClick={() =>
          onSave(
            item.id,
            item.product_disposition || "rework",
            item.disposition_justification || "Rework final disposition verified.",
            item.quantity_accepted !== null && item.quantity_accepted !== undefined
              ? String(item.quantity_accepted)
              : "0",
            item.quantity_rejected !== null && item.quantity_rejected !== undefined
              ? String(item.quantity_rejected)
              : String(item.quantity_affected || 0),
            finalDispositionAfterRework,
            finalReworkQuantityAccepted,
            finalReworkQuantityRejected
          )
        }
      >
        Save Rework Verification
      </button>

      {item.final_disposition_after_rework ? (
        <div
          style={{
            border: "1px solid #86efac",
            background: "#f0fdf4",
            color: "#166534",
            borderRadius: "8px",
            padding: "10px",
          }}
        >
          Final rework disposition saved.
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
            Final rework disposition becomes available after MRB approval and rework task completion.
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
