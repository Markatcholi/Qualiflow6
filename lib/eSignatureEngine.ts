import { supabase } from "./supabaseClient";

export type ESignatureRecord = {
  id: string;
  module_name: string;
  record_id: string;
  action_type: string;
  signed_by: string;
  signer_role: string | null;
  signature_meaning: string;
  signature_reason: string | null;
  signed_at: string | null;
  ip_address?: string | null;
  created_at?: string | null;
};

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
}): Promise<ESignatureRecord> {
  if (!moduleName || !recordId || !actionType || !signedBy || !signatureMeaning) {
    throw new Error("Missing required electronic signature information.");
  }

  const { data, error } = await supabase
    .from("electronic_signatures")
    .insert({
      module_name: moduleName,
      record_id: recordId,
      action_type: actionType,
      signed_by: signedBy,
      signer_role: signerRole || null,
      signature_meaning: signatureMeaning,
      signature_reason: signatureReason || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as ESignatureRecord;
}
