"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";

export default function OosOotFullRecordReportPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [record, setRecord] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReport = async () => {
      const recordRes = await supabase
        .from("oos_oot_investigations")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (recordRes.error) {
        alert(recordRes.error.message);
        setLoading(false);
        return;
      }

      setRecord(recordRes.data);

      const logRes = await supabase
        .from("audit_logs")
        .select("*")
        .eq("entity_type", "oos_oot")
        .eq("entity_id", id)
        .order("created_at", { ascending: true });

      if (!logRes.error) setAuditLogs(logRes.data || []);

      setLoading(false);
    };

    if (id) fetchReport();
  }, [id]);

  if (loading) return <main style={{ padding: "20px" }}>Loading OOS/OOT full record...</main>;
  if (!record) return <main style={{ padding: "20px" }}>OOS/OOT record not found.</main>;

  return (
    <main style={pageStyle}>
      <div className="no-print" style={{ marginBottom: "18px" }}>
        <button onClick={() => window.print()} style={{ padding: "8px 12px", marginRight: "10px" }}>
          Print / Save as PDF
        </button>
        <a href={`/oos-oot/${id}`}>Back to OOS/OOT Workflow</a>
      </div>

      <header style={headerStyle}>
        <div>
          <h1 style={{ margin: 0 }}>OOS / OOT Full Controlled Record</h1>
          <div><strong>Investigation Number:</strong> {displayValue(record.investigation_number || "PENDING")}</div>
          <div><strong>Record ID:</strong> {displayValue(record.id)}</div>
          <div><strong>Status:</strong> {displayValue(record.status)}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div><strong>Generated:</strong> {new Date().toISOString()}</div>
          <div><strong>QMS Record Type:</strong> OOS / OOT / Environmental Monitoring Investigation</div>
          <div><strong>Print Use:</strong> Audit / controlled record review</div>
        </div>
      </header>

      <section style={sectionStyle}>
        <h2>1. Record Identification / Initiation</h2>
        <div style={gridStyle}>
          <Field label="Investigation Number" value={record.investigation_number} />
          <Field label="Investigation Source" value={record.investigation_source} />
          <Field label="Event Type" value={record.event_type} />
          <Field label="Test Name" value={record.test_name} />
          <Field label="Test Method" value={record.test_method} />
          <Field label="Area / Room / Equipment" value={record.area_room_equipment} />
          <Field label="Product / Part Number" value={record.product_part_number} />
          <Field label="Lot / Batch Number" value={record.lot_batch_number} />
          <Field label="Sample ID" value={record.sample_id} />
          <Field label="Date Detected" value={record.date_detected} />
          <Field label="Detected By" value={record.detected_by} />
          <Field label="Created At" value={record.created_at} />
        </div>
      </section>

      <section style={sectionStyle}>
        <h2>2. Result / Limit</h2>
        <div style={gridStyle}>
          <Field label="Observed Result" value={record.observed_result} />
          <Field label="Specification / Alert / Action Limit" value={record.specification_limit} />
          <Field label="Unit of Measure" value={record.unit_of_measure} />
        </div>
      </section>

      <section style={sectionStyle}>
        <h2>3. Immediate Assessment / Containment</h2>
        <Field label="Immediate Action" value={record.immediate_action} />
        <div style={gridStyle}>
          <Field label="Product Affected" value={record.product_affected ? "Yes" : "No"} />
          <Field label="Material on Hold" value={record.material_on_hold ? "Yes" : "No"} />
          <Field label="Room / Equipment Impacted" value={record.room_equipment_impacted ? "Yes" : "No"} />
          <Field label="Containment Owner" value={record.containment_owner} />
          <Field label="Quarantined Quantity" value={record.quarantined_quantity} />
        </div>
      </section>

      <section style={sectionStyle}>
        <h2>4. Phase 1 Investigation</h2>
        <div style={gridStyle}>
          <Field label="Sample Handling Issue" value={record.sample_handling_issue ? "Yes" : "No"} />
          <Field label="Calculation / Transcription Error" value={record.calculation_error ? "Yes" : "No"} />
          <Field label="Method Deviation" value={record.method_deviation ? "Yes" : "No"} />
          <Field label="Instrument / Equipment Issue" value={record.instrument_equipment_issue ? "Yes" : "No"} />
          <Field label="Operator Issue" value={record.operator_issue ? "Yes" : "No"} />
          <Field label="Environmental Condition Issue" value={record.environmental_condition_issue ? "Yes" : "No"} />
          <Field label="Retest Justified" value={record.retest_justified ? "Yes" : "No"} />
        </div>
        <Field label="Phase 1 Conclusion" value={record.phase1_conclusion} />
      </section>

      <section style={sectionStyle}>
        <h2>5. Phase 2 Full Investigation / Root Cause</h2>
        <Field label="Expanded Scope" value={record.expanded_scope} />
        <Field label="Historical Trend Review" value={record.historical_trend_review} />
        <Field label="Other Lots / Rooms / Equipment Affected" value={record.other_lots_rooms_equipment_affected} />
        <Field label="Root Cause Category" value={record.root_cause_category} />
        <Field label="Root Cause Description" value={record.root_cause_description} />
        <Field label="Impact Assessment" value={record.impact_assessment} />
        <Field label="Risk Assessment" value={record.risk_assessment} />
      </section>

      <section style={sectionStyle}>
        <h2>6. Product Impact / NCMR Linkage</h2>
        <div style={gridStyle}>
          <Field label="Product Impact" value={record.product_impact ? "Yes" : "No"} />
          <Field label="NCMR Required" value={record.ncmr_required ? "Yes" : "No"} />
          <Field label="Linked NCMR Number" value={record.linked_ncmr_number} />
          <Field label="Affected Product / Lot / Quantity" value={record.affected_product_lot_quantity} />
        </div>
        <Field label="No Product Impact Justification" value={record.no_product_impact_justification} />
      </section>

      <section style={sectionStyle}>
        <h2>7. Systemic Issue / Escalation</h2>
        <div style={gridStyle}>
          <Field label="Systemic Issue" value={record.systemic_issue ? "Yes" : "No"} />
          <Field label="Escalation Required" value={record.escalation_required ? "Yes" : "No"} />
        </div>
        <Field label="Escalation Notes" value={record.escalation_notes} />
      </section>

      <section style={sectionStyle}>
        <h2>8. Disposition / Decision</h2>
        <Field label="Disposition Decision" value={record.disposition_decision} />
        <Field label="Disposition Justification" value={record.disposition_justification} />
      </section>

      <section style={sectionStyle}>
        <h2>9. Closure / Electronic Signature</h2>
        <Field label="Closure Summary" value={record.closure_summary} />
        <div style={signatureStyle}>
          <Field label="Closed At" value={record.closed_at} />
          <Field label="Signed By" value={record.signed_by} />
          <Field label="Signed At" value={record.signed_at} />
          <Field label="Signature Method" value={record.signature_method || "session_confirm"} />
          <Field label="Signature Meaning" value={record.signature_meaning} />
          <Field label="Authentication Method" value="Active authenticated session confirmation" />
        </div>
      </section>

      <section style={sectionStyle}>
        <h2>10. Audit Trail Summary</h2>
        {auditLogs.length === 0 ? (
          <p>No audit log entries found for this OOS/OOT investigation.</p>
        ) : (
          auditLogs.map((log) => (
            <div key={log.id} style={{ borderTop: "1px solid #ddd", paddingTop: "8px", marginTop: "8px" }}>
              <Field label="Date / Time" value={log.created_at} />
              <Field label="User" value={log.user_email} />
              <Field label="Action" value={log.action} />
              <Field label="Details" value={log.details} />
            </div>
          ))
        )}
      </section>

      <footer className="print-footer">
        OOS/OOT Controlled Record | {record.investigation_number || record.id} | Generated {new Date().toISOString()}
      </footer>

      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }

          body {
            color: black;
            background: white;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          main {
            padding: 18px !important;
          }

          section {
            page-break-inside: avoid;
          }

          .print-footer {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            font-size: 10px;
            border-top: 1px solid #999;
            padding: 6px 20px;
            background: white;
          }
        }

        @page {
          margin: 0.75in;
        }
      `}</style>
    </main>
  );
}

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div style={{ marginBottom: "8px" }}>
      <strong>{label}:</strong> {displayValue(value)}
    </div>
  );
}

function displayValue(input: any) {
  return input === null || input === undefined || input === "" ? "N/A" : String(input);
}

const pageStyle: React.CSSProperties = {
  padding: "36px",
  fontFamily: "Arial, sans-serif",
  color: "#111",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "20px",
  borderBottom: "2px solid #111",
  paddingBottom: "14px",
  marginBottom: "18px",
};

const sectionStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: "8px",
  padding: "14px",
  marginTop: "16px",
  background: "#fff",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "8px",
};

const signatureStyle: React.CSSProperties = {
  border: "1px solid #94a3b8",
  borderRadius: "8px",
  padding: "12px",
  marginTop: "10px",
  background: "#f8fafc",
};
