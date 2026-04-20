"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [email, setEmail] = useState("");

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getUser();

      if (data.user) {
        setAuthenticated(true);
        setEmail(data.user.email ?? "");
      } else {
        window.location.href = "/login";
      }

      setLoading(false);
    };

    checkUser();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  if (loading) {
    return <main style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>Loading...</main>;
  }

  if (!authenticated) {
    return null;
  }

  return (
    <main style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>Dashboard</h1>
      <p>Your dashboard is working.</p>
      {email ? <p>Signed in as: {email}</p> : null}

      <button
        onClick={handleLogout}
        style={{ marginTop: "20px", padding: "8px 12px" }}
      >
        Logout
      </button>
    </main>
  );
}
