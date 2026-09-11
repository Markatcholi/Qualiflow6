"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Membership = {
  tenant_id: string;
  membership_role: string;
  user_email: string;
  tenants: { company_name: string; slug: string; status: string } | { company_name: string; slug: string; status: string }[] | null;
};

export default function SelectCompanyPage() {
  const [loading, setLoading] = useState(true);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const load = async () => {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      const authenticatedEmail = authData?.user?.email?.trim().toLowerCase() || "";

      if (authError || !authData?.user || !authenticatedEmail) {
        window.location.href = "/login";
        return;
      }

      const { data, error } = await supabase
        .from("tenant_memberships")
        .select("tenant_id,membership_role,user_email,tenants(company_name,slug,status)")
        .eq("membership_status", "active")
        .ilike("user_email", authenticatedEmail);

      if (error) {
        setMessage(error.message);
        setLoading(false);
        return;
      }

      const active = ((data || []) as Membership[]).filter((membership) => {
        const tenant = Array.isArray(membership.tenants) ? membership.tenants[0] : membership.tenants;
        return tenant?.status === "active";
      });

      if (active.length === 1) {
        const membership = active[0];
        const tenant = Array.isArray(membership.tenants) ? membership.tenants[0] : membership.tenants;
        window.localStorage.setItem("qualisphere_active_tenant_id", membership.tenant_id);
        window.localStorage.setItem("qualisphere_active_tenant_name", tenant?.company_name || "");
        window.localStorage.setItem("qualisphere_active_tenant_slug", tenant?.slug || "");
        window.sessionStorage.removeItem("qualisphere_membership_selection_required");
        window.location.href = "/workspace";
        return;
      }

      setMemberships(active);
      setLoading(false);
    };

    void load();
  }, []);

  const choose = (membership: Membership) => {
    const tenant = Array.isArray(membership.tenants) ? membership.tenants[0] : membership.tenants;
    window.localStorage.setItem("qualisphere_active_tenant_id", membership.tenant_id);
    window.localStorage.setItem("qualisphere_active_tenant_name", tenant?.company_name || "");
    window.localStorage.setItem("qualisphere_active_tenant_slug", tenant?.slug || "");
    window.sessionStorage.removeItem("qualisphere_membership_selection_required");
    window.location.href = "/workspace";
  };

  return (
    <main style={pageStyle}>
      <section style={cardStyle}>
        <div style={eyebrowStyle}>QUALISPHERE COMPANY ACCESS</div>
        <h1 style={titleStyle}>Choose Company</h1>
        <p style={subtleStyle}>Your account belongs to more than one active QualiSphere company. Choose the workspace you want to enter.</p>

        {loading ? <div>Loading company memberships...</div> : null}
        {message ? <div style={messageStyle}>{message}</div> : null}

        {!loading && memberships.map((membership) => {
          const tenant = Array.isArray(membership.tenants) ? membership.tenants[0] : membership.tenants;
          return (
            <button key={membership.tenant_id} type="button" style={companyButtonStyle} onClick={() => choose(membership)}>
              <strong>{tenant?.company_name || "Company"}</strong>
              <span style={smallStyle}>{membership.membership_role.replaceAll("_", " ")}</span>
            </button>
          );
        })}

        {!loading && memberships.length === 0 ? (
          <div style={messageStyle}>No active company memberships are available for this account.</div>
        ) : null}

        <a href="/login" style={linkStyle}>Back to Sign In</a>
      </section>
    </main>
  );
}

const pageStyle: React.CSSProperties = { minHeight:"100vh", display:"flex", justifyContent:"center", alignItems:"center", padding:24, background:"#f8fafc", fontFamily:"Arial, sans-serif" };
const cardStyle: React.CSSProperties = { width:"100%", maxWidth:620, background:"white", border:"1px solid #dbe3ef", borderRadius:20, padding:28, boxShadow:"0 18px 48px rgba(15,23,42,0.10)" };
const eyebrowStyle: React.CSSProperties = { color:"#2563eb", fontWeight:900, fontSize:12, letterSpacing:"0.14em" };
const titleStyle: React.CSSProperties = { fontSize:34, margin:"8px 0" };
const subtleStyle: React.CSSProperties = { color:"#64748b", lineHeight:1.5, marginBottom:20 };
const companyButtonStyle: React.CSSProperties = { width:"100%", display:"flex", justifyContent:"space-between", alignItems:"center", gap:16, padding:"16px 18px", marginBottom:12, background:"#f8fafc", border:"1px solid #cbd5e1", borderRadius:12, cursor:"pointer", textAlign:"left", fontSize:16 };
const smallStyle: React.CSSProperties = { color:"#64748b", fontSize:13, textTransform:"capitalize" };
const messageStyle: React.CSSProperties = { padding:12, borderRadius:10, border:"1px solid #fdba74", background:"#fff7ed", color:"#9a3412", marginBottom:14 };
const linkStyle: React.CSSProperties = { display:"inline-block", marginTop:8, color:"#1d4ed8", fontWeight:800, textDecoration:"none" };
