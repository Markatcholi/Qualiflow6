"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

export default function AppHeader() {
  const pathname = usePathname();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");

  const isPlatformContext =
    pathname?.startsWith("/platform-admin") ||
    pathname?.startsWith("/admin/companies");

  const fetchUser = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const userEmail = userData?.user?.email || "";
    setEmail(userEmail);

    if (!userEmail) {
      setRole("");
      return;
    }

    if (isPlatformContext) {
      const { data: isPlatformAdmin } = await supabase.rpc("is_platform_admin");
      setRole(isPlatformAdmin === true ? "Platform Administrator" : "Unauthorized");
      return;
    }

    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_email", userEmail)
      .maybeSingle();

    setRole(data?.role || "user");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.sessionStorage.removeItem("qualisphere_access_context");
    window.localStorage.removeItem("qualisphere_active_tenant_id");
    window.localStorage.removeItem("qualisphere_active_tenant_name");
    window.localStorage.removeItem("qualisphere_active_tenant_slug");
    window.location.href = isPlatformContext ? "/platform-admin/login" : "/login";
  };

  useEffect(() => {
    void fetchUser();
  }, [pathname]);

  const homeHref = isPlatformContext ? "/admin/companies" : "/workspace";
  const brandSubtext = isPlatformContext ? "Platform Administration" : "Enterprise QMS";

  return (
    <header style={headerStyle}>
      <a href={homeHref} style={brandStyle}>
        <span style={logoMarkStyle}>Q</span>

        <span>
          <span style={brandNameStyle}>QualiSphere</span>
          <span style={brandSubtextStyle}>{brandSubtext}</span>
        </span>
      </a>

      <div style={rightSideStyle}>
        <a href={homeHref} style={headerLinkStyle}>
          Home
        </a>

        <span style={userTextStyle}>
          {email ? `${email} (${role || "user"})` : "Not logged in"}
        </span>

        {email ? (
          <button type="button" onClick={handleLogout} style={logoutButtonStyle}>
            Logout
          </button>
        ) : (
          <a href={isPlatformContext ? "/platform-admin/login" : "/login"} style={primaryLinkStyle}>
            Login
          </a>
        )}
      </div>
    </header>
  );
}

const headerStyle: React.CSSProperties = {
  padding: "12px 20px",
  borderBottom: "1px solid #d1d5db",
  fontFamily: "Arial, sans-serif",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "16px",
  flexWrap: "wrap",
  background: "#ffffff",
};

const brandStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "10px",
  textDecoration: "none",
  color: "#0f172a",
};

const logoMarkStyle: React.CSSProperties = {
  width: "34px",
  height: "34px",
  borderRadius: "10px",
  background: "#2563eb",
  color: "#ffffff",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 900,
  fontSize: "18px",
};

const brandNameStyle: React.CSSProperties = {
  display: "block",
  fontWeight: 950,
  fontSize: "18px",
  lineHeight: "20px",
};

const brandSubtextStyle: React.CSSProperties = {
  display: "block",
  color: "#64748b",
  fontSize: "12px",
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const rightSideStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  flexWrap: "wrap",
};

const headerLinkStyle: React.CSSProperties = {
  color: "#1f2937",
  textDecoration: "none",
  fontWeight: 800,
};

const primaryLinkStyle: React.CSSProperties = {
  color: "#ffffff",
  background: "#2563eb",
  borderRadius: "999px",
  padding: "8px 12px",
  textDecoration: "none",
  fontWeight: 900,
};

const userTextStyle: React.CSSProperties = {
  color: "#334155",
  fontSize: "14px",
  fontWeight: 700,
};

const logoutButtonStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  background: "#ffffff",
  borderRadius: "8px",
  padding: "7px 10px",
  fontWeight: 800,
  cursor: "pointer",
};
