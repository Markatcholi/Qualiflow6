"use client";
import { DashboardSection, KpiCard, TrendChart, TrendItem, getStatusColor, gridStyle } from "./DashboardComponents";

export default function CapaPerformanceSection(props: {
  capaTotal: number; capaOpen: number; capaClosed: number; capaClosureRate: string;
  capaOverdue: number; capaOverdueRate: string; capaDueSoon: number;
  capaAwaitingEffectiveness: number; capaEffectivenessOverdue: number; capaEffectivenessDueSoon: number;
  avgCapaCloseDays: string; capaTrend: TrendItem[];
}) {
  const p = props;
  return (
    <DashboardSection title="CAPA Performance">
      <div style={gridStyle}>
        <KpiCard title="Total CAPAs" value={p.capaTotal} color="#2563eb" />
        <KpiCard title="Active CAPAs" value={p.capaOpen} color={getStatusColor(p.capaOpen, "warning")} />
        <KpiCard title="Closed CAPAs" value={p.capaClosed} color="#15803d" />
        <KpiCard title="Closure Rate" value={`${p.capaClosureRate}%`} color="#2563eb" />
        <KpiCard title="Overdue CAPAs" value={p.capaOverdue} color={getStatusColor(p.capaOverdue)} />
        <KpiCard title="Overdue Rate" value={`${p.capaOverdueRate}%`} color={getStatusColor(p.capaOverdue)} />
        <KpiCard title="Due Next 7 Days" value={p.capaDueSoon} color={getStatusColor(p.capaDueSoon, "warning")} />
        <KpiCard title="Awaiting Effectiveness" value={p.capaAwaitingEffectiveness} color={getStatusColor(p.capaAwaitingEffectiveness, "warning")} />
        <KpiCard title="Effectiveness Overdue" value={p.capaEffectivenessOverdue} color={getStatusColor(p.capaEffectivenessOverdue)} />
        <KpiCard title="Effectiveness Due Soon" value={p.capaEffectivenessDueSoon} color={getStatusColor(p.capaEffectivenessDueSoon, "warning")} />
        <KpiCard title="Avg Close Time" value={`${p.avgCapaCloseDays} d`} color="#374151" />
      </div>
      <TrendChart title="CAPA Monthly Trend (Last 6 Months)" data={p.capaTrend} />
    </DashboardSection>
  );
}
