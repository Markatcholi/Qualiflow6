"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type NotificationRecord = {
  id: string;
  user_email: string;
  assigned_role?: string | null;
  notification_type: string | null;
  title: string | null;
  message: string | null;
  related_module: string | null;
  related_record_id: string | null;
  related_url?: string | null;
  severity: string | null;
  read_status: boolean | null;
  created_at: string | null;
  read_at: string | null;
};

type NotificationFilter = "unread" | "all" | "critical" | "workflow" | "training";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [userEmail, setUserEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<NotificationFilter>("unread");

  const fetchNotifications = async () => {
    setLoading(true);

    const { data: userData } = await supabase.auth.getUser();
    const email = userData?.user?.email || "";
    setUserEmail(email);

    if (!email) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    let query = supabase
      .from("notifications")
      .select("*")
      .eq("user_email", email)
      .order("created_at", { ascending: false });

    if (filter === "unread") {
      query = query.eq("read_status", false);
    }

    if (filter === "critical") {
      query = query.eq("severity", "critical");
    }

    if (filter === "workflow") {
      query = query.not(
        "related_module",
        "in",
        '("training","system","general")'
      );
    }

    if (filter === "training") {
      query = query.eq("related_module", "training");
    }

    const { data, error } = await query;

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setNotifications((data as NotificationRecord[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchNotifications();
  }, [filter]);

  const markRead = async (id: string) => {
    const { error } = await supabase
      .from("notifications")
      .update({
        read_status: true,
        read_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_email", userEmail);

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
      .update({
        read_status: true,
        read_at: new Date().toISOString(),
      })
      .eq("user_email", userEmail)
      .eq("read_status", false);

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
          <div style={eyebrowStyle}>QUALISPHERE NOTIFICATION CENTER</div>
          <h1 style={{ margin: "6px 0" }}>My Notifications</h1>
          <p style={subtleText}>
            Workflow, training, review, escalation, and document release alerts.
          </p>
        </div>

        <div style={buttonRowStyle}>
          <Link href="/settings/notifications" style={blueButtonStyle}>
            Preferences
          </Link>
          <Link href="/dashboard/workflow" style={blueButtonStyle}>
            Workflow Dashboard
          </Link>
          <Link href="/dashboard" style={darkButtonStyle}>
            Dashboard
          </Link>
        </div>
      </header>

      <section style={filterBarStyle}>
        <div style={buttonRowStyle}>
          <button
            onClick={() => setFilter("unread")}
            style={filter === "unread" ? blueButtonStyle : secondaryButtonStyle}
          >
            Unread
          </button>
          <button
            onClick={() => setFilter("critical")}
            style={filter === "critical" ? blueButtonStyle : secondaryButtonStyle}
          >
            Critical
          </button>
          <button
            onClick={() => setFilter("workflow")}
            style={filter === "workflow" ? blueButtonStyle : secondaryButtonStyle}
          >
            Workflow
          </button>
          <button
            onClick={() => setFilter("training")}
            style={filter === "training" ? blueButtonStyle : secondaryButtonStyle}
          >
            Training
          </button>
          <button
            onClick={() => setFilter("all")}
            style={filter === "all" ? blueButtonStyle : secondaryButtonStyle}
          >
            All
          </button>
        </div>

        <button onClick={markAllRead} style={secondaryButtonStyle}>
          Mark All Read
        </button>
      </section>

      <section style={{ display: "grid", gap: "12px" }}>
        {notifications.length === 0 ? (
          <section style={cardStyle}>
            <strong>No notifications.</strong>
            <p style={subtleText}>You are all caught up.</p>
          </section>
        ) : (
          notifications.map((item) => {
            const relatedUrl = getRelatedUrl(item);

            return (
              <article
                key={item.id}
                style={{
                  ...cardStyle,
                  borderLeft: `8px solid ${getSeverityColor(item.severity || "info")}`,
                  opacity: item.read_status ? 0.72 : 1,
                }}
              >
                <div style={notificationHeaderStyle}>
                  <div>
                    <div style={eyebrowStyle}>
                      {item.notification_type || "notification"}
                    </div>
                    <h3 style={{ margin: "4px 0" }}>{item.title || "Notification"}</h3>
                    <p style={{ margin: 0 }}>{item.message || "No details provided."}</p>
                    <div style={smallMutedStyle}>
                      {formatDateTime(item.created_at)} | Severity: {item.severity || "info"}
                      {item.related_module ? ` | Module: ${item.related_module}` : ""}
                      {item.assigned_role ? ` | Role: ${item.assigned_role}` : ""}
                    </div>
                  </div>

                  <div style={buttonRowStyle}>
                    {relatedUrl ? (
                      <Link href={relatedUrl} style={blueButtonStyle}>
                        Open Related Record
                      </Link>
                    ) : null}

                    {!item.read_status ? (
                      <button onClick={() => markRead(item.id)} style={secondaryButtonStyle}>
                        Mark Read
                      </button>
                    ) : (
                      <span style={readBadgeStyle}>Read</span>
                    )}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </section>
    </main>
  );
}

function getRelatedUrl(item: NotificationRecord) {
  const storedUrl = String(item.related_url || "").trim();

  if (storedUrl) {
    return storedUrl;
  }

  const recordId = String(item.related_record_id || "").trim();
  const module = String(item.related_module || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  const notificationType = String(item.notification_type || "")
    .trim()
    .toLowerCase();

  if (!recordId) return null;

  const collaborationTypes = new Set([
    "collaboration_assignment",
    "collaboration_update",
    "collaboration_resolved",
  ]);

  if (collaborationTypes.has(notificationType)) {
    if (module === "ncmr" || module === "ncmrs") {
      return `/ncmrs/${recordId}/collaboration`;
    }

    if (module === "capa" || module === "capas") {
      return `/capa/${recordId}/collaboration`;
    }

    if (module === "change_control") {
      return `/change-control/${recordId}/collaboration`;
    }

    if (
      module === "document" ||
      module === "documents" ||
      module === "controlled_documents"
    ) {
      return `/documents/${recordId}/collaboration`;
    }

    if (module === "scar" || module === "scars") {
      return `/supplier-quality/scars/${recordId}/collaboration`;
    }

    if (module === "complaint" || module === "complaints") {
      return `/complaints/${recordId}/collaboration`;
    }

    if (module === "audit" || module === "audits") {
      return `/audits/${recordId}/collaboration`;
    }

    if (module === "oos_oot" || module === "oos" || module === "oot") {
      return `/oos-oot/${recordId}/collaboration`;
    }
  }

  if (
    module === "document" ||
    module === "documents" ||
    module === "controlled_documents"
  ) {
    return `/documents/${recordId}`;
  }

  if (module === "training") {
    return `/training`;
  }

  if (module === "capa" || module === "capas") {
    return `/capa/${recordId}`;
  }

  if (module === "ncmr" || module === "ncmrs") {
    return `/ncmrs/${recordId}`;
  }

  if (module === "audit" || module === "audits") {
    return `/audits/${recordId}`;
  }

  if (module === "change_control") {
    return `/change-control/${recordId}`;
  }

  if (module === "scar" || module === "scars") {
    return `/supplier-quality/scars/${recordId}`;
  }

  if (module === "complaint" || module === "complaints") {
    return `/complaints/${recordId}`;
  }

  if (module === "oos_oot" || module === "oos" || module === "oot") {
    return `/oos-oot/${recordId}`;
  }

  if (module === "supplier" || module === "suppliers") {
    return `/suppliers/${recordId}`;
  }

  if (module === "equipment") {
    return `/equipment/${recordId}`;
  }

  return null;
}

function getSeverityColor(value: string) {
  if (value === "critical") return "#991b1b";
  if (value === "high") return "#dc2626";
  if (value === "warning" || value === "medium") return "#d97706";
  if (value === "success") return "#15803d";
  return "#2563eb";
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "N/A";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
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

const filterBarStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  flexWrap: "wrap",
  marginBottom: "20px",
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

const readBadgeStyle: React.CSSProperties = {
  background: "#e5e7eb",
  color: "#374151",
  padding: "9px 12px",
  borderRadius: "8px",
  fontWeight: 700,
};
