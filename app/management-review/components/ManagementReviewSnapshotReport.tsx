"use client";

import React from "react";

type ReportConfig = Record<string, boolean | undefined>;

type Props = {
  snapshot: any;
  config: ReportConfig;
  executiveSummary?: string | null;
  showPrintSignatureBlocks?: boolean;
};

export default function ManagementReviewSnapshotReport({
  snapshot,
  config,
  executiveSummary,
  showPrintSignatureBlocks = false,
}: Props) {
  const ncmr = snapshot?.ncmr || {};
  const capa = snapshot?.capa || {};
  const scar = snapshot?.scar || {};
  const supplierQuality = snapshot?.supplier_quality || {};
  const audits = snapshot?.audits || {};
  const oos = snapshot?.oos_oot || {};
  const complaints = snapshot?.complaints || {};
  const changeControl = snapshot?.change_control || {};
  const documentControl = snapshot?.document_control || {};
  const training = snapshot?.training || {};
  const equipment = snapshot?.equipment || {};
  const queues = snapshot?.queues || {};
  const notifications = Array.isArray(snapshot?.notifications) ? snapshot.notifications : [];
  const managementActions = Array.isArray(snapshot?.management_actions) ? snapshot.management_actions : [];
  const trends = snapshot?.trends || {};
  const printSigning = snapshot?.print_signing || {};
  const printSigners = Array.isArray(printSigning?.signers) ? printSigning.signers : [];

  return (
    <>
      {config.executiveSummary !== false ? (
        <ReportSection title="Executive Summary">
          <p style={narrativeStyle}>
            {executiveSummary || snapshot?.executive?.auto_generated_summary || "No executive summary recorded."}
          </p>
          <MetricGrid
            items={[
              ["Quality Health", snapshot?.executive?.quality_health],
              ["Risk Score", snapshot?.executive?.risk_score],
              ["Total Open Quality Items", snapshot?.executive?.total_open_quality_items],
              ["Total Risk Events", snapshot?.executive?.total_risk_events],
              ["Overall Closure Rate", percent(snapshot?.executive?.overall_closure_rate)],
            ]}
          />
        </ReportSection>
      ) : null}

      {config.ncmrPerformance ? (
        <ReportSection title="NCMR Performance">
          <MetricGrid
            items={[
              ["Total", ncmr.total],
              ["Open", ncmr.open],
              ["Investigation", ncmr.investigation],
              ["Closed", ncmr.closed],
              ["Closure Rate", percent(ncmr.closure_rate)],
              ["Average Close Days", ncmr.avg_close_days],
            ]}
          />
        </ReportSection>
      ) : null}

      {config.capaPerformance ? (
        <ReportSection title="CAPA Performance">
          <MetricGrid
            items={[
              ["Total", capa.total],
              ["Open", capa.open],
              ["Closed", capa.closed],
              ["Overdue", capa.overdue],
              ["Due Soon", capa.due_soon],
              ["Closure Rate", percent(capa.closure_rate)],
              ["Overdue Rate", percent(capa.overdue_rate)],
              ["Average Close Days", capa.avg_close_days],
            ]}
          />
        </ReportSection>
      ) : null}

      {config.capaEffectiveness ? (
        <ReportSection title="CAPA Effectiveness">
          <MetricGrid
            items={[
              ["Effectiveness Rate", percent(capa.effectiveness_rate)],
              ["Effective", capa.effective],
              ["Partially Effective", capa.partially_effective],
              ["Not Effective", capa.not_effective],
              ["Awaiting Effectiveness", capa.awaiting_effectiveness],
              ["Effectiveness Overdue", capa.effectiveness_overdue],
              ["Follow-up Required", capa.followup_required],
            ]}
          />
        </ReportSection>
      ) : null}

      {config.scarPerformance ? (
        <ReportSection title="SCAR Performance">
          <MetricGrid
            items={[
              ["Open", scar.open],
              ["Effective", scar.effective],
              ["Not Effective", scar.not_effective],
              ["Effectiveness Rate", percent(scar.effectiveness_rate)],
              ["Awaiting Effectiveness", scar.awaiting_effectiveness],
            ]}
          />
        </ReportSection>
      ) : null}

      {config.supplierQuality ? (
        <ReportSection title="Supplier Quality">
          <MetricGrid
            items={[
              ["Supplier SCAR Required", supplierQuality.supplier_scar_required],
              ["Open Supplier CAPAs", supplierQuality.open_supplier_capas],
              ["Recurrence Events", supplierQuality.recurrence_events],
            ]}
          />
          <h3 style={subheadingStyle}>Top Suppliers</h3>
          <SimpleTable
            headers={["Supplier", "Event Count"]}
            rows={(Array.isArray(supplierQuality.top_suppliers) ? supplierQuality.top_suppliers : []).map((item: any) => [
              item?.supplier || "N/A",
              item?.count ?? 0,
            ])}
            emptyText="No supplier events were included in this review period."
          />
        </ReportSection>
      ) : null}

      {config.auditPerformance ? (
        <ReportSection title="Audit Performance">
          <MetricGrid
            items={[
              ["Total", audits.total],
              ["Open", audits.open],
              ["Closed", audits.closed],
              ["Closure Rate", percent(audits.closure_rate)],
              ["Overdue", audits.overdue],
              ["Total Findings", audits.findings_total],
              ["Open Findings", audits.findings_open],
              ["Closed Findings", audits.findings_closed],
              ["Findings Closure Rate", percent(audits.findings_closure_rate)],
              ["Major Findings", audits.major_findings],
              ["Critical Findings", audits.critical_findings],
              ["Findings Requiring CAPA", audits.findings_requiring_capa],
            ]}
          />
        </ReportSection>
      ) : null}

      {config.oosPerformance ? (
        <ReportSection title="OOS / OOT Performance">
          <MetricGrid
            items={[
              ["Total", oos.total],
              ["Open", oos.open],
              ["Closed", oos.closed],
              ["Closure Rate", percent(oos.closure_rate)],
              ["Product Impact", oos.product_impact],
              ["NCMR Required", oos.ncmr_required],
              ["Systemic Issues", oos.systemic_issues],
              ["Escalations", oos.escalations],
            ]}
          />
        </ReportSection>
      ) : null}

      {config.complaintPerformance ? (
        <ReportSection title="Complaint Performance">
          <MetricGrid
            items={[
              ["Total", complaints.total],
              ["Open", complaints.open],
              ["Closed", complaints.closed],
              ["Closure Rate", percent(complaints.closure_rate)],
              ["High Risk", complaints.high_risk],
              ["Reportable / Pending", complaints.reportable_or_pending],
              ["CAPA Triggered", complaints.capa_triggered],
              ["NCMR Triggered", complaints.ncmr_triggered],
            ]}
          />
        </ReportSection>
      ) : null}

      {config.changeControlPerformance ? (
        <ReportSection title="Change Control Performance">
          <ConfiguredKpiTable data={changeControl} />
        </ReportSection>
      ) : null}

      {config.documentControlPerformance ? (
        <ReportSection title="Document Control Performance">
          <MetricGrid
            items={[
              ["Total", documentControl.total],
              ["Released", documentControl.released],
              ["Pending Review", documentControl.pending_review],
              ["Overdue Review", documentControl.overdue_review],
              ["Release Rate", percent(documentControl.release_rate)],
            ]}
          />
        </ReportSection>
      ) : null}

      {config.trainingPerformance ? (
        <ReportSection title="Training Performance">
          <MetricGrid
            items={[
              ["Total", training.total],
              ["Completed", training.completed],
              ["Open", training.open],
              ["Overdue", training.overdue],
              ["Completion Rate", percent(training.completion_rate)],
            ]}
          />
        </ReportSection>
      ) : null}

      {config.equipmentPerformance ? (
        <ReportSection title="Equipment Performance">
          <MetricGrid items={[
            ["Calibration Compliance Rate", percent(equipment.calibration_compliance_rate)],
            ["PM Compliance Rate", percent(equipment.pm_compliance_rate)],
            ["Calibration Overdue", equipment.calibration_overdue],
            ["PM Overdue", equipment.pm_overdue],
            ["Out of Service Equipment", equipment.out_of_service],
            ["Equipment-Related Quality Events", equipment.quality_events],
            ["Significant Equipment Exceptions", equipment.significant_exceptions],
          ]} />
          <p style={helperTextStyle}>Due-soon calibration and preventive-maintenance activity is intentionally excluded from Management Review and remains on the operational Equipment dashboard.</p>
        </ReportSection>
      ) : null}

      {config.escalationQueues ? (
        <ReportSection title="Escalation Queues">
          <MetricGrid
            items={[
              ["CAPA Governance Queue", arrayCount(queues.capa_governance)],
              ["SCAR Governance Queue", arrayCount(queues.scar_governance)],
              ["Audit Escalation Queue", arrayCount(queues.audit_escalation)],
            ]}
          />
          <p style={helperTextStyle}>
            Queue counts are included as management-level signals. Underlying workflow records are intentionally excluded from the controlled report.
          </p>
        </ReportSection>
      ) : null}

      {config.executiveNotifications ? (
        <ReportSection title="Executive Notifications">
          <SimpleTable
            headers={["Type", "Management Notification"]}
            rows={notifications.map((item: any) => [item?.type || "Notification", item?.message || "N/A"])}
            emptyText="No executive notifications were included in this review period."
          />
        </ReportSection>
      ) : null}

      {config.managementActions ? (
        <ReportSection title="Management Actions">
          <SimpleTable
            headers={["Action", "Owner", "Due Date", "Priority", "Status"]}
            rows={managementActions.map((item: any) => [
              item?.action_title || item?.title || "Management Action",
              item?.action_owner || item?.owner || item?.assigned_to || "N/A",
              item?.due_date || "N/A",
              item?.priority || "N/A",
              item?.status || "open",
            ])}
            emptyText="No Management Review actions were recorded for this report."
          />
        </ReportSection>
      ) : null}

      {config.trendCharts ? (
        <ReportSection title="Trend Data">
          <TrendTable trends={trends} />
        </ReportSection>
      ) : null}

      {showPrintSignatureBlocks && printSigning?.enabled && printSigners.length > 0 ? (
        <ReportSection title="Print & Sign">
          <p style={helperTextStyle}>
            The following wet-signature blocks were configured when this report snapshot was generated. These wet signatures are separate from electronic QualiSphere approvals and do not change the approval status of the Management Review record.
          </p>
          <PrintSignatureBlocks signers={printSigners} />
        </ReportSection>
      ) : null}
    </>
  );
}

function ReportSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={sectionStyle}>
      <h2 style={headingStyle}>{title}</h2>
      {children}
    </section>
  );
}

function MetricGrid({ items }: { items: Array<[string, any]> }) {
  return (
    <div style={metricGridStyle}>
      {items.map(([label, value]) => (
        <div key={label} style={metricStyle}>
          <div style={metricLabelStyle}>{label}</div>
          <div style={metricValueStyle}>{displayValue(value)}</div>
        </div>
      ))}
    </div>
  );
}

function SimpleTable({
  headers,
  rows,
  emptyText,
}: {
  headers: string[];
  rows: any[][];
  emptyText: string;
}) {
  if (!rows.length) return <p style={helperTextStyle}>{emptyText}</p>;

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={tableStyle}>
        <thead>
          <tr>{headers.map((header) => <th key={header} style={thStyle}>{header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((value, index) => <td key={index} style={tdStyle}>{displayValue(value)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConfiguredKpiTable({ data }: { data: any }) {
  const configured = Array.isArray(data?.configured_kpis) ? data.configured_kpis : [];
  const values = data?.kpi_values || {};

  if (!configured.length) return <p style={helperTextStyle}>No configured Change Control KPIs were included.</p>;

  return (
    <SimpleTable
      headers={["KPI", "Value", "Detail"]}
      rows={configured.map((kpi: any) => {
        const result = values?.[kpi?.kpi_key] || {};
        const distribution = Array.isArray(result?.distribution)
          ? result.distribution.map((item: any) => `${item?.label}: ${item?.count}`).join(", ")
          : "";
        return [
          kpi?.kpi_name || kpi?.kpi_key || "KPI",
          result?.value ?? "N/A",
          result?.subtitle || distribution || "",
        ];
      })}
      emptyText="No configured Change Control KPIs were included."
    />
  );
}

function TrendTable({ trends }: { trends: any }) {
  const series = [
    ["NCMR", trends?.ncmr],
    ["CAPA", trends?.capa],
    ["OOS / OOT", trends?.oos],
    ["Audit", trends?.audit],
    ["Findings", trends?.findings],
  ] as Array<[string, any]>;

  const labels: string[] = [];
  series.forEach(([, data]) => {
    if (!Array.isArray(data)) return;
    data.forEach((item: any) => {
      if (item?.label && !labels.includes(item.label)) labels.push(item.label);
    });
  });

  if (!labels.length) return <p style={helperTextStyle}>No trend data was included for this review period.</p>;

  return (
    <SimpleTable
      headers={["Metric", ...labels]}
      rows={series.map(([name, data]) => {
        const values = new Map((Array.isArray(data) ? data : []).map((item: any) => [item?.label, item?.count ?? 0]));
        return [name, ...labels.map((label) => values.get(label) ?? 0)];
      })}
      emptyText="No trend data was included for this review period."
    />
  );
}

function PrintSignatureBlocks({ signers }: { signers: any[] }) {
  return (
    <div style={{ display: "grid", gap: "22px" }}>
      {signers.map((signer: any, index: number) => (
        <div key={`${signer?.name || "signer"}-${index}`} style={printSignatureBlockStyle}>
          <div><strong>Printed Name:</strong> {signer?.name || "N/A"}</div>
          <div><strong>Role / Title:</strong> {signer?.role || "N/A"}</div>
          <div style={{ marginTop: "8px" }}><strong>Signature Meaning:</strong> {signer?.signature_meaning || "I reviewed this Management Review report."}</div>
          <div style={signatureLineRowStyle}>
            <div style={signatureLineStyle}>Signature</div>
            <div style={dateLineStyle}>Date</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function arrayCount(value: any) {
  return Array.isArray(value) ? value.length : Number(value || 0);
}

function percent(value: any) {
  if (value === null || value === undefined || value === "") return "N/A";
  return `${value}%`;
}

function displayValue(value: any) {
  if (value === null || value === undefined || value === "") return "N/A";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

const printSignatureBlockStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  padding: 18,
  breakInside: "avoid",
};
const signatureLineRowStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24, marginTop: 36 };
const signatureLineStyle: React.CSSProperties = { borderTop: "1px solid #0f172a", paddingTop: 6, fontSize: 12, color: "#475569" };
const dateLineStyle: React.CSSProperties = { borderTop: "1px solid #0f172a", paddingTop: 6, fontSize: 12, color: "#475569" };

const sectionStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #dbe3ee",
  borderRadius: 14,
  padding: 24,
  marginBottom: 20,
};
const headingStyle: React.CSSProperties = { margin: "0 0 18px", fontSize: 28, borderBottom: "1px solid #dbe3ee", paddingBottom: 12 };
const subheadingStyle: React.CSSProperties = { margin: "22px 0 10px", fontSize: 18 };
const narrativeStyle: React.CSSProperties = { whiteSpace: "pre-wrap", lineHeight: 1.6, marginTop: 0 };
const helperTextStyle: React.CSSProperties = { color: "#475569", lineHeight: 1.5 };
const metricGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 };
const metricStyle: React.CSSProperties = { border: "1px solid #dbe3ee", borderRadius: 10, padding: 14, background: "#f8fafc" };
const metricLabelStyle: React.CSSProperties = { color: "#64748b", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em" };
const metricValueStyle: React.CSSProperties = { fontSize: 20, fontWeight: 700, marginTop: 4 };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse" };
const thStyle: React.CSSProperties = { textAlign: "left", borderBottom: "1px solid #cbd5e1", padding: "10px 8px", background: "#f8fafc" };
const tdStyle: React.CSSProperties = { borderBottom: "1px solid #e2e8f0", padding: "10px 8px", verticalAlign: "top" };
