"use client";
import { DashboardSection, KpiCard, TrendChart, TrendItem, getStatusColor, gridStyle } from "./DashboardComponents";

export default function AuditPerformanceSection(props: {
  auditTotal: number; auditOpen: number; auditClosed: number; auditClosureRate: string; auditOverdue: number;
  findingTotal: number; findingOpen: number; findingClosureRate: string; majorFindings: number; criticalFindings: number;
  findingsRequiringCapa: number; auditTrend: TrendItem[]; findingTrend: TrendItem[];
}) {
  const p = props;
  return (
    <DashboardSection title="Audit Performance">
      <div style={gridStyle}>
        <KpiCard title="Total Audits" value={p.auditTotal} color="#2563eb" />
        <KpiCard title="Open Audits" value={p.auditOpen} color={getStatusColor(p.auditOpen, "warning")} />
        <KpiCard title="Closed Audits" value={p.auditClosed} color="#15803d" />
        <KpiCard title="Audit Closure Rate" value={`${p.auditClosureRate}%`} color="#2563eb" />
        <KpiCard title="Overdue / Past Due Audits" value={p.auditOverdue} color={getStatusColor(p.auditOverdue)} />
        <KpiCard title="Total Findings" value={p.findingTotal} color="#374151" />
        <KpiCard title="Open Findings" value={p.findingOpen} color={getStatusColor(p.findingOpen, "warning")} />
        <KpiCard title="Findings Closure Rate" value={`${p.findingClosureRate}%`} color="#2563eb" />
        <KpiCard title="Major Findings" value={p.majorFindings} color={getStatusColor(p.majorFindings)} />
        <KpiCard title="Critical Findings" value={p.criticalFindings} color={getStatusColor(p.criticalFindings)} />
        <KpiCard title="Findings Requiring CAPA" value={p.findingsRequiringCapa} color={getStatusColor(p.findingsRequiringCapa, "warning")} />
      </div>
      <TrendChart title="Audit Monthly Trend (Last 6 Months)" data={p.auditTrend} />
      <div style={{ marginTop: "14px" }}>
        <TrendChart title="Audit Finding Monthly Trend (Last 6 Months)" data={p.findingTrend} />
      </div>
    </DashboardSection>
  );
}
