"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import ESignatureModal from "../../components/ESignatureModal";
import DocumentSignatures from "../../components/DocumentSignatures";
import { createESignature } from "../../../lib/eSignatureEngine";
import {
  canManageWorkflow as canUserManageWorkflow,
  canTransition,
  canUserActOnReviewer,
  getSlaLabel,
  getWorkflowState,
  hasPriorRequiredReviewerOpen,
  isApproverRole,
  isManagementRole,
  isOverdue,
  normalizeEmail,
} from "../../../lib/documentWorkflowEngine";

type ControlledDocument = {
  id: string;
  document_number: string;
  title: string;
  document_type: string | null;
  revision: string;
  status: string;
  department: string | null;
  process_area: string | null;
  file_name: string | null;
  file_path: string | null;
  file_url: string | null;
  change_summary: string | null;
  approval_comments: string | null;
  owner_email: string | null;
  approver_email: string | null;
  submitted_for_approval_at: string | null;
  submitted_for_approval_by: string | null;
  approved_at: string | null;
  approved_by: string | null;
  effective_date: string | null;
  obsolete_at: string | null;
  obsolete_by: string | null;
  obsolete_reason: string | null;
  read_ack_required: boolean | null;
  training_required: boolean | null;
  originating_change_control_id?: string | null;
  change_required?: boolean | null;
  superseded_by_document_id?: string | null;
  superseded_document_id?: string | null;
  collaboration_required?: boolean | null;
  formal_review_required?: boolean | null;
  collaboration_completed?: boolean | null;
  formal_review_completed?: boolean | null;
  release_comments?: string | null;
  release_approved_by?: string | null;
  release_approved_at?: string | null;
  created_at: string | null;
  created_by: string | null;
};

type AssignedReviewer = {
  id: string;
  document_id: string;
  reviewer_type: "collaboration" | "formal_review" | "approver" | string;
  reviewer_email: string;
  reviewer_role: string | null;
  required_reviewer: boolean | null;
  review_sequence: number | null;
  review_status: string | null;
  review_comments: string | null;
  reviewed_at: string | null;
  assigned_by: string | null;
  reviewed_file_name?: string | null;
  reviewed_file_path?: string | null;
  reviewed_file_url?: string | null;
  due_date?: string | null;
  sla_days?: number | null;
};

type WorkflowEvent = {
  id: string;
  document_id: string;
  event_type: string;
  performed_by: string | null;
  performed_at: string | null;
  from_status: string | null;
  to_status: string | null;
  comments: string | null;
  metadata?: any;
};

type DocumentRelationship = {
  id: string;
  parent_document_id: string;
  related_document_id: string;
  relationship_type: string;
  relationship_reason: string | null;
  created_by: string | null;
  created_at: string | null;
};

const REVIEWER_TYPES = ["collaboration", "formal_review", "approver"];

const RELATIONSHIP_TYPES = [
  { value: "parent_sop", label: "Parent SOP" },
  { value: "work_instruction", label: "Work Instruction" },
  { value: "form", label: "Form" },
  { value: "template", label: "Template" },
  { value: "specification", label: "Specification" },
  { value: "protocol", label: "Protocol" },
  { value: "report", label: "Report" },
  { value: "supersedes", label: "Supersedes" },
  { value: "impacted_by_change", label: "Impacted By Change" },
  { value: "related", label: "Related" },
];

