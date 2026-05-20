"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type SupplierRow = {
  supplier: any;
  totalNcmrs: number;
  openNcmrs: number;
  closedNcmrs: number;
  majorCritical: number;
  topDefect: string;
  latestNcmr: any | null;
  qualityScore: number;
  recurrenceSignal: "Low" | "Medium" | "High";
};

export default function SupplierQualityDashboardPage() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [ncmrs, setNcmrs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [riskFilter, setRiskFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  const fetchData = async () => {
    setLoading(true);

    const suppliersRes = await supabase
      .from("suppliers")
      .select("*")
      .order("supplier_name", { ascending: true });

    const ncmrRes = await supabase
      .from("ncmrs")
      .select(
        "id, ncmr_number, title, status, severity, supplier_id, supplier_name, defect_category, defect_subcategory, created_at"
      )
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

  const supplierRows: SupplierRow[] = useMemo(() => {
    return suppliers
      .filter((supplier) =>
        riskFilter ? normalizeRisk(supplier.supplier_risk_level) === riskFilter : true
      )
      .filter((supplier) =>
        statusFilter ? supplier.supplier_status === statusFilter : true
      )
      .filter((supplier) => {
        if (!search.trim()) return true;

        const name = supplier.supplier_name || "";
        const number = supplier.supplier_number || "";

        return (
          name.toLowerCase().includes(search.toLowerCase()) ||
          number.toLowerCase().includes(search.toLowerCase())
        );
      })
      .map((supplier) => {
        const supplierNcmrs = ncmrs.filter((ncmr) => ncmr.supplier_id === supplier.id);
        const openNcmrs = supplierNcmrs.filter((ncmr) => ncmr.status !== "closed");
        const closedNcmrs = supplierNcmrs.filter((ncmr) => ncmr.status === "closed");

        const majorCritical = supplierNcmrs.filter(
          (ncmr) =>
            normalizeRisk(ncmr.severity) === "major" ||
            normalizeRisk(ncmr.severity) === "critical" ||
            normalizeRisk(ncmr.severity) === "high"
        );

        const defectCounts: Record<string, number> = {};
        supplierNcmrs.forEach((ncmr) => {
          const key = ncmr.defect_category || "Uncategorized";
          defectCounts[key] = (defectCounts[key] || 0) + 1;
        });

        const topDefect = Object.entries(defectCounts).sort((a, b) => b[1] - a[1])[0];

        const baseScore = 100;
        const openPenalty = openNcmrs.length * 8;
        const majorPenalty = majorCritical.length * 12;
        const totalPenalty = supplierNcmrs.length > 5 ? 8 : 0;
        const statusPenalty =
          supplier.supplier_status === "probation"
            ? 15
            : supplier.supplier_status === "conditional"
            ? 8
            : supplier.supplier_status === "disqualified"
            ? 40
            : 0;

        const qualityScore = Math.max(
          0,
          Math.min(100, baseScore - openPenalty - majorPenalty - totalPenalty - statusPenalty)
        );

        const recurrenceSignal: "Low" | "Medium" | "High" =
          supplierNcmrs.length >= 4 || openNcmrs.length >= 2
            ? "High"
            : supplierNcmrs.length >= 2
            ? "Medium"
            : "Low";

        return {
          supplier,
          totalNcmrs: supplierNcmrs.length,
          openNcmrs: openNcmrs.length,
          closedNcmrs: closedNcmrs.length,
          majorCritical: majorCritical.length,
          topDefect: topDefect ? `${topDefect[0]} (${topDefect[1]})` : "N/A",
          latestNcmr: supplierNcmrs[0] || null,
          qualityScore,
          recurrenceSignal,
        };
      })
      .sort((a, b) => {
        return (
          b.openNcmrs - a.openNcmrs ||
          b.majorCritical - a.majorCritical ||
          b.totalNcmrs - a.totalNcmrs ||
          a.qualityScore - b.qualityScore
        );
      });
  }, [suppliers, ncmrs, riskFilter, statusFilter, search]);

  const totalSuppliers = suppliers.length;

  const highRiskSuppliers = suppliers.filter((supplier) => {
    const risk = normalizeRisk(supplier.supplier_risk_level);
    return risk === "high" || risk === "critical";
  }).length;

  const suppliersWithOpenNcmrs = supplierRows.filter((row) => row.openNcmrs > 0).length;
  const totalSupplierNcmrs = ncmrs.length;
  const openSupplierNcmrs = ncmrs.filter((ncmr) => ncmr.status !== "closed").length;
  const majorCriticalNcmrs = ncmrs.filter((ncmr) => {
    const severity = normalizeRisk(ncmr.severity);
    return severity === "major" || severity === "critical" || severity === "high";
  }).length;

  const averageSupplierQualityScore =
    supplierRows.length > 0
      ? Math.round(
          supplierRows.reduce((sum, row) => sum + row.qualityScore, 0) / supplierRows.length
        )
      : 100;

  const supplierRecurrenceRate =
    totalSuppliers > 0
      ? ((supplierRows.filter((row) => row.recurrenceSignal === "High").length / totalSuppliers) * 100).toFixed(1)
      : "0.0";

  const topRiskSuppliers = [...supplierRows]
    .sort((a, b) => a.qualityScore - b.qualityScore)
    .slice(0, 5);

  const defectCategoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    ncmrs.forEach((ncmr) => {
      const category = ncmr.defect_category || "Uncategorized";
      counts[category] = (counts[category] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [ncmrs]);

  const statusDistribution = useMemo(() => {
    const counts: Record<string, number> = {};

    suppliers.forEach((supplier) => {
      const status = supplier.supplier_status || "Unknown";
      counts[status] = (counts[status] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);
  }, [suppliers]);

  const monthlySupplierNcmrTrend = useMemo(() => {
    const months = getLast6Months();
    const counts: Record<string, number> = {};

    months.forEach((month) => {
      counts[month.key] = 0;
    });

    ncmrs.forEach((ncmr) => {
      if (!ncmr.created_at) return;

      const d = new Date(ncmr.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

      if (counts[key] !== undefined) {
        counts[key] += 1;
      }
    });

    return months.map((month) => ({
      label: month.label,
      count: counts[month.key],
    }));
  }, [ncmrs]);

  const operationalAlerts = [
    highRiskSuppliers > 0
      ? `${highRiskSuppliers} supplier(s) are currently high or critical risk.`
      : "",
    openSupplierNcmrs > 0
      ? `${openSupplierNcmrs} supplier-linked NCMR(s) remain open.`
      : "",
    majorCriticalNcmrs > 0
      ? `${majorCriticalNcmrs} supplier-linked NCMR(s) are major/critical.`
      : "",
    Number(supplierRecurrenceRate) > 25
      ? `Supplier recurrence rate is ${supplierRecurrenceRate}%, which may require supplier governance review.`
      : "",
  ].filter(Boolean);

  if (loading) {
    return (
      <main style={{ padding: "24px", fontFamily: "Arial, sans-serif" }}>
        Loading supplier quality dashboard...
      </main>
    );
  }

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
          <div style={eyebrowStyle}>SUPPLIER OPERATIONAL INTELLIGENCE</div>
          <h1 style={{ margin: "6px 0" }}>Supplier Quality Dashboard</h1>
          <p style={{ margin: 0, color: "#4b5563" }}>
            Operational supplier quality performance, supplier-linked NCMRs,
            defect concentration, supplier health, and recurrence signals.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <Link href="/suppliers">
            <button style={secondaryButtonStyle}>Supplier List</button>
          </Link>

          <Link href="/suppliers/new">
            <button style={primaryButtonStyle}>Add Supplier</button>
          </Link>

          <Link href="/scar/dashboard">
            <button style={darkButtonStyle}>Governance Dashboard</button>
          </Link>
        </div>
      </div>

      <section style={sectionStyle}>
        <h2 style={{ marginTop: 0 }}>Executive Supplier Quality Snapshot</h2>

        <div style={summaryGridStyle}>
          <MetricCard
            label="Supplier Quality Score"
            value={`${averageSupplierQualityScore}%`}
            color={scoreColor(averageSupplierQualityScore)}
            subtitle="Average supplier health"
          />

          <MetricCard
            label="Total Suppliers"
            value={totalSuppliers}
            color="#2563eb"
            subtitle="Suppliers monitored"
          />

          <MetricCard
            label="High/Critical Risk Suppliers"
            value={highRiskSuppliers}
            color={highRiskSuppliers > 0 ? "#dc2626" : "#15803d"}
            subtitle="Risk escalation watch"
          />

          <MetricCard
            label="Supplier NCMRs"
            value={totalSupplierNcmrs}
            color="#7c3aed"
            subtitle="Total supplier-linked NCMRs"
          />

          <MetricCard
            label="Open Supplier NCMRs"
            value={openSupplierNcmrs}
            color={openSupplierNcmrs > 0 ? "#dc2626" : "#15803d"}
            subtitle="Open operational exposure"
          />

          <MetricCard
            label="Recurrence Rate"
            value={`${supplierRecurrenceRate}%`}
            color={Number(supplierRecurrenceRate) > 25 ? "#dc2626" : "#15803d"}
            subtitle="Suppliers with high recurrence signal"
          />
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={{ marginTop: 0 }}>Operational Alerts</h2>

        {operationalAlerts.length === 0 ? (
          <p style={{ color: "#15803d", fontWeight: 700 }}>
            No significant supplier quality alerts identified.
          </p>
        ) : (
          <div style={alertGridStyle}>
            {operationalAlerts.map((alert, index) => (
              <div key={index} style={alertCardStyle}>
                {alert}
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={sectionStyle}>
        <h2 style={{ marginTop: 0 }}>Filters</h2>

        <div style={filterGridStyle}>
          <label>
            <strong>Search Supplier</strong>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search supplier name or number"
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
              <option value="">All Risk Levels</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </label>

          <label>
            <strong>Supplier Status</strong>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={inputStyle}
            >
              <option value="">All Statuses</option>
              <option value="approved">Approved</option>
              <option value="conditional">Conditional</option>
              <option value="probation">Probation</option>
              <option value="disqualified">Disqualified</option>
            </select>
          </label>

          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button
              onClick={() => {
                setRiskFilter("");
                setStatusFilter("");
                setSearch("");
              }}
              style={secondaryButtonStyle}
            >
              Clear Filters
            </button>
          </div>
        </div>
      </section>

      <div style={twoColumnGridStyle}>
        <section style={sectionStyle}>
          <h2 style={{ marginTop: 0 }}>Top Risk Suppliers</h2>

          {topRiskSuppliers.length === 0 ? (
            <p>No suppliers found.</p>
          ) : (
            <div>
              {topRiskSuppliers.map((row) => (
                <div key={row.supplier.id} style={rankedItemStyle}>
                  <div>
                    <Link href={`/suppliers/${row.supplier.id}`}>
                      <strong>{row.supplier.supplier_name || "Unnamed Supplier"}</strong>
                    </Link>
                    <div style={subTextStyle}>
                      Open NCMRs: {row.openNcmrs} | Major/Critical: {row.majorCritical}
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <QualityScoreBadge score={row.qualityScore} />
                    <div style={{ marginTop: "6px" }}>
                      <RiskBadge level={row.supplier.supplier_risk_level || "N/A"} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section style={sectionStyle}>
          <h2 style={{ marginTop: 0 }}>Top Defect Categories</h2>

          {defectCategoryCounts.length === 0 ? (
            <p>No defect category data available.</p>
          ) : (
            <MiniBarChart
              data={defectCategoryCounts.map((item) => ({
                label: item.category,
                value: item.count,
              }))}
            />
          )}
        </section>
      </div>

      <div style={twoColumnGridStyle}>
        <section style={sectionStyle}>
          <h2 style={{ marginTop: 0 }}>Supplier NCMR Monthly Trend</h2>

          <MiniBarChart
            data={monthlySupplierNcmrTrend.map((item) => ({
              label: item.label,
              value: item.count,
            }))}
          />
        </section>

        <section style={sectionStyle}>
          <h2 style={{ marginTop: 0 }}>Supplier Status Distribution</h2>

          {statusDistribution.length === 0 ? (
            <p>No supplier status data available.</p>
          ) : (
            <MiniBarChart
              data={statusDistribution.map((item) => ({
                label: item.status,
                value: item.count,
              }))}
            />
          )}
        </section>
      </div>

      <section style={sectionStyle}>
        <h2 style={{ marginTop: 0 }}>Supplier Quality Performance</h2>

        {supplierRows.length === 0 ? (
          <p>No supplier records match the selected filters.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Supplier</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Risk</th>
                  <th style={thStyle}>Quality Score</th>
                  <th style={thStyle}>Total NCMRs</th>
                  <th style={thStyle}>Open NCMRs</th>
                  <th style={thStyle}>Major/Critical</th>
                  <th style={thStyle}>Recurrence</th>
                  <th style={thStyle}>Top Defect</th>
                  <th style={thStyle}>Latest NCMR</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>

              <tbody>
                {supplierRows.map((row, index) => (
                  <tr key={row.supplier.id} style={stripedRowStyle(index)}>
                    <td style={tdStyle}>
                      <Link href={`/suppliers/${row.supplier.id}`}>
                        <strong>{row.supplier.supplier_name}</strong>
                      </Link>
                      <div style={subTextStyle}>
                        {row.supplier.supplier_number || "No supplier number"}
                      </div>
                    </td>

                    <td style={tdStyle}>
                      <StatusBadge status={row.supplier.supplier_status || "N/A"} />
                    </td>

                    <td style={tdStyle}>
                      <RiskBadge level={row.supplier.supplier_risk_level || "N/A"} />
                    </td>

                    <td style={tdStyle}>
                      <QualityScoreBadge score={row.qualityScore} />
                    </td>

                    <td style={tdStyle}>{row.totalNcmrs}</td>
                    <td style={tdStyle}>{row.openNcmrs}</td>
                    <td style={tdStyle}>{row.majorCritical}</td>

                    <td style={tdStyle}>
                      <RecurrenceBadge level={row.recurrenceSignal} />
                    </td>

                    <td style={tdStyle}>{row.topDefect}</td>

                    <td style={tdStyle}>
                      {row.latestNcmr ? (
                        <Link href={`/ncmrs/${row.latestNcmr.id}`}>
                          {row.latestNcmr.ncmr_number ||
                            row.latestNcmr.title ||
                            "Open NCMR"}
                        </Link>
                      ) : (
                        "N/A"
                      )}
                    </td>

                    <td style={tdStyle}>
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <Link href={`/suppliers/${row.supplier.id}`}>Supplier</Link>
                        <Link href="/scar/dashboard">Governance</Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={sectionStyle}>
        <h2 style={{ marginTop: 0 }}>Recent Supplier-Linked NCMRs</h2>

        {ncmrs.length === 0 ? (
          <p>No supplier-linked NCMRs found.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
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
                {ncmrs.slice(0, 15).map((ncmr, index) => (
                  <tr key={ncmr.id} style={stripedRowStyle(index)}>
                    <td style={tdStyle}>
                      <Link href={`/ncmrs/${ncmr.id}`}>
                        {ncmr.ncmr_number || ncmr.title || "Open NCMR"}
                      </Link>
                    </td>
                    <td style={tdStyle}>{ncmr.supplier_name || "N/A"}</td>
                    <td style={tdStyle}>
                      <StatusBadge status={ncmr.status || "N/A"} />
                    </td>
                    <td style={tdStyle}>
                      <RiskBadge level={ncmr.severity || "N/A"} />
                    </td>
                    <td style={tdStyle}>{ncmr.defect_category || "N/A"}</td>
                    <td style={tdStyle}>{formatDate(ncmr.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function MetricCard({
  label,
  value,
  color,
  subtitle,
}: {
  label: string;
  value: any;
  color: string;
  subtitle?: string;
}) {
  return (
    <div style={{ ...metricCardStyle, borderLeft: `6px solid ${color}` }}>
      <div style={{ color: "#4b5563", fontSize: "13px", fontWeight: 700 }}>
        {label}
      </div>
      <div style={{ fontSize: "30px", fontWeight: 800, marginTop: "6px", color }}>
        {value}
      </div>
      {subtitle ? (
        <div style={{ color: "#6b7280", fontSize: "12px", marginTop: "6px" }}>
          {subtitle}
        </div>
      ) : null}
    </div>
  );
}

function RiskBadge({ level }: { level: string }) {
  const normalized = normalizeRisk(level);

  let background = "#f3f4f6";
  let color = "#374151";
  let border = "#d1d5db";

  if (normalized === "low") {
    background = "#dcfce7";
    color = "#166534";
    border = "#bbf7d0";
  }

  if (normalized === "medium") {
    background = "#fef3c7";
    color = "#92400e";
    border = "#fde68a";
  }

  if (normalized === "high" || normalized === "major") {
    background = "#ffedd5";
    color = "#9a3412";
    border = "#fed7aa";
  }

  if (normalized === "critical") {
    background = "#fee2e2";
    color = "#991b1b";
    border = "#fecaca";
  }

  return <Pill label={level || "N/A"} background={background} color={color} border={border} />;
}

function StatusBadge({ status }: { status: string }) {
  const normalized = (status || "").toLowerCase();

  let background = "#f3f4f6";
  let color = "#374151";
  let border = "#d1d5db";

  if (normalized === "approved" || normalized === "closed") {
    background = "#dcfce7";
    color = "#166534";
    border = "#bbf7d0";
  }

  if (normalized === "conditional" || normalized === "probation" || normalized === "open") {
    background = "#fef3c7";
    color = "#92400e";
    border = "#fde68a";
  }

  if (normalized === "disqualified") {
    background = "#fee2e2";
    color = "#991b1b";
    border = "#fecaca";
  }

  return <Pill label={status || "N/A"} background={background} color={color} border={border} />;
}

function QualityScoreBadge({ score }: { score: number }) {
  const color = scoreColor(score);

  return (
    <span
      style={{
        display: "inline-block",
        minWidth: "58px",
        textAlign: "center",
        padding: "6px 10px",
        borderRadius: "10px",
        background: "#f9fafb",
        color,
        border: `1px solid ${color}`,
        fontWeight: 800,
        fontSize: "13px",
      }}
    >
      {score}%
    </span>
  );
}

function RecurrenceBadge({ level }: { level: "Low" | "Medium" | "High" }) {
  const color =
    level === "High" ? "#dc2626" : level === "Medium" ? "#d97706" : "#15803d";

  const background =
    level === "High" ? "#fee2e2" : level === "Medium" ? "#fef3c7" : "#dcfce7";

  return (
    <span
      style={{
        display: "inline-block",
        padding: "5px 10px",
        borderRadius: "999px",
        background,
        color,
        border: `1px solid ${color}`,
        fontWeight: 700,
        fontSize: "12px",
      }}
    >
      {level}
    </span>
  );
}

function Pill({
  label,
  background,
  color,
  border,
}: {
  label: string;
  background: string;
  color: string;
  border: string;
}) {
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
        textTransform: "capitalize",
      }}
    >
      {label}
    </span>
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
              <span>{item.label}</span>
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

function getLast6Months() {
  const months: { key: string; label: string }[] = [];
  const now = new Date();

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("en-US", {
      month: "short",
      year: "2-digit",
    });

    months.push({ key, label });
  }

  return months;
}

function normalizeRisk(value: string | null | undefined) {
  return (value || "").toLowerCase();
}

function scoreColor(score: number) {
  if (score >= 85) return "#15803d";
  if (score >= 70) return "#d97706";
  return "#dc2626";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "N/A";

  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return value;
  }
}

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "16px",
  alignItems: "flex-start",
  flexWrap: "wrap",
  marginBottom: "20px",
};

const eyebrowStyle: React.CSSProperties = {
  fontSize: "12px",
  letterSpacing: "0.08em",
  color: "#6b7280",
  fontWeight: 800,
};

const summaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: "14px",
};

const metricCardStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: "14px",
  padding: "16px",
  background: "#fff",
  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
};

const sectionStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: "14px",
  padding: "18px",
  marginBottom: "20px",
  background: "white",
};

const filterGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "14px",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px",
  borderRadius: "8px",
  border: "1px solid #d1d5db",
  marginTop: "6px",
};

const twoColumnGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
  gap: "20px",
};

const alertGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "12px",
};

const alertCardStyle: React.CSSProperties = {
  padding: "14px",
  borderRadius: "12px",
  border: "1px solid #fecaca",
  background: "#fef2f2",
  color: "#991b1b",
  fontWeight: 700,
};

const rankedItemStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: "12px",
  padding: "12px",
  marginBottom: "10px",
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  alignItems: "center",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: "1100px",
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

const primaryButtonStyle: React.CSSProperties = {
  padding: "10px 14px",
  background: "#2563eb",
  color: "white",
  borderRadius: "8px",
  border: "none",
  cursor: "pointer",
  fontWeight: 700,
};

const secondaryButtonStyle: React.CSSProperties = {
  ...primaryButtonStyle,
  background: "#374151",
};

const darkButtonStyle: React.CSSProperties = {
  ...primaryButtonStyle,
  background: "#111827",
};

const stripedRowStyle = (index: number): React.CSSProperties => ({
  background: index % 2 === 0 ? "#ffffff" : "#f9fafb",
});
