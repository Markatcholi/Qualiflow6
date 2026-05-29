export type DocumentStatus =
  | "draft"
  | "collaboration"
  | "formal_review"
  | "approved"
  | "effective"
  | "rejected"
  | "obsolete"
  | "superseded";

export type ReviewerType =
  | "collaboration"
  | "formal_review"
  | "approver";

export type ReviewerStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "not_required";

export type UserRole =
  | "admin"
  | "approver"
  | "vp_quality"
  | "document_control"
  | "quality"
  | "user"
  | string;

export type WorkflowDocument = {
  id: string;
  status: string;
  document_type?: string | null;
  department?: string | null;
  process_area?: string | null;
  owner_email?: string | null;
  approver_email?: string | null;
  collaboration_required?: boolean | null;
  formal_review_required?: boolean | null;
  collaboration_completed?: boolean | null;
  formal_review_completed?: boolean | null;
  file_url?: string | null;
  read_ack_required?: boolean | null;
  training_required?: boolean | null;
};

export type WorkflowReviewer = {
  id: string;
  document_id: string;
  reviewer_type: string;
  reviewer_email: string;
  reviewer_role?: string | null;
  required_reviewer?: boolean | null;
  review_sequence?: number | null;
  review_status?: string | null;
  reviewed_at?: string | null;
  due_date?: string | null;
  sla_days?: number | null;
};

export type WorkflowState = {
  currentStatus: string;
  currentStepLabel: string;
  nextPendingReviewer: WorkflowReviewer | null;
  pendingRequiredReviewers: WorkflowReviewer[];
  collaborationPending: boolean;
  formalReviewPending: boolean;
  approvalPending: boolean;
  canCompleteCollaboration: boolean;
  canFinalApprove: boolean;
  blockedReason: string | null;
  workflowPercentComplete: number;
};

export type TransitionName =
  | "send_to_collaboration"
  | "complete_collaboration"
  | "send_to_formal_review"
  | "final_approve"
  | "make_effective"
  | "reject"
  | "obsolete"
  | "acknowledge"
  | "assign_training";

export function normalizeEmail(value: string | null | undefined) {
  const text = String(value || "").trim().toLowerCase();
  if (!text || !text.includes("@")) return "";
  return text;
}

export function isApproverRole(role: UserRole) {
  return role === "admin" || role === "approver" || role === "vp_quality";
}

export function isManagementRole(role: UserRole) {
  return (
    isApproverRole(role) ||
    role === "document_control" ||
    role === "quality"
  );
}

export function isDocumentOwner(
  doc: WorkflowDocument | null | undefined,
  userEmail: string | null | undefined
) {
  return (
    normalizeEmail(doc?.owner_email) !== "" &&
    normalizeEmail(doc?.owner_email) === normalizeEmail(userEmail)
  );
}

export function canManageWorkflow(
  doc: WorkflowDocument | null | undefined,
  userEmail: string | null | undefined,
  userRole: UserRole
) {
  return isManagementRole(userRole) || isDocumentOwner(doc, userEmail);
}

export function getRequiredReviewers(
  reviewers: WorkflowReviewer[],
  reviewerType?: ReviewerType
) {
  return reviewers.filter((reviewer) => {
    const required = reviewer.required_reviewer !== false;
    const typeMatches = reviewerType
      ? reviewer.reviewer_type === reviewerType
      : true;

    return required && typeMatches;
  });
}

export function getPendingRequiredReviewers(
  reviewers: WorkflowReviewer[],
  reviewerType?: ReviewerType
) {
  return getRequiredReviewers(reviewers, reviewerType).filter(
    (reviewer) => reviewer.review_status !== "approved"
  );
}

export function getNextPendingReviewer(reviewers: WorkflowReviewer[]) {
  const pending = reviewers
    .filter((reviewer) => reviewer.review_status !== "approved")
    .sort(
      (a, b) =>
        Number(a.review_sequence || 9999) -
        Number(b.review_sequence || 9999)
    );

  return pending[0] || null;
}

export function hasPriorRequiredReviewerOpen(
  reviewer: WorkflowReviewer,
  reviewers: WorkflowReviewer[]
) {
  return reviewers.some(
    (item) =>
      Number(item.review_sequence || 0) <
        Number(reviewer.review_sequence || 0) &&
      item.required_reviewer !== false &&
      item.review_status !== "approved"
  );
}

export function canUserActOnReviewer(
  reviewer: WorkflowReviewer,
  userEmail: string | null | undefined
) {
  return normalizeEmail(reviewer.reviewer_email) === normalizeEmail(userEmail);
}

