"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";

type ApprovalGate =
  | "initiation"
  | "investigation"
  | "action_plan"
  | "implementation"
  | "effectiveness_plan"
  | "closure";

const gateLabels: Record<ApprovalGate, string> = {
  initiation: "Initiation Approval",
  investigation: "Investigation Approval",
  action_plan: "Action Plan Approval",
  implementation: "Implementation Approval",
  effectiveness_plan: "Effectiveness Plan Approval",
  closure: "Closure Approval",
};

const gateTaskTypes: Record<ApprovalGate, string> = {
  initiation: "capa_initiation_approval",
  investigation: "capa_investigation_approval",
  action_plan: "capa_action_plan_approval",
  implementation: "capa_implementation_approval",
  effectiveness_plan: "capa_effectiveness_plan_approval",
  closure: "capa_closure_approval",
};

const gateStatusFields: Record<
  ApprovalGate,
  {
    status: string;
    submittedBy: string;
    submittedAt: string;
    approvedBy: string;
    approvedAt: string;
    approvalComments: string;
    rejectedBy: string;
    rejectedAt: string;
    rejectionComments: string;
    approvedRecordStatus: string;
    rejectedRecordStatus: string;
  }
> = {
  initiation: {
    status: "initiation_approval_status",
    submittedBy: "initiation_submitted_by",
    submittedAt: "initiation_submitted_at",
    approvedBy: "initiation_approved_by",
    approvedAt: "initiation_approved_at",
    approvalComments: "initiation_approval_comments",
    rejectedBy: "initiation_rejected_by",
    rejectedAt: "initiation_rejected_at",
    rejectionComments: "initiation_rejection_comments",
    approvedRecordStatus: "evaluation",
    rejectedRecordStatus: "initiation",
  },
  investigation: {
    status: "investigation_approval_status",
    submittedBy: "investigation_submitted_by",
    submittedAt: "investigation_submitted_at",
    approvedBy: "investigation_approved_by",
    approvedAt: "investigation_approved_at",
    approvalComments: "investigation_approval_comments",
    rejectedBy: "investigation_rejected_by",
    rejectedAt: "investigation_rejected_at",
    rejectionComments: "investigation_rejection_comments",
    approvedRecordStatus: "action_plan",
    rejectedRecordStatus: "investigation",
  },
  action_plan: {
    status: "action_plan_approval_status",
    submittedBy: "action_plan_submitted_by",
    submittedAt: "action_plan_submitted_at",
    approvedBy: "action_plan_approved_by",
    approvedAt: "action_plan_approved_at",
    approvalComments: "action_plan_approval_comments",
    rejectedBy: "action_plan_rejected_by",
    rejectedAt: "action_plan_rejected_at",
    rejectionComments: "action_plan_rejection_comments",
    approvedRecordStatus: "implementation",
    rejectedRecordStatus: "action_plan",
  },
  implementation: {
    status: "implementation_approval_status",
    submittedBy: "implementation_submitted_by",
    submittedAt: "implementation_submitted_at",
    approvedBy: "implementation_approved_by",
    approvedAt: "implementation_approved_at",
    approvalComments: "implementation_approval_comments",
    rejectedBy: "implementation_rejected_by",
    rejectedAt: "implementation_rejected_at",
    rejectionComments: "implementation_rejection_comments",
    approvedRecordStatus: "effectiveness_plan",
    rejectedRecordStatus: "implementation",
  },
  effectiveness_plan: {
    status: "effectiveness_plan_approval_status",
    submittedBy: "effectiveness_plan_submitted_by",
    submittedAt: "effectiveness_plan_submitted_at",
    approvedBy: "effectiveness_plan_approved_by",
    approvedAt: "effectiveness_plan_approved_at",
    approvalComments: "effectiveness_plan_approval_comments",
    rejectedBy: "effectiveness_plan_rejected_by",
    rejectedAt: "effectiveness_plan_rejected_at",
    rejectionComments: "effectiveness_plan_rejection_comments",
    approvedRecordStatus: "effectiveness_verification",
    rejectedRecordStatus: "effectiveness_plan",
  },
  closure: {
    status: "closure_approval_status",
    submittedBy: "closure_submitted_by",
    submittedAt: "closure_submitted_at",
    approvedBy: "closure_approved_by",
    approvedAt: "closure_approved_at",
    approvalComments: "closure_approval_comments",
    rejectedBy: "closure_rejected_by",
    rejectedAt: "closure_rejected_at",
    rejectionComments: "closure_rejection_comments",
    approvedRecordStatus: "closed",
    rejectedRecordStatus: "effectiveness_verification",
  },
};

