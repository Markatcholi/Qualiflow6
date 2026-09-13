"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type CompanySettings = {
  id?: string;
  tenant_id: string;
  company_name: string;
  enable_notifications: boolean;
  enable_overdue_scan: boolean;
  enable_task_sla_dashboard: boolean;
  enable_escalation_dashboard: boolean;
  enable_email_notifications: boolean;
  overdue_scan_mode: "manual" | "scheduled" | "disabled";
  notification_default_frequency: "immediate" | "daily" | "weekly" | "off";
  overdue_bucket_1: number;
  overdue_bucket_2: number;
  overdue_bucket_3: number;
  allow_users_to_override_preferences: boolean;
};

type KpiLibraryItem = {
  id: string;
  module_name: string;
  kpi_key: string;
  kpi_name: string;
  kpi_description?: string | null;
  kpi_category?: string | null;
  category?: string | null;
  enabled_by_default?: boolean | null;
  default_executive_dashboard?: boolean | null;
  default_management_review?: boolean | null;
  default_display_order?: number | null;
};

type KpiConfig = Record<string, {
  executive_dashboard: boolean;
  management_review: boolean;
  display_order: number;
}>;

type CustomKpi = {
  id: string;
  kpi_name: string;
  module_name: string;
  kpi_category: string | null;
  executive_dashboard: boolean | null;
  management_review: boolean | null;
  display_order: number | null;
};

const DEFAULTS: Omit<CompanySettings, "tenant_id" | "company_name"> = {
  enable_notifications: true,
  enable_overdue_scan: true,
  enable_task_sla_dashboard: true,
  enable_escalation_dashboard: true,
  enable_email_notifications: false,
  overdue_scan_mode: "manual",
  notification_default_frequency: "immediate",
  overdue_bucket_1: 7,
  overdue_bucket_2: 14,
  overdue_bucket_3: 30,
  allow_users_to_override_preferences: true,
};

const MODULE_LABELS: Record<string, string> = {
  audit: "Audit",
  audit_management: "Audit",
  capa: "CAPA",
  change_control: "Change Control",
  complaint: "Complaint",
  complaints: "Complaint",
  controlled_documents: "Document Control",
  document_control: "Document Control",
  ncmr: "NCMR",
  oos_oot: "OOS/OOT",
  scar: "SCAR",
  suppliers: "Suppliers",
  equipment: "Equipment",
  training: "Training",
};

function normalizeModule(value: string) {
  return String(value || "").trim().toLowerCase().replace(/[\s/-]+/g, "_");
}

