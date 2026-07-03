"use client";

import Link from "next/link";
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
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      alert(error.message);
      return;
    }

    window.location.href = "/dashboard";
  };

  return (
    <main style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>Login</h1>

      <input type="email" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <br /><br />

      <input type="password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <br /><br />

      <button onClick={login}>Login</button>
      <br /><br />

      <Link href="/signup">Create Account</Link>
    </main>
  );
}
