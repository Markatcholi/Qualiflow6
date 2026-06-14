
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type TrainingAssignment = {
  id: string;
  document_id: string | null;
  assigned_to_email: string;
  assigned_by_email: string | null;
  assignment_source: string | null;
  role_name: string | null;
  department: string | null;
  training_title: string | null;
  training_description: string | null;
  due_date: string | null;
  status: string | null;
  completed_at: string | null;
  completed_by: string | null;
  effectiveness_required: boolean | null;
  effectiveness_status: string | null;
  supervisor_verification_required: boolean | null;
  supervisor_verified_by: string | null;
  supervisor_verified_at: string | null;
  acknowledgement_required: boolean | null;
  acknowledged_at: string | null;
  acknowledged_by?: string | null;
  signature_id?: string | null;
  training_comments: string | null;
  created_at: string | null;
};

type TrainingMatrixRow = {
  id: string;
  role_name: string | null;
  department: string | null;
  document_number: string | null;
  required_training: boolean | null;
  effectiveness_required: boolean | null;
  created_at: string | null;
};

type ControlledDocument = {
  id: string;
  document_number: string;
  title: string;
  revision: string;
  status: string;
};

type ElectronicSignature = {
  id: string;
  module_name: string;
  record_id: string;
  action_type: string;
  signed_by: string;
  signer_role: string | null;
  signature_meaning: string;
  signature_reason: string | null;
  signed_at: string | null;
};

