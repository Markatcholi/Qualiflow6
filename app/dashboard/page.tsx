"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type TrendItem = {
  label: string;
  count: number;
};

type NotificationItem = {
  type: string;
  message: string;
  link: string;
};

type SupplierCount = {
  supplier: string;
  count: number;
};

export default function DashboardPage() {
  const [ncmrOpen, setNcmrOpen] = useState(0);
  const [ncmrInvestigation, setNcmrInvestigation] = useState(0);
  const [capaOpen, setCapaOpen] = useState(0);
  const [capaOverdue, setCapaOverdue] = useState(0);

  const [ncmrTotal, setNcmrTotal] = useState(0);
  const [ncmrClosed, setNcmrClosed] = useState(0);
  const [capaTotal, setCapaTotal] = useState(0);
  const [capaClosed, setCapaClosed] = useState(0);

  const [avgNcmrCloseDays, setAvgNcmrCloseDays] = useState("0.0");
  const [avgCapaCloseDays, setAvgCapaCloseDays] = useState("0.0");

  const [capaOverdueRate, setCapaOverdueRate] = useState("0.0");
  const [capaDueSoon, setCapaDueSoon] = useState(0);

  const [capaAwaitingEffectiveness, setCapaAwaitingEffectiveness] = useState(0);
  const [capaEffectivenessOverdue, setCapaEffectivenessOverdue] = useState(0);
  const [capaEffectivenessDueSoon, setCapaEffectivenessDueSoon] = useState(0);

  const [supplierScarRequired, setSupplierScarRequired] = useState(0);
  const [openSupplierCapas, setOpenSupplierCapas] = useState(0);
  const [openScars, setOpenScars] = useState(0);
  const [topSuppliers, setTopSuppliers] = useState<SupplierCount[]>([]);

  const [oosTotal, setOosTotal] = useState(0);
  const [oosOpen, setOosOpen] = useState(0);
  const [oosClosed, setOosClosed] = useState(0);
  const [oosProductImpact, setOosProductImpact] = useState(0);
  const [oosNcmrRequired, setOosNcmrRequired] = useState(0);
  const [oosSystemicIssues, setOosSystemicIssues] = useState(0);
  const [oosEscalations, setOosEscalations] = useState(0);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const [ncmrTrend, setNcmrTrend] = useState<TrendItem[]>([]);
  const [capaTrend, setCapaTrend] = useState<TrendItem[]>([]);
  const [oosTrend, setOosTrend] = useState<TrendItem[]>([]);

  const [auditTotal, setAuditTotal] = useState(0);
  const [auditOpen, setAuditOpen] = useState(0);
  const [auditClosed, setAuditClosed] = useState(0);
  const [auditOverdue, setAuditOverdue] = useState(0);
  const [findingTotal, setFindingTotal] = useState(0);
  const [findingOpen, setFindingOpen] = useState(0);
  const [findingClosed, setFindingClosed] = useState(0);
  const [majorFindings, setMajorFindings] = useState(0);
  const [criticalFindings, setCriticalFindings] = useState(0);
  const [findingsRequiringCapa, setFindingsRequiringCapa] = useState(0);
  const [auditTrend, setAuditTrend] = useState<TrendItem[]>([]);
  const [findingTrend, setFindingTrend] = useState<TrendItem[]>([]);

  const getLast6Months = () => {
    const months: { key: string; label: string }[] = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const key = `${year}-${month}`;
      const label = d.toLocaleString("en-US", {
        month: "short",
        year: "2-digit",
      });

      months.push({ key, label });
    }

    return months;
  };

  const buildTrend = (items: any[]) => {
    const months = getLast6Months();
    const counts: Record<string, number> = {};

    months.forEach((m) => {
      counts[m.key] = 0;
    });

    items.forEach((item) => {
      if (!item.created_at) return;

      const d = new Date(item.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

      if (counts[key] !== undefined) {
        counts[key] += 1;
      }
    });

    return months.map((m) => ({
      label: m.label,
      count: counts[m.key],
    }));
  };

  const daysBetween = (dateString: string) => {
    const start = new Date(dateString).getTime();
    const now = new Date().getTime();
    return Math.floor((now - start) / (1000 * 60 * 60 * 24));
  };

  const buildSupplierCounts = (allNcmrs: any[]) => {
    const supplierMap: Record<string, number> = {};

    allNcmrs.forEach((ncmr: any) => {
      const supplier = (ncmr.supplier_name || "").trim();
      if (!supplier) return;
      supplierMap[supplier] = (supplierMap[supplier] || 0) + 1;
    });

    const sorted = Object.entries(supplierMap)
      .map(([supplier, count]) => ({ supplier, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    setTopSuppliers(sorted);
  };

  const buildNotifications = (
    allNcmrs: any[],
    allCapas: any[],
    allOos: any[],
    allAudits: any[],
    allFindings: any[]
  ) => {
    const alerts: NotificationItem[] = [];

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    allCapas.forEach((capa: any) => {
      if (capa.status !== "closed" && capa.due_date && capa.due_date < todayStr) {
        alerts.push({
          type: "CAPA Overdue",
          message: `CAPA overdue: ${capa.title || "Untitled CAPA"} was due on ${capa.due_date}.`,
          link: `/capa/${capa.id}`,
        });
      }

      if (
        capa.status !== "closed" &&
        capa.implemented_by &&
        !capa.effectiveness_check &&
        capa.effectiveness_due_date &&
        capa.effectiveness_due_date < todayStr
      ) {
        alerts.push({
          type: "Effectiveness Overdue",
          message: `Effectiveness check overdue for CAPA: ${capa.title || "Untitled CAPA"}.`,
          link: `/capa/${capa.id}`,
        });
      }

      if (
        capa.status !== "closed" &&
        capa.effectiveness_rating === "not_effective" &&
        !capa.followup_capa_id
      ) {
        alerts.push({
          type: "Follow-up CAPA Needed",
          message: `CAPA rated Not Effective and needs follow-up CAPA: ${capa.title || "Untitled CAPA"}.`,
          link: `/capa/${capa.id}`,
        });
      }

      if (
        capa.status !== "closed" &&
        (capa.capa_type === "supplier_capa" || capa.capa_type === "scar")
      ) {
        alerts.push({
          type: "Open Supplier CAPA / SCAR",
          message: `${capa.capa_type === "scar" ? "SCAR" : "Supplier CAPA"} open for supplier ${capa.supplier_name || "N/A"}: ${capa.title || "Untitled"}.`,
          link: `/capa/${capa.id}`,
        });
      }
    });

    allNcmrs.forEach((ncmr: any) => {
      if (
        ncmr.status === "investigation" &&
        ncmr.investigation_opened_at &&
        daysBetween(ncmr.investigation_opened_at) > 10
      ) {
        alerts.push({
          type: "NCMR Stuck",
          message: `NCMR in investigation >10 days: ${ncmr.title || "Untitled NCMR"}.`,
          link: `/ncmrs/${ncmr.id}`,
        });
      }

      if (ncmr.status !== "closed" && ncmr.severity === "critical" && !ncmr.capa_id) {
        alerts.push({
          type: "Critical NCMR Missing CAPA",
          message: `Critical NCMR requires CAPA: ${ncmr.title || "Untitled NCMR"}.`,
          link: `/ncmrs/${ncmr.id}`,
        });
      }

      if (
        ncmr.status !== "closed" &&
        ncmr.severity === "major" &&
        !ncmr.capa_id &&
        !ncmr.capa_justification
      ) {
        alerts.push({
          type: "Major NCMR Needs CAPA Decision",
          message: `Major NCMR needs CAPA or no-CAPA justification: ${ncmr.title || "Untitled NCMR"}.`,
          link: `/ncmrs/${ncmr.id}`,
        });
      }

      if (ncmr.status !== "closed" && ncmr.recurring_issue && !ncmr.capa_id) {
        alerts.push({
          type: "Recurring NCMR Missing CAPA",
          message: `Recurring NCMR should be reviewed for CAPA: ${ncmr.title || "Untitled NCMR"}.`,
          link: `/ncmrs/${ncmr.id}`,
        });
      }

      if (ncmr.status !== "closed" && ncmr.supplier_capa_required && !ncmr.capa_id) {
        alerts.push({
          type: "Supplier SCAR Required",
          message: `Supplier CAPA/SCAR required for ${ncmr.supplier_name || "supplier"}: ${ncmr.supplier_capa_reason || ncmr.title || "Untitled NCMR"}.`,
          link: `/ncmrs/${ncmr.id}`,
        });
      }

      if (ncmr.status !== "closed" && ncmr.supplier_capa_required && ncmr.capa_id) {
        alerts.push({
          type: "Supplier SCAR Linked",
          message: `Supplier CAPA/SCAR has been triggered for ${ncmr.supplier_name || "supplier"}: ${ncmr.title || "Untitled NCMR"}.`,
          link: `/ncmrs/${ncmr.id}`,
        });
      }
    });

    allOos.forEach((item: any) => {
      if (item.status !== "closed" && item.product_impact && item.ncmr_required && !item.linked_ncmr_number) {
        alerts.push({
          type: "OOS/OOT Missing NCMR Link",
          message: `${item.investigation_number || "OOS/OOT"} has product impact and requires NCMR linkage.`,
          link: `/oos-oot/${item.id}`,
        });
      }

      if (item.status !== "closed" && item.systemic_issue && item.escalation_required) {
        alerts.push({
          type: "OOS/OOT Escalation Required",
          message: `${item.investigation_number || "OOS/OOT"} has systemic issue requiring escalation.`,
          link: `/oos-oot/${item.id}`,
        });
      }
    });

    allAudits.forEach((audit: any) => {
      if (audit.status !== "closed" && audit.audit_date && audit.audit_date < todayStr) {
        alerts.push({
          type: "Audit Overdue / Past Due",
          message: `Audit past due or still open: ${audit.audit_number || "AUD"} - ${audit.audit_title || "Untitled Audit"}.`,
          link: `/audits/${audit.id}/report`,
        });
      }
    });

    allFindings.forEach((finding: any) => {
      if (finding.finding_status !== "closed" && finding.finding_severity === "critical") {
        alerts.push({
          type: "Critical Audit Finding Open",
          message: `Critical audit finding open: ${finding.finding_title || "Untitled Finding"}.`,
          link: finding.capa_id ? `/capa/${finding.capa_id}` : "/audits",
        });
      }

      if (finding.finding_status !== "closed" && finding.capa_required && !finding.capa_id) {
        alerts.push({
          type: "Audit Finding Missing CAPA",
          message: `Audit finding requires CAPA but has no linked CAPA: ${finding.finding_title || "Untitled Finding"}.`,
          link: "/audits",
        });
      }
    });

    setNotifications(alerts);
  };

  const fetchData = async () => {
    const { data: ncmrAllData, error: ncmrAllError } = await supabase
      .from("ncmrs")
      .select("*");

    if (ncmrAllError) {
      alert(ncmrAllError.message);
      return;
    }

    const allNcmrs = ncmrAllData || [];
    setNcmrTotal(allNcmrs.length);

    const closedNcmrs = allNcmrs.filter((item: any) => item.status === "closed");
    setNcmrClosed(closedNcmrs.length);

    const openNcmrs = allNcmrs.filter((item: any) => item.status === "open");
    setNcmrOpen(openNcmrs.length);

    const investigationNcmrs = allNcmrs.filter((item: any) => item.status === "investigation");
    setNcmrInvestigation(investigationNcmrs.length);

    const supplierScarNcmrs = allNcmrs.filter((item: any) => item.supplier_capa_required);
    setSupplierScarRequired(supplierScarNcmrs.length);

    buildSupplierCounts(allNcmrs);

    const ncmrDurations = closedNcmrs
      .filter((item: any) => item.created_at && item.closed_at)
      .map((item: any) => {
        const created = new Date(item.created_at).getTime();
        const closed = new Date(item.closed_at).getTime();
        return (closed - created) / (1000 * 60 * 60 * 24);
      });

    if (ncmrDurations.length > 0) {
      const avg = ncmrDurations.reduce((sum: number, d: number) => sum + d, 0) / ncmrDurations.length;
      setAvgNcmrCloseDays(avg.toFixed(1));
    } else {
      setAvgNcmrCloseDays("0.0");
    }

    setNcmrTrend(buildTrend(allNcmrs));

    const { data: capaAllData, error: capaAllError } = await supabase
      .from("capas")
      .select("*");

    if (capaAllError) {
      alert(capaAllError.message);
      return;
    }

    const allCapas = capaAllData || [];
    setCapaTotal(allCapas.length);

    const closedCapas = allCapas.filter((item: any) => item.status === "closed");
    setCapaClosed(closedCapas.length);

    const activeCapas = allCapas.filter((item: any) => item.status !== "closed");
    setCapaOpen(activeCapas.length);

    const supplierCapas = allCapas.filter((item: any) => item.status !== "closed" && item.capa_type === "supplier_capa");
    setOpenSupplierCapas(supplierCapas.length);

    const scars = allCapas.filter((item: any) => item.status !== "closed" && item.capa_type === "scar");
    setOpenScars(scars.length);

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    const next7 = new Date();
    next7.setDate(today.getDate() + 7);
    const next7Str = next7.toISOString().split("T")[0];

    const overdueCapas = activeCapas.filter((item: any) => item.due_date && item.due_date < todayStr);
    setCapaOverdue(overdueCapas.length);

    const overdueRate = activeCapas.length > 0 ? ((overdueCapas.length / activeCapas.length) * 100).toFixed(1) : "0.0";
    setCapaOverdueRate(overdueRate);

    const dueSoonCapas = activeCapas.filter((item: any) => item.due_date && item.due_date >= todayStr && item.due_date <= next7Str);
    setCapaDueSoon(dueSoonCapas.length);

    const awaitingEffectiveness = allCapas.filter((item: any) => item.status !== "closed" && item.implemented_by && !item.effectiveness_check);
    setCapaAwaitingEffectiveness(awaitingEffectiveness.length);

    const overdueEffectiveness = allCapas.filter((item: any) =>
      item.status !== "closed" &&
      item.implemented_by &&
      !item.effectiveness_check &&
      item.effectiveness_due_date &&
      item.effectiveness_due_date < todayStr
    );
    setCapaEffectivenessOverdue(overdueEffectiveness.length);

    const dueSoonEffectiveness = allCapas.filter((item: any) =>
      item.status !== "closed" &&
      item.implemented_by &&
      !item.effectiveness_check &&
      item.effectiveness_due_date &&
      item.effectiveness_due_date >= todayStr &&
      item.effectiveness_due_date <= next7Str
    );
    setCapaEffectivenessDueSoon(dueSoonEffectiveness.length);

    const capaDurations = closedCapas
      .filter((item: any) => item.created_at && item.closed_at)
      .map((item: any) => {
        const created = new Date(item.created_at).getTime();
        const closed = new Date(item.closed_at).getTime();
        return (closed - created) / (1000 * 60 * 60 * 24);
      });

    if (capaDurations.length > 0) {
      const avg = capaDurations.reduce((sum: number, d: number) => sum + d, 0) / capaDurations.length;
      setAvgCapaCloseDays(avg.toFixed(1));
    } else {
      setAvgCapaCloseDays("0.0");
    }

    setCapaTrend(buildTrend(allCapas));

    const { data: oosData, error: oosError } = await supabase
      .from("oos_oot_investigations")
      .select("*");

    if (oosError) {
      alert(oosError.message);
      return;
    }

    const allOos = oosData || [];
    setOosTotal(allOos.length);
    setOosOpen(allOos.filter((item: any) => item.status !== "closed").length);
    setOosClosed(allOos.filter((item: any) => item.status === "closed").length);
    setOosProductImpact(allOos.filter((item: any) => item.product_impact).length);
    setOosNcmrRequired(allOos.filter((item: any) => item.ncmr_required).length);
    setOosSystemicIssues(allOos.filter((item: any) => item.systemic_issue).length);
    setOosEscalations(allOos.filter((item: any) => item.escalation_required).length);
    setOosTrend(buildTrend(allOos));

    const { data: auditData, error: auditError } = await supabase
      .from("audits")
      .select("*");

    if (auditError) {
      alert(auditError.message);
      return;
    }

    const { data: findingData, error: findingError } = await supabase
      .from("audit_findings")
      .select("*");

    if (findingError) {
      alert(findingError.message);
      return;
    }

    const allAudits = auditData || [];
    const allFindings = findingData || [];

    setAuditTotal(allAudits.length);
    setAuditOpen(allAudits.filter((item: any) => item.status !== "closed").length);
    setAuditClosed(allAudits.filter((item: any) => item.status === "closed").length);
    setAuditOverdue(allAudits.filter((item: any) => item.status !== "closed" && item.audit_date && item.audit_date < todayStr).length);

    setFindingTotal(allFindings.length);
    setFindingOpen(allFindings.filter((item: any) => item.finding_status !== "closed").length);
    setFindingClosed(allFindings.filter((item: any) => item.finding_status === "closed").length);
    setMajorFindings(allFindings.filter((item: any) => item.finding_severity === "major").length);
    setCriticalFindings(allFindings.filter((item: any) => item.finding_severity === "critical").length);
    setFindingsRequiringCapa(allFindings.filter((item: any) => item.capa_required).length);
    setAuditTrend(buildTrend(allAudits));
    setFindingTrend(buildTrend(allFindings));

    buildNotifications(allNcmrs, allCapas, allOos, allAudits, allFindings);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const ncmrClosureRate = ncmrTotal > 0 ? ((ncmrClosed / ncmrTotal) * 100).toFixed(1) : "0.0";
  const capaClosureRate = capaTotal > 0 ? ((capaClosed / capaTotal) * 100).toFixed(1) : "0.0";
  const oosClosureRate = oosTotal > 0 ? ((oosClosed / oosTotal) * 100).toFixed(1) : "0.0";
  const auditClosureRate = auditTotal > 0 ? ((auditClosed / auditTotal) * 100).toFixed(1) : "0.0";
  const findingClosureRate = findingTotal > 0 ? ((findingClosed / findingTotal) * 100).toFixed(1) : "0.0";

  const renderTrend = (title: string, data: TrendItem[]) => {
    const max = Math.max(...data.map((d) => d.count), 1);

    return (
      <div style={{ padding: "15px", border: "1px solid #ccc" }}>
        <strong>{title}</strong>

        <div style={{ marginTop: "10px" }}>
          {data.map((item) => (
            <div key={item.label} style={{ marginBottom: "10px" }}>
              <div style={{ fontSize: "14px", marginBottom: "4px" }}>
                {item.label}: {item.count}
              </div>

              <div style={{ background: "#eee", height: "12px", width: "100%", maxWidth: "300px" }}>
                <div
                  style={{
                    background: "#3b82f6",
                    height: "12px",
                    width: `${item.count > 0 ? Math.max((item.count / max) * 100, 5) : 0}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const totalHighPriorityAlerts = notifications.length;
  const totalOpenQualityItems = ncmrOpen + ncmrInvestigation + capaOpen + oosOpen + auditOpen + findingOpen;
  const totalRiskEvents = capaOverdue + capaEffectivenessOverdue + oosProductImpact + oosSystemicIssues + auditOverdue + criticalFindings + majorFindings;
  const overallClosureRate =
    ncmrTotal + capaTotal + oosTotal + auditTotal + findingTotal > 0
      ? (((ncmrClosed + capaClosed + oosClosed + auditClosed + findingClosed) /
          (ncmrTotal + capaTotal + oosTotal + auditTotal + findingTotal)) * 100).toFixed(1)
      : "0.0";
  const executiveRiskScore =
    capaOverdue * 3 +
    capaEffectivenessOverdue * 3 +
    oosProductImpact * 4 +
    oosSystemicIssues * 5 +
    auditOverdue * 2 +
    criticalFindings * 5 +
    majorFindings * 3 +
    ncmrInvestigation * 1;

  const executiveHealth =
    executiveRiskScore === 0
      ? "Controlled"
      : executiveRiskScore < 10
      ? "Watch"
      : executiveRiskScore < 25
      ? "Elevated"
      : "Critical";

  const getStatusColor = (value: number, riskType: "risk" | "warning" = "risk") => {
    if (value === 0) return "#15803d";
    if (riskType === "warning") return "#b45309";
    return "#b91c1c";
  };

  const cardStyle = (borderColor: string): React.CSSProperties => ({
    border: `2px solid ${borderColor}`,
    borderRadius: "10px",
    padding: "16px",
    background: "#fff",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  });

  const sectionStyle: React.CSSProperties = {
    border: "1px solid #d1d5db",
    borderRadius: "10px",
    padding: "18px",
    marginBottom: "20px",
    background: "#fff",
  };

  const gridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: "14px",
    marginBottom: "20px",
  };

  const KpiCard = ({
    title,
    value,
    subtitle,
    color,
  }: {
    title: string;
    value: string | number;
    subtitle?: string;
    color: string;
  }) => (
    <div style={cardStyle(color)}>
      <div style={{ fontSize: "13px", fontWeight: 700, color: "#374151", marginBottom: "8px" }}>
        {title}
      </div>
      <div style={{ fontSize: "30px", fontWeight: 800, color }}>{value}</div>
      {subtitle ? <div style={{ marginTop: "6px", fontSize: "12px", color: "#6b7280" }}>{subtitle}</div> : null}
    </div>
  );

  return (
    <main style={{ padding: "24px", fontFamily: "Arial, sans-serif", background: "#f8fafc", minHeight: "100vh" }}>
      <div style={{ marginBottom: "22px" }}>
        <h1 style={{ marginBottom: "4px" }}>Executive Quality Dashboard</h1>
        <p style={{ margin: 0, color: "#4b5563" }}>
          NCMR, CAPA, OOS/OOT, Audit, Supplier Quality, and executive risk overview
        </p>

        <div style={{ marginTop: "16px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            onClick={() => window.open("/management-review/print", "_blank")}
            style={{
              padding: "10px 14px",
              background: "#2563eb",
              color: "white",
              borderRadius: "8px",
              border: "none",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Generate Management Review Report
          </button>

          <button
            onClick={() => window.print()}
            style={{
              padding: "10px 14px",
              background: "#374151",
              color: "white",
              borderRadius: "8px",
              border: "none",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Print Dashboard
          </button>
        </div>
      </div>

      <section style={sectionStyle}>
        <h2 style={{ marginTop: 0 }}>Executive Summary</h2>
        <div style={gridStyle}>
          <KpiCard title="Quality Health" value={executiveHealth} color={getStatusColor(executiveRiskScore)} subtitle={`Risk score: ${executiveRiskScore}`} />
          <KpiCard title="Total Open Quality Items" value={totalOpenQualityItems} color={getStatusColor(totalOpenQualityItems, "warning")} />
          <KpiCard title="Total Risk Events" value={totalRiskEvents} color={getStatusColor(totalRiskEvents)} />
          <KpiCard title="Overall Closure Rate" value={`${overallClosureRate}%`} color="#2563eb" />
        </div>
      </section>

      <section
        style={{
          ...sectionStyle,
          border: totalHighPriorityAlerts > 0 ? "2px solid #b91c1c" : "2px solid #15803d",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Notification Panel</h2>

        {notifications.length === 0 ? (
          <p style={{ color: "#15803d", fontWeight: 700 }}>No active quality alerts.</p>
        ) : (
          <ul style={{ paddingLeft: "20px" }}>
            {notifications.map((alert, index) => (
              <li key={index} style={{ marginBottom: "10px" }}>
                <strong style={{ color: "#b91c1c" }}>{alert.type}:</strong> {alert.message} <a href={alert.link}>Open</a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={sectionStyle}>
        <h2 style={{ marginTop: 0 }}>Executive Risk Snapshot</h2>
        <div style={gridStyle}>
          <KpiCard title="Active Alerts" value={totalHighPriorityAlerts} color={getStatusColor(totalHighPriorityAlerts)} />
          <KpiCard title="Overdue CAPAs" value={capaOverdue} color={getStatusColor(capaOverdue)} />
          <KpiCard title="OOS/OOT Product Impact" value={oosProductImpact} color={getStatusColor(oosProductImpact)} />
          <KpiCard title="OOS/OOT Systemic Issues" value={oosSystemicIssues} color={getStatusColor(oosSystemicIssues)} />
          <KpiCard title="Open Audit Findings" value={findingOpen} color={getStatusColor(findingOpen, "warning")} />
          <KpiCard title="Critical / Major Findings" value={criticalFindings + majorFindings} color={getStatusColor(criticalFindings + majorFindings)} />
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={{ marginTop: 0 }}>NCMR Performance</h2>
        <div style={gridStyle}>
          <KpiCard title="Total NCMRs" value={ncmrTotal} color="#2563eb" />
          <KpiCard title="Open NCMRs" value={ncmrOpen} color={getStatusColor(ncmrOpen, "warning")} />
          <KpiCard title="In Investigation" value={ncmrInvestigation} color={getStatusColor(ncmrInvestigation, "warning")} />
          <KpiCard title="Closed NCMRs" value={ncmrClosed} color="#15803d" />
          <KpiCard title="Closure Rate" value={`${ncmrClosureRate}%`} color="#2563eb" />
          <KpiCard title="Avg Close Time" value={`${avgNcmrCloseDays} d`} color="#374151" />
        </div>
        {renderTrend("NCMR Monthly Trend (Last 6 Months)", ncmrTrend)}
      </section>

      <section style={sectionStyle}>
        <h2 style={{ marginTop: 0 }}>CAPA Performance</h2>
        <div style={gridStyle}>
          <KpiCard title="Total CAPAs" value={capaTotal} color="#2563eb" />
          <KpiCard title="Active CAPAs" value={capaOpen} color={getStatusColor(capaOpen, "warning")} />
          <KpiCard title="Closed CAPAs" value={capaClosed} color="#15803d" />
          <KpiCard title="Closure Rate" value={`${capaClosureRate}%`} color="#2563eb" />
          <KpiCard title="Overdue CAPAs" value={capaOverdue} color={getStatusColor(capaOverdue)} />
          <KpiCard title="Overdue Rate" value={`${capaOverdueRate}%`} color={getStatusColor(capaOverdue)} />
          <KpiCard title="Due Next 7 Days" value={capaDueSoon} color={getStatusColor(capaDueSoon, "warning")} />
          <KpiCard title="Awaiting Effectiveness" value={capaAwaitingEffectiveness} color={getStatusColor(capaAwaitingEffectiveness, "warning")} />
          <KpiCard title="Effectiveness Overdue" value={capaEffectivenessOverdue} color={getStatusColor(capaEffectivenessOverdue)} />
          <KpiCard title="Effectiveness Due Soon" value={capaEffectivenessDueSoon} color={getStatusColor(capaEffectivenessDueSoon, "warning")} />
          <KpiCard title="Avg Close Time" value={`${avgCapaCloseDays} d`} color="#374151" />
        </div>
        {renderTrend("CAPA Monthly Trend (Last 6 Months)", capaTrend)}
      </section>

      <section style={sectionStyle}>
        <h2 style={{ marginTop: 0 }}>OOS / OOT / Environmental Monitoring</h2>
        <div style={gridStyle}>
          <KpiCard title="Total Investigations" value={oosTotal} color="#0f766e" />
          <KpiCard title="Open Investigations" value={oosOpen} color={getStatusColor(oosOpen, "warning")} />
          <KpiCard title="Closed Investigations" value={oosClosed} color="#15803d" />
          <KpiCard title="Closure Rate" value={`${oosClosureRate}%`} color="#0f766e" />
          <KpiCard title="Product Impact" value={oosProductImpact} color={getStatusColor(oosProductImpact)} />
          <KpiCard title="NCMR Required" value={oosNcmrRequired} color={getStatusColor(oosNcmrRequired)} />
          <KpiCard title="Systemic Issues" value={oosSystemicIssues} color={getStatusColor(oosSystemicIssues)} />
          <KpiCard title="Escalations" value={oosEscalations} color={getStatusColor(oosEscalations)} />
        </div>
        {renderTrend("OOS/OOT Monthly Trend (Last 6 Months)", oosTrend)}
      </section>

      <section style={sectionStyle}>
        <h2 style={{ marginTop: 0 }}>Audit Performance</h2>
        <div style={gridStyle}>
          <KpiCard title="Total Audits" value={auditTotal} color="#2563eb" />
          <KpiCard title="Open Audits" value={auditOpen} color={getStatusColor(auditOpen, "warning")} />
          <KpiCard title="Closed Audits" value={auditClosed} color="#15803d" />
          <KpiCard title="Audit Closure Rate" value={`${auditClosureRate}%`} color="#2563eb" />
          <KpiCard title="Overdue / Past Due Audits" value={auditOverdue} color={getStatusColor(auditOverdue)} />
          <KpiCard title="Total Findings" value={findingTotal} color="#374151" />
          <KpiCard title="Open Findings" value={findingOpen} color={getStatusColor(findingOpen, "warning")} />
          <KpiCard title="Findings Closure Rate" value={`${findingClosureRate}%`} color="#2563eb" />
          <KpiCard title="Major Findings" value={majorFindings} color={getStatusColor(majorFindings)} />
          <KpiCard title="Critical Findings" value={criticalFindings} color={getStatusColor(criticalFindings)} />
          <KpiCard title="Findings Requiring CAPA" value={findingsRequiringCapa} color={getStatusColor(findingsRequiringCapa, "warning")} />
        </div>
        {renderTrend("Audit Monthly Trend (Last 6 Months)", auditTrend)}
        <div style={{ marginTop: "14px" }}>
          {renderTrend("Audit Finding Monthly Trend (Last 6 Months)", findingTrend)}
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={{ marginTop: 0 }}>Supplier Quality</h2>
        <div style={gridStyle}>
          <KpiCard title="Supplier CAPA / SCAR Required NCMRs" value={supplierScarRequired} color={getStatusColor(supplierScarRequired, "warning")} />
          <KpiCard title="Open Supplier CAPAs" value={openSupplierCapas} color={getStatusColor(openSupplierCapas, "warning")} />
          <KpiCard title="Open SCARs" value={openScars} color={getStatusColor(openScars, "warning")} />
        </div>

        <div style={{ marginTop: "12px" }}>
          <strong>Top Suppliers by NCMR Count</strong>
          {topSuppliers.length === 0 ? (
            <p>No supplier NCMR data yet.</p>
          ) : (
            <ol>
              {topSuppliers.map((item) => (
                <li key={item.supplier}>{item.supplier}: {item.count}</li>
              ))}
            </ol>
          )}
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={{ marginTop: 0 }}>Quick Actions</h2>
        <a href="/ncmrs">NCMRs</a>
        {" | "}
        <a href="/capa">CAPAs</a>
        {" | "}
        <a href="/oos-oot">OOS/OOT</a>
        {" | "}
        <a href="/audits">Audits</a>
        {" | "}
        <a href="/management-review">Management Review</a>
        {" | "}
        <a href="/management-review/print">Create MR Report</a>
        {" | "}
        <a href="/audit">Audit Trail</a>
        {" | "}
        <a href="/admin/master-data">Admin Master Data</a>
      </section>
    </main>
  );
}
