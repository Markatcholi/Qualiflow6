"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type Audit = {
  id: string;
  audit_number: string | null;
  audit_title: string | null;
  audit_type: string | null;
  audit_scope: string | null;
  auditor: string | null;
  audit_date: string | null;
  status: string | null;
  created_at: string | null;
  closed_at?: string | null;
};

type AuditFinding = {
  id: string;
  audit_id: string | null;
  finding_title: string | null;
  finding_description: string | null;
  finding_severity: string | null;
  clause_reference: string | null;
  evidence: string | null;
  capa_required: boolean | null;
  capa_id: string | null;
  finding_status: string | null;
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

export default function AuditIntelligenceDashboardPage() {
  const [audits, setAudits] = useState<Audit[]>([]);
  const [findings, setFindings] = useState<AuditFinding[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);

    const auditRes = await supabase
      .from("audits")
      .select("*")
      .order("created_at", { ascending: false });

    const findingRes = await supabase
      .from("audit_findings")
      .select("*")
      .order("created_at", { ascending: false });

    if (auditRes.error) {
      alert(auditRes.error.message);
      setLoading(false);
      return;
    }

    if (findingRes.error) {
      alert(findingRes.error.message);
      setLoading(false);
      return;
    }

    setAudits((auditRes.data as Audit[]) || []);
    setFindings((findingRes.data as AuditFinding[]) || []);
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
    if (value >= 90) return { label: "On Target", color: "#15803d", icon: "🟢" };
    if (value >= 75) return { label: "At Risk", color: "#d97706", icon: "🟡" };
    return { label: "Action Required", color: "#dc2626", icon: "🔴" };
  };

  const findingsForAudit = (auditId: string) => {
    return findings.filter((finding) => finding.audit_id === auditId);
  };

  const metrics = useMemo(() => {
    const today = new Date().toISOString();

    const openAudits = audits.filter(
      (audit) =>
        String(audit.status || "").toLowerCase() !== "closed" &&
        String(audit.status || "").toLowerCase() !== "cancelled",
    );

    const closedAudits = audits.filter(
      (audit) => String(audit.status || "").toLowerCase() === "closed",
    );

    const openFindings = findings.filter(
      (finding) =>
        String(finding.finding_status || "").toLowerCase() !== "closed" &&
        String(finding.finding_status || "").toLowerCase() !== "cancelled",
    );

    const closedFindings = findings.filter(
      (finding) => String(finding.finding_status || "").toLowerCase() === "closed",
    );

    const criticalFindings = findings.filter(
      (finding) => String(finding.finding_severity || "").toLowerCase() === "critical",
    );

    const majorFindings = findings.filter(
      (finding) => String(finding.finding_severity || "").toLowerCase() === "major",
    );

    const capaRequiredFindings = findings.filter((finding) => Boolean(finding.capa_required));
    const capaCreatedFindings = findings.filter((finding) => Boolean(finding.capa_id));

    const auditsWithOpenFindings = audits.filter((audit) =>
      findings.some(
        (finding) =>
          finding.audit_id === audit.id &&
          String(finding.finding_status || "").toLowerCase() !== "closed",
      ),
    );

    const overdueFindings = openFindings.filter((finding) => {
      const age = daysBetween(finding.created_at, today);
      return age !== null && age > 30;
    });

    const openFindingAges = openFindings
      .map((finding) => daysBetween(finding.created_at, today))
      .filter((age): age is number => age !== null && age >= 0);

    const averageOpenFindingAge =
      openFindingAges.length > 0
        ? Number((openFindingAges.reduce((sum, age) => sum + age, 0) / openFindingAges.length).toFixed(1))
        : 0;

    const oldestOpenFinding =
      openFindingAges.length > 0 ? Number(Math.max(...openFindingAges).toFixed(1)) : 0;

    const findingClosureDurations = closedFindings
      .map((finding) => daysBetween(finding.created_at, finding.closed_at))
      .filter((duration): duration is number => duration !== null && duration >= 0);

    const averageFindingClosureTime =
      findingClosureDurations.length > 0
        ? Number((findingClosureDurations.reduce((sum, duration) => sum + duration, 0) / findingClosureDurations.length).toFixed(1))
        : 0;

    const findingsClosedWithin30 =
      findingClosureDurations.length > 0
        ? Number(((findingClosureDurations.filter((duration) => duration <= 30).length / findingClosureDurations.length) * 100).toFixed(1))
        : 0;

    const auditClosureRate =
      audits.length > 0 ? Number(((closedAudits.length / audits.length) * 100).toFixed(1)) : 0;

    const findingClosureRate =
      findings.length > 0 ? Number(((closedFindings.length / findings.length) * 100).toFixed(1)) : 0;

    const capaConversionRate =
      findings.length > 0 ? Number(((capaRequiredFindings.length / findings.length) * 100).toFixed(1)) : 0;

    const capaCreatedRate =
      capaRequiredFindings.length > 0
        ? Number(((capaCreatedFindings.length / capaRequiredFindings.length) * 100).toFixed(1))
        : 0;

    const averageFindingsPerAudit = audits.length > 0 ? Number((findings.length / audits.length).toFixed(1)) : 0;

    return {
      openAudits,
      closedAudits,
      openFindings,
      closedFindings,
      criticalFindings,
      majorFindings,
      capaRequiredFindings,
      capaCreatedFindings,
      auditsWithOpenFindings,
      overdueFindings,
      averageOpenFindingAge,
      oldestOpenFinding,
      averageFindingClosureTime,
      findingsClosedWithin30,
      auditClosureRate,
      findingClosureRate,
      capaConversionRate,
      capaCreatedRate,
      averageFindingsPerAudit,
    };
  }, [audits, findings]);

  const findingClosureStatus = getSlaStatus(metrics.findingsClosedWithin30);
  const findingClosureRateStatus = getSlaStatus(metrics.findingClosureRate);
  const capaCreatedStatus = getSlaStatus(metrics.capaCreatedRate);

  const kpis: KpiTile[] = [
    {
      title: "Findings Closed ≤ 30 Days",
      value: metrics.findingsClosedWithin30,
      suffix: "%",
      color: findingClosureStatus.color,
      target: "Target: 90%",
      statusLabel: findingClosureStatus.label,
      statusIcon: findingClosureStatus.icon,
      statusColor: findingClosureStatus.color,
    },
    {
      title: "Finding Closure Rate",
      value: metrics.findingClosureRate,
      suffix: "%",
      color: findingClosureRateStatus.color,
      target: "Target: 90%",
      statusLabel: findingClosureRateStatus.label,
      statusIcon: findingClosureRateStatus.icon,
      statusColor: findingClosureRateStatus.color,
    },
    {
      title: "CAPA Created Rate",
      value: metrics.capaCreatedRate,
      suffix: "%",
      color: capaCreatedStatus.color,
      target: "Target: 90%",
      statusLabel: capaCreatedStatus.label,
      statusIcon: capaCreatedStatus.icon,
      statusColor: capaCreatedStatus.color,
    },
    { title: "Open Audits", value: metrics.openAudits.length, color: "#2563eb" },
    { title: "Open Findings", value: metrics.openFindings.length, color: metrics.openFindings.length > 0 ? "#d97706" : "#15803d" },
    { title: "Overdue Findings >30 Days", value: metrics.overdueFindings.length, color: metrics.overdueFindings.length > 0 ? "#dc2626" : "#15803d" },
    { title: "Critical Findings", value: metrics.criticalFindings.length, color: metrics.criticalFindings.length > 0 ? "#dc2626" : "#15803d" },
    { title: "Major Findings", value: metrics.majorFindings.length, color: metrics.majorFindings.length > 0 ? "#d97706" : "#15803d" },
    { title: "CAPA Required", value: metrics.capaRequiredFindings.length, color: metrics.capaRequiredFindings.length > 0 ? "#d97706" : "#15803d" },
    { title: "Avg Findings / Audit", value: metrics.averageFindingsPerAudit, color: "#2563eb" },
  ];

  const auditTypeCounts = useMemo(() => buildCounts(audits, ["audit_type"]), [audits]);
  const auditStatusCounts = useMemo(() => buildCounts(audits, ["status"]), [audits]);
  const findingSeverityCounts = useMemo(() => buildCounts(findings, ["finding_severity"]), [findings]);
  const findingStatusCounts = useMemo(() => buildCounts(findings, ["finding_status"]), [findings]);
  const clauseCounts = useMemo(() => buildCounts(findings, ["clause_reference"]), [findings]);
  const auditorCounts = useMemo(() => buildCounts(audits, ["auditor"]), [audits]);

  const agingBuckets = useMemo(() => {
    const today = new Date().toISOString();
    const buckets = { "0–15 Days": 0, "16–30 Days": 0, "31–60 Days": 0, ">60 Days": 0 };

    metrics.openFindings.forEach((finding) => {
      const age = daysBetween(finding.created_at, today) || 0;
      if (age <= 15) buckets["0–15 Days"] += 1;
      else if (age <= 30) buckets["16–30 Days"] += 1;
      else if (age <= 60) buckets["31–60 Days"] += 1;
      else buckets[">60 Days"] += 1;
    });

    return Object.entries(buckets);
  }, [metrics.openFindings]);

  if (loading) return <main style={pageStyle}>Loading Audit Intelligence...</main>;

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>ENTERPRISE QUALITY COMMAND CENTER</div>
          <h1 style={{ margin: "6px 0" }}>Audit Intelligence Dashboard</h1>
          <p style={subtleText}>
            Executive operational intelligence for audit execution, finding severity,
            clause recurrence, CAPA conversion, closure performance, and regulatory readiness.
          </p>
        </div>

        <div style={buttonRowStyle}>
          <Link href="/audits" style={secondaryLinkStyle}>Audit Registry</Link>
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
          <div style={eyebrowStyle}>AUDIT PERFORMANCE</div>
          <h2 style={{ margin: "6px 0" }}>Finding Closure & CAPA Governance</h2>
          <p style={subtleText}>
            Tracks audit finding aging, CAPA conversion, findings closed within target,
            and readiness for audit closure.
          </p>
        </div>

        <div style={slaSummaryGridStyle}>
          <KpiCard title="Total Audits" value={audits.length} color="#2563eb" />
          <KpiCard title="Total Findings" value={findings.length} color="#2563eb" />
          <KpiCard title="Oldest Open Finding" value={metrics.oldestOpenFinding} suffix=" days" color={metrics.oldestOpenFinding > 30 ? "#dc2626" : "#15803d"} />
          <KpiCard title="Avg Open Finding Age" value={metrics.averageOpenFindingAge} suffix=" days" color={metrics.averageOpenFindingAge > 30 ? "#dc2626" : "#2563eb"} />
          <KpiCard title="Avg Finding Closure Time" value={metrics.averageFindingClosureTime} suffix=" days" color={metrics.averageFindingClosureTime > 30 ? "#dc2626" : "#15803d"} />
          <KpiCard title="Audit Closure Rate" value={metrics.auditClosureRate} suffix="%" color={metrics.auditClosureRate >= 90 ? "#15803d" : "#d97706"} />
        </div>

        <div style={slaGridStyle}>
          <section style={cardStyle}>
            <h3 style={{ marginTop: 0 }}>Open Finding Aging Buckets</h3>
            {agingBuckets.map(([label, value]) => (
              <BarRow key={label} label={label} value={value} max={Math.max(metrics.openFindings.length, 1)} />
            ))}
          </section>

          <section style={cardStyle}>
            <h3 style={{ marginTop: 0 }}>Finding Severity Intelligence</h3>
            {findingSeverityCounts.length === 0 ? <p style={subtleText}>No finding severity data available.</p> : findingSeverityCounts.map(([label, count]) => <BarRow key={label} label={label} value={count} max={findingSeverityCounts[0]?.[1] || 1} />)}
          </section>

          <section style={cardStyle}>
            <h3 style={{ marginTop: 0 }}>Most Cited Clauses</h3>
            {clauseCounts.length === 0 ? <p style={subtleText}>No clause data available.</p> : clauseCounts.map(([label, count]) => <BarRow key={label} label={label} value={count} max={clauseCounts[0]?.[1] || 1} />)}
          </section>
        </div>
      </section>

      <section style={escalationPanelStyle}>
        <div>
          <div style={eyebrowStyle}>EXECUTIVE ESCALATION ENGINE</div>
          <h2 style={{ margin: "6px 0" }}>Action Required</h2>
          <p style={subtleText}>
            Prioritized audit signals requiring leadership attention, CAPA follow-up,
            finding closure, or regulatory readiness action.
          </p>
        </div>

        <div style={escalationGridStyle}>
          <FindingEscalationCard title="Overdue Findings" count={metrics.overdueFindings.length} severity={metrics.overdueFindings.length > 0 ? "high" : "controlled"} items={metrics.overdueFindings} audits={audits} description="Open audit findings greater than 30 days old." />
          <FindingEscalationCard title="Critical Findings" count={metrics.criticalFindings.length} severity={metrics.criticalFindings.length > 0 ? "high" : "controlled"} items={metrics.criticalFindings} audits={audits} description="Critical audit findings requiring immediate leadership attention." />
          <FindingEscalationCard title="Major Findings" count={metrics.majorFindings.length} severity={metrics.majorFindings.length > 0 ? "medium" : "controlled"} items={metrics.majorFindings} audits={audits} description="Major findings that may require escalation or CAPA." />
          <FindingEscalationCard title="CAPA Required Findings" count={metrics.capaRequiredFindings.length} severity={metrics.capaRequiredFindings.length > 0 ? "medium" : "controlled"} items={metrics.capaRequiredFindings} audits={audits} description="Findings requiring corrective and preventive action." />
          <AuditEscalationCard title="Audits with Open Findings" count={metrics.auditsWithOpenFindings.length} severity={metrics.auditsWithOpenFindings.length > 0 ? "medium" : "controlled"} items={metrics.auditsWithOpenFindings} findingsForAudit={findingsForAudit} description="Audits that cannot be cleanly closed due to open findings." />
        </div>
      </section>

      <div style={dashboardGridStyle}>
        <DistributionSection title="Audit Type Intelligence" items={auditTypeCounts} />
        <DistributionSection title="Audit Status Intelligence" items={auditStatusCounts} />
        <DistributionSection title="Finding Status Intelligence" items={findingStatusCounts} />
        <DistributionSection title="Auditor Workload" items={auditorCounts} />

        <section style={cardStyle}>
          <h2>CAPA Intelligence</h2>
          <MetricRow label="CAPA Required Findings" value={metrics.capaRequiredFindings.length} />
          <MetricRow label="CAPA Created Findings" value={metrics.capaCreatedFindings.length} />
          <MetricRow label="CAPA Conversion Rate" value={metrics.capaConversionRate} suffix="%" />
          <MetricRow label="CAPA Created Rate" value={metrics.capaCreatedRate} suffix="%" />
        </section>

        <section style={cardStyle}>
          <h2>Recent Audits</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Audit</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Auditor</th>
                  <th style={thStyle}>Open Findings</th>
                </tr>
              </thead>
              <tbody>
                {audits.slice(0, 10).map((audit) => {
                  const openFindings = findingsForAudit(audit.id).filter(
                    (finding) => String(finding.finding_status || "").toLowerCase() !== "closed",
                  );

                  return (
                    <tr key={audit.id}>
                      <td style={tdStyle}>{audit.audit_number || audit.audit_title || audit.id}</td>
                      <td style={tdStyle}>{audit.audit_type || "N/A"}</td>
                      <td style={tdStyle}>{audit.auditor || "N/A"}</td>
                      <td style={tdStyle}>{openFindings.length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function DistributionSection({ title, items }: { title: string; items: [string, number][] }) {
  return (
    <section style={cardStyle}>
      <h2>{title}</h2>
      {items.length === 0 ? (
        <p style={subtleText}>No data available.</p>
      ) : (
        items.map(([label, count]) => (
          <BarRow key={label} label={label} value={count} max={items[0]?.[1] || 1} />
        ))
      )}
    </section>
  );
}

function buildCounts(records: any[], fields: string[]) {
  const counts: Record<string, number> = {};
  records.forEach((record) => {
    let value = "Unspecified";
    for (const field of fields) {
      const candidate = record[field];
      if (candidate) {
        value = String(candidate);
        break;
      }
    }
    counts[value] = (counts[value] || 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
}

function FindingEscalationCard({ title, count, severity, items, audits, description }: { title: string; count: number; severity: "controlled" | "medium" | "high"; items: AuditFinding[]; audits: Audit[]; description: string }) {
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
        {items.length === 0 ? <div style={{ color: "#15803d", fontWeight: 700 }}>No escalation required.</div> : items.slice(0, 5).map((item) => {
          const audit = audits.find((auditItem) => auditItem.id === item.audit_id);
          return (
            <div key={item.id} style={escalationItemStyle}>
              <strong>{item.finding_title || item.id}</strong>
              <div style={smallMutedStyle}>Audit: {audit?.audit_number || audit?.audit_title || "N/A"} | Severity: {item.finding_severity || "N/A"} | Status: {item.finding_status || "open"}</div>
              {item.capa_id ? <Link href={`/capa/${item.capa_id}`}>Open CAPA</Link> : null}
            </div>
          );
        })}
        {items.length > 5 ? <div style={{ ...smallMutedStyle, marginTop: "8px" }}>+ {items.length - 5} more</div> : null}
      </div>
    </div>
  );
}

function AuditEscalationCard({ title, count, severity, items, findingsForAudit, description }: { title: string; count: number; severity: "controlled" | "medium" | "high"; items: Audit[]; findingsForAudit: (auditId: string) => AuditFinding[]; description: string }) {
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
        {items.length === 0 ? <div style={{ color: "#15803d", fontWeight: 700 }}>No escalation required.</div> : items.slice(0, 5).map((item) => {
          const openFindings = findingsForAudit(item.id).filter((finding) => String(finding.finding_status || "").toLowerCase() !== "closed");
          return (
            <div key={item.id} style={escalationItemStyle}>
              <strong>{item.audit_number || item.audit_title || item.id}</strong>
              <div style={smallMutedStyle}>Type: {item.audit_type || "N/A"} | Auditor: {item.auditor || "N/A"} | Open Findings: {openFindings.length}</div>
            </div>
          );
        })}
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
