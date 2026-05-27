"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type ChangeControl = {
  id: string;
  change_number: string | null;
  change_title: string;
  change_description: string;
  change_justification: string;
  change_type: string | null;
  change_category: string | null;
  priority: string | null;
  status: string | null;
  owner_email: string | null;
  approver_email: string | null;
  risk_level: string | null;
  created_at: string | null;
};

export default function ChangeControlWorkflowPage() {
  const params = useParams();
  const changeId = String(params?.id || "");

  const [change, setChange] = useState<ChangeControl | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [controlledDocuments, setControlledDocuments] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [trainingAssignments, setTrainingAssignments] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState("");

  const [newDoc, setNewDoc] = useState({
    document_number: "",
    document_title: "",
    current_revision: "",
    proposed_revision: "",
    change_description: "",
    training_required: false,
  });

  const [newProduct, setNewProduct] = useState({
    product_part_number: "",
    product_name: "",
    lot_or_serial_scope: "",
    impact_description: "",
  });

  const [newTask, setNewTask] = useState({
    task_title: "",
    task_description: "",
    owner_email: "",
    due_date: "",
  });

  const canApprove =
    userRole === "admin" || userRole === "approver" || userRole === "vp_quality";

  const fetchUser = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const email = userData?.user?.email || "";
    setUserEmail(email);

    if (!email) return;

    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_email", email)
      .maybeSingle();

    setUserRole(data?.role || "user");
  };

  const fetchData = async () => {
    if (!changeId) return;
    setLoading(true);
    await fetchUser();

    const changeRes = await supabase
      .from("change_controls")
      .select("*")
      .eq("id", changeId)
      .maybeSingle();

    const docRes = await supabase
      .from("change_control_documents")
      .select("*")
      .eq("change_control_id", changeId)
      .order("created_at", { ascending: false });

    const productRes = await supabase
      .from("change_control_products")
      .select("*")
      .eq("change_control_id", changeId)
      .order("created_at", { ascending: false });

    const taskRes = await supabase
      .from("change_control_tasks")
      .select("*")
      .eq("change_control_id", changeId)
      .order("created_at", { ascending: false });

    const controlledDocRes = await supabase
      .from("controlled_documents")
      .select("*")
      .order("created_at", { ascending: false });

    const trainingRes = await supabase
      .from("training_assignments")
      .select("*")
      .order("created_at", { ascending: false });

    if (changeRes.error) alert(changeRes.error.message);
    else setChange((changeRes.data as ChangeControl) || null);
    if (!docRes.error) setDocuments(docRes.data || []);
    if (!productRes.error) setProducts(productRes.data || []);
    if (!taskRes.error) setTasks(taskRes.data || []);
    if (!controlledDocRes.error) setControlledDocuments(controlledDocRes.data || []);
    if (!trainingRes.error) setTrainingAssignments(trainingRes.data || []);

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [changeId]);

  const normalizeEmail = (value: string) => {
    const text = String(value || "").trim().toLowerCase();
    if (!text || !text.includes("@")) return "";
    return text;
  };

  const linkedControlledDocuments = documents
    .map((doc) => controlledDocuments.find((cd) => cd.id === doc.controlled_document_id))
    .filter(Boolean);

  const implementationComplete = tasks.length > 0 && tasks.every((task) => task.status === "complete");
  const documentsEffective = linkedControlledDocuments.length > 0 && linkedControlledDocuments.every((doc: any) => doc.status === "effective");

  const trainingComplete = documents.length > 0 && documents.every((doc) => {
    if (!doc.training_required) return true;
    const linkedDoc = controlledDocuments.find((cd) => cd.id === doc.controlled_document_id);
    if (!linkedDoc) return false;
    const docTraining = trainingAssignments.filter((item) => item.document_id === linkedDoc.id);
    return docTraining.length > 0 && docTraining.every((item) => item.status === "completed" || item.status === "effectiveness_complete" || item.status === "waived");
  });

  const closureEligible = implementationComplete && documentsEffective && trainingComplete;

  const addDocument = async () => {
    if (!newDoc.document_number.trim()) return alert("Document number is required.");
    const { error } = await supabase.from("change_control_documents").insert({
      change_control_id: changeId,
      document_number: newDoc.document_number,
      document_title: newDoc.document_title,
      current_revision: newDoc.current_revision,
      proposed_revision: newDoc.proposed_revision,
      change_description: newDoc.change_description,
      training_required: newDoc.training_required,
      document_status: "planned",
    });
    if (error) return alert(error.message);
    setNewDoc({ document_number: "", document_title: "", current_revision: "", proposed_revision: "", change_description: "", training_required: false });
    fetchData();
  };

  const createControlledDocumentFromChange = async (linkedDoc: any) => {
    if (!change) return;
    const { data, error } = await supabase
      .from("controlled_documents")
      .insert({
        document_number: linkedDoc.document_number,
        title: linkedDoc.document_title || linkedDoc.document_number,
        revision: linkedDoc.proposed_revision || "A",
        status: "draft",
        originating_change_control_id: change.id,
        change_required: true,
        change_summary: linkedDoc.change_description || change.change_description,
        owner_email: change.owner_email || userEmail || null,
        training_required: linkedDoc.training_required || false,
        read_ack_required: true,
        created_by: userEmail || "unknown",
      })
      .select()
      .single();

    if (error) return alert(error.message);

    const linkRes = await supabase
      .from("change_control_documents")
      .update({ controlled_document_id: data.id, document_status: "draft" })
      .eq("id", linkedDoc.id);

    if (linkRes.error) return alert(linkRes.error.message);
    alert("Controlled document created from change.");
    fetchData();
  };

  const addProduct = async () => {
    if (!newProduct.product_part_number.trim()) return alert("Product part number is required.");
    const { error } = await supabase.from("change_control_products").insert({ change_control_id: changeId, ...newProduct });
    if (error) return alert(error.message);
    setNewProduct({ product_part_number: "", product_name: "", lot_or_serial_scope: "", impact_description: "" });
    fetchData();
  };

  const addTask = async () => {
    if (!newTask.task_title.trim()) return alert("Task title is required.");
    if (!normalizeEmail(newTask.owner_email)) return alert("Task owner email is required.");
    const { error } = await supabase.from("change_control_tasks").insert({
      change_control_id: changeId,
      ...newTask,
      owner_email: normalizeEmail(newTask.owner_email),
      status: "open",
      created_by: userEmail || "unknown",
    });
    if (error) return alert(error.message);
    setNewTask({ task_title: "", task_description: "", owner_email: "", due_date: "" });
    fetchData();
  };

  const completeTask = async (id: string) => {
    const { error } = await supabase
      .from("change_control_tasks")
      .update({ status: "complete", completed_at: new Date().toISOString(), completed_by: userEmail })
      .eq("id", id);
    if (error) return alert(error.message);
    fetchData();
  };

  const updateStatus = async (status: string) => {
    if (!change) return;
    const payload: any = { status, updated_at: new Date().toISOString() };

    if (status === "pending_approval") {
      payload.submitted_at = new Date().toISOString();
      payload.submitted_by = userEmail;
    }
    if (status === "approved") {
      if (!canApprove) return alert("Only approvers/admin/VP Quality can approve.");
      payload.approved_at = new Date().toISOString();
      payload.approved_by = userEmail;
      payload.approval_comments = "Change approved.";
    }
    if (status === "implementation") payload.actual_implementation_date = new Date().toISOString().slice(0, 10);
    if (status === "closed") {
      if (!closureEligible) return alert("Cannot close change. Implementation tasks, linked effective documents, and required training must be complete.");
      payload.closed_at = new Date().toISOString();
      payload.closed_by = userEmail;
      payload.documents_effective = documentsEffective;
      payload.training_complete = trainingComplete;
      payload.implementation_complete = implementationComplete;
      payload.closure_block_reason = null;
    }

    const { error } = await supabase.from("change_controls").update(payload).eq("id", change.id);
    if (error) return alert(error.message);
    fetchData();
  };

  if (loading) return <main style={pageStyle}>Loading Change Workflow...</main>;
  if (!change) return <main style={pageStyle}><h1>Change not found</h1><a href="/change-control">Back to Change Control</a></main>;

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>CHANGE WORKFLOW</div>
          <h1 style={{ margin: "6px 0" }}>{change.change_number || "Change"} — {change.change_title}</h1>
          <p style={subtleText}>{change.change_description}</p>
        </div>
        <div style={buttonRowStyle}><a href="/change-control" style={secondaryLinkStyle}>Back to Change Control</a><a href="/dashboard" style={darkButtonStyle}>Dashboard</a></div>
      </header>

      <section style={kpiGridStyle}>
        <KpiCard title="Implementation Complete" value={implementationComplete ? "Yes" : "No"} color={implementationComplete ? "#15803d" : "#dc2626"} />
        <KpiCard title="Documents Effective" value={documentsEffective ? "Yes" : "No"} color={documentsEffective ? "#15803d" : "#dc2626"} />
        <KpiCard title="Training Complete" value={trainingComplete ? "Yes" : "No"} color={trainingComplete ? "#15803d" : "#dc2626"} />
        <KpiCard title="Closure Eligible" value={closureEligible ? "Yes" : "No"} color={closureEligible ? "#15803d" : "#dc2626"} />
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Workflow Actions</h2>
        <div style={buttonRowStyle}>
          {change.status === "draft" ? <button onClick={() => updateStatus("pending_approval")}>Submit for Approval</button> : null}
          {change.status === "pending_approval" ? <button onClick={() => updateStatus("approved")}>Approve Change</button> : null}
          {change.status === "approved" ? <button onClick={() => updateStatus("implementation")}>Start Implementation</button> : null}
          {change.status === "implementation" ? <button onClick={() => updateStatus("closed")}>Close Change</button> : null}
          <StatusBadge status={change.status || "draft"} />
        </div>
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Change Details</h2>
        <div style={gridStyle}>
          <Detail label="Type" value={change.change_type || "N/A"} />
          <Detail label="Category" value={change.change_category || "N/A"} />
          <Detail label="Priority" value={change.priority || "N/A"} />
          <Detail label="Risk Level" value={change.risk_level || "N/A"} />
          <Detail label="Owner" value={change.owner_email || "N/A"} />
          <Detail label="Approver" value={change.approver_email || "N/A"} />
        </div>
        <h3>Justification / Rationale</h3><p>{change.change_justification}</p>
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Affected / New Documents</h2>
        <div style={gridStyle}>
          <input placeholder="Document Number" value={newDoc.document_number} onChange={(e) => setNewDoc({ ...newDoc, document_number: e.target.value })} style={inputStyle} />
          <input placeholder="Document Title" value={newDoc.document_title} onChange={(e) => setNewDoc({ ...newDoc, document_title: e.target.value })} style={inputStyle} />
          <input placeholder="Current Revision" value={newDoc.current_revision} onChange={(e) => setNewDoc({ ...newDoc, current_revision: e.target.value })} style={inputStyle} />
          <input placeholder="Proposed Revision" value={newDoc.proposed_revision} onChange={(e) => setNewDoc({ ...newDoc, proposed_revision: e.target.value })} style={inputStyle} />
        </div>
        <textarea placeholder="Document change description" value={newDoc.change_description} onChange={(e) => setNewDoc({ ...newDoc, change_description: e.target.value })} rows={3} style={textareaStyle} />
        <label><input type="checkbox" checked={newDoc.training_required} onChange={(e) => setNewDoc({ ...newDoc, training_required: e.target.checked })} /> Training Required</label>
        <div style={{ marginTop: "10px" }}><button onClick={addDocument} style={primaryButtonStyle}>Add Document to Change</button></div>
        <ul>{documents.map((doc) => { const linkedDoc = controlledDocuments.find((cd) => cd.id === doc.controlled_document_id); return <li key={doc.id} style={listCardStyle}><strong>{doc.document_number}</strong> Rev {doc.current_revision || "N/A"} → {doc.proposed_revision || "N/A"}<div>{doc.document_title}</div><div style={smallTextStyle}>Controlled Document Status: {linkedDoc?.status || doc.document_status || "Not Created"}</div><div style={smallTextStyle}>Training Required: {doc.training_required ? "Yes" : "No"}</div>{!doc.controlled_document_id ? <button onClick={() => createControlledDocumentFromChange(doc)}>Create Controlled Document</button> : linkedDoc ? <a href="/documents" style={primaryLinkStyle}>Open Document Register</a> : null}</li>; })}</ul>
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Affected Products</h2>
        <div style={gridStyle}><input placeholder="Part Number" value={newProduct.product_part_number} onChange={(e) => setNewProduct({ ...newProduct, product_part_number: e.target.value })} style={inputStyle} /><input placeholder="Product Name" value={newProduct.product_name} onChange={(e) => setNewProduct({ ...newProduct, product_name: e.target.value })} style={inputStyle} /><input placeholder="Lot / Serial Scope" value={newProduct.lot_or_serial_scope} onChange={(e) => setNewProduct({ ...newProduct, lot_or_serial_scope: e.target.value })} style={inputStyle} /></div>
        <textarea placeholder="Impact Description" value={newProduct.impact_description} onChange={(e) => setNewProduct({ ...newProduct, impact_description: e.target.value })} rows={3} style={textareaStyle} />
        <button onClick={addProduct} style={primaryButtonStyle}>Add Product</button>
        <ul>{products.map((product) => <li key={product.id} style={listCardStyle}><strong>{product.product_part_number}</strong> — {product.product_name}<div style={smallTextStyle}>{product.impact_description}</div></li>)}</ul>
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Implementation Tasks</h2>
        <div style={gridStyle}><input placeholder="Task Title" value={newTask.task_title} onChange={(e) => setNewTask({ ...newTask, task_title: e.target.value })} style={inputStyle} /><input placeholder="Owner Email" value={newTask.owner_email} onChange={(e) => setNewTask({ ...newTask, owner_email: e.target.value })} style={inputStyle} /><input type="date" value={newTask.due_date} onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })} style={inputStyle} /></div>
        <textarea placeholder="Task Description" value={newTask.task_description} onChange={(e) => setNewTask({ ...newTask, task_description: e.target.value })} rows={3} style={textareaStyle} />
        <button onClick={addTask} style={primaryButtonStyle}>Add Task</button>
        <ul>{tasks.map((task) => <li key={task.id} style={listCardStyle}><strong>{task.task_title}</strong> — {task.owner_email}<div style={smallTextStyle}>Status: {task.status}</div><div style={smallTextStyle}>Due: {task.due_date || "N/A"}</div>{task.status !== "complete" ? <button onClick={() => completeTask(task.id)}>Complete</button> : null}</li>)}</ul>
      </section>
    </main>
  );
}

