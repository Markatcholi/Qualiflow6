"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [riskDashboard, setRiskDashboard] = useState<any[]>([]);
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

  const fetchSupplierRiskDashboard = async () => {
    const { data, error } = await supabase
      .from("supplier_risk_dashboard")
      .select("*");

    if (error) {
      console.warn(error.message);
      return;
    }

    setRiskDashboard(data || []);
  };

  useEffect(() => {
    fetchSuppliers();
    fetchSupplierRiskDashboard();
  }, [search]);

  const totalSuppliers = suppliers.length;

  const criticalSuppliers = riskDashboard.filter(
    (supplier) => supplier.supplier_risk_level === "Critical"
  ).length;

  const highRiskSuppliers = riskDashboard.filter(
    (supplier) => supplier.supplier_risk_level === "High"
  ).length;

  const totalOpenScars = riskDashboard.reduce(
    (sum, supplier) => sum + Number(supplier.open_scars || 0),
    0
  );

  const totalRecurringNcmrs = riskDashboard.reduce(
    (sum, supplier) => sum + Number(supplier.recurring_ncmrs || 0),
    0
  );

  return (
    <main
      style={{
        padding: "24px",
        fontFamily: "Arial, sans-serif",
        background: "#f8fafc",
        minHeight: "100vh",
      }}
    >
      <div style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>SUPPLIER QUALITY MANAGEMENT</div>

          <h1 style={{ margin: "6px 0" }}>
            Supplier Quality Intelligence
          </h1>

          <p style={{ margin: 0, color: "#4b5563" }}>
            Supplier master data, operational supplier quality dashboard,
            scorecards, SCAR governance, risk escalation, audits, documents,
            and qualification status.
          </p>
        </div>

        <Link href="/suppliers/new">
          <button style={primaryButtonStyle}>
            Add Supplier
          </button>
        </Link>
      </div>

      <section style={sectionStyle}>
        <h2 style={{ marginTop: 0 }}>
          Supplier Intelligence Overview
        </h2>

        <div style={kpiGridStyle}>
          <KpiCard
            title="Total Suppliers"
            value={totalSuppliers}
            color="#2563eb"
          />

          <KpiCard
            title="Critical Suppliers"
            value={criticalSuppliers}
            color="#dc2626"
          />

          <KpiCard
            title="High Risk Suppliers"
            value={highRiskSuppliers}
            color="#ea580c"
          />

          <KpiCard
            title="Open SCARs"
            value={totalOpenScars}
            color="#7c3aed"
          />

          <KpiCard
            title="Recurring Supplier NCMRs"
            value={totalRecurringNcmrs}
            color="#b91c1c"
          />
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={{ marginTop: 0 }}>
          Supplier Quality Navigation
        </h2>

        <div style={navGridStyle}>
          <NavigationCard
            title="Supplier Quality Dashboard"
            description="Operational supplier quality performance, supplier KPIs, supplier-linked NCMRs, defect trends, recurrence signals, and supplier quality score."
            href="/supplier-quality-dashboard"
            badge="Operational Intelligence"
            color="#2563eb"
          />

          <NavigationCard
            title="Supplier Governance Dashboard"
            description="Supplier risk score, escalation level, recurrence intelligence, and governance decision support."
            href="/scar/dashboard"
            badge="Risk Intelligence"
            color="#dc2626"
          />

          <NavigationCard
            title="Supplier Scorecards"
            description="Supplier performance history, quality performance, responsiveness, and supplier health."
            href="/supplier-quality/scorecards"
            badge="Scorecards"
            color="#7c3aed"
          />

          <NavigationCard
            title="SCAR Management"
            description="Supplier corrective action records, supplier responses, effectiveness verification, and closure."
            href="/supplier-quality/scars"
            badge="SCAR"
            color="#ea580c"
          />

          <NavigationCard
            title="Supplier Audits"
            description="Supplier audits, findings, corrective actions, and supplier audit history."
            href="/supplier-quality/audits"
            badge="Audits"
            color="#0f766e"
          />

          <NavigationCard
            title="Supplier Documents"
            description="Supplier certificates, quality agreements, ISO records, and controlled supplier documents."
            href="/supplier-quality/documents"
            badge="Documents"
            color="#374151"
          />

          <NavigationCard
            title="ASL / Qualification"
            description="Approved supplier list status, supplier qualification status, probation, and disqualification controls."
            href="/supplier-quality/asl"
            badge="Qualification"
            color="#9333ea"
          />

          <NavigationCard
            title="Receiving Inspection"
            description="Receiving inspection route is not connected yet. Disabled to prevent 404 until the receiving inspection module is created."
            badge="Route Pending"
            color="#0891b2"
            disabled
          />
        </div>
      </section>

      <section style={sectionStyle}>
        <div style={tableHeaderStyle}>
          <div>
            <h2 style={{ marginTop: 0 }}>
              Supplier List
            </h2>

            <p style={{ marginTop: 0, color: "#4b5563" }}>
              Supplier master list with quality, status, risk, and record access.
            </p>
          </div>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search supplier"
            style={searchInputStyle}
          />
        </div>

        {loading ? (
          <p>Loading suppliers...</p>
        ) : suppliers.length === 0 ? (
          <p>No suppliers found.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
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
                {suppliers.map((supplier, index) => {
                  const riskRecord = riskDashboard.find(
                    (risk) => risk.id === supplier.id
                  );

                  return (
                    <tr key={supplier.id} style={stripedRowStyle(index)}>
                      <td style={tdStyle}>
                        {supplier.supplier_number || "N/A"}
                      </td>

                      <td style={tdStyle}>
                        <strong>
                          {supplier.supplier_name || "Unnamed Supplier"}
                        </strong>
                      </td>

                      <td style={tdStyle}>
                        {supplier.supplier_category || "N/A"}
                      </td>

                      <td style={tdStyle}>
                        {supplier.supplier_status || "N/A"}
                      </td>

                      <td style={tdStyle}>
                        <RiskBadge
                          level={
                            riskRecord?.supplier_risk_level ||
                            supplier.supplier_risk_level ||
                            "Low"
                          }
                        />

                        <div style={subTextStyle}>
                          Score:{" "}
                          {riskRecord?.supplier_risk_score ??
                            supplier.supplier_risk_score ??
                            0}
                        </div>
                      </td>

                      <td style={tdStyle}>
                        {supplier.iso_expiration_date || "N/A"}
                      </td>

                      <td style={tdStyle}>
                        <div
                          style={{
                            display: "flex",
                            gap: "10px",
                            flexWrap: "wrap",
                          }}
                        >
                          <Link href={`/suppliers/${supplier.id}`}>
                            Open Supplier
                          </Link>

                          <Link href="/supplier-quality-dashboard">
                            Quality Dashboard
                          </Link>

                          <Link href="/scar/dashboard">
                            Governance
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function KpiCard({
  title,
  value,
  color,
}: {
  title: string;
  value: number;
  color: string;
}) {
  return (
    <div
      style={{
        borderRadius: "14px",
        padding: "18px",
        background: "white",
        border: "1px solid #e5e7eb",
        borderLeft: `6px solid ${color}`,
        boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
      }}
    >
      <div
        style={{
          color: "#6b7280",
          fontSize: "13px",
          fontWeight: 700,
          marginBottom: "8px",
        }}
      >
        {title}
      </div>

      <div
        style={{
          fontSize: "30px",
          fontWeight: 800,
          color,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function NavigationCard({
  title,
  description,
  href,
  badge,
  color,
  disabled = false,
}: {
  title: string;
  description: string;
  href?: string;
  badge: string;
  color: string;
  disabled?: boolean;
}) {
  const card = (
    <div
      style={{
        borderRadius: "16px",
        padding: "20px",
        background: disabled ? "#f9fafb" : "white",
        border: "1px solid #e5e7eb",
        borderTop: `5px solid ${color}`,
        boxShadow: disabled ? "none" : "0 1px 4px rgba(0,0,0,0.08)",
        minHeight: "150px",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.72 : 1,
      }}
    >
      <div
        style={{
          display: "inline-block",
          padding: "4px 10px",
          borderRadius: "999px",
          background: disabled ? "#f3f4f6" : "#eff6ff",
          color,
          border: "1px solid #bfdbfe",
          fontSize: "12px",
          fontWeight: 700,
          marginBottom: "12px",
        }}
      >
        {badge}
      </div>

      <h3 style={{ marginTop: 0, marginBottom: "8px" }}>
        {title}
      </h3>

      <p
        style={{
          color: "#4b5563",
          lineHeight: 1.5,
          marginBottom: 0,
        }}
      >
        {description}
      </p>
    </div>
  );

  if (disabled || !href) return card;

  return (
    <Link
      href={href}
      style={{
        textDecoration: "none",
        color: "inherit",
      }}
    >
      {card}
    </Link>
  );
}

function RiskBadge({ level }: { level: string }) {
  const normalized = level.toLowerCase();

  let background = "#dcfce7";
  let color = "#166534";
  let border = "#bbf7d0";

  if (normalized === "medium") {
    background = "#fef3c7";
    color = "#92400e";
    border = "#fde68a";
  }

  if (normalized === "high") {
    background = "#ffedd5";
    color = "#9a3412";
    border = "#fed7aa";
  }

  if (normalized === "critical") {
    background = "#fee2e2";
    color = "#991b1b";
    border = "#fecaca";
  }

  return (
    <span
      style={{
        display: "inline-block",
        padding: "5px 10px",
        borderRadius: "999px",
        background,
        color,
        border: `1px solid ${border}`,
        fontWeight: 700,
        fontSize: "12px",
      }}
    >
      {level}
    </span>
  );
}

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "20px",
  alignItems: "flex-start",
  marginBottom: "22px",
};

const eyebrowStyle: React.CSSProperties = {
  fontSize: "12px",
  letterSpacing: "0.08em",
  color: "#6b7280",
  fontWeight: 800,
};

const sectionStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: "14px",
  padding: "20px",
  marginBottom: "20px",
  background: "white",
};

const kpiGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "14px",
};

const navGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "16px",
};

const tableHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "16px",
  alignItems: "flex-start",
  marginBottom: "16px",
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "10px 14px",
  background: "#2563eb",
  color: "white",
  borderRadius: "8px",
  border: "none",
  cursor: "pointer",
  fontWeight: 700,
};

const searchInputStyle: React.CSSProperties = {
  padding: "10px",
  width: "300px",
  borderRadius: "8px",
  border: "1px solid #d1d5db",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: "950px",
};

const thStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  padding: "10px",
  background: "#f3f4f6",
  textAlign: "left",
  fontSize: "13px",
};

const tdStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  padding: "10px",
  verticalAlign: "top",
  fontSize: "13px",
};

const subTextStyle: React.CSSProperties = {
  color: "#6b7280",
  fontSize: "12px",
  marginTop: "4px",
};

const stripedRowStyle = (
  index: number
): React.CSSProperties => ({
  background: index % 2 === 0 ? "#ffffff" : "#f9fafb",
});
