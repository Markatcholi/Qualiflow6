"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function MyApprovalTasksPage() {
  const [userEmail, setUserEmail] = useState("");
  const [tasks, setTasks] = useState<any[]>([]);
  const [signatureEmail, setSignatureEmail] = useState("");
  const [approverCommentByTask, setApproverCommentByTask] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

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
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setTasks(data || []);
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

  const getCapaReviewUrl = (task: any) => {
    const gate = getCapaGateFromTask(task);
    return `/capa/${task.entity_id}/approval-review?gate=${gate}&taskId=${task.id}`;
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

  if (loading) return <main style={{ padding: "20px" }}>Loading tasks...</main>;

  return (
    <main style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>My Tasks</h1>
      <p><strong>Logged-in:</strong> {userEmail || "none"}</p>

      <div style={{ marginBottom: "16px" }}>
        <label>Re-enter Your Email for E-Signature</label><br />
        <input
          value={signatureEmail}
          onChange={(e) => setSignatureEmail(e.target.value)}
          style={{ padding: "8px", width: "100%", maxWidth: "500px" }}
        />
      </div>

      {tasks.length === 0 ? (
        <p>No tasks assigned to you.</p>
      ) : (
        <div style={{ display: "grid", gap: "12px" }}>
          {tasks.map((task) => {
            const capaApproval = isCapaApprovalTask(task);

            return (
              <section
                key={task.id}
                style={{
                  border: "1px solid #d1d5db",
                  borderRadius: "8px",
                  padding: "12px",
                  background:
                    task.status === "approved" || task.status === "completed"
                      ? "#f0fdf4"
                      : task.status === "rejected"
                      ? "#fef2f2"
                      : "#f9fafb",
                }}
              >
                <h2 style={{ marginTop: 0 }}>
                  {task.task_title || `${task.required_function} — ${task.task_type}`}
                </h2>

                <p><strong>Status:</strong> {task.status}</p>
                <p><strong>Entity:</strong> {task.entity_type} / {task.entity_id}</p>
                <p><strong>Assigned By:</strong> {task.assigned_by_email || "N/A"}</p>
                <p><strong>Created:</strong> {task.created_at}</p>

                {task.approver_function || task.approver_job_title ? (
                  <p>
                    <strong>Approval Capacity:</strong>{" "}
                    {task.approver_function || "N/A"} / {task.approver_job_title || task.required_function || "N/A"}
                  </p>
                ) : null}

                {task.entity_type === "ncmr" ? (
                  <p><a href={`/ncmrs/${task.entity_id}`} target="_blank" rel="noreferrer">Open NCMR</a></p>
                ) : null}

                {capaApproval ? (
                  <div
                    style={{
                      border: "1px solid #bfdbfe",
                      background: "#eff6ff",
                      borderRadius: "8px",
                      padding: "12px",
                      marginTop: "10px",
                      marginBottom: "12px",
                    }}
                  >
                    <strong>CAPA Read-Only Review Required</strong>
                    <p style={{ marginBottom: "10px" }}>
                      Open the CAPA review package to review the submitted section and prior approved context before approving or rejecting.
                    </p>
                    <a href={getCapaReviewUrl(task)} style={primaryLinkStyle}>
                      Open CAPA Review Package
                    </a>
                  </div>
                ) : null}

                <div style={{ marginTop: "10px", marginBottom: "12px" }}>
                  <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>
                    Review Instructions
                  </label>
                  <textarea
                    value={task.task_instructions || task.comments || "No instructions provided."}
                    readOnly
                    rows={capaApproval ? 4 : 8}
                    style={{
                      width: "100%",
                      maxWidth: "800px",
                      background: "#f3f4f6",
                      display: "block",
                    }}
                  />
                </div>

                {!capaApproval ? (
                  <div style={{ marginTop: "10px", marginBottom: "12px" }}>
                    <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>
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
                      style={{ width: "100%", maxWidth: "800px", display: "block" }}
                    />
                  </div>
                ) : null}

                {task.status === "pending" ? (
                  capaApproval ? (
                    <div style={{ marginTop: "10px", display: "flex", gap: "8px" }}>
                      <button onClick={() => (window.location.href = getCapaReviewUrl(task))}>
                        Review CAPA
                      </button>
                    </div>
                  ) : task.task_type === "correction_task" ||
                    task.task_type === "rework_task" ||
                    task.task_type === "investigation_collaboration" ? (
                    <div style={{ marginTop: "10px", display: "flex", gap: "8px" }}>
                      <button onClick={() => completeExecutionTask(task)}>Complete Task</button>
                    </div>
                  ) : (
                    <div style={{ marginTop: "10px", display: "flex", gap: "8px" }}>
                      <button onClick={() => signTask(task, "approved")}>Approve</button>
                      <button onClick={() => signTask(task, "rejected")}>Reject</button>
                    </div>
                  )
                ) : (
                  <div style={{ marginTop: "10px" }}>
                    <strong>Signed By:</strong> {task.signed_by || task.completed_by || "N/A"}<br />
                    <strong>Signed At:</strong> {task.signed_at || task.completed_at || "N/A"}<br />
                    <strong>Signature Meaning:</strong> {task.signature_meaning || "N/A"}<br />
                    <strong>Comment:</strong> {task.approver_comment || task.completion_comment || "N/A"}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}

const primaryLinkStyle: React.CSSProperties = {
  display: "inline-block",
  background: "#2563eb",
  color: "white",
  padding: "8px 12px",
  borderRadius: "8px",
  textDecoration: "none",
  fontWeight: 700,
};
