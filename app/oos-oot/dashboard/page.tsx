"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type Investigation = {
  id: string;
  investigation_number: string | null;
  investigation_source: string | null;
  event_type: string | null;
  test_name: string | null;
  test_method?: string | null;
  area_room_equipment: string | null;
  product_part_number: string | null;
  lot_batch_number: string | null;
  sample_id?: string | null;
  date_detected: string | null;
  detected_by?: string | null;
  observed_result: string | null;
  specification_limit: string | null;
  unit_of_measure?: string | null;
  product_affected?: boolean | null;
  material_on_hold?: boolean | null;
  room_equipment_impacted?: boolean | null;
  containment_owner?: string | null;
  product_impact: boolean | null;
  ncmr_required: boolean | null;
  linked_ncmr_number: string | null;
  systemic_issue: boolean | null;
  escalation_required: boolean | null;
  escalation_notes?: string | null;
  status: string | null;
  created_at: string | null;
  closed_at?: string | null;
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

export default function OosOotIntelligenceDashboardPage() {
  const [records, setRecords] = useState<Investigation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("oos_oot_investigations")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setRecords((data as Investigation[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
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

  const getSlaStatus = (value: number) => {
    if (value >= 90) {
      return { label: "On Target", color: "#15803d", icon: "🟢" };
    }

    if (value >= 75) {
      return { label: "At Risk", color: "#d97706", icon: "🟡" };
    }

    return { label: "Action Required", color: "#dc2626", icon: "🔴" };
  };

  const metrics = useMemo(() => {
    const today = new Date().toISOString();

    const openInvestigations = records.filter(
      (item) =>
        String(item.status || "").toLowerCase() !== "closed" &&
        String(item.status || "").toLowerCase() !== "cancelled",
    );

    const closedInvestigations = records.filter(
      (item) => String(item.status || "").toLowerCase() === "closed",
    );

    const oosEvents = records.filter((item) =>
      String(item.event_type || "").toLowerCase().includes("oos"),
    );

    const ootEvents = records.filter((item) =>
      String(item.event_type || "").toLowerCase().includes("oot"),
    );

    const alertOrActionEvents = records.filter((item) => {
      const event = String(item.event_type || "").toLowerCase();
      return event.includes("alert") || event.includes("action");
    });

    const productImpact = records.filter((item) => Boolean(item.product_impact));
    const ncmrRequired = records.filter((item) => Boolean(item.ncmr_required));
    const systemicIssues = records.filter((item) => Boolean(item.systemic_issue));
    const escalationRequired = records.filter((item) => Boolean(item.escalation_required));
    const materialOnHold = records.filter((item) => Boolean(item.material_on_hold));
    const roomEquipmentImpacted = records.filter((item) => Boolean(item.room_equipment_impacted));

    const openAges = openInvestigations
      .map((item) => daysBetween(item.created_at || item.date_detected, today))
      .filter((age): age is number => age !== null && age >= 0);

    const averageOpenAge =
      openAges.length > 0
        ? Number((openAges.reduce((sum, age) => sum + age, 0) / openAges.length).toFixed(1))
        : 0;

    const oldestOpenAge = openAges.length > 0 ? Number(Math.max(...openAges).toFixed(1)) : 0;

    const overdueInvestigations = openInvestigations.filter((item) => {
      const age = daysBetween(item.created_at || item.date_detected, today);
      return age !== null && age > 30;
    });

    const closedDurations = closedInvestigations
      .map((item) => daysBetween(item.created_at || item.date_detected, item.closed_at))
      .filter((duration): duration is number => duration !== null && duration >= 0);

    const averageClosureTime =
      closedDurations.length > 0
        ? Number((closedDurations.reduce((sum, duration) => sum + duration, 0) / closedDurations.length).toFixed(1))
        : 0;

    const closureWithin30 =
      closedDurations.length > 0
        ? Number(((closedDurations.filter((duration) => duration <= 30).length / closedDurations.length) * 100).toFixed(1))
        : 0;

    const productImpactRate = records.length > 0 ? Number(((productImpact.length / records.length) * 100).toFixed(1)) : 0;
    const ncmrConversionRate = records.length > 0 ? Number(((ncmrRequired.length / records.length) * 100).toFixed(1)) : 0;
    const systemicIssueRate = records.length > 0 ? Number(((systemicIssues.length / records.length) * 100).toFixed(1)) : 0;
    const escalationRate = records.length > 0 ? Number(((escalationRequired.length / records.length) * 100).toFixed(1)) : 0;

    return {
      openInvestigations,
      closedInvestigations,
      oosEvents,
      ootEvents,
      alertOrActionEvents,
      productImpact,
      ncmrRequired,
      systemicIssues,
      escalationRequired,
      materialOnHold,
      roomEquipmentImpacted,
      overdueInvestigations,
      averageOpenAge,
      oldestOpenAge,
      averageClosureTime,
      closureWithin30,
      productImpactRate,
      ncmrConversionRate,
      systemicIssueRate,
      escalationRate,
    };
  }, [records]);

  const closureStatus = getSlaStatus(metrics.closureWithin30);

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
    { title: "Open Investigations", value: metrics.openInvestigations.length, color: "#2563eb" },
    { title: "Overdue >30 Days", value: metrics.overdueInvestigations.length, color: metrics.overdueInvestigations.length > 0 ? "#dc2626" : "#15803d" },
    { title: "Oldest Open Investigation", value: metrics.oldestOpenAge, suffix: " days", color: metrics.oldestOpenAge > 30 ? "#dc2626" : "#15803d" },
    { title: "Product Impact Rate", value: metrics.productImpactRate, suffix: "%", color: metrics.productImpactRate > 15 ? "#d97706" : "#2563eb" },
    { title: "NCMR Conversion Rate", value: metrics.ncmrConversionRate, suffix: "%", color: metrics.ncmrConversionRate > 15 ? "#d97706" : "#2563eb" },
    { title: "Systemic Issue Rate", value: metrics.systemicIssueRate, suffix: "%", color: metrics.systemicIssueRate > 10 ? "#dc2626" : "#15803d" },
    { title: "Escalation Rate", value: metrics.escalationRate, suffix: "%", color: metrics.escalationRate > 10 ? "#dc2626" : "#15803d" },
    { title: "Average Open Age", value: metrics.averageOpenAge, suffix: " days", color: metrics.averageOpenAge > 30 ? "#dc2626" : "#2563eb" },
    { title: "Average Closure Time", value: metrics.averageClosureTime, suffix: " days", color: metrics.averageClosureTime > 30 ? "#dc2626" : "#15803d" },
  ];

  const eventTypeCounts = useMemo(() => buildCounts(records, ["event_type"]), [records]);
  const sourceCounts = useMemo(() => buildCounts(records, ["investigation_source"]), [records]);
  const testCounts = useMemo(() => buildCounts(records, ["test_name"]), [records]);
  const areaCounts = useMemo(() => buildCounts(records, ["area_room_equipment"]), [records]);
  const productCounts = useMemo(() => buildCounts(records, ["product_part_number"]), [records]);
  const lotCounts = useMemo(() => buildCounts(records, ["lot_batch_number"]), [records]);

  const monthlyTrend = useMemo(() => {
    const months: { key: string; label: string; count: number }[] = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      months.push({ key, label: date.toLocaleString("en-US", { month: "short", year: "2-digit" }), count: 0 });
    }

    records.forEach((item) => {
      const dateValue = item.created_at || item.date_detected;
      if (!dateValue) return;
      const date = new Date(dateValue);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const match = months.find((month) => month.key === key);
      if (match) match.count += 1;
    });

    return months;
  }, [records]);

  const agingBuckets = useMemo(() => {
    const today = new Date().toISOString();
    const buckets = { "0–15 Days": 0, "16–30 Days": 0, "31–60 Days": 0, ">60 Days": 0 };

    metrics.openInvestigations.forEach((item) => {
      const age = daysBetween(item.created_at || item.date_detected, today) || 0;
      if (age <= 15) buckets["0–15 Days"] += 1;
      else if (age <= 30) buckets["16–30 Days"] += 1;
      else if (age <= 60) buckets["31–60 Days"] += 1;
      else buckets[">60 Days"] += 1;
    });

    return Object.entries(buckets);
  }, [metrics.openInvestigations]);

  if (loading) {
    return <main style={pageStyle}>Loading OOS/OOT Intelligence...</main>;
  }

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>ENTERPRISE QUALITY COMMAND CENTER</div>
          <h1 style={{ margin: "6px 0" }}>OOS/OOT Intelligence Dashboard</h1>
          <p style={subtleText}>
            Executive operational intelligence for laboratory excursions, environmental monitoring,
            out-of-specification events, out-of-trend signals, product impact, systemic issues,
            and escalation control.
          </p>
        </div>

        <div style={buttonRowStyle}>
          <Link href="/oos-oot" style={secondaryLinkStyle}>OOS/OOT Registry</Link>
          <Link href="/dashboard" style={darkLinkStyle}>Executive Dashboard</Link>
        </div>
      </header>

      <section style={kpiGridStyle}>
        {kpis.map((kpi) => (
          <KpiCard key={kpi.title} {...kpi} />
        ))}
      </section>

      <section style={slaPanelStyle}>
        <div>
          <div style={eyebrowStyle}>INVESTIGATION PERFORMANCE</div>
          <h2 style={{ margin: "6px 0" }}>Timeliness & Laboratory Control</h2>
          <p style={subtleText}>
            Tracks investigation aging, closure performance, product impact, material hold exposure,
            equipment impact, and escalation readiness.
          </p>
        </div>

        <div style={slaSummaryGridStyle}>
          <KpiCard title="Total Investigations" value={records.length} color="#2563eb" />
          <KpiCard title="OOS Events" value={metrics.oosEvents.length} color={metrics.oosEvents.length > 0 ? "#dc2626" : "#15803d"} />
          <KpiCard title="OOT Events" value={metrics.ootEvents.length} color={metrics.ootEvents.length > 0 ? "#d97706" : "#15803d"} />
          <KpiCard title="Material on Hold" value={metrics.materialOnHold.length} color={metrics.materialOnHold.length > 0 ? "#dc2626" : "#15803d"} />
          <KpiCard title="Room / Equipment Impact" value={metrics.roomEquipmentImpacted.length} color={metrics.roomEquipmentImpacted.length > 0 ? "#d97706" : "#15803d"} />
          <KpiCard title="Alert / Action Events" value={metrics.alertOrActionEvents.length} color={metrics.alertOrActionEvents.length > 0 ? "#d97706" : "#15803d"} />
        </div>

        <div style={slaGridStyle}>
          <section style={cardStyle}>
            <h3 style={{ marginTop: 0 }}>Open Investigation Aging Buckets</h3>
            {agingBuckets.map(([label, value]) => (
              <BarRow key={label} label={label} value={value} max={Math.max(metrics.openInvestigations.length, 1)} />
            ))}
          </section>

          <section style={cardStyle}>
            <h3 style={{ marginTop: 0 }}>Monthly Investigation Trend</h3>
            {monthlyTrend.map((item) => (
              <BarRow key={item.key} label={item.label} value={item.count} max={Math.max(...monthlyTrend.map((month) => month.count), 1)} />
            ))}
          </section>

          <section style={cardStyle}>
            <h3 style={{ marginTop: 0 }}>Event Type Intelligence</h3>
            {eventTypeCounts.length === 0 ? <p style={subtleText}>No event type data available.</p> : eventTypeCounts.map(([label, count]) => (
              <BarRow key={label} label={label} value={count} max={eventTypeCounts[0]?.[1] || 1} />
            ))}
          </section>
        </div>
      </section>

      <section style={escalationPanelStyle}>
        <div>
          <div style={eyebrowStyle}>EXECUTIVE ESCALATION ENGINE</div>
          <h2 style={{ margin: "6px 0" }}>Action Required</h2>
          <p style={subtleText}>
            Prioritized OOS/OOT and environmental monitoring signals requiring quality leadership attention,
            product impact decision-making, NCMR escalation, or investigation governance action.
          </p>
        </div>

        <div style={escalationGridStyle}>
          <EscalationCard title="Overdue Investigations" count={metrics.overdueInvestigations.length} severity={metrics.overdueInvestigations.length > 0 ? "high" : "controlled"} items={metrics.overdueInvestigations} description="Open investigations greater than 30 days old." />
          <EscalationCard title="Product Impact" count={metrics.productImpact.length} severity={metrics.productImpact.length > 0 ? "high" : "controlled"} items={metrics.productImpact} description="Investigations with potential or confirmed product impact." />
          <EscalationCard title="NCMR Required" count={metrics.ncmrRequired.length} severity={metrics.ncmrRequired.length > 0 ? "medium" : "controlled"} items={metrics.ncmrRequired} description="Investigations requiring nonconformance linkage." />
          <EscalationCard title="Systemic Issues" count={metrics.systemicIssues.length} severity={metrics.systemicIssues.length > 0 ? "high" : "controlled"} items={metrics.systemicIssues} description="Investigations indicating systemic or recurring concerns." />
          <EscalationCard title="Escalation Required" count={metrics.escalationRequired.length} severity={metrics.escalationRequired.length > 0 ? "high" : "controlled"} items={metrics.escalationRequired} description="Investigations flagged for management escalation." />
          <EscalationCard title="Material on Hold" count={metrics.materialOnHold.length} severity={metrics.materialOnHold.length > 0 ? "medium" : "controlled"} items={metrics.materialOnHold} description="Investigations with material hold or quarantine exposure." />
        </div>
      </section>

      <div style={dashboardGridStyle}>
        <DistributionCard title="Source Intelligence" items={sourceCounts} />
        <DistributionCard title="Test Method Intelligence" items={testCounts} />
        <DistributionCard title="Area / Room / Equipment" items={areaCounts} />
        <DistributionCard title="Product Intelligence" items={productCounts} />
        <DistributionCard title="Lot / Batch Intelligence" items={lotCounts} />

        <section style={cardStyle}>
          <h2>Risk & Escalation Metrics</h2>
          <MetricRow label="Product Impact" value={metrics.productImpact.length} />
          <MetricRow label="NCMR Required" value={metrics.ncmrRequired.length} />
          <MetricRow label="Systemic Issues" value={metrics.systemicIssues.length} />
          <MetricRow label="Escalation Required" value={metrics.escalationRequired.length} />
          <MetricRow label="Product Impact Rate" value={metrics.productImpactRate} suffix="%" />
          <MetricRow label="NCMR Conversion Rate" value={metrics.ncmrConversionRate} suffix="%" />
        </section>

        <section style={cardStyle}>
          <h2>Recent Investigations</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Investigation</th>
                  <th style={thStyle}>Event</th>
                  <th style={thStyle}>Source</th>
                  <th style={thStyle}>Status</th>
                </tr>
              </thead>
              <tbody>
                {records.slice(0, 10).map((item) => (
                  <tr key={item.id}>
                    <td style={tdStyle}>
                      <Link href={`/oos-oot/${item.id}`}>{item.investigation_number || item.test_name || item.id}</Link>
                    </td>
                    <td style={tdStyle}>{item.event_type || "N/A"}</td>
                    <td style={tdStyle}>{item.investigation_source || "N/A"}</td>
                    <td style={tdStyle}>{item.status || "N/A"}</td>
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

function buildCounts(records: Investigation[], fields: string[]) {
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
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
}

function DistributionCard({ title, items }: { title: string; items: [string, number][] }) {
  return (
    <section style={cardStyle}>
      <h2>{title}</h2>
      {items.length === 0 ? <p style={subtleText}>No data available.</p> : items.map(([label, count]) => (
        <BarRow key={label} label={label} value={count} max={items[0]?.[1] || 1} />
      ))}
    </section>
  );
}

function EscalationCard({ title, count, severity, items, description }: { title: string; count: number; severity: "controlled" | "medium" | "high"; items: Investigation[]; description: string }) {
  const color = severity === "high" ? "#dc2626" : severity === "medium" ? "#d97706" : "#15803d";
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
        {items.length === 0 ? <div style={{ color: "#15803d", fontWeight: 700 }}>No escalation required.</div> : items.slice(0, 5).map((item) => (
          <div key={item.id} style={escalationItemStyle}>
            <Link href={`/oos-oot/${item.id}`} style={{ fontWeight: 700 }}>{item.investigation_number || item.test_name || item.id}</Link>
            <div style={smallMutedStyle}>{item.test_name || "Untitled Investigation"} | Event: {item.event_type || "N/A"} | Status: {item.status || "N/A"}</div>
          </div>
        ))}
        {items.length > 5 ? <div style={{ ...smallMutedStyle, marginTop: "8px" }}>+ {items.length - 5} more</div> : null}
      </div>
    </div>
  );
}

function KpiCard({ title, value, color, suffix = "", target, statusLabel, statusIcon, statusColor }: KpiTile) {
  return (
    <div style={{ ...kpiCardStyle, borderLeft: `8px solid ${color}` }}>
      <div style={kpiTitleStyle}>{title}</div>
      <div style={{ fontSize: "34px", fontWeight: 800, color }}>{value}{suffix}</div>
      {target ? <div style={kpiTargetStyle}>{target}</div> : null}
      {statusLabel ? (
        <div style={{ ...kpiStatusStyle, color: statusColor || color, borderColor: statusColor || color, background: "#ffffff" }}>
          <span>{statusIcon}</span><span>{statusLabel}</span>
        </div>
      ) : null}
    </div>
  );
}

function MetricRow({ label, value, suffix = "" }: { label: string; value: number; suffix?: string }) {
  return <div style={metricRowStyle}><span>{label}</span><strong>{value}{suffix}</strong></div>;
}

function BarRow({ label, value, max }: { label: string; value: number; max: number }) {
  const width = max === 0 ? 0 : (value / max) * 100;
  return (
    <div style={{ marginBottom: "14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}><span>{formatLabel(label)}</span><strong>{value}</strong></div>
      <div style={{ background: "#e5e7eb", height: "10px", borderRadius: "999px" }}>
        <div style={{ width: `${width}%`, background: "#2563eb", height: "10px", borderRadius: "999px" }} />
      </div>
    </div>
  );
}

const formatLabel = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());

const pageStyle: React.CSSProperties = { padding: "24px", background: "#f8fafc", minHeight: "100vh", fontFamily: "Arial, sans-serif" };
const headerStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap", marginBottom: "24px" };
const eyebrowStyle: React.CSSProperties = { fontSize: "12px", fontWeight: 800, color: "#6b7280", letterSpacing: "0.08em" };
const subtleText: React.CSSProperties = { color: "#6b7280" };
const buttonRowStyle: React.CSSProperties = { display: "flex", gap: "8px", flexWrap: "wrap" };
const darkLinkStyle: React.CSSProperties = { background: "#111827", color: "white", borderRadius: "8px", padding: "10px 14px", textDecoration: "none", fontWeight: 700 };
const secondaryLinkStyle: React.CSSProperties = { background: "#15803d", color: "white", borderRadius: "8px", padding: "10px 14px", textDecoration: "none", fontWeight: 700 };
const kpiGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "18px", marginBottom: "24px" };
const kpiCardStyle: React.CSSProperties = { background: "white", borderRadius: "16px", padding: "20px", border: "1px solid #d1d5db" };
const kpiTitleStyle: React.CSSProperties = { color: "#6b7280", marginBottom: "10px" };
const kpiTargetStyle: React.CSSProperties = { color: "#6b7280", fontSize: "13px", marginTop: "8px", fontWeight: 700 };
const kpiStatusStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: "6px", border: "1px solid", borderRadius: "999px", padding: "4px 10px", fontSize: "12px", fontWeight: 800, marginTop: "8px" };
const slaPanelStyle: React.CSSProperties = { background: "white", borderRadius: "16px", padding: "22px", border: "1px solid #d1d5db", marginBottom: "24px" };
const slaSummaryGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "18px", marginTop: "18px", marginBottom: "20px" };
const slaGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px", marginTop: "18px" };
const escalationPanelStyle: React.CSSProperties = { background: "white", borderRadius: "16px", padding: "22px", border: "1px solid #d1d5db", marginBottom: "24px" };
const escalationGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px", marginTop: "18px" };
const escalationCardStyle: React.CSSProperties = { border: "1px solid #d1d5db", borderRadius: "14px", padding: "16px", background: "#f9fafb" };
const escalationItemStyle: React.CSSProperties = { borderTop: "1px solid #e5e7eb", paddingTop: "10px", marginTop: "10px" };
const smallMutedStyle: React.CSSProperties = { fontSize: "12px", color: "#6b7280", marginTop: "4px" };
const dashboardGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: "20px" };
const cardStyle: React.CSSProperties = { background: "white", borderRadius: "16px", padding: "20px", border: "1px solid #d1d5db" };
const metricRowStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", marginBottom: "10px" };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse" };
const thStyle: React.CSSProperties = { borderBottom: "1px solid #d1d5db", textAlign: "left", padding: "10px" };
const tdStyle: React.CSSProperties = { borderBottom: "1px solid #e5e7eb", padding: "10px" };
