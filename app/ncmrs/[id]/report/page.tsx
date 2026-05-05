"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";

export default function NcmrFullRecordReportPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [record, setRecord] = useState<any>(null);
  const [linkedCapa, setLinkedCapa] = useState<any>(null);
  const [mrbApprovers, setMrbApprovers] = useState<any[]>([]);
  const [affectedItems, setAffectedItems] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReport = async () => {
      const recordRes = await supabase
        .from("ncmrs")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (recordRes.error) {
        alert(recordRes.error.message);
        setLoading(false);
        return;
      }

      const ncmr = recordRes.data;
      setRecord(ncmr);

      if (ncmr?.capa_id) {
        const capaRes = await supabase
          .from("capas")
          .select("*")
          .eq("id", ncmr.capa_id)
          .maybeSingle();

        if (!capaRes.error) setLinkedCapa(capaRes.data || null);
      }

      const approverRes = await supabase
        .from("ncmr_mrb_approvers")
        .select("*")
        .eq("ncmr_id", id)
        .order("created_at", { ascending: true });

      if (!approverRes.error) setMrbApprovers(approverRes.data || []);

      const affectedItemsRes = await supabase
        .from("ncmr_affected_items")
        .select("*")
        .eq("ncmr_id", id)
        .order("created_at", { ascending: true });

      if (!affectedItemsRes.error) setAffectedItems(affectedItemsRes.data || []);

      const logRes = await supabase
        .from("audit_logs")
        .select("*")
        .eq("entity_type", "ncmr")
        .eq("entity_id", id)
        .order("created_at", { ascending: true });

      if (!logRes.error) setAuditLogs(logRes.data || []);

      setLoading(false);
    };

    if (id) fetchReport();
  }, [id]);

  if (loading) {
    return <main style={{ padding: "20px" }}>Loading NCMR full record...</main>;
  }

  if (!record) {
    return <main style={{ padding: "20px" }}>NCMR record not found.</main>;
  }

  return (
    <main style={pageStyle}>
      <div className="no-print" style={{ marginBottom: "18px" }}>
        <button onClick={() => window.print()} style={{ padding: "8px 12px", marginRight: "10px" }}>
          Print / Save as PDF
        </button>
        <a href={`/ncmrs/${id}`}>Back to NCMR Workflow</a>
      </div>

      <header style={headerStyle}>
        <div>
          <h1 style={{ margin: 0 }}>NCMR Full Controlled Record</h1>
          <div><strong>NCMR Number:</strong> {displayValue(record.ncmr_number || "NCMR-PENDING")}</div>
          <div><strong>Record ID:</strong> {displayValue(record.id)}</div>
          <div><strong>Status:</strong> {displayValue(record.status)}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div><strong>Generated:</strong> {new Date().toISOString()}</div>
          <div><strong>QMS Record Type:</strong> Nonconforming Material Report</div>
          <div><strong>Print Use:</strong> Audit / controlled record review</div>
        </div>
      </header>

      <section style={sectionStyle}>
        <h2>1. Record Identification</h2>
        <div style={gridStyle}>
          <Field label="NCMR Number" value={record.ncmr_number} />
          <Field label="Title" value={record.title} />
          <Field label="Status" value={record.status} />
          <Field label="Review Status" value={record.review_status} />
          <Field label="Created At" value={record.created_at} />
          <Field label="Closed At" value={record.closed_at} />
          <Field label="Owner" value={record.owner} />
          <Field label="Investigator" value={record.investigator} />
        </div>
      </section>

      <section style={sectionStyle}>
        <h2>2. Initiation / Event Details</h2>
        <div style={gridStyle}>
          <Field label="Issue Description" value={record.issue_description} />
          <Field label="Product Part Number" value={record.product_part_number} />
          <Field label="Lot Number" value={record.lot_number} />
          <Field label="Work Order Number" value={record.workorder_number} />
          <Field label="Source of Detection" value={record.source_of_detection} />
          <Field label="Department" value={record.department} />
          <Field label="Date Detected" value={record.date_detected} />
          <Field label="Quantity Affected" value={record.quantity_affected} />
          <Field label="Supplier Name" value={record.supplier_name} />
          <Field label="Supplier Lot" value={record.supplier_lot} />
          <Field label="Site / Location" value={record.site_location} />
          <Field label="Defect Category" value={record.defect_category} />
          <Field label="Defect Subcategory" value={record.defect_subcategory} />
        </div>
      </section>

      <section style={sectionStyle}>
        <h2>3. Affected Items / Multi-Part, Multi-Lot, Multi-Disposition</h2>

        {affectedItems.length === 0 ? (
          <p>No additional affected items recorded.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr>
                <th style={thStyle}>Part Number</th>
                <th style={thStyle}>Lot Number</th>
                <th style={thStyle}>Work Order</th>
                <th style={thStyle}>Qty Affected</th>
                <th style={thStyle}>Qty Quarantined</th>
                <th style={thStyle}>Disposition</th>
                <th style={thStyle}>Disposition Justification</th>
              </tr>
            </thead>
            <tbody>
              {affectedItems.map((item) => (
                <tr key={item.id}>
                  <td style={tdStyle}>{displayValue(item.product_part_number)}</td>
                  <td style={tdStyle}>{displayValue(item.lot_number)}</td>
                  <td style={tdStyle}>{displayValue(item.workorder_number)}</td>
                  <td style={tdStyle}>{displayValue(item.quantity_affected)}</td>
                  <td style={tdStyle}>{displayValue(item.quarantined_quantity)}</td>
                  <td style={tdStyle}>{displayValue(item.product_disposition)}</td>
                  <td style={tdStyle}>{displayValue(item.disposition_justification)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section style={sectionStyle}>
        <h2>4. Containment / Immediate Correction</h2>
        <Field label="Containment Action" value={record.containment_action} />
        <Field label="Containment Owner" value={record.containment_owner} />
        <Field label="Material Status" value={record.material_status} />
        <Field label="Quarantined Quantity" value={record.quarantined_quantity} />
        <Field label="Immediate Correction" value={record.immediate_correction} />
      </section>

      <section style={sectionStyle}>
        <h2>5. Investigation / Root Cause</h2>
        <Field label="Problem Description" value={record.problem_description} />
        <Field label="Investigation Summary" value={record.investigation_summary} />
        <Field label="Root Cause Category" value={record.root_cause_category} />
        <Field label="Root Cause" value={record.root_cause} />
        <Field label="Correction / Corrective Action Proposal" value={record.correction_action_proposal} />
        <Field label="Corrective Action Recommendation" value={record.corrective_action} />
      </section>

      <section style={sectionStyle}>
        <h2>6. Risk Assessment / CAPA Decision</h2>
        <div style={gridStyle}>
          <Field label="Risk Assessment" value={record.risk_assessment} />
          <Field label="Severity" value={record.severity} />
          <Field label="CAPA Required" value={record.capa_required ? "Yes" : "No"} />
          <Field label="CAPA Justification" value={record.capa_justification} />
          <Field label="Recurring Issue" value={record.recurring_issue ? "Yes" : "No"} />
          <Field label="Recurrence Reason" value={record.recurrence_reason} />
          <Field label="Supplier CAPA / SCAR Required" value={record.supplier_capa_required ? "Yes" : "No"} />
          <Field label="Supplier CAPA / SCAR Reason" value={record.supplier_capa_reason} />
        </div>
      </section>

      <section style={sectionStyle}>
        <h2>7. Disposition / MRB Decision</h2>
        <Field label="Product Disposition" value={record.product_disposition || record.disposition} />
        <Field label="Disposition Justification" value={record.disposition_justification} />

        <div style={signatureStyle}>
          <h3>MRB Electronic Signature</h3>
          <Field label="MRB Approved By" value={record.mrb_approved_by} />
          <Field label="MRB Approved At" value={record.mrb_approved_at} />
          <Field label="Signature Email Entered" value={record.mrb_signature_email_entered} />
          <Field label="Signature Meaning" value={record.mrb_signature_meaning} />
          <Field label="Additional Approvers Entered" value={record.mrb_additional_approvers} />
          <Field label="Authentication Method" value="Active authenticated session with email confirmation" />
        </div>

        {mrbApprovers.length > 0 ? (
          <div>
            <h3>Additional MRB Approvers</h3>
            {mrbApprovers.map((approver) => (
              <div key={approver.id} style={{ borderTop: "1px solid #ddd", paddingTop: "8px" }}>
                <Field label="Approver Email" value={approver.approver_email} />
                <Field label="Approver Role" value={approver.approver_role} />
                <Field label="Approval Status" value={approver.approval_status} />
                <Field label="Signed At" value={approver.signed_at} />
                <Field label="Signature Meaning" value={approver.signature_meaning} />
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section style={sectionStyle}>
        <h2>8. Implementation / Evidence</h2>
        <Field label="Correction Implementation" value={record.correction_implementation} />
        <Field label="Implemented By" value={record.correction_implemented_by} />
        <Field label="Implemented At" value={record.correction_implemented_at} />
        <Field label="Evidence URL" value={record.evidence_url} />
        <Field label="Evidence Notes" value={record.evidence_notes} />
      </section>

      <section style={sectionStyle}>
        <h2>9. Linked Records</h2>
        <Field label="Linked CAPA ID" value={record.capa_id} />
        <Field label="Linked CAPA Number" value={linkedCapa?.capa_number} />
        <Field label="Linked CAPA Title" value={linkedCapa?.title} />
        <Field label="Linked CAPA Status" value={linkedCapa?.status} />
      </section>

      <section style={sectionStyle}>
        <h2>10. Closure / Electronic Signature</h2>
        <div style={signatureStyle}>
          <Field label="Closed By" value={record.ncmr_closed_by} />
          <Field label="Closed At" value={record.closed_at} />
          <Field label="Investigation Completed At" value={record.investigation_completed_at} />
          <Field label="Signature Meaning" value={record.ncmr_signature_meaning} />
          <Field label="Authentication Method" value="Active authenticated session confirmation" />
        </div>
      </section>

      <section style={sectionStyle}>
        <h2>11. Audit Trail Summary</h2>
        {auditLogs.length === 0 ? (
          <p>No audit log entries found for this NCMR.</p>
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
        NCMR Controlled Record | {record.ncmr_number || record.id} | Generated {new Date().toISOString()}
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

const thStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  padding: "8px",
  textAlign: "left",
  background: "#f1f5f9",
};

const tdStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  padding: "8px",
  verticalAlign: "top",
};
