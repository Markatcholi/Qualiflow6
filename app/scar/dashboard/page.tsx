"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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

  const criticalSupplierRows = suppliers.filter(
    (s) => s.supplier_risk_level === "Critical"
  );

  const highRiskSupplierRows = suppliers.filter(
    (s) => s.supplier_risk_level === "High"
  );

  const overdueScarSuppliers = suppliers.filter(
    (s) => Number(s.overdue_scars || 0) > 0
  );

  const notEffectiveScarSuppliers = suppliers.filter(
    (s) => Number(s.not_effective_scars || 0) > 0
  );

  const recurringSupplierIssueRows = suppliers.filter(
    (s) => Number(s.recurring_ncmrs || 0) > 0
  );

  const executiveReviewSuppliers = suppliers.filter(
    (s) =>
      Number(s.supplier_escalation_level || 1) >= 3 ||
      s.supplier_governance_status === "executive_review" ||
      s.supplier_governance_status === "disqualification_risk"
  );

  const suppliersWithMultipleOpenScars = suppliers.filter(
    (s) => Number(s.open_scars || 0) >= 3
  );

  const topRiskSuppliers = [...suppliers]
    .sort(
      (a, b) =>
        Number(b.supplier_risk_score || 0) - Number(a.supplier_risk_score || 0)
    )
    .slice(0, 10);

  const topOpenScarSuppliers = [...suppliers]
    .sort((a, b) => Number(b.open_scars || 0) - Number(a.open_scars || 0))
    .filter((s) => Number(s.open_scars || 0) > 0)
    .slice(0, 10);

  const topOverdueScarSuppliers = [...suppliers]
    .sort((a, b) => Number(b.overdue_scars || 0) - Number(a.overdue_scars || 0))
    .filter((s) => Number(s.overdue_scars || 0) > 0)
    .slice(0, 10);

  const topRecurringNcmrSuppliers = [...suppliers]
    .sort((a, b) => Number(b.recurring_ncmrs || 0) - Number(a.recurring_ncmrs || 0))
    .filter((s) => Number(s.recurring_ncmrs || 0) > 0)
    .slice(0, 10);

  const riskDistribution = useMemo(() => {
    const counts: Record<string, number> = {
      Critical: 0,
      High: 0,
      Medium: 0,
      Low: 0,
    };

    suppliers.forEach((supplier) => {
      const level = supplier.supplier_risk_level || "Low";
      counts[level] = (counts[level] || 0) + 1;
    });

    return Object.entries(counts).map(([label, value]) => ({ label, value }));
  }, [suppliers]);

  const governanceDistribution = useMemo(() => {
    const counts: Record<string, number> = {};

    suppliers.forEach((supplier) => {
      const status = supplier.supplier_governance_status || "routine";
      counts[status] = (counts[status] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [suppliers]);

  const totalSupplierNcmrs = suppliers.reduce(
    (sum, s) => sum + Number(s.supplier_ncmrs || 0),
    0
  );

  const supplierScarExposureRate =
    suppliers.length > 0
      ? Number(
          (
            (suppliers.filter((s) => Number(s.open_scars || 0) > 0).length /
              suppliers.length) *
            100
          ).toFixed(1)
        )
      : 0;

  const supplierRecurrenceRate =
    suppliers.length > 0
      ? Number(
          (
            (suppliers.filter((s) => Number(s.recurring_ncmrs || 0) > 0).length /
              suppliers.length) *
            100
          ).toFixed(1)
        )
      : 0;

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

          <Link href="/supplier-quality-dashboard">
            <button style={darkButtonStyle}>Supplier Quality Dashboard</button>
          </Link>

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
        <div>
          <div style={eyebrowStyle}>EXECUTIVE ESCALATION ENGINE</div>
          <h2 style={{ margin: "6px 0" }}>Action Required</h2>
          <p style={{ color: "#4b5563", marginTop: 0 }}>
            Prioritized supplier signals requiring leadership attention,
            supplier follow-up, SCAR escalation, or governance action.
          </p>
        </div>

        <div style={escalationGridStyle}>
          <EscalationCard
            title="Critical Suppliers"
            count={criticalSupplierRows.length}
            severity={criticalSupplierRows.length > 0 ? "high" : "controlled"}
            items={criticalSupplierRows}
            description="Suppliers currently classified as critical risk."
          />

          <EscalationCard
            title="High Risk Suppliers"
            count={highRiskSupplierRows.length}
            severity={highRiskSupplierRows.length > 0 ? "medium" : "controlled"}
            items={highRiskSupplierRows}
            description="Suppliers requiring increased monitoring or governance action."
          />

          <EscalationCard
            title="Overdue SCARs"
            count={totalOverdueScars}
            severity={totalOverdueScars > 0 ? "high" : "controlled"}
            items={overdueScarSuppliers}
            description="Suppliers with overdue SCAR responses or actions."
            metricField="overdue_scars"
            metricLabel="Overdue SCARs"
          />

          <EscalationCard
            title="Failed Effectiveness"
            count={totalNotEffectiveScars}
            severity={totalNotEffectiveScars > 0 ? "high" : "controlled"}
            items={notEffectiveScarSuppliers}
            description="Suppliers with SCAR effectiveness checks marked not effective."
            metricField="not_effective_scars"
            metricLabel="Not Effective"
          />

          <EscalationCard
            title="Recurring Supplier Issues"
            count={totalRecurringNcmrs}
            severity={totalRecurringNcmrs > 0 ? "medium" : "controlled"}
            items={recurringSupplierIssueRows}
            description="Suppliers with recurring NCMR signals."
            metricField="recurring_ncmrs"
            metricLabel="Recurring NCMRs"
          />

          <EscalationCard
            title="Executive Review Required"
            count={executiveReviewSuppliers.length}
            severity={executiveReviewSuppliers.length > 0 ? "high" : "controlled"}
            items={executiveReviewSuppliers}
            description="Suppliers with escalation level 3 or higher."
          />

          <EscalationCard
            title="Multiple Open SCARs"
            count={suppliersWithMultipleOpenScars.length}
            severity={suppliersWithMultipleOpenScars.length > 0 ? "medium" : "controlled"}
            items={suppliersWithMultipleOpenScars}
            description="Suppliers with three or more open SCARs."
            metricField="open_scars"
            metricLabel="Open SCARs"
          />
        </div>
      </section>

      <section style={sectionStyle}>
        <div>
          <div style={eyebrowStyle}>SUPPLIER SLA & GOVERNANCE INTELLIGENCE</div>
          <h2 style={{ margin: "6px 0" }}>SCAR Exposure and Supplier Risk Control</h2>
          <p style={{ color: "#4b5563", marginTop: 0 }}>
            Aggregated supplier governance indicators using supplier risk,
            SCAR exposure, recurring supplier NCMRs, and effectiveness signals.
          </p>
        </div>

        <div style={kpiGridStyle}>
          <KpiCard
            title="Supplier SCAR Exposure"
            value={supplierScarExposureRate}
            suffix="%"
            color={supplierScarExposureRate > 25 ? "#d97706" : "#15803d"}
          />

          <KpiCard
            title="Supplier Recurrence Rate"
            value={supplierRecurrenceRate}
            suffix="%"
            color={supplierRecurrenceRate > 25 ? "#dc2626" : "#15803d"}
          />

          <KpiCard
            title="Supplier NCMRs"
            value={totalSupplierNcmrs}
            color="#7c3aed"
          />

          <KpiCard
            title="Suppliers with ≥3 Open SCARs"
            value={suppliersWithMultipleOpenScars.length}
            color={suppliersWithMultipleOpenScars.length > 0 ? "#d97706" : "#15803d"}
          />
        </div>
      </section>

      <section style={sectionStyle}>
        <div>
          <div style={eyebrowStyle}>SUPPLIER RANKING INTELLIGENCE</div>
          <h2 style={{ margin: "6px 0" }}>Risk and Recurrence Ranking</h2>
          <p style={{ color: "#4b5563", marginTop: 0 }}>
            Supplier ranking views for management review, supplier quality
            governance, and executive follow-up.
          </p>
        </div>

        <div style={rankingGridStyle}>
          <RankingCard
            title="Top Risk Suppliers"
            suppliers={topRiskSuppliers}
            metricLabel="Risk Score"
            metricField="supplier_risk_score"
          />

          <RankingCard
            title="Top Suppliers by Open SCARs"
            suppliers={topOpenScarSuppliers}
            metricLabel="Open SCARs"
            metricField="open_scars"
          />

          <RankingCard
            title="Top Suppliers by Overdue SCARs"
            suppliers={topOverdueScarSuppliers}
            metricLabel="Overdue SCARs"
            metricField="overdue_scars"
          />

          <RankingCard
            title="Top Suppliers by Recurrence"
            suppliers={topRecurringNcmrSuppliers}
            metricLabel="Recurring NCMRs"
            metricField="recurring_ncmrs"
          />
        </div>
      </section>

      <section style={sectionStyle}>
        <div>
          <div style={eyebrowStyle}>SUPPLIER TREND INTELLIGENCE</div>
          <h2 style={{ margin: "6px 0" }}>Risk and Governance Distribution</h2>
          <p style={{ color: "#4b5563", marginTop: 0 }}>
            Management review view of supplier risk distribution and governance
            status distribution.
          </p>
        </div>

        <div style={rankingGridStyle}>
          <section style={miniPanelStyle}>
            <h3 style={{ marginTop: 0 }}>Supplier Risk Distribution</h3>
            <MiniBarChart data={riskDistribution} />
          </section>

          <section style={miniPanelStyle}>
            <h3 style={{ marginTop: 0 }}>Governance Status Distribution</h3>
            <MiniBarChart data={governanceDistribution} />
          </section>
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
  suffix = "",
}: {
  title: string;
  value: number;
  color: string;
  suffix?: string;
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
        {suffix}
      </div>
    </div>
  );
}


function EscalationCard({
  title,
  count,
  severity,
  items,
  description,
  metricField,
  metricLabel,
}: {
  title: string;
  count: number;
  severity: "controlled" | "medium" | "high";
  items: SupplierRiskRow[];
  description: string;
  metricField?: keyof SupplierRiskRow;
  metricLabel?: string;
}) {
  const color =
    severity === "high"
      ? "#dc2626"
      : severity === "medium"
      ? "#d97706"
      : "#15803d";

  return (
    <div style={{ ...escalationCardStyle, borderLeft: `8px solid ${color}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "10px" }}>
        <div>
          <h3 style={{ margin: "0 0 4px 0" }}>{title}</h3>
          <p style={{ color: "#6b7280", margin: 0 }}>{description}</p>
        </div>

        <div style={{ fontSize: "30px", fontWeight: 800, color }}>{count}</div>
      </div>

      <div style={{ marginTop: "14px" }}>
        {items.length === 0 ? (
          <div style={{ color: "#15803d", fontWeight: 700 }}>
            No escalation required.
          </div>
        ) : (
          items.slice(0, 5).map((supplier) => (
            <div key={supplier.id} style={escalationItemStyle}>
              <Link href={`/suppliers/${supplier.id}`} style={{ fontWeight: 700 }}>
                {supplier.supplier_name || "Unnamed Supplier"}
              </Link>
              <div style={subTextStyle}>
                Risk: {supplier.supplier_risk_level || "Low"} | Score:{" "}
                {supplier.supplier_risk_score ?? 0} | Escalation Level:{" "}
                {supplier.supplier_escalation_level || 1}
              </div>
              {metricField ? (
                <div style={subTextStyle}>
                  {metricLabel}: {Number(supplier[metricField] || 0)}
                </div>
              ) : null}
            </div>
          ))
        )}

        {items.length > 5 ? (
          <div style={{ ...subTextStyle, marginTop: "8px" }}>
            + {items.length - 5} more
          </div>
        ) : null}
      </div>
    </div>
  );
}

function RankingCard({
  title,
  suppliers,
  metricLabel,
  metricField,
}: {
  title: string;
  suppliers: SupplierRiskRow[];
  metricLabel: string;
  metricField: keyof SupplierRiskRow;
}) {
  return (
    <section style={miniPanelStyle}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>

      {suppliers.length === 0 ? (
        <p style={{ color: "#6b7280" }}>No supplier data available.</p>
      ) : (
        suppliers.map((supplier) => (
          <div key={supplier.id} style={rankingRowStyle}>
            <div>
              <Link href={`/suppliers/${supplier.id}`}>
                <strong>{supplier.supplier_name || "Unnamed Supplier"}</strong>
              </Link>
              <div style={subTextStyle}>
                {supplier.supplier_number || "No supplier number"} |{" "}
                {supplier.supplier_risk_level || "Low"}
              </div>
            </div>

            <strong>{Number(supplier[metricField] || 0)}</strong>
          </div>
        ))
      )}

      <div style={{ ...subTextStyle, marginTop: "8px" }}>{metricLabel}</div>
    </section>
  );
}

function MiniBarChart({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map((item) => item.value), 1);

  return (
    <div>
      {data.map((item) => {
        const width = item.value > 0 ? Math.max((item.value / max) * 100, 6) : 0;

        return (
          <div key={item.label} style={{ marginBottom: "12px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "13px",
                marginBottom: "4px",
              }}
            >
              <span>{formatLabel(item.label)}</span>
              <strong>{item.value}</strong>
            </div>

            <div
              style={{
                height: "12px",
                background: "#e5e7eb",
                borderRadius: "999px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "12px",
                  width: `${width}%`,
                  background: "#2563eb",
                  borderRadius: "999px",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

const formatLabel = (value: string) =>
  String(value || "Unspecified")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

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

const darkButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: "#111827",
};


const escalationGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: "16px",
  marginTop: "18px",
};

const escalationCardStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: "14px",
  padding: "16px",
  background: "#f9fafb",
};

const escalationItemStyle: React.CSSProperties = {
  borderTop: "1px solid #e5e7eb",
  paddingTop: "10px",
  marginTop: "10px",
};

const rankingGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: "16px",
  marginTop: "16px",
};

const miniPanelStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: "14px",
  padding: "16px",
  background: "#f9fafb",
};

const rankingRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  borderBottom: "1px solid #e5e7eb",
  padding: "10px 0",
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
