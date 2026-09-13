"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { APPROVAL_MATRIX_MODULE_CATALOG } from "../../../lib/platformModuleCatalog";

type ApprovalMatrixTemplate = {
  id: string;
  tenant_id: string;
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
  tenant_id: string;
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

const MODULE_CODE_ALIASES: Record<string, string> = {
  controlled_documents: "documents",
  audit_management: "audit",
};

const MODULE_LABELS = Object.fromEntries(
  APPROVAL_MATRIX_MODULE_CATALOG.flatMap((module) => {
    const workflowCode = MODULE_CODE_ALIASES[module.code] || module.code;
    return [[workflowCode, module.label], [module.code, module.label]];
  })
) as Record<string, string>;

const MODULE_OPTIONS = APPROVAL_MATRIX_MODULE_CATALOG.map((module) => ({
  value: MODULE_CODE_ALIASES[module.code] || module.code,
  label: module.label,
}));

const DEFAULT_MODULE = MODULE_OPTIONS[0]?.value || "capa";

export default function CompanyApprovalMatrixPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [message, setMessage] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [companyName, setCompanyName] = useState("");

  const [templates, setTemplates] = useState<ApprovalMatrixTemplate[]>([]);
  const [reviewers, setReviewers] = useState<ApprovalMatrixReviewer[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [showReviewerForm, setShowReviewerForm] = useState(false);

  const [newTemplate, setNewTemplate] = useState({
    template_name: "",
    module_name: DEFAULT_MODULE,
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

  useEffect(() => {
    initialize();
  }, []);

  const initialize = async () => {
    try {
      setLoading(true);
      setMessage("");

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;

      const email = String(authData?.user?.email || "").trim().toLowerCase();
      setUserEmail(email);
      if (!email) return;

      const activeTenantId = window.localStorage.getItem("qualisphere_active_tenant_id") || "";
      if (!activeTenantId) {
        setMessage("No active Company Account is selected.");
        return;
      }

      const { data: membership, error: membershipError } = await supabase
        .from("tenant_memberships")
        .select("tenant_id,membership_status,tenants(company_name)")
        .eq("tenant_id", activeTenantId)
        .ilike("user_email", email)
        .eq("membership_status", "active")
        .maybeSingle();

      if (membershipError) throw membershipError;
      if (!membership) {
        setMessage("You do not have an active membership in this Company Account.");
        return;
      }

      const { data: isCompanyAdmin, error: adminError } = await supabase.rpc(
        "qualisphere_is_company_admin",
        { p_tenant_id: activeTenantId }
      );
      if (adminError) throw adminError;
      if (isCompanyAdmin !== true) {
        setMessage("Company Administrator authority is required to manage approval matrices.");
        return;
      }

      const tenant = Array.isArray((membership as any).tenants)
        ? (membership as any).tenants[0]
        : (membership as any).tenants;
      const resolvedCompanyName = String(
        tenant?.company_name ||
          window.localStorage.getItem("qualisphere_active_tenant_name") ||
          "Company Account"
      );

      setTenantId(activeTenantId);
      setCompanyName(resolvedCompanyName);
      setAuthorized(true);
      await fetchData(activeTenantId);
    } catch (error: any) {
      setMessage(error?.message || "Unable to load Approval Matrix Templates.");
    } finally {
      setLoading(false);
    }
  };

  const fetchData = async (activeTenantId = tenantId) => {
    if (!activeTenantId) return;

    const [templateRes, reviewerRes] = await Promise.all([
      supabase
        .from("approval_matrix_templates")
        .select("*")
        .eq("tenant_id", activeTenantId)
        .order("module_name", { ascending: true })
        .order("template_name", { ascending: true }),
      supabase
        .from("approval_matrix_reviewers")
        .select("*")
        .eq("tenant_id", activeTenantId)
        .order("sequence_order", { ascending: true }),
    ]);

    if (templateRes.error) throw templateRes.error;
    if (reviewerRes.error) throw reviewerRes.error;

    const templateData = (templateRes.data || []) as ApprovalMatrixTemplate[];
    setTemplates(templateData);
    setReviewers((reviewerRes.data || []) as ApprovalMatrixReviewer[]);

    setSelectedTemplateId((current) => {
      if (current && templateData.some((item) => item.id === current)) return current;
      return templateData[0]?.id || "";
    });
  };

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) || null,
    [templates, selectedTemplateId]
  );

  const selectedReviewers = useMemo(() => {
    if (!selectedTemplateId) return [];
    return reviewers
      .filter((reviewer) => reviewer.template_id === selectedTemplateId)
      .sort((a, b) => Number(a.sequence_order || 0) - Number(b.sequence_order || 0));
  }, [reviewers, selectedTemplateId]);

  const resetTemplateForm = () => {
    setNewTemplate({
      template_name: "",
      module_name: DEFAULT_MODULE,
      description: "",
      active: true,
    });
  };

  const resetReviewerForm = () => {
    const nextSequence = selectedReviewers.length
      ? Math.max(...selectedReviewers.map((item) => Number(item.sequence_order || 0))) + 1
      : 1;

    setNewReviewer({
      reviewer_type: "formal_review",
      approver_function: "",
      reviewer_role: "",
      reviewer_email: "",
      required_reviewer: true,
      sequence_order: String(nextSequence),
      active: true,
    });
  };

  const normalizeEmail = (value: string) => {
    const text = value.trim().toLowerCase();
    return text && text.includes("@") ? text : "";
  };

  const createTemplate = async () => {
    if (!tenantId || !newTemplate.template_name.trim() || !newTemplate.module_name) {
      alert("Template Name and Module are required.");
      return;
    }

    try {
      setBusy(true);
      const { data, error } = await supabase
        .from("approval_matrix_templates")
        .insert({
          tenant_id: tenantId,
          template_name: newTemplate.template_name.trim(),
          module_name: newTemplate.module_name,
          description: newTemplate.description.trim() || null,
          active: newTemplate.active,
          created_by: userEmail || "unknown",
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      resetTemplateForm();
      setShowTemplateForm(false);
      await fetchData();
      setSelectedTemplateId(data.id);
    } catch (error: any) {
      alert(error?.message || "Unable to create approval matrix template.");
    } finally {
      setBusy(false);
    }
  };

  const updateTemplateActive = async (template: ApprovalMatrixTemplate, active: boolean) => {
    try {
      setBusy(true);
      const { error } = await supabase
        .from("approval_matrix_templates")
        .update({ active, updated_at: new Date().toISOString() })
        .eq("id", template.id)
        .eq("tenant_id", tenantId);
      if (error) throw error;
      await fetchData();
    } catch (error: any) {
      alert(error?.message || "Unable to update template.");
    } finally {
      setBusy(false);
    }
  };

  const deleteTemplate = async (template: ApprovalMatrixTemplate) => {
    if (!window.confirm(`Delete approval matrix template "${template.template_name}" and all reviewer rows?`)) return;

    try {
      setBusy(true);
      const reviewerDelete = await supabase
        .from("approval_matrix_reviewers")
        .delete()
        .eq("template_id", template.id)
        .eq("tenant_id", tenantId);
      if (reviewerDelete.error) throw reviewerDelete.error;

      const templateDelete = await supabase
        .from("approval_matrix_templates")
        .delete()
        .eq("id", template.id)
        .eq("tenant_id", tenantId);
      if (templateDelete.error) throw templateDelete.error;

      setSelectedTemplateId("");
      await fetchData();
    } catch (error: any) {
      alert(error?.message || "Unable to delete template.");
    } finally {
      setBusy(false);
    }
  };

  const addReviewer = async () => {
    if (!selectedTemplateId || !tenantId) {
      alert("Select a template before adding reviewers.");
      return;
    }
    if (!newReviewer.approver_function.trim() || !newReviewer.reviewer_role.trim()) {
      alert("Function and Job Title are required.");
      return;
    }

    const email = normalizeEmail(newReviewer.reviewer_email);
    if (!email) {
      alert("Reviewer Email is required and must be valid.");
      return;
    }

    const sequence = Number(newReviewer.sequence_order);
    if (!Number.isFinite(sequence) || sequence < 1) {
      alert("Sequence must be a positive number.");
      return;
    }

    try {
      setBusy(true);
      const { error } = await supabase.from("approval_matrix_reviewers").insert({
        tenant_id: tenantId,
        template_id: selectedTemplateId,
        reviewer_type: newReviewer.reviewer_type,
        approver_function: newReviewer.approver_function.trim(),
        reviewer_role: newReviewer.reviewer_role.trim(),
        reviewer_email: email,
        required_reviewer: newReviewer.required_reviewer,
        sequence_order: sequence,
        active: newReviewer.active,
      });
      if (error) throw error;

      setShowReviewerForm(false);
      await fetchData();
      resetReviewerForm();
    } catch (error: any) {
      alert(error?.message || "Unable to add reviewer.");
    } finally {
      setBusy(false);
    }
  };

  const updateReviewerActive = async (reviewer: ApprovalMatrixReviewer, active: boolean) => {
    try {
      setBusy(true);
      const { error } = await supabase
        .from("approval_matrix_reviewers")
        .update({ active })
        .eq("id", reviewer.id)
        .eq("tenant_id", tenantId);
      if (error) throw error;
      await fetchData();
    } catch (error: any) {
      alert(error?.message || "Unable to update reviewer.");
    } finally {
      setBusy(false);
    }
  };

  const deleteReviewer = async (reviewer: ApprovalMatrixReviewer) => {
    if (!window.confirm("Delete this reviewer row from the template?")) return;

    try {
      setBusy(true);
      const { error } = await supabase
        .from("approval_matrix_reviewers")
        .delete()
        .eq("id", reviewer.id)
        .eq("tenant_id", tenantId);
      if (error) throw error;
      await fetchData();
    } catch (error: any) {
      alert(error?.message || "Unable to delete reviewer.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <main style={pageStyle}>Loading Approval Matrix Templates...</main>;

  if (!authorized) {
    return (
      <main style={pageStyle}>
        <h1>Access Denied</h1>
        <p>{message || "Company Administrator authority is required."}</p>
        <p><strong>Logged-in Email:</strong> {userEmail || "none"}</p>
        <Link href="/workspace">Back to Workspace</Link>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>COMPANY ADMINISTRATION</div>
          <h1 style={{ margin: "6px 0" }}>Approval Matrix Templates</h1>
          <p style={subtleText}>
            Create and maintain reusable approval matrices for {companyName}. New Company Accounts start with no approval matrices.
          </p>
        </div>
        <div style={buttonRowStyle}>
          <Link href="/company-administration/master-data" style={darkButtonStyle}>Admin Master Data</Link>
          <Link href="/company-administration/settings" style={darkButtonStyle}>Company Settings</Link>
          <Link href="/workspace" style={darkButtonStyle}>My Workspace</Link>
        </div>
      </header>

      <section style={infoCardStyle}>
        <strong>Company Account:</strong> {companyName}
        <span style={{ marginLeft: 18 }}><strong>Company Administrator:</strong> {userEmail}</span>
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <h2 style={{ margin: 0 }}>Create Template</h2>
            <p style={subtleText}>Build reusable approval matrices using your company&apos;s own approval structure.</p>
          </div>
          {!showTemplateForm && (
            <button
              onClick={() => {
                resetTemplateForm();
                setShowTemplateForm(true);
              }}
              style={primaryButtonStyle}
            >
              New Template
            </button>
          )}
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
                    <option key={module.value} value={module.value}>{module.label}</option>
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
              <button onClick={createTemplate} disabled={busy} style={busy ? disabledButtonStyle : primaryButtonStyle}>Save Template</button>
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
          <p style={subtleText}>Use “New Template” to create the first approval matrix for this Company Account.</p>
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
          <div style={emptyStateStyle}>
            <strong>No approval matrices yet.</strong>
            <div style={{ marginTop: 6 }}>This is expected for a new Company Account. Create matrices that match your company&apos;s approval requirements.</div>
          </div>
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
                        <button onClick={() => { setSelectedTemplateId(template.id); setShowReviewerForm(false); }} style={secondaryButtonStyle}>Select</button>
                        <button onClick={() => updateTemplateActive(template, !template.active)} disabled={busy} style={darkButtonStyle}>{template.active ? "Deactivate" : "Activate"}</button>
                        <button onClick={() => deleteTemplate(template)} disabled={busy} style={dangerButtonStyle}>Delete</button>
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
            <p style={subtleText}>Reviewer rows populate the workflow when the template is loaded.</p>
          </div>
          <div style={buttonRowStyle}>
            {selectedTemplate && <StatusBadge label={selectedTemplate.template_name} color="#2563eb" />}
            {selectedTemplate && !showReviewerForm && (
              <button onClick={() => { resetReviewerForm(); setShowReviewerForm(true); }} style={primaryButtonStyle}>Add Reviewer</button>
            )}
          </div>
        </div>

        {!selectedTemplate ? (
          <p style={subtleText}>Create or select a template before adding reviewer rows.</p>
        ) : (
          <>
            {showReviewerForm && (
              <div style={reviewerFormStyle}>
                <div style={gridStyle}>
                  <Field label="Review Phase">
                    <select value={newReviewer.reviewer_type} onChange={(e) => setNewReviewer({ ...newReviewer, reviewer_type: e.target.value })} style={inputStyle}>
                      {REVIEWER_TYPES.map((type) => <option key={type} value={type}>{getReviewerTypeLabel(type)}</option>)}
                    </select>
                  </Field>

                  <Field label="Function">
                    <select value={newReviewer.approver_function} onChange={(e) => setNewReviewer({ ...newReviewer, approver_function: e.target.value })} style={inputStyle}>
                      <option value="">Select function</option>
                      {FUNCTION_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </Field>

                  <Field label="Job Title">
                    <input value={newReviewer.reviewer_role} onChange={(e) => setNewReviewer({ ...newReviewer, reviewer_role: e.target.value })} placeholder="Quality Engineer" style={inputStyle} />
                  </Field>

                  <Field label="Reviewer Email">
                    <input type="email" value={newReviewer.reviewer_email} onChange={(e) => setNewReviewer({ ...newReviewer, reviewer_email: e.target.value })} placeholder="reviewer@company.com" style={inputStyle} />
                  </Field>

                  <Field label="Sequence">
                    <input type="number" min="1" value={newReviewer.sequence_order} onChange={(e) => setNewReviewer({ ...newReviewer, sequence_order: e.target.value })} style={inputStyle} />
                  </Field>

                  <Field label="Required Reviewer">
                    <label><input type="checkbox" checked={newReviewer.required_reviewer} onChange={(e) => setNewReviewer({ ...newReviewer, required_reviewer: e.target.checked })} /> Required</label>
                  </Field>

                  <Field label="Active">
                    <label><input type="checkbox" checked={newReviewer.active} onChange={(e) => setNewReviewer({ ...newReviewer, active: e.target.checked })} /> Active</label>
                  </Field>
                </div>

                <div style={buttonRowStyle}>
                  <button onClick={addReviewer} disabled={busy} style={busy ? disabledButtonStyle : primaryButtonStyle}>Save Reviewer</button>
                  <button onClick={() => { resetReviewerForm(); setShowReviewerForm(false); }} disabled={busy} style={darkButtonStyle}>Cancel</button>
                </div>
              </div>
            )}

            <div style={{ marginTop: 18, overflowX: "auto" }}>
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
                    <tr><td colSpan={8} style={tdStyle}>No reviewers have been added to this template.</td></tr>
                  ) : selectedReviewers.map((reviewer) => (
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
                          <button onClick={() => updateReviewerActive(reviewer, !reviewer.active)} disabled={busy} style={darkButtonStyle}>{reviewer.active ? "Deactivate" : "Activate"}</button>
                          <button onClick={() => deleteReviewer(reviewer)} disabled={busy} style={dangerButtonStyle}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
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
  return <div style={{ marginBottom: 12 }}><label style={labelStyle}>{label}</label><div style={{ marginTop: 5 }}>{children}</div></div>;
}

function StatusBadge({ label, color }: { label: string; color: string }) {
  return <span style={{ background: color, color: "white", borderRadius: 999, padding: "3px 8px", fontSize: 12, fontWeight: 700, display: "inline-block" }}>{label}</span>;
}

function getModuleLabel(value: string) {
  return MODULE_LABELS[value] || value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function getReviewerTypeLabel(value: string) {
  const labels: Record<string, string> = {
    collaboration: "Collaboration",
    formal_review: "Formal Review",
    approver: "Approval",
  };
  return labels[value] || value;
}

const pageStyle: React.CSSProperties = { padding: 24, background: "#f8fafc", minHeight: "100vh", fontFamily: "Arial, sans-serif" };
const headerStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 20 };
const eyebrowStyle: React.CSSProperties = { fontSize: 12, letterSpacing: "0.08em", color: "#6b7280", fontWeight: 800 };
const subtleText: React.CSSProperties = { color: "#6b7280" };
const infoCardStyle: React.CSSProperties = { background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 12, padding: 14, marginBottom: 20 };
const cardStyle: React.CSSProperties = { background: "white", border: "1px solid #d1d5db", borderRadius: 16, padding: 20, marginBottom: 20 };
const emptyStateStyle: React.CSSProperties = { background: "#f9fafb", border: "1px dashed #cbd5e1", borderRadius: 12, padding: 18, color: "#475569" };
const sectionHeaderStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 16 };
const gridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 };
const labelStyle: React.CSSProperties = { fontWeight: 700 };
const inputStyle: React.CSSProperties = { width: "100%", padding: 9, borderRadius: 8, border: "1px solid #d1d5db" };
const textareaStyle: React.CSSProperties = { width: "100%", padding: 9, borderRadius: 8, border: "1px solid #d1d5db", marginTop: 6 };
const primaryButtonStyle: React.CSSProperties = { background: "#2563eb", color: "white", border: "none", padding: "10px 14px", borderRadius: 8, fontWeight: 700, cursor: "pointer", textDecoration: "none", display: "inline-block" };
const secondaryButtonStyle: React.CSSProperties = { background: "#111827", color: "white", border: "none", padding: "8px 12px", borderRadius: 8, fontWeight: 700, cursor: "pointer", textDecoration: "none", display: "inline-block" };
const darkButtonStyle: React.CSSProperties = { background: "#374151", color: "white", border: "none", padding: "8px 12px", borderRadius: 8, fontWeight: 700, cursor: "pointer", textDecoration: "none", display: "inline-block" };
const dangerButtonStyle: React.CSSProperties = { background: "#991b1b", color: "white", border: "none", padding: "8px 12px", borderRadius: 8, fontWeight: 700, cursor: "pointer" };
const disabledButtonStyle: React.CSSProperties = { background: "#9ca3af", color: "white", border: "none", padding: "10px 14px", borderRadius: 8, fontWeight: 700, cursor: "not-allowed" };
const buttonRowStyle: React.CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" };
const smallTextStyle: React.CSSProperties = { fontSize: 12, color: "#6b7280" };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse" };
const thStyle: React.CSSProperties = { textAlign: "left", borderBottom: "1px solid #d1d5db", padding: 10 };
const tdStyle: React.CSSProperties = { borderBottom: "1px solid #e5e7eb", padding: 10, verticalAlign: "top" };
const reviewerFormStyle: React.CSSProperties = { background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14, marginBottom: 16 };
const selectedRowStyle: React.CSSProperties = { background: "#eff6ff" };
