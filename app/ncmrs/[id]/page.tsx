"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

export default function NcmrDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [record, setRecord] = useState<any>(null);
  const [linkedCapa, setLinkedCapa] = useState<any>(null);
  const [mrbApprovers, setMrbApprovers] = useState<any[]>([]);
  const [affectedItems, setAffectedItems] = useState<any[]>([]);
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
  const [correctionActionProposal, setCorrectionActionProposal] = useState("");
  const [correctiveAction, setCorrectiveAction] = useState("");
  const [riskAssessment, setRiskAssessment] = useState("");
  const [severity, setSeverity] = useState("not_assessed");
  const [capaJustification, setCapaJustification] = useState("");
  const [productDisposition, setProductDisposition] = useState("");
  const [dispositionJustification, setDispositionJustification] = useState("");
  const [correctionImplementation, setCorrectionImplementation] = useState("");
  const [reviewStatus, setReviewStatus] = useState("draft");

  const [mrbSignatureEmail, setMrbSignatureEmail] = useState("");
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

  const [investigationCollaborationNotes, setInvestigationCollaborationNotes] = useState("");
  const [investigationCollaborators, setInvestigationCollaborators] = useState("");

  const [collaborationComments, setCollaborationComments] = useState<any[]>([]);
  const [newCollaborationComment, setNewCollaborationComment] = useState("");
  const [taggedUsers, setTaggedUsers] = useState("");

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

  const fetchMrbApprovers = async () => {
    const { data, error } = await supabase
      .from("ncmr_mrb_approvers")
      .select("*")
      .eq("ncmr_id", id)
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


  const fetchCollaborationComments = async () => {
    const { data, error } = await supabase
      .from("ncmr_comments")
      .select("*")
      .eq("ncmr_id", id)
      .order("created_at", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setCollaborationComments(data || []);
  };

  const postCollaborationComment = async () => {
    if (!newCollaborationComment.trim()) {
      alert("Comment is required.");
      return;
    }

    const taggedUserArray = taggedUsers
      .split(",")
      .map((user) => user.trim().toLowerCase())
      .filter((user) => user);

    const { error } = await supabase.from("ncmr_comments").insert({
      ncmr_id: id,
      comment_text: newCollaborationComment,
      created_by: userEmail,
      tagged_users: taggedUserArray.length > 0 ? taggedUserArray : null,
    });

    if (error) {
      alert(error.message);
      return;
    }

    if (taggedUserArray.length > 0) {
      const notifications = taggedUserArray.map((email) => ({
        recipient_email: email,
        subject: `Tagged in NCMR collaboration thread: ${record?.ncmr_number || "NCMR"}`,
        body: `${userEmail} tagged you in the NCMR collaboration thread.`,
        entity_type: "ncmr",
        entity_id: id,
        status: "pending",
      }));

      await supabase.from("notification_queue").insert(notifications);
    }

    await addAuditLog(
      "collaboration_comment_posted",
      `Collaboration comment posted by ${userEmail}.`
    );

    setNewCollaborationComment("");
    setTaggedUsers("");
    fetchCollaborationComments();
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
    setProductDisposition(data.product_disposition || data.disposition || "");
    setDispositionJustification(data.disposition_justification || "");
    setCorrectionImplementation(data.correction_implementation || "");
    setReviewStatus(data.review_status || "draft");
    setMrbSignatureEmail("");
    setAdditionalMrbApprovers(data.mrb_additional_approvers || "");
    setEvidenceUrl(data.evidence_url || "");
    setEvidenceNotes(data.evidence_notes || "");

    await fetchLinkedCapa(data.capa_id || null);
    await fetchMrbApprovers();
    await fetchAffectedItems();
    await fetchApprovalTasks();
    await fetchCorrectionTasks();
    await fetchReworkTasks();
    await fetchCollaborationComments();
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
  };

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

  const validateWorkflowForMrbApproval = () => {
    const errors: string[] = [];

    if (!investigator) errors.push("Investigator is required before MRB approval.");
    if (!problemDescription) errors.push("Problem description is required before MRB approval.");
    if (!investigationSummary) errors.push("Investigation summary is required before MRB approval.");
    if (!rootCauseCategory) errors.push("Root cause category is required before MRB approval.");
    if (!rootCause) errors.push("Root cause is required before MRB approval.");
    if (!riskAssessment) errors.push("Risk assessment is required before MRB approval.");
    if (severity === "not_assessed") errors.push("Severity must be assessed before MRB approval.");

    if (severity === "critical" && !record?.capa_id) {
      errors.push("Critical severity requires a linked CAPA before MRB approval.");
    }

    if (severity === "major" && !record?.capa_id && !capaJustification) {
      errors.push("Major severity requires a linked CAPA or a documented no-CAPA justification.");
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

    });

    const mrbGovernanceErrors = requiredMrbApprovalsComplete();
    errors.push(...mrbGovernanceErrors);

    setValidationErrors(errors);
    return errors.length === 0;
  };

  const validateWorkflowForClosure = () => {
    const errors: string[] = [];

    if (!record?.mrb_approved_by) errors.push("MRB approval is required before closure.");
    if (!correctionImplementation) errors.push("Correction implementation is required before closure.");
    if (!record?.correction_implemented_by) {
      errors.push("Correction implementation must be formally recorded before closure.");
    }
    if (!investigationSummary) errors.push("Investigation summary is required before closure.");
    if (!riskAssessment) errors.push("Risk assessment is required before closure.");
    if (severity === "critical" && !record?.capa_id) {
      errors.push("Critical severity requires a linked CAPA before closure.");
    }

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

  const saveMrbGovernance = async () => {
    if (record?.is_locked || record?.mrb_approved_by) {
      alert("MRB governance cannot be changed after MRB approval or record lock.");
      return;
    }

    const { error } = await supabase
      .from("ncmrs")
      .update({
        require_quality_approval: requireQualityApproval,
        require_operations_approval: requireOperationsApproval,
        require_regulatory_approval: requireRegulatoryApproval,
        require_supply_chain_approval: requireSupplyChainApproval,
        require_engineering_approval: requireEngineeringApproval,
        quality_approver_email: qualityApproverEmail || null,
        operations_approver_email: operationsApproverEmail || null,
        regulatory_approver_email: regulatoryApproverEmail || null,
        supply_chain_approver_email: supplyChainApproverEmail || null,
        engineering_approver_email: engineeringApproverEmail || null,
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await addAuditLog(
      "mrb_governance_saved",
      "MRB required approval functions and approver assignments were updated."
    );

    alert("MRB governance saved.");
    fetchRecord();
  };

  const generateMrbApprovalTasks = async () => {
    if (record?.is_locked || record?.mrb_approved_by) {
      alert("Approval tasks cannot be generated after MRB approval or record lock.");
      return;
    }

    const requiredTasks = [
      { required: requireQualityApproval, functionName: "Quality", email: qualityApproverEmail },
      { required: requireOperationsApproval, functionName: "Operations", email: operationsApproverEmail },
      { required: requireRegulatoryApproval, functionName: "Regulatory", email: regulatoryApproverEmail },
      { required: requireSupplyChainApproval, functionName: "Supply Chain", email: supplyChainApproverEmail },
      { required: requireEngineeringApproval, functionName: "Engineering", email: engineeringApproverEmail },
    ].filter((task) => task.required);

    const missingEmails = requiredTasks.filter((task) => !task.email);

    if (missingEmails.length > 0) {
      alert(
        `Missing approver email for: ${missingEmails
          .map((task) => task.functionName)
          .join(", ")}`
      );
      return;
    }

    const { error: saveError } = await supabase
      .from("ncmrs")
      .update({
        require_quality_approval: requireQualityApproval,
        require_operations_approval: requireOperationsApproval,
        require_regulatory_approval: requireRegulatoryApproval,
        require_supply_chain_approval: requireSupplyChainApproval,
        require_engineering_approval: requireEngineeringApproval,
        quality_approver_email: qualityApproverEmail || null,
        operations_approver_email: operationsApproverEmail || null,
        regulatory_approver_email: regulatoryApproverEmail || null,
        supply_chain_approver_email: supplyChainApproverEmail || null,
        engineering_approver_email: engineeringApproverEmail || null,
      })
      .eq("id", id);

    if (saveError) {
      alert(saveError.message);
      return;
    }

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

This approval becomes part of the official electronic quality record.`,
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

    await addAuditLog("mrb_approval_tasks_generated", `Generated ${taskRows.length} MRB approval task(s).`);

    alert("MRB approval tasks generated.");
    fetchRecord();
  };

  const requiredMrbApprovalsComplete = () => {
    const errors: string[] = [];

    const requiredFunctions = [
      { required: requireQualityApproval, functionName: "Quality" },
      { required: requireOperationsApproval, functionName: "Operations" },
      { required: requireRegulatoryApproval, functionName: "Regulatory" },
      { required: requireSupplyChainApproval, functionName: "Supply Chain" },
      { required: requireEngineeringApproval, functionName: "Engineering" },
    ].filter((item) => item.required);

    requiredFunctions.forEach((item) => {
      const task = approvalTasks.find(
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

  const saveWorkflow = async () => {
    if (record?.is_locked) {
      alert("This record is locked after electronic signature and cannot be edited.");
      return;
    }

    if (severity === "major" && !record?.capa_id && !capaJustification) {
      alert("For Major severity, CAPA is required OR justification must be provided.");
      return;
    }

    const payload: any = {
      investigator,
      problem_description: problemDescription,
      containment_action: containmentAction,
      investigation_summary: investigationSummary,
      investigation_collaboration_notes: investigationCollaborationNotes,
      investigation_collaborators: investigationCollaborators,
      root_cause: rootCause,
      root_cause_category: rootCauseCategory,
      correction_action_proposal: correctionActionProposal,
      corrective_action: correctiveAction,
      risk_assessment: riskAssessment,
      severity,
      capa_justification: capaJustification,
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

    if (severity === "critical" && !record?.capa_id) {
      const { data: capaData, error: capaError } = await supabase
        .from("capas")
        .insert({
          title: `CAPA for ${record.title}`,
          status: "open",
          source_type: "ncmr",
          capa_source: "Severity-based trigger: critical",
          ncmr_id: id,
          linked_ncmr_title: record.title,
          problem_description:
            problemDescription || record.issue_description || record.title,
          investigation_summary: investigationSummary,
          root_cause: rootCause,
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
          capa_justification: null,
        })
        .eq("id", id);

      if (ncmrUpdateError) {
        alert(ncmrUpdateError.message);
        return;
      }

      await addAuditLog(
        "critical_severity_capa_trigger",
        "CAPA automatically created because NCMR severity was assessed as critical."
      );

      alert("NCMR saved. CAPA automatically created because severity is Critical.");
      fetchRecord();
      return;
    }

    if (severity === "major" && !record?.capa_id && capaJustification) {
      await supabase
        .from("ncmrs")
        .update({
          capa_required: false,
          capa_justification: capaJustification,
        })
        .eq("id", id);

      await addAuditLog(
        "major_severity_no_capa_justification",
        `Major severity assessed with no CAPA. Justification: ${capaJustification}`
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

    if (severity === "major" && !record?.capa_id && !capaJustification) {
      return alert("For Major severity, CAPA is required OR justification must be provided before MRB approval.");
    }

    if (severity === "critical" && !record?.capa_id) {
      return alert("Critical severity requires a linked CAPA before MRB approval. Save workflow first to auto-create CAPA.");
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

    }

    const confirmed = window.confirm(
      "Electronic Signature:\n\nI have reviewed the nonconformance, risk assessment, severity, CAPA decision, product disposition, MRB rules, and approve the MRB decision."
    );

    if (!confirmed) return;

    const now = new Date().toISOString();

    const meaning =
      "I have reviewed the nonconformance, risk assessment, severity, CAPA decision, product disposition, MRB rules, and approve the MRB decision.";

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

  const generateInvestigationCollaborationTasks = async () => {
    if (record?.is_locked || record?.mrb_approved_by) {
      alert("Investigation collaborators cannot be assigned after MRB approval or record lock.");
      return;
    }

    const collaboratorEmails = investigationCollaborators
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter((email) => email);

    if (collaboratorEmails.length === 0) {
      alert("Enter at least one collaborator email.");
      return;
    }

    const taskRows = collaboratorEmails.map((email) => ({
      entity_type: "ncmr",
      entity_id: id,
      task_type: "investigation_collaboration",
      required_function: "Investigation Collaborator",
      task_title: `Investigation collaboration requested for ${record?.ncmr_number || "NCMR"}`,
      task_instructions:
        investigationCollaborationNotes ||
        "Please review the NCMR investigation and provide input to support problem definition, containment, root cause, risk assessment, or disposition decision.",
      assigned_to_email: email,
      assigned_by_email: userEmail,
      status: "pending",
      comments:
        investigationCollaborationNotes ||
        "Please review the NCMR investigation and provide collaboration input.",
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
        subject: `Investigation collaboration requested: ${record?.ncmr_number || "NCMR"}`,
        body: `You have been assigned an investigation collaboration task for ${record?.ncmr_number || "this NCMR"}. Please log in to QualiFlow and open My Tasks.`,
        entity_type: "ncmr",
        entity_id: id,
        task_id: task.id,
        status: "pending",
      }));

      await supabase.from("notification_queue").insert(notifications);
    }

    await addAuditLog(
      "investigation_collaboration_tasks_generated",
      `Investigation collaboration tasks assigned to ${collaboratorEmails.join(", ")}.`
    );

    alert("Investigation collaboration task(s) generated.");
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

  const requiredExecutionTasksComplete = () => {
    const errors: string[] = [];

    const hasCorrectionAction =
      correctionActionProposal &&
      correctionActionProposal !== "no_correction_required";

    if (hasCorrectionAction) {
      const completedCorrectionTask = correctionTasks.find(
        (task) => task.status === "completed"
      );

      if (!completedCorrectionTask) {
        errors.push("At least one correction task must be completed before closure.");
      }
    }

    if (hasReworkDisposition()) {
      const completedReworkTask = reworkTasks.find(
        (task) => task.status === "completed"
      );

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

    if (severity === "major" && !record?.capa_id && !capaJustification) {
      return alert("For Major severity, CAPA is required OR justification must be provided before closure.");
    }

    if (severity === "critical" && !record?.capa_id) {
      return alert("Critical severity requires a linked CAPA before closure.");
    }

    if (!productDisposition) return alert("Product disposition is required.");
    if (!dispositionJustification) return alert("Disposition justification is required.");
    if (!record?.mrb_approved_by) return alert("MRB approval is required before closure.");
    if (!correctionImplementation) return alert("Correction implementation is required.");

    if (!record?.correction_implemented_by) {
      return alert("Correction implementation must be formally recorded before closure.");
    }

    const confirmed = window.confirm(
      "Electronic Signature:\n\nI confirm this NCMR investigation, risk assessment, severity assessment, CAPA decision, disposition, MRB approval, correction implementation, and closure review are complete."
    );

    if (!confirmed) return;

    const now = new Date().toISOString();
    const meaning =
      "I confirm this NCMR investigation, risk assessment, severity assessment, CAPA decision, disposition, MRB approval, correction implementation, and closure review are complete.";

    const { error } = await supabase
      .from("ncmrs")
      .update({
        status: "closed",
        review_status: "completed",
        closed_at: now,
        ncmr_closed_by: userEmail,
        ncmr_signature_meaning: meaning,
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
    }
  }, [id]);

  if (loading) {
    return <main style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>Loading...</main>;
  }

  if (!record) {
    return <main style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>Record not found</main>;
  }

  const isLocked = record?.is_locked === true;
  const canEditInitiation = !isLocked && !record?.mrb_approved_by;

  return (
    <main style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>NCMR Controlled Workflow</h1>
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

      {validationErrors.length > 0 ? (
        <div
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
        <p><strong>CAPA Justification:</strong> {record.capa_justification || "N/A"}</p>
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

      <section style={{ marginBottom: "20px" }}>
        <h2>1. Initiation</h2>
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
      </section>

      <section style={{ marginBottom: "20px" }}>
        <h2>2. Containment</h2>

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
          style={{ width: "100%", maxWidth: "800px" }}
        />
      </section>

      <section style={{ marginBottom: "20px" }}>
        <h2>3. Investigation / Root Cause</h2>

        <label>Investigation Summary</label><br />
        <textarea
          value={investigationSummary}
          onChange={(e) => setInvestigationSummary(e.target.value)}
          rows={4}
          style={{ width: "100%", maxWidth: "800px", marginBottom: "12px" }}
        />


        <div
          style={{
            border: "1px solid #cbd5e1",
            borderRadius: "10px",
            padding: "14px",
            background: "#f8fafc",
            marginBottom: "16px",
          }}
        >
          <h3 style={{ marginTop: 0 }}>Investigation Collaboration Thread</h3>

          <p style={{ color: "#475569", fontSize: "14px" }}>
            Use this thread for investigation discussion, manufacturing feedback,
            supplier communication summaries, technical review, and cross-functional collaboration.
          </p>

          <label>New Collaboration Comment</label><br />
          <textarea
            value={newCollaborationComment}
            onChange={(e) => setNewCollaborationComment(e.target.value)}
            rows={4}
            placeholder="Enter investigation discussion, findings, or updates."
            style={{ width: "100%", maxWidth: "900px", marginBottom: "10px" }}
          />

          <br />
          <label>Tag Users (comma-separated emails)</label><br />
          <input
            value={taggedUsers}
            onChange={(e) => setTaggedUsers(e.target.value)}
            placeholder="quality@company.com, operations@company.com"
            style={{ width: "100%", maxWidth: "700px", padding: "8px", marginBottom: "10px" }}
          />

          <br />
          <button type="button" onClick={postCollaborationComment}>
            Post Collaboration Comment
          </button>

          <div style={{ marginTop: "18px" }}>
            <h4>Discussion History</h4>

            {collaborationComments.length === 0 ? (
              <p>No collaboration comments posted yet.</p>
            ) : (
              <div style={{ display: "grid", gap: "12px" }}>
                {collaborationComments.map((comment) => (
                  <div
                    key={comment.id}
                    style={{
                      border: "1px solid #d1d5db",
                      borderRadius: "8px",
                      padding: "12px",
                      background: "white",
                    }}
                  >
                    <div style={{ marginBottom: "8px", color: "#334155" }}>
                      <strong>{comment.created_by}</strong>
                      {" • "}
                      {new Date(comment.created_at).toLocaleString()}
                    </div>

                    <div style={{ whiteSpace: "pre-wrap", marginBottom: "8px" }}>
                      {comment.comment_text}
                    </div>

                    {comment.tagged_users && comment.tagged_users.length > 0 ? (
                      <div style={{ color: "#2563eb", fontSize: "14px" }}>
                        <strong>Tagged:</strong> {comment.tagged_users.join(", ")}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <br />
        <div
          style={{
            border: "1px solid #d1d5db",
            borderRadius: "8px",
            padding: "12px",
            background: "#f9fafb",
            marginBottom: "12px",
          }}
        >
          <h3 style={{ marginTop: 0 }}>Investigation Collaboration</h3>

          <label>Collaborator Emails</label><br />
          <input
            value={investigationCollaborators}
            onChange={(e) => setInvestigationCollaborators(e.target.value)}
            placeholder="Enter comma-separated collaborator emails"
            disabled={!canEditInitiation}
            style={{ padding: "8px", width: "100%", maxWidth: "800px", marginBottom: "10px" }}
          />

          <br />
          <label>Collaboration Notes / Instructions</label><br />
          <textarea
            value={investigationCollaborationNotes}
            onChange={(e) => setInvestigationCollaborationNotes(e.target.value)}
            placeholder="Capture investigation collaboration, SME input, manufacturing feedback, supplier input, regulatory input, or cross-functional comments."
            rows={4}
            disabled={!canEditInitiation}
            style={{ width: "100%", maxWidth: "800px", marginBottom: "10px" }}
          />

          <br />
          <button
            type="button"
            onClick={generateInvestigationCollaborationTasks}
            disabled={!canEditInitiation}
          >
            Generate Collaboration Task(s)
          </button>
        </div>

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
          style={{ width: "100%", maxWidth: "800px" }}
        />
      </section>

      <section style={{ marginBottom: "20px" }}>
        <h2>4. Correction / Corrective Action Proposal</h2>

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
          style={{ width: "100%", maxWidth: "800px" }}
        />
      </section>

      <section style={{ marginBottom: "20px" }}>
        <h2>5. Risk Assessment</h2>

        <label>Risk Assessment</label><br />
        <textarea
          value={riskAssessment}
          onChange={(e) => setRiskAssessment(e.target.value)}
          placeholder="Assess product, process, patient/user, regulatory, and quality risk."
          rows={4}
          style={{ width: "100%", maxWidth: "800px" }}
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

        {severity === "major" && !linkedCapa ? (
          <div style={{ marginTop: "12px" }}>
            <label>Justification for No CAPA</label><br />
            <textarea
              value={capaJustification}
              onChange={(e) => setCapaJustification(e.target.value)}
              placeholder="Required if severity is Major and no CAPA is linked."
              rows={3}
              style={{ width: "100%", maxWidth: "800px" }}
            />
          </div>
        ) : null}

        {severity === "critical" && !linkedCapa ? (
          <p style={{ color: "red", marginTop: "12px" }}>
            Critical severity requires CAPA. Save Workflow will automatically create one.
          </p>
        ) : null}
      </section>

      <section style={{ marginBottom: "20px" }}>
        <h2>6. Product Disposition / MRB Decision</h2>

        <label>Product Disposition</label><br />
        <select
          value={productDisposition}
          onChange={(e) => setProductDisposition(e.target.value)}
          style={{ padding: "8px", minWidth: "240px", marginBottom: "12px" }}
        >
          <option value="">Select disposition</option>
          <option value="use_as_is">Use As Is</option>
          <option value="rework">Rework</option>
          <option value="repair">Repair</option>
          <option value="scrap">Scrap</option>
          <option value="return_to_supplier">Return to Supplier</option>
          <option value="sort_screen">Sort / Screen</option>
          <option value="hold_pending_decision">Hold Pending Decision</option>
        </select>

        <br />
        <label>Disposition Justification</label><br />
        <textarea
          value={dispositionJustification}
          onChange={(e) => setDispositionJustification(e.target.value)}
          placeholder="Justify disposition based on risk assessment and investigation."
          rows={4}
          style={{ width: "100%", maxWidth: "800px" }}
        />

        <div style={{ marginTop: "18px" }}>
          <h3>Disposition by Affected Item</h3>
          <p style={{ color: "#4b5563", fontSize: "14px" }}>
            Add one disposition decision per affected item. Include quantity accepted and quantity rejected.
            If disposition is Rework, document the final disposition after rework with final accepted/rejected quantities.
            Overall MRB approval approves all saved item dispositions.
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
                  onSave={updateAffectedItemDisposition}
                />
              ))}
            </div>
          )}
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

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px" }}>
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
                style={{ width: "100%", maxWidth: "800px" }}
              />
            </div>

            <button type="button" onClick={generateReworkTask} disabled={isLocked} style={{ marginTop: "10px" }}>
              Generate Rework Task
            </button>

            <h4>Rework Task Status</h4>
            {reworkTasks.length === 0 ? <p>No rework tasks generated.</p> : <TaskStatusList tasks={reworkTasks} />}
          </div>
        ) : null}

        <div
          style={{
            marginTop: "18px",
            border: "1px solid #d1d5db",
            borderRadius: "8px",
            padding: "12px",
            background: "#f9fafb",
          }}
        >
          <h3 style={{ marginTop: 0 }}>MRB Required Approval Tasks</h3>
          <p style={{ color: "#4b5563", fontSize: "14px" }}>
            Assign named approvers for required MRB functions. Approvers log in to My Approval Tasks to approve or reject.
            Final MRB approval is blocked until all required approval tasks are approved.
          </p>

          <MrbApproverAssignmentRow label="Quality" required={requireQualityApproval} setRequired={setRequireQualityApproval} email={qualityApproverEmail} setEmail={setQualityApproverEmail} disabled={isLocked || !!record.mrb_approved_by} />
          <MrbApproverAssignmentRow label="Operations" required={requireOperationsApproval} setRequired={setRequireOperationsApproval} email={operationsApproverEmail} setEmail={setOperationsApproverEmail} disabled={isLocked || !!record.mrb_approved_by} />
          <MrbApproverAssignmentRow label="Regulatory" required={requireRegulatoryApproval} setRequired={setRequireRegulatoryApproval} email={regulatoryApproverEmail} setEmail={setRegulatoryApproverEmail} disabled={isLocked || !!record.mrb_approved_by} />
          <MrbApproverAssignmentRow label="Supply Chain" required={requireSupplyChainApproval} setRequired={setRequireSupplyChainApproval} email={supplyChainApproverEmail} setEmail={setSupplyChainApproverEmail} disabled={isLocked || !!record.mrb_approved_by} />
          <MrbApproverAssignmentRow label="Engineering" required={requireEngineeringApproval} setRequired={setRequireEngineeringApproval} email={engineeringApproverEmail} setEmail={setEngineeringApproverEmail} disabled={isLocked || !!record.mrb_approved_by} />

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "12px" }}>
            <button type="button" onClick={saveMrbGovernance} disabled={isLocked || !!record.mrb_approved_by}>
              Save Required Approvers
            </button>
            <button type="button" onClick={generateMrbApprovalTasks} disabled={isLocked || !!record.mrb_approved_by}>
              Generate Approval Tasks
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

        <div style={{ marginTop: "12px" }}>
          <label>Re-enter Your Email for MRB E-Signature</label><br />
          <input
            value={mrbSignatureEmail}
            onChange={(e) => setMrbSignatureEmail(e.target.value)}
            placeholder={userEmail || "your.email@company.com"}
            style={{ width: "100%", maxWidth: "500px", padding: "8px" }}
          />
        </div>

        <div style={{ marginTop: "12px" }}>
          <label>Additional MRB Approvers</label><br />
          <textarea
            value={additionalMrbApprovers}
            onChange={(e) => setAdditionalMrbApprovers(e.target.value)}
            placeholder="Enter comma-separated approver emails"
            rows={3}
            style={{ width: "100%", maxWidth: "800px" }}
          />
        </div>

        <div style={{ marginTop: "12px" }}>
          <button onClick={approveMrb} disabled={isLocked}>Approve MRB Decision</button>
        </div>

        {record.mrb_approved_by ? (
          <div style={{ marginTop: "12px" }}>
            <strong>MRB Approved By:</strong> {record.mrb_approved_by}<br />
            <strong>MRB Approved At:</strong> {record.mrb_approved_at}<br />
            <strong>Signature Email Entered:</strong> {record.mrb_signature_email_entered || "N/A"}<br />
            <strong>Signature Meaning:</strong> {record.mrb_signature_meaning}
          </div>
        ) : null}

        {mrbApprovers.length > 0 ? (
          <div style={{ marginTop: "12px" }}>
            <strong>Additional MRB Approvers:</strong>
            <ul>
              {mrbApprovers.map((approver) => (
                <li key={approver.id}>
                  {approver.approver_email} — {approver.approval_status}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section style={{ marginBottom: "20px" }}>
        <h2>7. Correction Implementation</h2>

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

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px" }}>
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
              style={{ width: "100%", maxWidth: "800px" }}
            />
          </div>

          <button type="button" onClick={generateCorrectionTask} disabled={isLocked} style={{ marginTop: "10px" }}>
            Generate Correction Task
          </button>

          <h4>Correction Task Status</h4>
          {correctionTasks.length === 0 ? <p>No correction tasks generated.</p> : <TaskStatusList tasks={correctionTasks} />}
        </div>

        <textarea
          value={correctionImplementation}
          onChange={(e) => setCorrectionImplementation(e.target.value)}
          placeholder="Describe how the correction was implemented."
          rows={4}
          style={{ width: "100%", maxWidth: "800px" }}
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
      </section>

      <section style={{ marginBottom: "20px" }}>
        <h2>8. Evidence</h2>

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
            style={{ width: "100%", maxWidth: "800px" }}
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
      </section>

      <section style={{ marginBottom: "20px" }}>
        <h2>9. Closure</h2>

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

        {record.ncmr_closed_by ? (
          <div style={{ marginTop: "12px" }}>
            <strong>NCMR Closed By:</strong> {record.ncmr_closed_by}<br />
            <strong>Closed At:</strong> {record.closed_at}<br />
            <strong>Signature Meaning:</strong> {record.ncmr_signature_meaning}
          </div>
        ) : null}
      </section>

      <button onClick={saveWorkflow} disabled={isLocked} style={{ marginRight: "10px" }}>
        Save Workflow
      </button>

      <button onClick={closeNcmr} disabled={isLocked} style={{ marginRight: "10px" }}>
        Close NCMR with E-Signature
      </button>

      <a href="/ncmrs">Back to NCMRs</a>
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
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "10px",
        }}
      >
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

function AffectedItemCard({
  item,
  isLocked,
  mrbApproved,
  onSave,
}: {
  item: any;
  isLocked: boolean;
  mrbApproved: boolean;
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
        {item.lot_number || "N/A"}
      </h4>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "8px",
          marginBottom: "12px",
        }}
      >
        <div><strong>Part Number:</strong> {item.product_part_number || "N/A"}</div>
        <div><strong>Lot Number:</strong> {item.lot_number || "N/A"}</div>
        <div><strong>Work Order:</strong> {item.workorder_number || "N/A"}</div>
        <div><strong>Qty Affected:</strong> {item.quantity_affected ?? "N/A"}</div>
        <div><strong>Qty Quarantined:</strong> {item.quarantined_quantity ?? "N/A"}</div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "10px",
        }}
      >
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
            <option value="use_as_is">Use As Is</option>
            <option value="rework">Rework</option>
            <option value="repair">Repair</option>
            <option value="scrap">Scrap</option>
            <option value="return_to_supplier">Return to Supplier</option>
            <option value="sort_screen">Sort / Screen</option>
            <option value="hold_pending_decision">Hold Pending Decision</option>
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
      </div>

      <div style={{ marginTop: "10px" }}>
        <label>Disposition Justification</label>
        <br />
        <textarea
          value={dispositionJustification}
          onChange={(e) => setDispositionJustification(e.target.value)}
          disabled={isLocked}
          rows={3}
          style={{ width: "100%", maxWidth: "900px", marginBottom: "8px" }}
        />
      </div>

      {productDisposition === "rework" && !mrbApproved ? (
        <p style={{ color: "#4b5563", marginTop: "10px" }}>
          Final rework disposition becomes available after MRB approval.
        </p>
      ) : null}

      {productDisposition === "rework" && mrbApproved ? (
        <div
          style={{
            marginTop: "12px",
            border: "1px solid #bfdbfe",
            background: "#eff6ff",
            padding: "12px",
            borderRadius: "8px",
          }}
        >
          <h4 style={{ marginTop: 0 }}>Final Disposition After Rework</h4>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "10px",
            }}
          >
            <div>
              <label>Final Disposition</label>
              <br />
              <select
                value={finalDispositionAfterRework}
                onChange={(e) => setFinalDispositionAfterRework(e.target.value)}
                disabled={isLocked}
                style={{ padding: "8px", width: "100%" }}
              >
                <option value="">Select final disposition</option>
                <option value="use_as_is">Use As Is</option>
                <option value="accept_after_rework">Accept After Rework</option>
                <option value="scrap">Scrap</option>
                <option value="return_to_supplier">Return to Supplier</option>
                <option value="additional_rework_required">Additional Rework Required</option>
              </select>
            </div>

            <div>
              <label>Final Qty Accepted</label>
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
              <label>Final Qty Rejected</label>
              <br />
              <input
                type="number"
                value={finalReworkQuantityRejected}
                onChange={(e) => setFinalReworkQuantityRejected(e.target.value)}
                disabled={isLocked}
                style={{ padding: "8px", width: "100%" }}
              />
            </div>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        disabled={isLocked}
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
        style={{ marginTop: "12px" }}
      >
        Save Item Disposition
      </button>

      <div
        style={{
          marginTop: "10px",
          border: item.product_disposition ? "1px solid #86efac" : "1px solid #facc15",
          background: item.product_disposition ? "#f0fdf4" : "#fefce8",
          padding: "10px",
          borderRadius: "8px",
        }}
      >
        <strong>Item Disposition Status:</strong>{" "}
        {item.product_disposition
          ? "Disposition saved; pending overall MRB approval"
          : "Pending item disposition"}
      </div>
    </div>
  );
}
