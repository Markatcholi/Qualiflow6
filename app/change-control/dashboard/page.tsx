"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type ChangeControl = {
  id: string;
  change_number: string | null;
  change_title: string;
  change_description: string;
  change_type: string | null;
  priority: string | null;
  status: string | null;
  owner_email: string | null;
  initiator_email?: string | null;
  risk_level: string | null;
  change_origin?: string | null;
  originating_record_number?: string | null;
  closure_decision?: string | null;
  created_at: string | null;
  closed_at?: string | null;
  approved_at?: string | null;
  target_implementation_date?: string | null;
};

const CHANGE_TYPES = [
  "ECO",
  "Process",
  "Document",
  "Supplier",
  "Software",
  "Equipment",
  "Material",
  "Other",
];

const OPEN_STATUSES = [
  "draft",
  "pending_approval",
  "approved",
  "implementation",
  "verification",
  "closure_approval",
  "rejected",
];

export default function ChangeControlDashboardPage() {
  const [changes, setChanges] = useState<ChangeControl[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("change_controls")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) alert(error.message);
    else setChanges((data as ChangeControl[]) || []);

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const daysBetween = (startDate?: string | null, endDate?: string | null) => {
    if (!startDate) return 0;
    const start = new Date(startDate).getTime();
    const end = endDate ? new Date(endDate).getTime() : new Date().getTime();
    if (Number.isNaN(start) || Number.isNaN(end)) return 0;
    return Math.max(0, Math.floor((end - start) / (1000 * 60 * 60 * 24)));
  };

  const isOpen = (change: ChangeControl) =>
    OPEN_STATUSES.includes(change.status || "draft");

  const isOverdue = (change: ChangeControl) => {
    if (!isOpen(change)) return false;
    if (change.target_implementation_date) {
      const target = new Date(change.target_implementation_date).getTime();
      return !Number.isNaN(target) && target < new Date().getTime();
    }
    return daysBetween(change.created_at) > 45;
  };

  const isHighRisk = (change: ChangeControl) =>
    change.risk_level === "High" ||
    change.risk_level === "Critical" ||
    change.priority === "Critical";

  const metrics = useMemo(() => {
    const closedChanges = changes.filter((c) => c.status === "closed");
    const closedDays = closedChanges.map((c) => daysBetween(c.created_at, c.closed_at));
    const averageClosureDays = closedDays.length
      ? Math.round(closedDays.reduce((sum, value) => sum + value, 0) / closedDays.length)
      : 0;

    return {
      total: changes.length,
      open: changes.filter((c) => isOpen(c)).length,
      draft: changes.filter((c) => c.status === "draft").length,
      pending: changes.filter((c) => c.status === "pending_approval").length,
      approved: changes.filter((c) => c.status === "approved").length,
      implementation: changes.filter((c) => c.status === "implementation").length,
      verification: changes.filter((c) => c.status === "verification").length,
      closureApproval: changes.filter((c) => c.status === "closure_approval").length,
      closed: closedChanges.length,
      cancelled: changes.filter((c) => c.status === "cancelled").length,
      rejected: changes.filter((c) => c.status === "rejected").length,
      overdue: changes.filter((c) => isOverdue(c)).length,
      highRisk: changes.filter((c) => isHighRisk(c)).length,
      averageClosureDays,
    };
  }, [changes]);

  const aging = useMemo(() => {
    const openChanges = changes.filter((change) => isOpen(change));
    return {
      zeroToThirty: openChanges.filter((c) => daysBetween(c.created_at) <= 30).length,
      thirtyOneToSixty: openChanges.filter((c) => {
        const days = daysBetween(c.created_at);
        return days >= 31 && days <= 60;
      }).length,
      sixtyOneToNinety: openChanges.filter((c) => {
        const days = daysBetween(c.created_at);
        return days >= 61 && days <= 90;
      }).length,
      overNinety: openChanges.filter((c) => daysBetween(c.created_at) > 90).length,
    };
  }, [changes]);

  const statusCounts = useMemo(() => {
    return [
      { label: "Draft", count: metrics.draft },
      { label: "Pending Approval", count: metrics.pending },
      { label: "Approved", count: metrics.approved },
      { label: "Implementation", count: metrics.implementation },
      { label: "Verification", count: metrics.verification },
      { label: "Closure Approval", count: metrics.closureApproval },
      { label: "Closed", count: metrics.closed },
      { label: "Cancelled", count: metrics.cancelled },
      { label: "Rejected", count: metrics.rejected },
    ];
  }, [metrics]);

  const typeCounts = useMemo(() => {
    return CHANGE_TYPES.map((type) => ({
      label: type,
      count: changes.filter((change) => change.change_type === type).length,
    })).filter((item) => item.count > 0);
  }, [changes]);

  const riskCounts = useMemo(() => {
    const levels = ["Not assessed", "Low", "Medium", "High", "Critical"];
    return levels
      .map((level) => ({
        label: level,
        count: changes.filter((change) => (change.risk_level || "Not assessed") === level).length,
      }))
      .filter((item) => item.count > 0);
  }, [changes]);

  const originCounts = useMemo(() => {
    const map: Record<string, number> = {};
    changes.forEach((change) => {
      const label = change.change_origin || "N/A";
      map[label] = (map[label] || 0) + 1;
    });
    return Object.entries(map)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  }, [changes]);

  const closureDecisionCounts = useMemo(() => {
    const labels = ["accepted", "rejected", "cancelled", "Not recorded"];
    return labels
      .map((label) => ({
        label: label === "Not recorded" ? label : getClosureDecisionLabel(label),
        count: changes.filter((change) => (change.closure_decision || "Not recorded") === label).length,
      }))
      .filter((item) => item.count > 0);
  }, [changes]);

  const overdueChanges = useMemo(() => {
    return changes.filter((change) => isOverdue(change)).slice(0, 10);
  }, [changes]);

  if (loading) return <main style={pageStyle}>Loading Change Control Dashboard...</main>;

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>CHANGE CONTROL / KPI DASHBOARD</div>
          <h1 style={{ margin: "6px 0" }}>Change Control Dashboard</h1>
          <p style={subtleText}>
            Executive visibility into change status, aging, risk, closure performance,
            and originating sources.
          </p>
        </div>
        <div style={buttonRowStyle}>
          <a href="/change-control" style={darkButtonStyle}>Back to Change Register</a>
          <a href="/dashboard" style={secondaryButtonStyle}>Enterprise Dashboard</a>
        </div>
      </header>

      <section style={kpiGridStyle}>
        <KpiCard title="Total Changes" value={metrics.total} color="#2563eb" />
        <KpiCard title="Open" value={metrics.open} color="#d97706" />
        <KpiCard title="Pending Approval" value={metrics.pending} color="#d97706" />
        <KpiCard title="Implementation" value={metrics.implementation} color="#2563eb" />
        <KpiCard title="Verification" value={metrics.verification} color="#7c3aed" />
        <KpiCard title="Closure Approval" value={metrics.closureApproval} color="#9333ea" />
        <KpiCard title="Closed" value={metrics.closed} color="#15803d" />
        <KpiCard title="Cancelled" value={metrics.cancelled} color="#991b1b" />
        <KpiCard title="Overdue" value={metrics.overdue} color="#dc2626" />
        <KpiCard title="High/Critical Risk" value={metrics.highRisk} color="#dc2626" />
        <KpiCard title="Avg Days to Close" value={metrics.averageClosureDays} color="#111827" />
      </section>

      <section style={analyticsGridStyle}>
        <SummaryCard title="Status Distribution" rows={statusCounts} />
        <SummaryCard title="Changes by Type" rows={typeCounts.length ? typeCounts : [{ label: "No data", count: 0 }]} />
        <SummaryCard title="Changes by Risk" rows={riskCounts.length ? riskCounts : [{ label: "No data", count: 0 }]} />
        <div style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>Open Change Aging</h3>
          <AgingRow label="0–30 Days" value={aging.zeroToThirty} color="#15803d" />
          <AgingRow label="31–60 Days" value={aging.thirtyOneToSixty} color="#d97706" />
          <AgingRow label="61–90 Days" value={aging.sixtyOneToNinety} color="#ea580c" />
          <AgingRow label=">90 Days" value={aging.overNinety} color="#dc2626" />
        </div>
        <SummaryCard title="Changes by Origin" rows={originCounts.length ? originCounts : [{ label: "No data", count: 0 }]} />
        <SummaryCard title="Closure Decisions" rows={closureDecisionCounts.length ? closureDecisionCounts : [{ label: "No data", count: 0 }]} />
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <h2 style={{ margin: 0 }}>Overdue / Aging Attention</h2>
            <p style={subtleText}>Open changes with past target dates or greater than 45 days open.</p>
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Change</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Owner</th>
                <th style={thStyle}>Target Date</th>
                <th style={thStyle}>Days Open</th>
                <th style={thStyle}>Open</th>
              </tr>
            </thead>
            <tbody>
              {overdueChanges.length === 0 ? (
                <tr><td colSpan={6} style={tdStyle}>No overdue changes.</td></tr>
              ) : overdueChanges.map((change) => (
                <tr key={change.id}>
                  <td style={tdStyle}>
                    <strong>{change.change_number || change.id}</strong>
                    <div>{change.change_title}</div>
                    <div style={smallTextStyle}>{change.change_description}</div>
                  </td>
                  <td style={tdStyle}><StatusBadge status={change.status || "draft"} /></td>
                  <td style={tdStyle}>{change.owner_email || "N/A"}</td>
                  <td style={tdStyle}>{formatDate(change.target_implementation_date)}</td>
                  <td style={tdStyle}>{daysBetween(change.created_at)}</td>
                  <td style={tdStyle}><a href={`/change-control/${change.id}`} style={primaryLinkStyle}>Open Workflow</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function KpiCard({ title, value, color }: { title: string; value: number; color: string }) {
  return <div style={{ ...kpiCardStyle, borderLeft: `8px solid ${color}` }}><div style={kpiTitleStyle}>{title}</div><div style={{ fontSize: "30px", fontWeight: 800, color }}>{value}</div></div>;
}

function SummaryCard({ title, rows }: { title: string; rows: { label: string; count: number }[] }) {
  return (
    <div style={cardStyle}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      {rows.map((row) => (
        <div key={row.label} style={summaryRowStyle}>
          <span>{row.label}</span>
          <strong>{row.count}</strong>
        </div>
      ))}
    </div>
  );
}

function AgingRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={summaryRowStyle}>
      <span>{label}</span>
      <strong style={{ color }}>{value}</strong>
    </div>
  );
}

function getStatusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "Draft",
    pending_approval: "Pending Approval",
    approved: "Approved",
    implementation: "Implementation",
    verification: "Verification",
    closure_approval: "Closure Approval",
    closed: "Closed",
    cancelled: "Cancelled",
    rejected: "Rejected",
  };
  return labels[status] || status;
}

