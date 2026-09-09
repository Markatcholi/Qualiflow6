"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../../../../lib/supabaseClient";

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
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [modules, setModules] = useState<ModuleAccess[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    void load();
  }, [tenantId]);

  const load = async () => {
    if (!tenantId) return;
    setLoading(true);
    setError("");

    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user?.email) {
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

    setTenant((tenantResult.data || null) as Tenant | null);
    setMemberships((membershipResult.data || []) as Membership[]);
    setModules((moduleResult.data || []) as ModuleAccess[]);
    setLoading(false);
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

  return (
    <main style={pageStyle}>
      <div style={headerRowStyle}>
        <div>
          <div style={eyebrowStyle}>QUALISPHERE PLATFORM ADMINISTRATION</div>
          <h1 style={titleStyle}>{tenant.company_name}</h1>
          <p style={subtitleStyle}>Tenant profile, membership, and company-level module entitlement.</p>
        </div>
        <div style={headerActionsStyle}>
          <Link href="/admin/companies" style={linkButtonStyle}>Company Registry</Link>
          <Link href="/" style={linkButtonStyle}>Home</Link>
        </div>
      </div>

      {error ? <div style={warningStyle}>{error}</div> : null}

      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>Company Profile</h2>
        <div style={profileGridStyle}>
          <Info label="Tenant ID" value={tenant.id} />
          <Info label="Tenant Code" value={tenant.tenant_code} />
          <Info label="Company Name" value={tenant.company_name} />
          <Info label="Legal Name" value={tenant.legal_name || "N/A"} />
          <Info label="Slug" value={tenant.slug} />
          <Info label="Status" value={tenant.status} />
          <Info label="Tenant Type" value={tenant.is_internal ? "QualiSphere Internal" : "Customer"} />
          <Info label="Primary Contact" value={tenant.primary_contact_email || "N/A"} />
          <Info label="Country" value={tenant.country_code || "N/A"} />
          <Info label="Default Time Zone" value={tenant.default_timezone || "N/A"} />
          <Info label="Created By" value={tenant.created_by || "N/A"} />
          <Info label="Created" value={formatDate(tenant.created_at)} />
        </div>
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <h2 style={sectionTitleStyle}>Company Memberships</h2>
            <p style={helperStyle}>These users belong to this tenant. Company membership is separate from QualiSphere Platform Administration.</p>
          </div>
          <div style={countBadgeStyle}>{memberships.length} member{memberships.length === 1 ? "" : "s"}</div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>User Email</th>
                <th style={thStyle}>Membership Role</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Joined</th>
                <th style={thStyle}>Invited By</th>
              </tr>
            </thead>
            <tbody>
              {memberships.map((membership) => (
                <tr key={membership.id}>
                  <td style={tdStyle}>{membership.user_email}</td>
                  <td style={tdStyle}>{humanize(membership.membership_role)}</td>
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
            <h2 style={sectionTitleStyle}>Module Entitlements</h2>
            <p style={helperStyle}>Company-level module availability. Individual user authorization will be layered on top of these entitlements.</p>
          </div>
          <div style={countBadgeStyle}>{modules.filter((module) => module.is_enabled).length} enabled</div>
        </div>
        <div style={moduleGridStyle}>
          {modules.map((module) => (
            <div key={module.id} style={moduleCardStyle}>
              <div style={{ fontWeight: 900 }}>{humanize(module.module_code)}</div>
              <div style={{ marginTop: 8 }}>
                <span style={{ ...statusBadgeStyle, background: module.is_enabled ? "#dcfce7" : "#fee2e2", color: module.is_enabled ? "#166534" : "#991b1b" }}>
                  {module.is_enabled ? "Enabled" : "Disabled"}
                </span>
              </div>
              <div style={smallStyle}>Enabled by: {module.enabled_by || "N/A"}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={noteStyle}>
        <strong>Phase 2 scope:</strong> this screen is intentionally read-only. Tenant creation is controlled through the Company Registry. Membership administration, module changes, invitations, and tenant-scoped QMS role management will be added only after the tenant boundary is tested.
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
const moduleCardStyle: React.CSSProperties = { border: "1px solid #e2e8f0", borderRadius: 12, padding: 15, background: "#f8fafc" };
const statusBadgeStyle: React.CSSProperties = { display: "inline-block", padding: "4px 9px", borderRadius: 999, fontWeight: 800, fontSize: 12 };
const countBadgeStyle: React.CSSProperties = { background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", borderRadius: 999, padding: "6px 10px", fontWeight: 900, fontSize: 13 };
const smallStyle: React.CSSProperties = { color: "#64748b", fontSize: 12, marginTop: 10 };
const linkButtonStyle: React.CSSProperties = { border: "1px solid #cbd5e1", borderRadius: 9, background: "white", color: "#0f172a", padding: "10px 15px", fontWeight: 800, textDecoration: "none" };
const backLinkStyle: React.CSSProperties = { color: "#1d4ed8", fontWeight: 800, textDecoration: "none" };
const warningStyle: React.CSSProperties = { background: "#fff7ed", border: "1px solid #fdba74", borderRadius: 12, padding: 16, color: "#9a3412" };
const noteStyle: React.CSSProperties = { background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 12, padding: 16, color: "#1e3a8a", lineHeight: 1.5 };
