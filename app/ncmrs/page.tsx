"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import {
  SectionCard,
  ActionToolbar,
  StatusBadge,
  EmptyStateCard,
  FormField,
  primaryButtonStyle,
  standardInputStyle,
  standardTextareaStyle,
} from "../components/QualityWorkflowComponents";

type MasterOption = {
  code: string;
  label: string;
  description?: string | null;
  part_description?: string | null;
  product_description?: string | null;
  name?: string | null;
};

type DefectSubcategoryOption = {
  category_code: string;
  code: string;
  label: string;
};

type SupplierOption = {
  id: string;
  supplier_name: string;
  supplier_number: string | null;
};

type AffectedItemInput = {
  product_part_number: string;
  part_description: string;
  part_revision: string;
  lot_number: string;
  workorder_number: string;
  quantity_affected: string;
  quarantined_quantity: string;
  defect_category: string;
  defect_subcategory: string;
};

type InitiationAttachment = {
  name: string;
  url: string;
  storage_path: string;
  uploaded_at: string;
  uploaded_by: string;
  phase: "initiation";
};

type Ncmr = {
  id: string;
  ncmr_number: string | null;
  issue_description: string | null;
  product_part_number: string | null;
  part_description?: string | null;
  part_revision?: string | null;
  lot_number: string | null;
  workorder_number: string | null;
  source_of_detection: string | null;
  department: string | null;
  date_detected: string | null;
  quantity_affected: number | null;
  containment_action: string | null;
  containment_owner: string | null;
  containment_completed_at?: string | null;
  containment_completed_by?: string | null;
  material_status: string | null;
  quarantined_quantity: number | null;
  defect_category: string | null;
  defect_subcategory: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  supplier_lot: string | null;
  purchase_order_number?: string | null;
  site_location: string | null;
  immediate_correction: string | null;
  recurring_issue: boolean | null;
  recurrence_reason: string | null;
  supplier_capa_required: boolean | null;
  supplier_capa_reason: string | null;
  severity: string | null;
  owner: string | null;
  status: string | null;
  capa_required: boolean | null;
  created_at: string | null;
};

