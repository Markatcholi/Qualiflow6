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
      <div style={{ marginBottom: "12px" }}>
        <div style={{ fontSize: "14px", marginBottom: "4px" }}>
          {label}: {value}
        </div>

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

  const ncmrTrend = charts.ncmr_trend || [];
  const capaTrend = charts.capa_trend || [];
  const findings = charts.findings_by_severity || {};
  const effectiveness = charts.capa_effectiveness || {};
  const topSuppliers = charts.top_suppliers || [];

  const maxTrend = Math.max(
    ...ncmrTrend.map((x: any) => x.count || 0),
    ...capaTrend.map((x: any) => x.count || 0),
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

  const maxSupplier = Math.max(
    ...topSuppliers.map((x: any) => x.count || 0),
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
        <h2>Executive Charts</h2>

        <h3>Closure Status</h3>
        <Bar
          label="Closed NCMRs"
          value={data.executive_summary?.closed_ncmrs || 0}
          max={Math.max(data.executive_summary?.total_ncmrs || 0, 1)}
        />
        <Bar
          label="Open NCMRs"
          value={data.executive_summary?.open_ncmrs || 0}
          max={Math.max(data.executive_summary?.total_ncmrs || 0, 1)}
        />
        <Bar
          label="Closed CAPAs"
          value={data.executive_summary?.closed_capas || 0}
          max={Math.max(data.executive_summary?.total_capas || 0, 1)}
        />
        <Bar
          label="Open CAPAs"
          value={data.executive_summary?.open_capas || 0}
          max={Math.max(data.executive_summary?.total_capas || 0, 1)}
        />

        <h3>Monthly NCMR / CAPA Trend</h3>
        {ncmrTrend.length === 0 ? (
          <p>No trend data saved.</p>
        ) : (
          ncmrTrend.map((item: any, index: number) => (
            <div key={item.key || index} style={{ marginBottom: "12px" }}>
              <strong>{item.label}</strong>
              <Bar label="NCMR" value={item.count || 0} max={maxTrend} />
              <Bar
                label="CAPA"
                value={capaTrend[index]?.count || 0}
                max={maxTrend}
              />
            </div>
          ))
        )}

        <h3>Audit Findings by Severity</h3>
        <Bar label="Minor" value={findings.minor || 0} max={maxFinding} />
        <Bar label="Major" value={findings.major || 0} max={maxFinding} />
        <Bar label="Critical" value={findings.critical || 0} max={maxFinding} />

        <h3>CAPA Effectiveness</h3>
        <Bar
          label="Effective"
          value={effectiveness.effective || 0}
          max={maxEffectiveness}
        />
        <Bar
          label="Partially Effective"
          value={effectiveness.partial || 0}
          max={maxEffectiveness}
        />
        <Bar
          label="Not Effective"
          value={effectiveness.notEffective || 0}
          max={maxEffectiveness}
        />

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
