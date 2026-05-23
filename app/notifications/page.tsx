"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [userEmail, setUserEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("unread");

  const fetchNotifications = async () => {
    setLoading(true);

    const { data: userData } = await supabase.auth.getUser();
    const email = userData?.user?.email || "";
    setUserEmail(email);

    if (!email) {
      setLoading(false);
      return;
    }

    let query = supabase
      .from("notifications")
      .select("*")
      .eq("user_email", email)
      .order("created_at", { ascending: false });

    if (filter === "unread") {
      query = query.eq("is_read", false);
    }

    const { data, error } = await query;

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setNotifications(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchNotifications();
  }, [filter]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications]
  );

  const markRead = async (id: string) => {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    fetchNotifications();
  };

  const markAllRead = async () => {
    if (!userEmail) return;

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_email", userEmail)
      .eq("is_read", false);

    if (error) {
      alert(error.message);
      return;
    }

    fetchNotifications();
  };

  if (loading) {
    return <main style={pageStyle}>Loading notifications...</main>;
  }

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>QUALIFLOW NOTIFICATION CENTER</div>
          <h1 style={{ margin: "6px 0" }}>My Notifications</h1>
          <p style={subtleText}>
            Owner-driven workflow alerts for CAPA actions, approvals, tasks, and escalation items.
          </p>
        </div>

        <div style={buttonRowStyle}>
          <Link href="/dashboard" style={darkButtonStyle}>
            Dashboard
          </Link>

          <Link href="/capa/intelligence" style={blueButtonStyle}>
            CAPA Intelligence
          </Link>
        </div>
      </header>

      <section style={summaryStyle}>
        <div>
          <strong>User:</strong> {userEmail || "N/A"}
        </div>
        <div>
          <strong>Unread:</strong> {unreadCount}
        </div>

        <div style={buttonRowStyle}>
          <button onClick={() => setFilter("unread")} style={filter === "unread" ? blueButtonStyle : secondaryButtonStyle}>
            Unread
          </button>
          <button onClick={() => setFilter("all")} style={filter === "all" ? blueButtonStyle : secondaryButtonStyle}>
            All
          </button>
          <button onClick={markAllRead} style={secondaryButtonStyle}>
            Mark All Read
          </button>
        </div>
      </section>

      <section style={{ display: "grid", gap: "12px" }}>
        {notifications.length === 0 ? (
          <section style={cardStyle}>
            <strong>No notifications.</strong>
            <p style={subtleText}>You are all caught up.</p>
          </section>
        ) : (
          notifications.map((item) => (
            <article
              key={item.id}
              style={{
                ...cardStyle,
                borderLeft: `8px solid ${getSeverityColor(item.severity)}`,
                opacity: item.is_read ? 0.72 : 1,
              }}
            >
              <div style={notificationHeaderStyle}>
                <div>
                  <div style={eyebrowStyle}>{item.notification_type || "notification"}</div>
                  <h3 style={{ margin: "4px 0" }}>{item.title}</h3>
                  <p style={{ margin: 0 }}>{item.message || "No details provided."}</p>
                  <div style={smallMutedStyle}>
                    {item.created_at || "N/A"} | Severity: {item.severity || "info"}
                  </div>
                </div>

                <div style={buttonRowStyle}>
                  {item.related_url ? (
                    <Link href={item.related_url} style={blueButtonStyle}>
                      Open
                    </Link>
                  ) : null}

                  {!item.is_read ? (
                    <button onClick={() => markRead(item.id)} style={secondaryButtonStyle}>
                      Mark Read
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
}

function getSeverityColor(value: string) {
  if (value === "critical") return "#991b1b";
  if (value === "high") return "#dc2626";
  if (value === "medium") return "#d97706";
  return "#2563eb";
}

const pageStyle: React.CSSProperties = {
  padding: "24px",
  background: "#f8fafc",
  minHeight: "100vh",
  fontFamily: "Arial, sans-serif",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
  flexWrap: "wrap",
  marginBottom: "20px",
};

const eyebrowStyle: React.CSSProperties = {
  fontSize: "12px",
  letterSpacing: "0.08em",
  color: "#6b7280",
  fontWeight: 800,
};

const subtleText: React.CSSProperties = {
  color: "#6b7280",
};

const summaryStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid #d1d5db",
  borderRadius: "14px",
  padding: "16px",
  marginBottom: "20px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  flexWrap: "wrap",
};

const cardStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid #d1d5db",
  borderRadius: "14px",
  padding: "16px",
};

const notificationHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "12px",
  flexWrap: "wrap",
};

const smallMutedStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#6b7280",
  marginTop: "8px",
};

const buttonRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
};

const darkButtonStyle: React.CSSProperties = {
  background: "#111827",
  color: "white",
  padding: "9px 12px",
  borderRadius: "8px",
  textDecoration: "none",
  border: "none",
  fontWeight: 700,
};

const blueButtonStyle: React.CSSProperties = {
  background: "#2563eb",
  color: "white",
  padding: "9px 12px",
  borderRadius: "8px",
  textDecoration: "none",
  border: "none",
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  background: "#15803d",
  color: "white",
  padding: "9px 12px",
  borderRadius: "8px",
  textDecoration: "none",
  border: "none",
  fontWeight: 700,
  cursor: "pointer",
};
