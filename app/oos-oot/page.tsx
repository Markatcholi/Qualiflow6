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

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState("");
  const [impactFilter, setImpactFilter] = useState("");

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

  const badgeBaseStyle: React.CSSProperties = {
    color: "white",
    padding: "4px 8px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 600,
    display: "inline-block",
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

  
  const getReportButtonColor = (status: string | null | undefined) => {
    const normalized = (status || "").toLowerCase();

    if (normalized === "closed" || normalized === "completed") return "#16a34a";
    if (normalized === "draft") return "#6b7280";
    if (
      normalized === "open" ||
      normalized === "in_progress" ||
      normalized === "investigation" ||
      normalized === "in_review" ||
      normalized === "effectiveness_check"
    ) return "#2563eb";

    return "#3b82f6";
  };

  const isReportLocked = (item: any) => {
    return item?.is_locked === true || item?.locked === true || item?.record_locked === true;
  };

  const reportButtonStyle = (item: any): React.CSSProperties => ({
    display: "inline-block",
    background: isReportLocked(item) ? "#9ca3af" : getReportButtonColor(item.status),
    color: "white",
    padding: "8px 12px",
    borderRadius: "8px",
    textDecoration: "none",
    cursor: isReportLocked(item) ? "not-allowed" : "pointer",
    opacity: isReportLocked(item) ? 0.65 : 1,
  });

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

  const filteredRecords = records.filter((item) => {
    const searchableText = [
      item.investigation_number,
      item.investigation_source,
      item.event_type,
      item.test_name,
      item.area_room_equipment,
      item.product_part_number,
      item.lot_batch_number,
      item.observed_result,
      item.specification_limit,
      item.linked_ncmr_number,
    ]
      .join(" ")
      .toLowerCase();

    const matchesSearch = searchableText.includes(search.toLowerCase());
    const matchesStatus = statusFilter ? item.status === statusFilter : true;
    const matchesSource = sourceFilter ? item.investigation_source === sourceFilter : true;
    const matchesEventType = eventTypeFilter ? item.event_type === eventTypeFilter : true;

    let matchesImpact = true;
    if (impactFilter === "product_impact") matchesImpact = !!item.product_impact;
    if (impactFilter === "ncmr_required") matchesImpact = !!item.ncmr_required;
    if (impactFilter === "systemic_issue") matchesImpact = !!item.systemic_issue;
    if (impactFilter === "escalation_required") matchesImpact = !!item.escalation_required;

    return matchesSearch && matchesStatus && matchesSource && matchesEventType && matchesImpact;
  });

  const uniqueStatuses = Array.from(
    new Set(records.map((item) => item.status).filter(Boolean))
  ) as string[];

  const uniqueSources = Array.from(
    new Set(records.map((item) => item.investigation_source).filter(Boolean))
  ) as string[];

  const uniqueEventTypes = Array.from(
    new Set(records.map((item) => item.event_type).filter(Boolean))
  ) as string[];

  const badgeColor = (kind: string) => {
    if (kind === "closed") return "#16a34a";
    if (kind === "open") return "#2563eb";
    if (kind === "OOS - Out of Specification") return "#dc2626";
    if (kind === "OOT - Out of Trend") return "#f59e0b";
    if (kind === "Action Limit Exceeded") return "#dc2626";
    if (kind === "Alert Limit Exceeded") return "#f59e0b";
    if (kind === "Calibration Out of Tolerance") return "#7c3aed";
    if (kind === "Environmental Excursion") return "#0f766e";
    return "#6b7280";
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

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "12px",
          marginBottom: "20px",
        }}
      >
        <div style={summaryCardStyle}>
          <div style={summaryLabelStyle}>Total Investigations</div>
          <div style={summaryValueStyle}>{records.length}</div>
        </div>
        <div style={summaryCardStyle}>
          <div style={summaryLabelStyle}>Open / Active</div>
          <div style={summaryValueStyle}>{records.filter((x) => x.status !== "closed").length}</div>
        </div>
        <div style={summaryCardStyle}>
          <div style={summaryLabelStyle}>Product Impact</div>
          <div style={summaryValueStyle}>{productImpactCount}</div>
        </div>
        <div style={summaryCardStyle}>
          <div style={summaryLabelStyle}>Systemic Issues</div>
          <div style={summaryValueStyle}>{systemicIssueCount}</div>
        </div>
      </section>

      <section style={{ marginBottom: "20px" }}>
        <h3>Filters</h3>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search number, test, source, event, area, part, lot, NCMR"
          style={{
            padding: "8px",
            marginRight: "8px",
            marginBottom: "8px",
            minWidth: "330px",
          }}
        />

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ padding: "8px", marginRight: "8px", marginBottom: "8px" }}
        >
          <option value="">All Status</option>
          {uniqueStatuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>

        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          style={{ padding: "8px", marginRight: "8px", marginBottom: "8px" }}
        >
          <option value="">All Sources</option>
          {uniqueSources.map((source) => (
            <option key={source} value={source}>
              {source}
            </option>
          ))}
        </select>

        <select
          value={eventTypeFilter}
          onChange={(e) => setEventTypeFilter(e.target.value)}
          style={{ padding: "8px", marginRight: "8px", marginBottom: "8px" }}
        >
          <option value="">All Event Types</option>
          {uniqueEventTypes.map((event) => (
            <option key={event} value={event}>
              {event}
            </option>
          ))}
        </select>

        <select
          value={impactFilter}
          onChange={(e) => setImpactFilter(e.target.value)}
          style={{ padding: "8px", marginRight: "8px", marginBottom: "8px" }}
        >
          <option value="">All Impact / Escalation</option>
          <option value="product_impact">Product Impact</option>
          <option value="ncmr_required">NCMR Required</option>
          <option value="systemic_issue">Systemic Issue</option>
          <option value="escalation_required">Escalation Required</option>
        </select>

        <button
          onClick={() => {
            setSearch("");
            setStatusFilter("");
            setSourceFilter("");
            setEventTypeFilter("");
            setImpactFilter("");
          }}
          style={{ padding: "8px", marginBottom: "8px" }}
        >
          Clear Filters
        </button>

        <div style={{ marginTop: "6px", fontSize: "14px", color: "#4b5563" }}>
          Showing {filteredRecords.length} of {records.length} investigations
        </div>
      </section>

      {filteredRecords.length === 0 ? (
        <p>No investigations match the current filters.</p>
      ) : (
        <div style={{ display: "grid", gap: "16px" }}>
          {filteredRecords.map((item) => {
            const statusColor = badgeColor(item.status || "");
            const eventColor = badgeColor(item.event_type || "");

            return (
              <article
                key={item.id}
                style={{
                  border: item.product_impact ? "2px solid #dc2626" : "1px solid #d1d5db",
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
                      {item.investigation_number || "PENDING"} — {item.test_name || "Untitled Investigation"}
                    </h3>
                    <div style={{ color: "#4b5563", fontSize: "14px" }}>
                      {item.investigation_source || "N/A"} | {item.area_room_equipment || "No area / room / equipment"}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <span style={{ ...badgeBaseStyle, background: statusColor }}>
                      {item.status || "unknown"}
                    </span>
                    <span style={{ ...badgeBaseStyle, background: eventColor }}>
                      {item.event_type || "event not set"}
                    </span>
                  </div>
                </div>

                <div style={{ marginTop: "10px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {item.product_impact ? (
                    <span style={{ ...badgeBaseStyle, background: "#dc2626" }}>Product Impact</span>
                  ) : null}
                  {item.ncmr_required ? (
                    <span style={{ ...badgeBaseStyle, background: "#f59e0b" }}>NCMR Required</span>
                  ) : null}
                  {item.systemic_issue ? (
                    <span style={{ ...badgeBaseStyle, background: "#7c3aed" }}>Systemic Issue</span>
                  ) : null}
                  {item.escalation_required ? (
                    <span style={{ ...badgeBaseStyle, background: "#0f766e" }}>Escalation Required</span>
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
                  <div><strong>Source:</strong> {item.investigation_source || "N/A"}</div>
                  <div><strong>Event Type:</strong> {item.event_type || "N/A"}</div>
                  <div><strong>Area / Room / Equipment:</strong> {item.area_room_equipment || "N/A"}</div>
                  <div><strong>Product / Part:</strong> {item.product_part_number || "N/A"}</div>
                  <div><strong>Lot / Batch:</strong> {item.lot_batch_number || "N/A"}</div>
                  <div><strong>Date Detected:</strong> {item.date_detected || "N/A"}</div>
                  <div><strong>Observed Result:</strong> {item.observed_result || "N/A"}</div>
                  <div><strong>Limit:</strong> {item.specification_limit || "N/A"}</div>
                  <div><strong>Linked NCMR:</strong> {item.linked_ncmr_number || "N/A"}</div>
                  <div><strong>Status:</strong> {item.status || "N/A"}</div>
                </div>

                <div style={{ marginTop: "14px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <a
                    href={`/oos-oot/${item.id}`}
                    style={{
                      display: "inline-block",
                      background: "#2563eb",
                      color: "white",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      textDecoration: "none",
                    }}
                  >
                    Open Investigation
                  </a>

                  {isReportLocked(item) ? (
                    <span style={reportButtonStyle(item)}>
                      OOS/OOT Report Locked
                    </span>
                  ) : (
                    <a
                      href={`/oos-oot/${item.id}/report`}
                      target="_blank"
                      rel="noreferrer"
                      style={reportButtonStyle(item)}
                    >
                      OOS/OOT Report
                    </a>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
