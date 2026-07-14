"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function MyApprovalTasksPage() {
  const [userEmail, setUserEmail] = useState("");
  const [tasks, setTasks] = useState<any[]>([]);
  const [signatureEmail, setSignatureEmail] = useState("");
  const [approverCommentByTask, setApproverCommentByTask] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [availableUsers, setAvailableUsers] = useState<string[]>([]);
  const [reassignTask, setReassignTask] = useState<any>(null);
  const [reassignEmail, setReassignEmail] = useState("");
  const [reassigning, setReassigning] = useState(false);

  const fetchTasks = async () => {
    setLoading(true);

    const { data: userData } = await supabase.auth.getUser();
    const email = userData?.user?.email || "";

    setUserEmail(email);
    setSignatureEmail(email);

    if (!email) {
      setTasks([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("approval_tasks")
      .select("*")
      .eq("assigned_to_email", email.toLowerCase())
      .order("created_at", { ascending: true });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    const normalizedEmail = email.toLowerCase();

    const { data: ownedCapaData, error: ownedCapaError } = await supabase
      .from("capas")
      .select("*")
      .or(
        `owner_email.eq.${normalizedEmail},owner.eq.${normalizedEmail}`
      )
      .not("status", "in", '("closed","cancelled")')
      .order("created_at", { ascending: true });

    if (ownedCapaError) {
      alert(ownedCapaError.message);
      setLoading(false);
      return;
    }

    const assignedTaskItems = (data || []).map((task: any) => ({
      ...task,
      workspace_item_type: "assigned_task",
    }));

    const ownedCapaItems = (ownedCapaData || [])
      .filter((capa: any) => shouldShowOwnedCapaWork(capa))
      .map((capa: any) => ({
        ...capa,
        workspace_item_type: "owned_capa",
      }));

    setTasks(
      [...assignedTaskItems, ...ownedCapaItems].sort((a: any, b: any) =>
        String(a.created_at || "").localeCompare(String(b.created_at || ""))
      )
    );

    const { data: usersData } = await supabase
      .from("user_roles")
      .select("user_email")
      .order("user_email", { ascending: true });

    setAvailableUsers(
      (usersData || [])
        .map((user: any) => String(user.user_email || "").toLowerCase())
        .filter(Boolean)
    );

    setLoading(false);
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const updateApproverComment = (taskId: string, value: string) => {
    setApproverCommentByTask((current) => ({ ...current, [taskId]: value }));
  };

  const isCapaApprovalTask = (task: any) => {
    return (
      task.entity_type === "capa" &&
      [
        "capa_initiation_approval",
        "capa_investigation_approval",
        "capa_action_plan_approval",
        "capa_implementation_approval",
        "capa_effectiveness_plan_approval",
        "capa_closure_approval",
      ].includes(task.task_type)
    );
  };

  const getCapaGateFromTask = (task: any) => {
    const taskType = String(task.task_type || "");

    if (taskType === "capa_initiation_approval") return "initiation";
    if (taskType === "capa_investigation_approval") return "investigation";
    if (taskType === "capa_action_plan_approval") return "action_plan";
    if (taskType === "capa_implementation_approval") return "implementation";
    if (taskType === "capa_effectiveness_plan_approval") return "effectiveness_plan";
    if (taskType === "capa_closure_approval") return "closure";

    return "initiation";
  };

  const getApprovalGateLabel = (task: any) => {
    const gate = getCapaGateFromTask(task);

    if (gate === "initiation") return "Initiation Approval";
    if (gate === "investigation") return "Investigation Approval";
    if (gate === "action_plan") return "Action Plan Approval";
    if (gate === "implementation") return "Implementation Approval";
    if (gate === "effectiveness_plan") return "Effectiveness Plan Approval";
    if (gate === "closure") return "Closure Approval";

    return "Approval";
  };

  const getCapaReviewUrl = (task: any) => {
    const gate = getCapaGateFromTask(task);
    return `/capa/${task.entity_id}/approval-review?gate=${gate}&taskId=${task.id}`;
  };

  const getRecordDisplay = (task: any) => {
    if (task.workspace_item_type === "owned_capa") {
      return task.capa_number || task.id || "CAPA";
    }

    return task.record_number || task.capa_number || task.entity_number || task.entity_id || "Record";
  };

  const getTaskTitle = (task: any) => {
    if (task.workspace_item_type === "owned_capa") {
      return `${getRecordDisplay(task)} — ${getOwnedCapaWorkLabel(task)}`;
    }

    if (isCapaApprovalTask(task)) {
      const jobTitle = task.approver_job_title || task.required_function || "Approver";
      return `${jobTitle} — ${getRecordDisplay(task)} ${getApprovalGateLabel(task)}`;
    }

    return task.task_title || `${task.required_function || "Task"} — ${formatTaskType(task.task_type)}`;
  };

  const getDueStatus = (task: any) => {
    const dueDateValue =
      task.workspace_item_type === "owned_capa"
        ? task.due_date || task.action_due_date || task.effectiveness_due_date
        : task.due_date || task.approver_due_date;

    if (!dueDateValue) {
      return {
        label: "No due date",
        icon: "⚪",
        background: "#f9fafb",
        border: "#d1d5db",
        text: "#374151",
      };
    }

    const today = new Date();
    const dueDate = new Date(`${dueDateValue}T23:59:59`);

    today.setHours(0, 0, 0, 0);

    const millisecondsPerDay = 1000 * 60 * 60 * 24;
    const daysRemaining = Math.ceil(
      (dueDate.getTime() - today.getTime()) / millisecondsPerDay
    );

    if (daysRemaining < 0) {
      return {
        label: "Overdue",
        icon: "🔴",
        background: "#fef2f2",
        border: "#fecaca",
        text: "#991b1b",
      };
    }

    if (daysRemaining <= 3) {
      return {
        label: daysRemaining === 0 ? "Due today" : `Due in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`,
        icon: "🟡",
        background: "#fffbeb",
        border: "#fde68a",
        text: "#92400e",
      };
    }

    return {
      label: `Due in ${daysRemaining} days`,
      icon: "🟢",
      background: "#f0fdf4",
      border: "#bbf7d0",
      text: "#166534",
    };
  };

  const openReassignDialog = (task: any) => {
    setReassignTask(task);
    setReassignEmail("");
  };

  const closeReassignDialog = () => {
    if (reassigning) return;
    setReassignTask(null);
    setReassignEmail("");
  };

  const completeReassignment = async () => {
    if (!reassignTask?.id) return;

    const newOwner = String(reassignEmail || "").trim().toLowerCase();

    if (!newOwner) {
      alert("New owner email is required.");
      return;
    }

    const currentOwner = String(reassignTask.owner_email || reassignTask.owner || userEmail)
      .trim()
      .toLowerCase();

    if (newOwner === currentOwner) {
      alert("The new owner must be different from the current owner.");
      return;
    }

    setReassigning(true);

    const { error } = await supabase
      .from("capas")
      .update({
        owner_email: newOwner,
        owner: newOwner,
      })
      .eq("id", reassignTask.id);

    setReassigning(false);

    if (error) {
      alert(error.message);
      return;
    }

    await supabase.from("audit_logs").insert({
      entity_type: "capa",
      entity_id: reassignTask.id,
      action: "workflow_owner_reassigned",
      details: `CAPA ownership reassigned from ${currentOwner} to ${newOwner}.`,
      user_email: userEmail,
    });

    alert("CAPA ownership reassigned.");
    closeReassignDialog();
    fetchTasks();
  };

  const signTask = async (task: any, status: "approved" | "rejected") => {
    if (isCapaApprovalTask(task)) {
      window.location.href = getCapaReviewUrl(task);
      return;
    }

    if (!signatureEmail) {
      alert("Please enter your email for electronic signature.");
      return;
    }

    if (signatureEmail.trim().toLowerCase() !== userEmail.trim().toLowerCase()) {
      alert("Electronic signature email does not match the logged-in user.");
      return;
    }

    const approverComment = approverCommentByTask[task.id] || "";

    if (status === "rejected" && !approverComment.trim()) {
      alert("Rejection comment is required when rejecting an approval task.");
      return;
    }

    const actionLabel = status === "approved" ? "approve" : "reject";
    const confirmed = window.confirm(
      `Electronic Signature:\n\nI ${actionLabel} this ${task.required_function} ${task.task_type} task.`
    );

    if (!confirmed) return;

    const now = new Date().toISOString();
    const signatureMeaning = `I ${actionLabel} this ${task.required_function} ${task.task_type} task.`;

    const { error } = await supabase
      .from("approval_tasks")
      .update({
        status,
        approver_comment: approverComment,
        signature_meaning: signatureMeaning,
        signed_by: userEmail,
        signed_at: now,
      })
      .eq("id", task.id);

    if (error) {
      alert(error.message);
      return;
    }

    await supabase.from("audit_logs").insert({
      entity_type: task.entity_type,
      entity_id: task.entity_id,
      action: `approval_task_${status}`,
      details: `${task.required_function} approval task ${status} by ${userEmail}. Approver comment: ${approverComment || "N/A"}`,
      user_email: userEmail,
    });

    alert(`Task ${status}.`);
    fetchTasks();
  };

  const completeExecutionTask = async (task: any) => {
    if (!signatureEmail) {
      alert("Please enter your email for electronic signature.");
      return;
    }

    if (signatureEmail.trim().toLowerCase() !== userEmail.trim().toLowerCase()) {
      alert("Electronic signature email does not match the logged-in user.");
      return;
    }

    const completionComment = approverCommentByTask[task.id] || "";

    if (!completionComment.trim()) {
      alert("Completion comment is required.");
      return;
    }

    const confirmed = window.confirm(
      `Electronic Signature:\n\nI confirm this ${task.task_type} has been completed.`
    );

    if (!confirmed) return;

    const now = new Date().toISOString();
    const signatureMeaning = `I confirm this ${task.task_type} has been completed.`;

    const { error } = await supabase
      .from("approval_tasks")
      .update({
        status: "completed",
        completion_comment: completionComment,
        approver_comment: completionComment,
        signature_meaning: signatureMeaning,
        completed_by: userEmail,
        completed_at: now,
        signed_by: userEmail,
        signed_at: now,
      })
      .eq("id", task.id);

    if (error) {
      alert(error.message);
      return;
    }

    await supabase.from("audit_logs").insert({
      entity_type: task.entity_type,
      entity_id: task.entity_id,
      action: `${task.task_type}_completed`,
      details: `${task.task_type} completed by ${userEmail}. Completion comment: ${completionComment}`,
      user_email: userEmail,
    });

    alert("Task completed.");
    fetchTasks();
  };

  if (loading) {
    return <main style={pageStyle}>Loading tasks...</main>;
  }

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>QUALISPHERE WORK QUEUE</div>
          <h1 style={{ margin: "4px 0" }}>My Tasks</h1>
          <p style={{ margin: 0, color: "#4b5563" }}>
            Logged in as <strong>{userEmail || "none"}</strong>
          </p>
        </div>
      </header>

      <div style={signatureBoxStyle}>
        <label style={labelStyle}>Re-enter Your Email for E-Signature</label>
        <input
          value={signatureEmail}
          onChange={(e) => setSignatureEmail(e.target.value)}
          style={inputStyle}
        />
      </div>

      {tasks.length === 0 ? (
        <section style={emptyStateStyle}>No tasks assigned to you.</section>
      ) : (
        <div style={{ display: "grid", gap: "12px" }}>
          {tasks.map((task) => {
            const capaApproval = isCapaApprovalTask(task);
            const ownedCapaWork = task.workspace_item_type === "owned_capa";
            const dueStatus = getDueStatus(task);
            const pending = task.status === "pending";

            return (
              <section
                key={task.id}
                style={{
                  ...taskCardStyle,
                  borderLeft: `8px solid ${pending ? dueStatus.border : "#d1d5db"}`,
                  background:
                    task.status === "approved" || task.status === "completed"
                      ? "#f0fdf4"
                      : task.status === "rejected"
                      ? "#fef2f2"
                      : "#ffffff",
                }}
              >
                <div style={taskHeaderStyle}>
                  <div>
                    <h2 style={{ margin: "0 0 8px 0", fontSize: "22px" }}>
                      {getTaskTitle(task)}
                    </h2>

                    <div style={taskMetaRowStyle}>
                      <span style={statusPillStyle(task.status)}>
                        {formatTaskStatus(task.status)}
                      </span>

                      <span
                        style={{
                          ...duePillStyle,
                          background: dueStatus.background,
                          borderColor: dueStatus.border,
                          color: dueStatus.text,
                        }}
                      >
                        {dueStatus.icon} Due: {task.due_date || task.approver_due_date || "N/A"}
                        {pending ? ` (${dueStatus.label})` : ""}
                      </span>
                    </div>
                  </div>

                  {ownedCapaWork ? (
                    <div style={buttonRowStyle}>
                      <a href={`/capa/${task.id}`} style={primaryLinkStyle}>
                        Open CAPA
                      </a>
                      <button
                        type="button"
                        onClick={() => openReassignDialog(task)}
                        style={secondaryActionButtonStyle}
                      >
                        Reassign
                      </button>
                    </div>
                  ) : capaApproval ? (
                    <a href={getCapaReviewUrl(task)} style={primaryLinkStyle}>
                      Open CAPA Review Package
                    </a>
                  ) : null}
                </div>

                {!capaApproval && !ownedCapaWork ? (
                  <>
                    <div style={{ marginTop: "14px", marginBottom: "12px" }}>
                      <label style={labelStyle}>Review Instructions</label>
                      <textarea
                        value={task.task_instructions || task.comments || "No instructions provided."}
                        readOnly
                        rows={6}
                        style={readOnlyTextareaStyle}
                      />
                    </div>

                    <div style={{ marginTop: "10px", marginBottom: "12px" }}>
                      <label style={labelStyle}>
                        {task.task_type === "correction_task" ||
                        task.task_type === "rework_task" ||
                        task.task_type === "investigation_collaboration"
                          ? "Completion Comment"
                          : "Approver Comment"}
                      </label>
                      <textarea
                        value={approverCommentByTask[task.id] ?? task.approver_comment ?? ""}
                        onChange={(e) => updateApproverComment(task.id, e.target.value)}
                        disabled={task.status !== "pending"}
                        placeholder="Add approval comment or rejection rationale. Required if rejecting."
                        rows={4}
                        style={textareaStyle}
                      />
                    </div>

                    {task.status === "pending" ? (
                      task.task_type === "correction_task" ||
                      task.task_type === "rework_task" ||
                      task.task_type === "investigation_collaboration" ? (
                        <div style={buttonRowStyle}>
                          <button onClick={() => completeExecutionTask(task)}>
                            Complete Task
                          </button>
                        </div>
                      ) : (
                        <div style={buttonRowStyle}>
                          <button onClick={() => signTask(task, "approved")}>
                            Approve
                          </button>
                          <button onClick={() => signTask(task, "rejected")}>
                            Reject
                          </button>
                        </div>
                      )
                    ) : (
                      <CompletedTaskDetails task={task} />
                    )}
                  </>
                ) : !ownedCapaWork && task.status !== "pending" ? (
                  <CompletedTaskDetails task={task} />
                ) : null}
              </section>
            );
          })}
        </div>
      )}

      {reassignTask ? (
        <div style={modalOverlayStyle}>
          <section style={modalCardStyle}>
            <h2 style={{ marginTop: 0 }}>Reassign {getRecordDisplay(reassignTask)}</h2>

            <div style={modalFieldStyle}>
              <label style={modalLabelStyle}>Current Owner</label>
              <div style={readOnlyValueStyle}>
                {reassignTask.owner_email || reassignTask.owner || "N/A"}
              </div>
            </div>

            <div style={modalFieldStyle}>
              <label style={modalLabelStyle}>New Owner</label>
              <select
                value={reassignEmail}
                onChange={(event) => setReassignEmail(event.target.value)}
                style={modalInputStyle}
              >
                <option value="">Select user</option>
                {availableUsers
                  .filter(
                    (user) =>
                      user !==
                      String(reassignTask.owner_email || reassignTask.owner || "").toLowerCase()
                  )
                  .map((user) => (
                    <option key={user} value={user}>
                      {user}
                    </option>
                  ))}
              </select>
            </div>

            <div style={modalActionsStyle}>
              <button
                type="button"
                onClick={closeReassignDialog}
                disabled={reassigning}
                style={modalSecondaryButtonStyle}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={completeReassignment}
                disabled={reassigning}
                style={modalPrimaryButtonStyle}
              >
                {reassigning ? "Reassigning..." : "Reassign"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function shouldShowOwnedCapaWork(capa: any) {
  const status = String(capa.status || "").toLowerCase();

  if (status === "closed" || status === "cancelled") return false;

  const approvalPending =
    status.includes("pending") &&
    status.includes("approval");

  const pendingGateApproved =
    (status.includes("initiation") && capa.initiation_approval_status === "approved") ||
    (status.includes("investigation") && capa.investigation_approval_status === "approved") ||
    (status.includes("action_plan") && capa.action_plan_approval_status === "approved") ||
    (status.includes("effectiveness_plan") && capa.effectiveness_plan_approval_status === "approved") ||
    (status.includes("closure") && capa.closure_approval_status === "approved");

  if (approvalPending && !pendingGateApproved) return false;

  return true;
}

function getOwnedCapaWorkLabel(capa: any) {
  if (!capa.initiation_approval_status || capa.initiation_approval_status === "not_submitted") {
    return "Complete Initiation";
  }

  if (capa.initiation_approval_status === "rejected") return "Revise Initiation";

  if (capa.initiation_approval_status === "approved" && !capa.investigation_approval_status) {
    return "Complete Evaluation / Investigation";
  }

  if (capa.investigation_approval_status === "rejected") return "Revise Investigation";

  if (capa.investigation_approval_status === "approved" && !capa.action_plan_approval_status) {
    return "Complete Action Plan Proposal";
  }

  if (capa.action_plan_approval_status === "rejected") return "Revise Action Plan";

  if (capa.action_plan_approval_status === "approved" && !capa.implemented_by) {
    return "Complete Implementation";
  }

  if (capa.implemented_by && capa.effectiveness_plan_approval_status !== "approved") {
    return "Complete / Submit Effectiveness Plan";
  }

  if (
    capa.implemented_by &&
    capa.effectiveness_plan_approval_status === "approved" &&
    !capa.effectiveness_verified_by &&
    !capa.effectiveness_rating
  ) {
    return "Complete Effectiveness Verification";
  }

  if (capa.effectiveness_rating && !capa.closure_approval_status) return "Submit Closure";
  if (capa.closure_approval_status === "rejected") return "Revise Closure";

  return "Continue CAPA";
}

function CompletedTaskDetails({ task }: { task: any }) {
  return (
    <div style={{ marginTop: "12px", color: "#374151" }}>
      <strong>Signed By:</strong> {task.signed_by || task.completed_by || "N/A"}<br />
      <strong>Signed At:</strong> {task.signed_at || task.completed_at || "N/A"}<br />
      <strong>Signature Meaning:</strong> {task.signature_meaning || "N/A"}<br />
      <strong>Comment:</strong> {task.approver_comment || task.completion_comment || "N/A"}
    </div>
  );
}

function formatTaskType(value: any) {
  return String(value || "task")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatTaskStatus(value: any) {
  return String(value || "pending")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

const pageStyle: React.CSSProperties = {
  padding: "24px",
  fontFamily: "Arial, sans-serif",
  background: "#f8fafc",
  color: "#111827",
  minHeight: "100vh",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "16px",
  alignItems: "flex-start",
  marginBottom: "18px",
};

const eyebrowStyle: React.CSSProperties = {
  color: "#2563eb",
  fontSize: "12px",
  fontWeight: 900,
  letterSpacing: "0.14em",
};

const signatureBoxStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid #d1d5db",
  borderRadius: "12px",
  padding: "14px",
  marginBottom: "16px",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontWeight: 800,
  marginBottom: "6px",
};

const inputStyle: React.CSSProperties = {
  padding: "8px",
  width: "100%",
  maxWidth: "500px",
  border: "1px solid #cbd5e1",
  borderRadius: "8px",
};

const emptyStateStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid #d1d5db",
  borderRadius: "12px",
  padding: "18px",
};

const taskCardStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: "12px",
  padding: "16px",
  boxShadow: "0 8px 20px rgba(15,23,42,0.06)",
};

const taskHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "14px",
  flexWrap: "wrap",
};

const taskMetaRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
  alignItems: "center",
};

const statusPillStyle = (status: string): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  border: "1px solid #d1d5db",
  borderRadius: "999px",
  padding: "6px 10px",
  background:
    status === "approved" || status === "completed"
      ? "#dcfce7"
      : status === "rejected"
      ? "#fee2e2"
      : "#eff6ff",
  color:
    status === "approved" || status === "completed"
      ? "#166534"
      : status === "rejected"
      ? "#991b1b"
      : "#1d4ed8",
  fontWeight: 800,
});

const duePillStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  border: "1px solid",
  borderRadius: "999px",
  padding: "6px 10px",
  fontWeight: 800,
};

const primaryLinkStyle: React.CSSProperties = {
  display: "inline-block",
  background: "#2563eb",
  color: "white",
  padding: "10px 14px",
  borderRadius: "10px",
  textDecoration: "none",
  fontWeight: 800,
};

const readOnlyTextareaStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "800px",
  background: "#f3f4f6",
  border: "1px solid #d1d5db",
  borderRadius: "8px",
  padding: "8px",
  display: "block",
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "800px",
  border: "1px solid #cbd5e1",
  borderRadius: "8px",
  padding: "8px",
  display: "block",
};