export default function CapaApprovalReviewPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();

  const id = params.id;
  const gate = normalizeGate(searchParams.get("gate"));
  const taskId = searchParams.get("taskId") || "";

  const [record, setRecord] = useState<any>(null);
  const [task, setTask] = useState<any>(null);
  const [capaTasks, setCapaTasks] = useState<any[]>([]);
  const [userEmail, setUserEmail] = useState("");
  const [comments, setComments] = useState("");
  const [loading, setLoading] = useState(true);

  const visibleSections = useMemo(() => getVisibleSections(gate), [gate]);

  useEffect(() => {
    loadReviewPackage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, gate, taskId]);

  const loadReviewPackage = async () => {
    setLoading(true);

    const { data: authData } = await supabase.auth.getUser();
    const currentEmail = authData?.user?.email?.toLowerCase() || "";
    setUserEmail(currentEmail);

    const { data: capaData, error: capaError } = await supabase
      .from("capas")
      .select("*")
      .eq("id", id)
      .single();

    if (capaError) {
      alert(capaError.message);
      setLoading(false);
      return;
    }

    setRecord(capaData);

    let taskQuery = supabase
      .from("approval_tasks")
      .select("*")
      .eq("entity_type", "capa")
      .eq("entity_id", id)
      .eq("task_type", gateTaskTypes[gate]);

    if (taskId) {
      taskQuery = taskQuery.eq("id", taskId);
    } else if (currentEmail) {
      taskQuery = taskQuery.eq("assigned_to_email", currentEmail);
    }

    const { data: taskData, error: taskError } = await taskQuery
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (taskError) {
      alert(taskError.message);
      setLoading(false);
      return;
    }

    setTask(taskData);

    const { data: tasksData } = await supabase
      .from("capa_tasks")
      .select("*")
      .eq("capa_id", id)
      .order("sequence_order", { ascending: true });

    setCapaTasks(tasksData || []);
    setLoading(false);
  };

  const approveTask = async () => {
    if (!task?.id) {
      alert("No approval task found for this review package.");
      return;
    }

    if (!isAssignedApprover()) {
      alert("Only the assigned approver can approve this task.");
      return;
    }

    const confirmed = window.confirm(
      `Electronic Signature\n\nApprove ${gateLabels[gate]}?`
    );

    if (!confirmed) return;

    const now = new Date().toISOString();

    const { error } = await supabase
      .from("approval_tasks")
      .update({
        status: "approved",
        approver_comment: comments || null,
        signed_by: userEmail,
        signed_at: now,
      })
      .eq("id", task.id);

    if (error) {
      alert(error.message);
      return;
    }

    const fields = gateStatusFields[gate];
    const capaUpdate: Record<string, any> = {
      [fields.status]: "approved",
      [fields.approvedBy]: userEmail,
      [fields.approvedAt]: now,
      [fields.approvalComments]: comments || null,
      status: fields.approvedRecordStatus,
    };

    if (gate === "closure") {
      capaUpdate.closed_at = now;
      capaUpdate.signed_by = userEmail;
      capaUpdate.signed_at = now;
      capaUpdate.signature_meaning = "CAPA closure approved by electronic signature.";
    }

    const { error: capaUpdateError } = await supabase
      .from("capas")
      .update(capaUpdate)
      .eq("id", id);

    if (capaUpdateError) {
      alert(capaUpdateError.message);
      return;
    }

    await addAuditLog("approval_task_approved", `${gateLabels[gate]} approved.`);
    alert("Approval completed.");
    window.location.href = "/my-approval-tasks";
  };

  const rejectTask = async () => {
    if (!task?.id) {
      alert("No approval task found for this review package.");
      return;
    }

    if (!isAssignedApprover()) {
      alert("Only the assigned approver can reject this task.");
      return;
    }

    if (!comments.trim()) {
      alert("Rejection comments are required.");
      return;
    }

    const confirmed = window.confirm(
      `Reject ${gateLabels[gate]} and return it to the CAPA owner?`
    );

    if (!confirmed) return;

    const now = new Date().toISOString();

    const { error } = await supabase
      .from("approval_tasks")
      .update({
        status: "rejected",
        approver_comment: comments,
        signed_by: userEmail,
        signed_at: now,
      })
      .eq("id", task.id);

    if (error) {
      alert(error.message);
      return;
    }

    const fields = gateStatusFields[gate];
    const { error: capaUpdateError } = await supabase
      .from("capas")
      .update({
        [fields.status]: "rejected",
        [fields.rejectedBy]: userEmail,
        [fields.rejectedAt]: now,
        [fields.rejectionComments]: comments,
        status: fields.rejectedRecordStatus,
      })
      .eq("id", id);

    if (capaUpdateError) {
      alert(capaUpdateError.message);
      return;
    }

    await addAuditLog(
      "approval_task_rejected",
      `${gateLabels[gate]} rejected. Comments: ${comments}`
    );

    alert("Approval package rejected.");
    window.location.href = "/my-approval-tasks";
  };

  const addAuditLog = async (action: string, details: string) => {
    await supabase.from("audit_logs").insert({
      entity_type: "capa",
      entity_id: id,
      action,
      details,
      user_email: userEmail || "unknown",
    });
  };

  const isAssignedApprover = () => {
    if (!task) return false;
    return (
      String(task.assigned_to_email || "").toLowerCase() ===
      String(userEmail || "").toLowerCase()
    );
  };

  if (loading) {
    return <main style={pageStyle}>Loading CAPA approval review package...</main>;
  }

  if (!record) {
    return <main style={pageStyle}>CAPA record not found.</main>;
  }

  const taskStatus = task?.status || "not_found";
  const pending = taskStatus === "pending";

  return (
    <main style={pageStyle}>
      <section style={headerCardStyle}>
        <div style={eyebrowStyle}>READ ONLY REVIEW PACKAGE</div>
        <h1 style={{ margin: "6px 0" }}>
          {record.capa_number || "CAPA"} — {gateLabels[gate]}
        </h1>

        <div style={summaryGridStyle}>
          <Summary label="Submitted By" value={task?.assigned_by_email || "N/A"} />
          <Summary label="Submitted On" value={formatDate(task?.created_at)} />
          <Summary label="Assigned To" value={task?.assigned_to_email || "N/A"} />
          <Summary label="Function" value={task?.approver_function || "N/A"} />
          <Summary label="Job Title" value={task?.approver_job_title || task?.required_function || "N/A"} />
          <Summary label="Approval Due Date" value={task?.due_date || "N/A"} />
          <Summary label="Task Status" value={taskStatus} />
        </div>

        {!pending ? (
          <div style={noticeStyle}>
            This approval task is no longer pending. Current status: {taskStatus}.
          </div>
        ) : null}

        {!isAssignedApprover() && task ? (
          <div style={warningStyle}>
            You are viewing this package, but this task is assigned to {task.assigned_to_email}.
          </div>
        ) : null}
      </section>

      {visibleSections.includes("initiation") ? <InitiationSection record={record} /> : null}
      {visibleSections.includes("evaluation") ? <EvaluationSection record={record} /> : null}
      {visibleSections.includes("investigation") ? <InvestigationSection record={record} /> : null}
      {visibleSections.includes("root_cause") ? <RootCauseSection record={record} /> : null}
      {visibleSections.includes("action_plan") ? <ActionPlanSection record={record} /> : null}
      {visibleSections.includes("implementation") ? <ImplementationSection record={record} tasks={capaTasks} /> : null}
      {visibleSections.includes("effectiveness_plan") ? <EffectivenessPlanSection record={record} /> : null}
      {visibleSections.includes("effectiveness") ? <EffectivenessVerificationSection record={record} /> : null}
      {visibleSections.includes("closure") ? <ClosureSection record={record} /> : null}

      <section style={approvalCardStyle}>
        <h2 style={{ marginTop: 0 }}>Approval Decision</h2>

        <label style={labelStyle}>Approval / Rejection Comments</label>
        <textarea
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          rows={5}
          disabled={!pending || !isAssignedApprover()}
          style={textareaStyle}
        />

        <div style={buttonRowStyle}>
          <button
            onClick={approveTask}
            disabled={!pending || !isAssignedApprover()}
            style={primaryButtonStyle(!pending || !isAssignedApprover())}
          >
            Approve
          </button>

          <button
            onClick={rejectTask}
            disabled={!pending || !isAssignedApprover()}
            style={dangerButtonStyle(!pending || !isAssignedApprover())}
          >
            Reject
          </button>

          <button
            onClick={() => (window.location.href = "/my-approval-tasks")}
            style={secondaryButtonStyle}
          >
            Back to My Approval Tasks
          </button>
        </div>
      </section>
    </main>
  );
}

