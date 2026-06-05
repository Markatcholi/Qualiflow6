"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import { createESignature } from "../../../lib/eSignatureEngine";

type ChangeControl = {
  id: string;
  change_number: string | null;
  change_title: string;
  change_description: string;
  change_justification: string;
  change_type: string | null;
  change_category: string | null;
  priority: string | null;
  status: string | null;
  owner_email: string | null;
  risk_level: string | null;
  impact_assessment?: string | null;
  product_impact?: boolean | null;
  document_impact?: boolean | null;
  process_impact?: boolean | null;
  equipment_impact?: boolean | null;
  supplier_impact?: boolean | null;
  software_impact?: boolean | null;
  regulatory_impact?: boolean | null;
  validation_impact?: boolean | null;
  training_impact?: boolean | null;
  risk_review_summary?: string | null;
  risk_acceptability?: string | null;
  residual_risk?: string | null;
  implementation_plan?: string | null;
  implementation_owner_email?: string | null;
  target_implementation_date?: string | null;
  verification_plan?: string | null;
  effectiveness_required?: boolean | null;
  effectiveness_plan?: string | null;
  approved_at?: string | null;
  approved_by?: string | null;
  closed_at?: string | null;
  closed_by?: string | null;
  created_at: string | null;
};

type ApprovalMatrixTemplate = {
  id: string;
  template_name: string;
  module_name: string;
  active: boolean | null;
};

type ChangeReviewer = {
  id: string;
  change_control_id: string;
  reviewer_type: string;
  reviewer_role: string | null;
  reviewer_email: string | null;
  required_reviewer: boolean | null;
  sequence_order: number | null;
  review_status: string | null;
  review_comments: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
};

const CHANGE_TYPES = ["ECO", "Process", "Document", "Supplier", "Software", "Equipment", "Material", "Other"];
const CATEGORIES = ["Design", "Manufacturing", "Quality System", "Supplier", "Regulatory", "Validation", "Document", "Other"];
const PRIORITIES = ["Low", "Medium", "High", "Critical"];
const RISKS = ["Low", "Medium", "High", "Critical"];
const REVIEWER_TYPES = ["formal_review", "approver"];