export function getWorkflowState(
  doc: WorkflowDocument,
  reviewers: WorkflowReviewer[]
): WorkflowState {
  const pendingRequiredReviewers = getPendingRequiredReviewers(reviewers);
  const pendingCollaboration = getPendingRequiredReviewers(
    reviewers,
    "collaboration"
  );
  const pendingFormal = getPendingRequiredReviewers(
    reviewers,
    "formal_review"
  );
  const pendingApprovers = getPendingRequiredReviewers(
    reviewers,
    "approver"
  );

  const nextPendingReviewer = getNextPendingReviewer(reviewers);

  const collaborationPending = pendingCollaboration.length > 0;
  const formalReviewPending = pendingFormal.length > 0;
  const approvalPending = pendingApprovers.length > 0;

  const canCompleteCollaboration =
    doc.status === "collaboration" && !collaborationPending;

  const canFinalApprove =
    doc.status === "formal_review" &&
    !formalReviewPending &&
    !approvalPending;

  let currentStepLabel = "Draft";
  let blockedReason: string | null = null;
  let workflowPercentComplete = 10;

  if (doc.status === "draft") {
    currentStepLabel = "Draft / Authoring";
    workflowPercentComplete = 10;
  }

  if (doc.status === "collaboration") {
    currentStepLabel = collaborationPending
      ? "Collaboration Review Pending"
      : "Collaboration Ready to Complete";
    workflowPercentComplete = collaborationPending ? 35 : 45;

    if (collaborationPending) {
      blockedReason = "Required collaboration reviewers are still pending.";
    }
  }

  if (doc.status === "formal_review") {
    currentStepLabel =
      formalReviewPending || approvalPending
        ? "Formal Review / Approval Pending"
        : "Ready for Final Approval";
    workflowPercentComplete =
      formalReviewPending || approvalPending ? 65 : 80;

    if (formalReviewPending) {
      blockedReason = "Required formal reviewers are still pending.";
    } else if (approvalPending) {
      blockedReason = "Required approvers are still pending.";
    }
  }

  if (doc.status === "approved") {
    currentStepLabel = "Approved / Pending Release";
    workflowPercentComplete = 90;
  }

  if (doc.status === "effective") {
    currentStepLabel = "Effective / Released";
    workflowPercentComplete = 100;
  }

  if (doc.status === "rejected") {
    currentStepLabel = "Rejected / Returned to Owner";
    workflowPercentComplete = 25;
    blockedReason = "Document was rejected and requires owner update.";
  }

  if (doc.status === "obsolete") {
    currentStepLabel = "Obsolete";
    workflowPercentComplete = 100;
  }

  if (doc.status === "superseded") {
    currentStepLabel = "Superseded";
    workflowPercentComplete = 100;
  }

  return {
    currentStatus: doc.status,
    currentStepLabel,
    nextPendingReviewer,
    pendingRequiredReviewers,
    collaborationPending,
    formalReviewPending,
    approvalPending,
    canCompleteCollaboration,
    canFinalApprove,
    blockedReason,
    workflowPercentComplete,
  };
}

