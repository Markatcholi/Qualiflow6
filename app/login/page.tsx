"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const login = async () => {
    if (!email || !password) {
      alert("Email and password are required.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert(error.message);
      return;
    }

    window.location.href = "/workspace";
  };

  return (
    <main style={pageStyle}>
      <div style={backgroundGridStyle} />

      <section style={shellStyle}>
        <div style={brandPanelStyle}>
          <div style={badgeStyle}>ENTERPRISE QUALITY MANAGEMENT SYSTEM</div>

          <div style={brandRowStyle}>
            <span style={logoMarkStyle}>Q</span>
            <div>
              <h1 style={brandTitleStyle}>QualiSphere</h1>
              <div style={brandSubTitleStyle}>Enterprise QMS</div>
            </div>
          </div>

          <p style={brandTextStyle}>
            Connected quality workflows, configurable governance, audit-ready
            records, and one work queue for assigned quality tasks.
          </p>

          <div style={featureGridStyle}>
            <FeaturePill label="CAPA" />
            <FeaturePill label="NCMR" />
            <FeaturePill label="Change Control" />
            <FeaturePill label="Documents" />
            <FeaturePill label="Training" />
            <FeaturePill label="Audit Ready" />
          </div>
        </div>

        <section style={cardStyle}>
          <div style={formHeaderStyle}>
            <div style={eyebrowStyle}>SECURE ACCESS</div>
            <h2 style={titleStyle}>Login</h2>
            <p style={subtitleStyle}>
              Sign in to access your workspace and assigned tasks.
            </p>
          </div>

          <label style={labelStyle}>Email</label>
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            style={inputStyle}
          />

          <label style={labelStyle}>Password</label>
          <input
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            style={inputStyle}
          />

          <button type="button" onClick={login} style={buttonStyle}>
            Login
          </button>

          <div style={footerRowStyle}>
            <a href="/forgot-password" style={linkStyle}>
              Forgot password?
            </a>
            <a href="/" style={linkStyle}>
              Back to home
            </a>
          </div>
        </section>
      </section>
    </main>
  );
}

function FeaturePill({ label }: { label: string }) {
  return <span style={featurePillStyle}>{label}</span>;
}

const pageStyle: React.CSSProperties = {
  position: "relative",
  minHeight: "100vh",
  overflow: "hidden",
  background:
    "linear-gradient(135deg, #f8fafc 0%, #eef2ff 45%, #f8fafc 100%)",
  fontFamily: "Arial, sans-serif",
  color: "#0f172a",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "32px",
};

const backgroundGridStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  backgroundImage: `
    radial-gradient(circle at 18% 20%, rgba(37, 99, 235, 0.20), transparent 28%),
    radial-gradient(circle at 80% 18%, rgba(14, 165, 233, 0.14), transparent 25%),
    radial-gradient(circle at 50% 88%, rgba(59, 130, 246, 0.12), transparent 30%),
    linear-gradient(90deg, rgba(37,99,235,0.05) 1px, transparent 1px),
    linear-gradient(0deg, rgba(37,99,235,0.05) 1px, transparent 1px)
  `,
  backgroundSize: "auto, auto, auto, 54px 54px, 54px 54px",
  pointerEvents: "none",
};

const shellStyle: React.CSSProperties = {
  position: "relative",
  width: "100%",
  maxWidth: "1040px",
  display: "grid",
  gridTemplateColumns: "1.1fr 440px",
  gap: "26px",
  alignItems: "stretch",
};

const brandPanelStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.72)",
  border: "1px solid rgba(191,219,254,0.9)",
  borderRadius: "30px",
  padding: "38px",
  boxShadow: "0 24px 70px rgba(15, 23, 42, 0.12)",
  backdropFilter: "blur(14px)",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
};

const badgeStyle: React.CSSProperties = {
  display: "inline-block",
  alignSelf: "flex-start",
  fontSize: "12px",
  fontWeight: 900,
  letterSpacing: "0.16em",
  color: "#2563eb",
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
  borderRadius: "999px",
  padding: "8px 13px",
  marginBottom: "24px",
};

const brandRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "16px",
};

const logoMarkStyle: React.CSSProperties = {
  width: "58px",
  height: "58px",
  borderRadius: "18px",
  background: "#2563eb",
  color: "white",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 950,
  fontSize: "30px",
  boxShadow: "0 16px 34px rgba(37,99,235,0.28)",
};

const brandTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "48px",
  lineHeight: 1,
  letterSpacing: "-0.05em",
};

const brandSubTitleStyle: React.CSSProperties = {
  marginTop: "6px",
  color: "#64748b",
  fontSize: "13px",
  fontWeight: 900,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
};

const brandTextStyle: React.CSSProperties = {
  marginTop: "24px",
  marginBottom: "24px",
  color: "#334155",
  fontSize: "20px",
  lineHeight: "32px",
  maxWidth: "560px",
};

const featureGridStyle: React.CSSProperties = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
};

const featurePillStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.9)",
  border: "1px solid #dbeafe",
  color: "#1e40af",
  borderRadius: "999px",
  padding: "8px 12px",
  fontWeight: 800,
  fontSize: "13px",
};

const cardStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.92)",
  border: "1px solid #d1d5db",
  borderRadius: "26px",
  padding: "30px",
  boxShadow: "0 24px 70px rgba(15,23,42,0.14)",
  backdropFilter: "blur(14px)",
};

const formHeaderStyle: React.CSSProperties = {
  marginBottom: "22px",
};

const eyebrowStyle: React.CSSProperties = {
  color: "#2563eb",
  fontSize: "12px",
  fontWeight: 900,
  letterSpacing: "0.14em",
};

const titleStyle: React.CSSProperties = {
  margin: "8px 0 6px 0",
  fontSize: "34px",
  letterSpacing: "-0.03em",
};

const subtitleStyle: React.CSSProperties = {
  margin: 0,
  color: "#64748b",
  lineHeight: "24px",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontWeight: 900,
  marginTop: "14px",
  marginBottom: "6px",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #cbd5e1",
  borderRadius: "12px",
  padding: "12px",
  fontSize: "15px",
  outline: "none",
};

const buttonStyle: React.CSSProperties = {
  width: "100%",
  marginTop: "20px",
  background: "#2563eb",
  color: "white",
  border: "none",
  borderRadius: "12px",
  padding: "12px 16px",
  fontWeight: 900,
  fontSize: "16px",
  cursor: "pointer",
  boxShadow: "0 14px 30px rgba(37,99,235,0.24)",
};

const footerRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  marginTop: "16px",
  flexWrap: "wrap",
};

const linkStyle: React.CSSProperties = {
  color: "#1d4ed8",
  fontWeight: 800,
  textDecoration: "none",
};
