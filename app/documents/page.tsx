"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { isOverdue } from "../../lib/documentWorkflowEngine";

type ControlledDocument = {
  id: string;
  document_number: string;
  title: string;
  document_type: string | null;
  revision: string;
  status: string;
  department: string | null;
  process_area: string | null;
  file_name: string | null;
  file_path: string | null;
  file_url: string | null;
  change_summary: string | null;
  owner_email: string | null;
  approver_email: string | null;
  effective_date: string | null;
  read_ack_required: boolean | null;
  training_required: boolean | null;
  created_at: string | null;
  created_by: string | null;
};

type AssignedReviewer = {
  id: string;
  document_id: string;
  reviewer_type: string;
  reviewer_email: string;
  reviewer_role: string | null;
  required_reviewer: boolean | null;
  review_sequence: number | null;
  review_status: string | null;
  due_date?: string | null;
  sla_days?: number | null;
};

const DOCUMENT_TYPES = [
  "SOP",
  "Work Instruction",
  "Form",
  "Policy",
  "Specification",
  "Protocol",
  "Report",
  "Template",
  "Other",
];

const STATUSES = [
  "draft",
  "collaboration",
  "formal_review",
  "approved",
  "effective",
  "rejected",
  "obsolete",
  "superseded",
];

export default function DocumentControlLandingPage() {
  const [documents, setDocuments] = useState<ControlledDocument[]>([]);
  const [trainingAssignments, setTrainingAssignments] = useState<any[]>([]);
  const [assignedReviewers, setAssignedReviewers] = useState<AssignedReviewer[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");

  const [newDoc, setNewDoc] = useState({
    document_number: "",
    title: "",
    document_type: "SOP",
    revision: "A",
    department: "",
    process_area: "",
    change_summary: "",
    owner_email: "",
    approver_email: "",
    effective_date: "",
    read_ack_required: true,
    training_required: false,
  });

  const fetchUser = async () => {
    const { data: userData } = await supabase.auth.getUser();
    setUserEmail(userData?.user?.email || "");
  };

  const fetchData = async () => {
    setLoading(true);
    await fetchUser();

    const [docRes, trainingRes, reviewerRes] = await Promise.all([
      supabase
        .from("controlled_documents")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("document_training_assignments")
        .select("*")
        .order("assigned_at", { ascending: false }),
      supabase
        .from("document_assigned_reviewers")
        .select("id, document_id, reviewer_type, reviewer_email, reviewer_role, required_reviewer, review_sequence, review_status, due_date, sla_days")
        .order("due_date", { ascending: true }),
    ]);

    if (docRes.error) alert(docRes.error.message);
    else setDocuments((docRes.data as ControlledDocument[]) || []);

    if (!trainingRes.error) setTrainingAssignments(trainingRes.data || []);
    if (!reviewerRes.error) setAssignedReviewers((reviewerRes.data as AssignedReviewer[]) || []);

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const normalizeEmail = (value: string) => {
    const text = String(value || "").trim().toLowerCase();
    if (!text || !text.includes("@")) return "";
    return text;
  };

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const matchesStatus = filterStatus === "all" || doc.status === filterStatus;
      const text = `${doc.document_number} ${doc.title} ${doc.document_type} ${doc.revision} ${doc.department} ${doc.process_area}`.toLowerCase();
      return matchesStatus && text.includes(search.toLowerCase());
    });
  }, [documents, filterStatus, search]);

  const metrics = useMemo(() => {
    return {
      total: documents.length,
      draft: documents.filter((doc) => doc.status === "draft").length,
      collaboration: documents.filter((doc) => doc.status === "collaboration").length,
      formalReview: documents.filter((doc) => doc.status === "formal_review").length,
      approved: documents.filter((doc) => doc.status === "approved").length,
      effective: documents.filter((doc) => doc.status === "effective").length,
      rejected: documents.filter((doc) => doc.status === "rejected").length,
      obsolete: documents.filter((doc) => doc.status === "obsolete").length,
      trainingOpen: trainingAssignments.filter((t) => t.status !== "completed").length,
    };
  }, [documents, trainingAssignments]);

  const workflowSnapshot = useMemo(() => {
    const openReviews = assignedReviewers.filter(
      (reviewer) => reviewer.review_status !== "approved" && reviewer.review_status !== "rejected"
    );

    const overdueReviews = openReviews.filter((reviewer) => isOverdue(reviewer.due_date || null));

    const reviewerCount = assignedReviewers.length;
    const workflowSla =
      reviewerCount === 0
        ? "100.0"
        : (((reviewerCount - overdueReviews.length) / reviewerCount) * 100).toFixed(1);

    return {
      documentsInCollaboration: documents.filter((doc) => doc.status === "collaboration").length,
      documentsInFormalReview: documents.filter((doc) => doc.status === "formal_review").length,
      documentsAwaitingRelease: documents.filter((doc) => doc.status === "approved").length,
      effectiveDocuments: documents.filter((doc) => doc.status === "effective").length,
      openReviews: openReviews.length,
      overdueReviews: overdueReviews.length,
      workflowSla,
      overdueQueue: overdueReviews.slice(0, 5),
    };
  }, [documents, assignedReviewers]);

  const documentMap = useMemo(() => {
    const map = new Map<string, ControlledDocument>();
    documents.forEach((doc) => map.set(doc.id, doc));
    return map;
  }, [documents]);

  const uploadDocumentFile = async () => {
    if (!selectedFile) return { fileName: null, filePath: null, fileUrl: null };

    const safeDocNumber =
      newDoc.document_number.trim().replace(/[^a-zA-Z0-9-_]/g, "_") ||
      "document";
    const safeRevision =
      newDoc.revision.trim().replace(/[^a-zA-Z0-9-_]/g, "_") || "rev";
    const filePath = `${safeDocNumber}/${safeRevision}/${Date.now()}_${selectedFile.name}`;

    const { error } = await supabase.storage
      .from("controlled-documents")
      .upload(filePath, selectedFile, { upsert: true });

    if (error) throw new Error(error.message);

    const { data } = supabase.storage
      .from("controlled-documents")
      .getPublicUrl(filePath);

    return {
      fileName: selectedFile.name,
      filePath,
      fileUrl: data?.publicUrl || null,
    };
  };

  const createDocument = async () => {
    if (!newDoc.document_number.trim() || !newDoc.title.trim()) {
      alert("Document number and title are required.");
      return;
    }

    if (!newDoc.revision.trim()) {
      alert("Revision is required.");
      return;
    }

    if (newDoc.owner_email && !normalizeEmail(newDoc.owner_email)) {
      alert("Owner email must be valid.");
      return;
    }

    if (newDoc.approver_email && !normalizeEmail(newDoc.approver_email)) {
      alert("Approver email must be valid.");
      return;
    }

    setUploading(true);

    try {
      const uploaded = await uploadDocumentFile();

      const { data, error } = await supabase
        .from("controlled_documents")
        .insert({
          document_number: newDoc.document_number.trim(),
          title: newDoc.title.trim(),
          document_type: newDoc.document_type,
          revision: newDoc.revision.trim(),
          status: "draft",
          department: newDoc.department || null,
          process_area: newDoc.process_area || null,
          file_name: uploaded.fileName,
          file_path: uploaded.filePath,
          file_url: uploaded.fileUrl,
          change_summary: newDoc.change_summary || null,
          owner_email: normalizeEmail(newDoc.owner_email) || userEmail || null,
          approver_email: normalizeEmail(newDoc.approver_email) || null,
          effective_date: newDoc.effective_date || null,
          read_ack_required: newDoc.read_ack_required,
          training_required: newDoc.training_required,
          created_by: userEmail || "unknown",
        })
        .select()
        .single();

      if (error) {
        alert(error.message);
        setUploading(false);
        return;
      }

      window.location.href = `/documents/${data.id}`;
    } catch (error: any) {
      alert(error.message);
    }

    setUploading(false);
  };

  const reviseDocument = async (doc: ControlledDocument) => {
    const nextRevision = prompt(
      `Enter new revision for ${doc.document_number}`,
      `${doc.revision}-1`
    );

    if (!nextRevision) return;

    const { data, error } = await supabase
      .from("controlled_documents")
      .insert({
        document_number: doc.document_number,
        title: doc.title,
        document_type: doc.document_type,
        revision: nextRevision,
        status: "draft",
        department: doc.department,
        process_area: doc.process_area,
        owner_email: doc.owner_email || userEmail || null,
        approver_email: doc.approver_email || null,
        read_ack_required: doc.read_ack_required,
        training_required: doc.training_required,
        superseded_document_id: doc.id,
        change_summary: `Revision created from ${doc.document_number} Rev ${doc.revision}`,
        created_by: userEmail || "unknown",
      })
      .select()
      .single();

    if (error) {
      alert(error.message);
      return;
    }

    await supabase
      .from("controlled_documents")
      .update({ superseded_by_document_id: data.id })
      .eq("id", doc.id);

    window.location.href = `/documents/${data.id}`;
  };

  if (loading) return <main style={pageStyle}>Loading Document Control...</main>;

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>DOCUMENT CONTROL</div>
          <h1 style={{ margin: "6px 0" }}>Controlled Documents</h1>
          <p style={subtleText}>
            Create, revise, search, and open controlled document workflows.
          </p>
        </div>
      </header>

      <section style={workflowSnapshotStyle}>
        <div style={snapshotHeaderStyle}>
          <div>
            <div style={eyebrowStyle}>QUALIFLOW ENTERPRISE</div>
            <h2 style={{ margin: "6px 0" }}>Document Workflow Dashboard</h2>
            <p style={subtleText}>
              Real-time snapshot of controlled document workflow, review aging, release status, and SLA performance.
            </p>
          </div>
          <a href="/dashboard/workflow" style={primaryLinkStyle}>Open Full Workflow Dashboard</a>
        </div>

        <div style={kpiGridStyle}>
          <KpiCard title="Collaboration" value={workflowSnapshot.documentsInCollaboration} color="#7c3aed" />
          <KpiCard title="Formal Review" value={workflowSnapshot.documentsInFormalReview} color="#d97706" />
          <KpiCard title="Awaiting Release" value={workflowSnapshot.documentsAwaitingRelease} color="#2563eb" />
          <KpiCard title="Effective" value={workflowSnapshot.effectiveDocuments} color="#15803d" />
          <KpiCard title="Open Reviews" value={workflowSnapshot.openReviews} color="#d97706" />
          <KpiCard title="Overdue Reviews" value={workflowSnapshot.overdueReviews} color="#dc2626" />
          <KpiCard title="Workflow SLA" value={`${workflowSnapshot.workflowSla}%`} color="#2563eb" />
        </div>

        {workflowSnapshot.overdueQueue.length > 0 ? (
          <div style={miniQueueStyle}>
            <h3 style={{ marginTop: 0 }}>Overdue Review Queue</h3>
            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Document</th>
                    <th style={thStyle}>Reviewer</th>
                    <th style={thStyle}>Role</th>
                    <th style={thStyle}>Due Date</th>
                    <th style={thStyle}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {workflowSnapshot.overdueQueue.map((reviewer) => {
                    const relatedDoc = documentMap.get(reviewer.document_id);
                    return (
                      <tr key={reviewer.id}>
                        <td style={tdStyle}>
                          {relatedDoc ? `${relatedDoc.document_number} Rev ${relatedDoc.revision}` : reviewer.document_id}
                        </td>
                        <td style={tdStyle}>{reviewer.reviewer_email}</td>
                        <td style={tdStyle}>{reviewer.reviewer_role || reviewer.reviewer_type}</td>
                        <td style={overdueCellStyle}>{formatDate(reviewer.due_date)}</td>
                        <td style={tdStyle}>
                          <a href={`/documents/${reviewer.document_id}`} style={smallLinkStyle}>Open Workflow</a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>

      <section style={kpiGridStyle}>
        <KpiCard title="Total" value={metrics.total} color="#2563eb" />
        <KpiCard title="Draft" value={metrics.draft} color="#6b7280" />
        <KpiCard title="Collaboration" value={metrics.collaboration} color="#7c3aed" />
        <KpiCard title="Formal Review" value={metrics.formalReview} color="#d97706" />
        <KpiCard title="Approved" value={metrics.approved} color="#2563eb" />
        <KpiCard title="Effective" value={metrics.effective} color="#15803d" />
        <KpiCard title="Rejected" value={metrics.rejected} color="#dc2626" />
        <KpiCard title="Open Training" value={metrics.trainingOpen} color="#dc2626" />
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Create / Add Document</h2>

        <div style={gridStyle}>
          <Field label="Document Number"><input value={newDoc.document_number} onChange={(e) => setNewDoc({ ...newDoc, document_number: e.target.value })} style={inputStyle} /></Field>
          <Field label="Title"><input value={newDoc.title} onChange={(e) => setNewDoc({ ...newDoc, title: e.target.value })} style={inputStyle} /></Field>
          <Field label="Document Type"><select value={newDoc.document_type} onChange={(e) => setNewDoc({ ...newDoc, document_type: e.target.value })} style={inputStyle}>{DOCUMENT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></Field>
          <Field label="Revision"><input value={newDoc.revision} onChange={(e) => setNewDoc({ ...newDoc, revision: e.target.value })} style={inputStyle} /></Field>
          <Field label="Department"><input value={newDoc.department} onChange={(e) => setNewDoc({ ...newDoc, department: e.target.value })} style={inputStyle} /></Field>
          <Field label="Process Area"><input value={newDoc.process_area} onChange={(e) => setNewDoc({ ...newDoc, process_area: e.target.value })} style={inputStyle} /></Field>
          <Field label="Owner Email"><input type="email" value={newDoc.owner_email} onChange={(e) => setNewDoc({ ...newDoc, owner_email: e.target.value })} style={inputStyle} /></Field>
          <Field label="Approver Email"><input type="email" value={newDoc.approver_email} onChange={(e) => setNewDoc({ ...newDoc, approver_email: e.target.value })} style={inputStyle} /></Field>
          <Field label="Document File"><input type="file" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} style={inputStyle} /></Field>
        </div>

        <Field label="Change Summary"><textarea value={newDoc.change_summary} onChange={(e) => setNewDoc({ ...newDoc, change_summary: e.target.value })} rows={3} style={textareaStyle} /></Field>

        <div style={buttonRowStyle}>
          <label><input type="checkbox" checked={newDoc.read_ack_required} onChange={(e) => setNewDoc({ ...newDoc, read_ack_required: e.target.checked })} /> Read & Acknowledge Required</label>
          <label><input type="checkbox" checked={newDoc.training_required} onChange={(e) => setNewDoc({ ...newDoc, training_required: e.target.checked })} /> Training Required</label>
        </div>

        <button onClick={createDocument} disabled={uploading} style={uploading ? disabledButtonStyle : primaryButtonStyle}>{uploading ? "Uploading..." : "Create Document"}</button>
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Document Register</h2>
        <div style={filterRowStyle}>
          <input placeholder="Search document number, title, type, department..." value={search} onChange={(e) => setSearch(e.target.value)} style={inputStyle} />
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={inputStyle}><option value="all">All Statuses</option>{STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead><tr><th style={thStyle}>Document</th><th style={thStyle}>Type</th><th style={thStyle}>Revision</th><th style={thStyle}>Status</th><th style={thStyle}>Effective Date</th><th style={thStyle}>Owner</th><th style={thStyle}>Workflow</th><th style={thStyle}>Revise</th></tr></thead>
            <tbody>
              {filteredDocuments.map((doc) => (
                <tr key={doc.id}>
                  <td style={tdStyle}><strong>{doc.document_number}</strong><div>{doc.title}</div>{doc.file_url ? <a href={doc.file_url} target="_blank">Open File</a> : null}</td>
                  <td style={tdStyle}>{doc.document_type || "N/A"}</td>
                  <td style={tdStyle}>{doc.revision}</td>
                  <td style={tdStyle}><StatusBadge status={doc.status} /></td>
                  <td style={tdStyle}>{doc.effective_date || "N/A"}</td>
                  <td style={tdStyle}>{doc.owner_email || "N/A"}</td>
                  <td style={tdStyle}><a href={`/documents/${doc.id}`} style={primaryLinkStyle}>Open Workflow</a></td>
                  <td style={tdStyle}><button onClick={() => reviseDocument(doc)}>Revise</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div style={{ marginBottom: "12px" }}><label style={labelStyle}>{label}</label><div style={{ marginTop: "5px" }}>{children}</div></div>; }
function KpiCard({ title, value, color }: { title: string; value: number | string; color: string }) { return <div style={{ ...kpiCardStyle, borderLeft: `8px solid ${color}` }}><div style={kpiTitleStyle}>{title}</div><div style={{ fontSize: "30px", fontWeight: 800, color }}>{value}</div></div>; }
function StatusBadge({ status }: { status: string }) { const color = status === "effective" ? "#15803d" : status === "approved" ? "#2563eb" : status === "formal_review" ? "#d97706" : status === "collaboration" ? "#7c3aed" : status === "rejected" ? "#dc2626" : status === "obsolete" || status === "superseded" ? "#991b1b" : "#6b7280"; return <span style={{ background: color, color: "white", borderRadius: "999px", padding: "3px 8px", fontSize: "12px", fontWeight: 700 }}>{status}</span>; }
function formatDate(value: string | null | undefined) { if (!value) return "N/A"; try { return new Date(value).toLocaleDateString(); } catch { return value; } }

const pageStyle: React.CSSProperties = { padding: "24px", background: "#f8fafc", minHeight: "100vh", fontFamily: "Arial, sans-serif" };
const headerStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-start", flexWrap: "wrap", marginBottom: "20px" };
const eyebrowStyle: React.CSSProperties = { fontSize: "12px", letterSpacing: "0.08em", color: "#6b7280", fontWeight: 800 };
const subtleText: React.CSSProperties = { color: "#6b7280" };
const cardStyle: React.CSSProperties = { background: "white", border: "1px solid #d1d5db", borderRadius: "16px", padding: "20px", marginBottom: "20px" };
const workflowSnapshotStyle: React.CSSProperties = { background: "white", border: "1px solid #d1d5db", borderRadius: "16px", padding: "20px", marginBottom: "20px" };
const snapshotHeaderStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: "14px", alignItems: "flex-start", flexWrap: "wrap", marginBottom: "16px" };
const gridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "14px" };
const kpiGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px", marginBottom: "20px" };
const kpiCardStyle: React.CSSProperties = { background: "white", border: "1px solid #d1d5db", borderRadius: "14px", padding: "16px" };
const kpiTitleStyle: React.CSSProperties = { color: "#6b7280", marginBottom: "8px" };
const labelStyle: React.CSSProperties = { fontWeight: 700 };
const inputStyle: React.CSSProperties = { width: "100%", padding: "9px", borderRadius: "8px", border: "1px solid #d1d5db" };
const textareaStyle: React.CSSProperties = { width: "100%", padding: "9px", borderRadius: "8px", border: "1px solid #d1d5db", marginTop: "6px" };
const primaryButtonStyle: React.CSSProperties = { background: "#2563eb", color: "white", border: "none", padding: "10px 14px", borderRadius: "8px", fontWeight: 700, cursor: "pointer" };
const disabledButtonStyle: React.CSSProperties = { background: "#9ca3af", color: "white", border: "none", padding: "10px 14px", borderRadius: "8px", fontWeight: 700, cursor: "not-allowed" };
const primaryLinkStyle: React.CSSProperties = { background: "#2563eb", color: "white", padding: "8px 12px", borderRadius: "8px", textDecoration: "none", fontWeight: 700, display: "inline-block" };
const smallLinkStyle: React.CSSProperties = { color: "#2563eb", fontWeight: 700, textDecoration: "none" };
const buttonRowStyle: React.CSSProperties = { display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center", marginTop: "12px" };
const filterRowStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "2fr 1fr", gap: "12px", marginBottom: "14px" };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse" };
const thStyle: React.CSSProperties = { textAlign: "left", borderBottom: "1px solid #d1d5db", padding: "10px" };
const tdStyle: React.CSSProperties = { borderBottom: "1px solid #e5e7eb", padding: "10px", verticalAlign: "top" };
const overdueCellStyle: React.CSSProperties = { ...tdStyle, color: "#dc2626", fontWeight: 700 };
const miniQueueStyle: React.CSSProperties = { background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "14px", marginTop: "4px" };
