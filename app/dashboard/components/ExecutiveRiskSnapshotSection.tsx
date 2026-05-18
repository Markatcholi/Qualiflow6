"use client";

import { DashboardSection, KpiCard, getStatusColor, gridStyle } from "./DashboardComponents";

export default function ExecutiveRiskSnapshotSection({
  totalHighPriorityAlerts,
  capaOverdue,
  oosProductImpact,
  oosSystemicIssues,
  findingOpen,
  criticalFindings,
  majorFindings,
}: {
  totalHighPriorityAlerts: number;
  capaOverdue: number;
  oosProductImpact: number;
  oosSystemicIssues: number;
  findingOpen: number;
  criticalFindings: number;
  majorFindings: number;
}) {
  return (
    <DashboardSection title="Executive Risk Snapshot">
      <div style={gridStyle}>
        <KpiCard title="Active Alerts" value={totalHighPriorityAlerts} color={getStatusColor(totalHighPriorityAlerts)} />
        <KpiCard title="Overdue CAPAs" value={capaOverdue} color={getStatusColor(capaOverdue)} />
        <KpiCard title="OOS/OOT Product Impact" value={oosProductImpact} color={getStatusColor(oosProductImpact)} />
        <KpiCard title="OOS/OOT Systemic Issues" value={oosSystemicIssues} color={getStatusColor(oosSystemicIssues)} />
        <KpiCard title="Open Audit Findings" value={findingOpen} color={getStatusColor(findingOpen, "warning")} />
        <KpiCard title="Critical / Major Findings" value={criticalFindings + majorFindings} color={getStatusColor(criticalFindings + majorFindings)} />
      </div>
    </DashboardSection>
  );
}
