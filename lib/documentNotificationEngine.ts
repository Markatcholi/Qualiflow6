export type NotificationSeverity =
  | "info"
  | "warning"
  | "critical"
  | "success";

export type NotificationType =
  | "review_assignment"
  | "review_due"
  | "review_overdue"
  | "review_escalation"
  | "training_assignment"
  | "training_due"
  | "training_overdue"
  | "workflow_update"
  | "document_released"
  | "document_rejected";

export type NotificationRecord = {
  user_email: string;
  assigned_role?: string | null;
  notification_type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  message: string;
  related_module?: string | null;
  related_record_id?: string | null;
};

export function createReviewAssignmentNotification({
  reviewerEmail,
  documentNumber,
  revision,
  dueDate,
}: {
  reviewerEmail: string;
  documentNumber: string;
  revision: string;
  dueDate?: string | null;
}): NotificationRecord {
  return {
    user_email: reviewerEmail,
    notification_type: "review_assignment",
    severity: "info",
    title: "Document Review Assigned",
    message: `You have been assigned to review ${documentNumber} Rev ${revision}${dueDate ? `. Due ${dueDate}.` : "."}`,
    related_module: "documents",
  };
}

export function createReviewDueNotification({
  reviewerEmail,
  documentNumber,
  revision,
}: {
  reviewerEmail: string;
  documentNumber: string;
  revision: string;
}): NotificationRecord {
  return {
    user_email: reviewerEmail,
    notification_type: "review_due",
    severity: "warning",
    title: "Review Due Soon",
    message: `${documentNumber} Rev ${revision} review is approaching its due date.`,
    related_module: "documents",
  };
}

export function createReviewOverdueNotification({
  reviewerEmail,
  documentNumber,
  revision,
}: {
  reviewerEmail: string;
  documentNumber: string;
  revision: string;
}): NotificationRecord {
  return {
    user_email: reviewerEmail,
    notification_type: "review_overdue",
    severity: "critical",
    title: "Review Overdue",
    message: `${documentNumber} Rev ${revision} review is overdue.`,
    related_module: "documents",
  };
}

export function createEscalationNotification({
  escalationEmail,
  reviewerEmail,
  documentNumber,
}: {
  escalationEmail: string;
  reviewerEmail: string;
  documentNumber: string;
}): NotificationRecord {
  return {
    user_email: escalationEmail,
    notification_type: "review_escalation",
    severity: "critical",
    title: "Review Escalation",
    message: `${reviewerEmail} has an overdue review for ${documentNumber}.`,
    related_module: "documents",
  };
}

export function createTrainingAssignmentNotification({
  userEmail,
  documentNumber,
  revision,
}: {
  userEmail: string;
  documentNumber: string;
  revision: string;
}): NotificationRecord {
  return {
    user_email: userEmail,
    notification_type: "training_assignment",
    severity: "info",
    title: "Training Assigned",
    message: `Training assigned for ${documentNumber} Rev ${revision}.`,
    related_module: "training",
  };
}

export function createTrainingOverdueNotification({
  userEmail,
  documentNumber,
}: {
  userEmail: string;
  documentNumber: string;
}): NotificationRecord {
  return {
    user_email: userEmail,
    notification_type: "training_overdue",
    severity: "critical",
    title: "Training Overdue",
    message: `Training for ${documentNumber} is overdue.`,
    related_module: "training",
  };
}

export function createDocumentReleasedNotification({
  userEmail,
  documentNumber,
  revision,
}: {
  userEmail: string;
  documentNumber: string;
  revision: string;
}): NotificationRecord {
  return {
    user_email: userEmail,
    notification_type: "document_released",
    severity: "success",
    title: "Document Released",
    message: `${documentNumber} Rev ${revision} is now effective.`,
    related_module: "documents",
  };
}

export function createDocumentRejectedNotification({
  userEmail,
  documentNumber,
}: {
  userEmail: string;
  documentNumber: string;
}): NotificationRecord {
  return {
    user_email: userEmail,
    notification_type: "document_rejected",
    severity: "warning",
    title: "Document Rejected",
    message: `${documentNumber} was rejected and returned for revision.`,
    related_module: "documents",
  };
}

export function createWorkflowUpdateNotification({
  userEmail,
  title,
  message,
}: {
  userEmail: string;
  title: string;
  message: string;
}): NotificationRecord {
  return {
    user_email: userEmail,
    notification_type: "workflow_update",
    severity: "info",
    title,
    message,
    related_module: "documents",
  };
}
