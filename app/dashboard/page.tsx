"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type MonthTrend = {
  key: string;
  label: string;
  created: number;
  closed: number;
  closureRate: number;
  recurring: number;
  overdue: number;
  findings: number;
};

export default function ManagementReviewPage() {
  const [ncmrs, setNcmrs] = useState<any[]>([]);
  const [capas, setCapas] = useState<any[]>([]);
  const [audits, setAudits] = useState<any[]>([]);
  const [auditFindings, setAuditFindings] = useState<any[]>([]);
  const [oosRecords, setOosRecords] = useState<any[]>([]);
  const [savedReports, setSavedReports] = useState<any[]>([]);

  const [reportTitle, setReportTitle] = useState("Management Review Report");
  const [reportPeriod, setReportPeriod] = useState("");

  const fetchData = async () => {
    const ncmrRes = await supabase.from("ncmrs").select("*");
    const capaRes = await supabase.from("capas").select("*");
    const auditRes = await supabase.from("audits").select("*");
    const findingsRes = await supabase.from("audit_findings").select("*");
    const oosRes = await supabase.from("oos_oot_investigations").select("*");
    const reportsRes = await supabase
      .from("management_review_reports")
      .select("*")
      .order("created_at", { ascending: false });

    if (ncmrRes.error) alert(ncmrRes.error.message);
    if (capaRes.error) alert(capaRes.error.message);
    if (auditRes.error) alert(auditRes.error.message);
    if (findingsRes.error) alert(findingsRes.error.message);
    if (oosRes.error) alert(oosRes.error.message);
    if (reportsRes.error) alert(reportsRes.error.message);

    setNcmrs(ncmrRes.data || []);
    setCapas(capaRes.data || []);
    setAudits(auditRes.data || []);
    setAuditFindings(findingsRes.data || []);
    setOosRecords(oosRes.data || []);
    setSavedReports(reportsRes.data || []);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const todayStr = new Date().toISOString().split("T")[0];

  const closedNcmrs = ncmrs.filter((x) => x.status === "closed");
  const openNcmrs = ncmrs.filter((x) => x.status !== "closed");

  const closedCapas = capas.filter((x) => x.status === "closed");
  const openCapas = capas.filter((x) => x.status !== "closed");

  const closedOos = oosRecords.filter((x) => x.status === "closed");
  const openOos = oosRecords.filter((x) => x.status !== "closed");

  const overdueCapas = capas.filter(
    (x) => x.status !== "closed" && x.due_date && x.due_date < todayStr
  );

  const scars = capas.filter((x) => x.capa_type === "scar");

  const effectiveness = {
    effective: capas.filter((x) => x.effectiveness_rating === "effective").length,
    partial: capas.filter((x) => x.effectiveness_rating === "partially_effective").length,
    notEffective: capas.filter((x) => x.effectiveness_rating === "not_effective").length,
  };

  const totalAudits = audits.length;
  const openAudits = audits.filter((a) => a.status !== "closed").length;
  const closedAudits = audits.filter((a) => a.status === "closed").length;
  const overdueAudits = audits.filter(
    (a) => a.status !== "closed" && a.audit_date && a.audit_date < todayStr
  ).length;

  const totalFindings = auditFindings.length;
  const openFindings = auditFindings.filter((f) => f.finding_status !== "closed").length;
  const closedFindings = auditFindings.filter((f) => f.finding_status === "closed").length;
  const minorFindings = auditFindings.filter((f) => f.finding_severity === "minor").length;
  const majorFindings = auditFindings.filter((f) => f.finding_severity === "major").length;
  const criticalFindings = auditFindings.filter((f) => f.finding_severity === "critical").length;
  const capaFindings = auditFindings.filter((f) => f.capa_required).length;

  const capaFindingsPercent =
    totalFindings > 0 ? ((capaFindings / totalFindings) * 100).toFixed(1) : "0.0";

  const supplierMap = new Map<string, number>();
  ncmrs.forEach((n) => {
    const supplier = n.supplier_name || "";
    if (!supplier) return;
    supplierMap.set(supplier, (supplierMap.get(supplier) || 0) + 1);
  });

  const topSuppliers = Array.from(supplierMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const closureRate = (closed: number, total: number) =>
    total > 0 ? ((closed / total) * 100).toFixed(1) : "0.0";

  const getLast6Months = () => {
    const months: MonthTrend[] = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

      months.push({
        key,
        label: d.toLocaleString("en-US", { month: "short", year: "2-digit" }),
        created: 0,
        closed: 0,
        closureRate: 0,
        recurring: 0,
        overdue: 0,
        findings: 0,
      });
    }

    return months;
  };

  const monthKey = (dateString: string) => {
    const d = new Date(dateString);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };

  const buildRecordTrend = (items: any[], type: "ncmr" | "capa" | "oos") => {
    const months = getLast6Months();

    months.forEach((month) => {
      const createdThisMonth = items.filter(
        (item) => item.created_at && monthKey(item.created_at) === month.key
      );

      const closedThisMonth = items.filter(
        (item) => item.closed_at && monthKey(item.closed_at) === month.key
      );

      month.created = createdThisMonth.length;
      month.closed = closedThisMonth.length;
      month.closureRate =
        createdThisMonth.length > 0
          ? Number(((closedThisMonth.length / createdThisMonth.length) * 100).toFixed(1))
          : 0;

      if (type === "ncmr") {
        month.recurring = createdThisMonth.filter((item) => item.recurring_issue).length;
      }

      if (type === "capa") {
        month.overdue = createdThisMonth.filter(
          (item) => item.status !== "closed" && item.due_date && item.due_date < todayStr
        ).length;
      }

      if (type === "oos") {
        month.recurring = createdThisMonth.filter((item) => item.systemic_issue).length;
        month.overdue = createdThisMonth.filter((item) => item.escalation_required).length;
      }
    });

    return months;
  };

  const buildAuditFindingTrend = () => {
    const months = getLast6Months();

    months.forEach((month) => {
      month.findings = auditFindings.filter(
        (finding) => finding.created_at && monthKey(finding.created_at) === month.key
      ).length;
    });

    return months;
  };

  const ncmrTrend = buildRecordTrend(ncmrs, "ncmr");
  const capaTrend = buildRecordTrend(capas, "capa");
  const oosTrend = buildRecordTrend(oosRecords, "oos");
  const auditFindingTrend = buildAuditFindingTrend();

  const oosMetrics = {
    total: oosRecords.length,
    open: openOos.length,
    closed: closedOos.length,
    closure_rate: closureRate(closedOos.length, oosRecords.length),
    product_impact: oosRecords.filter((x) => x.product_impact).length,
    ncmr_required: oosRecords.filter((x) => x.ncmr_required).length,
    systemic_issues: oosRecords.filter((x) => x.systemic_issue).length,
    escalation_required: oosRecords.filter((x) => x.escalation_required).length,
  };

  const buildReportData = () => {
    return {
      generated_at: new Date().toISOString(),
      executive_summary: {
        total_ncmrs: ncmrs.length,
        open_ncmrs: openNcmrs.length,
        closed_ncmrs: closedNcmrs.length,
        ncmr_closure_rate: closureRate(closedNcmrs.length, ncmrs.length),
        total_capas: capas.length,
        open_capas: openCapas.length,
        closed_capas: closedCapas.length,
        capa_closure_rate: closureRate(closedCapas.length, capas.length),
        overdue_capas: overdueCapas.length,
      },
      charts: {
        ncmr_trend: ncmrTrend,
        capa_trend: capaTrend,
        oos_trend: oosTrend,
        audit_finding_trend: auditFindingTrend,
        findings_by_severity: {
          minor: minorFindings,
          major: majorFindings,
          critical: criticalFindings,
        },
        capa_effectiveness: effectiveness,
        top_suppliers: topSuppliers.map(([supplier, count]) => ({ supplier, count })),
      },
      trend_over_time: {
        ncmr_monthly_recurrence: ncmrTrend.map((m) => ({ label: m.label, recurring: m.recurring })),
        capa_monthly_overdue: capaTrend.map((m) => ({ label: m.label, overdue: m.overdue })),
        audit_monthly_findings: auditFindingTrend.map((m) => ({ label: m.label, findings: m.findings })),
        oos_monthly_created_closed: oosTrend.map((m) => ({ label: m.label, created: m.created, closed: m.closed })),
        oos_monthly_systemic_issues: oosTrend.map((m) => ({ label: m.label, systemic_issues: m.recurring })),
        oos_monthly_escalations: oosTrend.map((m) => ({ label: m.label, escalations: m.overdue })),
      },
      risk_escalation: {
        critical_ncmrs: ncmrs.filter((x) => x.severity === "critical").length,
        major_ncmrs: ncmrs.filter((x) => x.severity === "major").length,
        recurring_ncmrs: ncmrs.filter((x) => x.recurring_issue).length,
        supplier_capa_required: ncmrs.filter((x) => x.supplier_capa_required).length,
      },
      capa_effectiveness: effectiveness,
      supplier_quality: {
        total_scars: scars.length,
        top_suppliers: topSuppliers.map(([supplier, count]) => ({ supplier, count })),
      },
      audit_metrics: {
        total_audits: totalAudits,
        open_audits: openAudits,
        closed_audits: closedAudits,
        overdue_audits: overdueAudits,
        total_findings: totalFindings,
        open_findings: openFindings,
        closed_findings: closedFindings,
        minor_findings: minorFindings,
        major_findings: majorFindings,
        critical_findings: criticalFindings,
        findings_requiring_capa: capaFindings,
        percent_findings_requiring_capa: capaFindingsPercent,
      },
      oos_oot_metrics: oosMetrics,
    };
  };

  const saveReport = async () => {
    if (!reportTitle) {
      alert("Report title is required.");
      return;
    }

    if (!reportPeriod) {
      alert("Report period is required.");
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const email = userData?.user?.email || "unknown";

    if (!email || email === "unknown") {
      alert("You must be logged in to sign this report.");
      return;
    }

    const confirmed = window.confirm(
      "Electronic Signature:\n\nI confirm this Management Review report snapshot is accurate at the time of generation.\n\nBy clicking OK, my active login session will be used as my electronic signature."
    );

    if (!confirmed) return;

    const now = new Date().toISOString();

    const signatureMeaning =
      "I confirm this Management Review report snapshot is accurate at the time of generation.";

    const { error } = await supabase.from("management_review_reports").insert({
      report_title: reportTitle,
      report_period: reportPeriod,
      report_data: buildReportData(),
      created_by: email,
      signed_by: email,
      signed_at: now,
      signature_email_entered: email,
      signature_meaning: signatureMeaning,
      signature_method: "session_confirm",
      auth_reverified: false,
    });

    if (error) {
      alert(error.message);
      return;
    }

    alert("Management Review report saved with session-based electronic signature.");
    fetchData();
  };

  const Bar = ({ label, value, max }: { label: string; value: number; max: number }) => {
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

  const maxRecurring = Math.max(...ncmrTrend.map((x) => x.recurring), 1);
  const maxOverdue = Math.max(...capaTrend.map((x) => x.overdue), 1);
  const maxAuditFindings = Math.max(...auditFindingTrend.map((x) => x.findings), 1);
  const maxOosCreatedClosed = Math.max(...oosTrend.map((x) => x.created), ...oosTrend.map((x) => x.closed), 1);
  const maxOosSystemic = Math.max(...oosTrend.map((x) => x.recurring), 1);
  const maxOosEscalation = Math.max(...oosTrend.map((x) => x.overdue), 1);

  const maxFinding = Math.max(minorFindings, majorFindings, criticalFindings, 1);
  const maxEffectiveness = Math.max(effectiveness.effective, effectiveness.partial, effectiveness.notEffective, 1);
  const maxSupplier = Math.max(...topSuppliers.map((x) => x[1]), 1);

  return (
    <main style={{ padding: "25px", fontFamily: "Arial, sans-serif" }}>
      <button onClick={() => window.print()} className="no-print">
        Print / Save as PDF
      </button>

      <h1>Management Review Dashboard</h1>
      <p><strong>Date:</strong> {new Date().toLocaleDateString()}</p>

      <section style={sectionStyle} className="no-print">
        <h2>Generate Saved Management Review Report</h2>

        <div style={{ marginBottom: "10px" }}>
          <label>Report Title</label><br />
          <input value={reportTitle} onChange={(e) => setReportTitle(e.target.value)} style={{ padding: "8px", width: "100%", maxWidth: "400px" }} />
        </div>

        <div style={{ marginBottom: "10px" }}>
          <label>Report Period</label><br />
          <input value={reportPeriod} onChange={(e) => setReportPeriod(e.target.value)} placeholder="Example: Q1 2026 or January 2026" style={{ padding: "8px", width: "100%", maxWidth: "400px" }} />
        </div>

        <button onClick={saveReport}>Generate & Save Report Snapshot</button>
      </section>

      <section style={sectionStyle}>
        <h2>Executive Summary</h2>
        <p><strong>Total NCMRs:</strong> {ncmrs.length}</p>
        <p><strong>Open NCMRs:</strong> {openNcmrs.length}</p>
        <p><strong>Closed NCMRs:</strong> {closedNcmrs.length}</p>
        <p><strong>NCMR Closure Rate:</strong> {closureRate(closedNcmrs.length, ncmrs.length)}%</p>
        <p><strong>Total CAPAs:</strong> {capas.length}</p>
        <p><strong>Open CAPAs:</strong> {openCapas.length}</p>
        <p><strong>Closed CAPAs:</strong> {closedCapas.length}</p>
        <p><strong>CAPA Closure Rate:</strong> {closureRate(closedCapas.length, capas.length)}%</p>
        <p><strong>Overdue CAPAs:</strong> {overdueCapas.length}</p>
        <p><strong>Total OOS/OOT Investigations:</strong> {oosMetrics.total}</p>
        <p><strong>Open OOS/OOT Investigations:</strong> {oosMetrics.open}</p>
        <p><strong>Closed OOS/OOT Investigations:</strong> {oosMetrics.closed}</p>
        <p><strong>OOS/OOT Closure Rate:</strong> {oosMetrics.closure_rate}%</p>
      </section>

      <section style={sectionStyle}>
        <h2>Trend Over Time</h2>

        <h3>Monthly NCMR Created vs Closed</h3>
        {ncmrTrend.map((item) => (
          <div key={item.key} style={{ marginBottom: "12px" }}>
            <strong>{item.label}</strong>
            <Bar label="Created" value={item.created} max={Math.max(...ncmrTrend.map((x) => x.created), 1)} />
            <Bar label="Closed" value={item.closed} max={Math.max(...ncmrTrend.map((x) => x.created), 1)} />
          </div>
        ))}

        <h3>Monthly CAPA Created vs Closed</h3>
        {capaTrend.map((item) => (
          <div key={item.key} style={{ marginBottom: "12px" }}>
            <strong>{item.label}</strong>
            <Bar label="Created" value={item.created} max={Math.max(...capaTrend.map((x) => x.created), 1)} />
            <Bar label="Closed" value={item.closed} max={Math.max(...capaTrend.map((x) => x.created), 1)} />
          </div>
        ))}

        <h3>Monthly OOS/OOT Created vs Closed</h3>
        {oosTrend.map((item) => (
          <div key={item.key} style={{ marginBottom: "12px" }}>
            <strong>{item.label}</strong>
            <Bar label="Created" value={item.created} max={maxOosCreatedClosed} />
            <Bar label="Closed" value={item.closed} max={maxOosCreatedClosed} />
          </div>
        ))}

        <h3>Monthly NCMR Recurrence</h3>
        {ncmrTrend.map((item) => (
          <Bar key={`ncmr-rec-${item.key}`} label={`${item.label} Recurring NCMRs`} value={item.recurring} max={maxRecurring} />
        ))}

        <h3>Monthly CAPA Overdue</h3>
        {capaTrend.map((item) => (
          <Bar key={`capa-overdue-${item.key}`} label={`${item.label} Overdue CAPAs`} value={item.overdue} max={maxOverdue} />
        ))}

        <h3>Monthly OOS/OOT Systemic Issues</h3>
        {oosTrend.map((item) => (
          <Bar key={`oos-systemic-${item.key}`} label={`${item.label} Systemic Issues`} value={item.recurring} max={maxOosSystemic} />
        ))}

        <h3>Monthly OOS/OOT Escalations</h3>
        {oosTrend.map((item) => (
          <Bar key={`oos-escalation-${item.key}`} label={`${item.label} Escalations`} value={item.overdue} max={maxOosEscalation} />
        ))}

        <h3>NCMR Backlog Trend</h3>
        {ncmrTrend.map((item, index) => {
          const backlog = ncmrTrend.slice(0, index + 1).reduce((acc, m) => acc + m.created - m.closed, 0);
          return <Bar key={item.key} label={`${item.label} Backlog`} value={backlog} max={Math.max(...ncmrTrend.map((x) => x.created), 1)} />;
        })}

        <h3>Monthly Audit Findings</h3>
        {auditFindingTrend.map((item) => (
          <Bar key={`audit-find-${item.key}`} label={`${item.label} Findings`} value={item.findings} max={maxAuditFindings} />
        ))}
      </section>

      <section style={sectionStyle}>
        <h2>Executive Charts</h2>
        <h3>Audit Findings by Severity</h3>
        <Bar label="Minor" value={minorFindings} max={maxFinding} />
        <Bar label="Major" value={majorFindings} max={maxFinding} />
        <Bar label="Critical" value={criticalFindings} max={maxFinding} />

        <h3>CAPA Effectiveness</h3>
        <Bar label="Effective" value={effectiveness.effective} max={maxEffectiveness} />
        <Bar label="Partially Effective" value={effectiveness.partial} max={maxEffectiveness} />
        <Bar label="Not Effective" value={effectiveness.notEffective} max={maxEffectiveness} />

        <h3>Top Suppliers by NCMR Count</h3>
        {topSuppliers.length === 0 ? <p>No supplier data.</p> : topSuppliers.map(([supplier, count]) => <Bar key={supplier} label={supplier} value={count} max={maxSupplier} />)}
      </section>

      <section style={sectionStyle}>
        <h2>Risk & Escalation</h2>
        <p><strong>Critical NCMRs:</strong> {ncmrs.filter((x) => x.severity === "critical").length}</p>
        <p><strong>Major NCMRs:</strong> {ncmrs.filter((x) => x.severity === "major").length}</p>
        <p><strong>Recurring NCMRs:</strong> {ncmrs.filter((x) => x.recurring_issue).length}</p>
        <p><strong>Supplier CAPA Required:</strong> {ncmrs.filter((x) => x.supplier_capa_required).length}</p>
        <p><strong>OOS/OOT Product Impact Cases:</strong> {oosMetrics.product_impact}</p>
        <p><strong>OOS/OOT NCMR Required:</strong> {oosMetrics.ncmr_required}</p>
        <p><strong>OOS/OOT Systemic Issues:</strong> {oosMetrics.systemic_issues}</p>
        <p><strong>OOS/OOT Escalation Required:</strong> {oosMetrics.escalation_required}</p>
      </section>

      <section style={sectionStyle}>
        <h2>CAPA Effectiveness</h2>
        <p><strong>Effective:</strong> {effectiveness.effective}</p>
        <p><strong>Partially Effective:</strong> {effectiveness.partial}</p>
        <p><strong>Not Effective:</strong> {effectiveness.notEffective}</p>
      </section>

      <section style={sectionStyle}>
        <h2>Supplier Quality</h2>
        <p><strong>Total SCARs:</strong> {scars.length}</p>
      </section>

      <section style={sectionStyle}>
        <h2>Audit Metrics</h2>
        <p><strong>Total Audits:</strong> {totalAudits}</p>
        <p><strong>Open Audits:</strong> {openAudits}</p>
        <p><strong>Closed Audits:</strong> {closedAudits}</p>
        <p><strong>Overdue Audits:</strong> {overdueAudits}</p>
        <p><strong>Total Findings:</strong> {totalFindings}</p>
        <p><strong>Open Findings:</strong> {openFindings}</p>
        <p><strong>Closed Findings:</strong> {closedFindings}</p>
        <p><strong>Findings Requiring CAPA:</strong> {capaFindings}</p>
        <p><strong>% Findings Requiring CAPA:</strong> {capaFindingsPercent}%</p>
      </section>

      <section style={sectionStyle}>
        <h2>OOS/OOT Metrics</h2>
        <p><strong>Total OOS/OOT Investigations:</strong> {oosMetrics.total}</p>
        <p><strong>Open OOS/OOT Investigations:</strong> {oosMetrics.open}</p>
        <p><strong>Closed OOS/OOT Investigations:</strong> {oosMetrics.closed}</p>
        <p><strong>OOS/OOT Closure Rate:</strong> {oosMetrics.closure_rate}%</p>
        <p><strong>Product Impact Cases:</strong> {oosMetrics.product_impact}</p>
        <p><strong>NCMR Required:</strong> {oosMetrics.ncmr_required}</p>
        <p><strong>Systemic Issues:</strong> {oosMetrics.systemic_issues}</p>
        <p><strong>Escalation Required:</strong> {oosMetrics.escalation_required}</p>
      </section>

      <section style={sectionStyle} className="no-print">
        <h2>Saved Management Review Reports</h2>
        {savedReports.length === 0 ? (
          <p>No saved reports yet.</p>
        ) : (
          <ul>
            {savedReports.map((report) => (
              <li key={report.id} style={{ marginBottom: "10px" }}>
                <strong>{report.report_title}</strong> — {report.report_period}<br />
                Created: {report.created_at}<br />
                Created By: {report.created_by || "unknown"}<br />
                Signed By: {report.signed_by || "Not signed"}<br />
                Signed At: {report.signed_at || "N/A"}<br />
                <a href={`/management-review/${report.id}`}>Open Saved Report</a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <style jsx global>{`
        @media print {
          .no-print { display: none; }
          body { color: black; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
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
