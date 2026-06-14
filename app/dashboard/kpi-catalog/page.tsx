"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { getCompanySettings } from "../../../lib/companySettings";

type KpiCatalogRow = {
  module_name: string;
  kpi_key: string;
  kpi_name: string;
  kpi_description?: string | null;
  kpi_category?: string | null;
  category?: string | null;
  calculation_type?: string | null;
  default_display_order?: number | null;
  enabled_by_default?: boolean | null;
  default_executive_dashboard?: boolean | null;
  default_management_review?: boolean | null;
  active?: boolean | null;
  source?: "standard" | "custom";
};

type CompanyKpiConfiguration = {
  company_name: string;
  module_name: string;
  kpi_key: string;
  executive_dashboard: boolean | null;
  management_review: boolean | null;
  display_order: number | null;
};

type CustomKpiDefinition = {
  id?: string;
  company_name: string;
  module_name: string;
  kpi_key: string;
  kpi_name: string;
  kpi_description?: string | null;
  kpi_category?: string | null;
  calculation_type: string;
  executive_dashboard?: boolean | null;
  management_review?: boolean | null;
  display_order?: number | null;
  active?: boolean | null;
};

type CatalogDisplayRow = {
  module_name: string;
  kpi_key: string;
  kpi_name: string;
  kpi_description: string;
  category: string;
  calculation_type: string;
  executive_dashboard: boolean;
  management_review: boolean;
  display_order: number;
  source: "standard" | "custom";
  reusable: boolean;
};