function labelModule(value: string) {
  const key = normalizeModule(value);
  return MODULE_LABELS[key] || String(value || "").replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function CompanyAdministrationSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingKpis, setSavingKpis] = useState(false);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [settings, setSettings] = useState<CompanySettings | null>(null);

  const [kpiLibrary, setKpiLibrary] = useState<KpiLibraryItem[]>([]);
  const [kpiConfig, setKpiConfig] = useState<KpiConfig>({});
  const [catalogFilter, setCatalogFilter] = useState("all");
  const [quickAddModule, setQuickAddModule] = useState("");
  const [quickAddKpi, setQuickAddKpi] = useState("");

  const [customKpis, setCustomKpis] = useState<CustomKpi[]>([]);
  const [customName, setCustomName] = useState("");
  const [customModule, setCustomModule] = useState("change_control");
  const [customCategory, setCustomCategory] = useState("Custom");
  const [customCalculationType, setCustomCalculationType] = useState("count");
  const [customFilterField, setCustomFilterField] = useState("");
  const [customFilterOperator, setCustomFilterOperator] = useState("equals");
  const [customFilterValue, setCustomFilterValue] = useState("");
  const [customDescription, setCustomDescription] = useState("");
  const [customOrder, setCustomOrder] = useState(100);
  const [customExecutive, setCustomExecutive] = useState(true);
  const [customManagementReview, setCustomManagementReview] = useState(true);

  useEffect(() => {
    initialize();
  }, []);

  const initialize = async () => {
    try {
      setLoading(true);
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const userEmail = String(authData?.user?.email || "").trim().toLowerCase();
      setEmail(userEmail);
      if (!userEmail) return;

      const activeTenantId = window.localStorage.getItem("qualisphere_active_tenant_id") || "";
      if (!activeTenantId) return;

      const { data: membership, error: membershipError } = await supabase
        .from("tenant_memberships")
        .select("tenant_id,membership_status,tenants(company_name)")
        .eq("tenant_id", activeTenantId)
        .ilike("user_email", userEmail)
        .eq("membership_status", "active")
        .maybeSingle();
      if (membershipError) throw membershipError;
      if (!membership) return;

      const { data: isCompanyAdmin, error: adminError } = await supabase.rpc(
        "qualisphere_is_company_admin",
        { p_tenant_id: activeTenantId }
      );
      if (adminError) throw adminError;
      if (isCompanyAdmin !== true) return;

      const tenant = Array.isArray((membership as any).tenants)
        ? (membership as any).tenants[0]
        : (membership as any).tenants;
      const resolvedCompanyName = String(
        tenant?.company_name || window.localStorage.getItem("qualisphere_active_tenant_name") || "Company Account"
      );

      setTenantId(activeTenantId);
      setCompanyName(resolvedCompanyName);
      setAuthorized(true);
      await Promise.all([
        loadSettings(activeTenantId, resolvedCompanyName),
        loadKpiConfiguration(activeTenantId),
        loadCustomKpis(activeTenantId),
      ]);
    } catch (error: any) {
      setMessage(error?.message || "Unable to load Company Settings.");
    } finally {
      setLoading(false);
    }
  };

  const loadSettings = async (activeTenantId: string, resolvedCompanyName: string) => {
    const { data, error } = await supabase
      .from("company_settings")
      .select("*")
      .eq("tenant_id", activeTenantId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw error;

    setSettings({
      ...DEFAULTS,
      ...(data || {}),
      tenant_id: activeTenantId,
      company_name: resolvedCompanyName,
    } as CompanySettings);
  };

  const loadKpiConfiguration = async (activeTenantId: string) => {
    let library: KpiLibraryItem[] = [];
    const { data: modernLibrary, error: modernError } = await supabase
      .from("kpi_library_definitions")
      .select("*")
      .eq("active", true)
      .order("module_name")
      .order("category")
      .order("default_display_order");

    if (!modernError && modernLibrary?.length) {
      library = modernLibrary as KpiLibraryItem[];
    } else {
      const { data: legacyLibrary, error: legacyError } = await supabase
        .from("kpi_library")
        .select("*")
        .order("module_name")
        .order("kpi_category")
        .order("kpi_name");
      if (legacyError && modernError) throw legacyError;
      library = (legacyLibrary || []) as KpiLibraryItem[];
    }

    setKpiLibrary(library);

    const { data: rows, error: configError } = await supabase
      .from("company_dashboard_kpi_configuration")
      .select("*")
      .eq("tenant_id", activeTenantId);
    if (configError) throw configError;

    const deduped = new Map<string, any>();
    for (const row of rows || []) {
      const key = `${normalizeModule(row.module_name)}:${row.kpi_key}`;
      if (!deduped.has(key)) deduped.set(key, row);
    }

    const next: KpiConfig = {};
    library.forEach((item, index) => {
      const key = `${normalizeModule(item.module_name)}:${item.kpi_key}`;
      const existing = deduped.get(key);
      next[key] = {
        executive_dashboard: existing?.executive_dashboard ?? Boolean(item.default_executive_dashboard ?? item.enabled_by_default ?? false),
        management_review: existing?.management_review ?? Boolean(item.default_management_review ?? item.enabled_by_default ?? false),
        display_order: Number(existing?.display_order || item.default_display_order || index + 1),
      };
    });
    setKpiConfig(next);

    const firstModule = Array.from(new Set(library.map((x) => normalizeModule(x.module_name)))).sort()[0] || "";
    setQuickAddModule(firstModule);
    const firstKpi = library.find((x) => normalizeModule(x.module_name) === firstModule);
    setQuickAddKpi(firstKpi?.kpi_key || "");
  };

  const loadCustomKpis = async (activeTenantId: string) => {
    const { data, error } = await supabase
      .from("custom_kpi_definitions")
      .select("*")
      .eq("tenant_id", activeTenantId)
      .eq("active", true)
      .order("display_order")
      .order("kpi_name");
    if (error) throw error;
    setCustomKpis((data || []) as CustomKpi[]);
  };

  const saveSettings = async () => {
    if (!settings || !tenantId) return;
    setSaving(true);
    setMessage("");
    try {
      const payload = {
        tenant_id: tenantId,
        company_name: companyName,
        enable_notifications: settings.enable_notifications,
        enable_overdue_scan: settings.enable_overdue_scan,
        enable_task_sla_dashboard: settings.enable_task_sla_dashboard,
        enable_escalation_dashboard: settings.enable_escalation_dashboard,
        enable_email_notifications: settings.enable_email_notifications,
        overdue_scan_mode: settings.overdue_scan_mode,
        notification_default_frequency: settings.notification_default_frequency,
        overdue_bucket_1: Number(settings.overdue_bucket_1) || 7,
        overdue_bucket_2: Number(settings.overdue_bucket_2) || 14,
        overdue_bucket_3: Number(settings.overdue_bucket_3) || 30,
        allow_users_to_override_preferences: settings.allow_users_to_override_preferences,
        updated_at: new Date().toISOString(),
      };

      let error: any = null;
      if (settings.id) {
        ({ error } = await supabase.from("company_settings").update(payload).eq("id", settings.id).eq("tenant_id", tenantId));
      } else {
        const response = await supabase.from("company_settings").insert(payload).select().single();
        error = response.error;
        if (response.data) setSettings((current) => current ? { ...current, id: response.data.id } : current);
      }
      if (error) throw error;
      setMessage("Company Settings saved successfully.");
    } catch (error: any) {
      setMessage(error?.message || "Unable to save Company Settings.");
    } finally {
      setSaving(false);
    }
  };

  const saveKpis = async () => {
    if (!tenantId) return;
    setSavingKpis(true);
    setMessage("");
    try {
      const { error: deleteError } = await supabase
        .from("company_dashboard_kpi_configuration")
        .delete()
        .eq("tenant_id", tenantId);
      if (deleteError) throw deleteError;

      const rows = kpiLibrary.map((item, index) => {
        const key = `${normalizeModule(item.module_name)}:${item.kpi_key}`;
        const config = kpiConfig[key];
        return {
          tenant_id: tenantId,
          company_name: companyName,
          module_name: normalizeModule(item.module_name),
          kpi_key: item.kpi_key,
          executive_dashboard: config?.executive_dashboard ?? false,
          management_review: config?.management_review ?? false,
          display_order: Number(config?.display_order || item.default_display_order || index + 1),
        };
      });

      if (rows.length) {
        const { error: insertError } = await supabase
          .from("company_dashboard_kpi_configuration")
          .insert(rows);
        if (insertError) throw insertError;
      }
      setMessage("Quality Intelligence Catalog configuration saved successfully.");
      await loadKpiConfiguration(tenantId);
    } catch (error: any) {
      setMessage(error?.message || "Unable to save KPI configuration.");
    } finally {
      setSavingKpis(false);
    }
  };

  const addCatalogKpi = () => {
    const selected = kpiLibrary.find(
      (item) => normalizeModule(item.module_name) === quickAddModule && item.kpi_key === quickAddKpi
    );
    if (!selected) return;
    const key = `${normalizeModule(selected.module_name)}:${selected.kpi_key}`;
    setKpiConfig((current) => ({
      ...current,
      [key]: {
        executive_dashboard: true,
        management_review: true,
        display_order: current[key]?.display_order || selected.default_display_order || Object.keys(current).length + 1,
      },
    }));
  };

  const createCustomKpi = async () => {
    if (!tenantId || !customName.trim() || !customFilterField.trim()) {
      setMessage("KPI Name and Filter Field are required.");
      return;
    }
    if (customFilterOperator !== "is_not_blank" && !customFilterValue.trim()) {
      setMessage("Filter Value is required for the selected operator.");
      return;
    }

    const key = customName.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    const { error } = await supabase.from("custom_kpi_definitions").insert({
      tenant_id: tenantId,
      company_name: companyName,
      module_name: customModule,
      kpi_key: key,
      kpi_name: customName.trim(),
      kpi_description: customDescription.trim() || null,
      kpi_category: customCategory.trim() || "Custom",
      data_source: null,
      calculation_type: customCalculationType,
      filter_field: customFilterField.trim(),
      filter_operator: customFilterOperator,
      filter_value: customFilterOperator === "is_not_blank" ? null : customFilterValue.trim(),
      display_type: "card",
      executive_dashboard: customExecutive,
      management_review: customManagementReview,
      display_order: Number(customOrder || 100),
      active: true,
    });
    if (error) {
      setMessage(error.message);
      return;
    }
    setCustomName("");
    setCustomDescription("");
    setCustomFilterField("");
    setCustomFilterValue("");
    setCustomOrder(100);
    setMessage("Custom KPI created successfully.");
    await loadCustomKpis(tenantId);
  };

  const deactivateCustomKpi = async (id: string) => {
    const { error } = await supabase
      .from("custom_kpi_definitions")
      .update({ active: false })
      .eq("id", id)
      .eq("tenant_id", tenantId);
    if (error) {
      setMessage(error.message);
      return;
    }
    await loadCustomKpis(tenantId);
  };

  const modules = useMemo(
    () => Array.from(new Set(kpiLibrary.map((item) => normalizeModule(item.module_name)))).sort(),
    [kpiLibrary]
  );

  const filteredKpis = useMemo(
    () => catalogFilter === "all" ? kpiLibrary : kpiLibrary.filter((item) => normalizeModule(item.module_name) === catalogFilter),
    [kpiLibrary, catalogFilter]
  );

  const quickKpis = useMemo(
    () => kpiLibrary.filter((item) => normalizeModule(item.module_name) === quickAddModule),
    [kpiLibrary, quickAddModule]
  );

  if (loading) return <main style={pageStyle}>Loading Company Settings...</main>;

  if (!authorized || !settings) {
    return (
      <main style={pageStyle}>
        <h1>Access Denied</h1>
        <p>Only a Company Administrator for the active Company Account can access Company Settings.</p>
        <p><strong>Logged-in Email:</strong> {email || "none"}</p>
        {message ? <p style={{ color: "#b45309" }}>{message}</p> : null}
        <Link href="/workspace">Back to My Workspace</Link>
      </main>
    );
  }

  const update = <K extends keyof CompanySettings>(field: K, value: CompanySettings[K]) => {
    setSettings((current) => current ? { ...current, [field]: value } : current);
  };

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>COMPANY ADMINISTRATION</div>
          <h1 style={{ margin: "4px 0 8px", fontSize: 42 }}>Company Admin Settings</h1>
          <p style={{ margin: 0, color: "#64748b", fontSize: 18 }}>
            Configure governance defaults for <strong>{companyName}</strong>.
          </p>
          <p><strong>Company Administrator:</strong> {email}</p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/company-administration/master-data" style={greenButton}>Admin Master Data</Link>
          <Link href="/workspace" style={darkButton}>My Workspace</Link>
        </div>
      </header>

      {message ? <div style={messageStyle}>{message}</div> : null}

      <section style={cardStyle}>
        <h2>Company Profile</h2>
        <label style={labelStyle}>Company Name</label>
        <input value={companyName} readOnly style={inputStyle} />
        <p style={helpStyle}>Company Account identity is controlled by QualiSphere Platform Administration.</p>
      </section>

      <section style={cardStyle}>
        <h2>Notification Governance</h2>
        <div style={gridStyle}>
          <CheckCard label="Enable Notifications" checked={settings.enable_notifications} onChange={(v) => update("enable_notifications", v)} description="Master switch for in-app workflow notifications." />
          <CheckCard label="Enable Email Notifications" checked={settings.enable_email_notifications} onChange={(v) => update("enable_email_notifications", v)} description="Enable company email workflow notifications." />
          <CheckCard label="Allow User Preference Overrides" checked={settings.allow_users_to_override_preferences} onChange={(v) => update("allow_users_to_override_preferences", v)} description="Allows users to choose immediate, daily, weekly, or off." />
          <div>
            <label style={labelStyle}>Default Notification Frequency</label>
            <select value={settings.notification_default_frequency} onChange={(e) => update("notification_default_frequency", e.target.value as CompanySettings["notification_default_frequency"])} style={inputStyle}>
              <option value="immediate">Immediate</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="off">Off</option>
            </select>
          </div>
        </div>
      </section>

      <section style={cardStyle}>
        <h2>Overdue Governance</h2>
        <div style={gridStyle}>
          <CheckCard label="Enable Overdue Task Scan" checked={settings.enable_overdue_scan} onChange={(v) => update("enable_overdue_scan", v)} description="Allows overdue task scanning for company workflows." />
          <div>
            <label style={labelStyle}>Overdue Scan Mode</label>
            <select value={settings.overdue_scan_mode} onChange={(e) => update("overdue_scan_mode", e.target.value as CompanySettings["overdue_scan_mode"])} style={inputStyle}>
              <option value="manual">Manual</option><option value="scheduled">Scheduled</option><option value="disabled">Disabled</option>
            </select>
          </div>
        </div>
      </section>

      <section style={cardStyle}>
        <h2>Dashboard Governance</h2>
        <div style={gridStyle}>
          <CheckCard label="Enable Task SLA Dashboard" checked={settings.enable_task_sla_dashboard} onChange={(v) => update("enable_task_sla_dashboard", v)} description="Show or hide task aging, owner workload, and overdue owner exposure." />
          <CheckCard label="Enable Escalation Dashboard" checked={settings.enable_escalation_dashboard} onChange={(v) => update("enable_escalation_dashboard", v)} description="Show or hide executive escalation cards." />
        </div>
      </section>

      <section style={cardStyle}>
        <h2>Quality Intelligence Catalog</h2>
        <p style={helpStyle}>Choose which standard QualiSphere KPIs are available to this Company Account's Executive Dashboard and Management Review.</p>
        <button onClick={saveKpis} disabled={savingKpis} style={blueButton}>{savingKpis ? "Saving..." : "Save KPI Catalog"}</button>

        <div style={{ ...gridStyle, marginTop: 18 }}>
          <div><label style={labelStyle}>Catalog Filter</label><select value={catalogFilter} onChange={(e) => setCatalogFilter(e.target.value)} style={inputStyle}><option value="all">All Modules</option>{modules.map((m) => <option key={m} value={m}>{labelModule(m)}</option>)}</select></div>
          <div><label style={labelStyle}>Add KPI From Module</label><select value={quickAddModule} onChange={(e) => { const value = e.target.value; setQuickAddModule(value); const first = kpiLibrary.find((x) => normalizeModule(x.module_name) === value); setQuickAddKpi(first?.kpi_key || ""); }} style={inputStyle}>{modules.map((m) => <option key={m} value={m}>{labelModule(m)}</option>)}</select></div>
          <div><label style={labelStyle}>Available KPI</label><select value={quickAddKpi} onChange={(e) => setQuickAddKpi(e.target.value)} style={inputStyle}>{quickKpis.map((k) => <option key={k.kpi_key} value={k.kpi_key}>{k.kpi_name}</option>)}</select></div>
          <div style={{ alignSelf: "end" }}><button onClick={addCatalogKpi} style={blueButton}>Add KPI</button></div>
        </div>

        <div style={{ overflowX: "auto", marginTop: 20 }}>
          <table style={tableStyle}>
            <thead><tr><th>Module</th><th>Category</th><th>KPI</th><th>Description</th><th>Executive Dashboard</th><th>Management Review</th><th>Display Order</th></tr></thead>
            <tbody>{filteredKpis.map((item) => {
              const key = `${normalizeModule(item.module_name)}:${item.kpi_key}`;
              const cfg = kpiConfig[key] || { executive_dashboard: false, management_review: false, display_order: 1 };
              return <tr key={`${item.module_name}-${item.kpi_key}`}>
                <td>{labelModule(item.module_name)}</td><td>{item.category || item.kpi_category || "General"}</td>
                <td><strong>{item.kpi_name}</strong><div style={mutedStyle}>{item.kpi_key}</div></td><td>{item.kpi_description || ""}</td>
                <td><input type="checkbox" checked={cfg.executive_dashboard} onChange={(e) => setKpiConfig((current) => ({ ...current, [key]: { ...cfg, executive_dashboard: e.target.checked } }))} /></td>
                <td><input type="checkbox" checked={cfg.management_review} onChange={(e) => setKpiConfig((current) => ({ ...current, [key]: { ...cfg, management_review: e.target.checked } }))} /></td>
                <td><input type="number" value={cfg.display_order} onChange={(e) => setKpiConfig((current) => ({ ...current, [key]: { ...cfg, display_order: Number(e.target.value || 1) } }))} style={{ ...inputStyle, minWidth: 90 }} /></td>
              </tr>;
            })}</tbody>
          </table>
        </div>
      </section>

      <section style={cardStyle}>
        <h2>Custom KPI Builder</h2>
        <p style={helpStyle}>Create company-specific KPI cards without changing application code.</p>
        <div style={gridStyle}>
          <Field label="KPI Name"><input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Example: Open Engineering Changes" style={inputStyle} /></Field>
          <Field label="Module"><select value={customModule} onChange={(e) => setCustomModule(e.target.value)} style={inputStyle}>{modules.map((m) => <option key={m} value={m}>{labelModule(m)}</option>)}</select></Field>
          <Field label="KPI Category"><input value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} style={inputStyle} /></Field>
          <Field label="Calculation Type"><select value={customCalculationType} onChange={(e) => setCustomCalculationType(e.target.value)} style={inputStyle}><option value="count">Record Count</option></select></Field>
          <Field label="Filter Field"><input value={customFilterField} onChange={(e) => setCustomFilterField(e.target.value)} placeholder="status, risk_level, change_type" style={inputStyle} /></Field>
          <Field label="Operator"><select value={customFilterOperator} onChange={(e) => setCustomFilterOperator(e.target.value)} style={inputStyle}><option value="equals">Equals</option><option value="not_equals">Not Equals</option><option value="is_not_blank">Is Not Blank</option></select></Field>
          <Field label="Filter Value"><input value={customFilterValue} onChange={(e) => setCustomFilterValue(e.target.value)} placeholder="implementation, high, closed" style={inputStyle} /></Field>
          <Field label="Display Order"><input type="number" value={customOrder} onChange={(e) => setCustomOrder(Number(e.target.value || 100))} style={inputStyle} /></Field>
        </div>
        <Field label="KPI Description"><textarea value={customDescription} onChange={(e) => setCustomDescription(e.target.value)} style={{ ...inputStyle, minHeight: 90 }} placeholder="Describe what this KPI measures and why it matters" /></Field>
        <div style={{ display: "flex", gap: 24, margin: "12px 0" }}><label><input type="checkbox" checked={customExecutive} onChange={(e) => setCustomExecutive(e.target.checked)} /> Executive Dashboard</label><label><input type="checkbox" checked={customManagementReview} onChange={(e) => setCustomManagementReview(e.target.checked)} /> Management Review</label></div>
        <button onClick={createCustomKpi} style={blueButton}>Create Custom KPI</button>
        {customKpis.length ? <div style={{ marginTop: 18 }}>{customKpis.map((k) => <div key={k.id} style={customKpiRow}><div><strong>{k.kpi_name}</strong> — {labelModule(k.module_name)} <span style={mutedStyle}>({k.kpi_category || "Custom"})</span></div><button onClick={() => deactivateCustomKpi(k.id)}>Deactivate</button></div>)}</div> : <div style={infoStyle}>No active custom KPIs have been created for this company yet.</div>}
      </section>

      <section style={cardStyle}>
        <h2>Task SLA Aging Buckets</h2>
        <p style={helpStyle}>These values define aging buckets used by task SLA dashboards.</p>
        <div style={gridStyle}>
          <Field label="Bucket 1 Threshold"><input type="number" value={settings.overdue_bucket_1} onChange={(e) => update("overdue_bucket_1", Number(e.target.value || 7))} style={inputStyle} /></Field>
          <Field label="Bucket 2 Threshold"><input type="number" value={settings.overdue_bucket_2} onChange={(e) => update("overdue_bucket_2", Number(e.target.value || 14))} style={inputStyle} /></Field>
          <Field label="Bucket 3 Threshold"><input type="number" value={settings.overdue_bucket_3} onChange={(e) => update("overdue_bucket_3", Number(e.target.value || 30))} style={inputStyle} /></Field>
        </div>
        <div style={infoStyle}>Current SLA buckets: 1–{settings.overdue_bucket_1} days, {settings.overdue_bucket_1 + 1}–{settings.overdue_bucket_2} days, {settings.overdue_bucket_2 + 1}–{settings.overdue_bucket_3} days, {settings.overdue_bucket_3 + 1}+ days.</div>
      </section>

      <div style={{ display: "flex", justifyContent: "flex-end" }}><button onClick={saveSettings} disabled={saving} style={blueButton}>{saving ? "Saving..." : "Save Company Settings"}</button></div>
    </main>
  );
}

