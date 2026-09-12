"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../../../../lib/supabaseClient";
import { PLATFORM_MODULE_CATALOG } from "../../../../lib/platformModuleCatalog";

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
  created_by: string | null;
};

type Membership = {
  id: string;
  user_email: string;
  membership_role: string;
  membership_status: string;
  invited_by: string | null;
  invited_at: string | null;
  joined_at: string | null;
};

type ModuleAccess = {
  id: string;
  module_code: string;
  is_enabled: boolean;
  enabled_by: string | null;
  enabled_at: string | null;
};

export default function CompanyDetailPage() {
  const params = useParams<{ id: string }>();
  const tenantId = params?.id || "";
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [platformAdminEmail, setPlatformAdminEmail] = useState("");
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [modules, setModules] = useState<ModuleAccess[]>([]);
  const [enabledModuleCodes, setEnabledModuleCodes] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [activationMessage, setActivationMessage] = useState("");
  const [activationError, setActivationError] = useState("");
  const [sendingActivationFor, setSendingActivationFor] = useState("");
  const [savingModules, setSavingModules] = useState(false);
  const [moduleMessage, setModuleMessage] = useState("");
  const [moduleError, setModuleError] = useState("");

  useEffect(() => {
    void load();
  }, [tenantId]);

  const load = async () => {
    if (!tenantId) return;
    setLoading(true);
    setError("");

    const { data: authData } = await supabase.auth.getUser();
    const email = String(authData?.user?.email || "").trim().toLowerCase();
    setPlatformAdminEmail(email);

    if (!email) {
      setLoading(false);
      return;
    }

    const { data: adminData, error: adminError } = await supabase.rpc("is_platform_admin");
    if (adminError || adminData !== true) {
      setAuthorized(false);
      setLoading(false);
      return;
    }

    setAuthorized(true);

    const [tenantResult, membershipResult, moduleResult] = await Promise.all([
      supabase.from("tenants").select("*").eq("id", tenantId).maybeSingle(),
      supabase.from("tenant_memberships").select("*").eq("tenant_id", tenantId).order("user_email"),
      supabase.from("tenant_module_access").select("*").eq("tenant_id", tenantId).order("module_code"),
    ]);

    if (tenantResult.error) setError(tenantResult.error.message);
    if (membershipResult.error) setError(membershipResult.error.message);
    if (moduleResult.error) setError(moduleResult.error.message);

    const loadedModules = (moduleResult.data || []) as ModuleAccess[];
    setTenant((tenantResult.data || null) as Tenant | null);
    setMemberships((membershipResult.data || []) as Membership[]);
    setModules(loadedModules);
    setEnabledModuleCodes(
      loadedModules.filter((module) => module.is_enabled).map((module) => module.module_code),
    );
    setLoading(false);
  };

  const sendActivation = async (membership: Membership) => {
    setActivationMessage("");
    setActivationError("");
    setSendingActivationFor(membership.user_email);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        setActivationError("Your Platform Administrator session has expired. Please sign in again.");
        return;
      }

      const response = await fetch("/api/platform/invite-company-admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ tenantId, email: membership.user_email }),
      });

      const result = await response.json();
      if (!response.ok) {
        setActivationError(result?.error || "Unable to send activation email.");
        return;
      }

      setActivationMessage(`Activation email sent to ${membership.user_email}.`);
    } catch (requestError: any) {
      setActivationError(requestError?.message || "Unable to send activation email.");
    } finally {
      setSendingActivationFor("");
    }
  };

  const toggleModule = (moduleCode: string) => {
    setEnabledModuleCodes((current) =>
      current.includes(moduleCode)
        ? current.filter((code) => code !== moduleCode)
        : [...current, moduleCode],
    );
  };

  const saveSubscriptionModules = async () => {
    setModuleMessage("");
    setModuleError("");

    if (enabledModuleCodes.length === 0) {
      setModuleError("Select at least one subscribed QualiSphere module.");
      return;
    }

    setSavingModules(true);

    try {
      const existingByCode = new Map(modules.map((module) => [module.module_code, module]));
      const changedAt = new Date().toISOString();

      for (const moduleDefinition of PLATFORM_MODULE_CATALOG) {
        const enabled = enabledModuleCodes.includes(moduleDefinition.code);
        const existing = existingByCode.get(moduleDefinition.code);

        if (existing?.id) {
          const { error: updateError } = await supabase
            .from("tenant_module_access")
            .update({
              is_enabled: enabled,
              enabled_by: platformAdminEmail,
              enabled_at: changedAt,
            })
            .eq("id", existing.id);
          if (updateError) throw updateError;
        } else {
          const { error: insertError } = await supabase
            .from("tenant_module_access")
            .insert({
              tenant_id: tenantId,
              module_code: moduleDefinition.code,
              is_enabled: enabled,
              enabled_by: platformAdminEmail,
              enabled_at: changedAt,
            });
          if (insertError) throw insertError;
        }
      }

      const { data: refreshedModules, error: refreshError } = await supabase
        .from("tenant_module_access")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("module_code");

      if (refreshError) throw refreshError;

      const nextModules = (refreshedModules || []) as ModuleAccess[];
      setModules(nextModules);
      setEnabledModuleCodes(
        nextModules.filter((module) => module.is_enabled).map((module) => module.module_code),
      );
      setModuleMessage("Company subscription updated successfully.");
    } catch (saveError: any) {
      setModuleError(saveError?.message || "Unable to update the company subscription.");
    } finally {
      setSavingModules(false);
    }
  };

  if (loading) return <main style={pageStyle}>Loading company...</main>;

  if (!authorized) {
    return (
      <main style={pageStyle}>
        <h1>Company Administration</h1>
        <div style={warningStyle}>Platform Administrator access is required.</div>
      </main>
    );
  }

  if (!tenant) {
    return (
      <main style={pageStyle}>
        <Link href="/admin/companies" style={backLinkStyle}>← Company Registry</Link>
        <h1>Company Not Found</h1>
        {error ? <div style={warningStyle}>{error}</div> : null}
      </main>
    );
  }

  const customerContacts = memberships.filter((membership) => membership.membership_role === "company_admin");
  const moduleGroups = ["Quality Management", "Analytics & Governance"] as const;

  return (
    <main style={pageStyle}>
      <div style={headerRowStyle}>
        <div>
          <div style={eyebrowStyle}>QUALISPHERE PLATFORM ADMINISTRATION</div>
          <h1 style={titleStyle}>{tenant.company_name}</h1>
          <p style={subtitleStyle}>Company Account profile, Customer Contact, and QualiSphere-controlled module subscription.</p>
        </div>
        <div style={headerActionsStyle}>
          <Link href="/admin/companies" style={linkButtonStyle}>Company Registry</Link>
          <Link href="/" style={linkButtonStyle}>Home</Link>
        </div>
      </div>

      {error ? <div style={warningStyle}>{error}</div> : null}

      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>Company Account</h2>
        <div style={profileGridStyle}>
          <Info label="Tenant ID" value={tenant.id} />
          <Info label="Tenant Code" value={tenant.tenant_code} />
          <Info label="Company Name" value={tenant.company_name} />
          <Info label="Legal Name" value={tenant.legal_name || "N/A"} />
          <Info label="Slug" value={tenant.slug} />
          <Info label="Status" value={tenant.status} />
          <Info label="Account Type" value={tenant.is_internal ? "Development / Validation" : "Customer"} />
          <Info label="Customer Contact" value={tenant.primary_contact_email || "N/A"} />
          <Info label="Country" value={tenant.country_code || "N/A"} />
          <Info label="Default Time Zone" value={tenant.default_timezone || "N/A"} />
          <Info label="Created By" value={tenant.created_by || "N/A"} />
          <Info label="Created" value={formatDate(tenant.created_at)} />
        </div>
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <h2 style={sectionTitleStyle}>Company Account Members</h2>
            <p style={helperStyle}>These users belong to this Company Account. Account membership is separate from customer-defined QMS roles and separate from QualiSphere Platform Administration.</p>
          </div>
          <div style={countBadgeStyle}>{memberships.length} member{memberships.length === 1 ? "" : "s"}</div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>User Email</th>
                <th style={thStyle}>Account Authority</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Joined</th>
                <th style={thStyle}>Invited By</th>
              </tr>
            </thead>
            <tbody>
              {memberships.map((membership) => (
                <tr key={membership.id}>
                  <td style={tdStyle}>{membership.user_email}</td>
                  <td style={tdStyle}>{displayAccountAuthority(membership.membership_role)}</td>
                  <td style={tdStyle}>{humanize(membership.membership_status)}</td>
                  <td style={tdStyle}>{formatDate(membership.joined_at)}</td>
                  <td style={tdStyle}>{membership.invited_by || "N/A"}</td>
                </tr>
              ))}
              {memberships.length === 0 ? <tr><td colSpan={5} style={tdStyle}>No memberships found.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <h2 style={sectionTitleStyle}>Customer Contact Activation</h2>
            <p style={helperStyle}>Send a secure activation email to the designated Customer Contact. After activation, the customer manages its own QMS configuration inside its Company Account.</p>
          </div>
          <Link href="/admin/company-admin-activation" style={linkButtonStyle}>Activation Console</Link>
        </div>

        <div style={activationPolicyStyle}>
          <strong>Security model:</strong> QualiSphere does not email temporary passwords. Activation uses a secure invitation link followed by password creation by the recipient. Customer Contact authority is account bootstrap authority, not a customer QMS role.
        </div>

        {activationMessage ? <div style={successStyle}>{activationMessage}</div> : null}
        {activationError ? <div style={warningStyle}>{activationError}</div> : null}

        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Customer Contact Email</th>
                <th style={thStyle}>Membership Status</th>
                <th style={thStyle}>Action</th>
              </tr>
            </thead>
            <tbody>
              {customerContacts.map((membership) => (
                <tr key={membership.id}>
                  <td style={tdStyle}>{membership.user_email}</td>
                  <td style={tdStyle}>{humanize(membership.membership_status)}</td>
                  <td style={tdStyle}>
                    <button
                      type="button"
                      style={primaryButtonStyle}
                      disabled={sendingActivationFor === membership.user_email}
                      onClick={() => void sendActivation(membership)}
                    >
                      {sendingActivationFor === membership.user_email ? "Sending..." : "Send Activation Email"}
                    </button>
                  </td>
                </tr>
              ))}
              {customerContacts.length === 0 ? <tr><td colSpan={3} style={tdStyle}>No bootstrap Customer Contact membership found for this Company Account.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <h2 style={sectionTitleStyle}>Subscribed Modules</h2>
            <p style={helperStyle}>QualiSphere Platform Administration controls the modules included in this Company Account's subscription. Master Data Administration is included automatically and is not a subscription item.</p>
          </div>
          <div style={countBadgeStyle}>{enabledModuleCodes.length} enabled</div>
        </div>

        {moduleMessage ? <div style={successStyle}>{moduleMessage}</div> : null}
        {moduleError ? <div style={warningStyle}>{moduleError}</div> : null}

        <div style={subscriptionActionsStyle}>
          <button type="button" style={secondaryButtonStyle} onClick={() => setEnabledModuleCodes(PLATFORM_MODULE_CATALOG.map((module) => module.code))}>Select All</button>
          <button type="button" style={secondaryButtonStyle} onClick={() => setEnabledModuleCodes([])}>Clear</button>
        </div>

        {moduleGroups.map((group) => (
          <div key={group} style={{ marginTop: 18 }}>
            <div style={groupLabelStyle}>{group}</div>
            <div style={moduleGridStyle}>
              {PLATFORM_MODULE_CATALOG.filter((module) => module.group === group).map((module) => (
                <label key={module.code} style={moduleCardStyle}>
                  <div style={moduleOptionHeaderStyle}>
                    <input
                      type="checkbox"
                      checked={enabledModuleCodes.includes(module.code)}
                      onChange={() => toggleModule(module.code)}
                    />
                    <span style={{ fontWeight: 900 }}>{module.label}</span>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <span style={{ ...statusBadgeStyle, background: enabledModuleCodes.includes(module.code) ? "#dcfce7" : "#fee2e2", color: enabledModuleCodes.includes(module.code) ? "#166534" : "#991b1b" }}>
                      {enabledModuleCodes.includes(module.code) ? "Subscribed" : "Not Subscribed"}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        ))}

        <div style={includedCoreStyle}><strong>Always included:</strong> Master Data Administration</div>

        <div style={{ marginTop: 18 }}>
          <button type="button" style={primaryButtonStyle} disabled={savingModules} onClick={() => void saveSubscriptionModules()}>
            {savingModules ? "Saving Subscription..." : "Save Subscription"}
          </button>
        </div>
      </section>

      <section style={noteStyle}>
        <strong>Account boundary:</strong> Every Company Account is independent. A module subscription enables that module only inside this Company Account; it does not share or continue another company's records. The QualiSphere Development / Validation account follows the same Company Account model and is used to test modules and releases before customer deployment.
      </section>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div style={infoCardStyle}>
      <div style={infoLabelStyle}>{label}</div>
      <div style={infoValueStyle}>{value}</div>
    </div>
  );
}

function displayAccountAuthority(value: string) {
  if (value === "company_admin") return "Customer Contact (Bootstrap)";
  return "Company Member";
}

function humanize(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDate(value: string | null) {
  if (!value) return "N/A";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

const pageStyle: React.CSSProperties = { minHeight: "100vh", background: "#f8fafc", padding: 32, fontFamily: "Arial, sans-serif", color: "#0f172a" };
const headerRowStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 24, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 22 };
const headerActionsStyle: React.CSSProperties = { display: "flex", gap: 10, flexWrap: "wrap" };
const eyebrowStyle: React.CSSProperties = { fontSize: 12, fontWeight: 900, letterSpacing: "0.12em", color: "#2563eb" };
const titleStyle: React.CSSProperties = { margin: "6px 0 4px", fontSize: 36 };
const subtitleStyle: React.CSSProperties = { margin: 0, color: "#475569" };
const cardStyle: React.CSSProperties = { background: "white", border: "1px solid #dbe3ef", borderRadius: 16, padding: 24, marginBottom: 22, boxShadow: "0 8px 22px rgba(15,23,42,0.05)" };
const sectionHeaderStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 16 };
const sectionTitleStyle: React.CSSProperties = { margin: 0, fontSize: 24 };
const helperStyle: React.CSSProperties = { color: "#64748b", margin: "7px 0 0", lineHeight: 1.45 };
const profileGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 14, marginTop: 18 };
const infoCardStyle: React.CSSProperties = { border: "1px solid #e2e8f0", borderRadius: 11, padding: 14, background: "#f8fafc" };
const infoLabelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 900, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" };
const infoValueStyle: React.CSSProperties = { fontSize: 15, fontWeight: 800, marginTop: 6, overflowWrap: "anywhere" };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", minWidth: 760 };
const thStyle: React.CSSProperties = { textAlign: "left", borderBottom: "1px solid #cbd5e1", padding: "11px 9px", background: "#f8fafc", fontSize: 13 };
const tdStyle: React.CSSProperties = { borderBottom: "1px solid #e2e8f0", padding: "12px 9px", fontSize: 14 };
const moduleGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 13 };
const moduleCardStyle: React.CSSProperties = { border: "1px solid #e2e8f0", borderRadius: 12, padding: 15, background: "#f8fafc", cursor: "pointer" };
const moduleOptionHeaderStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 9 };
const statusBadgeStyle: React.CSSProperties = { display: "inline-block", padding: "4px 9px", borderRadius: 999, fontWeight: 800, fontSize: 12 };
const countBadgeStyle: React.CSSProperties = { background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", borderRadius: 999, padding: "6px 10px", fontWeight: 900, fontSize: 13 };
const linkButtonStyle: React.CSSProperties = { border: "1px solid #cbd5e1", borderRadius: 9, background: "white", color: "#0f172a", padding: "10px 15px", fontWeight: 800, textDecoration: "none" };
const backLinkStyle: React.CSSProperties = { color: "#1d4ed8", fontWeight: 800, textDecoration: "none" };
const primaryButtonStyle: React.CSSProperties = { border: 0, borderRadius: 9, background: "#2563eb", color: "white", padding: "9px 12px", fontWeight: 900, cursor: "pointer" };
const secondaryButtonStyle: React.CSSProperties = { border: "1px solid #cbd5e1", borderRadius: 8, background: "white", color: "#334155", padding: "8px 11px", fontWeight: 800, cursor: "pointer" };
const subscriptionActionsStyle: React.CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 };
const groupLabelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 900, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 };
const includedCoreStyle: React.CSSProperties = { marginTop: 18, borderRadius: 10, padding: "11px 13px", background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#166534" };
const activationPolicyStyle: React.CSSProperties = { background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e3a8a", borderRadius: 12, padding: 14, marginBottom: 16, lineHeight: 1.5 };
const successStyle: React.CSSProperties = { background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#166534", borderRadius: 12, padding: 14, marginBottom: 16 };
const warningStyle: React.CSSProperties = { background: "#fff7ed", border: "1px solid #fdba74", borderRadius: 12, padding: 16, color: "#9a3412" };
const noteStyle: React.CSSProperties = { background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 12, padding: 16, color: "#1e3a8a", lineHeight: 1.5 };