function normalizeGate(value: string | null): ApprovalGate {
  const normalized = String(value || "").toLowerCase();

  if (
    normalized === "investigation" ||
    normalized === "action_plan" ||
    normalized === "implementation" ||
    normalized === "effectiveness_plan" ||
    normalized === "closure"
  ) {
    return normalized as ApprovalGate;
  }

  return "initiation";
}

function getVisibleSections(gate: ApprovalGate) {
  const map: Record<ApprovalGate, string[]> = {
    initiation: ["initiation"],
    investigation: ["initiation", "evaluation", "investigation", "root_cause"],
    action_plan: [
      "initiation",
      "evaluation",
      "investigation",
      "root_cause",
      "action_plan",
    ],
    implementation: [
      "initiation",
      "evaluation",
      "investigation",
      "root_cause",
      "action_plan",
      "implementation",
    ],
    effectiveness_plan: [
      "initiation",
      "evaluation",
      "investigation",
      "root_cause",
      "action_plan",
      "implementation",
      "effectiveness_plan",
    ],
    closure: [
      "initiation",
      "evaluation",
      "investigation",
      "root_cause",
      "action_plan",
      "implementation",
      "effectiveness_plan",
      "effectiveness",
      "closure",
    ],
  };

  return map[gate];
}

function InitiationSection({ record }: { record: any }) {
  return (
    <ReviewSection title="1. Initiation">
      <ReadOnlyGrid
        rows={[
          ["CAPA Type", record.capa_type],
          ["CAPA Source", record.capa_source],
          ["Problem Statement", record.problem_statement || record.issue_summary],
          ["Justification for CAPA", record.capa_justification],
          ["Product Impact", record.product_impact],
          ["Process Impact", record.process_impact],
          ["Patient Safety Impact", record.patient_impact],
          ["Owner", record.owner],
          ["Due Date", record.due_date],
        ]}
      />
    </ReviewSection>
  );
}

