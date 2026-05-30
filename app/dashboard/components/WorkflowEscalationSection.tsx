"use client";

import React from "react";

type WorkflowEscalationItem = {
  id: string;
  document_id: string;
  document_number?: string | null;
  revision?: string | null;
  reviewer_email: string;
  reviewer_type: string;
  reviewer_role?: string | null;
  due_date?: string | null;
  review_status?: string | null;
};

type Props = {
  openReviews: number;
  overdueReviews: number;
  criticalNotifications: number;
  workflowEvents: number;
  escalationQueue: WorkflowEscalationItem[];
};

export default function WorkflowEscalationSection({
  openReviews,
  overdueReviews,
  criticalNotifications,
  workflowEvents,
  escalationQueue,
}: Props) {
  return (
    <section style={sectionStyle}>
      <h2>Workflow Escalation Queue</h2>

      <div style={gridStyle}>
        <MetricCard title="Open Reviews" value={openReviews} color="#d97706" />
        <MetricCard title="Overdue Reviews" value={overdueReviews} color="#dc2626" />
        <MetricCard title="Critical Notifications" value={criticalNotifications} color="#991b1b" />
        <MetricCard title="Workflow Events" value={workflowEvents} color="#2563eb" />
      </div>

      <h3 style={{ marginTop: "22px" }}>Overdue / Escalation Items</h3>

      {escalationQueue.length === 0 ? (
        <p style={subtleText}>No overdue workflow escalation items.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Document</th>
                <th style={thStyle}>Reviewer</th>
                <th style={thStyle}>Role</th>
                <th style={thStyle}>Due Date</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Action</th>
              </tr>
            </thead>

            <tbody>
              {escalationQueue.map((item) => (
                <tr key={item.id}>
                  <td style={tdStyle}>
                    {item.document_number ? (
                      <>
                        {item.document_number} Rev {item.revision || "N/A"}
                      </>
                    ) : (
                      item.document_id
                    )}
                  </td>

                  <td style={tdStyle}>{item.reviewer_email}</td>
                  <td style={tdStyle}>{item.reviewer_role || item.reviewer_type}</td>
                  <td style={overdueCellStyle}>{formatDate(item.due_date)}</td>
                  <td style={tdStyle}>{item.review_status || "pending"}</td>
                  <td style={tdStyle}>
                    <a href={`/documents/${item.document_id}`} style={linkStyle}>
                      Open
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function MetricCard({
  title,
  value,
  color,
}: {
  title: string;
  value: string | number;
  color: string;
}) {
  return (
    <div style={{ ...cardStyle, borderColor: color }}>
      <div style={titleStyle}>{title}</div>
      <div style={{ ...valueStyle, color }}>{value}</div>
    </div>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "N/A";

  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return value;
  }
}

const sectionStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid #d1d5db",
  borderRadius: "12px",
  padding: "20px",
  marginBottom: "24px",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "14px",
};

const cardStyle: React.CSSProperties = {
  border: "2px solid #d1d5db",
  borderRadius: "10px",
  padding: "16px",
};

const titleStyle: React.CSSProperties = {
  fontWeight: 700,
  color: "#111827",
  marginBottom: "10px",
};

const valueStyle: React.CSSProperties = {
  fontSize: "30px",
  fontWeight: 800,
};

const subtleText: React.CSSProperties = {
  color: "#6b7280",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  borderBottom: "1px solid #d1d5db",
  padding: "10px",
};

const tdStyle: React.CSSProperties = {
  borderBottom: "1px solid #e5e7eb",
  padding: "10px",
  verticalAlign: "top",
};

const overdueCellStyle: React.CSSProperties = {
  ...tdStyle,
  color: "#dc2626",
  fontWeight: 700,
};

const linkStyle: React.CSSProperties = {
  color: "#2563eb",
  fontWeight: 700,
  textDecoration: "none",
};
