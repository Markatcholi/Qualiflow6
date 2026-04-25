"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Ncmr = {
  id: string;
  title: string | null;
  issue_description: string | null;
  scope: string | null;
  product_part_number: string | null;
  lot_number: string | null;
  workorder_number: string | null;
  disposition: string | null;
  source_of_detection: string | null;
  department: string | null;
  date_detected: string | null;
  quantity_affected: number | null;
  containment_owner: string | null;
  containment_action: string | null;
  mrb_decision_date: string | null;
  defect_category: string | null;
  defect_subcategory: string | null;
  material_status: string | null;
  quarantined_quantity: number | null;
  supplier_name: string | null;
  supplier_lot: string | null;
  site_location: string | null;
  immediate_correction: string | null;
  severity: string | null;
  owner: string | null;
  status: string | null;
  capa_required: boolean | null;
  recurring_issue: boolean | null;
  recurrence_reason: string | null;
  problem_description: string | null;
  investigation_summary: string | null;
  root_cause: string | null;
  risk_assessment: string | null;
  corrective_action: string | null;
  created_at: string | null;
  closed_at: string | null;
};

type MasterOption = {
  code: string;
  label: string;
};

type DefectSubcategoryOption = {
  category_code: string;
  code: string;
  label: string;
};

export default function NcmrPage() {
  const [title, setTitle] = useState("");
  const [issueDescription, setIssueDescription] = useState("");
  const [scope, setScope] = useState("");
  const [productPartNumber, setProductPartNumber] = useState("");
  const [lotNumber, setLotNumber] = useState("");
  const [workorderNumber, setWorkorderNumber] = useState("");
  const [disposition, setDisposition] = useState("hold");
  const [sourceOfDetection, setSourceOfDetection] = useState("in_process_inspection");
  const [department, setDepartment] = useState("manufacturing");
  const [dateDetected, setDateDetected] = useState("");
  const [quantityAffected, setQuantityAffected] = useState("");
  const [containmentOwner, setContainmentOwner] = useState("");
  const [containmentAction, setContainmentAction] = useState("");
  const [mrbDecisionDate, setMrbDecisionDate] = useState("");
  const [defectCategory, setDefectCategory] = useState("visual");
  const [defectSubcategory, setDefectSubcategory] = useState("");
  const [materialStatus, setMaterialStatus] = useState("quarantined");
  const [quarantinedQuantity, setQuarantinedQuantity] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [supplierLot, setSupplierLot] = useState("");
  const [siteLocation, setSiteLocation] = useState("");
  const [immediateCorrection, setImmediateCorrection] = useState("");
  const [owner, setOwner] = useState("");
  const [list, setList] = useState<Ncmr[]>([]);

  const [partNumberOptions, setPartNumberOptions] = useState<MasterOption[]>([]);
  const [dispositionOptions, setDispositionOptions] = useState<MasterOption[]>([]);
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

  const fetchMasterData = async () => {
    const [
      partNumbersRes,
      dispositionsRes,
      detectionRes,
      departmentsRes,
      materialRes,
      defectCategoryRes,
      defectSubcategoryRes,
    ] = await Promise.all([
      supabase.from("md_product_part_numbers").select("code, label").order("label"),
      supabase.from("md_dispositions").select("code, label").order("label"),
      supabase.from("md_detection_sources").select("code, label").order("label"),
      supabase.from("md_departments").select("code, label").order("label"),
      supabase.from("

    if (partNumbersRes.error) return alert(partNumbersRes.error.message);
    if (dispositionsRes.error) return alert(dispositionsRes.error.message);
    if (detectionRes.error) return alert(detectionRes.error.message);
    if (departmentsRes.error) return alert(departmentsRes.error.message);
    if (materialRes.error) return alert(materialRes.error.message);
    if (defectCategoryRes.error) return alert(defectCategoryRes.error.message);
    if (defectSubcategoryRes.error) return alert(defectSubcategoryRes.error.message);

    setPartNumberOptions((partNumbersRes.data as MasterOption[]) || []);
    setDispositionOptions((dispositionsRes.data as MasterOption[]) || []);
    setDetectionSourceOptions((detectionRes.data as MasterOption[]) || []);
    setDepartmentOptions((departmentsRes.data as MasterOption[]) || []);
    setMaterialStatusOptions((materialRes.data as MasterOption[]) || []);
    setDefectCategoryOptions((defectCategoryRes.data as MasterOption[]) || []);
    setDefectSubcategoryOptions((defectSubcategoryRes.data as DefectSubcategoryOption[]) || []);
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
      return {
        recurring: false,
        reason: "",
      };
    }

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const { data, error } = await supabase
      .from("ncmrs")
      .select("id, title, created_at, product_part_number, defect_category, defect_subcategory")
      .eq("product_part_number", productPartNumber)
      .eq("defect_category", defectCategory)
      .gte("created_at", sixtyDaysAgo.toISOString());

    if (error) {
      alert(error.message);
      return {
        recurring: false,
        reason: "",
      };
    }

    const matches = data || [];

    if (matches.length > 0) {
      return {
        recurring: true,
        reason: `Recurring issue detected: ${matches.length} prior NCMR(s) with same part number and defect category in the last 60 days.`,
      };
    }

    return {
      recurring: false,
      reason: "",
    };
  };

  const addNcmr = async () => {
    if (!title) {
      alert("Title is required.");
      return;
    }

    const recurrence = await checkRecurrence();

    const severityRequiresCapa = severity === "major" || severity === "critical";
    const capaRequired = severityRequiresCapa || recurrence.recurring;

    const { data, error } = await supabase
      .from("ncmrs")
      .insert({
        title,
        issue_description: issueDescription,
        scope,
        product_part_number: productPartNumber,
        lot_number: lotNumber,
        workorder_number: workorderNumber,
        disposition,
        source_of_detection: sourceOfDetection,
        department,
        date_detected: dateDetected || null,
        quantity_affected: quantityAffected ? Number(quantityAffected) : null,
        containment_owner: containmentOwner,
        mrb_decision_date: mrbDecisionDate || null,
        defect_category: defectCategory,
        defect_subcategory: defectSubcategory,
        material_status: materialStatus,
        affected_quantity: affectedQuantity ? Number(affectedQuantity) : null,
        quarantined_quantity: quarantinedQuantity ? Number(quarantinedQuantity) : null,
        supplier_name: supplierName,
        supplier_lot: supplierLot,
        site_location: siteLocation,
        immediate_correction: immediateCorrection,
        long_term_corrective_action: longTermCorrectiveAction,
        severity,
        owner,
        status: "open",
        capa_required: capaRequired,
        recurring_issue: recurrence.recurring,
        recurrence_reason: recurrence.reason,
        recurrence_checked_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      alert(error.message);
      return;
    }

    await addAuditLog("ncmr", data.id, "created", `Created NCMR: ${title}`);

    if (recurrence.recurring) {
      await addAuditLog(
        "ncmr",
        data.id,
        "recurrence_detected",
        recurrence.reason
      );
    }

    if (capaRequired && data) {
      const { error: capaError } = await supabase.from("capas").insert({
        ncmr_id: data.id,
        title: `CAPA for ${title}`,
        linked_ncmr_title: title,
        source_type: "ncmr",
        capa_source: recurrence.recurring ? "Recurring NCMR" : "NCMR Severity",
        problem_description: issueDescription || title,
        root_cause: "",
        corrective_action_plan: longTermCorrectiveAction,
        action_plan: longTermCorrectiveAction,
        status: "open",
      });

      if (capaError) {
        alert(capaError.message);
        return;
      }

      await addAuditLog(
        "ncmr",
        data.id,
        "capa_triggered",
        recurrence.recurring
          ? "CAPA automatically required due to recurring issue."
          : `CAPA automatically required for severity: ${severity}`
      );
    }

    setTitle("");
    setIssueDescription("");
    setScope("");
    setProductPartNumber("");
    setLotNumber("");
    setWorkorderNumber("");
    setDisposition("hold");
    setSourceOfDetection("in_process_inspection");
    setDepartment("manufacturing");
    setDateDetected("");
    setQuantityAffected("");
    setContainmentOwner("");
    setMrbDecisionDate("");
    setDefectCategory(defectCategoryOptions[0]?.code || "visual");
    setDefectSubcategory("");
    setMaterialStatus("quarantined");
    setAffectedQuantity("");
    setQuarantinedQuantity("");
    setSupplierName("");
    setSupplierLot("");
    setSiteLocation("");
    setImmediateCorrection("");
    setLongTermCorrectiveAction("");
    setOwner("");
    setSeverity("minor");
    fetchData();
  };

  const investigationComplete = (item: Ncmr) => {
    return Boolean(
      item.problem_description &&
        item.containment_action &&
        item.investigation_summary &&
        item.root_cause &&
        item.risk_assessment &&
        item.corrective_action
    );
  };

  const updateStatus = async (item: Ncmr, status: string) => {
    if (status === "closed" && !investigationComplete(item)) {
      alert("Cannot close NCMR until investigation is completed.");
      return;
    }

    const oldStatus = item.status;
    const updatePayload: { status: string; closed_at?: string | null } = { status };

    if (status === "closed") {
      updatePayload.closed_at = new Date().toISOString();
    } else {
      updatePayload.closed_at = null;
    }

    const { error } = await supabase
      .from("ncmrs")
      .update(updatePayload)
      .eq("id", item.id);

    if (error) {
      alert(error.message);
      return;
    }

    await addAuditLog(
      "ncmr",
      item.id,
      "status_changed",
      `Status changed from ${oldStatus} to ${status}`
    );

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

      <div style={{ marginBottom: "12px" }}>
        <label>Title</label><br />
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short NCMR title" style={{ width: "100%", maxWidth: "500px", padding: "8px" }} />
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label>Issue Description</label><br />
        <textarea value={issueDescription} onChange={(e) => setIssueDescription(e.target.value)} placeholder="Describe the issue observed" rows={4} style={{ width: "100%", maxWidth: "800px" }} />
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label>Scope</label><br />
        <textarea value={scope} onChange={(e) => setScope(e.target.value)} placeholder="Affected scope, quantity, line, product family, etc." rows={3} style={{ width: "100%", maxWidth: "800px" }} />
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label>Product Part Number</label><br />
        <select value={productPartNumber} onChange={(e) => setProductPartNumber(e.target.value)} style={{ padding: "8px", minWidth: "220px" }}>
          <option value="">Select part number</option>
          {renderOptions(partNumberOptions)}
        </select>
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label>Lot Number</label><br />
        <input value={lotNumber} onChange={(e) => setLotNumber(e.target.value)} placeholder="Lot number" style={{ width: "100%", maxWidth: "400px", padding: "8px" }} />
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label>Work Order Number</label><br />
        <input value={workorderNumber} onChange={(e) => setWorkorderNumber(e.target.value)} placeholder="Work order number" style={{ width: "100%", maxWidth: "400px", padding: "8px" }} />
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label>Disposition</label><br />
        <select value={disposition} onChange={(e) => setDisposition(e.target.value)} style={{ padding: "8px", minWidth: "220px" }}>
          {renderOptions(dispositionOptions)}
        </select>
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label>Source of Detection</label><br />
        <select value={sourceOfDetection} onChange={(e) => setSourceOfDetection(e.target.value)} style={{ padding: "8px", minWidth: "260px" }}>
          {renderOptions(detectionSourceOptions)}
        </select>
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label>Department</label><br />
        <select value={department} onChange={(e) => setDepartment(e.target.value)} style={{ padding: "8px", minWidth: "220px" }}>
          {renderOptions(departmentOptions)}
        </select>
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label>Date Detected</label><br />
        <input type="date" value={dateDetected} onChange={(e) => setDateDetected(e.target.value)} style={{ padding: "8px" }} />
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label>Quantity Affected</label><br />
        <input type="number" value={quantityAffected} onChange={(e) => setQuantityAffected(e.target.value)} placeholder="Quantity affected" style={{ width: "100%", maxWidth: "200px", padding: "8px" }} />
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label>Containment Owner</label><br />
        <input value={containmentOwner} onChange={(e) => setContainmentOwner(e.target.value)} placeholder="Containment owner" style={{ width: "100%", maxWidth: "400px", padding: "8px" }} />
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label>MRB Decision Date</label><br />
        <input type="date" value={mrbDecisionDate} onChange={(e) => setMrbDecisionDate(e.target.value)} style={{ padding: "8px" }} />
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label>Defect Category</label><br />
        <select value={defectCategory} onChange={(e) => setDefectCategory(e.target.value)} style={{ padding: "8px", minWidth: "220px" }}>
          {renderOptions(defectCategoryOptions)}
        </select>
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label>Defect Subcategory</label><br />
        <select value={defectSubcategory} onChange={(e) => setDefectSubcategory(e.target.value)} style={{ padding: "8px", minWidth: "220px" }}>
          {filteredDefectSubcategories.map((option) => (
            <option key={option.code} value={option.code}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label>Material Status</label><br />
        <select value={materialStatus} onChange={(e) => setMaterialStatus(e.target.value)} style={{ padding: "8px", minWidth: "220px" }}>
          {renderOptions(materialStatusOptions)}
        </select>
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label>Affected Quantity</label><br />
        <input type="number" value={affectedQuantity} onChange={(e) => setAffectedQuantity(e.target.value)} placeholder="Affected quantity" style={{ width: "100%", maxWidth: "200px", padding: "8px" }} />
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label>Quarantined Quantity</label><br />
        <input type="number" value={quarantinedQuantity} onChange={(e) => setQuarantinedQuantity(e.target.value)} placeholder="Quarantined quantity" style={{ width: "100%", maxWidth: "200px", padding: "8px" }} />
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label>Supplier Name</label><br />
        <input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="Supplier name" style={{ width: "100%", maxWidth: "400px", padding: "8px" }} />
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label>Supplier Lot</label><br />
        <input value={supplierLot} onChange={(e) => setSupplierLot(e.target.value)} placeholder="Supplier lot" style={{ width: "100%", maxWidth: "400px", padding: "8px" }} />
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label>Site / Location</label><br />
        <input value={siteLocation} onChange={(e) => setSiteLocation(e.target.value)} placeholder="Site / room / line / location" style={{ width: "100%", maxWidth: "400px", padding: "8px" }} />
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label>Immediate Correction</label><br />
        <textarea value={immediateCorrection} onChange={(e) => setImmediateCorrection(e.target.value)} placeholder="Immediate correction taken" rows={3} style={{ width: "100%", maxWidth: "800px" }} />
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label>Long-Term Corrective Action</label><br />
        <textarea value={longTermCorrectiveAction} onChange={(e) => setLongTermCorrectiveAction(e.target.value)} placeholder="Long-term corrective action planned" rows={3} style={{ width: "100%", maxWidth: "800px" }} />
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label>Severity</label><br />
        <select value={severity: "not_assessed", } onChange={(e) => setSeverity(e.target.value)} style={{ padding: "8px", minWidth: "160px" }}>
          <option value="minor">Minor</option>
          <option value="major">Major</option>
          <option value="critical">Critical</option>
        </select>
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label>Owner</label><br />
        <input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Owner" style={{ width: "100%", maxWidth: "400px", padding: "8px" }} />
      </div>

      <div style={{ marginBottom: "20px" }}>
        <button onClick={addNcmr}>Create NCMR</button>
      </div>

      <h2>Existing NCMRs</h2>

      <ul>
        {list.map((item) => (
          <li key={item.id} style={{ marginBottom: "16px" }}>
            <strong>{item.title}</strong> — {item.severity} — {item.owner} — {item.status}
            {item.capa_required ? <span style={{ color: "red", marginLeft: "10px" }}>CAPA Required</span> : null}
            {item.recurring_issue ? <span style={{ color: "orange", marginLeft: "10px" }}>Recurring Issue</span> : null}

            <div style={{ marginTop: "6px" }}>
  <div><strong>Issue Description:</strong> {item.issue_description || "N/A"}</div>
  <div><strong>Scope:</strong> {item.scope || "N/A"}</div>
  <div><strong>Part Number:</strong> {item.product_part_number || "N/A"}</div>
  <div><strong>Lot Number:</strong> {item.lot_number || "N/A"}</div>
  <div><strong>Work Order:</strong> {item.workorder_number || "N/A"}</div>
  <div><strong>Disposition:</strong> {item.disposition || "N/A"}</div>
  <div><strong>Source:</strong> {item.source_of_detection || "N/A"}</div>
  <div><strong>Department:</strong> {item.department || "N/A"}</div>
  <div><strong>Date Detected:</strong> {item.date_detected || "N/A"}</div>
  <div><strong>Qty Affected:</strong> {item.quantity_affected ?? "N/A"}</div>
  <div><strong>Containment Owner:</strong> {item.containment_owner || "N/A"}</div>
  <div><strong>MRB Decision Date:</strong> {item.mrb_decision_date || "N/A"}</div>
  <div><strong>Defect Category:</strong> {item.defect_category || "N/A"}</div>
  <div><strong>Defect Subcategory:</strong> {item.defect_subcategory || "N/A"}</div>
  <div><strong>Material Status:</strong> {item.material_status || "N/A"}</div>
  <div><strong>Affected Qty:</strong> {item.affected_quantity ?? "N/A"}</div>
  <div><strong>Quarantined Qty:</strong> {item.quarantined_quantity ?? "N/A"}</div>
  <div><strong>Supplier Name:</strong> {item.supplier_name || "N/A"}</div>
  <div><strong>Supplier Lot:</strong> {item.supplier_lot || "N/A"}</div>
  <div><strong>Site/Location:</strong> {item.site_location || "N/A"}</div>
  <div><strong>Immediate Correction:</strong> {item.immediate_correction || "N/A"}</div>
  <div><strong>Long-Term Corrective Action:</strong> {item.long_term_corrective_action || "N/A"}</div>
  <div><strong>Recurring:</strong> {item.recurring_issue ? "Yes" : "No"}</div>
  <div><strong>Recurrence Reason:</strong> {item.recurrence_reason || "N/A"}</div>
</div>

            <div style={{ marginTop: "8px" }}>
              <button onClick={() => updateStatus(item, "investigation")} style={{ marginRight: "8px" }}>
                Move to Investigation
              </button>

              <button onClick={() => updateStatus(item, "closed")} style={{ marginRight: "8px" }}>
                Close
              </button>

              <a href={`/ncmrs/${item.id}`}>Open Investigation</a>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
