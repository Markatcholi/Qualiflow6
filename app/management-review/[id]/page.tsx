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

      <div className="no-print">
        <a href="/management-review">Back to Management Review</a>
      </div>

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
