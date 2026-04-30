"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");

  const updatePassword = async () => {
    if (!password) {
      alert("Enter a new password");
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
    window.location.href = "/login";
  };

  return (
    <main style={{ padding: "20px", fontFamily: "Arial" }}>
      <h1>Set New Password</h1>

      <input
        type="password"
        placeholder="Enter new password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ padding: "8px", width: "250px", marginBottom: "10px" }}
      />

      <br />

      <button onClick={updatePassword}>Update Password</button>
    </main>
  );
}
