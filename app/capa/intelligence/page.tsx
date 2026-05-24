"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { runOverdueTaskScan } from "../../../lib/overdueTaskScanner";

export default function CapaIntelligenceDashboardPage() {
  const [capas, setCapas] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanRunning, setScanRunning] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const [userEmail, setUserEmail] = useState("");

  const fetchData = async () => {
    setLoading(true);

    const { data: userData } = await supabase.auth.getUser();
    setUserEmail(userData?.user?.email || "");

    const capaRes = await supabase
      .from("capas")
      .select("*")
      .order("created_at", { ascending: false });

    const taskRes = await supabase
      .from("capa_tasks")
      .select("*")
      .order("created_at", { ascending: false });

    if (!capaRes.error) setCapas(capaRes.data || []);
    if (!taskRes.error) setTasks(taskRes.data || []);

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const runScan = async () => {
    setScanRunning(true);
    setScanResult(null);

    const result = await runOverdueTaskScan(userEmail || null);

    setScanResult(result);
    setScanRunning(false);

    await fetchData();
  };

  const metrics = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);

    const openCapas = capas.filter(
      (c) => c.status !== "closed" && c.status !== "cancelled"
    );

    const overdueCapas = capas.filter((c) => {
      if (!c.due_date) return false;

      return (
        c.status !== "closed" &&
        c.status !== "cancelled" &&
        c.due_date < today
      );
    });

    const criticalCapas = capas.filter(
      (c) =>
        String(c.risk_level || "").toLowerCase() === "critical" ||
        String(c.severity || "").toLowerCase() === "critical"
    );

    const pendingInvestigationApproval = capas.filter(
      (c) => c.investigation_approval_status === "pending"
    );

    const pendingClosureApproval = capas.filter(
      (c) => c.closure_approval_status === "pending"
    );

    const ineffectiveCapas = capas.filter(
      (c) =>
        c.effectiveness_rating === "not_effective" ||
        c.effectiveness_result === "ineffective"
    );

    const overdueTasks = tasks.filter((t) => {
      if (!t.due_date) return false;
      return t.status !== "complete" && t.due_date < today;
    });

    const blockedTasks = tasks.filter((t) => t.status === "blocked");

    const incompleteEffectiveness = capas.filter(
      (c) =>
        c.status !== "cancelled" &&
        c.status !== "closed" &&
        !c.effectiveness_rating
    );

    return {
      openCapas,
      overdueCapas,
      criticalCapas,
      pendingInvestigationApproval,
      pendingClosureApproval,
      ineffectiveCapas,
      overdueTasks,
      blockedTasks,
      incompleteEffectiveness,
    };
  }, [capas, tasks]);

  const rootCauseCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    capas.forEach((c) => {
      const key =
        c.root_cause_method ||
        c.root_cause_category ||
        "Unspecified";

      counts[key] = (counts[key] || 0) + 1;
    });

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [capas]);

  const supplierCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    capas.forEach((c) => {
      const key =
        c.affected_supplier ||
        c.supplier_name ||
        "Unspecified";

      counts[key] = (counts[key] || 0) + 1;
    });

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [capas]);

  if (loading) {
    return <main style={pageStyle}>Loading CAPA Intelligence...</main>;
  }

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>ENTERPRISE QUALITY COMMAND CENTER</div>

          <h1 style={{ margin: "6px 0" }}>CAPA Intelligence Dashboard</h1>

          <p style={subtleText}>
            Executive operational intelligence for CAPA execution, risk,
            effectiveness, task ownership, overdue governance, and escalation control.
          </p>
        </div>

        <Link
          href="/capa"
          style={{
            ...darkButtonStyle,
            background: "#2563eb",
          }}
        >
          Back to CAPA Program
        </Link>
      </header>

      <section style={governanceScanStyle}>
        <div>
          <div style={eyebrowStyle}>OVERDUE TASK GOVERNANCE</div>
          <h2 style={{ margin: "6px 0" }}>Manual Overdue Task Scan</h2>
          <p style={subtleText}>
            Creates high-signal overdue task notifications only for task owners.
            Respects user notification preferences and deduplicates once per day.
          </p>
        </div>

        <button
          onClick={runScan}
          disabled={scanRunning}
          style={scanRunning ? disabledButtonStyle : blueButtonStyle}
        >
          {scanRunning ? "Scanning..." : "Run Overdue Task Scan"}
        </button>

        {scanResult ? (
          <div style={scanResultGridStyle}>
            <MetricTile label="Tasks Scanned" value={scanResult.tasksScanned} />
            <MetricTile label="Overdue Detected" value={scanResult.overdueDetected} />
            <MetricTile label="Notifications Created" value={scanResult.notificationsCreated} />
            <MetricTile label="Skipped: No Owner Email" value={scanResult.skippedNoOwnerEmail} />
            <MetricTile label="Skipped: Preference/Duplicate" value={scanResult.skippedPreferenceOrDuplicate} />
            <MetricTile label="Errors" value={scanResult.errors?.length || 0} />

            {scanResult.errors?.length > 0 ? (
              <div style={errorBoxStyle}>
                {scanResult.errors.map((error: string, index: number) => (
                  <div key={index}>{error}</div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <section style={kpiGridStyle}>
        <KpiCard title="Open CAPAs" value={metrics.openCapas.length} color="#2563eb" />
        <KpiCard title="Overdue CAPAs" value={metrics.overdueCapas.length} color="#dc2626" />
        <KpiCard title="Critical CAPAs" value={metrics.criticalCapas.length} color="#991b1b" />
        <KpiCard title="Pending Investigation Approval" value={metrics.pendingInvestigationApproval.length} color="#d97706" />
        <KpiCard title="Pending Closure Approval" value={metrics.pendingClosureApproval.length} color="#d97706" />
        <KpiCard title="Ineffective CAPAs" value={metrics.ineffectiveCapas.length} color="#dc2626" />
        <KpiCard title="Overdue Tasks" value={metrics.overdueTasks.length} color="#dc2626" />
        <KpiCard title="Blocked Tasks" value={metrics.blockedTasks.length} color="#d97706" />
      </section>

      <section style={escalationPanelStyle}>
        <div>
          <div style={eyebrowStyle}>EXECUTIVE ESCALATION ENGINE</div>
          <h2 style={{ margin: "6px 0" }}>Action Required</h2>
          <p style={subtleText}>
            Prioritized CAPA signals requiring leadership attention, follow-up,
            or governance action. Notifications remain limited to task assignment and overdue task ownership.
          </p>
        </div>

        <div style={escalationGridStyle}>
          <EscalationCard title="Overdue CAPAs" count={metrics.overdueCapas.length} severity={metrics.overdueCapas.length > 0 ? "high" : "controlled"} items={metrics.overdueCapas} itemType="capa" description="CAPAs past due and not closed." />

          <EscalationCard title="Overdue Tasks" count={metrics.overdueTasks.length} severity={metrics.overdueTasks.length > 0 ? "high" : "controlled"} items={metrics.overdueTasks} itemType="task" description="Execution tasks past due and not complete." />

          <EscalationCard title="Blocked Tasks" count={metrics.blockedTasks.length} severity={metrics.blockedTasks.length > 0 ? "medium" : "controlled"} items={metrics.blockedTasks} itemType="task" description="Tasks marked blocked and requiring intervention." />

          <EscalationCard title="Pending Investigation Approval" count={metrics.pendingInvestigationApproval.length} severity={metrics.pendingInvestigationApproval.length > 0 ? "medium" : "controlled"} items={metrics.pendingInvestigationApproval} itemType="capa" description="CAPAs waiting for investigation/root cause approval." />

          <EscalationCard title="Pending Closure Approval" count={metrics.pendingClosureApproval.length} severity={metrics.pendingClosureApproval.length > 0 ? "medium" : "controlled"} items={metrics.pendingClosureApproval} itemType="capa" description="CAPAs waiting for final closure approval." />

          <EscalationCard title="High / Critical CAPAs" count={metrics.criticalCapas.length} severity={metrics.criticalCapas.length > 0 ? "high" : "controlled"} items={metrics.criticalCapas} itemType="capa" description="High-severity or critical-risk CAPAs." />

          <EscalationCard title="Ineffective CAPAs" count={metrics.ineffectiveCapas.length} severity={metrics.ineffectiveCapas.length > 0 ? "high" : "controlled"} items={metrics.ineffectiveCapas} itemType="capa" description="CAPAs with ineffective effectiveness results." />

          <EscalationCard title="Incomplete Effectiveness" count={metrics.incompleteEffectiveness.length} severity={metrics.incompleteEffectiveness.length > 0 ? "medium" : "controlled"} items={metrics.incompleteEffectiveness} itemType="capa" description="Active CAPAs missing effectiveness rating." />
        </div>
      </section>

      <div style={dashboardGridStyle}>
        <section style={cardStyle}>
          <h2>Root Cause Intelligence</h2>

          {rootCauseCounts.length === 0 ? (
            <p style={subtleText}>No root cause data available.</p>
          ) : (
            rootCauseCounts.map(([key, count]) => (
              <BarRow key={key} label={key} value={count} max={rootCauseCounts[0]?.[1] || 1} />
            ))
          )}
        </section>

        <section style={cardStyle}>
          <h2>Supplier Recurrence</h2>

          {supplierCounts.length === 0 ? (
            <p style={subtleText}>No supplier recurrence data available.</p>
          ) : (
            supplierCounts.map(([key, count]) => (
              <BarRow key={key} label={key} value={count} max={supplierCounts[0]?.[1] || 1} />
            ))
          )}
        </section>

        <section style={cardStyle}>
          <h2>Effectiveness Intelligence</h2>

          <MetricRow label="Effective" value={capas.filter((c) => c.effectiveness_rating === "effective").length} />
          <MetricRow label="Partially Effective" value={capas.filter((c) => c.effectiveness_rating === "partially_effective").length} />
          <MetricRow label="Not Effective" value={capas.filter((c) => c.effectiveness_rating === "not_effective").length} />
        </section>

        <section style={cardStyle}>
          <h2>Task Execution Intelligence</h2>

          <MetricRow label="Total Tasks" value={tasks.length} />
          <MetricRow label="Completed Tasks" value={tasks.filter((t) => t.status === "complete").length} />
          <MetricRow label="Blocked Tasks" value={tasks.filter((t) => t.status === "blocked").length} />
          <MetricRow label="Pending Review" value={tasks.filter((t) => t.status === "pending_review").length} />
        </section>

        <section style={cardStyle}>
          <h2>Regulatory Readiness</h2>

          <MetricRow label="Unsigned Closed CAPAs" value={capas.filter((c) => !c.signed_by && c.status === "closed").length} />
          <MetricRow label="Missing Closure Approval" value={capas.filter((c) => c.status === "closed" && !c.closure_approved_by).length} />
          <MetricRow label="Incomplete Effectiveness" value={capas.filter((c) => !c.effectiveness_rating).length} />
        </section>

        <section style={cardStyle}>
          <h2>Recent CAPAs</h2>

          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>CAPA</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Risk</th>
                  <th style={thStyle}>Owner</th>
                </tr>
              </thead>

              <tbody>
                {capas.slice(0, 10).map((c) => (
                  <tr key={c.id}>
                    <td style={tdStyle}>
                      <Link href={`/capa/${c.id}`}>
                        {c.capa_number || c.id}
                      </Link>
                    </td>

                    <td style={tdStyle}>{c.status || "N/A"}</td>
                    <td style={tdStyle}>{c.risk_level || c.severity || "N/A"}</td>
                    <td style={tdStyle}>{c.owner || "N/A"}</td>
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

function EscalationCard({
  title,
  count,
  severity,
  items,
  itemType,
  description,
}: {
  title: string;
  count: number;
  severity: "controlled" | "medium" | "high";
  items: any[];
  itemType: "capa" | "task";
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
          <div style={{ color: "#15803d", fontWeight: 700 }}>No escalation required.</div>
        ) : (
          items.slice(0, 5).map((item) => (
            <div key={item.id} style={escalationItemStyle}>
              {itemType === "capa" ? (
                <>
                  <Link href={`/capa/${item.id}`} style={{ fontWeight: 700 }}>
                    {item.capa_number || item.title || item.id}
                  </Link>
                  <div style={smallMutedStyle}>
                    {item.title || "Untitled CAPA"} | Owner: {item.owner || "N/A"} | Due: {item.due_date || "N/A"}
                  </div>
                </>
              ) : (
                <>
                  <strong>{item.task_title || "Untitled Task"}</strong>
                  <div style={smallMutedStyle}>
                    Owner: {item.owner || "N/A"} | Due: {item.due_date || "N/A"} | Status: {item.status || "open"}
                  </div>
                  {item.capa_id ? <Link href={`/capa/${item.capa_id}`}>Open CAPA</Link> : null}
                </>
              )}
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

function KpiCard({ title, value, color }: { title: string; value: number; color: string }) {
  return (
    <div style={{ ...kpiCardStyle, borderLeft: `8px solid ${color}` }}>
      <div style={kpiTitleStyle}>{title}</div>
      <div style={{ fontSize: "34px", fontWeight: 800, color }}>{value}</div>
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

function MetricTile({ label, value }: { label: string; value: number }) {
  return (
    <div style={metricTileStyle}>
      <div style={smallMutedStyle}>{label}</div>
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

const blueButtonStyle: React.CSSProperties = {
  background: "#2563eb",
  color: "white",
  border: "none",
  padding: "10px 14px",
  borderRadius: "8px",
  textDecoration: "none",
  fontWeight: 700,
  cursor: "pointer",
};

const disabledButtonStyle: React.CSSProperties = {
  background: "#9ca3af",
  color: "white",
  border: "none",
  padding: "10px 14px",
  borderRadius: "8px",
  fontWeight: 700,
  cursor: "not-allowed",
};

const governanceScanStyle: React.CSSProperties = {
  background: "white",
  borderRadius: "16px",
  padding: "22px",
  border: "1px solid #d1d5db",
  marginBottom: "24px",
};

const scanResultGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "12px",
  marginTop: "18px",
};

const metricTileStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: "12px",
  padding: "12px",
  background: "#f9fafb",
};

const errorBoxStyle: React.CSSProperties = {
  gridColumn: "1 / -1",
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#991b1b",
  borderRadius: "12px",
  padding: "12px",
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
