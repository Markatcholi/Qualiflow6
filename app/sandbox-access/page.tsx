"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import SandboxCompanyConfiguration from "../../components/SandboxCompanyConfiguration";

export default function SandboxAccessPage() {
  const sandbox = process.env.NEXT_PUBLIC_QUALISPHERE_ENVIRONMENT === "sandbox";
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [message, setMessage] = useState("Verifying your sandbox access…");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!sandbox) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!data.user || error) { window.location.replace("/login"); return; }
      const { data: rows, error: accessError } = await supabase.from("tenant_memberships")
        .select("tenant_id,user_email,membership_role,membership_status,tenants(company_name,tenant_code,status)")
        .eq("membership_status", "active");
      if (cancelled) return;
      if (accessError) { setMessage("Sandbox access could not be verified. Please sign out and try again."); return; }
      const matches = (rows || []).filter((row: any) => {
        const tenant = Array.isArray(row.tenants) ? row.tenants[0] : row.tenants;
        return row.user_email?.toLowerCase() === data.user!.email?.toLowerCase()
          && row.membership_role === "company_admin"
          && tenant?.tenant_code === "QUALISPHERE-SANDBOX"
          && ["provisioning", "active"].includes(tenant?.status);
      });
      if (matches.length !== 1) { setMessage("This login has no unique sandbox administrator membership. Contact your QualiSphere administrator."); return; }
      const row: any = matches[0];
      const tenant = Array.isArray(row.tenants) ? row.tenants[0] : row.tenants;
      setCompany(tenant.company_name);
      setTenantId(row.tenant_id);
      setEmail(data.user.email || "");
      setMessage("Your sandbox sign-in and company membership are verified.");
    })().catch(() => { if (!cancelled) setMessage("Sandbox access could not be verified. Please sign out and try again."); });
    return () => { cancelled = true; };
  }, [sandbox]);
  const signOut = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signOut();
    if (error) { setMessage("Sign-out was unsuccessful. Please try again."); setBusy(false); return; }
    window.sessionStorage.removeItem("qualisphere_access_context");
    window.sessionStorage.removeItem("qualisphere_membership_selection_required");
    for (const key of ["id", "name", "slug", "role"]) window.localStorage.removeItem(`qualisphere_active_tenant_${key}`);
    window.location.replace("/login");
  };
  if (!sandbox) return <main style={{ padding: 32 }}><p>This page is available in the sandbox environment.</p><a href="/login">Sign in</a></main>;
  return <main style={{ minHeight: "75vh", padding: "56px 24px", background: "#f1f5f9", color: "#0f172a" }}>
    <section style={{ maxWidth: 680, margin: "0 auto", padding: 32, borderRadius: 16, background: "white", border: "1px solid #cbd5e1" }}>
      <p style={{ color: "#0f766e", fontWeight: 700 }}>QUALISPHERE SANDBOX</p>
      <h1 style={{ fontSize: 32 }}>Sandbox access</h1>
      <p role="status" style={{ marginTop: 20 }}>{message}</p>
      {company && <dl style={{ lineHeight: 1.8, marginTop: 20 }}><dt>Company</dt><dd style={{ fontWeight: 700 }}>{company}</dd><dt>Signed in as</dt><dd>{email}</dd><dt>Access</dt><dd>Company administrator</dd></dl>}
      <div style={{ padding: 20, marginTop: 24, borderRadius: 8, background: "#fef3c7" }}>
        <strong>Setup in progress</strong>
        <p>Company profile and department setup are available below. Quality modules and file uploads remain disabled. Your working QualiSphere account is separate.</p>
      </div>
      {tenantId && <SandboxCompanyConfiguration tenantId={tenantId} initialName={company} onSaved={setCompany} />}
      <button type="button" disabled={busy} onClick={signOut} style={{ marginTop: 24, padding: "12px 24px", background: "#0f172a", color: "white", border: 0, borderRadius: 8, cursor: "pointer" }}>{busy ? "Signing out…" : "Sign out"}</button>
    </section>
  </main>;
}
