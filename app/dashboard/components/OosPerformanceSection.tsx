"use client";
import { DashboardSection, KpiCard, TrendChart, TrendItem, getStatusColor, gridStyle } from "./DashboardComponents";

export default function OosPerformanceSection(props: {
  oosTotal: number; oosOpen: number; oosClosed: number; oosClosureRate: string;
  oosProductImpact: number; oosNcmrRequired: number; oosSystemicIssues: number; oosEscalations: number; oosTrend: TrendItem[];
}) {
  const p = props;
  return (
    <DashboardSection title="OOS / OOT / Environmental Monitoring">
      <div style={gridStyle}>
        <KpiCard title="Total Investigations" value={p.oosTotal} color="#0f766e" />
        <KpiCard title="Open Investigations" value={p.oosOpen} color={getStatusColor(p.oosOpen, "warning")} />
        <KpiCard title="Closed Investigations" value={p.oosClosed} color="#15803d" />
        <KpiCard title="Closure Rate" value={`${p.oosClosureRate}%`} color="#0f766e" />
        <KpiCard title="Product Impact" value={p.oosProductImpact} color={getStatusColor(p.oosProductImpact)} />
        <KpiCard title="NCMR Required" value={p.oosNcmrRequired} color={getStatusColor(p.oosNcmrRequired)} />
        <KpiCard title="Systemic Issues" value={p.oosSystemicIssues} color={getStatusColor(p.oosSystemicIssues)} />
        <KpiCard title="Escalations" value={p.oosEscalations} color={getStatusColor(p.oosEscalations)} />
      </div>
      <TrendChart title="OOS/OOT Monthly Trend (Last 6 Months)" data={p.oosTrend} />
    </DashboardSection>
  );
}
