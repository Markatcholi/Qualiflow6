"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [userEmail, setUserEmail] = useState("");

  const fetchUnreadCount = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const email = userData?.user?.email || "";

    setUserEmail(email);

    if (!email) {
      setUnreadCount(0);
      return;
    }

    const { count, error } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_email", email)
      .eq("is_read", false);

    if (!error) {
      setUnreadCount(count || 0);
    }
  };

  useEffect(() => {
    fetchUnreadCount();

    const interval = window.setInterval(() => {
      fetchUnreadCount();
    }, 30000);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <Link
      href="/notifications"
      title={userEmail ? `Notifications for ${userEmail}` : "Notifications"}
      style={bellStyle}
    >
      <span style={{ fontSize: "18px" }}>🔔</span>
      <span>Notifications</span>

      {unreadCount > 0 ? (
        <span style={countBadgeStyle}>{unreadCount}</span>
      ) : null}
    </Link>
  );
}

const bellStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  background: "#111827",
  color: "white",
  padding: "9px 12px",
  borderRadius: "8px",
  textDecoration: "none",
  fontWeight: 700,
  position: "relative",
};

const countBadgeStyle: React.CSSProperties = {
  background: "#dc2626",
  color: "white",
  borderRadius: "999px",
  padding: "2px 7px",
  fontSize: "12px",
  fontWeight: 800,
};
