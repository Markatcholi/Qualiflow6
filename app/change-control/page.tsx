"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

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
  initiator_email: string | null;
  owner_email: string | null;
  approver_email: string | null;
  affected_process: string | null;
  affected_equipment: string | null;
  affected_supplier: string | null;
  affected_software: string | null;
  impact_assessment: string | null;
  product_impact: boolean | null;
  document_impact: boolean | null;
  process_impact: boolean | null;
  equipment_impact: boolean | null;
  supplier_impact: boolean | null;
  software_impact: boolean | null;
  regulatory_impact: boolean | null;
  validation_impact: boolean | null;
  training_impact: boolean | null;
  risk_level: string | null;
  risk_review_summary: string | null;
  risk_acceptability: string | null;
  residual_risk: string | null;
  implementation_plan: string | null;
  implementation_owner_email: string | null;
  target_implementation_date: string | null;
  actual_implementation_date: string | null;
  verification_plan: string | null;
  verification_result: string | null;
  effectiveness_required: boolean | null;
  effectiveness_plan: string | null;
  effectiveness_result: string | null;
  approval_comments: string | null;
  closure_summary: string | null;
  created_at: string | null;
};

const CHANGE_TYPES = ["ECO", "Process", "Document", "Supplier", "Software", "Equipment", "Material", "Other"];
const CATEGORIES = ["Design", "Manufacturing", "Quality System", "Supplier", "Regulatory", "Validation", "Document", "Other"];
const PRIORITIES = ["Low", "Medium", "High", "Critical"];
const RISKS = ["Low", "Medium", "High", "Critical"];

