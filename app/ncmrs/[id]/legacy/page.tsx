"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";

export default function NcmrHistoricalRecordPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [record, setRecord] = useState<any>(null);
  const [affectedItems, setAffectedItems] = useState<any[]>([]);
  const [approvalTasks, setApprovalTasks] = useState<any[]>([]);
  const [auditTimeline, setAuditTimeline] = useState<any[]>([]);
  const [moduleVersionStatus, setModuleVersionStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (id) loadHistoricalRecord();
  }, [id]);

  const loadHistoricalRecord = async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const recordRes = await supabase
        .from("ncmrs")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (recordRes.error) throw new Error(recordRes.error.message);
      if (!recordRes.data) throw new Error("NCMR record not found.");

      const ncmr = recordRes.data;
      const isClosed =
        String(ncmr.status || "").trim().toLowerCase() === "closed";

      if (!isClosed) {
        setRecord(ncmr);
        setErrorMessage(
          "Historical Record Protection applies only to closed NCMR records. This NCMR remains an active workflow record."
        );
        setLoading(false);
        return;
      }

      const [itemsRes, tasksRes, auditRes] = await Promise.all([
        supabase
          .from("ncmr_affected_items")
          .select("*")
          .eq("ncmr_id", id)
          .order("created_at", { ascending: true }),
        supabase
          .from("approval_tasks")
          .select("*")
          .eq("entity_type", "ncmr")
          .eq("entity_id", id)
          .order("created_at", { ascending: true }),
        supabase
          .from("audit_logs")
          .select("*")
          .eq("entity_type", "ncmr")
          .eq("entity_id", id)
          .order("created_at", { ascending: false }),
      ]);

      if (itemsRes.error) throw new Error(itemsRes.error.message);
      if (tasksRes.error) throw new Error(tasksRes.error.message);
      if (auditRes.error) throw new Error(auditRes.error.message);

      let versionStatus = "";

      if (ncmr.workflow_version_id) {
        const versionRes = await supabase
          .from("qms_workflow_versions")
          .select("status")
          .eq("id", ncmr.workflow_version_id)
          .maybeSingle();

        if (!versionRes.error) {
          versionStatus = versionRes.data?.status || "";
        }
      } else if (ncmr.workflow_version_code) {
        const versionRes = await supabase
          .from("qms_workflow_versions")
          .select("status")
          .eq("module_code", "NCMR")
          .eq("version_code", ncmr.workflow_version_code)
          .maybeSingle();

        if (!versionRes.error) {
          versionStatus = versionRes.data?.status || "";
        }
      }

      setRecord(ncmr);
      setAffectedItems(itemsRes.data || []);
      setApprovalTasks(tasksRes.data || []);
      setAuditTimeline(auditRes.data || []);
      setModuleVersionStatus(normalizeModuleVersionStatus(versionStatus));
    } catch (error: any) {
      setErrorMessage(error?.message || "Unable to load the NCMR record.");
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

  if (errorMessage) {
    return (
      <main style={pageStyle}>
        <h1>{record.ncmr_number || "NCMR Record"}</h1>

        <div style={warningStyle}>{errorMessage}</div>

        <div style={buttonRowStyle}>
          <Link href={`/ncmrs/${id}`} style={primaryLinkStyle}>
            Open Active Workflow
          </Link>

          <Link href="/ncmrs" style={secondaryLinkStyle}>
            Return to NCMR
          </Link>
        </div>
      </main>
    );
  }

  const moduleVersion =
    record.workflow_version_code || "Unstamped Historical Version";

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>QUALISPHERE NCMR RECORD</div>

          <h1 style={{ margin: "6px 0" }}>
            {record.ncmr_number || "NCMR Record"}
          </h1>

          <p style={subtleText}>
            Closed NCMR record · Read-only historical presentation
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
        <strong>Historical Record Protection:</strong> This closed NCMR record
        is presented as stored and is read only. The NCMR record remains valid
        and auditable. Changes to later module versions do not change this
        record.
      </section>

      <section style={summaryGridStyle}>
        <SummaryValue label="NCMR Number" value={record.ncmr_number} />
        <SummaryValue label="Record Status" value={formatLabel(record.status)} />
        <SummaryValue label="Module Version" value={moduleVersion} />
        <SummaryValue
          label="Module Version Status"
          value={moduleVersionStatus || "Historical"}
        />
        <SummaryValue label="Owner" value={record.owner} />
        <SummaryValue label="Created" value={formatDateTime(record.created_at)} />
        <SummaryValue
          label="Closed"
          value={formatDateTime(record.closed_at || record.closure_date)}
        />
        <SummaryValue label="Record Access" value="Read Only" />
      </section>

      <ReadOnlySection title="Initiation">
        <FieldGrid>
          <ReadOnlyField
            label="Issue Description"
            value={record.issue_description}
            wide
          />
          <ReadOnlyField
            label="Source of Detection"
            value={record.source_of_detection}
          />
          <ReadOnlyField label="Department" value={record.department} />
          <ReadOnlyField
            label="Date Detected"
            value={formatDate(record.date_detected)}
          />
          <ReadOnlyField label="Site / Location" value={record.site_location} />
          <ReadOnlyField label="Supplier" value={record.supplier_name} />
          <ReadOnlyField label="Supplier Lot" value={record.supplier_lot} />
          <ReadOnlyField
            label="Purchase Order"
            value={record.purchase_order_number}
          />
          <ReadOnlyField
            label="Immediate Correction"
            value={record.immediate_correction}
            wide
          />
        </FieldGrid>
      </ReadOnlySection>

      <ReadOnlySection title="Affected Parts / Materials">
        {affectedItems.length === 0 ? (
          <p style={subtleText}>
            No affected-item rows are stored for this NCMR.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Part Number</th>
                  <th style={thStyle}>Description</th>
                  <th style={thStyle}>Revision</th>
                  <th style={thStyle}>Lot</th>
                  <th style={thStyle}>Work Order</th>
                  <th style={thStyle}>Affected Qty</th>
                  <th style={thStyle}>Quarantined Qty</th>
                  <th style={thStyle}>Defect Category</th>
                  <th style={thStyle}>Defect Subcategory</th>
                  <th style={thStyle}>Disposition</th>
                </tr>
              </thead>

              <tbody>
                {affectedItems.map((item) => (
                  <tr key={item.id}>
                    <td style={tdStyle}>{display(item.product_part_number)}</td>
                    <td style={tdStyle}>{display(item.part_description)}</td>
                    <td style={tdStyle}>{display(item.part_revision)}</td>
                    <td style={tdStyle}>{display(item.lot_number)}</td>
                    <td style={tdStyle}>{display(item.workorder_number)}</td>
                    <td style={tdStyle}>{display(item.quantity_affected)}</td>
                    <td style={tdStyle}>
                      {display(item.quarantined_quantity)}
                    </td>
                    <td style={tdStyle}>
                      {displayLabel(item.defect_category)}
                    </td>
                    <td style={tdStyle}>
                      {displayLabel(item.defect_subcategory)}
                    </td>
                    <td style={tdStyle}>
                      {displayLabel(
                        item.product_disposition || item.disposition
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ReadOnlySection>

      <ReadOnlySection title="Containment">
        <FieldGrid>
          <ReadOnlyField
            label="Containment Action"
            value={record.containment_action}
            wide
          />
          <ReadOnlyField
            label="Containment Owner"
            value={record.containment_owner}
          />
          <ReadOnlyField
            label="Containment Completed"
            value={formatDateTime(record.containment_completed_at)}
          />
          <ReadOnlyField
            label="Completed By"
            value={record.containment_completed_by}
          />
          <ReadOnlyField
            label="Material Status"
            value={displayLabel(record.material_status)}
          />
        </FieldGrid>
      </ReadOnlySection>

      <ReadOnlySection title="Investigation / Root Cause">
        <FieldGrid>
          <ReadOnlyField label="Investigator" value={record.investigator} />
          <ReadOnlyField
            label="Problem Description"
            value={record.problem_description}
            wide
          />
          <ReadOnlyField
            label="Investigation Summary"
            value={record.investigation_summary}
            wide
          />
          <ReadOnlyField
            label="Root Cause Category"
            value={displayLabel(record.root_cause_category)}
          />
          <ReadOnlyField label="Root Cause" value={record.root_cause} wide />
        </FieldGrid>
      </ReadOnlySection>

      <ReadOnlySection title="Risk Assessment">
        <FieldGrid>
          <ReadOnlyField
            label="Risk Determination"
            value={displayLabel(record.risk_determination)}
          />
          <ReadOnlyField
            label="Severity"
            value={displayLabel(record.severity)}
          />
          <ReadOnlyField
            label="Occurrence"
            value={record.occurrence_rating}
          />
          <ReadOnlyField
            label="Detection"
            value={record.detection_rating}
          />
          <ReadOnlyField
            label="Risk Level"
            value={displayLabel(record.risk_level)}
          />
          <ReadOnlyField
            label="Risk Assessment"
            value={record.risk_assessment}
            wide
          />
          <ReadOnlyField
            label="No Risk Justification"
            value={record.no_risk_justification}
            wide
          />
        </FieldGrid>
      </ReadOnlySection>

      <ReadOnlySection title="CAPA / SCAR Governance Record">
        <FieldGrid>
          <ReadOnlyField
            label="CAPA Recommended"
            value={formatBoolean(record.capa_recommended)}
          />
          <ReadOnlyField
            label="CAPA Decision"
            value={displayLabel(record.capa_decision)}
          />
          <ReadOnlyField
            label="CAPA Justification"
            value={
              record.capa_justification ||
              record.capa_decision_justification
            }
            wide
          />
          <ReadOnlyField
            label="Recurring Issue"
            value={formatBoolean(record.recurring_issue)}
          />
          <ReadOnlyField
            label="Recurrence Reason"
            value={record.recurrence_reason}
            wide
          />
          <ReadOnlyField
            label="Supplier SCAR Required"
            value={formatBoolean(record.supplier_capa_required)}
          />
          <ReadOnlyField
            label="Supplier SCAR Reason"
            value={
              record.supplier_capa_reason || record.scar_justification
            }
            wide
          />
        </FieldGrid>
      </ReadOnlySection>

      <ReadOnlySection title="MRB / Disposition">
        <FieldGrid>
          <ReadOnlyField
            label="Product Disposition"
            value={displayLabel(
              record.product_disposition || record.disposition
            )}
          />
          <ReadOnlyField
            label="Disposition Justification"
            value={record.disposition_justification}
            wide
          />
          <ReadOnlyField
            label="Correction Action Proposal"
            value={record.correction_action_proposal}
            wide
          />
          <ReadOnlyField
            label="Corrective Action"
            value={record.corrective_action}
            wide
          />
          <ReadOnlyField
            label="MRB Approved By"
            value={record.mrb_approved_by}
          />
          <ReadOnlyField
            label="MRB Approved At"
            value={formatDateTime(record.mrb_approved_at)}
          />
        </FieldGrid>
      </ReadOnlySection>

      <ReadOnlySection title="Implementation / Verification / Closure">
        <FieldGrid>
          <ReadOnlyField
            label="Correction Implementation"
            value={record.correction_implementation}
            wide
          />
          <ReadOnlyField
            label="Verification Notes"
            value={
              record.verification_notes ||
              record.effectiveness_verification
            }
            wide
          />
          <ReadOnlyField
            label="Closure Comments"
            value={
              record.closure_comments ||
              record.closure_comment
            }
            wide
          />
          <ReadOnlyField label="Closed By" value={record.closed_by} />
          <ReadOnlyField
            label="Closed At"
            value={formatDateTime(record.closed_at || record.closure_date)}
          />
        </FieldGrid>
      </ReadOnlySection>

      <ReadOnlySection title="Approval / Task History">
        {approvalTasks.length === 0 ? (
          <p style={subtleText}>
            No approval or implementation task rows are stored for this NCMR.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Task</th>
                  <th style={thStyle}>Assigned To</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Due Date</th>
                  <th style={thStyle}>Completed / Approved By</th>
                </tr>
              </thead>

              <tbody>
                {approvalTasks.map((task) => (
                  <tr key={task.id}>
                    <td style={tdStyle}>
                      {displayLabel(task.task_type || task.task_title)}
                    </td>
                    <td style={tdStyle}>
                      {display(
                        task.assigned_to_email || task.approver_email
                      )}
                    </td>
                    <td style={tdStyle}>
                      {displayLabel(task.status)}
                    </td>
                    <td style={tdStyle}>
                      {formatDate(
                        task.due_date || task.approver_due_date
                      )}
                    </td>
                    <td style={tdStyle}>
                      {display(
                        task.completed_by ||
                        task.completed_by_email ||
                        task.approved_by
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ReadOnlySection>

      <ReadOnlySection title="Audit Trail">
        {auditTimeline.length === 0 ? (
          <p style={subtleText}>
            No audit log rows are stored for this NCMR.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Date / Time</th>
                  <th style={thStyle}>Action</th>
                  <th style={thStyle}>User</th>
                  <th style={thStyle}>Details</th>
                </tr>
              </thead>

              <tbody>
                {auditTimeline.map((entry) => (
                  <tr key={entry.id}>
                    <td style={tdStyle}>
                      {formatDateTime(entry.created_at)}
                    </td>
                    <td style={tdStyle}>
                      {displayLabel(entry.action)}
                    </td>
                    <td style={tdStyle}>
                      {display(entry.user_email)}
                    </td>
                    <td style={tdStyle}>
                      {display(entry.details)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ReadOnlySection>

      <section style={footerProtectionStyle}>
        <strong>Record Integrity:</strong> No fields on this page can be edited.
        This page contains no NCMR workflow update, approval, migration,
        recalculation, CAPA/SCAR creation, task creation, or closure actions.
      </section>
    </main>
  );
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

function normalizeModuleVersionStatus(value: any) {
  const normalized = String(value || "").trim().toLowerCase();

  if (normalized === "superseded") return "Superseded";
  if (normalized === "active") return "Active";
  if (normalized === "draft") return "Draft";

  return value ? formatLabel(value) : "";
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