function EvaluationSection({ record }: { record: any }) {
  return (
    <ReviewSection title="2. Evaluation">
      <ReadOnlyGrid
        rows={[
          ["Scope", record.scope],
          ["Interim Controls Required?", record.interim_controls_required],
          ["Interim Controls", record.containment_plan || record.interim_controls],
          ["Rationale if No Interim Control", record.no_interim_control_rationale],
          ["Severity", record.severity],
          ["Occurrence", record.occurrence],
          ["Detection", record.detection],
          ["Risk Level", record.risk_level],
          ["Risk Rationale", record.risk_rationale],
        ]}
      />
    </ReviewSection>
  );
}

function InvestigationSection({ record }: { record: any }) {
  return (
    <ReviewSection title="3. Investigation">
      <ReadOnlyGrid
        rows={[
          ["Investigation Objective", record.investigation_objective],
          ["Investigation", record.investigation || record.investigation_summary],
          ["Evidence Reviewed", record.evidence_reviewed],
          ["Investigation Findings", record.investigation_findings],
          ["Investigation Conclusion", record.investigation_conclusion],
        ]}
      />
    </ReviewSection>
  );
}

function RootCauseSection({ record }: { record: any }) {
  return (
    <ReviewSection title="4. Root Cause Determination">
      <ReadOnlyGrid
        rows={[
          ["Root Cause Method", record.root_cause_method],
          ["Root Cause", record.root_cause],
          ["Contributing Factors", record.contributing_factors],
          ["Root Cause Verification", record.root_cause_verification],
          ["Systemic Impact", record.systemic_impact],
        ]}
      />
    </ReviewSection>
  );
}

