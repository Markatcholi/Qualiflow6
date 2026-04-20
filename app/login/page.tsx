"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");

  const handleLogin = async () => {
    if (!email) {
      alert("Please enter your email");
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: "https://qualiflow6.vercel.app/dashboard",
      },
    });

    if (error) {
      alert(error.message);
    } else {
      alert("Check your email for login link");
    }
  };

  return (
    <main style={{ padding: "20px", fontFamily: "Arial" }}>
      <h1>Login</h1>

      <input
        type="email"
        placeholder="Enter your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ padding: "8px", marginRight: "10px" }}
      />

      <button onClick={handleLogin}>
        Send Login Link
      </button>
    </main>
  );
}
