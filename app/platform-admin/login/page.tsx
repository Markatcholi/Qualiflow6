"use client";

import { useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

export default function PlatformAdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const login = async () => {
    if (!email || !password) {
      setMessage("Email and password are required.");
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage(error.message);
        return;
      }

      const { data: isPlatformAdmin, error: adminError } = await supabase.rpc("is_platform_admin");
      if (adminError || isPlatformAdmin !== true) {
        await supabase.auth.signOut();
        setMessage("This account is not authorized for QualiSphere Platform Administration.");
        return;
      }

      window.localStorage.removeItem("qualisphere_active_tenant_id");
      window.localStorage.removeItem("qualisphere_active_tenant_name");
      window.localStorage.removeItem("qualisphere_active_tenant_slug");
      window.sessionStorage.setItem("qualisphere_access_context", "platform_admin");
      window.location.href = "/admin/companies";
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={pageStyle}>
      <section style={cardStyle}>
        <div style={eyebrowStyle}>QUALISPHERE PLATFORM ADMINISTRATION</div>
        <h1 style={titleStyle}>Enterprise Admin Sign In</h1>
        <p style={subtleStyle}>
          Restricted to authorized QualiSphere Platform Administrators. Customer and internal QMS users should use the standard company sign-in.
        </p>

        {message ? <div style={messageStyle}>{message}</div> : null}

        <label style={labelStyle}>Email</label>
        <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Platform administrator email" style={inputStyle} />

        <label style={labelStyle}>Password</label>
        <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" style={inputStyle} />

        <button type="button" onClick={login} disabled={busy} style={buttonStyle}>
          {busy ? "Verifying Platform Access..." : "Enter Platform Administration"}
        </button>

        <div style={footerStyle}>
          <a href="/login" style={linkStyle}>Company QMS Sign In</a>
          <a href="/" style={linkStyle}>Back to Home</a>
        </div>
      </section>
    </main>
  );
}

const pageStyle: React.CSSProperties = { minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:24, fontFamily:"Arial, sans-serif", background:"linear-gradient(135deg,#0f172a,#1e3a8a 58%,#0f172a)", color:"#0f172a" };
const cardStyle: React.CSSProperties = { width:"100%", maxWidth:520, background:"white", borderRadius:24, padding:32, boxShadow:"0 28px 80px rgba(0,0,0,0.28)", border:"1px solid #334155" };
const eyebrowStyle: React.CSSProperties = { fontSize:12, fontWeight:900, letterSpacing:"0.14em", color:"#2563eb" };
const titleStyle: React.CSSProperties = { margin:"9px 0 8px", fontSize:34 };
const subtleStyle: React.CSSProperties = { color:"#475569", lineHeight:1.55, marginBottom:20 };
const messageStyle: React.CSSProperties = { background:"#fff7ed", border:"1px solid #fdba74", color:"#9a3412", padding:12, borderRadius:10, marginBottom:14 };
const labelStyle: React.CSSProperties = { display:"block", fontWeight:800, margin:"14px 0 6px" };
const inputStyle: React.CSSProperties = { width:"100%", boxSizing:"border-box", padding:"12px 13px", border:"1px solid #cbd5e1", borderRadius:10, fontSize:15 };
const buttonStyle: React.CSSProperties = { width:"100%", marginTop:20, padding:"12px 16px", border:0, borderRadius:10, background:"#1d4ed8", color:"white", fontWeight:900, cursor:"pointer" };
const footerStyle: React.CSSProperties = { marginTop:18, display:"flex", justifyContent:"space-between", gap:12, flexWrap:"wrap" };
const linkStyle: React.CSSProperties = { color:"#1d4ed8", fontWeight:800, textDecoration:"none" };
