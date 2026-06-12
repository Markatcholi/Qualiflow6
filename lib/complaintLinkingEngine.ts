import { SupabaseClient } from "@supabase/supabase-js";

type LinkModule = "ncmr" | "capa" | "scar" | "change_control";

type CreateLinkedRecordInput = {
  supabase: SupabaseClient;
  complaint: any;
  module: LinkModule;
  userEmail: string;
};

type ModuleConfig = {
  table: string;
  numberPrefix: string;
  titlePrefix: string;
  route: string;
};

const moduleConfig: Record<LinkModule, ModuleConfig> = {
  ncmr: {
    table: "ncmrs",
    numberPrefix: "NCMR",
    titlePrefix: "Complaint-related NCMR",
    route: "/ncmrs",
  },
  capa: {
    table: "capas",
    numberPrefix: "CAPA",
    titlePrefix: "Complaint-related CAPA",
    route: "/capa",
  },
  scar: {
    table: "scars",
    numberPrefix: "SCAR",
    titlePrefix: "Complaint-related SCAR",
    route: "/supplier-quality/scars",
  },
  change_control: {
    table: "change_controls",
    numberPrefix: "CC",
    titlePrefix: "Complaint-related Change",
    route: "/change-control",
  },
};

const generateRecordNumber = async (
  supabase: SupabaseClient,
  table: string,
  prefix: string,
) => {
  const year = new Date().getFullYear();

  const { count } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true });

  return `${prefix}-${year}-${String((count || 0) + 1).padStart(6, "0")}`;
};

const buildPayload = ({
  complaint,
  module,
  recordNumber,
  userEmail,
}: {
  complaint: any;
  module: LinkModule;
  recordNumber: string;
  userEmail: string;
}): Record<string, any> => {
  const baseTitle = `${moduleConfig[module].titlePrefix}: ${
    complaint.complaint_number || complaint.complaint_title || "Complaint"
  }`;

  const baseDescription = [
    `Created from complaint: ${complaint.complaint_number || complaint.id}`,
    `Complaint title: ${complaint.complaint_title || "N/A"}`,
    `Complaint description: ${complaint.complaint_description || "N/A"}`,
    `Product: ${complaint.product_name || "N/A"}`,
    `Part number: ${complaint.part_number || "N/A"}`,
    `Lot number: ${complaint.lot_number || "N/A"}`,
    `Severity: ${complaint.severity || "N/A"}`,
  ].join("\n");

  if (module === "ncmr") {
    return {
      ncmr_number: recordNumber,
      title: baseTitle,
      description: baseDescription,
      status: "open",
      severity: complaint.severity || "minor",
      product_name: complaint.product_name || null,
      part_number: complaint.part_number || null,
      lot_number: complaint.lot_number || null,
      created_by: userEmail,
    };
  }

  if (module === "capa") {
    return {
      capa_number: recordNumber,
      title: baseTitle,
      description: baseDescription,
      status: "open",
      severity: complaint.severity || "minor",
      capa_source: "complaint",
      created_by: userEmail,
    };
  }

  if (module === "scar") {
    return {
      scar_number: recordNumber,
      title: baseTitle,
      scar_title: baseTitle,
      description: baseDescription,
      scar_description: baseDescription,
      status: "open",
      scar_status: "open",
      supplier_name: complaint.customer_organization || null,
      created_by: userEmail,
    };
  }

  return {
    change_number: recordNumber,
    title: baseTitle,
    change_title: baseTitle,
    description: baseDescription,
    change_description: baseDescription,
    status: "initiation",
    change_origin: "complaint",
    risk_level:
      complaint.severity === "critical"
        ? "critical"
        : complaint.severity === "major"
        ? "high"
        : "medium",
    created_by: userEmail,
  };
};

export async function createLinkedQualityRecord({
  supabase,
  complaint,
  module,
  userEmail,
}: CreateLinkedRecordInput) {
  const config = moduleConfig[module];

  const recordNumber = await generateRecordNumber(
    supabase,
    config.table,
    config.numberPrefix,
  );

  const payload: Record<string, any> = buildPayload({
    complaint,
    module,
    recordNumber,
    userEmail,
  });

  const { data, error } = await supabase
    .from(config.table)
    .insert(payload as any)
    .select()
    .single();

  if (error) {
    return {
      data: null,
      error,
      linkedRecordNumber: recordNumber,
      route: config.route,
    };
  }

  await supabase.from("complaint_quality_links").insert({
    complaint_id: complaint.id,
    linked_module: module,
    linked_record_id: data.id,
    linked_record_number: recordNumber,
    link_reason: `Created from complaint ${
      complaint.complaint_number || complaint.id
    }`,
    created_by: userEmail,
  });

  await supabase.from("complaint_activity_log").insert({
    complaint_id: complaint.id,
    action: `${module}_created_from_complaint`,
    details: `${recordNumber} created and linked to complaint.`,
    user_email: userEmail,
  });

  const complaintUpdate: Record<string, any> = {};

  if (module === "ncmr") {
    complaintUpdate.ncmr_required = true;
    complaintUpdate.linked_ncmr_id = data.id;
  }

  if (module === "capa") {
    complaintUpdate.capa_required = true;
    complaintUpdate.linked_capa_id = data.id;
  }

  if (module === "scar") {
    complaintUpdate.scar_required = true;
    complaintUpdate.linked_scar_id = data.id;
  }

  if (module === "change_control") {
    complaintUpdate.change_control_required = true;
    complaintUpdate.linked_change_control_id = data.id;
  }

  await supabase
    .from("complaints")
    .update({
      ...complaintUpdate,
      updated_at: new Date().toISOString(),
    })
    .eq("id", complaint.id);

  return {
    data,
    error: null,
    linkedRecordNumber: recordNumber,
    route: config.route,
  };
}

export async function fetchComplaintQualityLinks({
  supabase,
  complaintId,
}: {
  supabase: SupabaseClient;
  complaintId: string;
}) {
  const { data, error } = await supabase
    .from("complaint_quality_links")
    .select("*")
    .eq("complaint_id", complaintId)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn(error.message);
    return [];
  }

  return data || [];
}
