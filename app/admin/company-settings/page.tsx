"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CompanySettings,
  DEFAULT_COMPANY_SETTINGS,
  getCompanySettings,
  saveCompanySettings,
} from "../../../lib/companySettings";
import { supabase } from "../../../lib/supabaseClient";

export default function CompanySettingsPage() {
  const [settings, setSettings] = useState<CompanySettings>(
    DEFAULT_COMPANY_SETTINGS
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [userRole, setUserRole] = useState("");
  const [userEmail, setUserEmail] = useState("");

  const canEdit = userRole === "approver" || userRole === "vp_quality";

  const fetchUser = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const email = userData?.user?.email || "";

    setUserEmail(email);

    if (!email) return;

    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_email", email)
      .maybeSingle();

    setUserRole(data?.role || "user");
  };

  const fetchSettings = async () => {
    setLoading(true);
    await fetchUser();

    const data = await getCompanySettings();
    setSettings(data);

    setLoading(false);
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const updateField = (field: keyof CompanySettings, value: any) => {
    setSettings((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const save = async () => {
    if (!canEdit) {
      alert("Only an approver or VP Quality can update company settings.");
      return;
    }

    if (
      Number(settings.overdue_bucket_1) >= Number(settings.overdue_bucket_2) ||
      Number(settings.overdue_bucket_2) >= Number(settings.overdue_bucket_3)
    ) {
      alert("Aging bucket values must increase in order. Example: 7, 14, 30.");
      return;
    }

    setSaving(true);

    const { error } = await saveCompanySettings(settings);

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Company settings saved.");
    fetchSettings();
  };

  if (loading) {
    return <main style={pageStyle}>Loading company settings...</main>;
  }

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>ENTERPRISE CONFIGURATION</div>
          <h1 style={{ margin: "6px 0" }}>Company Admin Settings</h1>
          <p style={subtleText}>
            Configure governance defaults so each company can use QualiFlow as-is,
            customize behavior, or disable features entirely.
          </p>
        </div>

        <div style={buttonRowStyle}>
          <Link href="/admin/master-data" style={secondaryLinkStyle}>
            Admin Master Data
          </Link>

          <Link href="/dashboard" style={darkLinkStyle}>
            Dashboard
          </Link>
        </div>
      </header>

      {!canEdit ? (
        <section style={warningStyle}>
          You are signed in as {userEmail || "unknown"} ({userRole || "user"}).
          You can view settings, but only approvers or VP Quality can edit them.
        </section>
      ) : null}

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Company Profile</h2>

        <Field label="Company Name">
          <input
            value={settings.company_name || ""}
            onChange={(e) => updateField("company_name", e.target.value)}
            disabled={!canEdit}
            style={inputStyle(!canEdit)}
          />
        </Field>
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Notification Governance</h2>

        <div style={gridStyle}>
          <ToggleField
            label="Enable Notifications"
            description="Master switch for in-app workflow notifications."
            checked={settings.enable_notifications}
            disabled={!canEdit}
            onChange={(value) => updateField("enable_notifications", value)}
          />

          <ToggleField
            label="Enable Email Notifications"
            description="Future email notification switch. Default is off."
            checked={settings.enable_email_notifications}
            disabled={!canEdit}
            onChange={(value) => updateField("enable_email_notifications", value)}
          />

          <ToggleField
            label="Allow User Preference Overrides"
            description="Allows individual users to choose immediate/daily/weekly/off."
            checked={settings.allow_users_to_override_preferences}
            disabled={!canEdit}
            onChange={(value) =>
              updateField("allow_users_to_override_preferences", value)
            }
          />

          <Field label="Default Notification Frequency">
            <select
              value={settings.notification_default_frequency}
              onChange={(e) =>
                updateField(
                  "notification_default_frequency",
                  e.target.value as CompanySettings["notification_default_frequency"]
                )
              }
              disabled={!canEdit}
              style={inputStyle(!canEdit)}
            >
              <option value="immediate">Immediate</option>
              <option value="daily">Daily Digest</option>
              <option value="weekly">Weekly Digest</option>
              <option value="off">Off</option>
            </select>
          </Field>
        </div>
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Overdue Governance</h2>

        <div style={gridStyle}>
          <ToggleField
            label="Enable Overdue Task Scan"
            description="Allows the CAPA Intelligence page to run overdue task scanning."
            checked={settings.enable_overdue_scan}
            disabled={!canEdit}
            onChange={(value) => updateField("enable_overdue_scan", value)}
          />

          <Field label="Overdue Scan Mode">
            <select
              value={settings.overdue_scan_mode}
              onChange={(e) =>
                updateField(
                  "overdue_scan_mode",
                  e.target.value as CompanySettings["overdue_scan_mode"]
                )
              }
              disabled={!canEdit}
              style={inputStyle(!canEdit)}
            >
              <option value="manual">Manual</option>
              <option value="scheduled">Scheduled</option>
              <option value="disabled">Disabled</option>
            </select>
          </Field>
        </div>
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Dashboard Governance</h2>

        <div style={gridStyle}>
          <ToggleField
            label="Enable Task SLA Dashboard"
            description="Show or hide task aging, owner workload, and overdue owner exposure."
            checked={settings.enable_task_sla_dashboard}
            disabled={!canEdit}
            onChange={(value) => updateField("enable_task_sla_dashboard", value)}
          />

          <ToggleField
            label="Enable Escalation Dashboard"
            description="Show or hide executive escalation cards."
            checked={settings.enable_escalation_dashboard}
            disabled={!canEdit}
            onChange={(value) => updateField("enable_escalation_dashboard", value)}
          />
        </div>
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Task SLA Aging Buckets</h2>
        <p style={subtleText}>
          These values define aging buckets used by the CAPA Intelligence SLA
          dashboard. Defaults are 7 / 14 / 30 days.
        </p>

        <div style={gridStyle}>
          <Field label="Bucket 1 Threshold">
            <input
              type="number"
              value={settings.overdue_bucket_1}
              onChange={(e) =>
                updateField("overdue_bucket_1", Number(e.target.value))
              }
              disabled={!canEdit}
              style={inputStyle(!canEdit)}
            />
          </Field>

          <Field label="Bucket 2 Threshold">
            <input
              type="number"
              value={settings.overdue_bucket_2}
              onChange={(e) =>
                updateField("overdue_bucket_2", Number(e.target.value))
              }
              disabled={!canEdit}
              style={inputStyle(!canEdit)}
            />
          </Field>

          <Field label="Bucket 3 Threshold">
            <input
              type="number"
              value={settings.overdue_bucket_3}
              onChange={(e) =>
                updateField("overdue_bucket_3", Number(e.target.value))
              }
              disabled={!canEdit}
              style={inputStyle(!canEdit)}
            />
          </Field>
        </div>

        <div style={infoBoxStyle}>
          Current SLA buckets: 1–{settings.overdue_bucket_1} days,{" "}
          {settings.overdue_bucket_1 + 1}–{settings.overdue_bucket_2} days,{" "}
          {settings.overdue_bucket_2 + 1}–{settings.overdue_bucket_3} days,{" "}
          {settings.overdue_bucket_3 + 1}+ days.
        </div>
      </section>

      <section style={buttonFooterStyle}>
        <button
          onClick={save}
          disabled={!canEdit || saving}
          style={!canEdit || saving ? disabledButtonStyle : primaryButtonStyle}
        >
          {saving ? "Saving..." : "Save Company Settings"}
        </button>
      </section>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <div style={{ marginTop: "6px" }}>{children}</div>
    </div>
  );
}

function ToggleField({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div style={toggleCardStyle}>
      <label style={toggleLabelStyle}>
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        {label}
      </label>

      <p style={{ ...subtleText, margin: "8px 0 0 0" }}>{description}</p>
    </div>
  );
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
  gap: "16px",
  alignItems: "flex-start",
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

const cardStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid #d1d5db",
  borderRadius: "16px",
  padding: "20px",
  marginBottom: "18px",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "16px",
};

const labelStyle: React.CSSProperties = {
  fontWeight: 700,
};

const inputStyle = (disabled: boolean): React.CSSProperties => ({
  width: "100%",
  padding: "10px",
  borderRadius: "8px",
  border: "1px solid #d1d5db",
  background: disabled ? "#f3f4f6" : "white",
});

const toggleCardStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: "12px",
  padding: "14px",
  background: "#f9fafb",
};

const toggleLabelStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  fontWeight: 700,
};

const infoBoxStyle: React.CSSProperties = {
  marginTop: "16px",
  background: "#eff6ff",
  color: "#1e3a8a",
  border: "1px solid #bfdbfe",
  borderRadius: "12px",
  padding: "14px",
};

const warningStyle: React.CSSProperties = {
  background: "#fefce8",
  border: "1px solid #fde68a",
  color: "#92400e",
  borderRadius: "14px",
  padding: "14px",
  marginBottom: "18px",
  fontWeight: 700,
};

const buttonRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
};

const buttonFooterStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  marginTop: "8px",
};

const primaryButtonStyle: React.CSSProperties = {
  background: "#2563eb",
  color: "white",
  border: "none",
  borderRadius: "8px",
  padding: "10px 14px",
  fontWeight: 700,
  cursor: "pointer",
};

const disabledButtonStyle: React.CSSProperties = {
  background: "#9ca3af",
  color: "white",
  border: "none",
  borderRadius: "8px",
  padding: "10px 14px",
  fontWeight: 700,
  cursor: "not-allowed",
};

const darkLinkStyle: React.CSSProperties = {
  background: "#111827",
  color: "white",
  borderRadius: "8px",
  padding: "10px 14px",
  textDecoration: "none",
  fontWeight: 700,
};

const secondaryLinkStyle: React.CSSProperties = {
  background: "#15803d",
  color: "white",
  borderRadius: "8px",
  padding: "10px 14px",
  textDecoration: "none",
  fontWeight: 700,
};
