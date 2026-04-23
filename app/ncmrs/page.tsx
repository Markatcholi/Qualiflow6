"use client";

import { useEffect, useState } from "react";
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
  mrb_decision_date: string | null;
  defect_category: string | null;
  defect_subcategory: string | null;
  material_status: string | null;
  affected_quantity: number | null;
  quarantined_quantity: number | null;
  severity: string | null;
  owner: string | null;
  status: string | null;
  capa_required: boolean | null;
  problem_description: string | null;
  containment_action: string | null;
  investigation_summary: string | null;
  root_cause: string | null;
  risk_assessment: string | null;
  corrective_action: string | null;
  created_at: string | null;
  closed_at: string | null;
};

export default function NcmrPage() {
  const [title, setTitle] = useState("");
  const [issueDescription, setIssueDescription] = useState("");
  const [scope, setScope] = useState("");
  const [productPartNumber, setProductPartNumber] = useState("");
  const [lotNumber, setLotNumber] = useState("");
  const [workorderNumber, setWorkorderNumber] = useState("");
  const [disposition, setDisposition] = useState("hold");
  const [sourceOfDetection, setSourceOfDetection] = useState("");
  const [department, setDepartment] = useState("");
  const [dateDetected, setDateDetected] = useState("");
  const [quantityAffected, setQuantityAffected] = useState("");

  const [containmentOwner, setContainmentOwner] = useState("");
  const [mrbDecisionDate, setMrbDecisionDate] = useState("");
  const [defectCategory, setDefectCategory] = useState("");
  const [defectSubcategory, setDefectSubcategory] = useState("");
  const [materialStatus, setMaterialStatus] = useState("quarantined");
  const [affectedQuantity, setAffectedQuantity] = useState("");
  const [quarantinedQuantity, setQuarantinedQuantity] = useState("");

  const [severity, setSeverity] = useState("minor");
  const [owner, setOwner] = useState("");
  const [list, setList] = useState<Ncmr[]>([]);

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

  const addNcmr = async () => {
    if (!title) {
      alert("Title is required.");
      return;
    }

    const capaRequired = severity === "major" || severity === "critical";

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
        severity,
        owner,
        status: "open",
        capa_required: capaRequired,
      })
      .select()
      .single();

    if (error) {
      alert(error.message);
      return;
    }

    await addAuditLog("ncmr", data.id, "created", `Created NCMR: ${title}`);

    if (capaRequired && data) {
      const { error: capaError } = await supabase.from("capas").insert({
        ncmr_id: data.id,
        title: `CAPA for ${title}`,
        linked_ncmr_title: title,
      });

      if (capaError) {
        alert(capaError.message);
        return;
      }

      await addAuditLog(
        "ncmr",
        data.id,
        "capa_triggered",
        `CAPA automatically required for severity: ${severity}`
      );
    }

    setTitle("");
    setIssueDescription("");
    setScope("");
    setProductPartNumber("");
    setLotNumber("");
    setWorkorderNumber("");
    setDisposition("hold");
    setSourceOfDetection("");
    setDepartment("");
    setDateDetected("");
    setQuantityAffected("");
    setContainmentOwner("");
    setMrbDecisionDate("");
    setDefectCategory("");
    setDefectSubcategory("");
    setMaterialStatus("quarantined");
    setAffectedQuantity("");
    setQuarantinedQuantity("");
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
    const updatePayload: { status: string; closed_at?: string | null } = {
      status,
    };

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
    fetchData();
  }, []);

  return (
    <main style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>NCMR Initiation</h1>

      <div style={{ marginBottom: "12px" }}>
        <label>Title</label>
        <br />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Short NCMR title"
          style={{ width: "100%", maxWidth: "500px", padding: "8px" }}
        />
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label>Issue Description</label>
        <br />
        <textarea
          value={issueDescription}
          onChange={(e) => setIssueDescription(e.target.value)}
          placeholder="Describe the issue observed"
          rows={4}
          style={{ width: "100%", maxWidth: "800px" }}
        />
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label>Scope</label>
        <br />
        <textarea
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          placeholder="Affected scope, quantity, line, product family, etc."
          rows={3}
          style={{ width: "100%", maxWidth: "800px" }}
        />
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label>Product Part Number</label>
        <br />
        <input
          value={productPartNumber}
          onChange={(e) => setProductPartNumber(e.target.value)}
          placeholder="Part number"
          style={{ width: "100%", maxWidth: "400px", padding: "8px" }}
        />
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label>Lot Number</label>
        <br />
        <input
          value={lotNumber}
          onChange={(e) => setLotNumber(e.target.value)}
          placeholder="Lot number"
          style={{ width: "100%", maxWidth: "400px", padding: "8px" }}
        />
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label>Work Order Number</label>
        <br />
        <input
          value={workorderNumber}
          onChange={(e) => setWorkorderNumber(e.target.value)}
          placeholder="Work order number"
          style={{ width: "100%", maxWidth: "400px", padding: "8px" }}
        />
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label>Disposition</label>
        <br />
        <select
          value={disposition}
          onChange={(e) => setDisposition(e.target.value)}
          style={{ padding: "8px", minWidth: "180px" }}
        >
          <option value="hold">Hold</option>
          <option value="use_as_is">Use As Is</option>
          <option value="rework">Rework</option>
          <option value="scrap">Scrap</option>
          <option value="return_to_supplier">Return to Supplier</option>
          <option value="pending_mrb">Pending MRB</option>
        </select>
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label>Source of Detection</label>
        <br />
        <input
          value={sourceOfDetection}
          onChange={(e) => setSourceOfDetection(e.target.value)}
          placeholder="Incoming, in-process, final inspection, complaint, audit, etc."
          style={{ width: "100%", maxWidth: "500px", padding: "8px" }}
        />
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label>Department</label>
        <br />
        <input
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          placeholder="Manufacturing, Quality, Warehouse, Supplier Quality, etc."
          style={{ width: "100%", maxWidth: "400px", padding: "8px" }}
        />
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label>Date Detected</label>
        <br />
        <input
          type="date"
          value={dateDetected}
          onChange={(e) => setDateDetected(e.target.value)}
          style={{ padding: "8px" }}
        />
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label>Quantity Affected</label>
        <br />
        <input
          type="number"
          value={quantityAffected}
          onChange={(e) => setQuantityAffected(e.target.value)}
          placeholder="Quantity affected"
          style={{ width: "100%", maxWidth: "200px", padding: "8px" }}
        />
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label>Containment Owner</label>
        <br />
        <input
          value={containmentOwner}
          onChange={(e) => setContainmentOwner(e.target.value)}
          placeholder="Containment owner"
          style={{ width: "100%", maxWidth: "400px", padding: "8px" }}
        />
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label>MRB Decision Date</label>
        <br />
        <input
          type="date"
          value={mrbDecisionDate}
          onChange={(e) => setMrbDecisionDate(e.target.value)}
          style={{ padding: "8px" }}
        />
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label>Defect Category</label>
        <br />
        <input
          value={defectCategory}
          onChange={(e) => setDefectCategory(e.target.value)}
          placeholder="Defect category"
          style={{ width: "100%", maxWidth: "400px", padding: "8px" }}
        />
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label>Defect Subcategory</label>
        <br />
        <input
          value={defectSubcategory}
          onChange={(e) => setDefectSubcategory(e.target.value)}
          placeholder="Defect subcategory"
          style={{ width: "100%", maxWidth: "400px", padding: "8px" }}
        />
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label>Material Status</label>
        <br />
        <select
          value={materialStatus}
          onChange={(e) => setMaterialStatus(e.target.value)}
          style={{ padding: "8px", minWidth: "180px" }}
        >
          <option value="quarantined">Quarantined</option>
          <option value="segregated">Segregated</option>
          <option value="released">Released</option>
          <option value="under_review">Under Review</option>
          <option value="scrapped">Scrapped</option>
          <option value="reworked">Reworked</option>
        </select>
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label>Affected Quantity</label>
        <br />
        <input
          type="number"
          value={affectedQuantity}
          onChange={(e) => setAffectedQuantity(e.target.value)}
          placeholder="Affected quantity"
          style={{ width: "100%", maxWidth: "200px", padding: "8px" }}
        />
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label>Quarantined Quantity</label>
        <br />
        <input
          type="number"
          value={quarantinedQuantity}
          onChange={(e) => setQuarantinedQuantity(e.target.value)}
          placeholder="Quarantined quantity"
          style={{ width: "100%", maxWidth: "200px", padding: "8px" }}
        />
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label>Severity</label>
        <br />
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          style={{ padding: "8px", minWidth: "160px" }}
        >
          <option value="minor">Minor</option>
          <option value="major">Major</option>
          <option value="critical">Critical</option>
        </select>
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label>Owner</label>
        <br />
        <input
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          placeholder="Owner"
          style={{ width: "100%", maxWidth: "400px", padding: "8px" }}
        />
      </div>

      <div style={{ marginBottom: "20px" }}>
        <button onClick={addNcmr}>Create NCMR</button>
      </div>

      <h2>Existing NCMRs</h2>

      <ul>
        {list.map((item) => (
          <li key={item.id} style={{ marginBottom: "16px" }}>
            <strong>{item.title}</strong> — {item.severity} — {item.owner} — {item.status}
            {item.capa_required ? (
              <span style={{ color: "red", marginLeft: "10px" }}>
                CAPA Required
              </span>
            ) : null}

            <div style={{ marginTop: "6px" }}>
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
            </div>

            <div style={{ marginTop: "8px" }}>
              <button
                onClick={() => updateStatus(item, "investigation")}
                style={{ marginRight: "8px" }}
              >
                Move to Investigation
              </button>

              <button
                onClick={() => updateStatus(item, "closed")}
                style={{ marginRight: "8px" }}
              >
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