export default function DashboardKpiCatalogPage() {
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState("Default Company");
  const [libraryRows, setLibraryRows] = useState<KpiCatalogRow[]>([]);
  const [configurationRows, setConfigurationRows] = useState<CompanyKpiConfiguration[]>([]);
  const [customRows, setCustomRows] = useState<CustomKpiDefinition[]>([]);
  const [moduleFilter, setModuleFilter] = useState("all");
  const [usageFilter, setUsageFilter] = useState("all");
  const [searchText, setSearchText] = useState("");

  const fetchCatalog = async () => {
    setLoading(true);

    const settings = await getCompanySettings();
    const resolvedCompanyName = settings?.company_name || "Default Company";
    setCompanyName(resolvedCompanyName);

    let standardLibrary: KpiCatalogRow[] = [];

    const { data: newLibraryData, error: newLibraryError } = await supabase
      .from("kpi_library_definitions")
      .select("*")
      .eq("active", true)
      .order("module_name", { ascending: true })
      .order("category", { ascending: true })
      .order("default_display_order", { ascending: true });

    if (!newLibraryError && newLibraryData && newLibraryData.length > 0) {
      standardLibrary = (newLibraryData as KpiCatalogRow[]).map((row) => ({
        ...row,
        source: "standard",
      }));
    } else {
      const { data: legacyLibraryData, error: legacyLibraryError } = await supabase
        .from("kpi_library")
        .select("*")
        .order("module_name", { ascending: true })
        .order("kpi_category", { ascending: true })
        .order("kpi_name", { ascending: true });

      if (legacyLibraryError && newLibraryError) {
        alert(legacyLibraryError.message || newLibraryError.message);
        setLoading(false);
        return;
      }

      standardLibrary = ((legacyLibraryData as KpiCatalogRow[]) || []).map((row) => ({
        ...row,
        source: "standard",
      }));
    }

    const { data: companyConfigData, error: companyConfigError } = await supabase
      .from("company_dashboard_kpi_configuration")
      .select("*")
      .eq("company_name", resolvedCompanyName);

    if (companyConfigError) {
      alert(companyConfigError.message);
      setLoading(false);
      return;
    }

    let resolvedConfigurationRows = (companyConfigData as CompanyKpiConfiguration[]) || [];

    if (resolvedConfigurationRows.length === 0 && resolvedCompanyName !== "Default Company") {
      const { data: defaultConfigData } = await supabase
        .from("company_dashboard_kpi_configuration")
        .select("*")
        .eq("company_name", "Default Company");

      resolvedConfigurationRows = (defaultConfigData as CompanyKpiConfiguration[]) || [];
    }

    const { data: customData, error: customError } = await supabase
      .from("custom_kpi_definitions")
      .select("*")
      .eq("company_name", resolvedCompanyName)
      .eq("active", true)
      .order("module_name", { ascending: true })
      .order("display_order", { ascending: true });

    if (customError) {
      console.warn(customError.message);
    }

    setLibraryRows(standardLibrary);
    setConfigurationRows(resolvedConfigurationRows);
    setCustomRows((customData as CustomKpiDefinition[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchCatalog();
  }, []);

  const catalogRows: CatalogDisplayRow[] = useMemo(() => {
    const configMap = new Map<string, CompanyKpiConfiguration>();

    configurationRows.forEach((config) => {
      configMap.set(
        `${normalizeModuleName(config.module_name)}:${config.kpi_key}`,
        config,
      );
    });

    const standardRows: CatalogDisplayRow[] = libraryRows.map((row, index) => {
      const normalizedModule = normalizeModuleName(row.module_name);
      const config = configMap.get(`${normalizedModule}:${row.kpi_key}`);

      return {
        module_name: normalizedModule,
        kpi_key: row.kpi_key,
        kpi_name: row.kpi_name,
        kpi_description: row.kpi_description || "No description provided.",
        category: row.category || row.kpi_category || "General",
        calculation_type: row.calculation_type || "count",
        executive_dashboard:
          config?.executive_dashboard ??
          Boolean(row.default_executive_dashboard ?? row.enabled_by_default ?? false),
        management_review:
          config?.management_review ??
          Boolean(row.default_management_review ?? row.enabled_by_default ?? false),
        display_order: Number(
          config?.display_order || row.default_display_order || index + 1,
        ),
        source: "standard",
        reusable: isReusableKpi(row.kpi_key, row.kpi_name),
      };
    });

    const customDisplayRows: CatalogDisplayRow[] = customRows.map((row, index) => ({
      module_name: normalizeModuleName(row.module_name),
      kpi_key: row.kpi_key,
      kpi_name: row.kpi_name,
      kpi_description: row.kpi_description || "Custom KPI.",
      category: row.kpi_category || "Custom",
      calculation_type: row.calculation_type || "count",
      executive_dashboard: Boolean(row.executive_dashboard),
      management_review: Boolean(row.management_review),
      display_order: Number(row.display_order || 1000 + index),
      source: "custom",
      reusable: false,
    }));

    return [...standardRows, ...customDisplayRows].sort((a, b) => {
      const moduleCompare = a.module_name.localeCompare(b.module_name);
      if (moduleCompare !== 0) return moduleCompare;

      return Number(a.display_order || 100) - Number(b.display_order || 100);
    });
  }, [libraryRows, configurationRows, customRows]);

  const filteredRows = useMemo(() => {
    return catalogRows.filter((row) => {
      const matchesModule = moduleFilter === "all" || row.module_name === moduleFilter;

      const matchesUsage =
        usageFilter === "all" ||
        (usageFilter === "executive" && row.executive_dashboard) ||
        (usageFilter === "management_review" && row.management_review) ||
        (usageFilter === "reusable" && row.reusable) ||
        (usageFilter === "custom" && row.source === "custom") ||
        (usageFilter === "unused" && !row.executive_dashboard && !row.management_review);

      const search = searchText.trim().toLowerCase();

      const matchesSearch =
        search.length === 0 ||
        row.kpi_name.toLowerCase().includes(search) ||
        row.kpi_key.toLowerCase().includes(search) ||
        row.category.toLowerCase().includes(search) ||
        row.module_name.toLowerCase().includes(search) ||
        row.kpi_description.toLowerCase().includes(search);

      return matchesModule && matchesUsage && matchesSearch;
    });
  }, [catalogRows, moduleFilter, usageFilter, searchText]);

  const modules = useMemo(() => {
    return Array.from(new Set(catalogRows.map((row) => row.module_name))).sort();
  }, [catalogRows]);

  const reusableGroups = useMemo(() => {
    const groups: Record<string, CatalogDisplayRow[]> = {};

    catalogRows
      .filter((row) => row.reusable)
      .forEach((row) => {
        const template = getReusableTemplate(row.kpi_key, row.kpi_name);
        if (!groups[template]) groups[template] = [];
        groups[template].push(row);
      });

    return Object.entries(groups)
      .map(([template, rows]) => ({ template, rows }))
      .sort((a, b) => b.rows.length - a.rows.length);
  }, [catalogRows]);

  const totalKpis = catalogRows.length;
  const executiveKpis = catalogRows.filter((row) => row.executive_dashboard).length;
  const managementReviewKpis = catalogRows.filter((row) => row.management_review).length;
  const reusableKpis = catalogRows.filter((row) => row.reusable).length;
  const customKpis = catalogRows.filter((row) => row.source === "custom").length;
  const unusedKpis = catalogRows.filter(
    (row) => !row.executive_dashboard && !row.management_review,
  ).length;

  if (loading) {
    return (
      <main style={pageStyle}>
        Loading Dashboard KPI Catalog...
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>QUALITY INTELLIGENCE GOVERNANCE</div>
          <h1 style={{ margin: "6px 0" }}>Dashboard KPI Catalog</h1>
          <p style={subtleText}>
            Read-only governance view of the enterprise KPI catalog for{" "}
            <strong>{companyName}</strong>. Configure KPI availability in Company
            Settings, then use this page to audit Executive Dashboard and
            Management Review usage.
          </p>
        </div>

        <div style={buttonRowStyle}>
          <a href="/dashboard" style={darkButtonStyle}>
            Executive Dashboard
          </a>
          <a href="/admin/company-settings" style={secondaryButtonStyle}>
            Configure KPIs
          </a>
        </div>
      </header>

      <section style={kpiGridStyle}>
        <KpiCard label="Total KPIs" value={totalKpis} color="#2563eb" />
        <KpiCard label="Executive KPIs" value={executiveKpis} color="#15803d" />
        <KpiCard label="Management Review KPIs" value={managementReviewKpis} color="#7c3aed" />
        <KpiCard label="Reusable KPIs" value={reusableKpis} color="#d97706" />
        <KpiCard label="Custom KPIs" value={customKpis} color="#111827" />
        <KpiCard label="Unused KPIs" value={unusedKpis} color={unusedKpis > 0 ? "#dc2626" : "#15803d"} />
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <div style={eyebrowStyle}>CATALOG FILTERS</div>
            <h2 style={{ margin: "6px 0" }}>Find and Audit KPIs</h2>
          </div>
        </div>

        <div style={filterGridStyle}>
          <Field label="Search">
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search KPI name, key, module, category..."
              style={inputStyle}
            />
          </Field>

          <Field label="Module">
            <select
              value={moduleFilter}
              onChange={(event) => setModuleFilter(event.target.value)}
              style={inputStyle}
            >
              <option value="all">All Modules</option>
              {modules.map((moduleName) => (
                <option key={moduleName} value={moduleName}>
                  {formatModuleName(moduleName)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Usage">
            <select
              value={usageFilter}
              onChange={(event) => setUsageFilter(event.target.value)}
              style={inputStyle}
            >
              <option value="all">All Usage</option>
              <option value="executive">Executive Dashboard</option>
              <option value="management_review">Management Review</option>
              <option value="reusable">Reusable KPIs</option>
              <option value="custom">Custom KPIs</option>
              <option value="unused">Unused KPIs</option>
            </select>
          </Field>
        </div>
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <div style={eyebrowStyle}>ENTERPRISE KPI CATALOG</div>
            <h2 style={{ margin: "6px 0" }}>Configured KPI Governance</h2>
            <p style={subtleText}>
              Showing {filteredRows.length} of {catalogRows.length} KPI records.
            </p>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Module</th>
                <th style={thStyle}>KPI</th>
                <th style={thStyle}>Category</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Executive</th>
                <th style={thStyle}>Mgmt Review</th>
                <th style={thStyle}>Reusable</th>
                <th style={thStyle}>Source</th>
                <th style={thStyle}>Order</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={9} style={tdStyle}>
                    No KPIs match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={`${row.source}:${row.module_name}:${row.kpi_key}`}>
                    <td style={tdStyle}>
                      <strong>{formatModuleName(row.module_name)}</strong>
                    </td>
                    <td style={tdStyle}>
                      <strong>{row.kpi_name}</strong>
                      <div style={smallTextStyle}>{row.kpi_key}</div>
                      <div style={smallTextStyle}>{row.kpi_description}</div>
                    </td>
                    <td style={tdStyle}>{row.category}</td>
                    <td style={tdStyle}>{formatLabel(row.calculation_type)}</td>
                    <td style={tdStyle}>
                      <StatusPill active={row.executive_dashboard} label={row.executive_dashboard ? "Yes" : "No"} />
                    </td>
                    <td style={tdStyle}>
                      <StatusPill active={row.management_review} label={row.management_review ? "Yes" : "No"} />
                    </td>
                    <td style={tdStyle}>
                      <StatusPill active={row.reusable} label={row.reusable ? "Reusable" : "Specific"} />
                    </td>
                    <td style={tdStyle}>{formatLabel(row.source)}</td>
                    <td style={tdStyle}>{row.display_order}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <div style={eyebrowStyle}>REUSABLE KPI INTELLIGENCE</div>
            <h2 style={{ margin: "6px 0" }}>Reusable KPI Templates</h2>
            <p style={subtleText}>
              These KPI concepts can be reused across modules and are candidates
              for future template-driven calculations.
            </p>
          </div>
        </div>

        {reusableGroups.length === 0 ? (
          <p style={subtleText}>No reusable KPI patterns detected yet.</p>
        ) : (
          <div style={reusableGridStyle}>
            {reusableGroups.map((group) => (
              <div key={group.template} style={reusableCardStyle}>
                <h3 style={{ marginTop: 0 }}>{group.template}</h3>
                <p style={smallTextStyle}>
                  Used by {group.rows.length} KPI record{group.rows.length === 1 ? "" : "s"}.
                </p>

                <div>
                  {group.rows.slice(0, 8).map((row) => (
                    <div key={`${row.module_name}:${row.kpi_key}`} style={usageRowStyle}>
                      <span>{formatModuleName(row.module_name)}</span>
                      <strong>{row.kpi_name}</strong>
                    </div>
                  ))}

                  {group.rows.length > 8 ? (
                    <div style={smallTextStyle}>
                      + {group.rows.length - 8} more
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function KpiCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div style={{ ...kpiCardStyle, borderLeft: `8px solid ${color}` }}>
      <div style={smallTextStyle}>{label}</div>
      <div style={{ fontSize: "30px", fontWeight: 900, color }}>
        {value}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "block" }}>
      <div style={fieldLabelStyle}>{label}</div>
      {children}
    </label>
  );
}

function StatusPill({
  active,
  label,
}: {
  active: boolean;
  label: string;
}) {
  return (
    <span
      style={{
        background: active ? "#dcfce7" : "#f3f4f6",
        color: active ? "#166534" : "#374151",
        border: `1px solid ${active ? "#86efac" : "#d1d5db"}`,
        borderRadius: "999px",
        padding: "4px 10px",
        fontSize: "12px",
        fontWeight: 800,
        display: "inline-block",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function normalizeModuleName(moduleName: string | null | undefined) {
  const value = String(moduleName || "");

  if (["change_controls", "change"].includes(value)) return "change_control";
  if (value === "complaints") return "complaint";
  if (value === "ncmrs") return "ncmr";
  if (value === "capas") return "capa";
  if (value === "audits") return "audit";
  if (value === "scars" || value === "supplier_quality") return "scar";
  if (value === "documents" || value === "controlled_documents") return "document_control";
  if (value === "training_assignments") return "training";
  if (value === "oos_oot_investigations" || value === "oos") return "oos_oot";

  return value;
}

function formatModuleName(moduleName: string) {
  return normalizeModuleName(moduleName)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatLabel(value: string | null | undefined) {
  return String(value || "N/A")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function isReusableKpi(kpiKey: string, kpiName: string) {
  const template = getReusableTemplate(kpiKey, kpiName);
  return template !== "Module-Specific KPI";
}

function getReusableTemplate(kpiKey: string, kpiName: string) {
  const combined = `${kpiKey} ${kpiName}`.toLowerCase();

  if (combined.includes("open")) return "Open Records";
  if (combined.includes("overdue")) return "Overdue Records";
  if (combined.includes("closure rate")) return "Closure Rate";
  if (combined.includes("completion rate")) return "Completion Rate";
  if (combined.includes("compliance")) return "Compliance Rate";
  if (combined.includes("average") || combined.includes("avg")) return "Average Cycle Time";
  if (combined.includes("effectiveness")) return "Effectiveness";
  if (combined.includes("critical")) return "Critical Records";
  if (combined.includes("high risk")) return "High-Risk Records";
  if (combined.includes("pending")) return "Pending Records";
  if (combined.includes("closed") || combined.includes("completed")) return "Closed / Completed Records";
  if (combined.includes("by type")) return "Distribution by Type";
  if (combined.includes("by status")) return "Distribution by Status";

  return "Module-Specific KPI";
}

const pageStyle: React.CSSProperties = {
  padding: "24px",
  background: "#f8fafc",
  minHeight: "100vh",
  fontFamily: "Arial, sans-serif",
};

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

const subtleText: React.CSSProperties = {
  color: "#6b7280",
};

const smallTextStyle: React.CSSProperties = {
  color: "#6b7280",
  fontSize: "12px",
};

const buttonRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
  alignItems: "center",
};

const darkButtonStyle: React.CSSProperties = {
  background: "#111827",
  color: "white",
  padding: "10px 14px",
  borderRadius: "8px",
  textDecoration: "none",
  fontWeight: 700,
};

const secondaryButtonStyle: React.CSSProperties = {
  background: "#2563eb",
  color: "white",
  padding: "10px 14px",
  borderRadius: "8px",
  textDecoration: "none",
  fontWeight: 700,
};

const cardStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid #d1d5db",
  borderRadius: "16px",
  padding: "20px",
  marginBottom: "20px",
};

const kpiGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "14px",
  marginBottom: "20px",
};

const kpiCardStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid #d1d5db",
  borderRadius: "14px",
  padding: "16px",
};

const sectionHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "14px",
  alignItems: "flex-start",
  flexWrap: "wrap",
  marginBottom: "16px",
};

const filterGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: "14px",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px",
  borderRadius: "8px",
  border: "1px solid #d1d5db",
};

const fieldLabelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "13px",
  color: "#374151",
  fontWeight: 700,
  marginBottom: "6px",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  borderBottom: "1px solid #d1d5db",
  padding: "10px",
  color: "#374151",
  fontSize: "13px",
};

const tdStyle: React.CSSProperties = {
  borderBottom: "1px solid #e5e7eb",
  padding: "10px",
  verticalAlign: "top",
};

const reusableGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: "14px",
};

const reusableCardStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: "14px",
  padding: "16px",
  background: "#f9fafb",
};

const usageRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  borderBottom: "1px solid #e5e7eb",
  padding: "8px 0",
};
