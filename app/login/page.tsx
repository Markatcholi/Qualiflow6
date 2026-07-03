"use client";

import Link from "next/link";
import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const login = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      alert("Email and password are required.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      alert(error.message);
      return;
    }

    window.location.href = "/dashboard";
  };

  return (
    <main style={pageStyle}>
      <section style={cardStyle}>
        <div style={eyebrowStyle}>QUALISPHERE ACCESS</div>
        <h1 style={{ margin: "8px 0 6px" }}>Sign In</h1>
        <p style={subtleText}>
          Access your quality workspace, workflow tasks, approvals, and controlled records.
        </p>

        <div style={{ marginBottom: "12px" }}>
          <label style={labelStyle}>Email</label>
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label style={labelStyle}>Password</label>
          <input
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />
        </div>

        <button onClick={login} style={primaryButtonStyle}>
          Sign In
        </button>

        <div style={linkRowStyle}>
          <Link href="/forgot-password" style={linkStyle}>
            Forgot Password?
          </Link>

          <Link href="/signup" style={linkStyle}>
            Create Account
          </Link>
        </div>

        <div style={{ marginTop: "18px" }}>
          <Link href="/" style={secondaryLinkStyle}>
            Back to Home
          </Link>
        </div>
      </section>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  padding: "24px",
  fontFamily: "Arial, sans-serif",
  background: "linear-gradient(135deg, #eef2ff, #f8fafc)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const cardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "440px",
  background: "white",
  border: "1px solid #dbeafe",
  borderRadius: "18px",
  padding: "28px",
  boxShadow: "0 12px 30px rgba(15, 23, 42, 0.12)",
};

const eyebrowStyle: React.CSSProperties = {
  color: "#2563eb",
  fontWeight: 800,
  fontSize: "12px",
  letterSpacing: "0.18em",
};

const subtleText: React.CSSProperties = {
  color: "#4b5563",
  marginTop: 0,
  marginBottom: "20px",
  lineHeight: "24px",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontWeight: 700,
  marginBottom: "6px",
};

const inputStyle: React.CSSProperties = {
  padding: "10px",
  width: "100%",
  border: "1px solid #cbd5e1",
  borderRadius: "10px",
  boxSizing: "border-box",
};

const primaryButtonStyle: React.CSSProperties = {
  background: "#2563eb",
  color: "white",
  border: "none",
  borderRadius: "10px",
  padding: "10px 18px",
  fontWeight: 800,
  cursor: "pointer",
  width: "100%",
};

const linkRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  flexWrap: "wrap",
  marginTop: "16px",
};

const linkStyle: React.CSSProperties = {
  color: "#2563eb",
  fontWeight: 700,
  textDecoration: "none",
};

const secondaryLinkStyle: React.CSSProperties = {
  color: "#475569",
  fontWeight: 700,
  textDecoration: "none",
};