const buttonRowStyle: React.CSSProperties = {
  marginTop: "10px",
  display: "flex",
  gap: "8px",
};

const secondaryActionButtonStyle: React.CSSProperties = {
  background: "#ffffff",
  color: "#1d4ed8",
  border: "1px solid #bfdbfe",
  borderRadius: "10px",
  padding: "10px 14px",
  fontWeight: 800,
  cursor: "pointer",
};

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.35)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
  zIndex: 50,
};

const modalCardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "520px",
  background: "#ffffff",
  borderRadius: "18px",
  border: "1px solid #d1d5db",
  padding: "22px",
  boxShadow: "0 24px 80px rgba(15, 23, 42, 0.25)",
};

const modalFieldStyle: React.CSSProperties = {
  marginBottom: "14px",
};

const modalLabelStyle: React.CSSProperties = {
  display: "block",
  fontWeight: 900,
  marginBottom: "6px",
};

const readOnlyValueStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  background: "#f8fafc",
  borderRadius: "10px",
  padding: "10px",
  fontWeight: 800,
};

const modalInputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #cbd5e1",
  borderRadius: "10px",
  padding: "10px",
  boxSizing: "border-box",
};

const modalActionsStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "10px",
  marginTop: "16px",
};

const modalSecondaryButtonStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  background: "#ffffff",
  borderRadius: "10px",
  padding: "9px 14px",
  fontWeight: 900,
  cursor: "pointer",
};

const modalPrimaryButtonStyle: React.CSSProperties = {
  border: "none",
  background: "#2563eb",
  color: "#ffffff",
  borderRadius: "10px",
  padding: "9px 14px",
  fontWeight: 900,
  cursor: "pointer",
};
