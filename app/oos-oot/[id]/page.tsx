"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

export default function OosOotDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [record, setRecord] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [userEmail, setUserEmail] = useState("");

  const [sampleHandlingIssue, setSampleHandlingIssue] = useState("no");
  const [calculationError, setCalculationError] = useState("no");
  const [methodDeviation, setMethodDeviation] = useState("no");
  const [instrumentEquipmentIssue, setInstrumentEquipmentIssue] = useState("no");
  const [operatorIssue, setOperatorIssue] = useState("no");
  const [environmentalConditionIssue, setEnvironmentalConditionIssue] = useState("no");
  const [retestJustified, setRetestJustified] = useState("no");
  const [phase1Conclusion, setPhase1Conclusion] = useState("");

  const [expandedScope, setExpandedScope] = useState("");
  const [historicalTrendReview, setHistoricalTrendReview] = useState("");
  const [otherAffected, setOtherAffected] = useState("");
  const [rootCauseCategory, setRootCauseCategory] = useState("");
  const [rootCauseDescription, setRootCauseDescription] = useState("");
  const [impactAssessment, setImpactAssessment] = useState("");
  const [riskAssessment, setRiskAssessment] = useState("");

  const [dispositionDecision, setDispositionDecision] = useState("");
  const [dispositionJustification, setDispositionJustification] = useState("");

  const [productImpact, setProductImpact] = useState("no");
  const [ncmrRequired, setNcmrRequired] = useState("no");
  const [linkedNcmrNumber, setLinkedNcmrNumber] = useState("");
  const [affectedProductLotQuantity, setAffectedProductLotQuantity] = useState("");
  const [noProductImpactJustification, setNoProductImpactJustification] = useState("");

  const [systemicIssue, setSystemicIssue] = useState("no");
  const [escalationRequired, setEscalationRequired] = useState("no");
  const [escalationNotes, setEscalationNotes] = useState("");

  const [closureSummary, setClosureSummary] = useState("");

  const fetchUser = async () => {
    const { data } = await supabase.auth.getUser();
    setUserEmail(data?.user?.email || "");
  };

  const fetchRecord = async () => {
    const { data, error } = await supabase
      .from("oos_oot_investigations")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    if (!data) {
      alert("Investigation not found.");
      setRecord(null);
      setLoading(false);
      return;
    }

    setRecord(data);

    setSampleHandlingIssue(data.sample_handling_issue ? "yes" : "no");
    setCalculationError(data.calculation_error ? "yes" : "no");
    setMethodDeviation(data.method_deviation ? "yes" : "no");
    setInstrumentEquipmentIssue(data.instrument_equipment_issue ? "yes" : "no");
    setOperatorIssue(data.operator_issue ? "yes" : "no");
    setEnvironmentalConditionIssue(data.environmental_condition_issue ? "yes" : "no");
    setRetestJustified(data.retest_justified ? "yes" : "no");
    setPhase1Conclusion(data.phase1_conclusion || "");

    setExpandedScope(data.expanded_scope || "");
    setHistoricalTrendReview(data.historical_trend_review || "");
    setOtherAffected(data.other_lots_rooms_equipment_affected || "");
    setRootCauseCategory(data.root_cause_category || "");
    setRootCauseDescription(data.root_cause_description || "");
    setImpactAssessment(data.impact_assessment || "");
    setRiskAssessment(data.risk_assessment || "");

    setDispositionDecision(data.disposition_decision || "");
    setDispositionJustification(data.disposition_justification || "");

    setProductImpact(data.product_impact ? "yes" : "no");
    setNcmrRequired(data.ncmr_required ? "yes" : "no");
    setLinkedNcmrNumber(data.linked_ncmr_number || "");
    setAffectedProductLotQuantity(data.affected_product_lot_quantity || "");
    setNoProductImpactJustification(data.no_product_impact_justification || "");

    setSystemicIssue(data.systemic_issue ? "yes" : "no");
    setEscalationRequired(data.escalation_required ? "yes" : "no");
    setEscalationNotes(data.escalation_notes || "");

    setClosureSummary(data.closure_summary || "");

    setLoading(false);
  };

  const addAuditLog = async (action: string, details: string) => {
    await supabase.from("audit_logs").insert({
      entity_type: "oos_oot",
      entity_id: id,
      action,
      details,
      user_email: userEmail || "unknown",
    });
  };

  const saveWorkflow = async () => {
    if (productImpact === "yes" && ncmrRequired === "yes" && !linkedNcmrNumber) {
      alert("Linked NCMR number is required when NCMR is required.");
      return;
    }

    if (productImpact === "no" && !noProductImpactJustification) {
      alert("No product impact justification is required.");
      return;
    }

    const { error } = await supabase
      .from("oos_oot_investigations")
      .update({
        sample_handling_issue: sampleHandlingIssue === "yes",
        calculation_error: calculationError === "yes",
        method_deviation: methodDeviation === "yes",
        instrument_equipment_issue: instrumentEquipmentIssue === "yes",
        operator_issue: operatorIssue === "yes",
        environmental_condition_issue: environmentalConditionIssue === "yes",
        retest_justified: retestJustified === "yes",
        phase1_conclusion: phase1Conclusion,

        expanded_scope: expandedScope,
        historical_trend_review: historicalTrendReview,
        other_lots_rooms_equipment_affected: otherAffected,
        root_cause_category: rootCauseCategory,
        root_cause_description: rootCauseDescription,
        impact_assessment: impactAssessment,
        risk_assessment: riskAssessment,

        disposition_decision: dispositionDecision,
        disposition_justification: dispositionJustification,

        product_impact: productImpact === "yes",
        ncmr_required: ncmrRequired === "yes",
        linked_ncmr_number: linkedNcmrNumber,
        affected_product_lot_quantity: affectedProductLotQuantity,
        no_product_impact_justification: noProductImpactJustification,

        systemic_issue: systemicIssue === "yes",
        escalation_required: escalationRequired === "yes",
        escalation_notes: escalationNotes,

        closure_summary: closureSummary,
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await addAuditLog("workflow_saved", "OOS/OOT investigation workflow saved.");
    alert("Investigation saved.");
    fetchRecord();
  };

  const closeInvestigation = async () => {
    if (!phase1Conclusion) return alert("Phase 1 conclusion is required.");
    if (!rootCauseCategory) return alert("Root cause category is required.");
    if (!rootCauseDescription) return alert("Root cause description is required.");
    if (!impactAssessment) return alert("Impact assessment is required.");
    if (!riskAssessment) return alert("Risk assessment is required.");
    if (!dispositionDecision) return alert("Disposition decision is required.");
    if (!dispositionJustification) return alert("Disposition justification is required.");

    if (productImpact === "yes" && ncmrRequired === "yes" && !linkedNcmrNumber) {
      return alert("Linked NCMR number is required before closure.");
    }

    if (productImpact === "no" && !noProductImpactJustification) {
      return alert("No product impact justification is required before closure.");
    }

    if (systemicIssue === "yes" && escalationRequired === "yes" && !escalationNotes) {
      return alert("Escalation notes are required when escalation is required.");
    }

    if (!closureSummary) return alert("Closure summary is required.");

    const confirmed = window.confirm(
      "Electronic Signature:\n\nI confirm this OOS/OOT investigation has been reviewed, impact/risk assessment completed, disposition documented, and the investigation is approved for closure.\n\nBy clicking OK, my active login session will be used as my electronic signature."
    );

    if (!confirmed) return;

    const now = new Date().toISOString();

    const meaning =
      "I confirm this OOS/OOT investigation has been reviewed, impact/risk assessment completed, disposition documented, and the investigation is approved for closure.";

    const { error } = await supabase
      .from("oos_oot_investigations")
      .update({
        sample_handling_issue: sampleHandlingIssue === "yes",
        calculation_error: calculationError === "yes",
        method_deviation: methodDeviation === "yes",
        instrument_equipment_issue: instrumentEquipmentIssue === "yes",
        operator_issue: operatorIssue === "yes",
        environmental_condition_issue: environmentalConditionIssue === "yes",
        retest_justified: retestJustified === "yes",
        phase1_conclusion: phase1Conclusion,

        expanded_scope: expandedScope,
        historical_trend_review: historicalTrendReview,
        other_lots_rooms_equipment_affected: otherAffected,
        root_cause_category: rootCauseCategory,
        root_cause_description: rootCauseDescription,
        impact_assessment: impactAssessment,
        risk_assessment: riskAssessment,

        disposition_decision: dispositionDecision,
        disposition_justification: dispositionJustification,

        product_impact: productImpact === "yes",
        ncmr_required: ncmrRequired === "yes",
        linked_ncmr_number: linkedNcmrNumber,
        affected_product_lot_quantity: affectedProductLotQuantity,
        no_product_impact_justification: noProductImpactJustification,

        systemic_issue: systemicIssue === "yes",
        escalation_required: escalationRequired === "yes",
        escalation_notes: escalationNotes,

        closure_summary: closureSummary,
        status: "closed",
        closed_at: now,
        signed_by: userEmail,
        signed_at: now,
        signature_meaning: meaning,
        signature_method: "session_confirm",
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await addAuditLog(
      "closed_signature",
      `OOS/OOT investigation closed with session-based e-signature. Meaning: ${meaning}`
    );

    alert("Investigation closed.");
    fetchRecord();
  };

  useEffect(() => {
    if (id) {
      fetchUser();
      fetchRecord();
    }
  }, [id]);

  if (loading) {
    return <main style={{ padding: "20px" }}>Loading...</main>;
  }

  if (!record) {
    return <main style={{ padding: "20px" }}>Investigation not found.</main>;
  }

  return (
    <main style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>OOS / OOT Investigation Workflow</h1>
      <button
  onClick={() => window.open(`/oos-oot/${id}/report`, "_blank")}
>
  📄 Print Full OOS/OOT Report
</button>

      <p><strong>Logged-in:</strong> {userEmail || "none"}</p>

      <section style={sectionStyle}>
        <h2>Record Summary</h2>
        <p><strong>Investigation Number:</strong> {record.investigation_number}</p>
        <p><strong>Source:</strong> {record.investigation_source}</p>
        <p><strong>Event Type:</strong> {record.event_type}</p>
        <p><strong>Test Name:</strong> {record.test_name}</p>
        <p><strong>Method:</strong> {record.test_method}</p>
        <p><strong>Area / Room / Equipment:</strong> {record.area_room_equipment}</p>
        <p><strong>Product / Part:</strong> {record.product_part_number || "N/A"}</p>
        <p><strong>Lot / Batch:</strong> {record.lot_batch_number || "N/A"}</p>
        <p><strong>Observed Result:</strong> {record.observed_result}</p>
        <p><strong>Limit:</strong> {record.specification_limit}</p>
        <p><strong>Status:</strong> {record.status}</p>
      </section>

      <section style={sectionStyle}>
        <h2>1. Phase 1 Investigation</h2>

        <SelectYN label="Sample Handling Issue?" value={sampleHandlingIssue} setValue={setSampleHandlingIssue} />
        <SelectYN label="Calculation / Transcription Error?" value={calculationError} setValue={setCalculationError} />
        <SelectYN label="Method Deviation?" value={methodDeviation} setValue={setMethodDeviation} />
        <SelectYN label="Instrument / Equipment Issue?" value={instrumentEquipmentIssue} setValue={setInstrumentEquipmentIssue} />
        <SelectYN label="Operator Issue?" value={operatorIssue} setValue={setOperatorIssue} />
        <SelectYN label="Environmental Condition Issue?" value={environmentalConditionIssue} setValue={setEnvironmentalConditionIssue} />
        <SelectYN label="Retest Justified?" value={retestJustified} setValue={setRetestJustified} />

        <label>Phase 1 Conclusion</label><br />
        <textarea value={phase1Conclusion} onChange={(e) => setPhase1Conclusion(e.target.value)} rows={4} style={textAreaStyle} />
      </section>

      <section style={sectionStyle}>
        <h2>2. Phase 2 Full Investigation</h2>

        <label>Expanded Scope</label><br />
        <textarea value={expandedScope} onChange={(e) => setExpandedScope(e.target.value)} rows={3} style={textAreaStyle} />

        <br /><br />
        <label>Historical Trend Review</label><br />
        <textarea value={historicalTrendReview} onChange={(e) => setHistoricalTrendReview(e.target.value)} rows={3} style={textAreaStyle} />

        <br /><br />
        <label>Other Lots / Rooms / Equipment Affected</label><br />
        <textarea value={otherAffected} onChange={(e) => setOtherAffected(e.target.value)} rows={3} style={textAreaStyle} />

        <br /><br />
        <label>Root Cause Category</label><br />
        <select value={rootCauseCategory} onChange={(e) => setRootCauseCategory(e.target.value)} style={fieldStyle}>
          <option value="">Select category</option>
          <option value="laboratory_error">Laboratory Error</option>
          <option value="method_issue">Method Issue</option>
          <option value="equipment_issue">Equipment Issue</option>
          <option value="operator_error">Operator Error</option>
          <option value="environmental_condition">Environmental Condition</option>
          <option value="process_issue">Process Issue</option>
          <option value="supplier_issue">Supplier Issue</option>
          <option value="no_assignable_cause">No Assignable Cause</option>
        </select>

        <br /><br />
        <label>Root Cause Description</label><br />
        <textarea value={rootCauseDescription} onChange={(e) => setRootCauseDescription(e.target.value)} rows={4} style={textAreaStyle} />

        <br /><br />
        <label>Impact Assessment</label><br />
        <textarea value={impactAssessment} onChange={(e) => setImpactAssessment(e.target.value)} rows={4} style={textAreaStyle} />

        <br /><br />
        <label>Risk Assessment</label><br />
        <textarea value={riskAssessment} onChange={(e) => setRiskAssessment(e.target.value)} rows={4} style={textAreaStyle} />
      </section>

      <section style={sectionStyle}>
        <h2>3. Disposition / Decision</h2>

        <label>Disposition Decision</label><br />
        <select value={dispositionDecision} onChange={(e) => setDispositionDecision(e.target.value)} style={fieldStyle}>
          <option value="">Select decision</option>
          <option value="accept_valid_no_impact">Accept as valid - no impact</option>
          <option value="accept_with_justification">Accept with justification</option>
          <option value="reject_result">Reject result</option>
          <option value="retest_approved">Retest approved</option>
          <option value="resample_approved">Resample approved</option>
          <option value="product_hold">Product hold</option>
          <option value="product_release_allowed">Product release allowed</option>
          <option value="product_rejection">Product rejection</option>
          <option value="room_equipment_returned_to_service">Room/equipment returned to service</option>
          <option value="calibration_adjustment_required">Calibration adjustment required</option>
          <option value="equipment_removed_from_service">Equipment removed from service</option>
        </select>

        <br /><br />
        <label>Disposition Justification</label><br />
        <textarea value={dispositionJustification} onChange={(e) => setDispositionJustification(e.target.value)} rows={4} style={textAreaStyle} />
      </section>

      <section style={sectionStyle}>
        <h2>4. Product Impact / NCMR Linkage</h2>

        <SelectYN label="Product Impact?" value={productImpact} setValue={setProductImpact} />

        {productImpact === "yes" ? (
          <>
            <SelectYN label="NCMR Required?" value={ncmrRequired} setValue={setNcmrRequired} />

            <label>Linked NCMR Number</label><br />
            <input value={linkedNcmrNumber} onChange={(e) => setLinkedNcmrNumber(e.target.value)} placeholder="Example: NCMR0000001" style={fieldStyle} />

            <br /><br />
            <label>Affected Product / Lot / Quantity</label><br />
            <textarea value={affectedProductLotQuantity} onChange={(e) => setAffectedProductLotQuantity(e.target.value)} rows={3} style={textAreaStyle} />
          </>
        ) : (
          <>
            <label>No Product Impact Justification</label><br />
            <textarea value={noProductImpactJustification} onChange={(e) => setNoProductImpactJustification(e.target.value)} rows={3} style={textAreaStyle} />
          </>
        )}
      </section>

      <section style={sectionStyle}>
        <h2>5. Systemic Issue / Escalation</h2>

        <SelectYN label="Systemic Issue Identified?" value={systemicIssue} setValue={setSystemicIssue} />
        <SelectYN label="Escalation Required?" value={escalationRequired} setValue={setEscalationRequired} />

        <label>Escalation Notes</label><br />
        <textarea value={escalationNotes} onChange={(e) => setEscalationNotes(e.target.value)} rows={3} style={textAreaStyle} />
      </section>

      <section style={sectionStyle}>
        <h2>6. Closure</h2>

        <label>Closure Summary</label><br />
        <textarea value={closureSummary} onChange={(e) => setClosureSummary(e.target.value)} rows={4} style={textAreaStyle} />

        {record.signed_by ? (
          <div style={{ marginTop: "12px" }}>
            <strong>Electronic Signature:</strong><br />
            Signed By: {record.signed_by}<br />
            Signed At: {record.signed_at}<br />
            Method: {record.signature_method || "session_confirm"}<br />
            Meaning: {record.signature_meaning}
          </div>
        ) : null}
      </section>

      <button onClick={saveWorkflow} style={{ marginRight: "10px" }}>
        Save Investigation
      </button>

      <button onClick={closeInvestigation} style={{ marginRight: "10px" }}>
        Close with E-Signature
      </button>

      <a href="/oos-oot">Back to OOS/OOT</a>
    </main>
  );
}

function SelectYN({
  label,
  value,
  setValue,
}: {
  label: string;
  value: string;
  setValue: (value: string) => void;
}) {
  return (
    <div style={{ marginBottom: "12px" }}>
      <label>{label}</label><br />
      <select value={value} onChange={(e) => setValue(e.target.value)} style={fieldStyle}>
        <option value="no">No</option>
        <option value="yes">Yes</option>
      </select>
    </div>
  );
}

const sectionStyle: React.CSSProperties = {
  border: "1px solid #ccc",
  padding: "16px",
  marginBottom: "20px",
  borderRadius: "8px",
};

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
