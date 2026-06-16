"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type RiskSeverity = "critical" | "high" | "medium" | "low";

type EnterpriseRisk = {
  id: string;
  source: string;
  sourceTable: string;
  recordId: string;
  recordNumber: string;
  title: string;
  riskDescription: string;
  severity: RiskSeverity;
  status: string;
  owner: string;
  dueDate: string | null;
  createdAt: string | null;
  ageDays: number;
  escalationReason: string;
  link: string;
};

type DistributionItem = {
  label: string;
  count: number;
};

export default function ExecutiveRiskRegisterPage() {
  const [loading, setLoading] = useState(true);
  const [risks, setRisks] = useState<EnterpriseRisk[]>([]);
  const [filter, setFilter] = useState("open");
  const [sourceFilter, setSourceFilter] = useState("all");

  const loadRisks = async () => {
    setLoading(true);

    const collectedRisks: EnterpriseRisk[] = [];

    await Promise.all([
      loadNcmrRisks(collectedRisks),
      loadCapaRisks(collectedRisks),
      loadComplaintRisks(collectedRisks),
      loadAuditRisks(collectedRisks),
      loadScarRisks(collectedRisks),
      loadOosRisks(collectedRisks),
      loadChangeControlRisks(collectedRisks),
    ]);

    collectedRisks.sort((a, b) => {
      const severityScore = getSeverityScore(b.severity) - getSeverityScore(a.severity);
      if (severityScore !== 0) return severityScore;

      return b.ageDays - a.ageDays;
    });

    setRisks(collectedRisks);
    setLoading(false);
  };

  useEffect(() => {
    loadRisks();
  }, []);

  const filteredRisks = useMemo(() => {
    return risks.filter((risk) => {
      const sourceMatch = sourceFilter === "all" || risk.source === sourceFilter;

      const filterMatch =
        filter === "all" ||
        (filter === "open" && !isClosedStatus(risk.status)) ||
        (filter === "critical" && risk.severity === "critical") ||
        (filter === "high" && risk.severity === "high") ||
        (filter === "overdue" && isOverdue(risk.dueDate, risk.status)) ||
        (filter === "escalated" && risk.escalationReason.trim().length > 0) ||
        (filter === "closed" && isClosedStatus(risk.status));

      return sourceMatch && filterMatch;
    });
  }, [risks, filter, sourceFilter]);

  const sourceOptions = useMemo(() => {
    return Array.from(new Set(risks.map((risk) => risk.source))).sort();
  }, [risks]);

  const openRisks = risks.filter((risk) => !isClosedStatus(risk.status));
  const criticalRisks = risks.filter((risk) => risk.severity === "critical");
  const highRisks = risks.filter((risk) => risk.severity === "high");
  const overdueRisks = risks.filter((risk) => isOverdue(risk.dueDate, risk.status));
  const escalatedRisks = risks.filter((risk) => risk.escalationReason.trim().length > 0);

  const sourceDistribution = buildDistribution(risks, "source");
  const severityDistribution = buildDistribution(risks, "severity");
  const agingDistribution = buildAgingDistribution(risks);

  const executiveEscalations = risks
    .filter(
      (risk) =>
        risk.severity === "critical" ||
        risk.severity === "high" ||
        isOverdue(risk.dueDate, risk.status) ||
        risk.escalationReason.trim().length > 0,
    )
    .slice(0, 25);

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>EXECUTIVE GOVERNANCE</div>
          <h1 style={{ margin: "6px 0" }}>Executive Risk Register</h1>
          <p style={subtleText}>
            Detailed enterprise risk workspace for quality risks coming from NCMR,
            CAPA, complaints, audits, SCAR, OOS/OOT, and change control.
          </p>
        </div>

        <div style={buttonRowStyle}>
          <Link href="/dashboard" style={darkButtonStyle}>
            Executive Dashboard
          </Link>
          <Link href="/management-review" style={blueButtonStyle}>
            Management Review
          </Link>
        </div>
      </header>

      {loading ? (
        <section style={cardStyle}>Loading enterprise risks...</section>
      ) : (
        <>
          <section style={kpiGridStyle}>
            <RiskKpiCard label="Total Enterprise Risks" value={risks.length} tone="blue" />
            <RiskKpiCard label="Open Risks" value={openRisks.length} tone="orange" />
            <RiskKpiCard label="Critical Risks" value={criticalRisks.length} tone="red" />
            <RiskKpiCard label="High Risks" value={highRisks.length} tone="orange" />
            <RiskKpiCard label="Overdue Risks" value={overdueRisks.length} tone="red" />
            <RiskKpiCard label="Executive Escalations" value={escalatedRisks.length} tone="purple" />
          </section>

          <section style={gridTwoColumnStyle}>
            <DistributionCard title="Risk Source Analysis" items={sourceDistribution} />
            <DistributionCard title="Risk Severity Breakdown" items={severityDistribution} />
            <DistributionCard title="Risk Aging" items={agingDistribution} />
            <section style={cardStyle}>
              <h2 style={{ marginTop: 0 }}>Governance Purpose</h2>
              <p style={subtleText}>
                The Executive Dashboard shows the snapshot. This register shows the
                detailed risk list behind the snapshot so leaders can review,
                prioritize, and drive follow-up actions.
              </p>
              <div style={infoBoxStyle}>
                V1 uses existing records only. No new database tables or migrations are required.
              </div>
            </section>
          </section>

          <section style={cardStyle}>
            <div style={sectionHeaderStyle}>
              <div>
                <div style={eyebrowStyle}>EXECUTIVE ESCALATIONS</div>
                <h2 style={{ margin: "6px 0" }}>Priority Risk Items</h2>
                <p style={subtleText}>
                  Critical, high, overdue, or explicitly escalated quality records.
                </p>
              </div>
            </div>

            <RiskTable risks={executiveEscalations} compact />
          </section>

          <section style={cardStyle}>
            <div style={sectionHeaderStyle}>
              <div>
                <div style={eyebrowStyle}>ENTERPRISE RISK REGISTER</div>
                <h2 style={{ margin: "6px 0" }}>Detailed Risk Governance Table</h2>
                <p style={subtleText}>
                  Showing {filteredRisks.length} of {risks.length} risk records.
                </p>
              </div>

              <div style={filterRowStyle}>
                <select
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                  style={inputStyle}
                >
                  <option value="open">Open Risks</option>
                  <option value="all">All Risks</option>
                  <option value="critical">Critical Risks</option>
                  <option value="high">High Risks</option>
                  <option value="overdue">Overdue Risks</option>
                  <option value="escalated">Escalated Risks</option>
                  <option value="closed">Closed Risks</option>
                </select>

                <select
                  value={sourceFilter}
                  onChange={(event) => setSourceFilter(event.target.value)}
                  style={inputStyle}
                >
                  <option value="all">All Sources</option>
                  {sourceOptions.map((source) => (
                    <option key={source} value={source}>
                      {source}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <RiskTable risks={filteredRisks} />
          </section>
        </>
      )}
    </main>
  );
}

async function loadNcmrRisks(collectedRisks: EnterpriseRisk[]) {
  const { data, error } = await supabase.from("ncmrs").select("*");

  if (error) {
    console.warn(error.message);
    return;
  }

  (data || []).forEach((item: any) => {
    const status = String(item.status || "open").toLowerCase();
    const severity = normalizeSeverity(item.severity);
    const isRisk =
      status !== "closed" ||
      severity === "critical" ||
      severity === "high" ||
      severity === "medium" ||
      item.capa_required ||
      item.capa_evaluation_outcome === "required" ||
      item.scar_required ||
      item.supplier_capa_required ||
      item.recurring_issue;

    if (!isRisk) return;

    const reasons = [
      status !== "closed" ? "NCMR remains open" : "",
      status === "investigation" ? "NCMR in investigation" : "",
      severity === "critical" || severity === "high" ? "Major/Critical nonconformance" : "",
      item.capa_required || item.capa_evaluation_outcome === "required" ? "CAPA required" : "",
      item.scar_required || item.supplier_capa_required ? "SCAR required" : "",
      item.recurring_issue ? "Recurring issue" : "",
      isOlderThan(item.created_at, 45) && status !== "closed" ? "Closure aging exceeds 45 days" : "",
    ].filter(Boolean);

    collectedRisks.push({
      id: `ncmr-${item.id}`,
      source: "NCMR",
      sourceTable: "ncmrs",
      recordId: item.id,
      recordNumber: item.ncmr_number || item.record_number || item.title || "NCMR",
      title: item.title || item.issue_description || "Nonconformance risk",
      riskDescription: reasons.join("; ") || "NCMR risk item",
      severity,
      status,
      owner: item.owner || item.assigned_to || item.created_by || "Unassigned",
      dueDate: item.due_date || item.target_closure_date || null,
      createdAt: item.created_at || null,
      ageDays: getAgeDays(item.created_at),
      escalationReason: reasons.join("; "),
      link: `/ncmrs/${item.id}`,
    });
  });
}

async function loadCapaRisks(collectedRisks: EnterpriseRisk[]) {
  const { data, error } = await supabase.from("capas").select("*");

  if (error) {
    console.warn(error.message);
    return;
  }

  (data || []).forEach((item: any) => {
    const status = String(item.status || "open").toLowerCase();
    const severity = normalizeSeverity(item.severity || item.priority);
    const dueDate = item.due_date || item.effectiveness_due_date || null;

    const isRisk =
      status !== "closed" ||
      isOverdue(dueDate, status) ||
      item.effectiveness_rating === "not_effective" ||
      item.effectiveness_due_date ||
      severity === "critical" ||
      severity === "high";

    if (!isRisk) return;

    const reasons = [
      status !== "closed" ? "CAPA remains open" : "",
      isOverdue(dueDate, status) ? "CAPA due date overdue" : "",
      item.effectiveness_rating === "not_effective" ? "CAPA effectiveness failed" : "",
      item.implemented_by && !item.effectiveness_check ? "Effectiveness verification pending" : "",
      severity === "critical" || severity === "high" ? "High severity CAPA" : "",
    ].filter(Boolean);

    collectedRisks.push({
      id: `capa-${item.id}`,
      source: "CAPA",
      sourceTable: "capas",
      recordId: item.id,
      recordNumber: item.capa_number || item.record_number || item.title || "CAPA",
      title: item.title || item.problem_statement || "CAPA risk",
      riskDescription: reasons.join("; ") || "CAPA risk item",
      severity: reasons.some((reason) => reason.includes("failed")) ? "critical" : severity,
      status,
      owner: item.owner || item.assigned_to || item.created_by || "Unassigned",
      dueDate,
      createdAt: item.created_at || null,
      ageDays: getAgeDays(item.created_at),
      escalationReason: reasons.join("; "),
      link: `/capa/${item.id}`,
    });
  });
}

async function loadComplaintRisks(collectedRisks: EnterpriseRisk[]) {
  const { data, error } = await supabase.from("complaints").select("*");

  if (error) {
    console.warn(error.message);
    return;
  }

  (data || []).forEach((item: any) => {
    const status = String(item.status || "open").toLowerCase();
    const severity = normalizeSeverity(item.severity);
    const isReportable =
      item.mdr_assessment_required ||
      item.regulatory_assessment === "reportable" ||
      item.regulatory_assessment === "pending";

    const isRisk =
      status !== "closed" ||
      severity === "critical" ||
      isReportable ||
      item.potential_patient_impact ||
      item.potential_safety_issue ||
      item.capa_required ||
      item.ncmr_required;

    if (!isRisk) return;

    const reasons = [
      status !== "closed" ? "Complaint remains open" : "",
      severity === "critical" ? "Critical complaint" : "",
      isReportable ? "MDR/reportability assessment required or pending" : "",
      item.potential_patient_impact ? "Potential patient impact" : "",
      item.potential_safety_issue ? "Potential safety issue" : "",
      item.capa_required ? "CAPA triggered" : "",
      item.ncmr_required ? "NCMR triggered" : "",
    ].filter(Boolean);

    collectedRisks.push({
      id: `complaint-${item.id}`,
      source: "Complaint",
      sourceTable: "complaints",
      recordId: item.id,
      recordNumber: item.complaint_number || item.record_number || "Complaint",
      title: item.complaint_title || item.title || "Complaint risk",
      riskDescription: reasons.join("; ") || "Complaint risk item",
      severity: item.potential_patient_impact || item.potential_safety_issue ? "critical" : severity,
      status,
      owner: item.owner || item.assigned_to || item.created_by || "Unassigned",
      dueDate: item.due_date || item.mdr_due_date || null,
      createdAt: item.created_at || item.date_received || null,
      ageDays: getAgeDays(item.created_at || item.date_received),
      escalationReason: reasons.join("; "),
      link: `/complaints/${item.id}`,
    });
  });
}

async function loadAuditRisks(collectedRisks: EnterpriseRisk[]) {
  // ==========================
  // OPEN AUDITS
  // ==========================
  const { data: audits, error: auditError } = await supabase
    .from("audits")
    .select("*");

  if (auditError) {
    console.warn(auditError.message);
  }

  (audits || []).forEach((audit: any) => {
    const status = String(audit.status || "open").toLowerCase();
    const dueDate = audit.due_date || audit.target_date || audit.audit_date || null;

    const isRisk =
      !isClosedStatus(status) ||
      isOverdue(dueDate, status);

    if (!isRisk) return;

    const reasons = [
      !isClosedStatus(status) ? "Audit remains open" : "",
      isOverdue(dueDate, status) ? "Audit overdue or past due" : "",
    ].filter(Boolean);

    collectedRisks.push({
      id: `audit-${audit.id}`,
      source: "Audit",
      sourceTable: "audits",
      recordId: audit.id,
      recordNumber: audit.audit_number || audit.record_number || "Audit",
      title: audit.audit_title || audit.title || "Open Audit",
      riskDescription: reasons.join("; ") || "Open audit requires attention",
      severity: isOverdue(dueDate, status) ? "high" : "medium",
      status,
      owner: audit.audit_owner || audit.auditor || audit.owner || audit.created_by || "Unassigned",
      dueDate,
      createdAt: audit.created_at || audit.audit_date || null,
      ageDays: getAgeDays(audit.created_at || audit.audit_date),
      escalationReason: reasons.join("; "),
      link: `/audits/${audit.id}`,
    });
  });

  // ==========================
  // AUDIT FINDINGS
  // ==========================
  const { data: findings, error: findingError } = await supabase
    .from("audit_findings")
    .select("*");

  if (findingError) {
    console.warn(findingError.message);
    return;
  }

  (findings || []).forEach((item: any) => {
    const status = String(item.finding_status || item.status || "open").toLowerCase();
    const severity = normalizeSeverity(item.finding_severity || item.severity);
    const dueDate = item.due_date || item.target_date || null;

    const isRisk =
      !isClosedStatus(status) ||
      severity === "critical" ||
      severity === "high" ||
      item.capa_required ||
      item.scar_required ||
      item.linked_capa_id ||
      item.linked_scar_id ||
      isOverdue(dueDate, status);

    if (!isRisk) return;

    const reasons = [
      !isClosedStatus(status) ? "Audit finding remains open" : "",
      severity === "critical" || severity === "high" ? "Major/Critical audit finding" : "",
      item.capa_required ? "CAPA required" : "",
      item.scar_required ? "SCAR required" : "",
      isOverdue(dueDate, status) ? "Audit finding overdue" : "",
    ].filter(Boolean);

    collectedRisks.push({
      id: `audit-finding-${item.id}`,
      source: "Audit",
      sourceTable: "audit_findings",
      recordId: item.id,
      recordNumber: item.finding_number || item.audit_number || "Audit Finding",
      title: item.finding_title || item.title || "Audit finding risk",
      riskDescription: reasons.join("; ") || "Audit finding risk item",
      severity,
      status,
      owner: item.owner || item.assigned_to || item.created_by || "Unassigned",
      dueDate,
      createdAt: item.created_at || null,
      ageDays: getAgeDays(item.created_at),
      escalationReason: reasons.join("; "),
      link: item.audit_id ? `/audits/${item.audit_id}` : "/audits",
    });
  });
}

async function loadScarRisks(collectedRisks: EnterpriseRisk[]) {
  const { data, error } = await supabase.from("scars").select("*");

  if (error) {
    console.warn(error.message);
    return;
  }

  (data || []).forEach((item: any) => {
    const status = String(item.status || item.scar_status || "open").toLowerCase();
    const severity = normalizeSeverity(item.severity || item.priority);
    const dueDate = item.due_date || item.response_due_date || item.effectiveness_due_date || null;

    const isRisk =
      status !== "closed" ||
      isOverdue(dueDate, status) ||
      item.effectiveness_rating === "not_effective" ||
      severity === "critical" ||
      severity === "high";

    if (!isRisk) return;

    const reasons = [
      status !== "closed" ? "SCAR remains open" : "",
      isOverdue(dueDate, status) ? "Supplier response or effectiveness overdue" : "",
      item.effectiveness_rating === "not_effective" ? "SCAR effectiveness failed" : "",
      severity === "critical" || severity === "high" ? "High severity supplier issue" : "",
    ].filter(Boolean);

    collectedRisks.push({
      id: `scar-${item.id}`,
      source: "SCAR",
      sourceTable: "scars",
      recordId: item.id,
      recordNumber: item.scar_number || item.record_number || "SCAR",
      title: item.title || item.scar_title || "Supplier corrective action risk",
      riskDescription: reasons.join("; ") || "SCAR risk item",
      severity: item.effectiveness_rating === "not_effective" ? "critical" : severity,
      status,
      owner: item.owner || item.supplier_name || item.created_by || "Unassigned",
      dueDate,
      createdAt: item.created_at || null,
      ageDays: getAgeDays(item.created_at),
      escalationReason: reasons.join("; "),
      link: `/supplier-quality/scars/${item.id}`,
    });
  });
}

async function loadOosRisks(collectedRisks: EnterpriseRisk[]) {
  const { data, error } = await supabase
    .from("oos_oot_investigations")
    .select("*");

  if (error) {
    console.warn(error.message);
    return;
  }

  (data || []).forEach((item: any) => {
    const status = String(item.status || "open").toLowerCase();
    const isRisk =
      status !== "closed" ||
      item.product_impact ||
      item.systemic_issue ||
      item.escalation_required ||
      item.ncmr_required;

    if (!isRisk) return;

    const reasons = [
      status !== "closed" ? "OOS/OOT investigation remains open" : "",
      item.product_impact ? "Product impact identified" : "",
      item.systemic_issue ? "Systemic issue identified" : "",
      item.escalation_required ? "Escalation required" : "",
      item.ncmr_required ? "NCMR required" : "",
    ].filter(Boolean);

    collectedRisks.push({
      id: `oos-${item.id}`,
      source: "OOS/OOT",
      sourceTable: "oos_oot_investigations",
      recordId: item.id,
      recordNumber: item.investigation_number || item.record_number || "OOS/OOT",
      title: item.title || item.investigation_title || "OOS/OOT risk",
      riskDescription: reasons.join("; ") || "OOS/OOT risk item",
      severity: item.product_impact || item.systemic_issue ? "critical" : "medium",
      status,
      owner: item.owner || item.assigned_to || item.created_by || "Unassigned",
      dueDate: item.due_date || item.target_closure_date || null,
      createdAt: item.created_at || null,
      ageDays: getAgeDays(item.created_at),
      escalationReason: reasons.join("; "),
      link: `/oos-oot/${item.id}`,
    });
  });
}

async function loadChangeControlRisks(collectedRisks: EnterpriseRisk[]) {
  const { data, error } = await supabase.from("change_controls").select("*");

  if (error) {
    console.warn(error.message);
    return;
  }

  (data || []).forEach((item: any) => {
    const status = String(item.status || "open").toLowerCase();
    const severity = normalizeSeverity(item.risk_level || item.severity);
    const dueDate = item.target_implementation_date || item.due_date || null;

    const verificationFailed = String(item.status || "").toLowerCase() === "verification_failed";

    const isRisk =
      !isClosedStatus(status) ||
      verificationFailed ||
      isOverdue(dueDate, status) ||
      severity === "critical" ||
      severity === "high";

    if (!isRisk) return;

    const reasons = [
      status !== "closed" ? "Change control remains open" : "",
      verificationFailed ? "Verification failed" : "",
      isOverdue(dueDate, status) ? "Implementation overdue" : "",
      severity === "critical" || severity === "high" ? "High-risk change" : "",
    ].filter(Boolean);

    collectedRisks.push({
      id: `change-${item.id}`,
      source: "Change Control",
      sourceTable: "change_controls",
      recordId: item.id,
      recordNumber: item.change_number || item.record_number || "Change",
      title: item.change_title || item.title || "Change control risk",
      riskDescription: reasons.join("; ") || "Change control risk item",
      severity,
      status,
      owner: item.owner || item.change_owner || item.created_by || "Unassigned",
      dueDate,
      createdAt: item.created_at || null,
      ageDays: getAgeDays(item.created_at),
      escalationReason: reasons.join("; "),
      link: `/change-control/${item.id}`,
    });
  });
}

function RiskTable({
  risks,
  compact = false,
}: {
  risks: EnterpriseRisk[];
  compact?: boolean;
}) {
  if (risks.length === 0) {
    return <div style={infoBoxStyle}>No risk records match the current criteria.</div>;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Source</th>
            <th style={thStyle}>Record</th>
            <th style={thStyle}>Risk</th>
            <th style={thStyle}>Severity</th>
            {!compact ? <th style={thStyle}>Owner</th> : null}
            <th style={thStyle}>Age</th>
            <th style={thStyle}>Due Date</th>
            <th style={thStyle}>Status</th>
            {!compact ? <th style={thStyle}>Action</th> : null}
          </tr>
        </thead>
        <tbody>
          {risks.map((risk) => (
            <tr key={risk.id}>
              <td style={tdStyle}>
                <strong>{risk.source}</strong>
              </td>
              <td style={tdStyle}>{risk.recordNumber}</td>
              <td style={tdStyle}>
                <strong>{risk.title}</strong>
                <div style={smallTextStyle}>{risk.riskDescription}</div>
              </td>
              <td style={tdStyle}>
                <SeverityBadge severity={risk.severity} />
              </td>
              {!compact ? <td style={tdStyle}>{risk.owner}</td> : null}
              <td style={tdStyle}>{risk.ageDays} days</td>
              <td style={tdStyle}>{risk.dueDate || "N/A"}</td>
              <td style={tdStyle}>
                <StatusBadge status={risk.status} />
              </td>
              {!compact ? (
                <td style={tdStyle}>
                  <Link href={risk.link}>Open</Link>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RiskKpiCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: "blue" | "green" | "orange" | "red" | "purple";
}) {
  const colorMap = {
    blue: "#2563eb",
    green: "#15803d",
    orange: "#c2410c",
    red: "#b91c1c",
    purple: "#7c3aed",
  };

  return (
    <div style={{ ...kpiCardStyle, borderLeft: `7px solid ${colorMap[tone]}` }}>
      <div style={smallTextStyle}>{label}</div>
      <div style={{ fontSize: "30px", fontWeight: 900, color: colorMap[tone] }}>
        {value}
      </div>
    </div>
  );
}

function DistributionCard({
  title,
  items,
}: {
  title: string;
  items: DistributionItem[];
}) {
  return (
    <section style={cardStyle}>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      {items.length === 0 ? (
        <div style={infoBoxStyle}>No data available.</div>
      ) : (
        items.map((item) => (
          <div key={item.label} style={distributionRowStyle}>
            <span>{formatLabel(item.label)}</span>
            <strong>{item.count}</strong>
          </div>
        ))
      )}
    </section>
  );
}

function SeverityBadge({ severity }: { severity: RiskSeverity }) {
  const styleMap: Record<RiskSeverity, React.CSSProperties> = {
    critical: {
      background: "#fee2e2",
      color: "#991b1b",
      border: "1px solid #fca5a5",
    },
    high: {
      background: "#ffedd5",
      color: "#9a3412",
      border: "1px solid #fdba74",
    },
    medium: {
      background: "#fef3c7",
      color: "#92400e",
      border: "1px solid #fcd34d",
    },
    low: {
      background: "#dcfce7",
      color: "#166534",
      border: "1px solid #86efac",
    },
  };

  return (
    <span style={{ ...pillStyle, ...styleMap[severity] }}>
      {formatLabel(severity)}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalized = String(status || "open").replaceAll("_", " ").toLowerCase();
  const approved = normalized === "closed" || normalized === "approved" || normalized === "completed";

  return (
    <span
      style={{
        ...pillStyle,
        background: approved ? "#dcfce7" : "#dbeafe",
        color: approved ? "#166534" : "#1d4ed8",
        border: approved ? "1px solid #86efac" : "1px solid #93c5fd",
      }}
    >
      {formatLabel(normalized)}
    </span>
  );
}

function normalizeSeverity(value: string | null | undefined): RiskSeverity {
  const normalized = String(value || "").toLowerCase();

  if (normalized.includes("critical")) return "critical";
  if (normalized.includes("high") || normalized.includes("major")) return "high";
  if (normalized.includes("medium") || normalized.includes("moderate")) return "medium";

  return "low";
}

function getSeverityScore(severity: RiskSeverity) {
  if (severity === "critical") return 4;
  if (severity === "high") return 3;
  if (severity === "medium") return 2;
  return 1;
}

function isClosedStatus(status: string) {
  const normalized = String(status || "").toLowerCase();
  return ["closed", "complete", "completed", "approved", "cancelled", "canceled"].includes(normalized);
}

function isOverdue(dueDate: string | null, status: string) {
  if (!dueDate || isClosedStatus(status)) return false;
  return String(dueDate).slice(0, 10) < new Date().toISOString().slice(0, 10);
}

function isOlderThan(date: string | null | undefined, days: number) {
  return getAgeDays(date) > days;
}

function getAgeDays(date: string | null | undefined) {
  if (!date) return 0;
  const start = new Date(date).getTime();
  if (Number.isNaN(start)) return 0;
  const now = new Date().getTime();
  return Math.max(0, Math.floor((now - start) / (1000 * 60 * 60 * 24)));
}

function buildDistribution(items: EnterpriseRisk[], field: keyof EnterpriseRisk): DistributionItem[] {
  const counts: Record<string, number> = {};

  items.forEach((item) => {
    const label = String(item[field] || "N/A");
    counts[label] = (counts[label] || 0) + 1;
  });

  return Object.entries(counts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

function buildAgingDistribution(items: EnterpriseRisk[]): DistributionItem[] {
  const buckets = {
    "0–30 Days": 0,
    "31–60 Days": 0,
    "61–90 Days": 0,
    "90+ Days": 0,
  };

  items.forEach((item) => {
    if (item.ageDays <= 30) buckets["0–30 Days"] += 1;
    else if (item.ageDays <= 60) buckets["31–60 Days"] += 1;
    else if (item.ageDays <= 90) buckets["61–90 Days"] += 1;
    else buckets["90+ Days"] += 1;
  });

  return Object.entries(buckets).map(([label, count]) => ({ label, count }));
}

function formatLabel(value: string) {
  return String(value || "N/A")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
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
  gap: "16px",
  alignItems: "flex-start",
  flexWrap: "wrap",
  marginBottom: "20px",
};

const eyebrowStyle: React.CSSProperties = {
  fontSize: "12px",
  letterSpacing: "0.08em",
  color: "#6b7280",
  fontWeight: 800,
};

const subtleText: React.CSSProperties = {
  color: "#6b7280",
};

const smallTextStyle: React.CSSProperties = {
  color: "#6b7280",
  fontSize: "12px",
};

const buttonRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
};

const darkButtonStyle: React.CSSProperties = {
  background: "#111827",
  color: "white",
  padding: "10px 14px",
  borderRadius: "8px",
  textDecoration: "none",
  fontWeight: 700,
};

const blueButtonStyle: React.CSSProperties = {
  background: "#2563eb",
  color: "white",
  padding: "10px 14px",
  borderRadius: "8px",
  textDecoration: "none",
  fontWeight: 700,
};

const cardStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid #d1d5db",
  borderRadius: "16px",
  padding: "20px",
  marginBottom: "20px",
};

const kpiGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: "14px",
  marginBottom: "20px",
};

const gridTwoColumnStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: "18px",
  marginBottom: "20px",
};

const kpiCardStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid #d1d5db",
  borderRadius: "14px",
  padding: "16px",
};

const sectionHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "14px",
  alignItems: "flex-start",
  flexWrap: "wrap",
  marginBottom: "16px",
};

const filterRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
};

const inputStyle: React.CSSProperties = {
  padding: "10px",
  borderRadius: "8px",
  border: "1px solid #d1d5db",
  minWidth: "180px",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  borderBottom: "1px solid #d1d5db",
  padding: "10px",
  color: "#374151",
  fontSize: "13px",
};

const tdStyle: React.CSSProperties = {
  borderBottom: "1px solid #e5e7eb",
  padding: "10px",
  verticalAlign: "top",
};

const distributionRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  borderBottom: "1px solid #e5e7eb",
  padding: "10px 0",
};

const infoBoxStyle: React.CSSProperties = {
  background: "#eff6ff",
  color: "#1e3a8a",
  border: "1px solid #bfdbfe",
  borderRadius: "12px",
  padding: "14px",
};

const pillStyle: React.CSSProperties = {
  display: "inline-block",
  borderRadius: "999px",
  padding: "5px 10px",
  fontSize: "12px",
  fontWeight: 800,
  whiteSpace: "nowrap",
};
