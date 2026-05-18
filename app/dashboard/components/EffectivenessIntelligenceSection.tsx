"use client";

import { DashboardSection, KpiCard, getStatusColor, gridStyle } from "./DashboardComponents";

export default function EffectivenessIntelligenceSection({
  capaEffective,
  capaPartiallyEffective,
  capaNotEffective,
  capaEffectivenessRate,
  capaFollowupRequired,
  scarEffective,
  scarNotEffective,
  scarEffectivenessRate,
  scarAwaitingEffectiveness,
  supplierRecurrenceEvents,
}: {
  capaEffective: number;
  capaPartiallyEffective: number;
  capaNotEffective: number;
  capaEffectivenessRate: string;
  capaFollowupRequired: number;
  scarEffective: number;
  scarNotEffective: number;
  scarEffectivenessRate: string;
  scarAwaitingEffectiveness: number;
  supplierRecurrenceEvents: number;
}) {
  return (
    <DashboardSection title="CAPA & SCAR Effectiveness Intelligence">
      <div style={gridStyle}>
        <KpiCard title="CAPA Effectiveness Rate" value={`${capaEffectivenessRate}%`} color="#2563eb" />
        <KpiCard title="Effective CAPAs" value={capaEffective} color="#15803d" />
        <KpiCard title="Partially Effective CAPAs" value={capaPartiallyEffective} color={getStatusColor(capaPartiallyEffective, "warning")} />
        <KpiCard title="Not Effective CAPAs" value={capaNotEffective} color={getStatusColor(capaNotEffective)} />
        <KpiCard title="Follow-up CAPAs Required" value={capaFollowupRequired} color={getStatusColor(capaFollowupRequired)} />
        <KpiCard title="SCAR Effectiveness Rate" value={`${scarEffectivenessRate}%`} color="#2563eb" />
        <KpiCard title="Effective SCARs" value={scarEffective} color="#15803d" />
        <KpiCard title="Not Effective SCARs" value={scarNotEffective} color={getStatusColor(scarNotEffective)} />
        <KpiCard title="SCAR Awaiting Effectiveness" value={scarAwaitingEffectiveness} color={getStatusColor(scarAwaitingEffectiveness, "warning")} />
        <KpiCard title="Supplier Recurrence Events" value={supplierRecurrenceEvents} color={getStatusColor(supplierRecurrenceEvents)} />
      </div>
    </DashboardSection>
  );
}
