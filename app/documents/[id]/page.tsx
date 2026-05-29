"use client";

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

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
  created_at?: string | null;
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
  metadata: any;
};

type ApprovalTemplate = {
  id: string;
  template_name: string;
  active?: boolean | null;
};

const REVIEWER_TYPES = ["collaboration", "formal_review", "approver"];

export default function DocumentWorkflowPage() {
  const params = useParams();
  const documentId = String(params?.id || "");

  const [doc, setDoc] = useState<ControlledDocument | null>(null);
  const [acknowledgements, setAcknowledgements] = useState<any[]>([]);
  const [trainingAssignments, setTrainingAssignments] = useState<any[]>([]);
  const [collaborationReviews, setCollaborationReviews] = useState<any[]>([]);
  const [formalReviews, setFormalReviews] = useState<any[]>([]);
  const [approvalTemplates, setApprovalTemplates] = useState<ApprovalTemplate[]>([]);
  const [assignedReviewers, setAssignedReviewers] = useState<AssignedReviewer[]>([]);
  const [workflowEvents, setWorkflowEvents] = useState<WorkflowEvent[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState("user");

  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [newReviewer, setNewReviewer] = useState({
    reviewer_type: "formal_review",
    reviewer_email: "",
    reviewer_role: "",
    required_reviewer: true,
  });

  const [reviewComments, setReviewComments] = useState<Record<string, string>>({});
  const [collaborationReviewerEmails, setCollaborationReviewerEmails] = useState("");
  const [formalReviewerEmails, setFormalReviewerEmails] = useState("");
  const [rejectComments, setRejectComments] = useState("");
  const [releaseComments, setReleaseComments] = useState("");
  const [obsoleteReason, setObsoleteReason] = useState("");
  const [trainingEmails, setTrainingEmails] = useState("");

  const normalizeEmail = (value: string | null | undefined) => {
    const text = String(value || "").trim().toLowerCase();
    if (!text || !text.includes("@")) return "";
    return text;
  };

  const canApprove = ["admin", "approver", "vp_quality"].includes(userRole);
  const canManage = canApprove || ["document_control", "quality"].includes(userRole);
  const isOwner = normalizeEmail(doc?.owner_email) === normalizeEmail(userEmail);
  const canManageWorkflow = canManage || isOwner;

  const requiredCollaborationReviewers = useMemo(
    () =>
      assignedReviewers.filter(
        (r) => r.reviewer_type === "collaboration" && Boolean(r.required_reviewer)
      ),
    [assignedReviewers]
  );

  const requiredFormalReviewers = useMemo(
    () =>
      assignedReviewers.filter(
        (r) => r.reviewer_type === "formal_review" && Boolean(r.required_reviewer)
      ),
    [assignedReviewers]
  );

  const requiredApprovers = useMemo(
    () =>
      assignedReviewers.filter(
        (r) => r.reviewer_type === "approver" && Boolean(r.required_reviewer)
      ),
    [assignedReviewers]
  );

  const rejectedReviewers = useMemo(
    () => assignedReviewers.filter((r) => r.review_status === "rejected"),
    [assignedReviewers]
  );

  const requiredCollaborationApproved =
    requiredCollaborationReviewers.length === 0 ||
    requiredCollaborationReviewers.every((r) => r.review_status === "approved");

  const requiredFormalApproved =
    requiredFormalReviewers.length === 0 ||
    requiredFormalReviewers.every((r) => r.review_status === "approved");

  const requiredApproversApproved =
    requiredApprovers.length === 0 ||
    requiredApprovers.every((r) => r.review_status === "approved");

  const nextPendingReviewer = useMemo(() => {
    return [...assignedReviewers]
      .filter((r) => r.review_status !== "approved" && r.review_status !== "rejected")
      .sort((a, b) => Number(a.review_sequence || 999) - Number(b.review_sequence || 999))[0];
  }, [assignedReviewers]);

  const workflowCompletionPercent = useMemo(() => {
    if (assignedReviewers.length === 0) return doc?.status === "effective" ? 100 : 0;
    const completed = assignedReviewers.filter(
      (r) => r.review_status === "approved" || r.review_status === "rejected"
    ).length;
    return Math.round((completed / assignedReviewers.length) * 100);
  }, [assignedReviewers, doc?.status]);

  const fetchUser = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const email = userData?.user?.email || "";
    setUserEmail(email);

    if (!email) {
      setUserRole("user");
      return;
    }

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
      .maybeSingle();

    if (docRes.error) alert(docRes.error.message);
    setDoc((docRes.data as ControlledDocument) || null);

    const [ackRes, trainingRes, collaborationRes, formalRes, templateRes, reviewerRes, eventRes] =
      await Promise.all([
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
      ]);

    if (!ackRes.error) setAcknowledgements(ackRes.data || []);
    if (!trainingRes.error) setTrainingAssignments(trainingRes.data || []);
    if (!collaborationRes.error) setCollaborationReviews(collaborationRes.data || []);
    if (!formalRes.error) setFormalReviews(formalRes.data || []);
    if (!templateRes.error) setApprovalTemplates(templateRes.data || []);
    if (!reviewerRes.error) setAssignedReviewers((reviewerRes.data as AssignedReviewer[]) || []);
    if (!eventRes.error) setWorkflowEvents((eventRes.data as WorkflowEvent[]) || []);
    if (eventRes.error) setWorkflowEvents([]);

    setLoading(false);
  };

  useEffect(() => {
    if (documentId) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (!documentId) return;

    await supabase.from("document_workflow_events").insert({
      document_id: documentId,
      event_type: eventType,
      performed_by: userEmail || "unknown",
      from_status: fromStatus || null,
      to_status: toStatus || null,
      comments: comments || null,
      metadata: metadata || {},
    });
  };

  const transitionDocument = async ({
    toStatus,
    updates,
    eventType,
    comments,
    metadata,
  }: {
    toStatus: string;
    updates?: Record<string, any>;
    eventType: string;
    comments?: string | null;
    metadata?: any;
  }) => {
    if (!doc) return false;

    setSaving(true);

    const { error } = await supabase
      .from("controlled_documents")
      .update({
        ...(updates || {}),
        status: toStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", doc.id);

    if (error) {
      alert(error.message);
      setSaving(false);
      return false;
    }

    await logWorkflowEvent({
      eventType,
      fromStatus: doc.status,
      toStatus,
      comments,
      metadata,
    });

    setSaving(false);
    await fetchData();
    return true;
  };

  const parseEmails = (value: string) =>
    value
      .split(/[;,\n]/)
      .map((email) => normalizeEmail(email))
      .filter(Boolean);

  const documentAckCount = () => acknowledgements.length;
  const trainingCount = () => trainingAssignments.length;
  const openTrainingCount = () => trainingAssignments.filter((item) => item.status !== "completed").length;

  const loadApprovalTemplate = async () => {
    if (!selectedTemplateId || !doc) {
      alert("Select an approval matrix template first.");
      return;
    }

    if (!canManageWorkflow) {
      alert("Only the document owner, Document Control, Quality, approvers, admins, or VP Quality can load reviewers.");
      return;
    }

    const { data, error } = await supabase
      .from("approval_matrix_reviewers")
      .select("*")
      .eq("template_id", selectedTemplateId)
      .order("sequence_order", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    const rows = (data || []).map((reviewer: any, index: number) => ({
      document_id: doc.id,
      reviewer_type: reviewer.reviewer_type,
      reviewer_email: normalizeEmail(reviewer.reviewer_email),
      reviewer_role: reviewer.reviewer_role || null,
      required_reviewer: reviewer.required_reviewer ?? true,
      review_sequence: reviewer.sequence_order || assignedReviewers.length + index + 1,
      review_status: "pending",
      assigned_by: userEmail || "unknown",
    }));

    if (rows.length === 0) {
      alert("This template does not have reviewers configured.");
      return;
    }

    const insertRes = await supabase.from("document_assigned_reviewers").insert(rows);

    if (insertRes.error) {
      alert(insertRes.error.message);
      return;
    }

    await logWorkflowEvent({
      eventType: "approval_matrix_loaded",
      comments: "Approval matrix reviewers loaded.",
      metadata: { template_id: selectedTemplateId, reviewer_count: rows.length },
    });

    setSelectedTemplateId("");
    await fetchData();
  };

  const addCustomReviewer = async () => {
    if (!doc) return;

    if (!canManageWorkflow) {
      alert("Only the document owner, Document Control, Quality, approvers, admins, or VP Quality can add reviewers.");
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
      assigned_by: userEmail || "unknown",
    });

    if (error) {
      alert(error.message);
      return;
    }

    await logWorkflowEvent({
      eventType: "reviewer_added",
      comments: `Reviewer added: ${reviewerEmail}`,
      metadata: {
        reviewer_type: newReviewer.reviewer_type,
        reviewer_role: newReviewer.reviewer_role,
      },
    });

    setNewReviewer({
      reviewer_type: "formal_review",
      reviewer_email: "",
      reviewer_role: "",
      required_reviewer: true,
    });

    await fetchData();
  };

  const removeReviewer = async (reviewer: AssignedReviewer) => {
    if (!canManageWorkflow) {
      alert("Only workflow managers can remove reviewers.");
      return;
    }

    if (reviewer.review_status === "approved" || reviewer.review_status === "rejected") {
      alert("Completed reviewer records should not be removed. Add a new reviewer or restart the workflow instead.");
      return;
    }

    const { error } = await supabase.from("document_assigned_reviewers").delete().eq("id", reviewer.id);

    if (error) {
      alert(error.message);
      return;
    }

    await logWorkflowEvent({
      eventType: "reviewer_removed",
      comments: `Reviewer removed: ${reviewer.reviewer_email}`,
      metadata: { reviewer_type: reviewer.reviewer_type, reviewer_role: reviewer.reviewer_role },
    });

    await fetchData();
  };

  const sendToCollaboration = async () => {
    if (!doc) return;
    if (!canManageWorkflow) {
      alert("Only the document owner or workflow managers can send to collaboration.");
      return;
    }
    if (!["draft", "rejected"].includes(doc.status)) {
      alert("Only draft or rejected documents can be sent to collaboration.");
      return;
    }

    const reviewers = parseEmails(collaborationReviewerEmails);

    if (reviewers.length > 0) {
      const startSequence = assignedReviewers.length + 1;
      const assignedRows = reviewers.map((email, index) => ({
        document_id: doc.id,
        reviewer_type: "collaboration",
        reviewer_email: email,
        reviewer_role: "collaboration_reviewer",
        required_reviewer: true,
        review_sequence: startSequence + index,
        review_status: "pending",
        assigned_by: userEmail || "unknown",
      }));

      await supabase.from("document_assigned_reviewers").insert(assignedRows);

      const legacyRows = reviewers.map((email) => ({
        document_id: doc.id,
        reviewer_email: email,
        review_status: "pending",
      }));

      await supabase
        .from("document_collaboration_reviews")
        .upsert(legacyRows, { onConflict: "document_id,reviewer_email" });
    }

    await transitionDocument({
      toStatus: "collaboration",
      eventType: "sent_to_collaboration",
      comments: "Document sent to collaboration review.",
      updates: {
        collaboration_completed: false,
        formal_review_completed: false,
      },
      metadata: { reviewer_count_added: reviewers.length },
    });

    setCollaborationReviewerEmails("");
  };

  const completeCollaboration = async () => {
    if (!doc) return;
    if (!canManageWorkflow) {
      alert("Only the document owner or workflow managers can complete collaboration.");
      return;
    }
    if (doc.status !== "collaboration") {
      alert("Only documents in collaboration can complete collaboration.");
      return;
    }
    if (!requiredCollaborationApproved) {
      alert("Required collaboration reviewers must approve before collaboration can be completed.");
      return;
    }
    if (rejectedReviewers.length > 0) {
      alert("One or more reviewers rejected the document. Resolve comments before continuing.");
      return;
    }

    const { error } = await supabase
      .from("controlled_documents")
      .update({ collaboration_completed: true, updated_at: new Date().toISOString() })
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

    await fetchData();
  };

  const sendToFormalReview = async () => {
    if (!doc) return;
    if (!canManageWorkflow) {
      alert("Only the document owner or workflow managers can send to formal review.");
      return;
    }
    if (!["draft", "collaboration", "rejected"].includes(doc.status)) {
      alert("Document must be in draft, collaboration, or rejected status before formal review.");
      return;
    }
    if (doc.collaboration_required && !doc.collaboration_completed && doc.status !== "draft") {
      alert("Collaboration must be completed before formal review.");
      return;
    }
    if (rejectedReviewers.length > 0) {
      alert("One or more reviewers rejected the document. Resolve comments before sending to formal review.");
      return;
    }

    const reviewers = parseEmails(formalReviewerEmails);

    if (reviewers.length > 0) {
      const startSequence = assignedReviewers.length + 1;
      const assignedRows = reviewers.map((email, index) => ({
        document_id: doc.id,
        reviewer_type: "formal_review",
        reviewer_email: email,
        reviewer_role: "formal_reviewer",
        required_reviewer: true,
        review_sequence: startSequence + index,
        review_status: "pending",
        assigned_by: userEmail || "unknown",
      }));

      await supabase.from("document_assigned_reviewers").insert(assignedRows);

      const legacyRows = reviewers.map((email) => ({
        document_id: doc.id,
        reviewer_email: email,
        review_role: "formal_reviewer",
        review_status: "pending",
      }));

      await supabase
        .from("document_formal_reviews")
        .upsert(legacyRows, { onConflict: "document_id,reviewer_email" });
    }

    await transitionDocument({
      toStatus: "formal_review",
      eventType: "sent_to_formal_review",
      comments: "Document sent to formal review.",
      updates: {
        formal_review_completed: false,
        submitted_for_approval_at: new Date().toISOString(),
        submitted_for_approval_by: userEmail || "unknown",
      },
      metadata: { reviewer_count_added: reviewers.length },
    });

    setFormalReviewerEmails("");
  };

  const reviewerDecision = async (reviewer: AssignedReviewer, decision: "approved" | "rejected") => {
    if (!doc) return;

    const currentUser = normalizeEmail(userEmail);
    const assignedUser = normalizeEmail(reviewer.reviewer_email);

    if (currentUser !== assignedUser) {
      alert("Only the assigned reviewer can complete this review.");
      return;
    }

    if (reviewer.review_status === "approved" || reviewer.review_status === "rejected") {
      alert("This reviewer decision has already been completed.");
      return;
    }

    const previousRequiredReviewers = assignedReviewers.filter(
      (r) =>
        Number(r.review_sequence || 999) < Number(reviewer.review_sequence || 999) &&
        Boolean(r.required_reviewer)
    );

    const blockedReviewer = previousRequiredReviewers.find((r) => r.review_status !== "approved");

    if (blockedReviewer) {
      alert(`Waiting for ${blockedReviewer.reviewer_email} to complete review first.`);
      return;
    }

    const comments = reviewComments[reviewer.id] || "";

    const { error } = await supabase
      .from("document_assigned_reviewers")
      .update({
        review_status: decision,
        review_comments: comments,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", reviewer.id);

    if (error) {
      alert(error.message);
      return;
    }

    if (reviewer.reviewer_type === "collaboration") {
      await supabase.from("document_collaboration_reviews").upsert(
        {
          document_id: doc.id,
          reviewer_email: reviewer.reviewer_email,
          review_status: decision,
          review_comments: comments,
          completed_at: new Date().toISOString(),
        },
        { onConflict: "document_id,reviewer_email" }
      );
    }

    if (reviewer.reviewer_type === "formal_review" || reviewer.reviewer_type === "approver") {
      await supabase.from("document_formal_reviews").upsert(
        {
          document_id: doc.id,
          reviewer_email: reviewer.reviewer_email,
          review_role: reviewer.reviewer_role || reviewer.reviewer_type,
          review_status: decision,
          review_comments: comments,
          approved_at: new Date().toISOString(),
        },
        { onConflict: "document_id,reviewer_email" }
      );
    }

    await logWorkflowEvent({
      eventType: decision === "approved" ? "review_approved" : "review_rejected",
      fromStatus: doc.status,
      toStatus: doc.status,
      comments,
      metadata: {
        reviewer_id: reviewer.id,
        reviewer_email: reviewer.reviewer_email,
        reviewer_type: reviewer.reviewer_type,
        reviewer_role: reviewer.reviewer_role,
        review_sequence: reviewer.review_sequence,
      },
    });

    setReviewComments({ ...reviewComments, [reviewer.id]: "" });
    await fetchData();
  };

  const approveDocument = async () => {
    if (!doc) return;
    if (!canApprove) {
      alert("Only approvers, admins, or VP Quality can approve documents.");
      return;
    }
    if (doc.status !== "formal_review") {
      alert("Only documents in formal review can be approved.");
      return;
    }
    if (rejectedReviewers.length > 0) {
      alert("One or more reviewers rejected the document. Resolve comments before approval.");
      return;
    }
    if (!requiredFormalApproved) {
      alert("Required formal reviewers must approve before document approval.");
      return;
    }
    if (!requiredApproversApproved) {
      alert("Required approvers must approve before document approval.");
      return;
    }

    await transitionDocument({
      toStatus: "approved",
      eventType: "document_approved",
      comments: "Controlled document approved.",
      updates: {
        formal_review_completed: true,
        approved_at: new Date().toISOString(),
        approved_by: userEmail || "unknown",
        approval_comments: "Approved controlled document.",
      },
    });
  };

  const rejectDocument = async () => {
    if (!doc) return;
    if (!canApprove) {
      alert("Only approvers, admins, or VP Quality can reject documents.");
      return;
    }
    if (!["formal_review", "collaboration"].includes(doc.status)) {
      alert("Only documents in collaboration or formal review can be rejected.");
      return;
    }

    const comments = rejectComments.trim() || "Rejected during document review.";

    await transitionDocument({
      toStatus: "rejected",
      eventType: "document_rejected",
      comments,
      updates: { approval_comments: comments },
    });

    setRejectComments("");
  };

  const makeEffective = async () => {
    if (!doc) return;
    if (!canApprove) {
      alert("Only approvers, admins, or VP Quality can make documents effective.");
      return;
    }
    if (doc.status !== "approved") {
      alert("Only approved documents can be made effective.");
      return;
    }
    if (doc.formal_review_required && !doc.formal_review_completed) {
      alert("Formal review must be completed before release.");
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const comments = releaseComments.trim() || "Document released effective.";

    await transitionDocument({
      toStatus: "effective",
      eventType: "document_made_effective",
      comments,
      updates: {
        effective_date: doc.effective_date || today,
        release_comments: comments,
        release_approved_by: userEmail || "unknown",
        release_approved_at: new Date().toISOString(),
      },
    });

    setReleaseComments("");
  };

  const obsoleteDocument = async () => {
    if (!doc) return;
    if (!canApprove) {
      alert("Only approvers, admins, or VP Quality can obsolete documents.");
      return;
    }
    if (!obsoleteReason.trim()) {
      alert("Obsolete reason is required.");
      return;
    }

    await transitionDocument({
      toStatus: "obsolete",
      eventType: "document_obsoleted",
      comments: obsoleteReason.trim(),
      updates: {
        obsolete_at: new Date().toISOString(),
        obsolete_by: userEmail || "unknown",
        obsolete_reason: obsoleteReason.trim(),
      },
    });

    setObsoleteReason("");
  };

  const acknowledgeDocument = async () => {
    if (!doc) return;
    if (!userEmail) {
      alert("You must be logged in to acknowledge a document.");
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
      fromStatus: doc.status,
      toStatus: doc.status,
      comments: "User acknowledged document.",
    });

    await fetchData();
  };

  const assignTraining = async () => {
    if (!doc) return;
    if (!canManageWorkflow) {
      alert("Only document control, quality, approvers, admins, VP Quality, or the owner can assign training.");
      return;
    }

    const emails = parseEmails(trainingEmails);

    if (emails.length === 0) {
      alert("Enter at least one valid training assignee email.");
      return;
    }

    const rows = emails.map((email) => ({
      document_id: doc.id,
      user_email: email,
      status: "assigned",
      assigned_by: userEmail || "unknown",
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
      fromStatus: doc.status,
      toStatus: doc.status,
      comments: `Training assigned to ${emails.length} user(s).`,
      metadata: { assignees: emails },
    });

    setTrainingEmails("");
    await fetchData();
  };

  const completeTraining = async (assignmentId: string) => {
    const { error } = await supabase
      .from("document_training_assignments")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        completed_by: userEmail || "unknown",
      })
      .eq("id", assignmentId);

    if (error) {
      alert(error.message);
      return;
    }

    if (doc) {
      await logWorkflowEvent({
        eventType: "training_completed",
        fromStatus: doc.status,
        toStatus: doc.status,
        comments: "Training assignment completed.",
        metadata: { assignment_id: assignmentId },
      });
    }

    await fetchData();
  };

  if (loading) return <main style={pageStyle}>Loading Document Workflow...</main>;

  if (!doc) {
    return (
      <main style={pageStyle}>
        <h1>Document not found</h1>
        <a href="/documents" style={darkButtonStyle}>
          Back to Document Control
        </a>
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
          <div style={buttonRowStyle}>
            <StatusBadge status={doc.status} />
            <span style={smallTextStyle}>User: {userEmail || "Not signed in"}</span>
            <span style={smallTextStyle}>Role: {userRole}</span>
          </div>
        </div>
        <div style={buttonRowStyle}>
          <a href="/documents" style={darkButtonStyle}>
            Back to Document Register
          </a>
          <a href="/dashboard" style={darkButtonStyle}>
            Dashboard
          </a>
        </div>
      </header>

      <section style={kpiGridStyle}>
        <KpiCard title="Workflow Complete" value={`${workflowCompletionPercent}%`} color="#2563eb" />
        <KpiCard title="Assigned Reviewers" value={assignedReviewers.length} color="#7c3aed" />
        <KpiCard title="Acknowledgements" value={documentAckCount()} color="#15803d" />
        <KpiCard title="Open Training" value={openTrainingCount()} color="#dc2626" />
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Workflow Status</h2>
        <div style={gridStyle}>
          <Field label="Current Status">
            <StatusBadge status={doc.status} />
          </Field>
          <Field label="Next Pending Reviewer">
            <div>{nextPendingReviewer?.reviewer_email || "None"}</div>
          </Field>
          <Field label="Collaboration Gate">
            <div>{requiredCollaborationApproved ? "Complete / Not Required" : "Pending Required Reviewers"}</div>
          </Field>
          <Field label="Formal Review Gate">
            <div>{requiredFormalApproved ? "Complete / Not Required" : "Pending Required Reviewers"}</div>
          </Field>
          <Field label="Approval Gate">
            <div>{requiredApproversApproved ? "Complete / Not Required" : "Pending Required Approvers"}</div>
          </Field>
          <Field label="Rejected Reviewer Tasks">
            <div>{rejectedReviewers.length}</div>
          </Field>
        </div>
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Document Metadata</h2>
        <div style={gridStyle}>
          <Field label="Document Type"><div>{doc.document_type || "N/A"}</div></Field>
          <Field label="Department"><div>{doc.department || "N/A"}</div></Field>
          <Field label="Process Area"><div>{doc.process_area || "N/A"}</div></Field>
          <Field label="Owner"><div>{doc.owner_email || "N/A"}</div></Field>
          <Field label="Approver"><div>{doc.approver_email || "N/A"}</div></Field>
          <Field label="Effective Date"><div>{doc.effective_date || "N/A"}</div></Field>
          <Field label="Originating Change Control"><div>{doc.originating_change_control_id || "None"}</div></Field>
          <Field label="File"><div>{doc.file_name || "No file attached"}</div></Field>
        </div>
        {doc.file_url ? (
          <div style={buttonRowStyle}>
            <a href={doc.file_url} target="_blank" rel="noreferrer" style={primaryLinkStyle}>
              Open / Download Document File
            </a>
          </div>
        ) : null}
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Approval Matrix & Reviewer Assignment</h2>

        <div style={gridStyle}>
          <select
            value={selectedTemplateId}
            onChange={(e) => setSelectedTemplateId(e.target.value)}
            style={inputStyle}
            disabled={!canManageWorkflow || saving}
          >
            <option value="">Select Approval Matrix Template</option>
            {approvalTemplates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.template_name}
              </option>
            ))}
          </select>

          <button onClick={loadApprovalTemplate} disabled={!canManageWorkflow || saving} style={canManageWorkflow ? primaryButtonStyle : disabledButtonStyle}>
            Load Template
          </button>
        </div>

        <hr style={{ margin: "20px 0" }} />

        <h3>Add Custom Reviewer</h3>
        <div style={gridStyle}>
          <select
            value={newReviewer.reviewer_type}
            onChange={(e) => setNewReviewer({ ...newReviewer, reviewer_type: e.target.value })}
            style={inputStyle}
            disabled={!canManageWorkflow || saving}
          >
            {REVIEWER_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>

          <input
            placeholder="Reviewer Email"
            value={newReviewer.reviewer_email}
            onChange={(e) => setNewReviewer({ ...newReviewer, reviewer_email: e.target.value })}
            style={inputStyle}
            disabled={!canManageWorkflow || saving}
          />

          <input
            placeholder="Reviewer Role"
            value={newReviewer.reviewer_role}
            onChange={(e) => setNewReviewer({ ...newReviewer, reviewer_role: e.target.value })}
            style={inputStyle}
            disabled={!canManageWorkflow || saving}
          />
        </div>

        <label style={{ ...smallTextStyle, display: "block", marginTop: "10px" }}>
          <input
            type="checkbox"
            checked={newReviewer.required_reviewer}
            onChange={(e) => setNewReviewer({ ...newReviewer, required_reviewer: e.target.checked })}
            disabled={!canManageWorkflow || saving}
          />{" "}
          Required reviewer
        </label>

        <button onClick={addCustomReviewer} disabled={!canManageWorkflow || saving} style={canManageWorkflow ? primaryButtonStyle : disabledButtonStyle}>
          Add Reviewer
        </button>
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Reviewer Tasks</h2>
        {assignedReviewers.length === 0 ? (
          <p style={subtleText}>No reviewers assigned.</p>
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            {assignedReviewers.map((reviewer) => {
              const canCurrentUserReview = normalizeEmail(reviewer.reviewer_email) === normalizeEmail(userEmail);
              const completed = reviewer.review_status === "approved" || reviewer.review_status === "rejected";
              const previousRequiredReviewers = assignedReviewers.filter(
                (r) =>
                  Number(r.review_sequence || 999) < Number(reviewer.review_sequence || 999) &&
                  Boolean(r.required_reviewer)
              );
              const blockedReviewer = previousRequiredReviewers.find((r) => r.review_status !== "approved");

              return (
                <div key={reviewer.id} style={trainingCardStyle}>
                  <div style={reviewerHeaderStyle}>
                    <div>
                      <strong>{reviewer.reviewer_email}</strong>
                      <div style={smallTextStyle}>
                        Sequence {reviewer.review_sequence || "N/A"} • {reviewer.reviewer_type} • {reviewer.reviewer_role || "No role"} • {reviewer.required_reviewer ? "Required" : "Optional"}
                      </div>
                    </div>
                    <StatusBadge status={reviewer.review_status || "pending"} />
                  </div>

                  {blockedReviewer ? (
                    <div style={warningBoxStyle}>Blocked until {blockedReviewer.reviewer_email} approves.</div>
                  ) : null}

                  {doc.file_url ? (
                    <a href={doc.file_url} target="_blank" rel="noreferrer" style={primaryLinkStyle}>
                      Open Document for Review
                    </a>
                  ) : (
                    <p style={smallTextStyle}>No document file is attached.</p>
                  )}

                  <textarea
                    placeholder="Review comments"
                    value={reviewComments[reviewer.id] || ""}
                    onChange={(e) => setReviewComments({ ...reviewComments, [reviewer.id]: e.target.value })}
                    rows={3}
                    style={textareaStyle}
                    disabled={!canCurrentUserReview || completed || Boolean(blockedReviewer)}
                  />

                  <div style={buttonRowStyle}>
                    {canCurrentUserReview && !completed ? (
                      <>
                        <button
                          onClick={() => reviewerDecision(reviewer, "approved")}
                          disabled={saving || Boolean(blockedReviewer)}
                          style={blockedReviewer ? disabledButtonStyle : primaryButtonStyle}
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => reviewerDecision(reviewer, "rejected")}
                          disabled={saving || Boolean(blockedReviewer)}
                          style={dangerButtonStyle}
                        >
                          Reject
                        </button>
                      </>
                    ) : (
                      <span style={smallTextStyle}>
                        {completed ? "Decision completed" : "Waiting for assigned reviewer"}
                      </span>
                    )}

                    {canManageWorkflow && !completed ? (
                      <button onClick={() => removeReviewer(reviewer)} disabled={saving} style={secondaryButtonStyle}>
                        Remove
                      </button>
                    ) : null}
                  </div>

                  {reviewer.review_comments ? (
                    <div style={commentBoxStyle}>
                      <strong>Comment:</strong> {reviewer.review_comments}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Workflow Actions</h2>
        <div style={actionStackStyle}>
          {doc.status === "draft" || doc.status === "rejected" ? (
            <details>
              <summary>Send to Collaboration</summary>
              <textarea
                value={collaborationReviewerEmails}
                onChange={(e) => setCollaborationReviewerEmails(e.target.value)}
                placeholder="Optional: reviewer emails separated by comma, semicolon, or new line"
                rows={3}
                style={textareaStyle}
                disabled={!canManageWorkflow || saving}
              />
              <button onClick={sendToCollaboration} disabled={!canManageWorkflow || saving} style={canManageWorkflow ? primaryButtonStyle : disabledButtonStyle}>
                Send Collaboration
              </button>
            </details>
          ) : null}

          {doc.status === "collaboration" ? (
            <button onClick={completeCollaboration} disabled={!canManageWorkflow || saving} style={canManageWorkflow ? primaryButtonStyle : disabledButtonStyle}>
              Complete Collaboration
            </button>
          ) : null}

          {doc.status === "draft" || doc.status === "collaboration" || doc.status === "rejected" ? (
            <details>
              <summary>Send to Formal Review</summary>
              <textarea
                value={formalReviewerEmails}
                onChange={(e) => setFormalReviewerEmails(e.target.value)}
                placeholder="Optional: formal reviewer / approver emails"
                rows={3}
                style={textareaStyle}
                disabled={!canManageWorkflow || saving}
              />
              <button onClick={sendToFormalReview} disabled={!canManageWorkflow || saving} style={canManageWorkflow ? primaryButtonStyle : disabledButtonStyle}>
                Send Formal Review
              </button>
            </details>
          ) : null}

          {doc.status === "formal_review" ? (
            <button onClick={approveDocument} disabled={!canApprove || saving} style={canApprove ? primaryButtonStyle : disabledButtonStyle}>
              Final Approve Document
            </button>
          ) : null}

          {doc.status === "formal_review" || doc.status === "collaboration" ? (
            <details>
              <summary>Reject Document</summary>
              <textarea
                value={rejectComments}
                onChange={(e) => setRejectComments(e.target.value)}
                placeholder="Rejection comments"
                rows={3}
                style={textareaStyle}
                disabled={!canApprove || saving}
              />
              <button onClick={rejectDocument} disabled={!canApprove || saving} style={canApprove ? dangerButtonStyle : disabledButtonStyle}>
                Reject Document
              </button>
            </details>
          ) : null}

          {doc.status === "approved" ? (
            <details>
              <summary>Make Effective / Release</summary>
              <textarea
                value={releaseComments}
                onChange={(e) => setReleaseComments(e.target.value)}
                placeholder="Release comments"
                rows={3}
                style={textareaStyle}
                disabled={!canApprove || saving}
              />
              <button onClick={makeEffective} disabled={!canApprove || saving} style={canApprove ? primaryButtonStyle : disabledButtonStyle}>
                Make Effective
              </button>
            </details>
          ) : null}

          {doc.status === "effective" && doc.read_ack_required ? (
            <button onClick={acknowledgeDocument} disabled={saving} style={primaryButtonStyle}>
              Read & Acknowledge
            </button>
          ) : null}

          {doc.training_required ? (
            <details>
              <summary>Assign Training</summary>
              <textarea
                value={trainingEmails}
                onChange={(e) => setTrainingEmails(e.target.value)}
                placeholder="Emails separated by comma, semicolon, or new line"
                rows={3}
                style={textareaStyle}
                disabled={!canManageWorkflow || saving}
              />
              <button onClick={assignTraining} disabled={!canManageWorkflow || saving} style={canManageWorkflow ? primaryButtonStyle : disabledButtonStyle}>
                Assign Training
              </button>
            </details>
          ) : null}

          {doc.status !== "obsolete" ? (
            <details>
              <summary>Obsolete</summary>
              <textarea
                value={obsoleteReason}
                onChange={(e) => setObsoleteReason(e.target.value)}
                placeholder="Obsolete reason"
                rows={3}
                style={textareaStyle}
                disabled={!canApprove || saving}
              />
              <button onClick={obsoleteDocument} disabled={!canApprove || saving} style={canApprove ? dangerButtonStyle : disabledButtonStyle}>
                Obsolete
              </button>
            </details>
          ) : null}
        </div>
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Review Records</h2>
        <h3>Collaboration Reviews</h3>
        {collaborationReviews.length === 0 ? (
          <p style={subtleText}>No collaboration review records.</p>
        ) : (
          <ul>
            {collaborationReviews.map((review) => (
              <li key={review.id}>
                {review.reviewer_email} — {review.review_status || "pending"}
              </li>
            ))}
          </ul>
        )}

        <h3>Formal Reviews</h3>
        {formalReviews.length === 0 ? (
          <p style={subtleText}>No formal review records.</p>
        ) : (
          <ul>
            {formalReviews.map((review) => (
              <li key={review.id}>
                {review.reviewer_email} — {review.review_status || "pending"}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Training Assignments</h2>
        <div style={smallTextStyle}>Total Assigned: {trainingCount()}</div>
        {trainingAssignments.length === 0 ? (
          <p style={subtleText}>No training assigned for this document.</p>
        ) : (
          <div style={{ display: "grid", gap: "10px", marginTop: "12px" }}>
            {trainingAssignments.map((item) => {
              const canCompleteTraining = normalizeEmail(item.user_email) === normalizeEmail(userEmail) || canManageWorkflow;
              return (
                <div key={item.id} style={trainingCardStyle}>
                  <strong>{item.user_email}</strong>
                  <div style={smallTextStyle}>Status: {item.status}</div>
                  {item.status !== "completed" ? (
                    <button onClick={() => completeTraining(item.id)} disabled={!canCompleteTraining || saving} style={canCompleteTraining ? primaryButtonStyle : disabledButtonStyle}>
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
        <h2 style={{ marginTop: 0 }}>Workflow Timeline / Audit Trail</h2>
        {workflowEvents.length === 0 ? (
          <p style={subtleText}>
            No workflow event records found. If this section stays empty, create the document_workflow_events table.
          </p>
        ) : (
          <div style={{ display: "grid", gap: "10px" }}>
            {workflowEvents.map((event) => (
              <div key={event.id} style={timelineItemStyle}>
                <strong>{event.event_type}</strong>
                <div style={smallTextStyle}>
                  {formatDateTime(event.performed_at)} • By {event.performed_by || "unknown"}
                </div>
                <div style={smallTextStyle}>
                  {event.from_status || "N/A"} → {event.to_status || "N/A"}
                </div>
                {event.comments ? <div style={commentBoxStyle}>{event.comments}</div> : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: "12px" }}>
      <label style={labelStyle}>{label}</label>
      <div style={{ marginTop: "5px" }}>{children}</div>
    </div>
  );
}

function KpiCard({ title, value, color }: { title: string; value: number | string; color: string }) {
  return (
    <div style={{ ...kpiCardStyle, borderLeft: `8px solid ${color}` }}>
      <div style={kpiTitleStyle}>{title}</div>
      <div style={{ fontSize: "30px", fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "effective" || status === "approved"
      ? "#15803d"
      : status === "formal_review" || status === "pending"
      ? "#d97706"
      : status === "collaboration"
      ? "#7c3aed"
      : status === "rejected"
      ? "#dc2626"
      : status === "obsolete" || status === "superseded"
      ? "#991b1b"
      : "#6b7280";

  return (
    <span style={{ background: color, color: "white", borderRadius: "999px", padding: "4px 10px", fontSize: "12px", fontWeight: 700 }}>
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

const pageStyle: CSSProperties = { padding: "24px", background: "#f8fafc", minHeight: "100vh", fontFamily: "Arial, sans-serif" };
const headerStyle: CSSProperties = { display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-start", flexWrap: "wrap", marginBottom: "20px" };
const eyebrowStyle: CSSProperties = { fontSize: "12px", letterSpacing: "0.08em", color: "#6b7280", fontWeight: 800 };
const subtleText: CSSProperties = { color: "#6b7280" };
const cardStyle: CSSProperties = { background: "white", border: "1px solid #d1d5db", borderRadius: "16px", padding: "20px", marginBottom: "20px" };
const gridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "14px" };
const kpiGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px", marginBottom: "20px" };
const kpiCardStyle: CSSProperties = { background: "white", border: "1px solid #d1d5db", borderRadius: "14px", padding: "16px" };
const kpiTitleStyle: CSSProperties = { color: "#6b7280", marginBottom: "8px" };
const labelStyle: CSSProperties = { fontWeight: 700 };
const inputStyle: CSSProperties = { width: "100%", padding: "9px", borderRadius: "8px", border: "1px solid #d1d5db" };
const textareaStyle: CSSProperties = { width: "100%", padding: "9px", borderRadius: "8px", border: "1px solid #d1d5db", marginTop: "6px" };
const primaryButtonStyle: CSSProperties = { background: "#2563eb", color: "white", border: "none", padding: "10px 14px", borderRadius: "8px", fontWeight: 700, cursor: "pointer", marginTop: "10px" };
const secondaryButtonStyle: CSSProperties = { background: "#4b5563", color: "white", border: "none", padding: "10px 14px", borderRadius: "8px", fontWeight: 700, cursor: "pointer" };
const dangerButtonStyle: CSSProperties = { background: "#dc2626", color: "white", border: "none", padding: "10px 14px", borderRadius: "8px", fontWeight: 700, cursor: "pointer", marginTop: "10px" };
const disabledButtonStyle: CSSProperties = { background: "#9ca3af", color: "white", border: "none", padding: "10px 14px", borderRadius: "8px", fontWeight: 700, cursor: "not-allowed", marginTop: "10px" };
const darkButtonStyle: CSSProperties = { background: "#111827", color: "white", padding: "10px 14px", borderRadius: "8px", textDecoration: "none", fontWeight: 700 };
const primaryLinkStyle: CSSProperties = { color: "#2563eb", fontWeight: 700, textDecoration: "underline", display: "inline-block", marginTop: "10px" };
const buttonRowStyle: CSSProperties = { display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center", marginTop: "12px" };
const actionStackStyle: CSSProperties = { display: "grid", gap: "12px" };
const smallTextStyle: CSSProperties = { fontSize: "12px", color: "#6b7280" };
const trainingCardStyle: CSSProperties = { border: "1px solid #d1d5db", borderRadius: "12px", padding: "14px", background: "#f9fafb" };
const reviewerHeaderStyle: CSSProperties = { display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "flex-start", flexWrap: "wrap" };
const warningBoxStyle: CSSProperties = { background: "#fffbeb", border: "1px solid #f59e0b", borderRadius: "10px", padding: "10px", marginTop: "10px", color: "#92400e" };
const commentBoxStyle: CSSProperties = { background: "#f3f4f6", borderRadius: "10px", padding: "10px", marginTop: "10px", color: "#374151" };
const timelineItemStyle: CSSProperties = { borderLeft: "4px solid #2563eb", padding: "10px 12px", background: "#f9fafb", borderRadius: "10px" };
