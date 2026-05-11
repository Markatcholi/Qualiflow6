"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

export default function SupplierScorecardsPage() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [ncmrs, setNcmrs] = useState<any[]>([]);
  const [scars, setScars] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);

    const suppliersRes = await supabase
      .from("suppliers")
      .select("*")
      .order("supplier_name", { ascending: true });

    const ncmrRes = await supabase
      .from("ncmrs")
      .select("id, supplier_id, status, severity, defect_category, created_at")
      .not("supplier_id", "is", null);

    const scarRes = await supabase
      .from("scars")
      .select("id, supplier_id, status, risk_level, created_at");

    if (suppliersRes.error) {
      alert(suppliersRes.error.message);
      setLoading(false);
      return;
    }

    if (ncmrRes.error) {
      alert(ncmrRes.error.message);
      setLoading(false);
      return;
    }

    if (scarRes.error) {
      alert(scarRes.error.message);
      setLoading(false);
      return;
    }

    setSuppliers(suppliersRes.data || []);
    setNcmrs(ncmrRes.data || []);
    setScars(scarRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const rows = useMemo(() => {
    return suppliers.map((supplier) => {
      const supplierNcmrs = ncmrs.filter((n) => n.supplier_id === supplier.id);
      const supplierScars = scars.filter((s) => s.supplier_id === supplier.id);

      const openNcmrs = supplierNcmrs.filter((n) => n.status !== "closed").length;
      const openScars = supplierScars.filter((s) => s.status !== "closed").length;
      const highCriticalIssues =
        supplierNcmrs.filter((n) => n.severity === "major" || n.severity === "critical").length +
        supplierScars.filter((s) => s.risk_level === "high" || s.risk_level === "critical").length;

      const qualityScore = calculateQualityScore({
        totalNcmrs: supplierNcmrs.length,
        openNcmrs,
        totalScars: supplierScars.length,
        openScars,
        highCriticalIssues,
        supplierRisk: supplier.supplier_risk_level,
        supplierStatus: supplier.supplier_status,
      });

      return {
        supplier,
        totalNcmrs: supplierNcmrs.length,
        openNcmrs,
        totalScars: supplierScars.length,
        openScars,
        highCriticalIssues,
        qualityScore,
        rating: scoreRating(qualityScore),
      };
    }).sort((a, b) => a.qualityScore - b.qualityScore);
  }, [suppliers, ncmrs, scars]);

  if (loading) {
    return <main style={{ padding: "24px", fontFamily: "Arial" }}>Loading supplier scorecards...</main>;
  }

  return (
    <main style={{ padding: "24px", fontFamily: "Arial" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
        <h1>Supplier Scorecards</h1>
        <div>
          <Link href="/supplier-quality-dashboard" style={{ marginRight: "12px" }}>Supplier Dashboard</Link>
          <Link href="/supplier-quality/scars">SCARs</Link>
        </div>
      </div>

      <section style={sectionStyle}>
        <h2>Supplier Quality Scorecard Summary</h2>
        <p style={{ color: "#4b5563" }}>
          Score is calculated from supplier risk/status, open NCMRs, open SCARs, and major/critical supplier quality issues.
        </p>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}>Supplier</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Risk</th>
              <th style={thStyle}>Score</th>
              <th style={thStyle}>Rating</th>
              <th style={thStyle}>NCMRs</th>
              <th style={thStyle}>Open NCMRs</th>
              <th style={thStyle}>SCARs</th>
              <th style={thStyle}>Open SCARs</th>
              <th style={thStyle}>High/Critical Issues</th>
              <th style={thStyle}>Open</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr key={row.supplier.id}>
                <td style={tdStyle}>{row.supplier.supplier_name}</td>
                <td style={tdStyle}>{row.supplier.supplier_status || "N/A"}</td>
                <td style={tdStyle}>{row.supplier.supplier_risk_level || "N/A"}</td>
                <td style={tdStyle}>{row.qualityScore}</td>
                <td style={tdStyle}>{row.rating}</td>
                <td style={tdStyle}>{row.totalNcmrs}</td>
                <td style={tdStyle}>{row.openNcmrs}</td>
                <td style={tdStyle}>{row.totalScars}</td>
                <td style={tdStyle}>{row.openScars}</td>
                <td style={tdStyle}>{row.highCriticalIssues}</td>
                <td style={tdStyle}>
                  <Link href={`/supplier-quality/scorecards/${row.supplier.id}`}>Open Scorecard</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}

function calculateQualityScore(input: {
  totalNcmrs: number;
  openNcmrs: number;
  totalScars: number;
  openScars: number;
  highCriticalIssues: number;
  supplierRisk: string | null;
  supplierStatus: string | null;
}) {
  let score = 100;

  score -= input.openNcmrs * 5;
  score -= input.totalNcmrs * 2;
  score -= input.openScars * 10;
  score -= input.totalScars * 4;
  score -= input.highCriticalIssues * 6;

  if (input.supplierRisk === "critical") score -= 20;
  if (input.supplierRisk === "high") score -= 12;
  if (input.supplierRisk === "medium") score -= 5;

  if (input.supplierStatus === "probation") score -= 15;
  if (input.supplierStatus === "conditional") score -= 8;
  if (input.supplierStatus === "disqualified") score -= 40;

  return Math.max(0, Math.min(100, score));
}

function scoreRating(score: number) {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 60) return "Watch";
  if (score >= 40) return "At Risk";
  return "Critical";
}

const sectionStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: "10px",
  padding: "14px",
  marginBottom: "20px",
};

const thStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  padding: "10px",
  background: "#f3f4f6",
  textAlign: "left",
};

const tdStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  padding: "10px",
};
