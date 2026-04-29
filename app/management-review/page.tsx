"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function ManagementReviewPage() {
  const [ncmrs, setNcmrs] = useState<any[]>([]);
  const [capas, setCapas] = useState<any[]>([]);
  const [audits, setAudits] = useState<any[]>([]);
  const [auditFindings, setAuditFindings] = useState<any[]>([]);
  const [savedReports, setSavedReports] = useState<any[]>([]);

  const [reportTitle, setReportTitle] = useState("Management Review Report");
  const [reportPeriod, setReportPeriod] = useState("");

  const fetchData = async () => {
    const ncmrRes = await supabase.from("ncmrs").select("*");
    const capaRes = await supabase.from("capas").select("*");
    const auditRes = await supabase.from("audits").select("*");
    const findingsRes = await supabase.from("audit_findings").select("*");
    const reportsRes = await supabase
      .from("management_review_reports")
      .select("*")
      .order("created_at", { ascending: false });

    if (ncmrRes.error) alert(ncmrRes.error.message);
    if (capaRes.error) alert(capaRes.error.message);
    if (auditRes.error) alert(auditRes.error.message);
    if (findingsRes.error) alert(findingsRes.error.message);
    if (reportsRes.error) alert(reportsRes.error.message);

    setNcmrs(ncmrRes.data || []);
    setCapas(capaRes.data || []);
    setAudits(auditRes.data || []);
    setAuditFindings(findingsRes.data || []);
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

  const buildMonthlyTrend = (items: any[]) => {
    const months: { key: string; label: string; count: number }[] = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.push({
        key,
        label: d.toLocaleString("en-US", { month: "short", year: "2-digit" }),
        count: 0,
      });
    }

    items.forEach((item) => {
      if (!item.created_at) return;
      const d = new Date(item.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const match = months.find((m) => m.key === key);
      if (match) match.count += 1;
    });

    return months;
  };

  const ncmrTrend = buildMonthlyTrend(ncmrs);
  const capaTrend = buildMonthlyTrend(capas);

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
        findings_by_severity: {
          minor: minorFindings,
          major: majorFindings,
          critical: criticalFindings,
        },
        capa_effectiveness: effectiveness,
        top_suppliers: topSuppliers.map(([supplier, count]) => ({
          supplier,
          count,
        })),
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
        top_suppliers: topSuppliers.map(([supplier, count]) => ({
          supplier,
          count,
        })),
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

    const enteredEmail = window.prompt(
      "Electronic Signature Required\n\nRe-enter your email to generate and save this Management Review report:"
    );

    if (!enteredEmail) {
      alert("Report generation cancelled. Email re-entry is required.");
      return;
    }

    if (enteredEmail.trim().toLowerCase() !== email.trim().toLowerCase()) {
      alert("Electronic signature email does not match logged-in user.");
      return;
    }

    const confirmed = window.confirm(
      "Electronic Signature:\n\nI confirm this Management Review report snapshot is accurate at the time of generation."
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
      signature_email_entered: enteredEmail,
      signature_meaning: signatureMeaning,
    });

    if (error) {
      alert(error.message);
      return;
    }

    alert("Management Review report saved with electronic signature.");
    fetchData();
  };

  const Bar = ({ label, value, max }: { label: string; value: number; max: number }) => (
    <div style={{ marginBottom: "10px" }}>
      <div>
        {label}: {value}
      </div>
      <div style={{ background: "#eee", width: "100%", maxWidth: "500px", height: "16px" }}>
        <div
          style={{
            background: "#3b82f6",
            width: `${max > 0 ? (value / max) * 100 : 0}%`,
            height: "16px",
          }}
        />
      </div>
    </div>
  );

  const maxTrend = Math.max(
    ...ncmrTrend.map((x) => x.count),
    ...capaTrend.map((x) => x.count),
    1
  );

  const maxFinding = Math.max(minorFindings, majorFindings, criticalFindings, 1);
  const maxEffectiveness = Math.max(
    effectiveness.effective,
    effectiveness.partial,
    effectiveness.notEffective,
    1
  );
  const maxSupplier = Math.max(...topSuppliers.map((x) => x[1]), 1);

  return (
    <main style={{ padding: "25px", fontFamily: "Arial, sans-serif" }}>
      <button onClick={() => window.print()} className="no-print">
        Print / Save as PDF
      </button>

      <h1>Management Review Dashboard</h1>
      <p>
        <strong>Date:</strong> {new Date().toLocaleDateString()}
      </p>

      <section style={sectionStyle} className="no-print">
        <h2>Generate Saved Management Review Report</h2>

        <div style={{ marginBottom: "10px" }}>
          <label>Report Title</label>
          <br />
          <input
            value={reportTitle}
            onChange={(e) => setReportTitle(e.target.value)}
            style={{ padding: "8px", width: "100%", maxWidth: "400px" }}
          />
        </div>

        <div style={{ marginBottom: "10px" }}>
          <label>Report Period</label>
          <br />
          <input
            value={reportPeriod}
            onChange={(e) => setReportPeriod(e.target.value)}
            placeholder="Example: Q1 2026 or January 2026"
            style={{ padding: "8px", width: "100%", maxWidth: "400px" }}
          />
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
      </section>

      <section style={sectionStyle}>
        <h2>Executive Charts</h2>

        <h3>Closure Status</h3>
        <Bar label="Closed NCMRs" value={closedNcmrs.length} max={Math.max(ncmrs.length, 1)} />
        <Bar label="Open NCMRs" value={openNcmrs.length} max={Math.max(ncmrs.length, 1)} />
        <Bar label="Closed CAPAs" value={closedCapas.length} max={Math.max(capas.length, 1)} />
        <Bar label="Open CAPAs" value={openCapas.length} max={Math.max(capas.length, 1)} />

        <h3>Monthly NCMR / CAPA Trend</h3>
        {ncmrTrend.map((item, index) => (
          <div key={item.key} style={{ marginBottom: "12px" }}>
            <strong>{item.label}</strong>
            <Bar label="NCMR" value={item.count} max={maxTrend} />
            <Bar label="CAPA" value={capaTrend[index]?.count || 0} max={maxTrend} />
          </div>
        ))}

        <h3>Audit Findings by Severity</h3>
        <Bar label="Minor" value={minorFindings} max={maxFinding} />
        <Bar label="Major" value={majorFindings} max={maxFinding} />
        <Bar label="Critical" value={criticalFindings} max={maxFinding} />

        <h3>CAPA Effectiveness</h3>
        <Bar label="Effective" value={effectiveness.effective} max={maxEffectiveness} />
        <Bar label="Partially Effective" value={effectiveness.partial} max={maxEffectiveness} />
        <Bar label="Not Effective" value={effectiveness.notEffective} max={maxEffectiveness} />

        <h3>Top Suppliers by NCMR Count</h3>
        {topSuppliers.length === 0 ? (
          <p>No supplier data.</p>
        ) : (
          topSuppliers.map(([supplier, count]) => (
            <Bar key={supplier} label={supplier} value={count} max={maxSupplier} />
          ))
        )}
      </section>

      <section style={sectionStyle}>
        <h2>Risk & Escalation</h2>
        <p><strong>Critical NCMRs:</strong> {ncmrs.filter((x) => x.severity === "critical").length}</p>
        <p><strong>Major NCMRs:</strong> {ncmrs.filter((x) => x.severity === "major").length}</p>
        <p><strong>Recurring NCMRs:</strong> {ncmrs.filter((x) => x.recurring_issue).length}</p>
        <p><strong>Supplier CAPA Required:</strong> {ncmrs.filter((x) => x.supplier_capa_required).length}</p>
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

      <section style={sectionStyle} className="no-print">
        <h2>Saved Management Review Reports</h2>

        {savedReports.length === 0 ? (
          <p>No saved reports yet.</p>
        ) : (
          <ul>
            {savedReports.map((report) => (
              <li key={report.id} style={{ marginBottom: "10px" }}>
                <strong>{report.report_title}</strong> — {report.report_period}
                <br />
                Created: {report.created_at}
                <br />
                Created By: {report.created_by || "unknown"}
                <br />
                Signed By: {report.signed_by || "Not signed"}
                <br />
                Signed At: {report.signed_at || "N/A"}
                <br />
                <a href={`/management-review/${report.id}`}>Open Saved Report</a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <style jsx global>{`
        @media print {
          .no-print {
            display: none;
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
