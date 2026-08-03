"use client";

import { ReactNode, useState } from "react";

export function WorkflowSection({
  title,
  subtitle,
  children,
  defaultOpen = true,
  rightAction,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  rightAction?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section
      style={{
        border: "1px solid #d1d5db",
        borderRadius: "12px",
        padding: "14px",
        marginBottom: "18px",
        background: "white",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "12px",
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        <div>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            style={{
              border: "none",
              background: "transparent",
              padding: 0,
              cursor: "pointer",
              fontSize: "20px",
              fontWeight: 700,
              textAlign: "left",
            }}
          >
            {open ? "▼" : "▶"} {title}
          </button>

          {subtitle ? (
            <p style={{ color: "#4b5563", marginTop: "6px", marginBottom: 0 }}>
              {subtitle}
            </p>
          ) : null}
        </div>

        {rightAction ? <div>{rightAction}</div> : null}
      </div>

      {open ? <div style={{ marginTop: "14px" }}>{children}</div> : null}
    </section>
  );
}

export function WorkflowActionBar({
  children,
  sticky = false,
}: {
  children: ReactNode;
  sticky?: boolean;
}) {
  return (
    <div
      style={{
        position: sticky ? "sticky" : "static",
        top: sticky ? 0 : undefined,
        zIndex: sticky ? 50 : undefined,
        background: "white",
        border: "1px solid #d1d5db",
        borderRadius: "12px",
        padding: "12px",
        marginBottom: "16px",
        boxShadow: sticky ? "0 2px 8px rgba(0,0,0,0.08)" : undefined,
      }}
    >
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
        {children}
      </div>
    </div>
  );
}

export function SaveCancelActions({
  onSave,
  onCancel,
  disabled = false,
  saveLabel = "Save Section",
  cancelLabel = "Cancel Section Changes",
}: {
  onSave: () => void;
  onCancel: () => void;
  disabled?: boolean;
  saveLabel?: string;
  cancelLabel?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: "8px",
        flexWrap: "wrap",
        marginTop: "14px",
        borderTop: "1px solid #e5e7eb",
        paddingTop: "12px",
      }}
    >
      <button type="button" onClick={onSave} disabled={disabled}>
        {saveLabel}
      </button>
      <button type="button" onClick={onCancel} disabled={disabled}>
        {cancelLabel}
      </button>
    </div>
  );
}

export function StatusBadge({
  status,
}: {
  status: string | null | undefined;
}) {
  const normalized = (status || "unknown").toLowerCase();

  let background = "#f3f4f6";
  let border = "#d1d5db";
  let color = "#111827";

  if (
    normalized.includes("approved") ||
    normalized.includes("closed") ||
    normalized.includes("completed") ||
    normalized.includes("active") ||
    normalized.includes("qualified") ||
    normalized.includes("complete") ||
    normalized.includes("on track")
  ) {
    background = "#f0fdf4";
    border = "#86efac";
    color = "#166534";
  }

  if (
    normalized.includes("pending") ||
    normalized.includes("draft") ||
    normalized.includes("planned") ||
    normalized.includes("conditional") ||
    normalized.includes("watch") ||
    normalized.includes("in progress") ||
    normalized.includes("at risk")
  ) {
    background = "#fffbeb";
    border = "#facc15";
    color = "#92400e";
  }

  if (
    normalized.includes("rejected") ||
    normalized.includes("critical") ||
    normalized.includes("overdue") ||
    normalized.includes("expired") ||
    normalized.includes("disqualified") ||
    normalized.includes("probation") ||
    normalized.includes("needs attention")
  ) {
    background = "#fef2f2";
    border = "#fca5a5";
    color = "#991b1b";
  }

  return (
    <span
      style={{
        display: "inline-block",
        border: `1px solid ${border}`,
        background,
        color,
        borderRadius: "999px",
        padding: "4px 10px",
        fontSize: "12px",
        fontWeight: 700,
        textTransform: "capitalize",
      }}
    >
      {status || "Unknown"}
    </span>
  );
}

