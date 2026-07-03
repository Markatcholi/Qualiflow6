"use client";

import Link from "next/link";
import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");

  const sendResetLink = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      alert("Email is required.");
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      alert(error.message);
      return;
    }

    alert("Password reset link sent. Please check your email.");
  };

  return (
    <main style={pageStyle}>
      <section style={cardStyle}>
        <div style={eyebrowStyle}>QUALISPHERE ACCESS</div>
        <h1 style={{ margin: "8px 0 6px" }}>Forgot Password</h1>
        <p style={subtleText}>
          Enter your email and we will send a secure password reset link.
        </p>

        <div style={{ marginBottom: "16px" }}>
          <label style={labelStyle}>Email</label>
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />
        </div>

        <button onClick={sendResetLink} style={primaryButtonStyle}>
          Send Password Reset Link
        </button>

        <div style={{ marginTop: "16px" }}>
          <Link href="/login" style={linkStyle}>
            Back to Sign In
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

const linkStyle: React.CSSProperties = {
  color: "#2563eb",
  fontWeight: 700,
  textDecoration: "none",
};
