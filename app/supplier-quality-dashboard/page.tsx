"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function SupplierQualityDashboardPage() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [ncmrs, setNcmrs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [riskFilter, setRiskFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const fetchData = async () => {
    setLoading(true);

    const suppliersRes = await supabase
      .from("suppliers")
      .select("*")
      .order("supplier_name", { ascending: true });

    const ncmrRes = await supabase
      .from("ncmrs")
      .select("id, ncmr_number, title, status, severity, supplier_id, supplier_name, defect_category, defect_subcategory, created_at")
      .not("supplier_id", "is", null)
      .order("created_at", { ascending: false });

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

    setSuppliers(suppliersRes.data || []);
    setNcmrs(ncmrRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const supplierRows = useMemo(() => {
    return suppliers
      .filter((supplier) => (riskFilter ? supplier.supplier_risk_level === riskFilter : true))
      .filter((supplier) => (statusFilter ? supplier.supplier_status === statusFilter : true))
      .map((supplier) => {
        const supplierNcmrs = ncmrs.filter((ncmr) => ncmr.supplier_id === supplier.id);
        const openNcmrs = supplierNcmrs.filter((ncmr) => ncmr.status !== "closed");
        const majorCritical = supplierNcmrs.filter(
          (ncmr) => ncmr.severity === "major" || ncmr.severity === "critical"
        );

        const defectCounts: Record<string, number> = {};
        supplierNcmrs.forEach((ncmr) => {
          const key = ncmr.defect_category || "Uncategorized";
          defectCounts[key] = (defectCounts[key] || 0) + 1;
        });

        const topDefect = Object.entries(defectCounts).sort((a, b) => b[1] - a[1])[0];

        return {
          supplier,
          totalNcmrs: supplierNcmrs.length,
          openNcmrs: openNcmrs.length,
          majorCritical: majorCritical.length,
          topDefect: topDefect ? `${topDefect[0]} (${topDefect[1]})` : "N/A",
          latestNcmr: supplierNcmrs[0] || null,
        };
      })
      .sort((a, b) => b.openNcmrs - a.openNcmrs || b.totalNcmrs - a.totalNcmrs);
  }, [suppliers, ncmrs, riskFilter, statusFilter]);

  const totalSuppliers = suppliers.length;
  const highRiskSuppliers = suppliers.filter(
    (supplier) => supplier.supplier_risk_level === "high" || supplier.supplier_risk_level === "critical"
  ).length;
  const suppliersWithOpenNcmrs = supplierRows.filter((row) => row.openNcmrs > 0).length;
  const totalSupplierNcmrs = ncmrs.length;
  const openSupplierNcmrs = ncmrs.filter((ncmr) => ncmr.status !== "closed").length;

  if (loading) {
    return <main style={{ padding: "24px", fontFamily: "Arial" }}>Loading supplier quality dashboard...</main>;
  }

  return (
    <main style={{ padding: "24px", fontFamily: "Arial" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
        <h1>Supplier Quality Dashboard</h1>
        <div>
          <Link href="/suppliers" style={{ marginRight: "12px" }}>Supplier List</Link>
          <Link href="/suppliers/new">Add Supplier</Link>
        </div>
      </div>

      <section style={summaryGridStyle}>
        <MetricCard label="Total Suppliers" value={totalSuppliers} />
        <MetricCard label="High/Critical Risk Suppliers" value={highRiskSuppliers} />
        <MetricCard label="Supplier NCMRs" value={totalSupplierNcmrs} />
        <MetricCard label="Open Supplier NCMRs" value={openSupplierNcmrs} />
        <MetricCard label="Suppliers with Open NCMRs" value={suppliersWithOpenNcmrs} />
      </section>

      <section style={sectionStyle}>
        <h2>Filters</h2>

        <select
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value)}
          style={{ padding: "8px", marginRight: "10px", marginBottom: "8px" }}
        >
          <option value="">All Risk Levels</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ padding: "8px", marginRight: "10px", marginBottom: "8px" }}
        >
          <option value="">All Statuses</option>
          <option value="approved">Approved</option>
          <option value="conditional">Conditional</option>
          <option value="probation">Probation</option>
          <option value="disqualified">Disqualified</option>
        </select>

        <button
          onClick={() => {
            setRiskFilter("");
            setStatusFilter("");
          }}
        >
          Clear Filters
        </button>
      </section>

      <section style={sectionStyle}>
        <h2>Supplier Quality Performance</h2>

        {supplierRows.length === 0 ? (
          <p>No supplier records match the selected filters.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Supplier</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Risk</th>
                <th style={thStyle}>Total NCMRs</th>
                <th style={thStyle}>Open NCMRs</th>
                <th style={thStyle}>Major/Critical</th>
                <th style={thStyle}>Top Defect</th>
                <th style={thStyle}>Latest NCMR</th>
              </tr>
            </thead>

            <tbody>
              {supplierRows.map((row) => (
                <tr key={row.supplier.id}>
                  <td style={tdStyle}>
                    <Link href={`/suppliers/${row.supplier.id}`}>
                      {row.supplier.supplier_name}
                    </Link>
                    <div style={{ color: "#6b7280", fontSize: "12px" }}>
                      {row.supplier.supplier_number || "No supplier number"}
                    </div>
                  </td>
                  <td style={tdStyle}>{row.supplier.supplier_status || "N/A"}</td>
                  <td style={tdStyle}>{row.supplier.supplier_risk_level || "N/A"}</td>
                  <td style={tdStyle}>{row.totalNcmrs}</td>
                  <td style={tdStyle}>{row.openNcmrs}</td>
                  <td style={tdStyle}>{row.majorCritical}</td>
                  <td style={tdStyle}>{row.topDefect}</td>
                  <td style={tdStyle}>
                    {row.latestNcmr ? (
                      <Link href={`/ncmrs/${row.latestNcmr.id}`}>
                        {row.latestNcmr.ncmr_number || row.latestNcmr.title || "Open NCMR"}
                      </Link>
                    ) : (
                      "N/A"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section style={sectionStyle}>
        <h2>Recent Supplier-Linked NCMRs</h2>

        {ncmrs.length === 0 ? (
          <p>No supplier-linked NCMRs found.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>NCMR</th>
                <th style={thStyle}>Supplier</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Severity</th>
                <th style={thStyle}>Defect Category</th>
                <th style={thStyle}>Created</th>
              </tr>
            </thead>

            <tbody>
              {ncmrs.slice(0, 15).map((ncmr) => (
                <tr key={ncmr.id}>
                  <td style={tdStyle}>
                    <Link href={`/ncmrs/${ncmr.id}`}>
                      {ncmr.ncmr_number || ncmr.title || "Open NCMR"}
                    </Link>
                  </td>
                  <td style={tdStyle}>{ncmr.supplier_name || "N/A"}</td>
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
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: any }) {
  return (
    <div style={metricCardStyle}>
      <div style={{ color: "#4b5563", fontSize: "13px" }}>{label}</div>
      <div style={{ fontSize: "28px", fontWeight: "bold", marginTop: "6px" }}>{value}</div>
    </div>
  );
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

const thStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  padding: "10px",
  background: "#f3f4f6",
  textAlign: "left",
};

const tdStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  padding: "10px",
  verticalAlign: "top",
};
