"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";

export default function NcmrRecordPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [snapshot, setSnapshot] = useState<any>(null);
  const [record, setRecord] = useState<any>(null);
  const [affectedItems, setAffectedItems] = useState<any[]>([]);
  const [approvalTasks, setApprovalTasks] = useState<any[]>([]);
  const [auditTimeline, setAuditTimeline] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (id) loadClosureSnapshot();
  }, [id]);

  const loadClosureSnapshot = async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const { data, error } = await supabase
        .from("qms_record_snapshots")
        .select("*")
        .eq("module_code", "NCMR")
        .eq("record_id", id)
        .eq("snapshot_type", "closure")
        .maybeSingle();

      if (error) throw new Error(error.message);
      if (!data) {
        throw new Error(
          "No immutable closure snapshot is available for this closed NCMR."
        );
      }

      const payload = data.snapshot_payload || {};
      setSnapshot(data);
      setRecord(payload.record || null);
      setAffectedItems(Array.isArray(payload.affected_items) ? payload.affected_items : []);
      setApprovalTasks(Array.isArray(payload.approval_tasks) ? payload.approval_tasks : []);
      setAuditTimeline(Array.isArray(payload.audit_trail) ? payload.audit_trail : []);
    } catch (error: any) {
      setErrorMessage(error?.message || "Unable to load the NCMR closure snapshot.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <main style={pageStyle}>Loading NCMR record...</main>;
  }

  if (!record) {
    return (
      <main style={pageStyle}>
        <h1>NCMR Record</h1>
        <div style={errorStyle}>
          {errorMessage || "Unable to load NCMR record."}
        </div>
        <Link href="/ncmrs">Return to NCMR</Link>
      </main>
    );
  }


  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>QUALISPHERE NCMR RECORD</div>

          <h1 style={{ margin: "6px 0" }}>
            {record.ncmr_number || "NCMR Record"}
          </h1>

          <p style={subtleText}>
            Closed NCMR record · Immutable closure snapshot
          </p>
        </div>

        <div style={buttonRowStyle}>
          <button
            type="button"
            onClick={() => window.open(`/ncmrs/${id}/report`, "_blank")}
            style={reportButtonStyle}
          >
            NCMR Report
          </button>

          <Link href="/ncmrs" style={secondaryLinkStyle}>
            Return to NCMR
          </Link>
        </div>
      </header>

      <section style={protectionStyle}>
        <strong>Record Protection:</strong> This NCMR is closed. The information below comes from the immutable snapshot created at closure and is not re-rendered from the live NCMR workflow. Future QualiSphere workflow changes do not modify this record.
      </section>

      <section style={summaryGridStyle}>
        <SummaryValue label="NCMR Number" value={record.ncmr_number} />
        <SummaryValue label="Record Status" value={formatLabel(record.status)} />
        <SummaryValue label="Owner" value={record.owner} />
        <SummaryValue label="Created" value={formatDateTime(record.created_at)} />
        <SummaryValue
          label="Closed"
          value={formatDateTime(record.closed_at || record.closure_date)}
        />
        <SummaryValue label="Record Access" value="Read Only" />
      </section>

      <ReadOnlySection title="1. Initiation">
        <FieldGrid>
          <ReadOnlyField label="Issue Description" value={record.issue_description} wide />
          <ReadOnlyField label="Source of Detection" value={displayLabel(record.source_of_detection)} />
          <ReadOnlyField label="Department" value={displayLabel(record.department)} />
          <ReadOnlyField label="Date Detected" value={formatDate(record.date_detected)} />
          <ReadOnlyField label="Site / Location" value={record.site_location} />
          <ReadOnlyField label="Immediate Correction" value={record.immediate_correction} wide />
          <ReadOnlyField label="Supplier Name" value={record.supplier_name} />
          <ReadOnlyField label="Supplier Lot" value={record.supplier_lot} />
          <ReadOnlyField label="Purchase Order Number" value={record.purchase_order_number} />
        </FieldGrid>

        <h3>Affected Materials / Multiple Parts and Lots</h3>
        {affectedItems.length === 0 ? (
          <p style={subtleText}>No affected materials recorded.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead><tr>
                <th style={thStyle}>Part Number</th><th style={thStyle}>Part Description</th>
                <th style={thStyle}>Revision</th><th style={thStyle}>Lot Number</th>
                <th style={thStyle}>Work Order</th><th style={thStyle}>Quantity Affected</th>
                <th style={thStyle}>Quantity Quarantined</th><th style={thStyle}>Defect Category</th>
                <th style={thStyle}>Defect Subcategory</th>
              </tr></thead>
              <tbody>{affectedItems.map((item, index) => (
                <tr key={item.id || index}>
                  <td style={tdStyle}>{display(item.product_part_number)}</td>
                  <td style={tdStyle}>{display(item.part_description)}</td>
                  <td style={tdStyle}>{display(item.part_revision)}</td>
                  <td style={tdStyle}>{display(item.lot_number)}</td>
                  <td style={tdStyle}>{display(item.workorder_number)}</td>
                  <td style={tdStyle}>{display(item.quantity_affected)}</td>
                  <td style={tdStyle}>{display(item.quarantined_quantity)}</td>
                  <td style={tdStyle}>{displayLabel(item.defect_category)}</td>
                  <td style={tdStyle}>{displayLabel(item.defect_subcategory)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </ReadOnlySection>

      <ReadOnlySection title="2. Containment">
        <FieldGrid>
          <ReadOnlyField label="Containment Action" value={record.containment_action} wide />
          <ReadOnlyField label="Containment Owner" value={record.containment_owner} />
          <ReadOnlyField label="Material Status" value={displayLabel(record.material_status)} />
          <ReadOnlyField label="Quarantined Quantity" value={record.quarantined_quantity} />
          <ReadOnlyField label="Containment Completed By" value={record.containment_completed_by} />
          <ReadOnlyField label="Containment Completed At" value={formatDateTime(record.containment_completed_at)} />
        </FieldGrid>
      </ReadOnlySection>

      <ReadOnlySection title="3. Investigation / Root Cause Summary">
        <FieldGrid>
          <ReadOnlyField label="Investigator" value={record.investigator} />
          <ReadOnlyField label="Problem Description" value={record.problem_description} wide />
          <ReadOnlyField label="Investigation Summary" value={record.investigation_summary} wide />
          <ReadOnlyField label="Root Cause Category" value={displayLabel(record.root_cause_category)} />
          <ReadOnlyField label="Root Cause Summary" value={record.root_cause} wide />
        </FieldGrid>
      </ReadOnlySection>

      <ReadOnlySection title="4. Correction">
        <FieldGrid><ReadOnlyField label="Correction Proposal" value={record.correction_action_proposal} wide /></FieldGrid>
      </ReadOnlySection>

      <ReadOnlySection title="5. Corrective Action">
        <FieldGrid><ReadOnlyField label="Corrective Action Proposal / Justification" value={record.corrective_action} wide /></FieldGrid>
      </ReadOnlySection>

      <ReadOnlySection title="6. Risk Assessment">
        <FieldGrid>
          <ReadOnlyField label="Risk Determination" value={displayLabel(record.risk_determination)} />
          <ReadOnlyField label="Risk Assessment Method" value={displayLabel(record.risk_assessment_method)} />
          <ReadOnlyField label="Severity" value={displayLabel(record.severity)} />
          <ReadOnlyField label="Occurrence" value={displayLabel(record.occurrence_rating)} />
          <ReadOnlyField label="Detection" value={displayLabel(record.detection_rating)} />
          <ReadOnlyField label="Risk Level" value={displayLabel(record.risk_level)} />
          <ReadOnlyField label="Calculated Risk Overridden" value={formatBoolean(record.risk_override_enabled)} />
          <ReadOnlyField label="Override Risk Level" value={displayLabel(record.risk_override_level)} />
          <ReadOnlyField label="Risk Assessment Notes" value={record.risk_assessment} wide />
          <ReadOnlyField label="No Risk Justification" value={record.no_risk_justification} wide />
          <ReadOnlyField label="Risk Override Justification" value={record.risk_override_justification} wide />
        </FieldGrid>
      </ReadOnlySection>

      <ReadOnlySection title="7. Product Disposition">
        <FieldGrid>
          <ReadOnlyField label="Overall Product Disposition" value={displayLabel(record.product_disposition || record.disposition)} />
          <ReadOnlyField label="Overall Disposition Justification" value={record.disposition_justification} wide />
          <ReadOnlyField label="MRB Decision Date" value={formatDateTime(record.mrb_decision_date || record.mrb_approved_at || record.mrb_decision_at)} />
        </FieldGrid>
        <h3>Disposition by Affected Item</h3>
        {affectedItems.length === 0 ? <p style={subtleText}>No disposition data recorded.</p> : (
          <div style={{ overflowX: "auto" }}><table style={tableStyle}>
            <thead><tr><th style={thStyle}>Part / Lot</th><th style={thStyle}>Disposition</th><th style={thStyle}>Quantity Accepted</th><th style={thStyle}>Quantity Rejected</th><th style={thStyle}>Disposition Justification</th></tr></thead>
            <tbody>{affectedItems.map((item, index) => <tr key={item.id || index}>
              <td style={tdStyle}>{display(item.product_part_number)} / {display(item.lot_number)}</td>
              <td style={tdStyle}>{displayLabel(item.product_disposition || item.disposition)}</td>
              <td style={tdStyle}>{display(item.quantity_accepted)}</td>
              <td style={tdStyle}>{display(item.quantity_rejected)}</td>
              <td style={tdStyle}>{display(item.disposition_justification)}</td>
            </tr>)}</tbody>
          </table></div>
        )}
      </ReadOnlySection>

      <ReadOnlySection title="8. CAPA Governance">
        <FieldGrid>
          <ReadOnlyField label="CAPA Governance Decision" value={displayLabel(record.capa_decision || record.capa_evaluation_outcome)} />
          <ReadOnlyField label="CAPA Governance Rationale" value={record.capa_evaluation_rationale || record.capa_decision_justification || record.capa_justification} wide />
          <ReadOnlyField label="CAPA Recommended" value={formatBoolean(record.capa_recommended)} />
          <ReadOnlyField label="Recurring Issue" value={formatBoolean(record.recurring_issue)} />
          <ReadOnlyField label="Recurrence Reason" value={record.recurrence_reason} wide />
          <ReadOnlyField label="CAPA Not Required Justification" value={record.capa_not_required_justification} wide />
        </FieldGrid>
      </ReadOnlySection>

      <ReadOnlySection title="9. Supplier / SCAR Governance">
        <FieldGrid>
          <ReadOnlyField label="Governance Decision" value={displayLabel(record.scar_decision || record.supplier_capa_decision || record.scar_governance_decision)} />
          <ReadOnlyField label="Rationale" value={record.scar_justification || record.supplier_capa_reason || record.scar_governance_rationale} wide />
          <ReadOnlyField label="Supplier SCAR Required" value={formatBoolean(record.supplier_capa_required)} />
          <ReadOnlyField label="Linked SCAR ID" value={record.linked_scar_id} />
        </FieldGrid>
      </ReadOnlySection>

      <ReadOnlySection title="10. MRB Approval">
        <FieldGrid>
          <ReadOnlyField label="MRB Approved By" value={record.mrb_approved_by} />
          <ReadOnlyField label="MRB Approved At" value={formatDateTime(record.mrb_approved_at)} />
          <ReadOnlyField label="Signature Email Entered" value={record.mrb_signature_email_entered} />
          <ReadOnlyField label="Signature Meaning" value={record.mrb_signature_meaning} wide />
        </FieldGrid>
        <h3>MRB Approval History</h3>
        <TaskTable tasks={approvalTasks.filter((t:any)=>String(t.task_type||'').toLowerCase()==='mrb_approval')} />
      </ReadOnlySection>

      <ReadOnlySection title="11. Disposition Implementation">
        {affectedItems.filter((item:any)=> item.disposition_implementation_status || item.disposition_implementation_notes || item.disposition_implemented_by || item.quantity_discrepancy !== null && item.quantity_discrepancy !== undefined).length === 0 ? (
          <p style={subtleText}>No disposition implementation data recorded.</p>
        ) : affectedItems.map((item:any,index:number) => {
          const hasImpl = item.disposition_implementation_status || item.disposition_implementation_notes || item.disposition_implemented_by || item.quantity_discrepancy !== null && item.quantity_discrepancy !== undefined;
          if (!hasImpl) return null;
          return <div key={item.id || index} style={{border:"1px solid #e5e7eb",borderRadius:"8px",padding:"12px",marginBottom:"12px",background:"#f9fafb"}}>
            <h3 style={{marginTop:0}}>{displayLabel(item.product_disposition || item.disposition)} — {display(item.product_part_number)} / Lot {display(item.lot_number)}</h3>
            <FieldGrid>
              <ReadOnlyField label="Implementation Status" value={displayLabel(item.disposition_implementation_status)} />
              <ReadOnlyField label="MRB Quantity Accepted" value={item.quantity_accepted} />
              <ReadOnlyField label="MRB Quantity Rejected" value={item.quantity_rejected} />
              <ReadOnlyField label="Quantity Discrepancy" value={formatBoolean(item.quantity_discrepancy)} />
              <ReadOnlyField label="Discrepancy Quantity" value={item.discrepancy_quantity} />
              <ReadOnlyField label="Discrepancy Type" value={displayLabel(item.discrepancy_type)} />
              <ReadOnlyField label="Final Quantity Accepted" value={item.final_quantity_accepted ?? item.final_rework_quantity_accepted} />
              <ReadOnlyField label="Final Quantity Rejected" value={item.final_quantity_rejected ?? item.final_rework_quantity_rejected} />
              <ReadOnlyField label="Final Disposition After Rework" value={displayLabel(item.final_disposition_after_rework)} />
              <ReadOnlyField label="Implemented By" value={item.disposition_implemented_by} />
              <ReadOnlyField label="Implemented At" value={formatDateTime(item.disposition_implemented_at)} />
              <ReadOnlyField label="Disposition Implementation Notes" value={item.disposition_implementation_notes} wide />
              <ReadOnlyField label="Discrepancy Rationale" value={item.discrepancy_rationale} wide />
            </FieldGrid>
          </div>;
        })}
        <h3>Rework Execution</h3>
        <TaskTable tasks={approvalTasks.filter((t:any)=>String(t.task_type||'').toLowerCase()==='rework_task')} detailed />
      </ReadOnlySection>

      <ReadOnlySection title="12. Correction / Corrective Action Implementation">
        <TaskTable tasks={approvalTasks.filter((t:any)=>['correction_task','corrective_action_task'].includes(String(t.task_type||'').toLowerCase()))} detailed />
        {record.correction_implementation ? <><h3>Summary Correction Implementation</h3><FieldGrid>
          <ReadOnlyField label="Correction Implementation" value={record.correction_implementation} wide />
          <ReadOnlyField label="Implemented By" value={record.correction_implemented_by} />
          <ReadOnlyField label="Implemented At" value={formatDateTime(record.correction_implemented_at)} />
        </FieldGrid></> : null}
      </ReadOnlySection>

      <ReadOnlySection title="13. Evidence">
        <FieldGrid>
          <ReadOnlyField label="Evidence URL" value={record.evidence_url} wide />
          <ReadOnlyField label="Evidence Notes" value={record.evidence_notes} wide />
          <ReadOnlyField label="Linked CAPA ID" value={record.linked_capa_id || record.capa_id} />
          <ReadOnlyField label="Linked SCAR ID" value={record.linked_scar_id} />
        </FieldGrid>
      </ReadOnlySection>

      <ReadOnlySection title="MRB Approval History">
        <TaskTable tasks={approvalTasks.filter((t:any)=>String(t.task_type||'').toLowerCase()==='mrb_approval')} />
      </ReadOnlySection>

      <ReadOnlySection title="NCMR Timeline / Activity Feed">
        {auditTimeline.length === 0 ? <p style={subtleText}>No audit trail events captured.</p> : (
          <div style={{overflowX:"auto"}}><table style={tableStyle}>
            <thead><tr><th style={thStyle}>Date / Time</th><th style={thStyle}>Action</th><th style={thStyle}>User</th><th style={thStyle}>Details</th></tr></thead>
            <tbody>{auditTimeline.slice().sort((a:any,b:any)=>new Date(a.created_at||0).getTime()-new Date(b.created_at||0).getTime()).map((entry:any,index:number)=><tr key={entry.id||index}>
              <td style={tdStyle}>{formatDateTime(entry.created_at)}</td><td style={tdStyle}>{displayLabel(entry.action)}</td><td style={tdStyle}>{display(entry.user_email)}</td><td style={tdStyle}>{display(entry.details)}</td>
            </tr>)}</tbody>
          </table></div>
        )}
      </ReadOnlySection>

      <ReadOnlySection title="14. Closure">
        <FieldGrid>
          <ReadOnlyField label="Closure Status" value={displayLabel(record.status)} />
          <ReadOnlyField label="Closed By" value={record.ncmr_closed_by || record.closed_by} />
          <ReadOnlyField label="Closed At" value={formatDateTime(record.closed_at || record.closure_date)} />
          <ReadOnlyField label="Closure Comments" value={record.closure_comments || record.closure_comment || record.closure_notes} wide />
          <ReadOnlyField label="Signature Meaning" value={record.ncmr_signature_meaning} wide />
          <ReadOnlyField label="Signature Email Entered" value={record.ncmr_signature_email_entered} />
        </FieldGrid>
      </ReadOnlySection>

      <section style={footerProtectionStyle}>
        <strong>Record Integrity:</strong> No fields on this page can be edited.
        This page reads only the immutable closure snapshot and contains no NCMR workflow update, approval, migration, recalculation, CAPA/SCAR creation, task creation, reopening, or closure actions.
      </section>
    </main>
  );
}

function TaskTable({ tasks, detailed = false }: { tasks: any[]; detailed?: boolean }) {
  if (!tasks.length) return <p style={subtleText}>No task records captured in the closure snapshot.</p>;
  if (detailed) {
    return <div style={{display:"grid",gap:"12px"}}>{tasks.map((task:any,index:number)=><div key={task.id||index} style={{border:"1px solid #e5e7eb",borderRadius:"8px",padding:"12px",background:"#f9fafb"}}>
      <h3 style={{marginTop:0}}>{display(task.task_title || displayLabel(task.task_type))}</h3>
      <FieldGrid>
        <ReadOnlyField label="Task Type" value={displayLabel(task.task_type)} />
        <ReadOnlyField label="Assigned To" value={task.assigned_to_email || task.approver_email} />
        <ReadOnlyField label="Assigned By" value={task.assigned_by_email} />
        <ReadOnlyField label="Due Date" value={formatDate(task.due_date || task.approver_due_date)} />
        <ReadOnlyField label="Status" value={displayLabel(task.status)} />
        <ReadOnlyField label="Created At" value={formatDateTime(task.created_at)} />
        <ReadOnlyField label="Completed By / Signed By" value={task.completed_by_email || task.completed_by || task.approved_by} />
        <ReadOnlyField label="Completed At / Signed At" value={formatDateTime(task.completed_at || task.approved_at)} />
        <ReadOnlyField label="Signature Meaning" value={task.signature_meaning || task.e_signature_meaning || task.completion_signature_meaning} wide />
        <ReadOnlyField label="Implementation Instructions" value={task.task_instructions || task.comments} wide />
        <ReadOnlyField label="Task Owner Completion Comment" value={task.completion_comment || task.completion_notes || task.completed_comment} wide />
        <ReadOnlyField label="Verification Status" value={displayLabel(task.implementation_verification_status)} />
        <ReadOnlyField label="Verification Comment" value={task.implementation_verification_comment} wide />
        <ReadOnlyField label="Verified By" value={task.implementation_verified_by} />
        <ReadOnlyField label="Verified At" value={formatDateTime(task.implementation_verified_at)} />
      </FieldGrid>
    </div>)}</div>;
  }
  return <div style={{overflowX:"auto"}}><table style={tableStyle}><thead><tr>
    <th style={thStyle}>Task</th><th style={thStyle}>Assigned To</th><th style={thStyle}>Status</th><th style={thStyle}>Due Date</th><th style={thStyle}>Completed / Approved By</th><th style={thStyle}>Completed At</th><th style={thStyle}>Comments</th>
  </tr></thead><tbody>{tasks.map((task:any,index:number)=><tr key={task.id||index}>
    <td style={tdStyle}>{display(task.task_title || displayLabel(task.task_type))}</td>
    <td style={tdStyle}>{display(task.assigned_to_email || task.approver_email)}</td>
    <td style={tdStyle}>{displayLabel(task.status)}</td>
    <td style={tdStyle}>{formatDate(task.due_date || task.approver_due_date)}</td>
    <td style={tdStyle}>{display(task.completed_by_email || task.completed_by || task.approved_by)}</td>
    <td style={tdStyle}>{formatDateTime(task.completed_at || task.approved_at)}</td>
    <td style={tdStyle}>{display(task.approval_comments || task.completion_comment || task.comments)}</td>
  </tr>)}</tbody></table></div>;
}

function ReadOnlySection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={sectionStyle}>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      {children}
    </section>
  );
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div style={fieldGridStyle}>{children}</div>;
}

function ReadOnlyField({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: any;
  wide?: boolean;
}) {
  return (
    <div
      style={
        wide
          ? { ...fieldBoxStyle, gridColumn: "1 / -1" }
          : fieldBoxStyle
      }
    >
      <div style={fieldLabelStyle}>{label}</div>
      <div style={fieldValueStyle}>{display(value)}</div>
    </div>
  );
}

function SummaryValue({
  label,
  value,
}: {
  label: string;
  value: any;
}) {
  return (
    <div style={summaryCardStyle}>
      <div style={fieldLabelStyle}>{label}</div>
      <div style={summaryValueStyle}>{display(value)}</div>
    </div>
  );
}

function display(value: any) {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  ) {
    return "Not recorded";
  }

  return String(value);
}

function displayLabel(value: any) {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  ) {
    return "Not recorded";
  }

  return formatLabel(value);
}

function formatLabel(value: any) {
  return String(value || "")
    .trim()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatBoolean(value: any) {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "Not recorded";
}


function formatDate(value: any) {
  if (!value) return "Not recorded";

  const raw = String(value).trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (match) {
    const [, year, month, day] = match;
    const monthLabel = new Date(
      Number(year),
      Number(month) - 1,
      Number(day)
    ).toLocaleString("en-US", { month: "short" });

    return `${day}-${monthLabel}-${year}`;
  }

  return formatDateTime(value);
}

function formatDateTime(value: any) {
  if (!value) return "Not recorded";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString();
}

const pageStyle: React.CSSProperties = {
  padding: "24px",
  fontFamily: "Arial, sans-serif",
  background: "#f8fafc",
  minHeight: "100vh",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
  flexWrap: "wrap",
  marginBottom: "18px",
};

const eyebrowStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 800,
  letterSpacing: "0.08em",
  color: "#6b7280",
};

const subtleText: React.CSSProperties = {
  color: "#4b5563",
};

const buttonRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
};

