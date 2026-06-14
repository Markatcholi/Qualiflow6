"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

export default function ManagementReviewDashboard() {
  const [loading, setLoading] = useState(true);

  const [capas, setCapas] = useState<any[]>([]);
  const [ncmrs, setNcmrs] = useState<any[]>([]);
  const [audits, setAudits] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [training, setTraining] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [workflowEvents, setWorkflowEvents] = useState<any[]>([]);

  const fetchData = async () => {
    setLoading(true);

    const [
      capaRes,
      ncmrRes,
      auditRes,
      documentRes,
      trainingRes,
      notificationRes,
      workflowRes,
    ] = await Promise.allSettled([
      supabase.from("capa_records").select("*"),
      supabase.from("ncmr_records").select("*"),
      supabase.from("audit_findings").select("*"),
      supabase.from("controlled_documents").select("*"),
      supabase.from("document_training_assignments").select("*"),
      supabase.from("notifications").select("*"),
      supabase.from("document_workflow_events").select("*"),
    ]);

    if (capaRes.status === "fulfilled")
      setCapas(capaRes.value.data || []);

    if (ncmrRes.status === "fulfilled")
      setNcmrs(ncmrRes.value.data || []);

    if (auditRes.status === "fulfilled")
      setAudits(auditRes.value.data || []);

    if (documentRes.status === "fulfilled")
      setDocuments(documentRes.value.data || []);

    if (trainingRes.status === "fulfilled")
      setTraining(trainingRes.value.data || []);

    if (notificationRes.status === "fulfilled")
      setNotifications(notificationRes.value.data || []);

    if (workflowRes.status === "fulfilled")
      setWorkflowEvents(workflowRes.value.data || []);

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const metrics = useMemo(() => {
    const openCapas = capas.filter(
      (x) =>
        x.status !== "closed" &&
        x.status !== "approved"
    ).length;

    const openNcmrs = ncmrs.filter(
      (x) =>
        x.status !== "closed"
    ).length;

    const openAudits = audits.filter(
      (x) =>
        x.status !== "closed"
    ).length;

    const docsInReview = documents.filter(
      (x) =>
        x.status === "collaboration" ||
        x.status === "formal_review"
    ).length;

    const effectiveDocs = documents.filter(
      (x) =>
        x.status === "effective"
    ).length;

    const trainingCompleted = training.filter(
      (x) =>
        x.status === "completed"
    ).length;

    const trainingOpen = training.filter(
      (x) =>
        x.status !== "completed"
    ).length;

    const criticalNotifications = notifications.filter(
      (x) =>
        x.severity === "critical"
    ).length;

    const unreadNotifications = notifications.filter(
      (x) =>
        !x.read_status
    ).length;

    return {
      openCapas,
      openNcmrs,
      openAudits,
      docsInReview,
      effectiveDocs,
      trainingCompleted,
      trainingOpen,
      criticalNotifications,
      unreadNotifications,
    };
  }, [
    capas,
    ncmrs,
    audits,
    documents,
    training,
    notifications,
  ]);

  if (loading) {
    return (
      <main style={pageStyle}>
        Loading Management Review Dashboard...
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>
            QUALIFLOW ENTERPRISE
          </div>

          <h1 style={{ margin: "6px 0" }}>
            Management Review Dashboard
          </h1>

          <p style={subtleText}>
            Executive quality system health,
            compliance, workflow, and training
            oversight.
          </p>
        </div>

        <div style={buttonRowStyle}>
          <a
            href="/dashboard"
            style={darkButtonStyle}
          >
            Dashboard
          </a>

          <a
            href="/dashboard/workflow"
            style={blueButtonStyle}
          >
            Workflow Dashboard
          </a>
        </div>
      </header>

      <section style={kpiGridStyle}>
        <KpiCard
          title="Open CAPAs"
          value={metrics.openCapas}
          color="#dc2626"
        />

        <KpiCard
          title="Open NCMRs"
          value={metrics.openNcmrs}
          color="#d97706"
        />

        <KpiCard
          title="Open Audit Findings"
          value={metrics.openAudits}
          color="#2563eb"
        />

        <KpiCard
          title="Docs In Review"
          value={metrics.docsInReview}
          color="#7c3aed"
        />
      </section>

      <section style={kpiGridStyle}>
        <KpiCard
          title="Effective Documents"
          value={metrics.effectiveDocs}
          color="#15803d"
        />

        <KpiCard
          title="Training Complete"
          value={metrics.trainingCompleted}
          color="#0f766e"
        />

        <KpiCard
          title="Training Open"
          value={metrics.trainingOpen}
          color="#d97706"
        />

        <KpiCard
          title="Critical Alerts"
          value={metrics.criticalNotifications}
          color="#991b1b"
        />
      </section>

      <section style={kpiGridStyle}>
        <KpiCard
          title="Unread Notifications"
          value={metrics.unreadNotifications}
          color="#2563eb"
        />

        <KpiCard
          title="Workflow Events"
          value={workflowEvents.length}
          color="#7c3aed"
        />

        <KpiCard
          title="CAPA Records"
          value={capas.length}
          color="#0f766e"
        />

        <KpiCard
          title="Documents"
          value={documents.length}
          color="#15803d"
        />
      </section>

      <section style={cardStyle}>
        <h2>Management Review Summary</h2>

        <table style={tableStyle}>
          <tbody>
            <tr>
              <td style={labelCellStyle}>
                CAPA Program
              </td>
              <td style={valueCellStyle}>
                {metrics.openCapas} open CAPAs
              </td>
            </tr>

            <tr>
              <td style={labelCellStyle}>
                Nonconformance Program
              </td>
              <td style={valueCellStyle}>
                {metrics.openNcmrs} open NCMRs
              </td>
            </tr>

            <tr>
              <td style={labelCellStyle}>
                Audit Program
              </td>
              <td style={valueCellStyle}>
                {metrics.openAudits} open findings
              </td>
            </tr>

            <tr>
              <td style={labelCellStyle}>
                Document Control
              </td>
              <td style={valueCellStyle}>
                {metrics.docsInReview} documents
                currently in workflow
              </td>
            </tr>

            <tr>
              <td style={labelCellStyle}>
                Training Program
              </td>
              <td style={valueCellStyle}>
                {metrics.trainingCompleted}
                completed /{" "}
                {metrics.trainingOpen}
                outstanding
              </td>
            </tr>

            <tr>
              <td style={labelCellStyle}>
                Notifications
              </td>
              <td style={valueCellStyle}>
                {metrics.unreadNotifications}
                unread /{" "}
                {metrics.criticalNotifications}
                critical
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section style={cardStyle}>
        <h2>Recent Workflow Activity</h2>

        {workflowEvents.length === 0 ? (
          <p style={subtleText}>
            No workflow events available.
          </p>
        ) : (
          <div
            style={{
              display: "grid",
              gap: "10px",
            }}
          >
            {workflowEvents
              .slice(0, 15)
              .map((event) => (
                <div
                  key={event.id}
                  style={timelineItemStyle}
                >
                  <strong>
                    {event.event_type}
                  </strong>

                  <div
                    style={smallTextStyle}
                  >
                    {event.performed_by ||
                      "system"}
                  </div>

                  <div
                    style={smallTextStyle}
                  >
                    {event.performed_at}
                  </div>
                </div>
              ))}
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
  value: string | number;
  color: string;
}) {
  return (
    <div
      style={{
        ...kpiCardStyle,
        borderLeft: `8px solid ${color}`,
      }}
    >
      <div style={kpiTitleStyle}>
        {title}
      </div>

      <div
        style={{
          fontSize: "30px",
          fontWeight: 800,
          color,
        }}
      >
        {value}
      </div>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  padding: "24px",
  background: "#f8fafc",
  minHeight: "100vh",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  flexWrap: "wrap",
  gap: "12px",
  marginBottom: "20px",
};

const eyebrowStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 800,
  color: "#6b7280",
};

const subtleText: React.CSSProperties = {
  color: "#6b7280",
};

const buttonRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "10px",
};

const darkButtonStyle: React.CSSProperties = {
  background: "#111827",
  color: "white",
  padding: "10px 14px",
  borderRadius: "8px",
  textDecoration: "none",
};

const blueButtonStyle: React.CSSProperties = {
  background: "#2563eb",
  color: "white",
  padding: "10px 14px",
  borderRadius: "8px",
  textDecoration: "none",
};

const kpiGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(220px,1fr))",
  gap: "12px",
  marginBottom: "20px",
};

const kpiCardStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid #d1d5db",
  borderRadius: "12px",
  padding: "16px",
};

const kpiTitleStyle: React.CSSProperties = {
  color: "#6b7280",
  marginBottom: "6px",
};

const cardStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid #d1d5db",
  borderRadius: "12px",
  padding: "20px",
  marginBottom: "20px",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};

const labelCellStyle: React.CSSProperties = {
  fontWeight: 700,
  borderBottom: "1px solid #e5e7eb",
  padding: "10px",
};

const valueCellStyle: React.CSSProperties = {
  borderBottom: "1px solid #e5e7eb",
  padding: "10px",
};

const timelineItemStyle: React.CSSProperties = {
  borderLeft: "4px solid #2563eb",
  background: "#f9fafb",
  padding: "10px",
  borderRadius: "8px",
};

const smallTextStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#6b7280",
};