export default function ChangeControlWorkflowPage() {
  const params = useParams();
  const changeId = String(params?.id || "");

  const [change, setChange] = useState<ChangeControl | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [controlledDocuments, setControlledDocuments] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [trainingAssignments, setTrainingAssignments] = useState<any[]>([]);
  const [templates, setTemplates] = useState<ApprovalMatrixTemplate[]>([]);
  const [reviewers, setReviewers] = useState<ChangeReviewer[]>([]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [approvalComments, setApprovalComments] = useState<Record<string, string>>({});
  const [rejectionComment, setRejectionComment] = useState("");

  const [initiationForm, setInitiationForm] = useState({
    change_title: "",
    change_description: "",
    change_justification: "",
    change_type: "ECO",
    change_category: "Process",
    priority: "Medium",
    owner_email: "",
  });

  const [assessmentForm, setAssessmentForm] = useState({
    product_impact: false,
    document_impact: false,
    process_impact: false,
    equipment_impact: false,
    supplier_impact: false,
    software_impact: false,
    regulatory_impact: false,
    validation_impact: false,
    training_impact: false,
    impact_assessment: "",
  });

  const [riskForm, setRiskForm] = useState({
    risk_level: "Medium",
    risk_review_summary: "",
    risk_acceptability: "",
    residual_risk: "",
  });

  const [implementationForm, setImplementationForm] = useState({
    implementation_plan: "",
    implementation_owner_email: "",
    target_implementation_date: "",
    verification_plan: "",
    effectiveness_required: false,
    effectiveness_plan: "",
  });

  const [newReviewer, setNewReviewer] = useState({
    reviewer_type: "approver",
    reviewer_role: "",
    reviewer_email: "",
    required_reviewer: true,
    sequence_order: "1",
  });

  const [newDoc, setNewDoc] = useState({
    document_number: "",
    document_title: "",
    current_revision: "",
    proposed_revision: "",
    change_description: "",
    training_required: false,
  });

  const [newProduct, setNewProduct] = useState({
    product_part_number: "",
    product_name: "",
    lot_or_serial_scope: "",
    impact_description: "",
  });

  const [newTask, setNewTask] = useState({
    task_title: "",
    task_description: "",
    owner_email: "",
    due_date: "",
  });

  const canApprove =
    userRole === "admin" || userRole === "approver" || userRole === "vp_quality" || userRole === "quality";

  const canEditPlanning = Boolean(
    change &&
      (change.status === "draft" || change.status === "rejected" || change.status === "pending_approval")
  );

  const canImplement = Boolean(change && (change.status === "approved" || change.status === "implementation"));
  const canVerify = Boolean(change && (change.status === "implementation" || change.status === "verification"));

  const fetchUser = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const email = userData?.user?.email || "";
    setUserEmail(email);

    if (!email) return;

    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_email", email)
      .maybeSingle();

    setUserRole(data?.role || "user");
  };

  const fetchData = async () => {
    if (!changeId) return;
    setLoading(true);
    await fetchUser();

    const [changeRes, docRes, productRes, taskRes, controlledDocRes, trainingRes, templateRes, reviewerRes] = await Promise.all([
      supabase.from("change_controls").select("*").eq("id", changeId).maybeSingle(),
      supabase.from("change_control_documents").select("*").eq("change_control_id", changeId).order("created_at", { ascending: false }),
      supabase.from("change_control_products").select("*").eq("change_control_id", changeId).order("created_at", { ascending: false }),
      supabase.from("change_control_tasks").select("*").eq("change_control_id", changeId).order("created_at", { ascending: false }),
      supabase.from("controlled_documents").select("*").order("created_at", { ascending: false }),
      supabase.from("training_assignments").select("*").order("created_at", { ascending: false }),
      supabase.from("approval_matrix_templates").select("id, template_name, module_name, active").eq("module_name", "change_control").eq("active", true).order("template_name", { ascending: true }),
      supabase.from("change_control_reviewers").select("*").eq("change_control_id", changeId).order("sequence_order", { ascending: true }),
    ]);

    if (changeRes.error) alert(changeRes.error.message);
    else setChange((changeRes.data as ChangeControl) || null);
    if (!docRes.error) setDocuments(docRes.data || []);
    if (!productRes.error) setProducts(productRes.data || []);
    if (!taskRes.error) setTasks(taskRes.data || []);
    if (!controlledDocRes.error) setControlledDocuments(controlledDocRes.data || []);
    if (!trainingRes.error) setTrainingAssignments(trainingRes.data || []);
    if (!templateRes.error) {
      const data = (templateRes.data as ApprovalMatrixTemplate[]) || [];
      setTemplates(data);
      if (!selectedTemplateId && data.length > 0) setSelectedTemplateId(data[0].id);
    }
    if (!reviewerRes.error) setReviewers((reviewerRes.data as ChangeReviewer[]) || []);

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [changeId]);

  useEffect(() => {
    if (!change) return;

    setInitiationForm({
      change_title: change.change_title || "",
      change_description: change.change_description || "",
      change_justification: change.change_justification || "",
      change_type: change.change_type || "ECO",
      change_category: change.change_category || "Process",
      priority: change.priority || "Medium",
      owner_email: change.owner_email || "",
    });

    setAssessmentForm({
      product_impact: Boolean(change.product_impact),
      document_impact: Boolean(change.document_impact),
      process_impact: Boolean(change.process_impact),
      equipment_impact: Boolean(change.equipment_impact),
      supplier_impact: Boolean(change.supplier_impact),
      software_impact: Boolean(change.software_impact),
      regulatory_impact: Boolean(change.regulatory_impact),
      validation_impact: Boolean(change.validation_impact),
      training_impact: Boolean(change.training_impact),
      impact_assessment: change.impact_assessment || "",
    });

    setRiskForm({
      risk_level: change.risk_level || "Medium",
      risk_review_summary: change.risk_review_summary || "",
      risk_acceptability: change.risk_acceptability || "",
      residual_risk: change.residual_risk || "",
    });

    setImplementationForm({
      implementation_plan: change.implementation_plan || "",
      implementation_owner_email: change.implementation_owner_email || "",
      target_implementation_date: change.target_implementation_date || "",
      verification_plan: change.verification_plan || "",
      effectiveness_required: Boolean(change.effectiveness_required),
      effectiveness_plan: change.effectiveness_plan || "",
    });
  }, [change?.id]);

  const normalizeEmail = (value: string) => {
    const text = String(value || "").trim().toLowerCase();
    if (!text || !text.includes("@")) return "";
    return text;
  };

  const getNextRevisionValue = (revision: string | null | undefined) => {
    const value = String(revision || "").trim();

    if (/^\d+$/.test(value)) {
      return String(Number(value) + 1).padStart(value.length, "0");
    }

    if (/^[A-Z]$/i.test(value)) {
      const code = value.toUpperCase().charCodeAt(0);
      if (code >= 65 && code < 90) return String.fromCharCode(code + 1);
      return `${value}-1`;
    }

    const numericSuffix = value.match(/^(.*?)(\d+)$/);
    if (numericSuffix) {
      const prefix = numericSuffix[1];
      const numberText = numericSuffix[2];
      return `${prefix}${String(Number(numberText) + 1).padStart(numberText.length, "0")}`;
    }

    return value ? `${value}-1` : "01";
  };

  const linkedControlledDocuments = documents
    .map((doc) => controlledDocuments.find((cd) => cd.id === doc.controlled_document_id))
    .filter(Boolean);

  const implementationComplete = tasks.length === 0 ? false : tasks.every((task) => task.status === "complete");

  const documentsReleased = documents.length === 0
    ? true
    : linkedControlledDocuments.length === documents.length &&
      linkedControlledDocuments.every((doc: any) => doc.status === "release" || doc.status === "superseded");

  const trainingComplete = documents.length === 0 || documents.every((doc) => {
    if (!doc.training_required) return true;
    const linkedDoc = controlledDocuments.find((cd) => cd.id === doc.controlled_document_id);
    if (!linkedDoc) return false;
    const docTraining = trainingAssignments.filter((item) => item.document_id === linkedDoc.id);
    return docTraining.length > 0 && docTraining.every((item) => item.status === "completed" || item.status === "effectiveness_complete" || item.status === "waived");
  });

  const requiredReviewersApproved = reviewers
    .filter((reviewer) => reviewer.required_reviewer)
    .every((reviewer) => reviewer.review_status === "approved");

  const hasRequiredReviewers = reviewers.some((reviewer) => reviewer.required_reviewer);
  const closureEligible = implementationComplete && documentsReleased && trainingComplete;

  const savePlanningPackage = async () => {
    if (!change) return;
    if (!canEditPlanning) return alert("Planning sections are locked after approval.");
    if (!initiationForm.change_title.trim()) return alert("Change title is required.");
    if (!initiationForm.change_description.trim()) return alert("Change description is required.");
    if (!initiationForm.change_justification.trim()) return alert("Change justification is required.");
    if (initiationForm.owner_email && !normalizeEmail(initiationForm.owner_email)) return alert("Owner email must be valid.");
    if (!assessmentForm.impact_assessment.trim()) return alert("Impact assessment summary is required.");
    if (!riskForm.risk_review_summary.trim()) return alert("Risk review summary is required.");
    if (!riskForm.risk_acceptability.trim()) return alert("Risk acceptability is required.");

    setBusy(true);
    const { error } = await supabase
      .from("change_controls")
      .update({
        change_title: initiationForm.change_title.trim(),
        change_description: initiationForm.change_description.trim(),
        change_justification: initiationForm.change_justification.trim(),
        change_type: initiationForm.change_type,
        change_category: initiationForm.change_category,
        priority: initiationForm.priority,
        owner_email: normalizeEmail(initiationForm.owner_email) || userEmail || null,
        approver_email: null,
        ...assessmentForm,
        ...riskForm,
        updated_at: new Date().toISOString(),
      })
      .eq("id", change.id);

    if (error) alert(error.message);
    await fetchData();
    setBusy(false);
  };

  const saveImplementationPlan = async () => {
    if (!change) return;
    if (!canImplement && !canVerify) return alert("Implementation and verification planning is available after approval.");
    if (implementationForm.implementation_owner_email && !normalizeEmail(implementationForm.implementation_owner_email)) return alert("Implementation owner email must be valid.");

    setBusy(true);
    const { error } = await supabase
      .from("change_controls")
      .update({
        implementation_plan: implementationForm.implementation_plan || null,
        implementation_owner_email: normalizeEmail(implementationForm.implementation_owner_email) || null,
        target_implementation_date: implementationForm.target_implementation_date || null,
        verification_plan: implementationForm.verification_plan || null,
        effectiveness_required: implementationForm.effectiveness_required,
        effectiveness_plan: implementationForm.effectiveness_plan || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", change.id);

    if (error) alert(error.message);
    await fetchData();
    setBusy(false);
  };

  const loadApprovalTemplate = async () => {
    if (!change) return;
    if (!selectedTemplateId) return alert("Select an approval matrix template.");

    const { data, error } = await supabase
      .from("approval_matrix_reviewers")
      .select("*")
      .eq("template_id", selectedTemplateId)
      .eq("active", true)
      .order("sequence_order", { ascending: true });

    if (error) return alert(error.message);

    const rows = (data || []).map((reviewer: any) => ({
      change_control_id: change.id,
      reviewer_type: reviewer.reviewer_type || "approver",
      reviewer_role: reviewer.reviewer_role || null,
      reviewer_email: reviewer.reviewer_email || null,
      required_reviewer: reviewer.required_reviewer ?? true,
      sequence_order: reviewer.sequence_order || 1,
      review_status: "pending",
      assigned_by: userEmail || "unknown",
    }));

    if (rows.length === 0) return alert("The selected template has no active reviewer rows.");

    const insertRes = await supabase.from("change_control_reviewers").insert(rows);
    if (insertRes.error) return alert(insertRes.error.message);

    await fetchData();
  };

  const addReviewer = async () => {
    if (!change) return;
    if (!newReviewer.reviewer_role.trim() && !newReviewer.reviewer_email.trim()) return alert("Reviewer role or reviewer email is required.");
    const reviewerEmail = normalizeEmail(newReviewer.reviewer_email);
    if (newReviewer.reviewer_email && !reviewerEmail) return alert("Reviewer email must be valid.");
    const sequence = Number(newReviewer.sequence_order || 1);

    const { error } = await supabase.from("change_control_reviewers").insert({
      change_control_id: change.id,
      reviewer_type: newReviewer.reviewer_type,
      reviewer_role: newReviewer.reviewer_role || null,
      reviewer_email: reviewerEmail || null,
      required_reviewer: newReviewer.required_reviewer,
      sequence_order: sequence,
      review_status: "pending",
      assigned_by: userEmail || "unknown",
    });

    if (error) return alert(error.message);

    setNewReviewer({
      reviewer_type: "approver",
      reviewer_role: "",
      reviewer_email: "",
      required_reviewer: true,
      sequence_order: String(sequence + 1),
    });
    fetchData();
  };

  const reviewerDecision = async (reviewer: ChangeReviewer, decision: "approved" | "rejected") => {
    if (!change) return;
    const comments = approvalComments[reviewer.id] || "";
    const currentUser = normalizeEmail(userEmail);
    const assignedUser = normalizeEmail(reviewer.reviewer_email || "");

    if (assignedUser && currentUser !== assignedUser && !canApprove) {
      return alert("Only the assigned reviewer or an authorized approver can complete this review.");
    }

    if (decision === "rejected" && !comments.trim()) return alert("Rejection comments are required.");

    setBusy(true);

    const { error } = await supabase
      .from("change_control_reviewers")
      .update({
        review_status: decision,
        review_comments: comments || null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: userEmail || "unknown",
      })
      .eq("id", reviewer.id);

    if (error) {
      setBusy(false);
      return alert(error.message);
    }

    await createESignature({
      moduleName: "change_control",
      recordId: change.id,
      actionType: decision === "approved" ? "approve_change_reviewer" : "reject_change_reviewer",
      signedBy: userEmail || "unknown",
      signerRole: userRole || reviewer.reviewer_role || null,
      signatureMeaning: decision === "approved" ? "Approve Change Review" : "Reject Change Review",
      signatureReason: comments || (decision === "approved" ? "Approved change control review." : "Rejected change control review."),
    });

    if (decision === "rejected") {
      await supabase
        .from("change_controls")
        .update({ status: "rejected", approval_comments: comments || "Rejected during change review.", updated_at: new Date().toISOString() })
        .eq("id", change.id);
    }

    setApprovalComments({ ...approvalComments, [reviewer.id]: "" });
    await fetchData();
    setBusy(false);
  };

  const updateStatus = async (status: string) => {
    if (!change) return;
    const payload: any = { status, updated_at: new Date().toISOString() };

    if (status === "pending_approval") {
      if (!assessmentForm.impact_assessment.trim() || !riskForm.risk_review_summary.trim() || !riskForm.risk_acceptability.trim()) {
        return alert("Impact assessment, risk review summary, and risk acceptability are required before submitting for approval.");
      }
      if (!hasRequiredReviewers) return alert("Load an approval matrix or add at least one required reviewer before submitting for approval.");
      payload.submitted_at = new Date().toISOString();
      payload.submitted_by = userEmail;
    }

    if (status === "approved") {
      if (!canApprove) return alert("Only authorized approvers/admin/VP Quality can approve.");
      if (!requiredReviewersApproved) return alert("All required reviewers must approve before the change can be approved.");
      payload.approved_at = new Date().toISOString();
      payload.approved_by = userEmail;
      payload.approval_comments = "Change approved after approval matrix review.";
    }

    if (status === "implementation") {
      if (change.status !== "approved") return alert("Only approved changes can move to implementation.");
      payload.actual_implementation_date = new Date().toISOString().slice(0, 10);
    }

    if (status === "verification") {
      if (!implementationComplete) return alert("All implementation tasks must be complete before verification.");
    }

    if (status === "closed") {
      if (!closureEligible) return alert("Cannot close change. Implementation tasks, linked released documents, and required training must be complete.");
      payload.closed_at = new Date().toISOString();
      payload.closed_by = userEmail;
      payload.documents_effective = documentsReleased;
      payload.training_complete = trainingComplete;
      payload.implementation_complete = implementationComplete;
      payload.closure_block_reason = null;
    }

    const { error } = await supabase.from("change_controls").update(payload).eq("id", change.id);
    if (error) return alert(error.message);
    fetchData();
  };

  const resubmitRejectedChange = async () => {
    if (!change) return;
    if (!rejectionComment.trim()) return alert("Enter a resubmission comment.");

    await supabase.from("change_control_reviewers").update({ review_status: "pending", review_comments: null, reviewed_at: null, reviewed_by: null }).eq("change_control_id", change.id);

    const { error } = await supabase
      .from("change_controls")
      .update({ status: "draft", approval_comments: rejectionComment, updated_at: new Date().toISOString() })
      .eq("id", change.id);

    if (error) return alert(error.message);
    setRejectionComment("");
    fetchData();
  };

  const addDocument = async () => {
    if (!change) return;
    if (!canImplement) return alert("Affected document implementation is available after change approval.");
    if (!newDoc.document_number.trim()) return alert("Document number is required.");

    const { error } = await supabase.from("change_control_documents").insert({
      change_control_id: changeId,
      document_number: newDoc.document_number,
      document_title: newDoc.document_title,
      current_revision: newDoc.current_revision,
      proposed_revision: newDoc.proposed_revision,
      change_description: newDoc.change_description,
      training_required: newDoc.training_required,
      document_status: "planned",
    });
    if (error) return alert(error.message);
    setNewDoc({ document_number: "", document_title: "", current_revision: "", proposed_revision: "", change_description: "", training_required: false });
    fetchData();
  };

  const createControlledDocumentFromChange = async (linkedDoc: any) => {
    if (!change) return;
    if (!canImplement) return alert("Controlled document revisions can only be created after change approval.");

    const documentNumber = String(linkedDoc.document_number || "").trim();
    const requestedRevision = String(linkedDoc.proposed_revision || "").trim();
    const currentRevision = String(linkedDoc.current_revision || "").trim();

    if (!documentNumber) return alert("Document number is required.");

    const matchingDocuments = controlledDocuments
      .filter((doc: any) => String(doc.document_number || "").trim() === documentNumber)
      .sort((a: any, b: any) => String(b.created_at || "").localeCompare(String(a.created_at || "")));

    const releasedOrHistoricalDocuments = matchingDocuments.filter((doc: any) =>
      doc.status === "release" || doc.status === "effective" || doc.status === "superseded"
    );

    const sourceDoc = currentRevision
      ? matchingDocuments.find((doc: any) => String(doc.revision || "").trim() === currentRevision) ||
        releasedOrHistoricalDocuments[0] ||
        matchingDocuments[0] ||
        null
      : releasedOrHistoricalDocuments[0] || matchingDocuments[0] || null;

    const isExistingControlledDocument = Boolean(sourceDoc);

    const revisionToCreate = isExistingControlledDocument
      ? requestedRevision || getNextRevisionValue(sourceDoc?.revision)
      : requestedRevision || "A";

    if (!revisionToCreate) {
      return alert("Unable to determine the new revision. Enter a proposed revision and try again.");
    }

    const duplicateRevision = matchingDocuments.find(
      (doc: any) => String(doc.revision || "").trim() === revisionToCreate
    );

    if (duplicateRevision) {
      return alert(
        `Document ${documentNumber} Rev ${revisionToCreate} already exists. Enter a new proposed revision before creating the controlled document revision.`
      );
    }

    const masterSourceDoc =
      (sourceDoc?.file_url ? sourceDoc : null) ||
      releasedOrHistoricalDocuments.find((doc: any) => doc.file_url) ||
      matchingDocuments.find((doc: any) => doc.file_url) ||
      null;

    const insertPayload: any = {
      document_number: documentNumber,
      title: linkedDoc.document_title || sourceDoc?.title || documentNumber,
      document_type: sourceDoc?.document_type || masterSourceDoc?.document_type || null,
      department: sourceDoc?.department || masterSourceDoc?.department || null,
      process_area: sourceDoc?.process_area || masterSourceDoc?.process_area || null,
      revision: revisionToCreate,
      status: "draft",
      file_name: masterSourceDoc?.file_name || null,
      file_path: masterSourceDoc?.file_path || null,
      file_url: masterSourceDoc?.file_url || null,
      release_pdf_file_name: null,
      release_pdf_file_path: null,
      release_pdf_file_url: null,
      controlled_copy_file_name: null,
      controlled_copy_file_path: null,
      controlled_copy_file_url: null,
      controlled_copy_generated_at: null,
      controlled_copy_generated_by: null,
      originating_change_control_id: change.id,
      change_required: true,
      change_summary: linkedDoc.change_description || change.change_description,
      change_rationale: change.change_justification,
      revision_change_description: linkedDoc.change_description || change.change_description,
      revision_change_justification: change.change_justification,
      superseded_document_id: sourceDoc?.id || null,
      superseded_by_document_id: null,
      owner_email: change.owner_email || sourceDoc?.owner_email || masterSourceDoc?.owner_email || userEmail || null,
      approver_email: null,
      effective_date: null,
      approved_at: null,
      approved_by: null,
      approval_comments: null,
      submitted_for_approval_at: null,
      submitted_for_approval_by: null,
      release_comments: null,
      release_approved_by: null,
      release_approved_at: null,
      collaboration_required: sourceDoc?.collaboration_required ?? true,
      formal_review_required: sourceDoc?.formal_review_required ?? true,
      collaboration_completed: false,
      formal_review_completed: false,
      training_impact: linkedDoc.training_required ? "FORMAL_TRAINING" : "NO_TRAINING",
      training_required: linkedDoc.training_required || false,
      read_ack_required: linkedDoc.training_required || false,
      created_by: userEmail || "unknown",
    };

    const { data, error } = await supabase
      .from("controlled_documents")
      .insert(insertPayload)
      .select()
      .single();

    if (error) return alert(error.message);

    if (sourceDoc?.id) {
      await supabase
        .from("controlled_documents")
        .update({
          superseded_by_document_id: data.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sourceDoc.id);
    }

    const linkRes = await supabase
      .from("change_control_documents")
      .update({
        controlled_document_id: data.id,
        current_revision: sourceDoc?.revision || linkedDoc.current_revision || null,
        proposed_revision: revisionToCreate,
        document_title: linkedDoc.document_title || sourceDoc?.title || documentNumber,
        document_status: "draft",
      })
      .eq("id", linkedDoc.id);

    if (linkRes.error) return alert(linkRes.error.message);

    alert(
      masterSourceDoc?.file_url
        ? `Controlled document revision ${revisionToCreate} created. The editable master/redline source was carried forward.`
        : `Controlled document revision ${revisionToCreate} created. No editable master/redline source was found to carry forward.`
    );
    fetchData();
  };

  const addProduct = async () => {
    if (!canImplement) return alert("Affected products are managed after change approval.");
    if (!newProduct.product_part_number.trim()) return alert("Product part number is required.");
    const { error } = await supabase.from("change_control_products").insert({ change_control_id: changeId, ...newProduct });
    if (error) return alert(error.message);
    setNewProduct({ product_part_number: "", product_name: "", lot_or_serial_scope: "", impact_description: "" });
    fetchData();
  };

  const addTask = async () => {
    if (!canImplement) return alert("Implementation tasks are managed after change approval.");
    if (!newTask.task_title.trim()) return alert("Task title is required.");
    if (!normalizeEmail(newTask.owner_email)) return alert("Task owner email is required.");
    const { error } = await supabase.from("change_control_tasks").insert({
      change_control_id: changeId,
      ...newTask,
      owner_email: normalizeEmail(newTask.owner_email),
      status: "open",
      created_by: userEmail || "unknown",
    });
    if (error) return alert(error.message);
    setNewTask({ task_title: "", task_description: "", owner_email: "", due_date: "" });
    fetchData();
  };

  const completeTask = async (id: string) => {
    const { error } = await supabase
      .from("change_control_tasks")
      .update({ status: "complete", completed_at: new Date().toISOString(), completed_by: userEmail })
      .eq("id", id);
    if (error) return alert(error.message);
    fetchData();
  };

  if (loading) return <main style={pageStyle}>Loading Change Workflow...</main>;
  if (!change) return <main style={pageStyle}><h1>Change not found</h1><a href="/change-control">Back to Change Control</a></main>;

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>CHANGE WORKFLOW EXECUTION</div>
          <h1 style={{ margin: "6px 0" }}>{change.change_number || "Change"} — {change.change_title}</h1>
          <p style={subtleText}>{change.change_description}</p>
        </div>
        <div style={buttonRowStyle}>
          <a href="/change-control" style={secondaryLinkStyle}>Back to Change Control</a>
          <a href="/dashboard" style={darkButtonStyle}>Dashboard</a>
        </div>
      </header>

      <section style={kpiGridStyle}>
        <KpiCard title="Implementation Complete" value={implementationComplete ? "Yes" : "No"} color={implementationComplete ? "#15803d" : "#dc2626"} />
        <KpiCard title="Documents Released" value={documentsReleased ? "Yes" : "No"} color={documentsReleased ? "#15803d" : "#dc2626"} />
        <KpiCard title="Training Complete" value={trainingComplete ? "Yes" : "No"} color={trainingComplete ? "#15803d" : "#dc2626"} />
        <KpiCard title="Closure Eligible" value={closureEligible ? "Yes" : "No"} color={closureEligible ? "#15803d" : "#dc2626"} />
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Workflow Actions</h2>
        <div style={buttonRowStyle}>
          {(change.status === "draft" || change.status === "rejected") ? <button onClick={savePlanningPackage} disabled={busy} style={primaryButtonStyle}>Save Planning Package</button> : null}
          {(change.status === "draft" || change.status === "rejected") ? <button onClick={() => updateStatus("pending_approval")} disabled={busy} style={primaryButtonStyle}>Submit for Approval</button> : null}
          {change.status === "pending_approval" ? <button onClick={() => updateStatus("approved")} disabled={busy} style={primaryButtonStyle}>Finalize Approval</button> : null}
          {change.status === "approved" ? <button onClick={() => updateStatus("implementation")} disabled={busy} style={primaryButtonStyle}>Start Implementation</button> : null}
          {change.status === "implementation" ? <button onClick={() => updateStatus("verification")} disabled={busy} style={primaryButtonStyle}>Move to Verification</button> : null}
          {change.status === "verification" ? <button onClick={() => updateStatus("closed")} disabled={busy} style={primaryButtonStyle}>Close Change</button> : null}
          <StatusBadge status={change.status || "draft"} />
        </div>
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>1. Initiation</h2>
        {canEditPlanning ? (
          <>
            <div style={gridStyle}>
              <Field label="Change Title"><input value={initiationForm.change_title} onChange={(e) => setInitiationForm({ ...initiationForm, change_title: e.target.value })} style={inputStyle} /></Field>
              <Field label="Change Type"><select value={initiationForm.change_type} onChange={(e) => setInitiationForm({ ...initiationForm, change_type: e.target.value })} style={inputStyle}>{CHANGE_TYPES.map((x) => <option key={x} value={x}>{x}</option>)}</select></Field>
              <Field label="Change Category"><select value={initiationForm.change_category} onChange={(e) => setInitiationForm({ ...initiationForm, change_category: e.target.value })} style={inputStyle}>{CATEGORIES.map((x) => <option key={x} value={x}>{x}</option>)}</select></Field>
              <Field label="Priority"><select value={initiationForm.priority} onChange={(e) => setInitiationForm({ ...initiationForm, priority: e.target.value })} style={inputStyle}>{PRIORITIES.map((x) => <option key={x} value={x}>{x}</option>)}</select></Field>
              <Field label="Owner Email"><input type="email" value={initiationForm.owner_email} onChange={(e) => setInitiationForm({ ...initiationForm, owner_email: e.target.value })} style={inputStyle} /></Field>
            </div>
            <Field label="Change Description"><textarea value={initiationForm.change_description} onChange={(e) => setInitiationForm({ ...initiationForm, change_description: e.target.value })} rows={4} style={textareaStyle} /></Field>
            <Field label="Change Justification / Rationale"><textarea value={initiationForm.change_justification} onChange={(e) => setInitiationForm({ ...initiationForm, change_justification: e.target.value })} rows={4} style={textareaStyle} /></Field>
          </>
        ) : (
          <div style={gridStyle}>
            <Detail label="Type" value={change.change_type || "N/A"} />
            <Detail label="Category" value={change.change_category || "N/A"} />
            <Detail label="Priority" value={change.priority || "N/A"} />
            <Detail label="Owner" value={change.owner_email || "N/A"} />
            <Detail label="Description" value={change.change_description || "N/A"} />
            <Detail label="Justification" value={change.change_justification || "N/A"} />
          </div>
        )}
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>2. Impact Assessment</h2>
        {canEditPlanning ? (
          <>
            <div style={checkboxGridStyle}>
              {[["product_impact", "Product"], ["document_impact", "Document"], ["process_impact", "Process"], ["equipment_impact", "Equipment"], ["supplier_impact", "Supplier"], ["software_impact", "Software"], ["regulatory_impact", "Regulatory"], ["validation_impact", "Validation"], ["training_impact", "Training"]].map(([key, label]) => (
                <label key={key}><input type="checkbox" checked={(assessmentForm as any)[key]} onChange={(e) => setAssessmentForm({ ...assessmentForm, [key]: e.target.checked } as any)} /> {label}</label>
              ))}
            </div>
            <Field label="Impact Assessment Summary"><textarea value={assessmentForm.impact_assessment} onChange={(e) => setAssessmentForm({ ...assessmentForm, impact_assessment: e.target.value })} rows={4} style={textareaStyle} /></Field>
          </>
        ) : (
          <>
            <div style={checkboxGridStyle}>
              <Impact label="Product" value={change.product_impact} />
              <Impact label="Document" value={change.document_impact} />
              <Impact label="Process" value={change.process_impact} />
              <Impact label="Equipment" value={change.equipment_impact} />
              <Impact label="Supplier" value={change.supplier_impact} />
              <Impact label="Software" value={change.software_impact} />
              <Impact label="Regulatory" value={change.regulatory_impact} />
              <Impact label="Validation" value={change.validation_impact} />
              <Impact label="Training" value={change.training_impact} />
            </div>
            <Detail label="Impact Summary" value={change.impact_assessment || "N/A"} />
          </>
        )}
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>3. Risk Review</h2>
        {canEditPlanning ? (
          <>
            <div style={gridStyle}>
              <Field label="Risk Level"><select value={riskForm.risk_level} onChange={(e) => setRiskForm({ ...riskForm, risk_level: e.target.value })} style={inputStyle}>{RISKS.map((x) => <option key={x} value={x}>{x}</option>)}</select></Field>
              <Field label="Risk Acceptability"><input value={riskForm.risk_acceptability} onChange={(e) => setRiskForm({ ...riskForm, risk_acceptability: e.target.value })} style={inputStyle} /></Field>
              <Field label="Residual Risk"><input value={riskForm.residual_risk} onChange={(e) => setRiskForm({ ...riskForm, residual_risk: e.target.value })} style={inputStyle} /></Field>
            </div>
            <Field label="Risk Review Summary"><textarea value={riskForm.risk_review_summary} onChange={(e) => setRiskForm({ ...riskForm, risk_review_summary: e.target.value })} rows={4} style={textareaStyle} /></Field>
          </>
        ) : (
          <div style={gridStyle}>
            <Detail label="Risk Level" value={change.risk_level || "N/A"} />
            <Detail label="Risk Acceptability" value={change.risk_acceptability || "N/A"} />
            <Detail label="Residual Risk" value={change.residual_risk || "N/A"} />
            <Detail label="Risk Review Summary" value={change.risk_review_summary || "N/A"} />
          </div>
        )}
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>4. Approval Matrix & Review</h2>
        {change.status === "draft" || change.status === "rejected" || change.status === "pending_approval" ? (
          <div style={gridStyle}>
            <Field label="Approval Matrix Template">
              <select value={selectedTemplateId} onChange={(e) => setSelectedTemplateId(e.target.value)} style={inputStyle}>
                <option value="">Select template</option>
                {templates.map((template) => <option key={template.id} value={template.id}>{template.template_name}</option>)}
              </select>
            </Field>
            <Field label="Load Template"><button onClick={loadApprovalTemplate} disabled={busy || !selectedTemplateId} style={primaryButtonStyle}>Load Template</button></Field>
          </div>
        ) : null}

        <div style={subCardStyle}>
          <h3 style={{ marginTop: 0 }}>Assigned Reviewers</h3>
          {reviewers.length === 0 ? <p style={subtleText}>No reviewers assigned yet.</p> : (
            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead><tr><th style={thStyle}>Seq</th><th style={thStyle}>Phase</th><th style={thStyle}>Role</th><th style={thStyle}>Email</th><th style={thStyle}>Required</th><th style={thStyle}>Status</th><th style={thStyle}>Action</th></tr></thead>
                <tbody>{reviewers.map((reviewer) => (
                  <tr key={reviewer.id}>
                    <td style={tdStyle}>{reviewer.sequence_order || 1}</td>
                    <td style={tdStyle}>{getReviewerTypeLabel(reviewer.reviewer_type)}</td>
                    <td style={tdStyle}>{reviewer.reviewer_role || "N/A"}</td>
                    <td style={tdStyle}>{reviewer.reviewer_email || "Role-based"}</td>
                    <td style={tdStyle}>{reviewer.required_reviewer ? "Yes" : "No"}</td>
                    <td style={tdStyle}><StatusBadge status={reviewer.review_status || "pending"} /></td>
                    <td style={tdStyle}>{change.status === "pending_approval" && reviewer.review_status !== "approved" && reviewer.review_status !== "rejected" ? <div style={buttonRowStyle}><input placeholder="Comments" value={approvalComments[reviewer.id] || ""} onChange={(e) => setApprovalComments({ ...approvalComments, [reviewer.id]: e.target.value })} style={inputStyle} /><button onClick={() => reviewerDecision(reviewer, "approved")} style={primaryButtonStyle}>Approve</button><button onClick={() => reviewerDecision(reviewer, "rejected")} style={dangerButtonStyle}>Reject</button></div> : "—"}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>

        {(change.status === "draft" || change.status === "rejected") ? (
          <div style={subCardStyle}>
            <h3 style={{ marginTop: 0 }}>Add Reviewer</h3>
            <div style={gridStyle}>
              <Field label="Review Phase"><select value={newReviewer.reviewer_type} onChange={(e) => setNewReviewer({ ...newReviewer, reviewer_type: e.target.value })} style={inputStyle}>{REVIEWER_TYPES.map((type) => <option key={type} value={type}>{getReviewerTypeLabel(type)}</option>)}</select></Field>
              <Field label="Reviewer Role"><input value={newReviewer.reviewer_role} onChange={(e) => setNewReviewer({ ...newReviewer, reviewer_role: e.target.value })} style={inputStyle} /></Field>
              <Field label="Reviewer Email Optional"><input type="email" value={newReviewer.reviewer_email} onChange={(e) => setNewReviewer({ ...newReviewer, reviewer_email: e.target.value })} style={inputStyle} /></Field>
              <Field label="Sequence"><input type="number" min="1" value={newReviewer.sequence_order} onChange={(e) => setNewReviewer({ ...newReviewer, sequence_order: e.target.value })} style={inputStyle} /></Field>
              <Field label="Required"><label><input type="checkbox" checked={newReviewer.required_reviewer} onChange={(e) => setNewReviewer({ ...newReviewer, required_reviewer: e.target.checked })} /> Required Reviewer</label></Field>
            </div>
            <button onClick={addReviewer} disabled={busy} style={primaryButtonStyle}>Add Reviewer</button>
          </div>
        ) : null}

        {change.status === "rejected" ? (
          <div style={warningStyle}>
            <strong>Change Rejected / Returned</strong>
            <Field label="Resubmission Comment"><textarea value={rejectionComment} onChange={(e) => setRejectionComment(e.target.value)} rows={3} style={textareaStyle} /></Field>
            <button onClick={resubmitRejectedChange} style={primaryButtonStyle}>Return to Draft for Update</button>
          </div>
        ) : null}
      </section>

      {(change.status === "approved" || change.status === "implementation" || change.status === "verification" || change.status === "closed") ? (
        <>
          <section style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>5. Implementation & Verification Plan</h2>
            {(canImplement || canVerify) && change.status !== "closed" ? (
              <>
                <div style={gridStyle}>
                  <Field label="Implementation Owner Email"><input type="email" value={implementationForm.implementation_owner_email} onChange={(e) => setImplementationForm({ ...implementationForm, implementation_owner_email: e.target.value })} style={inputStyle} /></Field>
                  <Field label="Target Implementation Date"><input type="date" value={implementationForm.target_implementation_date} onChange={(e) => setImplementationForm({ ...implementationForm, target_implementation_date: e.target.value })} style={inputStyle} /></Field>
                </div>
                <Field label="Implementation Plan"><textarea value={implementationForm.implementation_plan} onChange={(e) => setImplementationForm({ ...implementationForm, implementation_plan: e.target.value })} rows={4} style={textareaStyle} /></Field>
                <Field label="Verification Plan"><textarea value={implementationForm.verification_plan} onChange={(e) => setImplementationForm({ ...implementationForm, verification_plan: e.target.value })} rows={4} style={textareaStyle} /></Field>
                <label><input type="checkbox" checked={implementationForm.effectiveness_required} onChange={(e) => setImplementationForm({ ...implementationForm, effectiveness_required: e.target.checked })} /> Effectiveness Check Required</label>
                <Field label="Effectiveness Plan"><textarea value={implementationForm.effectiveness_plan} onChange={(e) => setImplementationForm({ ...implementationForm, effectiveness_plan: e.target.value })} rows={3} style={textareaStyle} /></Field>
                <button onClick={saveImplementationPlan} disabled={busy} style={primaryButtonStyle}>Save Implementation / Verification Plan</button>
              </>
            ) : (
              <div style={gridStyle}>
                <Detail label="Implementation Owner" value={change.implementation_owner_email || "N/A"} />
                <Detail label="Target Date" value={change.target_implementation_date || "N/A"} />
                <Detail label="Implementation Plan" value={change.implementation_plan || "N/A"} />
                <Detail label="Verification Plan" value={change.verification_plan || "N/A"} />
                <Detail label="Effectiveness Required" value={change.effectiveness_required ? "Yes" : "No"} />
                <Detail label="Effectiveness Plan" value={change.effectiveness_plan || "N/A"} />
              </div>
            )}
          </section>

          <section style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>Affected / New Documents</h2>
            {canImplement ? (
              <>
                <div style={gridStyle}>
                  <input placeholder="Document Number" value={newDoc.document_number} onChange={(e) => setNewDoc({ ...newDoc, document_number: e.target.value })} style={inputStyle} />
                  <input placeholder="Document Title" value={newDoc.document_title} onChange={(e) => setNewDoc({ ...newDoc, document_title: e.target.value })} style={inputStyle} />
                  <input placeholder="Current Revision Optional" value={newDoc.current_revision} onChange={(e) => setNewDoc({ ...newDoc, current_revision: e.target.value })} style={inputStyle} />
                  <input placeholder="Proposed Revision Optional / Auto" value={newDoc.proposed_revision} onChange={(e) => setNewDoc({ ...newDoc, proposed_revision: e.target.value })} style={inputStyle} />
                </div>
                <textarea placeholder="Document change description" value={newDoc.change_description} onChange={(e) => setNewDoc({ ...newDoc, change_description: e.target.value })} rows={3} style={textareaStyle} />
                <label><input type="checkbox" checked={newDoc.training_required} onChange={(e) => setNewDoc({ ...newDoc, training_required: e.target.checked })} /> Training Required</label>
                <div style={{ marginTop: "10px" }}><button onClick={addDocument} style={primaryButtonStyle}>Add Document to Change</button></div>
              </>
            ) : null}
            <ul>{documents.map((doc) => { const linkedDoc = controlledDocuments.find((cd) => cd.id === doc.controlled_document_id); return <li key={doc.id} style={listCardStyle}><strong>{doc.document_number}</strong> Rev {doc.current_revision || "N/A"} → {doc.proposed_revision || "N/A"}<div>{doc.document_title}</div><div style={smallTextStyle}>Controlled Document Status: {linkedDoc?.status || doc.document_status || "Not Created"}</div><div style={smallTextStyle}>Training Required: {doc.training_required ? "Yes" : "No"}</div>{!doc.controlled_document_id && canImplement ? <button onClick={() => createControlledDocumentFromChange(doc)} style={primaryButtonStyle}>Create Controlled Document Revision</button> : linkedDoc ? <a href={`/documents/${linkedDoc.id}`} style={primaryLinkStyle}>Open Document Workflow</a> : null}</li>; })}</ul>
          </section>

          <section style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>Affected Products</h2>
            {canImplement ? (
              <>
                <div style={gridStyle}><input placeholder="Part Number" value={newProduct.product_part_number} onChange={(e) => setNewProduct({ ...newProduct, product_part_number: e.target.value })} style={inputStyle} /><input placeholder="Product Name" value={newProduct.product_name} onChange={(e) => setNewProduct({ ...newProduct, product_name: e.target.value })} style={inputStyle} /><input placeholder="Lot / Serial Scope" value={newProduct.lot_or_serial_scope} onChange={(e) => setNewProduct({ ...newProduct, lot_or_serial_scope: e.target.value })} style={inputStyle} /></div>
                <textarea placeholder="Impact Description" value={newProduct.impact_description} onChange={(e) => setNewProduct({ ...newProduct, impact_description: e.target.value })} rows={3} style={textareaStyle} />
                <button onClick={addProduct} style={primaryButtonStyle}>Add Product</button>
              </>
            ) : null}
            <ul>{products.map((product) => <li key={product.id} style={listCardStyle}><strong>{product.product_part_number}</strong> — {product.product_name}<div style={smallTextStyle}>{product.impact_description}</div></li>)}</ul>
          </section>

          <section style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>Implementation Tasks</h2>
            {canImplement ? (
              <>
                <div style={gridStyle}><input placeholder="Task Title" value={newTask.task_title} onChange={(e) => setNewTask({ ...newTask, task_title: e.target.value })} style={inputStyle} /><input placeholder="Owner Email" value={newTask.owner_email} onChange={(e) => setNewTask({ ...newTask, owner_email: e.target.value })} style={inputStyle} /><input type="date" value={newTask.due_date} onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })} style={inputStyle} /></div>
                <textarea placeholder="Task Description" value={newTask.task_description} onChange={(e) => setNewTask({ ...newTask, task_description: e.target.value })} rows={3} style={textareaStyle} />
                <button onClick={addTask} style={primaryButtonStyle}>Add Task</button>
              </>
            ) : null}
            <ul>{tasks.map((task) => <li key={task.id} style={listCardStyle}><strong>{task.task_title}</strong> — {task.owner_email}<div style={smallTextStyle}>Status: {task.status}</div><div style={smallTextStyle}>Due: {task.due_date || "N/A"}</div>{task.status !== "complete" && canImplement ? <button onClick={() => completeTask(task.id)} style={primaryButtonStyle}>Complete</button> : null}</li>)}</ul>
          </section>
        </>
      ) : (
        <section style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Implementation Locked</h2>
          <p style={subtleText}>Affected documents, affected products, implementation tasks, verification, and closure are available after the change is approved.</p>
        </section>
      )}
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div style={{ marginBottom: "12px" }}><label style={labelStyle}>{label}</label><div style={{ marginTop: "5px" }}>{children}</div></div>; }
function Detail({ label, value }: { label: string; value: string }) { return <div style={detailTileStyle}><div style={smallTextStyle}>{label}</div><strong>{value}</strong></div>; }
function Impact({ label, value }: { label: string; value: boolean | null | undefined }) { return <div style={detailTileStyle}><div style={smallTextStyle}>{label}</div><strong>{value ? "Yes" : "No"}</strong></div>; }
function KpiCard({ title, value, color }: { title: string; value: string; color: string }) { return <div style={{ ...kpiCardStyle, borderLeft: `8px solid ${color}` }}><div style={kpiTitleStyle}>{title}</div><div style={{ fontSize: "24px", fontWeight: 800, color }}>{value}</div></div>; }
function getStatusLabel(status: string) { const labels: Record<string, string> = { draft: "Draft", pending: "Pending", pending_approval: "Pending Approval", approved: "Approved", implementation: "Implementation", verification: "Verification", closed: "Closed", rejected: "Rejected" }; return labels[status] || status; }
function getReviewerTypeLabel(value: string) { const labels: Record<string, string> = { formal_review: "Formal Review", approver: "Approval", collaboration: "Collaboration" }; return labels[value] || value; }
function StatusBadge({ status }: { status: string }) { const color = status === "closed" ? "#15803d" : status === "verification" ? "#7c3aed" : status === "implementation" ? "#2563eb" : status === "approved" ? "#2563eb" : status === "pending_approval" || status === "pending" ? "#d97706" : status === "rejected" ? "#dc2626" : "#6b7280"; return <span style={{ background: color, color: "white", borderRadius: "999px", padding: "3px 8px", fontSize: "12px", fontWeight: 700 }}>{getStatusLabel(status)}</span>; }

const pageStyle: React.CSSProperties = { padding: "24px", background: "#f8fafc", minHeight: "100vh", fontFamily: "Arial, sans-serif" };
const headerStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-start", flexWrap: "wrap", marginBottom: "20px" };
const eyebrowStyle: React.CSSProperties = { fontSize: "12px", letterSpacing: "0.08em", color: "#6b7280", fontWeight: 800 };
const subtleText: React.CSSProperties = { color: "#6b7280" };
const cardStyle: React.CSSProperties = { background: "white", border: "1px solid #d1d5db", borderRadius: "16px", padding: "20px", marginBottom: "20px" };
const subCardStyle: React.CSSProperties = { background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "14px", marginBottom: "14px" };
const gridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "14px" };
const checkboxGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "8px", marginBottom: "12px" };
const kpiGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px", marginBottom: "20px" };
const kpiCardStyle: React.CSSProperties = { background: "white", border: "1px solid #d1d5db", borderRadius: "14px", padding: "16px" };
const kpiTitleStyle: React.CSSProperties = { color: "#6b7280", marginBottom: "8px" };
const inputStyle: React.CSSProperties = { width: "100%", padding: "9px", borderRadius: "8px", border: "1px solid #d1d5db" };
const textareaStyle: React.CSSProperties = { width: "100%", padding: "9px", borderRadius: "8px", border: "1px solid #d1d5db", marginTop: "10px" };
const labelStyle: React.CSSProperties = { fontWeight: 700 };
const primaryButtonStyle: React.CSSProperties = { background: "#2563eb", color: "white", border: "none", padding: "10px 14px", borderRadius: "8px", fontWeight: 700, cursor: "pointer", textDecoration: "none", display: "inline-block" };
const dangerButtonStyle: React.CSSProperties = { background: "#991b1b", color: "white", border: "none", padding: "10px 14px", borderRadius: "8px", fontWeight: 700, cursor: "pointer" };
const primaryLinkStyle: React.CSSProperties = { display: "inline-block", background: "#2563eb", color: "white", padding: "8px 12px", borderRadius: "8px", textDecoration: "none", fontWeight: 700, marginTop: "8px" };
const secondaryLinkStyle: React.CSSProperties = { display: "inline-block", background: "#15803d", color: "white", padding: "10px 14px", borderRadius: "8px", textDecoration: "none", fontWeight: 700 };
const darkButtonStyle: React.CSSProperties = { background: "#111827", color: "white", padding: "10px 14px", borderRadius: "8px", textDecoration: "none", fontWeight: 700 };
const buttonRowStyle: React.CSSProperties = { display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" };
const listCardStyle: React.CSSProperties = { border: "1px solid #d1d5db", borderRadius: "12px", padding: "12px", marginBottom: "10px", background: "#f9fafb" };
const detailTileStyle: React.CSSProperties = { background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "12px" };
const smallTextStyle: React.CSSProperties = { fontSize: "12px", color: "#6b7280" };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse" };
const thStyle: React.CSSProperties = { textAlign: "left", borderBottom: "1px solid #d1d5db", padding: "10px" };
const tdStyle: React.CSSProperties = { borderBottom: "1px solid #e5e7eb", padding: "10px", verticalAlign: "top" };
const warningStyle: React.CSSProperties = { background: "#fef3c7", border: "1px solid #fde68a", borderRadius: "12px", padding: "12px", marginTop: "12px" };
