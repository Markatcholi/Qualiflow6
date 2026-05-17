"use client";

import { useEffect, useMemo, useState } from "react";
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
  supplier_status: string | null;
  supplier_risk_level: string | null;
  primary_contact_email: string | null;
};

type AffectedItemInput = {
  product_part_number: string;
  lot_number: string;
  workorder_number: string;
  quantity_affected: string;
  quarantined_quantity: string;
};

type Ncmr = {
  id: string;
  ncmr_number: string | null;
  title: string | null;
  issue_description: string | null;
  product_part_number: string | null;
  lot_number: string | null;
  workorder_number: string | null;
  source_of_detection: string | null;
  department: string | null;
  date_detected: string | null;
  quantity_affected: number | null;
  containment_action: string | null;
  containment_owner: string | null;
  material_status: string | null;
  quarantined_quantity: number | null;
  defect_category: string | null;
  defect_subcategory: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  supplier_lot: string | null;
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
  const [title, setTitle] = useState("");
  const [issueDescription, setIssueDescription] = useState("");
  const [sourceOfDetection, setSourceOfDetection] = useState("");
  const [department, setDepartment] = useState("");
  const [dateDetected, setDateDetected] = useState("");
  const [containmentAction, setContainmentAction] = useState("");
  const [containmentOwner, setContainmentOwner] = useState("");
  const [materialStatus, setMaterialStatus] = useState("");
  const [quarantinedQuantity, setQuarantinedQuantity] = useState("");
  const [defectCategory, setDefectCategory] = useState("");
  const [defectSubcategory, setDefectSubcategory] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [supplierLot, setSupplierLot] = useState("");
  const [supplierScarRecommended, setSupplierScarRecommended] = useState(false);
  const [supplierScarDecision, setSupplierScarDecision] = useState("");
  const [supplierScarDecisionJustification, setSupplierScarDecisionJustification] = useState("");
  const [siteLocation, setSiteLocation] = useState("");
  const [immediateCorrection, setImmediateCorrection] = useState("");
  const [owner, setOwner] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(true);

  const [affectedItems, setAffectedItems] = useState<AffectedItemInput[]>([
    {
      product_part_number: "",
      lot_number: "",
      workorder_number: "",
      quantity_affected: "",
      quarantined_quantity: "",
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

  const filteredDefectSubcategories = useMemo(() => {
    return defectSubcategoryOptions.filter(
      (item) => item.category_code === defectCategory
    );
  }, [defectSubcategoryOptions, defectCategory]);

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
      supabase.from("md_product_part_numbers").select("code, label").order("label"),
      supabase.from("md_detection_sources").select("code, label").order("label"),
      supabase.from("md_departments").select("code, label").order("label"),
      supabase.from("md_material_statuses").select("code, label").order("label"),
      supabase.from("md_defect_categories").select("code, label").order("label"),
      supabase.from("md_defect_subcategories").select("category_code, code, label").order("label"),
      supabase
        .from("suppliers")
        .select("id, supplier_name, supplier_number, supplier_status, supplier_risk_level, primary_contact_email")
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

    setList((data as Ncmr[]) || []);
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
    const primaryAffectedItem = affectedItems.find(
      (item) => item.product_part_number || item.lot_number || item.workorder_number
    );

    const primaryPartNumber = primaryAffectedItem?.product_part_number || "";

    if (!primaryPartNumber || !defectCategory) {
      return { recurring: false, reason: "" };
    }

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const { data, error } = await supabase
      .from("ncmrs")
      .select("id")
      .eq("product_part_number", primaryPartNumber)
      .eq("defect_category", defectCategory)
      .gte("created_at", sixtyDaysAgo.toISOString());

    if (error) {
      alert(error.message);
      return { recurring: false, reason: "" };
    }

    const count = data?.length || 0;

    if (count > 0) {
      return {
        recurring: true,
        reason: `Recurring issue detected: ${count} prior NCMR(s) with same affected part number and defect category in the last 60 days.`,
      };
    }

    return { recurring: false, reason: "" };
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
        lot_number: "",
        workorder_number: "",
        quantity_affected: "",
        quarantined_quantity: "",
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
    };
    setAffectedItems(updated);
  };

  const removeAffectedItem = (index: number) => {
    if (affectedItems.length === 1) {
      setAffectedItems([
        {
          product_part_number: "",
          lot_number: "",
          workorder_number: "",
          quantity_affected: "",
          quarantined_quantity: "",
            },
      ]);
      return;
    }

    const updated = [...affectedItems];
    updated.splice(index, 1);
    setAffectedItems(updated);
  };


  const resetNcmrForm = () => {
    setTitle("");
    setIssueDescription("");
    setSourceOfDetection("");
    setDepartment("");
    setDateDetected("");
    setContainmentAction("");
    setContainmentOwner("");
    setMaterialStatus("");
    setQuarantinedQuantity("");
    setDefectCategory("");
    setDefectSubcategory("");
    setSupplierId("");
    setSupplierName("");
    setSupplierLot("");
    setSupplierScarRecommended(false);
    setSupplierScarDecision("");
    setSupplierScarDecisionJustification("");
    setSiteLocation("");
    setImmediateCorrection("");
    setOwner("");
    setAffectedItems([
      {
        product_part_number: "",
        lot_number: "",
        workorder_number: "",
        quantity_affected: "",
        quarantined_quantity: "",
      },
    ]);
  };

  const createScarFromInitiatedNcmr = async (ncmrRecord: any, createdByEmail: string) => {
    if (supplierScarDecision !== "yes") {
      return null;
    }

    if (!supplierId) {
      alert("SCAR was selected, but no supplier was selected. NCMR was created, but SCAR was not created.");
      return null;
    }

    const scarTitle = `SCAR from ${ncmrRecord?.ncmr_number || ncmrRecord?.title || "NCMR"}`;
    const firstAffectedItem: any = affectedItems?.[0] || {};

    const scarProblemDescription = [
      "SCAR initiated from NCMR initiation.",
      title ? `NCMR Title: ${title}` : "",
      issueDescription ? `Issue: ${issueDescription}` : "",
      defectCategory ? `Defect Category: ${defectCategory}` : "",
      defectSubcategory ? `Defect Subcategory: ${defectSubcategory}` : "",
      firstAffectedItem.product_part_number ? `Part Number: ${firstAffectedItem.product_part_number}` : "",
      firstAffectedItem.lot_number ? `Lot Number: ${firstAffectedItem.lot_number}` : "",
      supplierLot ? `Supplier Lot: ${supplierLot}` : "",
      supplierScarDecision ? `Initial SCAR Decision: ${supplierScarDecision}` : "",
      supplierScarDecisionJustification ? `Initial SCAR Justification: ${supplierScarDecisionJustification}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const scarPayload: any = {
      title: scarTitle,
      scar_title: scarTitle,
      status: "open",
      scar_status: "open",
      source_type: "ncmr",
      source_ncmr_id: ncmrRecord.id,
      linked_supplier_id: supplierId,
      supplier_id: supplierId,
      problem_description: scarProblemDescription,
      issue_description: scarProblemDescription,
      part_number: firstAffectedItem.product_part_number || null,
      lot_number: firstAffectedItem.lot_number || null,
      supplier_lot: supplierLot || null,
      created_from_module: "ncmr",
      created_by: createdByEmail,
    };

    const { data: scarData, error: scarError } = await supabase
      .from("scars")
      .insert(scarPayload)
      .select()
      .single();

    if (scarError) {
      alert(`NCMR was created, but SCAR creation failed: ${scarError.message}`);
      return null;
    }

    const { error: ncmrUpdateError } = await supabase
      .from("ncmrs")
      .update({
        linked_scar_id: scarData.id,
        scar_required: true,
        scar_justification: supplierScarDecisionJustification || null,
      })
      .eq("id", ncmrRecord.id);

    if (ncmrUpdateError) {
      alert(`SCAR was created, but NCMR link update failed: ${ncmrUpdateError.message}`);
      return scarData;
    }

    await supabase.from("audit_logs").insert([
      {
        entity_type: "ncmr",
        entity_id: ncmrRecord.id,
        action: "scar_created_from_ncmr_initiation",
        details: `SCAR created during NCMR initiation. SCAR title: ${scarTitle}.`,
        user_email: createdByEmail,
      },
      {
        entity_type: "scar",
        entity_id: scarData.id,
        action: "scar_created_from_ncmr_initiation",
        details: `SCAR created from NCMR initiation: ${ncmrRecord?.ncmr_number || ncmrRecord?.title || ncmrRecord.id}.`,
        user_email: createdByEmail,
      },
    ]);

    return scarData;
  };

  const addNcmr = async () => {
    if (!title) {
      alert("Title is required.");
      return;
    }

    const recurrence = await checkRecurrence();
    const supplierScar = await checkSupplierScar();

    const capaRequired = recurrence.recurring;
    const supplierNameForInsert = isSupplierSource
      ? selectedSupplier?.supplier_name || supplierName
      : "";
    const supplierLotForInsert = isSupplierSource ? supplierLot : "";
    const supplierIdForInsert = isSupplierSource ? supplierId || null : null;


    const { data, error } = await supabase
      .from("ncmrs")
      .insert({
        title,
        issue_description: issueDescription,
        product_part_number: null,
        lot_number: null,
        workorder_number: null,
        source_of_detection: sourceOfDetection,
        department,
        date_detected: dateDetected || null,
        quantity_affected: null,
        containment_action: containmentAction,
        containment_owner: containmentOwner,
        material_status: materialStatus,
        quarantined_quantity: quarantinedQuantity ? Number(quarantinedQuantity) : null,
        defect_category: defectCategory,
        defect_subcategory: defectSubcategory,
        supplier_id: supplierIdForInsert,
        supplier_name: supplierNameForInsert,
        supplier_lot: supplierLotForInsert,
        supplier_scar_recommended: supplierScar.required,
        supplier_scar_decision: supplierScar.required ? supplierScarDecision || null : null,
        supplier_scar_decision_justification:
          supplierScar.required && supplierScarDecision === "no"
            ? supplierScarDecisionJustification
            : null,
        site_location: siteLocation,
        immediate_correction: immediateCorrection,
        owner,
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

    await addAuditLog("ncmr", data.id, "created", `Created NCMR: ${title}`);

    const validAffectedItems = affectedItems.filter(
      (item) =>
        item.product_part_number ||
        item.lot_number ||
        item.workorder_number ||
        item.quantity_affected ||
        item.quarantined_quantity
    );

    if (validAffectedItems.length > 0) {
      const itemsToInsert = validAffectedItems.map((item) => ({
        ncmr_id: data.id,
        product_part_number: item.product_part_number || null,
        lot_number: item.lot_number || null,
        workorder_number: item.workorder_number || null,
        quantity_affected: item.quantity_affected
          ? Number(item.quantity_affected)
          : null,
        quarantined_quantity: item.quarantined_quantity
          ? Number(item.quarantined_quantity)
          : null,
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

      if (supplierScarDecision === "no") {
        await addAuditLog(
          "ncmr",
          data.id,
          "supplier_scar_not_initiated",
          supplierScarDecisionJustification || "SCAR was not initiated based on risk-based decision."
        );
      }
    }

    if (recurrence.recurring) {
      await addAuditLog(
        "ncmr",
        data.id,
        "capa_evaluation_required",
        `CAPA evaluation required due to recurrence. Risk-based decision required before CAPA creation. Reason: ${recurrence.reason}`
      );
    }

    await createScarFromInitiatedNcmr(data, currentUserEmail);

    resetNcmrForm();
    fetchData();
  };

  useEffect(() => {
    fetchMasterData();
    fetchData();
  }, []);

  useEffect(() => {
    if (filteredDefectSubcategories.length > 0) {
      const stillValid = filteredDefectSubcategories.some(
        (item) => item.code === defectSubcategory
      );

      if (!stillValid) {
        setDefectSubcategory(filteredDefectSubcategories[0].code);
      }
    } else {
      setDefectSubcategory("");
    }
  }, [defectCategory, defectSubcategoryOptions]);

  const renderOptions = (options: MasterOption[]) =>
    options.map((option) => (
      <option key={option.code} value={option.code}>
        {option.label}
      </option>
    ));

  const summaryCardStyle: React.CSSProperties = {
    border: "1px solid #d1d5db",
    borderRadius: "10px",
    padding: "14px",
    background: "#f9fafb",
  };

  const summaryLabelStyle: React.CSSProperties = {
    fontSize: "13px",
    color: "#4b5563",
    marginBottom: "4px",
  };

  const summaryValueStyle: React.CSSProperties = {
    fontSize: "24px",
    fontWeight: "bold",
  };

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
      item.title,
      item.issue_description,
      item.product_part_number,
      item.lot_number,
      item.workorder_number,
      item.supplier_name,
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
    { label: "Issue", complete: !!title && !!issueDescription },
    { label: "Detection", complete: !!sourceOfDetection && !!department && !!dateDetected },
    { label: "Affected Material", complete: affectedItems.some((item) => item.product_part_number || item.lot_number || item.workorder_number || item.quantity_affected) },
    { label: "Containment", complete: !!containmentAction || !!materialStatus },
    { label: "Defect", complete: !!defectCategory },
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
        subtitle="Capture the issue, affected material, containment, defect information, and owner."
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
            <SectionCard
              title="1. Initiation Information"
              subtitle="Capture title, issue description, detection source, department, date, and affected material."
              defaultOpen={true}
            >


        <div style={rowStyle}>
          <label>Title</label>
          <br />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Short NCMR title"
            style={fieldStyle}
          />
        </div>

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
          <input
            type="date"
            value={dateDetected}
            onChange={(e) => setDateDetected(e.target.value)}
            style={fieldStyle}
          />
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
              <strong>Affected Item {index + 1}</strong>

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
                      updateAffectedItem(index, "product_part_number", e.target.value)
                    }
                    style={{ width: "100%", padding: "8px" }}
                  >
                    <option value="">Select part number</option>
                    {renderOptions(partNumberOptions)}
                  </select>
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
              title="3. Defect / Supplier Information"
              subtitle="Capture defect category, supplier linkage when applicable, site, immediate correction, and owner."
              defaultOpen={false}
            >


        <div style={rowStyle}>
          <label>Defect Category</label>
          <br />
          <select
            value={defectCategory}
            onChange={(e) => setDefectCategory(e.target.value)}
            style={fieldStyle}
          >
            <option value="">Select defect category</option>
            {renderOptions(defectCategoryOptions)}
          </select>
        </div>

        <div style={rowStyle}>
          <label>Defect Subcategory</label>
          <br />
          <select
            value={defectSubcategory}
            onChange={(e) => setDefectSubcategory(e.target.value)}
            style={fieldStyle}
          >
            <option value="">Select defect subcategory</option>
            {filteredDefectSubcategories.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div
          style={{
            border: "1px solid #d1d5db",
            borderRadius: "8px",
            padding: "12px",
            marginBottom: "12px",
            background: isSupplierSource ? "#ffffff" : "#f3f4f6",
            opacity: isSupplierSource ? 1 : 0.65,
          }}
        >
          <h3 style={{ marginTop: 0 }}>Supplier Information</h3>

          {!isSupplierSource ? (
            <p style={{ color: "#6b7280", fontSize: "14px" }}>
              Supplier fields are disabled because Source of Detection is not supplier-related.
            </p>
          ) : null}

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
              disabled={!isSupplierSource}
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

          {selectedSupplier ? (
            <div
              style={{
                border: "1px solid #d1d5db",
                borderRadius: "8px",
                padding: "10px",
                background: "#f9fafb",
                marginBottom: "12px",
              }}
            >
              <strong>Selected Supplier Summary</strong>
              <div><strong>Status:</strong> {selectedSupplier.supplier_status || "N/A"}</div>
              <div><strong>Risk Level:</strong> {selectedSupplier.supplier_risk_level || "N/A"}</div>
              <div><strong>Contact Email:</strong> {selectedSupplier.primary_contact_email || "N/A"}</div>
              <div>
                <a href={`/suppliers/${selectedSupplier.id}`} target="_blank" rel="noreferrer">
                  Open Supplier Profile
                </a>
              </div>
            </div>
          ) : null}

          <div style={rowStyle}>
            <label>Supplier Lot</label>
            <br />
            <input
              value={supplierLot}
              onChange={(e) => setSupplierLot(e.target.value)}
              placeholder="Supplier lot"
              disabled={!isSupplierSource}
              style={fieldStyle}
            />
          </div>

          {isSupplierSource ? (
            <div
              style={{
                border: "1px solid #f59e0b",
                background: "#fffbeb",
                padding: "12px",
                borderRadius: "8px",
                marginTop: "12px",
                marginBottom: "12px",
              }}
            >
              <strong>Supplier SCAR Risk-Based Decision</strong>
              <p style={{ marginTop: "8px" }}>
                If supplier escalation criteria are met when this NCMR is created, decide whether to initiate a SCAR.
              </p>

              <div style={{ marginBottom: "10px" }}>
                <button
                  type="button"
                  onClick={() => setSupplierScarDecision("yes")}
                  style={{
                    marginRight: "8px",
                    background: supplierScarDecision === "yes" ? "#16a34a" : undefined,
                    color: supplierScarDecision === "yes" ? "white" : undefined,
                  }}
                >
                  Yes - Initiate SCAR if recommended
                </button>

                <button
                  type="button"
                  onClick={() => setSupplierScarDecision("no")}
                  style={{
                    background: supplierScarDecision === "no" ? "#dc2626" : undefined,
                    color: supplierScarDecision === "no" ? "white" : undefined,
                  }}
                >
                  No - Do Not Initiate SCAR
                </button>
              </div>

              {supplierScarDecision === "no" ? (
                <div>
                  <label>Justification for not initiating SCAR</label>
                  <br />
                  <textarea
                    value={supplierScarDecisionJustification}
                    onChange={(e) => setSupplierScarDecisionJustification(e.target.value)}
                    rows={4}
                    style={{
                      width: "100%",
                      maxWidth: "800px",
                      padding: "8px",
                    }}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

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
          <label>Owner</label>
          <br />
          <input
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            placeholder="Owner"
            style={fieldStyle}
          />
        </div>
      
            </SectionCard>

            <ActionToolbar>
              <button onClick={addNcmr} style={primaryButtonStyle}>
                Create NCMR
              </button>

              <button
                type="button"
                onClick={() => {
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
          placeholder="Search by title, NCMR number, part, lot, supplier, owner"
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

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "12px",
          marginBottom: "20px",
        }}
      >
        <div style={summaryCardStyle}>
          <div style={summaryLabelStyle}>Total NCMRs</div>
          <div style={summaryValueStyle}>{list.length}</div>
        </div>
        <div style={summaryCardStyle}>
          <div style={summaryLabelStyle}>Open / Active</div>
          <div style={summaryValueStyle}>{list.filter((x) => x.status !== "closed").length}</div>
        </div>
        <div style={summaryCardStyle}>
          <div style={summaryLabelStyle}>CAPA Evaluation Required</div>
          <div style={summaryValueStyle}>{list.filter((x) => x.capa_required).length}</div>
        </div>
        <div style={summaryCardStyle}>
          <div style={summaryLabelStyle}>Recurring Issues</div>
          <div style={summaryValueStyle}>{list.filter((x) => x.recurring_issue).length}</div>
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
                      {item.ncmr_number || "NCMR-PENDING"} — {item.title || "Untitled NCMR"}
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
                  <div><strong>Detected:</strong> {item.date_detected || "N/A"}</div>
                  <div><strong>Qty Affected:</strong> {item.quantity_affected ?? "N/A"}</div>
                  <div><strong>Material Status:</strong> {item.material_status || "N/A"}</div>
                  <div><strong>Defect:</strong> {item.defect_category || "N/A"}</div>
                  <div><strong>Subcategory:</strong> {item.defect_subcategory || "N/A"}</div>
                  <div><strong>Supplier:</strong> {item.supplier_name || "N/A"}</div>
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
