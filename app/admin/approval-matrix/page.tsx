"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type ApprovalMatrixTemplate = {
  id: string;
  template_name: string;
  module_name: string;
  description: string | null;
  active: boolean | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type ApprovalMatrixReviewer = {
  id: string;
  template_id: string;
  reviewer_type: string;
  approver_function: string | null;
  reviewer_role: string | null;
  reviewer_email: string | null;
  required_reviewer: boolean | null;
  sequence_order: number | null;
  active: boolean | null;
  created_at: string | null;
};

const MODULE_OPTIONS = [
  "documents",
  "change_control",
  "capa",
  "audit",
  "training",
  "ncmr",
  "management_review",
];

const REVIEWER_TYPES = ["collaboration", "formal_review", "approver"];

const FUNCTION_OPTIONS = [
  "Quality",
  "Quality Systems",
  "Supplier Quality",
  "Manufacturing",
  "Operations",
  "Engineering",
  "Validation",
  "Regulatory",
  "Clinical",
  "Training",
  "Management",
  "Executive",
  "Other",
];

export default function ApprovalMatrixAdminPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState("");

  const [templates, setTemplates] = useState<ApprovalMatrixTemplate[]>([]);
  const [reviewers, setReviewers] = useState<ApprovalMatrixReviewer[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [showReviewerForm, setShowReviewerForm] = useState(false);

  const [newTemplate, setNewTemplate] = useState({
    template_name: "",
    module_name: "documents",
    description: "",
    active: true,
  });

  const [newReviewer, setNewReviewer] = useState({
    reviewer_type: "formal_review",
    approver_function: "",
    reviewer_role: "",
    reviewer_email: "",
    required_reviewer: true,
    sequence_order: "1",
    active: true,
  });

  const fetchUserRole = async () => {
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError) {
      alert(userError.message);
      setLoading(false);
      return;
    }

    const email = userData?.user?.email || "";
    setUserEmail(email);

    if (!email) {
      setUserRole("");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_email", email)
      .maybeSingle();

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setUserRole(data?.role || "");
  };

  const fetchData = async () => {
    const [templateRes, reviewerRes] = await Promise.all([
      supabase
        .from("approval_matrix_templates")
        .select("*")
        .order("module_name", { ascending: true })
        .order("template_name", { ascending: true }),
      supabase
        .from("approval_matrix_reviewers")
        .select("*")
        .order("sequence_order", { ascending: true }),
    ]);

    if (templateRes.error) {
      alert(templateRes.error.message);
      return;
    }

    if (reviewerRes.error) {
      alert(reviewerRes.error.message);
      return;
    }

    const templateData = (templateRes.data as ApprovalMatrixTemplate[]) || [];
    setTemplates(templateData);
    setReviewers((reviewerRes.data as ApprovalMatrixReviewer[]) || []);

    if (!selectedTemplateId && templateData.length > 0) {
      setSelectedTemplateId(templateData[0].id);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchUserRole();
      await fetchData();
      setLoading(false);
    };

    load();
  }, []);

  const selectedTemplate = useMemo(() => {
    return templates.find((template) => template.id === selectedTemplateId) || null;
  }, [templates, selectedTemplateId]);

  const selectedReviewers = useMemo(() => {
    if (!selectedTemplateId) return [];

    return reviewers
      .filter((reviewer) => reviewer.template_id === selectedTemplateId)
      .sort((a, b) => Number(a.sequence_order || 0) - Number(b.sequence_order || 0));
  }, [reviewers, selectedTemplateId]);

  const normalizeEmail = (value: string | null | undefined) => {
    const text = String(value || "").trim().toLowerCase();
    if (!text) return "";
    if (!text.includes("@")) return "";
    return text;
  };

  const canAccessAdmin =
    userRole?.includes("approver") ||
    userRole?.includes("vp_quality") ||
    userRole?.includes("admin") ||
    userRole?.includes("quality");

  const resetTemplateForm = () => {
    setNewTemplate({
      template_name: "",
      module_name: "documents",
      description: "",
      active: true,
    });
  };

  const resetReviewerForm = () => {
    setNewReviewer({
      reviewer_type: "formal_review",
      approver_function: "",
      reviewer_role: "",
      reviewer_email: "",
      required_reviewer: true,
      sequence_order: selectedReviewers.length > 0
        ? String(Math.max(...selectedReviewers.map((item) => Number(item.sequence_order || 1))) + 1)
        : "1",
      active: true,
    });
  };

  const createTemplate = async () => {
    if (!newTemplate.template_name.trim()) {
      alert("Template name is required.");
      return false;
    }

    if (!newTemplate.module_name.trim()) {
      alert("Module is required.");
      return false;
    }

    setBusy(true);

    const { data, error } = await supabase
      .from("approval_matrix_templates")
      .insert({
        template_name: newTemplate.template_name.trim(),
        module_name: newTemplate.module_name.trim(),
        description: newTemplate.description.trim() || null,
        active: newTemplate.active,
        created_by: userEmail || "unknown",
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      alert(error.message);
      setBusy(false);
      return false;
    }

    resetTemplateForm();
    setShowTemplateForm(false);

    await fetchData();
    setSelectedTemplateId(data.id);
    setBusy(false);
    return true;
  };

  const updateTemplateActive = async (template: ApprovalMatrixTemplate, active: boolean) => {
    setBusy(true);

    const { error } = await supabase
      .from("approval_matrix_templates")
      .update({ active, updated_at: new Date().toISOString() })
      .eq("id", template.id);

    if (error) alert(error.message);

    await fetchData();
    setBusy(false);
  };

  const deleteTemplate = async (template: ApprovalMatrixTemplate) => {
    const confirmed = window.confirm(
      `Delete approval matrix template "${template.template_name}" and all reviewer rows?`
    );

    if (!confirmed) return;

    setBusy(true);

    const { error } = await supabase
      .from("approval_matrix_templates")
      .delete()
      .eq("id", template.id);

    if (error) {
      alert(error.message);
      setBusy(false);
      return;
    }

    setSelectedTemplateId("");
    await fetchData();
    setBusy(false);
  };

  const addReviewer = async () => {
    if (!selectedTemplateId) {
      alert("Select a template before adding reviewers.");
      return false;
    }

    if (!newReviewer.reviewer_type.trim()) {
      alert("Review phase is required.");
      return false;
    }

    if (!newReviewer.approver_function.trim()) {
      alert("Function is required.");
      return false;
    }

    if (!newReviewer.reviewer_role.trim()) {
      alert("Job title is required.");
      return false;
    }

    if (!newReviewer.reviewer_email.trim()) {
      alert("Reviewer email is required.");
      return false;
    }

    const reviewerEmail = normalizeEmail(newReviewer.reviewer_email);

    if (newReviewer.reviewer_email && !reviewerEmail) {
      alert("Reviewer email must be valid when provided.");
      return false;
    }

    const sequence = Number(newReviewer.sequence_order || 1);

    if (!Number.isFinite(sequence) || sequence < 1) {
      alert("Sequence must be a positive number.");
      return false;
    }

    setBusy(true);

    const { error } = await supabase.from("approval_matrix_reviewers").insert({
      template_id: selectedTemplateId,
      reviewer_type: newReviewer.reviewer_type,
      approver_function: newReviewer.approver_function.trim(),
      reviewer_role: newReviewer.reviewer_role.trim(),
      reviewer_email: reviewerEmail || null,
      required_reviewer: newReviewer.required_reviewer,
      sequence_order: sequence,
      active: newReviewer.active,
    });

    if (error) {
      alert(error.message);
      setBusy(false);
      return false;
    }

    setNewReviewer({
      reviewer_type: "formal_review",
      approver_function: "",
      reviewer_role: "",
      reviewer_email: "",
      required_reviewer: true,
      sequence_order: String(sequence + 1),
      active: true,
    });
    setShowReviewerForm(false);

    await fetchData();
    setBusy(false);
    return true;
  };

  const updateReviewerActive = async (reviewer: ApprovalMatrixReviewer, active: boolean) => {
    setBusy(true);

    const { error } = await supabase
      .from("approval_matrix_reviewers")
      .update({ active })
      .eq("id", reviewer.id);

    if (error) alert(error.message);

    await fetchData();
    setBusy(false);
  };

  const deleteReviewer = async (reviewer: ApprovalMatrixReviewer) => {
    const confirmed = window.confirm("Delete this reviewer row from the template?");

    if (!confirmed) return;

    setBusy(true);

    const { error } = await supabase
      .from("approval_matrix_reviewers")
      .delete()
      .eq("id", reviewer.id);

    if (error) {
      alert(error.message);
      setBusy(false);
      return;
    }

    await fetchData();
    setBusy(false);
  };

  if (loading) {
    return <main style={pageStyle}>Loading Approval Matrix Templates...</main>;
  }

  if (!canAccessAdmin) {
    return (
      <main style={pageStyle}>
        <h1>Access Denied</h1>
        <p>Only authorized Quality, Approver, Admin, or VP Quality users can access Approval Matrix Templates.</p>
        <p><strong>Logged-in Email:</strong> {userEmail || "none"}</p>
        <p><strong>Your Role:</strong> {userRole || "none"}</p>
        <Link href="/dashboard">Back to Dashboard</Link>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>ADMIN MASTER DATA</div>
          <h1 style={{ margin: "6px 0" }}>Approval Matrix Templates</h1>
          <p style={subtleText}>
            Maintain reusable approval matrix templates for Document Control, Change Control, CAPA, Audit, Training, and other workflows.
          </p>
        </div>
        <div style={buttonRowStyle}>
          <Link href="/admin/master-data" style={darkButtonStyle}>Back to Master Data</Link>
          <Link href="/dashboard" style={darkButtonStyle}>Dashboard</Link>
        </div>
      </header>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <h2 style={{ margin: 0 }}>Create Template</h2>
            <p style={subtleText}>Create reusable approval matrix templates for workflow reviewer assignment.</p>
          </div>
          {!showTemplateForm ? (
            <button
              onClick={() => {
                resetTemplateForm();
                setShowTemplateForm(true);
              }}
              style={primaryButtonStyle}
            >
              New Template
            </button>
          ) : null}
        </div>

        {showTemplateForm ? (
          <>
            <div style={gridStyle}>
              <Field label="Template Name">
                <input
                  value={newTemplate.template_name}
                  onChange={(e) => setNewTemplate({ ...newTemplate, template_name: e.target.value })}
                  placeholder="SOP Approval Matrix"
                  style={inputStyle}
                />
              </Field>

              <Field label="Module">
                <select
                  value={newTemplate.module_name}
                  onChange={(e) => setNewTemplate({ ...newTemplate, module_name: e.target.value })}
                  style={inputStyle}
                >
                  {MODULE_OPTIONS.map((module) => (
                    <option key={module} value={module}>{getModuleLabel(module)}</option>
                  ))}
                </select>
              </Field>

              <Field label="Active">
                <label>
                  <input
                    type="checkbox"
                    checked={newTemplate.active}
                    onChange={(e) => setNewTemplate({ ...newTemplate, active: e.target.checked })}
                  />{" "}
                  Active template
                </label>
              </Field>
            </div>

            <Field label="Description">
              <textarea
                value={newTemplate.description}
                onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                placeholder="Describe when this matrix should be used."
                rows={3}
                style={textareaStyle}
              />
            </Field>

            <div style={buttonRowStyle}>
              <button onClick={createTemplate} disabled={busy} style={busy ? disabledButtonStyle : primaryButtonStyle}>
                Save Template
              </button>
              <button
                onClick={() => {
                  resetTemplateForm();
                  setShowTemplateForm(false);
                }}
                disabled={busy}
                style={darkButtonStyle}
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <p style={subtleText}>Use “New Template” to create a reusable approval matrix. Existing templates can be selected and maintained below.</p>
        )}
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <h2 style={{ margin: 0 }}>Existing Templates</h2>
            <p style={subtleText}>Select a template to manage reviewer rows.</p>
          </div>
          <div style={smallTextStyle}>{templates.length} template(s)</div>
        </div>

        {templates.length === 0 ? (
          <p style={subtleText}>No approval matrix templates have been created yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Template</th>
                  <th style={thStyle}>Module</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Description</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((template) => (
                  <tr key={template.id} style={selectedTemplateId === template.id ? selectedRowStyle : undefined}>
                    <td style={tdStyle}><strong>{template.template_name}</strong></td>
                    <td style={tdStyle}>{getModuleLabel(template.module_name)}</td>
                    <td style={tdStyle}>{template.active ? <StatusBadge label="Active" color="#15803d" /> : <StatusBadge label="Inactive" color="#991b1b" />}</td>
                    <td style={tdStyle}>{template.description || "N/A"}</td>
                    <td style={tdStyle}>
                      <div style={buttonRowStyle}>
                        <button
                          onClick={() => {
                            setSelectedTemplateId(template.id);
                            setShowReviewerForm(false);
                            resetReviewerForm();
                          }}
                          style={secondaryButtonStyle}
                        >
                          Select
                        </button>
                        <button onClick={() => updateTemplateActive(template, !template.active)} style={darkButtonStyle}>
                          {template.active ? "Deactivate" : "Activate"}
                        </button>
                        <button onClick={() => deleteTemplate(template)} style={dangerButtonStyle}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <h2 style={{ margin: 0 }}>Template Reviewers</h2>
            <p style={subtleText}>
              Add reviewer rows that will populate the workflow when the template is loaded.
            </p>
          </div>
          <div style={buttonRowStyle}>
            {selectedTemplate ? (
              <StatusBadge label={selectedTemplate.template_name} color="#2563eb" />
            ) : null}
            {selectedTemplate && !showReviewerForm ? (
              <button
                onClick={() => {
                  resetReviewerForm();
                  setShowReviewerForm(true);
                }}
                style={primaryButtonStyle}
              >
                Add Reviewer
              </button>
            ) : null}
          </div>
        </div>

        {!selectedTemplate ? (
          <p style={subtleText}>Select a template before adding reviewer rows.</p>
        ) : (
          <>
            {showReviewerForm ? (
              <div style={reviewerFormStyle}>
                <div style={gridStyle}>
                  <Field label="Review Phase">
                    <select
                      value={newReviewer.reviewer_type}
                      onChange={(e) => setNewReviewer({ ...newReviewer, reviewer_type: e.target.value })}
                      style={inputStyle}
                    >
                      {REVIEWER_TYPES.map((type) => (
                        <option key={type} value={type}>{getReviewerTypeLabel(type)}</option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Function">
                    <select
                      value={newReviewer.approver_function}
                      onChange={(e) => setNewReviewer({ ...newReviewer, approver_function: e.target.value })}
                      style={inputStyle}
                    >
                      <option value="">Select function</option>
                      {FUNCTION_OPTIONS.map((functionName) => (
                        <option key={functionName} value={functionName}>{functionName}</option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Job Title">
                    <input
                      value={newReviewer.reviewer_role}
                      onChange={(e) => setNewReviewer({ ...newReviewer, reviewer_role: e.target.value })}
                      placeholder="Quality Engineer"
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="Reviewer Email">
                    <input
                      type="email"
                      value={newReviewer.reviewer_email}
                      onChange={(e) => setNewReviewer({ ...newReviewer, reviewer_email: e.target.value })}
                      placeholder="reviewer@company.com"
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="Sequence">
                    <input
                      type="number"
                      min="1"
                      value={newReviewer.sequence_order}
                      onChange={(e) => setNewReviewer({ ...newReviewer, sequence_order: e.target.value })}
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="Required Reviewer">
                    <label>
                      <input
                        type="checkbox"
                        checked={newReviewer.required_reviewer}
                        onChange={(e) => setNewReviewer({ ...newReviewer, required_reviewer: e.target.checked })}
                      />{" "}
                      Required
                    </label>
                  </Field>

                  <Field label="Active">
                    <label>
                      <input
                        type="checkbox"
                        checked={newReviewer.active}
                        onChange={(e) => setNewReviewer({ ...newReviewer, active: e.target.checked })}
                      />{" "}
                      Active
                    </label>
                  </Field>
                </div>

                <div style={buttonRowStyle}>
                  <button onClick={addReviewer} disabled={busy} style={busy ? disabledButtonStyle : primaryButtonStyle}>
                    Save Reviewer
                  </button>
                  <button
                    onClick={() => {
                      resetReviewerForm();
                      setShowReviewerForm(false);
                    }}
                    disabled={busy}
                    style={darkButtonStyle}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}

            <div style={{ marginTop: "18px", overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Sequence</th>
                    <th style={thStyle}>Review Phase</th>
                    <th style={thStyle}>Function</th>
                    <th style={thStyle}>Job Title</th>
                    <th style={thStyle}>Reviewer Email</th>
                    <th style={thStyle}>Required</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedReviewers.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={tdStyle}>No reviewers have been added to this template.</td>
                    </tr>
                  ) : (
                    selectedReviewers.map((reviewer) => (
                      <tr key={reviewer.id}>
                        <td style={tdStyle}>{reviewer.sequence_order || 1}</td>
                        <td style={tdStyle}>{getReviewerTypeLabel(reviewer.reviewer_type)}</td>
                        <td style={tdStyle}>{reviewer.approver_function || "Not assigned"}</td>
                        <td style={tdStyle}>{reviewer.reviewer_role || "N/A"}</td>
                        <td style={tdStyle}>{reviewer.reviewer_email || "Assigned at workflow"}</td>
                        <td style={tdStyle}>{reviewer.required_reviewer ? "Yes" : "No"}</td>
                        <td style={tdStyle}>{reviewer.active ? <StatusBadge label="Active" color="#15803d" /> : <StatusBadge label="Inactive" color="#991b1b" />}</td>
                        <td style={tdStyle}>
                          <div style={buttonRowStyle}>
                            <button onClick={() => updateReviewerActive(reviewer, !reviewer.active)} style={darkButtonStyle}>
                              {reviewer.active ? "Deactivate" : "Activate"}
                            </button>
                            <button onClick={() => deleteReviewer(reviewer)} style={dangerButtonStyle}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
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

function StatusBadge({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        background: color,
        color: "white",
        borderRadius: "999px",
        padding: "3px 8px",
        fontSize: "12px",
        fontWeight: 700,
        display: "inline-block",
      }}
    >
      {label}
    </span>
  );
}

function getModuleLabel(value: string) {
  const labels: Record<string, string> = {
    documents: "Document Control",
    change_control: "Change Control",
    capa: "CAPA",
    audit: "Audit",
    training: "Training",
    ncmr: "NCMR",
    management_review: "Management Review",
  };

  return labels[value] || value;
}

function getReviewerTypeLabel(value: string) {
  const labels: Record<string, string> = {
    collaboration: "Collaboration",
    formal_review: "Formal Review",
    approver: "Approval",
  };

  return labels[value] || value;
}

const pageStyle: React.CSSProperties = {
  padding: "24px",
  background: "#f8fafc",
  minHeight: "100vh",
  fontFamily: "Arial, sans-serif",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "16px",
  alignItems: "flex-start",
  flexWrap: "wrap",
  marginBottom: "20px",
};

const eyebrowStyle: React.CSSProperties = {
  fontSize: "12px",
  letterSpacing: "0.08em",
  color: "#6b7280",
  fontWeight: 800,
};

const subtleText: React.CSSProperties = { color: "#6b7280" };

const cardStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid #d1d5db",
  borderRadius: "16px",
  padding: "20px",
  marginBottom: "20px",
};

const sectionHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "14px",
  alignItems: "flex-start",
  flexWrap: "wrap",
  marginBottom: "16px",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: "14px",
};

const labelStyle: React.CSSProperties = { fontWeight: 700 };

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px",
  borderRadius: "8px",
  border: "1px solid #d1d5db",
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px",
  borderRadius: "8px",
  border: "1px solid #d1d5db",
  marginTop: "6px",
};

const primaryButtonStyle: React.CSSProperties = {
  background: "#2563eb",
  color: "white",
  border: "none",
  padding: "10px 14px",
  borderRadius: "8px",
  fontWeight: 700,
  cursor: "pointer",
  textDecoration: "none",
  display: "inline-block",
};

const secondaryButtonStyle: React.CSSProperties = {
  background: "#111827",
  color: "white",
  border: "none",
  padding: "8px 12px",
  borderRadius: "8px",
  fontWeight: 700,
  cursor: "pointer",
  textDecoration: "none",
  display: "inline-block",
};

const darkButtonStyle: React.CSSProperties = {
  background: "#374151",
  color: "white",
  border: "none",
  padding: "8px 12px",
  borderRadius: "8px",
  fontWeight: 700,
  cursor: "pointer",
  textDecoration: "none",
  display: "inline-block",
};

const dangerButtonStyle: React.CSSProperties = {
  background: "#991b1b",
  color: "white",
  border: "none",
  padding: "8px 12px",
  borderRadius: "8px",
  fontWeight: 700,
  cursor: "pointer",
};

const disabledButtonStyle: React.CSSProperties = {
  background: "#9ca3af",
  color: "white",
  border: "none",
  padding: "10px 14px",
  borderRadius: "8px",
  fontWeight: 700,
  cursor: "not-allowed",
};

const buttonRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
  alignItems: "center",
};

const smallTextStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#6b7280",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  borderBottom: "1px solid #d1d5db",
  padding: "10px",
};

const tdStyle: React.CSSProperties = {
  borderBottom: "1px solid #e5e7eb",
  padding: "10px",
  verticalAlign: "top",
};

const reviewerFormStyle: React.CSSProperties = {
  background: "#f9fafb",
  border: "1px solid #e5e7eb",
  borderRadius: "12px",
  padding: "14px",
  marginBottom: "16px",
};

const selectedRowStyle: React.CSSProperties = {
  background: "#eff6ff",
};
