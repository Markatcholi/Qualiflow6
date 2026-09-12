"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type Row = {
  tenant_id: string;
  company_name: string;
  tenant_status: string;
  user_email: string;
  membership_status: string;
};

export default function CompanyAdminActivationPage() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [busyKey, setBusyKey] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void load();
  }, []);

  const load = async () => {
    setLoading(true);
    setError("");

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user?.email) return;

      const { data: adminData, error: adminError } = await supabase.rpc("is_platform_admin");
      if (adminError || adminData !== true) return;

      setAuthorized(true);

      const { data, error: membershipError } = await supabase
        .from("tenant_memberships")
        .select("tenant_id,user_email,membership_status,membership_role,tenants(company_name,status)")
        .eq("membership_role", "company_admin")
        .order("user_email");

      if (membershipError) {
        setError(membershipError.message);
        return;
      }

      const mapped: Row[] = (data || []).map((item: any) => {
        const tenant = Array.isArray(item.tenants) ? item.tenants[0] : item.tenants;
        return {
          tenant_id: item.tenant_id,
          company_name: tenant?.company_name || "Unknown Company",
          tenant_status: tenant?.status || "unknown",
          user_email: item.user_email,
          membership_status: item.membership_status,
        };
      });

      setRows(mapped);
    } finally {
      setLoading(false);
    }
  };

  const sendActivation = async (row: Row) => {
    setMessage("");
    setError("");
    const key = `${row.tenant_id}:${row.user_email}`;
    setBusyKey(key);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        setError("Your Platform Administrator session has expired. Please sign in again.");
        return;
      }

      const response = await fetch("/api/platform/invite-company-admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ tenantId: row.tenant_id, email: row.user_email }),
      });

      const result = await response.json();
      if (!response.ok) {
        setError(result?.error || "Unable to send activation email.");
        return;
      }

      setMessage(`Activation email sent to ${row.user_email} for ${row.company_name}.`);
    } catch (requestError: any) {
      setError(requestError?.message || "Unable to send activation email.");
    } finally {
      setBusyKey("");
    }
  };

  if (loading) return <main style={pageStyle}>Loading Company Administrator activations...</main>;

  if (!authorized) {
    return (
      <main style={pageStyle}>
        <h1>Company Administrator Activation</h1>
        <div style={errorStyle}>Platform Administrator access is required.</div>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <div style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>QUALISPHERE PLATFORM ADMINISTRATION</div>
          <h1 style={titleStyle}>Company Administrator Activation</h1>
          <p style={subtitleStyle}>
            Send a secure invitation to the Initial Company Administrator designated when the Company Account is created. This person receives the account's initial Master Data Administration authority; Customer Contact remains a separate relationship designation.
          </p>
        </div>
        <Link href="/admin/companies" style={linkButtonStyle}>Company Registry</Link>
      </div>

      <div style={policyStyle}>
        <strong>Administrative handoff:</strong> Master Data Administration is included automatically with every Company Account. The Company Administrator authority is tenant-scoped and is not a customer QMS process role. After activation, the customer can manage its own administrative access model.
      </div>

      {message ? <div style={successStyle}>{message}</div> : null}
      {error ? <div style={errorStyle}>{error}</div> : null}

      <section style={cardStyle}>
        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Company</th>
                <th style={thStyle}>Initial Company Administrator</th>
                <th style={thStyle}>Tenant Status</th>
                <th style={thStyle}>Membership</th>
                <th style={thStyle}>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const key = `${row.tenant_id}:${row.user_email}`;
                return (
                  <tr key={key}>
                    <td style={tdStyle}>{row.company_name}</td>
                    <td style={tdStyle}>{row.user_email}</td>
                    <td style={tdStyle}>{row.tenant_status}</td>
                    <td style={tdStyle}>{row.membership_status}</td>
                    <td style={tdStyle}>
                      <button
                        type="button"
                        style={primaryButtonStyle}
                        disabled={busyKey === key}
                        onClick={() => sendActivation(row)}
                      >
                        {busyKey === key ? "Sending..." : "Send Activation Email"}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 ? (
                <tr><td colSpan={5} style={tdStyle}>No Company Administrator memberships found.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

const pageStyle: React.CSSProperties = { minHeight:"100vh", background:"#f8fafc", padding:32, fontFamily:"Arial, sans-serif", color:"#0f172a" };
const headerStyle: React.CSSProperties = { display:"flex", justifyContent:"space-between", gap:20, alignItems:"flex-start", flexWrap:"wrap", marginBottom:20 };
const eyebrowStyle: React.CSSProperties = { color:"#2563eb", fontSize:12, fontWeight:900, letterSpacing:"0.14em" };
const titleStyle: React.CSSProperties = { margin:"7px 0", fontSize:36 };
const subtitleStyle: React.CSSProperties = { color:"#475569", maxWidth:820, lineHeight:1.5, margin:0 };
const linkButtonStyle: React.CSSProperties = { border:"1px solid #cbd5e1", borderRadius:9, background:"white", color:"#0f172a", padding:"10px 15px", fontWeight:800, textDecoration:"none" };
const policyStyle: React.CSSProperties = { background:"#eff6ff", border:"1px solid #bfdbfe", color:"#1e3a8a", borderRadius:12, padding:16, marginBottom:18, lineHeight:1.5 };
const successStyle: React.CSSProperties = { background:"#ecfdf5", border:"1px solid #a7f3d0", color:"#166534", borderRadius:12, padding:14, marginBottom:16 };
const errorStyle: React.CSSProperties = { background:"#fff7ed", border:"1px solid #fdba74", color:"#9a3412", borderRadius:12, padding:14, marginBottom:16 };
const cardStyle: React.CSSProperties = { background:"white", border:"1px solid #dbe3ef", borderRadius:16, padding:22, boxShadow:"0 8px 22px rgba(15,23,42,0.05)" };
const tableStyle: React.CSSProperties = { width:"100%", borderCollapse:"collapse", minWidth:820 };
const thStyle: React.CSSProperties = { textAlign:"left", borderBottom:"1px solid #cbd5e1", padding:"11px 9px", background:"#f8fafc", fontSize:13 };
const tdStyle: React.CSSProperties = { borderBottom:"1px solid #e2e8f0", padding:"12px 9px", fontSize:14 };
const primaryButtonStyle: React.CSSProperties = { border:0, borderRadius:9, background:"#2563eb", color:"white", padding:"9px 12px", fontWeight:900, cursor:"pointer" };