export default function ChangeControlPage() {
  const [changes, setChanges] = useState<ChangeControl[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [controlledDocuments, setControlledDocuments] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState("");
  const [selectedChangeId, setSelectedChangeId] = useState("");

  const [newChange, setNewChange] = useState({
    change_title: "",
    change_description: "",
    change_justification: "",
    change_type: "ECO",
    change_category: "Process",
    priority: "Medium",
    owner_email: "",
    approver_email: "",
    affected_process: "",
    affected_equipment: "",
    affected_supplier: "",
    affected_software: "",
    impact_assessment: "",
    product_impact: false,
    document_impact: false,
    process_impact: false,
    equipment_impact: false,
    supplier_impact: false,
    software_impact: false,
    regulatory_impact: false,
    validation_impact: false,
    training_impact: false,
    risk_level: "Medium",
    risk_review_summary: "",
    risk_acceptability: "",
    residual_risk: "",
    implementation_plan: "",
    implementation_owner_email: "",
    target_implementation_date: "",
    verification_plan: "",
    effectiveness_required: false,
    effectiveness_plan: "",
  });

  const [newDoc, setNewDoc] = useState({
    document_number: "",
    document_title: "",
    current_revision: "",
    proposed_revision: "",
    change_description: "",
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

  const [filterStatus, setFilterStatus] = useState("all");

  const canApprove =
    userRole === "admin" || userRole === "approver" || userRole === "vp_quality";

  const selectedChange = changes.find((c) => c.id === selectedChangeId) || null;

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
    setLoading(true);
    await fetchUser();

    const changeRes = await supabase
      .from("change_controls")
      .select("*")
      .order("created_at", { ascending: false });

    const docRes = await supabase
      .from("change_control_documents")
      .select("*")
      .order("created_at", { ascending: false });

    const productRes = await supabase
      .from("change_control_products")
      .select("*")
      .order("created_at", { ascending: false });

    const taskRes = await supabase
      .from("change_control_tasks")
      .select("*")
      .order("created_at", { ascending: false });

    if (changeRes.error) alert(changeRes.error.message);
    else setChanges((changeRes.data as ChangeControl[]) || []);

    if (!docRes.error) setDocuments(docRes.data || []);
    if (!productRes.error) setProducts(productRes.data || []);
    if (!taskRes.error) setTasks(taskRes.data || []);

    const controlledDocRes = await supabase
      .from("controlled_documents")
      .select("*")
      .order("created_at", { ascending: false });

    if (!controlledDocRes.error) {
      setControlledDocuments(controlledDocRes.data || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredChanges = useMemo(() => {
    return changes.filter((change) => {
      return filterStatus === "all" || change.status === filterStatus;
    });
  }, [changes, filterStatus]);

  const metrics = useMemo(() => {
    return {
      total: changes.length,
      draft: changes.filter((c) => c.status === "draft").length,
      pending: changes.filter((c) => c.status === "pending_approval").length,
      approved: changes.filter((c) => c.status === "approved").length,
      implementation: changes.filter((c) => c.status === "implementation").length,
      closed: changes.filter((c) => c.status === "closed").length,
      highRisk: changes.filter((c) => c.risk_level === "High" || c.risk_level === "Critical").length,
      openTasks: tasks.filter((t) => t.status !== "complete").length,
    };
  }, [changes, tasks]);

  const normalizeEmail = (value: string) => {
    const text = String(value || "").trim().toLowerCase();
    if (!text || !text.includes("@")) return "";
    return text;
  };

  
  const selectedDocuments = documents.filter(
    (d) => d.change_control_id === selectedChangeId
  );

  const selectedTasks = tasks.filter(
    (t) => t.change_control_id === selectedChangeId
  );

  const implementationComplete =
    selectedTasks.length > 0 &&
    selectedTasks.every((t) => t.status === "complete");

  const linkedControlledDocuments = selectedDocuments
    .map((doc) =>
      controlledDocuments.find(
        (cd) => cd.id === doc.controlled_document_id
      )
    )
    .filter(Boolean);

  const documentsEffective =
    linkedControlledDocuments.length > 0 &&
    linkedControlledDocuments.every(
      (doc: any) => doc.status === "effective"
    );

  const trainingComplete =
    selectedDocuments.length > 0 &&
    selectedDocuments.every(
      (doc) =>
        !doc.training_required ||
        doc.training_completed
    );

  const closureEligible =
    implementationComplete &&
    documentsEffective &&
    trainingComplete;

  const createControlledDocumentFromChange = async (
    linkedDoc: any
  ) => {
    if (!selectedChange) {
      alert("Select a change first.");
      return;
    }

    const { data, error } = await supabase
      .from("controlled_documents")
      .insert({
        document_number: linkedDoc.document_number,
        title: linkedDoc.document_title,
        revision: linkedDoc.proposed_revision || "A",
        status: "draft",
        originating_change_control_id: selectedChange.id,
        owner_email:
          selectedChange.owner_email || userEmail || null,
      })
      .select()
      .single();

    if (error) {
      alert(error.message);
      return;
    }

    await supabase
      .from("change_control_documents")
      .update({
        controlled_document_id: data.id,
        document_status: "draft",
      })
      .eq("id", linkedDoc.id);

    alert("Controlled document created successfully.");

    fetchData();
  };


  const createChange = async () => {
    if (!newChange.change_title.trim()) return alert("Change title is required.");
    if (!newChange.change_description.trim()) return alert("Change description is required.");
    if (!newChange.change_justification.trim()) return alert("Change justification is required.");

    if (newChange.owner_email && !normalizeEmail(newChange.owner_email)) {
      return alert("Owner email must be valid.");
    }

    if (newChange.approver_email && !normalizeEmail(newChange.approver_email)) {
      return alert("Approver email must be valid.");
    }

    const changeNumber = `CC-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

    const { error } = await supabase.from("change_controls").insert({
      change_number: changeNumber,
      ...newChange,
      initiator_email: userEmail || null,
      owner_email: normalizeEmail(newChange.owner_email) || userEmail || null,
      approver_email: normalizeEmail(newChange.approver_email) || null,
      implementation_owner_email:
        normalizeEmail(newChange.implementation_owner_email) || null,
      status: "draft",
      created_by: userEmail || "unknown",
    });

    if (error) return alert(error.message);

    setNewChange({
      change_title: "",
      change_description: "",
      change_justification: "",
      change_type: "ECO",
      change_category: "Process",
      priority: "Medium",
      owner_email: "",
      approver_email: "",
      affected_process: "",
      affected_equipment: "",
      affected_supplier: "",
      affected_software: "",
      impact_assessment: "",
      product_impact: false,
      document_impact: false,
      process_impact: false,
      equipment_impact: false,
      supplier_impact: false,
      software_impact: false,
      regulatory_impact: false,
      validation_impact: false,
      training_impact: false,
      risk_level: "Medium",
      risk_review_summary: "",
      risk_acceptability: "",
      residual_risk: "",
      implementation_plan: "",
      implementation_owner_email: "",
      target_implementation_date: "",
      verification_plan: "",
      effectiveness_required: false,
      effectiveness_plan: "",
    });

    fetchData();
  };

  const updateStatus = async (change: ChangeControl, status: string) => {
    const payload: any = {
      status,
      updated_at: new Date().toISOString(),
    };

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

    if (status === "implementation") {
      payload.actual_implementation_date = new Date().toISOString().slice(0, 10);
    }

    if (status === "closed") {
      payload.closed_at = new Date().toISOString();
      payload.closed_by = userEmail;
    }

    const { error } = await supabase
      .from("change_controls")
      .update(payload)
      .eq("id", change.id);

    if (error) return alert(error.message);

    fetchData();
  };

  const addDocument = async () => {
    if (!selectedChangeId) return alert("Select a change first.");
    if (!newDoc.document_number.trim()) return alert("Document number is required.");

    const { error } = await supabase.from("change_control_documents").insert({
      change_control_id: selectedChangeId,
      ...newDoc,
    });

    if (error) return alert(error.message);

    setNewDoc({
      document_number: "",
      document_title: "",
      current_revision: "",
      proposed_revision: "",
      change_description: "",
    });
    fetchData();
  };

  const addProduct = async () => {
    if (!selectedChangeId) return alert("Select a change first.");
    if (!newProduct.product_part_number.trim()) return alert("Product part number is required.");

    const { error } = await supabase.from("change_control_products").insert({
      change_control_id: selectedChangeId,
      ...newProduct,
    });

    if (error) return alert(error.message);

    setNewProduct({
      product_part_number: "",
      product_name: "",
      lot_or_serial_scope: "",
      impact_description: "",
    });
    fetchData();
  };

  const addTask = async () => {
    if (!selectedChangeId) return alert("Select a change first.");
    if (!newTask.task_title.trim()) return alert("Task title is required.");
    if (!normalizeEmail(newTask.owner_email)) return alert("Task owner email is required.");

    const { error } = await supabase.from("change_control_tasks").insert({
      change_control_id: selectedChangeId,
      ...newTask,
      owner_email: normalizeEmail(newTask.owner_email),
      status: "open",
      created_by: userEmail || "unknown",
    });

    if (error) return alert(error.message);

    setNewTask({
      task_title: "",
      task_description: "",
      owner_email: "",
      due_date: "",
    });
    fetchData();
  };

  const completeTask = async (id: string) => {
    const { error } = await supabase
      .from("change_control_tasks")
      .update({
        status: "complete",
        completed_at: new Date().toISOString(),
        completed_by: userEmail,
      })
      .eq("id", id);

    if (error) return alert(error.message);
    fetchData();
  };

  if (loading) return <main style={pageStyle}>Loading Change Control...</main>;

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>CHANGE CONTROL / ECO</div>
          <h1 style={{ margin: "6px 0" }}>Change Control</h1>
          <p style={subtleText}>
            Manage change requests, impact assessment, affected documents/products,
            risk review, approvals, implementation tracking, and closure.
          </p>
        </div>

        <a href="/dashboard" style={darkButtonStyle}>
          Dashboard
        </a>
      </header>

      <section style={kpiGridStyle}>
        <KpiCard title="Total Changes" value={metrics.total} color="#2563eb" />
        <KpiCard title="Pending Approval" value={metrics.pending} color="#d97706" />
        <KpiCard title="Implementation" value={metrics.implementation} color="#2563eb" />
        <KpiCard title="Closed" value={metrics.closed} color="#15803d" />
        <KpiCard title="High/Critical Risk" value={metrics.highRisk} color="#dc2626" />
        <KpiCard title="Open Tasks" value={metrics.openTasks} color="#d97706" />
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Initiate Change Request</h2>

        <div style={gridStyle}>
          <Field label="Change Title">
            <input value={newChange.change_title} onChange={(e) => setNewChange({ ...newChange, change_title: e.target.value })} style={inputStyle} />
          </Field>

          <Field label="Change Type">
            <select value={newChange.change_type} onChange={(e) => setNewChange({ ...newChange, change_type: e.target.value })} style={inputStyle}>
              {CHANGE_TYPES.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </Field>

          <Field label="Change Category">
            <select value={newChange.change_category} onChange={(e) => setNewChange({ ...newChange, change_category: e.target.value })} style={inputStyle}>
              {CATEGORIES.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </Field>

          <Field label="Priority">
            <select value={newChange.priority} onChange={(e) => setNewChange({ ...newChange, priority: e.target.value })} style={inputStyle}>
              {PRIORITIES.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </Field>

          <Field label="Owner Email">
            <input type="email" value={newChange.owner_email} onChange={(e) => setNewChange({ ...newChange, owner_email: e.target.value })} style={inputStyle} />
          </Field>

          <Field label="Approver Email">
            <input type="email" value={newChange.approver_email} onChange={(e) => setNewChange({ ...newChange, approver_email: e.target.value })} style={inputStyle} />
          </Field>
        </div>

        <Field label="Change Description">
          <textarea value={newChange.change_description} onChange={(e) => setNewChange({ ...newChange, change_description: e.target.value })} rows={4} style={textareaStyle} />
        </Field>

        <Field label="Change Justification / Business Need">
          <textarea value={newChange.change_justification} onChange={(e) => setNewChange({ ...newChange, change_justification: e.target.value })} rows={4} style={textareaStyle} />
        </Field>

        <div style={gridStyle}>
          <Field label="Affected Process">
            <input value={newChange.affected_process} onChange={(e) => setNewChange({ ...newChange, affected_process: e.target.value })} style={inputStyle} />
          </Field>
          <Field label="Affected Equipment">
            <input value={newChange.affected_equipment} onChange={(e) => setNewChange({ ...newChange, affected_equipment: e.target.value })} style={inputStyle} />
          </Field>
          <Field label="Affected Supplier">
            <input value={newChange.affected_supplier} onChange={(e) => setNewChange({ ...newChange, affected_supplier: e.target.value })} style={inputStyle} />
          </Field>
          <Field label="Affected Software">
            <input value={newChange.affected_software} onChange={(e) => setNewChange({ ...newChange, affected_software: e.target.value })} style={inputStyle} />
          </Field>
        </div>

        <section style={subCardStyle}>
          <h3 style={{ marginTop: 0 }}>Impact Assessment</h3>
          <div style={checkboxGridStyle}>
            {[
              ["product_impact", "Product"],
              ["document_impact", "Document"],
              ["process_impact", "Process"],
              ["equipment_impact", "Equipment"],
              ["supplier_impact", "Supplier"],
              ["software_impact", "Software"],
              ["regulatory_impact", "Regulatory"],
              ["validation_impact", "Validation"],
              ["training_impact", "Training"],
            ].map(([key, label]) => (
              <label key={key}>
                <input
                  type="checkbox"
                  checked={(newChange as any)[key]}
                  onChange={(e) => setNewChange({ ...newChange, [key]: e.target.checked } as any)}
                />{" "}
                {label}
              </label>
            ))}
          </div>

          <Field label="Impact Assessment Summary">
            <textarea value={newChange.impact_assessment} onChange={(e) => setNewChange({ ...newChange, impact_assessment: e.target.value })} rows={4} style={textareaStyle} />
          </Field>
        </section>

        <section style={subCardStyle}>
          <h3 style={{ marginTop: 0 }}>Risk Review</h3>
          <div style={gridStyle}>
            <Field label="Risk Level">
              <select value={newChange.risk_level} onChange={(e) => setNewChange({ ...newChange, risk_level: e.target.value })} style={inputStyle}>
                {RISKS.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </Field>
            <Field label="Risk Acceptability">
              <input value={newChange.risk_acceptability} onChange={(e) => setNewChange({ ...newChange, risk_acceptability: e.target.value })} style={inputStyle} />
            </Field>
            <Field label="Residual Risk">
              <input value={newChange.residual_risk} onChange={(e) => setNewChange({ ...newChange, residual_risk: e.target.value })} style={inputStyle} />
            </Field>
          </div>
          <Field label="Risk Review Summary">
            <textarea value={newChange.risk_review_summary} onChange={(e) => setNewChange({ ...newChange, risk_review_summary: e.target.value })} rows={4} style={textareaStyle} />
          </Field>
        </section>

        <section style={subCardStyle}>
          <h3 style={{ marginTop: 0 }}>Implementation / Verification</h3>
          <div style={gridStyle}>
            <Field label="Implementation Owner Email">
              <input type="email" value={newChange.implementation_owner_email} onChange={(e) => setNewChange({ ...newChange, implementation_owner_email: e.target.value })} style={inputStyle} />
            </Field>
            <Field label="Target Implementation Date">
              <input type="date" value={newChange.target_implementation_date} onChange={(e) => setNewChange({ ...newChange, target_implementation_date: e.target.value })} style={inputStyle} />
            </Field>
          </div>
          <Field label="Implementation Plan">
            <textarea value={newChange.implementation_plan} onChange={(e) => setNewChange({ ...newChange, implementation_plan: e.target.value })} rows={4} style={textareaStyle} />
          </Field>
          <Field label="Verification Plan">
            <textarea value={newChange.verification_plan} onChange={(e) => setNewChange({ ...newChange, verification_plan: e.target.value })} rows={4} style={textareaStyle} />
          </Field>
          <label>
            <input type="checkbox" checked={newChange.effectiveness_required} onChange={(e) => setNewChange({ ...newChange, effectiveness_required: e.target.checked })} /> Effectiveness Check Required
          </label>
          <Field label="Effectiveness Plan">
            <textarea value={newChange.effectiveness_plan} onChange={(e) => setNewChange({ ...newChange, effectiveness_plan: e.target.value })} rows={3} style={textareaStyle} />
          </Field>
        </section>

        <button onClick={createChange} style={primaryButtonStyle}>Create Change Request</button>
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Change Register</h2>
        <div style={filterRowStyle}>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={inputStyle}>
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="pending_approval">Pending Approval</option>
            <option value="approved">Approved</option>
            <option value="implementation">Implementation</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Change</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Priority</th>
                <th style={thStyle}>Risk</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Owner</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredChanges.map((change) => (
                <tr key={change.id}>
                  <td style={tdStyle}>
                    <button onClick={() => setSelectedChangeId(change.id)} style={linkButtonStyle}>
                      {change.change_number || change.id}
                    </button>
                    <div><strong>{change.change_title}</strong></div>
                    <div style={smallTextStyle}>{change.change_description}</div>
                  </td>
                  <td style={tdStyle}>{change.change_type}</td>
                  <td style={tdStyle}>{change.priority}</td>
                  <td style={tdStyle}>{change.risk_level}</td>
                  <td style={tdStyle}><StatusBadge status={change.status || "draft"} /></td>
                  <td style={tdStyle}>{change.owner_email || "N/A"}</td>
                  <td style={tdStyle}>
                    <div style={actionStackStyle}>
                      {change.status === "draft" ? <button onClick={() => updateStatus(change, "pending_approval")}>Submit Approval</button> : null}
                      {change.status === "pending_approval" ? <button onClick={() => updateStatus(change, "approved")}>Approve</button> : null}
                      {change.status === "approved" ? <button onClick={() => updateStatus(change, "implementation")}>Start Implementation</button> : null}
                      {change.status === "implementation" ? (
                        <button
                          onClick={() => {
                            if (
                              selectedChangeId === change.id &&
                              !closureEligible
                            ) {
                              alert(
                                "Cannot close change until implementation, effective documents, and training are complete."
                              );
                              return;
                            }

                            updateStatus(change, "closed");
                          }}
                        >
                          Close
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {selectedChange ? (
        <section style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Selected Change Detail</h2>
          <p><strong>{selectedChange.change_number}</strong> — {selectedChange.change_title}</p>

          <div style={gridStyle}>
            
            <section style={subCardStyle}>
              <h3>Governance Status</h3>

              <div style={{ marginBottom: "8px" }}>
                <strong>Implementation Complete:</strong>{" "}
                {implementationComplete ? "Yes" : "No"}
              </div>

              <div style={{ marginBottom: "8px" }}>
                <strong>Documents Effective:</strong>{" "}
                {documentsEffective ? "Yes" : "No"}
              </div>

              <div style={{ marginBottom: "8px" }}>
                <strong>Training Complete:</strong>{" "}
                {trainingComplete ? "Yes" : "No"}
              </div>

              <div style={{ marginBottom: "8px" }}>
                <strong>Closure Eligible:</strong>{" "}
                {closureEligible ? "Yes" : "No"}
              </div>
            </section>

<section style={subCardStyle}>
              <h3>Affected Documents</h3>
              <input placeholder="Document Number" value={newDoc.document_number} onChange={(e) => setNewDoc({ ...newDoc, document_number: e.target.value })} style={inputStyle} />
              <input placeholder="Document Title" value={newDoc.document_title} onChange={(e) => setNewDoc({ ...newDoc, document_title: e.target.value })} style={inputStyle} />
              <input placeholder="Current Revision" value={newDoc.current_revision} onChange={(e) => setNewDoc({ ...newDoc, current_revision: e.target.value })} style={inputStyle} />
              <input placeholder="Proposed Revision" value={newDoc.proposed_revision} onChange={(e) => setNewDoc({ ...newDoc, proposed_revision: e.target.value })} style={inputStyle} />
              <textarea placeholder="Change Description" value={newDoc.change_description} onChange={(e) => setNewDoc({ ...newDoc, change_description: e.target.value })} rows={3} style={textareaStyle} />
              <button onClick={addDocument}>Add Document</button>
              <ul>
                {documents
                  .filter((d) => d.change_control_id === selectedChange.id)
                  .map((d) => {
                    const linkedControlledDoc = controlledDocuments.find(
                      (cd) => cd.id === d.controlled_document_id
                    );

                    return (
                      <li key={d.id} style={{ marginBottom: "10px" }}>
                        <div>
                          <strong>{d.document_number}</strong> Rev {d.current_revision} → {d.proposed_revision}
                        </div>

                        <div style={smallTextStyle}>
                          Controlled Document Status:{" "}
                          {linkedControlledDoc?.status || d.document_status || "Not Created"}
                        </div>

                        <div style={smallTextStyle}>
                          Training Required: {d.training_required ? "Yes" : "No"}
                        </div>

                        <div style={smallTextStyle}>
                          Training Complete: {d.training_completed ? "Yes" : "No"}
                        </div>

                        {!d.controlled_document_id ? (
                          <button
                            onClick={() =>
                              createControlledDocumentFromChange(d)
                            }
                          >
                            Create Controlled Document
                          </button>
                        ) : null}
                      </li>
                    );
                  })}
              </ul>
            </section>

            <section style={subCardStyle}>
              <h3>Affected Products</h3>
              <input placeholder="Part Number" value={newProduct.product_part_number} onChange={(e) => setNewProduct({ ...newProduct, product_part_number: e.target.value })} style={inputStyle} />
              <input placeholder="Product Name" value={newProduct.product_name} onChange={(e) => setNewProduct({ ...newProduct, product_name: e.target.value })} style={inputStyle} />
              <input placeholder="Lot / Serial Scope" value={newProduct.lot_or_serial_scope} onChange={(e) => setNewProduct({ ...newProduct, lot_or_serial_scope: e.target.value })} style={inputStyle} />
              <textarea placeholder="Impact Description" value={newProduct.impact_description} onChange={(e) => setNewProduct({ ...newProduct, impact_description: e.target.value })} rows={3} style={textareaStyle} />
              <button onClick={addProduct}>Add Product</button>
              <ul>{products.filter((p) => p.change_control_id === selectedChange.id).map((p) => <li key={p.id}>{p.product_part_number} — {p.product_name}</li>)}</ul>
            </section>

            <section style={subCardStyle}>
              <h3>Implementation Tasks</h3>
              <input placeholder="Task Title" value={newTask.task_title} onChange={(e) => setNewTask({ ...newTask, task_title: e.target.value })} style={inputStyle} />
              <input placeholder="Owner Email" value={newTask.owner_email} onChange={(e) => setNewTask({ ...newTask, owner_email: e.target.value })} style={inputStyle} />
              <input type="date" value={newTask.due_date} onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })} style={inputStyle} />
              <textarea placeholder="Task Description" value={newTask.task_description} onChange={(e) => setNewTask({ ...newTask, task_description: e.target.value })} rows={3} style={textareaStyle} />
              <button onClick={addTask}>Add Task</button>
              <ul>{tasks.filter((t) => t.change_control_id === selectedChange.id).map((t) => <li key={t.id}>{t.task_title} — {t.owner_email} — {t.status} {t.status !== "complete" ? <button onClick={() => completeTask(t.id)}>Complete</button> : null}</li>)}</ul>
            </section>
          </div>
        </section>
      ) : null}
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "12px" }}>
      <label style={labelStyle}>{label}</label>
      <div style={{ marginTop: "5px" }}>{children}</div>
    </div>
  );
}

function KpiCard({ title, value, color }: { title: string; value: number; color: string }) {
  return (
    <div style={{ ...kpiCardStyle, borderLeft: `8px solid ${color}` }}>
      <div style={kpiTitleStyle}>{title}</div>
      <div style={{ fontSize: "30px", fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "closed" ? "#15803d" :
    status === "implementation" ? "#2563eb" :
    status === "approved" ? "#2563eb" :
    status === "pending_approval" ? "#d97706" :
    "#6b7280";

  return <span style={{ background: color, color: "white", borderRadius: "999px", padding: "3px 8px", fontSize: "12px", fontWeight: 700 }}>{status}</span>;
}

const pageStyle: React.CSSProperties = { padding: "24px", background: "#f8fafc", minHeight: "100vh", fontFamily: "Arial, sans-serif" };
const headerStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-start", flexWrap: "wrap", marginBottom: "20px" };
const eyebrowStyle: React.CSSProperties = { fontSize: "12px", letterSpacing: "0.08em", color: "#6b7280", fontWeight: 800 };
const subtleText: React.CSSProperties = { color: "#6b7280" };
const cardStyle: React.CSSProperties = { background: "white", border: "1px solid #d1d5db", borderRadius: "16px", padding: "20px", marginBottom: "20px" };
const subCardStyle: React.CSSProperties = { background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "14px", marginBottom: "14px" };
const gridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "14px" };
const checkboxGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "8px", marginBottom: "12px" };
const kpiGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px", marginBottom: "20px" };
const kpiCardStyle: React.CSSProperties = { background: "white", border: "1px solid #d1d5db", borderRadius: "14px", padding: "16px" };
const kpiTitleStyle: React.CSSProperties = { color: "#6b7280", marginBottom: "8px" };
const labelStyle: React.CSSProperties = { fontWeight: 700 };
const inputStyle: React.CSSProperties = { width: "100%", padding: "9px", borderRadius: "8px", border: "1px solid #d1d5db" };
const textareaStyle: React.CSSProperties = { width: "100%", padding: "9px", borderRadius: "8px", border: "1px solid #d1d5db", marginTop: "6px" };
const primaryButtonStyle: React.CSSProperties = { background: "#2563eb", color: "white", border: "none", padding: "10px 14px", borderRadius: "8px", fontWeight: 700, cursor: "pointer" };
const darkButtonStyle: React.CSSProperties = { background: "#111827", color: "white", padding: "10px 14px", borderRadius: "8px", textDecoration: "none", fontWeight: 700 };
const filterRowStyle: React.CSSProperties = { maxWidth: "260px", marginBottom: "14px" };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse" };
const thStyle: React.CSSProperties = { textAlign: "left", borderBottom: "1px solid #d1d5db", padding: "10px" };
const tdStyle: React.CSSProperties = { borderBottom: "1px solid #e5e7eb", padding: "10px", verticalAlign: "top" };
const actionStackStyle: React.CSSProperties = { display: "grid", gap: "8px" };
const smallTextStyle: React.CSSProperties = { fontSize: "12px", color: "#6b7280" };
const linkButtonStyle: React.CSSProperties = { background: "transparent", border: "none", color: "#2563eb", padding: 0, cursor: "pointer", fontWeight: 700 };
