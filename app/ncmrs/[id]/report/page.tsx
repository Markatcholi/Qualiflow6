"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";

export default function NcmrFullRecordReportPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [record, setRecord] = useState<any>(null);
  const [linkedCapa, setLinkedCapa] = useState<any>(null);
  const [linkedScar, setLinkedScar] = useState<any>(null);
  const [affectedItems, setAffectedItems] = useState<any[]>([]);
  const [correctionTasks, setCorrectionTasks] = useState<any[]>([]);
  const [reworkTasks, setReworkTasks] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [includeAuditTrail, setIncludeAuditTrail] = useState(false);
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

      const linkedCapaId = ncmr?.linked_capa_id || ncmr?.capa_id;
      if (linkedCapaId) {
        const capaRes = await supabase
          .from("capas")
          .select("*")
          .eq("id", linkedCapaId)
          .maybeSingle();

        if (!capaRes.error) setLinkedCapa(capaRes.data || null);
      }

      if (ncmr?.linked_scar_id) {
        const scarRes = await supabase
          .from("scars")
          .select("*")
          .eq("id", ncmr.linked_scar_id)
          .maybeSingle();

        if (!scarRes.error) setLinkedScar(scarRes.data || null);
      }


      const affectedItemsRes = await supabase
        .from("ncmr_affected_items")
        .select("*")
        .eq("ncmr_id", id)
        .order("created_at", { ascending: true });

      if (!affectedItemsRes.error) setAffectedItems(affectedItemsRes.data || []);

      const tasksRes = await supabase
        .from("approval_tasks")
        .select("*")
        .eq("entity_type", "ncmr")
        .eq("entity_id", id)
        .order("created_at", { ascending: true });

      if (!tasksRes.error) {
        const tasks = tasksRes.data || [];
        setCorrectionTasks(tasks.filter((task) => ["correction_task", "corrective_action_task"].includes(task.task_type)));
        setReworkTasks(tasks.filter((task) => task.task_type === "rework_task"));
      }

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

  const effectiveRiskLevel =
    record.risk_assessment_method === "automatic" && record.risk_override_enabled
      ? record.risk_override_level || record.risk_level
      : record.risk_level;

  const evaluateScarGovernanceForReport = () => {
    const supplierPartRecorded =
      !!record?.product_part_number ||
      affectedItems.some((item: any) => !!item.product_part_number);

    const supplierRecurrence =
      record?.recurring_issue === true ||
      record?.supplier_capa_required === true ||
      record?.supplier_scar_required === true ||
      String(record?.recurrence_reason || "").toLowerCase().includes("recurr") ||
      String(record?.supplier_capa_reason || "").toLowerCase().includes("recurr") ||
      String(record?.supplier_scar_reason || "").toLowerCase().includes("recurr") ||
      String(record?.scar_reason || "").toLowerCase().includes("recurr");

    const triggers = [
      `${supplierPartRecorded ? "✓" : "✗"} Supplier Part Recorded`,
      `${supplierRecurrence ? "✓" : "✗"} Supplier Recurrence Detected`,
    ];

    if (supplierPartRecorded && supplierRecurrence) {
      return {
        label: "SCAR Recommended",
        rationale:
          "SCAR is recommended because supplier part has been recorded and supplier recurrence has been detected.",
        triggers,
      };
    }

    return {
      label: "SCAR Not Required",
      rationale:
        "SCAR is not automatically required because both supplier governance criteria have not been met. Supplier Part Recorded and Supplier Recurrence Detected are required for an automatic SCAR recommendation.",
      triggers,
    };
  };

  const scarGovernance = evaluateScarGovernanceForReport();

  return (
    <main style={pageStyle}>
      <div className="no-print" style={{ marginBottom: "18px" }}>
        <button onClick={() => window.print()} style={{ padding: "8px 12px", marginRight: "10px" }}>
          Print / Save as PDF
        </button>
        <label style={{ marginRight: "14px" }}>
          <input type="checkbox" checked={includeAuditTrail} onChange={(e) => setIncludeAuditTrail(e.target.checked)} style={{ marginRight: "6px" }} />
          Include Audit Trail
        </label>
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
          <div><strong>Generated:</strong> {formatDateTime(new Date())}</div>
          <div><strong>QMS Record Type:</strong> Nonconforming Material Report</div>
          <div><strong>Print Use:</strong> Controlled record review</div>
        </div>
      </header>

      <ReportSection title="Record Summary">
        <div style={gridStyle}>
          <Field label="NCMR Number" value={record.ncmr_number} />
          <Field label="Title" value={record.title} />
          <Field label="Status" value={record.status} />
          <Field label="Created At" value={formatDateTime(record.created_at)} />
          <Field label="Closed At" value={formatDateTime(record.closed_at)} />
          <Field label="Owner" value={record.owner || record.owner_email} />
          <Field label="Investigator" value={record.investigator} />
          <Field label="Severity" value={formatLabel(record.severity)} />
          <Field label="Effective Risk Level" value={formatLabel(effectiveRiskLevel)} />
        </div>
      </ReportSection>

      <ReportSection title="1. Initiation Information">
        <div style={verticalGridStyle}>
          <Field label="Issue Description" value={record.issue_description} />
          <Field label="Source of Detection" value={record.source_of_detection} />
          <Field label="Department" value={record.department} />
          <Field label="Date Detected" value={formatDate(record.date_detected)} />
          <Field label="Site / Location" value={record.site_location} />
          <Field label="Immediate Correction" value={record.immediate_correction} />
          <Field label="NCMR Owner" value={record.owner || record.owner_email} />
        </div>

        <h3>Affected Materials / Multiple Parts and Lots</h3>
        {affectedItems.length === 0 ? <p>No affected materials recorded.</p> : (
          <div style={{ display: "grid", gap: "10px" }}>
            {affectedItems.map((item, index) => (
              <div key={item.id || index} style={itemCardStyle}>
                <h4 style={{ marginTop: 0 }}>Affected Material {index + 1}</h4>
                <div style={gridStyle}>
                  <Field label="Part Number" value={item.product_part_number} />
                  <Field label="Part Description" value={item.part_description} />
                  <Field label="Part Revision" value={item.part_revision} />
                  <Field label="Lot Number" value={item.lot_number} />
                  <Field label="Work Order" value={item.workorder_number} />
                  <Field label="Quantity Affected" value={item.quantity_affected} />
                  <Field label="Quantity Quarantined" value={item.quarantined_quantity} />
                  <Field label="Defect Category" value={formatLabel(item.defect_category)} />
                  <Field label="Defect Subcategory" value={formatLabel(item.defect_subcategory)} />
                </div>
              </div>
            ))}
          </div>
        )}

        <h3>Supplier Information (If Applicable)</h3>
        <div style={gridStyle}>
          <Field label="Supplier Name" value={record.supplier_name} />
          <Field label="Supplier Lot" value={record.supplier_lot} />
          <Field label="Purchase Order Number" value={record.purchase_order_number} />
        </div>

        <AttachmentList title="Initiation Supporting Attachments" attachments={record.initiation_attachments} />
      </ReportSection>

      <ReportSection title="2. Containment">
        <div style={verticalGridStyle}>
          <Field label="Containment Action" value={record.containment_action} />
          <Field label="Containment Owner" value={record.containment_owner} />
          <Field label="Material Status" value={formatLabel(record.material_status)} />
          <Field label="Quarantined Quantity" value={record.quarantined_quantity} />
          <Field label="Containment Completed By" value={record.containment_completed_by} />
          <Field label="Containment Completed At" value={formatDateTime(record.containment_completed_at)} />
        </div>
      </ReportSection>

      <ReportSection title="3. Investigation / Root Cause Summary">
        <div style={verticalGridStyle}>
          <Field label="Investigator" value={record.investigator} />
          <Field label="Problem Description" value={record.problem_description} />
          <Field label="Investigation Summary" value={record.investigation_summary} />
          <Field label="Root Cause Category" value={formatLabel(record.root_cause_category)} />
          <Field label="Root Cause Summary" value={record.root_cause} />
        </div>
        <AttachmentList title="Investigation / Root Cause Summary Attachments" attachments={record.investigation_attachments} />
      </ReportSection>

      <ReportSection title="4. Correction">
        <Field label="Correction Proposal" value={formatLabel(record.correction_action_proposal)} />
      </ReportSection>

      <ReportSection title="5. Corrective Action">
        <Field label="Corrective Action Proposal / Justification" value={record.corrective_action} />
      </ReportSection>

      <ReportSection title="6. Risk Assessment">
        <div style={gridStyle}>
          <Field label="Risk Assessment Method" value={formatLabel(record.risk_assessment_method || "automatic")} />
          <Field label="Severity" value={formatLabel(record.severity)} />
          <Field label="Occurrence" value={formatLabel(record.occurrence_rating)} />
          <Field label="Detection" value={formatLabel(record.detection_rating)} />
          <Field label="Calculated / Manual Risk Level" value={formatLabel(record.risk_level)} />
          <Field label="Effective Risk Level" value={formatLabel(effectiveRiskLevel)} />
          <Field label="Calculated Risk Overridden" value={record.risk_override_enabled ? "Yes" : "No"} />
          {record.risk_override_enabled ? <Field label="Override Risk Level" value={formatLabel(record.risk_override_level)} /> : null}
        </div>
        {record.risk_override_enabled ? <Field label="Risk Override Justification" value={record.risk_override_justification} /> : null}
        <Field label="Risk Assessment Notes" value={record.risk_assessment} />
      </ReportSection>

      <ReportSection title="7. Product Disposition / MRB Decision">
        <div style={verticalGridStyle}>
          <Field label="Overall Product Disposition" value={formatLabel(record.product_disposition || record.disposition)} />
          <Field label="Overall Disposition Justification" value={record.disposition_justification} />
          <Field label="MRB Decision Date" value={formatDateTime(record.mrb_decision_date || record.mrb_approved_at)} />
        </div>
        <h3>Disposition by Affected Item</h3>
        {affectedItems.length === 0 ? <p>No item-level disposition records found.</p> : affectedItems.map((item, index) => (
          <div key={item.id || index} style={itemCardStyle}>
            <h4 style={{ marginTop: 0 }}>Disposition Item {index + 1} — {displayValue(item.product_part_number)} / Lot {displayValue(item.lot_number)}</h4>
            <div style={gridStyle}>
              <Field label="Disposition" value={formatLabel(item.product_disposition)} />
              <Field label="Quantity Accepted" value={item.quantity_accepted} />
              <Field label="Quantity Rejected" value={item.quantity_rejected} />
              <Field label="Disposition Justification" value={item.disposition_justification} />
            </div>
          </div>
        ))}
      </ReportSection>

      <ReportSection title="8. CAPA Governance">
        <div style={verticalGridStyle}>
          <Field label="CAPA Governance Decision" value={formatLabel(record.capa_evaluation_outcome || record.capa_decision)} />
          <Field label="CAPA Governance Rationale" value={record.capa_evaluation_rationale} />
          <Field label="CAPA Recommended" value={record.capa_recommended ? "Yes" : "No"} />
          <Field label="Recurring Issue" value={record.recurring_issue ? "Yes" : "No"} />
        </div>
      </ReportSection>

      <ReportSection title="9. Supplier / SCAR Governance">
        <div style={verticalGridStyle}>
          <Field label="Governance Decision" value={scarGovernance.label} />
          <Field label="Rationale" value={scarGovernance.rationale} />
          <div style={itemCardStyle}>
            <strong>SCAR Governance Signal</strong>
            <ul style={{ marginBottom: 0 }}>
              {scarGovernance.triggers.map((trigger: string, index: number) => (
                <li key={index}>{trigger}</li>
              ))}
            </ul>
          </div>
          {record.scar_justification ? (
            <Field label="Risk-Based Justification if SCAR is Not Opened" value={record.scar_justification} />
          ) : null}
        </div>
      </ReportSection>

      <ReportSection title="10. MRB Approval">
        <div style={signatureStyle}>
          <h3 style={{ marginTop: 0 }}>MRB Electronic Signature</h3>
          <Field label="MRB Approved By" value={record.mrb_approved_by} />
          <Field label="MRB Approved At" value={formatDateTime(record.mrb_approved_at)} />
          <Field label="Signature Email Entered" value={record.mrb_signature_email_entered} />
          <Field label="Signature Meaning" value={record.mrb_signature_meaning} />
          <Field label="Authentication Method" value="Active authenticated session with email confirmation" />
        </div>
      </ReportSection>

      <ReportSection title="11. Disposition Implementation">
        {affectedItems.length === 0 ? <p>No affected-item implementation records found.</p> : affectedItems.map((item, index) => (
          <div key={item.id || index} style={itemCardStyle}>
            <h4 style={{ marginTop: 0 }}>{formatLabel(item.product_disposition)} — {displayValue(item.product_part_number)} / Lot {displayValue(item.lot_number)}</h4>
            <div style={gridStyle}>
              <Field label="Implementation Status" value={formatLabel(item.disposition_implementation_status)} />
              <Field label="MRB Quantity Accepted" value={item.quantity_accepted} />
              <Field label="MRB Quantity Rejected" value={item.quantity_rejected} />
              {["use_as_is", "accept_per_specification"].includes(normalize(item.product_disposition)) ? (
                <>
                  <Field label="Quantity Discrepancy" value={item.quantity_discrepancy ? "Yes" : "No"} />
                  {item.quantity_discrepancy ? (
                    <>
                      <Field label="Discrepancy Quantity" value={item.discrepancy_quantity} />
                      <Field label="Discrepancy Type" value={formatLabel(item.discrepancy_type)} />
                    </>
                  ) : null}
                </>
              ) : null}
              <Field label="Final Quantity Accepted" value={item.final_quantity_accepted} />
              <Field label="Final Quantity Rejected" value={item.final_quantity_rejected} />
              <Field label="Implemented By" value={item.disposition_implemented_by} />
              <Field label="Implemented At" value={formatDateTime(item.disposition_implemented_at)} />
            </div>
            <Field label="Disposition Implementation Notes" value={item.disposition_implementation_notes} />
            {["use_as_is", "accept_per_specification"].includes(normalize(item.product_disposition)) && item.quantity_discrepancy ? (
              <Field label="Discrepancy Rationale" value={item.discrepancy_rationale} />
            ) : null}
          </div>
        ))}
      </ReportSection>

      <ReportSection title="Rework Execution">
        {reworkTasks.length === 0 ? <p>No Rework tasks recorded.</p> : reworkTasks.map((task, index) => (
          <div key={task.id || index} style={taskCardStyle(task.status)}>
            <h3 style={{ marginTop: 0 }}>Rework Task {index + 1}</h3>
            <TaskRecord task={task} />
            <AttachmentList title="Assignment Attachment(s)" attachments={task.assignment_attachments} />
            <AttachmentList title="Completion Evidence / Attachment(s)" attachments={task.task_attachments} />
            {task.returned_reason || task.returned_by || task.returned_at ? <div style={returnHistoryStyle}>
              <strong>Return History</strong>
              <Field label="Returned By" value={task.returned_by} />
              <Field label="Returned At" value={formatDateTime(task.returned_at)} />
              <Field label="Return Reason" value={task.returned_reason} />
            </div> : null}
            <div style={signatureStyle}>
              <h4 style={{ marginTop: 0 }}>Rework Owner Completion / Electronic Signature</h4>
              <Field label="Completed By / Signed By" value={task.completed_by || task.signed_by} />
              <Field label="Completed At / Signed At" value={formatDateTime(task.completed_at || task.signed_at)} />
      <Field label="Signature Meaning" value={task.signature_meaning} />
              <Field label="Completion Comment" value={task.completion_comment || task.approver_comment} />
            </div>
            <h4>Final Rework Outcome</h4>
            {affectedItems.filter((item) => normalize(item.product_disposition) === "rework").map((item, itemIndex) => (
              <div key={item.id || itemIndex} style={itemCardStyle}>
                <Field label="Part / Lot" value={`${displayValue(item.product_part_number)} / ${displayValue(item.lot_number)}`} />
                <Field label="Final Disposition After Rework" value={formatLabel(item.final_disposition_after_rework)} />
                <Field label="Final Rework Quantity Accepted" value={item.final_rework_quantity_accepted} />
                <Field label="Final Rework Quantity Rejected" value={item.final_rework_quantity_rejected} />
                <Field label="Quantity Reconciliation" value={reworkReconciliation(item)} />
              </div>
            ))}
            <div style={signatureStyle}>
              <h4 style={{ marginTop: 0 }}>NCMR Owner Rework Verification</h4>
              <Field label="Verification Status" value={formatLabel(task.implementation_verification_status)} />
              <Field label="Verification Comment" value={task.implementation_verification_comment} />
              <Field label="Verified By" value={task.implementation_verified_by} />
              <Field label="Verified At" value={formatDateTime(task.implementation_verified_at)} />
            </div>
          </div>
        ))}
        <h3>Rework Lifecycle History</h3>
        {auditLogs.filter((log) => String(log?.action || "").toLowerCase().includes("rework")).length === 0 ? (
          <p>No Rework lifecycle audit events recorded.</p>
        ) : auditLogs.filter((log) => String(log?.action || "").toLowerCase().includes("rework")).map((log) => (
          <div key={log.id} style={itemCardStyle}>
            <Field label="Date / Time" value={formatDateTime(log.created_at)} />
            <Field label="User" value={log.user_email} />
            <Field label="Action" value={formatLabel(log.action)} />
            <Field label="Details" value={log.details} />
          </div>
        ))}
      </ReportSection>

      <ReportSection title="12. Correction / Corrective Action Implementation">
        {correctionTasks.length === 0 ? <p>No Correction or Corrective Action implementation tasks recorded.</p> : correctionTasks.map((task, index) => (
          <div key={task.id || index} style={taskCardStyle(task.status)}>
            <h3 style={{ marginTop: 0 }}>{task.task_type === "corrective_action_task" ? "Corrective Action" : "Correction"} Implementation Task {index + 1}</h3>
            <TaskRecord task={task} />
            <AttachmentList title="Completion Evidence / Attachment(s)" attachments={task.task_attachments} />
            <div style={signatureStyle}>
              <h4 style={{ marginTop: 0 }}>NCMR Owner Implementation Verification</h4>
              <Field label="Verification Status" value={formatLabel(task.implementation_verification_status)} />
              <Field label="Verification Comment" value={task.implementation_verification_comment} />
              <Field label="Verified By" value={task.implementation_verified_by} />
              <Field label="Verified At" value={formatDateTime(task.implementation_verified_at)} />
            </div>
          </div>
        ))}
        <Field label="Legacy / Summary Correction Implementation" value={record.correction_implementation} />
        <Field label="Implemented By" value={record.correction_implemented_by} />
        <Field label="Implemented At" value={formatDateTime(record.correction_implemented_at)} />
      </ReportSection>

      <ReportSection title="13. Evidence / Attachments">
        <Field label="Evidence URL" value={record.evidence_url} />
        <Field label="Evidence Notes" value={record.evidence_notes} />
      </ReportSection>

      <ReportSection title="Linked Records">
        <div style={gridStyle}>
          <Field label="Linked CAPA ID" value={record.linked_capa_id || record.capa_id} />
          <Field label="Linked CAPA Number" value={linkedCapa?.capa_number} />
          <Field label="Linked CAPA Title" value={linkedCapa?.title} />
          <Field label="Linked CAPA Status" value={linkedCapa?.status} />
          <Field label="Linked SCAR ID" value={record.linked_scar_id} />
          <Field label="Linked SCAR Number" value={linkedScar?.scar_number} />
          <Field label="Linked SCAR Title" value={linkedScar?.scar_title || linkedScar?.title} />
          <Field label="Linked SCAR Status" value={linkedScar?.scar_status || linkedScar?.status} />
        </div>
      </ReportSection>

      <ReportSection title="14. Closure / Electronic Signature">
        <div style={signatureStyle}>
          <Field label="Closure Status" value={record.status} />
          <Field label="Closed By" value={record.ncmr_closed_by} />
          <Field label="Closed At" value={formatDateTime(record.closed_at)} />
          <Field label="Closure Comments" value={record.closure_comments} />
          <Field label="Signature Meaning" value={record.ncmr_signature_meaning} />
          <Field label="Authentication Method" value="Active authenticated session confirmation" />
        </div>
      </ReportSection>

      {includeAuditTrail ? (
        <ReportSection title="Audit Trail Summary">
          {auditLogs.length === 0 ? <p>No audit log entries found for this NCMR.</p> : auditLogs.map((log) => (
            <div key={log.id} style={{ borderTop: "1px solid #ddd", paddingTop: "8px", marginTop: "8px" }}>
              <Field label="Date / Time" value={formatDateTime(log.created_at)} />
              <Field label="User" value={log.user_email} />
              <Field label="Action" value={formatLabel(log.action)} />
              <Field label="Details" value={log.details} />
            </div>
          ))}
        </ReportSection>
      ) : null}

      <footer className="print-footer">
        NCMR Controlled Record | {record.ncmr_number || record.id} | Generated {formatDateTime(new Date())}
      </footer>

      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }

          /* The Home / user identity / Logout row comes from the shared application
             layout, not this report component. Hide that application header only
             in the printed controlled record while preserving the report itself. */
          body > header,
          body > nav,
          body > div > header:first-child,
          body > div > nav:first-child {
            display: none !important;
          }

          body { color: black; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          main { padding: 18px !important; }
          section { break-inside: auto; page-break-inside: auto; }
          .report-card, .task-card, .signature-card { break-inside: avoid; page-break-inside: avoid; }
          .print-footer { position: fixed; bottom: 0; left: 0; right: 0; font-size: 10px; border-top: 1px solid #999; padding: 6px 20px; background: white; }
        }
        @page { margin: 0.65in 0.65in 0.8in; }
      `}</style>
    </main>
  );
}

function ReportSection({ title, children }: { title: string; children: any }) {
  return <section style={sectionStyle}><h2>{title}</h2>{children}</section>;
}

function Field({ label, value }: { label: string; value: any }) {
  return <div style={{ marginBottom: "8px", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}><strong>{label}:</strong> {displayValue(value)}</div>;
}

function AttachmentList({ title, attachments }: { title: string; attachments: any }) {
  const list = Array.isArray(attachments) ? attachments : [];
  return <div style={{ marginTop: "12px" }}><h3>{title}</h3>{list.length === 0 ? <p>None recorded.</p> : list.map((attachment: any, index: number) => (
    <div key={`${attachment?.storage_path || attachment?.url || index}`} style={itemCardStyle}>
      <Field label="File" value={attachment?.name || `Attachment ${index + 1}`} />
      <Field label="Uploaded By" value={attachment?.uploaded_by} />
      <Field label="Uploaded At" value={formatDateTime(attachment?.uploaded_at)} />
      {attachment?.url ? <div><strong>Link:</strong> <a href={attachment.url} target="_blank" rel="noreferrer">Open attachment</a></div> : null}
    </div>
  ))}</div>;
}

function TaskRecord({ task, approvalMode = false }: { task: any; approvalMode?: boolean }) {
  return <div className="task-card" style={{ marginBottom: "10px" }}>
    <div style={gridStyle}>
      <Field label={approvalMode ? "Function" : "Task Type"} value={approvalMode ? task.required_function : (task.task_type === "corrective_action_task" ? "Corrective Action" : task.task_type === "correction_task" ? "Correction" : task.required_function || task.task_type)} />
      <Field label="Task Title" value={task.task_title} />
      <Field label="Assigned To" value={task.assigned_to_email} />
      <Field label="Assigned By" value={task.assigned_by_email} />
      <Field label="Due Date" value={formatDate(task.due_date)} />
      <Field label="Status" value={formatLabel(task.status)} />
      <Field label="Created At" value={formatDateTime(task.created_at)} />
      <Field label="Completed By / Signed By" value={task.completed_by || task.signed_by} />
      <Field label="Completed At / Signed At" value={formatDateTime(task.completed_at || task.signed_at)} />
      <Field label="Signature Meaning" value={task.signature_meaning} />
    </div>
    <Field label={approvalMode ? "Approver Comment" : "Implementation Instructions"} value={approvalMode ? task.approver_comment : (task.task_instructions || task.comments)} />
    {!approvalMode ? <Field label="Task Owner Completion Comment" value={task.completion_comment || task.approver_comment} /> : null}
  </div>;
}

function displayValue(input: any) { return input === null || input === undefined || input === "" ? "N/A" : String(input); }
function normalize(value: any) { return String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_"); }
function formatLabel(value: any) { const raw=String(value || "").trim(); if(!raw) return "N/A"; return raw.replace(/_/g," ").replace(/\b\w/g,(m)=>m.toUpperCase()); }
function formatDate(value: any) {
  if (!value) return "N/A";
  const raw=String(value).trim();
  const match=raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(match){ const months=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]; return `${match[3]}-${months[Number(match[2])-1]}-${match[1]}`; }
  const d=new Date(value); if(Number.isNaN(d.getTime())) return raw;
  const months=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${String(d.getDate()).padStart(2,"0")}-${months[d.getMonth()]}-${d.getFullYear()}`;
}
function formatDateTime(value: any) {
  if(!value) return "N/A"; const d=value instanceof Date ? value : new Date(value); if(Number.isNaN(d.getTime())) return String(value);
  return `${formatDate(d)} ${d.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"})}`;
}
function reworkReconciliation(item: any) {
  const affected=Number(item?.quantity_affected || 0); const accepted=Number(item?.final_rework_quantity_accepted || 0); const rejected=Number(item?.final_rework_quantity_rejected || 0);
  return `${accepted} Accepted + ${rejected} Rejected = ${accepted+rejected} / Affected ${affected} — ${accepted+rejected===affected ? "Reconciled" : "Not Reconciled"}`;
}

function taskCardStyle(status: string): React.CSSProperties {
  const s=normalize(status); return { border: s==="approved"||s==="completed" ? "1px solid #86efac" : s==="rejected"||s==="returned" ? "1px solid #fca5a5" : "1px solid #facc15", background: s==="approved"||s==="completed" ? "#f0fdf4" : s==="rejected"||s==="returned" ? "#fef2f2" : "#fefce8", borderRadius:"8px", padding:"10px", marginBottom:"10px" };
}
const returnHistoryStyle: React.CSSProperties = { border:"1px solid #facc15", background:"#fffdf2", borderRadius:"8px", padding:"10px", marginTop:"10px" };

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

const verticalGridStyle: React.CSSProperties = {
  display: "grid",
  gap: "8px",
};

const itemCardStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: "8px",
  padding: "12px",
  background: "#f8fafc",
};

const signatureStyle: React.CSSProperties = {
  border: "1px solid #94a3b8",
  borderRadius: "8px",
  padding: "12px",
  marginTop: "10px",
  background: "#f8fafc",
};
