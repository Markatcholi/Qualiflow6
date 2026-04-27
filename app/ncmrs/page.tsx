"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type MasterOption = {
  code: string;
  label: string;
};

type DefectSubcategoryOption = {
  category_code: string;
  code: string;
  label: string;
};

type Ncmr = {
  id: string;
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
  const [productPartNumber, setProductPartNumber] = useState("");
  const [lotNumber, setLotNumber] = useState("");
  const [workorderNumber, setWorkorderNumber] = useState("");
  const [sourceOfDetection, setSourceOfDetection] = useState("");
  const [department, setDepartment] = useState("");
  const [dateDetected, setDateDetected] = useState("");
  const [quantityAffected, setQuantityAffected] = useState("");
  const [containmentAction, setContainmentAction] = useState("");
  const [containmentOwner, setContainmentOwner] = useState("");
  const [materialStatus, setMaterialStatus] = useState("");
  const [quarantinedQuantity, setQuarantinedQuantity] = useState("");
  const [defectCategory, setDefectCategory] = useState("");
  const [defectSubcategory, setDefectSubcategory] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [supplierLot, setSupplierLot] = useState("");
  const [siteLocation, setSiteLocation] = useState("");
  const [immediateCorrection, setImmediateCorrection] = useState("");
  const [owner, setOwner] = useState("");

  const [list, setList] = useState<Ncmr[]>([]);

  const [partNumberOptions, setPartNumberOptions] = useState<MasterOption[]>([]);
  const [detectionSourceOptions, setDetectionSourceOptions] = useState<MasterOption[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<MasterOption[]>([]);
  const [materialStatusOptions, setMaterialStatusOptions] = useState<MasterOption[]>([]);
  const [defectCategoryOptions, setDefectCategoryOptions] = useState<MasterOption[]>([]);
  const [defectSubcategoryOptions, setDefectSubcategoryOptions] = useState<DefectSubcategoryOption[]>([]);

  const filteredDefectSubcategories = useMemo(() => {
    return defectSubcategoryOptions.filter(
      (item) => item.category_code === defectCategory
    );
  }, [defectSubcategoryOptions, defectCategory]);

  const fieldStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: "500px",
    padding: "8px",
    marginTop: "4px",
  };

  const textAreaStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: "800px",
    padding: "8px",
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
    ] = await Promise.all([
      supabase.from("md_product_part_numbers").select("code, label").order("label"),
      supabase.from("md_detection_sources").select("code, label").order("label"),
      supabase.from("md_departments").select("code, label").order("label"),
      supabase.from("md_material_statuses").select("code, label").order("label"),
      supabase.from("md_defect_categories").select("code, label").order("label"),
      supabase.from("md_defect_subcategories").select("category_code, code, label").order("label"),
    ]);

    if (partNumbersRes.error) return alert(partNumbersRes.error.message);
    if (detectionRes.error) return alert(detectionRes.error.message);
    if (departmentsRes.error) return alert(departmentsRes.error.message);
    if (materialRes.error) return alert(materialRes.error.message);
    if (defectCategoryRes.error) return alert(defectCategoryRes.error.message);
    if (defectSubcategoryRes.error) return alert(defectSubcategoryRes.error.message);

    setPartNumberOptions(partNumbersRes.data || []);
    setDetectionSourceOptions(detectionRes.data || []);
    setDepartmentOptions(departmentsRes.data || []);
    setMaterialStatusOptions(materialRes.data || []);
    setDefectCategoryOptions(defectCategoryRes.data || []);
    setDefectSubcategoryOptions(defectSubcategoryRes.data || []);
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
    if (!productPartNumber || !defectCategory) {
      return { recurring: false, reason: "" };
    }

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const { data, error } = await supabase
      .from("ncmrs")
      .select("id")
      .eq("product_part_number", productPartNumber)
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
        reason: `Recurring issue detected: ${count} prior NCMR(s) with same part number and defect category in the last 60 days.`,
      };
    }

    return { recurring: false, reason: "" };
  };

  const checkSupplierScar = async () => {
    if (!supplierName.trim()) {
      return { required: false, reason: "" };
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data, error } = await supabase
      .from("ncmrs")
      .select("id")
      .ilike("supplier_name", supplierName.trim())
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
        reason: `Supplier CAPA/SCAR required: ${supplierName} has ${totalWithNewRecord} NCMR(s) in the last 30 days.`,
      };
    }

    return { required: false, reason: "" };
  };

  const addNcmr = async () => {
    if (!title) {
      alert("Title is required.");
      return;
    }

    const recurrence = await checkRecurrence();
    const supplierScar = await checkSupplierScar();

    const capaRequired = recurrence.recurring || supplierScar.required;

    const { data, error } = await supabase
      .from("ncmrs")
      .insert({
        title,
        issue_description: issueDescription,
        product_part_number: productPartNumber,
        lot_number: lotNumber,
        workorder_number: workorderNumber,
        source_of_detection: sourceOfDetection,
        department,
        date_detected: dateDetected || null,
        quantity_affected: quantityAffected ? Number(quantityAffected) : null,
        containment_action: containmentAction,
        containment_owner: containmentOwner,
        material_status: materialStatus,
        quarantined_quantity: quarantinedQuantity ? Number(quarantinedQuantity) : null,
        defect_category: defectCategory,
        defect_subcategory: defectSubcategory,
        supplier_name: supplierName,
        supplier_lot: supplierLot,
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

    if (recurrence.recurring) {
      await addAuditLog("ncmr", data.id, "recurrence_detected", recurrence.reason);
    }

    if (supplierScar.required) {
      await addAuditLog("ncmr", data.id, "supplier_scar_required", supplierScar.reason);

      const { data: scarData, error: scarError } = await supabase
        .from("capas")
        .insert({
          ncmr_id: data.id,
          title: `SCAR for ${supplierName}`,
          linked_ncmr_title: title,
          source_type: "supplier_quality",
          capa_source: "Supplier recurrence",
          capa_type: "scar",
          supplier_name: supplierName,
          scar_required: true,
          scar_reason: supplierScar.reason,
          problem_description:
            issueDescription || `Supplier recurrence identified for ${supplierName}`,
          status: "open",
        })
        .select()
        .single();

      if (scarError) {
        alert(scarError.message);
        return;
      }

      await supabase
        .from("ncmrs")
        .update({
          capa_id: scarData.id,
          capa_required: true,
        })
        .eq("id", data.id);

      await addAuditLog(
        "ncmr",
        data.id,
        "scar_created",
        `Supplier CAPA/SCAR automatically created for supplier: ${supplierName}`
      );
    } else if (recurrence.recurring) {
      const { data: capaData, error: capaError } = await supabase
        .from("capas")
        .insert({
          ncmr_id: data.id,
          title: `CAPA for ${title}`,
          linked_ncmr_title: title,
          source_type: "ncmr",
          capa_source: "Recurring NCMR",
          capa_type: "internal_capa",
          problem_description: issueDescription || title,
          status: "open",
        })
        .select()
        .single();

      if (capaError) {
        alert(capaError.message);
        return;
      }

      await supabase
        .from("ncmrs")
        .update({ capa_id: capaData.id })
        .eq("id", data.id);

      await addAuditLog(
        "ncmr",
        data.id,
        "capa_triggered",
        "CAPA automatically created due to recurring issue."
      );
    }

    setTitle("");
    setIssueDescription("");
    setProductPartNumber("");
    setLotNumber("");
    setWorkorderNumber("");
    setSourceOfDetection("");
    setDepartment("");
    setDateDetected("");
    setQuantityAffected("");
    setContainmentAction("");
    setContainmentOwner("");
    setMaterialStatus("");
    setQuarantinedQuantity("");
    setDefectCategory("");
    setDefectSubcategory("");
    setSupplierName("");
    setSupplierLot("");
    setSiteLocation("");
    setImmediateCorrection("");
    setOwner("");

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

  return (
    <main style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>NCMR Initiation</h1>

      <section style={sectionStyle}>
        <h2>1. Initiation Information</h2>

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
          <label>Product Part Number</label>
          <br />
          <select
            value={productPartNumber}
            onChange={(e) => setProductPartNumber(e.target.value)}
            style={fieldStyle}
          >
            <option value="">Select part number</option>
            {renderOptions(partNumberOptions)}
          </select>
        </div>

        <div style={rowStyle}>
          <label>Lot Number</label>
          <br />
          <input
            value={lotNumber}
            onChange={(e) => setLotNumber(e.target.value)}
            placeholder="Lot number"
            style={fieldStyle}
          />
        </div>

        <div style={rowStyle}>
          <label>Work Order Number</label>
          <br />
          <input
            value={workorderNumber}
            onChange={(e) => setWorkorderNumber(e.target.value)}
            placeholder="Work order number"
            style={fieldStyle}
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

        <div style={rowStyle}>
          <label>Quantity Affected</label>
          <br />
          <input
            type="number"
            value={quantityAffected}
            onChange={(e) => setQuantityAffected(e.target.value)}
            placeholder="Quantity affected"
            style={fieldStyle}
          />
        </div>
      </section>

      <section style={sectionStyle}>
        <h2>2. Containment</h2>

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
      </section>

      <section style={sectionStyle}>
        <h2>3. Defect / Supplier Information</h2>

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

        <div style={rowStyle}>
          <label>Supplier Name</label>
          <br />
          <input
            value={supplierName}
            onChange={(e) => setSupplierName(e.target.value)}
            placeholder="Supplier name"
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
      </section>

      <button onClick={addNcmr} style={{ padding: "10px 16px", marginBottom: "25px" }}>
        Create NCMR
      </button>

      <h2>Existing NCMRs</h2>

      {list.length === 0 ? (
        <p>No NCMRs created yet.</p>
      ) : (
        <ul>
          {list.map((item) => (
            <li
              key={item.id}
              style={{
                marginBottom: "18px",
                border: "1px solid #ddd",
                padding: "12px",
                borderRadius: "8px",
              }}
            >
              <strong>{item.title}</strong> — {item.status}

              {item.recurring_issue ? (
                <span style={{ color: "orange", marginLeft: "10px" }}>
                  Recurring Issue
                </span>
              ) : null}

              {item.capa_required ? (
                <span style={{ color: "red", marginLeft: "10px" }}>
                  CAPA Required
                </span>
              ) : null}

              {item.supplier_capa_required ? (
                <span style={{ color: "purple", marginLeft: "10px" }}>
                  Supplier CAPA / SCAR Required
                </span>
              ) : null}

              <div style={{ marginTop: "8px" }}>
                <div><strong>Issue Description:</strong> {item.issue_description || "N/A"}</div>
                <div><strong>Part Number:</strong> {item.product_part_number || "N/A"}</div>
                <div><strong>Lot Number:</strong> {item.lot_number || "N/A"}</div>
                <div><strong>Work Order:</strong> {item.workorder_number || "N/A"}</div>
                <div><strong>Source:</strong> {item.source_of_detection || "N/A"}</div>
                <div><strong>Department:</strong> {item.department || "N/A"}</div>
                <div><strong>Date Detected:</strong> {item.date_detected || "N/A"}</div>
                <div><strong>Quantity Affected:</strong> {item.quantity_affected ?? "N/A"}</div>
                <div><strong>Containment Action:</strong> {item.containment_action || "N/A"}</div>
                <div><strong>Containment Owner:</strong> {item.containment_owner || "N/A"}</div>
                <div><strong>Material Status:</strong> {item.material_status || "N/A"}</div>
                <div><strong>Quarantined Quantity:</strong> {item.quarantined_quantity ?? "N/A"}</div>
                <div><strong>Defect Category:</strong> {item.defect_category || "N/A"}</div>
                <div><strong>Defect Subcategory:</strong> {item.defect_subcategory || "N/A"}</div>
                <div><strong>Supplier Name:</strong> {item.supplier_name || "N/A"}</div>
                <div><strong>Supplier Lot:</strong> {item.supplier_lot || "N/A"}</div>
                <div><strong>Site / Location:</strong> {item.site_location || "N/A"}</div>
                <div><strong>Immediate Correction:</strong> {item.immediate_correction || "N/A"}</div>
                <div><strong>Owner:</strong> {item.owner || "N/A"}</div>
                <div><strong>Severity:</strong> {item.severity || "not_assessed"}</div>
                <div><strong>Recurring:</strong> {item.recurring_issue ? "Yes" : "No"}</div>
                <div><strong>Recurrence Reason:</strong> {item.recurrence_reason || "N/A"}</div>
                <div><strong>Supplier CAPA / SCAR Required:</strong> {item.supplier_capa_required ? "Yes" : "No"}</div>
                <div><strong>Supplier CAPA / SCAR Reason:</strong> {item.supplier_capa_reason || "N/A"}</div>
              </div>

              <div style={{ marginTop: "10px" }}>
                <a href={`/ncmrs/${item.id}`}>Open Workflow</a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
