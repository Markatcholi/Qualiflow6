"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";

type ImpactRow = {
  id: string;
  impact_area: string;
  is_impacted: boolean | null;
  assessment: string | null;
  disposition_required: boolean;
  disposition_summary: string | null;
};

type TaskRow = {
  id: string;
  document_impact_assessment_id: string | null;
  assigned_to_email: string;
  status: string | null;
  due_date: string | null;
  task_title: string | null;
  task_instructions: string | null;
  task_attachments: any[];
  implementation_verification_status: string;
  completion_comment: string | null;
};

const REQUIREMENT_MAP: Record<string, { title: string; requiredFunction: string; instruction: string }> = {
  validation: {
    title: "Revalidation",
    requiredFunction: "Validation",
    instruction: "Upload the completed validation report.",
  },
};

export default function DocumentPostApprovalTasks({
  documentId,
  tenantId,
  documentNumber,
  revision,
  status,
  userEmail,
  canCoordinate,
}: {
  documentId: string;
  tenantId: string;
  documentNumber: string;
  revision: string;
  status: string;
  userEmail: string;
  canCoordinate: boolean;
}) {
  const [impacts, setImpacts] = useState<ImpactRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [users, setUsers] = useState<string[]>([]);
  const [forms, setForms] = useState<Record<string, { assignee: string; dueDate: string; instruction: string }>>({});
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [impactRes, taskRes, userRes] = await Promise.all([
      supabase.from("document_impact_assessments").select("*").eq("document_id", documentId).eq("is_impacted", true).order("impact_area"),
      supabase.from("approval_tasks").select("*").eq("entity_type", "document").eq("entity_id", documentId).eq("task_type", "document_post_approval").order("created_at"),
      supabase.from("tenant_memberships").select("user_email").eq("tenant_id", tenantId).eq("membership_status", "active").order("user_email"),
    ]);
    if (impactRes.error) throw new Error(impactRes.error.message);
    if (taskRes.error) throw new Error(taskRes.error.message);
    if (userRes.error) throw new Error(userRes.error.message);
    setImpacts((impactRes.data || []) as ImpactRow[]);
    setTasks((taskRes.data || []) as TaskRow[]);
    setUsers((userRes.data || []).map((row: any) => String(row.user_email || "").trim().toLowerCase()).filter(Boolean));
  };

  useEffect(() => { load().catch((e) => alert(e.message)); }, [documentId, tenantId]);

  const requirements = useMemo(
    () => impacts.filter((impact) => impact.disposition_required && REQUIREMENT_MAP[impact.impact_area]),
    [impacts]
  );

  const taskForImpact = (impactId: string) =>
    tasks.find((task) => task.document_impact_assessment_id === impactId && task.status !== "cancelled");

  const formFor = (impact: ImpactRow) => {
    const mapped = REQUIREMENT_MAP[impact.impact_area];
    return forms[impact.id] || { assignee: "", dueDate: "", instruction: impact.disposition_summary?.trim() || mapped?.instruction || "" };
  };

  const patchForm = (impact: ImpactRow, patch: Partial<{ assignee: string; dueDate: string; instruction: string }>) => {
    setForms((current) => ({ ...current, [impact.id]: { ...formFor(impact), ...patch } }));
  };

  const assignTask = async (impact: ImpactRow) => {
    if (!canCoordinate || status !== "approved") return;
    const mapped = REQUIREMENT_MAP[impact.impact_area];
    const form = formFor(impact);
    if (!mapped || !form.assignee || !form.dueDate || !form.instruction.trim()) {
      alert("Assignee, due date, and task instruction are required.");
      return;
    }
    if (taskForImpact(impact.id)) {
      alert("A post-approval task already exists for this impact requirement.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.from("approval_tasks").insert({
        entity_type: "document",
        entity_id: documentId,
        task_type: "document_post_approval",
        required_function: mapped.requiredFunction,
        assigned_to_email: form.assignee,
        assigned_by_email: userEmail,
        status: "pending",
        due_date: form.dueDate,
        required: true,
        task_title: mapped.title,
        task_instructions: form.instruction.trim(),
        record_number: `${documentNumber} Rev ${revision}`,
        implementation_verification_status: "pending",
        document_impact_assessment_id: impact.id,
      });
      if (error) throw new Error(error.message);
      setForms((current) => ({ ...current, [impact.id]: { ...form, assignee: "", dueDate: "" } }));
      await load();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  };

  const verifyTask = async (task: TaskRow) => {
    if (!canCoordinate || task.status !== "completed") return;
    const attachments = Array.isArray(task.task_attachments) ? task.task_attachments : [];
    if (attachments.length === 0) {
      alert("Objective evidence is required before this implementation task can be verified.");
      return;
    }
    const comment = window.prompt("Verification comment:", "Implementation evidence reviewed and accepted.");
    if (!comment?.trim()) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("approval_tasks").update({
        implementation_verification_status: "verified",
        implementation_verification_comment: comment.trim(),
        implementation_verified_by: userEmail,
        implementation_verified_at: new Date().toISOString(),
      }).eq("id", task.id).eq("entity_type", "document").eq("entity_id", documentId);
      if (error) throw new Error(error.message);
      await load();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (requirements.length === 0 && tasks.length === 0) return null;

  return (
    <section style={cardStyle}>
      <h2 style={{ marginTop: 0 }}>Post-Approval Implementation</h2>
      <p style={subtleStyle}>
        QualiSphere carries required actions forward from the Impact Assessment. After formal approval, Document Control assigns the resulting implementation tasks and verifies the submitted evidence.
      </p>

      <div style={summaryStyle}>
        <strong>{requirements.length} impact requirement(s)</strong>
        <span>{tasks.filter((t) => t.status !== "cancelled").length} task(s) assigned</span>
        <span>{tasks.filter((t) => t.implementation_verification_status === "verified").length} verified</span>
      </div>

      {requirements.map((impact) => {
        const mapped = REQUIREMENT_MAP[impact.impact_area];
        const task = taskForImpact(impact.id);
        const form = formFor(impact);
        return (
          <div key={impact.id} style={requirementStyle}>
            <div>
              <strong>{mapped.title}</strong>
              <div style={smallStyle}>Impact source: Validation</div>
              <div style={{ marginTop: 6 }}>{impact.assessment || "No impact description."}</div>
            </div>

            {!task ? (
              status === "approved" && canCoordinate ? (
                <div style={gridStyle}>
                  <label style={labelStyle}>Assignee
                    <select value={form.assignee} onChange={(e) => patchForm(impact, { assignee: e.target.value })} style={inputStyle}>
                      <option value="">Select assignee</option>
                      {users.map((email) => <option key={email} value={email}>{email}</option>)}
                    </select>
                  </label>
                  <label style={labelStyle}>Due Date
                    <input type="date" value={form.dueDate} onChange={(e) => patchForm(impact, { dueDate: e.target.value })} style={inputStyle} />
                  </label>
                  <label style={{ ...labelStyle, gridColumn: "1 / -1" }}>Task Instruction
                    <textarea value={form.instruction} onChange={(e) => patchForm(impact, { instruction: e.target.value })} rows={2} style={inputStyle} />
                  </label>
                  <button disabled={busy} onClick={() => assignTask(impact)} style={buttonStyle}>Assign Implementation Task</button>
                </div>
              ) : (
                <div style={noticeStyle}>Formal approval must be completed before Document Control can assign this implementation task.</div>
              )
            ) : (
              <div style={taskStyle}>
                <div><strong>Assigned to:</strong> {task.assigned_to_email}</div>
                <div><strong>Due:</strong> {task.due_date || "N/A"}</div>
                <div><strong>Status:</strong> {task.status || "pending"}</div>
                <div><strong>Verification:</strong> {task.implementation_verification_status || "pending"}</div>
                <div><strong>Instruction:</strong> {task.task_instructions}</div>
                {Array.isArray(task.task_attachments) && task.task_attachments.length > 0 ? (
                  <div style={{ marginTop: 8 }}>
                    <strong>Evidence:</strong>{" "}
                    {task.task_attachments.map((file: any, index: number) => (
                      <span key={file.storage_path || index}>
                        {index > 0 ? ", " : ""}
                        <a href={file.url} target="_blank" rel="noreferrer">{file.name || `Attachment ${index + 1}`}</a>
                      </span>
                    ))}
                  </div>
                ) : null}
                {task.status === "completed" && task.implementation_verification_status !== "verified" && canCoordinate ? (
                  <button disabled={busy} onClick={() => verifyTask(task)} style={buttonStyle}>Verify Implementation Evidence</button>
                ) : null}
                {task.status === "pending" ? (
                  <Link href={`/documents/${documentId}/implementation?taskId=${task.id}`} style={linkStyle}>Open Implementation Task</Link>
                ) : null}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

const cardStyle: React.CSSProperties = { background: "#fff", border: "1px solid #d1d5db", borderRadius: 16, padding: 20, marginBottom: 20 };
const subtleStyle: React.CSSProperties = { color: "#596579" };
const summaryStyle: React.CSSProperties = { display: "flex", gap: 16, flexWrap: "wrap", padding: 12, background: "#f8fafc", borderRadius: 10, marginBottom: 14 };
const requirementStyle: React.CSSProperties = { borderTop: "1px solid #e5e7eb", padding: "16px 0", display: "grid", gap: 14 };
const gridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 };
const labelStyle: React.CSSProperties = { fontWeight: 700, display: "grid", gap: 6 };
const inputStyle: React.CSSProperties = { width: "100%", padding: "9px 10px", border: "1px solid #cbd5e1", borderRadius: 7, boxSizing: "border-box" };
const buttonStyle: React.CSSProperties = { background: "#172033", color: "#fff", border: 0, borderRadius: 7, padding: "10px 14px", cursor: "pointer", fontWeight: 700, marginTop: 8 };
const taskStyle: React.CSSProperties = { background: "#f8fafc", border: "1px solid #dbe3ec", borderRadius: 10, padding: 12, display: "grid", gap: 6 };
const noticeStyle: React.CSSProperties = { background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: 10, color: "#92400e" };
const smallStyle: React.CSSProperties = { fontSize: 12, color: "#64748b" };
const linkStyle: React.CSSProperties = { display: "inline-block", marginTop: 8, fontWeight: 700 };
