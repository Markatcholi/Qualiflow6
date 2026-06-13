"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type NcmrRecord = {
  id: string;
  ncmr_number: string | null;
  title: string | null;
  issue_description: string | null;
  status: string | null;
  severity: string | null;
  created_at: string | null;
  closed_at?: string | null;
  date_detected?: string | null;
  containment_completed_at?: string | null;
  containment_completed_date?: string | null;
  containment_date?: string | null;
  disposition_at?: string | null;
  disposition_date?: string | null;
  disposition_completed_at?: string | null;
  disposition?: string | null;
  disposition_decision?: string | null;
  defect_category?: string | null;
  defect_subcategory?: string | null;
  department?: string | null;
  owner?: string | null;
  supplier_name?: string | null;
  supplier_id?: string | null;
  capa_required?: boolean | null;
  recurring_issue?: boolean | null;
  supplier_capa_required?: boolean | null;
  scar_required?: boolean | null;
  supplier_scar_recommended?: boolean | null;
  material_status?: string | null;
};

type KpiTile = {
  title: string;
  value: number | string;
  color: string;
  suffix?: string;
};

export default function NcmrIntelligenceDashboardPage() {
  const [ncmrs, setNcmrs] = useState<NcmrRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("ncmrs")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setNcmrs((data as NcmrRecord[]) || []);
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

  const firstAvailableDate = (record: NcmrRecord, fields: string[]) => {
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
    records: NcmrRecord[];
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
    records: NcmrRecord[];
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

  const metrics = useMemo(() => {
    const today = new Date().toISOString();

    const openNcmrs = ncmrs.filter(
      (ncmr) =>
        String(ncmr.status || "").toLowerCase() !== "closed" &&
        String(ncmr.status || "").toLowerCase() !== "cancelled",
    );

    const closedNcmrs = ncmrs.filter(
      (ncmr) => String(ncmr.status || "").toLowerCase() === "closed",
    );

    const criticalNcmrs = ncmrs.filter(
      (ncmr) => String(ncmr.severity || "").toLowerCase() === "critical",
    );

    const majorNcmrs = ncmrs.filter(
      (ncmr) => String(ncmr.severity || "").toLowerCase() === "major",
    );

    const capaRequired = ncmrs.filter((ncmr) => Boolean(ncmr.capa_required));
    const recurringIssues = ncmrs.filter((ncmr) => Boolean(ncmr.recurring_issue));

    const scarRequired = ncmrs.filter(
      (ncmr) =>
        Boolean(ncmr.scar_required) ||
        Boolean(ncmr.supplier_capa_required) ||
        Boolean(ncmr.supplier_scar_recommended),
    );

    const supplierRelated = ncmrs.filter(
      (ncmr) => Boolean(ncmr.supplier_id) || Boolean(ncmr.supplier_name),
    );

    const openAges = openNcmrs
      .map((ncmr) => daysBetween(ncmr.created_at, today))
      .filter((age): age is number => age !== null && age >= 0);

    const averageOpenAge =
      openAges.length > 0
        ? Number((openAges.reduce((sum, age) => sum + age, 0) / openAges.length).toFixed(1))
        : 0;

    const oldestOpenAge = openAges.length > 0 ? Number(Math.max(...openAges).toFixed(1)) : 0;

    const overdueNcmrs = openNcmrs.filter((ncmr) => {
      const age = daysBetween(ncmr.created_at, today);
      return age !== null && age > 45;
    });

    const closureWithin45 = percentWithinTarget({
      records: closedNcmrs,
      startFields: ["created_at", "date_detected"],
      endFields: ["closed_at"],
      targetDays: 45,
    });

    const containmentWithin5 = percentWithinTarget({
      records: ncmrs,
      startFields: ["created_at", "date_detected"],
      endFields: [
        "containment_completed_at",
        "containment_completed_date",
        "containment_date",
      ],
      targetDays: 5,
    });

    const dispositionWithin15 = percentWithinTarget({
      records: ncmrs,
      startFields: ["created_at", "date_detected"],
      endFields: [
        "disposition_at",
        "disposition_date",
        "disposition_completed_at",
      ],
      targetDays: 15,
    });

    const averageClosureTime = averageDuration({
      records: closedNcmrs,
      startFields: ["created_at", "date_detected"],
      endFields: ["closed_at"],
    });

    const averageContainmentTime = averageDuration({
      records: ncmrs,
      startFields: ["created_at", "date_detected"],
      endFields: [
        "containment_completed_at",
        "containment_completed_date",
        "containment_date",
      ],
    });

    const averageDispositionTime = averageDuration({
      records: ncmrs,
      startFields: ["created_at", "date_detected"],
      endFields: [
        "disposition_at",
        "disposition_date",
        "disposition_completed_at",
      ],
    });

    return {
      openNcmrs,
      closedNcmrs,
      criticalNcmrs,
      majorNcmrs,
      capaRequired,
      recurringIssues,
      scarRequired,
      supplierRelated,
      overdueNcmrs,
      averageOpenAge,
      oldestOpenAge,
      closureWithin45,
      containmentWithin5,
      dispositionWithin15,
      averageClosureTime,
      averageContainmentTime,
      averageDispositionTime,
    };
  }, [ncmrs]);

  const kpis: KpiTile[] = [
    {
      title: "Containment ≤ 5 Days",
      value: metrics.containmentWithin5,
      suffix: "%",
      color:
        metrics.containmentWithin5 >= 90
          ? "#15803d"
          : metrics.containmentWithin5 >= 75
          ? "#d97706"
          : "#dc2626",
    },
    {
      title: "Disposition ≤ 15 Days",
      value: metrics.dispositionWithin15,
      suffix: "%",
      color:
        metrics.dispositionWithin15 >= 90
          ? "#15803d"
          : metrics.dispositionWithin15 >= 75
          ? "#d97706"
          : "#dc2626",
    },
    {
      title: "Closure ≤ 45 Days",
      value: metrics.closureWithin45,
      suffix: "%",
      color:
        metrics.closureWithin45 >= 90
          ? "#15803d"
          : metrics.closureWithin45 >= 75
          ? "#d97706"
          : "#dc2626",
    },
    { title: "Open NCMRs", value: metrics.openNcmrs.length, color: "#2563eb" },
    {
      title: "Overdue >45 Days",
      value: metrics.overdueNcmrs.length,
      color: metrics.overdueNcmrs.length > 0 ? "#dc2626" : "#15803d",
    },
    {
      title: "Oldest Open NCMR",
      value: metrics.oldestOpenAge,
      suffix: " days",
      color: metrics.oldestOpenAge > 45 ? "#dc2626" : "#15803d",
    },
    {
      title: "Avg Open Age",
      value: metrics.averageOpenAge,
      suffix: " days",
      color: metrics.averageOpenAge > 45 ? "#dc2626" : "#2563eb",
    },
    {
      title: "Avg Closure Time",
      value: metrics.averageClosureTime,
      suffix: " days",
      color: metrics.averageClosureTime > 45 ? "#dc2626" : "#15803d",
    },
  ];

  const defectCounts = useMemo(() => buildCounts(ncmrs, ["defect_category"]), [ncmrs]);
  const dispositionCounts = useMemo(() => buildCounts(ncmrs, ["disposition_decision", "disposition"]), [ncmrs]);
  const departmentCounts = useMemo(() => buildCounts(ncmrs, ["department"]), [ncmrs]);
  const supplierCounts = useMemo(() => buildCounts(ncmrs, ["supplier_name"]), [ncmrs]);

  const agingBuckets = useMemo(() => {
    const today = new Date().toISOString();
    const buckets = {
      "0–15 Days": 0,
      "16–30 Days": 0,
      "31–45 Days": 0,
      ">45 Days": 0,
    };

    metrics.openNcmrs.forEach((ncmr) => {
      const age = daysBetween(ncmr.created_at, today) || 0;
      if (age <= 15) buckets["0–15 Days"] += 1;
      else if (age <= 30) buckets["16–30 Days"] += 1;
      else if (age <= 45) buckets["31–45 Days"] += 1;
      else buckets[">45 Days"] += 1;
    });

    return Object.entries(buckets);
  }, [metrics.openNcmrs]);

  if (loading) {
    return <main style={pageStyle}>Loading NCMR Intelligence...</main>;
  }

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>ENTERPRISE QUALITY COMMAND CENTER</div>
          <h1 style={{ margin: "6px 0" }}>NCMR Intelligence Dashboard</h1>
          <p style={subtleText}>
            Executive operational intelligence for nonconformance performance,
            containment, disposition, closure timeliness, supplier exposure,
            recurrence, and escalation control.
          </p>
        </div>

        <Link href="/ncmrs" style={{ ...darkButtonStyle, background: "#2563eb" }}>
          Back to NCMR Program
        </Link>
      </header>

      <section style={kpiGridStyle}>
        {kpis.map((kpi) => (
          <KpiCard
            key={kpi.title}
            title={kpi.title}
            value={kpi.value}
            suffix={kpi.suffix}
            color={kpi.color}
          />
        ))}
      </section>

      <section style={slaPanelStyle}>
        <div>
          <div style={eyebrowStyle}>NCMR PROCESS PERFORMANCE</div>
          <h2 style={{ margin: "6px 0" }}>Timeliness & Quality Objective Control</h2>
          <p style={subtleText}>
            Tracks whether NCMRs are contained within 5 days, dispositioned within
            15 days, and closed within 45 days.
          </p>
        </div>

        <div style={slaSummaryGridStyle}>
          <KpiCard
            title="Avg Containment Time"
            value={metrics.averageContainmentTime}
            suffix=" days"
            color={metrics.averageContainmentTime > 5 ? "#dc2626" : "#15803d"}
          />
          <KpiCard
            title="Avg Disposition Time"
            value={metrics.averageDispositionTime}
            suffix=" days"
            color={metrics.averageDispositionTime > 15 ? "#dc2626" : "#15803d"}
          />
          <KpiCard
            title="Avg Closure Time"
            value={metrics.averageClosureTime}
            suffix=" days"
            color={metrics.averageClosureTime > 45 ? "#dc2626" : "#15803d"}
          />
          <KpiCard title="Total NCMRs" value={ncmrs.length} color="#2563eb" />
        </div>

        <div style={slaGridStyle}>
          <section style={cardStyle}>
            <h3 style={{ marginTop: 0 }}>Open NCMR Aging Buckets</h3>
            {agingBuckets.map(([label, value]) => (
              <BarRow key={label} label={label} value={value} max={Math.max(metrics.openNcmrs.length, 1)} />
            ))}
          </section>

          <section style={cardStyle}>
            <h3 style={{ marginTop: 0 }}>Disposition Intelligence</h3>
            {dispositionCounts.length === 0 ? (
              <p style={subtleText}>No disposition data available.</p>
            ) : (
              dispositionCounts.map(([label, count]) => (
                <BarRow key={label} label={label} value={count} max={dispositionCounts[0]?.[1] || 1} />
              ))
            )}
          </section>

          <section style={cardStyle}>
            <h3 style={{ marginTop: 0 }}>Defect Intelligence</h3>
            {defectCounts.length === 0 ? (
              <p style={subtleText}>No defect category data available.</p>
            ) : (
              defectCounts.map(([label, count]) => (
                <BarRow key={label} label={label} value={count} max={defectCounts[0]?.[1] || 1} />
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
            Prioritized NCMR signals requiring quality leadership attention,
            escalation, or governance action.
          </p>
        </div>

        <div style={escalationGridStyle}>
          <EscalationCard title="Overdue NCMRs" count={metrics.overdueNcmrs.length} severity={metrics.overdueNcmrs.length > 0 ? "high" : "controlled"} items={metrics.overdueNcmrs} description="Open NCMRs greater than 45 days old." />
          <EscalationCard title="Critical NCMRs" count={metrics.criticalNcmrs.length} severity={metrics.criticalNcmrs.length > 0 ? "high" : "controlled"} items={metrics.criticalNcmrs} description="Critical severity nonconformances." />
          <EscalationCard title="Major NCMRs" count={metrics.majorNcmrs.length} severity={metrics.majorNcmrs.length > 0 ? "medium" : "controlled"} items={metrics.majorNcmrs} description="Major severity nonconformances." />
          <EscalationCard title="CAPA Evaluation Required" count={metrics.capaRequired.length} severity={metrics.capaRequired.length > 0 ? "medium" : "controlled"} items={metrics.capaRequired} description="NCMRs requiring CAPA evaluation." />
          <EscalationCard title="Recurring Issues" count={metrics.recurringIssues.length} severity={metrics.recurringIssues.length > 0 ? "medium" : "controlled"} items={metrics.recurringIssues} description="NCMRs identified as repeat or recurring events." />
          <EscalationCard title="Supplier / SCAR Exposure" count={metrics.scarRequired.length} severity={metrics.scarRequired.length > 0 ? "medium" : "controlled"} items={metrics.scarRequired} description="Supplier-related NCMRs or SCAR/CAPA candidates." />
        </div>
      </section>

      <div style={dashboardGridStyle}>
        <section style={cardStyle}>
          <h2>Supplier Intelligence</h2>
          {supplierCounts.length === 0 ? (
            <p style={subtleText}>No supplier data available.</p>
          ) : (
            supplierCounts.map(([label, count]) => (
              <BarRow key={label} label={label} value={count} max={supplierCounts[0]?.[1] || 1} />
            ))
          )}
        </section>

        <section style={cardStyle}>
          <h2>Department Intelligence</h2>
          {departmentCounts.length === 0 ? (
            <p style={subtleText}>No department data available.</p>
          ) : (
            departmentCounts.map(([label, count]) => (
              <BarRow key={label} label={label} value={count} max={departmentCounts[0]?.[1] || 1} />
            ))
          )}
        </section>

        <section style={cardStyle}>
          <h2>Escalation Metrics</h2>
          <MetricRow label="CAPA Required" value={metrics.capaRequired.length} />
          <MetricRow label="Recurring Issues" value={metrics.recurringIssues.length} />
          <MetricRow label="Supplier Related" value={metrics.supplierRelated.length} />
          <MetricRow label="SCAR / Supplier CAPA Required" value={metrics.scarRequired.length} />
        </section>

        <section style={cardStyle}>
          <h2>Recent NCMRs</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>NCMR</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Severity</th>
                  <th style={thStyle}>Owner</th>
                </tr>
              </thead>
              <tbody>
                {ncmrs.slice(0, 10).map((ncmr) => (
                  <tr key={ncmr.id}>
                    <td style={tdStyle}>
                      <Link href={`/ncmrs/${ncmr.id}`}>
                        {ncmr.ncmr_number || ncmr.title || ncmr.id}
                      </Link>
                    </td>
                    <td style={tdStyle}>{ncmr.status || "N/A"}</td>
                    <td style={tdStyle}>{ncmr.severity || "N/A"}</td>
                    <td style={tdStyle}>{ncmr.owner || "N/A"}</td>
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

function buildCounts(records: NcmrRecord[], fields: string[]) {
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
  items: NcmrRecord[];
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
              <Link href={`/ncmrs/${item.id}`} style={{ fontWeight: 700 }}>
                {item.ncmr_number || item.title || item.id}
              </Link>
              <div style={smallMutedStyle}>
                {item.title || "Untitled NCMR"} | Owner: {item.owner || "N/A"} |
                Status: {item.status || "N/A"}
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
}: {
  title: string;
  value: number | string;
  color: string;
  suffix?: string;
}) {
  return (
    <div style={{ ...kpiCardStyle, borderLeft: `8px solid ${color}` }}>
      <div style={kpiTitleStyle}>{title}</div>
      <div style={{ fontSize: "34px", fontWeight: 800, color }}>
        {value}
        {suffix}
      </div>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: number }) {
  return (
    <div style={metricRowStyle}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function BarRow({ label, value, max }: { label: string; value: number; max: number }) {
  const width = max === 0 ? 0 : (value / max) * 100;

  return (
    <div style={{ marginBottom: "14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div style={{ background: "#e5e7eb", height: "10px", borderRadius: "999px" }}>
        <div style={{ width: `${width}%`, background: "#2563eb", height: "10px", borderRadius: "999px" }} />
      </div>
    </div>
  );
}

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

const darkButtonStyle: React.CSSProperties = {
  background: "#111827",
  color: "white",
  padding: "10px 14px",
  borderRadius: "8px",
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
