import {
  calculateDueDate,
  normalizeEmail,
} from "./documentWorkflowEngine";

export type ApprovalMatrixTemplate = {
  id: string;
  template_name: string;
  description?: string | null;
  document_type?: string | null;
  department?: string | null;
  process_area?: string | null;
  workflow_type?: string | null;
  auto_apply?: boolean | null;
  active?: boolean | null;
};

export type ApprovalMatrixReviewer = {
  id?: string;
  template_id: string;
  reviewer_type: string;
  reviewer_email: string;
  reviewer_role?: string | null;
  required_reviewer?: boolean | null;
  sequence_order?: number | null;
  sla_days?: number | null;
  escalation_role?: string | null;
  escalation_email?: string | null;
};

export type WorkflowDocument = {
  id: string;
  document_type?: string | null;
  department?: string | null;
  process_area?: string | null;
};

export type AssignedReviewer = {
  reviewer_email: string;
  reviewer_type: string;
};

export function templateMatchesDocument(
  template: ApprovalMatrixTemplate,
  doc: WorkflowDocument
) {
  const docTypeMatch =
    !template.document_type ||
    template.document_type === doc.document_type;

  const departmentMatch =
    !template.department ||
    template.department === doc.department;

  const processMatch =
    !template.process_area ||
    template.process_area === doc.process_area;

  return docTypeMatch && departmentMatch && processMatch;
}

export function getMatchingTemplates(
  templates: ApprovalMatrixTemplate[],
  doc: WorkflowDocument
) {
  return templates.filter((template) =>
    templateMatchesDocument(template, doc)
  );
}

export function getRecommendedTemplate(
  templates: ApprovalMatrixTemplate[],
  doc: WorkflowDocument
) {
  const matches = getMatchingTemplates(templates, doc);

  if (matches.length === 0) return null;

  const exactMatch = matches.find(
    (template) =>
      template.document_type === doc.document_type &&
      template.department === doc.department &&
      template.process_area === doc.process_area
  );

  return exactMatch || matches[0];
}

export function getAutoApplyTemplate(
  templates: ApprovalMatrixTemplate[],
  doc: WorkflowDocument
) {
  const matches = getMatchingTemplates(templates, doc);

  const autoTemplates = matches.filter(
    (template) => template.auto_apply === true
  );

  if (autoTemplates.length === 1) {
    return autoTemplates[0];
  }

  return null;
}

export function reviewerAlreadyAssigned(
  assignedReviewers: AssignedReviewer[],
  reviewerEmail: string,
  reviewerType: string
) {
  const email = normalizeEmail(reviewerEmail);

  return assignedReviewers.some(
    (reviewer) =>
      normalizeEmail(reviewer.reviewer_email) === email &&
      reviewer.reviewer_type === reviewerType
  );
}

export function buildReviewerAssignments(
  templateReviewers: ApprovalMatrixReviewer[],
  documentId: string,
  assignedBy: string,
  existingReviewers: AssignedReviewer[]
) {
  const now = new Date().toISOString();

  const assignments = [];

  for (const reviewer of templateReviewers) {
    const reviewerEmail = normalizeEmail(
      reviewer.reviewer_email
    );

    if (!reviewerEmail) continue;

    if (
      reviewerAlreadyAssigned(
        existingReviewers,
        reviewerEmail,
        reviewer.reviewer_type
      )
    ) {
      continue;
    }

    const slaDays = Number(reviewer.sla_days || 5);

    assignments.push({
      document_id: documentId,
      reviewer_type: reviewer.reviewer_type,
      reviewer_email: reviewerEmail,
      reviewer_role: reviewer.reviewer_role || null,
      required_reviewer:
        reviewer.required_reviewer !== false,
      review_sequence:
        reviewer.sequence_order || 1,
      review_status: "pending",
      assigned_by: assignedBy,
      assigned_at: now,
      sla_days: slaDays,
      due_date: calculateDueDate(now, slaDays),
      escalation_role:
        reviewer.escalation_role || null,
      escalation_email:
        reviewer.escalation_email || null,
    });
  }

  return assignments;
}

export function getTemplateDisplayName(
  template: ApprovalMatrixTemplate
) {
  return (
    template.template_name ||
    "Unnamed Approval Matrix"
  );
}

export function getTemplateDescription(
  template: ApprovalMatrixTemplate
) {
  const pieces = [];

  if (template.document_type)
    pieces.push(`Type: ${template.document_type}`);

  if (template.department)
    pieces.push(`Dept: ${template.department}`);

  if (template.process_area)
    pieces.push(`Process: ${template.process_area}`);

  return pieces.join(" | ");
}

export function calculateTemplateCoverage(
  template: ApprovalMatrixTemplate,
  doc: WorkflowDocument
) {
  let score = 0;

  if (
    template.document_type &&
    template.document_type === doc.document_type
  ) {
    score += 40;
  }

  if (
    template.department &&
    template.department === doc.department
  ) {
    score += 30;
  }

  if (
    template.process_area &&
    template.process_area === doc.process_area
  ) {
    score += 30;
  }

  return score;
}

export function sortTemplatesByBestMatch(
  templates: ApprovalMatrixTemplate[],
  doc: WorkflowDocument
) {
  return [...templates].sort(
    (a, b) =>
      calculateTemplateCoverage(b, doc) -
      calculateTemplateCoverage(a, doc)
  );
}

export function getTemplateStatistics(
  templateReviewers: ApprovalMatrixReviewer[]
) {
  return {
    totalReviewers: templateReviewers.length,
    collaborationReviewers:
      templateReviewers.filter(
        (r) => r.reviewer_type === "collaboration"
      ).length,
    formalReviewers:
      templateReviewers.filter(
        (r) => r.reviewer_type === "formal_review"
      ).length,
    approvers:
      templateReviewers.filter(
        (r) => r.reviewer_type === "approver"
      ).length,
    requiredReviewers:
      templateReviewers.filter(
        (r) => r.required_reviewer !== false
      ).length,
  };
}
