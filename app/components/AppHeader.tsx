"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function AppHeader() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");

  const canAccessAdmin =
    role === "admin" ||
    role === "administrator" ||
    role === "coordinator" ||
    role === "approver" ||
    role === "vp_quality";

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
    <header style={headerStyle}>
      <nav style={navStyle}>
        <div style={moduleGroupStyle}>
          <div style={groupLabelStyle}>My Work</div>
          <a href="/my-approval-tasks" style={primaryNavLinkStyle}>
            My Tasks
          </a>
        </div>

        <div style={moduleGroupStyle}>
          <div style={groupLabelStyle}>Quality Management</div>
          <a href="/capa" style={navLinkStyle}>CAPA</a>
          <a href="/ncmrs" style={navLinkStyle}>NCMRs</a>
          <a href="/complaints" style={navLinkStyle}>Complaints</a>
          <a href="/supplier-quality/scars" style={navLinkStyle}>SCARs</a>
          <a href="/audits" style={navLinkStyle}>Audits</a>
          <a href="/oos-oot" style={navLinkStyle}>OOS/OOT</a>
        </div>

        <div style={moduleGroupStyle}>
          <div style={groupLabelStyle}>Operations</div>
          <a href="/change-control" style={navLinkStyle}>Change Control</a>
          <a href="/documents" style={navLinkStyle}>Documents</a>
          <a href="/training" style={navLinkStyle}>Training</a>
          <a href="/suppliers" style={navLinkStyle}>Suppliers</a>
        </div>

        <div style={moduleGroupStyle}>
          <div style={groupLabelStyle}>Analytics</div>
          <a href="/dashboard" style={navLinkStyle}>Dashboard</a>
          <a href="/management-review" style={navLinkStyle}>Management Review</a>
          <a href="/audit" style={navLinkStyle}>Audit Trail</a>
        </div>

        {canAccessAdmin ? (
          <div style={moduleGroupStyle}>
            <div style={groupLabelStyle}>Administration</div>
            <a href="/admin/master-data" style={navLinkStyle}>Admin Master Data</a>
          </div>
        ) : null}
      </nav>

      <div style={userBoxStyle}>
        <span style={{ marginRight: "12px" }}>
          {email ? `${email} (${role || "user"})` : "Not logged in"}
        </span>

        {email ? <button onClick={handleLogout}>Logout</button> : null}
      </div>
    </header>
  );
}

const headerStyle: React.CSSProperties = {
  padding: "14px 20px",
  borderBottom: "1px solid #d1d5db",
  fontFamily: "Arial, sans-serif",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "20px",
  flexWrap: "wrap",
  background: "#ffffff",
};

const navStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "18px",
  flexWrap: "wrap",
};

const moduleGroupStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flexWrap: "wrap",
  paddingRight: "12px",
  borderRight: "1px solid #e5e7eb",
};

const groupLabelStyle: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 900,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginRight: "2px",
};

const navLinkStyle: React.CSSProperties = {
  color: "#1f2937",
  textDecoration: "none",
  fontWeight: 700,
  fontSize: "14px",
};

const primaryNavLinkStyle: React.CSSProperties = {
  color: "#ffffff",
  background: "#2563eb",
  borderRadius: "999px",
  padding: "7px 12px",
  textDecoration: "none",
  fontWeight: 900,
  fontSize: "14px",
};

const userBoxStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flexWrap: "wrap",
  fontSize: "14px",
};
