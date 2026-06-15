"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { getCompanySettings } from "../../lib/companySettings";
import {
  calculateCustomKpiValues,
  fetchCustomKpiDefinitions,
  mapCustomDefinitionsToConfiguredKpis,
} from "../../lib/customKpiEngine";

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

type ConfiguredKpi = {
  kpi_key: string;
  kpi_name: string;
  kpi_category: string | null;
  calculation_type: string | null;
  display_order: number | null;
};

type KpiDisplayValue = {
  value: string | number;
  subtitle?: string;
  distribution?: { label: string; count: number }[];
};

type ReportConfig = {
  executiveSummary: boolean;
  ncmrPerformance: boolean;
  capaPerformance: boolean;
  capaEffectiveness: boolean;
  scarPerformance: boolean;
  supplierQuality: boolean;
  auditPerformance: boolean;
  oosPerformance: boolean;
  complaintPerformance: boolean;
  changeControlPerformance: boolean;
  documentControlPerformance: boolean;
  trainingPerformance: boolean;
  escalationQueues: boolean;
  trendCharts: boolean;
  executiveNotifications: boolean;
  recurrenceAnalysis: boolean;
  managementActions: boolean;
};

export default function ManagementReviewPage() {
  const [reportConfig, setReportConfig] = useState<ReportConfig>({
    executiveSummary: true,
    ncmrPerformance: true,
    capaPerformance: true,
    capaEffectiveness: true,
    scarPerformance: true,
    supplierQuality: true,
    auditPerformance: true,
    oosPerformance: true,
    complaintPerformance: true,
    changeControlPerformance: true,
    documentControlPerformance: true,
    trainingPerformance: true,
    escalationQueues: true,
    trendCharts: true,
    executiveNotifications: true,
    recurrenceAnalysis: true,
    managementActions: true,
  });

  const [managementReviews, setManagementReviews] = useState<any[]>([]);
  const [selectedReviewId, setSelectedReviewId] = useState("");
  const [approverName, setApproverName] = useState("");
  const [approverEmail, setApproverEmail] = useState("");
  const [approverRole, setApproverRole] = useState("");
  const [signatureMeaning, setSignatureMeaning] = useState("I approve this management review record and confirm that the reviewed quality system performance, risks, actions, and conclusions are acceptable.");
  const [managementReviewActions, setManagementReviewActions] = useState<any[]>([]);
  const [actionTitle, setActionTitle] = useState("");
  const [actionDescription, setActionDescription] = useState("");
  const [actionOwner, setActionOwner] = useState("");
  const [actionOwnerEmail, setActionOwnerEmail] = useState("");
  const [actionDueDate, setActionDueDate] = useState("");
  const [actionPriority, setActionPriority] = useState("Medium");
  const [actionClosureNotes, setActionClosureNotes] = useState<Record<string, string>>({});
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

  const [complaintTotal, setComplaintTotal] = useState(0);
  const [complaintOpen, setComplaintOpen] = useState(0);
  const [complaintClosed, setComplaintClosed] = useState(0);
  const [complaintHighRisk, setComplaintHighRisk] = useState(0);
  const [complaintReportable, setComplaintReportable] = useState(0);
  const [complaintCapaTriggered, setComplaintCapaTriggered] = useState(0);
  const [complaintNcmrTriggered, setComplaintNcmrTriggered] = useState(0);
  const [complaintTrend, setComplaintTrend] = useState<TrendItem[]>([]);

  const [documentTotal, setDocumentTotal] = useState(0);
  const [documentReleased, setDocumentReleased] = useState(0);
  const [documentPendingReview, setDocumentPendingReview] = useState(0);
  const [documentOverdueReview, setDocumentOverdueReview] = useState(0);

  const [trainingTotal, setTrainingTotal] = useState(0);
  const [trainingCompleted, setTrainingCompleted] = useState(0);
  const [trainingOpen, setTrainingOpen] = useState(0);
  const [trainingOverdue, setTrainingOverdue] = useState(0);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [capaGovernanceQueue, setCapaGovernanceQueue] = useState<any[]>([]);
  const [scarGovernanceQueue, setScarGovernanceQueue] = useState<any[]>([]);
  const [auditEscalationQueue, setAuditEscalationQueue] = useState<any[]>([]);

  const [configuredChangeKpis, setConfiguredChangeKpis] = useState<ConfiguredKpi[]>([]);
  const [changeKpiValues, setChangeKpiValues] = useState<Record<string, KpiDisplayValue>>({});

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


  const buildDistribution = (items: any[], field: string) => {
    const counts: Record<string, number> = {};

    items.forEach((item: any) => {
      const label = String(item[field] || "N/A").trim() || "N/A";
      counts[label] = (counts[label] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  };

  const calculateChangeControlKpis = (allChanges: any[]) => {
    const activeChanges = allChanges.filter(
      (change: any) => change.status !== "closed" && change.status !== "cancelled",
    );

    const closedChanges = allChanges.filter((change: any) => change.status === "closed");

    const closedDurations = closedChanges
      .filter((change: any) => change.created_at && change.closed_at)
      .map((change: any) => {
        const created = new Date(change.created_at).getTime();
        const closed = new Date(change.closed_at).getTime();
        return (closed - created) / (1000 * 60 * 60 * 24);
      });

    const averageDaysToClose =
      closedDurations.length > 0
        ? (closedDurations.reduce((sum: number, value: number) => sum + value, 0) / closedDurations.length).toFixed(1)
        : "0.0";

    const overdueChanges = activeChanges.filter((change: any) => {
      if (change.target_implementation_date) {
        return change.target_implementation_date < new Date().toISOString().slice(0, 10);
      }
      if (!change.created_at) return false;
      return daysBetween(change.created_at) > 30;
    });

    const pendingApprovalCount = allChanges.filter((change: any) => change.status === "pending_approval").length;
    const implementationCount = allChanges.filter((change: any) => change.status === "implementation").length;
    const verificationCount = allChanges.filter((change: any) => change.status === "verification").length;
    const closureApprovalCount = allChanges.filter((change: any) => change.status === "closure_approval").length;
    const cancelledCount = allChanges.filter((change: any) => change.status === "cancelled").length;
    const highRiskCount = activeChanges.filter((change: any) => String(change.risk_level || "").toLowerCase() === "high").length;
    const criticalRiskCount = activeChanges.filter((change: any) => String(change.risk_level || "").toLowerCase() === "critical").length;

    return {
      total_changes: { value: allChanges.length },
      total_change_controls: { value: allChanges.length },
      open_changes: { value: activeChanges.length },
      active_changes: { value: activeChanges.length },
      open_change_controls: { value: activeChanges.length },
      closed_changes: { value: closedChanges.length },
      closed_change_controls: { value: closedChanges.length },
      cancelled_changes: { value: cancelledCount },
      canceled_changes: { value: cancelledCount },
      pending_approval: { value: pendingApprovalCount },
      pending_approval_changes: { value: pendingApprovalCount },
      changes_pending_approval: { value: pendingApprovalCount },
      implementation: { value: implementationCount },
      implementation_changes: { value: implementationCount },
      changes_in_implementation: { value: implementationCount },
      verification: { value: verificationCount },
      verification_changes: { value: verificationCount },
      changes_in_verification: { value: verificationCount },
      closure_approval: { value: closureApprovalCount },
      closure_approval_changes: { value: closureApprovalCount },
      changes_pending_closure_approval: { value: closureApprovalCount },
      overdue_changes: { value: overdueChanges.length, subtitle: "Target date past due or >30 days old" },
      overdue_change_controls: { value: overdueChanges.length, subtitle: "Target date past due or >30 days old" },
      average_days_to_close: { value: averageDaysToClose, subtitle: "days" },
      average_closure_time: { value: averageDaysToClose, subtitle: "days" },
      avg_days_to_close: { value: averageDaysToClose, subtitle: "days" },
      open_high_risk_changes: { value: highRiskCount },
      high_risk_changes: { value: highRiskCount },
      open_critical_changes: { value: criticalRiskCount },
      critical_changes: { value: criticalRiskCount },
      changes_by_type: { value: "", distribution: buildDistribution(allChanges, "change_type") },
      change_by_type: { value: "", distribution: buildDistribution(allChanges, "change_type") },
      change_type_distribution: { value: "", distribution: buildDistribution(allChanges, "change_type") },
      changes_by_origin: { value: "", distribution: buildDistribution(allChanges, "change_origin") },
      change_by_origin: { value: "", distribution: buildDistribution(allChanges, "change_origin") },
      change_origin_distribution: { value: "", distribution: buildDistribution(allChanges, "change_origin") },
    };
  };

  const fetchConfiguredChangeKpis = async () => {
    const companySettings = await getCompanySettings();
    const companyName = companySettings?.company_name || "Default Company";

    const { data: configData, error: configError } = await supabase
      .from("company_dashboard_kpi_configuration")
      .select("kpi_key, display_order")
      .eq("company_name", companyName)
      .eq("module_name", "change_control")
      .eq("management_review", true)
      .order("display_order", { ascending: true });

    if (configError) {
      console.warn(configError.message);
      setConfiguredChangeKpis([]);
      return;
    }

    let configRows = configData || [];

    if (configRows.length === 0 && companyName !== "Default Company") {
      const { data: fallbackConfigData } = await supabase
        .from("company_dashboard_kpi_configuration")
        .select("kpi_key, display_order")
        .eq("company_name", "Default Company")
        .eq("module_name", "change_control")
        .eq("management_review", true)
        .order("display_order", { ascending: true });

      configRows = fallbackConfigData || [];
    }

    const selectedKeys = configRows.map((item: any) => item.kpi_key);
    let configured: ConfiguredKpi[] = [];

    if (selectedKeys.length > 0) {
      const { data: libraryData, error: libraryError } = await supabase
        .from("kpi_library")
        .select("kpi_key, kpi_name, kpi_category, calculation_type")
        .in("module_name", ["change_control", "change_controls", "change"])
        .in("kpi_key", selectedKeys);

      if (libraryError) {
        console.warn(libraryError.message);
      }

      const displayOrder: Record<string, number> = {};
      configRows.forEach((item: any) => {
        displayOrder[item.kpi_key] = item.display_order || 1;
      });

      configured = selectedKeys
        .map((key: string) => {
          const matched = (libraryData || []).find((item: any) => item.kpi_key === key);

          return {
            kpi_key: key,
            kpi_name: matched?.kpi_name || formatKpiName(key),
            kpi_category: matched?.kpi_category || "Change Control",
            calculation_type: matched?.calculation_type || inferCalculationType(key),
            display_order: displayOrder[key] || 1,
          };
        })
        .sort(
          (a: ConfiguredKpi, b: ConfiguredKpi) =>
            Number(a.display_order || 1) - Number(b.display_order || 1),
        );
    }

    const customDefinitions = await fetchCustomKpiDefinitions({
      supabase,
      companyName,
      target: "management_review",
    });

    const customConfigured = mapCustomDefinitionsToConfiguredKpis(customDefinitions);
    const customValues = await calculateCustomKpiValues({
      supabase,
      definitions: customDefinitions,
    });

    const combined: ConfiguredKpi[] = [...configured, ...customConfigured].sort(
      (a, b) => Number(a.display_order || 100) - Number(b.display_order || 100),
    );

    setConfiguredChangeKpis(combined);
    setChangeKpiValues((prev) => ({
      ...prev,
      ...customValues,
    }));
  };

  const formatKpiName = (key: string) => {
    return String(key || "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const inferCalculationType = (key: string) => {
    const normalized = String(key || "").toLowerCase();

    if (
      normalized.includes("by_type") ||
      normalized.includes("by_origin") ||
      normalized.includes("by_status") ||
      normalized.includes("distribution")
    ) {
      return "distribution";
    }

    return "count";
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

  const fetchManagementReviewActions = async () => {
    const { data, error } = await supabase
      .from("management_review_actions")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.warn(error.message);
      return;
    }

    setManagementReviewActions(data || []);

    const notes: Record<string, string> = {};
    (data || []).forEach((action: any) => {
      notes[action.id] = action.closure_notes || "";
    });
    setActionClosureNotes(notes);
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

    const { data: complaintData, error: complaintError } = await supabase
      .from("complaints")
      .select("*");

    if (!complaintError) {
      const allComplaints = complaintData || [];
      const closedComplaints = allComplaints.filter((item: any) => item.status === "closed");
      const openComplaints = allComplaints.filter((item: any) => item.status !== "closed");

      setComplaintTotal(allComplaints.length);
      setComplaintOpen(openComplaints.length);
      setComplaintClosed(closedComplaints.length);
      setComplaintHighRisk(
        allComplaints.filter(
          (item: any) =>
            item.severity === "critical" ||
            item.potential_patient_impact ||
            item.potential_safety_issue,
        ).length,
      );
      setComplaintReportable(
        allComplaints.filter(
          (item: any) =>
            item.mdr_assessment_required ||
            item.regulatory_assessment === "reportable" ||
            item.regulatory_assessment === "pending",
        ).length,
      );
      setComplaintCapaTriggered(allComplaints.filter((item: any) => item.capa_required).length);
      setComplaintNcmrTriggered(allComplaints.filter((item: any) => item.ncmr_required).length);
      setComplaintTrend(buildTrend(allComplaints));
    } else {
      console.warn(complaintError.message);
    }

    const { data: documentData, error: documentError } = await supabase
      .from("controlled_documents")
      .select("*");

    if (!documentError) {
      const allDocuments = documentData || [];
      const todayStrForDocuments = new Date().toISOString().slice(0, 10);

      setDocumentTotal(allDocuments.length);
      setDocumentReleased(
        allDocuments.filter((item: any) => {
          const status = String(item.status || item.document_status || "").toLowerCase();
          return status === "released" || status === "effective" || status === "active";
        }).length,
      );
      setDocumentPendingReview(
        allDocuments.filter((item: any) => {
          const status = String(item.status || item.document_status || "").toLowerCase();
          return status.includes("review") || status.includes("approval") || status.includes("draft");
        }).length,
      );
      setDocumentOverdueReview(
        allDocuments.filter((item: any) => {
          const due = item.next_review_date || item.review_due_date || item.due_date;
          return due && String(due).slice(0, 10) < todayStrForDocuments;
        }).length,
      );
    } else {
      console.warn(documentError.message);
    }

    const { data: trainingData, error: trainingError } = await supabase
      .from("training_assignments")
      .select("*");

    if (!trainingError) {
      const allTraining = trainingData || [];
      const todayStrForTraining = new Date().toISOString().slice(0, 10);

      setTrainingTotal(allTraining.length);
      setTrainingCompleted(
        allTraining.filter((item: any) => {
          const status = String(item.status || item.training_status || "").toLowerCase();
          return status === "completed" || status === "complete";
        }).length,
      );
      setTrainingOpen(
        allTraining.filter((item: any) => {
          const status = String(item.status || item.training_status || "").toLowerCase();
          return status !== "completed" && status !== "complete" && status !== "waived";
        }).length,
      );
      setTrainingOverdue(
        allTraining.filter((item: any) => {
          const status = String(item.status || item.training_status || "").toLowerCase();
          const due = item.due_date || item.training_due_date;
          return status !== "completed" && status !== "complete" && due && String(due).slice(0, 10) < todayStrForTraining;
        }).length,
      );
    } else {
      console.warn(trainingError.message);
    }

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

    const { data: changeData, error: changeError } = await supabase
      .from("change_controls")
      .select("*");

    if (!changeError) {
      setChangeKpiValues((prev) => ({ ...prev, ...calculateChangeControlKpis(changeData || []) }));
    } else {
      console.warn(changeError.message);
      setChangeKpiValues({});
    }

    buildNotifications(allNcmrs, allCapas, allScars, allOos, allAudits, allFindings);
  };

  useEffect(() => {
    fetchConfiguredChangeKpis();
    fetchData();
    fetchManagementReviews();
    fetchManagementReviewActions();
  }, []);

  const ncmrClosureRate = ncmrTotal > 0 ? ((ncmrClosed / ncmrTotal) * 100).toFixed(1) : "0.0";
  const capaClosureRate = capaTotal > 0 ? ((capaClosed / capaTotal) * 100).toFixed(1) : "0.0";
  const oosClosureRate = oosTotal > 0 ? ((oosClosed / oosTotal) * 100).toFixed(1) : "0.0";
  const auditClosureRate = auditTotal > 0 ? ((auditClosed / auditTotal) * 100).toFixed(1) : "0.0";
  const findingClosureRate = findingTotal > 0 ? ((findingClosed / findingTotal) * 100).toFixed(1) : "0.0";
  const complaintClosureRate = complaintTotal > 0 ? ((complaintClosed / complaintTotal) * 100).toFixed(1) : "0.0";
  const documentReleaseRate = documentTotal > 0 ? ((documentReleased / documentTotal) * 100).toFixed(1) : "0.0";
  const trainingCompletionRate = trainingTotal > 0 ? ((trainingCompleted / trainingTotal) * 100).toFixed(1) : "0.0";

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
    majorFindings +
    complaintHighRisk +
    complaintReportable +
    documentOverdueReview +
    trainingOverdue;

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
  const selectedReviewActions = managementReviewActions.filter(
    (action) => action.management_review_id === selectedReviewId
  );
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

  const createManagementReviewAction = async () => {
    if (!selectedReviewId) {
      alert("Select a management review record first.");
      return;
    }

    if (selectedReviewLocked) {
      alert("This management review is locked. You cannot add actions to a locked review.");
      return;
    }

    if (!actionTitle.trim()) {
      alert("Action title is required.");
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const userEmail = userData?.user?.email || "unknown";

    const { error } = await supabase.from("management_review_actions").insert({
      management_review_id: selectedReviewId,
      action_title: actionTitle,
      action_description: actionDescription || null,
      action_owner: actionOwner || null,
      action_owner_email: actionOwnerEmail || null,
      due_date: actionDueDate || null,
      priority: actionPriority,
      action_status: "open",
      created_by: userEmail,
    });

    if (error) {
      alert(error.message);
      return;
    }

    await supabase.from("audit_logs").insert({
      entity_type: "management_review",
      entity_id: selectedReviewId,
      action: "management_review_action_created",
      details: `Management review action created: ${actionTitle}`,
      user_email: userEmail,
    });

    alert("Management review action created.");
    setActionTitle("");
    setActionDescription("");
    setActionOwner("");
    setActionOwnerEmail("");
    setActionDueDate("");
    setActionPriority("Medium");
    fetchManagementReviewActions();
  };

  const updateManagementReviewActionStatus = async (action: any, status: string) => {
    const { data: userData } = await supabase.auth.getUser();
    const userEmail = userData?.user?.email || "unknown";

    const updatePayload: any = {
      action_status: status,
      updated_at: new Date().toISOString(),
    };

    if (status === "closed") {
      updatePayload.closed_at = new Date().toISOString();
      updatePayload.closed_by = userEmail;
      updatePayload.closure_notes = actionClosureNotes[action.id] || null;
    }

    const { error } = await supabase
      .from("management_review_actions")
      .update(updatePayload)
      .eq("id", action.id);

    if (error) {
      alert(error.message);
      return;
    }

    await supabase.from("audit_logs").insert({
      entity_type: "management_review_action",
      entity_id: action.id,
      action: "management_review_action_status_updated",
      details: `Action status updated to ${status}.`,
      user_email: userEmail,
    });

    alert("Action updated.");
    fetchManagementReviewActions();
  };

  const deleteManagementReviewAction = async (action: any) => {
    if (selectedReviewLocked) {
      alert("This management review is locked. You cannot delete actions.");
      return;
    }

    const confirmed = window.confirm(`Delete action: ${action.action_title}?`);
    if (!confirmed) return;

    const { error } = await supabase
      .from("management_review_actions")
      .delete()
      .eq("id", action.id);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Action deleted.");
    fetchManagementReviewActions();
  };

  const reportGeneratedAt = new Date().toLocaleString();

  const selectedReviewForReport = managementReviews.find((review) => review.id === selectedReviewId);
  const approversForReport = selectedReviewForReport?.management_review_approvers || [];

  const scarClosureRate = openScars + scarEffective + scarNotEffective > 0
    ? (((scarEffective + scarNotEffective) / (openScars + scarEffective + scarNotEffective)) * 100).toFixed(1)
    : "0.0";

  const scarOverdueRate = openScars > 0
    ? ((scarAwaitingEffectiveness / openScars) * 100).toFixed(1)
    : "0.0";

  const kpiTargetRows = [
    {
      kpi: "Overall Closure Rate",
      actual: `${overallClosureRate}%`,
      target: "≥ 90%",
      status: Number(overallClosureRate) >= 90 ? "Meets Target" : "Below Target",
    },
    {
      kpi: "NCMR Closure Rate",
      actual: `${ncmrClosureRate}%`,
      target: "≥ 90%",
      status: Number(ncmrClosureRate) >= 90 ? "Meets Target" : "Below Target",
    },
    {
      kpi: "Avg NCMR Close Time",
      actual: `${avgNcmrCloseDays} d`,
      target: "≤ 30 d",
      status: Number(avgNcmrCloseDays) <= 30 ? "Meets Target" : "Below Target",
    },
    {
      kpi: "Open NCMRs",
      actual: ncmrOpen,
      target: "Trending Down",
      status: ncmrOpen <= 5 ? "Healthy" : "Monitor",
    },
    {
      kpi: "CAPA Closure Rate",
      actual: `${capaClosureRate}%`,
      target: "≥ 90%",
      status: Number(capaClosureRate) >= 90 ? "Meets Target" : "Below Target",
    },
    {
      kpi: "CAPA Effectiveness Rate",
      actual: `${capaEffectivenessRate}%`,
      target: "≥ 90%",
      status: Number(capaEffectivenessRate) >= 90 ? "Meets Target" : "Below Target",
    },
    {
      kpi: "SCAR Closure Rate",
      actual: `${scarClosureRate}%`,
      target: "≥ 90%",
      status: Number(scarClosureRate) >= 90 ? "Meets Target" : "Below Target",
    },
    {
      kpi: "SCAR Effectiveness Rate",
      actual: `${scarEffectivenessRate}%`,
      target: "≥ 90%",
      status: Number(scarEffectivenessRate) >= 90 ? "Meets Target" : "Below Target",
    },
    {
      kpi: "SCAR Overdue / Awaiting Effectiveness Rate",
      actual: `${scarOverdueRate}%`,
      target: "≤ 5%",
      status: Number(scarOverdueRate) <= 5 ? "Meets Target" : "Below Target",
    },
    {
      kpi: "Supplier Recurrence Events",
      actual: supplierRecurrenceEvents,
      target: "Trending Down",
      status: supplierRecurrenceEvents <= 3 ? "Healthy" : "Monitor",
    },
    {
      kpi: "Audit Closure Rate",
      actual: `${auditClosureRate}%`,
      target: "≥ 95%",
      status: Number(auditClosureRate) >= 95 ? "Meets Target" : "Below Target",
    },
    {
      kpi: "OOS/OOT Closure Rate",
      actual: `${oosClosureRate}%`,
      target: "≥ 95%",
      status: Number(oosClosureRate) >= 95 ? "Meets Target" : "Below Target",
    },
  ];

  const leadershipAttentionItems = [
    capaNotEffective > 0 ? `${capaNotEffective} CAPA(s) were rated not effective and require management attention.` : "",
    scarAwaitingEffectiveness > 0 ? `${scarAwaitingEffectiveness} SCAR(s) are awaiting effectiveness verification.` : "",
    supplierRecurrenceEvents > 0 ? `${supplierRecurrenceEvents} supplier recurrence event(s) were identified and should be reviewed for supplier oversight actions.` : "",
    auditOverdue > 0 ? `${auditOverdue} audit(s) are overdue or past due.` : "",
    capaEffectivenessOverdue > 0 ? `${capaEffectivenessOverdue} CAPA effectiveness check(s) are overdue.` : "",
    executiveRiskScore >= 25 ? "Executive quality health is Critical. Leadership review and action prioritization are recommended." : "",
    managementReviewActions.filter((action) => action.management_review_id === selectedReviewId && action.action_status !== "closed").length > 0 ? `${managementReviewActions.filter((action) => action.management_review_id === selectedReviewId && action.action_status !== "closed").length} management review action(s) remain open.` : "",
  ].filter(Boolean);

  const executiveNarrative =
    executiveRiskScore >= 25
      ? "Overall quality system performance requires leadership attention due to elevated risk signals, open governance actions, recurrence indicators, or overdue items."
      : executiveRiskScore >= 10
      ? "Overall quality system performance is elevated and should continue to be monitored through routine governance review and escalation follow-up."
      : executiveRiskScore > 0
      ? "Overall quality system performance remains generally controlled with selected items requiring routine follow-up."
      : "Overall quality system performance appears controlled based on available dashboard indicators.";

  const loadExecutivePreset = () => {
    setReportConfig({
      executiveSummary: true,
      ncmrPerformance: true,
      capaPerformance: true,
      capaEffectiveness: true,
      scarPerformance: false,
      supplierQuality: false,
      auditPerformance: true,
      oosPerformance: false,
      complaintPerformance: true,
      changeControlPerformance: true,
      documentControlPerformance: false,
      trainingPerformance: false,
      escalationQueues: false,
      trendCharts: true,
      executiveNotifications: true,
      recurrenceAnalysis: false,
      managementActions: true,
    });
  };

  const loadFullQualityPreset = () => {
    setReportConfig({
      executiveSummary: true,
      ncmrPerformance: true,
      capaPerformance: true,
      capaEffectiveness: true,
      scarPerformance: true,
      supplierQuality: true,
      auditPerformance: true,
      oosPerformance: true,
      complaintPerformance: true,
      changeControlPerformance: true,
      documentControlPerformance: true,
      trainingPerformance: true,
      escalationQueues: true,
      trendCharts: true,
      executiveNotifications: true,
      recurrenceAnalysis: true,
      managementActions: true,
    });
  };


  const generateExecutiveSummaryNarrative = () => {
    const attentionSummary =
      leadershipAttentionItems.length > 0
        ? leadershipAttentionItems.join(" ")
        : "No major leadership attention items were identified from the current dashboard indicators.";

    const configuredKpiCount = configuredChangeKpis.length;

    return [
      executiveNarrative,
      "",
      `Executive quality health is ${executiveHealth} with an executive risk score of ${executiveRiskScore}.`,
      `There are ${totalOpenQualityItems} open quality item(s), ${totalRiskEvents} risk event(s), and ${totalHighPriorityAlerts} high-priority notification(s).`,
      `Overall closure performance is ${overallClosureRate}%. NCMR closure is ${ncmrClosureRate}%, CAPA closure is ${capaClosureRate}%, Audit closure is ${auditClosureRate}%, and OOS/OOT closure is ${oosClosureRate}%.`,
      `CAPA effectiveness is ${capaEffectivenessRate}%, with ${capaEffectivenessOverdue} overdue effectiveness check(s) and ${capaNotEffective} CAPA(s) rated not effective.`,
      `Supplier quality review identified ${supplierRecurrenceEvents} supplier recurrence event(s), ${supplierScarRequired} supplier-related SCAR trigger(s), and ${openScars} open SCAR(s).`,
      `Audit performance includes ${auditOpen} open audit(s), ${auditOverdue} overdue audit(s), ${majorFindings} major finding(s), and ${criticalFindings} critical finding(s).`,
      configuredKpiCount > 0
        ? `${configuredKpiCount} catalog-driven Management Review KPI(s) are included in this review snapshot.`
        : "No catalog-driven Management Review KPIs are currently configured.",
      "",
      `Leadership attention summary: ${attentionSummary}`,
    ].join("\n");
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
        auto_generated_summary: generateExecutiveSummaryNarrative(),
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
      complaints: {
        included: reportConfig.complaintPerformance,
        total: complaintTotal,
        open: complaintOpen,
        closed: complaintClosed,
        closure_rate: complaintClosureRate,
        high_risk: complaintHighRisk,
        reportable_or_pending: complaintReportable,
        capa_triggered: complaintCapaTriggered,
        ncmr_triggered: complaintNcmrTriggered,
      },
      change_control: {
        included: reportConfig.changeControlPerformance,
        configured_kpis: configuredChangeKpis,
        kpi_values: changeKpiValues,
      },
      document_control: {
        included: reportConfig.documentControlPerformance,
        total: documentTotal,
        released: documentReleased,
        pending_review: documentPendingReview,
        overdue_review: documentOverdueReview,
        release_rate: documentReleaseRate,
      },
      training: {
        included: reportConfig.trainingPerformance,
        total: trainingTotal,
        completed: trainingCompleted,
        open: trainingOpen,
        overdue: trainingOverdue,
        completion_rate: trainingCompletionRate,
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
      change_control: {
        configured_kpis: configuredChangeKpis,
        kpi_values: changeKpiValues,
      },
      queues: {
        capa_governance: capaGovernanceQueue,
        scar_governance: scarGovernanceQueue,
        audit_escalation: auditEscalationQueue,
      },
      notifications,
      management_actions: managementReviewActions.filter((action) => action.management_review_id === selectedReviewId),
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

    const autoGeneratedSummary = generateExecutiveSummaryNarrative();
    const finalExecutiveSummary =
      executiveSummaryText.trim() || autoGeneratedSummary;

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
        executive_summary: finalExecutiveSummary || null,
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

    alert(`Auto-generated Management Review report created: ${reviewNumber}`);
    setSelectedReviewId(reviewData?.id || "");
    fetchManagementReviews();
  };

  return (
    <main style={{ padding: "24px", fontFamily: "Arial, sans-serif", background: "#f8fafc", minHeight: "100vh" }}>
      <style id="management-review-print-style">{`
        @media print {
          body {
            background: white !important;
            color: #111827 !important;
          }

          nav,
          header,
          .no-print,
          button,
          input,
          textarea,
          select {
            display: none !important;
          }

          main {
            padding: 0 !important;
            background: white !important;
          }

          .print-report-shell {
            background: white !important;
          }

          .report-section {
            page-break-inside: avoid;
            break-inside: avoid;
            box-shadow: none !important;
            border: 1px solid #d1d5db !important;
            margin-bottom: 24px !important;
          }

          .page-break {
            page-break-before: always;
            break-before: page;
          }

          .cover-page {
            min-height: 95vh;
            page-break-after: always;
            break-after: page;
          }

          .executive-dashboard-page {
            page-break-after: always;
            break-after: page;
          }

          .kpi-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
          }

          .report-card {
            box-shadow: none !important;
          }

          .print-only {
            display: block !important;
          }

          .screen-only {
            display: none !important;
          }

          a {
            color: #111827 !important;
            text-decoration: none !important;
          }

          table {
            page-break-inside: auto;
          }

          tr {
            page-break-inside: avoid;
            break-inside: avoid;
          }
        }

        @media screen {
          .print-only {
            display: none;
          }
        }
      `}</style>
      <div className="no-print" style={{ marginBottom: "22px" }}>
        <h1 style={{ marginBottom: "4px" }}>Auto-Generate Management Review Report</h1>
        <p style={{ margin: 0, color: "#4b5563" }}>
          Automatically generate a formal Management Review report using live quality intelligence,
          configured KPI catalog metrics, executive risk indicators, escalation queues, and management actions.
        </p>

        <div style={{ marginTop: "16px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button onClick={loadExecutivePreset} style={buttonStyle}>Executive Summary Preset</button>
          <button onClick={loadFullQualityPreset} style={buttonStyle}>Full Quality Review Preset</button>
          <button onClick={() => window.print()} style={darkButtonStyle}>Print Selected Report</button>
          <button onClick={() => window.open("/management-review/print", "_blank")} style={buttonStyle}>Open Legacy Print Report</button>
          <a href="/dashboard/kpi-catalog" style={purpleLinkButtonStyle}>Dashboard KPI Catalog</a>
          <a href="/dashboard" style={blackLinkButtonStyle}>Executive Dashboard</a>
        </div>
      </div>

      <Section title="Auto-Generate Management Review Report" className="no-print">
        <p style={{ color: "#4b5563", marginTop: 0 }}>
          Generate a formal Management Review record using live quality system metrics, selected report content,
          KPI catalog configuration, executive health signals, escalation queues, and an auto-generated executive narrative.
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
          <strong>Executive Summary / Notes Optional</strong>
          <textarea
            value={executiveSummaryText}
            onChange={(e) => setExecutiveSummaryText(e.target.value)}
            rows={4}
            placeholder="Optional. Leave blank to auto-generate the executive summary from current quality intelligence."
            style={textareaStyle}
          />
        </label>

        <div style={autoGenerateInfoStyle}>
          The report snapshot will include current KPI values, executive risk score, quality health,
          escalation queues, trend data, catalog-driven Management Review KPIs, and the generated executive narrative.
        </div>

        <div style={{ marginTop: "14px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button onClick={createManagementReviewRecord} style={buttonStyle}>
            Auto-Generate Report
          </button>
        </div>
      </Section>

      <Section title="Management Review Action Tracker" className="no-print">
        <p style={{ color: "#4b5563", marginTop: 0 }}>
          Create and track leadership actions from the selected management review record. Actions can be added only to unlocked draft or pending reviews.
        </p>

        <div style={{ marginBottom: "16px" }}>
          <label>
            <strong>Select Review for Action Tracking</strong>
            <select
              value={selectedReviewId}
              onChange={(e) => setSelectedReviewId(e.target.value)}
              style={inputStyle}
            >
              <option value="">Select review</option>
              {managementReviews.map((review) => (
                <option key={review.id} value={review.id}>
                  {review.review_number || "MR"} - {review.review_title || "Untitled"} ({review.approval_status || review.status || "draft"}{review.is_locked ? " / locked" : " / editable"})
                </option>
              ))}
            </select>
          </label>
        </div>

        {!selectedReviewId ? (
          <div style={noticeBoxStyle}>
            Select a management review record above to create or view leadership actions.
          </div>
        ) : selectedReviewLocked ? (
          <div style={warningBoxStyle}>
            This management review is locked. Existing actions can be viewed, but new actions cannot be added to this locked record. Select an unlocked draft or pending review to add actions.
          </div>
        ) : (
          <div style={actionFormStyle}>
            <h3 style={{ marginTop: 0 }}>Add Leadership Action</h3>

            <div style={builderGridStyle}>
              <label>
                <strong>Action Title</strong>
                <input
                  value={actionTitle}
                  onChange={(e) => setActionTitle(e.target.value)}
                  placeholder="Example: Review supplier recurrence trend"
                  style={inputStyle}
                />
              </label>

              <label>
                <strong>Owner</strong>
                <input
                  value={actionOwner}
                  onChange={(e) => setActionOwner(e.target.value)}
                  placeholder="Owner name"
                  style={inputStyle}
                />
              </label>

              <label>
                <strong>Owner Email</strong>
                <input
                  value={actionOwnerEmail}
                  onChange={(e) => setActionOwnerEmail(e.target.value)}
                  placeholder="owner@email.com"
                  style={inputStyle}
                />
              </label>

              <label>
                <strong>Due Date</strong>
                <input
                  type="date"
                  value={actionDueDate}
                  onChange={(e) => setActionDueDate(e.target.value)}
                  style={inputStyle}
                />
              </label>

              <label>
                <strong>Priority</strong>
                <select
                  value={actionPriority}
                  onChange={(e) => setActionPriority(e.target.value)}
                  style={inputStyle}
                >
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </label>
            </div>

            <label>
              <strong>Action Description</strong>
              <textarea
                value={actionDescription}
                onChange={(e) => setActionDescription(e.target.value)}
                rows={3}
                placeholder="Describe the management review decision, follow-up, or leadership action required."
                style={textareaStyle}
              />
            </label>

            <button type="button" onClick={createManagementReviewAction} style={buttonStyle}>
              Add Management Review Action
            </button>
          </div>
        )}

        <h3>Actions for Selected Review</h3>

        {selectedReviewActions.length === 0 ? (
          <p>No actions created for this review yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Action</th>
                <th style={thStyle}>Owner</th>
                <th style={thStyle}>Due Date</th>
                <th style={thStyle}>Priority</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Closure Notes</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {selectedReviewActions.map((action: any) => (
                <tr key={action.id}>
                  <td style={tdStyle}>
                    <strong>{action.action_title}</strong>
                    {action.action_description ? (
                      <div style={{ color: "#6b7280", fontSize: "12px", marginTop: "4px" }}>
                        {action.action_description}
                      </div>
                    ) : null}
                  </td>
                  <td style={tdStyle}>
                    {action.action_owner || "N/A"}
                    {action.action_owner_email ? (
                      <div style={{ color: "#6b7280", fontSize: "12px" }}>
                        {action.action_owner_email}
                      </div>
                    ) : null}
                  </td>
                  <td style={tdStyle}>{action.due_date || "N/A"}</td>
                  <td style={tdStyle}>{action.priority || "Medium"}</td>
                  <td style={tdStyle}>{action.action_status || "open"}</td>
                  <td style={tdStyle}>
                    <textarea
                      value={actionClosureNotes[action.id] || ""}
                      onChange={(e) =>
                        setActionClosureNotes({
                          ...actionClosureNotes,
                          [action.id]: e.target.value,
                        })
                      }
                      rows={2}
                      style={{ ...textareaStyle, marginTop: 0 }}
                      disabled={selectedReviewLocked || action.action_status === "closed"}
                    />
                  </td>
                  <td style={tdStyle}>
                    {action.action_status !== "closed" ? (
                      <>
                        <button
                          type="button"
                          onClick={() => updateManagementReviewActionStatus(action, "in_progress")}
                        >
                          In Progress
                        </button>
                        <button
                          type="button"
                          onClick={() => updateManagementReviewActionStatus(action, "closed")}
                          style={{ marginLeft: "6px" }}
                        >
                          Close
                        </button>
                      </>
                    ) : (
                      <span>Closed</span>
                    )}

                    {!selectedReviewLocked && action.action_status !== "closed" ? (
                      <button
                        type="button"
                        onClick={() => deleteManagementReviewAction(action)}
                        style={{ marginLeft: "6px" }}
                      >
                        Delete
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <section className="cover-page print-only" style={coverPageStyle}>
        <div>
          <div style={{ fontSize: "14px", letterSpacing: "0.08em", color: "#4b5563", fontWeight: 700 }}>
            Formal Management Review Cover Page
          </div>

          <h1 style={{ fontSize: "36px", marginBottom: "8px" }}>
            QualiFlow Management Review Report
          </h1>

          <p style={{ color: "#4b5563", fontSize: "16px" }}>
            Audit-ready management review summary generated from live quality system data.
          </p>
        </div>

        <div style={coverGridStyle}>
          <div>
            <strong>Review Title</strong>
            <div>{selectedReviewForReport?.review_title || reviewTitle || "Management Review"}</div>
          </div>

          <div>
            <strong>Review Number</strong>
            <div>{selectedReviewForReport?.review_number || "Draft / Not Saved"}</div>
          </div>

          <div>
            <strong>Review Period</strong>
            <div>
              {selectedReviewForReport?.review_period_start || reviewPeriodStart || "N/A"} to {selectedReviewForReport?.review_period_end || reviewPeriodEnd || "N/A"}
            </div>
          </div>

          <div>
            <strong>Review Date</strong>
            <div>{selectedReviewForReport?.review_date || reviewDate || "N/A"}</div>
          </div>

          <div>
            <strong>Site / Business Unit</strong>
            <div>
              {selectedReviewForReport?.site || site || "N/A"} / {selectedReviewForReport?.business_unit || businessUnit || "N/A"}
            </div>
          </div>

          <div>
            <strong>Prepared By</strong>
            <div>{selectedReviewForReport?.prepared_by || "N/A"}</div>
          </div>

          <div>
            <strong>Quality Health</strong>
            <div>{executiveHealth}</div>
          </div>

          <div>
            <strong>Executive Risk Score</strong>
            <div>{executiveRiskScore}</div>
          </div>

          <div>
            <strong>Approval Status</strong>
            <div>{selectedReviewForReport?.approval_status || "Draft / Pending"}</div>
          </div>

          <div>
            <strong>Generated At</strong>
            <div>{reportGeneratedAt}</div>
          </div>
        </div>

        <div style={{ marginTop: "40px", color: "#4b5563", fontSize: "13px" }}>
          Confidential Quality System Record. This report is intended for management review, quality governance, and audit readiness purposes.
        </div>
      </section>

      {reportConfig.executiveSummary && (
        <section className="report-section executive-dashboard-page page-break" style={executiveDashboardPageStyle}>
          <div style={executiveBannerStyle}>
            <div>
              <div style={executiveBannerLabelStyle}>Quality Health</div>
              <div style={executiveBannerValueStyle}>{executiveHealth}</div>
            </div>

            <div>
              <div style={executiveBannerLabelStyle}>Risk Score</div>
              <div style={executiveBannerValueStyle}>{executiveRiskScore}</div>
            </div>

            <div>
              <div style={executiveBannerLabelStyle}>Open Quality Items</div>
              <div style={executiveBannerValueStyle}>{totalOpenQualityItems}</div>
            </div>

            <div>
              <div style={executiveBannerLabelStyle}>Leadership Attention</div>
              <div style={executiveBannerValueStyle}>{leadershipAttentionItems.length}</div>
            </div>
          </div>

          <div style={executiveTwoColumnStyle}>
            <div style={executivePanelStyle}>
              <h2 style={{ marginTop: 0 }}>Executive Conclusions</h2>
              <p style={{ lineHeight: 1.7 }}>{executiveNarrative}</p>
              {leadershipAttentionItems.length === 0 ? (
                <p style={{ color: "#15803d", fontWeight: 700 }}>No high-priority leadership attention items identified.</p>
              ) : (
                <ul style={{ lineHeight: 1.7, paddingLeft: "20px" }}>
                  {leadershipAttentionItems.map((item, index) => <li key={index}>{item}</li>)}
                </ul>
              )}
            </div>

            <div style={executivePanelStyle}>
              <h2 style={{ marginTop: 0 }}>Required Leadership Actions</h2>
              <ul style={{ lineHeight: 1.7, paddingLeft: "20px" }}>
                {supplierRecurrenceEvents > 0 ? <li>Review supplier recurrence escalation strategy and supplier oversight actions.</li> : null}
                {capaNotEffective > 0 ? <li>Review not-effective CAPAs and confirm follow-up actions remain appropriate.</li> : null}
                {scarAwaitingEffectiveness > 0 ? <li>Monitor SCAR effectiveness verification and supplier response performance.</li> : null}
                {auditOverdue > 0 ? <li>Review overdue or past-due audits and assign closure priorities.</li> : null}
                {executiveRiskScore >= 25 ? <li>Prioritize high-risk governance activities until quality health improves.</li> : null}
              </ul>
            </div>
          </div>
        </section>
      )}

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

      {reportConfig.executiveSummary && (
        <Section title="Executive Narrative">
          <p style={{ fontSize: "15px", lineHeight: 1.6, color: "#374151" }}>
            {executiveNarrative}
          </p>

          {executiveSummaryText ? (
            <div style={{ marginTop: "12px" }}>
              <strong>Management Notes:</strong>
              <p style={{ whiteSpace: "pre-wrap" }}>{executiveSummaryText}</p>
            </div>
          ) : null}
        </Section>
      )}

      {reportConfig.executiveSummary && (
        <Section title="KPI Target vs Actual">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>KPI</th>
                <th style={thStyle}>Actual</th>
                <th style={thStyle}>Target</th>
                <th style={thStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              {kpiTargetRows.map((row, index) => (
                <tr key={row.kpi} style={stripedRowStyle(index)}>
                  <td style={tdStyle}>{row.kpi}</td>
                  <td style={tdStyle}>{row.actual}</td>
                  <td style={tdStyle}>{row.target}</td>
                  <td style={tdStyle}>
                    <StatusChip status={row.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {configuredChangeKpis.length > 0 && (
        <ConfiguredChangeControlKpiSection
          configuredKpis={configuredChangeKpis}
          kpiValues={changeKpiValues}
        />
      )}

      {reportConfig.trendCharts && (
        <Section
          title="Executive Trend Analytics"
          label="QUALITY INTELLIGENCE"
          description="Visual trend review of nonconformance, corrective action, audit, environmental monitoring, and supplier recurrence signals."
          className="page-break"
        >
          <SectionSummary>
            Trend analytics provide leadership with a visual view of quality system movement over time. Peaks, recurring signals, and supplier concentration should be reviewed for escalation, resource planning, and management review actions.
          </SectionSummary>

          <div style={twoColumnChartGridStyle}>
            <TrendChart title="NCMR Monthly Trend" data={ncmrTrend} />
            <TrendChart title="CAPA Monthly Trend" data={capaTrend} />
            <TrendChart title="Audit Monthly Trend" data={auditTrend} />
            <TrendChart title="Audit Finding Monthly Trend" data={findingTrend} />
            <TrendChart title="OOS/OOT Monthly Trend" data={oosTrend} />
            <SupplierParetoChart title="Top Suppliers by NCMR Count" data={topSuppliers} />
          </div>
        </Section>
      )}

      {reportConfig.executiveSummary && (
        <Section title="Key Risks Requiring Leadership Attention">
          {leadershipAttentionItems.length === 0 ? (
            <p style={{ color: "#15803d", fontWeight: 700 }}>
              No high-priority leadership attention items identified from the selected report data.
            </p>
          ) : (
            <ul style={{ paddingLeft: "20px", lineHeight: 1.6 }}>
              {leadershipAttentionItems.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          )}
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

      {reportConfig.ncmrPerformance && (
        <Section
          title="NCMR Performance Review"
          label="QUALITY SYSTEM PERFORMANCE"
          description="Operational nonconformance trends, investigation performance, closure effectiveness, and recurrence monitoring."
        >
          <SectionSummary>
            NCMR closure performance is measured against timeliness and closure expectations. Open and investigation-stage NCMRs should be monitored for escalation, recurrence, and potential CAPA linkage.
          </SectionSummary>

          <div className="kpi-grid" style={gridStyle}>
            <KpiCard title="Total NCMRs" value={ncmrTotal} color="#2563eb" />
            <KpiCard title="Open NCMRs" value={ncmrOpen} color={getStatusColor(ncmrOpen, "warning")} />
            <KpiCard title="In Investigation" value={ncmrInvestigation} color={getStatusColor(ncmrInvestigation, "warning")} />
            <KpiCard title="Closed NCMRs" value={ncmrClosed} color="#15803d" />
            <KpiCard title="NCMR Closure Rate" value={`${ncmrClosureRate}%`} color="#2563eb" />
            <KpiCard title="Avg NCMR Close Time" value={`${avgNcmrCloseDays} d`} color="#374151" />
          </div>

          {reportConfig.trendCharts && <TrendChart title="NCMR Monthly Trend" data={ncmrTrend} />}
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
        <Section
          title="SCAR Performance Review"
          label="SUPPLIER QUALITY GOVERNANCE"
          description="Supplier corrective action escalation, effectiveness monitoring, recurrence reduction, and supplier governance performance."
        >
          <SectionSummary>
            SCAR performance is monitored through open supplier actions, effectiveness verification, and supplier recurrence signals. Supplier recurrence should trigger management review of supplier oversight strategy.
          </SectionSummary>

          <div className="kpi-grid" style={gridStyle}>
            <KpiCard title="Open SCARs" value={openScars} color={getStatusColor(openScars, "warning")} />
            <KpiCard title="SCAR Closure Rate" value={`${scarClosureRate}%`} color="#2563eb" />
            <KpiCard title="SCAR Effectiveness Rate" value={`${scarEffectivenessRate}%`} color="#2563eb" />
            <KpiCard title="Effective SCARs" value={scarEffective} color="#15803d" />
            <KpiCard title="Not Effective SCARs" value={scarNotEffective} color={getStatusColor(scarNotEffective)} />
            <KpiCard title="SCAR Awaiting Effectiveness" value={scarAwaitingEffectiveness} color={getStatusColor(scarAwaitingEffectiveness, "warning")} />
            <KpiCard title="Supplier Recurrence Events" value={supplierRecurrenceEvents} color={getStatusColor(supplierRecurrenceEvents)} />
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

      {reportConfig.complaintPerformance && (
        <Section
          title="Complaint Performance"
          label="CUSTOMER AND POST-MARKET QUALITY"
          description="Complaint volume, high-risk events, reportability indicators, and linked quality action triggers."
        >
          <div style={gridStyle}>
            <KpiCard title="Total Complaints" value={complaintTotal} color="#2563eb" />
            <KpiCard title="Open Complaints" value={complaintOpen} color={getStatusColor(complaintOpen, "warning")} />
            <KpiCard title="Closed Complaints" value={complaintClosed} color="#15803d" />
            <KpiCard title="Complaint Closure Rate" value={`${complaintClosureRate}%`} color="#2563eb" />
            <KpiCard title="High-Risk Complaints" value={complaintHighRisk} color={getStatusColor(complaintHighRisk)} />
            <KpiCard title="Reportable / Pending" value={complaintReportable} color={getStatusColor(complaintReportable)} />
            <KpiCard title="CAPA Triggered" value={complaintCapaTriggered} color="#7c3aed" />
            <KpiCard title="NCMR Triggered" value={complaintNcmrTriggered} color="#7c3aed" />
          </div>

          {reportConfig.trendCharts && <TrendChart title="Complaint Monthly Trend" data={complaintTrend} />}
        </Section>
      )}

      {reportConfig.changeControlPerformance && (
        <Section
          title="Change Control Performance"
          label="QUALITY SYSTEM GOVERNANCE"
          description="Configured Management Review KPIs from the Quality Intelligence Catalog for change control performance."
        >
          {configuredChangeKpis.length === 0 ? (
            <p style={{ color: "#6b7280" }}>
              No Change Control KPIs are currently enabled for Management Review in the KPI Catalog.
            </p>
          ) : (
            <div style={gridStyle}>
              {configuredChangeKpis
                .filter((kpi) => kpi.calculation_type !== "distribution")
                .map((kpi) => {
                  const value = changeKpiValues[kpi.kpi_key] || { value: 0 };

                  return (
                    <KpiCard
                      key={kpi.kpi_key}
                      title={kpi.kpi_name}
                      value={value.value}
                      subtitle={value.subtitle}
                      color="#7c3aed"
                    />
                  );
                })}
            </div>
          )}

          {configuredChangeKpis
            .filter((kpi) => kpi.calculation_type === "distribution")
            .map((kpi) => {
              const rows = changeKpiValues[kpi.kpi_key]?.distribution || [];

              return (
                <div key={kpi.kpi_key} style={{ marginTop: "16px" }}>
                  <h3>{kpi.kpi_name}</h3>
                  {rows.length === 0 ? (
                    <p style={{ color: "#6b7280" }}>No distribution data available.</p>
                  ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          <th style={thStyle}>Category</th>
                          <th style={thStyle}>Count</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => (
                          <tr key={row.label}>
                            <td style={tdStyle}>{row.label}</td>
                            <td style={tdStyle}>{row.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}
        </Section>
      )}

      {reportConfig.documentControlPerformance && (
        <Section
          title="Document Control Performance"
          label="DOCUMENT GOVERNANCE"
          description="Controlled document release status, review backlog, and overdue review performance."
        >
          <div style={gridStyle}>
            <KpiCard title="Total Controlled Documents" value={documentTotal} color="#2563eb" />
            <KpiCard title="Released / Effective" value={documentReleased} color="#15803d" />
            <KpiCard title="Pending Review" value={documentPendingReview} color={getStatusColor(documentPendingReview, "warning")} />
            <KpiCard title="Overdue Reviews" value={documentOverdueReview} color={getStatusColor(documentOverdueReview)} />
            <KpiCard title="Release Rate" value={`${documentReleaseRate}%`} color="#2563eb" />
          </div>
        </Section>
      )}

      {reportConfig.trainingPerformance && (
        <Section
          title="Training Performance"
          label="TRAINING COMPLIANCE"
          description="Training assignment completion, open training load, and overdue training status."
        >
          <div style={gridStyle}>
            <KpiCard title="Total Training Assignments" value={trainingTotal} color="#2563eb" />
            <KpiCard title="Completed Training" value={trainingCompleted} color="#15803d" />
            <KpiCard title="Open Training" value={trainingOpen} color={getStatusColor(trainingOpen, "warning")} />
            <KpiCard title="Overdue Training" value={trainingOverdue} color={getStatusColor(trainingOverdue)} />
            <KpiCard title="Training Completion Rate" value={`${trainingCompletionRate}%`} color="#2563eb" />
          </div>
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
      {reportConfig.managementActions && (
        <Section
          title="Management Review Leadership Actions"
          label="CLOSED-LOOP MANAGEMENT REVIEW GOVERNANCE"
          description="Leadership actions assigned from the management review, including owner, due date, status, and closure evidence."
        >
          {selectedReviewActions.length === 0 ? (
            <p style={{ color: "#15803d", fontWeight: 700 }}>
              No management review actions are currently assigned for the selected review.
            </p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thStyle}>Action</th>
                  <th style={thStyle}>Owner</th>
                  <th style={thStyle}>Due Date</th>
                  <th style={thStyle}>Priority</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Closure Evidence</th>
                </tr>
              </thead>
              <tbody>
                {selectedReviewActions.map((action: any, index: number) => (
                  <tr key={action.id} style={stripedRowStyle(index)}>
                    <td style={tdStyle}>
                      <strong>{action.action_title}</strong>
                      {action.action_description ? (
                        <div style={{ color: "#6b7280", fontSize: "12px", marginTop: "4px" }}>
                          {action.action_description}
                        </div>
                      ) : null}
                    </td>
                    <td style={tdStyle}>{action.action_owner || "N/A"}</td>
                    <td style={tdStyle}>{action.due_date || "N/A"}</td>
                    <td style={tdStyle}>{action.priority || "Medium"}</td>
                    <td style={tdStyle}>
                      <StatusChip status={action.action_status || "open"} />
                    </td>
                    <td style={tdStyle}>{action.closure_notes || "N/A"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      )}

      <section className="report-section page-break" style={sectionStyle}>
        <h2 style={{ marginTop: 0 }}>Approval Signature Summary</h2>

        <p style={{ color: "#4b5563" }}>
          This section documents management review approval routing, electronic signatures, and record lock status.
        </p>

        <div style={gridStyle}>
          <KpiCard
            title="Approval Status"
            value={selectedReviewForReport?.approval_status || "Draft / Pending"}
            color={selectedReviewForReport?.approval_status === "approved" ? "#15803d" : "#b45309"}
          />

          <KpiCard
            title="Approvers Required"
            value={approversForReport.length}
            color="#2563eb"
          />

          <KpiCard
            title="Approvers Signed"
            value={approversForReport.filter((a: any) => a.approval_status === "approved").length}
            color="#15803d"
          />

          <KpiCard
            title="Record Locked"
            value={selectedReviewForReport?.is_locked ? "Yes" : "No"}
            color={selectedReviewForReport?.is_locked ? "#15803d" : "#b45309"}
          />
        </div>

        {approversForReport.length === 0 ? (
          <p>No approvers have been added to the selected management review record.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Approver</th>
                <th style={thStyle}>Role</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Signed By</th>
                <th style={thStyle}>Signed At</th>
                <th style={thStyle}>Signature Meaning</th>
              </tr>
            </thead>
            <tbody>
              {approversForReport.map((approver: any) => (
                <tr key={approver.id}>
                  <td style={tdStyle}>{approver.approver_name || "N/A"}</td>
                  <td style={tdStyle}>{approver.approver_role || "N/A"}</td>
                  <td style={tdStyle}>{approver.approval_status || "pending"}</td>
                  <td style={tdStyle}>{approver.signed_by || "N/A"}</td>
                  <td style={tdStyle}>{approver.signed_at || "N/A"}</td>
                  <td style={tdStyle}>{approver.signature_meaning || "N/A"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <div className="print-only" style={footerStyle}>
        QualiFlow Management Review Report | Generated {reportGeneratedAt}
      </div>


      <Section title="Review Approvals & Signatures" className="no-print">
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


      <Section title="Management Review History" className="no-print">
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
                <th style={thStyle}>Quality Health</th>
                <th style={thStyle}>Prepared By</th>
                <th style={thStyle}>Report</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {managementReviews.map((review) => (
                <tr key={review.id}>
                  <td style={tdStyle}>{review.review_number || "N/A"}</td>
                  <td style={tdStyle}>{review.review_title}</td>
                  <td style={tdStyle}>{review.review_date || "N/A"}</td>
                  <td style={tdStyle}>
                    {review.status || review.approval_status || "draft"}
                    {review.is_locked ? (
                      <div style={{ color: "#15803d", fontSize: "12px", marginTop: "4px" }}>
                        Locked: {review.locked_at || "N/A"}
                      </div>
                    ) : null}
                  </td>
                  <td style={tdStyle}>{review.quality_health || "N/A"}</td>
                  <td style={tdStyle}>{review.prepared_by || "N/A"}</td>
                  <td style={tdStyle}>
                    <button
                      type="button"
                      onClick={() =>
                        window.open(`/management-review/print?review_id=${review.id}`, "_blank")
                      }
                    >
                      Open Report
                    </button>
                  </td>
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
    <section className="no-print" style={sectionStyle}>
      <h2 style={{ marginTop: 0 }}>Report Sections</h2>
      <p style={{ color: "#4b5563" }}>Select which sections should appear in the management review report.</p>

      <div style={builderGridStyle}>
        <Checkbox label="Executive Summary" checked={config.executiveSummary} onChange={() => toggle("executiveSummary")} />
        <Checkbox label="NCMR Performance" checked={config.ncmrPerformance} onChange={() => toggle("ncmrPerformance")} />
        <Checkbox label="CAPA Performance" checked={config.capaPerformance} onChange={() => toggle("capaPerformance")} />
        <Checkbox label="CAPA Effectiveness" checked={config.capaEffectiveness} onChange={() => toggle("capaEffectiveness")} />
        <Checkbox label="SCAR Performance" checked={config.scarPerformance} onChange={() => toggle("scarPerformance")} />
        <Checkbox label="Supplier Quality" checked={config.supplierQuality} onChange={() => toggle("supplierQuality")} />
        <Checkbox label="Audit Performance" checked={config.auditPerformance} onChange={() => toggle("auditPerformance")} />
        <Checkbox label="OOS/OOT Performance" checked={config.oosPerformance} onChange={() => toggle("oosPerformance")} />
        <Checkbox label="Complaint Performance" checked={config.complaintPerformance} onChange={() => toggle("complaintPerformance")} />
        <Checkbox label="Change Control Performance" checked={config.changeControlPerformance} onChange={() => toggle("changeControlPerformance")} />
        <Checkbox label="Document Control Performance" checked={config.documentControlPerformance} onChange={() => toggle("documentControlPerformance")} />
        <Checkbox label="Training Performance" checked={config.trainingPerformance} onChange={() => toggle("trainingPerformance")} />
        <Checkbox label="Escalation Queues" checked={config.escalationQueues} onChange={() => toggle("escalationQueues")} />
        <Checkbox label="Trend Charts" checked={config.trendCharts} onChange={() => toggle("trendCharts")} />
        <Checkbox label="Executive Notifications" checked={config.executiveNotifications} onChange={() => toggle("executiveNotifications")} />
        <Checkbox label="Recurrence Analysis" checked={config.recurrenceAnalysis} onChange={() => toggle("recurrenceAnalysis")} />
        <Checkbox label="Management Actions" checked={config.managementActions} onChange={() => toggle("managementActions")} />
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

function Section({
  title,
  children,
  className = "",
  label,
  description,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
  label?: string;
  description?: string;
}) {
  return (
    <section className={`report-section ${className}`} style={sectionStyle}>
      {label || description ? (
        <div style={sectionHeaderStyle}>
          {label ? <div style={sectionLabelStyle}>{label}</div> : null}
          <h1 style={sectionTitleStyle}>{title}</h1>
          {description ? <p style={sectionDescriptionStyle}>{description}</p> : null}
        </div>
      ) : (
        <h2 style={{ marginTop: 0 }}>{title}</h2>
      )}
      {children}
    </section>
  );
}

function SectionSummary({ children }: { children: React.ReactNode }) {
  return <div style={sectionSummaryStyle}>{children}</div>;
}

function KpiCard({ title, value, subtitle, color }: { title: string; value: string | number; subtitle?: string; color: string }) {
  return (
    <div className="report-card" style={cardStyle(color)}>
      <div style={{ fontSize: "13px", fontWeight: 700, color: "#4b5563", marginBottom: "10px" }}>{title}</div>
      <div style={{ fontSize: "34px", fontWeight: 800, color: "#111827" }}>{value}</div>
      {subtitle ? <div style={{ marginTop: "8px", fontSize: "12px", color: "#6b7280" }}>{subtitle}</div> : null}
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const isGood = status === "Meets Target" || status === "Healthy";
  const background = isGood ? "#dcfce7" : status === "Monitor" ? "#fef3c7" : "#fee2e2";
  const color = isGood ? "#166534" : status === "Monitor" ? "#92400e" : "#991b1b";
  const border = isGood ? "#bbf7d0" : status === "Monitor" ? "#fde68a" : "#fecaca";

  return (
    <span
      style={{
        display: "inline-block",
        padding: "5px 10px",
        borderRadius: "999px",
        background,
        color,
        border: `1px solid ${border}`,
        fontSize: "12px",
        fontWeight: 700,
      }}
    >
      {status}
    </span>
  );
}

function TrendChart({ title, data }: { title: string; data: TrendItem[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  const latest = data.length > 0 ? data[data.length - 1]?.count || 0 : 0;
  const previous = data.length > 1 ? data[data.length - 2]?.count || 0 : 0;
  const change = latest - previous;
  const changeLabel = change > 0 ? `+${change}` : `${change}`;
  const changeColor = change > 0 ? "#b91c1c" : change < 0 ? "#15803d" : "#4b5563";

  return (
    <div style={chartCardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-start", marginBottom: "16px" }}>
        <div>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <p style={{ margin: "6px 0 0", color: "#6b7280", fontSize: "13px" }}>
            Last 6 months | Latest: {latest} | Change vs prior month: <span style={{ color: changeColor, fontWeight: 700 }}>{changeLabel}</span>
          </p>
        </div>

        <div style={{ ...miniTrendBadgeStyle, color: changeColor, borderColor: changeColor }}>
          {change === 0 ? "Flat" : change > 0 ? "Increasing" : "Improving"}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", gap: "14px", height: "230px", paddingTop: "18px", borderBottom: "1px solid #d1d5db" }}>
        {data.map((item) => {
          const height = item.count > 0 ? Math.max((item.count / max) * 185, 10) : 4;
          const intensity = item.count === max && max > 0 ? "#1d4ed8" : "#60a5fa";

          return (
            <div key={item.label} style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, marginBottom: "6px", color: "#111827" }}>{item.count}</div>
              <div
                style={{
                  height: `${height}px`,
                  background: intensity,
                  borderRadius: "10px 10px 0 0",
                  margin: "0 auto",
                  maxWidth: "48px",
                  boxShadow: "0 2px 6px rgba(37,99,235,0.25)",
                }}
              />
              <div style={{ marginTop: "8px", fontSize: "12px", color: "#4b5563" }}>{item.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SupplierParetoChart({ title, data }: { title: string; data: SupplierCount[] }) {
  const filtered = data.filter((item) => item.supplier && item.supplier !== "N/A");
  const max = Math.max(...filtered.map((d) => d.count), 1);

  return (
    <div style={chartCardStyle}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <p style={{ marginTop: 0, color: "#6b7280", fontSize: "13px" }}>
        Supplier concentration view for recurrence and oversight prioritization.
      </p>

      {filtered.length === 0 ? (
        <p>No supplier concentration data available.</p>
      ) : (
        <div style={{ display: "grid", gap: "12px" }}>
          {filtered.map((item, index) => {
            const width = Math.max((item.count / max) * 100, 5);
            return (
              <div key={item.supplier}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "4px" }}>
                  <strong>{index + 1}. {item.supplier}</strong>
                  <span>{item.count}</span>
                </div>
                <div style={{ height: "14px", background: "#e5e7eb", borderRadius: "999px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${width}%`, background: index === 0 ? "#1d4ed8" : "#60a5fa" }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
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

const autoGenerateInfoStyle: React.CSSProperties = {
  marginTop: "12px",
  background: "#eef2ff",
  color: "#312e81",
  border: "1px solid #c7d2fe",
  borderRadius: "12px",
  padding: "12px",
  fontSize: "14px",
};

const purpleLinkButtonStyle: React.CSSProperties = {
  padding: "10px 14px",
  background: "#7c3aed",
  color: "white",
  borderRadius: "8px",
  textDecoration: "none",
  fontWeight: 700,
  display: "inline-block",
};

const blackLinkButtonStyle: React.CSSProperties = {
  padding: "10px 14px",
  background: "#111827",
  color: "white",
  borderRadius: "8px",
  textDecoration: "none",
  fontWeight: 700,
  display: "inline-block",
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
  border: "1px solid #e5e7eb",
  borderLeft: `6px solid ${borderColor}`,
  borderRadius: "16px",
  padding: "22px",
  background: "#fff",
  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
  minHeight: "118px",
});

const sectionStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: "18px",
  padding: "28px",
  marginBottom: "26px",
  background: "#fff",
  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "18px",
  marginBottom: "24px",
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

const sectionHeaderStyle: React.CSSProperties = {
  marginBottom: "28px",
  paddingBottom: "18px",
  borderBottom: "2px solid #e5e7eb",
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: "12px",
  letterSpacing: "0.08em",
  color: "#6b7280",
  fontWeight: 700,
  textTransform: "uppercase",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: "30px",
  margin: "10px 0",
  color: "#111827",
};

const sectionDescriptionStyle: React.CSSProperties = {
  color: "#4b5563",
  maxWidth: "900px",
  lineHeight: 1.6,
};

const sectionSummaryStyle: React.CSSProperties = {
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
  borderRadius: "14px",
  padding: "18px",
  marginBottom: "24px",
  color: "#1e3a8a",
  lineHeight: 1.7,
};

const twoColumnChartGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
  gap: "22px",
  alignItems: "stretch",
};

const miniTrendBadgeStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: "999px",
  padding: "6px 10px",
  fontSize: "12px",
  fontWeight: 700,
  background: "white",
  whiteSpace: "nowrap",
};

const chartCardStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: "16px",
  padding: "20px",
  marginTop: "20px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
};

const executiveDashboardPageStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: "18px",
  padding: "30px",
  marginBottom: "26px",
  background: "#f8fafc",
};

const executiveBannerStyle: React.CSSProperties = {
  background: "#111827",
  color: "white",
  borderRadius: "18px",
  padding: "30px",
  marginBottom: "30px",
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "20px",
};

const executiveBannerLabelStyle: React.CSSProperties = {
  opacity: 0.72,
  fontSize: "13px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

const executiveBannerValueStyle: React.CSSProperties = {
  fontSize: "36px",
  fontWeight: 800,
  marginTop: "8px",
};

const executiveTwoColumnStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: "24px",
};

const executivePanelStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: "16px",
  padding: "24px",
};

const stripedRowStyle = (index: number): React.CSSProperties => ({
  background: index % 2 === 0 ? "#ffffff" : "#f9fafb",
});

const coverPageStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: "12px",
  padding: "48px",
  background: "white",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
};

const coverGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "18px",
  marginTop: "36px",
  padding: "20px",
  border: "1px solid #d1d5db",
  borderRadius: "10px",
  background: "#f9fafb",
};

const footerStyle: React.CSSProperties = {
  position: "fixed",
  bottom: "8px",
  left: "24px",
  right: "24px",
  borderTop: "1px solid #d1d5db",
  paddingTop: "6px",
  fontSize: "10px",
  color: "#6b7280",
};
const actionFormStyle: React.CSSProperties = {
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  borderRadius: "12px",
  padding: "16px",
  marginBottom: "18px",
};

const noticeBoxStyle: React.CSSProperties = {
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1e3a8a",
  borderRadius: "12px",
  padding: "14px",
  marginBottom: "18px",
  fontWeight: 700,
};

const warningBoxStyle: React.CSSProperties = {
  border: "1px solid #fde68a",
  background: "#fffbeb",
  color: "#92400e",
  borderRadius: "12px",
  padding: "14px",
  marginBottom: "18px",
  fontWeight: 700,
};

function ConfiguredChangeControlKpiSection({
  configuredKpis,
  kpiValues,
}: {
  configuredKpis: ConfiguredKpi[];
  kpiValues: Record<string, KpiDisplayValue>;
}) {
  if (configuredKpis.length === 0) return null;

  const cardKpis = configuredKpis.filter((kpi) => kpi.calculation_type !== "distribution");
  const distributionKpis = configuredKpis.filter((kpi) => kpi.calculation_type === "distribution");

  return (
    <Section
      title="Change Control Performance"
      label="CONFIGURED KPI ENGINE"
      description="These Change Control metrics are selected in Company Settings and automatically included in the Management Review package."
      className="page-break"
    >
      {cardKpis.length > 0 ? (
        <div style={gridStyle}>
          {cardKpis.map((kpi) => {
            const value =
              kpiValues[kpi.kpi_key] ||
              kpiValues[String(kpi.kpi_key || "").replace(/^change_control_/, "")] ||
              { value: 0, subtitle: "No calculated value" };
            return (
              <KpiCard
                key={kpi.kpi_key}
                title={kpi.kpi_name}
                value={value?.value ?? 0}
                color="#2563eb"
                subtitle={value?.subtitle}
              />
            );
          })}
        </div>
      ) : null}

      {distributionKpis.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px", marginTop: "16px" }}>
          {distributionKpis.map((kpi) => {
            const rows = kpiValues[kpi.kpi_key]?.distribution || [];
            return (
              <div key={kpi.kpi_key} style={{ border: "1px solid #e5e7eb", borderRadius: "14px", padding: "14px", background: "#ffffff" }}>
                <h3 style={{ marginTop: 0 }}>{kpi.kpi_name}</h3>
                {rows.length === 0 ? (
                  <p style={{ color: "#6b7280" }}>No data available.</p>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Category</th>
                        <th style={thStyle}>Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, index) => (
                        <tr key={row.label} style={stripedRowStyle(index)}>
                          <td style={tdStyle}>{row.label}</td>
                          <td style={tdStyle}>{row.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>
      ) : null}
    </Section>
  );
}
