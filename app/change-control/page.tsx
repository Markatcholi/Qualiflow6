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
  initiator_email?: string | null;
  risk_level: string | null;
  created_at: string | null;
  closed_at?: string | null;
  approved_at?: string | null;
  target_implementation_date?: string | null;
};

const CHANGE_TYPES = [
  "ECO",
  "Process",
  "Document",
  "Supplier",
  "Software",
  "Equipment",
  "Material",
  "Other",
];
const CATEGORIES = [
  "Design",
  "Manufacturing",
  "Quality System",
  "Supplier",
  "Regulatory",
  "Validation",
  "Document",
  "Other",
];
const PRIORITIES = ["Low", "Medium", "High", "Critical"];

const OPEN_STATUSES = [
  "draft",
  "pending_approval",
  "approved",
  "implementation",
  "verification",
  "rejected",
];

export default function ChangeControlLandingPage() {
  const [changes, setChanges] = useState<ChangeControl[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [quickFilter, setQuickFilter] = useState("all");
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

  const daysBetween = (startDate?: string | null, endDate?: string | null) => {
    if (!startDate) return 0;
    const start = new Date(startDate).getTime();
    const end = endDate ? new Date(endDate).getTime() : new Date().getTime();
    if (Number.isNaN(start) || Number.isNaN(end)) return 0;
    return Math.max(0, Math.floor((end - start) / (1000 * 60 * 60 * 24)));
  };

  const isOpen = (change: ChangeControl) =>
    OPEN_STATUSES.includes(change.status || "draft");

  const isOverdue = (change: ChangeControl) => {
    if (!isOpen(change)) return false;
    if (change.target_implementation_date) {
      const target = new Date(change.target_implementation_date).getTime();
      return !Number.isNaN(target) && target < new Date().getTime();
    }
    return daysBetween(change.created_at) > 45;
  };

  const isHighRisk = (change: ChangeControl) =>
    change.risk_level === "High" ||
    change.risk_level === "Critical" ||
    change.priority === "Critical";

  const filteredChanges = useMemo(() => {
    return changes.filter((change) => {
      const statusMatch = filterStatus === "all" || change.status === filterStatus;
      const normalizedUser = normalizeEmail(userEmail);
      const owner = normalizeEmail(change.owner_email || "");
      const initiator = normalizeEmail(change.initiator_email || "");

      let quickMatch = true;
      if (quickFilter === "my_changes") {
        quickMatch = Boolean(normalizedUser && (owner === normalizedUser || initiator === normalizedUser));
      }
      if (quickFilter === "open") quickMatch = isOpen(change);
      if (quickFilter === "overdue") quickMatch = isOverdue(change);
      if (quickFilter === "high_risk") quickMatch = isHighRisk(change);
      if (quickFilter === "implementation") quickMatch = change.status === "implementation";
      if (quickFilter === "verification") quickMatch = change.status === "verification";
      if (quickFilter === "pending_approval") quickMatch = change.status === "pending_approval";

      return statusMatch && quickMatch;
    });
  }, [changes, filterStatus, quickFilter, userEmail]);

  const metrics = useMemo(() => {
    const closedChanges = changes.filter((c) => c.status === "closed");
    const closedDays = closedChanges.map((c) => daysBetween(c.created_at, c.closed_at));
    const averageClosureDays = closedDays.length
      ? Math.round(closedDays.reduce((sum, value) => sum + value, 0) / closedDays.length)
      : 0;

    return {
      total: changes.length,
      open: changes.filter((c) => isOpen(c)).length,
      draft: changes.filter((c) => c.status === "draft").length,
      pending: changes.filter((c) => c.status === "pending_approval").length,
      approved: changes.filter((c) => c.status === "approved").length,
      implementation: changes.filter((c) => c.status === "implementation").length,
      verification: changes.filter((c) => c.status === "verification").length,
      closed: closedChanges.length,
      rejected: changes.filter((c) => c.status === "rejected").length,
      overdue: changes.filter((c) => isOverdue(c)).length,
      highRisk: changes.filter((c) => isHighRisk(c)).length,
      averageClosureDays,
    };
  }, [changes]);

  const aging = useMemo(() => {
    const openChanges = changes.filter((change) => isOpen(change));
    return {
      zeroToThirty: openChanges.filter((c) => daysBetween(c.created_at) <= 30).length,
      thirtyOneToSixty: openChanges.filter((c) => {
        const days = daysBetween(c.created_at);
        return days >= 31 && days <= 60;
      }).length,
      sixtyOneToNinety: openChanges.filter((c) => {
        const days = daysBetween(c.created_at);
        return days >= 61 && days <= 90;
      }).length,
      overNinety: openChanges.filter((c) => daysBetween(c.created_at) > 90).length,
    };
  }, [changes]);

  const statusCounts = useMemo(() => {
    return [
      { label: "Draft", count: metrics.draft },
      { label: "Pending Approval", count: metrics.pending },
      { label: "Approved", count: metrics.approved },
      { label: "Implementation", count: metrics.implementation },
      { label: "Verification", count: metrics.verification },
      { label: "Closed", count: metrics.closed },
      { label: "Rejected", count: metrics.rejected },
    ];
  }, [metrics]);

  const typeCounts = useMemo(() => {
    return CHANGE_TYPES.map((type) => ({
      label: type,
      count: changes.filter((change) => change.change_type === type).length,
    })).filter((item) => item.count > 0);
  }, [changes]);

  const riskCounts = useMemo(() => {
    const levels = ["Not assessed", "Low", "Medium", "High", "Critical"];
    return levels.map((level) => ({
      label: level,
      count: changes.filter((change) => (change.risk_level || "Not assessed") === level).length,
    })).filter((item) => item.count > 0);
  }, [changes]);

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
        <div style={buttonRowStyle}>
          <button onClick={() => setShowCreateForm(true)} style={primaryButtonStyle}>Create Change Request</button>
          <a href="/dashboard" style={darkButtonStyle}>Dashboard</a>
        </div>
      </header>

      <section style={kpiGridStyle}>
        <KpiCard title="Total Changes" value={metrics.total} color="#2563eb" />
        <KpiCard title="Open" value={metrics.open} color="#d97706" />
        <KpiCard title="Pending Approval" value={metrics.pending} color="#d97706" />
        <KpiCard title="Implementation" value={metrics.implementation} color="#2563eb" />
        <KpiCard title="Verification" value={metrics.verification} color="#7c3aed" />
        <KpiCard title="Closed" value={metrics.closed} color="#15803d" />
        <KpiCard title="Overdue" value={metrics.overdue} color="#dc2626" />
        <KpiCard title="High/Critical Risk" value={metrics.highRisk} color="#dc2626" />
        <KpiCard title="Avg Days to Close" value={metrics.averageClosureDays} color="#111827" />
      </section>

      <section style={analyticsGridStyle}>
        <SummaryCard title="Status Distribution" rows={statusCounts} />
        <SummaryCard title="Changes by Type" rows={typeCounts.length ? typeCounts : [{ label: "No data", count: 0 }]} />
        <SummaryCard title="Changes by Risk" rows={riskCounts.length ? riskCounts : [{ label: "No data", count: 0 }]} />
        <div style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>Open Change Aging</h3>
          <AgingRow label="0–30 Days" value={aging.zeroToThirty} color="#15803d" />
          <AgingRow label="31–60 Days" value={aging.thirtyOneToSixty} color="#d97706" />
          <AgingRow label="61–90 Days" value={aging.sixtyOneToNinety} color="#ea580c" />
          <AgingRow label=">90 Days" value={aging.overNinety} color="#dc2626" />
        </div>
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <h2 style={{ margin: 0 }}>Change Register</h2>
            <p style={subtleText}>Search current and historical change records, then open the workflow to complete assessments and approvals.</p>
          </div>
          <button onClick={() => setShowCreateForm(true)} style={primaryButtonStyle}>Create Change Request</button>
        </div>

        <div style={filterPanelStyle}>
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
          <div style={quickFilterRowStyle}>
            <QuickFilterButton label="All" active={quickFilter === "all"} onClick={() => setQuickFilter("all")} />
            <QuickFilterButton label="My Changes" active={quickFilter === "my_changes"} onClick={() => setQuickFilter("my_changes")} />
            <QuickFilterButton label="Open" active={quickFilter === "open"} onClick={() => setQuickFilter("open")} />
            <QuickFilterButton label="Pending Approval" active={quickFilter === "pending_approval"} onClick={() => setQuickFilter("pending_approval")} />
            <QuickFilterButton label="Implementation" active={quickFilter === "implementation"} onClick={() => setQuickFilter("implementation")} />
            <QuickFilterButton label="Verification" active={quickFilter === "verification"} onClick={() => setQuickFilter("verification")} />
            <QuickFilterButton label="Overdue" active={quickFilter === "overdue"} onClick={() => setQuickFilter("overdue")} />
            <QuickFilterButton label="High Risk" active={quickFilter === "high_risk"} onClick={() => setQuickFilter("high_risk")} />
          </div>
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
                <th style={thStyle}>Created</th>
                <th style={thStyle}>Days Open</th>
                <th style={thStyle}>Workflow</th>
              </tr>
            </thead>
            <tbody>
              {filteredChanges.length === 0 ? (
                <tr><td colSpan={9} style={tdStyle}>No changes found.</td></tr>
              ) : filteredChanges.map((change) => {
                const daysOpen = change.status === "closed" ? daysBetween(change.created_at, change.closed_at) : daysBetween(change.created_at);
                return (
                  <tr key={change.id}>
                    <td style={tdStyle}>
                      <strong>{change.change_number || change.id}</strong>
                      <div>{change.change_title}</div>
                      <div style={smallTextStyle}>{change.change_description}</div>
                      {isOverdue(change) ? <div style={overdueTextStyle}>Overdue / Aging Alert</div> : null}
                    </td>
                    <td style={tdStyle}>{change.change_type || "N/A"}</td>
                    <td style={tdStyle}>{change.priority || "N/A"}</td>
                    <td style={tdStyle}>{change.risk_level || "Not assessed"}</td>
                    <td style={tdStyle}><StatusBadge status={change.status || "draft"} /></td>
                    <td style={tdStyle}>{change.owner_email || "N/A"}</td>
                    <td style={tdStyle}>{formatDate(change.created_at)}</td>
                    <td style={tdStyle}>{daysOpen}</td>
                    <td style={tdStyle}><a href={`/change-control/${change.id}`} style={primaryLinkStyle}>Open Workflow</a></td>
                  </tr>
                );
              })}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: "12px" }}><label style={labelStyle}>{label}</label><div style={{ marginTop: "5px" }}>{children}</div></div>;
}

