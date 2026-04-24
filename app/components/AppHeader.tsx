"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function AppHeader() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");

  const fetchUser = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const userEmail = userData?.user?.email || "";
    setEmail(userEmail);

    if (!userEmail) return;

    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_email", userEmail)
      .maybeSingle();

    setRole(data?.role || "user");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  useEffect(() => {
    fetchUser();
  }, []);

  return (
    <header
      style={{
        padding: "12px 20px",
        borderBottom: "1px solid #ccc",
        fontFamily: "Arial, sans-serif",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "20px",
        flexWrap: "wrap",
      }}
    >
      <nav>
        <a href="/dashboard" style={{ marginRight: "12px" }}>Dashboard</a>
        <a href="/ncmrs" style={{ marginRight: "12px" }}>NCMRs</a>
        <a href="/capa" style={{ marginRight: "12px" }}>CAPA</a>
        <a href="/audit" style={{ marginRight: "12px" }}>Audit Trail</a>
        <a href="/admin/master-data">Admin Master Data</a>
      </nav>

      <div>
        <span style={{ marginRight: "12px" }}>
          {email ? `${email} (${role || "user"})` : "Not logged in"}
        </span>

        {email ? (
          <button onClick={handleLogout}>
            Logout
          </button>
        ) : null}
      </div>
    </header>
  );
}
