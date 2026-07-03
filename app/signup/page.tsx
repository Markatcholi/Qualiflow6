"use client";

import Link from "next/link";
import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const signup = async () => {
    if (!email || !password) {
      alert("Email and password are required.");
      return;
    }

    const { error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      alert(error.message);
      return;
    }

    alert("Account created. You can now log in.");
    window.location.href = "/login";
  };

  return (
    <main style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>Create Account</h1>

      <input type="email" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <br /><br />

      <input type="password" placeholder="Create password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <br /><br />

      <button onClick={signup}>Create Account</button>
      <br /><br />

      <Link href="/login">Back to Login</Link>
    </main>
  );
}
