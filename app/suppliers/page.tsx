"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import {
  StatusBadge,
  EmptyStateCard,
  primaryButtonStyle,
} from "../components/workflow/WorkflowComponents";

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchSuppliers = async () => {
    setLoading(true);

    let query = supabase
      .from("suppliers")
      .select("*")
      .order("supplier_name", { ascending: true });

    if (search.trim()) {
      query = query.ilike("supplier_name", `%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setSuppliers(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchSuppliers();
  }, [search]);

  const navCardStyle: React.CSSProperties = {
    border: "1px solid #d1d5db",
    borderRadius: "10px",
    padding: "14px",
    background: "white",
    textDecoration: "none",
    color: "#111827",
    fontWeight: 600,
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    transition: "0.2s",
  };

  return (
    <main style={{ padding: "24px", fontFamily: "Arial" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ marginBottom: "6px" }}>Supplier Quality Management</h1>
          <p style={{ color: "#4b5563", marginTop: 0 }}>
            Supplier qualification, audits, scorecards, receiving inspection,
            SCAR management, supplier documents, ASL governance, and supplier
            quality oversight.
          </p>
        </div>

        <Link href="/suppliers/new">
          <button style={primaryButtonStyle}>Add Supplier</button>
        </Link>
      </div>

      <section
        style={{
          border: "1px solid #d1d5db",
          borderRadius: "12px",
          padding: "16px",
          marginBottom: "24px",
          background: "#f9fafb",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Supplier Quality Navigation</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "14px",
            marginTop: "14px",
          }}
        >
          <Link href="/suppliers" style={navCardStyle}>
            <span>Supplier List</span>
            <small style={{ color: "#6b7280" }}>
              View and manage suppliers
            </small>
          </Link>

          <Link href="/supplier-quality-dashboard" style={navCardStyle}>
            <span>Supplier Dashboard</span>
            <small style={{ color: "#6b7280" }}>
              Supplier quality KPIs and trends
            </small>
          </Link>

          <Link href="/supplier-quality/scorecards" style={navCardStyle}>
            <span>Supplier Scorecards</span>
            <small style={{ color: "#6b7280" }}>
              Supplier performance monitoring
            </small>
          </Link>

          <Link href="/supplier-quality/scars" style={navCardStyle}>
            <span>SCAR Management</span>
            <small style={{ color: "#6b7280" }}>
              Supplier corrective actions
            </small>
          </Link>

          <Link href="/supplier-quality/audits" style={navCardStyle}>
            <span>Supplier Audits</span>
            <small style={{ color: "#6b7280" }}>
              Global audit register and audit creation
            </small>
          </Link>

          <Link
            href="/supplier-quality/receiving-inspections"
            style={navCardStyle}
          >
            <span>Receiving Inspection</span>
            <small style={{ color: "#6b7280" }}>
              Global inspection register for enabled suppliers
            </small>
          </Link>

          <Link href="/supplier-quality/documents" style={navCardStyle}>
            <span>Supplier Documents</span>
            <small style={{ color: "#6b7280" }}>
              Global supplier document management
            </small>
          </Link>

          <div style={navCardStyle}>
            <span>ASL / Qualification</span>
            <small style={{ color: "#6b7280" }}>
              Controlled within each supplier profile.
            </small>
          </div>
        </div>
      </section>

      <div
        style={{
          marginBottom: "20px",
          display: "flex",
          gap: "12px",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search supplier"
          style={{
            padding: "10px",
            width: "320px",
            maxWidth: "100%",
          }}
        />

        <div style={{ color: "#6b7280" }}>
          {suppliers.length} supplier(s)
        </div>
      </div>

      {loading ? (
        <p>Loading suppliers...</p>
      ) : suppliers.length === 0 ? (
        <EmptyStateCard
          title="No suppliers found"
          message="Create a supplier to begin supplier qualification and quality management."
          action={
            <Link href="/suppliers/new">
              <button style={primaryButtonStyle}>Add Supplier</button>
            </Link>
          }
        />
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
          }}
        >
          <thead>
            <tr>
              <th style={thStyle}>Supplier Number</th>
              <th style={thStyle}>Supplier Name</th>
              <th style={thStyle}>Category</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Risk Level</th>
              <th style={thStyle}>ISO Expiration</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>

          <tbody>
            {suppliers.map((supplier) => (
              <tr key={supplier.id}>
                <td style={tdStyle}>{supplier.supplier_number || "N/A"}</td>

                <td style={tdStyle}>
                  <strong>{supplier.supplier_name || "Unnamed Supplier"}</strong>
                </td>

                <td style={tdStyle}>{supplier.supplier_category || "N/A"}</td>

                <td style={tdStyle}>
                  <StatusBadge status={supplier.supplier_status || "unknown"} />
                </td>

                <td style={tdStyle}>
                  <StatusBadge
                    status={supplier.supplier_risk_level || "unknown"}
                  />
                </td>

                <td style={tdStyle}>{supplier.iso_expiration_date || "N/A"}</td>

                <td style={tdStyle}>
                  <Link href={`/suppliers/${supplier.id}`}>Open Supplier</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}

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
