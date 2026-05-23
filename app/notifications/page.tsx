"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type PreferenceRow = {
  module: string;
  notification_type: string;
  label: string;
  description: string;
  frequency: string;
  is_enabled: boolean;
};

const DEFAULT_ROWS: PreferenceRow[] = [
  {
    module: "capa",
    notification_type: "capa_task_assigned",
    label: "CAPA task assigned",
    description: "Notify me when a CAPA task is assigned to me.",
    frequency: "immediate",
    is_enabled: true,
  },
  {
    module: "capa",
    notification_type: "capa_task_overdue",
    label: "CAPA task overdue",
    description: "Notify me when one of my CAPA tasks is overdue.",
    frequency: "daily",
    is_enabled: true,
  },
];

export default function NotificationPreferencesPage() {
  const [userEmail, setUserEmail] = useState("");
  const [rows, setRows] = useState<PreferenceRow[]>(DEFAULT_ROWS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");

  const fetchPreferences = async () => {
    setLoading(true);

    const { data: userData } = await supabase.auth.getUser();
    const email = userData?.user?.email || "";
    setUserEmail(email);

    if (!email) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_email", email);

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    const merged = DEFAULT_ROWS.map((row) => {
      const existing = (data || []).find(
        (item: any) =>
          item.module === row.module &&
          item.notification_type === row.notification_type
      );

      if (!existing) return row;

      return {
        ...row,
        frequency: existing.frequency || row.frequency,
        is_enabled:
          existing.is_enabled === null || existing.is_enabled === undefined
            ? row.is_enabled
            : existing.is_enabled,
      };
    });

    setRows(merged);
    setLoading(false);
  };

  useEffect(() => {
    fetchPreferences();
  }, []);

  const updatePreference = async (
    row: PreferenceRow,
    field: "frequency" | "is_enabled",
    value: string | boolean
  ) => {
    if (!userEmail) {
      alert("You must be logged in to update notification preferences.");
      return;
    }

    const updatedRow = {
      ...row,
      [field]: value,
      is_enabled: field === "frequency" && value === "off" ? false : field === "frequency" ? true : Boolean(value),
      frequency: field === "is_enabled" && value === false ? "off" : field === "frequency" ? String(value) : row.frequency,
    };

    setRows((prev) =>
      prev.map((item) =>
        item.module === row.module &&
        item.notification_type === row.notification_type
          ? updatedRow
          : item
      )
    );

    setSaving(row.notification_type);

    const { error } = await supabase
      .from("notification_preferences")
      .upsert(
        {
          user_email: userEmail,
          module: row.module,
          notification_type: row.notification_type,
          frequency: updatedRow.frequency,
          is_enabled: updatedRow.is_enabled,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_email,module,notification_type",
        }
      );

    setSaving("");

    if (error) {
      alert(error.message);
      fetchPreferences();
    }
  };

  if (loading) {
    return <main style={pageStyle}>Loading notification preferences...</main>;
  }

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>USER NOTIFICATION GOVERNANCE</div>
          <h1 style={{ margin: "6px 0" }}>Notification Preferences</h1>
          <p style={subtleText}>
            Keep notifications focused and actionable. V1 only supports CAPA task assignment and CAPA task overdue alerts.
          </p>
        </div>

        <div style={buttonRowStyle}>
          <Link href="/notifications" style={blueButtonStyle}>
            My Notifications
          </Link>
          <Link href="/dashboard" style={darkButtonStyle}>
            Dashboard
          </Link>
        </div>
      </header>

      <section style={summaryStyle}>
        <div><strong>User:</strong> {userEmail || "N/A"}</div>
        <div><strong>Supported frequencies:</strong> Immediate, Daily Digest, Weekly Digest, Off</div>
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>CAPA Notifications</h2>

        <div style={{ display: "grid", gap: "14px" }}>
          {rows.map((row) => (
            <div key={row.notification_type} style={preferenceRowStyle}>
              <div>
                <strong>{row.label}</strong>
                <p style={{ ...subtleText, margin: "4px 0 0 0" }}>{row.description}</p>
                {saving === row.notification_type ? <div style={savingStyle}>Saving...</div> : null}
              </div>

              <div style={controlRowStyle}>
                <label style={smallLabelStyle}>
                  <input
                    type="checkbox"
                    checked={row.is_enabled}
                    onChange={(e) => updatePreference(row, "is_enabled", e.target.checked)}
                  /> Enabled
                </label>

                <select
                  value={row.is_enabled ? row.frequency : "off"}
                  onChange={(e) => updatePreference(row, "frequency", e.target.value)}
                  style={inputStyle}
                >
                  <option value="immediate">Immediate</option>
                  <option value="daily">Daily Digest</option>
                  <option value="weekly">Weekly Digest</option>
                  <option value="off">Off</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={noteStyle}>
        <strong>Design principle:</strong> Notification volume is intentionally limited. Future email notifications will use these same preferences so customers can control alert frequency before email is enabled.
      </section>
    </main>
  );
}

const pageStyle: React.CSSProperties = { padding: "24px", background: "#f8fafc", minHeight: "100vh", fontFamily: "Arial, sans-serif" };
const headerStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap", marginBottom: "20px" };
const eyebrowStyle: React.CSSProperties = { fontSize: "12px", letterSpacing: "0.08em", color: "#6b7280", fontWeight: 800 };
const subtleText: React.CSSProperties = { color: "#6b7280" };
const summaryStyle: React.CSSProperties = { background: "white", border: "1px solid #d1d5db", borderRadius: "14px", padding: "16px", marginBottom: "20px", display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" };
const cardStyle: React.CSSProperties = { background: "white", border: "1px solid #d1d5db", borderRadius: "14px", padding: "18px", marginBottom: "20px" };
const preferenceRowStyle: React.CSSProperties = { border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap" };
const controlRowStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" };
const inputStyle: React.CSSProperties = { padding: "9px 10px", borderRadius: "8px", border: "1px solid #d1d5db" };
const smallLabelStyle: React.CSSProperties = { fontSize: "14px", fontWeight: 700 };
const savingStyle: React.CSSProperties = { marginTop: "6px", color: "#2563eb", fontSize: "12px", fontWeight: 700 };
const noteStyle: React.CSSProperties = { background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "14px", padding: "16px", color: "#1e3a8a" };
const buttonRowStyle: React.CSSProperties = { display: "flex", gap: "8px", flexWrap: "wrap" };
const darkButtonStyle: React.CSSProperties = { background: "#111827", color: "white", padding: "9px 12px", borderRadius: "8px", textDecoration: "none", border: "none", fontWeight: 700 };
const blueButtonStyle: React.CSSProperties = { background: "#2563eb", color: "white", padding: "9px 12px", borderRadius: "8px", textDecoration: "none", border: "none", fontWeight: 700 };
