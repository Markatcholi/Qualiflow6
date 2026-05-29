// /lib/documentRoutingEngine.ts

import {
  ApprovalMatrixReviewer,
  ApprovalMatrixTemplate,
  AssignedReviewer,
  buildReviewerAssignments,
  calculateTemplateCoverage,
  getAutoApplyTemplate,
  getMatchingTemplates,
  getRecommendedTemplate,
  sortTemplatesByBestMatch,
} from "./documentTemplateEngine";

export type RoutingDocument = {
  id: string;
  document_number?: string | null;
  title?: string | null;
  document_type?: string | null;
  department?: string | null;
  process_area?: string | null;
  status?: string | null;
};

export type WorkflowRouteRecommendation = {
  recommendedTemplate: ApprovalMatrixTemplate | null;
  autoApplyTemplate: ApprovalMatrixTemplate | null;
  matchingTemplates: ApprovalMatrixTemplate[];
  bestMatchTemplates: ApprovalMatrixTemplate[];
  routingConfidence: "high" | "medium" | "low" | "none";
  routingReason: string;
};

export type WorkflowPreview = {
  templateName: string;
  documentType: string;
  department: string;
  processArea: string;
  totalReviewers: number;
  collaborationReviewers: number;
  formalReviewers: number;
  approvers: number;
  requiredReviewers: number;
  estimatedDurationDays: number;
  reviewerSummary: string[];
};

export type EscalationPath = {
  reviewerEmail: string;
  reviewerType: string;
  escalationRole: string | null;
  escalationEmail: string | null;
  escalationMessage: string;
};

export function getWorkflowRouteRecommendation({
  doc,
  templates,
}: {
  doc: RoutingDocument;
  templates: ApprovalMatrixTemplate[];
}): WorkflowRouteRecommendation {
  const matchingTemplates = getMatchingTemplates(templates, doc);
  const bestMatchTemplates = sortTemplatesByBestMatch(matchingTemplates, doc);
  const recommendedTemplate = getRecommendedTemplate(templates, doc);
  const autoApplyTemplate = getAutoApplyTemplate(templates, doc);

  let routingConfidence: WorkflowRouteRecommendation["routingConfidence"] =
    "none";

  let routingReason = "No matching workflow template was found.";

  if (autoApplyTemplate) {
    routingConfidence = "high";
    routingReason =
      "One auto-apply workflow template matches this document.";
  } else if (bestMatchTemplates.length > 0) {
    const bestScore = calculateTemplateCoverage(
      bestMatchTemplates[0],
      doc
    );

    if (bestScore >= 70) {
      routingConfidence = "high";
      routingReason =
        "A strong workflow template match was found based on document attributes.";
    } else if (bestScore >= 40) {
      routingConfidence = "medium";
      routingReason =
        "A partial workflow template match was found.";
    } else {
      routingConfidence = "low";
      routingReason =
        "Only a generic workflow template match was found.";
    }
  }

  return {
    recommendedTemplate,
    autoApplyTemplate,
    matchingTemplates,
    bestMatchTemplates,
    routingConfidence,
    routingReason,
  };
}

export function shouldAutoApplyTemplate({
  doc,
  templates,
  existingReviewers,
}: {
  doc: RoutingDocument;
  templates: ApprovalMatrixTemplate[];
  existingReviewers: AssignedReviewer[];
}) {
  const autoApplyTemplate = getAutoApplyTemplate(templates, doc);

  if (!autoApplyTemplate) {
    return {
      shouldAutoApply: false,
      template: null,
      reason: "No single auto-apply template matched this document.",
    };
  }

  if (existingReviewers.length > 0) {
    return {
      shouldAutoApply: false,
      template: autoApplyTemplate,
      reason:
        "Reviewers already exist for this document, so auto-apply was skipped to prevent duplicate routing.",
    };
  }

  return {
    shouldAutoApply: true,
    template: autoApplyTemplate,
    reason:
      "Auto-apply template matched and no reviewers are currently assigned.",
  };
}

export function buildAutoRouteAssignments({
  templateReviewers,
  doc,
  assignedBy,
  existingReviewers,
}: {
  templateReviewers: ApprovalMatrixReviewer[];
  doc: RoutingDocument;
  assignedBy: string;
  existingReviewers: AssignedReviewer[];
}) {
  return buildReviewerAssignments(
    templateReviewers,
    doc.id,
    assignedBy,
    existingReviewers
  );
}

