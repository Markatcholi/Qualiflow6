"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CompanySettings,
  DEFAULT_COMPANY_SETTINGS,
  getCompanySettings,
  saveCompanySettings,
} from "../../../lib/companySettings";
import { supabase } from "../../../lib/supabaseClient";

type KpiLibraryItem = {
  id: string;
  module_name: string;
  kpi_key: string;
  kpi_name: string;
  kpi_description: string | null;
  kpi_category: string | null;
  enabled_by_default: boolean | null;
  calculation_type: string | null;
};

type KpiConfigurationState = Record<
  string,
  {
    executive_dashboard: boolean;
    management_review: boolean;
    display_order: number;
  }
>;

type CustomKpiDefinition = {
  id: string;
  company_name: string;
  module_name: string;
  kpi_key: string;
  kpi_name: string;
  kpi_description: string | null;
  kpi_category: string | null;
  data_source: string | null;
  calculation_type: string | null;
  filter_field: string | null;
  filter_operator: string | null;
  filter_value: string | null;
  display_type: string | null;
  executive_dashboard: boolean | null;
  management_review: boolean | null;
  display_order: number | null;
  active: boolean | null;
};

export default function CompanySettingsPage() {
  const [settings, setSettings] = useState<CompanySettings>(
    DEFAULT_COMPANY_SETTINGS,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingKpis, setSavingKpis] = useState(false);

  const [kpiLibrary, setKpiLibrary] = useState<KpiLibraryItem[]>([]);
  const [kpiConfig, setKpiConfig] = useState<KpiConfigurationState>({});

  const [customKpis, setCustomKpis] = useState<CustomKpiDefinition[]>([]);
  const [savingCustomKpi, setSavingCustomKpi] = useState(false);
  const [customKpiName, setCustomKpiName] = useState("");
  const [customKpiDescription, setCustomKpiDescription] = useState("");
  const [customKpiCategory, setCustomKpiCategory] = useState("Custom");
  const [customModule, setCustomModule] = useState("change_control");
  const [customCalculationType, setCustomCalculationType] = useState("count");
  const [customFilterField, setCustomFilterField] = useState("");
  const [customFilterOperator, setCustomFilterOperator] = useState("equals");
  const [customFilterValue, setCustomFilterValue] = useState("");
  const [customExecutiveDashboard, setCustomExecutiveDashboard] =
    useState(true);
  const [customManagementReview, setCustomManagementReview] = useState(true);
  const [customDisplayOrder, setCustomDisplayOrder] = useState(100);

  const [userRole, setUserRole] = useState("");
  const [userEmail, setUserEmail] = useState("");

  const canEdit = userRole === "approver" || userRole === "vp_quality";

  const fetchUser = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const email = userData?.user?.email || "";

    setUserEmail(email);

    if (!email) return;

    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_email", email)
      .maybeSingle();

    setUserRole(data?.role || "user");
  };

  const fetchKpiConfiguration = async (companyName: string) => {
    const company = companyName || "Default Company";

    const { data: libraryData, error: libraryError } = await supabase
      .from("kpi_library")
      .select("*")
      .eq("module_name", "change_control")
      .order("kpi_category", { ascending: true })
      .order("kpi_name", { ascending: true });

    if (libraryError) {
      alert(libraryError.message);
      return;
    }

    const library = (libraryData as KpiLibraryItem[]) || [];
    setKpiLibrary(library);

    const { data: companyConfigData, error: companyConfigError } =
      await supabase
        .from("company_dashboard_kpi_configuration")
        .select("*")
        .eq("company_name", company)
        .eq("module_name", "change_control");

    if (companyConfigError) {
      alert(companyConfigError.message);
      return;
    }

    let configurationRows = companyConfigData || [];

    if (configurationRows.length === 0) {
      const { data: defaultConfigData } = await supabase
        .from("dashboard_kpi_configuration")
        .select("*")
        .eq("module_name", "change_control");

      configurationRows = defaultConfigData || [];
    }

    const nextConfig: KpiConfigurationState = {};

    library.forEach((kpi, index) => {
      const matchedConfig = configurationRows.find(
        (row: any) => row.kpi_key === kpi.kpi_key,
      );

      nextConfig[kpi.kpi_key] = {
        executive_dashboard:
          matchedConfig?.executive_dashboard ?? Boolean(kpi.enabled_by_default),
        management_review:
          matchedConfig?.management_review ?? Boolean(kpi.enabled_by_default),
        display_order: Number(matchedConfig?.display_order || index + 1),
      };
    });

    setKpiConfig(nextConfig);
  };

  const fetchCustomKpis = async (companyName: string) => {
    const company = companyName || "Default Company";

    const { data, error } = await supabase
      .from("custom_kpi_definitions")
      .select("*")
      .eq("company_name", company)
      .eq("active", true)
      .order("display_order", { ascending: true })
      .order("kpi_name", { ascending: true });

    if (error) {
      console.warn(error.message);
      setCustomKpis([]);
      return;
    }

    setCustomKpis((data as CustomKpiDefinition[]) || []);
  };

  const fetchSettings = async () => {
    setLoading(true);
    await fetchUser();

    const data = await getCompanySettings();
    setSettings(data);
    const companyName = data.company_name || "Default Company";
    await fetchKpiConfiguration(companyName);
    await fetchCustomKpis(companyName);

    setLoading(false);
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const updateField = (field: keyof CompanySettings, value: any) => {
    setSettings((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const updateKpiConfiguration = (
    kpiKey: string,
    field: "executive_dashboard" | "management_review" | "display_order",
    value: boolean | number,
  ) => {
    setKpiConfig((prev) => ({
      ...prev,
      [kpiKey]: {
        executive_dashboard: prev[kpiKey]?.executive_dashboard ?? false,
        management_review: prev[kpiKey]?.management_review ?? false,
        display_order: prev[kpiKey]?.display_order ?? 1,
        [field]: value,
      },
    }));
  };

  const saveKpiConfiguration = async () => {
    if (!canEdit) {
      alert("Only an approver or VP Quality can update KPI configuration.");
      return;
    }

    const companyName = settings.company_name || "Default Company";

    if (kpiLibrary.length === 0) {
      alert("No KPI library records found for Change Control.");
      return;
    }

    setSavingKpis(true);

    const rows = kpiLibrary.map((kpi, index) => ({
      company_name: companyName,
      module_name: kpi.module_name,
      kpi_key: kpi.kpi_key,
      executive_dashboard:
        kpiConfig[kpi.kpi_key]?.executive_dashboard ??
        Boolean(kpi.enabled_by_default),
      management_review:
        kpiConfig[kpi.kpi_key]?.management_review ??
        Boolean(kpi.enabled_by_default),
      display_order: Number(kpiConfig[kpi.kpi_key]?.display_order || index + 1),
    }));

    const { error } = await supabase
      .from("company_dashboard_kpi_configuration")
      .upsert(rows, { onConflict: "company_name,module_name,kpi_key" });

    setSavingKpis(false);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Dashboard KPI configuration saved.");
    await fetchKpiConfiguration(companyName);
  };

  const createCustomKpi = async () => {
    if (!canEdit) {
      alert("Only an approver or VP Quality can create custom KPIs.");
      return;
    }

    if (!customKpiName.trim()) {
      alert("KPI name is required.");
      return;
    }

    if (!customFilterField.trim()) {
      alert("Filter field is required for Version 1 custom KPIs.");
      return;
    }

    if (customFilterOperator !== "is_not_blank" && !customFilterValue.trim()) {
      alert("Filter value is required for the selected operator.");
      return;
    }

    const companyName = settings.company_name || "Default Company";
    const baseKey = customKpiName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");

    if (!baseKey) {
      alert("KPI name must include letters or numbers.");
      return;
    }

    setSavingCustomKpi(true);

    const { error } = await supabase.from("custom_kpi_definitions").insert({
      company_name: companyName,
      module_name: customModule,
      kpi_key: baseKey,
      kpi_name: customKpiName.trim(),
      kpi_description: customKpiDescription.trim() || null,
      kpi_category: customKpiCategory.trim() || "Custom",
      data_source: customModule,
      calculation_type: customCalculationType,
      filter_field: customFilterField.trim(),
      filter_operator: customFilterOperator,
      filter_value:
        customFilterOperator === "is_not_blank"
          ? null
          : customFilterValue.trim(),
      display_type: "card",
      executive_dashboard: customExecutiveDashboard,
      management_review: customManagementReview,
      display_order: Number(customDisplayOrder || 100),
      active: true,
    });

    setSavingCustomKpi(false);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Custom KPI created.");
    setCustomKpiName("");
    setCustomKpiDescription("");
    setCustomKpiCategory("Custom");
    setCustomModule("change_control");
    setCustomCalculationType("count");
    setCustomFilterField("");
    setCustomFilterOperator("equals");
    setCustomFilterValue("");
    setCustomExecutiveDashboard(true);
    setCustomManagementReview(true);
    setCustomDisplayOrder(100);
    await fetchCustomKpis(companyName);
  };

  const deactivateCustomKpi = async (customKpi: CustomKpiDefinition) => {
    if (!canEdit) {
      alert("Only an approver or VP Quality can deactivate custom KPIs.");
      return;
    }

    const confirmed = window.confirm(
      `Deactivate custom KPI: ${customKpi.kpi_name}?`,
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("custom_kpi_definitions")
      .update({ active: false })
      .eq("id", customKpi.id);

    if (error) {
      alert(error.message);
      return;
    }

    await fetchCustomKpis(settings.company_name || "Default Company");
  };

  const save = async () => {
    if (!canEdit) {
      alert("Only an approver or VP Quality can update company settings.");
      return;
    }

    if (
      Number(settings.overdue_bucket_1) >= Number(settings.overdue_bucket_2) ||
      Number(settings.overdue_bucket_2) >= Number(settings.overdue_bucket_3)
    ) {
      alert("Aging bucket values must increase in order. Example: 7, 14, 30.");
      return;
    }

    setSaving(true);

    const { error } = await saveCompanySettings(settings);

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Company settings saved.");
    fetchSettings();
  };

  if (loading) {
    return <main style={pageStyle}>Loading company settings...</main>;
  }

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>ENTERPRISE CONFIGURATION</div>
          <h1 style={{ margin: "6px 0" }}>Company Admin Settings</h1>
          <p style={subtleText}>
            Configure governance defaults so each company can use QualiFlow
            as-is, customize behavior, or disable features entirely.
          </p>
        </div>

        <div style={buttonRowStyle}>
          <Link href="/admin/master-data" style={secondaryLinkStyle}>
            Admin Master Data
          </Link>

          <Link href="/dashboard" style={darkLinkStyle}>
            Dashboard
          </Link>
        </div>
      </header>

      {!canEdit ? (
        <section style={warningStyle}>
          You are signed in as {userEmail || "unknown"} ({userRole || "user"}).
          You can view settings, but only approvers or VP Quality can edit them.
        </section>
      ) : null}

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Company Profile</h2>

        <Field label="Company Name">
          <input
            value={settings.company_name || ""}
            onChange={(e) => updateField("company_name", e.target.value)}
            disabled={!canEdit}
            style={inputStyle(!canEdit)}
          />
        </Field>
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Notification Governance</h2>

        <div style={gridStyle}>
          <ToggleField
            label="Enable Notifications"
            description="Master switch for in-app workflow notifications."
            checked={settings.enable_notifications}
            disabled={!canEdit}
            onChange={(value) => updateField("enable_notifications", value)}
          />

          <ToggleField
            label="Enable Email Notifications"
            description="Future email notification switch. Default is off."
            checked={settings.enable_email_notifications}
            disabled={!canEdit}
            onChange={(value) =>
              updateField("enable_email_notifications", value)
            }
          />

          <ToggleField
            label="Allow User Preference Overrides"
            description="Allows individual users to choose immediate/daily/weekly/off."
            checked={settings.allow_users_to_override_preferences}
            disabled={!canEdit}
            onChange={(value) =>
              updateField("allow_users_to_override_preferences", value)
            }
          />

          <Field label="Default Notification Frequency">
            <select
              value={settings.notification_default_frequency}
              onChange={(e) =>
                updateField(
                  "notification_default_frequency",
                  e.target
                    .value as CompanySettings["notification_default_frequency"],
                )
              }
              disabled={!canEdit}
              style={inputStyle(!canEdit)}
            >
              <option value="immediate">Immediate</option>
              <option value="daily">Daily Digest</option>
              <option value="weekly">Weekly Digest</option>
              <option value="off">Off</option>
            </select>
          </Field>
        </div>
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Overdue Governance</h2>

        <div style={gridStyle}>
          <ToggleField
            label="Enable Overdue Task Scan"
            description="Allows the CAPA Intelligence page to run overdue task scanning."
            checked={settings.enable_overdue_scan}
            disabled={!canEdit}
            onChange={(value) => updateField("enable_overdue_scan", value)}
          />

          <Field label="Overdue Scan Mode">
            <select
              value={settings.overdue_scan_mode}
              onChange={(e) =>
                updateField(
                  "overdue_scan_mode",
                  e.target.value as CompanySettings["overdue_scan_mode"],
                )
              }
              disabled={!canEdit}
              style={inputStyle(!canEdit)}
            >
              <option value="manual">Manual</option>
              <option value="scheduled">Scheduled</option>
              <option value="disabled">Disabled</option>
            </select>
          </Field>
        </div>
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Dashboard Governance</h2>

        <div style={gridStyle}>
          <ToggleField
            label="Enable Task SLA Dashboard"
            description="Show or hide task aging, owner workload, and overdue owner exposure."
            checked={settings.enable_task_sla_dashboard}
            disabled={!canEdit}
            onChange={(value) =>
              updateField("enable_task_sla_dashboard", value)
            }
          />

          <ToggleField
            label="Enable Escalation Dashboard"
            description="Show or hide executive escalation cards."
            checked={settings.enable_escalation_dashboard}
            disabled={!canEdit}
            onChange={(value) =>
              updateField("enable_escalation_dashboard", value)
            }
          />
        </div>
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <h2 style={{ margin: 0 }}>Dashboard & KPI Configuration</h2>
            <p style={subtleText}>
              Select which Change Control KPIs appear on the Executive Dashboard
              and Management Review package. Customers can use defaults or
              choose only the metrics that are meaningful for their quality
              system.
            </p>
          </div>

          <button
            onClick={saveKpiConfiguration}
            disabled={!canEdit || savingKpis}
            style={
              !canEdit || savingKpis ? disabledButtonStyle : primaryButtonStyle
            }
          >
            {savingKpis ? "Saving KPIs..." : "Save KPI Configuration"}
          </button>
        </div>

        {kpiLibrary.length === 0 ? (
          <div style={infoBoxStyle}>
            No Change Control KPI library records were found. Confirm the KPI
            library seed script was run successfully.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Category</th>
                  <th style={thStyle}>KPI</th>
                  <th style={thStyle}>Description</th>
                  <th style={thStyle}>Executive Dashboard</th>
                  <th style={thStyle}>Management Review</th>
                  <th style={thStyle}>Display Order</th>
                </tr>
              </thead>
              <tbody>
                {kpiLibrary.map((kpi, index) => {
                  const currentConfig = kpiConfig[kpi.kpi_key] || {
                    executive_dashboard: Boolean(kpi.enabled_by_default),
                    management_review: Boolean(kpi.enabled_by_default),
                    display_order: index + 1,
                  };

                  return (
                    <tr key={kpi.kpi_key}>
                      <td style={tdStyle}>{kpi.kpi_category || "General"}</td>
                      <td style={tdStyle}>
                        <strong>{kpi.kpi_name}</strong>
                        <div style={smallTextStyle}>{kpi.kpi_key}</div>
                      </td>
                      <td style={tdStyle}>
                        {kpi.kpi_description || "No description provided."}
                      </td>
                      <td style={tdStyle}>
                        <input
                          type="checkbox"
                          checked={currentConfig.executive_dashboard}
                          disabled={!canEdit}
                          onChange={(e) =>
                            updateKpiConfiguration(
                              kpi.kpi_key,
                              "executive_dashboard",
                              e.target.checked,
                            )
                          }
                        />
                      </td>
                      <td style={tdStyle}>
                        <input
                          type="checkbox"
                          checked={currentConfig.management_review}
                          disabled={!canEdit}
                          onChange={(e) =>
                            updateKpiConfiguration(
                              kpi.kpi_key,
                              "management_review",
                              e.target.checked,
                            )
                          }
                        />
                      </td>
                      <td style={tdStyle}>
                        <input
                          type="number"
                          min={1}
                          value={currentConfig.display_order}
                          disabled={!canEdit}
                          onChange={(e) =>
                            updateKpiConfiguration(
                              kpi.kpi_key,
                              "display_order",
                              Number(e.target.value || 1),
                            )
                          }
                          style={orderInputStyle(!canEdit)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <h2 style={{ margin: 0 }}>Custom KPI Builder</h2>
            <p style={subtleText}>
              Create customer-specific KPI cards without changing application
              code. Version 1 supports simple record-count KPIs using one
              filter condition.
            </p>
          </div>

          <button
            onClick={createCustomKpi}
            disabled={!canEdit || savingCustomKpi}
            style={
              !canEdit || savingCustomKpi
                ? disabledButtonStyle
                : primaryButtonStyle
            }
          >
            {savingCustomKpi ? "Creating KPI..." : "Create Custom KPI"}
          </button>
        </div>

        <div style={gridStyle}>
          <Field label="KPI Name">
            <input
              value={customKpiName}
              onChange={(e) => setCustomKpiName(e.target.value)}
              placeholder="Example: Open Engineering Changes"
              disabled={!canEdit}
              style={inputStyle(!canEdit)}
            />
          </Field>

          <Field label="Module">
            <select
              value={customModule}
              onChange={(e) => setCustomModule(e.target.value)}
              disabled={!canEdit}
              style={inputStyle(!canEdit)}
            >
              <option value="change_control">Change Control</option>
              <option value="ncmr">NCMR</option>
              <option value="capa">CAPA</option>
              <option value="scar">SCAR</option>
              <option value="audit">Audit</option>
              <option value="oos_oot">OOS/OOT</option>
              <option value="document_control">Document Control</option>
              <option value="training">Training</option>
            </select>
          </Field>

          <Field label="KPI Category">
            <input
              value={customKpiCategory}
              onChange={(e) => setCustomKpiCategory(e.target.value)}
              disabled={!canEdit}
              style={inputStyle(!canEdit)}
            />
          </Field>

          <Field label="Calculation Type">
            <select
              value={customCalculationType}
              onChange={(e) => setCustomCalculationType(e.target.value)}
              disabled={!canEdit}
              style={inputStyle(!canEdit)}
            >
              <option value="count">Record Count</option>
            </select>
          </Field>

          <Field label="Filter Field">
            <input
              value={customFilterField}
              onChange={(e) => setCustomFilterField(e.target.value)}
              placeholder="Example: status, risk_level, change_type"
              disabled={!canEdit}
              style={inputStyle(!canEdit)}
            />
          </Field>

          <Field label="Operator">
            <select
              value={customFilterOperator}
              onChange={(e) => setCustomFilterOperator(e.target.value)}
              disabled={!canEdit}
              style={inputStyle(!canEdit)}
            >
              <option value="equals">Equals</option>
              <option value="not_equals">Not Equals</option>
              <option value="contains">Contains</option>
              <option value="is_not_blank">Is Not Blank</option>
            </select>
          </Field>

          <Field label="Filter Value">
            <input
              value={customFilterValue}
              onChange={(e) => setCustomFilterValue(e.target.value)}
              placeholder="Example: implementation, high, closed"
              disabled={!canEdit || customFilterOperator === "is_not_blank"}
              style={inputStyle(!canEdit || customFilterOperator === "is_not_blank")}
            />
          </Field>

          <Field label="Display Order">
            <input
              type="number"
              min={1}
              value={customDisplayOrder}
              onChange={(e) => setCustomDisplayOrder(Number(e.target.value || 100))}
              disabled={!canEdit}
              style={inputStyle(!canEdit)}
            />
          </Field>
        </div>

        <Field label="KPI Description">
          <textarea
            value={customKpiDescription}
            onChange={(e) => setCustomKpiDescription(e.target.value)}
            placeholder="Describe what this KPI measures and why it matters."
            disabled={!canEdit}
            rows={3}
            style={textareaStyle(!canEdit)}
          />
        </Field>

        <div style={customToggleRowStyle}>
          <label style={toggleLabelStyle}>
            <input
              type="checkbox"
              checked={customExecutiveDashboard}
              disabled={!canEdit}
              onChange={(e) => setCustomExecutiveDashboard(e.target.checked)}
            />
            Executive Dashboard
          </label>

          <label style={toggleLabelStyle}>
            <input
              type="checkbox"
              checked={customManagementReview}
              disabled={!canEdit}
              onChange={(e) => setCustomManagementReview(e.target.checked)}
            />
            Management Review
          </label>
        </div>

        <div style={infoBoxStyle}>
          Example: To count changes currently in verification, use Module =
          Change Control, Filter Field = status, Operator = Equals, Filter Value
          = verification.
        </div>

        {customKpis.length > 0 ? (
          <div style={{ marginTop: "20px", overflowX: "auto" }}>
            <h3>Active Custom KPIs</h3>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>KPI</th>
                  <th style={thStyle}>Module</th>
                  <th style={thStyle}>Calculation</th>
                  <th style={thStyle}>Filter</th>
                  <th style={thStyle}>Executive</th>
                  <th style={thStyle}>Management Review</th>
                  <th style={thStyle}>Order</th>
                  <th style={thStyle}>Action</th>
                </tr>
              </thead>
              <tbody>
                {customKpis.map((customKpi) => (
                  <tr key={customKpi.id}>
                    <td style={tdStyle}>
                      <strong>{customKpi.kpi_name}</strong>
                      <div style={smallTextStyle}>{customKpi.kpi_key}</div>
                    </td>
                    <td style={tdStyle}>{customKpi.module_name}</td>
                    <td style={tdStyle}>{customKpi.calculation_type || "count"}</td>
                    <td style={tdStyle}>
                      {customKpi.filter_field || "N/A"} {" "}
                      {customKpi.filter_operator || ""} {" "}
                      {customKpi.filter_value || ""}
                    </td>
                    <td style={tdStyle}>
                      {customKpi.executive_dashboard ? "Yes" : "No"}
                    </td>
                    <td style={tdStyle}>
                      {customKpi.management_review ? "Yes" : "No"}
                    </td>
                    <td style={tdStyle}>{customKpi.display_order || 100}</td>
                    <td style={tdStyle}>
                      <button
                        onClick={() => deactivateCustomKpi(customKpi)}
                        disabled={!canEdit}
                        style={!canEdit ? disabledButtonStyle : dangerButtonStyle}
                      >
                        Deactivate
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={infoBoxStyle}>
            No active custom KPIs have been created for this company yet.
          </div>
        )}
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Task SLA Aging Buckets</h2>
        <p style={subtleText}>
          These values define aging buckets used by the CAPA Intelligence SLA
          dashboard. Defaults are 7 / 14 / 30 days.
        </p>

        <div style={gridStyle}>
          <Field label="Bucket 1 Threshold">
            <input
              type="number"
              value={settings.overdue_bucket_1}
              onChange={(e) =>
                updateField("overdue_bucket_1", Number(e.target.value))
              }
              disabled={!canEdit}
              style={inputStyle(!canEdit)}
            />
          </Field>

          <Field label="Bucket 2 Threshold">
            <input
              type="number"
              value={settings.overdue_bucket_2}
              onChange={(e) =>
                updateField("overdue_bucket_2", Number(e.target.value))
              }
              disabled={!canEdit}
              style={inputStyle(!canEdit)}
            />
          </Field>

          <Field label="Bucket 3 Threshold">
            <input
              type="number"
              value={settings.overdue_bucket_3}
              onChange={(e) =>
                updateField("overdue_bucket_3", Number(e.target.value))
              }
              disabled={!canEdit}
              style={inputStyle(!canEdit)}
            />
          </Field>
        </div>

        <div style={infoBoxStyle}>
          Current SLA buckets: 1–{settings.overdue_bucket_1} days,{" "}
          {settings.overdue_bucket_1 + 1}–{settings.overdue_bucket_2} days,{" "}
          {settings.overdue_bucket_2 + 1}–{settings.overdue_bucket_3} days,{" "}
          {settings.overdue_bucket_3 + 1}+ days.
        </div>
      </section>

      <section style={buttonFooterStyle}>
        <button
          onClick={save}
          disabled={!canEdit || saving}
          style={!canEdit || saving ? disabledButtonStyle : primaryButtonStyle}
        >
          {saving ? "Saving..." : "Save Company Settings"}
        </button>
      </section>
    </main>
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
    <div>
      <label style={labelStyle}>{label}</label>
      <div style={{ marginTop: "6px" }}>{children}</div>
    </div>
  );
}

function ToggleField({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div style={toggleCardStyle}>
      <label style={toggleLabelStyle}>
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        {label}
      </label>

      <p style={{ ...subtleText, margin: "8px 0 0 0" }}>{description}</p>
    </div>
  );
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

const cardStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid #d1d5db",
  borderRadius: "16px",
  padding: "20px",
  marginBottom: "18px",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "16px",
};

const labelStyle: React.CSSProperties = {
  fontWeight: 700,
};

const inputStyle = (disabled: boolean): React.CSSProperties => ({
  width: "100%",
  padding: "10px",
  borderRadius: "8px",
  border: "1px solid #d1d5db",
  background: disabled ? "#f3f4f6" : "white",
});

const textareaStyle = (disabled: boolean): React.CSSProperties => ({
  width: "100%",
  padding: "10px",
  borderRadius: "8px",
  border: "1px solid #d1d5db",
  background: disabled ? "#f3f4f6" : "white",
  fontFamily: "Arial, sans-serif",
});

const toggleCardStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: "12px",
  padding: "14px",
  background: "#f9fafb",
};

const toggleLabelStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  fontWeight: 700,
};

const infoBoxStyle: React.CSSProperties = {
  marginTop: "16px",
  background: "#eff6ff",
  color: "#1e3a8a",
  border: "1px solid #bfdbfe",
  borderRadius: "12px",
  padding: "14px",
};

const warningStyle: React.CSSProperties = {
  background: "#fefce8",
  border: "1px solid #fde68a",
  color: "#92400e",
  borderRadius: "14px",
  padding: "14px",
  marginBottom: "18px",
  fontWeight: 700,
};

const buttonRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
};

const customToggleRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "24px",
  flexWrap: "wrap",
  marginTop: "18px",
};

const sectionHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "16px",
  alignItems: "flex-start",
  flexWrap: "wrap",
  marginBottom: "16px",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  borderBottom: "1px solid #d1d5db",
  padding: "10px",
  fontSize: "13px",
};

const tdStyle: React.CSSProperties = {
  borderBottom: "1px solid #e5e7eb",
  padding: "10px",
  verticalAlign: "top",
};

const smallTextStyle: React.CSSProperties = {
  color: "#6b7280",
  fontSize: "12px",
  marginTop: "4px",
};

const orderInputStyle = (disabled: boolean): React.CSSProperties => ({
  width: "90px",
  padding: "8px",
  borderRadius: "8px",
  border: "1px solid #d1d5db",
  background: disabled ? "#f3f4f6" : "white",
});

const buttonFooterStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  marginTop: "8px",
};

const primaryButtonStyle: React.CSSProperties = {
  background: "#2563eb",
  color: "white",
  border: "none",
  borderRadius: "8px",
  padding: "10px 14px",
  fontWeight: 700,
  cursor: "pointer",
};

const disabledButtonStyle: React.CSSProperties = {
  background: "#9ca3af",
  color: "white",
  border: "none",
  borderRadius: "8px",
  padding: "10px 14px",
  fontWeight: 700,
  cursor: "not-allowed",
};

const dangerButtonStyle: React.CSSProperties = {
  background: "#dc2626",
  color: "white",
  border: "none",
  borderRadius: "8px",
  padding: "8px 12px",
  fontWeight: 700,
  cursor: "pointer",
};

const darkLinkStyle: React.CSSProperties = {
  background: "#111827",
  color: "white",
  borderRadius: "8px",
  padding: "10px 14px",
  textDecoration: "none",
  fontWeight: 700,
};

const secondaryLinkStyle: React.CSSProperties = {
  background: "#15803d",
  color: "white",
  borderRadius: "8px",
  padding: "10px 14px",
  textDecoration: "none",
  fontWeight: 700,
};