function KpiCard({ title, value, color }: { title: string; value: number; color: string }) {
  return <div style={{ ...kpiCardStyle, borderLeft: `8px solid ${color}` }}><div style={kpiTitleStyle}>{title}</div><div style={{ fontSize: "30px", fontWeight: 800, color }}>{value}</div></div>;
}

function SummaryCard({ title, rows }: { title: string; rows: { label: string; count: number }[] }) {
  return (
    <div style={cardStyle}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      {rows.map((row) => (
        <div key={row.label} style={summaryRowStyle}>
          <span>{row.label}</span>
          <strong>{row.count}</strong>
        </div>
      ))}
    </div>
  );
}

function AgingRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={summaryRowStyle}>
      <span>{label}</span>
      <strong style={{ color }}>{value}</strong>
    </div>
  );
}

function QuickFilterButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={active ? activeFilterButtonStyle : filterButtonStyle}>
      {label}
    </button>
  );
}

function getStatusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "Draft",
    pending_approval: "Pending Approval",
    approved: "Approved",
    implementation: "Implementation",
    verification: "Verification",
    closed: "Closed",
    rejected: "Rejected",
  };
  return labels[status] || status;
}

function StatusBadge({ status }: { status: string }) {
  const color = status === "closed"
    ? "#15803d"
    : status === "verification"
    ? "#7c3aed"
    : status === "implementation"
    ? "#2563eb"
    : status === "approved"
    ? "#2563eb"
    : status === "pending_approval"
    ? "#d97706"
    : status === "rejected"
    ? "#dc2626"
    : "#6b7280";
  return <span style={{ background: color, color: "white", borderRadius: "999px", padding: "3px 8px", fontSize: "12px", fontWeight: 700 }}>{getStatusLabel(status)}</span>;
}

