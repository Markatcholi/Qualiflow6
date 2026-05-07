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

  const signTask = async (task: any, status: "approved" | "rejected") => {
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

  if (loading) return <main style={{ padding: "20px" }}>Loading approval tasks...</main>;

  return (
    <main style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>My Approval Tasks</h1>
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
        <p>No approval tasks assigned to you.</p>
      ) : (
        <div style={{ display: "grid", gap: "12px" }}>
          {tasks.map((task) => (
            <section
              key={task.id}
              style={{
                border: "1px solid #d1d5db",
                borderRadius: "8px",
                padding: "12px",
                background: task.status === "approved" ? "#f0fdf4" : task.status === "rejected" ? "#fef2f2" : "#f9fafb",
              }}
            >
              <h2 style={{ marginTop: 0 }}>{task.required_function} — {task.task_type}</h2>
              <p><strong>Status:</strong> {task.status}</p>
              <p><strong>Entity:</strong> {task.entity_type} / {task.entity_id}</p>
              <p><strong>Assigned By:</strong> {task.assigned_by_email || "N/A"}</p>
              <p><strong>Created:</strong> {task.created_at}</p>

              {task.entity_type === "ncmr" ? (
                <p><a href={`/ncmrs/${task.entity_id}`} target="_blank" rel="noreferrer">Open NCMR</a></p>
              ) : null}

              <div style={{ marginTop: "10px", marginBottom: "12px" }}>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>
                  Review Instructions
                </label>
                <textarea
                  value={task.comments || "No review instructions provided."}
                  readOnly
                  rows={8}
                  style={{
                    width: "100%",
                    maxWidth: "800px",
                    background: "#f3f4f6",
                    display: "block",
                  }}
                />
              </div>

              <div style={{ marginTop: "10px", marginBottom: "12px" }}>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>
                  Approver Comment
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

              {task.status === "pending" ? (
                <div style={{ marginTop: "10px", display: "flex", gap: "8px" }}>
                  <button onClick={() => signTask(task, "approved")}>Approve</button>
                  <button onClick={() => signTask(task, "rejected")}>Reject</button>
                </div>
              ) : (
                <div style={{ marginTop: "10px" }}>
                  <strong>Signed By:</strong> {task.signed_by || "N/A"}<br />
                  <strong>Signed At:</strong> {task.signed_at || "N/A"}<br />
                  <strong>Signature Meaning:</strong> {task.signature_meaning || "N/A"}<br />
                  <strong>Approver Comment:</strong> {task.approver_comment || "N/A"}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