export default function NcmrPage() {
  const [issueDescription, setIssueDescription] = useState("");
  const [sourceOfDetection, setSourceOfDetection] = useState("");
  const [department, setDepartment] = useState("");
  const [dateDetected, setDateDetected] = useState("");
  const [containmentAction, setContainmentAction] = useState("");
  const [containmentOwner, setContainmentOwner] = useState("");
  const [materialStatus, setMaterialStatus] = useState("");
  const [quarantinedQuantity, setQuarantinedQuantity] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [supplierLot, setSupplierLot] = useState("");
  const [purchaseOrderNumber, setPurchaseOrderNumber] = useState("");
  const [siteLocation, setSiteLocation] = useState("");
  const [immediateCorrection, setImmediateCorrection] = useState("");
  const [owner, setOwner] = useState("");
  const [initiationAttachmentFiles, setInitiationAttachmentFiles] = useState<File[]>([]);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(true);
  const [draftSaveStatus, setDraftSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [draftRestored, setDraftRestored] = useState(false);
  const dateDetectedPickerRef = useRef<HTMLInputElement | null>(null);

  const [affectedItems, setAffectedItems] = useState<AffectedItemInput[]>([
    {
      product_part_number: "",
      part_description: "",
      part_revision: "",
      lot_number: "",
      workorder_number: "",
      quantity_affected: "",
      quarantined_quantity: "",
      defect_category: "",
      defect_subcategory: "",
    },
  ]);

  const [list, setList] = useState<Ncmr[]>([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");

  const [partNumberOptions, setPartNumberOptions] = useState<MasterOption[]>([]);
  const [detectionSourceOptions, setDetectionSourceOptions] = useState<MasterOption[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<MasterOption[]>([]);
  const [materialStatusOptions, setMaterialStatusOptions] = useState<MasterOption[]>([]);
  const [defectCategoryOptions, setDefectCategoryOptions] = useState<MasterOption[]>([]);
  const [defectSubcategoryOptions, setDefectSubcategoryOptions] = useState<DefectSubcategoryOption[]>([]);
  const [supplierOptions, setSupplierOptions] = useState<SupplierOption[]>([]);

  const getDefectSubcategoriesForCategory = (categoryCode: string) =>
    defectSubcategoryOptions.filter(
      (item) => item.category_code === categoryCode
    );


  const isSupplierSource = sourceOfDetection
    .toLowerCase()
    .includes("supplier");

  const selectedSupplier = supplierOptions.find((supplier) => supplier.id === supplierId) || null;

  const fieldStyle: React.CSSProperties = {
    ...standardInputStyle,
    marginTop: "4px",
  };

  const textAreaStyle: React.CSSProperties = {
    ...standardTextareaStyle,
    marginTop: "4px",
  };

  const sectionStyle: React.CSSProperties = {
    border: "1px solid #ccc",
    padding: "16px",
    marginBottom: "20px",
    borderRadius: "8px",
  };

  const rowStyle: React.CSSProperties = {
    marginBottom: "12px",
  };

  const fetchMasterData = async () => {
    const [
      partNumbersRes,
      detectionRes,
      departmentsRes,
      materialRes,
      defectCategoryRes,
      defectSubcategoryRes,
      suppliersRes,
    ] = await Promise.all([
      supabase.from("md_product_part_numbers").select("*").order("label"),
      supabase.from("md_detection_sources").select("code, label").order("label"),
      supabase.from("md_departments").select("code, label").order("label"),
      supabase.from("md_material_statuses").select("code, label").order("label"),
      supabase.from("md_defect_categories").select("code, label").order("label"),
      supabase.from("md_defect_subcategories").select("category_code, code, label").order("label"),
      supabase
        .from("suppliers")
        .select("id, supplier_name, supplier_number")
        .order("supplier_name"),
    ]);

    if (partNumbersRes.error) return alert(partNumbersRes.error.message);
    if (detectionRes.error) return alert(detectionRes.error.message);
    if (departmentsRes.error) return alert(departmentsRes.error.message);
    if (materialRes.error) return alert(materialRes.error.message);
    if (defectCategoryRes.error) return alert(defectCategoryRes.error.message);
    if (defectSubcategoryRes.error) return alert(defectSubcategoryRes.error.message);
    if (suppliersRes.error) return alert(suppliersRes.error.message);

    setPartNumberOptions(partNumbersRes.data || []);
    setDetectionSourceOptions(detectionRes.data || []);
    setDepartmentOptions(departmentsRes.data || []);
    setMaterialStatusOptions(materialRes.data || []);
    setDefectCategoryOptions(defectCategoryRes.data || []);
    setDefectSubcategoryOptions(defectSubcategoryRes.data || []);
    setSupplierOptions(suppliersRes.data || []);
  };

  const fetchData = async () => {
    const { data, error } = await supabase
      .from("ncmrs")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    const ncmrRows = (data as Ncmr[]) || [];
    const ncmrIds = ncmrRows.map((item) => item.id).filter(Boolean);

    if (ncmrIds.length === 0) {
      setList([]);
      return;
    }

    const { data: affectedRows, error: affectedError } = await supabase
      .from("ncmr_affected_items")
      .select("*")
      .in("ncmr_id", ncmrIds)
      .order("created_at", { ascending: true });

    if (affectedError) {
      alert(affectedError.message);
      setList(ncmrRows);
      return;
    }

    const affectedByNcmrId: Record<string, any[]> = {};

    (affectedRows || []).forEach((affectedItem: any) => {
      if (!affectedItem.ncmr_id) return;

      if (!affectedByNcmrId[affectedItem.ncmr_id]) {
        affectedByNcmrId[affectedItem.ncmr_id] = [];
      }

      affectedByNcmrId[affectedItem.ncmr_id].push(affectedItem);
    });

    const enrichedRows = ncmrRows.map((ncmr) => {
      const affectedItemsForRecord = affectedByNcmrId[ncmr.id] || [];
      const primaryAffectedItem =
        affectedItemsForRecord.find(
          (item) =>
            item.product_part_number ||
            item.part_description ||
            item.part_revision ||
            item.lot_number ||
            item.workorder_number ||
            item.quantity_affected ||
            item.quarantined_quantity
        ) || null;

      const totalAffectedQuantity = affectedItemsForRecord.reduce(
        (sum, item) => sum + (Number(item.quantity_affected) || 0),
        0
      );

      const totalQuarantinedQuantity = affectedItemsForRecord.reduce(
        (sum, item) => sum + (Number(item.quarantined_quantity) || 0),
        0
      );

      return {
        ...ncmr,
        product_part_number:
          ncmr.product_part_number ||
          primaryAffectedItem?.product_part_number ||
          null,
        part_description:
          ncmr.part_description ||
          primaryAffectedItem?.part_description ||
          null,
        part_revision:
          ncmr.part_revision ||
          primaryAffectedItem?.part_revision ||
          null,
        lot_number:
          ncmr.lot_number ||
          primaryAffectedItem?.lot_number ||
          null,
        workorder_number:
          ncmr.workorder_number ||
          primaryAffectedItem?.workorder_number ||
          null,
        quantity_affected:
          ncmr.quantity_affected ??
          (affectedItemsForRecord.length > 0 ? totalAffectedQuantity : null),
        quarantined_quantity:
          ncmr.quarantined_quantity ??
          (affectedItemsForRecord.length > 0 ? totalQuarantinedQuantity : null),
      };
    });

    setList(enrichedRows as Ncmr[]);
  };

  const addAuditLog = async (
    entityType: string,
    entityId: string,
    action: string,
    details: string
  ) => {
    const { data: userData } = await supabase.auth.getUser();
    const email = userData?.user?.email || "unknown";

    await supabase.from("audit_logs").insert({
      entity_type: entityType,
      entity_id: entityId,
      action,
      details,
      user_email: email,
    });
  };

  const checkRecurrence = async () => {
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const candidates = affectedItems.filter(
      (item) => item.product_part_number && item.defect_category
    );

    if (candidates.length === 0) {
      return { recurring: false, reason: "" };
    }

    const reasons: string[] = [];

    for (const item of candidates) {
      const { data, error } = await supabase
        .from("ncmr_affected_items")
        .select("id, ncmr_id")
        .eq("product_part_number", item.product_part_number)
        .eq("defect_category", item.defect_category)
        .gte("created_at", sixtyDaysAgo.toISOString());

      if (error) {
        alert(error.message);
        return { recurring: false, reason: "" };
      }

      const priorNcmrIds = Array.from(
        new Set((data || []).map((row: any) => row.ncmr_id).filter(Boolean))
      );

      if (priorNcmrIds.length > 0) {
        const categoryLabel =
          defectCategoryOptions.find((option) => option.code === item.defect_category)
            ?.label || item.defect_category;

        reasons.push(
          `${item.product_part_number} / ${categoryLabel}: ${priorNcmrIds.length} prior NCMR(s) in the last 60 days.`
        );
      }
    }

    return {
      recurring: reasons.length > 0,
      reason:
        reasons.length > 0
          ? `Recurring issue detected by affected part and defect category: ${reasons.join(" ")}`
          : "",
    };
  };

  const checkSupplierScar = async () => {
    const supplierNameForCheck = selectedSupplier?.supplier_name || supplierName;

    if (!supplierNameForCheck.trim()) {
      return { required: false, reason: "" };
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data, error } = await supabase
      .from("ncmrs")
      .select("id")
      .ilike("supplier_name", supplierNameForCheck.trim())
      .gte("created_at", thirtyDaysAgo.toISOString());

    if (error) {
      alert(error.message);
      return { required: false, reason: "" };
    }

    const priorCount = data?.length || 0;
    const totalWithNewRecord = priorCount + 1;

    if (totalWithNewRecord >= 3) {
      return {
        required: true,
        reason: `Supplier CAPA/SCAR required: ${supplierNameForCheck} has ${totalWithNewRecord} NCMR(s) in the last 30 days.`,
      };
    }

    return { required: false, reason: "" };
  };

  const addAffectedItem = () => {
    setAffectedItems([
      ...affectedItems,
      {
        product_part_number: "",
        part_description: "",
        part_revision: "",
        lot_number: "",
        workorder_number: "",
        quantity_affected: "",
        quarantined_quantity: "",
        defect_category: "",
        defect_subcategory: "",
        },
    ]);
  };

  const updateAffectedItem = (
    index: number,
    field: keyof AffectedItemInput,
    value: string
  ) => {
    const updated = [...affectedItems];
    updated[index] = {
      ...updated[index],
      [field]: value,
      ...(field === "defect_category" ? { defect_subcategory: "" } : {}),
    };
    setAffectedItems(updated);
  };

  const updateAffectedPartNumber = (index: number, value: string) => {
    const selectedPart = partNumberOptions.find(
      (option) => option.code === value
    );

    const resolvedDescription = selectedPart
      ? String(
          selectedPart.description ||
            selectedPart.part_description ||
            selectedPart.product_description ||
            selectedPart.name ||
            (selectedPart.label !== selectedPart.code
              ? selectedPart.label
              : "") ||
            ""
        ).trim()
      : "";

    const updated = [...affectedItems];

    updated[index] = {
      ...updated[index],
      product_part_number: value,
      part_description: resolvedDescription,
    };

    setAffectedItems(updated);
  };

  const removeAffectedItem = (index: number) => {
    if (affectedItems.length === 1) {
      setAffectedItems([
        {
          product_part_number: "",
          part_description: "",
          part_revision: "",
          lot_number: "",
          workorder_number: "",
          quantity_affected: "",
          quarantined_quantity: "",
          defect_category: "",
          defect_subcategory: "",
            },
      ]);
      return;
    }

    const updated = [...affectedItems];
    updated.splice(index, 1);
    setAffectedItems(updated);
  };


  const sanitizeFileName = (fileName: string) => {
    return fileName
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, "_")
      .replace(/_+/g, "_");
  };

  const addInitiationAttachmentFiles = (
    files: FileList | null
  ) => {
    if (!files || files.length === 0) return;

    const incomingFiles = Array.from(files);

    setInitiationAttachmentFiles((current) => {
      const existingKeys = new Set(
        current.map(
          (file) => `${file.name}:${file.size}:${file.lastModified}`
        )
      );

      const uniqueIncoming = incomingFiles.filter(
        (file) =>
          !existingKeys.has(
            `${file.name}:${file.size}:${file.lastModified}`
          )
      );

      return [...current, ...uniqueIncoming];
    });
  };

  const removeInitiationAttachmentFile = (index: number) => {
    setInitiationAttachmentFiles((current) =>
      current.filter((_, fileIndex) => fileIndex !== index)
    );
  };

  const uploadInitiationAttachments = async (
    ncmrId: string,
    uploadedBy: string
  ) => {
    if (initiationAttachmentFiles.length === 0) {
      return {
        attachments: [] as InitiationAttachment[],
        failedFiles: [] as string[],
      };
    }

    setUploadingAttachments(true);

    const attachments: InitiationAttachment[] = [];
    const failedFiles: string[] = [];

    try {
      for (let index = 0; index < initiationAttachmentFiles.length; index += 1) {
        const file = initiationAttachmentFiles[index];
        const safeFileName = sanitizeFileName(file.name) || `attachment_${index + 1}`;
        const storagePath =
          `ncmrs/${ncmrId}/initiation/` +
          `${Date.now()}_${index + 1}_${safeFileName}`;

        const { error: uploadError } = await supabase.storage
          .from("evidence")
          .upload(storagePath, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type || undefined,
          });

        if (uploadError) {
          console.warn(
            `Unable to upload initiation attachment ${file.name}:`,
            uploadError.message
          );
          failedFiles.push(file.name);
          continue;
        }

        const { data: publicUrlData } = supabase.storage
          .from("evidence")
          .getPublicUrl(storagePath);

        attachments.push({
          name: file.name,
          url: publicUrlData.publicUrl,
          storage_path: storagePath,
          uploaded_at: new Date().toISOString(),
          uploaded_by: uploadedBy,
          phase: "initiation",
        });
      }

      if (attachments.length > 0) {
        const { error: attachmentUpdateError } = await supabase
          .from("ncmrs")
          .update({
            initiation_attachments: attachments,
          })
          .eq("id", ncmrId);

        if (attachmentUpdateError) {
          throw new Error(attachmentUpdateError.message);
        }

        await addAuditLog(
          "ncmr",
          ncmrId,
          "initiation_attachments_uploaded",
          `Uploaded ${attachments.length} initiation supporting attachment(s): ${attachments
            .map((attachment) => attachment.name)
            .join(", ")}.`
        );
      }

      return { attachments, failedFiles };
    } finally {
      setUploadingAttachments(false);
    }
  };

  const resetNcmrForm = () => {
    setIssueDescription("");
    setSourceOfDetection("");
    setDepartment("");
    setDateDetected("");
    setContainmentAction("");
    setContainmentOwner("");
    setMaterialStatus("");
    setQuarantinedQuantity("");
    setSupplierId("");
    setSupplierName("");
    setSupplierLot("");
    setPurchaseOrderNumber("");
    setSiteLocation("");
    setImmediateCorrection("");
    setOwner("");
    setInitiationAttachmentFiles([]);
    setAffectedItems([
      {
        product_part_number: "",
        part_description: "",
        part_revision: "",
        lot_number: "",
        workorder_number: "",
        quantity_affected: "",
        quarantined_quantity: "",
        defect_category: "",
        defect_subcategory: "",
      },
    ]);
  };

  const addNcmr = async () => {
    if (!issueDescription.trim()) {
      alert("Issue Description is required.");
      return;
    }

    const normalizedOwnerEmail = owner.trim().toLowerCase();

    if (!normalizedOwnerEmail) {
      alert("NCMR Owner Email is required.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedOwnerEmail)) {
      alert("Enter a valid NCMR Owner Email.");
      return;
    }

    if (dateDetected.trim() && !dateDisplayToIso(dateDetected)) {
      alert("Date Detected must use the format DD-MMM-YYYY, for example 09-Aug-2026.");
      return;
    }

    if (isSupplierSource && !supplierId) {
      alert("Select a supplier for a supplier-related NCMR.");
      return;
    }

    const validAffectedItemsForValidation = affectedItems.filter(
      (item) =>
        item.product_part_number ||
        item.lot_number ||
        item.workorder_number ||
        item.quantity_affected ||
        item.quarantined_quantity ||
        item.defect_category ||
        item.defect_subcategory
    );

    if (validAffectedItemsForValidation.length === 0) {
      alert("At least one affected item is required.");
      return;
    }

    const missingDefectItems = validAffectedItemsForValidation
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => !item.defect_category || !item.defect_subcategory);

    if (missingDefectItems.length > 0) {
      alert(
        `Defect Category and Defect Subcategory are required for each affected item.\n\n${missingDefectItems
          .map(({ index }) => `Affected Item ${index + 1}`)
          .join("\n")}`
      );
      return;
    }

    const recurrence = await checkRecurrence();
    const supplierScar = await checkSupplierScar();

    const capaRequired = recurrence.recurring;
    const supplierNameForInsert = isSupplierSource
      ? selectedSupplier?.supplier_name || supplierName
      : "";
    const supplierLotForInsert = isSupplierSource ? supplierLot : "";
    const purchaseOrderForInsert = isSupplierSource ? purchaseOrderNumber : "";
    const supplierIdForInsert = isSupplierSource ? supplierId || null : null;

    const primaryAffectedItem =
      affectedItems.find(
        (item) =>
          item.product_part_number ||
          item.part_description ||
          item.part_revision ||
          item.lot_number ||
          item.workorder_number ||
          item.quantity_affected ||
          item.quarantined_quantity
      ) || null;

    const { data: currentUserData } = await supabase.auth.getUser();
    const currentUserEmail = currentUserData?.user?.email || "unknown";
    const containmentCompletedAt = containmentAction.trim()
      ? new Date().toISOString()
      : null;


    const { data, error } = await supabase
      .from("ncmrs")
      .insert({
        issue_description: issueDescription.trim(),
        product_part_number: primaryAffectedItem?.product_part_number || null,
        lot_number: primaryAffectedItem?.lot_number || null,
        workorder_number: primaryAffectedItem?.workorder_number || null,
        source_of_detection: sourceOfDetection,
        department,
        date_detected: dateDisplayToIso(dateDetected),
        quantity_affected: primaryAffectedItem?.quantity_affected
          ? Number(primaryAffectedItem.quantity_affected)
          : null,
        containment_action: containmentAction,
        containment_owner: containmentOwner,
        containment_completed_at: containmentCompletedAt,
        containment_completed_by: containmentCompletedAt ? currentUserEmail : null,
        material_status: materialStatus,
        quarantined_quantity: primaryAffectedItem?.quarantined_quantity
          ? Number(primaryAffectedItem.quarantined_quantity)
          : quarantinedQuantity
          ? Number(quarantinedQuantity)
          : null,
        // Legacy summary fields retained for compatibility. The authoritative
        // defect classification is stored on each ncmr_affected_items row.
        defect_category: primaryAffectedItem?.defect_category || null,
        defect_subcategory: primaryAffectedItem?.defect_subcategory || null,
        supplier_id: supplierIdForInsert,
        supplier_name: supplierNameForInsert,
        supplier_lot: supplierLotForInsert,
        purchase_order_number: purchaseOrderForInsert || null,
        site_location: siteLocation,
        immediate_correction: immediateCorrection,
        owner: normalizedOwnerEmail,
        status: "open",
        severity: "not_assessed",
        capa_required: capaRequired,
        recurring_issue: recurrence.recurring,
        recurrence_reason: recurrence.reason,
        recurrence_checked_at: new Date().toISOString(),
        supplier_capa_required: supplierScar.required,
        supplier_capa_reason: supplierScar.reason,
      })
      .select()
      .single();

    if (error) {
      alert(error.message);
      return;
    }

    await addAuditLog(
      "ncmr",
      data.id,
      "created",
      `Created NCMR: ${issueDescription.trim().slice(0, 120)}`
    );

    if (containmentCompletedAt) {
      await addAuditLog(
        "ncmr",
        data.id,
        "containment_completed_at_initiation",
        `Containment completed during NCMR initiation by ${currentUserEmail}.`
      );
    }

    const validAffectedItems = affectedItems.filter(
      (item) =>
        item.product_part_number ||
        item.lot_number ||
        item.workorder_number ||
        item.quantity_affected ||
        item.quarantined_quantity ||
        item.defect_category ||
        item.defect_subcategory
    );

    if (validAffectedItems.length > 0) {
      const itemsToInsert = validAffectedItems.map((item) => ({
        ncmr_id: data.id,
        product_part_number: item.product_part_number || null,
        part_description: item.part_description || null,
        part_revision: item.part_revision || null,
        lot_number: item.lot_number || null,
        workorder_number: item.workorder_number || null,
        quantity_affected: item.quantity_affected
          ? Number(item.quantity_affected)
          : null,
        quarantined_quantity: item.quarantined_quantity
          ? Number(item.quarantined_quantity)
          : null,
        defect_category: item.defect_category || null,
        defect_subcategory: item.defect_subcategory || null,
      }));

      const { error: affectedItemsError } = await supabase
        .from("ncmr_affected_items")
        .insert(itemsToInsert);

      if (affectedItemsError) {
        alert(affectedItemsError.message);
        return;
      }

      await addAuditLog(
        "ncmr",
        data.id,
        "affected_items_added",
        `Added ${itemsToInsert.length} affected item(s) during NCMR initiation.`
      );
    }

    if (recurrence.recurring) {
      await addAuditLog("ncmr", data.id, "recurrence_detected", recurrence.reason);
    }

    if (supplierScar.required) {
      await addAuditLog("ncmr", data.id, "supplier_scar_required", supplierScar.reason);
    }

    if (recurrence.recurring) {
      await addAuditLog(
        "ncmr",
        data.id,
        "capa_evaluation_required",
        `CAPA evaluation required due to recurrence. Risk-based decision required before CAPA creation. Reason: ${recurrence.reason}`
      );
    }

    let attachmentUploadResult = {
      attachments: [] as InitiationAttachment[],
      failedFiles: [] as string[],
    };

    try {
      attachmentUploadResult = await uploadInitiationAttachments(
        data.id,
        currentUserEmail
      );
    } catch (attachmentError: any) {
      await addAuditLog(
        "ncmr",
        data.id,
        "initiation_attachment_upload_error",
        `NCMR was created, but initiation attachments could not be fully recorded. ${attachmentError?.message || "Unknown upload error."}`
      );

      alert(
        `NCMR ${data.ncmr_number || ""} was created, but the initiation attachments could not be fully saved. Open the NCMR workflow and add the supporting evidence there.\n\n${attachmentError?.message || ""}`
      );
    }

    const failedAttachmentMessage =
      attachmentUploadResult.failedFiles.length > 0
        ? `\n\nThe following file(s) did not upload and may be added from the workflow page:\n${attachmentUploadResult.failedFiles.join("\n")}`
        : "";

    clearSavedIntakeDraft();
    resetNcmrForm();
    await fetchData();

    alert(
      `NCMR ${data.ncmr_number || ""} created successfully.${
        attachmentUploadResult.attachments.length > 0
          ? ` ${attachmentUploadResult.attachments.length} initiation attachment(s) uploaded.`
          : ""
      }${failedAttachmentMessage}`
    );
  };

  useEffect(() => {
    fetchMasterData();
    fetchData();
  }, []);

  const intakeDraftStorageKey = "qualisphere:ncmr-initiation-draft:v2";

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const savedDraft = window.localStorage.getItem(intakeDraftStorageKey);
      if (!savedDraft) {
        setDraftRestored(true);
        return;
      }

      const draft = JSON.parse(savedDraft);

      setIssueDescription(draft.issueDescription || "");
      setSourceOfDetection(draft.sourceOfDetection || "");
      setDepartment(draft.department || "");
      setDateDetected(formatDisplayDate(draft.dateDetected || ""));
      setContainmentAction(draft.containmentAction || "");
      setContainmentOwner(draft.containmentOwner || "");
      setMaterialStatus(draft.materialStatus || "");
      setQuarantinedQuantity(draft.quarantinedQuantity || "");
      setSupplierId(draft.supplierId || "");
      setSupplierName(draft.supplierName || "");
      setSupplierLot(draft.supplierLot || "");
      setPurchaseOrderNumber(draft.purchaseOrderNumber || "");
      setSiteLocation(draft.siteLocation || "");
      setImmediateCorrection(draft.immediateCorrection || "");
      setOwner(draft.owner || "");

      if (Array.isArray(draft.affectedItems) && draft.affectedItems.length > 0) {
        setAffectedItems(
          draft.affectedItems.map((item: any) => ({
            product_part_number: item.product_part_number || "",
            part_description: item.part_description || "",
            part_revision: item.part_revision || "",
            lot_number: item.lot_number || "",
            workorder_number: item.workorder_number || "",
            quantity_affected: item.quantity_affected || "",
            quarantined_quantity: item.quarantined_quantity || "",
            defect_category: item.defect_category || "",
            defect_subcategory: item.defect_subcategory || "",
          }))
        );
      }
    } catch (error) {
      console.warn("Unable to restore NCMR initiation draft:", error);
    } finally {
      setDraftRestored(true);
    }
  }, []);

  useEffect(() => {
    if (!draftRestored || typeof window === "undefined") return;

    setDraftSaveStatus("saving");

    const timer = window.setTimeout(() => {
      const draft = {
        issueDescription,
        sourceOfDetection,
        department,
        dateDetected,
        containmentAction,
        containmentOwner,
        materialStatus,
        quarantinedQuantity,
        supplierId,
        supplierName,
        supplierLot,
        purchaseOrderNumber,
        siteLocation,
        immediateCorrection,
        owner,
        affectedItems,
        savedAt: new Date().toISOString(),
      };

      window.localStorage.setItem(intakeDraftStorageKey, JSON.stringify(draft));
      setDraftSaveStatus("saved");
    }, 700);

    return () => window.clearTimeout(timer);
  }, [
    draftRestored,
    issueDescription,
    sourceOfDetection,
    department,
    dateDetected,
    containmentAction,
    containmentOwner,
    materialStatus,
    quarantinedQuantity,
    supplierId,
    supplierName,
    supplierLot,
    purchaseOrderNumber,
    siteLocation,
    immediateCorrection,
    owner,
    affectedItems,
  ]);

  const clearSavedIntakeDraft = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(intakeDraftStorageKey);
    }
    setDraftSaveStatus("idle");
  };

  const monthAbbreviations = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  const formatDisplayDate = (value: any) => {
    if (!value) return "";

    const raw = String(value).trim();

    const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      const [, year, month, day] = isoMatch;
      const monthIndex = Number(month) - 1;
      if (monthIndex >= 0 && monthIndex <= 11) {
        return `${day}-${monthAbbreviations[monthIndex]}-${year}`;
      }
    }

    const displayMatch = raw.match(/^(\d{2})-([A-Za-z]{3})-(\d{4})$/);
    if (displayMatch) {
      const [, day, monthText, year] = displayMatch;
      const normalizedMonth = monthAbbreviations.find(
        (month) => month.toLowerCase() === monthText.toLowerCase()
      );
      if (normalizedMonth) return `${day}-${normalizedMonth}-${year}`;
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return raw;

    const day = String(parsed.getDate()).padStart(2, "0");
    return `${day}-${monthAbbreviations[parsed.getMonth()]}-${parsed.getFullYear()}`;
  };

  const dateDisplayToIso = (value: string) => {
    const raw = String(value || "").trim();
    if (!raw) return null;

    const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) return raw;

    const displayMatch = raw.match(/^(\d{2})-([A-Za-z]{3})-(\d{4})$/);
    if (!displayMatch) return null;

    const [, day, monthText, year] = displayMatch;
    const monthIndex = monthAbbreviations.findIndex(
      (month) => month.toLowerCase() === monthText.toLowerCase()
    );

    if (monthIndex < 0) return null;

    const iso = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${day}`;
    const parsed = new Date(`${iso}T00:00:00`);

    if (
      Number.isNaN(parsed.getTime()) ||
      parsed.getFullYear() !== Number(year) ||
      parsed.getMonth() !== monthIndex ||
      parsed.getDate() !== Number(day)
    ) {
      return null;
    }

    return iso;
  };

  const formatNcmrDate = (value: any) => {
    const formatted = formatDisplayDate(value);
    return formatted || "N/A";
  };

  const formatFileSize = (bytes: number) => {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";

    const units = ["B", "KB", "MB", "GB"];
    const unitIndex = Math.min(
      Math.floor(Math.log(bytes) / Math.log(1024)),
      units.length - 1
    );
    const value = bytes / Math.pow(1024, unitIndex);

    return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
  };

  const renderOptions = (options: MasterOption[]) =>
    options.map((option) => (
      <option key={option.code} value={option.code}>
        {option.label}
      </option>
    ));

  const badgeStyle: React.CSSProperties = {
    color: "white",
    padding: "4px 8px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 600,
  };

  const filteredList = list.filter((item) => {
    const searchableText = [
      item.ncmr_number,
      item.issue_description,
      item.product_part_number,
      item.lot_number,
      item.workorder_number,
      item.supplier_name,
      item.purchase_order_number,
      item.department,
      item.owner,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const matchesSearch = search
      ? searchableText.includes(search.trim().toLowerCase())
      : true;

    const matchesStatus = statusFilter ? item.status === statusFilter : true;
    const matchesSeverity = severityFilter ? item.severity === severityFilter : true;

    return matchesSearch && matchesStatus && matchesSeverity;
  });

  const initiationProgressSteps = [
    { label: "Issue", complete: !!issueDescription.trim() },
    { label: "Detection", complete: !!sourceOfDetection && !!department && !!dateDetected },
    {
      label: "Affected Material",
      complete: affectedItems.some(
        (item) =>
          (item.product_part_number || item.lot_number || item.workorder_number || item.quantity_affected) &&
          !!item.defect_category &&
          !!item.defect_subcategory
      ),
    },
    { label: "Supplier", complete: !isSupplierSource || !!supplierId },
    { label: "Containment", complete: !!containmentAction || !!materialStatus },
    { label: "Owner", complete: !!owner },
  ];

  const completedInitiationSteps = initiationProgressSteps.filter((step) => step.complete).length;
  const initiationPercentComplete = Math.round(
    (completedInitiationSteps / initiationProgressSteps.length) * 100
  );

  return (
    <main style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "12px",
          alignItems: "flex-start",
          flexWrap: "wrap",
          marginBottom: "16px",
        }}
      >
        <div>
          <h1 style={{ marginBottom: "6px" }}>NCMR Initiation</h1>
          <p style={{ color: "#4b5563", marginTop: 0 }}>
            Create a lightweight NCMR intake record. Detailed investigation, risk assessment, MRB, and closure are completed in the controlled workflow page.
          </p>
        </div>

        <ActionToolbar>
          <a
            href="/ncmrs/dashboard"
            style={{
              ...primaryButtonStyle,
              textDecoration: "none",
              display: "inline-block",
            }}
          >
            NCMR Dashboard
          </a>

          {!showCreateForm ? (
            <button
              type="button"
              onClick={() => setShowCreateForm(true)}
              style={primaryButtonStyle}
            >
              + Create NCMR
            </button>
          ) : null}
        </ActionToolbar>
      </div>

      <SectionCard
        title="Create NCMR Intake"
        subtitle="Capture the issue, part-specific affected material and defect classification, containment, and owner."
        defaultOpen={showCreateForm}
        rightAction={<StatusBadge status={`${completedInitiationSteps}/${initiationProgressSteps.length} complete`} />}
      >
        {showCreateForm ? (
          <>
            <div
              style={{
                border: "1px solid #d1d5db",
                borderRadius: "10px",
                padding: "12px",
                background: "#f9fafb",
                marginBottom: "16px",
              }}
            >
              <strong>Intake Progress:</strong> {completedInitiationSteps} / {initiationProgressSteps.length} complete ({initiationPercentComplete}%)
              <div
                style={{
                  height: "8px",
                  background: "#e5e7eb",
                  borderRadius: "999px",
                  overflow: "hidden",
                  marginTop: "8px",
                  maxWidth: "420px",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${initiationPercentComplete}%`,
                    background: initiationPercentComplete === 100 ? "#16a34a" : "#2563eb",
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "10px" }}>
                {initiationProgressSteps.map((step) => (
                  <span
                    key={step.label}
                    style={{
                      border: step.complete ? "1px solid #86efac" : "1px solid #d1d5db",
                      background: step.complete ? "#f0fdf4" : "white",
                      color: step.complete ? "#166534" : "#374151",
                      borderRadius: "999px",
                      padding: "4px 10px",
                      fontSize: "12px",
                      fontWeight: 600,
                    }}
                  >
                    {step.complete ? "✓" : "○"} {step.label}
                  </span>
                ))}
              </div>
            </div>

            <div
              style={{
                marginBottom: "16px",
                fontSize: "13px",
                color: draftSaveStatus === "saving" ? "#92400e" : "#166534",
              }}
            >
              {draftSaveStatus === "saving"
                ? "Saving intake draft…"
                : draftSaveStatus === "saved"
                ? "✓ Intake draft saved automatically in this browser."
                : "Intake draft autosave is ready."}
            </div>

            <SectionCard
              title="1. Initiation Information"
              subtitle="Capture issue description, detection source, department, date, and affected material."
              defaultOpen={true}
            >

        <div style={rowStyle}>
          <label>Issue Description</label>
          <br />
          <textarea
            value={issueDescription}
            onChange={(e) => setIssueDescription(e.target.value)}
            placeholder="Describe the issue observed"
            rows={4}
            style={textAreaStyle}
          />
        </div>

        <div style={rowStyle}>
          <label>Source of Detection</label>
          <br />
          <select
            value={sourceOfDetection}
            onChange={(e) => setSourceOfDetection(e.target.value)}
            style={fieldStyle}
          >
            <option value="">Select source</option>
            {renderOptions(detectionSourceOptions)}
          </select>
        </div>

        <div style={rowStyle}>
          <label>Department</label>
          <br />
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            style={fieldStyle}
          >
            <option value="">Select department</option>
            {renderOptions(departmentOptions)}
          </select>
        </div>

        <div style={rowStyle}>
          <label>Date Detected</label>
          <br />
          <div
            style={{
              display: "flex",
              gap: "8px",
              alignItems: "center",
              maxWidth: "720px",
            }}
          >
            <input
              type="text"
              value={dateDetected}
              onChange={(e) => setDateDetected(e.target.value)}
              onBlur={() => {
                const isoValue = dateDisplayToIso(dateDetected);
                if (isoValue) {
                  setDateDetected(formatDisplayDate(isoValue));
                }
              }}
              placeholder="09-Aug-2026"
              style={{ ...fieldStyle, flex: 1, marginTop: 0 }}
            />
            <button
              type="button"
              onClick={() => {
                const picker = dateDetectedPickerRef.current;
                if (!picker) return;

                const isoValue = dateDisplayToIso(dateDetected);
                if (isoValue) picker.value = isoValue;

                if (typeof (picker as any).showPicker === "function") {
                  (picker as any).showPicker();
                } else {
                  picker.click();
                }
              }}
              style={{ padding: "8px 12px", whiteSpace: "nowrap" }}
              aria-label="Choose Date Detected"
            >
              Calendar
            </button>
            <input
              ref={dateDetectedPickerRef}
              type="date"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => {
                if (e.target.value) {
                  setDateDetected(formatDisplayDate(e.target.value));
                }
              }}
              style={{
                position: "absolute",
                width: "1px",
                height: "1px",
                opacity: 0,
                pointerEvents: "none",
              }}
            />
          </div>
        </div>

        <div style={{ marginTop: "18px" }}>
          <h3>Affected Materials / Multiple Parts and Lots</h3>
          <p style={{ color: "#4b5563", fontSize: "14px" }}>
            All impacted products must be entered in this section.
          </p>
          <p style={{ color: "#4b5563", fontSize: "14px" }}>
            Add all impacted products, lots, work orders, affected quantities, and quarantined quantities here.
            This section is the controlled source for impacted product information.
          </p>

          {affectedItems.map((item, index) => (
            <div
              key={index}
              style={{
                border: "1px solid #d1d5db",
                borderRadius: "8px",
                padding: "12px",
                marginBottom: "12px",
                background: "#f9fafb",
              }}
            >
              <div>
                <strong>Affected Item {index + 1}</strong>
                {(item.product_part_number || item.part_description || item.part_revision) ? (
                  <div style={{ color: "#4b5563", fontSize: "13px", marginTop: "4px" }}>
                    {[item.product_part_number, item.part_description, item.part_revision]
                      .filter(Boolean)
                      .join(" • ")}
                  </div>
                ) : null}
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: "10px",
                  marginTop: "10px",
                }}
              >
                <div>
                  <label>Part Number</label>
                  <br />
                  <select
                    value={item.product_part_number}
                    onChange={(e) =>
                      updateAffectedPartNumber(index, e.target.value)
                    }
                    style={{ width: "100%", padding: "8px" }}
                  >
                    <option value="">Select part number</option>
                    {renderOptions(partNumberOptions)}
                  </select>
                </div>

                <div>
                  <label>Part Description</label>
                  <br />
                  <input
                    value={item.part_description}
                    onChange={(e) =>
                      updateAffectedItem(index, "part_description", e.target.value)
                    }
                    placeholder="Part description"
                    style={{ width: "100%", padding: "8px" }}
                  />
                </div>

                <div>
                  <label>Part Revision</label>
                  <br />
                  <input
                    value={item.part_revision}
                    onChange={(e) =>
                      updateAffectedItem(index, "part_revision", e.target.value)
                    }
                    placeholder="Part revision"
                    style={{ width: "100%", padding: "8px" }}
                  />
                </div>

                <div>
                  <label>Lot Number</label>
                  <br />
                  <input
                    value={item.lot_number}
                    onChange={(e) => updateAffectedItem(index, "lot_number", e.target.value)}
                    placeholder="Lot number"
                    style={{ width: "100%", padding: "8px" }}
                  />
                </div>

                <div>
                  <label>Work Order</label>
                  <br />
                  <input
                    value={item.workorder_number}
                    onChange={(e) =>
                      updateAffectedItem(index, "workorder_number", e.target.value)
                    }
                    placeholder="Work order"
                    style={{ width: "100%", padding: "8px" }}
                  />
                </div>

                <div>
                  <label>Qty Affected</label>
                  <br />
                  <input
                    type="number"
                    value={item.quantity_affected}
                    onChange={(e) =>
                      updateAffectedItem(index, "quantity_affected", e.target.value)
                    }
                    style={{ width: "100%", padding: "8px" }}
                  />
                </div>

                <div>
                  <label>Qty Quarantined</label>
                  <br />
                  <input
                    type="number"
                    value={item.quarantined_quantity}
                    onChange={(e) =>
                      updateAffectedItem(index, "quarantined_quantity", e.target.value)
                    }
                    style={{ width: "100%", padding: "8px" }}
                  />
                </div>

                <div>
                  <label>Defect Category</label>
                  <br />
                  <select
                    value={item.defect_category}
                    onChange={(e) =>
                      updateAffectedItem(index, "defect_category", e.target.value)
                    }
                    style={{ width: "100%", padding: "8px" }}
                  >
                    <option value="">Select defect category</option>
                    {renderOptions(defectCategoryOptions)}
                  </select>
                </div>

                <div>
                  <label>Defect Subcategory</label>
                  <br />
                  <select
                    value={item.defect_subcategory}
                    onChange={(e) =>
                      updateAffectedItem(index, "defect_subcategory", e.target.value)
                    }
                    disabled={!item.defect_category}
                    style={{ width: "100%", padding: "8px" }}
                  >
                    <option value="">Select defect subcategory</option>
                    {getDefectSubcategoriesForCategory(item.defect_category).map((option) => (
                      <option key={option.code} value={option.code}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

              </div>

              <button
                type="button"
                onClick={() => removeAffectedItem(index)}
                style={{ marginTop: "10px" }}
              >
                Remove Item
              </button>
            </div>
          ))}

          <button type="button" onClick={addAffectedItem}>
            + Add Another Affected Item
          </button>
        </div>
      
            </SectionCard>

            <SectionCard
              title="2. Containment"
              subtitle="Document immediate containment action, owner, material status, and quarantined quantity."
              defaultOpen={false}
            >


        <div style={rowStyle}>
          <label>Containment Action</label>
          <br />
          <textarea
            value={containmentAction}
            onChange={(e) => setContainmentAction(e.target.value)}
            placeholder="Describe immediate containment action taken"
            rows={3}
            style={textAreaStyle}
          />
        </div>

        <div style={rowStyle}>
          <label>Containment Owner</label>
          <br />
          <input
            value={containmentOwner}
            onChange={(e) => setContainmentOwner(e.target.value)}
            placeholder="Containment owner"
            style={fieldStyle}
          />
        </div>

        <div style={rowStyle}>
          <label>Material Status</label>
          <br />
          <select
            value={materialStatus}
            onChange={(e) => setMaterialStatus(e.target.value)}
            style={fieldStyle}
          >
            <option value="">Select material status</option>
            {renderOptions(materialStatusOptions)}
          </select>
        </div>

        <div style={rowStyle}>
          <label>Quarantined Quantity</label>
          <br />
          <input
            type="number"
            value={quarantinedQuantity}
            onChange={(e) => setQuarantinedQuantity(e.target.value)}
            placeholder="Quarantined quantity"
            style={fieldStyle}
          />
        </div>
      
            </SectionCard>

            <SectionCard
              title="3. Supplier Information (If Applicable)"
              subtitle="Capture only the supplier traceability information needed for a supplier-related NCMR."
              defaultOpen={isSupplierSource}
            >
              {!isSupplierSource ? (
                <div
                  style={{
                    border: "1px solid #d1d5db",
                    borderRadius: "8px",
                    padding: "12px",
                    background: "#f3f4f6",
                    color: "#6b7280",
                  }}
                >
                  Supplier information is not required because Source of Detection is not supplier-related.
                </div>
              ) : (
                <>
                  <div style={rowStyle}>
                    <label>Supplier</label>
                    <br />
                    <select
                      value={supplierId}
                      onChange={(e) => {
                        const selectedId = e.target.value;
                        const supplier = supplierOptions.find((item) => item.id === selectedId) || null;
                        setSupplierId(selectedId);
                        setSupplierName(supplier?.supplier_name || "");
                      }}
                      style={fieldStyle}
                    >
                      <option value="">Select supplier</option>
                      {supplierOptions.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.supplier_number ? `${supplier.supplier_number} - ` : ""}
                          {supplier.supplier_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={rowStyle}>
                    <label>Supplier ID</label>
                    <br />
                    <input
                      value={selectedSupplier?.supplier_number || ""}
                      readOnly
                      placeholder="Auto-populated from selected supplier"
                      style={{ ...fieldStyle, background: "#f3f4f6" }}
                    />
                  </div>

                  <div style={rowStyle}>
                    <label>Purchase Order (PO)</label>
                    <br />
                    <input
                      value={purchaseOrderNumber}
                      onChange={(e) => setPurchaseOrderNumber(e.target.value)}
                      placeholder="Purchase order number"
                      style={fieldStyle}
                    />
                  </div>

                  <div style={rowStyle}>
                    <label>Supplier Lot</label>
                    <br />
                    <input
                      value={supplierLot}
                      onChange={(e) => setSupplierLot(e.target.value)}
                      placeholder="Supplier lot"
                      style={fieldStyle}
                    />
                  </div>

                  {selectedSupplier ? (
                    <div>
                      <a href={`/suppliers/${selectedSupplier.id}`} target="_blank" rel="noreferrer">
                        Open Supplier Profile
                      </a>
                    </div>
                  ) : null}
                </>
              )}
            </SectionCard>

            <SectionCard
              title="4. Additional Information and Ownership"
              subtitle="Capture the location, immediate correction, and responsible NCMR owner."
              defaultOpen={false}
            >
              <div style={rowStyle}>
                <label>Site / Location</label>
                <br />
                <input
                  value={siteLocation}
                  onChange={(e) => setSiteLocation(e.target.value)}
                  placeholder="Site / room / line / location"
                  style={fieldStyle}
                />
              </div>

              <div style={rowStyle}>
                <label>Immediate Correction</label>
                <br />
                <textarea
                  value={immediateCorrection}
                  onChange={(e) => setImmediateCorrection(e.target.value)}
                  placeholder="Immediate correction taken"
                  rows={3}
                  style={textAreaStyle}
                />
              </div>

              <div style={rowStyle}>
                <label>NCMR Owner Email</label>
                <br />
                <input
                  type="email"
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  placeholder="owner@company.com"
                  style={fieldStyle}
                />
              </div>
            </SectionCard>

            <SectionCard
              title="5. Supporting Attachments (Optional)"
              subtitle="Attach photographs, inspection records, supplier documents, test results, or other evidence available when the NCMR is initiated."
              defaultOpen={false}
              rightAction={
                <StatusBadge
                  status={`${initiationAttachmentFiles.length} file${
                    initiationAttachmentFiles.length === 1 ? "" : "s"
                  } selected`}
                />
              }
            >
              <div style={rowStyle}>
                <label>Supporting Files</label>
                <br />
                <input
                  type="file"
                  multiple
                  onChange={(event) => {
                    addInitiationAttachmentFiles(event.target.files);
                    event.currentTarget.value = "";
                  }}
                  disabled={uploadingAttachments}
                  style={{ marginTop: "8px" }}
                />
                <p
                  style={{
                    color: "#4b5563",
                    fontSize: "13px",
                    marginBottom: 0,
                  }}
                >
                  Multiple files are allowed. Attachments are uploaded after
                  the NCMR record is created and become part of the controlled
                  quality record.
                </p>
              </div>

              {initiationAttachmentFiles.length > 0 ? (
                <div
                  style={{
                    display: "grid",
                    gap: "8px",
                    marginTop: "12px",
                  }}
                >
                  {initiationAttachmentFiles.map((file, index) => (
                    <div
                      key={`${file.name}-${file.size}-${file.lastModified}`}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "12px",
                        border: "1px solid #d1d5db",
                        borderRadius: "8px",
                        padding: "10px 12px",
                        background: "#f9fafb",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <strong
                          style={{
                            display: "block",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {file.name}
                        </strong>
                        <span
                          style={{
                            color: "#6b7280",
                            fontSize: "12px",
                          }}
                        >
                          {formatFileSize(file.size)}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          removeInitiationAttachmentFile(index)
                        }
                        disabled={uploadingAttachments}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: "#6b7280", marginBottom: 0 }}>
                  No supporting files selected.
                </p>
              )}
            </SectionCard>

            <ActionToolbar>
              <button
                onClick={addNcmr}
                style={primaryButtonStyle}
                disabled={uploadingAttachments}
              >
                {uploadingAttachments
                  ? "Creating NCMR / Uploading..."
                  : "Create NCMR"}
              </button>

              <button
                type="button"
                onClick={() => {
                  clearSavedIntakeDraft();
                  resetNcmrForm();
                  setShowCreateForm(false);
                }}
              >
                Cancel / Clear
              </button>
            </ActionToolbar>
          </>
        ) : (
          <EmptyStateCard
            title="NCMR intake form collapsed"
            message="Use + Create NCMR to open the intake form."
            action={
              <button
                type="button"
                onClick={() => setShowCreateForm(true)}
                style={primaryButtonStyle}
              >
                + Create NCMR
              </button>
            }
          />
        )}
      </SectionCard>

      <SectionCard
        title="Existing NCMRs"
        subtitle="Search, filter, and open existing NCMR workflows."
        defaultOpen={true}
      >

      <section style={sectionStyle}>
        <h3 style={{ marginTop: 0 }}>Search / Filters</h3>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by NCMR number, issue description, part, lot, PO, supplier, owner"
          style={{ ...fieldStyle, maxWidth: "650px", marginRight: "10px" }}
        />

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ padding: "8px", marginRight: "10px", marginBottom: "8px" }}
        >
          <option value="">All Statuses</option>
          <option value="open">Open</option>
          <option value="investigation">Investigation</option>
          <option value="in_review">In Review</option>
          <option value="closed">Closed</option>
        </select>

        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          style={{ padding: "8px", marginRight: "10px", marginBottom: "8px" }}
        >
          <option value="">All Severities</option>
          <option value="not_assessed">Not Assessed</option>
          <option value="minor">Minor</option>
          <option value="major">Major</option>
          <option value="critical">Critical</option>
        </select>

        <button
          onClick={() => {
            setSearch("");
            setStatusFilter("");
            setSeverityFilter("");
          }}
        >
          Clear Filters
        </button>

        <div style={{ marginTop: "10px", fontSize: "14px", color: "#4b5563" }}>
          Showing {filteredList.length} of {list.length} NCMR record(s)
        </div>
      </section>

      {list.length === 0 ? (
        <EmptyStateCard
          title="No NCMRs created yet"
          message="Use the intake form above to create the first NCMR record."
        />
      ) : filteredList.length === 0 ? (
        <EmptyStateCard
          title="No NCMRs match the selected filters"
          message="Adjust or clear the filters to view more records."
        />
      ) : (
        <div style={{ display: "grid", gap: "16px" }}>
          {filteredList.map((item) => {
            const statusColor =
              item.status === "closed"
                ? "#16a34a"
                : item.status === "open"
                ? "#2563eb"
                : "#f59e0b";

            const severityColor =
              item.severity === "critical"
                ? "#dc2626"
                : item.severity === "major"
                ? "#f59e0b"
                : item.severity === "minor"
                ? "#16a34a"
                : "#6b7280";

            return (
              <article
                key={item.id}
                style={{
                  border: "1px solid #d1d5db",
                  borderRadius: "12px",
                  padding: "16px",
                  background: "#fff",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "12px",
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <h3 style={{ margin: "0 0 6px 0" }}>
                      {item.ncmr_number || "NCMR-PENDING"}
                    </h3>
                    <div style={{ color: "#4b5563", fontSize: "14px" }}>
                      {item.issue_description || "No issue description provided."}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <span style={{ ...badgeStyle, background: statusColor }}>
                      {item.status || "unknown"}
                    </span>
                    <span style={{ ...badgeStyle, background: severityColor }}>
                      {item.severity || "not_assessed"}
                    </span>
                  </div>
                </div>

                <div style={{ marginTop: "10px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {item.recurring_issue ? (
                    <span style={{ ...badgeStyle, background: "#f59e0b" }}>Recurring</span>
                  ) : null}
                  {item.capa_required ? (
                    <span style={{ ...badgeStyle, background: "#dc2626" }}>CAPA Evaluation Required</span>
                  ) : null}
                  {item.supplier_capa_required ? (
                    <span style={{ ...badgeStyle, background: "#7c3aed" }}>Supplier CAPA / SCAR</span>
                  ) : null}
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "8px",
                    marginTop: "14px",
                    fontSize: "14px",
                  }}
                >
                  <div><strong>Part:</strong> {item.product_part_number || "N/A"}</div>
                  <div><strong>Lot:</strong> {item.lot_number || "N/A"}</div>
                  <div><strong>Work Order:</strong> {item.workorder_number || "N/A"}</div>
                  <div><strong>Source:</strong> {item.source_of_detection || "N/A"}</div>
                  <div><strong>Department:</strong> {item.department || "N/A"}</div>
                  <div><strong>Detected:</strong> {formatNcmrDate(item.date_detected)}</div>
                  <div><strong>Qty Affected:</strong> {item.quantity_affected ?? "N/A"}</div>
                  <div><strong>Material Status:</strong> {item.material_status || "N/A"}<br />
                    <strong>Containment Completed:</strong>{" "}
                    {item.containment_completed_at
                      ? formatNcmrDate(item.containment_completed_at)
                      : "Pending"}</div>
                  <div><strong>Supplier:</strong> {item.supplier_name || "N/A"}</div>
                  <div><strong>PO:</strong> {item.purchase_order_number || "N/A"}</div>
                  <div><strong>Supplier Lot:</strong> {item.supplier_lot || "N/A"}</div>
                  <div><strong>Owner:</strong> {item.owner || "N/A"}</div>
                </div>

                {(item.recurrence_reason || item.supplier_capa_reason) ? (
                  <div
                    style={{
                      marginTop: "12px",
                      padding: "10px",
                      background: "#f9fafb",
                      borderRadius: "8px",
                      fontSize: "14px",
                    }}
                  >
                    {item.recurrence_reason ? (
                      <div><strong>Recurrence Reason:</strong> {item.recurrence_reason}</div>
                    ) : null}
                    {item.supplier_capa_reason ? (
                      <div><strong>Supplier CAPA / SCAR Reason:</strong> {item.supplier_capa_reason}</div>
                    ) : null}
                  </div>
                ) : null}

                <div style={{ marginTop: "14px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <a
                    href={`/ncmrs/${item.id}`}
                    style={{
                      display: "inline-block",
                      background: "#2563eb",
                      color: "white",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      textDecoration: "none",
                    }}
                  >
                    Open Workflow
                  </a>

                  <a
                    href={`/ncmrs/${item.id}/report`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "inline-block",
                      background:
                        item.status === "closed"
                          ? "#16a34a"
                          : item.status === "draft"
                          ? "#6b7280"
                          : "#3b82f6",
                      color: "white",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      textDecoration: "none",
                    }}
                  >
                    NCMR Report
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      )}
      </SectionCard>
    </main>
  );
}
