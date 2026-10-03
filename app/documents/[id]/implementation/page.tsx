"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";

export default function DocumentImplementationTaskPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const documentId = String(params?.id || "");
  const taskId = String(searchParams.get("taskId") || "");
  const [task, setTask] = useState<any>(null);
  const [doc, setDoc] = useState<any>(null);
  const [impact, setImpact] = useState<any>(null);
  const [userEmail, setUserEmail] = useState("");
  const [comment, setComment] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const email = String(authData?.user?.email || "").trim().toLowerCase();
      setUserEmail(email);

      const taskRes = await supabase.from("approval_tasks").select("*").eq("id", taskId).eq("entity_type", "document").eq("entity_id", documentId).eq("task_type", "document_post_approval").maybeSingle();
      if (taskRes.error) throw new Error(taskRes.error.message);
      if (!taskRes.data) throw new Error("Document implementation task not found.");
      setTask(taskRes.data);
      setComment(taskRes.data.completion_comment || "");

      const [docRes, impactRes] = await Promise.all([
        supabase.from("controlled_documents").select("id,document_number,revision,title,status,tenant_id").eq("id", documentId).maybeSingle(),
        taskRes.data.document_impact_assessment_id
          ? supabase.from("document_impact_assessments").select("*").eq("id", taskRes.data.document_impact_assessment_id).maybeSingle()
          : Promise.resolve({ data: null, error: null } as any),
      ]);
      if (docRes.error) throw new Error(docRes.error.message);
      if (!docRes.data) throw new Error("Controlled document not found.");
      if (impactRes.error) throw new Error(impactRes.error.message);
      setDoc(docRes.data);
      setImpact(impactRes.data);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (taskId) load(); else setLoading(false); }, [documentId, taskId]);

  const uploadEvidence = async () => {
    const existing = Array.isArray(task?.task_attachments) ? task.task_attachments : [];
    const uploaded: any[] = [];
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const safeName = file.name.trim().replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/_+/g, "_");
      const storagePath = `documents/${documentId}/implementation-tasks/${task.id}/${Date.now()}_${index + 1}_${safeName}`;
      const result = await supabase.storage.from("evidence").upload(storagePath, file, { upsert: false, contentType: file.type || undefined });
      if (result.error) throw new Error(`Unable to upload ${file.name}: ${result.error.message}`);
      const url = supabase.storage.from("evidence").getPublicUrl(storagePath).data.publicUrl;
      uploaded.push({ name: file.name, url, storage_path: storagePath, uploaded_at: new Date().toISOString(), uploaded_by: userEmail });
    }
    return [...existing, ...uploaded];
  };

  const complete = async () => {
    if (!task || !doc) return;
    if (String(task.assigned_to_email || "").toLowerCase() !== userEmail) {
      alert("Only the assigned task owner can complete this implementation task.");
      return;
    }
    if (task.status !== "pending") {
      alert("This task is no longer pending.");
      return;
    }
    if (!comment.trim()) {
      alert("Completion notes are required.");
      return;
    }

    const existingEvidence = Array.isArray(task.task_attachments) ? task.task_attachments : [];
    const evidenceRequired = impact?.impact_area === "validation";
    if (evidenceRequired && existingEvidence.length === 0 && files.length === 0) {
      alert("Upload the completed validation report before completing this task.");
      return;
    }

    setBusy(true);
    try {
      const attachments = await uploadEvidence();
      const now = new Date().toISOString();
      const { data: updated, error } = await supabase.from("approval_tasks").update({
        status: "completed",
        completion_comment: comment.trim(),
        completed_by: userEmail,
        completed_by_email: userEmail,
        completed_at: now,
        signed_by: userEmail,
        signed_at: now,
        signature_meaning: "Controlled Document Post-Approval Implementation: I confirm that the assigned implementation activity has been completed and the submitted evidence is accurate.",
        task_attachments: attachments,
      }).eq("id", task.id).eq("assigned_to_email", userEmail).eq("status", "pending").select("*");
      if (error) throw new Error(error.message);
      if (!updated || updated.length === 0) throw new Error("The task could not be completed. It may have changed or been reassigned.");
      alert("Implementation task completed and submitted to Document Control for verification.");
      window.location.href = `/documents/${documentId}`;
    } catch (e: any) {
      alert(e.message);
      setBusy(false);
    }
  };

  if (loading) return <main style={pageStyle}>Loading implementation task...</main>;
  if (!task || !doc) return <main style={pageStyle}><p>Unable to load the implementation task.</p><Link href="/workspace">Return to My Workspace</Link></main>;

  const assigned = String(task.assigned_to_email || "").toLowerCase() === userEmail;
  return (
    <main style={pageStyle}>
      <div style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>CONTROLLED DOCUMENT IMPLEMENTATION</div>
          <h1 style={{ margin: "5px 0" }}>{task.task_title || "Post-Approval Task"}</h1>
          <p style={{ margin: 0 }}>{doc.document_number} Rev {doc.revision} · {doc.title}</p>
        </div>
        <Link href="/workspace">Return to My Workspace</Link>
      </div>

      {!assigned ? <div style={warningStyle}>This task is assigned to <strong>{task.assigned_to_email}</strong>. You may review it, but only the assigned user can complete it.</div> : null}

      <section style={cardStyle}>
        <h2>Assignment</h2>
        <div style={gridStyle}>
          <Field label="Task" value={task.task_title} />
          <Field label="Assigned To" value={task.assigned_to_email} />
          <Field label="Due Date" value={task.due_date} />
          <Field label="Status" value={task.status} />
        </div>
        <Field label="Task Instruction" value={task.task_instructions} />
        {impact ? <Field label="Impact Assessment" value={impact.assessment} /> : null}
      </section>

      <section style={cardStyle}>
        <h2>Completion Evidence</h2>
        {impact?.impact_area === "validation" ? <p style={noticeStyle}><strong>Required evidence:</strong> Completed validation report.</p> : null}
        <label style={labelStyle}>Completion Notes
          <textarea disabled={!assigned || task.status !== "pending"} value={comment} onChange={(e) => setComment(e.target.value)} rows={4} style={inputStyle} />
        </label>
        <label style={labelStyle}>Upload Evidence
          <input disabled={!assigned || task.status !== "pending"} type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} />
        </label>
        {Array.isArray(task.task_attachments) && task.task_attachments.length > 0 ? (
          <div><strong>Existing evidence:</strong> {task.task_attachments.map((file: any, index: number) => <span key={file.storage_path || index}>{index ? ", " : ""}<a href={file.url} target="_blank" rel="noreferrer">{file.name || `Attachment ${index + 1}`}</a></span>)}</div>
        ) : null}
        {assigned && task.status === "pending" ? <button disabled={busy} onClick={complete} style={buttonStyle}>{busy ? "Submitting..." : "Complete & Submit for Verification"}</button> : null}
      </section>
    </main>
  );
}

