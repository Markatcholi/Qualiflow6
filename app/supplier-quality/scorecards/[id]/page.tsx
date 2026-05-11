"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";

export default function SupplierScorecardDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [supplier, setSupplier] = useState<any>(null);
  const [ncmrs, setNcmrs] = useState<any[]>([]);
  const [scars, setScars] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);

    const supplierRes = await supabase
      .from("suppliers")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (supplierRes.error) {
      alert(supplierRes.error.message);
      setLoading(false);
      return;
    }

    setSupplier(supplierRes.data);

    const ncmrRes = await supabase
      .from("ncmrs")
      .select("id, ncmr_number, title, status, severity, defect_category, defect_subcategory, created_at, closed_at")
      .eq("supplier_id", id)
      .order("created_at", { ascending: false });

    if (!ncmrRes.error) setNcmrs(ncmrRes.data || []);

    const scarRes = await supabase
      .from("scars")
      .select("*")
      .eq("supplier_id", id)
      .order("created_at", { ascending: false });

    if (!scarRes.error) setScars(scarRes.data || []);

    setLoading(false);
  };

  useEffect(() => {
    if (id) fetchData();
  }, [id]);

  const metrics = useMemo(() => {
    const openNcmrs = ncmrs.filter((n) => n.status !== "closed");
    const openScars = scars.filter((s) => s.status !== "closed");
    const highCriticalIssues =
      ncmrs.filter((n) => n.severity === "major" || n.severity === "critical").length +
      scars.filter((s) => s.risk_level === "high" || s.risk_level === "critical").length;

    const defectCounts: Record<string, number> = {};
    ncmrs.forEach((ncmr) => {
      const key = ncmr.defect_category || "Uncategorized";
      defectCounts[key] = (defectCounts[key] || 0) + 1;
    });

    const topDefect = Object.entries(defectCounts).sort((a, b) => b[1] - a[1])[0];

    const score = calculateQualityScore({
      totalNcmrs: ncmrs.length,
      openNcmrs: openNcmrs.length,
      totalScars: scars.length,
      openScars: openScars.length,
      highCriticalIssues,
      supplierRisk: supplier?.supplier_risk_level,
      supplierStatus: supplier?.supplier_status,
    });

    return {
      openNcmrs: openNcmrs.length,
      closedNcmrs: ncmrs.length - openNcmrs.length,
      openScars: openScars.length,
      closedScars: scars.length - openScars.length,
      highCriticalIssues,
      topDefect: topDefect ? `${topDefect[0]} (${topDefect[1]})` : "N/A",
      score,
      rating: scoreRating(score),
    };
  }, [supplier, ncmrs, scars]);

  if (loading) return <main style={{ padding: "24px" }}>Loading supplier scorecard...</main>;
  if (!supplier) return <main style={{ padding: "24px" }}>Supplier not found.</main>;

  return (
    <main style={{ padding: "24px", fontFamily: "Arial" }}>
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
        <h1>Supplier Scorecard — {supplier.supplier_name}</h1>
        <div>
          <button onClick={() => window.print()} style={{ marginRight: "12px" }}>Print / Save PDF</button>
          <Link href="/supplier-quality/scorecards">Back to Scorecards</Link>
        </div>
      </div>

      <section style={summaryGridStyle}>
        <MetricCard label="Quality Score" value={metrics.score} />
        <MetricCard label="Rating" value={metrics.rating} />
        <MetricCard label="Open NCMRs" value={metrics.openNcmrs} />
        <MetricCard label="Open SCARs" value={metrics.openScars} />
        <MetricCard label="High/Critical Issues" value={metrics.highCriticalIssues} />
        <MetricCard label="Top Defect Category" value={metrics.topDefect} />
      </section>

      <section style={sectionStyle}>
        <h2>Supplier Information</h2>
        <div style={gridStyle}>
          <Field label="Supplier Number" value={supplier.supplier_number} />
          <Field label="Status" value={supplier.supplier_status} />
          <Field label="Risk Level" value={supplier.supplier_risk_level} />
          <Field label="Category" value={supplier.supplier_category} />
          <Field label="Primary Contact" value={supplier.primary_contact_name} />
          <Field label="Primary Email" value={supplier.primary_contact_email} />
          <Field label="ISO Certification" value={supplier.iso_certification} />
          <Field label="ISO Expiration" value={supplier.iso_expiration_date} />
          <Field label="Quality Agreement Signed" value={supplier.quality_agreement_signed ? "Yes" : "No"} />
          <Field label="Last Audit" value={supplier.last_supplier_audit_date} />
          <Field label="Next Audit" value={supplier.next_supplier_audit_date} />
        </div>
      </section>

      <section style={sectionStyle}>
        <h2>Quality Event Summary</h2>
        <div style={gridStyle}>
          <Field label="Total NCMRs" value={ncmrs.length} />
          <Field label="Closed NCMRs" value={metrics.closedNcmrs} />
          <Field label="Open NCMRs" value={metrics.openNcmrs} />
          <Field label="Total SCARs" value={scars.length} />
          <Field label="Closed SCARs" value={metrics.closedScars} />
          <Field label="Open SCARs" value={metrics.openScars} />
        </div>
      </section>

      <section style={sectionStyle}>
        <h2>Linked NCMRs</h2>
        {ncmrs.length === 0 ? (
          <p>No linked NCMRs.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>NCMR</th>
                <th style={thStyle}>Title</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Severity</th>
                <th style={thStyle}>Defect</th>
                <th style={thStyle}>Created</th>
              </tr>
            </thead>
            <tbody>
              {ncmrs.map((ncmr) => (
                <tr key={ncmr.id}>
                  <td style={tdStyle}><Link href={`/ncmrs/${ncmr.id}`}>{ncmr.ncmr_number || "NCMR"}</Link></td>
                  <td style={tdStyle}>{ncmr.title || "N/A"}</td>
                  <td style={tdStyle}>{ncmr.status || "N/A"}</td>
                  <td style={tdStyle}>{ncmr.severity || "N/A"}</td>
                  <td style={tdStyle}>{ncmr.defect_category || "N/A"}</td>
                  <td style={tdStyle}>{ncmr.created_at || "N/A"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section style={sectionStyle}>
        <h2>Linked SCARs</h2>
        {scars.length === 0 ? (
          <p>No linked SCARs.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>SCAR</th>
                <th style={thStyle}>Title</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Risk</th>
                <th style={thStyle}>Due Date</th>
                <th style={thStyle}>Created</th>
              </tr>
            </thead>
            <tbody>
              {scars.map((scar) => (
                <tr key={scar.id}>
                  <td style={tdStyle}><Link href={`/supplier-quality/scars/${scar.id}`}>{scar.scar_number || "SCAR"}</Link></td>
                  <td style={tdStyle}>{scar.title || "N/A"}</td>
                  <td style={tdStyle}>{scar.status || "N/A"}</td>
                  <td style={tdStyle}>{scar.risk_level || "N/A"}</td>
                  <td style={tdStyle}>{scar.due_date || "N/A"}</td>
                  <td style={tdStyle}>{scar.created_at || "N/A"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <style jsx global>{`
        @media print {
          .no-print button,
          .no-print a {
            display: none !important;
          }

          body {
            color: black;
            background: white;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          section {
            page-break-inside: avoid;
          }
        }

        @page {
          margin: 0.75in;
        }
      `}</style>
    </main>
  );
}

function Field({ label, value }: { label: string; value: any }) {
  return <div><strong>{label}:</strong> {value || "N/A"}</div>;
}

function MetricCard({ label, value }: { label: string; value: any }) {
  return (
    <div style={metricCardStyle}>
      <div style={{ color: "#4b5563", fontSize: "13px" }}>{label}</div>
      <div style={{ fontSize: "24px", fontWeight: "bold", marginTop: "6px" }}>{value}</div>
    </div>
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

const summaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "12px",
  marginBottom: "20px",
};

const metricCardStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: "10px",
  padding: "14px",
  background: "#f9fafb",
};

const sectionStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: "10px",
  padding: "14px",
  marginBottom: "20px",
  background: "white",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: "10px",
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
