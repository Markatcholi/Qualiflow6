"use client";
import { DashboardSection, KpiCard, TrendChart, TrendItem, getStatusColor, gridStyle } from "./DashboardComponents";

export default function NcmrPerformanceSection(props: {
  ncmrTotal: number; ncmrOpen: number; ncmrInvestigation: number; ncmrClosed: number;
  ncmrClosureRate: string; avgNcmrCloseDays: string; ncmrTrend: TrendItem[];
}) {
  const { ncmrTotal, ncmrOpen, ncmrInvestigation, ncmrClosed, ncmrClosureRate, avgNcmrCloseDays, ncmrTrend } = props;
  return (
    <DashboardSection title="NCMR Performance">
      <div style={gridStyle}>
        <KpiCard title="Total NCMRs" value={ncmrTotal} color="#2563eb" />
        <KpiCard title="Open NCMRs" value={ncmrOpen} color={getStatusColor(ncmrOpen, "warning")} />
        <KpiCard title="In Investigation" value={ncmrInvestigation} color={getStatusColor(ncmrInvestigation, "warning")} />
        <KpiCard title="Closed NCMRs" value={ncmrClosed} color="#15803d" />
        <KpiCard title="Closure Rate" value={`${ncmrClosureRate}%`} color="#2563eb" />
        <KpiCard title="Avg Close Time" value={`${avgNcmrCloseDays} d`} color="#374151" />
      </div>
      <TrendChart title="NCMR Monthly Trend (Last 6 Months)" data={ncmrTrend} />
    </DashboardSection>
  );
}
