"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type Complaint = {
  id: string;
  complaint_number: string | null;
  complaint_title: string;
  complaint_description?: string | null;
  date_received: string | null;
  source: string | null;
  customer_name: string | null;
  customer_organization: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  country?: string | null;
  product_family?: string | null;
  product_name: string | null;
  part_number: string | null;
  lot_number: string | null;
  serial_number?: string | null;
  severity: string | null;
  potential_patient_impact: boolean | null;
  potential_safety_issue: boolean | null;
  status: string | null;
  investigator?: string | null;
  investigation_summary?: string | null;
  complaint_confirmed?: boolean | null;
  root_cause_category?: string | null;
  root_cause_summary?: string | null;
  mdr_assessment_required: boolean | null;
  regulatory_assessment: string | null;
  regulatory_assessment_rationale?: string | null;
  complaint_valid?: boolean | null;
  ncmr_required: boolean | null;
  capa_required: boolean | null;
  scar_required: boolean | null;
  change_control_required: boolean | null;
  customer_response_required?: boolean | null;
  customer_response_sent?: boolean | null;
  customer_response_date?: string | null;
  closure_summary?: string | null;
  closed_by?: string | null;
  closed_at: string | null;
  created_at: string | null;
};

type KpiTile = {
  title: string;
  value: number | string;
  color: string;
  suffix?: string;
  target?: string;
  statusLabel?: string;
  statusIcon?: string;
  statusColor?: string;
};

