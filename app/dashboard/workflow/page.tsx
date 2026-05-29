"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { isOverdue, normalizeEmail } from "../../../lib/documentWorkflowEngine";

type ControlledDocument = {
  id: string;
  document_number: string;
  title: string;
  revision: string;
  status: string;
  owner_email: string | null;
  document_type: string | null;
  department: string | null;
  process_area: string | null;
  effective_date: string | null;
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
  due_date: string | null;
  sla_days: number | null;
};

type TrainingAssignment = {
  id: string;
  document_id: string;
  user_email: string;
  status: string;
  assigned_at: string | null;
  due_date?: string | null;
};

type Notification = {
  id: string;
  user_email: string;
  notification_type: string;
  severity: string | null;
  title: string;
  message: string | null;
  read_status: boolean | null;
  created_at: string | null;
};

type WorkflowEvent = {
  id: string;
  document_id: string;
  event_type: string;
  performed_by: string | null;
  performed_at: string | null;
  comments: string | null;
};

export default function WorkflowDashboardPage() {
  const [documents, setDocuments] = useState<ControlledDocument[]>([]);
  const [reviewers, setReviewers] = useState<AssignedReviewer[]>([]);
  const [training, setTraining] = useState<TrainingAssignment[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [events, setEvents] = useState<WorkflowEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");

  const fetchDashboard = async () => {
    setLoading(true);

    const { data: userData } = await supabase.auth.getUser();
    const email = userData?.user?.email || "";
    setUserEmail(email);

    const [docRes, reviewerRes, trainingRes, notificationRes, eventRes] =
      await Promise.all([
        supabase
          .from("controlled_documents")
          .select(
            "id, document_number, title, revision, status, owner_email, document_type, department, process_area, effective_date"
          )
          .order("created_at", { ascending: false }),

        supabase
          .from("document_assigned_reviewers")
          .select(
            "id, document_id, reviewer_type, reviewer_email, reviewer_role, required_reviewer, review_sequence, review_status, due_date, sla_days"
          )
          .order("due_date", { ascending: true }),

        supabase
          .from("document_training_assignments")
          .select("id, document_id, user_email, status, assigned_at, due_date")
          .order("assigned_at", { ascending: false }),

        supabase
          .from("notifications")
          .select(
            "id, user_email, notification_type, severity, title, message, read_status, created_at"
          )
          .order("created_at", { ascending: false })
          .limit(50),

        supabase
          .from("document_workflow_events")
          .select("id, document_id, event_type, performed_by, performed_at, comments")
          .order("performed_at", { ascending: false })
          .limit(25),
      ]);

    if (!docRes.error) setDocuments((docRes.data as ControlledDocument[]) || []);
    if (!reviewerRes.error) setReviewers((reviewerRes.data as AssignedReviewer[]) || []);
    if (!trainingRes.error) setTraining((trainingRes.data as TrainingAssignment[]) || []);
    if (!notificationRes.error) setNotifications((notificationRes.data as Notification[]) || []);
    if (!eventRes.error) setEvents((eventRes.data as WorkflowEvent[]) || []);

    setLoading(false);
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const docMap = useMemo(() => {
    const map = new Map<string, ControlledDocument>();
    documents.forEach((doc) => map.set(doc.id, doc));
    return map;
  }, [documents]);

  const openReviews = reviewers.filter((r) => r.review_status !== "approved");
  const overdueReviews = openReviews.filter((r) => isOverdue(r.due_date));

  const openTraining = training.filter((t) => t.status !== "completed");
  const overdueTraining = openTraining.filter((t) => isOverdue(t.due_date || null));

  const unreadNotifications = notifications.filter(
    (n) => normalizeEmail(n.user_email) === normalizeEmail(userEmail) && !n.read_status
  );

  const criticalNotifications = notifications.filter(
    (n) =>
      normalizeEmail(n.user_email) === normalizeEmail(userEmail) &&
      n.severity === "critical" &&
      !n.read_status
  );

  const docsInCollaboration = documents.filter((d) => d.status === "collaboration");
  const docsInFormalReview = documents.filter((d) => d.status === "formal_review");
  const docsAwaitingRelease = documents.filter((d) => d.status === "approved");
  const docsRejected = documents.filter((d) => d.status === "rejected");

  const slaCompliance =
    reviewers.length === 0
      ? 100
      : Math.round(
          ((reviewers.length - overdueReviews.length) / reviewers.length) * 100
        );

  if (loading) {
    return <main style={pageStyle}>Loading Workflow Dashboard...</main>;
  }

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>QUALIFLOW ENTERPRISE</div>
          <h1 style={{ margin: "6px 0" }}>Workflow Dashboard</h1>
          <p style={subtleText}>
            Review aging, training status, notifications, and workflow execution visibility.
          </p>
        </div>

        <div style={buttonRowStyle}>
          <a href="/dashboard" style={darkButtonStyle}>Main Dashboard</a>
          <a href="/documents" style={darkButtonStyle}>Documents</a>
        </div>
      </header>

      <section style={kpiGridStyle}>
        <KpiCard title="Open Reviews" value={openReviews.length} color="#d97706" />
        <KpiCard title="Overdue Reviews" value={overdueReviews.length} color="#dc2626" />
        <KpiCard title="Workflow SLA" value={`${slaCompliance}%`} color="#2563eb" />
        <KpiCard title="Open Training" value={openTraining.length} color="#7c3aed" />
        <KpiCard title="Overdue Training" value={overdueTraining.length} color="#dc2626" />
        <KpiCard title="Unread Alerts" value={unreadNotifications.length} color="#0f766e" />
        <KpiCard title="Critical Alerts" value={criticalNotifications.length} color="#991b1b" />
      </section>

      <section style={kpiGridStyle}>
        <KpiCard title="Collaboration" value={docsInCollaboration.length} color="#7c3aed" />
        <KpiCard title="Formal Review" value={docsInFormalReview.length} color="#d97706" />
        <KpiCard title="Awaiting Release" value={docsAwaitingRelease.length} color="#2563eb" />
        <KpiCard title="Rejected / Returned" value={docsRejected.length} color="#dc2626" />
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Overdue Reviews</h2>
        {overdueReviews.length === 0 ? (
          <p style={subtleText}>No overdue reviews.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Document</th>
                  <th style={thStyle}>Reviewer</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Due Date</th>
                  <th style={thStyle}>Status</th>
                </tr>
              </thead>
              <tbody>
                {overdueReviews.map((review) => {
                  const doc = docMap.get(review.document_id);
                  return (
                    <tr key={review.id}>
                      <td style={tdStyle}>
                        {doc ? (
                          <a href={`/documents/${doc.id}`}>
                            {doc.document_number} Rev {doc.revision}
                          </a>
                        ) : (
                          review.document_id
                        )}
                      </td>
                      <td style={tdStyle}>{review.reviewer_email}</td>
                      <td style={tdStyle}>{review.reviewer_type}</td>
                      <td style={tdStyle}>{formatDate(review.due_date)}</td>
                      <td style={tdStyle}>
                        <StatusBadge status={review.review_status || "pending"} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Open Workflow Reviews</h2>
        {openReviews.length === 0 ? (
          <p style={subtleText}>No open reviews.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Document</th>
                  <th style={thStyle}>Reviewer</th>
                  <th style={thStyle}>Role</th>
                  <th style={thStyle}>SLA Days</th>
                  <th style={thStyle}>Due</th>
                </tr>
              </thead>
              <tbody>
                {openReviews.slice(0, 20).map((review) => {
                  const doc = docMap.get(review.document_id);
                  return (
                    <tr key={review.id}>
                      <td style={tdStyle}>
                        {doc ? (
                          <a href={`/documents/${doc.id}`}>
                            {doc.document_number} Rev {doc.revision}
                          </a>
                        ) : (
                          review.document_id
                        )}
                      </td>
                      <td style={tdStyle}>{review.reviewer_email}</td>
                      <td style={tdStyle}>{review.reviewer_role || review.reviewer_type}</td>
                      <td style={tdStyle}>{review.sla_days || "N/A"}</td>
                      <td style={isOverdue(review.due_date) ? overdueCellStyle : tdStyle}>
                        {formatDate(review.due_date)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Open Training</h2>
        {openTraining.length === 0 ? (
          <p style={subtleText}>No open training assignments.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Document</th>
                  <th style={thStyle}>Trainee</th>
                  <th style={thStyle}>Assigned</th>
                  <th style={thStyle}>Due</th>
                  <th style={thStyle}>Status</th>
                </tr>
              </thead>
              <tbody>
                {openTraining.slice(0, 20).map((item) => {
                  const doc = docMap.get(item.document_id);
                  return (
                    <tr key={item.id}>
                      <td style={tdStyle}>
                        {doc ? (
                          <a href={`/documents/${doc.id}`}>
                            {doc.document_number} Rev {doc.revision}
                          </a>
                        ) : (
                          item.document_id
                        )}
                      </td>
                      <td style={tdStyle}>{item.user_email}</td>
                      <td style={tdStyle}>{formatDate(item.assigned_at)}</td>
                      <td style={isOverdue(item.due_date || null) ? overdueCellStyle : tdStyle}>
                        {formatDate(item.due_date || null)}
                      </td>
                      <td style={tdStyle}>{item.status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Recent Workflow Activity</h2>
        {events.length === 0 ? (
          <p style={subtleText}>No recent workflow events.</p>
        ) : (
          <div style={{ display: "grid", gap: "10px" }}>
            {events.map((event) => {
              const doc = docMap.get(event.document_id);
              return (
                <div key={event.id} style={timelineItemStyle}>
                  <strong>{event.event_type}</strong>
                  <div style={smallTextStyle}>
                    {doc ? `${doc.document_number} Rev ${doc.revision}` : event.document_id}
                    {" • "}
                    {event.performed_by || "unknown"}
                    {" • "}
                    {formatDateTime(event.performed_at)}
                  </div>
                  {event.comments ? <p style={{ margin: "6px 0 0" }}>{event.comments}</p> : null}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

function KpiCard({
  title,
  value,
  color,
}: {
  title: string;
  value: number | string;
  color: string;
}) {
  return (
    <div style={{ ...kpiCardStyle, borderLeft: `8px solid ${color}` }}>
      <div style={kpiTitleStyle}>{title}</div>
      <div style={{ fontSize: "30px", fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "approved"
      ? "#15803d"
      : status === "rejected"
      ? "#dc2626"
      : status === "pending"
      ? "#d97706"
      : "#6b7280";

  return (
    <span
      style={{
        background: color,
        color: "white",
        borderRadius: "999px",
        padding: "3px 8px",
        fontSize: "12px",
        fontWeight: 700,
      }}
    >
      {status}
    </span>
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return "N/A";
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return value;
  }
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "N/A";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
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

const cardStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid #d1d5db",
  borderRadius: "16px",
  padding: "20px",
  marginBottom: "20px",
};

const kpiGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "14px",
  marginBottom: "20px",
};

const kpiCardStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid #d1d5db",
  borderRadius: "14px",
  padding: "16px",
};

const kpiTitleStyle: React.CSSProperties = {
  color: "#6b7280",
  marginBottom: "8px",
};

const buttonRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "12px",
  flexWrap: "wrap",
  alignItems: "center",
  marginTop: "12px",
};

const darkButtonStyle: React.CSSProperties = {
  background: "#111827",
  color: "white",
  padding: "10px 14px",
  borderRadius: "8px",
  textDecoration: "none",
  fontWeight: 700,
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  borderBottom: "1px solid #d1d5db",
  padding: "10px",
};

const tdStyle: React.CSSProperties = {
  borderBottom: "1px solid #e5e7eb",
  padding: "10px",
  verticalAlign: "top",
};

const overdueCellStyle: React.CSSProperties = {
  ...tdStyle,
  color: "#dc2626",
  fontWeight: 700,
};

const smallTextStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#6b7280",
};

const timelineItemStyle: React.CSSProperties = {
  borderLeft: "4px solid #2563eb",
  padding: "10px 12px",
  background: "#f9fafb",
  borderRadius: "8px",
};
