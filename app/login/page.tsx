"use client";

import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");

  const handleLogin = async () => {
    alert(`Login link will be sent to ${email}`);
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

      <button onClick={handleLogin}>Send Login Link</button>
    </main>
  );
}