function Detail({ label, value }: { label: string; value: string }) { return <div style={detailTileStyle}><div style={smallTextStyle}>{label}</div><strong>{value}</strong></div>; }
function KpiCard({ title, value, color }: { title: string; value: string; color: string }) { return <div style={{ ...kpiCardStyle, borderLeft: `8px solid ${color}` }}><div style={kpiTitleStyle}>{title}</div><div style={{ fontSize: "24px", fontWeight: 800, color }}>{value}</div></div>; }
function StatusBadge({ status }: { status: string }) { const color = status === "closed" ? "#15803d" : status === "implementation" ? "#2563eb" : status === "approved" ? "#2563eb" : status === "pending_approval" ? "#d97706" : "#6b7280"; return <span style={{ background: color, color: "white", borderRadius: "999px", padding: "3px 8px", fontSize: "12px", fontWeight: 700 }}>{status}</span>; }

const pageStyle: React.CSSProperties = { padding: "24px", background: "#f8fafc", minHeight: "100vh", fontFamily: "Arial, sans-serif" };
const headerStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-start", flexWrap: "wrap", marginBottom: "20px" };
const eyebrowStyle: React.CSSProperties = { fontSize: "12px", letterSpacing: "0.08em", color: "#6b7280", fontWeight: 800 };
const subtleText: React.CSSProperties = { color: "#6b7280" };
const cardStyle: React.CSSProperties = { background: "white", border: "1px solid #d1d5db", borderRadius: "16px", padding: "20px", marginBottom: "20px" };
const gridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "14px" };
const kpiGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px", marginBottom: "20px" };
const kpiCardStyle: React.CSSProperties = { background: "white", border: "1px solid #d1d5db", borderRadius: "14px", padding: "16px" };
const kpiTitleStyle: React.CSSProperties = { color: "#6b7280", marginBottom: "8px" };
const inputStyle: React.CSSProperties = { width: "100%", padding: "9px", borderRadius: "8px", border: "1px solid #d1d5db" };
const textareaStyle: React.CSSProperties = { width: "100%", padding: "9px", borderRadius: "8px", border: "1px solid #d1d5db", marginTop: "10px" };
const primaryButtonStyle: React.CSSProperties = { background: "#2563eb", color: "white", border: "none", padding: "10px 14px", borderRadius: "8px", fontWeight: 700, cursor: "pointer" };
const primaryLinkStyle: React.CSSProperties = { display: "inline-block", background: "#2563eb", color: "white", padding: "8px 12px", borderRadius: "8px", textDecoration: "none", fontWeight: 700, marginTop: "8px" };
const secondaryLinkStyle: React.CSSProperties = { display: "inline-block", background: "#15803d", color: "white", padding: "10px 14px", borderRadius: "8px", textDecoration: "none", fontWeight: 700 };
const darkButtonStyle: React.CSSProperties = { background: "#111827", color: "white", padding: "10px 14px", borderRadius: "8px", textDecoration: "none", fontWeight: 700 };
const buttonRowStyle: React.CSSProperties = { display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" };
const listCardStyle: React.CSSProperties = { border: "1px solid #d1d5db", borderRadius: "12px", padding: "12px", marginBottom: "10px", background: "#f9fafb" };
const detailTileStyle: React.CSSProperties = { background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "12px" };
const smallTextStyle: React.CSSProperties = { fontSize: "12px", color: "#6b7280" };