export function generateWorkflowPreview({
  template,
  templateReviewers,
  doc,
}: {
  template: ApprovalMatrixTemplate;
  templateReviewers: ApprovalMatrixReviewer[];
  doc: RoutingDocument;
}): WorkflowPreview {
  const collaborationReviewers = templateReviewers.filter(
    (reviewer) => reviewer.reviewer_type === "collaboration"
  );

  const formalReviewers = templateReviewers.filter(
    (reviewer) => reviewer.reviewer_type === "formal_review"
  );

  const approvers = templateReviewers.filter(
    (reviewer) => reviewer.reviewer_type === "approver"
  );

  const requiredReviewers = templateReviewers.filter(
    (reviewer) => reviewer.required_reviewer !== false
  );

  const estimatedDurationDays = templateReviewers.reduce(
    (total, reviewer) => total + Number(reviewer.sla_days || 5),
    0
  );

  const reviewerSummary = [...templateReviewers]
    .sort(
      (a, b) =>
        Number(a.sequence_order || 9999) -
        Number(b.sequence_order || 9999)
    )
    .map((reviewer) => {
      const role = reviewer.reviewer_role || reviewer.reviewer_type;
      const required =
        reviewer.required_reviewer === false ? "Optional" : "Required";
      const sla = Number(reviewer.sla_days || 5);

      return `${reviewer.reviewer_email} — ${role} — ${required} — SLA ${sla} day(s)`;
    });

  return {
    templateName: template.template_name || "Unnamed Workflow Template",
    documentType: doc.document_type || "Any",
    department: doc.department || "Any",
    processArea: doc.process_area || "Any",
    totalReviewers: templateReviewers.length,
    collaborationReviewers: collaborationReviewers.length,
    formalReviewers: formalReviewers.length,
    approvers: approvers.length,
    requiredReviewers: requiredReviewers.length,
    estimatedDurationDays,
    reviewerSummary,
  };
}

export function getEscalationPath(
  templateReviewers: ApprovalMatrixReviewer[]
): EscalationPath[] {
  return templateReviewers.map((reviewer) => {
    const escalationRole = reviewer.escalation_role || null;
    const escalationEmail = reviewer.escalation_email || null;

    return {
      reviewerEmail: reviewer.reviewer_email,
      reviewerType: reviewer.reviewer_type,
      escalationRole,
      escalationEmail,
      escalationMessage: escalationEmail
        ? `Escalate overdue ${reviewer.reviewer_type} task for ${reviewer.reviewer_email} to ${escalationEmail}.`
        : escalationRole
        ? `Escalate overdue ${reviewer.reviewer_type} task for ${reviewer.reviewer_email} to ${escalationRole}.`
        : `No escalation path configured for ${reviewer.reviewer_email}.`,
    };
  });
}

export function getRoutingSummaryText(
  recommendation: WorkflowRouteRecommendation
) {
  if (!recommendation.recommendedTemplate) {
    return "No recommended workflow template is available for this document.";
  }

  const autoApplyText = recommendation.autoApplyTemplate
    ? "Auto-apply is available."
    : "Manual template application is required.";

  return `${recommendation.routingReason} Recommended template: ${recommendation.recommendedTemplate.template_name}. ${autoApplyText}`;
}

export function getWorkflowTypeLabel(workflowType: string | null | undefined) {
  if (!workflowType) return "Document Control";

  return workflowType
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function canTemplateRouteDocument({
  template,
  doc,
}: {
  template: ApprovalMatrixTemplate;
  doc: RoutingDocument;
}) {
  const documentTypeOk =
    !template.document_type ||
    template.document_type === doc.document_type;

  const departmentOk =
    !template.department ||
    template.department === doc.department;

  const processAreaOk =
    !template.process_area ||
    template.process_area === doc.process_area;

  return documentTypeOk && departmentOk && processAreaOk;
}

export function getTemplateRouteWarning({
  template,
  doc,
}: {
  template: ApprovalMatrixTemplate;
  doc: RoutingDocument;
}) {
  if (canTemplateRouteDocument({ template, doc })) {
    return null;
  }

  return "This template does not fully match the document type, department, or process area.";
}

export function summarizeTemplateRoute({
  template,
  doc,
}: {
  template: ApprovalMatrixTemplate;
  doc: RoutingDocument;
}) {
  const parts = [];

  parts.push(`Template: ${template.template_name}`);

  if (template.document_type) {
    parts.push(`Document Type: ${template.document_type}`);
  } else {
    parts.push("Document Type: Any");
  }

  if (template.department) {
    parts.push(`Department: ${template.department}`);
  } else {
    parts.push("Department: Any");
  }

  if (template.process_area) {
    parts.push(`Process Area: ${template.process_area}`);
  } else {
    parts.push("Process Area: Any");
  }

  parts.push(
    `Match Score: ${calculateTemplateCoverage(template, doc)}%`
  );

  return parts.join(" | ");
}
