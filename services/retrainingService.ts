import { supabase } from "../lib/supabaseClient";

export async function processRetrainingForDocument(
  documentId: string,
  documentNumber: string,
  revision: string,
  assignedBy: string
) {
  if (!documentId) {
    throw new Error("Document ID is required.");
  }

  const { data: existingAssignments, error: assignmentError } =
    await supabase
      .from("training_assignments")
      .select("*")
      .eq("document_id", documentId);

  if (assignmentError) {
    throw new Error(assignmentError.message);
  }

  const completedUsers =
    existingAssignments?.filter(
      (a) =>
        a.status === "completed" ||
        a.status === "effectiveness_complete"
    ) || [];

  let created = 0;
  let skipped = 0;

  for (const previousAssignment of completedUsers) {
    const existingRetraining = await supabase
      .from("training_assignments")
      .select("id")
      .eq("document_id", documentId)
      .eq(
        "assigned_to_email",
        previousAssignment.assigned_to_email
      )
      .eq("retraining_assignment", true)
      .eq("source_document_revision", revision)
      .maybeSingle();

    if (existingRetraining.data) {
      skipped++;
      continue;
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14);

    const { error } = await supabase
      .from("training_assignments")
      .insert({
        document_id: documentId,

        assigned_to_email:
          previousAssignment.assigned_to_email,

        assigned_by_email: assignedBy,

        assignment_source: "document_revision_retraining",

        training_title:
          `${documentNumber} Rev ${revision} Retraining`,

        training_description:
          `Retraining automatically assigned because ${documentNumber} Revision ${revision} became effective.`,

        due_date: dueDate
          .toISOString()
          .slice(0, 10),

        status: "assigned",

        role_name:
          previousAssignment.role_name || null,

        department:
          previousAssignment.department || null,

        effectiveness_required:
          previousAssignment.effectiveness_required ||
          false,

        effectiveness_status:
          previousAssignment.effectiveness_required
            ? "effectiveness_pending"
            : "not_required",

        supervisor_verification_required:
          previousAssignment.supervisor_verification_required ||
          false,

        acknowledgement_required: true,

        retraining_assignment: true,

        source_document_revision: revision,

        previous_training_assignment_id:
          previousAssignment.id,
      });

    if (!error) {
      created++;
    }
  }

  return {
    created,
    skipped,
    impactedUsers: completedUsers.length,
  };
}