function ActionPlanSection({ record }: { record: any }) {
  const actionPlanLabel =
    String(record?.capa_type || "").toLowerCase() === "preventive"
      ? "Preventive Action Plan"
      : "Corrective Action Plan";

  return (
    <ReviewSection title="5. Action Plan Proposal">
      <ReadOnlyGrid
        rows={[
          [actionPlanLabel, record.corrective_action_plan],
          ["Action Owner", record.action_owner],
          ["Action Due Date", record.action_due_date],
          ["Verification Method", record.verification_method],
          ["Required Resources", record.required_resources],
          ["Required Evidence", record.required_evidence],
        ]}
      />
    </ReviewSection>
  );
}

function ImplementationSection({ record, tasks }: { record: any; tasks: any[] }) {
  return (
    <ReviewSection title="6. Implementation">
      <ReadOnlyGrid
        rows={[
          ["Implementation Notes", record.implementation || record.implementation_details],
          ["Implemented By", record.implemented_by],
          ["Implemented At", record.implemented_at],
          ["Implementation Evidence", record.implementation_evidence],
        ]}
      />

      <TaskTable tasks={tasks} title="Task Completion Evidence" />
    </ReviewSection>
  );
}

function EffectivenessPlanSection({ record }: { record: any }) {
  return (
    <ReviewSection title="7. Effectiveness Plan">
      <ReadOnlyGrid
        rows={[
          ["Verification Method", record.verification_method],
          ["Success Criteria", record.effectiveness_success_criteria],
          ["Data to Collect", record.effectiveness_data_to_collect],
          ["Sample Size", record.effectiveness_sample_size],
          ["Verification Owner", record.effectiveness_owner],
          ["Verification Due Date", record.effectiveness_due_date],
          ["Required Objective Evidence", record.required_objective_evidence],
        ]}
      />
    </ReviewSection>
  );
}

function EffectivenessVerificationSection({ record }: { record: any }) {
  return (
    <ReviewSection title="8. Effectiveness Verification">
      <ReadOnlyGrid
        rows={[
          ["Effectiveness Results", record.effectiveness_results],
          ["Objective Evidence", record.effectiveness_objective_evidence],
          ["Recurrence Observed?", record.recurrence_observed],
          ["Final Rating", record.effectiveness_rating],
          ["Conclusion", record.effectiveness_conclusion],
        ]}
      />
    </ReviewSection>
  );
}

function ClosureSection({ record }: { record: any }) {
  return (
    <ReviewSection title="9. Closure">
      <ReadOnlyGrid
        rows={[
          ["Closure Summary", record.closure_summary],
          ["Closed By", record.capa_closed_by],
          ["Closed At", record.closed_at],
          ["Signature Meaning", record.signature_meaning || record.capa_signature_meaning],
          ["Locked By", record.locked_by],
          ["Locked At", record.locked_at],
        ]}
      />
    </ReviewSection>
  );
}

function ReviewSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={sectionCardStyle}>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      {children}
    </section>
  );
}

function ReadOnlyGrid({ rows }: { rows: Array<[string, any]> }) {
  return (
    <div style={gridStyle}>
      {rows.map(([label, value]) => (
        <div key={label} style={readOnlyFieldStyle}>
          <div style={fieldLabelStyle}>{label}</div>
          <div style={fieldValueStyle}>{formatValue(value)}</div>
        </div>
      ))}
    </div>
  );
}

