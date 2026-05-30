import { supabase } from "../lib/supabaseClient";
import { createESignature } from "../lib/eSignatureEngine";

export async function acknowledgeTraining({
  assignmentId,
  documentId,
  userEmail,
  userRole,
  meaning,
  reason,
}: {
  assignmentId: string;
  documentId?: string | null;
  userEmail: string;
  userRole?: string | null;
  meaning: string;
  reason: string;
}) {
  if (!assignmentId) {
    throw new Error("Training assignment ID is required.");
  }

  if (!userEmail) {
    throw new Error("User email is required to electronically acknowledge training.");
  }

  const signature = await createESignature({
    moduleName: "training",
    recordId: assignmentId,
    actionType: "training_acknowledgement",
    signedBy: userEmail,
    signerRole: userRole || null,
    signatureMeaning: meaning || "Acknowledge Training",
    signatureReason: reason || "Training completed and acknowledged.",
  });

  const { error } = await supabase
    .from("training_assignments")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      completed_by: userEmail,
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: userEmail,
      signature_id: signature.id,
    })
    .eq("id", assignmentId);

  if (error) {
    throw new Error(error.message);
  }

  return signature;
}
