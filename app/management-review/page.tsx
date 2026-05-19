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

type ReportConfig = {
  executiveSummary: boolean;
  capaPerformance: boolean;
  capaEffectiveness: boolean;
  scarPerformance: boolean;
  supplierQuality: boolean;
  auditPerformance: boolean;
  oosPerformance: boolean;
  escalationQueues: boolean;
  trendCharts: boolean;
  executiveNotifications: boolean;
  recurrenceAnalysis: boolean;
};

export default function ManagementReviewPage() {
  const [reportConfig, setReportConfig] = useState<ReportConfig>({
    executiveSummary: true,
    capaPerformance: true,
    capaEffectiveness: true,
    scarPerformance: true,
    supplierQuality: true,
    auditPerformance: true,
    oosPerformance: true,
    escalationQueues: true,
    trendCharts: true,
    executiveNotifications: true,
    recurrenceAnalysis: true,
  });

  const [managementReviews, setManagementReviews] = useState<any[]>([]);
  const [selectedReviewId, setSelectedReviewId] = useState("");
  const [approverName, setApproverName] = useState("");
  const [approverEmail, setApproverEmail] = useState("");
  const [approverRole, setApproverRole] = useState("");
  const [signatureMeaning, setSignatureMeaning] = useState("I approve this management review record and confirm that the reviewed quality system performance, risks, actions, and conclusions are acceptable.");
  const [reviewTitle, setReviewTitle] = useState("Monthly Management Review");
  const [reviewPeriodStart, setReviewPeriodStart] = useState("");
  const [reviewPeriodEnd, setReviewPeriodEnd] = useState("");
  const [reviewDate, setReviewDate] = useState(new Date().toISOString().split("T")[0]);
  const [site, setSite] = useState("");
  const [businessUnit, setBusinessUnit] = useState("");
  const [executiveSummaryText, setExecutiveSummaryText] = useState("");

  const [ncmrOpen, setNcmrOpen] = useState(0);
  const [ncmrInvestigation, setNcmrInvestigation] = useState(0);
  const [ncmrTotal, setNcmrTotal] = useState(0);
  const [ncmrClosed, setNcmrClosed] = useState(0);
  const [avgNcmrCloseDays, setAvgNcmrCloseDays] = useState("0.0");
  const [ncmrTrend, setNcmrTrend] = useState<TrendItem[]>([]);

  const [capaTotal, setCapaTotal] = useState(0);
  const [capaOpen, setCapaOpen] = useState(0);
  const [capaClosed, setCapaClosed] = useState(0);
  const [capaOverdue, setCapaOverdue] = useState(0);
  const [capaOverdueRate, setCapaOverdueRate] = useState("0.0");
  const [capaDueSoon, setCapaDueSoon] = useState(0);
  const [avgCapaCloseDays, setAvgCapaCloseDays] = useState("0.0");
  const [capaTrend, setCapaTrend] = useState<TrendItem[]>([]);

  const [capaAwaitingEffectiveness, setCapaAwaitingEffectiveness] = useState(0);
  const [capaEffectivenessOverdue, setCapaEffectivenessOverdue] = useState(0);
  const [capaEffectivenessDueSoon, setCapaEffectivenessDueSoon] = useState(0);
  const [capaEffective, setCapaEffective] = useState(0);
  const [capaPartiallyEffective, setCapaPartiallyEffective] = useState(0);
  const [capaNotEffective, setCapaNotEffective] = useState(0);
  const [capaEffectivenessRate, setCapaEffectivenessRate] = useState("0.0");
  const [capaFollowupRequired, setCapaFollowupRequired] = useState(0);

  const [openScars, setOpenScars] = useState(0);
  const [scarEffective, setScarEffective] = useState(0);
  const [scarNotEffective, setScarNotEffective] = useState(0);
  const [scarEffectivenessRate, setScarEffectivenessRate] = useState("0.0");
  const [scarAwaitingEffectiveness, setScarAwaitingEffectiveness] = useState(0);

  const [supplierScarRequired, setSupplierScarRequired] = useState(0);
  const [openSupplierCapas, setOpenSupplierCapas] = useState(0);
  const [topSuppliers, setTopSuppliers] = useState<SupplierCount[]>([]);
  const [supplierRecurrenceEvents, setSupplierRecurrenceEvents] = useState(0);

  const [oosTotal, setOosTotal] = useState(0);
  const [oosOpen, setOosOpen] = useState(0);
  const [oosClosed, setOosClosed] = useState(0);
  const [oosProductImpact, setOosProductImpact] = useState(0);
  const [oosNcmrRequired, setOosNcmrRequired] = useState(0);
  const [oosSystemicIssues, setOosSystemicIssues] = useState(0);
  const [oosEscalations, setOosEscalations] = useState(0);
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

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [capaGovernanceQueue, setCapaGovernanceQueue] = useState<any[]>([]);
  const [scarGovernanceQueue, setScarGovernanceQueue] = useState<any[]>([]);
  const [auditEscalationQueue, setAuditEscalationQueue] = useState<any[]>([]);

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
          message: `NCMR requires CAPA decision: ${ncmr.title || "Untitled NCMR"}.`,
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
          link: `/audits/${audit.id}`,
        });
      }
    });

    allFindings.forEach((finding: any) => {
      if (finding.finding_status !== "closed" && finding.finding_severity === "critical") {
        alerts.push({
          type: "Critical Audit Finding Open",
          message: `Critical audit finding open: ${finding.finding_title || "Untitled Finding"}.`,
          link: finding.linked_capa_id ? `/capa/${finding.linked_capa_id}` : `/audits/${finding.audit_id}`,
        });
      }
    });

    setNotifications(alerts);
  };

  const fetchManagementReviews = async () => {
    const { data, error } = await supabase
      .from("management_reviews")
      .select("*, management_review_approvers(*)")
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      console.warn(error.message);
      return;
    }

    setManagementReviews(data || []);
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

    setCapaGovernanceQueue(
      allNcmrs.filter(
        (item: any) =>
          item.status !== "closed" &&
          !item.linked_capa_id &&
          !item.capa_id &&
          !item.capa_not_required_justification &&
          (
            item.capa_required ||
            item.capa_evaluation_outcome === "required" ||
            item.capa_evaluation_outcome === "recommended" ||
            item.recurring_issue ||
            item.severity === "major" ||
            item.severity === "critical"
          )
      )
    );

    setScarGovernanceQueue(
      allNcmrs.filter(
        (item: any) =>
          item.status !== "closed" &&
          !item.linked_scar_id &&
          !item.scar_justification &&
          (
            item.scar_required ||
            item.supplier_capa_required ||
            item.linked_supplier_id ||
            item.supplier_id ||
            item.supplier_name
          )
      )
    );

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

    setAuditEscalationQueue(
      allFindings.filter(
        (item: any) =>
          item.finding_status !== "closed" &&
          !item.escalation_justification &&
          (
            item.finding_severity === "major" ||
            item.finding_severity === "critical" ||
            item.capa_evaluation_outcome === "required" ||
            item.scar_evaluation_outcome === "required" ||
            (!item.linked_capa_id && !item.linked_scar_id)
          )
      )
    );

    buildNotifications(allNcmrs, allCapas, allScars, allOos, allAudits, allFindings);
  };

  useEffect(() => {
    fetchData();
    fetchManagementReviews();
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

  const selectedReview = managementReviews.find((review) => review.id === selectedReviewId);
  const selectedApprovers = selectedReview?.management_review_approvers || [];
  const selectedReviewLocked = selectedReview?.is_locked === true;

  const addApprover = async () => {
    if (!selectedReviewId) {
      alert("Select a management review record first.");
      return;
    }

    if (selectedReviewLocked) {
      alert("This management review is locked and cannot be changed.");
      return;
    }

    if (!approverName.trim()) {
      alert("Approver name is required.");
      return;
    }

    if (!approverEmail.trim()) {
      alert("Approver email is required.");
      return;
    }

    const { error } = await supabase.from("management_review_approvers").insert({
      management_review_id: selectedReviewId,
      approver_name: approverName,
      approver_email: approverEmail,
      approver_role: approverRole || null,
      approval_status: "pending",
      signature_meaning: signatureMeaning || null,
    });

    if (error) {
      alert(error.message);
      return;
    }

    await supabase
      .from("management_reviews")
      .update({
        approval_status: "pending_approval",
        status: "pending_approval",
      })
      .eq("id", selectedReviewId);

    alert("Approver added.");
    setApproverName("");
    setApproverEmail("");
    setApproverRole("");
    fetchManagementReviews();
  };

  const approveReviewApprover = async (approver: any) => {
    if (selectedReviewLocked) {
      alert("This management review is already locked.");
      return;
    }

    const confirmed = window.confirm(
      `Apply electronic approval for ${approver.approver_name}?\\n\\nMeaning: ${approver.signature_meaning || signatureMeaning}`
    );

    if (!confirmed) return;

    const { data: userData } = await supabase.auth.getUser();
    const userEmail = userData?.user?.email || "unknown";

    const { error } = await supabase
      .from("management_review_approvers")
      .update({
        approval_status: "approved",
        signed_by: userEmail,
        signed_at: new Date().toISOString(),
        signature_meaning: approver.signature_meaning || signatureMeaning,
      })
      .eq("id", approver.id);

    if (error) {
      alert(error.message);
      return;
    }

    const { data: approvers, error: approverFetchError } = await supabase
      .from("management_review_approvers")
      .select("*")
      .eq("management_review_id", approver.management_review_id);

    if (approverFetchError) {
      alert(approverFetchError.message);
      return;
    }

    const allApproved =
      (approvers || []).length > 0 &&
      (approvers || []).every((item: any) => item.approval_status === "approved");

    if (allApproved) {
      const now = new Date().toISOString();

      await supabase
        .from("management_reviews")
        .update({
          approval_status: "approved",
          status: "approved",
          is_locked: true,
          locked_at: now,
          locked_by: userEmail,
          fully_approved_at: now,
        })
        .eq("id", approver.management_review_id);

      await supabase.from("audit_logs").insert({
        entity_type: "management_review",
        entity_id: approver.management_review_id,
        action: "management_review_fully_approved_locked",
        details: "All required approvers signed. Management review record locked.",
        user_email: userEmail,
      });

      alert("Approval saved. All approvers have signed, and the management review record is now locked.");
    } else {
      await supabase
        .from("management_reviews")
        .update({
          approval_status: "pending_approval",
          status: "pending_approval",
        })
        .eq("id", approver.management_review_id);

      alert("Approval saved.");
    }

    await supabase.from("audit_logs").insert({
      entity_type: "management_review_approver",
      entity_id: approver.id,
      action: "management_review_approver_signed",
      details: `Approver ${approver.approver_name} signed management review approval.`,
      user_email: userEmail,
    });

    fetchManagementReviews();
  };

  const removeApprover = async (approver: any) => {
    if (selectedReviewLocked) {
      alert("This management review is locked and cannot be changed.");
      return;
    }

    const confirmed = window.confirm(`Remove approver ${approver.approver_name}?`);
    if (!confirmed) return;

    const { error } = await supabase
      .from("management_review_approvers")
      .delete()
      .eq("id", approver.id);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Approver removed.");
    fetchManagementReviews();
  };

  const loadExecutivePreset = () => {
    setReportConfig({
      executiveSummary: true,
      capaPerformance: true,
      capaEffectiveness: true,
      scarPerformance: false,
      supplierQuality: false,
      auditPerformance: true,
      oosPerformance: false,
      escalationQueues: false,
      trendCharts: true,
      executiveNotifications: true,
      recurrenceAnalysis: false,
    });
  };

  const loadFullQualityPreset = () => {
    setReportConfig({
      executiveSummary: true,
      capaPerformance: true,
      capaEffectiveness: true,
      scarPerformance: true,
      supplierQuality: true,
      auditPerformance: true,
      oosPerformance: true,
      escalationQueues: true,
      trendCharts: true,
      executiveNotifications: true,
      recurrenceAnalysis: true,
    });
  };


  const buildReportSnapshot = () => {
    return {
      generated_at: new Date().toISOString(),
      report_config: reportConfig,
      executive: {
        quality_health: executiveHealth,
        risk_score: executiveRiskScore,
        total_open_quality_items: totalOpenQualityItems,
        total_risk_events: totalRiskEvents,
        overall_closure_rate: overallClosureRate,
      },
      ncmr: {
        total: ncmrTotal,
        open: ncmrOpen,
        investigation: ncmrInvestigation,
        closed: ncmrClosed,
        closure_rate: ncmrClosureRate,
        avg_close_days: avgNcmrCloseDays,
      },
      capa: {
        total: capaTotal,
        open: capaOpen,
        closed: capaClosed,
        overdue: capaOverdue,
        overdue_rate: capaOverdueRate,
        due_soon: capaDueSoon,
        closure_rate: capaClosureRate,
        avg_close_days: avgCapaCloseDays,
        effectiveness_rate: capaEffectivenessRate,
        effective: capaEffective,
        partially_effective: capaPartiallyEffective,
        not_effective: capaNotEffective,
        awaiting_effectiveness: capaAwaitingEffectiveness,
        effectiveness_overdue: capaEffectivenessOverdue,
        followup_required: capaFollowupRequired,
      },
      scar: {
        open: openScars,
        effectiveness_rate: scarEffectivenessRate,
        effective: scarEffective,
        not_effective: scarNotEffective,
        awaiting_effectiveness: scarAwaitingEffectiveness,
      },
      supplier_quality: {
        supplier_scar_required: supplierScarRequired,
        open_supplier_capas: openSupplierCapas,
        recurrence_events: supplierRecurrenceEvents,
        top_suppliers: topSuppliers,
      },
      oos_oot: {
        total: oosTotal,
        open: oosOpen,
        closed: oosClosed,
        closure_rate: oosClosureRate,
        product_impact: oosProductImpact,
        ncmr_required: oosNcmrRequired,
        systemic_issues: oosSystemicIssues,
        escalations: oosEscalations,
      },
      audits: {
        total: auditTotal,
        open: auditOpen,
        closed: auditClosed,
        closure_rate: auditClosureRate,
        overdue: auditOverdue,
        findings_total: findingTotal,
        findings_open: findingOpen,
        findings_closed: findingClosed,
        findings_closure_rate: findingClosureRate,
        major_findings: majorFindings,
        critical_findings: criticalFindings,
        findings_requiring_capa: findingsRequiringCapa,
      },
      queues: {
        capa_governance: capaGovernanceQueue,
        scar_governance: scarGovernanceQueue,
        audit_escalation: auditEscalationQueue,
      },
      notifications,
      trends: {
        ncmr: ncmrTrend,
        capa: capaTrend,
        oos: oosTrend,
        audit: auditTrend,
        findings: findingTrend,
      },
    };
  };

  const createManagementReviewRecord = async () => {
    if (!reviewTitle.trim()) {
      alert("Review title is required.");
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const userEmail = userData?.user?.email || "unknown";

    const now = new Date();
    const reviewNumber = `MR-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;

    const snapshot = buildReportSnapshot();

    const { data: reviewData, error } = await supabase
      .from("management_reviews")
      .insert({
        review_number: reviewNumber,
        review_title: reviewTitle,
        review_period_start: reviewPeriodStart || null,
        review_period_end: reviewPeriodEnd || null,
        review_date: reviewDate || null,
        site: site || null,
        business_unit: businessUnit || null,
        status: "draft",
        approval_status: "draft",
        prepared_by: userEmail,
        report_config_json: reportConfig,
        report_snapshot_json: snapshot,
        executive_summary: executiveSummaryText || null,
        risk_score: executiveRiskScore,
        quality_health: executiveHealth,
      })
      .select()
      .single();

    if (error) {
      alert(error.message);
      return;
    }

    await supabase.from("audit_logs").insert({
      entity_type: "management_review",
      entity_id: reviewNumber,
      action: "management_review_created",
      details: `Management review record created: ${reviewTitle}`,
      user_email: userEmail,
    });

    alert(`Management review record created: ${reviewNumber}`);
    setSelectedReviewId(reviewData?.id || "");
    fetchManagementReviews();
  };

  return (
    <main style={{ padding: "24px", fontFamily: "Arial, sans-serif", background: "#f8fafc", minHeight: "100vh" }}>
      <div style={{ marginBottom: "22px" }}>
        <h1 style={{ marginBottom: "4px" }}>Management Review Report Builder</h1>
        <p style={{ margin: 0, color: "#4b5563" }}>
          Configure, preview, and print management review content using live quality system data.
        </p>

        <div style={{ marginTop: "16px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button onClick={loadExecutivePreset} style={buttonStyle}>Executive Summary Preset</button>
          <button onClick={loadFullQualityPreset} style={buttonStyle}>Full Quality Review Preset</button>
          <button onClick={() => window.print()} style={darkButtonStyle}>Print Selected Report</button>
          <button onClick={() => window.open("/management-review/print", "_blank")} style={buttonStyle}>Open Legacy Print Report</button>
        </div>
      </div>

      <Section title="Create Management Review Record">
        <p style={{ color: "#4b5563", marginTop: 0 }}>
          Save the selected report configuration and current KPI values as a formal management review record.
        </p>

        <div style={builderGridStyle}>
          <label>
            <strong>Review Title</strong>
            <input
              value={reviewTitle}
              onChange={(e) => setReviewTitle(e.target.value)}
              style={inputStyle}
            />
          </label>

          <label>
            <strong>Review Period Start</strong>
            <input
              type="date"
              value={reviewPeriodStart}
              onChange={(e) => setReviewPeriodStart(e.target.value)}
              style={inputStyle}
            />
          </label>

          <label>
            <strong>Review Period End</strong>
            <input
              type="date"
              value={reviewPeriodEnd}
              onChange={(e) => setReviewPeriodEnd(e.target.value)}
              style={inputStyle}
            />
          </label>

          <label>
            <strong>Review Date</strong>
            <input
              type="date"
              value={reviewDate}
              onChange={(e) => setReviewDate(e.target.value)}
              style={inputStyle}
            />
          </label>

          <label>
            <strong>Site</strong>
            <input
              value={site}
              onChange={(e) => setSite(e.target.value)}
              placeholder="Example: Minneapolis"
              style={inputStyle}
            />
          </label>

          <label>
            <strong>Business Unit</strong>
            <input
              value={businessUnit}
              onChange={(e) => setBusinessUnit(e.target.value)}
              placeholder="Example: Operations / Quality"
              style={inputStyle}
            />
          </label>
        </div>

        <label>
          <strong>Executive Summary / Notes</strong>
          <textarea
            value={executiveSummaryText}
            onChange={(e) => setExecutiveSummaryText(e.target.value)}
            rows={4}
            placeholder="Summarize quality performance, risks, decisions, and management review conclusions."
            style={textareaStyle}
          />
        </label>

        <div style={{ marginTop: "14px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button onClick={createManagementReviewRecord} style={buttonStyle}>
            Create Management Review Record
          </button>
        </div>
      </Section>

      <Section title="Recent Management Review Records">
        {managementReviews.length === 0 ? (
          <p>No management review records created yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Review Number</th>
                <th style={thStyle}>Title</th>
                <th style={thStyle}>Review Date</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Approval</th>
                <th style={thStyle}>Quality Health</th>
                <th style={thStyle}>Prepared By</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {managementReviews.map((review) => (
                <tr key={review.id}>
                  <td style={tdStyle}>{review.review_number || "N/A"}</td>
                  <td style={tdStyle}>{review.review_title}</td>
                  <td style={tdStyle}>{review.review_date || "N/A"}</td>
                  <td style={tdStyle}>{review.status || "draft"}</td>
                  <td style={tdStyle}>
                    {review.approval_status || "draft"}
                    {review.is_locked ? (
                      <div style={{ color: "#15803d", fontSize: "12px", marginTop: "4px" }}>
                        Locked: {review.locked_at || "N/A"}
                      </div>
                    ) : null}
                  </td>
                  <td style={tdStyle}>{review.quality_health || "N/A"}</td>
                  <td style={tdStyle}>{review.prepared_by || "N/A"}</td>
                  <td style={tdStyle}>
                    <button type="button" onClick={() => setSelectedReviewId(review.id)}>
                      Manage Approvals
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Flexible Approval Routing">
        <p style={{ color: "#4b5563", marginTop: 0 }}>
          Add approvers as needed for the selected management review. The record locks when all listed approvers have signed.
        </p>

        <label>
          <strong>Select Management Review Record</strong>
          <select
            value={selectedReviewId}
            onChange={(e) => setSelectedReviewId(e.target.value)}
            style={inputStyle}
          >
            <option value="">Select review</option>
            {managementReviews.map((review) => (
              <option key={review.id} value={review.id}>
                {review.review_number || "MR"} - {review.review_title || "Untitled"} ({review.approval_status || review.status || "draft"})
              </option>
            ))}
          </select>
        </label>

        {selectedReview ? (
          <div
            style={{
              border: "1px solid #d1d5db",
              borderRadius: "10px",
              padding: "12px",
              marginTop: "14px",
              background: selectedReviewLocked ? "#f3f4f6" : "white",
            }}
          >
            <h3 style={{ marginTop: 0 }}>{selectedReview.review_title}</h3>
            <p><strong>Review Number:</strong> {selectedReview.review_number || "N/A"}</p>
            <p><strong>Approval Status:</strong> {selectedReview.approval_status || "draft"}</p>
            <p><strong>Locked:</strong> {selectedReviewLocked ? `Yes — ${selectedReview.locked_at || "N/A"}` : "No"}</p>

            {!selectedReviewLocked ? (
              <>
                <h3>Add Approver</h3>

                <div style={builderGridStyle}>
                  <label>
                    <strong>Approver Name</strong>
                    <input
                      value={approverName}
                      onChange={(e) => setApproverName(e.target.value)}
                      style={inputStyle}
                    />
                  </label>

                  <label>
                    <strong>Approver Email</strong>
                    <input
                      value={approverEmail}
                      onChange={(e) => setApproverEmail(e.target.value)}
                      style={inputStyle}
                    />
                  </label>

                  <label>
                    <strong>Role / Title</strong>
                    <input
                      value={approverRole}
                      onChange={(e) => setApproverRole(e.target.value)}
                      placeholder="Example: VP Quality, Operations Leader"
                      style={inputStyle}
                    />
                  </label>
                </div>

                <label>
                  <strong>Signature Meaning</strong>
                  <textarea
                    value={signatureMeaning}
                    onChange={(e) => setSignatureMeaning(e.target.value)}
                    rows={3}
                    style={textareaStyle}
                  />
                </label>

                <button type="button" onClick={addApprover} style={buttonStyle}>
                  Add Approver
                </button>
              </>
            ) : null}

            <h3>Approvers</h3>

            {selectedApprovers.length === 0 ? (
              <p>No approvers added yet.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Name</th>
                    <th style={thStyle}>Email</th>
                    <th style={thStyle}>Role</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Signed By</th>
                    <th style={thStyle}>Signed At</th>
                    <th style={thStyle}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedApprovers.map((approver: any) => (
                    <tr key={approver.id}>
                      <td style={tdStyle}>{approver.approver_name || "N/A"}</td>
                      <td style={tdStyle}>{approver.approver_email || "N/A"}</td>
                      <td style={tdStyle}>{approver.approver_role || "N/A"}</td>
                      <td style={tdStyle}>{approver.approval_status || "pending"}</td>
                      <td style={tdStyle}>{approver.signed_by || "N/A"}</td>
                      <td style={tdStyle}>{approver.signed_at || "N/A"}</td>
                      <td style={tdStyle}>
                        {approver.approval_status !== "approved" && !selectedReviewLocked ? (
                          <button type="button" onClick={() => approveReviewApprover(approver)}>
                            Approve / Sign
                          </button>
                        ) : null}
                        {approver.approval_status !== "approved" && !selectedReviewLocked ? (
                          <button
                            type="button"
                            onClick={() => removeApprover(approver)}
                            style={{ marginLeft: "8px" }}
                          >
                            Remove
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <p>Select a management review record to manage approvals.</p>
        )}
      </Section>

      <ReportBuilder config={reportConfig} setConfig={setReportConfig} />

      {reportConfig.executiveSummary && (
        <Section title="Executive Summary">
          <div style={gridStyle}>
            <KpiCard title="Quality Health" value={executiveHealth} color={getStatusColor(executiveRiskScore)} subtitle={`Risk score: ${executiveRiskScore}`} />
            <KpiCard title="Total Open Quality Items" value={totalOpenQualityItems} color={getStatusColor(totalOpenQualityItems, "warning")} />
            <KpiCard title="Total Risk Events" value={totalRiskEvents} color={getStatusColor(totalRiskEvents)} />
            <KpiCard title="Overall Closure Rate" value={`${overallClosureRate}%`} color="#2563eb" />
          </div>
        </Section>
      )}

      {reportConfig.executiveNotifications && (
        <Section title="Executive Notifications">
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
        </Section>
      )}

      {reportConfig.capaPerformance && (
        <Section title="CAPA Performance">
          <div style={gridStyle}>
            <KpiCard title="Total CAPAs" value={capaTotal} color="#2563eb" />
            <KpiCard title="Active CAPAs" value={capaOpen} color={getStatusColor(capaOpen, "warning")} />
            <KpiCard title="Closed CAPAs" value={capaClosed} color="#15803d" />
            <KpiCard title="Closure Rate" value={`${capaClosureRate}%`} color="#2563eb" />
            <KpiCard title="Overdue CAPAs" value={capaOverdue} color={getStatusColor(capaOverdue)} />
            <KpiCard title="Overdue Rate" value={`${capaOverdueRate}%`} color={getStatusColor(capaOverdue)} />
            <KpiCard title="Due Next 7 Days" value={capaDueSoon} color={getStatusColor(capaDueSoon, "warning")} />
            <KpiCard title="Avg Close Time" value={`${avgCapaCloseDays} d`} color="#374151" />
          </div>
          {reportConfig.trendCharts && <TrendChart title="CAPA Monthly Trend" data={capaTrend} />}
        </Section>
      )}

      {reportConfig.capaEffectiveness && (
        <Section title="CAPA & SCAR Effectiveness">
          <div style={gridStyle}>
            <KpiCard title="CAPA Effectiveness Rate" value={`${capaEffectivenessRate}%`} color="#2563eb" />
            <KpiCard title="Effective CAPAs" value={capaEffective} color="#15803d" />
            <KpiCard title="Partially Effective CAPAs" value={capaPartiallyEffective} color={getStatusColor(capaPartiallyEffective, "warning")} />
            <KpiCard title="Not Effective CAPAs" value={capaNotEffective} color={getStatusColor(capaNotEffective)} />
            <KpiCard title="Follow-up CAPAs Required" value={capaFollowupRequired} color={getStatusColor(capaFollowupRequired)} />
            <KpiCard title="Awaiting CAPA Effectiveness" value={capaAwaitingEffectiveness} color={getStatusColor(capaAwaitingEffectiveness, "warning")} />
            <KpiCard title="CAPA Effectiveness Overdue" value={capaEffectivenessOverdue} color={getStatusColor(capaEffectivenessOverdue)} />
            <KpiCard title="CAPA Effectiveness Due Soon" value={capaEffectivenessDueSoon} color={getStatusColor(capaEffectivenessDueSoon, "warning")} />
            <KpiCard title="SCAR Effectiveness Rate" value={`${scarEffectivenessRate}%`} color="#2563eb" />
            <KpiCard title="Effective SCARs" value={scarEffective} color="#15803d" />
            <KpiCard title="Not Effective SCARs" value={scarNotEffective} color={getStatusColor(scarNotEffective)} />
            <KpiCard title="SCAR Awaiting Effectiveness" value={scarAwaitingEffectiveness} color={getStatusColor(scarAwaitingEffectiveness, "warning")} />
          </div>
        </Section>
      )}

      {reportConfig.scarPerformance && (
        <Section title="SCAR Performance">
          <div style={gridStyle}>
            <KpiCard title="Open SCARs" value={openScars} color={getStatusColor(openScars, "warning")} />
            <KpiCard title="SCAR Effectiveness Rate" value={`${scarEffectivenessRate}%`} color="#2563eb" />
            <KpiCard title="Effective SCARs" value={scarEffective} color="#15803d" />
            <KpiCard title="Not Effective SCARs" value={scarNotEffective} color={getStatusColor(scarNotEffective)} />
            <KpiCard title="SCAR Awaiting Effectiveness" value={scarAwaitingEffectiveness} color={getStatusColor(scarAwaitingEffectiveness, "warning")} />
          </div>
        </Section>
      )}

      {reportConfig.supplierQuality && (
        <Section title="Supplier Quality">
          <div style={gridStyle}>
            <KpiCard title="Supplier CAPA / SCAR Required NCMRs" value={supplierScarRequired} color={getStatusColor(supplierScarRequired, "warning")} />
            <KpiCard title="Open Supplier CAPAs" value={openSupplierCapas} color={getStatusColor(openSupplierCapas, "warning")} />
            <KpiCard title="Open SCARs" value={openScars} color={getStatusColor(openScars, "warning")} />
            <KpiCard title="Supplier Recurrence Events" value={supplierRecurrenceEvents} color={getStatusColor(supplierRecurrenceEvents)} />
          </div>

          <div style={{ marginTop: "12px" }}>
            <strong>Top Suppliers by NCMR Count</strong>
            {topSuppliers.length === 0 ? (
              <p>No supplier NCMR data yet.</p>
            ) : (
              <ol>{topSuppliers.map((item) => <li key={item.supplier}>{item.supplier}: {item.count}</li>)}</ol>
            )}
          </div>
        </Section>
      )}

      {reportConfig.auditPerformance && (
        <Section title="Audit Performance">
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

          {reportConfig.trendCharts && (
            <>
              <TrendChart title="Audit Monthly Trend" data={auditTrend} />
              <div style={{ marginTop: "14px" }}><TrendChart title="Audit Finding Monthly Trend" data={findingTrend} /></div>
            </>
          )}
        </Section>
      )}

      {reportConfig.oosPerformance && (
        <Section title="OOS / OOT / Environmental Monitoring">
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

          {reportConfig.trendCharts && <TrendChart title="OOS/OOT Monthly Trend" data={oosTrend} />}
        </Section>
      )}

      {reportConfig.recurrenceAnalysis && (
        <Section title="Recurrence Analysis">
          <div style={gridStyle}>
            <KpiCard title="Supplier Recurrence Events" value={supplierRecurrenceEvents} color={getStatusColor(supplierRecurrenceEvents)} />
            <KpiCard title="Not Effective CAPAs" value={capaNotEffective} color={getStatusColor(capaNotEffective)} />
            <KpiCard title="Not Effective SCARs" value={scarNotEffective} color={getStatusColor(scarNotEffective)} />
            <KpiCard title="Follow-up CAPAs Required" value={capaFollowupRequired} color={getStatusColor(capaFollowupRequired)} />
          </div>
        </Section>
      )}

      {reportConfig.escalationQueues && (
        <Section title="Escalation Queues">
          <h3>CAPA Governance Queue</h3>
          <SimpleQueueTable
            items={capaGovernanceQueue}
            columns={[
              { label: "Record", render: (item) => item.ncmr_number || item.title || "NCMR" },
              { label: "Severity", render: (item) => item.severity || "N/A" },
              { label: "Evaluation", render: (item) => item.capa_evaluation_outcome || "Pending" },
              { label: "Action", render: (item) => <a href={`/ncmrs/${item.id}`}>Open</a> },
            ]}
          />

          <h3>SCAR Governance Queue</h3>
          <SimpleQueueTable
            items={scarGovernanceQueue}
            columns={[
              { label: "Record", render: (item) => item.ncmr_number || item.title || "NCMR" },
              { label: "Supplier", render: (item) => item.supplier_name || "N/A" },
              { label: "SCAR", render: (item) => (item.linked_scar_id ? "Linked" : "Pending") },
              { label: "Action", render: (item) => <a href={`/ncmrs/${item.id}`}>Open</a> },
            ]}
          />

          <h3>Audit Escalation Queue</h3>
          <SimpleQueueTable
            items={auditEscalationQueue}
            columns={[
              { label: "Finding", render: (item) => item.finding_title || "Finding" },
              { label: "Severity", render: (item) => item.finding_severity || "N/A" },
              { label: "CAPA", render: (item) => (item.linked_capa_id ? "Linked" : "Pending") },
              { label: "SCAR", render: (item) => (item.linked_scar_id ? "Linked" : "Pending") },
              { label: "Action", render: (item) => <a href={`/audits/${item.audit_id}`}>Open</a> },
            ]}
          />
        </Section>
      )}
    </main>
  );
}

function ReportBuilder({
  config,
  setConfig,
}: {
  config: ReportConfig;
  setConfig: React.Dispatch<React.SetStateAction<ReportConfig>>;
}) {
  const toggle = (key: keyof ReportConfig) => {
    setConfig((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <section style={sectionStyle}>
      <h2 style={{ marginTop: 0 }}>Report Sections</h2>
      <p style={{ color: "#4b5563" }}>Select which sections should appear in the management review report.</p>

      <div style={builderGridStyle}>
        <Checkbox label="Executive Summary" checked={config.executiveSummary} onChange={() => toggle("executiveSummary")} />
        <Checkbox label="CAPA Performance" checked={config.capaPerformance} onChange={() => toggle("capaPerformance")} />
        <Checkbox label="CAPA Effectiveness" checked={config.capaEffectiveness} onChange={() => toggle("capaEffectiveness")} />
        <Checkbox label="SCAR Performance" checked={config.scarPerformance} onChange={() => toggle("scarPerformance")} />
        <Checkbox label="Supplier Quality" checked={config.supplierQuality} onChange={() => toggle("supplierQuality")} />
        <Checkbox label="Audit Performance" checked={config.auditPerformance} onChange={() => toggle("auditPerformance")} />
        <Checkbox label="OOS/OOT Performance" checked={config.oosPerformance} onChange={() => toggle("oosPerformance")} />
        <Checkbox label="Escalation Queues" checked={config.escalationQueues} onChange={() => toggle("escalationQueues")} />
        <Checkbox label="Trend Charts" checked={config.trendCharts} onChange={() => toggle("trendCharts")} />
        <Checkbox label="Executive Notifications" checked={config.executiveNotifications} onChange={() => toggle("executiveNotifications")} />
        <Checkbox label="Recurrence Analysis" checked={config.recurrenceAnalysis} onChange={() => toggle("recurrenceAnalysis")} />
      </div>
    </section>
  );
}

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px", border: "1px solid #d1d5db", borderRadius: "8px", background: checked ? "#eff6ff" : "white", cursor: "pointer" }}>
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span>{label}</span>
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={sectionStyle}>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      {children}
    </section>
  );
}

function KpiCard({ title, value, subtitle, color }: { title: string; value: string | number; subtitle?: string; color: string }) {
  return (
    <div style={cardStyle(color)}>
      <div style={{ fontSize: "13px", fontWeight: 700, color: "#374151", marginBottom: "8px" }}>{title}</div>
      <div style={{ fontSize: "30px", fontWeight: 800, color }}>{value}</div>
      {subtitle ? <div style={{ marginTop: "6px", fontSize: "12px", color: "#6b7280" }}>{subtitle}</div> : null}
    </div>
  );
}

function TrendChart({ title, data }: { title: string; data: TrendItem[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);

  return (
    <div style={{ padding: "15px", border: "1px solid #ccc" }}>
      <strong>{title}</strong>
      <div style={{ marginTop: "10px" }}>
        {data.map((item) => (
          <div key={item.label} style={{ marginBottom: "10px" }}>
            <div style={{ fontSize: "14px", marginBottom: "4px" }}>{item.label}: {item.count}</div>
            <div style={{ background: "#eee", height: "12px", width: "100%", maxWidth: "300px" }}>
              <div style={{ background: "#3b82f6", height: "12px", width: `${item.count > 0 ? Math.max((item.count / max) * 100, 5) : 0}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SimpleQueueTable({
  items,
  columns,
}: {
  items: any[];
  columns: { label: string; render: (item: any) => React.ReactNode }[];
}) {
  if (items.length === 0) {
    return <p style={{ color: "#15803d", fontWeight: 700 }}>No actions pending.</p>;
  }

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "20px" }}>
      <thead>
        <tr>{columns.map((column) => <th key={column.label} style={thStyle}>{column.label}</th>)}</tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.id}>{columns.map((column) => <td key={column.label} style={tdStyle}>{column.render(item)}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
}

const getStatusColor = (value: number, riskType: "risk" | "warning" = "risk") => {
  if (value === 0) return "#15803d";
  if (riskType === "warning") return "#b45309";
  return "#b91c1c";
};

const buttonStyle: React.CSSProperties = {
  padding: "10px 14px",
  background: "#2563eb",
  color: "white",
  borderRadius: "8px",
  border: "none",
  cursor: "pointer",
  fontWeight: 700,
};

const darkButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: "#374151",
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

const builderGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
  gap: "12px",
  marginTop: "16px",
};

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "10px",
  border: "1px solid #d1d5db",
  borderRadius: "8px",
  marginTop: "6px",
};

const textareaStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "10px",
  border: "1px solid #d1d5db",
  borderRadius: "8px",
  marginTop: "6px",
  marginBottom: "10px",
};

const thStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  padding: "10px",
  background: "#f3f4f6",
  textAlign: "left",
};

const tdStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  padding: "10px",
  verticalAlign: "top",
};