export function canTransition({
  transition,
  doc,
  reviewers,
  userEmail,
  userRole,
}: {
  transition: TransitionName;
  doc: WorkflowDocument;
  reviewers: WorkflowReviewer[];
  userEmail: string;
  userRole: UserRole;
}) {
  const state = getWorkflowState(doc, reviewers);
  const manager = canManageWorkflow(doc, userEmail, userRole);
  const approver = isApproverRole(userRole);

  if (transition === "send_to_collaboration") {
    return {
      allowed:
        manager &&
        (doc.status === "draft" || doc.status === "rejected"),
      reason:
        manager
          ? null
          : "Only the document owner or authorized workflow users can send to collaboration.",
    };
  }

  if (transition === "complete_collaboration") {
    return {
      allowed: manager && state.canCompleteCollaboration,
      reason:
        state.blockedReason ||
        "Only authorized workflow users can complete collaboration.",
    };
  }

  if (transition === "send_to_formal_review") {
    const statusAllowed =
      doc.status === "draft" ||
      doc.status === "collaboration" ||
      doc.status === "rejected";

    const collaborationSatisfied =
      !doc.collaboration_required ||
      doc.collaboration_completed ||
      doc.status === "draft";

    return {
      allowed: manager && statusAllowed && collaborationSatisfied,
      reason: !manager
        ? "Only authorized workflow users can send to formal review."
        : !statusAllowed
        ? "Document status does not allow formal review submission."
        : !collaborationSatisfied
        ? "Collaboration must be completed before formal review."
        : null,
    };
  }

  if (transition === "final_approve") {
    return {
      allowed: approver && state.canFinalApprove,
      reason: !approver
        ? "Only approvers, admins, or VP Quality can approve."
        : state.blockedReason,
    };
  }

  if (transition === "make_effective") {
    return {
      allowed: approver && doc.status === "approved",
      reason: !approver
        ? "Only approvers, admins, or VP Quality can make documents effective."
        : doc.status !== "approved"
        ? "Only approved documents can be made effective."
        : null,
    };
  }

  if (transition === "reject") {
    return {
      allowed:
        manager &&
        (doc.status === "collaboration" ||
          doc.status === "formal_review"),
      reason: !manager
        ? "Only authorized workflow users can reject documents."
        : "Only collaboration or formal review documents can be rejected.",
    };
  }

  if (transition === "obsolete") {
    return {
      allowed: approver && doc.status !== "obsolete",
      reason: !approver
        ? "Only approvers, admins, or VP Quality can obsolete documents."
        : null,
    };
  }

  if (transition === "acknowledge") {
    return {
      allowed:
        doc.status === "effective" &&
        Boolean(doc.read_ack_required) &&
        Boolean(doc.file_url),
      reason: !doc.file_url
        ? "No document file is attached for acknowledgement."
        : null,
    };
  }

  if (transition === "assign_training") {
    return {
      allowed:
        isManagementRole(userRole) &&
        Boolean(doc.training_required) &&
        Boolean(doc.file_url),
      reason: !doc.file_url
        ? "Cannot assign training because no document file is attached."
        : !isManagementRole(userRole)
        ? "Only document control, quality, or approvers can assign training."
        : null,
    };
  }

  return {
    allowed: false,
    reason: "Unsupported workflow transition.",
  };
}

export function addBusinessDays(date: Date, days: number) {
  const result = new Date(date);
  let remaining = days;

  while (remaining > 0) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();

    if (day !== 0 && day !== 6) {
      remaining -= 1;
    }
  }

  return result;
}

export function calculateDueDate(
  assignedAt: string | null | undefined,
  slaDays: number | null | undefined
) {
  const start = assignedAt ? new Date(assignedAt) : new Date();
  return addBusinessDays(start, Number(slaDays || 5)).toISOString();
}

export function getDaysOpen(startDate: string | null | undefined) {
  if (!startDate) return 0;

  const start = new Date(startDate).getTime();
  const now = new Date().getTime();

  if (Number.isNaN(start)) return 0;

  return Math.max(
    0,
    Math.floor((now - start) / (1000 * 60 * 60 * 24))
  );
}

export function isOverdue(dueDate: string | null | undefined) {
  if (!dueDate) return false;
  return new Date(dueDate).getTime() < new Date().getTime();
}

export function getSlaLabel(reviewer: WorkflowReviewer) {
  if (reviewer.review_status === "approved") return "Completed";
  if (reviewer.review_status === "rejected") return "Rejected";
  if (!reviewer.due_date) return "No due date";
  if (isOverdue(reviewer.due_date)) return "Overdue";
  return "On track";
}

export function getRecommendedWorkflowByDocumentType(
  documentType: string | null | undefined
) {
  const type = String(documentType || "").toLowerCase();

  if (type === "sop") {
    return {
      collaborationRequired: true,
      formalReviewRequired: true,
      recommendedTemplateName: "SOP Workflow",
      recommendedReviewerTypes: [
        "collaboration",
        "formal_review",
        "approver",
      ],
    };
  }

  if (type === "form" || type === "template") {
    return {
      collaborationRequired: false,
      formalReviewRequired: true,
      recommendedTemplateName: "Form / Template Workflow",
      recommendedReviewerTypes: ["formal_review", "approver"],
    };
  }

  if (type === "policy") {
    return {
      collaborationRequired: true,
      formalReviewRequired: true,
      recommendedTemplateName: "Policy Workflow",
      recommendedReviewerTypes: [
        "collaboration",
        "formal_review",
        "approver",
      ],
    };
  }

  if (type === "protocol" || type === "report") {
    return {
      collaborationRequired: true,
      formalReviewRequired: true,
      recommendedTemplateName: "Protocol / Report Workflow",
      recommendedReviewerTypes: [
        "collaboration",
        "formal_review",
        "approver",
      ],
    };
  }

  return {
    collaborationRequired: true,
    formalReviewRequired: true,
    recommendedTemplateName: "Standard Document Workflow",
    recommendedReviewerTypes: [
      "collaboration",
      "formal_review",
      "approver",
    ],
  };
}