export function WorkflowProgress({
  steps,
}: {
  steps: { label: string; complete: boolean }[];
}) {
  const completed = steps.filter((step) => step.complete).length;
  const percent = steps.length > 0 ? Math.round((completed / steps.length) * 100) : 0;

  return (
    <div>
      <strong>Workflow Progress:</strong> {completed} / {steps.length} complete ({percent}%)
      <div
        style={{
          height: "8px",
          background: "#e5e7eb",
          borderRadius: "999px",
          overflow: "hidden",
          marginTop: "6px",
          width: "280px",
          maxWidth: "100%",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${percent}%`,
            background: percent === 100 ? "#16a34a" : "#2563eb",
          }}
        />
      </div>

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "10px" }}>
        {steps.map((step) => (
          <span
            key={step.label}
            style={{
              border: step.complete ? "1px solid #86efac" : "1px solid #d1d5db",
              background: step.complete ? "#f0fdf4" : "#f9fafb",
              color: step.complete ? "#166534" : "#374151",
              borderRadius: "999px",
              padding: "4px 10px",
              fontSize: "12px",
              fontWeight: 600,
            }}
          >
            {step.complete ? "✓" : "○"} {step.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function MetricGrid({
  metrics,
}: {
  metrics: { label: string; value: any; helper?: string }[];
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: "12px",
      }}
    >
      {metrics.map((metric) => (
        <div
          key={metric.label}
          style={{
            border: "1px solid #d1d5db",
            borderRadius: "10px",
            padding: "12px",
            background: "#f9fafb",
          }}
        >
          <div style={{ color: "#4b5563", fontSize: "13px", marginBottom: "4px" }}>
            {metric.label}
          </div>
          <div style={{ fontSize: "22px", fontWeight: 700 }}>{metric.value}</div>
          {metric.helper ? (
            <div style={{ color: "#6b7280", fontSize: "12px", marginTop: "4px" }}>
              {metric.helper}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function SignaturePanel({
  title,
  meaning,
  userEmail,
  signatureEmail,
  setSignatureEmail,
  disabled = false,
}: {
  title: string;
  meaning: string;
  userEmail: string;
  signatureEmail: string;
  setSignatureEmail: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div
      style={{
        marginTop: "16px",
        border: "1px solid #cbd5e1",
        borderRadius: "8px",
        padding: "12px",
        background: "#f8fafc",
      }}
    >
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <p style={{ color: "#4b5563", fontSize: "14px" }}>
        <strong>Signature Meaning:</strong> {meaning}
      </p>

      <label>Re-enter Your Email for E-Signature</label>
      <br />
      <input
        value={signatureEmail}
        onChange={(e) => setSignatureEmail(e.target.value)}
        placeholder={userEmail || "your.email@company.com"}
        disabled={disabled}
        style={{ width: "100%", maxWidth: "500px", padding: "8px" }}
      />

      <div style={{ marginTop: "8px", color: "#6b7280", fontSize: "13px" }}>
        <strong>Logged-in User:</strong> {userEmail || "none"}
        <br />
        <strong>Signature Timestamp:</strong> recorded automatically at signing
      </div>
    </div>
  );
}

export function TimelineFeed({
  events,
  filter,
  setFilter,
}: {
  events: any[];
  filter: string;
  setFilter: (value: string) => void;
}) {
  const filteredEvents = filter
    ? events.filter((event) =>
        [event.action, event.details, event.user_email]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(filter.trim().toLowerCase())
      )
    : events;

  return (
    <div>
      <div style={{ marginBottom: "12px" }}>
        <label>Filter timeline events</label>
        <br />
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search action, details, or user"
          style={{ width: "100%", maxWidth: "500px", padding: "8px" }}
        />

        {filter ? (
          <button type="button" onClick={() => setFilter("")} style={{ marginLeft: "8px" }}>
            Clear
          </button>
        ) : null}
      </div>

      {events.length === 0 ? (
        <p>No activity recorded yet.</p>
      ) : filteredEvents.length === 0 ? (
        <p>No timeline events match the filter.</p>
      ) : (
        <div style={{ display: "grid", gap: "12px" }}>
          {filteredEvents.map((event) => (
            <div
              key={event.id}
              style={{
                border: "1px solid #d1d5db",
                borderRadius: "10px",
                padding: "12px",
                background: "white",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "12px",
                  flexWrap: "wrap",
                }}
              >
                <strong>{event.action || "Activity"}</strong>
                <span style={{ color: "#4b5563", fontSize: "13px" }}>
                  {event.created_at ? new Date(event.created_at).toLocaleString() : "N/A"}
                </span>
              </div>

              <div style={{ marginTop: "8px", color: "#374151" }}>
                {event.details || "No details provided."}
              </div>

              <div style={{ marginTop: "8px", color: "#6b7280", fontSize: "13px" }}>
                <strong>User:</strong> {event.user_email || "unknown"}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function EmptyStateCard({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div
      style={{
        border: "1px dashed #cbd5e1",
        borderRadius: "10px",
        padding: "18px",
        background: "#f8fafc",
        textAlign: "center",
        color: "#475569",
      }}
    >
      <strong style={{ color: "#111827" }}>{title}</strong>
      <p style={{ marginTop: "8px" }}>{message}</p>
      {action ? <div style={{ marginTop: "12px" }}>{action}</div> : null}
    </div>
  );
}

export function FormField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div style={{ marginBottom: "12px" }}>
      <label>{label}</label>
      <br />
      {children}
    </div>
  );
}

export const standardInputStyle: React.CSSProperties = {
  padding: "8px",
  width: "100%",
  maxWidth: "700px",
};

export const standardTextareaStyle: React.CSSProperties = {
  padding: "8px",
  width: "100%",
  maxWidth: "900px",
};

export const primaryButtonStyle: React.CSSProperties = {
  padding: "8px 12px",
  background: "#2563eb",
  color: "white",
  border: "none",
  borderRadius: "6px",
  cursor: "pointer",
  fontWeight: 600,
};

export const successButtonStyle: React.CSSProperties = {
  padding: "8px 12px",
  background: "#16a34a",
  color: "white",
  border: "none",
  borderRadius: "6px",
  cursor: "pointer",
  fontWeight: 600,
};

export const dangerButtonStyle: React.CSSProperties = {
  padding: "8px 12px",
  background: "#dc2626",
  color: "white",
  border: "none",
  borderRadius: "6px",
  cursor: "pointer",
  fontWeight: 600,
};
