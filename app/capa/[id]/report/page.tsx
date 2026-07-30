"use client";

// QualiSphere Enterprise CAPA Report v1.0 — Design Frozen

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";
export default function EnterpriseCapaReportPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [record, setRecord] = useState<CapaRecord | null>(null);
  const [tasks, setTasks] = useState<CapaTask[]>([]);
  const [linkedNcmr, setLinkedNcmr] = useState<Record<string, unknown> | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const generatedAt = useMemo(() => new Date(), []);

  useEffect(() => {
    let active = true;

    const fetchReport = async () => {
      if (!id) {
        if (active) {
          setErrorMessage("CAPA record identifier is missing.");
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setErrorMessage("");

      const capaRes = await supabase
        .from("capas")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (!active) return;

      if (capaRes.error) {
        setErrorMessage(capaRes.error.message);
        setLoading(false);
        return;
      }

      if (!capaRes.data) {
        setRecord(null);
        setLoading(false);
        return;
      }

      const capa = capaRes.data as CapaRecord;
      setRecord(capa);

      const taskRes = await supabase
        .from("capa_tasks")
        .select("*")
        .eq("capa_id", id)
        .order("created_at", { ascending: true });

      if (!active) return;

      if (taskRes.error) {
        setErrorMessage(
          `CAPA loaded, but execution tasks could not be loaded: ${taskRes.error.message}`,
        );
      } else {
        setTasks((taskRes.data || []) as CapaTask[]);
      }

      if (capa.ncmr_id) {
        const ncmrRes = await supabase
          .from("ncmrs")
          .select("*")
          .eq("id", capa.ncmr_id)
          .maybeSingle();

        if (!active) return;

        if (!ncmrRes.error) {
          setLinkedNcmr(
            (ncmrRes.data as Record<string, unknown> | null) || null,
          );
        }
      }

      setLoading(false);
    };

    void fetchReport();

    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <main style={{ padding: "24px", fontFamily: "Arial, sans-serif" }}>
        Loading enterprise CAPA report...
      </main>
    );
  }

  if (!record) {
    return (
      <main style={{ padding: "24px", fontFamily: "Arial, sans-serif" }}>
        <h1 style={{ marginTop: 0 }}>CAPA report unavailable</h1>
        <p>{errorMessage || "CAPA record not found."}</p>
        <a href="/capa">Return to CAPA</a>
      </main>
    );
  }

  return (
    <CapaEnterpriseReport
      record={record}
      tasks={tasks}
      linkedNcmr={linkedNcmr}
      generatedAt={generatedAt}
      warningMessage={errorMessage}
      onPrint={() => window.print()}
      backHref={`/capa/${id}`}
    />
  );
}

type CapaRecord = Record<string, any> & {
  id?: string;
  capa_number?: string;
  status?: string;
  ncmr_id?: string;
};

type CapaTask = Record<string, any> & {
  id?: string;
  task_title?: string;
  task_description?: string;
  owner?: string;
  due_date?: string;
  status?: string;
  completion_evidence?: string;
  completed_by?: string;
  completed_at?: string;
};

type Props = {
  record: CapaRecord;
  tasks: CapaTask[];
  linkedNcmr: Record<string, unknown> | null;
  generatedAt: Date;
  warningMessage?: string;
  onPrint: () => void;
  backHref: string;
};


function CapaEnterpriseReport({
  record,
  tasks,
  linkedNcmr,
  generatedAt,
  warningMessage,
  onPrint,
  backHref,
}: Props) {
  const capaNumber = firstValue(record.capa_number, record.id, "CAPA");
  const status = firstValue(record.status, "Unknown");
  const capaType = firstValue(
    record.capa_type,
    record.capa_classification,
    record.classification,
  );
  const owner = firstValue(
    record.owner,
    record.capa_owner,
    record.initiated_by,
  );
  const initiatedAt = firstValue(
    record.initiated_at,
    record.created_at,
    record.initiation_date,
  );


  const linkedNcmrNumber = firstValue(
    linkedNcmr?.ncmr_number,
    linkedNcmr?.record_number,
    linkedNcmr?.title,
    record.ncmr_id,
  );

  return (
    <main style={styles.page}>
      <div className="no-print" style={styles.toolbar}>
        <button type="button" onClick={onPrint} style={styles.primaryButton}>
          Print / Save PDF
        </button>
        <a href={backHref} style={styles.backLink}>
          Back to Workflow
        </a>
        <span style={styles.printInstruction}>
          Use Chrome 131 or newer. In the print dialog, turn off the browser’s
          built-in “Headers and footers”; the controlled header, ISO date stamp,
          and Page X of Y are generated by the report itself.
        </span>
      </div>

      {warningMessage ? (
        <div className="no-print" style={styles.warning}>
          {warningMessage}
        </div>
      ) : null}

      <article style={styles.report}>
        <CoverPage
          record={record}
          capaNumber={capaNumber}
          status={status}
          capaType={capaType}
          owner={owner}
          initiatedAt={initiatedAt}
          linkedNcmrNumber={linkedNcmrNumber}
          generatedAt={generatedAt}
        />

        <table className="enterprise-report-table" style={styles.reportTable}>
          <thead>
            <tr>
              <td style={styles.reportTableCell}>
                <InternalReportHeader
                  record={record}
                  capaNumber={capaNumber}
                  status={status}
                />
              </td>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={styles.reportTableCell}>
        <ReportSection
          number="1"
          title="Initiation"
          subtitle="CAPA initiation and quality approval record"
        >
          <FieldGrid>
            <ReportField
              label="Problem Statement"
              value={firstValue(
                record.problem_statement,
                record.problem_description,
                record.description,
              )}
              wide
            />
            <ReportField
              label="Justification for CAPA"
              value={firstValue(
                record.capa_justification,
                record.justification,
                record.initiation_justification,
              )}
              wide
            />
            <ReportField label="CAPA Type" value={capaType} />
            <ReportField
              label="Detection Source"
              value={firstValue(record.detection_source, record.source)}
            />
            <ReportField label="CAPA Owner" value={owner} />
            <ReportField
              label="Target Due Date"
              value={firstValue(record.due_date, record.target_due_date)}
              format="date"
            />
            <ReportField
              label="Product Impact"
              value={firstValue(
                record.product_impact,
                record.product_quality_impact,
                record.affected_product,
              )}
              wide
            />
            <ReportField
              label="Process Impact"
              value={firstValue(
                record.process_impact,
                record.affected_process,
              )}
              wide
            />
            <ReportField
              label="Patient Impact"
              value={firstValue(
                record.patient_impact,
                record.patient_safety_impact,
              )}
              wide
            />
          </FieldGrid>

          <ApprovalCard
            title="Initiation Approval"
            status={firstValue(
              record.initiation_approval_status,
              record.initiation_status,
            )}
            approvedBy={firstValue(
              record.initiation_approved_by,
              record.initiation_approver,
            )}
            approvedAt={firstValue(
              record.initiation_approved_at,
              record.initiation_approval_date,
            )}
            comments={firstValue(
              record.initiation_approval_comments,
              record.initiation_comments,
            )}
          />
        </ReportSection>

        <ReportSection
          number="2"
          title="Evaluation"
          subtitle="Scope, affected entities, interim controls, and risk assessment"
        >
          <FieldGrid>
            <ReportField
              label="Scope Summary"
              value={firstValue(
                record.scope_summary,
                record.scope,
                record.evaluation_scope,
              )}
              wide
            />
            <ReportField
              label="Affected Product"
              value={record.affected_product}
            />
            <ReportField
              label="Affected Lot"
              value={record.affected_lot}
            />
            <ReportField
              label="Affected Process"
              value={record.affected_process}
            />
            <ReportField
              label="Affected Supplier"
              value={record.affected_supplier}
            />
            <ReportField
              label="Potential Impact"
              value={record.potential_impact}
              wide
            />

            <ReportField
              label="Interim Controls Required"
              value={firstValue(
                record.interim_controls_required,
                record.interim_control_required,
                record.containment_required,
              )}
            />
            <ReportField
              label="No Interim Controls Justification"
              value={firstValue(
                record.no_interim_controls_justification,
                record.interim_control_rationale,
                record.containment_rationale,
              )}
              wide
            />
            <ReportField
              label="Interim Control / Containment Action"
              value={firstValue(
                record.containment_action,
                record.interim_control,
                record.interim_control_description,
              )}
              wide
            />
            <ReportField
              label="Interim Control Owner"
              value={firstValue(
                record.containment_owner,
                record.interim_control_owner,
              )}
            />
            <ReportField
              label="Interim Control Complete"
              value={firstValue(
                record.containment_complete,
                record.interim_control_complete,
              )}
            />
            <ReportField
              label="Residual Risk After Interim Control"
              value={record.containment_residual_risk}
              wide
            />
          </FieldGrid>

          <Subsection title="Risk Assessment">
            <FieldGrid>
              <ReportField label="Severity" value={record.severity} />
              <ReportField
                label="Occurrence"
                value={firstValue(
                  record.occurrence_rating,
                  record.occurrence,
                )}
              />
              <ReportField
                label="Detection"
                value={firstValue(
                  record.detection_rating,
                  record.detection,
                )}
              />
              <ReportField label="Risk Level" value={record.risk_level} />
              <ReportField
                label="Patient Safety Impact"
                value={record.patient_safety_impact}
                wide
              />
              <ReportField
                label="Product Quality Impact"
                value={record.product_quality_impact}
                wide
              />
              <ReportField
                label="Regulatory Impact"
                value={record.regulatory_impact}
                wide
              />
              <ReportField
                label="Risk Rationale"
                value={firstValue(
                  record.risk_rationale,
                  record.risk_assessment,
                )}
                wide
              />
            </FieldGrid>
          </Subsection>
        </ReportSection>

        <ReportSection
          number="3"
          title="Investigation"
          subtitle="Investigation plan, findings, and root-cause determination"
        >
          <FieldGrid>
            <ReportField
              label="Investigation Plan"
              value={firstValue(
                record.investigation_plan,
                record.investigation_objective,
                record.investigation_notes,
              )}
              wide
            />
            <ReportField
              label="Evidence Reviewed"
              value={record.evidence_reviewed}
              wide
            />
            <ReportField
              label="Investigation Findings"
              value={firstValue(
                record.investigation_findings,
                record.investigation_summary,
              )}
              wide
            />
            <ReportField
              label="Investigation Conclusion"
              value={record.investigation_conclusion}
              wide
            />
          </FieldGrid>

          <Subsection title="Root Cause Determination">
            <FieldGrid>
              <ReportField
                label="Root Cause Method"
                value={record.root_cause_method}
              />
              <ReportField
                label="Root Cause"
                value={firstValue(
                  record.root_cause,
                  record.root_cause_summary,
                )}
                wide
              />
              <ReportField
                label="Contributing Factors"
                value={record.contributing_factors}
                wide
              />
              <ReportField
                label="Root Cause Verification"
                value={record.root_cause_verification}
                wide
              />
              <ReportField
                label="Systemic Impact"
                value={record.systemic_impact}
                wide
              />
            </FieldGrid>
          </Subsection>

          <ApprovalCard
            title="Investigation Approval"
            status={record.investigation_approval_status}
            approvedBy={record.investigation_approved_by}
            approvedAt={record.investigation_approved_at}
            comments={record.investigation_approval_comments}
          />
        </ReportSection>

        <ReportSection
          number="4"
          title="Action Plan"
          subtitle="Proposed corrective or preventive actions and approval evidence"
        >
          <FieldGrid>
            <ReportField
              label={
                String(capaType).toLowerCase().includes("prevent")
                  ? "Preventive Action Plan"
                  : "Corrective Action Plan"
              }
              value={firstValue(
                record.corrective_action_plan,
                record.action_plan,
                record.corrective_action,
                record.preventive_action_plan,
                record.preventive_action,
              )}
              wide
            />
            <ReportField label="Action Owner" value={record.action_owner} />
            <ReportField
              label="Action Due Date"
              value={record.action_due_date}
              format="date"
            />
            <ReportField
              label="Required Resources"
              value={record.required_resources}
              wide
            />
            <ReportField
              label="Required Evidence"
              value={record.required_evidence}
              wide
            />
          </FieldGrid>

          <ApprovalCard
            title="Action Plan Approval"
            status={firstValue(
              record.action_plan_approval_status,
              record.action_approval_status,
            )}
            approvedBy={firstValue(
              record.action_plan_approved_by,
              record.action_approved_by,
            )}
            approvedAt={firstValue(
              record.action_plan_approved_at,
              record.action_approved_at,
            )}
            comments={firstValue(
              record.action_plan_approval_comments,
              record.action_plan_rejection_comments,
              record.action_approval_comments,
            )}
          />
        </ReportSection>

        <ReportSection
          number="5"
          title="Task Assignment"
          subtitle="Implementation task ownership, timing, status, and completion evidence"
        >
          <TaskTable tasks={tasks} />
        </ReportSection>

        <ReportSection
          number="6"
          title="Implementation"
          subtitle="Execution of approved actions and implementation evidence"
        >
          <FieldGrid>
            <ReportField
              label="Implementation Evidence"
              value={firstValue(
                record.implementation_details,
                record.implementation_evidence,
                record.implementation_summary,
                record.implementation_notes,
              )}
              wide
            />
            <ReportField
              label="Implementation Evidence Attachment"
              value={firstValue(
                record.implementation_evidence_file_name,
                record.implementation_evidence_file_url,
              )}
              wide
            />
            <ReportField
              label="Implemented By"
              value={firstValue(
                record.implemented_by,
                record.implementation_completed_by,
              )}
            />
            <ReportField
              label="Implemented At"
              value={firstValue(
                record.implemented_at,
                record.implementation_completed_at,
              )}
              format="datetime"
            />
            <ReportField
              label="Procedure Updated"
              value={record.procedure_updated}
            />
            <ReportField
              label="Training Required"
              value={record.training_required}
            />
            <ReportField
              label="Validation Required"
              value={record.validation_required}
            />
          </FieldGrid>
        </ReportSection>

        <ReportSection
          number="7"
          title="Effectiveness Plan"
          subtitle="Approved verification method, success criteria, evidence, ownership, and timing"
        >
          <FieldGrid>
            <ReportField
              label="Verification Method"
              value={firstValue(
                record.verification_method,
                record.monitoring_method,
                record.effectiveness_plan,
                record.monitoring_plan,
              )}
              wide
            />
            <ReportField
              label="Success Criteria"
              value={firstValue(
                record.effectiveness_success_criteria,
                record.effectiveness_criteria,
                record.success_criteria,
                record.acceptance_criteria,
              )}
              wide
            />
            <ReportField
              label="Data to Collect"
              value={record.effectiveness_data_to_collect}
              wide
            />
            <ReportField
              label="Sample Size"
              value={record.effectiveness_sample_size}
            />
            <ReportField
              label="Monitoring Period"
              value={record.monitoring_period}
            />
            <ReportField
              label="Verification Owner"
              value={record.verification_owner}
            />
            <ReportField
              label="Verification Due Date"
              value={firstValue(
                record.verification_due_date,
                record.effectiveness_due_date,
                record.effectiveness_verification_date,
              )}
              format="date"
            />
            <ReportField
              label="Required Objective Evidence"
              value={record.required_objective_evidence}
              wide
            />
          </FieldGrid>

          <ApprovalCard
            title="Effectiveness Plan Approval"
            status={record.effectiveness_plan_approval_status}
            approvedBy={record.effectiveness_plan_approved_by}
            approvedAt={record.effectiveness_plan_approved_at}
            comments={firstValue(
              record.effectiveness_plan_approval_comments,
              record.effectiveness_plan_rejection_comments,
            )}
          />
        </ReportSection>

        <ReportSection
          number="8"
          title="Effectiveness Verification"
          subtitle="Verification results, objective evidence, disposition, and follow-up"
        >
          <FieldGrid>
            <ReportField
              label="Verification Results"
              value={firstValue(
                record.effectiveness_results,
                record.effectiveness_check,
                record.effectiveness_verification,
              )}
              wide
            />
            <ReportField
              label="Objective Evidence"
              value={firstValue(
                record.effectiveness_evidence,
                record.effectiveness_verification_evidence,
              )}
              wide
            />
            <ReportField
              label="Result"
              value={firstValue(
                record.effectiveness_result,
                record.effectiveness_rating,
                record.effectiveness_status,
              )}
            />
            <ReportField
              label="Verified By"
              value={firstValue(
                record.effectiveness_verified_by,
                record.effectiveness_reviewed_by,
                record.verification_owner,
              )}
            />
            <ReportField
              label="Verified At"
              value={firstValue(
                record.effectiveness_verified_at,
                record.effectiveness_reviewed_at,
                record.verification_completed_at,
              )}
              format="datetime"
            />
            <ReportField
              label="Recurrence Detected"
              value={record.recurrence_detected}
            />
            <ReportField
              label="Follow-up CAPA Required"
              value={record.followup_capa_required}
            />
            <ReportField
              label="Follow-up Action"
              value={record.effectiveness_followup_action}
              wide
            />
          </FieldGrid>
        </ReportSection>

        <ReportSection
          number="9"
          title="Closure"
          subtitle="Final disposition, closure approval, signatures, and controlled-record status"
        >
          <FieldGrid>
            <ReportField
              label="Closure Summary"
              value={firstValue(
                record.closure_summary,
                record.closure_notes,
                record.final_summary,
              )}
              wide
            />
            <ReportField
              label="Closure Decision"
              value={firstValue(
                record.closure_decision,
                record.closure_disposition,
              )}
            />
            <ReportField
              label="Closed By"
              value={firstValue(record.closed_by, record.locked_by)}
            />
            <ReportField
              label="Closed At"
              value={firstValue(record.closed_at, record.locked_at)}
              format="datetime"
            />
          </FieldGrid>

          <ApprovalCard
            title="Closure Approval"
            status={record.closure_approval_status}
            approvedBy={record.closure_approved_by}
            approvedAt={record.closure_approved_at}
            comments={record.closure_approval_comments}
          />

          {hasMeaningfulValue(
            record.signed_by,
            record.signed_at,
            record.signature_meaning,
            record.locked_by,
            record.locked_at,
          ) ? (
            <Subsection title="Electronic Signature and Record Lock">
              <FieldGrid>
                <ReportField label="Signed By" value={record.signed_by} />
                <ReportField
                  label="Signed At"
                  value={record.signed_at}
                  format="datetime"
                />
                <ReportField
                  label="Signature Meaning"
                  value={record.signature_meaning}
                  wide
                />
                <ReportField label="Locked By" value={record.locked_by} />
                <ReportField
                  label="Locked At"
                  value={record.locked_at}
                  format="datetime"
                />
              </FieldGrid>
            </Subsection>
          ) : null}

          {String(record.status || "").toLowerCase() === "cancelled" ? (
            <Subsection title="Cancellation Evidence">
              <FieldGrid>
                <ReportField label="Cancel Reason" value={record.cancel_reason} />
                <ReportField
                  label="Cancellation Justification"
                  value={record.cancellation_justification}
                  wide
                />
                <ReportField label="Cancelled By" value={record.cancelled_by} />
                <ReportField
                  label="Cancelled At"
                  value={record.cancelled_at}
                  format="datetime"
                />
              </FieldGrid>
            </Subsection>
          ) : null}
        </ReportSection>
              </td>
            </tr>
          </tbody>
        </table>
      </article>

      <div className="print-footer" style={styles.printFooter}>
        <span>{String(capaNumber)}</span>
        <span style={styles.footerSeparator}>|</span>
        <span>Printed: {formatCustomerDateTime(generatedAt)}</span>
        <span style={styles.footerSeparator}>|</span>
        <span className="page-counter" />
      </div>

      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          background: #eef1f5;
        }

        @page {
          size: Letter;
          margin: 0.62in 0.5in 0.62in;

          @top-left {
            content: "${escapeCssContent(capaNumber)} Controlled Record";
            font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
            font-size: 8pt;
            color: #111827;
            border-bottom: 0.5pt solid #64748b;
            padding-bottom: 5pt;
            vertical-align: bottom;
          }

          @bottom-left {
            content: "${escapeCssContent(capaNumber)} | Printed: ${escapeCssContent(
              formatCustomerDateTime(generatedAt),
            )} | Page " counter(page) " of " counter(pages);
            font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
            font-size: 7.5pt;
            color: #111827;
            border-top: 0.5pt solid #64748b;
            padding-top: 4pt;
            vertical-align: top;
          }
        }

        @media print {
          html,
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }

          .no-print {
            display: none !important;
          }

          .report-shell {
            box-shadow: none !important;
            margin: 0 !important;
            max-width: none !important;
          }

          .report-cover {
            height: 9.1in !important;
            min-height: 0 !important;
            padding: 0.32in 0.42in 0.28in !important;
            overflow: hidden !important;
            page-break-after: always !important;
            break-after: page !important;
          }

          .report-cover > div:nth-child(2) {
            margin-top: 0.42in !important;
          }

          .report-cover > div:last-child {
            padding-top: 12px !important;
          }

          .enterprise-report-table {
            width: 100% !important;
            border-collapse: collapse !important;
          }

          .enterprise-report-table thead {
            display: table-header-group !important;
          }

          .enterprise-report-table tbody {
            display: table-row-group !important;
          }

          .enterprise-report-table > thead > tr > td,
          .enterprise-report-table > tbody > tr > td {
            padding: 0 !important;
            border: 0 !important;
          }

          .internal-report-header {
            display: none !important;
          }

          .report-section {
            break-inside: auto;
            page-break-inside: auto;
          }

          .report-section > div:first-child,
          .subsection-heading,
          h2,
          h3 {
            break-after: avoid-page;
            page-break-after: avoid;
          }

          .avoid-break,
          .approval-card,
          table:not(.enterprise-report-table) tr {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          table:not(.enterprise-report-table) {
            break-inside: auto;
            page-break-inside: auto;
          }

          table:not(.enterprise-report-table) thead {
            display: table-header-group;
          }

          .print-footer {
            display: none !important;
          }
        }
      `}</style>
    </main>
  );
}

function InternalReportHeader({
  capaNumber,
}: {
  record: CapaRecord;
  capaNumber: unknown;
  status: unknown;
}) {
  return (
    <div className="internal-report-header" style={styles.internalHeader}>
      <span style={styles.internalHeaderText}>
        {displayValue(capaNumber)} Controlled Record
      </span>
    </div>
  );
}

function CoverPage({
  record,
  capaNumber,
  status,
  capaType,
  owner,
  initiatedAt,
  linkedNcmrNumber,
  generatedAt,
}: {
  record: CapaRecord;
  capaNumber: unknown;
  status: unknown;
  capaType: unknown;
  owner: unknown;
  initiatedAt: unknown;
  linkedNcmrNumber: unknown;
  generatedAt: Date;
}) {
  return (
    <section className="report-cover" style={styles.cover}>
      <div style={styles.brandRow}>
        <div style={styles.logoBox}>
          {firstValue(record.organization_logo_url, record.logo_url) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={String(
                firstValue(record.organization_logo_url, record.logo_url),
              )}
              alt="Organization logo"
              style={styles.logo}
            />
          ) : (
            <span style={styles.logoPlaceholder}>QUALISPHERE</span>
          )}
        </div>

        <div style={styles.brandText}>
          <div style={styles.organizationName}>
            {displayValue(
              firstValue(
                record.organization_name,
                record.company_name,
                "QualiSphere",
              ),
            )}
          </div>
          <div style={styles.platformName}>QualiSphere Enterprise QMS</div>
        </div>
      </div>

      <div style={styles.coverTitleBlock}>
        <div style={styles.controlledRecordLabel}>CONTROLLED QUALITY RECORD</div>
        <h1 style={styles.coverTitle}>CAPA Report</h1>
        <div style={styles.coverNumber}>{displayValue(capaNumber)}</div>
      </div>

      <div style={styles.coverMetadata}>
        <MetadataRow label="Status" value={status} />
        <MetadataRow label="CAPA Type" value={capaType} />
        <MetadataRow label="Owner" value={owner} />
        <MetadataRow
          label="Initiated"
          value={formatDate(initiatedAt)}
        />
        <MetadataRow
          label="Closed"
          value={formatDate(record.closed_at)}
        />
        <MetadataRow label="Linked NCMR" value={linkedNcmrNumber} />
        <MetadataRow
          label="Report Generated"
          value={formatDateTime(generatedAt)}
        />
      </div>

      <div style={styles.coverStatement}>
        This report is the controlled record of the CAPA workflow and presents
        the information by approved workflow stage.
      </div>
    </section>
  );
}

function ReportSection({
  number,
  title,
  subtitle,
  children,
}: {
  number: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="report-section" style={styles.section}>
      <div style={styles.sectionHeader}>
        <div style={styles.sectionNumber}>{number}</div>
        <div>
          <div style={styles.phaseLabel}>WORKFLOW PHASE {number}</div>
          <h2 style={styles.sectionTitle}>{title}</h2>
          {subtitle ? (
            <div style={styles.sectionSubtitle}>{subtitle}</div>
          ) : null}
        </div>
      </div>
      <div style={styles.sectionBody}>{children}</div>
    </section>
  );
}

function Subsection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="avoid-break" style={styles.subsection}>
      <h3 className="subsection-heading" style={styles.subsectionTitle}>{title}</h3>
      {children}
    </div>
  );
}

function FieldGrid({ children }: { children: ReactNode }) {
  return <div style={styles.fieldGrid}>{children}</div>;
}

function ReportField({
  label,
  value,
  wide = false,
  format,
}: {
  label: string;
  value: unknown;
  wide?: boolean;
  format?: "date" | "datetime";
}) {
  if (!hasMeaningfulValue(value)) return null;

  let rendered = displayValue(value);
  if (format === "date") rendered = formatDate(value);
  if (format === "datetime") rendered = formatDateTime(value);

  return (
    <div
      className="avoid-break"
      style={{
        ...styles.field,
        ...(wide ? styles.fieldWide : {}),
      }}
    >
      <div style={styles.fieldLabel}>{label}</div>
      <div style={styles.fieldValue}>{rendered}</div>
    </div>
  );
}

function ApprovalCard({
  title,
  status,
  approvedBy,
  approvedAt,
  comments,
}: {
  title: string;
  status: unknown;
  approvedBy: unknown;
  approvedAt: unknown;
  comments?: unknown;
}) {
  if (!hasMeaningfulValue(status, approvedBy, approvedAt, comments)) return null;

  return (
    <div className="avoid-break approval-card" style={styles.approvalCard}>
      <div style={styles.approvalTitle}>{title}</div>
      <div style={styles.approvalGrid}>
        <MiniField label="Decision" value={status} />
        <MiniField label="Approved By" value={approvedBy} />
        <MiniField
          label="Date / Time"
          value={
            hasMeaningfulValue(approvedAt)
              ? formatDateTime(approvedAt)
              : ""
          }
        />
      </div>
      {hasMeaningfulValue(comments) ? (
        <div style={styles.approvalComments}>
          <strong>Comments:</strong> {displayValue(comments)}
        </div>
      ) : null}
    </div>
  );
}

function MiniField({
  label,
  value,
}: {
  label: string;
  value: unknown;
}) {
  return (
    <div>
      <div style={styles.miniLabel}>{label}</div>
      <div style={styles.miniValue}>{displayValue(value)}</div>
    </div>
  );
}

function TaskTable({ tasks }: { tasks: CapaTask[] }) {
  if (tasks.length === 0) {
    return <p style={styles.emptyText}>No task assignments recorded.</p>;
  }

  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Task</th>
            <th style={styles.th}>Owner</th>
            <th style={styles.th}>Due Date</th>
            <th style={styles.th}>Status</th>
            <th style={styles.th}>Evidence</th>
            <th style={styles.th}>Completion</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task, index) => (
            <tr key={String(task.id || index)}>
              <td style={styles.td}>
                <strong>
                  {displayValue(
                    firstValue(task.task_title, task.title),
                  )}
                </strong>
                {hasMeaningfulValue(
                  firstValue(task.task_description, task.description),
                ) ? (
                  <div style={styles.tableSecondary}>
                    {displayValue(
                      firstValue(
                        task.task_description,
                        task.description,
                      ),
                    )}
                  </div>
                ) : null}
              </td>
              <td style={styles.td}>
                {displayValue(
                  firstValue(task.owner, task.assigned_to),
                )}
              </td>
              <td style={styles.td}>{formatDate(task.due_date)}</td>
              <td style={styles.td}>{displayValue(task.status)}</td>
              <td style={styles.td}>
                {displayValue(task.completion_evidence)}
              </td>
              <td style={styles.td}>
                {displayValue(task.completed_by)}
                {hasMeaningfulValue(task.completed_at) ? (
                  <div style={styles.tableSecondary}>
                    {formatDateTime(task.completed_at)}
                  </div>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MetadataRow({
  label,
  value,
}: {
  label: string;
  value: unknown;
}) {
  return (
    <div style={styles.metadataRow}>
      <div style={styles.metadataLabel}>{label}</div>
      <div style={styles.metadataValue}>{displayValue(value)}</div>
    </div>
  );
}

function firstValue(...values: unknown[]) {
  return values.find((value) => hasMeaningfulValue(value));
}

function hasMeaningfulValue(...values: unknown[]) {
  return values.some((value) => {
    if (value === null || value === undefined || value === "") return false;
    if (Array.isArray(value)) return value.length > 0;
    return true;
  });
}

const DISPLAY_VALUES: Record<string, string> = {
  approved: "Approved",
  rejected: "Rejected",
  pending: "Pending",
  submitted: "Submitted",
  completed: "Completed",
  complete: "Complete",
  open: "Open",
  closed: "Closed",
  cancelled: "Cancelled",
  canceled: "Cancelled",
  corrective: "Corrective",
  preventive: "Preventive",
  high_detection: "High",
  medium_detection: "Medium",
  low_detection: "Low",
  high_occurrence: "High",
  medium_occurrence: "Medium",
  low_occurrence: "Low",
  critical: "Critical",
  major: "Major",
  minor: "Minor",
  high: "High",
  medium: "Medium",
  low: "Low",
  yes: "Yes",
  no: "No",
  pass: "Pass",
  passed: "Passed",
  fail: "Fail",
  failed: "Failed",
  effective: "Effective",
  ineffective: "Ineffective",
  not_effective: "Not Effective",
  not_required: "Not Required",
  in_progress: "In Progress",
  awaiting_approval: "Awaiting Approval",
  returned_for_revision: "Returned for Revision",
};

function toFriendlyDisplayValue(value: string): string {
  const normalized = value.trim().toLowerCase();

  if (DISPLAY_VALUES[normalized]) return DISPLAY_VALUES[normalized];

  if (/^[a-z0-9]+(?:[_-][a-z0-9]+)+$/i.test(value.trim())) {
    return value
      .trim()
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (character) => character.toUpperCase());
  }

  return value;
}

function displayValue(value: unknown): string {
  if (!hasMeaningfulValue(value)) return "N/A";

  if (typeof value === "boolean") return value ? "Yes" : "No";

  if (Array.isArray(value)) {
    return value.map((item) => displayValue(item)).join(", ");
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  return toFriendlyDisplayValue(String(value));
}

function formatDate(value: unknown): string {
  if (!hasMeaningfulValue(value)) return "N/A";

  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return displayValue(value);

  const day = String(date.getDate()).padStart(2, "0");
  const month = new Intl.DateTimeFormat("en-US", {
    month: "short",
  }).format(date);
  const year = date.getFullYear();

  return `${day}-${month}-${year}`;
}

function formatCustomerDateTime(value: unknown): string {
  if (!hasMeaningfulValue(value)) return "N/A";

  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return displayValue(value);

  const day = String(date.getDate()).padStart(2, "0");
  const month = new Intl.DateTimeFormat("en-US", {
    month: "short",
  }).format(date);
  const year = date.getFullYear();
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);

  return `${day}-${month}-${year} ${time}`;
}

function formatDateTime(value: unknown): string {
  return formatCustomerDateTime(value);
}

function escapeCssContent(value: unknown): string {
  return displayValue(value)
    .split("\\")
    .join("\\\\")
    .split('"')
    .join('\\"')
    .replace(/\r?\n/g, " ");
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "24px",
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    color: "#172033",
  },
  toolbar: {
    maxWidth: "1000px",
    margin: "0 auto 16px",
    display: "flex",
    alignItems: "center",
    gap: "14px",
  },
  primaryButton: {
    border: "1px solid #1f3a5f",
    background: "#1f3a5f",
    color: "white",
    borderRadius: "6px",
    padding: "9px 14px",
    cursor: "pointer",
    fontWeight: 700,
  },
  backLink: {
    color: "#1f3a5f",
    fontWeight: 600,
    textDecoration: "none",
    whiteSpace: "nowrap",
  },
  printInstruction: {
    marginLeft: "auto",
    maxWidth: "520px",
    color: "#667085",
    fontSize: "11px",
    lineHeight: 1.4,
  },
  warning: {
    maxWidth: "1000px",
    margin: "0 auto 16px",
    padding: "12px 14px",
    border: "1px solid #d6a100",
    background: "#fff8db",
    borderRadius: "6px",
  },
  report: {
    maxWidth: "1000px",
    margin: "0 auto",
    background: "white",
    boxShadow: "0 12px 32px rgba(15, 23, 42, 0.12)",
  },
  reportTable: {
    width: "100%",
    borderCollapse: "collapse",
  },
  reportTableCell: {
    padding: 0,
    border: 0,
  },
  internalHeader: {
    padding: "8px 12px",
    borderBottom: "1px solid #9ca3af",
    background: "white",
  },
  internalHeaderText: {
    color: "#111827",
    fontFamily:
      '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
    fontSize: "10px",
    fontWeight: 500,
    letterSpacing: "0.01em",
  },
  cover: {
    minHeight: "1030px",
    padding: "54px",
    display: "flex",
    flexDirection: "column",
    borderTop: "10px solid #1f3a5f",
  },
  brandRow: {
    display: "flex",
    alignItems: "center",
    gap: "20px",
    paddingBottom: "24px",
    borderBottom: "1px solid #cbd5e1",
  },
  logoBox: {
    width: "150px",
    minHeight: "64px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid #d7dee8",
    borderRadius: "4px",
    padding: "8px",
  },
  logo: {
    maxWidth: "132px",
    maxHeight: "54px",
    objectFit: "contain",
  },
  logoPlaceholder: {
    fontWeight: 800,
    letterSpacing: "0.08em",
    color: "#1f3a5f",
    fontSize: "12px",
  },
  brandText: {
    flex: 1,
  },
  organizationName: {
    fontSize: "22px",
    fontWeight: 800,
    color: "#172033",
  },
  platformName: {
    marginTop: "5px",
    fontSize: "13px",
    color: "#5d6878",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  coverTitleBlock: {
    marginTop: "110px",
  },
  controlledRecordLabel: {
    color: "#627086",
    fontSize: "12px",
    fontWeight: 800,
    letterSpacing: "0.16em",
  },
  coverTitle: {
    margin: "12px 0 8px",
    fontSize: "46px",
    lineHeight: 1.05,
    color: "#1f3a5f",
  },
  coverNumber: {
    fontSize: "26px",
    fontWeight: 700,
    color: "#374151",
  },
  coverMetadata: {
    marginTop: "64px",
    borderTop: "1px solid #d7dee8",
  },
  metadataRow: {
    display: "grid",
    gridTemplateColumns: "190px 1fr",
    gap: "18px",
    padding: "12px 0",
    borderBottom: "1px solid #e5e7eb",
  },
  metadataLabel: {
    color: "#5d6878",
    fontSize: "12px",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  metadataValue: {
    fontSize: "14px",
    fontWeight: 600,
  },
  coverStatement: {
    marginTop: "auto",
    paddingTop: "24px",
    borderTop: "1px solid #d7dee8",
    color: "#5d6878",
    fontSize: "12px",
    lineHeight: 1.6,
  },
  section: {
    padding: "38px 42px 42px",
    borderTop: "1px solid #dbe2ea",
  },
  sectionHeader: {
    display: "flex",
    alignItems: "flex-start",
    gap: "14px",
    paddingBottom: "16px",
    borderBottom: "2px solid #1f3a5f",
  },
  sectionNumber: {
    width: "34px",
    height: "34px",
    flex: "0 0 34px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#1f3a5f",
    color: "white",
    fontSize: "14px",
    fontWeight: 800,
  },
  phaseLabel: {
    marginBottom: "3px",
    color: "#64748b",
    fontSize: "10px",
    fontWeight: 800,
    letterSpacing: "0.12em",
  },
  sectionTitle: {
    margin: 0,
    color: "#1f3a5f",
    fontSize: "25px",
  },
  sectionSubtitle: {
    marginTop: "4px",
    color: "#667085",
    fontSize: "12px",
  },
  sectionBody: {
    paddingTop: "18px",
  },
  fieldGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "12px",
  },
  field: {
    border: "1px solid #dce2e9",
    borderRadius: "5px",
    background: "#fbfcfd",
    padding: "11px 12px",
    minHeight: "64px",
  },
  fieldWide: {
    gridColumn: "1 / -1",
  },
  fieldLabel: {
    marginBottom: "6px",
    color: "#596579",
    fontSize: "10px",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  fieldValue: {
    color: "#172033",
    fontSize: "13px",
    lineHeight: 1.5,
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
  },
  subsection: {
    marginTop: "18px",
    padding: "16px",
    border: "1px solid #d7dee8",
    borderRadius: "6px",
  },
  subsectionTitle: {
    margin: "0 0 12px",
    color: "#334155",
    fontSize: "16px",
  },
  approvalCard: {
    marginTop: "18px",
    border: "1px solid #bac7d6",
    borderLeft: "5px solid #1f3a5f",
    borderRadius: "5px",
    padding: "14px 16px",
    background: "#f7f9fc",
  },
  approvalTitle: {
    marginBottom: "12px",
    color: "#1f3a5f",
    fontSize: "14px",
    fontWeight: 800,
  },
  approvalGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "12px",
  },
  miniLabel: {
    color: "#64748b",
    fontSize: "9px",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  miniValue: {
    marginTop: "4px",
    fontSize: "12px",
    fontWeight: 600,
  },
  approvalComments: {
    marginTop: "12px",
    paddingTop: "10px",
    borderTop: "1px solid #d7dee8",
    fontSize: "12px",
    whiteSpace: "pre-wrap",
  },
  tableWrap: {
    width: "100%",
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "11px",
  },
  th: {
    padding: "9px",
    border: "1px solid #c7d0dc",
    background: "#e8edf4",
    color: "#26364d",
    textAlign: "left",
    verticalAlign: "top",
    fontWeight: 800,
  },
  td: {
    padding: "9px",
    border: "1px solid #d7dee8",
    verticalAlign: "top",
    lineHeight: 1.4,
    overflowWrap: "anywhere",
  },
  tableSecondary: {
    marginTop: "4px",
    color: "#667085",
    fontSize: "10px",
  },
  emptyText: {
    margin: 0,
    color: "#667085",
    fontStyle: "italic",
  },
  note: {
    margin: "14px 0 0",
    color: "#667085",
    fontSize: "11px",
    lineHeight: 1.5,
  },
  printFooter: {
    display: "none",
  },
  footerSeparator: {
    padding: "0 6px",
  },
}
