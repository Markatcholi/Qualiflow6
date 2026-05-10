"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

export default function SupplierQualityScarsPage() {
  const [scars, setScars] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [riskFilter, setRiskFilter] = useState("");

  const fetchScars = async () => {
    setLoading(true);

    let query = supabase
      .from("scars")
      .select("*")
      .order("created_at", { ascending: false });

    if (statusFilter) query = query.eq("status", statusFilter);
    if (riskFilter) query = query.eq("risk_level", riskFilter);

    const { data, error } = await query;

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setScars(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchScars();
  }, [statusFilter, riskFilter]);

  return (
    <main style={{ padding: "24px", fontFamily: "Arial" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
        <h1>Supplier Corrective Action Requests (SCARs)</h1>
        <div>
          <Link href="/supplier-quality-dashboard" style={{ marginRight: "12px" }}>Supplier Dashboard</Link>
          <Link href="/supplier-quality/scars/new">Create SCAR</Link>
        </div>
      </div>

      <section style={sectionStyle}>
        <h2>Filters</h2>

        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: "8px", marginRight: "10px" }}>
          <option value="">All Statuses</option>
          <option value="open">Open</option>
          <option value="supplier_response_pending">Supplier Response Pending</option>
          <option value="quality_review">Quality Review</option>
          <option value="effectiveness_check">Effectiveness Check</option>
          <option value="closed">Closed</option>
        </select>

        <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)} style={{ padding: "8px", marginRight: "10px" }}>
          <option value="">All Risk Levels</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>

        <button onClick={() => { setStatusFilter(""); setRiskFilter(""); }}>Clear Filters</button>
      </section>

      {loading ? (
        <p>Loading SCARs...</p>
      ) : scars.length === 0 ? (
        <p>No SCAR records found.</p>
      ) : (
        <section style={sectionStyle}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>SCAR Number</th>
                <th style={thStyle}>Supplier</th>
                <th style={thStyle}>Title</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Risk</th>
                <th style={thStyle}>Due Date</th>
                <th style={thStyle}>Linked NCMR</th>
                <th style={thStyle}>Open</th>
              </tr>
            </thead>
            <tbody>
              {scars.map((scar) => (
                <tr key={scar.id}>
                  <td style={tdStyle}>{scar.scar_number || "SCAR-PENDING"}</td>
                  <td style={tdStyle}>{scar.supplier_name || "N/A"}</td>
                  <td style={tdStyle}>{scar.title || "Untitled SCAR"}</td>
                  <td style={tdStyle}>{scar.status || "open"}</td>
                  <td style={tdStyle}>{scar.risk_level || "N/A"}</td>
                  <td style={tdStyle}>{scar.due_date || "N/A"}</td>
                  <td style={tdStyle}>{scar.linked_ncmr_number || "N/A"}</td>
                  <td style={tdStyle}>
                    <Link href={`/supplier-quality/scars/${scar.id}`}>Open SCAR</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}

const sectionStyle: React.CSSProperties = { border: "1px solid #d1d5db", borderRadius: "10px", padding: "14px", marginBottom: "20px" };
const thStyle: React.CSSProperties = { border: "1px solid #d1d5db", padding: "10px", background: "#f3f4f6", textAlign: "left" };
const tdStyle: React.CSSProperties = { border: "1px solid #d1d5db", padding: "10px" };