function CheckCard({ label, checked, onChange, description }: { label: string; checked: boolean; onChange: (value: boolean) => void; description: string }) {
  return <label style={checkCardStyle}><div style={{ display: "flex", gap: 10, alignItems: "center", fontWeight: 800 }}><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />{label}</div><div style={helpStyle}>{description}</div></label>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label style={labelStyle}>{label}</label>{children}</div>;
}

const pageStyle: React.CSSProperties = { minHeight: "100vh", background: "#f8fafc", color: "#0f172a", fontFamily: "Arial, sans-serif", padding: 24 };
const headerStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 20, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 24 };
const eyebrowStyle: React.CSSProperties = { color: "#64748b", fontWeight: 900, letterSpacing: ".12em", fontSize: 12 };
const cardStyle: React.CSSProperties = { background: "#fff", border: "1px solid #cbd5e1", borderRadius: 20, padding: 28, marginBottom: 24 };
const gridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 18 };
const checkCardStyle: React.CSSProperties = { display: "block", border: "1px solid #e2e8f0", background: "#f8fafc", borderRadius: 16, padding: 20 };
const labelStyle: React.CSSProperties = { display: "block", fontWeight: 800, marginBottom: 8 };
const inputStyle: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "12px 14px", border: "1px solid #cbd5e1", borderRadius: 10, background: "#fff" };
const helpStyle: React.CSSProperties = { color: "#64748b", lineHeight: 1.45, marginTop: 8 };
const mutedStyle: React.CSSProperties = { color: "#64748b", fontSize: 12, marginTop: 4 };
const blueButton: React.CSSProperties = { background: "#2563eb", color: "#fff", border: 0, borderRadius: 10, padding: "12px 18px", fontWeight: 800, cursor: "pointer" };
const greenButton: React.CSSProperties = { ...blueButton, background: "#059669", textDecoration: "none" };
const darkButton: React.CSSProperties = { ...blueButton, background: "#0f172a", textDecoration: "none" };
const messageStyle: React.CSSProperties = { background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e3a8a", borderRadius: 12, padding: 12, marginBottom: 18 };
const infoStyle: React.CSSProperties = { background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e3a8a", borderRadius: 12, padding: 14, marginTop: 16 };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse" };
const customKpiRow: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", borderTop: "1px solid #e2e8f0", padding: "12px 0" };
