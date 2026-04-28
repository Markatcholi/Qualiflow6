"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function ManagementReviewPage() {
  const [ncmrs, setNcmrs] = useState<any[]>([]);
  const [capas, setCapas] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const ncmrRes = await supabase.from("ncmrs").select("*");
      const capaRes = await supabase.from("capas").select("*");

      if (ncmrRes.error) alert(ncmrRes.error.message);
      if (capaRes.error) alert(capaRes.error.message);

      setNcmrs(ncmrRes.data || []);
      setCapas(capaRes.data || []);
    };

    fetchData();
  }, []);

  const closedNcmrs = ncmrs.filter((x) => x.status === "closed");
  const openNcmrs = ncmrs.filter((x) => x.status !== "closed");

  const closedCapas = capas.filter((x) => x.status === "closed");
  const openCapas = capas.filter((x) => x.status !== "closed");

  const overdueCapas = capas.filter(
    (x) =>
      x.status !== "closed" &&
      x.due_date &&
      x.due_date < new Date().toISOString().split("T")[0]
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

  return (
    <main style={{ padding: "25px", fontFamily: "Arial, sans-serif" }}>
      <button onClick={() => window.print()} className="no-print">
        Print / Save as PDF
      </button>

      <h1>Management Review Dashboard</h1>
      <p><strong>Date:</strong> {new Date().toLocaleDateString()}</p>

      {/* Executive Summary */}
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

      {/* Risk & Escalation */}
      <section style={sectionStyle}>
        <h2>Risk & Escalation</h2>
        <p><strong>Overdue CAPAs:</strong> {overdueCapas.length}</p>
        <p><strong>Critical NCMRs:</strong> {ncmrs.filter(x => x.severity === "critical").length}</p>
        <p><strong>Major NCMRs:</strong> {ncmrs.filter(x => x.severity === "major").length}</p>
      </section>

      {/* CAPA Effectiveness */}
      <section style={sectionStyle}>
        <h2>CAPA Effectiveness</h2>
        <p>Effective: {effectiveness.effective}</p>
        <p>Partially Effective: {effectiveness.partial}</p>
        <p>Not Effective: {effectiveness.notEffective}</p>
      </section>

      {/* Supplier Quality */}
      <section style={sectionStyle}>
        <h2>Supplier Quality</h2>
        <p><strong>Total SCARs:</strong> {scars.length}</p>

        <h3>Top Suppliers (by NCMR)</h3>
        {topSuppliers.length === 0 ? (
          <p>No supplier data</p>
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

      {/* Trends (simple counts) */}
      <section style={sectionStyle}>
        <h2>Trend Summary</h2>
        <p>Recurring NCMRs: {ncmrs.filter(x => x.recurring_issue).length}</p>
        <p>Supplier CAPA Required: {ncmrs.filter(x => x.supplier_capa_required).length}</p>
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
