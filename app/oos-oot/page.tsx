"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Investigation = {
  id: string;
  investigation_number: string | null;
  investigation_source: string | null;
  event_type: string | null;
  test_name: string | null;
  area_room_equipment: string | null;
  product_part_number: string | null;
  lot_batch_number: string | null;
  date_detected: string | null;
  observed_result: string | null;
  specification_limit: string | null;
  product_impact: boolean | null;
  ncmr_required: boolean | null;
  linked_ncmr_number: string | null;
  systemic_issue: boolean | null;
  escalation_required: boolean | null;
  status: string | null;
  created_at: string | null;
};

export default function OosOotPage() {
  const [records, setRecords] = useState<Investigation[]>([]);

  const [investigationSource, setInvestigationSource] = useState("Product Bioburden");
  const [eventType, setEventType] = useState("OOS - Out of Specification");

  const [testName, setTestName] = useState("");
  const [testMethod, setTestMethod] = useState("");
  const [areaRoomEquipment, setAreaRoomEquipment] = useState("");
  const [productPartNumber, setProductPartNumber] = useState("");
  const [lotBatchNumber, setLotBatchNumber] = useState("");
  const [sampleId, setSampleId] = useState("");
  const [dateDetected, setDateDetected] = useState("");
  const [detectedBy, setDetectedBy] = useState("");

  const [observedResult, setObservedResult] = useState("");
  const [specificationLimit, setSpecificationLimit] = useState("");
  const [unitOfMeasure, setUnitOfMeasure] = useState("");

  const [immediateAction, setImmediateAction] = useState("");
  const [productAffected, setProductAffected] = useState("no");
  const [materialOnHold, setMaterialOnHold] = useState("no");
  const [roomEquipmentImpacted, setRoomEquipmentImpacted] = useState("no");
  const [containmentOwner, setContainmentOwner] = useState("");
  const [quarantinedQuantity, setQuarantinedQuantity] = useState("");

  const [productImpact, setProductImpact] = useState("no");
  const [ncmrRequired, setNcmrRequired] = useState("no");
  const [linkedNcmrNumber, setLinkedNcmrNumber] = useState("");
  const [affectedProductLotQuantity, setAffectedProductLotQuantity] = useState("");
  const [noProductImpactJustification, setNoProductImpactJustification] = useState("");

  const [systemicIssue, setSystemicIssue] = useState("no");
  const [escalationRequired, setEscalationRequired] = useState("no");
  const [escalationNotes, setEscalationNotes] = useState("");

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

  const fetchData = async () => {
    const { data, error } = await supabase
      .from("oos_oot_investigations")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setRecords((data as Investigation[]) || []);
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

  const createInvestigation = async () => {
    if (!testName) {
      alert("Test name is required.");
      return;
    }

    if (!observedResult) {
      alert("Observed result is required.");
      return;
    }

    if (!specificationLimit) {
      alert("Specification / alert / action limit is required.");
      return;
    }

    if (productImpact === "yes" && ncmrRequired === "yes" && !linkedNcmrNumber) {
      alert("Linked NCMR number is required when product impact requires NCMR.");
      return;
    }

    if (productImpact === "no" && !noProductImpactJustification) {
      alert("No product impact justification is required.");
      return;
    }

    const { data, error } = await supabase
      .from("oos_oot_investigations")
      .insert({
        investigation_source: investigationSource,
        event_type: eventType,
        test_name: testName,
        test_method: testMethod,
        area_room_equipment: areaRoomEquipment,
        product_part_number: productPartNumber,
        lot_batch_number: lotBatchNumber,
        sample_id: sampleId,
        date_detected: dateDetected || null,
        detected_by: detectedBy,
        observed_result: observedResult,
        specification_limit: specificationLimit,
        unit_of_measure: unitOfMeasure,
        immediate_action: immediateAction,
        product_affected: productAffected === "yes",
        material_on_hold: materialOnHold === "yes",
        room_equipment_impacted: roomEquipmentImpacted === "yes",
        containment_owner: containmentOwner,
        quarantined_quantity: quarantinedQuantity ? Number(quarantinedQuantity) : null,
        product_impact: productImpact === "yes",
        ncmr_required: ncmrRequired === "yes",
        linked_ncmr_number: linkedNcmrNumber,
        affected_product_lot_quantity: affectedProductLotQuantity,
        no_product_impact_justification: noProductImpactJustification,
        systemic_issue: systemicIssue === "yes",
        escalation_required: escalationRequired === "yes",
        escalation_notes: escalationNotes,
        status: "open",
      })
      .select()
      .single();

    if (error) {
      alert(error.message);
      return;
    }

    await addAuditLog(
      "oos_oot",
      data.id,
      "created",
      `OOS/OOT investigation created: ${data.investigation_number || ""}`
    );

    alert(`Investigation created: ${data.investigation_number}`);

    setInvestigationSource("Product Bioburden");
    setEventType("OOS - Out of Specification");
    setTestName("");
    setTestMethod("");
    setAreaRoomEquipment("");
    setProductPartNumber("");
    setLotBatchNumber("");
    setSampleId("");
    setDateDetected("");
    setDetectedBy("");
    setObservedResult("");
    setSpecificationLimit("");
    setUnitOfMeasure("");
    setImmediateAction("");
    setProductAffected("no");
    setMaterialOnHold("no");
    setRoomEquipmentImpacted("no");
    setContainmentOwner("");
    setQuarantinedQuantity("");
    setProductImpact("no");
    setNcmrRequired("no");
    setLinkedNcmrNumber("");
    setAffectedProductLotQuantity("");
    setNoProductImpactJustification("");
    setSystemicIssue("no");
    setEscalationRequired("no");
    setEscalationNotes("");

    fetchData();
  };

  useEffect(() => {
    fetchData();
  }, []);

  const buildMonthlyTrend = () => {
    const months: { key: string; label: string; count: number }[] = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

      months.push({
        key,
        label: d.toLocaleString("en-US", { month: "short", year: "2-digit" }),
        count: 0,
      });
    }

    records.forEach((item) => {
      if (!item.created_at) return;

      const d = new Date(item.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const match = months.find((m) => m.key === key);

      if (match) match.count += 1;
    });

    return months;
  };

  const countByField = (field: keyof Investigation) => {
    const map = new Map<string, number>();

    records.forEach((item) => {
      const value = String(item[field] || "Unknown");
      map.set(value, (map.get(value) || 0) + 1);
    });

    return Array.from(map.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  };

  const monthlyTrend = buildMonthlyTrend();
  const sourceTrend = countByField("investigation_source");
  const eventTypeTrend = countByField("event_type");
  const areaTrend = countByField("area_room_equipment");

  const productImpactCount = records.filter((x) => x.product_impact).length;
  const ncmrRequiredCount = records.filter((x) => x.ncmr_required).length;
  const systemicIssueCount = records.filter((x) => x.systemic_issue).length;
  const escalationRequiredCount = records.filter((x) => x.escalation_required).length;

  const maxMonthly = Math.max(...monthlyTrend.map((x) => x.count), 1);
  const maxSource = Math.max(...sourceTrend.map((x) => x.count), 1);
  const maxEvent = Math.max(...eventTypeTrend.map((x) => x.count), 1);
  const maxArea = Math.max(...areaTrend.map((x) => x.count), 1);
  const maxRisk = Math.max(
    productImpactCount,
    ncmrRequiredCount,
    systemicIssueCount,
    escalationRequiredCount,
    1
  );

  const Bar = ({
    label,
    value,
    max,
  }: {
    label: string;
    value: number;
    max: number;
  }) => {
    const percent = max > 0 ? (value / max) * 100 : 0;

    return (
      <div style={{ marginBottom: "10px" }}>
        <div>{label}: {value}</div>
        <div
          style={{
            background: "#ddd",
            width: "100%",
            maxWidth: "550px",
            height: "18px",
            borderRadius: "4px",
            overflow: "hidden",
            border: "1px solid #bbb",
          }}
        >
          <div
            style={{
              background: "#2563eb",
              width: `${value > 0 ? Math.max(percent, 5) : 0}%`,
              height: "100%",
            }}
          />
        </div>
      </div>
    );
  };

  return (
    <main style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>OOS / OOT / Environmental Monitoring Investigation</h1>

      <section style={sectionStyle}>
        <h2>1. Initiation</h2>

        <div style={rowStyle}>
          <label>Investigation Source</label>
          <br />
          <select
            value={investigationSource}
            onChange={(e) => setInvestigationSource(e.target.value)}
            style={fieldStyle}
          >
            <option value="Product Bioburden">Product Bioburden</option>
            <option value="Cleanroom Routine Monitoring">Cleanroom Routine Monitoring</option>
            <option value="Room Temperature">Room Temperature</option>
            <option value="Room Humidity">Room Humidity</option>
            <option value="Differential Pressure">Differential Pressure</option>
            <option value="pH Testing">pH Testing</option>
            <option value="Equipment Calibration">Equipment Calibration</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div style={rowStyle}>
          <label>Event Type</label>
          <br />
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            style={fieldStyle}
          >
            <option value="OOS - Out of Specification">OOS - Out of Specification</option>
            <option value="OOT - Out of Trend">OOT - Out of Trend</option>
            <option value="Alert Limit Exceeded">Alert Limit Exceeded</option>
            <option value="Action Limit Exceeded">Action Limit Exceeded</option>
            <option value="Calibration Out of Tolerance">Calibration Out of Tolerance</option>
            <option value="Environmental Excursion">Environmental Excursion</option>
            <option value="Invalid / Suspect Result">Invalid / Suspect Result</option>
          </select>
        </div>

        <div style={rowStyle}>
          <label>Test Name</label>
          <br />
          <input value={testName} onChange={(e) => setTestName(e.target.value)} style={fieldStyle} />
        </div>

        <div style={rowStyle}>
          <label>Test Method</label>
          <br />
          <input value={testMethod} onChange={(e) => setTestMethod(e.target.value)} style={fieldStyle} />
        </div>

        <div style={rowStyle}>
          <label>Area / Room / Equipment</label>
          <br />
          <input value={areaRoomEquipment} onChange={(e) => setAreaRoomEquipment(e.target.value)} style={fieldStyle} />
        </div>

        <div style={rowStyle}>
          <label>Product / Part Number</label>
          <br />
          <input value={productPartNumber} onChange={(e) => setProductPartNumber(e.target.value)} style={fieldStyle} />
        </div>

        <div style={rowStyle}>
          <label>Lot / Batch Number</label>
          <br />
          <input value={lotBatchNumber} onChange={(e) => setLotBatchNumber(e.target.value)} style={fieldStyle} />
        </div>

        <div style={rowStyle}>
          <label>Sample ID</label>
          <br />
          <input value={sampleId} onChange={(e) => setSampleId(e.target.value)} style={fieldStyle} />
        </div>

        <div style={rowStyle}>
          <label>Date Detected</label>
          <br />
          <input type="date" value={dateDetected} onChange={(e) => setDateDetected(e.target.value)} style={fieldStyle} />
        </div>

        <div style={rowStyle}>
          <label>Detected By</label>
          <br />
          <input value={detectedBy} onChange={(e) => setDetectedBy(e.target.value)} style={fieldStyle} />
        </div>
      </section>

      <section style={sectionStyle}>
        <h2>2. Result / Limit</h2>

        <div style={rowStyle}>
          <label>Observed Result</label>
          <br />
          <input value={observedResult} onChange={(e) => setObservedResult(e.target.value)} style={fieldStyle} />
        </div>

        <div style={rowStyle}>
          <label>Specification / Alert / Action Limit</label>
          <br />
          <input value={specificationLimit} onChange={(e) => setSpecificationLimit(e.target.value)} style={fieldStyle} />
        </div>

        <div style={rowStyle}>
          <label>Unit of Measure</label>
          <br />
          <input value={unitOfMeasure} onChange={(e) => setUnitOfMeasure(e.target.value)} placeholder="CFU, °C, %RH, Pa, pH, etc." style={fieldStyle} />
        </div>
      </section>

      <section style={sectionStyle}>
        <h2>3. Immediate Assessment / Containment</h2>

        <div style={rowStyle}>
          <label>Immediate Action Taken</label>
          <br />
          <textarea value={immediateAction} onChange={(e) => setImmediateAction(e.target.value)} rows={3} style={textAreaStyle} />
        </div>

        <div style={rowStyle}>
          <label>Product Affected?</label>
          <br />
          <select value={productAffected} onChange={(e) => setProductAffected(e.target.value)} style={fieldStyle}>
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </div>

        <div style={rowStyle}>
          <label>Material on Hold?</label>
          <br />
          <select value={materialOnHold} onChange={(e) => setMaterialOnHold(e.target.value)} style={fieldStyle}>
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </div>

        <div style={rowStyle}>
          <label>Room / Equipment Impacted?</label>
          <br />
          <select value={roomEquipmentImpacted} onChange={(e) => setRoomEquipmentImpacted(e.target.value)} style={fieldStyle}>
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </div>

        <div style={rowStyle}>
          <label>Containment Owner</label>
          <br />
          <input value={containmentOwner} onChange={(e) => setContainmentOwner(e.target.value)} style={fieldStyle} />
        </div>

        <div style={rowStyle}>
          <label>Quarantined Quantity</label>
          <br />
          <input type="number" value={quarantinedQuantity} onChange={(e) => setQuarantinedQuantity(e.target.value)} style={fieldStyle} />
        </div>
      </section>

      <section style={sectionStyle}>
        <h2>4. Product Impact / NCMR Linkage</h2>

        <div style={rowStyle}>
          <label>Product Impact?</label>
          <br />
          <select value={productImpact} onChange={(e) => setProductImpact(e.target.value)} style={fieldStyle}>
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </div>

        {productImpact === "yes" ? (
          <>
            <div style={rowStyle}>
              <label>NCMR Required?</label>
              <br />
              <select value={ncmrRequired} onChange={(e) => setNcmrRequired(e.target.value)} style={fieldStyle}>
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </div>

            <div style={rowStyle}>
              <label>Linked NCMR Number</label>
              <br />
              <input value={linkedNcmrNumber} onChange={(e) => setLinkedNcmrNumber(e.target.value)} placeholder="Example: NCMR0000001" style={fieldStyle} />
            </div>

            <div style={rowStyle}>
              <label>Affected Product / Lot / Quantity</label>
              <br />
              <textarea value={affectedProductLotQuantity} onChange={(e) => setAffectedProductLotQuantity(e.target.value)} rows={3} style={textAreaStyle} />
            </div>
          </>
        ) : (
          <div style={rowStyle}>
            <label>No Product Impact Justification</label>
            <br />
            <textarea value={noProductImpactJustification} onChange={(e) => setNoProductImpactJustification(e.target.value)} rows={3} style={textAreaStyle} />
          </div>
        )}
      </section>

      <section style={sectionStyle}>
        <h2>5. Systemic Issue / Escalation</h2>

        <div style={rowStyle}>
          <label>Systemic Issue Identified?</label>
          <br />
          <select value={systemicIssue} onChange={(e) => setSystemicIssue(e.target.value)} style={fieldStyle}>
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </div>

        <div style={rowStyle}>
          <label>Escalation Required?</label>
          <br />
          <select value={escalationRequired} onChange={(e) => setEscalationRequired(e.target.value)} style={fieldStyle}>
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </div>

        <div style={rowStyle}>
          <label>Escalation Notes</label>
          <br />
          <textarea value={escalationNotes} onChange={(e) => setEscalationNotes(e.target.value)} rows={3} style={textAreaStyle} />
        </div>
      </section>

      <button onClick={createInvestigation} style={{ padding: "10px 16px", marginBottom: "25px" }}>
        Create Investigation
      </button>

      <section style={sectionStyle}>
        <h2>OOS / OOT / EM Trend Charts</h2>

        <h3>Monthly Investigation Trend</h3>
        {monthlyTrend.map((item) => (
          <Bar key={item.key} label={item.label} value={item.count} max={maxMonthly} />
        ))}

        <h3>Investigation Source Breakdown</h3>
        {sourceTrend.length === 0 ? (
          <p>No source data yet.</p>
        ) : (
          sourceTrend.map((item) => (
            <Bar key={item.label} label={item.label} value={item.count} max={maxSource} />
          ))
        )}

        <h3>Event Type Breakdown</h3>
        {eventTypeTrend.length === 0 ? (
          <p>No event type data yet.</p>
        ) : (
          eventTypeTrend.map((item) => (
            <Bar key={item.label} label={item.label} value={item.count} max={maxEvent} />
          ))
        )}

        <h3>Top Area / Room / Equipment</h3>
        {areaTrend.length === 0 ? (
          <p>No area / room / equipment data yet.</p>
        ) : (
          areaTrend.map((item) => (
            <Bar key={item.label} label={item.label} value={item.count} max={maxArea} />
          ))
        )}

        <h3>Impact / Escalation Summary</h3>
        <Bar label="Product Impact" value={productImpactCount} max={maxRisk} />
        <Bar label="NCMR Required" value={ncmrRequiredCount} max={maxRisk} />
        <Bar label="Systemic Issue" value={systemicIssueCount} max={maxRisk} />
        <Bar label="Escalation Required" value={escalationRequiredCount} max={maxRisk} />
      </section>

      <h2>Existing OOS / OOT / EM Investigations</h2>

      {records.length === 0 ? (
        <p>No investigations created yet.</p>
      ) : (
        <ul>
          {records.map((item) => (
            <li key={item.id} style={{ marginBottom: "18px", border: "1px solid #ddd", padding: "12px", borderRadius: "8px" }}>
              <strong>{item.investigation_number || "PENDING"} - {item.test_name}</strong> — {item.status}

              <div style={{ marginTop: "8px" }}>
                <div><strong>Source:</strong> {item.investigation_source || "N/A"}</div>
                <div><strong>Event Type:</strong> {item.event_type || "N/A"}</div>
                <div><strong>Area / Room / Equipment:</strong> {item.area_room_equipment || "N/A"}</div>
                <div><strong>Product / Part:</strong> {item.product_part_number || "N/A"}</div>
                <div><strong>Lot / Batch:</strong> {item.lot_batch_number || "N/A"}</div>
                <div><strong>Date Detected:</strong> {item.date_detected || "N/A"}</div>
                <div><strong>Observed Result:</strong> {item.observed_result || "N/A"}</div>
                <div><strong>Limit:</strong> {item.specification_limit || "N/A"}</div>
                <div><strong>Product Impact:</strong> {item.product_impact ? "Yes" : "No"}</div>
                <div><strong>NCMR Required:</strong> {item.ncmr_required ? "Yes" : "No"}</div>
                <div><strong>Linked NCMR:</strong> {item.linked_ncmr_number || "N/A"}</div>
                <div><strong>Systemic Issue:</strong> {item.systemic_issue ? "Yes" : "No"}</div>
                <div><strong>Escalation Required:</strong> {item.escalation_required ? "Yes" : "No"}</div>
              </div>

              <div style={{ marginTop: "10px" }}>
                <a href={`/oos-oot/${item.id}`}>Open Investigation</a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
