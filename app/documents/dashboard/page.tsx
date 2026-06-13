"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type ControlledDocument = {
  id: string;
  document_number: string;
  title: string;
  document_type: string | null;
  revision: string;
  status: string;
  department: string | null;
  process_area: string | null;
  owner_email: string | null;
  approver_email: string | null;
  effective_date: string | null;
  read_ack_required: boolean | null;
  training_required: boolean | null;
  created_at: string | null;
  created_by: string | null;
  approved_at?: string | null;
  released_at?: string | null;
  next_review_date?: string | null;
  review_due_date?: string | null;
};

type AssignedReviewer = {
  id: string;
  document_id: string;
  reviewer_type: string;
  reviewer_email: string;
  reviewer_role: string | null;
  required_reviewer: boolean | null;
  review_sequence: number | null;
  review_status: string | null;
  due_date?: string | null;
  sla_days?: number | null;
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

export default function DocumentControlIntelligenceDashboardPage() {
  const [documents, setDocuments] = useState<ControlledDocument[]>([]);
  const [reviewers, setReviewers] = useState<AssignedReviewer[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);

    const [docRes, reviewerRes] = await Promise.all([
      supabase
        .from("controlled_documents")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("document_assigned_reviewers")
        .select(
          "id, document_id, reviewer_type, reviewer_email, reviewer_role, required_reviewer, review_sequence, review_status, due_date, sla_days",
        )
        .order("due_date", { ascending: true }),
    ]);

    if (docRes.error) {
      alert(docRes.error.message);
      setLoading(false);
      return;
    }

    if (reviewerRes.error) {
      alert(reviewerRes.error.message);
      setLoading(false);
      return;
    }

    setDocuments((docRes.data as ControlledDocument[]) || []);
    setReviewers((reviewerRes.data as AssignedReviewer[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const documentMap = useMemo(() => {
    const map = new Map<string, ControlledDocument>();

    documents.forEach((document) => {
      map.set(document.id, document);
    });

    return map;
  }, [documents]);

  const daysBetween = (startDate?: string | null, endDate?: string | null) => {
    if (!startDate) return 0;

    const start = new Date(startDate).getTime();
    const end = endDate ? new Date(endDate).getTime() : new Date().getTime();

    if (Number.isNaN(start) || Number.isNaN(end)) return 0;

    return Math.max(0, Math.floor((end - start) / (1000 * 60 * 60 * 24)));
  };

  const isPastDue = (value?: string | null) => {
    if (!value) return false;

    const date = new Date(value).getTime();

    if (Number.isNaN(date)) return false;

    return date < new Date().getTime();
  };

  const isDueWithinDays = (value?: string | null, days = 30) => {
    if (!value) return false;

    const date = new Date(value).getTime();

    if (Number.isNaN(date)) return false;

    const now = new Date().getTime();
    const future = now + days * 24 * 60 * 60 * 1000;

    return date >= now && date <= future;
  };

  const getReviewDueDate = (document: ControlledDocument) =>
    document.next_review_date || document.review_due_date || null;

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

  const metrics = useMemo(() => {
    const releasedDocuments = documents.filter(
      (document) =>
        document.status === "release" ||
        document.status === "effective",
    );

    const inWorkflowDocuments = documents.filter(
      (document) =>
        document.status === "collaboration" ||
        document.status === "formal_review" ||
        document.status === "approved",
    );

    const draftDocuments = documents.filter((document) => document.status === "draft");
    const rejectedDocuments = documents.filter((document) => document.status === "rejected");
    const obsoleteDocuments = documents.filter(
      (document) =>
        document.status === "obsolete" ||
        document.status === "superseded",
    );

    const awaitingRelease = documents.filter((document) => document.status === "approved");
    const formalReview = documents.filter((document) => document.status === "formal_review");
    const collaboration = documents.filter((document) => document.status === "collaboration");

    const trainingRequiredDocuments = documents.filter((document) =>
      Boolean(document.training_required),
    );

    const readAckRequiredDocuments = documents.filter((document) =>
      Boolean(document.read_ack_required),
    );

    const openReviews = reviewers.filter(
      (reviewer) =>
        reviewer.review_status !== "approved" &&
        reviewer.review_status !== "rejected",
    );

    const overdueReviews = openReviews.filter((reviewer) =>
      isPastDue(reviewer.due_date || null),
    );

    const workflowSla = percentage(openReviews.length - overdueReviews.length, openReviews.length);
    const workflowStatus = getSlaStatus(workflowSla);

    const approvalDurations = documents
      .filter((document) => document.approved_at)
      .map((document) => daysBetween(document.created_at, document.approved_at));

    const releaseDurations = documents
      .filter((document) => document.released_at || document.effective_date)
      .map((document) =>
        daysBetween(document.created_at, document.released_at || document.effective_date),
      );

    const reviewDueDocuments = documents.filter((document) =>
      Boolean(getReviewDueDate(document)),
    );

    const overdueReviewDocuments = reviewDueDocuments.filter((document) =>
      isPastDue(getReviewDueDate(document)),
    );

    const reviewDueSoonDocuments = reviewDueDocuments.filter((document) =>
      isDueWithinDays(getReviewDueDate(document), 30),
    );

    const reviewCompliance = percentage(
      reviewDueDocuments.length - overdueReviewDocuments.length,
      reviewDueDocuments.length,
    );

    const reviewComplianceStatus = getSlaStatus(reviewCompliance);

    const effectiveThisMonth = releasedDocuments.filter((document) => {
      const value = document.effective_date || document.released_at;

      if (!value) return false;

      return value.slice(0, 7) === new Date().toISOString().slice(0, 7);
    });

    return {
      releasedDocuments,
      inWorkflowDocuments,
      draftDocuments,
      rejectedDocuments,
      obsoleteDocuments,
      awaitingRelease,
      formalReview,
      collaboration,
      trainingRequiredDocuments,
      readAckRequiredDocuments,
      openReviews,
      overdueReviews,
      workflowSla,
      workflowStatus,
      averageApprovalTime: averageDays(approvalDurations),
      averageReleaseTime: averageDays(releaseDurations),
      overdueReviewDocuments,
      reviewDueSoonDocuments,
      reviewCompliance,
      reviewComplianceStatus,
      effectiveThisMonth,
    };
  }, [documents, reviewers]);

  const kpis: KpiTile[] = [
    {
      title: "Workflow SLA",
      value: metrics.workflowSla,
      suffix: "%",
      color: metrics.workflowStatus.color,
      target: "Target: 90%",
      statusLabel: metrics.workflowStatus.label,
      statusIcon: metrics.workflowStatus.icon,
      statusColor: metrics.workflowStatus.color,
    },
    {
      title: "Review Compliance",
      value: metrics.reviewCompliance,
      suffix: "%",
      color: metrics.reviewComplianceStatus.color,
      target: "Target: 90%",
      statusLabel: metrics.reviewComplianceStatus.label,
      statusIcon: metrics.reviewComplianceStatus.icon,
      statusColor: metrics.reviewComplianceStatus.color,
    },
    {
      title: "Total Documents",
      value: documents.length,
      color: "#2563eb",
    },
    {
      title: "Released Documents",
      value: metrics.releasedDocuments.length,
      color: "#15803d",
    },
    {
      title: "In Workflow",
      value: metrics.inWorkflowDocuments.length,
      color: "#d97706",
    },
    {
      title: "Open Reviews",
      value: metrics.openReviews.length,
      color: metrics.openReviews.length > 0 ? "#d97706" : "#15803d",
    },
    {
      title: "Overdue Reviews",
      value: metrics.overdueReviews.length,
      color: metrics.overdueReviews.length > 0 ? "#dc2626" : "#15803d",
    },
    {
      title: "Awaiting Release",
      value: metrics.awaitingRelease.length,
      color: metrics.awaitingRelease.length > 0 ? "#2563eb" : "#15803d",
    },
    {
      title: "Training Required",
      value: metrics.trainingRequiredDocuments.length,
      color: "#7c3aed",
    },
    {
      title: "Due for Review ≤30 Days",
      value: metrics.reviewDueSoonDocuments.length,
      color: metrics.reviewDueSoonDocuments.length > 0 ? "#d97706" : "#15803d",
    },
    {
      title: "Overdue Document Reviews",
      value: metrics.overdueReviewDocuments.length,
      color: metrics.overdueReviewDocuments.length > 0 ? "#dc2626" : "#15803d",
    },
    {
      title: "Effective This Month",
      value: metrics.effectiveThisMonth.length,
      color: "#2563eb",
    },
  ];

  const statusCounts = useMemo(
    () => buildCounts(documents, ["status"]),
    [documents],
  );

  const documentTypeCounts = useMemo(
    () => buildCounts(documents, ["document_type"]),
    [documents],
  );

  const departmentCounts = useMemo(
    () => buildCounts(documents, ["department"]),
    [documents],
  );

  const processAreaCounts = useMemo(
    () => buildCounts(documents, ["process_area"]),
    [documents],
  );

  const ownerCounts = useMemo(
    () => buildCounts(documents, ["owner_email", "created_by"]),
    [documents],
  );

  const reviewerRoleCounts = useMemo(
    () => buildCounts(reviewers, ["reviewer_role", "reviewer_type"]),
    [reviewers],
  );

  const monthlyTrend = useMemo(() => {
    const months = getLast6Months();
    const createdCounts: Record<string, number> = {};
    const releasedCounts: Record<string, number> = {};
    const approvedCounts: Record<string, number> = {};

    months.forEach((month) => {
      createdCounts[month.key] = 0;
      releasedCounts[month.key] = 0;
      approvedCounts[month.key] = 0;
    });

    documents.forEach((document) => {
      const createdKey = getMonthKey(document.created_at);
      const releasedKey = getMonthKey(document.released_at || document.effective_date);
      const approvedKey = getMonthKey(document.approved_at);

      if (createdKey && createdCounts[createdKey] !== undefined) {
        createdCounts[createdKey] += 1;
      }

      if (releasedKey && releasedCounts[releasedKey] !== undefined) {
        releasedCounts[releasedKey] += 1;
      }

      if (approvedKey && approvedCounts[approvedKey] !== undefined) {
        approvedCounts[approvedKey] += 1;
      }
    });

    return months.map((month) => ({
      label: month.label,
      created: createdCounts[month.key],
      released: releasedCounts[month.key],
      approved: approvedCounts[month.key],
    }));
  }, [documents]);

  const overdueReviewAssignments = useMemo(() => {
    return reviewers
      .filter(
        (reviewer) =>
          reviewer.review_status !== "approved" &&
          reviewer.review_status !== "rejected" &&
          isPastDue(reviewer.due_date || null),
      )
      .slice(0, 10);
  }, [reviewers]);

  const pendingApprovalDocuments = metrics.formalReview;
  const awaitingReleaseDocuments = metrics.awaitingRelease;
  const rejectedDocuments = metrics.rejectedDocuments;
  const trainingRequiredDocuments = metrics.trainingRequiredDocuments;

  if (loading) {
    return <main style={pageStyle}>Loading Document Control Intelligence...</main>;
  }

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>ENTERPRISE QUALITY COMMAND CENTER</div>
          <h1 style={{ margin: "6px 0" }}>Document Control Intelligence Dashboard</h1>
          <p style={subtleText}>
            Executive operational intelligence for controlled documents,
            workflow performance, review aging, release readiness, training
            impact, and document lifecycle compliance.
          </p>
        </div>

        <div style={buttonRowStyle}>
          <Link href="/documents" style={darkButtonStyle}>
            Document Register
          </Link>
          <Link href="/dashboard/workflow" style={secondaryButtonStyle}>
            Workflow Dashboard
          </Link>
          <Link href="/dashboard" style={secondaryButtonStyle}>
            Enterprise Dashboard
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

      <section style={escalationPanelStyle}>
        <div>
          <div style={eyebrowStyle}>EXECUTIVE ESCALATION ENGINE</div>
          <h2 style={{ margin: "6px 0" }}>Action Required</h2>
          <p style={subtleText}>
            Prioritized document control signals requiring ownership follow-up,
            reviewer action, release control, training readiness, or governance
            attention.
          </p>
        </div>

        <div style={escalationGridStyle}>
          <ReviewerEscalationCard
            title="Overdue Reviews"
            count={overdueReviewAssignments.length}
            severity={overdueReviewAssignments.length > 0 ? "high" : "controlled"}
            items={overdueReviewAssignments}
            documentMap={documentMap}
            description="Reviewer assignments past due date."
          />

          <DocumentEscalationCard
            title="Pending Formal Review"
            count={pendingApprovalDocuments.length}
            severity={pendingApprovalDocuments.length > 0 ? "medium" : "controlled"}
            items={pendingApprovalDocuments}
            description="Documents currently in formal review."
          />

          <DocumentEscalationCard
            title="Awaiting Release"
            count={awaitingReleaseDocuments.length}
            severity={awaitingReleaseDocuments.length > 0 ? "medium" : "controlled"}
            items={awaitingReleaseDocuments}
            description="Approved documents waiting for release."
          />

          <DocumentEscalationCard
            title="Rejected Documents"
            count={rejectedDocuments.length}
            severity={rejectedDocuments.length > 0 ? "medium" : "controlled"}
            items={rejectedDocuments}
            description="Documents returned for correction or resubmission."
          />

          <DocumentEscalationCard
            title="Training Required"
            count={trainingRequiredDocuments.length}
            severity={trainingRequiredDocuments.length > 0 ? "medium" : "controlled"}
            items={trainingRequiredDocuments}
            description="Documents that require training assignment or completion."
          />

          <DocumentEscalationCard
            title="Overdue Review Dates"
            count={metrics.overdueReviewDocuments.length}
            severity={metrics.overdueReviewDocuments.length > 0 ? "high" : "controlled"}
            items={metrics.overdueReviewDocuments}
            description="Documents with overdue periodic review dates."
          />
        </div>
      </section>

      <section style={cardStyle}>
        <div>
          <div style={eyebrowStyle}>DOCUMENT SLA INTELLIGENCE</div>
          <h2 style={{ margin: "6px 0" }}>Approval, Release, and Workflow Timeliness</h2>
          <p style={subtleText}>
            Measures document workflow performance, release readiness, and review
            timeliness.
          </p>
        </div>

        <div style={kpiGridStyle}>
          <KpiCard
            title="Average Approval Time"
            value={metrics.averageApprovalTime}
            suffix=" days"
            color={metrics.averageApprovalTime > 30 ? "#d97706" : "#15803d"}
          />
          <KpiCard
            title="Average Release Time"
            value={metrics.averageReleaseTime}
            suffix=" days"
            color={metrics.averageReleaseTime > 45 ? "#d97706" : "#15803d"}
          />
          <KpiCard
            title="Collaboration"
            value={metrics.collaboration.length}
            color="#7c3aed"
          />
          <KpiCard
            title="Formal Review"
            value={metrics.formalReview.length}
            color="#d97706"
          />
          <KpiCard
            title="Awaiting Release"
            value={metrics.awaitingRelease.length}
            color="#2563eb"
          />
          <KpiCard
            title="Read & Acknowledge Required"
            value={metrics.readAckRequiredDocuments.length}
            color="#7c3aed"
          />
        </div>
      </section>

      <section style={analyticsGridStyle}>
        <SummaryCard title="Documents by Status" rows={statusCounts} />
        <SummaryCard title="Documents by Type" rows={documentTypeCounts.length ? documentTypeCounts : [["No data", 0]]} />
        <SummaryCard title="Documents by Department" rows={departmentCounts.length ? departmentCounts : [["No data", 0]]} />
        <SummaryCard title="Documents by Process Area" rows={processAreaCounts.length ? processAreaCounts : [["No data", 0]]} />
        <SummaryCard title="Documents by Owner" rows={ownerCounts.length ? ownerCounts : [["No data", 0]]} />
        <SummaryCard title="Reviewer Role Intelligence" rows={reviewerRoleCounts.length ? reviewerRoleCounts : [["No data", 0]]} />
      </section>

      <section style={cardStyle}>
        <div>
          <div style={eyebrowStyle}>MANAGEMENT REVIEW TREND INTELLIGENCE</div>
          <h2 style={{ margin: "6px 0" }}>Monthly Document Activity</h2>
          <p style={subtleText}>
            Six-month view of created, approved, and released controlled
            documents.
          </p>
        </div>

        <div style={trendGridStyle}>
          <TrendCard title="Created Documents" data={monthlyTrend.map((item) => ({ label: item.label, value: item.created }))} />
          <TrendCard title="Approved Documents" data={monthlyTrend.map((item) => ({ label: item.label, value: item.approved }))} />
          <TrendCard title="Released Documents" data={monthlyTrend.map((item) => ({ label: item.label, value: item.released }))} />
        </div>
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <h2 style={{ margin: 0 }}>Overdue Review Queue</h2>
            <p style={subtleText}>
              Open document review assignments that have passed the due date.
            </p>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Document</th>
                <th style={thStyle}>Reviewer</th>
                <th style={thStyle}>Role</th>
                <th style={thStyle}>Due Date</th>
                <th style={thStyle}>Action</th>
              </tr>
            </thead>
            <tbody>
              {overdueReviewAssignments.length === 0 ? (
                <tr>
                  <td colSpan={5} style={tdStyle}>
                    No overdue review assignments.
                  </td>
                </tr>
              ) : (
                overdueReviewAssignments.map((reviewer) => {
                  const relatedDoc = documentMap.get(reviewer.document_id);

                  return (
                    <tr key={reviewer.id}>
                      <td style={tdStyle}>
                        <strong>
                          {relatedDoc
                            ? `${relatedDoc.document_number} Rev ${relatedDoc.revision}`
                            : reviewer.document_id}
                        </strong>
                        <div style={smallTextStyle}>{relatedDoc?.title || "Document details unavailable"}</div>
                      </td>
                      <td style={tdStyle}>{reviewer.reviewer_email}</td>
                      <td style={tdStyle}>{reviewer.reviewer_role || reviewer.reviewer_type}</td>
                      <td style={overdueCellStyle}>{formatDate(reviewer.due_date)}</td>
                      <td style={tdStyle}>
                        <Link href={`/documents/${reviewer.document_id}`} style={primaryLinkStyle}>
                          Open Workflow
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
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

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
}

function DocumentEscalationCard({
  title,
  count,
  severity,
  items,
  description,
}: {
  title: string;
  count: number;
  severity: "controlled" | "medium" | "high";
  items: ControlledDocument[];
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
          items.slice(0, 5).map((document) => (
            <div key={document.id} style={escalationItemStyle}>
              <Link href={`/documents/${document.id}`} style={{ fontWeight: 700 }}>
                {document.document_number} Rev {document.revision}
              </Link>
              <div style={smallTextStyle}>
                {document.title} | Status: {getStatusLabel(document.status)} |
                Owner: {document.owner_email || "N/A"}
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

function ReviewerEscalationCard({
  title,
  count,
  severity,
  items,
  documentMap,
  description,
}: {
  title: string;
  count: number;
  severity: "controlled" | "medium" | "high";
  items: AssignedReviewer[];
  documentMap: Map<string, ControlledDocument>;
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
          items.slice(0, 5).map((reviewer) => {
            const document = documentMap.get(reviewer.document_id);

            return (
              <div key={reviewer.id} style={escalationItemStyle}>
                <Link href={`/documents/${reviewer.document_id}`} style={{ fontWeight: 700 }}>
                  {document ? `${document.document_number} Rev ${document.revision}` : reviewer.document_id}
                </Link>
                <div style={smallTextStyle}>
                  Reviewer: {reviewer.reviewer_email} | Role:{" "}
                  {reviewer.reviewer_role || reviewer.reviewer_type} | Due:{" "}
                  {formatDate(reviewer.due_date)}
                </div>
              </div>
            );
          })
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
  rows: [string, number][];
}) {
  return (
    <div style={cardStyle}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      {rows.map(([label, count]) => (
        <BarRow
          key={label}
          label={label}
          value={count}
          max={Math.max(...rows.map((row) => row[1]), 1)}
        />
      ))}
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
      {data.map((item) => (
        <BarRow key={item.label} label={item.label} value={item.value} max={max} />
      ))}
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

function getStatusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "Draft",
    collaboration: "Collaboration",
    formal_review: "Formal Review",
    approved: "Approved",
    release: "Released",
    effective: "Released",
    rejected: "Rejected",
    obsolete: "Obsolete",
    superseded: "Superseded",
  };

  return labels[status] || status;
}

const formatLabel = (value: string) =>
  String(value || "Unspecified")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

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

function formatDate(value: string | null | undefined) {
  if (!value) return "N/A";

  const text = String(value);

  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);

  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return value;
  }
}

const pageStyle: React.CSSProperties = { padding: "24px", background: "#f8fafc", minHeight: "100vh", fontFamily: "Arial, sans-serif" };
const headerStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-start", flexWrap: "wrap", marginBottom: "20px" };
const eyebrowStyle: React.CSSProperties = { fontSize: "12px", letterSpacing: "0.08em", color: "#6b7280", fontWeight: 800 };
const subtleText: React.CSSProperties = { color: "#6b7280" };
const cardStyle: React.CSSProperties = { background: "white", border: "1px solid #d1d5db", borderRadius: "16px", padding: "20px", marginBottom: "20px" };
const sectionHeaderStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: "14px", alignItems: "flex-start", flexWrap: "wrap", marginBottom: "16px" };
const kpiGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "14px", marginBottom: "20px" };
const analyticsGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "14px", marginBottom: "20px" };
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
const overdueCellStyle: React.CSSProperties = { ...tdStyle, color: "#dc2626", fontWeight: 700 };
const smallTextStyle: React.CSSProperties = { fontSize: "12px", color: "#6b7280" };
