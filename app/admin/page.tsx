"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [platformAdmin, setPlatformAdmin] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.rpc("is_platform_admin");
      setPlatformAdmin(data === true);
      setLoading(false);
    };
    void load();
  }, []);

  return (
    <main style={pageStyle}>
      <div style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>QUALISPHERE ADMINISTRATION</div>
          <h1 style={titleStyle}>Administration</h1>
          <p style={subtitleStyle}>Platform provisioning, company configuration, governance, and controlled master data.</p>
        </div>
        <Link href="/" style={linkButtonStyle}>Home</Link>
      </div>

      {loading ? <div style={noticeStyle}>Loading administration access...</div> : null}

      <div style={gridStyle}>
        {platformAdmin ? (
          <AdminCard
            title="Company Registry"
            description="Provision customer tenants and review company membership and module entitlements. Platform Administrator only."
            href="/admin/companies"
            badge="PLATFORM"
          />
        ) : null}

        <AdminCard title="Company Settings" description="Configure company notifications, quality dashboards, KPI behavior, and other company preferences." href="/admin/company-settings" />
        <AdminCard title="Master Data" description="Maintain controlled QMS master-data values used by workflows." href="/admin/master-data" />
        <AdminCard title="Approval Matrix" description="Configure reusable workflow approval matrices." href="/admin/approval-matrix" />
        <AdminCard title="Governance Rules" description="Manage configurable governance behavior and escalation rules." href="/admin/governance-rules" />
        <AdminCard title="NCMR Risk Governance" description="Configure NCMR risk-governance behavior." href="/admin/ncmr-risk-governance" />
        <AdminCard title="Module Releases" description="Review and manage controlled module release information." href="/admin/module-releases" />
      </div>

      {!loading && !platformAdmin ? (
        <div style={noticeStyle}>Company Registry is hidden because this account is not registered as a QualiSphere Platform Administrator.</div>
      ) : null}
    </main>
  );
}

function AdminCard({ title, description, href, badge }: { title: string; description: string; href: string; badge?: string }) {
  return (
    <Link href={href} style={cardStyle}>
      <div style={cardTopStyle}>
        <h2 style={cardTitleStyle}>{title}</h2>
        {badge ? <span style={badgeStyle}>{badge}</span> : null}
      </div>
      <p style={cardTextStyle}>{description}</p>
      <div style={openStyle}>Open →</div>
    </Link>
  );
}

const pageStyle: React.CSSProperties = { minHeight: "100vh", background: "#f8fafc", padding: 32, fontFamily: "Arial, sans-serif", color: "#0f172a" };
const headerStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap", alignItems: "flex-start", marginBottom: 26 };
const eyebrowStyle: React.CSSProperties = { color: "#2563eb", fontSize: 12, fontWeight: 900, letterSpacing: "0.12em" };
const titleStyle: React.CSSProperties = { margin: "6px 0", fontSize: 38 };
const subtitleStyle: React.CSSProperties = { margin: 0, color: "#475569", lineHeight: 1.5, maxWidth: 780 };
const gridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18 };
const cardStyle: React.CSSProperties = { display: "block", color: "inherit", textDecoration: "none", background: "white", border: "1px solid #dbe3ef", borderRadius: 16, padding: 22, boxShadow: "0 8px 22px rgba(15,23,42,0.05)" };
const cardTopStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" };
const cardTitleStyle: React.CSSProperties = { margin: 0, fontSize: 21 };
const cardTextStyle: React.CSSProperties = { color: "#64748b", lineHeight: 1.5, minHeight: 66 };
const openStyle: React.CSSProperties = { color: "#1d4ed8", fontWeight: 900 };
const badgeStyle: React.CSSProperties = { background: "#dbeafe", color: "#1d4ed8", borderRadius: 999, padding: "4px 8px", fontSize: 11, fontWeight: 900 };
const noticeStyle: React.CSSProperties = { background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 12, padding: 14, color: "#1e3a8a", marginBottom: 20 };
const linkButtonStyle: React.CSSProperties = { border: "1px solid #cbd5e1", borderRadius: 9, background: "white", color: "#0f172a", padding: "10px 15px", fontWeight: 800, textDecoration: "none" };