const primaryLinkStyle: React.CSSProperties = {
  display: "inline-block",
  textDecoration: "none",
  background: "#2563eb",
  color: "white",
  padding: "10px 14px",
  borderRadius: "8px",
  fontWeight: 700,
};

const secondaryLinkStyle: React.CSSProperties = {
  ...primaryLinkStyle,
  background: "#111827",
};

const reportButtonStyle: React.CSSProperties = {
  border: "none",
  background: "#2563eb",
  color: "white",
  padding: "10px 14px",
  borderRadius: "8px",
  fontWeight: 700,
  cursor: "pointer",
};

const protectionStyle: React.CSSProperties = {
  background: "#ecfdf5",
  border: "1px solid #a7f3d0",
  borderRadius: "10px",
  padding: "14px",
  marginBottom: "16px",
};

const warningStyle: React.CSSProperties = {
  background: "#fffbeb",
  border: "1px solid #fde68a",
  borderRadius: "10px",
  padding: "14px",
  marginBottom: "16px",
};

const errorStyle: React.CSSProperties = {
  background: "#fef2f2",
  border: "1px solid #fecaca",
  borderRadius: "10px",
  padding: "14px",
  marginBottom: "16px",
};

const summaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: "12px",
  marginBottom: "16px",
};

const summaryCardStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid #d1d5db",
  borderRadius: "10px",
  padding: "14px",
};

const summaryValueStyle: React.CSSProperties = {
  fontWeight: 800,
  marginTop: "5px",
  overflowWrap: "anywhere",
};

const sectionStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid #d1d5db",
  borderRadius: "12px",
  padding: "18px",
  marginBottom: "16px",
};

const fieldGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: "12px",
};

const fieldBoxStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: "8px",
  padding: "12px",
  background: "#f9fafb",
};

const fieldLabelStyle: React.CSSProperties = {
  color: "#6b7280",
  fontSize: "12px",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const fieldValueStyle: React.CSSProperties = {
  marginTop: "6px",
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "10px",
  borderBottom: "1px solid #cbd5e1",
  background: "#f8fafc",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "10px",
  borderBottom: "1px solid #e5e7eb",
  verticalAlign: "top",
};

const footerProtectionStyle: React.CSSProperties = {
  ...protectionStyle,
  marginTop: "18px",
};
