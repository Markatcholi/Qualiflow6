"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const setupResetSession = async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          alert(error.message);
          return;
        }
      }

      const { data } = await supabase.auth.getSession();

      if (!data.session) {
        alert("Reset session missing. Please request a new password reset link.");
        return;
      }

      setReady(true);
    };

    setupResetSession();
  }, []);

  const updatePassword = async () => {
    if (!password) {
      alert("Enter a new password.");
      return;
    }

    if (!ready) {
      alert("Password reset session is not ready.");
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      alert(error.message);
      return;
    }

    alert("Password updated successfully. You can now log in.");
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <main style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>Set New Password</h1>

      <input
        type="password"
        placeholder="Enter new password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ padding: "8px", width: "270px", marginBottom: "10px" }}
      />

      <br />

      <button onClick={updatePassword} disabled={!ready}>
        Update Password
      </button>

      {!ready ? <p>Waiting for reset session...</p> : null}
    </main>
  );
}
