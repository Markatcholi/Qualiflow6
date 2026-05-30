import { supabase } from "../lib/supabaseClient";
import { createESignature } from "../lib/eSignatureEngine";

export async function acknowledgeTraining({
  assignmentId,
  documentId,
  userEmail,
  meaning,
  reason,
  password,
}: {
  assignmentId: string;
  documentId: string;
  userEmail: string;
  meaning: string;
  reason: string;
  password: string;
}) {
  const signature = await createESignature({
    moduleName: "training",
    recordId: assignmentId,
    signerEmail: userEmail,
    meaning,
    reason,
    password,
  });

  const { error } = await supabase
    .from("training_assignments")
    .update({
      status: "completed",
      signature_id: signature.id,
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: userEmail,
    })
    .eq("id", assignmentId);

  if (error) throw error;

  return signature;
}