function getClosureDecisionLabel(decision: string) {
  const labels: Record<string, string> = {
    accepted: "Accepted",
    rejected: "Rejected",
    cancelled: "Cancelled",
  };
  return labels[decision] || decision;
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "closed"
      ? "#15803d"
      : status === "cancelled"
        ? "#991b1b"
        : status === "closure_approval"
          ? "#9333ea"
          : status === "verification"
            ? "#7c3aed"
            : status === "implementation"
              ? "#2563eb"
              : status === "approved"
                ? "#2563eb"
                : status === "pending_approval"
                  ? "#d97706"
                  : status === "rejected"
                    ? "#dc2626"
                    : "#6b7280";

  return (
    <span style={{ background: color, color: "white", borderRadius: "999px", padding: "3px 8px", fontSize: "12px", fontWeight: 700 }}>
      {getStatusLabel(status)}
    </span>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString();
}

const pageStyle: React.CSSProperties = { padding: "24px", background: "#f8fafc", minHeight: "100vh", fontFamily: "Arial, sans-serif" };
const headerStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-start", flexWrap: "wrap", marginBottom: "20px" };
const eyebrowStyle: React.CSSProperties = { fontSize: "12px", letterSpacing: "0.08em", color: "#6b7280", fontWeight: 800 };
const subtleText: React.CSSProperties = { color: "#6b7280" };
const cardStyle: React.CSSProperties = { background: "white", border: "1px solid #d1d5db", borderRadius: "16px", padding: "20px", marginBottom: "20px" };
const sectionHeaderStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: "14px", alignItems: "flex-start", flexWrap: "wrap", marginBottom: "16px" };
const kpiGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px", marginBottom: "20px" };
const analyticsGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "14px", marginBottom: "20px" };
const kpiCardStyle: React.CSSProperties = { background: "white", border: "1px solid #d1d5db", borderRadius: "14px", padding: "16px" };
const kpiTitleStyle: React.CSSProperties = { color: "#6b7280", marginBottom: "8px" };
const darkButtonStyle: React.CSSProperties = { background: "#111827", color: "white", padding: "10px 14px", borderRadius: "8px", textDecoration: "none", fontWeight: 700 };
const secondaryButtonStyle: React.CSSProperties = { background: "#2563eb", color: "white", border: "none", padding: "10px 14px", borderRadius: "8px", fontWeight: 700, cursor: "pointer", textDecoration: "none", display: "inline-block" };
const primaryLinkStyle: React.CSSProperties = { background: "#2563eb", color: "white", padding: "8px 12px", borderRadius: "8px", textDecoration: "none", fontWeight: 700, display: "inline-block" };
const buttonRowStyle: React.CSSProperties = { display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center", marginTop: "12px" };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse" };
const thStyle: React.CSSProperties = { textAlign: "left", borderBottom: "1px solid #d1d5db", padding: "10px" };
const tdStyle: React.CSSProperties = { borderBottom: "1px solid #e5e7eb", padding: "10px", verticalAlign: "top" };
const smallTextStyle: React.CSSProperties = { fontSize: "12px", color: "#6b7280" };
const summaryRowStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: "12px", borderBottom: "1px solid #e5e7eb", padding: "8px 0" };