function formatDate(value?: string | null) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString();
}

const pageStyle: React.CSSProperties = { padding: "24px", background: "#f8fafc", minHeight: "100vh", fontFamily: "Arial, sans-serif" };
const headerStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-start", flexWrap: "wrap", marginBottom: "20px" };
const eyebrowStyle: React.CSSProperties = { fontSize: "12px", letterSpacing: "0.08em", color: "#6b7280", fontWeight: 800 };
const subtleText: React.CSSProperties = { color: "#6b7280" };
const cardStyle: React.CSSProperties = { background: "white", border: "1px solid #d1d5db", borderRadius: "16px", padding: "20px", marginBottom: "20px" };
const sectionHeaderStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: "14px", alignItems: "flex-start", flexWrap: "wrap", marginBottom: "16px" };
const gridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "14px" };
const kpiGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px", marginBottom: "20px" };
const analyticsGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "14px", marginBottom: "20px" };
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
const filterPanelStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "minmax(220px, 260px) 1fr", gap: "12px", alignItems: "start", marginBottom: "14px" };
const quickFilterRowStyle: React.CSSProperties = { display: "flex", gap: "8px", flexWrap: "wrap" };
const filterButtonStyle: React.CSSProperties = { background: "#f3f4f6", color: "#111827", border: "1px solid #d1d5db", padding: "8px 10px", borderRadius: "999px", fontWeight: 700, cursor: "pointer" };
const activeFilterButtonStyle: React.CSSProperties = { ...filterButtonStyle, background: "#2563eb", color: "white", border: "1px solid #2563eb" };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse" };
const thStyle: React.CSSProperties = { textAlign: "left", borderBottom: "1px solid #d1d5db", padding: "10px" };
const tdStyle: React.CSSProperties = { borderBottom: "1px solid #e5e7eb", padding: "10px", verticalAlign: "top" };
const smallTextStyle: React.CSSProperties = { fontSize: "12px", color: "#6b7280" };
const overdueTextStyle: React.CSSProperties = { fontSize: "12px", color: "#dc2626", fontWeight: 800, marginTop: "4px" };
const summaryRowStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: "12px", borderBottom: "1px solid #e5e7eb", padding: "8px 0" };
