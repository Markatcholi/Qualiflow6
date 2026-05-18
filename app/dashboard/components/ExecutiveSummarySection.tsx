"use client";

import { DashboardSection, KpiCard, getStatusColor, gridStyle } from "./DashboardComponents";

export default function ExecutiveSummarySection({
  executiveHealth,
  executiveRiskScore,
  totalOpenQualityItems,
  totalRiskEvents,
  overallClosureRate,
}: {
  executiveHealth: string;
  executiveRiskScore: number;
  totalOpenQualityItems: number;
  totalRiskEvents: number;
  overallClosureRate: string;
}) {
  return (
    <DashboardSection title="Executive Summary">
      <div style={gridStyle}>
        <KpiCard title="Quality Health" value={executiveHealth} color={getStatusColor(executiveRiskScore)} subtitle={`Risk score: ${executiveRiskScore}`} />
        <KpiCard title="Total Open Quality Items" value={totalOpenQualityItems} color={getStatusColor(totalOpenQualityItems, "warning")} />
        <KpiCard title="Total Risk Events" value={totalRiskEvents} color={getStatusColor(totalRiskEvents)} />
        <KpiCard title="Overall Closure Rate" value={`${overallClosureRate}%`} color="#2563eb" />
      </div>
    </DashboardSection>
  );
}
