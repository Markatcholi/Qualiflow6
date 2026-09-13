"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type AdminArea = {
  title: string;
  eyebrow: string;
  description: string;
  href: string;
};

const ADMIN_AREAS: AdminArea[] = [
  {
    eyebrow: "MASTER DATA & USERS",
    title: "Admin Master Data",
    description:
      "Manage company-owned master data and tenant user administration, including roles and role assignments.",
    href: "/company-administration/master-data",
  },
  {
    eyebrow: "WORKFLOW GOVERNANCE",
    title: "Approval Matrix",
    description:
      "Create and maintain company-specific approval matrix templates and reviewers for supported workflows.",
    href: "/company-administration/approval-matrix",
  },
  {
    eyebrow: "COMPANY GOVERNANCE",
    title: "Company Settings",
    description:
      "Configure notification governance, overdue governance, dashboards, KPI configuration, and task SLA aging.",
    href: "/company-administration/settings",
  },
  {
    eyebrow: "RISK & CAPA GOVERNANCE",
    title: "NCMR Risk & CAPA Governance",
    description:
      "Manage the company-controlled NCMR risk matrix and CAPA governance configuration through version-controlled revisions.",
    href: "/company-administration/ncmr-risk-governance",
  },
];

export default function CompanyAdministrationPage() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    void loadAccess();
  }, []);

  const loadAccess = async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const { data: userData } = await supabase.auth.getUser();
      const userEmail = String(userData?.user?.email || "").trim().toLowerCase();
      setEmail(userEmail);

      if (!userEmail) {
        window.location.href = "/login";
        return;
      }

      const storedTenantId = window.localStorage.getItem("qualisphere_active_tenant_id") || "";

      let membershipQuery = supabase
        .from("tenant_memberships")
        .select("tenant_id,membership_status,tenants(company_name,status)")
        .ilike("user_email", userEmail)
        .eq("membership_status", "active");

      if (storedTenantId) {
        membershipQuery = membershipQuery.eq("tenant_id", storedTenantId);
      }

      const { data: memberships, error: membershipError } = await membershipQuery;
      if (membershipError) throw new Error(membershipError.message);

      const activeMemberships = (memberships || []).filter((membership: any) => {
        const tenant = Array.isArray(membership.tenants)
          ? membership.tenants[0]
          : membership.tenants;
        return tenant?.status === "active";
      });

      const membership = storedTenantId
        ? activeMemberships[0]
        : activeMemberships.length === 1
          ? activeMemberships[0]
          : null;

      if (!membership) {
        throw new Error("Unable to resolve the active Company Account.");
      }

      const tenant = Array.isArray(membership.tenants)
        ? membership.tenants[0]
        : membership.tenants;
      const tenantId = String(membership.tenant_id || "");
      const tenantName = String(tenant?.company_name || "");

      window.localStorage.setItem("qualisphere_active_tenant_id", tenantId);
      window.localStorage.setItem("qualisphere_active_tenant_name", tenantName);
      setCompanyName(tenantName);

      const { data: isCompanyAdmin, error: adminError } = await supabase.rpc(
        "qualisphere_is_company_admin",
        { p_tenant_id: tenantId }
      );

      if (adminError) throw new Error(adminError.message);

      if (isCompanyAdmin !== true) {
        setAuthorized(false);
        setErrorMessage(
          "Company Administrator authority is required to access Company Administration."
        );
        return;
      }

      setAuthorized(true);
    } catch (error: any) {
      setAuthorized(false);
      setErrorMessage(error?.message || "Unable to load Company Administration.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <main style={pageStyle}>
        <section style={panelStyle}>Loading Company Administration…</section>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main style={pageStyle}>
        <section style={panelStyle}>
          <div style={eyebrowStyle}>COMPANY ADMINISTRATION</div>
          <h1 style={titleStyle}>Access Restricted</h1>
          <p style={descriptionStyle}>{errorMessage}</p>
          <a href="/workspace" style={secondaryButtonStyle}>
            Return to My Workspace
          </a>
        </section>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <section style={heroStyle}>
        <div>
          <div style={eyebrowStyle}>COMPANY ADMINISTRATION</div>
          <h1 style={titleStyle}>Company Administration</h1>
          <p style={descriptionStyle}>
            Manage the tenant-owned configuration and administration for {companyName || "this Company Account"}.
          </p>
          <div style={identityRowStyle}>
            <span style={badgeStyle}>Company Account: {companyName || "—"}</span>
            <span style={badgeStyle}>Company Administrator: {email || "—"}</span>
          </div>
        </div>

        <a href="/workspace" style={secondaryButtonStyle}>
          My Workspace
        </a>
      </section>

      <section style={gridStyle}>
        {ADMIN_AREAS.map((area) => (
          <article key={area.href} style={cardStyle}>
            <div style={eyebrowStyle}>{area.eyebrow}</div>
            <h2 style={cardTitleStyle}>{area.title}</h2>
            <p style={cardDescriptionStyle}>{area.description}</p>
            <a href={area.href} style={primaryButtonStyle}>
              Open {area.title}
            </a>
          </article>
        ))}
      </section>

      <section style={noteStyle}>
        <strong>Access model:</strong> Company Administration is controlled by tenant-scoped Company Administrator authority. Customer Contact status does not grant administrative access.
      </section>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  maxWidth: "1180px",
  margin: "0 auto",
  padding: "28px 20px 48px",
  fontFamily: "Arial, sans-serif",
  color: "#0f172a",
};

const heroStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "20px",
  flexWrap: "wrap",
  padding: "24px",
  border: "1px solid #dbe3ee",
  borderRadius: "16px",
  background: "#ffffff",
  marginBottom: "22px",
};

const panelStyle: React.CSSProperties = {
  padding: "24px",
  border: "1px solid #dbe3ee",
  borderRadius: "16px",
  background: "#ffffff",
};

const eyebrowStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: "11px",
  fontWeight: 900,
  letterSpacing: "0.09em",
};

const titleStyle: React.CSSProperties = {
  margin: "6px 0 8px",
  fontSize: "30px",
  lineHeight: 1.15,
};

const descriptionStyle: React.CSSProperties = {
  margin: 0,
  color: "#475569",
  lineHeight: 1.6,
  maxWidth: "760px",
};

const identityRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
  marginTop: "16px",
};

const badgeStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "7px 10px",
  borderRadius: "999px",
  background: "#f1f5f9",
  color: "#334155",
  fontSize: "12px",
  fontWeight: 800,
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
  gap: "16px",
};

const cardStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  minHeight: "235px",
  padding: "20px",
  border: "1px solid #dbe3ee",
  borderRadius: "14px",
  background: "#ffffff",
};

const cardTitleStyle: React.CSSProperties = {
  margin: "7px 0 8px",
  fontSize: "20px",
};

const cardDescriptionStyle: React.CSSProperties = {
  flex: 1,
  margin: "0 0 18px",
  color: "#475569",
  lineHeight: 1.55,
};

const primaryButtonStyle: React.CSSProperties = {
  display: "inline-block",
  alignSelf: "flex-start",
  padding: "9px 12px",
  borderRadius: "9px",
  background: "#2563eb",
  color: "#ffffff",
  textDecoration: "none",
  fontWeight: 900,
};

const secondaryButtonStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "9px 12px",
  borderRadius: "9px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#1e293b",
  textDecoration: "none",
  fontWeight: 900,
};

const noteStyle: React.CSSProperties = {
  marginTop: "20px",
  padding: "14px 16px",
  borderRadius: "12px",
  background: "#f8fafc",
  color: "#475569",
  lineHeight: 1.5,
  fontSize: "13px",
};