"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const IMPACT_AREAS = [
  ["product_design", "Product / Design"],
  ["manufacturing_process", "Manufacturing / Process"],
  ["tooling_equipment", "Tooling / Equipment"],
  ["inspection_test_methods", "Inspection / Test Methods"],
  ["specifications", "Specifications"],
  ["supplier", "Supplier"],
  ["inventory_wip", "Inventory / WIP"],
  ["regulatory_risk", "Regulatory / Risk"],
  ["validation", "Validation"],
  ["training", "Training"],
] as const;

type Assessment = {
  id: string;
  impact_area: string;
  is_impacted: boolean | null;
  assessment: string | null;
  disposition_required: boolean;
  disposition_summary: string | null;
};

type Task = {
  id: string;
  document_impact_assessment_id: string | null;
  required_function: string;
  assigned_to_email: string;
  status: string;
  due_date: string | null;
  task_instructions: string | null;
  completion_comment: string | null;
  implementation_verification_status: string;
  implementation_verification_comment: string | null;
  returned_reason: string | null;
};

export default function DocumentImpactAssessment({
  documentId,
  tenantId,
  documentNumber,
  revision,
  status,
  userEmail,
  canManage,
}: {
  documentId: string;
  tenantId: string;
  documentNumber: string;
  revision: string;
  status: string;
  userEmail: string;
  canManage: boolean;
}) {
  const [rows, setRows] = useState<Assessment[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [busy, setBusy] = useState(false);
  const [taskDraft, setTaskDraft] = useState<Record<string, { assignee: string; due: string; instructions: string }>>({});
  const [completion, setCompletion] = useState<Record<string, string>>({});
  const [verification, setVerification] = useState<Record<string, string>>({});

  const editableAssessment = canManage && ["draft", "rejected", "collaboration"].includes(status);

  const load = async () => {
    const [assessmentRes, taskRes] = await Promise.all([
      supabase.from("document_impact_assessments").select("*").eq("document_id", documentId).order("impact_area"),
      supabase.from("approval_tasks").select("id,document_impact_assessment_id,required_function,assigned_to_email,status,due_date,task_instructions,completion_comment,implementation_verification_status,implementation_verification_comment,returned_reason").eq("entity_type", "document").eq("entity_id", documentId).eq("task_type", "document_disposition").order("created_at"),
    ]);
    if (assessmentRes.error) throw new Error(assessmentRes.error.message);
    if (taskRes.error) throw new Error(taskRes.error.message);
    setRows((assessmentRes.data || []) as Assessment[]);
    setTasks((taskRes.data || []) as Task[]);
  };

  useEffect(() => { load().catch((e) => alert(e.message)); }, [documentId]);

  const rowMap = useMemo(() => new Map(rows.map((row) => [row.impact_area, row])), [rows]);

  const saveArea = async (area: string, patch: Partial<Assessment>) => {
    if (!editableAssessment) return;
    setBusy(true);
    try {
      const current = rowMap.get(area);
      const payload = {
        tenant_id: tenantId,
        document_id: documentId,
        impact_area: area,
        is_impacted: patch.is_impacted !== undefined ? patch.is_impacted : current?.is_impacted ?? null,
        assessment: patch.assessment !== undefined ? patch.assessment : current?.assessment ?? null,
        disposition_required: patch.disposition_required !== undefined ? patch.disposition_required : current?.disposition_required ?? false,
        disposition_summary: patch.disposition_summary !== undefined ? patch.disposition_summary : current?.disposition_summary ?? null,
        assessed_by: userEmail,
        assessed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (payload.is_impacted === false) {
        payload.assessment = null;
        payload.disposition_required = false;
        payload.disposition_summary = null;
      }
      const { error } = await supabase.from("document_impact_assessments").upsert(payload, { onConflict: "document_id,impact_area" });
      if (error) throw new Error(error.message);
      await load();
    } catch (e: any) { alert(e.message); }
    setBusy(false);
  };

  const addTask = async (row: Assessment) => {
    const draft = taskDraft[row.id] || { assignee: "", due: "", instructions: "" };
    if (!draft.assignee.trim() || !draft.due || !draft.instructions.trim()) {
      alert("Assignee, due date, and task instructions are required.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.from("approval_tasks").insert({
        entity_type: "document",
        entity_id: documentId,
        task_type: "document_disposition",
        required_function: row.impact_area,
        assigned_to_email: draft.assignee.trim().toLowerCase(),
        assigned_by_email: userEmail,
        status: "pending",
        due_date: draft.due,
        task_title: `Document Impact Disposition — ${documentNumber} Rev ${revision}`,
        task_instructions: draft.instructions.trim(),
        required: true,
        implementation_verification_status: "pending",
        document_impact_assessment_id: row.id,
      });
      if (error) throw new Error(error.message);
      setTaskDraft((prev) => ({ ...prev, [row.id]: { assignee: "", due: "", instructions: "" } }));
      await load();
    } catch (e: any) { alert(e.message); }
    setBusy(false);
  };

  const completeTask = async (task: Task) => {
    const note = (completion[task.id] || "").trim();
    if (!note) { alert("Completion notes are required."); return; }
    setBusy(true);
    const { error } = await supabase.from("approval_tasks").update({
      status: "completed",
      completion_comment: note,
      completed_by: userEmail,
      completed_by_email: userEmail,
      completed_at: new Date().toISOString(),
      implementation_verification_status: "awaiting_verification",
    }).eq("id", task.id);
    setBusy(false);
    if (error) return alert(error.message);
    await load();
  };

  const verifyTask = async (task: Task, accepted: boolean) => {
    const note = (verification[task.id] || "").trim();
    if (!note) { alert(accepted ? "Verification notes are required." : "Return reason is required."); return; }
    setBusy(true);
    const patch = accepted ? {
      implementation_verification_status: "verified",
      implementation_verification_comment: note,
      implementation_verified_by: userEmail,
      implementation_verified_at: new Date().toISOString(),
    } : {
      status: "pending",
      implementation_verification_status: "pending",
      implementation_verification_comment: null,
      implementation_verified_by: null,
      implementation_verified_at: null,
      returned_reason: note,
      returned_by: userEmail,
      returned_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("approval_tasks").update(patch).eq("id", task.id);
    setBusy(false);
    if (error) return alert(error.message);
    setVerification((prev) => ({ ...prev, [task.id]: "" }));
    await load();
  };

  const completedAreas = IMPACT_AREAS.filter(([key]) => rowMap.get(key)?.is_impacted !== null && rowMap.get(key)?.is_impacted !== undefined).length;
  const requiredTasks = tasks.filter((task) => task.status !== "cancelled");
  const verifiedTasks = requiredTasks.filter((task) => task.implementation_verification_status === "verified").length;

  return (
    <section style={{ border: "1px solid #d8dee8", borderRadius: 12, padding: 18, marginTop: 18, background: "#fff" }}>
      <h2 style={{ marginTop: 0 }}>Impact Assessment & Disposition</h2>
      <p style={{ color: "#596579" }}>
        Assess every area independently. Selecting No ends that area's path. Selecting Yes opens the assessment and disposition controls.
        All required disposition tasks must be completed and verified before release.
      </p>
      <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
        <strong>Areas assessed: {completedAreas}/{IMPACT_AREAS.length}</strong>
        <strong>Disposition tasks verified: {verifiedTasks}/{requiredTasks.length}</strong>
      </div>

      {IMPACT_AREAS.map(([key, label]) => {
        const row = rowMap.get(key);
        const areaTasks = row ? tasks.filter((task) => task.document_impact_assessment_id === row.id) : [];
        return (
          <div key={key} style={{ borderTop: "1px solid #e6eaf0", padding: "16px 0" }}>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(220px,1fr) 180px", gap: 12, alignItems: "center" }}>
              <strong>{label}</strong>
              <select disabled={!editableAssessment || busy} value={row?.is_impacted === true ? "yes" : row?.is_impacted === false ? "no" : ""} onChange={(e) => saveArea(key, { is_impacted: e.target.value === "yes" ? true : e.target.value === "no" ? false : null })} style={inputStyle}>
                <option value="">Select Yes / No</option>
                <option value="yes">Yes — Impacted</option>
                <option value="no">No — Not Impacted</option>
              </select>
            </div>

            {row?.is_impacted === true ? (
              <div style={{ marginTop: 12 }}>
                <label style={labelStyle}>Impact Assessment</label>
                <textarea disabled={!editableAssessment} defaultValue={row.assessment || ""} onBlur={(e) => saveArea(key, { assessment: e.target.value })} rows={3} style={textareaStyle} placeholder={`Describe the ${label.toLowerCase()} impact.`} />
                <label style={{ ...labelStyle, display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
                  <input type="checkbox" disabled={!editableAssessment} checked={row.disposition_required} onChange={(e) => saveArea(key, { disposition_required: e.target.checked })} />
                  Disposition / implementation action required
                </label>

                {row.disposition_required ? (
                  <>
                    <label style={labelStyle}>Disposition Summary</label>
                    <textarea disabled={!editableAssessment} defaultValue={row.disposition_summary || ""} onBlur={(e) => saveArea(key, { disposition_summary: e.target.value })} rows={2} style={textareaStyle} placeholder="Describe the required disposition or implementation action." />

                    {areaTasks.map((task) => {
                      const mine = task.assigned_to_email.toLowerCase() === userEmail.toLowerCase();
                      return (
                        <div key={task.id} style={{ background: "#f7f9fc", border: "1px solid #dfe5ee", borderRadius: 8, padding: 12, marginTop: 10 }}>
                          <strong>{task.assigned_to_email}</strong> · Due {task.due_date || "N/A"} · {task.status} · Verification: {task.implementation_verification_status}
                          <div style={{ marginTop: 6 }}>{task.task_instructions}</div>
                          {task.returned_reason ? <div style={{ marginTop: 6 }}><strong>Returned:</strong> {task.returned_reason}</div> : null}
                          {task.completion_comment ? <div style={{ marginTop: 6 }}><strong>Completion:</strong> {task.completion_comment}</div> : null}

                          {mine && task.status === "pending" ? (
                            <div style={{ marginTop: 10 }}>
                              <textarea value={completion[task.id] || ""} onChange={(e) => setCompletion((p) => ({ ...p, [task.id]: e.target.value }))} rows={2} style={textareaStyle} placeholder="Completion notes / evidence summary" />
                              <button disabled={busy} onClick={() => completeTask(task)} style={buttonStyle}>Submit Task for Verification</button>
                            </div>
                          ) : null}

                          {canManage && task.status === "completed" && task.implementation_verification_status !== "verified" ? (
                            <div style={{ marginTop: 10 }}>
                              <textarea value={verification[task.id] || ""} onChange={(e) => setVerification((p) => ({ ...p, [task.id]: e.target.value }))} rows={2} style={textareaStyle} placeholder="Verification notes or return reason" />
                              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                                <button disabled={busy} onClick={() => verifyTask(task, true)} style={buttonStyle}>Accept & Verify</button>
                                <button disabled={busy} onClick={() => verifyTask(task, false)} style={secondaryButtonStyle}>Return for Additional Action</button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}

                    {editableAssessment ? (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 180px", gap: 8, marginTop: 12 }}>
                        <input value={taskDraft[row.id]?.assignee || ""} onChange={(e) => setTaskDraft((p) => ({ ...p, [row.id]: { ...(p[row.id] || { due: "", instructions: "" }), assignee: e.target.value } }))} style={inputStyle} placeholder="Task owner email" />
                        <input type="date" value={taskDraft[row.id]?.due || ""} onChange={(e) => setTaskDraft((p) => ({ ...p, [row.id]: { ...(p[row.id] || { assignee: "", instructions: "" }), due: e.target.value } }))} style={inputStyle} />
                        <textarea value={taskDraft[row.id]?.instructions || ""} onChange={(e) => setTaskDraft((p) => ({ ...p, [row.id]: { ...(p[row.id] || { assignee: "", due: "" }), instructions: e.target.value } }))} rows={2} style={{ ...textareaStyle, gridColumn: "1 / -1" }} placeholder="Disposition task instructions" />
                        <button disabled={busy} onClick={() => addTask(row)} style={buttonStyle}>Add Disposition Task</button>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}

const inputStyle: React.CSSProperties = { width: "100%", padding: "9px 10px", border: "1px solid #cbd3df", borderRadius: 6, boxSizing: "border-box" };
const textareaStyle: React.CSSProperties = { ...inputStyle, resize: "vertical", marginTop: 6 };
const labelStyle: React.CSSProperties = { display: "block", fontWeight: 600, marginTop: 8 };
const buttonStyle: React.CSSProperties = { border: 0, borderRadius: 6, padding: "9px 13px", cursor: "pointer", background: "#172033", color: "#fff", fontWeight: 600 };
const secondaryButtonStyle: React.CSSProperties = { ...buttonStyle, background: "#fff", color: "#172033", border: "1px solid #9aa6b6" };
