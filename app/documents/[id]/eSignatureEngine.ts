import { supabase } from "./supabaseClient";

export async function createESignature({
  moduleName,
  recordId,
  actionType,
  signedBy,
  signerRole,
  signatureMeaning,
  signatureReason,
}: {
  moduleName: string;
  recordId: string;
  actionType: string;
  signedBy: string;
  signerRole?: string | null;
  signatureMeaning: string;
  signatureReason?: string | null;
}) {
  const { error } = await supabase
    .from("electronic_signatures")
    .insert({
      module_name: moduleName,
      record_id: recordId,
      action_type: actionType,
      signed_by: signedBy,
      signer_role: signerRole || null,
      signature_meaning: signatureMeaning,
      signature_reason: signatureReason || null,
    });

  if (error) {
    throw new Error(error.message);
  }

  return true;
}