export default function ComplaintIntelligenceDashboardPage() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchComplaints = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("complaints")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setComplaints((data as Complaint[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchComplaints();
  }, []);

  const daysBetween = (start?: string | null, end?: string | null) => {
    if (!start || !end) return null;

    const startDate = new Date(start);
    const endDate = new Date(end);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return null;
    }

    return (
      (endDate.getTime() - startDate.getTime()) /
      (1000 * 60 * 60 * 24)
    );
  };

  const firstAvailableDate = (record: Complaint, fields: string[]) => {
    for (const field of fields) {
      const value = (record as any)[field];
      if (value) return String(value);
    }

    return null;
  };

  const percentWithinTarget = ({
    records,
    startFields,
    endFields,
    targetDays,
  }: {
    records: Complaint[];
    startFields: string[];
    endFields: string[];
    targetDays: number;
  }) => {
    const eligible = records
      .map((record) => {
        const start = firstAvailableDate(record, startFields);
        const end = firstAvailableDate(record, endFields);
        return daysBetween(start, end);
      })
      .filter((duration): duration is number => duration !== null && duration >= 0);

    if (eligible.length === 0) return 0;

    const withinTarget = eligible.filter((duration) => duration <= targetDays);
    return Number(((withinTarget.length / eligible.length) * 100).toFixed(1));
  };

  const averageDuration = ({
    records,
    startFields,
    endFields,
  }: {
    records: Complaint[];
    startFields: string[];
    endFields: string[];
  }) => {
    const durations = records
      .map((record) => {
        const start = firstAvailableDate(record, startFields);
        const end = firstAvailableDate(record, endFields);
        return daysBetween(start, end);
      })
      .filter((duration): duration is number => duration !== null && duration >= 0);

    if (durations.length === 0) return 0;

    return Number(
      (durations.reduce((sum, duration) => sum + duration, 0) / durations.length).toFixed(1),
    );
  };

  const getSlaStatus = (value: number) => {
    if (value >= 90) {
      return {
        label: "On Target",
        color: "#15803d",
        icon: "🟢",
      };
    }

    if (value >= 75) {
      return {
        label: "At Risk",
        color: "#d97706",
        icon: "🟡",
      };
    }

    return {
      label: "Action Required",
      color: "#dc2626",
      icon: "🔴",
    };
  };

  const metrics = useMemo(() => {
    const today = new Date().toISOString();

    const openComplaints = complaints.filter(
      (complaint) =>
        String(complaint.status || "").toLowerCase() !== "closed" &&
        String(complaint.status || "").toLowerCase() !== "cancelled",
    );

    const closedComplaints = complaints.filter(
      (complaint) => String(complaint.status || "").toLowerCase() === "closed",
    );

    const criticalComplaints = complaints.filter(
      (complaint) => String(complaint.severity || "").toLowerCase() === "critical",
    );

    const majorComplaints = complaints.filter(
      (complaint) => String(complaint.severity || "").toLowerCase() === "major",
    );

    const reportableComplaints = complaints.filter(
      (complaint) =>
        String(complaint.regulatory_assessment || "").toLowerCase() === "reportable",
    );

    const reportableOrPending = complaints.filter(
      (complaint) =>
        Boolean(complaint.mdr_assessment_required) ||
        String(complaint.regulatory_assessment || "").toLowerCase() === "reportable" ||
        String(complaint.regulatory_assessment || "").toLowerCase() === "pending",
    );

    const safetyComplaints = complaints.filter(
      (complaint) =>
        Boolean(complaint.potential_patient_impact) ||
        Boolean(complaint.potential_safety_issue),
    );

    const capaTriggered = complaints.filter((complaint) => Boolean(complaint.capa_required));
    const ncmrTriggered = complaints.filter((complaint) => Boolean(complaint.ncmr_required));
    const scarTriggered = complaints.filter((complaint) => Boolean(complaint.scar_required));
    const changeTriggered = complaints.filter((complaint) =>
      Boolean(complaint.change_control_required),
    );

    const customerResponseRequired = complaints.filter((complaint) =>
      Boolean(complaint.customer_response_required),
    );

    const customerResponseNotSent = complaints.filter(
      (complaint) =>
        Boolean(complaint.customer_response_required) &&
        !Boolean(complaint.customer_response_sent),
    );

    const openAges = openComplaints
      .map((complaint) =>
        daysBetween(complaint.created_at || complaint.date_received, today),
      )
      .filter((age): age is number => age !== null && age >= 0);

    const averageOpenAge =
      openAges.length > 0
        ? Number((openAges.reduce((sum, age) => sum + age, 0) / openAges.length).toFixed(1))
        : 0;

    const oldestOpenAge = openAges.length > 0 ? Number(Math.max(...openAges).toFixed(1)) : 0;

    const overdueComplaints = openComplaints.filter((complaint) => {
      const age = daysBetween(complaint.created_at || complaint.date_received, today);
      return age !== null && age > 30;
    });

    const closureWithin30 = percentWithinTarget({
      records: closedComplaints,
      startFields: ["date_received", "created_at"],
      endFields: ["closed_at"],
      targetDays: 30,
    });

    const averageClosureTime = averageDuration({
      records: closedComplaints,
      startFields: ["date_received", "created_at"],
      endFields: ["closed_at"],
    });

    const investigationCompleted = complaints.filter(
      (complaint) =>
        Boolean(complaint.investigation_summary) ||
        Boolean(complaint.root_cause_summary) ||
        complaint.complaint_confirmed !== null,
    );

    const investigationCompletionRate =
      complaints.length > 0
        ? Number(((investigationCompleted.length / complaints.length) * 100).toFixed(1))
        : 0;

    const escalationRate =
      complaints.length > 0
        ? Number(
            (
              ((capaTriggered.length +
                ncmrTriggered.length +
                scarTriggered.length +
                changeTriggered.length) /
                complaints.length) *
              100
            ).toFixed(1),
          )
        : 0;

    const reportabilityRate =
      complaints.length > 0
        ? Number(((reportableComplaints.length / complaints.length) * 100).toFixed(1))
        : 0;

    const currentMonth = new Date().toISOString().slice(0, 7);
    const receivedThisMonth = complaints.filter((complaint) =>
      String(complaint.date_received || complaint.created_at || "").startsWith(currentMonth),
    );

    return {
      openComplaints,
      closedComplaints,
      criticalComplaints,
      majorComplaints,
      reportableComplaints,
      reportableOrPending,
      safetyComplaints,
      capaTriggered,
      ncmrTriggered,
      scarTriggered,
      changeTriggered,
      customerResponseRequired,
      customerResponseNotSent,
      overdueComplaints,
      averageOpenAge,
      oldestOpenAge,
      closureWithin30,
      averageClosureTime,
      investigationCompletionRate,
      escalationRate,
      reportabilityRate,
      receivedThisMonth,
    };
  }, [complaints]);

  const closureStatus = getSlaStatus(metrics.closureWithin30);
  const investigationStatus = getSlaStatus(metrics.investigationCompletionRate);

  const kpis: KpiTile[] = [
    {
      title: "Closure ≤ 30 Days",
      value: metrics.closureWithin30,
      suffix: "%",
      color: closureStatus.color,
      target: "Target: 90%",
      statusLabel: closureStatus.label,
      statusIcon: closureStatus.icon,
      statusColor: closureStatus.color,
    },
    {
      title: "Investigation Complete",
      value: metrics.investigationCompletionRate,
      suffix: "%",
      color: investigationStatus.color,
      target: "Target: 90%",
      statusLabel: investigationStatus.label,
      statusIcon: investigationStatus.icon,
      statusColor: investigationStatus.color,
    },
    {
      title: "Open Complaints",
      value: metrics.openComplaints.length,
      color: "#2563eb",
    },
    {
      title: "Overdue >30 Days",
      value: metrics.overdueComplaints.length,
      color: metrics.overdueComplaints.length > 0 ? "#dc2626" : "#15803d",
    },
    {
      title: "Critical Complaints",
      value: metrics.criticalComplaints.length,
      color: metrics.criticalComplaints.length > 0 ? "#dc2626" : "#15803d",
    },
    {
      title: "Reportable / Pending",
      value: metrics.reportableOrPending.length,
      color: metrics.reportableOrPending.length > 0 ? "#d97706" : "#15803d",
    },
    {
      title: "Avg Open Age",
      value: metrics.averageOpenAge,
      suffix: " days",
      color: metrics.averageOpenAge > 30 ? "#dc2626" : "#2563eb",
    },
    {
      title: "Avg Closure Time",
      value: metrics.averageClosureTime,
      suffix: " days",
      color: metrics.averageClosureTime > 30 ? "#dc2626" : "#15803d",
    },
    {
      title: "Escalation Rate",
      value: metrics.escalationRate,
      suffix: "%",
      color: metrics.escalationRate > 25 ? "#d97706" : "#2563eb",
    },
    {
      title: "Reportability Rate",
      value: metrics.reportabilityRate,
      suffix: "%",
      color: metrics.reportabilityRate > 10 ? "#d97706" : "#2563eb",
    },
    {
      title: "Received This Month",
      value: metrics.receivedThisMonth.length,
      color: "#2563eb",
    },
  ];

  const severityCounts = useMemo(
    () => buildCounts(complaints, ["severity"]),
    [complaints],
  );

  const statusCounts = useMemo(
    () => buildCounts(complaints, ["status"]),
    [complaints],
  );

  const sourceCounts = useMemo(
    () => buildCounts(complaints, ["source"]),
    [complaints],
  );

  const productCounts = useMemo(
    () => buildCounts(complaints, ["product_name", "product_family", "part_number"]),
    [complaints],
  );

  const customerCounts = useMemo(
    () => buildCounts(complaints, ["customer_organization", "customer_name"]),
    [complaints],
  );

  const rootCauseCounts = useMemo(
    () => buildCounts(complaints, ["root_cause_category"]),
    [complaints],
  );

  const agingBuckets = useMemo(() => {
    const today = new Date().toISOString();
    const buckets = {
      "0–15 Days": 0,
      "16–30 Days": 0,
      "31–60 Days": 0,
      ">60 Days": 0,
    };

    metrics.openComplaints.forEach((complaint) => {
      const age =
        daysBetween(complaint.created_at || complaint.date_received, today) || 0;

      if (age <= 15) buckets["0–15 Days"] += 1;
      else if (age <= 30) buckets["16–30 Days"] += 1;
      else if (age <= 60) buckets["31–60 Days"] += 1;
      else buckets[">60 Days"] += 1;
    });

    return Object.entries(buckets);
  }, [metrics.openComplaints]);

  if (loading) {
    return <main style={pageStyle}>Loading Complaint Intelligence...</main>;
  }

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>ENTERPRISE QUALITY COMMAND CENTER</div>
          <h1 style={{ margin: "6px 0" }}>Complaint Intelligence Dashboard</h1>
          <p style={subtleText}>
            Executive operational intelligence for complaint volume, closure
            performance, product signals, customer signals, reportability,
            safety exposure, escalation, and quality system linkage.
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
        {kpis.map((kpi) => (
          <KpiCard
            key={kpi.title}
            title={kpi.title}
            value={kpi.value}
            suffix={kpi.suffix}
            color={kpi.color}
            target={kpi.target}
            statusLabel={kpi.statusLabel}
            statusIcon={kpi.statusIcon}
            statusColor={kpi.statusColor}
          />
        ))}
      </section>

      <section style={slaPanelStyle}>
        <div>
          <div style={eyebrowStyle}>COMPLAINT PROCESS PERFORMANCE</div>
          <h2 style={{ margin: "6px 0" }}>Timeliness & Regulatory Readiness</h2>
          <p style={subtleText}>
            Tracks complaint aging, closure performance, investigation completion,
            customer response exposure, and regulatory assessment readiness.
          </p>
        </div>

        <div style={slaSummaryGridStyle}>
          <KpiCard
            title="Oldest Open Complaint"
            value={metrics.oldestOpenAge}
            suffix=" days"
            color={metrics.oldestOpenAge > 30 ? "#dc2626" : "#15803d"}
          />
          <KpiCard
            title="Customer Response Needed"
            value={metrics.customerResponseRequired.length}
            color={metrics.customerResponseRequired.length > 0 ? "#d97706" : "#15803d"}
          />
          <KpiCard
            title="Response Not Sent"
            value={metrics.customerResponseNotSent.length}
            color={metrics.customerResponseNotSent.length > 0 ? "#dc2626" : "#15803d"}
          />
          <KpiCard
            title="Total Complaints"
            value={complaints.length}
            color="#2563eb"
          />
        </div>

        <div style={slaGridStyle}>
          <section style={cardStyle}>
            <h3 style={{ marginTop: 0 }}>Open Complaint Aging Buckets</h3>
            {agingBuckets.map(([label, value]) => (
              <BarRow
                key={label}
                label={label}
                value={value}
                max={Math.max(metrics.openComplaints.length, 1)}
              />
            ))}
          </section>

          <section style={cardStyle}>
            <h3 style={{ marginTop: 0 }}>Regulatory Intelligence</h3>
            <MetricRow label="Reportable Complaints" value={metrics.reportableComplaints.length} />
            <MetricRow label="Reportable / Pending" value={metrics.reportableOrPending.length} />
            <MetricRow label="Safety / Patient Impact" value={metrics.safetyComplaints.length} />
            <MetricRow label="MDR Assessment Required" value={complaints.filter((c) => c.mdr_assessment_required).length} />
          </section>

          <section style={cardStyle}>
            <h3 style={{ marginTop: 0 }}>Severity Intelligence</h3>
            {severityCounts.length === 0 ? (
              <p style={subtleText}>No severity data available.</p>
            ) : (
              severityCounts.map(([label, count]) => (
                <BarRow
                  key={label}
                  label={label}
                  value={count}
                  max={severityCounts[0]?.[1] || 1}
                />
              ))
            )}
          </section>
        </div>
      </section>

      <section style={escalationPanelStyle}>
        <div>
          <div style={eyebrowStyle}>EXECUTIVE ESCALATION ENGINE</div>
          <h2 style={{ margin: "6px 0" }}>Action Required</h2>
          <p style={subtleText}>
            Prioritized complaint signals requiring quality leadership attention,
            regulatory assessment, customer response, escalation, or governance action.
          </p>
        </div>

        <div style={escalationGridStyle}>
          <EscalationCard
            title="Overdue Complaints"
            count={metrics.overdueComplaints.length}
            severity={metrics.overdueComplaints.length > 0 ? "high" : "controlled"}
            items={metrics.overdueComplaints}
            description="Open complaints greater than 30 days old."
          />

          <EscalationCard
            title="Critical Complaints"
            count={metrics.criticalComplaints.length}
            severity={metrics.criticalComplaints.length > 0 ? "high" : "controlled"}
            items={metrics.criticalComplaints}
            description="Critical severity complaints."
          />

          <EscalationCard
            title="Safety / Patient Impact"
            count={metrics.safetyComplaints.length}
            severity={metrics.safetyComplaints.length > 0 ? "high" : "controlled"}
            items={metrics.safetyComplaints}
            description="Complaints with potential patient impact or safety issue."
          />

          <EscalationCard
            title="Reportable / Pending"
            count={metrics.reportableOrPending.length}
            severity={metrics.reportableOrPending.length > 0 ? "medium" : "controlled"}
            items={metrics.reportableOrPending}
            description="Complaints requiring reportability assessment or action."
          />

          <EscalationCard
            title="CAPA Triggered"
            count={metrics.capaTriggered.length}
            severity={metrics.capaTriggered.length > 0 ? "medium" : "controlled"}
            items={metrics.capaTriggered}
            description="Complaints escalated to CAPA."
          />

          <EscalationCard
            title="NCMR Triggered"
            count={metrics.ncmrTriggered.length}
            severity={metrics.ncmrTriggered.length > 0 ? "medium" : "controlled"}
            items={metrics.ncmrTriggered}
            description="Complaints linked to NCMR activity."
          />

          <EscalationCard
            title="SCAR Triggered"
            count={metrics.scarTriggered.length}
            severity={metrics.scarTriggered.length > 0 ? "medium" : "controlled"}
            items={metrics.scarTriggered}
            description="Complaints escalated to supplier corrective action."
          />

          <EscalationCard
            title="Customer Response Not Sent"
            count={metrics.customerResponseNotSent.length}
            severity={metrics.customerResponseNotSent.length > 0 ? "medium" : "controlled"}
            items={metrics.customerResponseNotSent}
            description="Required customer responses that have not been sent."
          />
        </div>
      </section>

      <div style={dashboardGridStyle}>
        <section style={cardStyle}>
          <h2>Product Intelligence</h2>
          {productCounts.length === 0 ? (
            <p style={subtleText}>No product data available.</p>
          ) : (
            productCounts.map(([label, count]) => (
              <BarRow
                key={label}
                label={label}
                value={count}
                max={productCounts[0]?.[1] || 1}
              />
            ))
          )}
        </section>

        <section style={cardStyle}>
          <h2>Customer Intelligence</h2>
          {customerCounts.length === 0 ? (
            <p style={subtleText}>No customer data available.</p>
          ) : (
            customerCounts.map(([label, count]) => (
              <BarRow
                key={label}
                label={label}
                value={count}
                max={customerCounts[0]?.[1] || 1}
              />
            ))
          )}
        </section>

        <section style={cardStyle}>
          <h2>Source Intelligence</h2>
          {sourceCounts.length === 0 ? (
            <p style={subtleText}>No source data available.</p>
          ) : (
            sourceCounts.map(([label, count]) => (
              <BarRow
                key={label}
                label={label}
                value={count}
                max={sourceCounts[0]?.[1] || 1}
              />
            ))
          )}
        </section>

        <section style={cardStyle}>
          <h2>Status Intelligence</h2>
          {statusCounts.length === 0 ? (
            <p style={subtleText}>No status data available.</p>
          ) : (
            statusCounts.map(([label, count]) => (
              <BarRow
                key={label}
                label={label}
                value={count}
                max={statusCounts[0]?.[1] || 1}
              />
            ))
          )}
        </section>

        <section style={cardStyle}>
          <h2>Root Cause Intelligence</h2>
          {rootCauseCounts.length === 0 ? (
            <p style={subtleText}>No root cause data available.</p>
          ) : (
            rootCauseCounts.map(([label, count]) => (
              <BarRow
                key={label}
                label={label}
                value={count}
                max={rootCauseCounts[0]?.[1] || 1}
              />
            ))
          )}
        </section>

        <section style={cardStyle}>
          <h2>Escalation Metrics</h2>
          <MetricRow label="CAPA Triggered" value={metrics.capaTriggered.length} />
          <MetricRow label="NCMR Triggered" value={metrics.ncmrTriggered.length} />
          <MetricRow label="SCAR Triggered" value={metrics.scarTriggered.length} />
          <MetricRow label="Change Triggered" value={metrics.changeTriggered.length} />
          <MetricRow label="Escalation Rate" value={metrics.escalationRate} suffix="%" />
          <MetricRow label="Reportability Rate" value={metrics.reportabilityRate} suffix="%" />
        </section>

        <section style={cardStyle}>
          <h2>Recent Complaints</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Complaint</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Severity</th>
                  <th style={thStyle}>Product</th>
                </tr>
              </thead>
              <tbody>
                {complaints.slice(0, 10).map((complaint) => (
                  <tr key={complaint.id}>
                    <td style={tdStyle}>
                      <Link href={`/complaints/${complaint.id}`}>
                        {complaint.complaint_number ||
                          complaint.complaint_title ||
                          complaint.id}
                      </Link>
                    </td>
                    <td style={tdStyle}>{complaint.status || "N/A"}</td>
                    <td style={tdStyle}>{complaint.severity || "N/A"}</td>
                    <td style={tdStyle}>{complaint.product_name || "N/A"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function buildCounts(records: Complaint[], fields: string[]) {
  const counts: Record<string, number> = {};

  records.forEach((record) => {
    let value = "Unspecified";

    for (const field of fields) {
      const candidate = (record as any)[field];

      if (candidate) {
        value = String(candidate);
        break;
      }
    }

    counts[value] = (counts[value] || 0) + 1;
  });

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
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
  items: Complaint[];
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
          items.slice(0, 5).map((item) => (
            <div key={item.id} style={escalationItemStyle}>
              <Link href={`/complaints/${item.id}`} style={{ fontWeight: 700 }}>
                {item.complaint_number || item.complaint_title || item.id}
              </Link>
              <div style={smallMutedStyle}>
                {item.complaint_title || "Untitled Complaint"} | Product:{" "}
                {item.product_name || "N/A"} | Status: {item.status || "N/A"}
              </div>
            </div>
          ))
        )}

        {items.length > 5 ? (
          <div style={{ ...smallMutedStyle, marginTop: "8px" }}>
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
  value: number | string;
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

      <div style={{ fontSize: "34px", fontWeight: 800, color }}>
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

function MetricRow({
  label,
  value,
  suffix = "",
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <div style={metricRowStyle}>
      <span>{label}</span>
      <strong>
        {value}
        {suffix}
      </strong>
    </div>
  );
}

function BarRow({ label, value, max }: { label: string; value: number; max: number }) {
  const width = max === 0 ? 0 : (value / max) * 100;

  return (
    <div style={{ marginBottom: "14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
        <span>{formatLabel(label)}</span>
        <strong>{value}</strong>
      </div>
      <div style={{ background: "#e5e7eb", height: "10px", borderRadius: "999px" }}>
        <div style={{ width: `${width}%`, background: "#2563eb", height: "10px", borderRadius: "999px" }} />
      </div>
    </div>
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
  alignItems: "flex-start",
  gap: "16px",
  flexWrap: "wrap",
  marginBottom: "24px",
};

const eyebrowStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 800,
  color: "#6b7280",
  letterSpacing: "0.08em",
};

const subtleText: React.CSSProperties = {
  color: "#6b7280",
};

const buttonRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
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

const kpiGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "18px",
  marginBottom: "24px",
};

const kpiCardStyle: React.CSSProperties = {
  background: "white",
  borderRadius: "16px",
  padding: "20px",
  border: "1px solid #d1d5db",
};

const kpiTitleStyle: React.CSSProperties = {
  color: "#6b7280",
  marginBottom: "10px",
};

const kpiTargetStyle: React.CSSProperties = {
  color: "#6b7280",
  fontSize: "13px",
  marginTop: "8px",
  fontWeight: 700,
};

const kpiStatusStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  border: "1px solid",
  borderRadius: "999px",
  padding: "4px 10px",
  fontSize: "12px",
  fontWeight: 800,
  marginTop: "8px",
};

const slaPanelStyle: React.CSSProperties = {
  background: "white",
  borderRadius: "16px",
  padding: "22px",
  border: "1px solid #d1d5db",
  marginBottom: "24px",
};

const slaSummaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "18px",
  marginTop: "18px",
  marginBottom: "20px",
};

const slaGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: "16px",
  marginTop: "18px",
};

const escalationPanelStyle: React.CSSProperties = {
  background: "white",
  borderRadius: "16px",
  padding: "22px",
  border: "1px solid #d1d5db",
  marginBottom: "24px",
};

const escalationGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: "16px",
  marginTop: "18px",
};

const escalationCardStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: "14px",
  padding: "16px",
  background: "#f9fafb",
};

const escalationItemStyle: React.CSSProperties = {
  borderTop: "1px solid #e5e7eb",
  paddingTop: "10px",
  marginTop: "10px",
};

const smallMutedStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#6b7280",
  marginTop: "4px",
};

const dashboardGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
  gap: "20px",
};

const cardStyle: React.CSSProperties = {
  background: "white",
  borderRadius: "16px",
  padding: "20px",
  border: "1px solid #d1d5db",
};

const metricRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  marginBottom: "10px",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};

const thStyle: React.CSSProperties = {
  borderBottom: "1px solid #d1d5db",
  textAlign: "left",
  padding: "10px",
};

const tdStyle: React.CSSProperties = {
  borderBottom: "1px solid #e5e7eb",
  padding: "10px",
};
