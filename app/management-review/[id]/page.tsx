"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

export default function SavedManagementReviewReportPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [report, setReport] = useState<any>(null);

  useEffect(() => {
    const fetchReport = async () => {
      const { data, error } = await supabase
        .from("management_review_reports")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) alert(error.message);
      setReport(data);
    };

    if (id) fetchReport();
  }, [id]);

  if (!report) {
    return <main style={{ padding: "20px" }}>Loading saved report...</main>;
  }

  const data = report.report_data || {};
  const charts = data.charts || {};

  const ncmrTrend = charts.ncmr_trend || [];
  const capaTrend = charts.capa_trend || [];
  const auditFindingTrend = charts.audit_finding_trend || [];
  const oosTrend = charts.oos_oot_trend || [];

  const findings = charts.findings_by_severity || {};
  const effectiveness = charts.capa_effectiveness || {};
  const topSuppliers = charts.top_suppliers || [];

  const oosMetrics = data.oos_oot_metrics || {};

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
            maxWidth: "500px",
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

  const maxNcmrCreatedClosed = Math.max(
    ...ncmrTrend.map((x: any) => x.created || 0),
    ...ncmrTrend.map((x: any) => x.closed || 0),
    1
  );

  const maxCapaCreatedClosed = Math.max(
    ...capaTrend.map((x: any) => x.created || 0),
    ...capaTrend.map((x: any) => x.closed || 0),
    1
  );

  const maxOosCreatedClosed = Math.max(
    ...oosTrend.map((x: any) => x.created || x.count || 0),
    ...oosTrend.map((x: any) => x.closed || 0),
    1
  );

  const maxRecurring = Math.max(...ncmrTrend.map((x: any) => x.recurring || 0), 1);
  const maxOverdue = Math.max(...capaTrend.map((x: any) => x.overdue || 0), 1);
  const maxAuditFindings = Math.max(
    ...auditFindingTrend.map((x: any) => x.findings || 0),
    1
  );

  const maxFinding = Math.max(
    findings.minor || 0,
    findings.major || 0,
    findings.critical || 0,
    1
  );

  const maxEffectiveness = Math.max(
    effectiveness.effective || 0,
    effectiveness.partial || 0,
    effectiveness.notEffective || 0,
    1
  );

  const maxSupplier = Math.max(...topSuppliers.map((x: any) => x.count || 0), 1);

  const maxOosRisk = Math.max(
    oosMetrics.total || 0,
    oosMetrics.product_impact || 0,
    oosMetrics.systemic_issues || 0,
    oosMetrics.ncmr_linked || 0,
    oosMetrics.escalation_required || 0,
    1
  );

  return (
    <main style={{ padding: "25px", fontFamily: "Arial, sans-serif" }}>
      <button onClick={() => window.print()} className="no-print">
        Print / Save as PDF
      </button>

      <h1>{report.report_title}</h1>
      <p><strong>Report Period:</strong> {report.report_period}</p>
      <p><strong>Report Date:</strong> {report.report_date}</p>
      <p><strong>Created By:</strong> {report.created_by}</p>
      <p><strong>Created At:</strong> {report.created_at}</p>

      <section style={sectionStyle}>
        <h2>Executive Summary</h2>
        <p><strong>Total NCMRs:</strong> {data.executive_summary?.total_ncmrs}</p>
        <p><strong>Open NCMRs:</strong> {data.executive_summary?.open_ncmrs}</p>
        <p><strong>Closed NCMRs:</strong> {data.executive_summary?.closed_ncmrs}</p>
        <p><strong>NCMR Closure Rate:</strong> {data.executive_summary?.ncmr_closure_rate}%</p>

        <p><strong>Total CAPAs:</strong> {data.executive_summary?.total_capas}</p>
        <p><strong>Open CAPAs:</strong> {data.executive_summary?.open_capas}</p>
        <p><strong>Closed CAPAs:</strong> {data.executive_summary?.closed_capas}</p>
        <p><strong>CAPA Closure Rate:</strong> {data.executive_summary?.capa_closure_rate}%</p>
        <p><strong>Overdue CAPAs:</strong> {data.executive_summary?.overdue_capas}</p>
      </section>

      <section style={sectionStyle}>
        <h2>OOS / OOT / Environmental Monitoring Summary</h2>
        <p><strong>Total OOS/OOT/EM Investigations:</strong> {oosMetrics.total ?? "N/A"}</p>
        <p><strong>Open OOS/OOT/EM Investigations:</strong> {oosMetrics.open ?? "N/A"}</p>
        <p><strong>Closed OOS/OOT/EM Investigations:</strong> {oosMetrics.closed ?? "N/A"}</p>
        <p><strong>Product Impact Cases:</strong> {oosMetrics.product_impact ?? "N/A"}</p>
        <p><strong>NCMR Linked / Required:</strong> {oosMetrics.ncmr_linked ?? "N/A"}</p>
        <p><strong>Systemic Issues:</strong> {oosMetrics.systemic_issues ?? "N/A"}</p>
        <p><strong>Escalation Required:</strong> {oosMetrics.escalation_required ?? "N/A"}</p>

        <h3>OOS/OOT Impact Summary</h3>
        <Bar label="Total OOS/OOT/EM" value={oosMetrics.total || 0} max={maxOosRisk} />
        <Bar label="Product Impact" value={oosMetrics.product_impact || 0} max={maxOosRisk} />
        <Bar label="NCMR Required" value={oosMetrics.ncmr_linked || 0} max={maxOosRisk} />
        <Bar label="Systemic Issue" value={oosMetrics.systemic_issues || 0} max={maxOosRisk} />
        <Bar label="Escalation Required" value={oosMetrics.escalation_required || 0} max={maxOosRisk} />
      </section>

      <section style={sectionStyle}>
        <h2>Trend Over Time</h2>

        <h3>Monthly NCMR Created vs Closed</h3>
        {ncmrTrend.length === 0 ? (
          <p>No NCMR trend data saved.</p>
        ) : (
          ncmrTrend.map((item: any) => (
            <div key={`ncmr-${item.key}`} style={{ marginBottom: "12px" }}>
              <strong>{item.label}</strong>
              <Bar label="Created" value={item.created || 0} max={maxNcmrCreatedClosed} />
              <Bar label="Closed" value={item.closed || 0} max={maxNcmrCreatedClosed} />
            </div>
          ))
        )}

        <h3>Monthly CAPA Created vs Closed</h3>
        {capaTrend.length === 0 ? (
          <p>No CAPA trend data saved.</p>
        ) : (
          capaTrend.map((item: any) => (
            <div key={`capa-${item.key}`} style={{ marginBottom: "12px" }}>
              <strong>{item.label}</strong>
              <Bar label="Created" value={item.created || 0} max={maxCapaCreatedClosed} />
              <Bar label="Closed" value={item.closed || 0} max={maxCapaCreatedClosed} />
            </div>
          ))
        )}

        <h3>Monthly OOS/OOT/EM Created vs Closed</h3>
        {oosTrend.length === 0 ? (
          <p>No OOS/OOT/EM trend data saved.</p>
        ) : (
          oosTrend.map((item: any) => (
            <div key={`oos-${item.key || item.label}`} style={{ marginBottom: "12px" }}>
              <strong>{item.label}</strong>
              <Bar label="Created" value={item.created || item.count || 0} max={maxOosCreatedClosed} />
              <Bar label="Closed" value={item.closed || 0} max={maxOosCreatedClosed} />
            </div>
          ))
        )}

        <h3>NCMR Backlog Trend</h3>
        {ncmrTrend.length === 0 ? (
          <p>No backlog data saved.</p>
        ) : (
          ncmrTrend.map((item: any, index: number) => {
            const backlog = ncmrTrend
              .slice(0, index + 1)
              .reduce(
                (acc: number, m: any) =>
                  acc + (m.created || 0) - (m.closed || 0),
                0
              );

            const maxBacklog = Math.max(
              ...ncmrTrend.map((_: any, i: number) =>
                ncmrTrend
                  .slice(0, i + 1)
                  .reduce(
                    (acc: number, m: any) =>
                      acc + (m.created || 0) - (m.closed || 0),
                    0
                  )
              ),
              1
            );

            return (
              <Bar
                key={`backlog-${item.key}`}
                label={`${item.label} Backlog`}
                value={backlog}
                max={maxBacklog}
              />
            );
          })
        )}

        <h3>Monthly NCMR Recurrence</h3>
        {ncmrTrend.map((item: any) => (
          <Bar
            key={`recurring-${item.key}`}
            label={`${item.label} Recurring NCMRs`}
            value={item.recurring || 0}
            max={maxRecurring}
          />
        ))}

        <h3>Monthly CAPA Overdue</h3>
        {capaTrend.map((item: any) => (
          <Bar
            key={`overdue-${item.key}`}
            label={`${item.label} Overdue CAPAs`}
            value={item.overdue || 0}
            max={maxOverdue}
          />
        ))}

        <h3>Monthly Audit Findings</h3>
        {auditFindingTrend.length === 0 ? (
          <p>No audit finding trend data saved.</p>
        ) : (
          auditFindingTrend.map((item: any) => (
            <Bar
              key={`audit-${item.key}`}
              label={`${item.label} Findings`}
              value={item.findings || 0}
              max={maxAuditFindings}
            />
          ))
        )}
      </section>

      <section style={sectionStyle}>
        <h2>Executive Charts</h2>

        <h3>Audit Findings by Severity</h3>
        <Bar label="Minor" value={findings.minor || 0} max={maxFinding} />
        <Bar label="Major" value={findings.major || 0} max={maxFinding} />
        <Bar label="Critical" value={findings.critical || 0} max={maxFinding} />

        <h3>CAPA Effectiveness</h3>
        <Bar label="Effective" value={effectiveness.effective || 0} max={maxEffectiveness} />
        <Bar label="Partially Effective" value={effectiveness.partial || 0} max={maxEffectiveness} />
        <Bar label="Not Effective" value={effectiveness.notEffective || 0} max={maxEffectiveness} />

        <h3>Top Suppliers by NCMR Count</h3>
        {topSuppliers.length === 0 ? (
          <p>No supplier data saved.</p>
        ) : (
          topSuppliers.map((item: any) => (
            <Bar
              key={item.supplier}
              label={item.supplier}
              value={item.count || 0}
              max={maxSupplier}
            />
          ))
        )}
      </section>

      <section style={sectionStyle}>
        <h2>Risk & Escalation</h2>
        <p><strong>Critical NCMRs:</strong> {data.risk_escalation?.critical_ncmrs}</p>
        <p><strong>Major NCMRs:</strong> {data.risk_escalation?.major_ncmrs}</p>
        <p><strong>Recurring NCMRs:</strong> {data.risk_escalation?.recurring_ncmrs}</p>
        <p><strong>Supplier CAPA Required:</strong> {data.risk_escalation?.supplier_capa_required}</p>
      </section>

      <section style={sectionStyle}>
        <h2>CAPA Effectiveness</h2>
        <p><strong>Effective:</strong> {data.capa_effectiveness?.effective}</p>
        <p><strong>Partially Effective:</strong> {data.capa_effectiveness?.partial}</p>
        <p><strong>Not Effective:</strong> {data.capa_effectiveness?.notEffective}</p>
      </section>

      <section style={sectionStyle}>
        <h2>Supplier Quality</h2>
        <p><strong>Total SCARs:</strong> {data.supplier_quality?.total_scars}</p>

        <h3>Top Suppliers</h3>
        {data.supplier_quality?.top_suppliers?.length ? (
          <ul>
            {data.supplier_quality.top_suppliers.map((item: any) => (
              <li key={item.supplier}>
                {item.supplier}: {item.count} NCMR(s)
              </li>
            ))}
          </ul>
        ) : (
          <p>No supplier data.</p>
        )}
      </section>

      <section style={sectionStyle}>
        <h2>Audit Metrics</h2>
        <p><strong>Total Audits:</strong> {data.audit_metrics?.total_audits}</p>
        <p><strong>Open Audits:</strong> {data.audit_metrics?.open_audits}</p>
        <p><strong>Closed Audits:</strong> {data.audit_metrics?.closed_audits}</p>
        <p><strong>Overdue Audits:</strong> {data.audit_metrics?.overdue_audits}</p>

        <p><strong>Total Findings:</strong> {data.audit_metrics?.total_findings}</p>
        <p><strong>Open Findings:</strong> {data.audit_metrics?.open_findings}</p>
        <p><strong>Closed Findings:</strong> {data.audit_metrics?.closed_findings}</p>
        <p><strong>Minor Findings:</strong> {data.audit_metrics?.minor_findings}</p>
        <p><strong>Major Findings:</strong> {data.audit_metrics?.major_findings}</p>
        <p><strong>Critical Findings:</strong> {data.audit_metrics?.critical_findings}</p>
        <p><strong>Findings Requiring CAPA:</strong> {data.audit_metrics?.findings_requiring_capa}</p>
        <p><strong>% Findings Requiring CAPA:</strong> {data.audit_metrics?.percent_findings_requiring_capa}%</p>
      </section>

      <section style={sectionStyle}>
        <h2>Electronic Signature</h2>
        <p><strong>Signed By:</strong> {report.signed_by || "N/A"}</p>
        <p><strong>Signed At:</strong> {report.signed_at || "N/A"}</p>
        <p><strong>Signature Email Entered:</strong> {report.signature_email_entered || "N/A"}</p>
        <p><strong>Signature Method:</strong> {report.signature_method || "email_confirm"}</p>
        <p><strong>Re-authenticated:</strong> {report.auth_reverified ? "Yes" : "No"}</p>
        <p><strong>Signature Meaning:</strong> {report.signature_meaning || "N/A"}</p>
      </section>

      <div className="no-print">
        <a href="/management-review">Back to Management Review</a>
      </div>

      <style jsx global>{`
        @media print {
          .no-print {
            display: none;
          }

          body {
            color: black;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
    </main>
  );
}

const sectionStyle: React.CSSProperties = {
  border: "1px solid #ccc",
  padding: "15px",
  marginBottom: "20px",
  borderRadius: "8px",
};