function Field({ label, value }: { label: string; value: any }) {
  return <div><strong>{label}</strong><div style={{ marginTop: 5 }}>{value || "N/A"}</div></div>;
}

const pageStyle: React.CSSProperties = { padding: 24, background: "#f8fafc", minHeight: "100vh", fontFamily: "Arial, sans-serif" };
const headerStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 20 };
const eyebrowStyle: React.CSSProperties = { fontSize: 12, letterSpacing: "0.08em", color: "#64748b", fontWeight: 800 };
const cardStyle: React.CSSProperties = { background: "#fff", border: "1px solid #d1d5db", borderRadius: 16, padding: 20, marginBottom: 20 };
const gridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14, marginBottom: 16 };
const labelStyle: React.CSSProperties = { display: "grid", gap: 7, fontWeight: 700, marginBottom: 14 };
const inputStyle: React.CSSProperties = { width: "100%", padding: 10, border: "1px solid #cbd5e1", borderRadius: 8, boxSizing: "border-box" };
const buttonStyle: React.CSSProperties = { background: "#172033", color: "#fff", border: 0, borderRadius: 8, padding: "10px 14px", fontWeight: 700, cursor: "pointer" };
const warningStyle: React.CSSProperties = { background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: 12, marginBottom: 16 };
const noticeStyle: React.CSSProperties = { background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: 10 };
