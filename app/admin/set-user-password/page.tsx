"use client";

import { useState } from "react";

export default function AdminSetUserPasswordPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const setUserPassword = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password || !confirmPassword) {
      alert("Email, new password, and confirm password are required.");
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

    const response = await fetch("/api/admin/set-user-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: normalizedEmail,
        password,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      alert(result.error || "Unable to update password.");
      return;
    }

    alert(`Password updated successfully for ${normalizedEmail}.`);

    setEmail("");
    setPassword("");
    setConfirmPassword("");
  };

  return (
    <main style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>Admin Set User Password</h1>

      <p style={{ color: "#4b5563", maxWidth: "650px" }}>
        Development tool for setting a user password without sending a Supabase recovery email.
        Use only for test/admin troubleshooting.
      </p>

      <div style={{ marginBottom: "10px" }}>
        <label style={labelStyle}>User Email</label>
        <input
          type="email"
          placeholder="user@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: "10px" }}>
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
        <label style={labelStyle}>Confirm Password</label>
        <input
          type="password"
          placeholder="Confirm password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          style={inputStyle}
        />
      </div>

      <button onClick={setUserPassword} style={buttonStyle}>
        Set Password
      </button>
    </main>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontWeight: 700,
  marginBottom: "6px",
};

const inputStyle: React.CSSProperties = {
  padding: "8px",
  width: "320px",
  maxWidth: "100%",
};

const buttonStyle: React.CSSProperties = {
  background: "#2563eb",
  color: "white",
  border: "none",
  borderRadius: "8px",
  padding: "10px 16px",
  fontWeight: 800,
  cursor: "pointer",
};
