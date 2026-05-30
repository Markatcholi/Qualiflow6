"use client";

import React from "react";

type Props = {
  trainingAssigned: number;
  trainingCompleted: number;
  trainingOverdue: number;
  trainingComplianceRate: string;
};

export default function TrainingComplianceSection({
  trainingAssigned,
  trainingCompleted,
  trainingOverdue,
  trainingComplianceRate,
}: Props) {
  return (
    <section style={sectionStyle}>
      <h2>Training Compliance</h2>

      <div style={gridStyle}>
        <MetricCard title="Training Assigned" value={trainingAssigned} color="#2563eb" />
        <MetricCard title="Training Completed" value={trainingCompleted} color="#15803d" />
        <MetricCard title="Training Overdue" value={trainingOverdue} color="#dc2626" />
        <MetricCard title="Compliance Rate" value={`${trainingComplianceRate}%`} color="#0f766e" />
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
