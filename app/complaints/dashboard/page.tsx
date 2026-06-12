"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type Complaint = {
  id: string;
  complaint_number: string | null;
  complaint_title: string;
  date_received: string | null;
  source: string | null;
  customer_name: string | null;
  customer_organization: string | null;
  product_name: string | null;
  part_number: string | null;
  lot_number: string | null;
  severity: string | null;
  potential_patient_impact: boolean | null;
  potential_safety_issue: boolean | null;
  status: string | null;
  mdr_assessment_required: boolean | null;
  regulatory_assessment: string | null;
  ncmr_required: boolean | null;
  capa_required: boolean | null;
  scar_required: boolean | null;
  change_control_required: boolean | null;
  closed_at: string | null;
  created_at: string | null;
};

type DistributionItem = {
  label: string;
  count: number;
};

export default function ComplaintDashboardPage() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchComplaints = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("complaints")
      .select("*")
      .order("created_at", { ascending: false });

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    setComplaints((data as Complaint[]) || []);
  };

  useEffect(() => {
    fetchComplaints();
  }, []);

  const openComplaints = complaints.filter(
    (complaint) => complaint.status !== "closed",
  );

  const closedComplaints = complaints.filter(
    (complaint) => complaint.status === "closed",
  );

  const reportableOrPending = complaints.filter(
    (complaint) =>
      complaint.mdr_assessment_required ||
      complaint.regulatory_assessment === "reportable" ||
      complaint.regulatory_assessment === "pending",
  );

  const highRiskComplaints = complaints.filter(
    (complaint) =>
      complaint.severity === "critical" ||
      complaint.potential_patient_impact ||
      complaint.potential_safety_issue,
  );

  const capaTriggered = complaints.filter((complaint) => complaint.capa_required);
  const ncmrTriggered = complaints.filter((complaint) => complaint.ncmr_required);
  const scarTriggered = complaints.filter((complaint) => complaint.scar_required);
  const changeTriggered = complaints.filter(
    (complaint) => complaint.change_control_required,
  );

  const closureRate =
    complaints.length > 0
      ? ((closedComplaints.length / complaints.length) * 100).toFixed(1)
      : "0.0";

  const complaintsThisMonth = useMemo(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(
      now.getMonth() + 1,
    ).padStart(2, "0")}`;

    return complaints.filter((complaint) => {
      if (!complaint.date_received) return false;
      return complaint.date_received.startsWith(currentMonth);
    });
  }, [complaints]);

  const buildDistribution = (
    items: Complaint[],
    field: keyof Complaint,
  ): DistributionItem[] => {
    const counts: Record<string, number> = {};

    items.forEach((item) => {
      const label = String(item[field] || "N/A").trim() || "N/A";
      counts[label] = (counts[label] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  };

  const severityDistribution = buildDistribution(complaints, "severity");
  const statusDistribution = buildDistribution(complaints, "status");
  const productDistribution = buildDistribution(complaints, "product_name").slice(
    0,
    10,
  );
  const sourceDistribution = buildDistribution(complaints, "source");

  if (loading) {
    return <main style={pageStyle}>Loading complaint dashboard...</main>;
  }

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>COMPLAINT REPORTING</div>
          <h1 style={{ margin: "6px 0" }}>Complaint Dashboard</h1>
          <p style={subtleText}>
            Monitor complaint volume, risk, reportability, and linked quality
            actions.
          </p>
        </div>

        <div style={buttonRowStyle}>
          <Link href="/complaints" style={secondaryLinkStyle}>
            Complaint Registry
          </Link>

          <Link href="/dashboard" style={darkLinkStyle}>
            Executive Dashboard
          </Link>
        </div>
      </header>

      <section style={kpiGridStyle}>
        <KpiCard label="Total Complaints" value={complaints.length} />
        <KpiCard label="Open Complaints" value={openComplaints.length} tone="blue" />
        <KpiCard label="Closed Complaints" value={closedComplaints.length} tone="green" />
        <KpiCard label="Closure Rate" value={`${closureRate}%`} tone="green" />
        <KpiCard label="Received This Month" value={complaintsThisMonth.length} tone="blue" />
        <KpiCard label="Reportable / Pending" value={reportableOrPending.length} tone="orange" />
        <KpiCard label="High-Risk Complaints" value={highRiskComplaints.length} tone="red" />
        <KpiCard label="CAPA Triggered" value={capaTriggered.length} tone="purple" />
        <KpiCard label="NCMR Triggered" value={ncmrTriggered.length} tone="purple" />
        <KpiCard label="SCAR Triggered" value={scarTriggered.length} tone="purple" />
        <KpiCard label="Change Triggered" value={changeTriggered.length} tone="purple" />
      </section>

      <section style={gridTwoColumnStyle}>
        <DistributionCard title="Complaints by Severity" items={severityDistribution} />
        <DistributionCard title="Complaints by Status" items={statusDistribution} />
        <DistributionCard title="Complaints by Source" items={sourceDistribution} />
        <DistributionCard title="Top Products" items={productDistribution} />
      </section>
    </main>
  );
}

function KpiCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "blue" | "green" | "orange" | "red" | "purple";
}) {
  const colorMap: Record<string, string> = {
    default: "#111827",
    blue: "#2563eb",
    green: "#15803d",
    orange: "#c2410c",
    red: "#b91c1c",
    purple: "#7c3aed",
  };

  return (
    <div style={{ ...kpiCardStyle, borderLeft: `6px solid ${colorMap[tone]}` }}>
      <div style={smallTextStyle}>{label}</div>
      <div style={{ fontSize: "30px", fontWeight: 900, color: colorMap[tone] }}>
        {value}
      </div>
    </div>
  );
}

function DistributionCard({
  title,
  items,
}: {
  title: string;
  items: DistributionItem[];
}) {
  return (
    <section style={cardStyle}>
      <h2 style={{ marginTop: 0 }}>{title}</h2>

      {items.length === 0 ? (
        <div style={infoBoxStyle}>No data available.</div>
      ) : (
        <div>
          {items.map((item) => (
            <div key={item.label} style={distributionRowStyle}>
              <span>{formatLabel(item.label)}</span>
              <strong>{item.count}</strong>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

const formatLabel = (value: string) =>
  value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

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

const buttonRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
};

const kpiGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: "14px",
  marginBottom: "18px",
};

const kpiCardStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid #d1d5db",
  borderRadius: "14px",
  padding: "16px",
};

const gridTwoColumnStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: "18px",
  marginBottom: "18px",
};

const cardStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid #d1d5db",
  borderRadius: "16px",
  padding: "20px",
  marginBottom: "18px",
};

const distributionRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  borderBottom: "1px solid #e5e7eb",
  padding: "10px 0",
};

const smallTextStyle: React.CSSProperties = {
  color: "#6b7280",
  fontSize: "12px",
  marginTop: "4px",
};

const infoBoxStyle: React.CSSProperties = {
  marginTop: "16px",
  background: "#eff6ff",
  color: "#1e3a8a",
  border: "1px solid #bfdbfe",
  borderRadius: "12px",
  padding: "14px",
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