export default function DocumentWorkflowPage() {
  const params = useParams();
  const documentId = String(params?.id || "");

  const [documents, setDocuments] = useState<ControlledDocument[]>([]);
  const [acknowledgements, setAcknowledgements] = useState<any[]>([]);
  const [trainingAssignments, setTrainingAssignments] = useState<any[]>([]);
  const [collaborationReviews, setCollaborationReviews] = useState<any[]>([]);
  const [formalReviews, setFormalReviews] = useState<any[]>([]);
  const [approvalTemplates, setApprovalTemplates] = useState<any[]>([]);
  const [assignedReviewers, setAssignedReviewers] = useState<AssignedReviewer[]>([]);
  const [workflowEvents, setWorkflowEvents] = useState<WorkflowEvent[]>([]);
  const [allDocuments, setAllDocuments] = useState<ControlledDocument[]>([]);
  const [documentRelationships, setDocumentRelationships] = useState<DocumentRelationship[]>([]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState("");

  const [trainingEmails, setTrainingEmails] = useState<Record<string, string>>({});
  const [obsoleteReason, setObsoleteReason] = useState<Record<string, string>>({});
  const [rejectComments, setRejectComments] = useState<Record<string, string>>({});
  const [releaseComments, setReleaseComments] = useState<Record<string, string>>({});
  const [collaborationReviewerEmails, setCollaborationReviewerEmails] = useState<Record<string, string>>({});
  const [formalReviewerEmails, setFormalReviewerEmails] = useState<Record<string, string>>({});
  const [reviewComments, setReviewComments] = useState<Record<string, string>>({});
  const [reviewedFiles, setReviewedFiles] = useState<Record<string, File | null>>({});

  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [newReviewer, setNewReviewer] = useState({
    reviewer_type: "formal_review",
    reviewer_email: "",
    reviewer_role: "",
    required_reviewer: true,
  });

  const [newRelationship, setNewRelationship] = useState({
    related_document_id: "",
    relationship_type: "related",
    relationship_reason: "",
  });

  const [showApprovalSignatureModal, setShowApprovalSignatureModal] = useState(false);
  const [pendingApprovalDoc, setPendingApprovalDoc] = useState<ControlledDocument | null>(null);

  const doc = documents[0] || null;

  const canApprove = isApproverRole(userRole);
  const canManage = isManagementRole(userRole);
  const canManageWorkflow = Boolean(
    doc ? canUserManageWorkflow(doc, userEmail, userRole) : canManage
  );

  const workflowState = useMemo(() => {
    if (!doc) return null;
    return getWorkflowState(doc, assignedReviewers);
  }, [doc, assignedReviewers]);

  const transitionPermissions = useMemo(() => {
    if (!doc) {
      return {
        sendToCollaboration: { allowed: false, reason: null as string | null },
        completeCollaboration: { allowed: false, reason: null as string | null },
        sendToFormalReview: { allowed: false, reason: null as string | null },
        finalApprove: { allowed: false, reason: null as string | null },
        makeEffective: { allowed: false, reason: null as string | null },
        reject: { allowed: false, reason: null as string | null },
        obsolete: { allowed: false, reason: null as string | null },
        acknowledge: { allowed: false, reason: null as string | null },
        assignTraining: { allowed: false, reason: null as string | null },
      };
    }

    const base = {
      doc,
      reviewers: assignedReviewers,
      userEmail,
      userRole,
    };

    return {
      sendToCollaboration: canTransition({ ...base, transition: "send_to_collaboration" }),
      completeCollaboration: canTransition({ ...base, transition: "complete_collaboration" }),
      sendToFormalReview: canTransition({ ...base, transition: "send_to_formal_review" }),
      finalApprove: canTransition({ ...base, transition: "final_approve" }),
      makeEffective: canTransition({ ...base, transition: "make_effective" }),
      reject: canTransition({ ...base, transition: "reject" }),
      obsolete: canTransition({ ...base, transition: "obsolete" }),
      acknowledge: canTransition({ ...base, transition: "acknowledge" }),
      assignTraining: canTransition({ ...base, transition: "assign_training" }),
    };
  }, [doc, assignedReviewers, userEmail, userRole]);

  const requiredFormalApproved = !workflowState?.formalReviewPending;
  const requiredApproversApproved = !workflowState?.approvalPending;
  const pendingRequiredReviewers = workflowState?.pendingRequiredReviewers || [];
  const nextPendingReviewer = workflowState?.nextPendingReviewer || null;

  const documentAckCount = (docId: string) =>
    acknowledgements.filter((ack) => ack.document_id === docId).length;

  const trainingCount = (docId: string) =>
    trainingAssignments.filter((item) => item.document_id === docId).length;

  const openTrainingCount = (docId: string) =>
    trainingAssignments.filter(
      (item) => item.document_id === docId && item.status !== "completed"
    ).length;

  const allDocumentMap = useMemo(() => {
    const map = new Map<string, ControlledDocument>();
    [...documents, ...allDocuments].forEach((item) => map.set(item.id, item));
    return map;
  }, [documents, allDocuments]);

  const relationshipOptions = useMemo(() => {
    return allDocuments.filter((item) => item.id !== documentId);
  }, [allDocuments, documentId]);

  const relationshipGroups = useMemo(() => {
    const groups: Record<string, DocumentRelationship[]> = {};

    documentRelationships.forEach((relationship) => {
      const type = relationship.relationship_type || "related";
      if (!groups[type]) groups[type] = [];
      groups[type].push(relationship);
    });

    return groups;
  }, [documentRelationships]);

  const relatedDocumentCount = documentRelationships.length;

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
    setLoading(true);
    await fetchUser();

    const docRes = await supabase
      .from("controlled_documents")
      .select("*")
      .eq("id", documentId)
      .order("created_at", { ascending: false });

    if (docRes.error) alert(docRes.error.message);
    else setDocuments((docRes.data as ControlledDocument[]) || []);

    const [
      ackRes,
      trainingRes,
      collaborationRes,
      formalRes,
      templateRes,
      reviewerRes,
      eventRes,
      allDocsRes,
      relationshipRes,
    ] = await Promise.all([
      supabase
        .from("document_acknowledgements")
        .select("*")
        .eq("document_id", documentId)
        .order("acknowledged_at", { ascending: false }),
      supabase
        .from("document_training_assignments")
        .select("*")
        .eq("document_id", documentId)
        .order("assigned_at", { ascending: false }),
      supabase
        .from("document_collaboration_reviews")
        .select("*")
        .eq("document_id", documentId)
        .order("created_at", { ascending: false }),
      supabase
        .from("document_formal_reviews")
        .select("*")
        .eq("document_id", documentId)
        .order("created_at", { ascending: false }),
      supabase.from("approval_matrix_templates").select("*").eq("active", true),
      supabase
        .from("document_assigned_reviewers")
        .select("*")
        .eq("document_id", documentId)
        .order("review_sequence", { ascending: true }),
      supabase
        .from("document_workflow_events")
        .select("*")
        .eq("document_id", documentId)
        .order("performed_at", { ascending: false }),
      supabase
        .from("controlled_documents")
        .select("id, document_number, title, document_type, revision, status, department, process_area, file_name, file_path, file_url, change_summary, approval_comments, owner_email, approver_email, submitted_for_approval_at, submitted_for_approval_by, approved_at, approved_by, effective_date, obsolete_at, obsolete_by, obsolete_reason, read_ack_required, training_required, originating_change_control_id, change_required, superseded_by_document_id, superseded_document_id, collaboration_required, formal_review_required, collaboration_completed, formal_review_completed, release_comments, release_approved_by, release_approved_at, created_at, created_by")
        .neq("id", documentId)
        .order("document_number", { ascending: true }),
      supabase
        .from("document_relationships")
        .select("*")
        .or(`parent_document_id.eq.${documentId},related_document_id.eq.${documentId}`)
        .order("created_at", { ascending: false }),
    ]);

    if (!ackRes.error) setAcknowledgements(ackRes.data || []);
    if (!trainingRes.error) setTrainingAssignments(trainingRes.data || []);
    if (!collaborationRes.error) setCollaborationReviews(collaborationRes.data || []);
    if (!formalRes.error) setFormalReviews(formalRes.data || []);
    if (!templateRes.error) setApprovalTemplates(templateRes.data || []);
    if (!reviewerRes.error) setAssignedReviewers((reviewerRes.data as AssignedReviewer[]) || []);
    if (!eventRes.error) setWorkflowEvents((eventRes.data as WorkflowEvent[]) || []);
    if (!allDocsRes.error) setAllDocuments((allDocsRes.data as ControlledDocument[]) || []);
    if (!relationshipRes.error) setDocumentRelationships((relationshipRes.data as DocumentRelationship[]) || []);

    setLoading(false);
  };

  useEffect(() => {
    if (documentId) fetchData();
  }, [documentId]);

  const logWorkflowEvent = async ({
    eventType,
    fromStatus,
    toStatus,
    comments,
    metadata,
  }: {
    eventType: string;
    fromStatus?: string | null;
    toStatus?: string | null;
    comments?: string | null;
    metadata?: any;
  }) => {
    if (!doc) return;

    await supabase.from("document_workflow_events").insert({
      document_id: doc.id,
      event_type: eventType,
      performed_by: userEmail || "unknown",
      from_status: fromStatus || null,
      to_status: toStatus || null,
      comments: comments || null,
      metadata: metadata || null,
    });
  };

  const uploadReviewedFile = async (reviewer: AssignedReviewer) => {
    const file = reviewedFiles[reviewer.id];

    if (!file || !doc) {
      return {
        reviewed_file_name: reviewer.reviewed_file_name || null,
        reviewed_file_path: reviewer.reviewed_file_path || null,
        reviewed_file_url: reviewer.reviewed_file_url || null,
      };
    }

    const safeDocNumber = doc.document_number.replace(/[^a-zA-Z0-9-_]/g, "_");
    const safeRev = doc.revision.replace(/[^a-zA-Z0-9-_]/g, "_");
    const safeReviewer = normalizeEmail(reviewer.reviewer_email).replace(/[^a-zA-Z0-9-_]/g, "_");
    const filePath = `${safeDocNumber}/${safeRev}/reviewed/${reviewer.id}_${safeReviewer}_${Date.now()}_${file.name}`;

    const { error } = await supabase.storage
      .from("controlled-documents")
      .upload(filePath, file, { upsert: true });

    if (error) throw new Error(error.message);

    const { data } = supabase.storage
      .from("controlled-documents")
      .getPublicUrl(filePath);

    return {
      reviewed_file_name: file.name,
      reviewed_file_path: filePath,
      reviewed_file_url: data?.publicUrl || null,
    };
  };

  const syncLegacyReviewRecord = async (
    reviewer: AssignedReviewer,
    decision: "approved" | "rejected",
    comments: string,
    reviewedUpload: any
  ) => {
    const base = {
      document_id: reviewer.document_id,
      reviewer_email: normalizeEmail(reviewer.reviewer_email),
      review_status: decision,
      review_comments: comments || null,
      reviewed_file_name: reviewedUpload.reviewed_file_name,
      reviewed_file_path: reviewedUpload.reviewed_file_path,
      reviewed_file_url: reviewedUpload.reviewed_file_url,
    };

    if (reviewer.reviewer_type === "collaboration") {
      await supabase.from("document_collaboration_reviews").upsert(
        {
          ...base,
        },
        { onConflict: "document_id,reviewer_email" }
      );
    }

    if (reviewer.reviewer_type === "formal_review" || reviewer.reviewer_type === "approver") {
      await supabase.from("document_formal_reviews").upsert(
        {
          ...base,
          review_role: reviewer.reviewer_role || reviewer.reviewer_type,
          approved_at: new Date().toISOString(),
        },
        { onConflict: "document_id,reviewer_email" }
      );
    }
  };

  const reviewerDecision = async (
    reviewer: AssignedReviewer,
    decision: "approved" | "rejected"
  ) => {
    if (!doc) return;

    const currentUser = normalizeEmail(userEmail);
    const assignedUser = normalizeEmail(reviewer.reviewer_email);

    if (currentUser !== assignedUser) {
      alert("Only the assigned reviewer can complete this review.");
      return;
    }

    const previousRequiredReviewers = assignedReviewers.filter(
      (r) =>
        Number(r.review_sequence || 0) < Number(reviewer.review_sequence || 0) &&
        r.required_reviewer
    );

    const blockedReviewer = previousRequiredReviewers.find(
      (r) => r.review_status !== "approved"
    );

    if (blockedReviewer) {
      alert(`Waiting for ${blockedReviewer.reviewer_email} to complete review first.`);
      return;
    }

    const comments = reviewComments[reviewer.id] || "";

    if (decision === "rejected" && !comments.trim()) {
      alert("Rejection comments are required.");
      return;
    }

    setBusy(true);

    try {
      const reviewedUpload = await uploadReviewedFile(reviewer);

      const { error } = await supabase
        .from("document_assigned_reviewers")
        .update({
          review_status: decision,
          review_comments: comments || null,
          reviewed_at: new Date().toISOString(),
          reviewed_file_name: reviewedUpload.reviewed_file_name,
          reviewed_file_path: reviewedUpload.reviewed_file_path,
          reviewed_file_url: reviewedUpload.reviewed_file_url,
        })
        .eq("id", reviewer.id);

      if (error) throw new Error(error.message);

      await syncLegacyReviewRecord(reviewer, decision, comments, reviewedUpload);

      if (decision === "rejected") {
        const { error: docError } = await supabase
          .from("controlled_documents")
          .update({
            status: "rejected",
            approval_comments: comments,
            collaboration_completed: false,
            formal_review_completed: false,
            updated_at: new Date().toISOString(),
          })
          .eq("id", doc.id);

        if (docError) throw new Error(docError.message);
      }

      await logWorkflowEvent({
        eventType: decision === "approved" ? "review_approved" : "review_rejected_returned_to_owner",
        fromStatus: doc.status,
        toStatus: decision === "rejected" ? "rejected" : doc.status,
        comments,
        metadata: {
          reviewer_id: reviewer.id,
          reviewer_type: reviewer.reviewer_type,
          reviewer_role: reviewer.reviewer_role,
          reviewer_email: reviewer.reviewer_email,
          reviewed_file_url: reviewedUpload.reviewed_file_url,
        },
      });

      setReviewComments({ ...reviewComments, [reviewer.id]: "" });
      setReviewedFiles({ ...reviewedFiles, [reviewer.id]: null });
      await fetchData();
    } catch (error: any) {
      alert(error.message);
    }

    setBusy(false);
  };

  const loadApprovalTemplate = async () => {
    if (!selectedTemplateId || !doc) return;

    if (!canManageWorkflow) {
      alert("Only the document owner, document control, quality, or approvers can load templates.");
      return;
    }

    setBusy(true);

    const { data, error } = await supabase
      .from("approval_matrix_reviewers")
      .select("*")
      .eq("template_id", selectedTemplateId);

    if (error) {
      alert(error.message);
      setBusy(false);
      return;
    }

    for (const reviewer of data || []) {
      await supabase.from("document_assigned_reviewers").insert({
        document_id: doc.id,
        reviewer_type: reviewer.reviewer_type,
        reviewer_email: normalizeEmail(reviewer.reviewer_email),
        reviewer_role: reviewer.reviewer_role,
        required_reviewer: reviewer.required_reviewer,
        review_sequence: reviewer.sequence_order,
        review_status: "pending",
        assigned_by: userEmail,
      });
    }

    await logWorkflowEvent({
      eventType: "approval_matrix_loaded",
      comments: "Approval matrix template loaded.",
      metadata: { template_id: selectedTemplateId },
    });

    setBusy(false);
    fetchData();
  };

  const addCustomReviewer = async () => {
    if (!doc) return;

    if (!canManageWorkflow) {
      alert("Only the document owner, document control, quality, or approvers can add reviewers.");
      return;
    }

    const reviewerEmail = normalizeEmail(newReviewer.reviewer_email);

    if (!reviewerEmail) {
      alert("Enter a valid reviewer email.");
      return;
    }

    const { error } = await supabase.from("document_assigned_reviewers").insert({
      document_id: doc.id,
      reviewer_type: newReviewer.reviewer_type,
      reviewer_email: reviewerEmail,
      reviewer_role: newReviewer.reviewer_role || null,
      required_reviewer: newReviewer.required_reviewer,
      review_sequence: assignedReviewers.length + 1,
      review_status: "pending",
      assigned_by: userEmail,
    });

    if (error) {
      alert(error.message);
      return;
    }

    await logWorkflowEvent({
      eventType: "custom_reviewer_added",
      comments: `Reviewer added: ${reviewerEmail}`,
      metadata: newReviewer,
    });

    setNewReviewer({
      reviewer_type: "formal_review",
      reviewer_email: "",
      reviewer_role: "",
      required_reviewer: true,
    });

    fetchData();
  };

  const sendToCollaboration = async (doc: ControlledDocument) => {
    if (!canManageWorkflow) {
      alert("Only the document owner, document control, quality, or approvers can send to collaboration.");
      return;
    }

    if (doc.status !== "draft" && doc.status !== "rejected") {
      alert("Only draft or rejected documents can be sent to collaboration.");
      return;
    }

    const reviewerText = collaborationReviewerEmails[doc.id] || "";
    const reviewers = reviewerText
      .split(/[,\n;]/)
      .map((email) => normalizeEmail(email))
      .filter(Boolean);

    setBusy(true);

    const { error } = await supabase
      .from("controlled_documents")
      .update({
        status: "collaboration",
        collaboration_completed: false,
        formal_review_completed: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", doc.id);

    if (error) {
      alert(error.message);
      setBusy(false);
      return;
    }

    if (reviewers.length > 0) {
      const startSeq = assignedReviewers.length + 1;
      const rows = reviewers.map((email, index) => ({
        document_id: doc.id,
        reviewer_type: "collaboration",
        reviewer_email: email,
        reviewer_role: "collaboration_reviewer",
        required_reviewer: true,
        review_sequence: startSeq + index,
        review_status: "pending",
        assigned_by: userEmail,
      }));

      const reviewRes = await supabase
        .from("document_assigned_reviewers")
        .insert(rows);

      if (reviewRes.error) alert(reviewRes.error.message);
    }

    await logWorkflowEvent({
      eventType: "sent_to_collaboration",
      fromStatus: doc.status,
      toStatus: "collaboration",
      comments: "Document sent to collaboration review.",
      metadata: { reviewers },
    });

    setBusy(false);
    fetchData();
  };

  const completeCollaboration = async (doc: ControlledDocument) => {
    if (!canManageWorkflow) {
      alert("Only the document owner, document control, quality, or approvers can complete collaboration.");
      return;
    }

    if (doc.status !== "collaboration") {
      alert("Only documents in collaboration can complete collaboration.");
      return;
    }

    const requiredCollaborationOpen = assignedReviewers.some(
      (r) =>
        r.reviewer_type === "collaboration" &&
        r.required_reviewer &&
        r.review_status !== "approved"
    );

    if (requiredCollaborationOpen) {
      alert("All required collaboration reviewers must approve before completing collaboration.");
      return;
    }

    const { error } = await supabase
      .from("controlled_documents")
      .update({
        collaboration_completed: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", doc.id);

    if (error) {
      alert(error.message);
      return;
    }

    await logWorkflowEvent({
      eventType: "collaboration_completed",
      fromStatus: doc.status,
      toStatus: doc.status,
      comments: "Collaboration review completed.",
    });

    fetchData();
  };

  const sendToFormalReview = async (doc: ControlledDocument) => {
    if (!canManageWorkflow) {
      alert("Only the document owner, document control, quality, or approvers can send to formal review.");
      return;
    }

    if (doc.status !== "collaboration" && doc.status !== "draft" && doc.status !== "rejected") {
      alert("Document must be in draft, collaboration, or rejected status before formal review.");
      return;
    }

    if (doc.collaboration_required && !doc.collaboration_completed && doc.status !== "draft") {
      alert("Collaboration must be completed before formal review.");
      return;
    }

    const reviewerText = formalReviewerEmails[doc.id] || "";
    const reviewers = reviewerText
      .split(/[,\n;]/)
      .map((email) => normalizeEmail(email))
      .filter(Boolean);

    const { error } = await supabase
      .from("controlled_documents")
      .update({
        status: "formal_review",
        formal_review_completed: false,
        submitted_for_approval_at: new Date().toISOString(),
        submitted_for_approval_by: userEmail,
        updated_at: new Date().toISOString(),
      })
      .eq("id", doc.id);

    if (error) {
      alert(error.message);
      return;
    }

    if (reviewers.length > 0) {
      const startSeq = assignedReviewers.length + 1;
      const rows = reviewers.map((email, index) => ({
        document_id: doc.id,
        reviewer_type: "formal_review",
        reviewer_email: email,
        reviewer_role: "formal_reviewer",
        required_reviewer: true,
        review_sequence: startSeq + index,
        review_status: "pending",
        assigned_by: userEmail,
      }));

      const reviewRes = await supabase
        .from("document_assigned_reviewers")
        .insert(rows);

      if (reviewRes.error) alert(reviewRes.error.message);
    }

    await logWorkflowEvent({
      eventType: "sent_to_formal_review",
      fromStatus: doc.status,
      toStatus: "formal_review",
      comments: "Document sent to formal review.",
      metadata: { reviewers },
    });

    fetchData();
  };

  const approveDocumentAfterSignature = async (
    doc: ControlledDocument,
    signatureMeaning: string,
    signatureReason: string
  ) => {
    if (!canApprove) {
      alert("Only approvers, admins, or VP Quality can approve documents.");
      return;
    }

    if (doc.status !== "formal_review") {
      alert("Only documents in formal review can be approved.");
      return;
    }

    if (!requiredFormalApproved) {
      alert("Required formal reviewers must approve.");
      return;
    }

    if (!requiredApproversApproved) {
      alert("Required approvers must approve.");
      return;
    }

    setBusy(true);

    try {
      await createESignature({
        moduleName: "documents",
        recordId: doc.id,
        actionType: "approve_document",
        signedBy: userEmail || "unknown",
        signerRole: userRole || null,
        signatureMeaning,
        signatureReason: signatureReason || "Approved controlled document.",
      });

      const { error } = await supabase
        .from("controlled_documents")
        .update({
          status: "approved",
          formal_review_completed: true,
          approved_at: new Date().toISOString(),
          approved_by: userEmail,
          approval_comments: signatureReason || "Approved controlled document.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", doc.id);

      if (error) throw new Error(error.message);

      await logWorkflowEvent({
        eventType: "document_approved_esignature",
        fromStatus: doc.status,
        toStatus: "approved",
        comments: signatureReason || "Document approved with electronic signature.",
        metadata: {
          module_name: "documents",
          action_type: "approve_document",
          signature_meaning: signatureMeaning,
          signed_by: userEmail || "unknown",
          signer_role: userRole || null,
        },
      });

      setShowApprovalSignatureModal(false);
      setPendingApprovalDoc(null);
      await fetchData();
    } catch (error: any) {
      alert(error.message);
    }

    setBusy(false);
  };

  const submitApprovalSignature = async ({
    meaning,
    reason,
  }: {
    meaning: string;
    reason: string;
  }) => {
    if (!pendingApprovalDoc) return;

    await approveDocumentAfterSignature(
      pendingApprovalDoc,
      meaning || "Approve Document",
      reason || "Approved controlled document."
    );
  };

  const rejectDocument = async (doc: ControlledDocument) => {
    if (!canApprove && !canManageWorkflow) {
      alert("Only authorized users can reject documents.");
      return;
    }

    if (doc.status !== "formal_review" && doc.status !== "collaboration") {
      alert("Only documents in collaboration or formal review can be rejected.");
      return;
    }

    const comments = rejectComments[doc.id] || "";

    if (!comments.trim()) {
      alert("Rejection comments are required.");
      return;
    }

    const { error } = await supabase
      .from("controlled_documents")
      .update({
        status: "rejected",
        approval_comments: comments,
        collaboration_completed: false,
        formal_review_completed: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", doc.id);

    if (error) {
      alert(error.message);
      return;
    }

    await logWorkflowEvent({
      eventType: "document_rejected_returned_to_owner",
      fromStatus: doc.status,
      toStatus: "rejected",
      comments,
    });

    setRejectComments({ ...rejectComments, [doc.id]: "" });
    fetchData();
  };

  const makeEffective = async (doc: ControlledDocument) => {
    if (!canApprove) {
      alert("Only approvers, admins, or VP Quality can make documents effective.");
      return;
    }

    if (doc.status !== "approved") {
      alert("Only approved documents can be made effective.");
      return;
    }

    const today = new Date().toISOString().slice(0, 10);

    const { error } = await supabase
      .from("controlled_documents")
      .update({
        status: "effective",
        effective_date: doc.effective_date || today,
        release_comments: releaseComments[doc.id] || "Document released effective.",
        release_approved_by: userEmail,
        release_approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", doc.id);

    if (error) {
      alert(error.message);
      return;
    }

    await logWorkflowEvent({
      eventType: "document_effective",
      fromStatus: doc.status,
      toStatus: "effective",
      comments: releaseComments[doc.id] || "Document released effective.",
    });

    fetchData();
  };

  const obsoleteDocument = async (doc: ControlledDocument) => {
    if (!canApprove) {
      alert("Only approvers, admins, or VP Quality can obsolete documents.");
      return;
    }

    const reason = obsoleteReason[doc.id] || "";

    if (!reason.trim()) {
      alert("Obsolete reason is required.");
      return;
    }

    const { error } = await supabase
      .from("controlled_documents")
      .update({
        status: "obsolete",
        obsolete_at: new Date().toISOString(),
        obsolete_by: userEmail,
        obsolete_reason: reason.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", doc.id);

    if (error) {
      alert(error.message);
      return;
    }

    await logWorkflowEvent({
      eventType: "document_obsoleted",
      fromStatus: doc.status,
      toStatus: "obsolete",
      comments: reason,
    });

    setObsoleteReason({ ...obsoleteReason, [doc.id]: "" });
    fetchData();
  };

  const acknowledgeDocument = async (doc: ControlledDocument) => {
    if (!userEmail) {
      alert("You must be logged in to acknowledge a document.");
      return;
    }

    if (!doc.file_url) {
      alert("No effective document file is attached for acknowledgement.");
      return;
    }

    const { error } = await supabase.from("document_acknowledgements").upsert(
      {
        document_id: doc.id,
        user_email: userEmail,
        acknowledged_at: new Date().toISOString(),
        acknowledgement_meaning: "I have read and understood this controlled document.",
      },
      { onConflict: "document_id,user_email" }
    );

    if (error) {
      alert(error.message);
      return;
    }

    await logWorkflowEvent({
      eventType: "document_acknowledged",
      comments: "Document read and acknowledged.",
    });

    fetchData();
  };

  const assignTraining = async (doc: ControlledDocument) => {
    if (!canManage) {
      alert("Only document control, quality, approvers, admins, or VP Quality can assign training.");
      return;
    }

    if (!doc.file_url) {
      alert("Cannot assign training because no document file is attached.");
      return;
    }

    const emails = (trainingEmails[doc.id] || "")
      .split(/[,\n;]/)
      .map((email) => normalizeEmail(email))
      .filter(Boolean);

    if (emails.length === 0) {
      alert("Enter at least one valid training assignee email.");
      return;
    }

    const rows = emails.map((email) => ({
      document_id: doc.id,
      user_email: email,
      status: "assigned",
      assigned_by: userEmail || "unknown",
      document_file_name: doc.file_name,
      document_file_url: doc.file_url,
    }));

    const { error } = await supabase
      .from("document_training_assignments")
      .upsert(rows, { onConflict: "document_id,user_email" });

    if (error) {
      alert(error.message);
      return;
    }

    await logWorkflowEvent({
      eventType: "training_assigned",
      comments: `Training assigned to ${emails.length} user(s).`,
      metadata: { users: emails, document_file_url: doc.file_url },
    });

    setTrainingEmails({ ...trainingEmails, [doc.id]: "" });
    fetchData();
  };

  const completeTraining = async (assignment: any) => {
    const trainingDocUrl = assignment.document_file_url || doc?.file_url;

    if (!trainingDocUrl) {
      alert("Training cannot be completed because no document is attached to the training record.");
      return;
    }

    if (normalizeEmail(assignment.user_email) !== normalizeEmail(userEmail) && !canManage) {
      alert("Only the assigned trainee or training administrator can complete this training.");
      return;
    }

    const { error } = await supabase
      .from("document_training_assignments")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        completed_by: userEmail,
        document_file_name: assignment.document_file_name || doc?.file_name || null,
        document_file_url: trainingDocUrl,
      })
      .eq("id", assignment.id);

    if (error) {
      alert(error.message);
      return;
    }

    await logWorkflowEvent({
      eventType: "training_completed",
      comments: `Training completed by ${userEmail}.`,
      metadata: { assignment_id: assignment.id, document_file_url: trainingDocUrl },
    });

    fetchData();
  };

  const getRelatedDocumentForRelationship = (relationship: DocumentRelationship) => {
    const relatedId =
      relationship.parent_document_id === documentId
        ? relationship.related_document_id
        : relationship.parent_document_id;

    return allDocumentMap.get(relatedId) || null;
  };

  const getRelationshipDirectionLabel = (relationship: DocumentRelationship) => {
    if (relationship.parent_document_id === documentId) return "Linked from this document";
    return "Linked to this document";
  };

  const addDocumentRelationship = async () => {
    if (!doc) return;

    if (!canManageWorkflow) {
      alert("Only the document owner, document control, quality, or approvers can add related documents.");
      return;
    }

    if (!newRelationship.related_document_id) {
      alert("Select a related document.");
      return;
    }

    if (newRelationship.related_document_id === doc.id) {
      alert("A document cannot be related to itself.");
      return;
    }

    setBusy(true);

    const relatedDoc = allDocumentMap.get(newRelationship.related_document_id);

    const { error } = await supabase.from("document_relationships").insert({
      parent_document_id: doc.id,
      related_document_id: newRelationship.related_document_id,
      relationship_type: newRelationship.relationship_type,
      relationship_reason: newRelationship.relationship_reason || null,
      created_by: userEmail || "unknown",
    });

    if (error) {
      alert(error.message);
      setBusy(false);
      return;
    }

    await logWorkflowEvent({
      eventType: "document_relationship_added",
      comments: `Related document added: ${relatedDoc?.document_number || newRelationship.related_document_id}`,
      metadata: {
        related_document_id: newRelationship.related_document_id,
        related_document_number: relatedDoc?.document_number || null,
        relationship_type: newRelationship.relationship_type,
        relationship_reason: newRelationship.relationship_reason || null,
      },
    });

    setNewRelationship({
      related_document_id: "",
      relationship_type: "related",
      relationship_reason: "",
    });

    setBusy(false);
    fetchData();
  };

  const removeDocumentRelationship = async (relationship: DocumentRelationship) => {
    if (!doc) return;

    if (!canManageWorkflow) {
      alert("Only the document owner, document control, quality, or approvers can remove related documents.");
      return;
    }

    const relatedDoc = getRelatedDocumentForRelationship(relationship);
    const confirmed = window.confirm(
      `Remove relationship to ${relatedDoc?.document_number || "this document"}?`
    );

    if (!confirmed) return;

    setBusy(true);

    const { error } = await supabase
      .from("document_relationships")
      .delete()
      .eq("id", relationship.id);

    if (error) {
      alert(error.message);
      setBusy(false);
      return;
    }

    await logWorkflowEvent({
      eventType: "document_relationship_removed",
      comments: `Related document removed: ${relatedDoc?.document_number || relationship.related_document_id}`,
      metadata: {
        relationship_id: relationship.id,
        related_document_id: relatedDoc?.id || null,
        related_document_number: relatedDoc?.document_number || null,
        relationship_type: relationship.relationship_type,
      },
    });

    setBusy(false);
    fetchData();
  };


  if (loading) return <main style={pageStyle}>Loading Document Workflow...</main>;

  if (!doc) {
    return (
      <main style={pageStyle}>
        <h1>Document not found</h1>
        <a href="/documents">Back to Document Control</a>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>DOCUMENT WORKFLOW EXECUTION ENGINE</div>
          <h1 style={{ margin: "6px 0" }}>
            {doc.document_number} Rev {doc.revision}
          </h1>
          <p style={subtleText}>{doc.title}</p>
        </div>
        <div style={buttonRowStyle}>
          <a href="/documents" style={darkButtonStyle}>Back to Document Register</a>
          <a href="/dashboard" style={darkButtonStyle}>Dashboard</a>
        </div>
      </header>

      <section style={kpiGridStyle}>
        <div style={kpiCardStyle}>
          <div style={kpiTitleStyle}>Status</div>
          <StatusBadge status={doc.status} />
        </div>
        <KpiCard title="Pending Reviewers" value={pendingRequiredReviewers.length} color="#d97706" />
        <KpiCard title="Acknowledgements" value={documentAckCount(doc.id)} color="#15803d" />
        <KpiCard title="Open Training" value={openTrainingCount(doc.id)} color="#dc2626" />
        <KpiCard title="Related Documents" value={relatedDocumentCount} color="#7c3aed" />
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Current Workflow State</h2>
        <div style={gridStyle}>
          <Field label="Current Step"><div>{workflowState?.currentStepLabel || doc.status}</div></Field>
          <Field label="Next Pending Reviewer">
            <div>{nextPendingReviewer?.reviewer_email || "None"}</div>
          </Field>
          <Field label="Workflow Completion">
            <div>{workflowState?.workflowPercentComplete ?? 0}%</div>
          </Field>
          <Field label="Owner"><div>{doc.owner_email || "N/A"}</div></Field>
          <Field label="Your Role"><div>{userRole || "user"}</div></Field>
        </div>
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Document Package</h2>
        <div style={gridStyle}>
          <Field label="Document Type"><div>{doc.document_type || "N/A"}</div></Field>
          <Field label="Department"><div>{doc.department || "N/A"}</div></Field>
          <Field label="Process Area"><div>{doc.process_area || "N/A"}</div></Field>
          <Field label="Approver"><div>{doc.approver_email || "N/A"}</div></Field>
          <Field label="Effective Date"><div>{doc.effective_date || "N/A"}</div></Field>
          <Field label="Originating Change Control"><div>{doc.originating_change_control_id || "None"}</div></Field>
        </div>

        <div style={buttonRowStyle}>
          {doc.file_url ? (
            <a href={doc.file_url} target="_blank" rel="noreferrer" style={primaryLinkStyle}>
              Open / Download Current Document
            </a>
          ) : (
            <span style={warningStyle}>No document file attached.</span>
          )}
        </div>

        {doc.approval_comments ? (
          <div style={noticeStyle}>
            <strong>Latest Approval / Rejection Comments:</strong>
            <p>{doc.approval_comments}</p>
          </div>
        ) : null}
      </section>

      <section style={cardStyle}>
        <div style={rowBetweenStyle}>
          <div>
            <h2 style={{ marginTop: 0 }}>Related Documents</h2>
            <p style={subtleText}>
              Link parent SOPs, work instructions, forms, specifications, templates, protocols, reports, and impacted documents.
            </p>
          </div>
          <div style={relationshipCountStyle}>{relatedDocumentCount} linked</div>
        </div>

        {documentRelationships.length === 0 ? (
          <p style={subtleText}>No related documents linked yet.</p>
        ) : (
          <div style={{ display: "grid", gap: "14px" }}>
            {RELATIONSHIP_TYPES.filter((type) => relationshipGroups[type.value]?.length).map((type) => (
              <div key={type.value} style={relationshipGroupStyle}>
                <h3 style={{ marginTop: 0 }}>{type.label}</h3>
                <div style={{ display: "grid", gap: "10px" }}>
                  {relationshipGroups[type.value].map((relationship) => {
                    const relatedDoc = getRelatedDocumentForRelationship(relationship);

                    return (
                      <div key={relationship.id} style={relationshipItemStyle}>
                        <div>
                          <strong>
                            {relatedDoc
                              ? `${relatedDoc.document_number} Rev ${relatedDoc.revision}`
                              : "Related document unavailable"}
                          </strong>
                          <div>{relatedDoc?.title || relationship.related_document_id}</div>
                          <div style={smallTextStyle}>
                            {getRelationshipDirectionLabel(relationship)}
                            {relatedDoc?.document_type ? ` • ${relatedDoc.document_type}` : ""}
                            {relatedDoc?.department ? ` • ${relatedDoc.department}` : ""}
                          </div>
                          {relationship.relationship_reason ? (
                            <div style={smallTextStyle}>Reason: {relationship.relationship_reason}</div>
                          ) : null}
                        </div>

                        <div style={buttonRowStyle}>
                          {relatedDoc?.file_url ? (
                            <a href={relatedDoc.file_url} target="_blank" rel="noreferrer" style={primaryLinkStyle}>
                              Open File
                            </a>
                          ) : null}
                          {relatedDoc ? (
                            <a href={`/documents/${relatedDoc.id}`} style={darkButtonStyle}>
                              Open Workflow
                            </a>
                          ) : null}
                          {canManageWorkflow ? (
                            <button
                              disabled={busy}
                              onClick={() => removeDocumentRelationship(relationship)}
                              style={dangerButtonStyle}
                            >
                              Remove
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {canManageWorkflow ? (
          <>
            <hr style={{ margin: "20px 0" }} />
            <h3>Add Related Document</h3>
            <div style={gridStyle}>
              <Field label="Relationship Type">
                <select
                  value={newRelationship.relationship_type}
                  onChange={(e) =>
                    setNewRelationship({
                      ...newRelationship,
                      relationship_type: e.target.value,
                    })
                  }
                  style={inputStyle}
                >
                  {RELATIONSHIP_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </Field>

              <Field label="Related Document">
                <select
                  value={newRelationship.related_document_id}
                  onChange={(e) =>
                    setNewRelationship({
                      ...newRelationship,
                      related_document_id: e.target.value,
                    })
                  }
                  style={inputStyle}
                >
                  <option value="">Select related document</option>
                  {relationshipOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.document_number} Rev {item.revision} — {item.title}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Relationship Reason / Impact Rationale">
              <textarea
                value={newRelationship.relationship_reason}
                onChange={(e) =>
                  setNewRelationship({
                    ...newRelationship,
                    relationship_reason: e.target.value,
                  })
                }
                rows={3}
                style={textareaStyle}
                placeholder="Example: This form is required by the parent SOP, or this specification is impacted by the procedure."
              />
            </Field>

            <button disabled={busy || !newRelationship.related_document_id} onClick={addDocumentRelationship} style={primaryButtonStyle}>
              Add Relationship
            </button>
          </>
        ) : (
          <p style={smallTextStyle}>Only authorized document control, quality, owner, or approver roles can manage related documents.</p>
        )}
      </section>


      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Approval Matrix & Assigned Reviewers</h2>

        {canManageWorkflow ? (
          <>
            <div style={gridStyle}>
              <select
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                style={inputStyle}
              >
                <option value="">Select Approval Matrix Template</option>
                {approvalTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.template_name}
                  </option>
                ))}
              </select>

              <button disabled={busy || !selectedTemplateId} onClick={loadApprovalTemplate} style={primaryButtonStyle}>
                Load Template
              </button>
            </div>

            <hr style={{ margin: "20px 0" }} />

            <h3>Add Custom Reviewer</h3>
            <div style={gridStyle}>
              <select
                value={newReviewer.reviewer_type}
                onChange={(e) =>
                  setNewReviewer({ ...newReviewer, reviewer_type: e.target.value })
                }
                style={inputStyle}
              >
                {REVIEWER_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>

              <input
                placeholder="Reviewer Email"
                value={newReviewer.reviewer_email}
                onChange={(e) =>
                  setNewReviewer({ ...newReviewer, reviewer_email: e.target.value })
                }
                style={inputStyle}
              />

              <input
                placeholder="Reviewer Role"
                value={newReviewer.reviewer_role}
                onChange={(e) =>
                  setNewReviewer({ ...newReviewer, reviewer_role: e.target.value })
                }
                style={inputStyle}
              />
            </div>

            <label style={{ display: "block", marginTop: "10px" }}>
              <input
                type="checkbox"
                checked={newReviewer.required_reviewer}
                onChange={(e) =>
                  setNewReviewer({ ...newReviewer, required_reviewer: e.target.checked })
                }
              />{" "}
              Required reviewer
            </label>

            <button disabled={busy} onClick={addCustomReviewer} style={primaryButtonStyle}>
              Add Reviewer
            </button>
          </>
        ) : (
          <p style={subtleText}>Only the document owner or authorized quality/document control users can assign reviewers.</p>
        )}

        <hr style={{ margin: "20px 0" }} />

        <div style={{ display: "grid", gap: "12px" }}>
          {assignedReviewers.length === 0 ? (
            <p style={subtleText}>No reviewers assigned yet.</p>
          ) : (
            assignedReviewers.map((reviewer) => {
              const canCurrentUserReview = canUserActOnReviewer(reviewer, userEmail);

              const priorRequiredOpen = hasPriorRequiredReviewerOpen(
                reviewer,
                assignedReviewers
              );

              const slaLabel = getSlaLabel(reviewer);
              const overdue = isOverdue(reviewer.due_date);

              return (
                <div key={reviewer.id} style={trainingCardStyle}>
                  <div style={rowBetweenStyle}>
                    <div>
                      <strong>{reviewer.reviewer_email}</strong>
                      <div style={smallTextStyle}>
                        Sequence {reviewer.review_sequence || "-"} • {reviewer.reviewer_type} • {reviewer.reviewer_role || "No role"} •{" "}
                        {reviewer.required_reviewer ? "Required" : "Optional"}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <StatusBadge status={reviewer.review_status || "pending"} />
                      <div style={overdue ? overdueTextStyle : smallTextStyle}>
                        SLA: {slaLabel}
                      </div>
                    </div>
                  </div>

                  {doc.file_url ? (
                    <div style={buttonRowStyle}>
                      <a href={doc.file_url} target="_blank" rel="noreferrer" style={primaryLinkStyle}>
                        Download Original for Review
                      </a>
                    </div>
                  ) : null}

                  {reviewer.reviewed_file_url ? (
                    <div style={noticeStyle}>
                      <strong>Reviewed / Redlined File:</strong>{" "}
                      <a href={reviewer.reviewed_file_url} target="_blank" rel="noreferrer">
                        {reviewer.reviewed_file_name || "Open reviewed file"}
                      </a>
                    </div>
                  ) : null}

                  {canCurrentUserReview && reviewer.review_status !== "approved" && reviewer.review_status !== "rejected" ? (
                    <>
                      {priorRequiredOpen ? (
                        <div style={warningStyle}>
                          Waiting for prior required reviewer before this review can be completed.
                        </div>
                      ) : (
                        <>
                          <Field label="Upload Reviewed / Redlined Document">
                            <input
                              type="file"
                              onChange={(e) =>
                                setReviewedFiles({
                                  ...reviewedFiles,
                                  [reviewer.id]: e.target.files?.[0] || null,
                                })
                              }
                            />
                          </Field>

                          <textarea
                            placeholder="Review comments. Rejection comments are required if rejecting."
                            value={reviewComments[reviewer.id] || ""}
                            onChange={(e) =>
                              setReviewComments({
                                ...reviewComments,
                                [reviewer.id]: e.target.value,
                              })
                            }
                            rows={3}
                            style={textareaStyle}
                          />

                          <div style={buttonRowStyle}>
                            <button
                              disabled={busy}
                              onClick={() => reviewerDecision(reviewer, "approved")}
                              style={primaryButtonStyle}
                            >
                              Approve Review
                            </button>

                            <button
                              disabled={busy}
                              onClick={() => reviewerDecision(reviewer, "rejected")}
                              style={dangerButtonStyle}
                            >
                              Reject & Return to Owner
                            </button>
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    <div style={smallTextStyle}>
                      {canCurrentUserReview
                        ? "Your review has been completed."
                        : "Waiting for assigned reviewer."}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Workflow Actions</h2>
        <div style={actionStackStyle}>
          {transitionPermissions.sendToCollaboration.allowed ? (
            <details>
              <summary>Send to Collaboration</summary>
              <textarea
                value={collaborationReviewerEmails[doc.id] || ""}
                onChange={(e) =>
                  setCollaborationReviewerEmails({
                    ...collaborationReviewerEmails,
                    [doc.id]: e.target.value,
                  })
                }
                placeholder="Reviewer emails separated by comma, semicolon, or new line"
                rows={3}
                style={textareaStyle}
              />
              <button disabled={busy} onClick={() => sendToCollaboration(doc)} style={primaryButtonStyle}>
                Send Collaboration
              </button>
            </details>
          ) : null}

          {transitionPermissions.completeCollaboration.allowed ? (
            <button disabled={busy} onClick={() => completeCollaboration(doc)} style={primaryButtonStyle}>
              Complete Collaboration
            </button>
          ) : null}

          {transitionPermissions.sendToFormalReview.allowed ? (
            <details>
              <summary>Send to Formal Review</summary>
              <textarea
                value={formalReviewerEmails[doc.id] || ""}
                onChange={(e) =>
                  setFormalReviewerEmails({
                    ...formalReviewerEmails,
                    [doc.id]: e.target.value,
                  })
                }
                placeholder="Formal reviewer / approver emails"
                rows={3}
                style={textareaStyle}
              />
              <button disabled={busy} onClick={() => sendToFormalReview(doc)} style={primaryButtonStyle}>
                Send Formal Review
              </button>
            </details>
          ) : null}

          {transitionPermissions.finalApprove.allowed ? (
            <button
              disabled={busy || !requiredFormalApproved || !requiredApproversApproved}
              onClick={() => {
                setPendingApprovalDoc(doc);
                setShowApprovalSignatureModal(true);
              }}
              style={primaryButtonStyle}
            >
              Electronic Signature Required
            </button>
          ) : null}

          {transitionPermissions.reject.allowed ? (
            <details>
              <summary>Administrative Reject / Return to Owner</summary>
              <textarea
                value={rejectComments[doc.id] || ""}
                onChange={(e) =>
                  setRejectComments({ ...rejectComments, [doc.id]: e.target.value })
                }
                placeholder="Rejection comments"
                rows={3}
                style={textareaStyle}
              />
              <button disabled={busy} onClick={() => rejectDocument(doc)} style={dangerButtonStyle}>
                Reject Document
              </button>
            </details>
          ) : null}

          {transitionPermissions.makeEffective.allowed ? (
            <details>
              <summary>Make Effective / Release</summary>
              <textarea
                value={releaseComments[doc.id] || ""}
                onChange={(e) =>
                  setReleaseComments({ ...releaseComments, [doc.id]: e.target.value })
                }
                placeholder="Release comments"
                rows={3}
                style={textareaStyle}
              />
              <button disabled={busy} onClick={() => makeEffective(doc)} style={primaryButtonStyle}>
                Make Effective
              </button>
            </details>
          ) : null}

          {transitionPermissions.acknowledge.allowed ? (
            <button disabled={busy || !doc.file_url} onClick={() => acknowledgeDocument(doc)} style={primaryButtonStyle}>
              Opened, Read & Acknowledge
            </button>
          ) : null}

          {doc.training_required ? (
            <details>
              <summary>Assign Training</summary>
              {!doc.file_url ? (
                <p style={warningStyle}>Training cannot be assigned until a document file is attached.</p>
              ) : (
                <p style={smallTextStyle}>Training will include the current document attachment link.</p>
              )}
              <textarea
                value={trainingEmails[doc.id] || ""}
                onChange={(e) =>
                  setTrainingEmails({ ...trainingEmails, [doc.id]: e.target.value })
                }
                placeholder="Emails separated by comma, semicolon, or new line"
                rows={3}
                style={textareaStyle}
              />
              <button disabled={busy || !transitionPermissions.assignTraining.allowed} onClick={() => assignTraining(doc)} style={primaryButtonStyle}>
                Assign Training
              </button>
            </details>
          ) : null}

          {transitionPermissions.obsolete.allowed ? (
            <details>
              <summary>Obsolete</summary>
              <textarea
                value={obsoleteReason[doc.id] || ""}
                onChange={(e) =>
                  setObsoleteReason({ ...obsoleteReason, [doc.id]: e.target.value })
                }
                placeholder="Obsolete reason"
                rows={3}
                style={textareaStyle}
              />
              <button disabled={busy} onClick={() => obsoleteDocument(doc)} style={dangerButtonStyle}>
                Obsolete
              </button>
            </details>
          ) : null}
        </div>
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Review Records</h2>
        <h3>Collaboration Reviews</h3>
        {collaborationReviews.length === 0 ? <p style={subtleText}>No collaboration reviews.</p> : (
          <ul>
            {collaborationReviews.map((review) => (
              <li key={review.id}>
                {review.reviewer_email} — {review.review_status}
                {review.reviewed_file_url ? (
                  <>
                    {" — "}
                    <a href={review.reviewed_file_url} target="_blank" rel="noreferrer">
                      Reviewed file
                    </a>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        <h3>Formal Reviews</h3>
        {formalReviews.length === 0 ? <p style={subtleText}>No formal reviews.</p> : (
          <ul>
            {formalReviews.map((review) => (
              <li key={review.id}>
                {review.reviewer_email} — {review.review_status}
                {review.reviewed_file_url ? (
                  <>
                    {" — "}
                    <a href={review.reviewed_file_url} target="_blank" rel="noreferrer">
                      Reviewed file
                    </a>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Training Assignments</h2>
        {trainingAssignments.length === 0 ? (
          <p style={subtleText}>No training assigned for this document.</p>
        ) : (
          <div style={{ display: "grid", gap: "10px" }}>
            {trainingAssignments.map((item) => {
              const trainingDocUrl = item.document_file_url || doc.file_url;
              const canComplete =
                normalizeEmail(item.user_email) === normalizeEmail(userEmail) || canManage;

              return (
                <div key={item.id} style={trainingCardStyle}>
                  <strong>{item.user_email}</strong>
                  <div style={smallTextStyle}>Status: {item.status}</div>

                  {trainingDocUrl ? (
                    <div style={buttonRowStyle}>
                      <a href={trainingDocUrl} target="_blank" rel="noreferrer" style={primaryLinkStyle}>
                        Open Training Document
                      </a>
                    </div>
                  ) : (
                    <p style={warningStyle}>No document attached to this training assignment.</p>
                  )}

                  {item.status !== "completed" && canComplete ? (
                    <button
                      disabled={busy || !trainingDocUrl}
                      onClick={() => completeTraining(item)}
                      style={primaryButtonStyle}
                    >
                      Complete Training
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Electronic Signatures</h2>
        <DocumentSignatures documentId={doc.id} />
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Workflow Timeline / Audit Trail</h2>
        {workflowEvents.length === 0 ? (
          <p style={subtleText}>No workflow events logged yet.</p>
        ) : (
          <div style={{ display: "grid", gap: "10px" }}>
            {workflowEvents.map((event) => (
              <div key={event.id} style={timelineItemStyle}>
                <strong>{event.event_type}</strong>
                <div style={smallTextStyle}>
                  {event.performed_by || "unknown"} • {formatDateTime(event.performed_at)}
                </div>
                {event.from_status || event.to_status ? (
                  <div style={smallTextStyle}>
                    {event.from_status || "-"} → {event.to_status || "-"}
                  </div>
                ) : null}
                {event.comments ? <p style={{ margin: "6px 0 0" }}>{event.comments}</p> : null}
                {event.metadata?.reviewed_file_url ? (
                  <a href={event.metadata.reviewed_file_url} target="_blank" rel="noreferrer">
                    Open reviewed file
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <ESignatureModal
        open={showApprovalSignatureModal}
        title="Document Approval Electronic Signature"
        actionLabel="Sign and Approve"
        onSubmit={submitApprovalSignature}
        onClose={() => {
          setShowApprovalSignatureModal(false);
          setPendingApprovalDoc(null);
        }}
      />
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "12px" }}>
      <label style={labelStyle}>{label}</label>
      <div style={{ marginTop: "5px" }}>{children}</div>
    </div>
  );
}

function KpiCard({ title, value, color }: { title: string; value: number; color: string }) {
  return (
    <div style={{ ...kpiCardStyle, borderLeft: `8px solid ${color}` }}>
      <div style={kpiTitleStyle}>{title}</div>
      <div style={{ fontSize: "30px", fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "effective"
      ? "#15803d"
      : status === "approved"
      ? "#2563eb"
      : status === "formal_review"
      ? "#d97706"
      : status === "collaboration"
      ? "#7c3aed"
      : status === "rejected"
      ? "#dc2626"
      : status === "obsolete" || status === "superseded"
      ? "#991b1b"
      : status === "pending"
      ? "#6b7280"
      : "#6b7280";

  return (
    <span
      style={{
        background: color,
        color: "white",
        borderRadius: "999px",
        padding: "3px 8px",
        fontSize: "12px",
        fontWeight: 700,
      }}
    >
      {status}
    </span>
  );
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "N/A";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

const pageStyle: React.CSSProperties = { padding: "24px", background: "#f8fafc", minHeight: "100vh", fontFamily: "Arial, sans-serif" };
const headerStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-start", flexWrap: "wrap", marginBottom: "20px" };
const eyebrowStyle: React.CSSProperties = { fontSize: "12px", letterSpacing: "0.08em", color: "#6b7280", fontWeight: 800 };
const subtleText: React.CSSProperties = { color: "#6b7280" };
const cardStyle: React.CSSProperties = { background: "white", border: "1px solid #d1d5db", borderRadius: "16px", padding: "20px", marginBottom: "20px" };
const gridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "14px" };
const kpiGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px", marginBottom: "20px" };
const kpiCardStyle: React.CSSProperties = { background: "white", border: "1px solid #d1d5db", borderRadius: "14px", padding: "16px" };
const kpiTitleStyle: React.CSSProperties = { color: "#6b7280", marginBottom: "8px" };
const labelStyle: React.CSSProperties = { fontWeight: 700 };
const inputStyle: React.CSSProperties = { width: "100%", padding: "9px", borderRadius: "8px", border: "1px solid #d1d5db" };
const textareaStyle: React.CSSProperties = { width: "100%", padding: "9px", borderRadius: "8px", border: "1px solid #d1d5db", marginTop: "6px" };
const primaryButtonStyle: React.CSSProperties = { background: "#2563eb", color: "white", border: "none", padding: "10px 14px", borderRadius: "8px", fontWeight: 700, cursor: "pointer", marginTop: "10px" };
const dangerButtonStyle: React.CSSProperties = { background: "#dc2626", color: "white", border: "none", padding: "10px 14px", borderRadius: "8px", fontWeight: 700, cursor: "pointer", marginTop: "10px" };
const darkButtonStyle: React.CSSProperties = { background: "#111827", color: "white", padding: "10px 14px", borderRadius: "8px", textDecoration: "none", fontWeight: 700 };
const primaryLinkStyle: React.CSSProperties = { background: "#2563eb", color: "white", padding: "9px 12px", borderRadius: "8px", textDecoration: "none", fontWeight: 700, display: "inline-block" };
const buttonRowStyle: React.CSSProperties = { display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center", marginTop: "12px" };
const actionStackStyle: React.CSSProperties = { display: "grid", gap: "10px" };
const smallTextStyle: React.CSSProperties = { fontSize: "12px", color: "#6b7280" };
const trainingCardStyle: React.CSSProperties = { border: "1px solid #d1d5db", borderRadius: "12px", padding: "14px", background: "#f9fafb" };
const rowBetweenStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "flex-start", flexWrap: "wrap" };
const noticeStyle: React.CSSProperties = { background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "10px", padding: "10px", marginTop: "12px" };
const warningStyle: React.CSSProperties = { color: "#b45309", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "8px", padding: "8px", display: "inline-block" };
const timelineItemStyle: React.CSSProperties = { borderLeft: "4px solid #2563eb", padding: "10px 12px", background: "#f9fafb", borderRadius: "8px" };
const overdueTextStyle: React.CSSProperties = { fontSize: "12px", color: "#dc2626", fontWeight: 700 };
const relationshipCountStyle: React.CSSProperties = { background: "#ede9fe", color: "#5b21b6", border: "1px solid #ddd6fe", borderRadius: "999px", padding: "6px 10px", fontWeight: 800, fontSize: "13px" };
const relationshipGroupStyle: React.CSSProperties = { border: "1px solid #e5e7eb", background: "#f9fafb", borderRadius: "12px", padding: "14px" };
const relationshipItemStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "flex-start", flexWrap: "wrap", border: "1px solid #d1d5db", background: "white", borderRadius: "10px", padding: "12px" };
