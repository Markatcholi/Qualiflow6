export type MatrixRequirement = {
  id?: string; role_name: string | null; department: string | null;
  document_number: string | null; required_training: boolean | null;
};
export type TrainingEmployee = {
  user_email: string; role_name: string | null; department: string | null;
  active: boolean | null;
};
export const normalizeTrainingValue = (value: string | null | undefined) => (value || "").trim().toLowerCase();
export function matchesTrainingRequirement(row: MatrixRequirement, employee: TrainingEmployee) {
  return employee.active === true && row.required_training === true &&
    (!normalizeTrainingValue(row.department) || normalizeTrainingValue(row.department) === normalizeTrainingValue(employee.department)) &&
    (!normalizeTrainingValue(row.role_name) || normalizeTrainingValue(row.role_name) === normalizeTrainingValue(employee.role_name));
}
export function trainingAudienceMatches(rows: MatrixRequirement[], documentNumber: string, employee: TrainingEmployee) {
  return rows.some(row => normalizeTrainingValue(row.document_number) === normalizeTrainingValue(documentNumber) && matchesTrainingRequirement(row, employee));
}
export function trainingAssignmentState(assignments: {document_id: string | null; assigned_to_email: string; status: string | null; source_document_revision?: string | null}[], documentId: string, revision: string, email: string) {
  const existing = assignments.filter(a => a.document_id === documentId &&
    normalizeTrainingValue(a.assigned_to_email) === normalizeTrainingValue(email) &&
    (!a.source_document_revision || a.source_document_revision === revision) &&
    !["cancelled", "withdrawn"].includes(a.status || ""));
  if (existing.some(a => ["completed", "effectiveness_complete", "waived"].includes(a.status || ""))) return "Completed / waived";
  return existing.length ? "Already assigned" : "Needs assignment";
}
export function trainingEvidenceMode(assignment: {training_category?: string | null; recurring_evidence_mode?: string | null}) {
  return assignment.training_category === "certification" ? "attachment" :
    assignment.recurring_evidence_mode || (assignment.training_category === "recurring" ? "attachment" : "signature");
}

export type TrainingAudience = { department: string; roles: string[]; allRoles: boolean };
export function buildTrainingAudienceTargets(allEmployees: boolean, audiences: TrainingAudience[]) {
  if (allEmployees) return [{department:null,role_name:null}];
  if (!audiences.length) throw new Error("Add at least one department, or select All employees.");
  return audiences.flatMap(a => {
    const department = a.department.trim() || null;
    if (a.allRoles) return [{department,role_name:null}];
    const roles = Array.from(new Map(a.roles.map(r=>r.trim()).filter(Boolean).map(r=>[normalizeTrainingValue(r),r])).values());
    if (!roles.length) throw new Error(`Add at least one role for ${department || "all departments"}, or choose All roles.`);
    return roles.map(role_name=>({department,role_name}));
  });
}
