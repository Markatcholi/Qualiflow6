"use client";

import { ReactNode, useState } from "react";

export function SectionCard({
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
        borderRadius: "10px",
        padding: "14px",
        marginBottom: "20px",
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

export function ActionToolbar({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: "8px",
        flexWrap: "wrap",
        alignItems: "center",
        marginTop: "12px",
      }}
    >
      {children}
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
    normalized.includes("qualified")
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
    normalized.includes("watch")
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
    normalized.includes("probation")
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

export function ValidationBanner({
  errors,
}: {
  errors: string[];
}) {
  if (!errors || errors.length === 0) {
    return (
      <div
        style={{
          background: "#f0fdf4",
          border: "1px solid #86efac",
          color: "#166534",
          padding: "12px",
          borderRadius: "8px",
          marginBottom: "16px",
        }}
      >
        <strong>Workflow Validation:</strong> No active validation errors.
      </div>
    );
  }

  return (
    <div
      style={{
        background: "#fef2f2",
        border: "1px solid #fca5a5",
        color: "#991b1b",
        padding: "12px",
        borderRadius: "8px",
        marginBottom: "16px",
      }}
    >
      <strong>Workflow Validation Errors</strong>
      <ul style={{ marginTop: "8px", marginBottom: 0 }}>
        {errors.map((error, index) => (
          <li key={index}>{error}</li>
        ))}
      </ul>
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

export function ConfirmButton({
  children,
  confirmMessage,
  onConfirm,
  disabled = false,
  style,
}: {
  children: ReactNode;
  confirmMessage: string;
  onConfirm: () => void;
  disabled?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        const confirmed = window.confirm(confirmMessage);
        if (confirmed) onConfirm();
      }}
      style={style}
    >
      {children}
    </button>
  );
}

export function FieldRow({
  label,
  value,
}: {
  label: string;
  value: any;
}) {
  return (
    <div style={{ marginBottom: "8px" }}>
      <strong>{label}:</strong> {value || "N/A"}
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
