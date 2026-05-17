"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

import ExecutiveSummarySection from "./components/ExecutiveSummarySection";
import NotificationPanelSection from "./components/NotificationPanelSection";
import ExecutiveRiskSnapshotSection from "./components/ExecutiveRiskSnapshotSection";
import NcmrPerformanceSection from "./components/NcmrPerformanceSection";
import CapaPerformanceSection from "./components/CapaPerformanceSection";
import EffectivenessIntelligenceSection from "./components/EffectivenessIntelligenceSection";
import OosPerformanceSection from "./components/OosPerformanceSection";
import AuditPerformanceSection from "./components/AuditPerformanceSection";
import SupplierQualitySection from "./components/SupplierQualitySection";
import QuickActionsSection from "./components/QuickActionsSection";

import {
  TrendItem,
  NotificationItem,
  SupplierCount,
} from "./components/DashboardComponents";

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

  const [capaEffective, setCapaEffective] = useState(0);
  const [capaPartiallyEffective, setCapaPartiallyEffective] = useState(0);
  const [capaNotEffective, setCapaNotEffective] = useState(0);
  const [capaEffectivenessRate, setCapaEffectivenessRate] = useState("0.0");
  const [capaFollowupRequired, setCapaFollowupRequired] = useState(0);

  const [scarEffective, setScarEffective] = useState(0);
  const [scarNotEffective, setScarNotEffective] = useState(0);
  const [scarEffectivenessRate, setScarEffectivenessRate] = useState("0.0");
  const [scarAwaitingEffectiveness, setScarAwaitingEffectiveness] = useState(0);
  const [supplierRecurrenceEvents, setSupplierRecurrenceEvents] = useState(0);

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
    allScars: any[],
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
    });

    allScars.forEach((scar: any) => {
      const scarStatus = scar.status || scar.scar_status;

      if (scarStatus !== "closed") {
        alerts.push({
          type: "Open SCAR",
          message: `Open SCAR: ${scar.title || scar.scar_title || "Untitled SCAR"}.`,
          link: `/supplier-quality/scars/${scar.id}`,
        });
      }

      if (
        scarStatus !== "closed" &&
        scar.effectiveness_verification_due_date &&
        scar.effectiveness_verification_due_date < todayStr &&
        !scar.effectiveness_verification
      ) {
        alerts.push({
          type: "SCAR Effectiveness Overdue",
          message: `SCAR effectiveness verification overdue: ${scar.title || scar.scar_title || "Untitled SCAR"}.`,
          link: `/supplier-quality/scars/${scar.id}`,
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

      if (
        ncmr.status !== "closed" &&
        ncmr.capa_evaluation_outcome === "required" &&
        !ncmr.linked_capa_id &&
        !ncmr.capa_id &&
        !ncmr.capa_not_required_justification
      ) {
        alerts.push({
          type: "CAPA Evaluation Required",
          message: `NCMR requires CAPA evaluation decision: ${ncmr.title || "Untitled NCMR"}.`,
          link: `/ncmrs/${ncmr.id}`,
        });
      }

      if (
        ncmr.status !== "closed" &&
        ncmr.scar_required &&
        !ncmr.linked_scar_id &&
        !ncmr.scar_justification
      ) {
        alerts.push({
          type: "SCAR Evaluation Required",
          message: `NCMR requires SCAR decision: ${ncmr.title || "Untitled NCMR"}.`,
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
          link: finding.linked_capa_id ? `/capa/${finding.linked_capa_id}` : "/audits",
        });
      }

      if (
        finding.finding_status !== "closed" &&
        finding.capa_evaluation_outcome === "required" &&
        !finding.linked_capa_id
      ) {
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
    setNcmrOpen(allNcmrs.filter((item: any) => item.status === "open").length);
    setNcmrInvestigation(allNcmrs.filter((item: any) => item.status === "investigation").length);
    setSupplierScarRequired(
      allNcmrs.filter((item: any) => item.scar_required || item.supplier_capa_required).length
    );

    buildSupplierCounts(allNcmrs);

    const ncmrDurations = closedNcmrs
      .filter((item: any) => item.created_at && item.closed_at)
      .map((item: any) => {
        const created = new Date(item.created_at).getTime();
        const closed = new Date(item.closed_at).getTime();
        return (closed - created) / (1000 * 60 * 60 * 24);
      });

    setAvgNcmrCloseDays(
      ncmrDurations.length > 0
        ? (ncmrDurations.reduce((sum: number, d: number) => sum + d, 0) / ncmrDurations.length).toFixed(1)
        : "0.0"
    );

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

    const supplierCapas = allCapas.filter(
      (item: any) => item.status !== "closed" && item.capa_type === "supplier_capa"
    );
    setOpenSupplierCapas(supplierCapas.length);

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    const next7 = new Date();
    next7.setDate(today.getDate() + 7);
    const next7Str = next7.toISOString().split("T")[0];

    const overdueCapas = activeCapas.filter((item: any) => item.due_date && item.due_date < todayStr);
    setCapaOverdue(overdueCapas.length);

    setCapaOverdueRate(
      activeCapas.length > 0
        ? ((overdueCapas.length / activeCapas.length) * 100).toFixed(1)
        : "0.0"
    );

    setCapaDueSoon(
      activeCapas.filter(
        (item: any) => item.due_date && item.due_date >= todayStr && item.due_date <= next7Str
      ).length
    );

    const awaitingEffectiveness = allCapas.filter(
      (item: any) => item.status !== "closed" && item.implemented_by && !item.effectiveness_check
    );
    setCapaAwaitingEffectiveness(awaitingEffectiveness.length);

    setCapaEffectivenessOverdue(
      allCapas.filter(
        (item: any) =>
          item.status !== "closed" &&
          item.implemented_by &&
          !item.effectiveness_check &&
          item.effectiveness_due_date &&
          item.effectiveness_due_date < todayStr
      ).length
    );

    setCapaEffectivenessDueSoon(
      allCapas.filter(
        (item: any) =>
          item.status !== "closed" &&
          item.implemented_by &&
          !item.effectiveness_check &&
          item.effectiveness_due_date &&
          item.effectiveness_due_date >= todayStr &&
          item.effectiveness_due_date <= next7Str
      ).length
    );

    const effectiveCapas = allCapas.filter((item: any) => item.effectiveness_rating === "effective");
    const partiallyEffectiveCapas = allCapas.filter((item: any) => item.effectiveness_rating === "partially_effective");
    const notEffectiveCapas = allCapas.filter((item: any) => item.effectiveness_rating === "not_effective");
    const completedEffectivenessCapas = effectiveCapas.length + partiallyEffectiveCapas.length + notEffectiveCapas.length;

    setCapaEffective(effectiveCapas.length);
    setCapaPartiallyEffective(partiallyEffectiveCapas.length);
    setCapaNotEffective(notEffectiveCapas.length);
    setCapaEffectivenessRate(
      completedEffectivenessCapas > 0
        ? ((effectiveCapas.length / completedEffectivenessCapas) * 100).toFixed(1)
        : "0.0"
    );
    setCapaFollowupRequired(
      allCapas.filter((item: any) => item.effectiveness_rating === "not_effective" && !item.followup_capa_id).length
    );

    const capaDurations = closedCapas
      .filter((item: any) => item.created_at && item.closed_at)
      .map((item: any) => {
        const created = new Date(item.created_at).getTime();
        const closed = new Date(item.closed_at).getTime();
        return (closed - created) / (1000 * 60 * 60 * 24);
      });

    setAvgCapaCloseDays(
      capaDurations.length > 0
        ? (capaDurations.reduce((sum: number, d: number) => sum + d, 0) / capaDurations.length).toFixed(1)
        : "0.0"
    );

    setCapaTrend(buildTrend(allCapas));

    const { data: scarData, error: scarError } = await supabase
      .from("scars")
      .select("*");

    if (scarError) {
      alert(scarError.message);
      return;
    }

    const allScars = scarData || [];
    const activeScars = allScars.filter((item: any) => (item.status || item.scar_status) !== "closed");
    setOpenScars(activeScars.length);

    const effectiveScars = allScars.filter((item: any) => item.effectiveness_rating === "effective");
    const notEffectiveScars = allScars.filter((item: any) => item.effectiveness_rating === "not_effective");
    const completedScarEffectiveness = effectiveScars.length + notEffectiveScars.length;

    setScarEffective(effectiveScars.length);
    setScarNotEffective(notEffectiveScars.length);
    setScarEffectivenessRate(
      completedScarEffectiveness > 0
        ? ((effectiveScars.length / completedScarEffectiveness) * 100).toFixed(1)
        : "0.0"
    );
    setScarAwaitingEffectiveness(
      allScars.filter(
        (item: any) =>
          (item.status || item.scar_status) !== "closed" &&
          !item.effectiveness_verification &&
          !item.effectiveness_rating
      ).length
    );

    setSupplierRecurrenceEvents(
      allNcmrs.filter((item: any) => item.recurring_issue || item.scar_required || item.linked_scar_id).length
    );

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
    setAuditOverdue(
      allAudits.filter((item: any) => item.status !== "closed" && item.audit_date && item.audit_date < todayStr).length
    );

    setFindingTotal(allFindings.length);
    setFindingOpen(allFindings.filter((item: any) => item.finding_status !== "closed").length);
    setFindingClosed(allFindings.filter((item: any) => item.finding_status === "closed").length);
    setMajorFindings(allFindings.filter((item: any) => item.finding_severity === "major").length);
    setCriticalFindings(allFindings.filter((item: any) => item.finding_severity === "critical").length);
    setFindingsRequiringCapa(
      allFindings.filter((item: any) => item.capa_required || item.linked_capa_id).length
    );
    setAuditTrend(buildTrend(allAudits));
    setFindingTrend(buildTrend(allFindings));

    buildNotifications(allNcmrs, allCapas, allScars, allOos, allAudits, allFindings);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const ncmrClosureRate = ncmrTotal > 0 ? ((ncmrClosed / ncmrTotal) * 100).toFixed(1) : "0.0";
  const capaClosureRate = capaTotal > 0 ? ((capaClosed / capaTotal) * 100).toFixed(1) : "0.0";
  const oosClosureRate = oosTotal > 0 ? ((oosClosed / oosTotal) * 100).toFixed(1) : "0.0";
  const auditClosureRate = auditTotal > 0 ? ((auditClosed / auditTotal) * 100).toFixed(1) : "0.0";
  const findingClosureRate = findingTotal > 0 ? ((findingClosed / findingTotal) * 100).toFixed(1) : "0.0";

  const totalHighPriorityAlerts = notifications.length;
  const totalOpenQualityItems = ncmrOpen + ncmrInvestigation + capaOpen + oosOpen + auditOpen + findingOpen + openScars;
  const totalRiskEvents =
    capaOverdue +
    capaEffectivenessOverdue +
    capaNotEffective +
    scarNotEffective +
    oosProductImpact +
    oosSystemicIssues +
    auditOverdue +
    criticalFindings +
    majorFindings;

  const overallClosureRate =
    ncmrTotal + capaTotal + oosTotal + auditTotal + findingTotal > 0
      ? (((ncmrClosed + capaClosed + oosClosed + auditClosed + findingClosed) /
          (ncmrTotal + capaTotal + oosTotal + auditTotal + findingTotal)) * 100).toFixed(1)
      : "0.0";

  const executiveRiskScore =
    capaOverdue * 3 +
    capaEffectivenessOverdue * 3 +
    capaNotEffective * 4 +
    scarNotEffective * 4 +
    supplierRecurrenceEvents * 2 +
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

  return (
    <main style={{ padding: "24px", fontFamily: "Arial, sans-serif", background: "#f8fafc", minHeight: "100vh" }}>
      <div style={{ marginBottom: "22px" }}>
        <h1 style={{ marginBottom: "4px" }}>Executive Quality Dashboard</h1>
        <p style={{ margin: 0, color: "#4b5563" }}>
          NCMR, CAPA, SCAR, OOS/OOT, Audit, Supplier Quality, effectiveness, and executive risk overview
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

      <ExecutiveSummarySection
        executiveHealth={executiveHealth}
        executiveRiskScore={executiveRiskScore}
        totalOpenQualityItems={totalOpenQualityItems}
        totalRiskEvents={totalRiskEvents}
        overallClosureRate={overallClosureRate}
      />

      <NotificationPanelSection notifications={notifications} />

      <ExecutiveRiskSnapshotSection
        totalHighPriorityAlerts={totalHighPriorityAlerts}
        capaOverdue={capaOverdue}
        oosProductImpact={oosProductImpact}
        oosSystemicIssues={oosSystemicIssues}
        findingOpen={findingOpen}
        criticalFindings={criticalFindings}
        majorFindings={majorFindings}
      />

      <EffectivenessIntelligenceSection
        capaEffective={capaEffective}
        capaPartiallyEffective={capaPartiallyEffective}
        capaNotEffective={capaNotEffective}
        capaEffectivenessRate={capaEffectivenessRate}
        capaFollowupRequired={capaFollowupRequired}
        scarEffective={scarEffective}
        scarNotEffective={scarNotEffective}
        scarEffectivenessRate={scarEffectivenessRate}
        scarAwaitingEffectiveness={scarAwaitingEffectiveness}
        supplierRecurrenceEvents={supplierRecurrenceEvents}
      />

      <NcmrPerformanceSection
        ncmrTotal={ncmrTotal}
        ncmrOpen={ncmrOpen}
        ncmrInvestigation={ncmrInvestigation}
        ncmrClosed={ncmrClosed}
        ncmrClosureRate={ncmrClosureRate}
        avgNcmrCloseDays={avgNcmrCloseDays}
        ncmrTrend={ncmrTrend}
      />

      <CapaPerformanceSection
        capaTotal={capaTotal}
        capaOpen={capaOpen}
        capaClosed={capaClosed}
        capaClosureRate={capaClosureRate}
        capaOverdue={capaOverdue}
        capaOverdueRate={capaOverdueRate}
        capaDueSoon={capaDueSoon}
        capaAwaitingEffectiveness={capaAwaitingEffectiveness}
        capaEffectivenessOverdue={capaEffectivenessOverdue}
        capaEffectivenessDueSoon={capaEffectivenessDueSoon}
        avgCapaCloseDays={avgCapaCloseDays}
        capaTrend={capaTrend}
      />

      <OosPerformanceSection
        oosTotal={oosTotal}
        oosOpen={oosOpen}
        oosClosed={oosClosed}
        oosClosureRate={oosClosureRate}
        oosProductImpact={oosProductImpact}
        oosNcmrRequired={oosNcmrRequired}
        oosSystemicIssues={oosSystemicIssues}
        oosEscalations={oosEscalations}
        oosTrend={oosTrend}
      />

      <AuditPerformanceSection
        auditTotal={auditTotal}
        auditOpen={auditOpen}
        auditClosed={auditClosed}
        auditClosureRate={auditClosureRate}
        auditOverdue={auditOverdue}
        findingTotal={findingTotal}
        findingOpen={findingOpen}
        findingClosureRate={findingClosureRate}
        majorFindings={majorFindings}
        criticalFindings={criticalFindings}
        findingsRequiringCapa={findingsRequiringCapa}
        auditTrend={auditTrend}
        findingTrend={findingTrend}
      />

      <SupplierQualitySection
        supplierScarRequired={supplierScarRequired}
        openSupplierCapas={openSupplierCapas}
        openScars={openScars}
        topSuppliers={topSuppliers}
      />

      <QuickActionsSection />
    </main>
  );
}
