"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type SupplierRiskRow = {
  id: string;
  supplier_number?: string | null;
  supplier_name?: string | null;
  supplier_status?: string | null;
  supplier_category?: string | null;
  supplier_risk_score?: number | null;
  supplier_risk_level?: string | null;
  supplier_escalation_level?: number | null;
  supplier_governance_status?: string | null;
  last_risk_reviewed_at?: string | null;
  risk_rationale?: string | null;
  open_scars?: number | null;
  overdue_scars?: number | null;
  not_effective_scars?: number | null;
  supplier_ncmrs?: number | null;
  recurring_ncmrs?: number | null;
};

export default function ScarSupplierGovernanceDashboardPage() {
  const [suppliers, setSuppliers] = useState<SupplierRiskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [riskFilter, setRiskFilter] = useState("all");
  const [search, setSearch] = useState("");

  const fetchSupplierRiskDashboard = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("supplier_risk_dashboard")
      .select("*")
      .order("supplier_risk_score", { ascending: false });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setSuppliers(data || []);
    setLoading(false);
  };

  const recalculateSupplierRisks = async () => {
    const confirmed = window.confirm(
      "Recalculate supplier risk scores for all suppliers?"
    );

    if (!confirmed) return;

    const { error } = await supabase.rpc("recalculate_all_supplier_risks");

    if (error) {
      alert(error.message);
      return;
    }

    alert("Supplier risk scores recalculated.");
    fetchSupplierRiskDashboard();
  };

  useEffect(() => {
    fetchSupplierRiskDashboard();
  }, []);

  const filteredSuppliers = suppliers.filter((supplier) => {
    const supplierName = supplier.supplier_name || "";
    const supplierNumber = supplier.supplier_number || "";
    const riskLevel = supplier.supplier_risk_level || "Low";

    const matchesSearch =
      supplierName.toLowerCase().includes(search.toLowerCase()) ||
      supplierNumber.toLowerCase().includes(search.toLowerCase());

    const matchesRisk =
      riskFilter === "all" ||
      riskLevel.toLowerCase() === riskFilter.toLowerCase();

    return matchesSearch && matchesRisk;
  });

  const criticalSuppliers = suppliers.filter(
    (s) => s.supplier_risk_level === "Critical"
  ).length;

  const highRiskSuppliers = suppliers.filter(
    (s) => s.supplier_risk_level === "High"
  ).length;

  const mediumRiskSuppliers = suppliers.filter(
    (s) => s.supplier_risk_level === "Medium"
  ).length;

  const totalOpenScars = suppliers.reduce(
    (sum, s) => sum + Number(s.open_scars || 0),
    0
  );

  const totalOverdueScars = suppliers.reduce(
    (sum, s) => sum + Number(s.overdue_scars || 0),
    0
  );

  const totalNotEffectiveScars = suppliers.reduce(
    (sum, s) => sum + Number(s.not_effective_scars || 0),
    0
  );

  const totalRecurringNcmrs = suppliers.reduce(
    (sum, s) => sum + Number(s.recurring_ncmrs || 0),
    0
  );

  return (
    <main
      style={{
        padding: "28px",
        fontFamily: "Arial, sans-serif",
        background: "#f8fafc",
        minHeight: "100vh",
      }}
    >
      <div style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>SCAR MODERNIZATION</div>
          <h1 style={{ margin: "6px 0" }}>Supplier Governance Dashboard</h1>
          <p style={{ color: "#4b5563", marginTop: 0 }}>
            Supplier risk intelligence, escalation visibility, recurrence
            monitoring, and SCAR governance performance.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button onClick={recalculateSupplierRisks} style={buttonStyle}>
            Recalculate Supplier Risk
          </button>

          <Link href="/suppliers">
            <button style={secondaryButtonStyle}>Supplier List</button>
          </Link>

          <Link href="/supplier-quality/scars">
            <button style={secondaryButtonStyle}>SCAR Management</button>
          </Link>
        </div>
      </div>

      <section style={sectionStyle}>
        <h2 style={{ marginTop: 0 }}>Executive Supplier Risk Snapshot</h2>

        <div style={kpiGridStyle}>
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
            title="Medium Risk Suppliers"
            value={mediumRiskSuppliers}
            color="#d97706"
          />
          <KpiCard
            title="Open SCARs"
            value={totalOpenScars}
            color="#2563eb"
          />
          <KpiCard
            title="Overdue SCAR Responses"
            value={totalOverdueScars}
            color="#dc2626"
          />
          <KpiCard
            title="Not Effective SCARs"
            value={totalNotEffectiveScars}
            color="#b91c1c"
          />
          <KpiCard
            title="Recurring Supplier NCMRs"
            value={totalRecurringNcmrs}
            color="#7c2d12"
          />
          <KpiCard
            title="Suppliers Monitored"
            value={suppliers.length}
            color="#374151"
          />
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={{ marginTop: 0 }}>Supplier Governance Filters</h2>

        <div style={filterGridStyle}>
          <label>
            <strong>Search Supplier</strong>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by supplier name or number"
              style={inputStyle}
            />
          </label>

          <label>
            <strong>Risk Level</strong>
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              style={inputStyle}
            >
              <option value="all">All</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </label>
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={{ marginTop: 0 }}>Supplier Risk Governance Table</h2>

        {loading ? (
          <p>Loading supplier risk dashboard...</p>
        ) : filteredSuppliers.length === 0 ? (
          <p>No suppliers found for the selected criteria.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Supplier</th>
                  <th style={thStyle}>Risk Score</th>
                  <th style={thStyle}>Risk Level</th>
                  <th style={thStyle}>Escalation</th>
                  <th style={thStyle}>Governance Status</th>
                  <th style={thStyle}>Open SCARs</th>
                  <th style={thStyle}>Overdue SCARs</th>
                  <th style={thStyle}>Not Effective</th>
                  <th style={thStyle}>Supplier NCMRs</th>
                  <th style={thStyle}>Recurring NCMRs</th>
                  <th style={thStyle}>Last Reviewed</th>
                  <th style={thStyle}>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredSuppliers.map((supplier, index) => (
                  <tr key={supplier.id} style={stripedRowStyle(index)}>
                    <td style={tdStyle}>
                      <strong>{supplier.supplier_name || "Unnamed Supplier"}</strong>
                      <div style={subTextStyle}>
                        {supplier.supplier_number || "No supplier number"}
                      </div>
                      <div style={subTextStyle}>
                        {supplier.supplier_category || "No category"}
                      </div>
                    </td>

                    <td style={tdStyle}>
                      <strong style={{ fontSize: "18px" }}>
                        {supplier.supplier_risk_score ?? 0}
                      </strong>
                    </td>

                    <td style={tdStyle}>
                      <RiskBadge level={supplier.supplier_risk_level || "Low"} />
                    </td>

                    <td style={tdStyle}>
                      Level {supplier.supplier_escalation_level || 1}
                    </td>

                    <td style={tdStyle}>
                      <GovernanceBadge
                        status={supplier.supplier_governance_status || "routine"}
                      />
                    </td>

                    <td style={tdStyle}>{supplier.open_scars || 0}</td>
                    <td style={tdStyle}>{supplier.overdue_scars || 0}</td>
                    <td style={tdStyle}>{supplier.not_effective_scars || 0}</td>
                    <td style={tdStyle}>{supplier.supplier_ncmrs || 0}</td>
                    <td style={tdStyle}>{supplier.recurring_ncmrs || 0}</td>

                    <td style={tdStyle}>
                      {supplier.last_risk_reviewed_at || "N/A"}
                    </td>

                    <td style={tdStyle}>
                      <Link href={`/suppliers/${supplier.id}`}>
                        Open Supplier
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={sectionStyle}>
        <h2 style={{ marginTop: 0 }}>Supplier Governance Intelligence</h2>

        <div style={recommendationGridStyle}>
          <RecommendationCard
            title="Level 1 — Routine"
            description="Supplier performance is acceptable. Continue standard monitoring through routine supplier controls."
            color="#15803d"
          />

          <RecommendationCard
            title="Level 2 — Increased Monitoring"
            description="Supplier has moderate risk signals. Consider additional inspection, supplier communication, or enhanced monitoring."
            color="#d97706"
          />

          <RecommendationCard
            title="Level 3 — Executive Review"
            description="Supplier has high risk signals. Management review, escalation, or formal supplier improvement plan may be needed."
            color="#ea580c"
          />

          <RecommendationCard
            title="Level 4 — Disqualification Risk"
            description="Supplier has critical risk signals. Consider formal escalation, executive disposition, or qualification status review."
            color="#dc2626"
          />
        </div>
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

      <div style={{ fontSize: "30px", fontWeight: 800, color }}>
        {value}
      </div>
    </div>
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

function GovernanceBadge({ status }: { status: string }) {
  const label = status.replaceAll("_", " ");

  return (
    <span
      style={{
        display: "inline-block",
        padding: "5px 10px",
        borderRadius: "999px",
        background: "#eff6ff",
        color: "#1d4ed8",
        border: "1px solid #bfdbfe",
        fontWeight: 700,
        fontSize: "12px",
        textTransform: "capitalize",
      }}
    >
      {label}
    </span>
  );
}

function RecommendationCard({
  title,
  description,
  color,
}: {
  title: string;
  description: string;
  color: string;
}) {
  return (
    <div
      style={{
        borderRadius: "14px",
        padding: "18px",
        background: "white",
        border: "1px solid #e5e7eb",
        borderTop: `5px solid ${color}`,
      }}
    >
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <p style={{ color: "#4b5563", lineHeight: 1.6 }}>{description}</p>
    </div>
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

const filterGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "14px",
};

const recommendationGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "14px",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px",
  borderRadius: "8px",
  border: "1px solid #d1d5db",
  marginTop: "6px",
};

const buttonStyle: React.CSSProperties = {
  padding: "10px 14px",
  background: "#2563eb",
  color: "white",
  borderRadius: "8px",
  border: "none",
  cursor: "pointer",
  fontWeight: 700,
};

const secondaryButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: "#374151",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: "1200px",
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
  marginTop: "3px",
};

const stripedRowStyle = (index: number): React.CSSProperties => ({
  background: index % 2 === 0 ? "#ffffff" : "#f9fafb",
});
