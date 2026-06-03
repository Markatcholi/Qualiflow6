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
  owner_email: string | null;
  risk_level: string | null;
  created_at: string | null;
};

const CHANGE_TYPES = ["ECO", "Process", "Document", "Supplier", "Software", "Equipment", "Material", "Other"];
const CATEGORIES = ["Design", "Manufacturing", "Quality System", "Supplier", "Regulatory", "Validation", "Document", "Other"];
const PRIORITIES = ["Low", "Medium", "High", "Critical"];

export default function ChangeControlLandingPage() {
  const [changes, setChanges] = useState<ChangeControl[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [newChange, setNewChange] = useState({
    change_title: "",
    change_description: "",
    change_justification: "",
    change_type: "ECO",
    change_category: "Process",
    priority: "Medium",
    owner_email: "",
  });

  const fetchUser = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const email = userData?.user?.email || "";
    setUserEmail(email);
  };

  const fetchData = async () => {
    setLoading(true);
    await fetchUser();

    const { data, error } = await supabase
      .from("change_controls")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) alert(error.message);
    else setChanges((data as ChangeControl[]) || []);

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

  const filteredChanges = useMemo(() => {
    return changes.filter((change) => filterStatus === "all" || change.status === filterStatus);
  }, [changes, filterStatus]);

  const metrics = useMemo(() => ({
    total: changes.length,
    draft: changes.filter((c) => c.status === "draft").length,
    pending: changes.filter((c) => c.status === "pending_approval").length,
    approved: changes.filter((c) => c.status === "approved").length,
    implementation: changes.filter((c) => c.status === "implementation").length,
    verification: changes.filter((c) => c.status === "verification").length,
    closed: changes.filter((c) => c.status === "closed").length,
    highRisk: changes.filter((c) => c.risk_level === "High" || c.risk_level === "Critical").length,
  }), [changes]);

  const resetCreateForm = () => {
    setNewChange({
      change_title: "",
      change_description: "",
      change_justification: "",
      change_type: "ECO",
      change_category: "Process",
      priority: "Medium",
      owner_email: "",
    });
  };

  const createChange = async () => {
    if (!newChange.change_title.trim()) return alert("Change title is required.");
    if (!newChange.change_description.trim()) return alert("Change description is required.");
    if (!newChange.change_justification.trim()) return alert("Change justification is required.");
    if (newChange.owner_email && !normalizeEmail(newChange.owner_email)) return alert("Owner email must be valid.");

    const changeNumber = `CC-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

    const { data, error } = await supabase
      .from("change_controls")
      .insert({
        change_number: changeNumber,
        change_title: newChange.change_title.trim(),
        change_description: newChange.change_description.trim(),
        change_justification: newChange.change_justification.trim(),
        change_type: newChange.change_type,
        change_category: newChange.change_category,
        priority: newChange.priority,
        initiator_email: userEmail || null,
        owner_email: normalizeEmail(newChange.owner_email) || userEmail || null,
        approver_email: null,
        status: "draft",
        created_by: userEmail || "unknown",
      })
      .select()
      .single();

    if (error) return alert(error.message);
    window.location.href = `/change-control/${data.id}`;
  };

  if (loading) return <main style={pageStyle}>Loading Change Control...</main>;

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>CHANGE CONTROL / ECO</div>
          <h1 style={{ margin: "6px 0" }}>Change Control</h1>
          <p style={subtleText}>
            Initiate changes here. Impact assessment, risk review, approval, implementation, document linkage, verification, and closure are handled in the workflow.
          </p>
        </div>
        <a href="/dashboard" style={darkButtonStyle}>Dashboard</a>
      </header>

      <section style={kpiGridStyle}>
        <KpiCard title="Total Changes" value={metrics.total} color="#2563eb" />
        <KpiCard title="Draft" value={metrics.draft} color="#6b7280" />
        <KpiCard title="Pending Approval" value={metrics.pending} color="#d97706" />
        <KpiCard title="Approved" value={metrics.approved} color="#2563eb" />
        <KpiCard title="Implementation" value={metrics.implementation} color="#2563eb" />
        <KpiCard title="Verification" value={metrics.verification} color="#7c3aed" />
        <KpiCard title="Closed" value={metrics.closed} color="#15803d" />
        <KpiCard title="High/Critical Risk" value={metrics.highRisk} color="#dc2626" />
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <h2 style={{ margin: 0 }}>Change Register</h2>
            <p style={subtleText}>Search current and historical change records, then open the workflow to complete assessments and approvals.</p>
          </div>
          <button onClick={() => setShowCreateForm(true)} style={primaryButtonStyle}>Create Change Request</button>
        </div>

        <div style={filterRowStyle}>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={inputStyle}>
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="pending_approval">Pending Approval</option>
            <option value="approved">Approved</option>
            <option value="implementation">Implementation</option>
            <option value="verification">Verification</option>
            <option value="closed">Closed</option>
            <option value="rejected">Rejected</option>
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
                <th style={thStyle}>Workflow</th>
              </tr>
            </thead>
            <tbody>
              {filteredChanges.length === 0 ? (
                <tr><td colSpan={7} style={tdStyle}>No changes found.</td></tr>
              ) : filteredChanges.map((change) => (
                <tr key={change.id}>
                  <td style={tdStyle}>
                    <strong>{change.change_number || change.id}</strong>
                    <div>{change.change_title}</div>
                    <div style={smallTextStyle}>{change.change_description}</div>
                  </td>
                  <td style={tdStyle}>{change.change_type || "N/A"}</td>
                  <td style={tdStyle}>{change.priority || "N/A"}</td>
                  <td style={tdStyle}>{change.risk_level || "Not assessed"}</td>
                  <td style={tdStyle}><StatusBadge status={change.status || "draft"} /></td>
                  <td style={tdStyle}>{change.owner_email || "N/A"}</td>
                  <td style={tdStyle}><a href={`/change-control/${change.id}`} style={primaryLinkStyle}>Open Workflow</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <h2 style={{ margin: 0 }}>Initiate Change Request</h2>
            <p style={subtleText}>Capture the minimum change initiation package. Detailed impact, risk, approval matrix, implementation, and verification are completed in the workflow.</p>
          </div>
          <button onClick={() => setShowCreateForm(!showCreateForm)} style={showCreateForm ? secondaryButtonStyle : primaryButtonStyle}>
            {showCreateForm ? "Hide Form" : "Create New Change"}
          </button>
        </div>

        {showCreateForm ? (
          <>
            <div style={gridStyle}>
              <Field label="Change Title"><input value={newChange.change_title} onChange={(e) => setNewChange({ ...newChange, change_title: e.target.value })} style={inputStyle} /></Field>
              <Field label="Change Type"><select value={newChange.change_type} onChange={(e) => setNewChange({ ...newChange, change_type: e.target.value })} style={inputStyle}>{CHANGE_TYPES.map((x) => <option key={x} value={x}>{x}</option>)}</select></Field>
              <Field label="Change Category"><select value={newChange.change_category} onChange={(e) => setNewChange({ ...newChange, change_category: e.target.value })} style={inputStyle}>{CATEGORIES.map((x) => <option key={x} value={x}>{x}</option>)}</select></Field>
              <Field label="Priority"><select value={newChange.priority} onChange={(e) => setNewChange({ ...newChange, priority: e.target.value })} style={inputStyle}>{PRIORITIES.map((x) => <option key={x} value={x}>{x}</option>)}</select></Field>
              <Field label="Owner Email"><input type="email" value={newChange.owner_email} onChange={(e) => setNewChange({ ...newChange, owner_email: e.target.value })} placeholder={userEmail || "owner@company.com"} style={inputStyle} /></Field>
            </div>

            <Field label="Change Description"><textarea value={newChange.change_description} onChange={(e) => setNewChange({ ...newChange, change_description: e.target.value })} rows={4} style={textareaStyle} /></Field>
            <Field label="Change Justification / Rationale"><textarea value={newChange.change_justification} onChange={(e) => setNewChange({ ...newChange, change_justification: e.target.value })} rows={4} style={textareaStyle} /></Field>

            <div style={buttonRowStyle}>
              <button onClick={createChange} style={primaryButtonStyle}>Create Change Request</button>
              <button onClick={resetCreateForm} style={secondaryButtonStyle}>Reset</button>
            </div>
          </>
        ) : (
          <p style={subtleText}>The initiation form is collapsed to keep the change register visible.</p>
        )}
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div style={{ marginBottom: "12px" }}><label style={labelStyle}>{label}</label><div style={{ marginTop: "5px" }}>{children}</div></div>; }
function KpiCard({ title, value, color }: { title: string; value: number; color: string }) { return <div style={{ ...kpiCardStyle, borderLeft: `8px solid ${color}` }}><div style={kpiTitleStyle}>{title}</div><div style={{ fontSize: "30px", fontWeight: 800, color }}>{value}</div></div>; }
function getStatusLabel(status: string) { const labels: Record<string, string> = { draft: "Draft", pending_approval: "Pending Approval", approved: "Approved", implementation: "Implementation", verification: "Verification", closed: "Closed", rejected: "Rejected" }; return labels[status] || status; }
function StatusBadge({ status }: { status: string }) { const color = status === "closed" ? "#15803d" : status === "verification" ? "#7c3aed" : status === "implementation" ? "#2563eb" : status === "approved" ? "#2563eb" : status === "pending_approval" ? "#d97706" : status === "rejected" ? "#dc2626" : "#6b7280"; return <span style={{ background: color, color: "white", borderRadius: "999px", padding: "3px 8px", fontSize: "12px", fontWeight: 700 }}>{getStatusLabel(status)}</span>; }

const pageStyle: React.CSSProperties = { padding: "24px", background: "#f8fafc", minHeight: "100vh", fontFamily: "Arial, sans-serif" };
const headerStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-start", flexWrap: "wrap", marginBottom: "20px" };
const eyebrowStyle: React.CSSProperties = { fontSize: "12px", letterSpacing: "0.08em", color: "#6b7280", fontWeight: 800 };
const subtleText: React.CSSProperties = { color: "#6b7280" };
const cardStyle: React.CSSProperties = { background: "white", border: "1px solid #d1d5db", borderRadius: "16px", padding: "20px", marginBottom: "20px" };
const sectionHeaderStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: "14px", alignItems: "flex-start", flexWrap: "wrap", marginBottom: "16px" };
const gridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "14px" };
const kpiGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px", marginBottom: "20px" };
const kpiCardStyle: React.CSSProperties = { background: "white", border: "1px solid #d1d5db", borderRadius: "14px", padding: "16px" };
const kpiTitleStyle: React.CSSProperties = { color: "#6b7280", marginBottom: "8px" };
const labelStyle: React.CSSProperties = { fontWeight: 700 };
const inputStyle: React.CSSProperties = { width: "100%", padding: "9px", borderRadius: "8px", border: "1px solid #d1d5db" };
const textareaStyle: React.CSSProperties = { width: "100%", padding: "9px", borderRadius: "8px", border: "1px solid #d1d5db", marginTop: "6px" };
const primaryButtonStyle: React.CSSProperties = { background: "#2563eb", color: "white", border: "none", padding: "10px 14px", borderRadius: "8px", fontWeight: 700, cursor: "pointer", textDecoration: "none", display: "inline-block" };
const secondaryButtonStyle: React.CSSProperties = { background: "#111827", color: "white", border: "none", padding: "10px 14px", borderRadius: "8px", fontWeight: 700, cursor: "pointer", textDecoration: "none", display: "inline-block" };
const darkButtonStyle: React.CSSProperties = { background: "#111827", color: "white", padding: "10px 14px", borderRadius: "8px", textDecoration: "none", fontWeight: 700 };
const primaryLinkStyle: React.CSSProperties = { background: "#2563eb", color: "white", padding: "8px 12px", borderRadius: "8px", textDecoration: "none", fontWeight: 700, display: "inline-block" };
const buttonRowStyle: React.CSSProperties = { display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center", marginTop: "12px" };
const filterRowStyle: React.CSSProperties = { maxWidth: "260px", marginBottom: "14px" };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse" };
const thStyle: React.CSSProperties = { textAlign: "left", borderBottom: "1px solid #d1d5db", padding: "10px" };
const tdStyle: React.CSSProperties = { borderBottom: "1px solid #e5e7eb", padding: "10px", verticalAlign: "top" };
const smallTextStyle: React.CSSProperties = { fontSize: "12px", color: "#6b7280" };
