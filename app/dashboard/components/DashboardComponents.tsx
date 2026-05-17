"use client";

import React from "react";

export type TrendItem = {
  label: string;
  count: number;
};

export type NotificationItem = {
  type: string;
  message: string;
  link: string;
};

export type SupplierCount = {
  supplier: string;
  count: number;
};

export const getStatusColor = (
  value: number,
  riskType: "risk" | "warning" = "risk"
) => {
  if (value === 0) return "#15803d";
  if (riskType === "warning") return "#b45309";
  return "#b91c1c";
};

export const cardStyle = (borderColor: string): React.CSSProperties => ({
  border: `2px solid ${borderColor}`,
  borderRadius: "10px",
  padding: "16px",
  background: "#fff",
  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
});

export const sectionStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: "10px",
  padding: "18px",
  marginBottom: "20px",
  background: "#fff",
};

export const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: "14px",
  marginBottom: "20px",
};

export function KpiCard({
  title,
  value,
  subtitle,
  color,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  color: string;
}) {
  return (
    <div style={cardStyle(color)}>
      <div style={{ fontSize: "13px", fontWeight: 700, color: "#374151", marginBottom: "8px" }}>
        {title}
      </div>
      <div style={{ fontSize: "30px", fontWeight: 800, color }}>{value}</div>
      {subtitle ? <div style={{ marginTop: "6px", fontSize: "12px", color: "#6b7280" }}>{subtitle}</div> : null}
    </div>
  );
}

export function DashboardSection({
  title,
  children,
  border,
}: {
  title: string;
  children: React.ReactNode;
  border?: string;
}) {
  return (
    <section style={{ ...sectionStyle, ...(border ? { border } : {}) }}>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      {children}
    </section>
  );
}

export function TrendChart({
  title,
  data,
}: {
  title: string;
  data: TrendItem[];
}) {
  const max = Math.max(...data.map((d) => d.count), 1);

  return (
    <div style={{ padding: "15px", border: "1px solid #ccc" }}>
      <strong>{title}</strong>
      <div style={{ marginTop: "10px" }}>
        {data.map((item) => (
          <div key={item.label} style={{ marginBottom: "10px" }}>
            <div style={{ fontSize: "14px", marginBottom: "4px" }}>
              {item.label}: {item.count}
            </div>
            <div style={{ background: "#eee", height: "12px", width: "100%", maxWidth: "300px" }}>
              <div
                style={{
                  background: "#3b82f6",
                  height: "12px",
                  width: `${item.count > 0 ? Math.max((item.count / max) * 100, 5) : 0}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
