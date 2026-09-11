"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function ActivateAccountPage() {
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    const initialize = async () => {
      try {
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          setError(sessionError.message);
          return;
        }

        const session = data.session;
        if (!session?.user) {
          setError(
            "This activation link is invalid, expired, or has already been used. Request a new activation email from your QualiSphere administrator.",
          );
          return;
        }

        setEmail(session.user.email || "");
        setVerified(Boolean(session.user.email_confirmed_at));
      } finally {
        setChecking(false);
      }
    };

    void initialize();
  }, []);

  const savePassword = async () => {
    setError("");
    setMessage("");

    if (!password || !confirmPassword) {
      setError("Password and confirmation are required.");
      return;
    }

    if (password.length < 12) {
      setError("Password must be at least 12 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSaving(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        return;
      }

      setMessage("Your QualiSphere password has been created successfully.");
      await supabase.auth.signOut();

      window.setTimeout(() => {
        window.location.href = "/login";
      }, 1200);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main style={pageStyle}>
      <section style={cardStyle}>
        <div style={eyebrowStyle}>QUALISPHERE ACCOUNT ACTIVATION</div>
        <h1 style={titleStyle}>Activate Your Company Admin Account</h1>
        <p style={subtitleStyle}>
          Step 1 verifies your email through the secure invitation link. Step 2 creates your private QualiSphere password.
        </p>

        {checking ? <div style={noticeStyle}>Validating activation link...</div> : null}

        {!checking && !error ? (
          <>
            <div style={stepStyle}>
              <div>
                <strong>Step 1 — Email verification</strong>
                <div style={smallStyle}>{email || "Verified invitation recipient"}</div>
              </div>
              <span style={verifiedBadgeStyle}>{verified ? "Verified" : "Authenticated"}</span>
            </div>

            <div style={stepStyle}>
              <div style={{ width: "100%" }}>
                <strong>Step 2 — Create password</strong>
                <p style={smallStyle}>Use at least 12 characters. QualiSphere never sends or stores a temporary password in email.</p>

                <label style={labelStyle}>New Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  style={inputStyle}
                  autoComplete="new-password"
                />

                <label style={labelStyle}>Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  style={inputStyle}
                  autoComplete="new-password"
                />

                <button type="button" onClick={savePassword} disabled={saving} style={primaryButtonStyle}>
                  {saving ? "Creating Password..." : "Create Password & Activate Account"}
                </button>
              </div>
            </div>
          </>
        ) : null}

        {error ? <div style={errorStyle}>{error}</div> : null}
        {message ? <div style={successStyle}>{message}</div> : null}

        <div style={footerStyle}>
          <a href="/login" style={linkStyle}>Company QMS Sign In</a>
          <a href="/" style={linkStyle}>QualiSphere Home</a>
        </div>
      </section>
    </main>
  );
}

const pageStyle: React.CSSProperties = { minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:24, background:"linear-gradient(135deg,#eef2ff,#f8fafc)", fontFamily:"Arial, sans-serif", color:"#0f172a" };
const cardStyle: React.CSSProperties = { width:"100%", maxWidth:660, background:"white", border:"1px solid #dbeafe", borderRadius:24, padding:32, boxShadow:"0 20px 60px rgba(15,23,42,0.12)" };
const eyebrowStyle: React.CSSProperties = { fontSize:12, fontWeight:900, letterSpacing:"0.14em", color:"#2563eb" };
const titleStyle: React.CSSProperties = { margin:"8px 0", fontSize:34 };
const subtitleStyle: React.CSSProperties = { color:"#475569", lineHeight:1.55, marginBottom:20 };
const noticeStyle: React.CSSProperties = { padding:14, borderRadius:10, background:"#eff6ff", border:"1px solid #bfdbfe", color:"#1e3a8a" };
const stepStyle: React.CSSProperties = { display:"flex", justifyContent:"space-between", gap:16, alignItems:"flex-start", padding:18, border:"1px solid #e2e8f0", borderRadius:12, marginBottom:14, background:"#f8fafc" };
const verifiedBadgeStyle: React.CSSProperties = { background:"#dcfce7", color:"#166534", borderRadius:999, padding:"5px 9px", fontSize:12, fontWeight:900 };
const smallStyle: React.CSSProperties = { color:"#64748b", fontSize:13, lineHeight:1.45, marginTop:6 };
const labelStyle: React.CSSProperties = { display:"block", fontWeight:800, margin:"14px 0 6px" };
const inputStyle: React.CSSProperties = { width:"100%", boxSizing:"border-box", padding:"12px 13px", border:"1px solid #cbd5e1", borderRadius:10, fontSize:15 };
const primaryButtonStyle: React.CSSProperties = { width:"100%", marginTop:20, padding:"12px 16px", border:0, borderRadius:10, background:"#2563eb", color:"white", fontWeight:900, cursor:"pointer" };
const errorStyle: React.CSSProperties = { padding:14, borderRadius:10, background:"#fff7ed", border:"1px solid #fdba74", color:"#9a3412", marginTop:14 };
const successStyle: React.CSSProperties = { padding:14, borderRadius:10, background:"#ecfdf5", border:"1px solid #a7f3d0", color:"#166534", marginTop:14 };
const footerStyle: React.CSSProperties = { display:"flex", justifyContent:"space-between", gap:12, flexWrap:"wrap", marginTop:20 };
const linkStyle: React.CSSProperties = { color:"#1d4ed8", fontWeight:800, textDecoration:"none" };
