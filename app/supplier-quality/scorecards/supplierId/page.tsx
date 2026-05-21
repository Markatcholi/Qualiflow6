"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";

export default function SupplierScorecardDetailPage() {
  const params = useParams<{ supplierId: string }>();
  const supplierId = params.supplierId;

  const [supplier, setSupplier] = useState<any>(null);
  const [ncmrs, setNcmrs] = useState<any[]>([]);
  const [scars, setScars] = useState<any[]>([]);
  const [inspections, setInspections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);

    const supplierRes = await supabase
      .from("suppliers")
      .select("*")
      .eq("id", supplierId)
      .maybeSingle();

    if (supplierRes.error) {
      alert(supplierRes.error.message);
      setLoading(false);
      return;
    }

    const ncmrRes = await supabase
      .from("ncmrs")
      .select("*")
      .or(`supplier_id.eq.${supplierId},linked_supplier_id.eq.${supplierId}`)
      .order("created_at", { ascending: false });

    const scarRes = await supabase
      .from("scars")
      .select("*")
      .or(`supplier_id.eq.${supplierId},linked_supplier_id.eq.${supplierId}`)
      .order("created_at", { ascending: false });

    const inspectionRes = await supabase
      .from("receiving_inspections")
      .select("*")
      .eq("supplier_id", supplierId)
      .order("created_at", { ascending: false });

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

    if (inspectionRes.error) {
      alert(inspectionRes.error.message);
      setLoading(false);
      return;
    }

    setSupplier(supplierRes.data || null);
    setNcmrs(ncmrRes.data || []);
    setScars(scarRes.data || []);
    setInspections(inspectionRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (supplierId) fetchData();
  }, [supplierId]);

  const metrics = useMemo(() => {
    const rejectedInspections = inspections.filter((i) => requiresNcmr(i));
    const approvedInspections = inspections.filter((i) => i.approval_status === "approved");
    const openNcmrs = ncmrs.filter((n) => norm(n.status) !== "closed");
    const openScars = scars.filter((s) => norm(s.status || s.scar_status) !== "closed");

    const highCriticalNcmrs = ncmrs.filter((n) =>
      ["major", "critical", "high"].includes(norm(n.severity))
    );

    const highCriticalScars = scars.filter((s) =>
      ["major", "critical", "high"].includes(norm(s.risk_level || s.scar_severity || s.severity))
    );

    const rejectRate = inspections.length
      ? (rejectedInspections.length / inspections.length) * 100
      : 0;

    const approvalRate = inspections.length
      ? (approvedInspections.length / inspections.length) * 100
      : 0;

    const defectCounts: Record<string, number> = {};
    ncmrs.forEach((n) => {
      const key = n.defect_category || "Uncategorized";
      defectCounts[key] = (defectCounts[key] || 0) + 1;
    });

    inspections.forEach((i) => {
      if (i.defect_category) defectCounts[i.defect_category] = (defectCounts[i.defect_category] || 0) + 1;
    });

    const topDefects = Object.entries(defectCounts)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    const recurrence = ncmrs.length >= 3 || rejectedInspections.length >= 3 || topDefects.some((d) => d.count >= 3);

    const score = calculateScore({
      openNcmrs: openNcmrs.length,
      totalNcmrs: ncmrs.length,
      openScars: openScars.length,
      totalScars: scars.length,
      highCritical: highCriticalNcmrs.length + highCriticalScars.length,
      rejectRate,
      approvalRate,
      recurrence,
      risk: supplier?.supplier_risk_level,
      status: supplier?.supplier_status,
    });

    const alerts = [
      openNcmrs.length ? `${openNcmrs.length} supplier NCMR(s) remain open.` : "",
      openScars.length ? `${openScars.length} SCAR(s) remain open.` : "",
      rejectRate > 10 ? `Receiving inspection reject rate is ${rejectRate.toFixed(1)}%.` : "",
      recurrence ? "Recurring supplier quality signal detected." : "",
      highCriticalNcmrs.length + highCriticalScars.length
        ? `${highCriticalNcmrs.length + highCriticalScars.length} high/critical issue(s) identified.`
        : "",
      norm(supplier?.supplier_status) === "probation" ? "Supplier is currently on probation." : "",
      norm(supplier?.supplier_risk_level) === "critical" ? "Supplier is currently critical risk." : "",
    ].filter(Boolean);

    return {
      rejectedInspections,
      approvedInspections,
      openNcmrs,
      openScars,
      highCriticalNcmrs,
      highCriticalScars,
      rejectRate,
      approvalRate,
      topDefects,
      recurrence,
      score,
      grade: grade(score),
      alerts,
    };
  }, [supplier, ncmrs, scars, inspections]);

  const printReport = () => {
    const html = `
      <html>
        <head>
          <title>Supplier Quality Scorecard</title>
          <style>
            body{font-family:Arial,sans-serif;margin:32px;color:#111827}
            h1{margin-bottom:4px} h2{border-bottom:1px solid #d1d5db;padding-bottom:6px;margin-top:24px}
            .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
            .field{border:1px solid #d1d5db;border-radius:8px;padding:10px}
            .label{font-size:11px;color:#6b7280;font-weight:700;text-transform:uppercase}
            table{width:100%;border-collapse:collapse;margin-top:10px}
            th,td{border:1px solid #d1d5db;padding:8px;font-size:12px;text-align:left;vertical-align:top}
            th{background:#f3f4f6}
          </style>
        </head>
        <body>
          <h1>Supplier Quality Scorecard Report</h1>
          <div>Generated: ${esc(new Date().toLocaleString())}</div>

          <h2>Supplier Overview</h2>
          <div class="grid">
            ${pf("Supplier", supplier?.supplier_name)}
            ${pf("Supplier Number", supplier?.supplier_number)}
            ${pf("Status", supplier?.supplier_status)}
            ${pf("Risk Level", supplier?.supplier_risk_level)}
            ${pf("Quality Score", metrics.score)}
            ${pf("Grade", metrics.grade)}
            ${pf("Reject Rate", `${metrics.rejectRate.toFixed(1)}%`)}
            ${pf("Open NCMRs", metrics.openNcmrs.length)}
            ${pf("Open SCARs", metrics.openScars.length)}
          </div>

          <h2>Governance Alerts</h2>
          ${metrics.alerts.length ? `<ul>${metrics.alerts.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>` : "<p>No significant alerts.</p>"}

          <h2>Recent Receiving Inspections</h2>
          ${printTable(["Part", "Rev", "Lot", "Result", "Approval"], inspections.slice(0, 10).map((i) => [i.part_number, i.part_revision, i.lot_number, i.inspection_result, i.approval_status]))}

          <h2>Recent NCMRs</h2>
          ${printTable(["NCMR", "Status", "Severity", "Defect"], ncmrs.slice(0, 10).map((n) => [n.ncmr_number || n.title || n.id, n.status, n.severity, n.defect_category]))}

          <h2>Recent SCARs</h2>
          ${printTable(["SCAR", "Status", "Risk"], scars.slice(0, 10).map((s) => [s.scar_number || s.title || s.id, s.status || s.scar_status, s.risk_level || s.scar_severity]))}

          <script>window.onload=function(){window.print()}</script>
        </body>
      </html>
    `;

    const w = window.open("", "_blank", "width=1000,height=800");
    if (!w) return alert("Unable to open print window. Please allow pop-ups.");
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  if (loading) return <main style={{ padding: 24, fontFamily: "Arial" }}>Loading supplier scorecard...</main>;
  if (!supplier) return <main style={{ padding: 24, fontFamily: "Arial" }}>Supplier not found.</main>;

  return (
    <main style={{ padding: 24, fontFamily: "Arial, sans-serif", background: "#f8fafc", minHeight: "100vh" }}>
      <div style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>EXECUTIVE SUPPLIER QUALITY PROFILE</div>
          <h1 style={{ margin: "6px 0" }}>{supplier.supplier_name}</h1>
          <p style={{ color: "#4b5563", margin: 0 }}>
            Supplier quality performance, receiving inspection intelligence, NCMR history, SCAR history, recurrence signals, and governance alerts.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={printReport} style={primaryButtonStyle}>Print Supplier Report</button>
          <Link href="/supplier-quality/scorecards">Back to Scorecards</Link>
          <Link href={`/suppliers/${supplierId}`}>Supplier Profile</Link>
          <Link href="/supplier-quality/receiving-inspections">Receiving Inspections</Link>
          <Link href="/scar/dashboard">Governance</Link>
        </div>
      </div>

      <section style={sectionStyle}>
        <h2 style={{ marginTop: 0 }}>Supplier Executive Summary</h2>
        <div style={gridStyle}>
          <KpiCard title="Quality Score" value={metrics.score} color={scoreColor(metrics.score)} />
          <KpiCard title="Grade" value={metrics.grade} color={gradeColor(metrics.grade)} />
          <KpiCard title="Risk" value={supplier.supplier_risk_level || "N/A"} color={riskColor(supplier.supplier_risk_level)} />
          <KpiCard title="Status" value={supplier.supplier_status || "N/A"} color="#374151" />
          <KpiCard title="Reject Rate" value={`${metrics.rejectRate.toFixed(1)}%`} color={metrics.rejectRate > 10 ? "#dc2626" : "#15803d"} />
          <KpiCard title="Approval Rate" value={`${metrics.approvalRate.toFixed(1)}%`} color={metrics.approvalRate >= 90 ? "#15803d" : "#d97706"} />
          <KpiCard title="Open NCMRs" value={metrics.openNcmrs.length} color={metrics.openNcmrs.length ? "#dc2626" : "#15803d"} />
          <KpiCard title="Open SCARs" value={metrics.openScars.length} color={metrics.openScars.length ? "#dc2626" : "#15803d"} />
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={{ marginTop: 0 }}>Governance Alerts</h2>
        {metrics.alerts.length ? (
          <div style={alertGridStyle}>
            {metrics.alerts.map((a, i) => <div key={i} style={alertStyle}>{a}</div>)}
          </div>
        ) : (
          <p style={{ color: "#15803d", fontWeight: 700 }}>No significant supplier quality alerts identified.</p>
        )}
      </section>

      <div style={twoColumnGridStyle}>
        <section style={sectionStyle}>
          <h2 style={{ marginTop: 0 }}>Supplier Overview</h2>
          <Info label="Supplier Number" value={supplier.supplier_number} />
          <Info label="Category" value={supplier.supplier_category} />
          <Info label="Risk Score" value={supplier.supplier_risk_score} />
          <Info label="Governance Status" value={supplier.supplier_governance_status} />
          <Info label="Escalation Level" value={supplier.supplier_escalation_level} />
          <Info label="ISO Expiration" value={supplier.iso_expiration_date} />
        </section>

        <section style={sectionStyle}>
          <h2 style={{ marginTop: 0 }}>Top Defect Categories</h2>
          {metrics.topDefects.length ? <MiniBars data={metrics.topDefects} /> : <p>No defect data available.</p>}
        </section>
      </div>

      <section style={sectionStyle}>
        <h2 style={{ marginTop: 0 }}>Receiving Inspection Intelligence</h2>
        <DataTable
          columns={["Part", "Rev", "Description", "Lot", "Result", "Qty Rec.", "Qty Rej.", "Approval", "Record"]}
          rows={inspections.slice(0, 15).map((i) => [
            i.part_number || "N/A",
            i.part_revision || "N/A",
            i.part_description || "N/A",
            i.lot_number || "N/A",
            i.inspection_result || "N/A",
            i.quantity_received ?? "N/A",
            i.quantity_rejected ?? "N/A",
            i.approval_status || "N/A",
            <Link key={i.id} href={`/suppliers/${supplierId}/receiving-inspections/${i.id}`}>Open</Link>,
          ])}
        />
      </section>

      <section style={sectionStyle}>
        <h2 style={{ marginTop: 0 }}>Supplier NCMR Intelligence</h2>
        <DataTable
          columns={["NCMR", "Status", "Severity", "Defect", "Created"]}
          rows={ncmrs.slice(0, 15).map((n) => [
            n.ncmr_number || n.title || n.id,
            n.status || "N/A",
            n.severity || "N/A",
            n.defect_category || "N/A",
            formatDate(n.created_at),
          ])}
        />
      </section>

      <section style={sectionStyle}>
        <h2 style={{ marginTop: 0 }}>SCAR Intelligence</h2>
        <DataTable
          columns={["SCAR", "Status", "Risk", "Created"]}
          rows={scars.slice(0, 15).map((s) => [
            s.scar_number || s.title || s.id,
            s.status || s.scar_status || "N/A",
            s.risk_level || s.scar_severity || "N/A",
            formatDate(s.created_at),
          ])}
        />
      </section>
    </main>
  );
}

function KpiCard({ title, value, color }: { title: string; value: string | number; color: string }) {
  return (
    <div style={{ borderRadius: 14, padding: 18, background: "white", border: "1px solid #e5e7eb", borderLeft: `6px solid ${color}`, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
      <div style={{ color: "#6b7280", fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div style={infoCardStyle}>
      <div style={{ color: "#6b7280", fontSize: 12, fontWeight: 800 }}>{label}</div>
      <div>{value || "N/A"}</div>
    </div>
  );
}

function MiniBars({ data }: { data: { category: string; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div>
      {data.map((d) => {
        const width = Math.max((d.count / max) * 100, 6);
        return (
          <div key={d.category} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span>{d.category}</span><strong>{d.count}</strong>
            </div>
            <div style={{ height: 12, background: "#e5e7eb", borderRadius: 999, overflow: "hidden" }}>
              <div style={{ height: 12, width: `${width}%`, background: "#2563eb" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DataTable({ columns, rows }: { columns: string[]; rows: any[][] }) {
  if (!rows.length) return <p>No records found.</p>;
  return (
    <div style={{ overflowX: "auto", marginTop: 14 }}>
      <table style={tableStyle}>
        <thead><tr>{columns.map((c) => <th key={c} style={thStyle}>{c}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#f9fafb" }}>
              {r.map((cell, j) => <td key={j} style={tdStyle}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function calculateScore(input: any) {
  let score = 100;
  score -= input.openNcmrs * 4;
  score -= input.totalNcmrs * 1.5;
  score -= input.openScars * 8;
  score -= input.totalScars * 3;
  score -= input.highCritical * 6;
  score -= input.rejectRate * 0.8;
  if (input.approvalRate < 80) score -= 5;
  if (input.recurrence) score -= 10;

  const risk = norm(input.risk);
  const status = norm(input.status);

  if (risk === "critical") score -= 20;
  if (risk === "high") score -= 12;
  if (risk === "medium") score -= 5;

  if (status === "probation") score -= 15;
  if (status === "conditional") score -= 8;
  if (status === "disqualified") score -= 40;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function grade(score: number) {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 65) return "C";
  if (score >= 45) return "D";
  return "F";
}

function requiresNcmr(i: any) {
  const result = norm(i.inspection_result);
  return result.includes("reject") || result.includes("fail") || result.includes("nonconform") || result.includes("non-conform") || result.includes("ncmr");
}

function norm(v: any) {
  return String(v || "").toLowerCase();
}

function scoreColor(score: number) {
  if (score >= 85) return "#15803d";
  if (score >= 70) return "#d97706";
  return "#dc2626";
}

function gradeColor(g: string) {
  if (g === "A") return "#15803d";
  if (g === "B") return "#2563eb";
  if (g === "C") return "#d97706";
  return "#dc2626";
}

function riskColor(risk: any) {
  const r = norm(risk);
  if (r === "critical") return "#991b1b";
  if (r === "high") return "#dc2626";
  if (r === "medium") return "#d97706";
  return "#15803d";
}

function formatDate(v: any) {
  if (!v) return "N/A";
  try { return new Date(v).toLocaleDateString(); } catch { return v; }
}

function pf(label: string, value: any) {
  return `<div class="field"><div class="label">${esc(label)}</div><div class="value">${esc(value ?? "N/A")}</div></div>`;
}

function printTable(headers: string[], rows: any[][]) {
  if (!rows.length) return "<p>No records found.</p>";
  return `<table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c ?? "N/A")}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

function esc(v: any) {
  return String(v ?? "N/A")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const headerStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 20 };
const eyebrowStyle: React.CSSProperties = { fontSize: 12, letterSpacing: "0.08em", color: "#6b7280", fontWeight: 800 };
const sectionStyle: React.CSSProperties = { border: "1px solid #d1d5db", borderRadius: 14, padding: 18, marginBottom: 20, background: "white" };
const gridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14 };
const twoColumnGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 20 };
const alertGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 };
const alertStyle: React.CSSProperties = { padding: 14, borderRadius: 12, border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", fontWeight: 700 };
const infoCardStyle: React.CSSProperties = { border: "1px solid #e5e7eb", borderRadius: 10, padding: 12, background: "#f9fafb", marginBottom: 10 };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", minWidth: 950 };
const thStyle: React.CSSProperties = { border: "1px solid #d1d5db", padding: 10, background: "#f3f4f6", textAlign: "left", fontSize: 13 };
const tdStyle: React.CSSProperties = { border: "1px solid #d1d5db", padding: 10, fontSize: 13, verticalAlign: "top" };
const primaryButtonStyle: React.CSSProperties = { padding: "10px 14px", background: "#2563eb", color: "white", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 700 };
