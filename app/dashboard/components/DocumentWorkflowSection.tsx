"use client";

import React from "react";

type Props = {
  documentsInCollaboration: number;
  documentsInFormalReview: number;
  documentsAwaitingRelease: number;
  effectiveDocuments: number;
  overdueDocumentReviews: number;
  workflowSlaCompliance: string;
};

export default function DocumentWorkflowSection({
  documentsInCollaboration,
  documentsInFormalReview,
  documentsAwaitingRelease,
  effectiveDocuments,
  overdueDocumentReviews,
  workflowSlaCompliance,
}: Props) {
  return (
    <section style={sectionStyle}>
      <h2>Document Control Workflow</h2>

      <div style={gridStyle}>
        <MetricCard title="In Collaboration" value={documentsInCollaboration} color="#7c3aed" />
        <MetricCard title="Formal Review" value={documentsInFormalReview} color="#d97706" />
        <MetricCard title="Awaiting Release" value={documentsAwaitingRelease} color="#2563eb" />
        <MetricCard title="Effective Documents" value={effectiveDocuments} color="#15803d" />
        <MetricCard title="Overdue Reviews" value={overdueDocumentReviews} color="#dc2626" />
        <MetricCard title="Workflow SLA" value={`${workflowSlaCompliance}%`} color="#2563eb" />
      </div>
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
