"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function SetPasswordPage() {
  const [password, setPassword] = useState("");

  const updatePassword = async () => {
    if (!password) {
      alert("Enter a password");
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      alert(error.message);
      return;
    }

    alert("Password updated successfully.");
  };

  return (
    <main style={{ padding: "20px" }}>
      <h1>Set Password</h1>

      <input
        type="password"
        placeholder="New password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ padding: "8px", width: "250px" }}
      />

      <br /><br />

      <button onClick={updatePassword}>Update Password</button>
    </main>
  );
}
