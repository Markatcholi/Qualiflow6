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
  effectiveness_result?: string | null;
  emergency_change?: boolean | null;
  is_emergency?: boolean | null;
  validation_required?: boolean | null;
  validation_status?: string | null;
  training_required?: boolean | null;
  training_status?: string | null;
  created_at: string | null;
  closed_at?: string | null;
  approved_at?: string | null;
  implemented_at?: string | null;
  implementation_completed_at?: string | null;
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

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setChanges((data as ChangeControl[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const daysBetween = (startDate?: string | null, endDate?: string | null) => {
    return daysBetweenStatic(startDate, endDate);
  };

  const averageDays = (items: number[]) => {
    if (items.length === 0) return 0;

    return Number(
      (items.reduce((sum, value) => sum + value, 0) / items.length).toFixed(1),
    );
  };

  const percentage = (numerator: number, denominator: number) => {
    if (denominator <= 0) return 0;

    return Number(((numerator / denominator) * 100).toFixed(1));
  };

  const getSlaStatus = (value: number) => {
    if (value >= 90) {
      return { label: "On Target", color: "#15803d", icon: "🟢" };
    }

    if (value >= 75) {
      return { label: "At Risk", color: "#d97706", icon: "🟡" };
    }

    return { label: "Action Required", color: "#dc2626", icon: "🔴" };
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

  const isEmergencyChange = (change: ChangeControl) =>
    Boolean(change.emergency_change) ||
    Boolean(change.is_emergency) ||
    change.priority === "Critical" ||
    change.change_type === "Emergency";

  const needsValidation = (change: ChangeControl) =>
    Boolean(change.validation_required) ||
    change.validation_status === "pending" ||
    change.validation_status === "required";

  const needsTraining = (change: ChangeControl) =>
    Boolean(change.training_required) ||
    change.training_status === "pending" ||
    change.training_status === "required";

  const metrics = useMemo(() => {
    const closedChanges = changes.filter((change) => change.status === "closed");
    const openChanges = changes.filter((change) => isOpen(change));

    const closedDays = closedChanges.map((change) =>
      daysBetween(change.created_at, change.closed_at),
    );

    const approvalDays = changes
      .filter((change) => change.approved_at)
      .map((change) => daysBetween(change.created_at, change.approved_at));

    const implementationDays = changes
      .filter(
        (change) =>
          change.approved_at &&
          (change.implemented_at || change.implementation_completed_at),
      )
      .map((change) =>
        daysBetween(
          change.approved_at,
          change.implemented_at || change.implementation_completed_at,
        ),
      );

    const closureWithin90 = percentage(
      closedDays.filter((days) => days <= 90).length,
      closedDays.length,
    );

    const closureStatus = getSlaStatus(closureWithin90);

    const oldestOpenChange =
      openChanges.length > 0
        ? Math.max(...openChanges.map((change) => daysBetween(change.created_at)))
        : 0;

    const effectiveChanges = changes.filter(
      (change) =>
        change.effectiveness_result === "effective" ||
        change.closure_decision === "accepted",
    );

    const notEffectiveChanges = changes.filter(
      (change) =>
        change.effectiveness_result === "not_effective" ||
        change.closure_decision === "rejected",
    );

    const effectivenessRate = percentage(
      effectiveChanges.length,
      effectiveChanges.length + notEffectiveChanges.length,
    );

    return {
      total: changes.length,
      open: openChanges.length,
      draft: changes.filter((change) => change.status === "draft").length,
      pending: changes.filter((change) => change.status === "pending_approval").length,
      approved: changes.filter((change) => change.status === "approved").length,
      implementation: changes.filter((change) => change.status === "implementation").length,
      verification: changes.filter((change) => change.status === "verification").length,
      closureApproval: changes.filter((change) => change.status === "closure_approval").length,
      closed: closedChanges.length,
      cancelled: changes.filter((change) => change.status === "cancelled").length,
      rejected: changes.filter((change) => change.status === "rejected").length,
      overdue: changes.filter((change) => isOverdue(change)).length,
      highRisk: changes.filter((change) => isHighRisk(change)).length,
      emergency: changes.filter((change) => isEmergencyChange(change)).length,
      pendingValidation: changes.filter((change) => isOpen(change) && needsValidation(change)).length,
      pendingTraining: changes.filter((change) => isOpen(change) && needsTraining(change)).length,
      averageClosureDays: averageDays(closedDays),
      averageApprovalDays: averageDays(approvalDays),
      averageImplementationDays: averageDays(implementationDays),
      closureWithin90,
      closureStatus,
      oldestOpenChange,
      effectiveChanges: effectiveChanges.length,
      notEffectiveChanges: notEffectiveChanges.length,
      effectivenessRate,
    };
  }, [changes]);

  const aging = useMemo(() => {
    const openChanges = changes.filter((change) => isOpen(change));

    return {
      zeroToThirty: openChanges.filter((change) => daysBetween(change.created_at) <= 30).length,
      thirtyOneToSixty: openChanges.filter((change) => {
        const days = daysBetween(change.created_at);
        return days >= 31 && days <= 60;
      }).length,
      sixtyOneToNinety: openChanges.filter((change) => {
        const days = daysBetween(change.created_at);
        return days >= 61 && days <= 90;
      }).length,
      overNinety: openChanges.filter((change) => daysBetween(change.created_at) > 90).length,
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

  const overdueChanges = useMemo(() => changes.filter((change) => isOverdue(change)), [changes]);

  const highRiskChanges = useMemo(
    () => changes.filter((change) => isOpen(change) && isHighRisk(change)),
    [changes],
  );

  const pendingApprovalChanges = useMemo(
    () => changes.filter((change) => change.status === "pending_approval"),
    [changes],
  );

  const implementationChanges = useMemo(
    () => changes.filter((change) => change.status === "implementation"),
    [changes],
  );

  const verificationChanges = useMemo(
    () => changes.filter((change) => change.status === "verification"),
    [changes],
  );

  const closureApprovalChanges = useMemo(
    () => changes.filter((change) => change.status === "closure_approval"),
    [changes],
  );

  const validationPendingChanges = useMemo(
    () => changes.filter((change) => isOpen(change) && needsValidation(change)),
    [changes],
  );

  const trainingPendingChanges = useMemo(
    () => changes.filter((change) => isOpen(change) && needsTraining(change)),
    [changes],
  );

  const monthlyTrend = useMemo(() => {
    const months = getLast6Months();
    const createdCounts: Record<string, number> = {};
    const closedCounts: Record<string, number> = {};
    const approvedCounts: Record<string, number> = {};

    months.forEach((month) => {
      createdCounts[month.key] = 0;
      closedCounts[month.key] = 0;
      approvedCounts[month.key] = 0;
    });

    changes.forEach((change) => {
      const createdKey = getMonthKey(change.created_at);
      const closedKey = getMonthKey(change.closed_at);
      const approvedKey = getMonthKey(change.approved_at);

      if (createdKey && createdCounts[createdKey] !== undefined) {
        createdCounts[createdKey] += 1;
      }

      if (closedKey && closedCounts[closedKey] !== undefined) {
        closedCounts[closedKey] += 1;
      }

      if (approvedKey && approvedCounts[approvedKey] !== undefined) {
        approvedCounts[approvedKey] += 1;
      }
    });

    return months.map((month) => ({
      label: month.label,
      created: createdCounts[month.key],
      closed: closedCounts[month.key],
      approved: approvedCounts[month.key],
    }));
  }, [changes]);

  if (loading) {
    return <main style={pageStyle}>Loading Change Control Intelligence...</main>;
  }

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>ENTERPRISE QUALITY COMMAND CENTER</div>
          <h1 style={{ margin: "6px 0" }}>Change Control Intelligence Dashboard</h1>
          <p style={subtleText}>
            Executive visibility into change status, aging, risk, closure
            performance, effectiveness, originating sources, and implementation
            governance.
          </p>
        </div>

        <div style={buttonRowStyle}>
          <a href="/change-control" style={darkButtonStyle}>
            Back to Change Register
          </a>
          <a href="/dashboard" style={secondaryButtonStyle}>
            Enterprise Dashboard
          </a>
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
        <KpiCard title="Overdue" value={metrics.overdue} color="#dc2626" />
        <KpiCard title="High/Critical Risk" value={metrics.highRisk} color="#dc2626" />
        <KpiCard title="Avg Days to Close" value={metrics.averageClosureDays} color="#111827" suffix=" days" />
        <KpiCard title="Closure ≤90 Days" value={metrics.closureWithin90} color={metrics.closureStatus.color} suffix="%" target="Target: 90%" statusLabel={metrics.closureStatus.label} statusIcon={metrics.closureStatus.icon} statusColor={metrics.closureStatus.color} />
        <KpiCard title="Oldest Open Change" value={metrics.oldestOpenChange} color={metrics.oldestOpenChange > 90 ? "#dc2626" : "#15803d"} suffix=" days" />
        <KpiCard title="Emergency Changes" value={metrics.emergency} color={metrics.emergency > 0 ? "#dc2626" : "#15803d"} />
        <KpiCard title="Effectiveness Rate" value={metrics.effectivenessRate} color={metrics.effectivenessRate >= 90 ? "#15803d" : "#d97706"} suffix="%" />
      </section>

      <section style={escalationPanelStyle}>
        <div>
          <div style={eyebrowStyle}>EXECUTIVE ESCALATION ENGINE</div>
          <h2 style={{ margin: "6px 0" }}>Action Required</h2>
          <p style={subtleText}>
            Prioritized change signals requiring leadership attention, approval
            follow-up, implementation control, validation, training, or closure
            governance.
          </p>
        </div>

        <div style={escalationGridStyle}>
          <EscalationCard title="Overdue Changes" count={overdueChanges.length} severity={overdueChanges.length > 0 ? "high" : "controlled"} items={overdueChanges} description="Open changes with past target dates or greater than 45 days open." />
          <EscalationCard title="High-Risk Changes" count={highRiskChanges.length} severity={highRiskChanges.length > 0 ? "high" : "controlled"} items={highRiskChanges} description="Open changes classified as high or critical risk." />
          <EscalationCard title="Pending Approval" count={pendingApprovalChanges.length} severity={pendingApprovalChanges.length > 0 ? "medium" : "controlled"} items={pendingApprovalChanges} description="Changes awaiting approval decision." />
          <EscalationCard title="Pending Implementation" count={implementationChanges.length} severity={implementationChanges.length > 0 ? "medium" : "controlled"} items={implementationChanges} description="Approved changes awaiting or undergoing implementation." />
          <EscalationCard title="Pending Verification" count={verificationChanges.length} severity={verificationChanges.length > 0 ? "medium" : "controlled"} items={verificationChanges} description="Implemented changes awaiting verification." />
          <EscalationCard title="Closure Approval" count={closureApprovalChanges.length} severity={closureApprovalChanges.length > 0 ? "medium" : "controlled"} items={closureApprovalChanges} description="Changes awaiting final closure approval." />
          <EscalationCard title="Validation Pending" count={validationPendingChanges.length} severity={validationPendingChanges.length > 0 ? "medium" : "controlled"} items={validationPendingChanges} description="Changes requiring validation completion or validation status review." />
          <EscalationCard title="Training Pending" count={trainingPendingChanges.length} severity={trainingPendingChanges.length > 0 ? "medium" : "controlled"} items={trainingPendingChanges} description="Changes requiring training completion or training status review." />
        </div>
      </section>

      <section style={cardStyle}>
        <div>
          <div style={eyebrowStyle}>CHANGE SLA INTELLIGENCE</div>
          <h2 style={{ margin: "6px 0" }}>Approval, Implementation, and Closure Performance</h2>
          <p style={subtleText}>
            Measures change control cycle time and timeliness against a 90-day
            closure target.
          </p>
        </div>

        <div style={kpiGridStyle}>
          <KpiCard title="Average Approval Time" value={metrics.averageApprovalDays} color={metrics.averageApprovalDays > 30 ? "#d97706" : "#15803d"} suffix=" days" />
          <KpiCard title="Average Implementation Time" value={metrics.averageImplementationDays} color={metrics.averageImplementationDays > 45 ? "#d97706" : "#15803d"} suffix=" days" />
          <KpiCard title="Average Closure Time" value={metrics.averageClosureDays} color={metrics.averageClosureDays > 90 ? "#dc2626" : "#15803d"} suffix=" days" />
          <KpiCard title="Pending Validation" value={metrics.pendingValidation} color={metrics.pendingValidation > 0 ? "#d97706" : "#15803d"} />
          <KpiCard title="Pending Training" value={metrics.pendingTraining} color={metrics.pendingTraining > 0 ? "#d97706" : "#15803d"} />
        </div>
      </section>

      <section style={cardStyle}>
        <div>
          <div style={eyebrowStyle}>CHANGE EFFECTIVENESS INTELLIGENCE</div>
          <h2 style={{ margin: "6px 0" }}>Effectiveness and Closure Decision Signals</h2>
          <p style={subtleText}>
            Monitors whether completed changes were accepted, rejected, or need
            additional follow-up.
          </p>
        </div>

        <div style={kpiGridStyle}>
          <KpiCard title="Effective / Accepted" value={metrics.effectiveChanges} color="#15803d" />
          <KpiCard title="Not Effective / Rejected" value={metrics.notEffectiveChanges} color={metrics.notEffectiveChanges > 0 ? "#dc2626" : "#15803d"} />
          <KpiCard title="Effectiveness Success Rate" value={metrics.effectivenessRate} color={metrics.effectivenessRate >= 90 ? "#15803d" : "#d97706"} suffix="%" />
        </div>
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
        <div>
          <div style={eyebrowStyle}>MANAGEMENT REVIEW TREND INTELLIGENCE</div>
          <h2 style={{ margin: "6px 0" }}>Monthly Change Activity</h2>
          <p style={subtleText}>
            Six-month view of created, approved, and closed change records.
          </p>
        </div>

        <div style={trendGridStyle}>
          <TrendCard title="Created Changes" data={monthlyTrend.map((item) => ({ label: item.label, value: item.created }))} />
          <TrendCard title="Approved Changes" data={monthlyTrend.map((item) => ({ label: item.label, value: item.approved }))} />
          <TrendCard title="Closed Changes" data={monthlyTrend.map((item) => ({ label: item.label, value: item.closed }))} />
        </div>
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
                <tr>
                  <td colSpan={6} style={tdStyle}>No overdue changes.</td>
                </tr>
              ) : (
                overdueChanges.slice(0, 10).map((change) => (
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function EscalationCard({
  title,
  count,
  severity,
  items,
  description,
}: {
  title: string;
  count: number;
  severity: "controlled" | "medium" | "high";
  items: ChangeControl[];
  description: string;
}) {
  const color =
    severity === "high"
      ? "#dc2626"
      : severity === "medium"
      ? "#d97706"
      : "#15803d";

  return (
    <div style={{ ...escalationCardStyle, borderLeft: `8px solid ${color}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "10px" }}>
        <div>
          <h3 style={{ margin: "0 0 4px 0" }}>{title}</h3>
          <p style={{ ...subtleText, margin: 0 }}>{description}</p>
        </div>

        <div style={{ fontSize: "30px", fontWeight: 800, color }}>{count}</div>
      </div>

      <div style={{ marginTop: "14px" }}>
        {items.length === 0 ? (
          <div style={{ color: "#15803d", fontWeight: 700 }}>
            No escalation required.
          </div>
        ) : (
          items.slice(0, 5).map((change) => (
            <div key={change.id} style={escalationItemStyle}>
              <a href={`/change-control/${change.id}`} style={{ fontWeight: 700 }}>
                {change.change_number || change.change_title || change.id}
              </a>
              <div style={smallTextStyle}>
                Status: {getStatusLabel(change.status || "draft")} | Owner:{" "}
                {change.owner_email || "N/A"} | Days Open:{" "}
                {change.status === "closed"
                  ? daysBetweenStatic(change.created_at, change.closed_at)
                  : daysBetweenStatic(change.created_at)}
              </div>
            </div>
          ))
        )}

        {items.length > 5 ? (
          <div style={{ ...smallTextStyle, marginTop: "8px" }}>
            + {items.length - 5} more
          </div>
        ) : null}
      </div>
    </div>
  );
}

function KpiCard({
  title,
  value,
  color,
  suffix = "",
  target,
  statusLabel,
  statusIcon,
  statusColor,
}: {
  title: string;
  value: number;
  color: string;
  suffix?: string;
  target?: string;
  statusLabel?: string;
  statusIcon?: string;
  statusColor?: string;
}) {
  return (
    <div style={{ ...kpiCardStyle, borderLeft: `8px solid ${color}` }}>
      <div style={kpiTitleStyle}>{title}</div>
      <div style={{ fontSize: "30px", fontWeight: 800, color }}>
        {value}
        {suffix}
      </div>
      {target ? <div style={kpiTargetStyle}>{target}</div> : null}
      {statusLabel ? (
        <div
          style={{
            ...kpiStatusStyle,
            color: statusColor || color,
            borderColor: statusColor || color,
            background: "#ffffff",
          }}
        >
          <span>{statusIcon}</span>
          <span>{statusLabel}</span>
        </div>
      ) : null}
    </div>
  );
}

function SummaryCard({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; count: number }[];
}) {
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

function TrendCard({
  title,
  data,
}: {
  title: string;
  data: { label: string; value: number }[];
}) {
  const max = Math.max(...data.map((item) => item.value), 1);

  return (
    <div style={cardStyle}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      {data.map((item) => {
        const width = item.value > 0 ? Math.max((item.value / max) * 100, 6) : 0;

        return (
          <div key={item.label} style={{ marginBottom: "12px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "13px",
                marginBottom: "4px",
              }}
            >
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>

            <div
              style={{
                height: "12px",
                background: "#e5e7eb",
                borderRadius: "999px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "12px",
                  width: `${width}%`,
                  background: "#2563eb",
                  borderRadius: "999px",
                }}
              />
            </div>
          </div>
        );
      })}
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

function daysBetweenStatic(startDate?: string | null, endDate?: string | null) {
  if (!startDate) return 0;

  const start = new Date(startDate).getTime();
  const end = endDate ? new Date(endDate).getTime() : new Date().getTime();

  if (Number.isNaN(start) || Number.isNaN(end)) return 0;

  return Math.max(0, Math.floor((end - start) / (1000 * 60 * 60 * 24)));
}

function getMonthKey(value?: string | null) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getLast6Months() {
  const months: { key: string; label: string }[] = [];
  const now = new Date();

  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const label = date.toLocaleString("en-US", {
      month: "short",
      year: "2-digit",
    });

    months.push({ key, label });
  }

  return months;
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
const kpiTargetStyle: React.CSSProperties = { color: "#6b7280", fontSize: "13px", marginTop: "8px", fontWeight: 700 };
const kpiStatusStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: "6px", border: "1px solid", borderRadius: "999px", padding: "4px 10px", fontSize: "12px", fontWeight: 800, marginTop: "8px" };
const escalationPanelStyle: React.CSSProperties = { background: "white", borderRadius: "16px", padding: "20px", border: "1px solid #d1d5db", marginBottom: "20px" };
const escalationGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px", marginTop: "18px" };
const escalationCardStyle: React.CSSProperties = { border: "1px solid #d1d5db", borderRadius: "14px", padding: "16px", background: "#f9fafb" };
const escalationItemStyle: React.CSSProperties = { borderTop: "1px solid #e5e7eb", paddingTop: "10px", marginTop: "10px" };
const trendGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px", marginTop: "16px" };
const darkButtonStyle: React.CSSProperties = { background: "#111827", color: "white", padding: "10px 14px", borderRadius: "8px", textDecoration: "none", fontWeight: 700 };
const secondaryButtonStyle: React.CSSProperties = { background: "#2563eb", color: "white", border: "none", padding: "10px 14px", borderRadius: "8px", fontWeight: 700, cursor: "pointer", textDecoration: "none", display: "inline-block" };
const primaryLinkStyle: React.CSSProperties = { background: "#2563eb", color: "white", padding: "8px 12px", borderRadius: "8px", textDecoration: "none", fontWeight: 700, display: "inline-block" };
const buttonRowStyle: React.CSSProperties = { display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center", marginTop: "12px" };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse" };
const thStyle: React.CSSProperties = { textAlign: "left", borderBottom: "1px solid #d1d5db", padding: "10px" };
const tdStyle: React.CSSProperties = { borderBottom: "1px solid #e5e7eb", padding: "10px", verticalAlign: "top" };
const smallTextStyle: React.CSSProperties = { fontSize: "12px", color: "#6b7280" };
const summaryRowStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: "12px", borderBottom: "1px solid #e5e7eb", padding: "8px 0" };