function TaskTable({ tasks, title }: { tasks: any[]; title: string }) {
  return (
    <div style={{ marginTop: "18px" }}>
      <h3>{title}</h3>

      {tasks.length === 0 ? (
        <p style={{ color: "#6b7280" }}>No tasks recorded.</p>
      ) : (
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Task</th>
              <th style={thStyle}>Owner</th>
              <th style={thStyle}>Due Date</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Evidence</th>
              <th style={thStyle}>Completed By</th>
              <th style={thStyle}>Completed At</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id}>
                <td style={tdStyle}>{task.task_title || "Task"}</td>
                <td style={tdStyle}>{task.owner_email || task.owner || "N/A"}</td>
                <td style={tdStyle}>{task.due_date || "N/A"}</td>
                <td style={tdStyle}>{task.status || "N/A"}</td>
                <td style={tdStyle}>{task.completion_evidence || "N/A"}</td>
                <td style={tdStyle}>{task.completed_by || "N/A"}</td>
                <td style={tdStyle}>{formatDate(task.completed_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: any }) {
  return (
    <div style={summaryBoxStyle}>
      <div style={fieldLabelStyle}>{label}</div>
      <div style={fieldValueStyle}>{formatValue(value)}</div>
    </div>
  );
}

function formatValue(value: any) {
  if (value === null || value === undefined || value === "") return "N/A";
  return String(value);
}

function formatDate(value: any) {
  if (!value) return "N/A";
  return String(value);
}

const pageStyle: React.CSSProperties = {
  padding: "24px",
  fontFamily: "Arial, sans-serif",
  background: "#f8fafc",
  color: "#111827",
  minHeight: "100vh",
};

const headerCardStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid #d1d5db",
  borderRadius: "14px",
  padding: "20px",
  marginBottom: "18px",
};

const eyebrowStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 900,
  letterSpacing: "0.14em",
  color: "#2563eb",
};

const summaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: "12px",
  marginTop: "16px",
};

const summaryBoxStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: "10px",
  padding: "12px",
  background: "#f9fafb",
};

const noticeStyle: React.CSSProperties = {
  marginTop: "14px",
  padding: "12px",
  borderRadius: "10px",
  background: "#ecfdf5",
  border: "1px solid #bbf7d0",
  color: "#166534",
  fontWeight: 700,
};

const warningStyle: React.CSSProperties = {
  marginTop: "14px",
  padding: "12px",
  borderRadius: "10px",
  background: "#fffbeb",
  border: "1px solid #fde68a",
  color: "#92400e",
  fontWeight: 700,
};

const sectionCardStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid #d1d5db",
  borderRadius: "14px",
  padding: "20px",
  marginBottom: "18px",
};

const approvalCardStyle: React.CSSProperties = {
  background: "white",
  border: "2px solid #2563eb",
  borderRadius: "14px",
  padding: "20px",
  marginBottom: "18px",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "12px",
};

const readOnlyFieldStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: "10px",
  padding: "12px",
  background: "#f9fafb",
};

const fieldLabelStyle: React.CSSProperties = {
  color: "#6b7280",
  fontSize: "12px",
  fontWeight: 800,
  marginBottom: "6px",
};

const fieldValueStyle: React.CSSProperties = {
  whiteSpace: "pre-wrap",
  fontWeight: 700,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontWeight: 800,
  marginBottom: "8px",
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #cbd5e1",
  borderRadius: "10px",
  padding: "10px",
  boxSizing: "border-box",
  marginBottom: "14px",
};

const buttonRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
};

const primaryButtonStyle = (disabled: boolean): React.CSSProperties => ({
  background: disabled ? "#9ca3af" : "#2563eb",
  color: "white",
  border: "none",
  borderRadius: "10px",
  padding: "10px 16px",
  fontWeight: 800,
  cursor: disabled ? "not-allowed" : "pointer",
});

const dangerButtonStyle = (disabled: boolean): React.CSSProperties => ({
  background: disabled ? "#9ca3af" : "#dc2626",
  color: "white",
  border: "none",
  borderRadius: "10px",
  padding: "10px 16px",
  fontWeight: 800,
  cursor: disabled ? "not-allowed" : "pointer",
});

const secondaryButtonStyle: React.CSSProperties = {
  background: "#f3f4f6",
  color: "#111827",
  border: "1px solid #d1d5db",
  borderRadius: "10px",
  padding: "10px 16px",
  fontWeight: 800,
  cursor: "pointer",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "13px",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "8px",
  borderBottom: "1px solid #d1d5db",
  background: "#f3f4f6",
};

const tdStyle: React.CSSProperties = {
  padding: "8px",
  borderBottom: "1px solid #e5e7eb",
  verticalAlign: "top",
};