type EmployeeProfile = {
  id: string;
  user_email: string;
  full_name: string | null;
  department: string | null;
  role_name: string | null;
  manager_email: string | null;
  active: boolean | null;
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

export default function TrainingIntelligenceDashboardPage() {
  const [assignments, setAssignments] = useState<TrainingAssignment[]>([]);
  const [matrixRows, setMatrixRows] = useState<TrainingMatrixRow[]>([]);
  const [documents, setDocuments] = useState<ControlledDocument[]>([]);
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [signatures, setSignatures] = useState<ElectronicSignature[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);

    const [assignmentRes, matrixRes, docRes, employeeRes, signatureRes] =
      await Promise.all([
        supabase
          .from("training_assignments")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("training_matrix")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("controlled_documents")
          .select("id,document_number,title,revision,status")
          .order("document_number", { ascending: true }),
        supabase
          .from("employee_profiles")
          .select("*")
          .order("user_email", { ascending: true }),
        supabase
          .from("electronic_signatures")
          .select("*")
          .eq("module_name", "training")
          .order("signed_at", { ascending: false }),
      ]);

    if (assignmentRes.error) {
      alert(assignmentRes.error.message);
      setLoading(false);
      return;
    }

    setAssignments((assignmentRes.data as TrainingAssignment[]) || []);
    setMatrixRows((matrixRes.data as TrainingMatrixRow[]) || []);
    setDocuments((docRes.data as ControlledDocument[]) || []);
    setEmployees((employeeRes.data as EmployeeProfile[]) || []);
    setSignatures((signatureRes.data as ElectronicSignature[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const today = new Date().toISOString().slice(0, 10);

  const documentMap = useMemo(() => {
    const map = new Map<string, ControlledDocument>();
    documents.forEach((document) => map.set(document.id, document));
    return map;
  }, [documents]);

  const daysBetween = (startDate?: string | null, endDate?: string | null) => {
    if (!startDate) return 0;
    const start = new Date(startDate).getTime();
    const end = endDate ? new Date(endDate).getTime() : new Date().getTime();
    if (Number.isNaN(start) || Number.isNaN(end)) return 0;
    return Math.max(0, Math.floor((end - start) / (1000 * 60 * 60 * 24)));
  };

  const averageDays = (items: number[]) => {
    if (items.length === 0) return 0;
    return Number((items.reduce((sum, value) => sum + value, 0) / items.length).toFixed(1));
  };

  const percentage = (numerator: number, denominator: number) => {
    if (denominator <= 0) return 0;
    return Number(((numerator / denominator) * 100).toFixed(1));
  };

  const getSlaStatus = (value: number) => {
    if (value >= 90) return { label: "On Target", color: "#15803d", icon: "🟢" };
    if (value >= 75) return { label: "At Risk", color: "#d97706", icon: "🟡" };
    return { label: "Action Required", color: "#dc2626", icon: "🔴" };
  };

  const isOpen = (assignment: TrainingAssignment) =>
    assignment.status !== "completed" &&
    assignment.status !== "waived" &&
    assignment.status !== "effectiveness_complete";

  const isOverdueAssignment = (assignment: TrainingAssignment) =>
    isOpen(assignment) && Boolean(assignment.due_date) && String(assignment.due_date) < today;

  const metrics = useMemo(() => {
    const openTraining = assignments.filter((assignment) => isOpen(assignment));
    const overdueTraining = assignments.filter((assignment) => isOverdueAssignment(assignment));
    const completedTraining = assignments.filter(
      (assignment) =>
        assignment.status === "completed" ||
        assignment.status === "effectiveness_complete",
    );
    const waivedTraining = assignments.filter((assignment) => assignment.status === "waived");
    const inProgressTraining = assignments.filter((assignment) => assignment.status === "in_progress");
    const awaitingSignature = assignments.filter(
      (assignment) =>
        Boolean(assignment.acknowledgement_required) &&
        isOpen(assignment) &&
        !assignment.signature_id,
    );
    const effectivenessRequired = assignments.filter((assignment) => Boolean(assignment.effectiveness_required));
    const effectivenessPending = effectivenessRequired.filter(
      (assignment) =>
        assignment.effectiveness_status !== "effectiveness_complete" &&
        assignment.status !== "effectiveness_complete",
    );
    const supervisorVerificationRequired = assignments.filter((assignment) =>
      Boolean(assignment.supervisor_verification_required),
    );
    const supervisorVerificationPending = supervisorVerificationRequired.filter(
      (assignment) => !assignment.supervisor_verified_at,
    );

    const completionRate = percentage(completedTraining.length, assignments.length);
    const completionStatus = getSlaStatus(completionRate);

    const onTimeCompletionRate = percentage(
      completedTraining.filter((assignment) => {
        if (!assignment.due_date || !assignment.completed_at) return true;
        return String(assignment.completed_at).slice(0, 10) <= String(assignment.due_date);
      }).length,
      completedTraining.length,
    );
    const onTimeStatus = getSlaStatus(onTimeCompletionRate);

    const effectivenessCompletionRate = percentage(
      effectivenessRequired.length - effectivenessPending.length,
      effectivenessRequired.length,
    );
    const effectivenessStatus = getSlaStatus(effectivenessCompletionRate);

    const completionDurations = completedTraining
      .filter((assignment) => assignment.completed_at)
      .map((assignment) => daysBetween(assignment.created_at, assignment.completed_at));

    const openAges = openTraining.map((assignment) => daysBetween(assignment.created_at));
    const oldestOpenTraining = openAges.length > 0 ? Math.max(...openAges) : 0;

    return {
      openTraining,
      overdueTraining,
      completedTraining,
      waivedTraining,
      inProgressTraining,
      awaitingSignature,
      effectivenessRequired,
      effectivenessPending,
      supervisorVerificationRequired,
      supervisorVerificationPending,
      completionRate,
      completionStatus,
      onTimeCompletionRate,
      onTimeStatus,
      effectivenessCompletionRate,
      effectivenessStatus,
      averageCompletionTime: averageDays(completionDurations),
      oldestOpenTraining,
      trainingSignatures: signatures.filter((signature) => signature.module_name === "training"),
      documentLinkedAssignments: assignments.filter((assignment) => assignment.document_id),
    };
  }, [assignments, signatures, today]);

  const kpis: KpiTile[] = [
    { title: "Training Completion Rate", value: metrics.completionRate, suffix: "%", color: metrics.completionStatus.color, target: "Target: 90%", statusLabel: metrics.completionStatus.label, statusIcon: metrics.completionStatus.icon, statusColor: metrics.completionStatus.color },
    { title: "On-Time Completion", value: metrics.onTimeCompletionRate, suffix: "%", color: metrics.onTimeStatus.color, target: "Target: 90%", statusLabel: metrics.onTimeStatus.label, statusIcon: metrics.onTimeStatus.icon, statusColor: metrics.onTimeStatus.color },
    { title: "Effectiveness Completion", value: metrics.effectivenessCompletionRate, suffix: "%", color: metrics.effectivenessStatus.color, target: "Target: 90%", statusLabel: metrics.effectivenessStatus.label, statusIcon: metrics.effectivenessStatus.icon, statusColor: metrics.effectivenessStatus.color },
    { title: "Total Assignments", value: assignments.length, color: "#2563eb" },
    { title: "Open Training", value: metrics.openTraining.length, color: metrics.openTraining.length > 0 ? "#d97706" : "#15803d" },
    { title: "Overdue Training", value: metrics.overdueTraining.length, color: metrics.overdueTraining.length > 0 ? "#dc2626" : "#15803d" },
    { title: "Awaiting Signature", value: metrics.awaitingSignature.length, color: metrics.awaitingSignature.length > 0 ? "#d97706" : "#15803d" },
    { title: "Effectiveness Pending", value: metrics.effectivenessPending.length, color: metrics.effectivenessPending.length > 0 ? "#d97706" : "#15803d" },
    { title: "Supervisor Verification Pending", value: metrics.supervisorVerificationPending.length, color: metrics.supervisorVerificationPending.length > 0 ? "#d97706" : "#15803d" },
    { title: "Average Completion Time", value: metrics.averageCompletionTime, suffix: " days", color: metrics.averageCompletionTime > 14 ? "#d97706" : "#15803d" },
    { title: "Oldest Open Training", value: metrics.oldestOpenTraining, suffix: " days", color: metrics.oldestOpenTraining > 30 ? "#dc2626" : "#15803d" },
    { title: "Matrix Rows", value: matrixRows.length, color: "#7c3aed" },
  ];

  const statusCounts = useMemo(() => buildCounts(assignments, ["status"]), [assignments]);
  const departmentCounts = useMemo(() => buildCounts(assignments, ["department"]), [assignments]);
  const roleCounts = useMemo(() => buildCounts(assignments, ["role_name"]), [assignments]);
  const sourceCounts = useMemo(() => buildCounts(assignments, ["assignment_source"]), [assignments]);
  const employeeCounts = useMemo(() => buildCounts(assignments, ["assigned_to_email"]), [assignments]);

  const documentCompliance = useMemo(() => {
    return documents
      .map((document) => {
        const docAssignments = assignments.filter((assignment) => assignment.document_id === document.id);
        const assigned = docAssignments.length;
        const completed = docAssignments.filter(
          (assignment) =>
            assignment.status === "completed" ||
            assignment.status === "effectiveness_complete",
        ).length;
        const overdue = docAssignments.filter((assignment) => isOverdueAssignment(assignment)).length;
        const awaitingSignature = docAssignments.filter(
          (assignment) => Boolean(assignment.acknowledgement_required) && isOpen(assignment) && !assignment.signature_id,
        ).length;

        return {
          id: document.id,
          documentNumber: document.document_number,
          title: document.title,
          revision: document.revision,
          assigned,
          completed,
          open: docAssignments.filter((assignment) => isOpen(assignment)).length,
          overdue,
          awaitingSignature,
          compliance: assigned === 0 ? 100 : percentage(completed, assigned),
        };
      })
      .filter((row) => row.assigned > 0)
      .sort((a, b) => a.compliance - b.compliance)
      .slice(0, 10);
  }, [documents, assignments, today]);

  const overdueAssignments = useMemo(
    () => assignments.filter((assignment) => isOverdueAssignment(assignment)),
    [assignments, today],
  );

  const monthlyTrend = useMemo(() => {
    const months = getLast6Months();
    const assignedCounts: Record<string, number> = {};
    const completedCounts: Record<string, number> = {};
    const overdueCounts: Record<string, number> = {};

    months.forEach((month) => {
      assignedCounts[month.key] = 0;
      completedCounts[month.key] = 0;
      overdueCounts[month.key] = 0;
    });

    assignments.forEach((assignment) => {
      const assignedKey = getMonthKey(assignment.created_at);
      const completedKey = getMonthKey(assignment.completed_at);
      const dueKey = getMonthKey(assignment.due_date);

      if (assignedKey && assignedCounts[assignedKey] !== undefined) assignedCounts[assignedKey] += 1;
      if (completedKey && completedCounts[completedKey] !== undefined) completedCounts[completedKey] += 1;
      if (dueKey && overdueCounts[dueKey] !== undefined && isOverdueAssignment(assignment)) overdueCounts[dueKey] += 1;
    });

    return months.map((month) => ({
      label: month.label,
      assigned: assignedCounts[month.key],
      completed: completedCounts[month.key],
      overdue: overdueCounts[month.key],
    }));
  }, [assignments, today]);

  if (loading) return <main style={pageStyle}>Loading Training Intelligence...</main>;

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>ENTERPRISE QUALITY COMMAND CENTER</div>
          <h1 style={{ margin: "6px 0" }}>Training Intelligence Dashboard</h1>
          <p style={subtleText}>
            Executive operational intelligence for training completion, overdue assignments,
            electronic signatures, effectiveness checks, supervisor verification, role compliance,
            and document-to-training traceability.
          </p>
        </div>

        <div style={buttonRowStyle}>
          <Link href="/training" style={darkButtonStyle}>Training Management</Link>
          <Link href="/documents/dashboard" style={secondaryButtonStyle}>Document Intelligence</Link>
          <Link href="/dashboard" style={secondaryButtonStyle}>Enterprise Dashboard</Link>
        </div>
      </header>

      <section style={kpiGridStyle}>
        {kpis.map((kpi) => (
          <KpiCard key={kpi.title} {...kpi} />
        ))}
      </section>

      <section style={escalationPanelStyle}>
        <div>
          <div style={eyebrowStyle}>EXECUTIVE ESCALATION ENGINE</div>
          <h2 style={{ margin: "6px 0" }}>Action Required</h2>
          <p style={subtleText}>
            Prioritized training signals requiring trainee follow-up, manager verification,
            effectiveness review, signature completion, or training administrator action.
          </p>
        </div>

        <div style={escalationGridStyle}>
          <AssignmentEscalationCard title="Overdue Training" count={overdueAssignments.length} severity={overdueAssignments.length > 0 ? "high" : "controlled"} items={overdueAssignments} documentMap={documentMap} description="Open training assignments past due date." />
          <AssignmentEscalationCard title="Awaiting Signature" count={metrics.awaitingSignature.length} severity={metrics.awaitingSignature.length > 0 ? "medium" : "controlled"} items={metrics.awaitingSignature} documentMap={documentMap} description="Assignments requiring electronic acknowledgement signature." />
          <AssignmentEscalationCard title="Effectiveness Pending" count={metrics.effectivenessPending.length} severity={metrics.effectivenessPending.length > 0 ? "medium" : "controlled"} items={metrics.effectivenessPending} documentMap={documentMap} description="Assignments requiring effectiveness completion." />
          <AssignmentEscalationCard title="Supervisor Verification Pending" count={metrics.supervisorVerificationPending.length} severity={metrics.supervisorVerificationPending.length > 0 ? "medium" : "controlled"} items={metrics.supervisorVerificationPending} documentMap={documentMap} description="Assignments requiring supervisor verification." />
        </div>
      </section>

      <section style={cardStyle}>
        <div>
          <div style={eyebrowStyle}>TRAINING SLA INTELLIGENCE</div>
          <h2 style={{ margin: "6px 0" }}>Completion, Signature, and Effectiveness Performance</h2>
          <p style={subtleText}>Measures training completion performance, overdue exposure, acknowledgement readiness, and effectiveness follow-up.</p>
        </div>

        <div style={kpiGridStyle}>
          <KpiCard title="Completed Training" value={metrics.completedTraining.length} color="#15803d" />
          <KpiCard title="In Progress" value={metrics.inProgressTraining.length} color="#2563eb" />
          <KpiCard title="Waived Training" value={metrics.waivedTraining.length} color="#6b7280" />
          <KpiCard title="Training Signatures" value={metrics.trainingSignatures.length} color="#7c3aed" />
          <KpiCard title="Document-Linked Training" value={metrics.documentLinkedAssignments.length} color="#2563eb" />
          <KpiCard title="Active Employees" value={employees.filter((employee) => employee.active !== false).length} color="#2563eb" />
        </div>
      </section>

      <section style={analyticsGridStyle}>
        <SummaryCard title="Training by Status" rows={statusCounts} />
        <SummaryCard title="Training by Department" rows={departmentCounts.length ? departmentCounts : [["No data", 0]]} />
        <SummaryCard title="Training by Role" rows={roleCounts.length ? roleCounts : [["No data", 0]]} />
        <SummaryCard title="Training by Source" rows={sourceCounts.length ? sourceCounts : [["No data", 0]]} />
        <SummaryCard title="Top Trainees by Assignment Volume" rows={employeeCounts.length ? employeeCounts : [["No data", 0]]} />
      </section>

      <section style={cardStyle}>
        <div>
          <div style={eyebrowStyle}>DOCUMENT-TO-TRAINING TRACEABILITY</div>
          <h2 style={{ margin: "6px 0" }}>Lowest Document Training Compliance</h2>
          <p style={subtleText}>Document-linked training completion for management review and audit readiness.</p>
        </div>

        {documentCompliance.length === 0 ? (
          <p style={subtleText}>No document-linked training assignments available yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Document</th>
                  <th style={thStyle}>Assigned</th>
                  <th style={thStyle}>Completed</th>
                  <th style={thStyle}>Open</th>
                  <th style={thStyle}>Overdue</th>
                  <th style={thStyle}>Awaiting Signature</th>
                  <th style={thStyle}>Compliance</th>
                </tr>
              </thead>
              <tbody>
                {documentCompliance.map((row) => (
                  <tr key={row.id}>
                    <td style={tdStyle}>
                      <Link href={`/documents/${row.id}`}><strong>{row.documentNumber} Rev {row.revision}</strong></Link>
                      <div style={smallTextStyle}>{row.title}</div>
                    </td>
                    <td style={tdStyle}>{row.assigned}</td>
                    <td style={tdStyle}>{row.completed}</td>
                    <td style={tdStyle}>{row.open}</td>
                    <td style={tdStyle}>{row.overdue}</td>
                    <td style={tdStyle}>{row.awaitingSignature}</td>
                    <td style={tdStyle}><ComplianceBadge value={row.compliance} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={cardStyle}>
        <div>
          <div style={eyebrowStyle}>MANAGEMENT REVIEW TREND INTELLIGENCE</div>
          <h2 style={{ margin: "6px 0" }}>Monthly Training Activity</h2>
          <p style={subtleText}>Six-month view of assigned, completed, and overdue training.</p>
        </div>

        <div style={trendGridStyle}>
          <TrendCard title="Assigned Training" data={monthlyTrend.map((item) => ({ label: item.label, value: item.assigned }))} />
          <TrendCard title="Completed Training" data={monthlyTrend.map((item) => ({ label: item.label, value: item.completed }))} />
          <TrendCard title="Overdue Training" data={monthlyTrend.map((item) => ({ label: item.label, value: item.overdue }))} />
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
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
}

function AssignmentEscalationCard({ title, count, severity, items, documentMap, description }: { title: string; count: number; severity: "controlled" | "medium" | "high"; items: TrainingAssignment[]; documentMap: Map<string, ControlledDocument>; description: string }) {
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
        {items.length === 0 ? (
          <div style={{ color: "#15803d", fontWeight: 700 }}>No escalation required.</div>
        ) : (
          items.slice(0, 5).map((assignment) => {
            const document = assignment.document_id ? documentMap.get(assignment.document_id) : null;
            return (
              <div key={assignment.id} style={escalationItemStyle}>
                <Link href={`/training/${assignment.id}`} style={{ fontWeight: 700 }}>{assignment.training_title || "Untitled Training"}</Link>
                <div style={smallTextStyle}>Trainee: {assignment.assigned_to_email} | Due: {assignment.due_date || "N/A"} | Status: {assignment.status || "assigned"}</div>
                {document ? <div style={smallTextStyle}>Document: {document.document_number} Rev {document.revision}</div> : null}
              </div>
            );
          })
        )}
        {items.length > 5 ? <div style={{ ...smallTextStyle, marginTop: "8px" }}>+ {items.length - 5} more</div> : null}
      </div>
    </div>
  );
}

function KpiCard({ title, value, color, suffix = "", target, statusLabel, statusIcon, statusColor }: KpiTile) {
  return (
    <div style={{ ...kpiCardStyle, borderLeft: `8px solid ${color}` }}>
      <div style={kpiTitleStyle}>{title}</div>
      <div style={{ fontSize: "30px", fontWeight: 800, color }}>{value}{suffix}</div>
      {target ? <div style={kpiTargetStyle}>{target}</div> : null}
      {statusLabel ? (
        <div style={{ ...kpiStatusStyle, color: statusColor || color, borderColor: statusColor || color, background: "#ffffff" }}>
          <span>{statusIcon}</span><span>{statusLabel}</span>
        </div>
      ) : null}
    </div>
  );
}

function SummaryCard({ title, rows }: { title: string; rows: [string, number][] }) {
  return (
    <div style={cardStyle}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      {rows.map(([label, count]) => <BarRow key={label} label={label} value={count} max={Math.max(...rows.map((row) => row[1]), 1)} />)}
    </div>
  );
}

function TrendCard({ title, data }: { title: string; data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map((item) => item.value), 1);
  return (
    <div style={cardStyle}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      {data.map((item) => <BarRow key={item.label} label={item.label} value={item.value} max={max} />)}
    </div>
  );
}

function BarRow({ label, value, max }: { label: string; value: number; max: number }) {
  const width = max === 0 ? 0 : (value / max) * 100;
  return (
    <div style={{ marginBottom: "14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}><span>{formatLabel(label)}</span><strong>{value}</strong></div>
      <div style={{ background: "#e5e7eb", height: "10px", borderRadius: "999px" }}><div style={{ width: `${width}%`, background: "#2563eb", height: "10px", borderRadius: "999px" }} /></div>
    </div>
  );
}

function ComplianceBadge({ value }: { value: number }) {
  const color = value >= 95 ? "#15803d" : value >= 80 ? "#d97706" : "#dc2626";
  return <span style={{ background: color, color: "white", borderRadius: "999px", padding: "3px 8px", fontSize: "12px", fontWeight: 700 }}>{value}%</span>;
}

const formatLabel = (value: string) => String(value || "Unspecified").replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());

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
    const label = date.toLocaleString("en-US", { month: "short", year: "2-digit" });
    months.push({ key, label });
  }
  return months;
}

const pageStyle: React.CSSProperties = { padding: "24px", background: "#f8fafc", minHeight: "100vh", fontFamily: "Arial, sans-serif" };
const headerStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-start", flexWrap: "wrap", marginBottom: "20px" };
const eyebrowStyle: React.CSSProperties = { fontSize: "12px", letterSpacing: "0.08em", color: "#6b7280", fontWeight: 800 };
const subtleText: React.CSSProperties = { color: "#6b7280" };
const cardStyle: React.CSSProperties = { background: "white", border: "1px solid #d1d5db", borderRadius: "16px", padding: "20px", marginBottom: "20px" };
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
const buttonRowStyle: React.CSSProperties = { display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center", marginTop: "12px" };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse" };
const thStyle: React.CSSProperties = { textAlign: "left", borderBottom: "1px solid #d1d5db", padding: "10px" };
const tdStyle: React.CSSProperties = { borderBottom: "1px solid #e5e7eb", padding: "10px", verticalAlign: "top" };
const smallTextStyle: React.CSSProperties = { fontSize: "12px", color: "#6b7280" };
