"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { PLATFORM_MODULE_CATALOG } from "../../../lib/platformModuleCatalog";

type Tenant = {
  id: string;
  tenant_code: string;
  company_name: string;
  legal_name: string | null;
  slug: string;
  status: string;
  is_internal: boolean;
  primary_contact_email: string | null;
  country_code: string | null;
  default_timezone: string | null;
  created_at: string;
};

type Membership = {
  tenant_id: string;
  user_email: string;
  membership_role: string;
  membership_status: string;
};

type ModuleAccess = {
  id?: string;
  tenant_id: string;
  module_code: string;
  is_enabled: boolean;
};

const emptyForm = {
  companyName: "",
  legalName: "",
  tenantCode: "",
  slug: "",
  customerContactEmail: "",
  initialCompanyAdminEmail: "",
  countryCode: "US",
  defaultTimezone: "America/Chicago",
};

export default function CompanyRegistryPage() {
  const [loading, setLoading] = useState(true);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [modules, setModules] = useState<ModuleAccess[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [selectedModules, setSelectedModules] = useState<string[]>([]);

  useEffect(() => {
    void initialize();
  }, []);

  const initialize = async () => {
    setLoading(true);
    setMessage("");
    setErrorMessage("");

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (authError) {
        setUserEmail("");
        setIsPlatformAdmin(false);
        setErrorMessage("Unable to verify your QualiSphere session. Please sign in again.");
        return;
      }

      const email = authData?.user?.email || "";
      setUserEmail(email);

      if (!email) {
        setIsPlatformAdmin(false);
        return;
      }

      const { data: adminData, error: adminError } = await supabase.rpc(
        "is_platform_admin",
      );

      if (adminError) {
        setIsPlatformAdmin(false);
        setErrorMessage("Unable to verify Platform Administrator access.");
        return;
      }

      if (adminData !== true) {
        setIsPlatformAdmin(false);
        return;
      }

      setIsPlatformAdmin(true);
      await loadRegistry();
    } catch (error: any) {
      setErrorMessage(error?.message || "Unable to load the Company Registry.");
    } finally {
      setLoading(false);
    }
  };

  const loadRegistry = async () => {
    const [tenantResult, membershipResult, moduleResult] = await Promise.all([
      supabase.from("tenants").select("*").order("company_name"),
      supabase
        .from("tenant_memberships")
        .select("tenant_id,user_email,membership_role,membership_status"),
      supabase
        .from("tenant_module_access")
        .select("id,tenant_id,module_code,is_enabled"),
    ]);

    if (tenantResult.error) throw tenantResult.error;
    if (membershipResult.error) throw membershipResult.error;
    if (moduleResult.error) throw moduleResult.error;

    setTenants((tenantResult.data || []) as Tenant[]);
    setMemberships((membershipResult.data || []) as Membership[]);
    setModules((moduleResult.data || []) as ModuleAccess[]);
  };

  const memberCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    memberships.forEach((membership) => {
      if (membership.membership_status === "active") {
        counts[membership.tenant_id] = (counts[membership.tenant_id] || 0) + 1;
      }
    });
    return counts;
  }, [memberships]);

  const moduleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    modules.forEach((module) => {
      if (module.is_enabled) {
        counts[module.tenant_id] = (counts[module.tenant_id] || 0) + 1;
      }
    });
    return counts;
  }, [modules]);

  const setField = (field: keyof typeof emptyForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const autoTenantCode = () => {
    if (form.tenantCode.trim()) return;
    const value = form.companyName
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
    setField("tenantCode", value);
  };

  const autoSlug = () => {
    if (form.slug.trim()) return;
    const value = form.companyName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
    setField("slug", value);
  };

  const toggleModule = (moduleCode: string) => {
    setSelectedModules((current) =>
      current.includes(moduleCode)
        ? current.filter((code) => code !== moduleCode)
        : [...current, moduleCode],
    );
  };

  const saveSubscriptionModules = async (tenantId: string) => {
    const { data: existingRows, error: existingError } = await supabase
      .from("tenant_module_access")
      .select("id,module_code")
      .eq("tenant_id", tenantId);

    if (existingError) throw existingError;

    const existingByCode = new Map(
      (existingRows || []).map((row: any) => [String(row.module_code), row]),
    );
    const changedAt = new Date().toISOString();

    for (const moduleDefinition of PLATFORM_MODULE_CATALOG) {
      const enabled = selectedModules.includes(moduleDefinition.code);
      const existing = existingByCode.get(moduleDefinition.code) as any;

      if (existing?.id) {
        const { error } = await supabase
          .from("tenant_module_access")
          .update({
            is_enabled: enabled,
            enabled_by: userEmail,
            enabled_at: changedAt,
          })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tenant_module_access").insert({
          tenant_id: tenantId,
          module_code: moduleDefinition.code,
          is_enabled: enabled,
          enabled_by: userEmail,
          enabled_at: changedAt,
        });
        if (error) throw error;
      }
    }
  };

  const createTenant = async (event: FormEvent) => {
    event.preventDefault();
    setMessage("");
    setErrorMessage("");

    if (!form.companyName.trim()) {
      setErrorMessage("Company name is required.");
      return;
    }
    if (!form.tenantCode.trim()) {
      setErrorMessage("Tenant code is required.");
      return;
    }
    if (!form.slug.trim()) {
      setErrorMessage("Tenant slug is required.");
      return;
    }
    if (!form.customerContactEmail.trim()) {
      setErrorMessage("Customer Contact email is required.");
      return;
    }
    if (!form.initialCompanyAdminEmail.trim()) {
      setErrorMessage("Initial Company Administrator email is required.");
      return;
    }
    if (selectedModules.length === 0) {
      setErrorMessage("Select at least one subscribed QualiSphere module.");
      return;
    }

    setCreating(true);

    try {
      const contactEmail = form.customerContactEmail.trim().toLowerCase();
      const initialAdminEmail = form.initialCompanyAdminEmail.trim().toLowerCase();
      const { data, error } = await supabase.rpc("qualisphere_create_tenant", {
        p_company_name: form.companyName.trim(),
        p_legal_name: form.legalName.trim(),
        p_tenant_code: form.tenantCode.trim(),
        p_slug: form.slug.trim(),
        p_primary_contact_email: contactEmail,
        p_company_admin_email: initialAdminEmail,
        p_country_code: form.countryCode.trim() || "US",
        p_default_timezone: form.defaultTimezone.trim() || "America/Chicago",
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      const tenantId = String(data || "");

      try {
        await saveSubscriptionModules(tenantId);
      } catch (moduleError: any) {
        setMessage(`Company account created successfully. Tenant ID: ${tenantId}`);
        setErrorMessage(
          `The Company Account was created, but its module subscription could not be saved. Do not create the company again. Open the Company Account and retry the subscription assignment. ${moduleError?.message || ""}`.trim(),
        );
        await loadRegistry();
        return;
      }

      setForm(emptyForm);
      setSelectedModules([]);
      setShowCreate(false);
      setMessage(
        `Company account created successfully. Master Data Administration is included and initial administrative authority was assigned to ${initialAdminEmail}. ${selectedModules.length} subscribed module${selectedModules.length === 1 ? "" : "s"} enabled. Tenant ID: ${tenantId}`,
      );

      try {
        await loadRegistry();
      } catch (refreshError: any) {
        setErrorMessage(
          `The company account and subscription were created successfully, but the registry could not refresh. Do not create the company again. Refresh this page before retrying. ${refreshError?.message || ""}`.trim(),
        );
      }
    } catch (error: any) {
      setErrorMessage(error?.message || "Unable to create the company account.");
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return <main style={pageStyle}>Loading Company Registry...</main>;
  }

  if (!userEmail) {
    return (
      <main style={pageStyle}>
        <h1>Company Registry</h1>
        {errorMessage ? <div style={warningStyle}>{errorMessage}</div> : null}
        <p>You must be signed in to access Platform Administration.</p>
        <Link href="/login">Sign In</Link>
      </main>
    );
  }

  if (!isPlatformAdmin) {
    return (
      <main style={pageStyle}>
        <div style={headerRowStyle}>
          <div>
            <div style={eyebrowStyle}>QUALISPHERE PLATFORM ADMINISTRATION</div>
            <h1 style={titleStyle}>Company Registry</h1>
          </div>
          <Link href="/" style={linkButtonStyle}>Home</Link>
        </div>
        {errorMessage ? <div style={warningStyle}>{errorMessage}</div> : null}
        <div style={warningStyle}>
          Platform Administrator access is required. Customer account access does not grant visibility to other QualiSphere company accounts.
        </div>
      </main>
    );
  }

  const moduleGroups = ["Quality Management", "Analytics & Governance"] as const;

  return (
    <main style={pageStyle}>
      <div style={headerRowStyle}>
        <div>
          <div style={eyebrowStyle}>QUALISPHERE PLATFORM ADMINISTRATION</div>
          <h1 style={titleStyle}>Company Registry</h1>
          <p style={subtitleStyle}>
            Create independent Company Accounts, establish the initial administrative handoff, and assign the QualiSphere modules included in each subscription.
          </p>
        </div>
        <div style={headerActionsStyle}>
          <Link href="/admin/company-settings" style={linkButtonStyle}>Company Settings</Link>
          <Link href="/" style={linkButtonStyle}>Home</Link>
          <button style={primaryButtonStyle} onClick={() => setShowCreate((value) => !value)}>
            {showCreate ? "Cancel" : "Create Company"}
          </button>
        </div>
      </div>

      <div style={identityBarStyle}>
        <strong>Platform Administrator:</strong> {userEmail}
      </div>

      {message ? <div style={messageStyle}>{message}</div> : null}
      {errorMessage ? <div style={warningStyle}>{errorMessage}</div> : null}

      {showCreate ? (
        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>Create Company Account</h2>
          <p style={helperStyle}>
            Create the independent Company Account, identify the relationship contact, designate the Initial Company Administrator who receives Master Data Administration authority, and assign only the operational modules included in the customer's subscription.
          </p>
          <form onSubmit={createTenant}>
            <div style={formGridStyle}>
              <Field label="Company Name *" value={form.companyName} onChange={(value) => setField("companyName", value)} onBlur={() => { autoTenantCode(); autoSlug(); }} />
              <Field label="Legal Name" value={form.legalName} onChange={(value) => setField("legalName", value)} />
              <Field label="Tenant Code *" value={form.tenantCode} onChange={(value) => setField("tenantCode", value.toUpperCase())} />
              <Field label="Tenant Slug *" value={form.slug} onChange={(value) => setField("slug", value.toLowerCase())} />
              <Field label="Customer Contact Email *" type="email" value={form.customerContactEmail} onChange={(value) => setField("customerContactEmail", value)} />
              <Field label="Initial Company Administrator Email *" type="email" value={form.initialCompanyAdminEmail} onChange={(value) => setField("initialCompanyAdminEmail", value)} />
              <Field label="Country Code" value={form.countryCode} onChange={(value) => setField("countryCode", value.toUpperCase())} />
              <Field label="Default Time Zone" value={form.defaultTimezone} onChange={(value) => setField("defaultTimezone", value)} />
            </div>

            <div style={handoffStyle}>
              <strong>Administrative handoff:</strong> The Customer Contact is the relationship contact and receives no automatic QMS authority. The Initial Company Administrator receives the tenant-scoped Master Data Administration authority at account creation. Both fields may use the same person when the customer chooses.
            </div>

            <div style={subscriptionSectionStyle}>
              <div style={subscriptionHeaderStyle}>
                <div>
                  <h3 style={subscriptionTitleStyle}>Subscribed Modules *</h3>
                  <p style={subscriptionHelperStyle}>
                    Master Data Administration is provisioned automatically with every Company Account and is not a subscription checkbox.
                  </p>
                </div>
                <div style={subscriptionActionsStyle}>
                  <button type="button" style={secondaryButtonStyle} onClick={() => setSelectedModules(PLATFORM_MODULE_CATALOG.map((module) => module.code))}>Select All</button>
                  <button type="button" style={secondaryButtonStyle} onClick={() => setSelectedModules([])}>Clear</button>
                </div>
              </div>

              {moduleGroups.map((group) => (
                <div key={group} style={{ marginTop: 18 }}>
                  <div style={groupLabelStyle}>{group}</div>
                  <div style={moduleGridStyle}>
                    {PLATFORM_MODULE_CATALOG.filter((module) => module.group === group).map((module) => (
                      <label key={module.code} style={moduleOptionStyle}>
                        <input
                          type="checkbox"
                          checked={selectedModules.includes(module.code)}
                          onChange={() => toggleModule(module.code)}
                        />
                        <span>{module.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <div style={includedCoreStyle}><strong>Always included:</strong> Master Data Administration</div>
            </div>

            <div style={{ marginTop: 20 }}>
              <button type="submit" style={primaryButtonStyle} disabled={creating}>
                {creating ? "Creating Company..." : "Create Company Account"}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <h2 style={sectionTitleStyle}>Registered Company Accounts</h2>
            <p style={helperStyle}>{tenants.length} company account{tenants.length === 1 ? "" : "s"} registered.</p>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Company</th>
                <th style={thStyle}>Tenant Code</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Customer Contact</th>
                <th style={thStyle}>Active Members</th>
                <th style={thStyle}>Subscribed Modules</th>
                <th style={thStyle}>Action</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((tenant) => (
                <tr key={tenant.id}>
                  <td style={tdStyle}>
                    <strong>{tenant.company_name}</strong>
                    {tenant.legal_name && tenant.legal_name !== tenant.company_name ? (
                      <div style={smallStyle}>{tenant.legal_name}</div>
                    ) : null}
                  </td>
                  <td style={tdStyle}>{tenant.tenant_code}</td>
                  <td style={tdStyle}>{tenant.is_internal ? "Development / Validation" : "Customer"}</td>
                  <td style={tdStyle}><StatusBadge status={tenant.status} /></td>
                  <td style={tdStyle}>{tenant.primary_contact_email || "N/A"}</td>
                  <td style={tdStyle}>{memberCounts[tenant.id] || 0}</td>
                  <td style={tdStyle}>{moduleCounts[tenant.id] || 0}</td>
                  <td style={tdStyle}>
                    <Link href={`/admin/companies/${tenant.id}`} style={actionLinkStyle}>Open Company</Link>
                  </td>
                </tr>
              ))}
              {tenants.length === 0 ? (
                <tr><td style={tdStyle} colSpan={8}>No company accounts found.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function Field({ label, value, onChange, onBlur, type = "text" }: { label: string; value: string; onChange: (value: string) => void; onBlur?: () => void; type?: string }) {
  return (
    <label style={fieldStyle}>
      <span style={labelStyle}>{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} onBlur={onBlur} style={inputStyle} />
    </label>
  );
}

function StatusBadge({ status }: { status: string }) {
  const active = status === "active";
  return <span style={{ ...badgeStyle, background: active ? "#dcfce7" : "#fef3c7", color: active ? "#166534" : "#92400e" }}>{status}</span>;
}

const pageStyle: React.CSSProperties = { minHeight: "100vh", background: "#f8fafc", padding: "32px", fontFamily: "Arial, sans-serif", color: "#0f172a" };
const headerRowStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 24, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 20 };
const headerActionsStyle: React.CSSProperties = { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" };
const eyebrowStyle: React.CSSProperties = { fontSize: 12, fontWeight: 900, letterSpacing: "0.12em", color: "#2563eb" };
const titleStyle: React.CSSProperties = { margin: "6px 0 4px", fontSize: 36 };
const subtitleStyle: React.CSSProperties = { margin: 0, color: "#475569", maxWidth: 760, lineHeight: 1.5 };
const cardStyle: React.CSSProperties = { background: "white", border: "1px solid #dbe3ef", borderRadius: 16, padding: 24, marginBottom: 22, boxShadow: "0 8px 22px rgba(15,23,42,0.05)" };
const sectionHeaderStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", marginBottom: 14 };
const sectionTitleStyle: React.CSSProperties = { margin: 0, fontSize: 24 };
const helperStyle: React.CSSProperties = { color: "#64748b", lineHeight: 1.5, margin: "8px 0 18px" };
const identityBarStyle: React.CSSProperties = { background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 12, padding: "12px 16px", marginBottom: 20, color: "#1e3a8a" };
const warningStyle: React.CSSProperties = { background: "#fff7ed", border: "1px solid #fdba74", borderRadius: 12, padding: 18, color: "#9a3412", marginBottom: 20 };
const messageStyle: React.CSSProperties = { background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 12, padding: 14, marginBottom: 20, color: "#166534" };
const formGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 };
const fieldStyle: React.CSSProperties = { display: "grid", gap: 7 };
const labelStyle: React.CSSProperties = { fontWeight: 800, fontSize: 14, color: "#334155" };
const inputStyle: React.CSSProperties = { width: "100%", boxSizing: "border-box", border: "1px solid #cbd5e1", borderRadius: 9, padding: "11px 12px", fontSize: 15 };
const primaryButtonStyle: React.CSSProperties = { border: 0, borderRadius: 9, background: "#2563eb", color: "white", padding: "11px 17px", fontWeight: 800, cursor: "pointer" };
const secondaryButtonStyle: React.CSSProperties = { border: "1px solid #cbd5e1", borderRadius: 8, background: "white", color: "#334155", padding: "8px 11px", fontWeight: 800, cursor: "pointer" };
const linkButtonStyle: React.CSSProperties = { border: "1px solid #cbd5e1", borderRadius: 9, background: "white", color: "#0f172a", padding: "10px 15px", fontWeight: 800, textDecoration: "none" };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", minWidth: 1050 };
const thStyle: React.CSSProperties = { textAlign: "left", borderBottom: "1px solid #cbd5e1", padding: "12px 10px", background: "#f8fafc", fontSize: 13 };
const tdStyle: React.CSSProperties = { borderBottom: "1px solid #e2e8f0", padding: "14px 10px", verticalAlign: "top", fontSize: 14 };
const smallStyle: React.CSSProperties = { fontSize: 12, color: "#64748b", marginTop: 4 };
const badgeStyle: React.CSSProperties = { display: "inline-block", borderRadius: 999, padding: "5px 9px", fontSize: 12, fontWeight: 800 };
const actionLinkStyle: React.CSSProperties = { color: "#1d4ed8", fontWeight: 800, textDecoration: "none" };
const handoffStyle: React.CSSProperties = { marginTop: 18, borderRadius: 10, padding: "12px 14px", background: "#f8fafc", border: "1px solid #cbd5e1", color: "#334155", lineHeight: 1.5 };
const subscriptionSectionStyle: React.CSSProperties = { marginTop: 24, border: "1px solid #bfdbfe", borderRadius: 14, padding: 18, background: "#f8fbff" };
const subscriptionHeaderStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" };
const subscriptionActionsStyle: React.CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap" };
const subscriptionTitleStyle: React.CSSProperties = { margin: 0, fontSize: 19 };
const subscriptionHelperStyle: React.CSSProperties = { color: "#64748b", margin: "6px 0 0", lineHeight: 1.45, maxWidth: 760 };
const groupLabelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 900, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 };
const moduleGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10 };
const moduleOptionStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 9, border: "1px solid #dbe3ef", borderRadius: 10, padding: "10px 12px", background: "white", fontWeight: 700, cursor: "pointer" };
const includedCoreStyle: React.CSSProperties = { marginTop: 18, borderRadius: 10, padding: "11px 13px", background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#166534" };
