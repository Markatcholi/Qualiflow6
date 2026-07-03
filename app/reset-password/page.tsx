"use client";

import Link from "next/link";
import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const updatePassword = async () => {
    if (!password || !confirmPassword) {
      alert("Password and confirm password are required.");
      return;
    }

    if (password !== confirmPassword) {
      alert("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      alert("Password must be at least 6 characters.");
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      alert(error.message);
      return;
    }

    alert("Password updated. Please sign in with your new password.");

    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <main style={pageStyle}>
      <section style={cardStyle}>
        <div style={eyebrowStyle}>QUALISPHERE ACCESS</div>
        <h1 style={{ margin: "8px 0 6px" }}>Reset Password</h1>
        <p style={subtleText}>
          Enter your new password. This page must be opened from the password recovery email.
        </p>

        <div style={{ marginBottom: "12px" }}>
          <label style={labelStyle}>New Password</label>
          <input
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label style={labelStyle}>Confirm New Password</label>
          <input
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            style={inputStyle}
          />
        </div>

        <button onClick={updatePassword} style={primaryButtonStyle}>
          Update Password
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
  maxWidth: "460px",
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
