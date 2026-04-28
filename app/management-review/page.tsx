"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function ManagementReviewPage() {
  const [ncmrs, setNcmrs] = useState<any[]>([]);
  const [capas, setCapas] = useState<any[]>([]);
  const [savedReports, setSavedReports] = useState<any[]>([]);

  const [reportTitle, setReportTitle] = useState("Management Review Report");
  const [reportPeriod, setReportPeriod] = useState("");

  const fetchData = async () => {
    const ncmrRes = await supabase.from("ncmrs").select("*");
    const capaRes = await supabase.from("capas").select("*");
    const reportsRes = await supabase
      .from("management_review_reports")
      .select("*")
      .order("created_at", { ascending: false });

    if (ncmrRes.error) alert(ncmrRes.error.message);
    if (capaRes.error) alert(capaRes.error.message);
    if (reportsRes.error) alert(reportsRes.error.message);

    setNcmrs(ncmrRes.data || []);
    setCapas(capaRes.data || []);
    setSavedReports(reportsRes.data || []);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const closedNcmrs = ncmrs.filter((x) => x.status === "closed");
  const openNcmrs = ncmrs.filter((x) => x.status !== "closed");

  const closedCapas = capas.filter((x) => x.status === "closed");
  const openCapas = capas.filter((x) => x.status !== "closed");

  const todayStr = new Date().toISOString().split("T")[0];

  const overdueCapas = capas.filter(
    (x) => x.status !== "closed" && x.due_date && x.due_date < todayStr
  );

  const scars = capas.filter((x) => x.capa_type === "scar");

  const effectiveness = {
    effective: capas.filter((x) => x.effectiveness_rating === "effective").length,
    partial: capas.filter((x) => x.effectiveness_rating === "partially_effective").length,
    notEffective: capas.filter((x) => x.effectiveness_rating === "not_effective").length,
  };

  const supplierMap = new Map<string, number>();

  ncmrs.forEach((n) => {
    const s = n.supplier_name || "";
    if (!s) return;
    supplierMap.set(s, (supplierMap.get(s) || 0) + 1);
  });

  const topSuppliers = Array.from(supplierMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const closureRate = (closed: number, total: number) =>
    total > 0 ? ((closed / total) * 100).toFixed(1) : "0.0";

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
    };
  };

  const saveReport = async () => {
    if (!reportTitle) {
      alert("Report title is required.");
      return;
    }

    if (!reportPeriod) {
      alert("Report period is required, for example Q1 2026 or January 2026.");
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const email = userData?.user?.email || "unknown";

    const { error } = await supabase.from("management_review_reports").insert({
      report_title: reportTitle,
      report_period: reportPeriod,
      report_data: buildReportData(),
      created_by: email,
    });

    if (error) {
      alert(error.message);
      return;
    }

    alert("Management Review report saved.");
    fetchData();
  };

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
          <input
            value={reportTitle}
            onChange={(e) => setReportTitle(e.target.value)}
            style={{ padding: "8px", width: "100%", maxWidth: "400px" }}
          />
        </div>

        <div style={{ marginBottom: "10px" }}>
          <label>Report Period</label><br />
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
        <p><strong>NCMR Closure Rate:</strong> {closureRate(closedNcmrs.length, ncmrs.length)}%</p>

        <p><strong>Total CAPAs:</strong> {capas.length}</p>
        <p><strong>Open CAPAs:</strong> {openCapas.length}</p>
        <p><strong>CAPA Closure Rate:</strong> {closureRate(closedCapas.length, capas.length)}%</p>
        <p><strong>Overdue CAPAs:</strong> {overdueCapas.length}</p>
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

        <h3>Top Suppliers by NCMR Count</h3>
        {topSuppliers.length === 0 ? (
          <p>No supplier data.</p>
        ) : (
          <ul>
            {topSuppliers.map(([supplier, count]) => (
              <li key={supplier}>
                {supplier}: {count} NCMR(s)
              </li>
            ))}
          </ul>
        )}
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
