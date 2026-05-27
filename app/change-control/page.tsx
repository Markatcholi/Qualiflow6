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
  approver_email: string | null;
  risk_level: string | null;
  created_at: string | null;
};

const CHANGE_TYPES = ["ECO", "Process", "Document", "Supplier", "Software", "Equipment", "Material", "Other"];
const CATEGORIES = ["Design", "Manufacturing", "Quality System", "Supplier", "Regulatory", "Validation", "Document", "Other"];
const PRIORITIES = ["Low", "Medium", "High", "Critical"];
const RISKS = ["Low", "Medium", "High", "Critical"];

export default function ChangeControlLandingPage() {
  const [changes, setChanges] = useState<ChangeControl[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

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
    closed: changes.filter((c) => c.status === "closed").length,
    highRisk: changes.filter((c) => c.risk_level === "High" || c.risk_level === "Critical").length,
  }), [changes]);

  const createChange = async () => {
    if (!newChange.change_title.trim()) return alert("Change title is required.");
    if (!newChange.change_description.trim()) return alert("Change description is required.");
    if (!newChange.change_justification.trim()) return alert("Change justification is required.");
    if (newChange.owner_email && !normalizeEmail(newChange.owner_email)) return alert("Owner email must be valid.");
    if (newChange.approver_email && !normalizeEmail(newChange.approver_email)) return alert("Approver email must be valid.");

    const changeNumber = `CC-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

    const { data, error } = await supabase
      .from("change_controls")
      .insert({
        change_number: changeNumber,
        ...newChange,
        initiator_email: userEmail || null,
        owner_email: normalizeEmail(newChange.owner_email) || userEmail || null,
        approver_email: normalizeEmail(newChange.approver_email) || null,
        implementation_owner_email: normalizeEmail(newChange.implementation_owner_email) || null,
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
          <h1 style={{ margin: "6px 0" }}>Submit a Change Request</h1>
          <p style={subtleText}>
            Start a change request here. Review, approval, affected documents, implementation tasks, and closure are handled on the change workflow page.
          </p>
        </div>
        <a href="/dashboard" style={darkButtonStyle}>Dashboard</a>
      </header>

      <section style={kpiGridStyle}>
        <KpiCard title="Total Changes" value={metrics.total} color="#2563eb" />
        <KpiCard title="Draft" value={metrics.draft} color="#6b7280" />
        <KpiCard title="Pending Approval" value={metrics.pending} color="#d97706" />
        <KpiCard title="Implementation" value={metrics.implementation} color="#2563eb" />
        <KpiCard title="Closed" value={metrics.closed} color="#15803d" />
        <KpiCard title="High/Critical Risk" value={metrics.highRisk} color="#dc2626" />
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Initiate Change Request</h2>
        <div style={gridStyle}>
          <Field label="Change Title"><input value={newChange.change_title} onChange={(e) => setNewChange({ ...newChange, change_title: e.target.value })} style={inputStyle} /></Field>
          <Field label="Change Type"><select value={newChange.change_type} onChange={(e) => setNewChange({ ...newChange, change_type: e.target.value })} style={inputStyle}>{CHANGE_TYPES.map((x) => <option key={x} value={x}>{x}</option>)}</select></Field>
          <Field label="Change Category"><select value={newChange.change_category} onChange={(e) => setNewChange({ ...newChange, change_category: e.target.value })} style={inputStyle}>{CATEGORIES.map((x) => <option key={x} value={x}>{x}</option>)}</select></Field>
          <Field label="Priority"><select value={newChange.priority} onChange={(e) => setNewChange({ ...newChange, priority: e.target.value })} style={inputStyle}>{PRIORITIES.map((x) => <option key={x} value={x}>{x}</option>)}</select></Field>
          <Field label="Risk Level"><select value={newChange.risk_level} onChange={(e) => setNewChange({ ...newChange, risk_level: e.target.value })} style={inputStyle}>{RISKS.map((x) => <option key={x} value={x}>{x}</option>)}</select></Field>
          <Field label="Owner Email"><input type="email" value={newChange.owner_email} onChange={(e) => setNewChange({ ...newChange, owner_email: e.target.value })} style={inputStyle} /></Field>
          <Field label="Approver Email"><input type="email" value={newChange.approver_email} onChange={(e) => setNewChange({ ...newChange, approver_email: e.target.value })} style={inputStyle} /></Field>
        </div>

        <Field label="Change Description"><textarea value={newChange.change_description} onChange={(e) => setNewChange({ ...newChange, change_description: e.target.value })} rows={4} style={textareaStyle} /></Field>
        <Field label="Change Justification / Rationale"><textarea value={newChange.change_justification} onChange={(e) => setNewChange({ ...newChange, change_justification: e.target.value })} rows={4} style={textareaStyle} /></Field>

        <section style={subCardStyle}>
          <h3 style={{ marginTop: 0 }}>Impact Assessment</h3>
          <div style={checkboxGridStyle}>
            {[["product_impact", "Product"], ["document_impact", "Document"], ["process_impact", "Process"], ["equipment_impact", "Equipment"], ["supplier_impact", "Supplier"], ["software_impact", "Software"], ["regulatory_impact", "Regulatory"], ["validation_impact", "Validation"], ["training_impact", "Training"]].map(([key, label]) => (
              <label key={key}><input type="checkbox" checked={(newChange as any)[key]} onChange={(e) => setNewChange({ ...newChange, [key]: e.target.checked } as any)} /> {label}</label>
            ))}
          </div>
          <Field label="Impact Assessment Summary"><textarea value={newChange.impact_assessment} onChange={(e) => setNewChange({ ...newChange, impact_assessment: e.target.value })} rows={4} style={textareaStyle} /></Field>
        </section>

        <section style={subCardStyle}>
          <h3 style={{ marginTop: 0 }}>Risk Review</h3>
          <Field label="Risk Review Summary"><textarea value={newChange.risk_review_summary} onChange={(e) => setNewChange({ ...newChange, risk_review_summary: e.target.value })} rows={4} style={textareaStyle} /></Field>
          <div style={gridStyle}>
            <Field label="Risk Acceptability"><input value={newChange.risk_acceptability} onChange={(e) => setNewChange({ ...newChange, risk_acceptability: e.target.value })} style={inputStyle} /></Field>
            <Field label="Residual Risk"><input value={newChange.residual_risk} onChange={(e) => setNewChange({ ...newChange, residual_risk: e.target.value })} style={inputStyle} /></Field>
          </div>
        </section>

        <section style={subCardStyle}>
          <h3 style={{ marginTop: 0 }}>Implementation / Verification</h3>
          <div style={gridStyle}>
            <Field label="Implementation Owner Email"><input type="email" value={newChange.implementation_owner_email} onChange={(e) => setNewChange({ ...newChange, implementation_owner_email: e.target.value })} style={inputStyle} /></Field>
            <Field label="Target Implementation Date"><input type="date" value={newChange.target_implementation_date} onChange={(e) => setNewChange({ ...newChange, target_implementation_date: e.target.value })} style={inputStyle} /></Field>
          </div>
          <Field label="Implementation Plan"><textarea value={newChange.implementation_plan} onChange={(e) => setNewChange({ ...newChange, implementation_plan: e.target.value })} rows={4} style={textareaStyle} /></Field>
          <Field label="Verification Plan"><textarea value={newChange.verification_plan} onChange={(e) => setNewChange({ ...newChange, verification_plan: e.target.value })} rows={4} style={textareaStyle} /></Field>
          <label><input type="checkbox" checked={newChange.effectiveness_required} onChange={(e) => setNewChange({ ...newChange, effectiveness_required: e.target.checked })} /> Effectiveness Check Required</label>
          <Field label="Effectiveness Plan"><textarea value={newChange.effectiveness_plan} onChange={(e) => setNewChange({ ...newChange, effectiveness_plan: e.target.value })} rows={3} style={textareaStyle} /></Field>
        </section>

        <button onClick={createChange} style={primaryButtonStyle}>Submit Change Request</button>
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Change Register</h2>
        <div style={filterRowStyle}><select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={inputStyle}><option value="all">All Statuses</option><option value="draft">Draft</option><option value="pending_approval">Pending Approval</option><option value="approved">Approved</option><option value="implementation">Implementation</option><option value="closed">Closed</option></select></div>
        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead><tr><th style={thStyle}>Change</th><th style={thStyle}>Type</th><th style={thStyle}>Priority</th><th style={thStyle}>Risk</th><th style={thStyle}>Status</th><th style={thStyle}>Owner</th><th style={thStyle}>Workflow</th></tr></thead>
            <tbody>{filteredChanges.map((change) => <tr key={change.id}><td style={tdStyle}><strong>{change.change_number || change.id}</strong><div>{change.change_title}</div><div style={smallTextStyle}>{change.change_description}</div></td><td style={tdStyle}>{change.change_type}</td><td style={tdStyle}>{change.priority}</td><td style={tdStyle}>{change.risk_level}</td><td style={tdStyle}><StatusBadge status={change.status || "draft"} /></td><td style={tdStyle}>{change.owner_email || "N/A"}</td><td style={tdStyle}><a href={`/change-control/${change.id}`} style={primaryLinkStyle}>Open Workflow</a></td></tr>)}</tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div style={{ marginBottom: "12px" }}><label style={labelStyle}>{label}</label><div style={{ marginTop: "5px" }}>{children}</div></div>; }
function KpiCard({ title, value, color }: { title: string; value: number; color: string }) { return <div style={{ ...kpiCardStyle, borderLeft: `8px solid ${color}` }}><div style={kpiTitleStyle}>{title}</div><div style={{ fontSize: "30px", fontWeight: 800, color }}>{value}</div></div>; }
function StatusBadge({ status }: { status: string }) { const color = status === "closed" ? "#15803d" : status === "implementation" ? "#2563eb" : status === "approved" ? "#2563eb" : status === "pending_approval" ? "#d97706" : "#6b7280"; return <span style={{ background: color, color: "white", borderRadius: "999px", padding: "3px 8px", fontSize: "12px", fontWeight: 700 }}>{status}</span>; }

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
const primaryLinkStyle: React.CSSProperties = { background: "#2563eb", color: "white", padding: "8px 12px", borderRadius: "8px", textDecoration: "none", fontWeight: 700, display: "inline-block" };
const filterRowStyle: React.CSSProperties = { maxWidth: "260px", marginBottom: "14px" };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse" };
const thStyle: React.CSSProperties = { textAlign: "left", borderBottom: "1px solid #d1d5db", padding: "10px" };
const tdStyle: React.CSSProperties = { borderBottom: "1px solid #e5e7eb", padding: "10px", verticalAlign: "top" };
const smallTextStyle: React.CSSProperties = { fontSize: "12px", color: "#6b7280" };
